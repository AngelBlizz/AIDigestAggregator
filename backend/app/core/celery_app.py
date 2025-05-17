from celery import Celery
from app.core.config import settings
import logging

# Настройки логгирования
logger = logging.getLogger(__name__)

# Проверяем доступность Redis
def check_redis():
    import redis
    import socket
    
    try:
        # Попытка подключения к Redis с таймаутом
        r = redis.Redis(
            host=settings.REDIS_HOST, 
            port=settings.REDIS_PORT, 
            socket_connect_timeout=3.0
        )
        if r.ping():
            return True
    except (redis.exceptions.ConnectionError, socket.error) as e:
        logger.warning(f"Не удалось подключиться к Redis: {str(e)}")
    return False

# Настраиваем брокер и бэкенд в зависимости от доступности Redis
redis_available = check_redis()

if redis_available:
    broker_url = settings.CELERY_BROKER_URL
    result_backend = settings.CELERY_RESULT_BACKEND
    logger.info("Используется Redis как брокер и бэкенд Celery")
else:
    # Используем SQLite как альтернативу Redis для Celery
    broker_url = "sqla+sqlite:///./celery-broker.db"
    result_backend = "db+sqlite:///./celery-results.db"
    logger.warning("Redis не доступен, используется SQLite для брокера и бэкенда Celery")

celery_app = Celery(
    "news_digest",
    broker=broker_url,
    backend=result_backend,
    include=["app.tasks.news_tasks"]
)

# Дополнительные настройки
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
) 