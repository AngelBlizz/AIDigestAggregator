from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, Dict, List
from datetime import datetime, timedelta
import json

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Article, Digest, DigestArticle, Topic

router = APIRouter()

@router.get("/sentiment")
def get_sentiment_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get sentiment statistics for articles in user's digests.
    """
    # Get articles from user's digests
    user_article_ids = (
        db.query(DigestArticle.article_id)
        .join(Digest)
        .filter(Digest.user_id == current_user.id)
        .distinct()
        .subquery()
    )
    
    articles = db.query(Article).filter(Article.id.in_(user_article_ids)).all()
    
    if not articles:
        return {
            "total": 0,
            "positive": 0,
            "neutral": 0,
            "negative": 0,
            "sentiment_distribution": [],
            "sentiment_by_topic": []
        }
    
    # Calculate sentiment statistics
    positive_count = sum(1 for a in articles if a.sentiment_score > 0.2)
    neutral_count = sum(1 for a in articles if -0.2 <= a.sentiment_score <= 0.2)
    negative_count = sum(1 for a in articles if a.sentiment_score < -0.2)
    
    # Create sentiment distribution (binned)
    bins = [-1.0, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0]
    distribution = [0] * (len(bins) - 1)
    
    for article in articles:
        for i in range(len(bins) - 1):
            if bins[i] <= article.sentiment_score < bins[i+1]:
                distribution[i] += 1
                break
    
    # Calculate sentiment by topic
    topic_sentiments = {}
    for article in articles:
        if article.topic:
            if article.topic.name not in topic_sentiments:
                topic_sentiments[article.topic.name] = {"count": 0, "total": 0}
            
            topic_sentiments[article.topic.name]["count"] += 1
            topic_sentiments[article.topic.name]["total"] += article.sentiment_score
    
    sentiment_by_topic = [
        {
            "topic": topic,
            "average_sentiment": data["total"] / data["count"] if data["count"] > 0 else 0,
            "article_count": data["count"]
        }
        for topic, data in topic_sentiments.items()
    ]
    
    # Sort by article count, descending
    sentiment_by_topic.sort(key=lambda x: x["article_count"], reverse=True)
    
    return {
        "total": len(articles),
        "positive": positive_count,
        "neutral": neutral_count,
        "negative": negative_count,
        "sentiment_distribution": [
            {"range": f"{bins[i]} to {bins[i+1]}", "count": distribution[i]}
            for i in range(len(bins) - 1)
        ],
        "sentiment_by_topic": sentiment_by_topic
    }

@router.get("/topics")
def get_topic_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get statistics about topics in user's digests.
    """
    # Get articles from user's digests
    user_article_ids = (
        db.query(DigestArticle.article_id)
        .join(Digest)
        .filter(Digest.user_id == current_user.id)
        .distinct()
        .subquery()
    )
    
    # Count articles by topic
    topic_stats = (
        db.query(
            Topic.name, 
            func.count(Article.id).label("article_count")
        )
        .join(Article, Article.topic_id == Topic.id)
        .filter(Article.id.in_(user_article_ids))
        .group_by(Topic.name)
        .order_by(func.count(Article.id).desc())
        .all()
    )
    
    return [
        {"topic": name, "article_count": count}
        for name, count in topic_stats
    ] 