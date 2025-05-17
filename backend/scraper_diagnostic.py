import os
import sys
import requests
import logging
from dotenv import load_dotenv
import time
import random
from pathlib import Path
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("ScrapeChecker")

def check_env_file_exists():
    """Проверяет наличие файла .env в директории backend"""
    env_path = Path('./.env')
    if not env_path.exists():
        logger.error("ОШИБКА: Файл .env не найден в директории backend!")
        logger.info("Создаю пример файла .env.example, который вы должны переименовать в .env и заполнить")
        
        with open('./.env.example', 'w', encoding='utf-8') as f:
            f.write("""# База данных
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=news_digest

# Безопасность
SECRET_KEY=your-very-secure-secret-key-here

# API ключи для новостных источников
NEWS_API_KEY=your-newsapi-key
NYTIMES_API_KEY=your-nytimes-key

# Redis (опционально, для кэширования и Celery)
REDIS_HOST=localhost
REDIS_PORT=6379
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Настройки для системы прокси и скрапинга
USE_PROXIES=false
PROXY_ROTATION=false
# Если нужны прокси, раскомментируйте и заполните
# HTTP_PROXY=http://username:password@proxy-server:port
# HTTPS_PROXY=https://username:password@proxy-server:port

# Настройки времени ожидания между запросами (в секундах)
MIN_REQUEST_DELAY=2.0
MAX_REQUEST_DELAY=5.0

# Максимальное количество повторных попыток при ошибках
MAX_RETRIES=5

# Включить отладочный режим скрапинга (больше логов)
DEBUG_SCRAPING=true
""")
        return False
    return True

def check_api_keys():
    """Проверяет наличие необходимых API ключей в .env файле"""
    load_dotenv()
    
    news_api_key = os.environ.get("NEWS_API_KEY", "")
    nytimes_api_key = os.environ.get("NYTIMES_API_KEY", "")
    
    if not news_api_key or news_api_key == "your-newsapi-key":
        logger.warning("ВНИМАНИЕ: NEWS_API_KEY не настроен или имеет значение по умолчанию")
        logger.info("Получите ключ API на https://newsapi.org/ и обновите его в файле .env")
    else:
        logger.info("✓ NEWS_API_KEY настроен")
    
    if not nytimes_api_key or nytimes_api_key == "your-nytimes-key":
        logger.warning("ВНИМАНИЕ: NYTIMES_API_KEY не настроен или имеет значение по умолчанию")
        logger.info("Получите ключ API на https://developer.nytimes.com/ и обновите его в файле .env")
    else:
        logger.info("✓ NYTIMES_API_KEY настроен")

def test_website_accessibility(urls):
    """Проверяет доступность веб-сайтов новостных источников"""
    for name, url in urls.items():
        logger.info(f"Проверка доступности {name} ({url})...")
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Referer': 'https://www.google.com/'
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                logger.info(f"✓ {name} доступен (статус 200)")
            elif response.status_code == 403 or response.status_code == 429:
                logger.warning(f"⚠ {name} возвращает статус {response.status_code} - возможно блокирование или ограничение запросов")
                logger.info(f"  Решение: Настройте прокси или увеличьте задержку между запросами в файле .env")
            else:
                logger.warning(f"⚠ {name} возвращает неожиданный статус: {response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"✗ Ошибка при доступе к {name}: {str(e)}")
        
        # Пауза между запросами для избежания блокировки
        time.sleep(random.uniform(2.0, 4.0))

def check_db_connection():
    """Проверяет соединение с базой данных (SQLite по умолчанию)"""
    try:
        from app.db.session import engine
        from sqlalchemy import text
        
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            for row in result:
                if row[0] == 1:
                    logger.info("✓ Соединение с базой данных успешно")
                    return True
    except Exception as e:
        logger.error(f"✗ Ошибка соединения с базой данных: {str(e)}")
        return False

def provide_solutions():
    """Предоставляет решения распространенных проблем скрапинга"""
    logger.info("\n=== ВОЗМОЖНЫЕ РЕШЕНИЯ ПРОБЛЕМ СО СКРАПИНГОМ ===")
    
    logger.info("1. Настройка прокси:")
    logger.info("   Многие новостные сайты блокируют активный скрапинг. Настройте прокси добавив в .env:")
    logger.info("   USE_PROXIES=true")
    logger.info("   HTTP_PROXY=http://username:password@proxy-server:port")
    logger.info("   HTTPS_PROXY=https://username:password@proxy-server:port")
    
    logger.info("\n2. Увеличение интервалов между запросами:")
    logger.info("   Измените настройки в .env:")
    logger.info("   MIN_REQUEST_DELAY=5.0")
    logger.info("   MAX_REQUEST_DELAY=10.0")
    
    logger.info("\n3. Изменение User-Agent:")
    logger.info("   Некоторые сайты блокируют определенные User-Agent. Вы можете добавить свои в файле:")
    logger.info("   services/news_scraper.py в методе _initialize_user_agents()")
    
    logger.info("\n4. Обновление селекторов:")
    logger.info("   Сайты могут менять структуру HTML. Проверьте селекторы в services/news_scraper.py")
    logger.info("   Используйте инструменты разработчика в браузере (F12), чтобы найти правильные селекторы")
    
    logger.info("\n5. Использование API вместо скрапинга:")
    logger.info("   Некоторые сайты предоставляют API. Настройте API ключи в .env и используйте их")

def check_proxy_settings():
    """Проверяет настройки прокси"""
    load_dotenv()
    
    use_proxies = os.environ.get("USE_PROXIES", "false").lower() == "true"
    http_proxy = os.environ.get("HTTP_PROXY")
    https_proxy = os.environ.get("HTTPS_PROXY")
    
    if use_proxies:
        logger.info("Настройка USE_PROXIES=true")
        
        if not http_proxy and not https_proxy:
            logger.warning("⚠ USE_PROXIES=true, но прокси не настроены")
            logger.info("  Добавьте HTTP_PROXY и HTTPS_PROXY в файл .env")
        else:
            if http_proxy:
                logger.info(f"✓ HTTP_PROXY настроен: {http_proxy}")
            if https_proxy:
                logger.info(f"✓ HTTPS_PROXY настроен: {https_proxy}")
    else:
        logger.info("USE_PROXIES=false - прокси не используются")
        logger.info("Рассмотрите возможность использования прокси, если у вас проблемы с доступом к сайтам")

def test_scraper_module():
    """Тестирует модуль скрапера на основной функциональности"""
    try:
        from app.services.news_scraper import NewsScraper
        from app.db.session import get_db
        
        logger.info("Проверка модуля скрапера...")
        db = next(get_db())
        scraper = NewsScraper(db)
        
        logger.info("✓ Модуль скрапера успешно инициализирован")
        logger.info(f"✓ Настроено {len(scraper.sources)} источников новостей")
        
        return True
    except Exception as e:
        logger.error(f"✗ Ошибка при инициализации модуля скрапера: {str(e)}")
        return False

def manual_test_single_source():
    """Ручное тестирование скрапинга одного источника"""
    from app.services.news_scraper import NewsScraper
    from app.db.session import get_db
    from app.models.models import Topic
    
    source_key = input("Введите ключ источника для тестирования (verge, techcrunch, cnet, wired, hackernews, bloomberg, habr): ")
    
    db = next(get_db())
    scraper = NewsScraper(db)
    
    if source_key not in scraper.sources:
        logger.error(f"Неизвестный источник: {source_key}")
        return
    
    # Создаем временную тему для тестирования
    temp_topic = Topic(
        id=999,
        name="Test Topic",
        description="Временная тема для тестирования",
        keywords="test, testing"
    )
    
    logger.info(f"Тестирование скрапинга источника {source_key}...")
    articles = scraper.scrape_source(source_key, temp_topic, max_articles=2)
    
    if articles:
        logger.info(f"✓ Успешно получены {len(articles)} статей из {source_key}")
        for article in articles:
            logger.info(f"  - {article.title} ({article.url})")
    else:
        logger.warning(f"⚠ Не удалось получить статьи из {source_key}")

def main():
    logger.info("=== ДИАГНОСТИКА СКРАПЕРА НОВОСТЕЙ ===")
    logger.info(f"Время запуска: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Проверка наличия .env файла
    if not check_env_file_exists():
        logger.info("Создайте файл .env на основе .env.example и запустите диагностику снова")
        return
    
    # Проверка API ключей
    check_api_keys()
    
    # Проверка настроек прокси
    check_proxy_settings()
    
    # Проверка доступности новостных сайтов
    news_sources = {
        "The Verge": "https://www.theverge.com/tech",
        "TechCrunch": "https://techcrunch.com/",
        "CNET": "https://www.cnet.com/tech/",
        "Wired": "https://www.wired.com/category/business/",
        "Hacker News": "https://news.ycombinator.com/",
        "Bloomberg": "https://www.bloomberg.com/technology",
        "Хабр": "https://habr.com/ru/all/"
    }
    
    test_website_accessibility(news_sources)
    
    # Проверка соединения с базой данных
    db_ok = check_db_connection()
    
    # Проверка модуля скрапера
    if db_ok:
        scraper_ok = test_scraper_module()
    else:
        logger.warning("Пропуск тестирования модуля скрапера из-за проблем с базой данных")
        scraper_ok = False
    
    # Предоставление решений
    provide_solutions()
    
    # Предложение ручного тестирования
    if scraper_ok:
        if input("\nХотите протестировать конкретный источник новостей? (y/n): ").lower() == 'y':
            manual_test_single_source()
    
    logger.info("\n=== ДИАГНОСТИКА ЗАВЕРШЕНА ===")
    logger.info("Если вы продолжаете испытывать проблемы, проверьте логи и примените предложенные решения")

if __name__ == "__main__":
    main() 