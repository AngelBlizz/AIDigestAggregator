from celery import shared_task
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.services.news_aggregator import NewsAggregator
from app.services.nlp_analyzer import NLPAnalyzer
from app.services.digest_generator import DigestGenerator
from app.services.news_scraper import NewsScraper
import logging

# Настройка логирования
logger = logging.getLogger(__name__)

@shared_task
def aggregate_news():
    """Задача для агрегации новостей из различных источников"""
    db = SessionLocal()
    try:
        aggregator = NewsAggregator(db)
        aggregator.aggregate_news()
    finally:
        db.close()

@shared_task
def analyze_articles():
    """Задача для анализа необработанных статей"""
    db = SessionLocal()
    try:
        analyzer = NLPAnalyzer(db)
        analyzer.process_unanalyzed_articles()
    finally:
        db.close()

@shared_task
def generate_digests():
    """Задача для генерации дайджестов для всех пользователей"""
    db = SessionLocal()
    try:
        generator = DigestGenerator(db)
        generator.generate_digests_for_all_users()
    finally:
        db.close()

@shared_task
def scrape_news():
    """Задача для скрапинга новостей из настроенных источников"""
    db = SessionLocal()
    try:
        logger.info("Запуск запланированной задачи по скрапингу новостей")
        scraper = NewsScraper(db)
        results = scraper.scrape_for_all_topics()
        
        total_articles = sum(results.values())
        logger.info(f"Скрапинг {total_articles} статей из всех источников")
        
        # Если мы нашли новые статьи, также запустите анализ
        if total_articles > 0:
            analyzer = NLPAnalyzer(db)
            analyzer.process_unanalyzed_articles()
            logger.info("Завершено аналитическое исследование новых собранных статей")
            
        return results
    except Exception as e:
        logger.error(f"Ошибка в задаче по скрапингу новостей: {str(e)}")
        raise
    finally:
        db.close()

# Расписание задач
from celery.schedules import crontab

# Настройка периодических задач
def configure_periodic_tasks(sender, **kwargs):
    # Агрегировать новости каждый час
    sender.add_periodic_task(
        crontab(minute=0),
        aggregate_news.s(),
        name='aggregate-news-hourly'
    )
    
    # Анализировать статьи каждые 30 минут
    sender.add_periodic_task(
        crontab(minute='*/30'),
        analyze_articles.s(),
        name='analyze-articles-every-30-min'
    )
    
    # Генерировать дайджесты ежедневно в 8:00
    sender.add_periodic_task(
        crontab(hour=8, minute=0),
        generate_digests.s(),
        name='generate-daily-digests'
    )
    
    # Скрапинг новостей каждые 3 часа
    sender.add_periodic_task(
        crontab(minute=0, hour='*/3'),
        scrape_news.s(),
        name='scrape-news-every-3-hours'
    ) 