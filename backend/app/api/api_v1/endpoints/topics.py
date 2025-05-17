from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Topic, user_topics
from app.schemas.topic import TopicCreate, TopicResponse, TopicUpdate

router = APIRouter()

@router.get("/", response_model=List[TopicResponse])
async def get_topics(
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
async def create_topic(
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
    
    # Create new topic
    topic = Topic(
        name=topic_in.name,
        description=topic_in.description,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    
    # Set is_selected to False for the newly created topic
    topic.is_selected = False
    
    return topic

@router.get("/{topic_id}", response_model=TopicResponse)
async def get_topic(
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
async def update_topic(
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
    
    # Update topic fields
    if topic_in.name:
        topic.name = topic_in.name
    if topic_in.description:
        topic.description = topic_in.description
    
    db.add(topic)
    db.commit()
    db.refresh(topic)
    
    # Check if the user has selected this topic
    topic.is_selected = topic in current_user.topics
    
    return topic

@router.patch("/{topic_id}/toggle", response_model=TopicResponse)
async def toggle_topic(
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
async def delete_topic(
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
    
    # First remove all associations
    if topic in current_user.topics:
        current_user.topics.remove(topic)
    
    # Delete topic
    db.delete(topic)
    db.commit()
    
    return topic 