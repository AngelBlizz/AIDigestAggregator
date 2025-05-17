"""
Диагностический скрипт для проверки работы основных модулей бэкенда.
Запуск: python diagnostic.py
"""

import sys
import logging
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.services.news_scraper import NewsScraper
from app.services.nlp_analyzer import NLPAnalyzer
from app.services.digest_generator import DigestGenerator
from app.models.models import User, Topic

# Настройка логирования
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    handlers=[logging.StreamHandler()])

logger = logging.getLogger("diagnostic")

def check_db_connection():
    """Проверка подключения к базе данных"""
    logger.info("=== Проверка подключения к базе данных ===")
    try:
        db = SessionLocal()
        # Проверка на возможность выполнения простого запроса
        user_count = db.query(User).count()
        topic_count = db.query(Topic).count()
        logger.info(f"Подключение к БД успешно. Пользователей: {user_count}, тем: {topic_count}")
        return db
    except Exception as e:
        logger.error(f"Ошибка подключения к БД: {str(e)}")
        return None
    finally:
        db.close()

def check_news_scraper(db: Session):
    """Проверка модуля сбора новостей"""
    logger.info("=== Проверка модуля сбора новостей ===")
    try:
        scraper = NewsScraper(db)
        sources = scraper.sources
        logger.info(f"Источников новостей: {len(sources)}")
        for key, source in sources.items():
            logger.info(f"Источник: {key} - {source.name} ({source.url})")
        
        # Проверка тем
        topics = db.query(Topic).all()
        if not topics:
            logger.warning("Темы не найдены в базе данных")
        else:
            logger.info(f"Найдено {len(topics)} тем в базе данных")
        
        return True
    except Exception as e:
        logger.error(f"Ошибка в модуле сбора новостей: {str(e)}")
        return False

def check_nlp_analyzer(db: Session):
    """Проверка модуля NLP-анализа"""
    logger.info("=== Проверка модуля NLP-анализа ===")
    try:
        analyzer = NLPAnalyzer(db)
        
        # Проверка загрузки моделей
        if hasattr(analyzer, 'nlp'):
            logger.info(f"Модель NLP загружена: {analyzer.nlp}")
        else:
            logger.error("Модель NLP не загружена")
            return False
        
        # Проверка анализа на тестовом тексте
        test_text = "This is a test sentence for sentiment analysis. It should work properly."
        sentiment = analyzer.analyze_sentiment(test_text)
        logger.info(f"Результаты анализа тональности: {sentiment}")
        
        return True
    except Exception as e:
        logger.error(f"Ошибка в модуле NLP-анализа: {str(e)}")
        return False

def check_digest_generator(db: Session):
    """Проверка модуля генерации дайджестов"""
    logger.info("=== Проверка модуля генерации дайджестов ===")
    try:
        generator = DigestGenerator(db)
        
        # Проверка наличия пользователей с темами
        users = db.query(User).all()
        users_with_topics = [user for user in users if user.topics]
        logger.info(f"Пользователей с темами: {len(users_with_topics)} из {len(users)}")
        
        if users_with_topics:
            test_user = users_with_topics[0]
            topics = generator.get_user_topics(test_user.id)
            logger.info(f"Темы пользователя {test_user.email}: {[t.name for t in topics]}")
            
            # Проверка поиска статей
            topic_ids = [t.id for t in topics]
            articles = generator.get_recent_articles(topic_ids, days=30)  # Увеличиваем период до 30 дней
            logger.info(f"Найдено {len(articles)} статей за последние 30 дней")
            
            # Если статей нет, пробуем расширить поиск
            if not articles:
                logger.warning("Статьи не найдены, пробуем расширить поиск до 90 дней")
                articles = generator.get_recent_articles(topic_ids, days=90)
                logger.info(f"Найдено {len(articles)} статей за последние 90 дней")
        else:
            logger.warning("Нет пользователей с темами для тестирования генерации дайджеста")
        
        return True
    except Exception as e:
        logger.error(f"Ошибка в модуле генерации дайджестов: {str(e)}")
        return False

def main():
    """Основная функция диагностики"""
    logger.info("Начало диагностики модулей бэкенда")
    
    # Проверка БД
    db = check_db_connection()
    if not db:
        logger.error("Невозможно продолжить диагностику без подключения к БД")
        return
    
    # Проверка основных модулей
    scraper_ok = check_news_scraper(db)
    nlp_ok = check_nlp_analyzer(db)
    digest_ok = check_digest_generator(db)
    
    # Итоговый результат
    logger.info("=== Результаты диагностики ===")
    logger.info(f"БД: Успешно")
    logger.info(f"Модуль сбора новостей: {'Успешно' if scraper_ok else 'Ошибка'}")
    logger.info(f"Модуль NLP-анализа: {'Успешно' if nlp_ok else 'Ошибка'}")
    logger.info(f"Модуль генерации дайджестов: {'Успешно' if digest_ok else 'Ошибка'}")
    
    if scraper_ok and nlp_ok and digest_ok:
        logger.info("Все основные модули работают корректно")
    else:
        logger.warning("Обнаружены проблемы в некоторых модулях")

if __name__ == "__main__":
    main() 