from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from datetime import datetime, timedelta
import logging

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Digest, DigestArticle, Article, Topic
from app.schemas.digest import DigestResponse, DigestCreate, DigestListResponse, DigestStats, DigestGenerationParams, ArticleResponse
from app.services.digest_generator import DigestGenerator

# Настраиваем логгирование
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[DigestListResponse])
def get_digests(
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
def get_digest_stats(
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
def get_digest(
    digest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение конкретного дайджеста по ID.
    """
    try:
        # Загружаем дайджест со связанными статьями
        digest = db.query(Digest).filter(Digest.id == digest_id, Digest.user_id == current_user.id).first()
        
        if not digest:
            logger.warning(f"Дайджест с ID={digest_id} не найден для пользователя {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Digest not found"
            )
        
        # Загружаем связанные статьи через DigestArticle с их полными данными
        articles_with_data = (
            db.query(Article)
            .join(DigestArticle, DigestArticle.article_id == Article.id)
            .filter(DigestArticle.digest_id == digest_id)
            .order_by(DigestArticle.order)
            .all()
        )
        
        logger.info(f"Загружено {len(articles_with_data)} статей для дайджеста {digest_id}")
        
        # Если статей нет, но дайджест существует, просто возвращаем дайджест с пустым списком статей
        if not articles_with_data:
            logger.warning(f"Дайджест с ID={digest_id} не содержит статей")
            return DigestResponse(
                id=digest.id,
                title=digest.title,
                created_at=digest.created_at,
                is_read=digest.is_read,
                articles=[]
            )
        
        # Создаем новый объект DigestResponse для явного заполнения полей
        # Важно преобразовать каждую статью через ArticleResponse.from_orm
        processed_articles = [ArticleResponse.from_orm(article) for article in articles_with_data]
        
        response = DigestResponse(
            id=digest.id,
            title=digest.title,
            created_at=digest.created_at,
            is_read=digest.is_read,
            articles=processed_articles
        )
        
        return response
    except Exception as e:
        logger.error(f"Ошибка при загрузке дайджеста {digest_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading digest: {str(e)}"
        )

@router.patch("/{digest_id}/read", response_model=DigestResponse)
def mark_digest_as_read(
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
def generate_digest(
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
        logger.warning(f"Пользователь {current_user.id} ({current_user.email}) не выбрал ни одной темы")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No topics selected. Please select topics first."
        )
    
    # Используем сервис генерации дайджестов
    digest_generator = DigestGenerator(db)
    
    # Если параметры не переданы, используем значения по умолчанию
    if not params:
        logger.info(f"Параметры не указаны, используем значения по умолчанию для пользователя {current_user.id}")
        params = DigestGenerationParams()
    
    # Логируем параметры генерации дайджеста
    logger.info(f"Генерация дайджеста для пользователя {current_user.id} с параметрами: {params.dict()}")
    
    try:
        # Создаем дайджест с указанными параметрами
        digest = digest_generator.generate_digest_with_params(current_user.id, params)
        
        if not digest:
            logger.warning(f"Не удалось создать дайджест для пользователя {current_user.id}: не найдено подходящих статей")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No articles found that match your criteria. Try adjusting your parameters."
            )
        
        # Получаем связанные статьи
        articles_with_data = (
            db.query(Article)
            .join(DigestArticle, DigestArticle.article_id == Article.id)
            .filter(DigestArticle.digest_id == digest.id)
            .order_by(DigestArticle.order)
            .all()
        )
        
        # Преобразуем статьи через ArticleResponse.from_orm
        processed_articles = [ArticleResponse.from_orm(article) for article in articles_with_data]
        
        # Создаем ответ с явным преобразованием статей
        response = DigestResponse(
            id=digest.id,
            title=digest.title,
            created_at=digest.created_at,
            is_read=digest.is_read,
            articles=processed_articles
        )
        
        logger.info(f"Дайджест успешно создан: ID={digest.id}, статей={len(digest.articles) if hasattr(digest, 'articles') else 'N/A'}")
        return response
    except Exception as e:
        logger.error(f"Ошибка при генерации дайджеста для пользователя {current_user.id}: {str(e)}")
        # Логируем полный стек-трейс для отладки
        import traceback
        logger.error(traceback.format_exc())
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating digest: {str(e)}"
        ) 