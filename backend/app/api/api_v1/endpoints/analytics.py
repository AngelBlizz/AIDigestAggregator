from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, case, cast, Float
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import json
import csv
import io
import logging

from app.db.session import get_db
from app.core.security import get_current_user, get_current_active_superuser
from app.models.models import User, Article, Topic, Digest, DigestArticle
from app.schemas.analytics import AnalyticsSummary, TopicDistribution, SentimentAnalytics, SourceAnalytics, SentimentStats, TopicStats, SourceStats, EntityStats
from app.core.cache import cached, invalidate_cache

# Настраиваем логгирование
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/summary", response_model=AnalyticsSummary)
@cached(namespace="analytics.summary", ttl=1800)  # Кэш на 30 минут
def get_analytics_summary(
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
def get_topic_distribution(
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
def get_sentiment_over_time(
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
def get_source_analytics(
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
def export_analytics_csv(
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
def export_analytics_json(
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

@router.get("/sentiment", response_model=SentimentStats)
def get_sentiment_stats(
    days: int = Query(30, description="Number of days to analyze"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение статистики по тональности статей.
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Получаем все статьи из дайджестов пользователя
        user_digest_articles = (
            db.query(Article)
            .join(Article.digest_articles)
            .join(DigestArticle.digest)
            .filter(Digest.user_id == current_user.id)
            .filter(Article.published_at >= cutoff_date)
            .all()
        )
        
        if not user_digest_articles:
            logger.warning(f"Не найдено статей для анализа тональности за последние {days} дней")
            # Возвращаем пустые данные
            return {
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "total": 0,
                "average_score": 0.0,
                "distribution": []
            }
        
        # Подсчитываем статистику
        positive = sum(1 for article in user_digest_articles if article.sentiment_score and article.sentiment_score > 0.2)
        negative = sum(1 for article in user_digest_articles if article.sentiment_score and article.sentiment_score < -0.2)
        neutral = sum(1 for article in user_digest_articles if article.sentiment_score and -0.2 <= article.sentiment_score <= 0.2)
        total = len(user_digest_articles)
        
        # Рассчитываем средний показатель тональности
        scores = [article.sentiment_score for article in user_digest_articles if article.sentiment_score is not None]
        average_score = sum(scores) / len(scores) if scores else 0.0
        
        # Создаем распределение тональности по дням
        distribution = []
        
        # Группируем статьи по дате
        date_groups = {}
        for article in user_digest_articles:
            if article.sentiment_score is None:
                continue
                
            date_str = article.published_at.strftime("%Y-%m-%d")
            if date_str not in date_groups:
                date_groups[date_str] = []
            date_groups[date_str].append(article.sentiment_score)
        
        # Рассчитываем среднюю тональность для каждого дня
        for date_str, scores in date_groups.items():
            avg_score = sum(scores) / len(scores)
            distribution.append({
                "date": date_str,
                "score": avg_score
            })
        
        # Сортируем распределение по дате
        distribution.sort(key=lambda x: x["date"])
        
        return {
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "total": total,
            "average_score": average_score,
            "distribution": distribution
        }
    except Exception as e:
        logger.error(f"Ошибка при получении статистики тональности: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting sentiment stats: {str(e)}"
        )

@router.get("/topics", response_model=List[TopicStats])
def get_topic_stats(
    days: int = Query(30, description="Number of days to analyze"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение статистики по темам.
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Получаем все статьи из дайджестов пользователя сгруппированные по темам
        topic_counts = (
            db.query(
                Topic.id,
                Topic.name,
                func.count(Article.id).label("article_count")
            )
            .join(Article, Article.topic_id == Topic.id)
            .join(Article.digest_articles)
            .join(DigestArticle.digest)
            .filter(Digest.user_id == current_user.id)
            .filter(Article.published_at >= cutoff_date)
            .group_by(Topic.id, Topic.name)
            .all()
        )
        
        if not topic_counts:
            logger.warning(f"Не найдено статей для анализа тем за последние {days} дней")
            return []
        
        # Рассчитываем общее количество статей
        total_articles = sum(count for _, _, count in topic_counts)
        
        # Создаем статистику по темам
        result = []
        for topic_id, topic_name, article_count in topic_counts:
            percentage = (article_count / total_articles) * 100 if total_articles > 0 else 0
            result.append({
                "topic_id": topic_id,
                "topic_name": topic_name,
                "article_count": article_count,
                "percentage": round(percentage, 1)
            })
        
        # Сортируем по количеству статей (по убыванию)
        result.sort(key=lambda x: x["article_count"], reverse=True)
        
        return result
    except Exception as e:
        logger.error(f"Ошибка при получении статистики тем: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting topic stats: {str(e)}"
        )

@router.get("/sources", response_model=List[SourceStats])
def get_source_stats(
    days: int = Query(30, description="Number of days to analyze"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение статистики по источникам.
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Получаем все статьи из дайджестов пользователя сгруппированные по источникам
        source_counts = (
            db.query(
                Article.source,
                func.count(Article.id).label("article_count")
            )
            .join(Article.digest_articles)
            .join(DigestArticle.digest)
            .filter(Digest.user_id == current_user.id)
            .filter(Article.published_at >= cutoff_date)
            .group_by(Article.source)
            .all()
        )
        
        if not source_counts:
            logger.warning(f"Не найдено статей для анализа источников за последние {days} дней")
            return []
        
        # Рассчитываем общее количество статей
        total_articles = sum(count for _, count in source_counts)
        
        # Создаем статистику по источникам
        result = []
        for source, article_count in source_counts:
            percentage = (article_count / total_articles) * 100 if total_articles > 0 else 0
            result.append({
                "source": source,
                "article_count": article_count,
                "percentage": round(percentage, 1)
            })
        
        # Сортируем по количеству статей (по убыванию)
        result.sort(key=lambda x: x["article_count"], reverse=True)
        
        return result
    except Exception as e:
        logger.error(f"Ошибка при получении статистики источников: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting source stats: {str(e)}"
        )

@router.get("/entities", response_model=List[EntityStats])
def get_entity_stats(
    days: int = Query(30, description="Number of days to analyze"),
    entity_type: str = Query(None, description="Filter by entity type"),
    limit: int = Query(10, description="Number of entities to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение статистики по именованным сущностям.
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Получаем все статьи из дайджестов пользователя
        user_digest_articles = (
            db.query(Article)
            .join(Article.digest_articles)
            .join(DigestArticle.digest)
            .filter(Digest.user_id == current_user.id)
            .filter(Article.published_at >= cutoff_date)
            .all()
        )
        
        if not user_digest_articles:
            logger.warning(f"Не найдено статей для анализа сущностей за последние {days} дней")
            return []
        
        # Собираем все сущности из статей
        all_entities = []
        for article in user_digest_articles:
            if not article.entities:
                continue
                
            try:
                entities = json.loads(article.entities) if isinstance(article.entities, str) else article.entities
                for entity in entities:
                    if entity_type and entity.get("type") != entity_type:
                        continue
                    all_entities.append(entity)
            except:
                continue
        
        # Группируем сущности по имени и типу
        entity_counts = {}
        for entity in all_entities:
            key = f"{entity['name']}|{entity['type']}"
            if key in entity_counts:
                entity_counts[key]["count"] += entity.get("count", 1)
            else:
                entity_counts[key] = {
                    "name": entity["name"],
                    "type": entity["type"],
                    "count": entity.get("count", 1)
                }
        
        # Преобразуем в список и сортируем по количеству
        result = list(entity_counts.values())
        result.sort(key=lambda x: x["count"], reverse=True)
        
        # Ограничиваем количество возвращаемых сущностей
        return result[:limit]
    except Exception as e:
        logger.error(f"Ошибка при получении статистики сущностей: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting entity stats: {str(e)}"
        ) 