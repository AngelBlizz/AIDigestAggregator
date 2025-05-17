from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc, func, cast, Float
from typing import Any, List, Optional, Dict
from datetime import datetime, timedelta
from enum import Enum

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Article, Topic
from app.schemas.digest import ArticleResponse
from app.core.cache import cached

# Определяем перечисления для сортировки
class SortField(str, Enum):
    date = "date"
    title = "title"
    source = "source"
    sentiment = "sentiment"

class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"

router = APIRouter()

@router.get("/", response_model=Dict[str, Any])
@cached(namespace="articles.search", ttl=600)  # Cache for 10 minutes
async def search_articles(
    q: Optional[str] = Query(None, description="Search query in title, content or summary"),
    topic_id: Optional[int] = Query(None, description="Filter by topic ID"),
    topic_ids: Optional[str] = Query(None, description="Comma-separated list of topic IDs"),
    source: Optional[str] = Query(None, description="Filter by source"),
    sources: Optional[str] = Query(None, description="Comma-separated list of sources"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment (positive, neutral, negative)"),
    min_sentiment: Optional[float] = Query(None, description="Minimum sentiment score (-1 to 1)"),
    max_sentiment: Optional[float] = Query(None, description="Maximum sentiment score (-1 to 1)"),
    keyword: Optional[str] = Query(None, description="Filter by keyword"),
    entity: Optional[str] = Query(None, description="Filter by named entity"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (PERSON, ORG, etc.)"),
    days: Optional[int] = Query(7, description="Number of days to look back"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    sort_by: SortField = Query(SortField.date, description="Field to sort by"),
    sort_order: SortOrder = Query(SortOrder.desc, description="Sort order (asc, desc)"),
    skip: int = Query(0, description="Number of items to skip (for pagination)"),
    limit: int = Query(20, description="Number of items to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Advanced search for articles with multiple filtering options.
    """
    # Base query
    query = db.query(Article)
    
    # Apply time filter
    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Article.published_at >= cutoff_date)
    
    if start_date:
        try:
            # Try different date formats
            for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
                try:
                    start_date_obj = datetime.strptime(start_date, fmt)
                    query = query.filter(Article.published_at >= start_date_obj)
                    break  # If successful, no need to try other formats
                except ValueError:
                    continue
        except Exception as e:
            print(f"Error parsing start_date: {e}")
    
    if end_date:
        try:
            # Try different date formats
            for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
                try:
                    end_date_obj = datetime.strptime(end_date, fmt) + timedelta(days=1)  # Include the end date
                    query = query.filter(Article.published_at < end_date_obj)
                    break  # If successful, no need to try other formats
                except ValueError:
                    continue
        except Exception as e:
            print(f"Error parsing end_date: {e}")
    
    # Apply topic filter
    if topic_id:
        query = query.filter(Article.topic_id == topic_id)
    
    if topic_ids:
        try:
            topic_id_list = [int(id.strip()) for id in topic_ids.split(",") if id.strip().isdigit()]
            if topic_id_list:
                query = query.filter(Article.topic_id.in_(topic_id_list))
        except Exception:
            pass
    
    # Apply source filter
    if source:
        query = query.filter(Article.source == source)
    
    if sources:
        source_list = [s.strip() for s in sources.split(",") if s.strip()]
        if source_list:
            query = query.filter(Article.source.in_(source_list))
    
    # Apply sentiment filter
    if sentiment:
        if sentiment.lower() == "positive":
            query = query.filter(Article.sentiment_score > 0.2)
        elif sentiment.lower() == "neutral":
            query = query.filter(and_(Article.sentiment_score >= -0.2, Article.sentiment_score <= 0.2))
        elif sentiment.lower() == "negative":
            query = query.filter(Article.sentiment_score < -0.2)
    
    if min_sentiment is not None:
        query = query.filter(Article.sentiment_score >= min_sentiment)
    
    if max_sentiment is not None:
        query = query.filter(Article.sentiment_score <= max_sentiment)
    
    # Apply keyword filter
    if keyword:
        # We need to search in JSON string field
        keyword_pattern = f'%"{keyword.lower()}"%'
        query = query.filter(func.lower(Article.keywords).like(keyword_pattern))
    
    # Apply entity filter
    if entity or entity_type:
        # Search in JSON string field
        if entity and entity_type:
            # Search for entity name and type
            entity_pattern = f'%"name":"{entity}"%"type":"{entity_type}"%'
            query = query.filter(Article.entities.like(entity_pattern))
        elif entity:
            # Search for entity name only
            entity_pattern = f'%"name":"{entity}"%'
            query = query.filter(Article.entities.like(entity_pattern))
        elif entity_type:
            # Search for entity type only
            entity_type_pattern = f'%"type":"{entity_type}"%'
            query = query.filter(Article.entities.like(entity_type_pattern))
    
    # Apply text search if specified
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Article.title.ilike(search_term),
                Article.content.ilike(search_term),
                Article.summary.ilike(search_term)
            )
        )
    
    # Get total count for pagination
    total = query.count()
    
    # Apply sorting
    if sort_by == SortField.date:
        order_clause = Article.published_at.desc() if sort_order == SortOrder.desc else Article.published_at.asc()
        query = query.order_by(order_clause)
    elif sort_by == SortField.title:
        order_clause = Article.title.desc() if sort_order == SortOrder.desc else Article.title.asc()
        query = query.order_by(order_clause)
    elif sort_by == SortField.source:
        order_clause = Article.source.desc() if sort_order == SortOrder.desc else Article.source.asc()
        query = query.order_by(order_clause)
    elif sort_by == SortField.sentiment:
        # Handle null values for sentiment score in sorting
        if sort_order == SortOrder.desc:
            # Nulls last when descending
            query = query.order_by(func.coalesce(Article.sentiment_score, -2).desc())
        else:
            # Nulls first when ascending
            query = query.order_by(func.coalesce(Article.sentiment_score, -2).asc())
    
    # Apply pagination and get results
    articles = query.offset(skip).limit(limit).all()
    
    # Get all unique sources for filter dropdown
    sources_query = db.query(Article.source).distinct().order_by(Article.source)
    available_sources = [s[0] for s in sources_query.all() if s[0]]
    
    # Get all topics for filter dropdown
    topics_query = db.query(Topic.id, Topic.name).order_by(Topic.name)
    available_topics = [{"id": t.id, "name": t.name} for t in topics_query.all()]
    
    return {
        "items": articles,
        "total": total,
        "page": skip // limit + 1 if limit > 0 else 1,
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
        "limit": limit,
        "filters": {
            "available_sources": available_sources,
            "available_topics": available_topics
        }
    }

@router.get("/{article_id}", response_model=ArticleResponse)
@cached(namespace="articles.detail", ttl=3600)  # Cache for 1 hour
async def get_article(
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific article by ID.
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    return article

@router.get("/sources/list", response_model=List[str])
@cached(namespace="articles.sources", ttl=3600)  # Cache for 1 hour
async def list_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a list of all article sources in the database.
    """
    sources = db.query(Article.source).distinct().order_by(Article.source).all()
    return [source[0] for source in sources if source[0]]

@router.get("/entity-types/list", response_model=List[str])
@cached(namespace="articles.entity_types", ttl=86400)  # Cache for 24 hours
async def list_entity_types(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a list of all unique named entity types found in articles.
    """
    # This will require parsing JSON data from the entities field
    # Using a simplified approach with a predefined list
    return [
        "PERSON", "ORG", "GPE", "LOC", "PRODUCT", "EVENT", 
        "WORK_OF_ART", "LAW", "LANGUAGE", "DATE", "TIME",
        "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"
    ] 