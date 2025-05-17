import functools
import json
import hashlib
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar, List, Union
import logging
from datetime import datetime, timedelta
import inspect
import redis
from app.core.config import settings

# Настройка логгирования    
logger = logging.getLogger(__name__)

# Ввод переменной для возврата функции
T = TypeVar('T')

class Cache:
    """Простая реализация кэша с использованием Redis"""
    
    def __init__(self):
        try:
            self.enabled = settings.CACHE_ENABLED
            if self.enabled:
                try:
                    self.redis = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        db=settings.REDIS_DB,
                        decode_responses=False,
                        socket_connect_timeout=2.0,  # Добавляем таймаут подключения
                        socket_timeout=2.0           # Добавляем таймаут операций
                    )
                    self._ping()
                    logger.info("Система кэширования, инициализированная с помощью Redis")
                except Exception as e:
                    self.enabled = False
                    logger.warning(f"Не удалось подключиться к Redis, кэширование отключено: {str(e)}")
            else:
                logger.info("Система кэширования отключена в конфигурации")
        except Exception as e:
            # Если настройки отсутствуют, отключаем кэширование
            self.enabled = False
            logger.warning(f"Ошибка инициализации кэша, кэширование отключено: {str(e)}")
    
    def _ping(self) -> bool:
        """Тестирование подключения к Redis"""
        try:
            return self.redis.ping()
        except Exception as e:
            self.enabled = False  # Отключаем кэширование при ошибке
            logger.error(f"Redis ping failed: {str(e)}")
            return False
    
    def _get_key(self, namespace: str, args: Tuple, kwargs: Dict) -> str:
        """Генерация уникального ключа кэша на основе аргументов функции"""
        # Преобразование аргументов и ключевых аргументов в строковое представление и хэширование его
        args_str = json.dumps(str(args), sort_keys=True)
        kwargs_str = json.dumps(str(kwargs), sort_keys=True)
        
        key_data = f"{namespace}:{args_str}:{kwargs_str}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _serialize(self, data: Any) -> bytes:
        """Сериализация данных в байты JSON"""
        try:
            return json.dumps(data).encode()
        except (TypeError, ValueError) as e:
            logger.error(f"Failed to serialize data: {str(e)}")
            return json.dumps({"error": "Serialization failed"}).encode()
    
    def _deserialize(self, data: bytes) -> Any:
        """Десериализация байтов JSON в данные"""
        try:
            if data:
                return json.loads(data)
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to deserialize data: {str(e)}")
            return None
    
    def get(self, key: str) -> Any:
        """Получение значения из кэша"""
        if not self.enabled:
            return None
        
        try:
            data = self.redis.get(key)
            return self._deserialize(data)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {str(e)}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Установка значения в кэш с TTL в секундах (по умолчанию 1 час)"""
        if not self.enabled:
            return False
        
        try:
            serialized = self._serialize(value)
            return self.redis.setex(key, ttl, serialized)
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {str(e)}")
            return False
    
    def delete(self, key: str) -> bool:
        """Удаление значения из кэша"""
        if not self.enabled:
            return False
        
        try:
            return self.redis.delete(key) > 0
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {str(e)}")
            return False
    
    def flush_namespace(self, namespace: str) -> bool:
        """Удаление всех ключей с заданным префиксом пространства имен"""
        if not self.enabled:
            return False
        
        try:
            keys = self.redis.keys(f"{namespace}:*")
            if keys:
                return self.redis.delete(*keys) > 0
            return True
        except Exception as e:
            logger.error(f"Cache flush error for namespace {namespace}: {str(e)}")
            return False

# Инициализация глобального экземпляра кэша
cache = Cache()

def cached(namespace: str, ttl: int = 3600):
    """
    Декоратор для кэширования результатов функции.
    
    Args:
        namespace: Пространство имен для ключей кэша
        ttl: TTL кэша в секундах (по умолчанию 1 час)
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            if not cache.enabled:
                return func(*args, **kwargs)
            
            # Генерация ключа кэша
            cache_key = cache._get_key(namespace, args, kwargs)
            
            # Попытка получить из кэша
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit for {namespace}:{func.__name__}")
                return cached_value
            
            # Пропуск кэша, вызов функции
            result = func(*args, **kwargs)
            
            # Кэширование результата
            cache.set(cache_key, result, ttl)
            logger.debug(f"Кэширование установлено для {namespace}:{func.__name__}")
            
            return result
        return wrapper
    return decorator

def invalidate_cache(namespace: str):
    """
    Декоратор для очистки кэша для пространства имен после выполнения функции.
    
    Args:
        namespace: Пространство имен для очистки
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            result = func(*args, **kwargs)
            cache.flush_namespace(namespace)
            logger.debug(f"Кэш очищен для пространства имен {namespace}")
            return result
        return wrapper
    return decorator 