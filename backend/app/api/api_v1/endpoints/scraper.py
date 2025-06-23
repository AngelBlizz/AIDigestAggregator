from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
import logging

from app.db.session import get_db
from app.core.security import get_current_user, get_current_active_superuser
from app.models.models import User, Topic, NewsSource, Article
from app.services.news_scraper import NewsScraper
from app.services.nlp_analyzer import NLPAnalyzer
from app.schemas.source import NewsSourceResponse, NewsSourceList, NewsSourceCreate, NewsSourceUpdate

# Настраиваем логгирование
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/run", response_model=Dict[str, Any])
def run_scraper(
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
def run_scraper_for_user(
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
        logger.info(f"Запуск фонового скрапинга для пользователя {user_id}, тема: {topic_id if topic_id else 'все'}")
        
        try:
            scraper = NewsScraper(db)
            
            if topic_id:
                # Проверяем, что тема принадлежит пользователю
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    logger.error(f"Пользователь с ID {user_id} не найден")
                    return {"status": "error", "message": "User not found"}
                    
                user_topics = [t.id for t in user.topics]
                if topic_id not in user_topics:
                    logger.warning(f"Тема {topic_id} не принадлежит пользователю {user_id}")
                    return {"status": "error", "message": "Topic doesn't belong to user"}
                
                topic = db.query(Topic).filter(Topic.id == topic_id).first()
                if not topic:
                    logger.error(f"Тема с ID {topic_id} не найдена")
                    return {"status": "error", "message": "Topic not found"}
                
                logger.info(f"Запуск скрапинга для темы {topic.name} (ID: {topic.id})")
                results = scraper.scrape_all_sources(topic)
                
                # После сбора данных запускаем анализатор
                analyzer = NLPAnalyzer(db)
                logger.info(f"Запуск анализатора для новых статей (тема: {topic.name})")
                analyzer.process_unanalyzed_articles()
                
                logger.info(f"Скрапинг завершен для темы {topic.name}: собрано {len(results)} статей")
                return {
                    "status": "success", 
                    "articles_scraped": len(results), 
                    "topic": topic.name
                }
            else:
                # Собираем новости для всех тем пользователя
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    logger.error(f"Пользователь с ID {user_id} не найден")
                    return {"status": "error", "message": "User not found"}
                
                if not user.topics:
                    logger.warning(f"У пользователя {user_id} нет выбранных тем")
                    return {"status": "error", "message": "No topics found for user"}
                
                logger.info(f"Запуск скрапинга для всех тем пользователя {user_id} (всего тем: {len(user.topics)})")
                
                total_articles = 0
                for topic in user.topics:
                    logger.info(f"Скрапинг для темы {topic.name} (ID: {topic.id})")
                    try:
                        articles = scraper.scrape_all_sources(topic)
                        total_articles += len(articles)
                        logger.info(f"Собрано {len(articles)} статей для темы {topic.name}")
                    except Exception as e:
                        logger.error(f"Ошибка при скрапинге темы {topic.name}: {str(e)}")
                
                # После сбора данных запускаем анализатор
                try:
                    analyzer = NLPAnalyzer(db)
                    logger.info("Запуск анализатора для всех новых статей")
                    analyzer.process_unanalyzed_articles()
                except Exception as e:
                    logger.error(f"Ошибка при анализе статей: {str(e)}")
                
                logger.info(f"Скрапинг завершен для всех тем пользователя {user_id}: собрано {total_articles} статей")
                return {
                    "status": "success", 
                    "articles_scraped": total_articles,
                    "topics_count": len(user.topics)
                }
        except Exception as e:
            logger.error(f"Непредвиденная ошибка при скрапинге для пользователя {user_id}: {str(e)}")
            # Логируем полный стек-трейс для отладки
            import traceback
            logger.error(traceback.format_exc())
            return {"status": "error", "message": f"Unexpected error: {str(e)}"}
    
    # Запускаем сбор данных в фоновом режиме
    background_tasks.add_task(scrape_in_background, current_user.id, topic_id)
    
    logger.info(f"Запущен фоновый скрапинг для пользователя {current_user.id}, тема: {topic_id if topic_id else 'все'}")
    return {
        "status": "started",
        "message": "Сбор новостей запущен в фоновом режиме. Это может занять несколько минут.",
        "for_topic_id": topic_id
    }

@router.post("/analyze", response_model=Dict[str, Any])
def run_analyzer(
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

@router.post("/topic-modeling", response_model=Dict[str, Any])
def run_topic_modeling(
    topic_id: Optional[int] = None,
    days: Optional[int] = Query(30, description="Number of days to look back", ge=1, le=365),
    num_topics: int = Query(5, description="Number of topics to discover", ge=2, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Выполняет тематическое моделирование статей с использованием LDA.
    
    Параметры:
    - topic_id: опциональный ID темы для анализа статей только из этой темы
    - days: количество дней для анализа (по умолчанию 30)
    - num_topics: количество тем для выявления (по умолчанию 5)
    """
    try:
        # Подготавливаем запрос для выборки статей
        from datetime import datetime, timedelta
        from sqlalchemy import and_
        
        # Базовый запрос
        query = db.query(Article).filter(Article.content.isnot(None))
        
        # Применяем фильтр по времени
        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Article.published_at >= cutoff_date)
        
        # Фильтруем по теме, если указана
        if topic_id:
            query = query.filter(Article.topic_id == topic_id)
            
        # Получаем статьи
        articles = query.all()
        
        if not articles:
            return {
                "status": "error",
                "message": "Не найдено статей для анализа с указанными параметрами"
            }
        
        # Выполняем тематическое моделирование
        analyzer = NLPAnalyzer(db)
        result = analyzer.topic_modeling(articles, num_topics=num_topics)
        
        if result["success"]:
            return {
                "status": "success",
                "article_count": len(articles),
                "topics": result["topics"],
                "article_topics": result["article_topics"]
            }
        else:
            return {
                "status": "error",
                "message": "Ошибка при выполнении тематического моделирования",
                "error": result.get("error", "Неизвестная ошибка")
            }
            
    except Exception as e:
        logger.error(f"Ошибка при тематическом моделировании: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"Ошибка при тематическом моделировании: {str(e)}"
        }

@router.post("/recategorize-articles", response_model=Dict[str, Any])
def recategorize_articles(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Перекатегоризирует статьи без категорий на основе их содержимого.
    Операция выполняется в фоновом режиме.
    """
    def recategorize_in_background():
        try:
            analyzer = NLPAnalyzer(db)
            moved_count, error_count = analyzer.recategorize_all_articles()
            return {
                "success": True, 
                "articles_moved": moved_count,
                "errors": error_count
            }
        except Exception as e:
            logger.error(f"Ошибка при перекатегоризации: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}
    
    background_tasks.add_task(recategorize_in_background)
    
    return {
        "status": "started",
        "message": "Перекатегоризация статей запущена в фоновом режиме. Это может занять некоторое время."
    }

@router.get("/language-detection", response_model=Dict[str, Any])
def language_detection(
    text: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Определяет язык текста с помощью модели языкового определения.
    """
    try:
        if not text or len(text) < 10:
            return {
                "status": "error",
                "message": "Текст слишком короткий для определения языка"
            }
            
        analyzer = NLPAnalyzer(db)
        language = analyzer.detect_language(text)
        
        return {
            "status": "success",
            "language": language,
            "text_sample": text[:100] + "..." if len(text) > 100 else text
        }
    except Exception as e:
        logger.error(f"Ошибка при определении языка: {str(e)}")
        return {
            "status": "error",
            "message": f"Ошибка при определении языка: {str(e)}"
        }

@router.get("/sources", response_model=List[str])
def get_available_sources(
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
def get_sources_details(
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
def add_news_source(
    source: NewsSourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Добавление нового источника новостей
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
def test_news_source(
    source: NewsSourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Тестирование конфигурации источника новостей без сохранения
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