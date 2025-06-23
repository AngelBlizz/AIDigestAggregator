from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Any, Dict
import logging

from app.db.session import get_db
from app.core.security import create_access_token, get_password_hash, verify_password, get_current_user
from app.models.models import User, Topic, UserTopic
from app.schemas.user import UserCreate, UserResponse, Token, UserUpdate, AuthResponse

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/test-auth")
def test_auth():
    """
    Тестовый эндпоинт для проверки доступности API авторизации
    """
    return {"message": "Авторизационное API работает корректно"}

@router.post("/register", response_model=AuthResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    """
    Регистрация нового пользователя.
    """
    # Проверяем, существует ли пользователь
    db_user = db.query(User).filter(User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email уже зарегистрирован"
        )
    
    # Создаем нового пользователя
    user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=get_password_hash(user_in.password),
        is_active=True,
        is_superuser=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Добавляем базовые темы для пользователя
    try:
        # Получаем все общие темы
        topics = db.query(Topic).all()
        
        # Добавляем пользователю базовые темы
        for topic in topics:
            user.topics.append(topic)
            
            # Также создаем персональную копию темы для пользователя
            user_topic = UserTopic(
                user_id=user.id,
                name=topic.name,
                description=topic.description,
                keywords=topic.tags,  # Используем теги общей темы как ключевые слова для персональной темы
                is_active=True
            )
            db.add(user_topic)
        
        db.commit()
        db.refresh(user)
    except Exception as e:
        logger.error(f"Ошибка при инициализации тем пользователя: {str(e)}")
    
    # Создаем токен доступа
    token = create_access_token(subject=user.id)
    
    # Создаем объект UserResponse явно, чтобы не было проблем с валидацией
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_active=user.is_active,
        is_superuser=False if user.is_superuser is None else user.is_superuser
    )
    
    # Возвращаем AuthResponse
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_response
    )

@router.post("/login", response_model=AuthResponse)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
) -> Any:
    """
    Вход в систему, совместимый с OAuth2.
    """
    try:
        # Ищем пользователя
        user = db.query(User).filter(User.email == form_data.username).first()
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неактивный пользователь"
            )
        
        # Установим is_superuser если оно None
        if user.is_superuser is None:
            user.is_superuser = False
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Создаем токен доступа
        token = create_access_token(subject=user.id)
        
        # Устанавливаем заголовок Content-Type
        response.headers["Content-Type"] = "application/json"
        
        # Создаем объект UserResponse явно, чтобы не было проблем с валидацией
        user_response = UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            is_superuser=False if user.is_superuser is None else user.is_superuser
        )
        
        # Возвращаем модель AuthResponse
        return AuthResponse(
            access_token=token,
            token_type="bearer",
            user=user_response
        )
    except HTTPException as e:
        # Перехватываем исключения FastAPI и преобразуем их в формат, понятный фронтенду
        raise e
    except Exception as e:
        # Обработка непредвиденных ошибок
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)) -> Any:
    """
    Получение профиля текущего пользователя.
    """
    # Создаем объект UserResponse явно, чтобы не было проблем с валидацией
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        is_superuser=False if current_user.is_superuser is None else current_user.is_superuser
    )

@router.put("/profile", response_model=UserResponse)
def update_profile(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Обновление профиля текущего пользователя.
    """
    # Обновляем поля пользователя
    if user_in.email:
        current_user.email = user_in.email
    
    if user_in.name:
        current_user.name = user_in.name
    
    # Обновляем пароль, если предоставлен
    if user_in.password:
        current_user.hashed_password = get_password_hash(user_in.password)
    
    # Устанавливаем is_superuser если оно None
    if current_user.is_superuser is None:
        current_user.is_superuser = False
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    # Создаем объект UserResponse явно, чтобы не было проблем с валидацией
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        is_superuser=False if current_user.is_superuser is None else current_user.is_superuser
    ) 