from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from datetime import datetime, timedelta
import logging

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Digest, DigestArticle, Article, Topic
from app.schemas.digest import DigestResponse, DigestCreate, DigestListResponse, DigestStats, DigestGenerationParams
from app.services.digest_generator import DigestGenerator

# Настраиваем логгирование
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[DigestListResponse])
async def get_digests(
    skip: int = 0,
    limit: int = 10,
    status: Optional[str] = Query(None, description="Filter by status (read/unread)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение всех дайджестов для текущего пользователя.
    """
    query = db.query(Digest).filter(Digest.user_id == current_user.id)
    
    if status:
        if status.lower() == "read":
            query = query.filter(Digest.is_read == True)
        elif status.lower() == "unread":
            query = query.filter(Digest.is_read == False)
    
    digests = query.order_by(Digest.created_at.desc()).offset(skip).limit(limit).all()
    return digests

@router.get("/stats", response_model=DigestStats)
async def get_digest_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение статистики дайджестов для текущего пользователя.
    """
    total_digests = db.query(Digest).filter(Digest.user_id == current_user.id).count()
    unread_digests = db.query(Digest).filter(Digest.user_id == current_user.id, Digest.is_read == False).count()
    
    # Подсчитываем статьи через связь digest_articles
    article_count_subquery = (
        db.query(DigestArticle.article_id)
        .join(Digest)
        .filter(Digest.user_id == current_user.id)
        .distinct()
        .subquery()
    )
    total_articles = db.query(article_count_subquery).count()
    
    # Получаем количество тем пользователя
    topics_count = len(current_user.topics)
    
    # Получаем недавние дайджесты
    recent_digests = (
        db.query(Digest)
        .filter(Digest.user_id == current_user.id)
        .order_by(Digest.created_at.desc())
        .limit(3)
        .all()
    )
    
    return {
        "total_digests": total_digests,
        "unread_digests": unread_digests,
        "total_articles": total_articles,
        "topics_count": topics_count,
        "recent_digests": recent_digests
    }

@router.get("/{digest_id}", response_model=DigestResponse)
async def get_digest(
    digest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение конкретного дайджеста по ID.
    """
    digest = db.query(Digest).filter(Digest.id == digest_id, Digest.user_id == current_user.id).first()
    if not digest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Digest not found"
        )
    return digest

@router.patch("/{digest_id}/read", response_model=DigestResponse)
async def mark_digest_as_read(
    digest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Отметить дайджест как прочитанный.
    """
    digest = db.query(Digest).filter(Digest.id == digest_id, Digest.user_id == current_user.id).first()
    if not digest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Digest not found"
        )
    
    digest.is_read = True
    db.add(digest)
    db.commit()
    db.refresh(digest)
    
    return digest

@router.post("/generate", response_model=DigestResponse)
async def generate_digest(
    params: Optional[DigestGenerationParams] = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Генерация нового дайджеста со статьями из выбранных пользователем тем.
    
    Можно указать следующие параметры:
    - topics: список ID тем (если не указан, используются все темы пользователя)
    - sources: список источников новостей
    - days: количество дней для поиска статей (по умолчанию 3)
    - maxArticles: максимальное количество статей в дайджесте (по умолчанию 10)
    - includeSentiment: учитывать ли тональность при ранжировании
    - includeKeywords: учитывать ли ключевые слова при ранжировании
    - minSentimentScore: минимальный порог тональности (-1.0 до 1.0)
    - maxSentimentScore: максимальный порог тональности (-1.0 до 1.0)
    """
    # Проверяем наличие выбранных тем у пользователя
    if not current_user.topics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No topics selected. Please select topics first."
        )
    
    # Используем сервис генерации дайджестов
    digest_generator = DigestGenerator(db)
    
    # Если параметры не переданы, используем значения по умолчанию
    if not params:
        params = DigestGenerationParams()
    
    # Создаем дайджест с указанными параметрами
    digest = digest_generator.generate_digest_with_params(current_user.id, params)
    
    if not digest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No articles found that match your criteria. Try adjusting your parameters."
        )
    
    return digest 