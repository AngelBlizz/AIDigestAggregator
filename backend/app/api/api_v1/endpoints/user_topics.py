from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List
import logging
import json

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, UserTopic, Topic
from app.schemas.topic import UserTopicCreate, UserTopicResponse, UserTopicUpdate

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[UserTopicResponse])
async def get_user_topics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получить все персональные темы текущего пользователя.
    """
    return db.query(UserTopic).filter(UserTopic.user_id == current_user.id).all()

@router.post("/", response_model=UserTopicResponse)
async def create_user_topic(
    topic_in: UserTopicCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Создать новую персональную тему для текущего пользователя.
    """
    # Проверяем, существует ли уже тема с таким именем у этого пользователя
    existing_topic = db.query(UserTopic).filter(
        UserTopic.user_id == current_user.id,
        UserTopic.name == topic_in.name
    ).first()
    
    if existing_topic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тема с таким именем уже существует"
        )
    
    # Проверяем валидность JSON в поле keywords
    if topic_in.keywords:
        try:
            json.loads(topic_in.keywords)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Поле keywords должно содержать валидный JSON"
            )
    
    # Создаем новую персональную тему
    user_topic = UserTopic(
        user_id=current_user.id,
        name=topic_in.name,
        description=topic_in.description,
        keywords=topic_in.keywords,
        is_active=topic_in.is_active
    )
    
    db.add(user_topic)
    db.commit()
    db.refresh(user_topic)
    
    return user_topic

@router.get("/{topic_id}", response_model=UserTopicResponse)
async def get_user_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получить конкретную персональную тему пользователя по ID.
    """
    topic = db.query(UserTopic).filter(
        UserTopic.id == topic_id,
        UserTopic.user_id == current_user.id
    ).first()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Персональная тема не найдена"
        )
    
    return topic

@router.put("/{topic_id}", response_model=UserTopicResponse)
async def update_user_topic(
    topic_id: int,
    topic_in: UserTopicUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Обновить персональную тему пользователя.
    """
    topic = db.query(UserTopic).filter(
        UserTopic.id == topic_id,
        UserTopic.user_id == current_user.id
    ).first()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Персональная тема не найдена"
        )
    
    # Проверяем, не существует ли уже тема с таким именем у этого пользователя
    if topic_in.name and topic_in.name != topic.name:
        existing_topic = db.query(UserTopic).filter(
            UserTopic.user_id == current_user.id,
            UserTopic.name == topic_in.name,
            UserTopic.id != topic_id
        ).first()
        
        if existing_topic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Тема с таким именем уже существует"
            )
    
    # Проверяем валидность JSON в поле keywords
    if topic_in.keywords:
        try:
            json.loads(topic_in.keywords)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Поле keywords должно содержать валидный JSON"
            )
    
    # Обновляем поля
    if topic_in.name:
        topic.name = topic_in.name
    if topic_in.description is not None:
        topic.description = topic_in.description
    if topic_in.keywords is not None:
        topic.keywords = topic_in.keywords
    if topic_in.is_active is not None:
        topic.is_active = topic_in.is_active
    
    db.add(topic)
    db.commit()
    db.refresh(topic)
    
    return topic

@router.delete("/{topic_id}", response_model=UserTopicResponse)
async def delete_user_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Удалить персональную тему пользователя.
    """
    topic = db.query(UserTopic).filter(
        UserTopic.id == topic_id,
        UserTopic.user_id == current_user.id
    ).first()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Персональная тема не найдена"
        )
    
    db.delete(topic)
    db.commit()
    
    return topic

@router.post("/copy-from-topic/{topic_id}", response_model=UserTopicResponse)
async def copy_from_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Копировать общую тему в персональную тему пользователя.
    """
    # Находим общую тему
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тема не найдена"
        )
    
    # Проверяем, существует ли уже персональная тема с таким именем у этого пользователя
    existing_topic = db.query(UserTopic).filter(
        UserTopic.user_id == current_user.id,
        UserTopic.name == topic.name
    ).first()
    
    if existing_topic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Персональная тема с таким именем уже существует"
        )
    
    # Создаем новую персональную тему на основе общей темы
    user_topic = UserTopic(
        user_id=current_user.id,
        name=topic.name,
        description=topic.description,
        keywords=topic.tags,  # Используем теги общей темы как ключевые слова для персональной темы
        is_active=True
    )
    
    db.add(user_topic)
    db.commit()
    db.refresh(user_topic)
    
    return user_topic

@router.post("/copy-all-topics", response_model=List[UserTopicResponse])
async def copy_all_topics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Копировать все общие темы в персональные темы пользователя.
    """
    # Получаем все общие темы
    topics = db.query(Topic).all()
    if not topics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Нет доступных тем для копирования"
        )
    
    # Получаем существующие персональные темы пользователя
    existing_topics = db.query(UserTopic).filter(UserTopic.user_id == current_user.id).all()
    existing_names = {topic.name for topic in existing_topics}
    
    # Копируем только те темы, которых еще нет у пользователя
    created_topics = []
    for topic in topics:
        if topic.name not in existing_names:
            user_topic = UserTopic(
                user_id=current_user.id,
                name=topic.name,
                description=topic.description,
                keywords=topic.tags,  # Используем теги общей темы как ключевые слова для персональной темы
                is_active=True
            )
            db.add(user_topic)
            created_topics.append(user_topic)
    
    if created_topics:
        db.commit()
        for topic in created_topics:
            db.refresh(topic)
    
    return created_topics 