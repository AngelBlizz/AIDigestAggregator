from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, case
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import json
import csv
import io

from app.db.session import get_db
from app.core.security import get_current_user, get_current_active_superuser
from app.models.models import User, Article, Topic, Digest
from app.schemas.analytics import AnalyticsSummary, TopicDistribution, SentimentAnalytics, SourceAnalytics
from app.core.cache import cached, invalidate_cache

router = APIRouter()

@router.get("/summary", response_model=AnalyticsSummary)
@cached(namespace="analytics.summary", ttl=1800)  # Кэш на 30 минут
async def get_analytics_summary(
    days: int = Query(30, description="Число дней для включения в анализ"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получить сводку аналитических данных для контента текущего пользователя.
    """
    # Вычислить дату отсечения
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Получить темы пользователя
    user_topic_ids = [topic.id for topic in current_user.topics]
    
    if not user_topic_ids:
        return {
            "total_articles": 0,
            "total_digests": 0,
            "avg_sentiment_score": 0,
            "positive_articles": 0,
            "negative_articles": 0,
            "neutral_articles": 0,
            "most_popular_topics": [],
            "most_active_sources": []
        }
    
    # Запрос статей из тем пользователя
    articles_query = db.query(Article).filter(
        Article.topic_id.in_(user_topic_ids),
        Article.published_at >= cutoff_date
    )
    
    # Получить общее количество статей
    total_articles = articles_query.count()
    
    if total_articles == 0:
        return {
            "total_articles": 0,
            "total_digests": 0,
            "avg_sentiment_score": 0,
            "positive_articles": 0,
            "negative_articles": 0,
            "neutral_articles": 0,
            "most_popular_topics": [],
            "most_active_sources": []
        }
    
    # Получить количество дайджестов
    total_digests = db.query(Digest).filter(
        Digest.user_id == current_user.id,
        Digest.created_at >= cutoff_date
    ).count()
    
    # Вычислить статистику по тональности
    sentiment_stats = db.query(
        func.avg(Article.sentiment_score).label("avg_score"),
        func.sum(case((Article.sentiment_score > 0.2, 1), else_=0)).label("positive"),
        func.sum(case((Article.sentiment_score < -0.2, 1), else_=0)).label("negative"),
        func.sum(case((and_(Article.sentiment_score >= -0.2, Article.sentiment_score <= 0.2), 1), else_=0)).label("neutral")
    ).filter(
        Article.topic_id.in_(user_topic_ids),
        Article.published_at >= cutoff_date,
        Article.sentiment_score.isnot(None)
    ).first()
    
    # Получить наиболее популярные темы
    popular_topics = db.query(
        Topic.name,
        func.count(Article.id).label("article_count")
    ).join(Article).filter(
        Topic.id.in_(user_topic_ids),
        Article.published_at >= cutoff_date
    ).group_by(Topic.name).order_by(desc("article_count")).limit(5).all()
    
    # Получить наиболее активные источники
    active_sources = db.query(
        Article.source,
        func.count(Article.id).label("article_count")
    ).filter(
        Article.topic_id.in_(user_topic_ids),
        Article.published_at >= cutoff_date
    ).group_by(Article.source).order_by(desc("article_count")).limit(5).all()
    
    return {
        "total_articles": total_articles,
        "total_digests": total_digests,
        "avg_sentiment_score": sentiment_stats.avg_score if sentiment_stats and sentiment_stats.avg_score else 0,
        "positive_articles": sentiment_stats.positive if sentiment_stats and sentiment_stats.positive else 0,
        "negative_articles": sentiment_stats.negative if sentiment_stats and sentiment_stats.negative else 0,
        "neutral_articles": sentiment_stats.neutral if sentiment_stats and sentiment_stats.neutral else 0,
        "most_popular_topics": [{"name": t.name, "count": t.article_count} for t in popular_topics],
        "most_active_sources": [{"name": s.source, "count": s.article_count} for s in active_sources]
    }

@router.get("/topic-distribution", response_model=TopicDistribution)
@cached(namespace="analytics.topics", ttl=1800)  # Кэш на 30 минут
async def get_topic_distribution(
    days: int = Query(30, description="Число дней для включения в анализ"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получить распределение статей по темам.
    """
    # Вычислить дату отсечения
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Получить темы пользователя
    user_topic_ids = [topic.id for topic in current_user.topics]
    
    if not user_topic_ids:
        return {"topics": []}
    
    # Получить распределение статей по темам
    topic_distribution = db.query(
        Topic.id,
        Topic.name,
        Topic.category,
        func.count(Article.id).label("article_count")
    ).outerjoin(Article, and_(
        Article.topic_id == Topic.id,
        Article.published_at >= cutoff_date
    )).filter(
        Topic.id.in_(user_topic_ids)
    ).group_by(Topic.id, Topic.name, Topic.category).all()
    
    return {
        "topics": [
            {
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "article_count": t.article_count
            } 
            for t in topic_distribution
        ]
    }

@router.get("/sentiment-over-time", response_model=SentimentAnalytics)
@cached(namespace="analytics.sentiment", ttl=1800)  # Кэш на 30 минут
async def get_sentiment_over_time(
    days: int = Query(30, description="Число дней для включения в анализ"),
    interval: str = Query("day", description="Интервал для группировки (день, неделя, месяц)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получить аналитические данные по тональности за период времени.
    """
    # Вычислить дату отсечения
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Получить темы пользователя
    user_topic_ids = [topic.id for topic in current_user.topics]
    
    if not user_topic_ids:
        return {"time_periods": []}
    
    # Определить усечение даты на основе интервала
    if interval == "week":
        date_trunc = func.date_trunc('week', Article.published_at)
    elif interval == "month":
        date_trunc = func.date_trunc('month', Article.published_at)
    else:  # default to day
        date_trunc = func.date_trunc('day', Article.published_at)
    
    # Получить данные по тональности за период времени
    sentiment_data = db.query(
        date_trunc.label("period"),
        func.avg(Article.sentiment_score).label("avg_sentiment"),
        func.count(Article.id).label("article_count")
    ).filter(
        Article.topic_id.in_(user_topic_ids),
        Article.published_at >= cutoff_date,
        Article.sentiment_score.isnot(None)
    ).group_by("period").order_by("period").all()
    
    return {
        "time_periods": [
            {
                "period": data.period.strftime("%Y-%m-%d"),
                "avg_sentiment": float(data.avg_sentiment) if data.avg_sentiment is not None else 0,
                "article_count": data.article_count
            }
            for data in sentiment_data
        ]
    }

@router.get("/sources", response_model=SourceAnalytics)
@cached(namespace="analytics.sources", ttl=1800)  # Кэш на 30 минут
async def get_source_analytics(
    days: int = Query(30, description="Число дней для включения в анализ"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получить аналитические данные для новостных источников.
    """
    # Вычислить дату отсечения
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Получить темы пользователя
    user_topic_ids = [topic.id for topic in current_user.topics]
    
    if not user_topic_ids:
        return {"sources": []}
    
    # Получить статистику по источникам
    source_data = db.query(
        Article.source,
        func.count(Article.id).label("article_count"),
        func.avg(Article.sentiment_score).label("avg_sentiment")
    ).filter(
        Article.topic_id.in_(user_topic_ids),
        Article.published_at >= cutoff_date
    ).group_by(Article.source).order_by(desc("article_count")).all()
    
    return {
        "sources": [
            {
                "name": s.source,
                "article_count": s.article_count,
                "avg_sentiment": float(s.avg_sentiment) if s.avg_sentiment is not None else 0
            }
            for s in source_data
        ]
    }

@router.get("/export/csv")
async def export_analytics_csv(
    days: int = Query(30, description="Число дней для включения в экспорт"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Экспорт аналитических данных в виде CSV файла.
    """
    # Вычислить дату отсечения
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Получить темы пользователя
    user_topic_ids = [topic.id for topic in current_user.topics]
    
    if not user_topic_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No topics selected for analytics export"
        )
    
    # Запрос статей из тем пользователя
    articles = db.query(
        Article.id,
        Article.title,
        Article.source,
        Article.published_at,
        Article.sentiment_score,
        Topic.name.label("topic_name")
    ).join(Topic).filter(
        Article.topic_id.in_(user_topic_ids),
        Article.published_at >= cutoff_date
    ).all()
    
    if not articles:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No articles found for the selected period"
        )
    
    # Создать CSV вывод
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Записать заголовки
    writer.writerow(['ID', 'Title', 'Source', 'Published Date', 'Sentiment Score', 'Topic'])
    
    # Записать строки данных
    for article in articles:
        writer.writerow([
            article.id,
            article.title,
            article.source,
            article.published_at.strftime("%Y-%m-%d %H:%M"),
            article.sentiment_score if article.sentiment_score is not None else "N/A",
            article.topic_name
        ])
    
    # Подготовить ответ
    response = Response(content=output.getvalue())
    response.headers["Content-Disposition"] = f"attachment; filename=analytics_export_{datetime.now().strftime('%Y%m%d')}.csv"
    response.headers["Content-Type"] = "text/csv"
    
    return response

@router.get("/export/json")
async def export_analytics_json(
    days: int = Query(30, description="Число дней для включения в экспорт"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Экспорт аналитических данных в виде JSON файла.
    """
    # Вычислить дату отсечения
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Получить темы пользователя
    user_topic_ids = [topic.id for topic in current_user.topics]
    
    if not user_topic_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No topics selected for analytics export"
        )
    
    # Запрос статей из тем пользователя
    articles = db.query(
        Article.id,
        Article.title,
        Article.source,
        Article.published_at,
        Article.sentiment_score,
        Article.sentiment_details,
        Article.keywords,
        Article.entities,
        Topic.name.label("topic_name")
    ).join(Topic).filter(
        Article.topic_id.in_(user_topic_ids),
        Article.published_at >= cutoff_date
    ).all()
    
    if not articles:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No articles found for the selected period"
        )
    
    # Создать JSON данные
    export_data = {
        "export_date": datetime.now().isoformat(),
        "user_id": current_user.id,
        "period_days": days,
        "articles": [
            {
                "id": article.id,
                "title": article.title,
                "source": article.source,
                "published_at": article.published_at.isoformat(),
                "topic": article.topic_name,
                "sentiment_score": article.sentiment_score,
                "sentiment_details": json.loads(article.sentiment_details) if article.sentiment_details else None,
                "keywords": json.loads(article.keywords) if article.keywords else [],
                "entities": json.loads(article.entities) if article.entities else []
            }
            for article in articles
        ]
    }
    
    # Подготовить ответ
    response = Response(content=json.dumps(export_data, ensure_ascii=False, indent=2))
    response.headers["Content-Disposition"] = f"attachment; filename=analytics_export_{datetime.now().strftime('%Y%m%d')}.json"
    response.headers["Content-Type"] = "application/json"
    
    return response 