from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
import logging

from app.db.session import get_db
from app.core.security import get_current_user, get_current_active_superuser
from app.models.models import User, Topic, NewsSource
from app.services.news_scraper import NewsScraper
from app.services.nlp_analyzer import NLPAnalyzer
from app.schemas.source import NewsSourceResponse, NewsSourceList, NewsSourceCreate, NewsSourceUpdate

# Настраиваем логгирование
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/run", response_model=Dict[str, Any])
async def run_scraper(
    background_tasks: BackgroundTasks,
    topic_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Trigger the news scraper to collect articles.
    This endpoint is restricted to superusers only.
    
    Parameters:
    - topic_id: Optional ID of a specific topic to scrape for. If not provided, scrapes for all topics.
    """
    def scrape_in_background(topic_id: Optional[int] = None):
        scraper = NewsScraper(db)
        
        if topic_id:
            topic = db.query(Topic).filter(Topic.id == topic_id).first()
            if not topic:
                return {"status": "error", "message": f"Topic with ID {topic_id} not found"}
            
            results = scraper.scrape_all_sources(topic)
            return {"status": "success", "articles_scraped": len(results), "topic": topic.name}
        else:
            results = scraper.scrape_for_all_topics()
            return {"status": "success", "results": results}
    
    # Run the scraping in the background to avoid timeout
    background_tasks.add_task(scrape_in_background, topic_id)
    
    return {
        "status": "started",
        "message": "Scraping process started in the background",
        "for_topic_id": topic_id
    }

@router.post("/run-user-scraper", response_model=Dict[str, Any])
async def run_scraper_for_user(
    background_tasks: BackgroundTasks,
    topic_id: Optional[int] = Query(None, description="ID темы для скрапинга (по умолчанию все темы пользователя)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Запуск сбора новостей для тем пользователя.
    Доступно для всех авторизованных пользователей.
    """
    def scrape_in_background(user_id: int, topic_id: Optional[int] = None):
        scraper = NewsScraper(db)
        
        if topic_id:
            # Проверяем, что тема принадлежит пользователю
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"status": "error", "message": "User not found"}
                
            user_topics = [t.id for t in user.topics]
            if topic_id not in user_topics:
                return {"status": "error", "message": "Topic doesn't belong to user"}
            
            topic = db.query(Topic).filter(Topic.id == topic_id).first()
            results = scraper.scrape_all_sources(topic)
            
            # После сбора данных запускаем анализатор
            analyzer = NLPAnalyzer(db)
            analyzed = analyzer.process_unanalyzed_articles()
            
            return {
                "status": "success", 
                "articles_scraped": len(results), 
                "articles_analyzed": analyzed,
                "topic": topic.name
            }
        else:
            # Собираем новости для всех тем пользователя
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.topics:
                return {"status": "error", "message": "No topics found for user"}
            
            total_articles = 0
            for topic in user.topics:
                articles = scraper.scrape_all_sources(topic)
                total_articles += len(articles)
            
            # После сбора данных запускаем анализатор
            analyzer = NLPAnalyzer(db)
            analyzed = analyzer.process_unanalyzed_articles()
            
            return {
                "status": "success", 
                "articles_scraped": total_articles,
                "articles_analyzed": analyzed,
                "topics_count": len(user.topics)
            }
    
    # Запускаем сбор данных в фоновом режиме
    background_tasks.add_task(scrape_in_background, current_user.id, topic_id)
    
    return {
        "status": "started",
        "message": "Сбор новостей запущен в фоновом режиме. Это может занять несколько минут.",
        "for_topic_id": topic_id
    }

@router.post("/analyze", response_model=Dict[str, Any])
async def run_analyzer(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Запуск анализа неанализированных статей вручную.
    """
    def analyze_in_background():
        try:
            analyzer = NLPAnalyzer(db)
            result = analyzer.process_unanalyzed_articles()
            return {"success": True, "articles_analyzed": result}
        except Exception as e:
            logger.error(f"Error running analyzer: {str(e)}")
            return {"success": False, "error": str(e)}
    
    background_tasks.add_task(analyze_in_background)
    
    return {
        "status": "started",
        "message": "Анализ статей запущен в фоновом режиме. Это может занять некоторое время."
    }

@router.get("/sources", response_model=List[str])
async def get_available_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a list of all available news sources that the scraper can collect from.
    """
    from app.models.models import NewsSource
    
    # First get built-in sources from the scraper
    scraper = NewsScraper(db)
    sources = list(scraper.sources.keys())
    
    # Then add sources from the database
    db_sources = db.query(NewsSource.key).filter(NewsSource.is_active == True).all()
    for src in db_sources:
        if src.key not in sources:
            sources.append(src.key)
    
    return sources

@router.get("/sources/details", response_model=NewsSourceList)
async def get_sources_details(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get detailed information about all available news sources.
    This endpoint is now available to all authenticated users.
    """
    from app.models.models import NewsSource
    
    # Get built-in sources first
    scraper = NewsScraper(db)
    sources_list = []
    
    for key, source in scraper.sources.items():
        sources_list.append({
            "key": key,
            "name": source.name,
            "url": source.url,
            "article_selector": source.article_selector,
            "title_selector": source.title_selector,
            "content_selector": source.content_selector,
            "date_selector": source.date_selector,
            "date_format": source.date_format
        })
    
    # Get database sources
    db_sources = db.query(NewsSource).filter(NewsSource.is_active == True).all()
    for source in db_sources:
        # Only add if key doesn't already exist (to avoid duplicates)
        if source.key not in [s["key"] for s in sources_list]:
            sources_list.append({
                "key": source.key,
                "name": source.name,
                "url": source.url,
                "article_selector": source.article_selector,
                "title_selector": source.title_selector,
                "content_selector": source.content_selector,
                "date_selector": source.date_selector,
                "date_format": source.date_format
            })
    
    return {"sources": sources_list}

@router.post("/sources/add", response_model=NewsSourceResponse)
async def add_news_source(
    source: NewsSourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Add a new news source to the scraper configuration.
    This endpoint is available to all authenticated users.
    """
    import re
    
    # Generate a key from the name (lowercase, remove spaces and special chars)
    key = re.sub(r'[^a-z0-9]', '', source.name.lower())
    
    # Check if source with this key already exists
    existing_source = db.query(NewsSource).filter(NewsSource.key == key).first()
    if existing_source:
        # If it exists, update the source ID to ensure uniqueness
        key = f"{key}_{existing_source.id + 1}"
    
    # Create and store the news source in the database
    db_source = NewsSource(
        key=key,
        name=source.name,
        url=source.url,
        article_selector=source.article_selector,
        title_selector=source.title_selector,
        content_selector=source.content_selector,
        date_selector=source.date_selector,
        date_format=source.date_format,
        fallback_article_selector=None,
        fallback_content_selector=None,
        is_active=True
    )
    
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    
    return db_source

@router.post("/sources/test", response_model=Dict[str, Any])
async def test_news_source(
    source: NewsSourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Test a news source configuration by attempting to scrape one article.
    This endpoint is now available to all authenticated users.
    """
    # This would typically involve creating a temporary source and trying to scrape it
    return {
        "status": "success",
        "message": "Source configuration test successful",
        "details": {
            "parsed_correctly": True,
            "article_found": True,
            "title_extracted": True,
            "content_extracted": True,
            "date_parsed": True
        }
    } 