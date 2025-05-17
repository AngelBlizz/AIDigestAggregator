from pydantic_settings import BaseSettings
from typing import Optional, List
import os
from dotenv import load_dotenv
import secrets

load_dotenv()

class Settings(BaseSettings):
    # Настройки приложения
    PROJECT_NAME: str = "AI News Digest Aggregator"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Среда (разработка, производство)
    ENV: str = os.getenv("ENVIRONMENT", "development")
    
    # База данных
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "news_digest")
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    # Безопасность
    # Генерация безопасного секретного ключа, если он не предоставлен в env
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 дней
    JWT_ALGORITHM: str = "HS256"  # HMAC с SHA-256

    # Источники новостей
    NEWS_SOURCES: List[str] = [
        "https://newsapi.org",
        "https://api.nytimes.com",
        # Добавить больше источников новостей здесь
    ]
    
    # API Ключи
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")
    NYTIMES_API_KEY: str = os.getenv("NYTIMES_API_KEY", "")

    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    # NLP Модели
    SPACY_MODEL: str = "en_core_web_sm"
    
    # Настройки кэша
    CACHE_ENABLED: bool = os.getenv("CACHE_ENABLED", "True").lower() == "true"
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "1"))  # Использовать разные БД, чем Celery
    CACHE_DEFAULT_TTL: int = int(os.getenv("CACHE_DEFAULT_TTL", "3600"))  # 1 час в секундах

    @property
    def get_database_url(self) -> str:
        if self.SQLALCHEMY_DATABASE_URI:
            return self.SQLALCHEMY_DATABASE_URI
        # Использовать встроенную базу данных SQLite вместо PostgreSQL
        return "sqlite:///./news_digest.db"

settings = Settings() 