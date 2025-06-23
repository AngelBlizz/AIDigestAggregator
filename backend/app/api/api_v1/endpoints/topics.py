from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List
import logging
import json

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Topic, user_topics, Article
from app.schemas.topic import TopicCreate, TopicResponse, TopicUpdate

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[TopicResponse])
def get_topics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all available topics and mark selected ones.
    """
    # Get all topics
    topics = db.query(Topic).all()
    
    # Get user's selected topics
    user_topic_ids = [topic.id for topic in current_user.topics]
    
    # Mark if the user has selected each topic
    for topic in topics:
        topic.is_selected = topic.id in user_topic_ids
    
    return topics

@router.post("/", response_model=TopicResponse)
def create_topic(
    topic_in: TopicCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new topic.
    """
    # Check if topic already exists
    db_topic = db.query(Topic).filter(Topic.name == topic_in.name).first()
    if db_topic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Topic already exists"
        )
    
    # Validate tags JSON if provided
    if topic_in.tags:
        try:
            tags = json.loads(topic_in.tags)
            if not isinstance(tags, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tags must be a JSON array"
                )
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tags must be a valid JSON array"
            )
    
    # Create new topic
    topic = Topic(
        name=topic_in.name,
        description=topic_in.description,
        tags=topic_in.tags
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    
    # Set is_selected to False for the newly created topic
    topic.is_selected = False
    
    return topic

@router.get("/{topic_id}", response_model=TopicResponse)
def get_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific topic by ID.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Check if the user has selected this topic
    topic.is_selected = topic in current_user.topics
    
    return topic

@router.put("/{topic_id}", response_model=TopicResponse)
def update_topic(
    topic_id: int,
    topic_in: TopicUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a topic.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Validate tags JSON if provided
    if topic_in.tags:
        try:
            tags = json.loads(topic_in.tags)
            if not isinstance(tags, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tags must be a JSON array"
                )
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tags must be a valid JSON array"
            )
    
    # Update topic fields
    if topic_in.name:
        topic.name = topic_in.name
    if topic_in.description is not None:
        topic.description = topic_in.description
    if topic_in.tags is not None:
        topic.tags = topic_in.tags
    
    db.add(topic)
    db.commit()
    db.refresh(topic)
    
    # Check if the user has selected this topic
    topic.is_selected = topic in current_user.topics
    
    return topic

@router.patch("/{topic_id}/toggle", response_model=TopicResponse)
def toggle_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Toggle user's subscription to a topic.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Check if the user has already selected this topic
    if topic in current_user.topics:
        # Remove topic from user's selection
        current_user.topics.remove(topic)
        topic.is_selected = False
    else:
        # Add topic to user's selection
        current_user.topics.append(topic)
        topic.is_selected = True
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return topic

@router.delete("/{topic_id}", response_model=TopicResponse)
def delete_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a topic.
    """
    # Anyone can delete topics they've created or if they're superusers
    # This check is removed to allow regular users to delete topics
    
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    try:
        # Проверяем наличие статей с этим топиком
        articles_count = db.query(Article).filter(Article.topic_id == topic_id).count()
        
        if articles_count > 0:
            # Обновляем статьи, устанавливая topic_id в NULL
            db.query(Article).filter(Article.topic_id == topic_id).update({Article.topic_id: None})
            logger.info(f"Обновлено {articles_count} статей при удалении топика {topic.name}")
        
        # Удаляем связи в таблице user_topics
        db.execute(user_topics.delete().where(user_topics.c.topic_id == topic_id))
        
        # Удаляем связи в таблице digest_articles
        from app.models.models import DigestArticle
        db.query(DigestArticle).filter(DigestArticle.topic_id == topic_id).update({DigestArticle.topic_id: None})
        
        # Удаляем топик
        db.delete(topic)
        db.commit()
        
        return topic
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при удалении топика: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении топика: {str(e)}"
        ) 