import requests
from bs4 import BeautifulSoup
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
from app.core.config import settings
from app.models.models import Article, Topic
from sqlalchemy.orm import Session
import re
import time
import random
from urllib.parse import urljoin, urlparse
import os

# Настройка логирования
logger = logging.getLogger(__name__)



class NewsSource:
    def __init__(self, name: str, url: str, article_selector: str, title_selector: str, 
                 content_selector: str, date_selector: str, date_format: str, 
                 fallback_article_selector: str = None, fallback_content_selector: str = None):
        self.name = name
        self.url = url
        self.article_selector = article_selector
        self.title_selector = title_selector
        self.content_selector = content_selector
        self.date_selector = date_selector
        self.date_format = date_format
        self.fallback_article_selector = fallback_article_selector
        self.fallback_content_selector = fallback_content_selector

class NewsScraper:
    def __init__(self, db: Session):
        self.db = db
        self.sources = self._initialize_sources()
        self.user_agent_list = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36 Edg/96.0.1054.62',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0'
        ]
        self.session = requests.Session()
    
    def _initialize_sources(self) -> Dict[str, NewsSource]:
        """Инициализируйте поддерживаемые источники новостей с помощью их селекторов"""
        sources = {
            # Современные сайты новостей в области технологий
            "verge": NewsSource(
                name="The Verge",
                url="https://www.theverge.com/tech",
                article_selector="div.duet--content-cards--content-card, div.relative, article",
                title_selector="h2 a, h2.relative a, h2.font-polysans a",
                content_selector="div.duet--article--article-body-component-container, div.max-w-content-block-standard, div[data-component='ArticleBody']",
                date_selector="time, span.relative time, span.text-gray-63",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.c-entry-box--compact, article.relative, div.group",
                fallback_content_selector="div.c-entry-content, div.article-content, div.lg\\:w-\\[680px\\]"
            ),
            "techcrunch": NewsSource(
                name="TechCrunch",
                url="https://techcrunch.com/",
                article_selector="article.post-block, div.post-block, div.post-block__content, div[data-type='post']",
                title_selector="h2.post-block__title a, h3 a, h2 a, h2.headline",
                content_selector="div.article-content, div.post-content, div.article__content",
                date_selector="time.post-block__time, time, div.full-date-time",
                date_format="%Y-%m-%dT%H:%M:%S",
                fallback_article_selector="div.post-block, article.post, div.river-post, article[data-media-id]",
                fallback_content_selector="div.article__content, div.article-content"
            ),
            # Научные и технологические новости
            "cnet": NewsSource(
                name="CNET",
                url="https://www.cnet.com/tech/",
                article_selector="div.c-storiesCard, div.c-storyCard, article.c-pageArticle",
                title_selector="div.c-storiesCard_title a, h3 a, h2 a",
                content_selector="div.c-pageArticle_content, article.c-page, div.article-main-body",
                date_selector="time, span.c-storiesCard_date",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.c-storyCard, div.content-card, article.story",
                fallback_content_selector="article.c-page, div.container--article-main-body"
            ),
            "wired": NewsSource(
                name="Wired",
                url="https://www.wired.com/category/business/",
                article_selector="div.SummaryItemWrapper-gdEuvf, div.SummaryCollageFourBlock-dUocbK, div.summary-item, article.card",
                title_selector="h3 a, h2 a, h3.summary-item__hed, div.card-component__title a",
                content_selector="div.body__inner-container, div.article__body, main.article__body",
                date_selector="time, span.summary-item__publish-date, div.date-published",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.summary-item, article.summary-item, div.card-component",
                fallback_content_selector="article.article, div.article__body-components, div.content-body"
            ),
            # Новостные агрегаторы
            "hackernews": NewsSource(
                name="Hacker News",
                url="https://news.ycombinator.com/",
                article_selector="tr.athing, table.itemlist tr.athing",
                title_selector="span.titleline > a, td.title > span > a, td.title a",
                content_selector="div.comment, div.commtext, div.storylink",
                date_selector="span.age a, span.age",
                date_format="%Y-%m-%dT%H:%M:%S",
                fallback_article_selector="tr.athing, tr.spacer + tr",
                fallback_content_selector="td.default, div.commenttext"
            ),
            # Бизнес-новости
            "bloomberg": NewsSource(
                name="Bloomberg",
                url="https://www.bloomberg.com/technology",
                article_selector="article.story-package-module__story, div.story-list-story, article.story-list-item",
                title_selector="h3 a, h3.story-package-module__headline a, div.headline a",
                content_selector="div.body-content, div.body-copy-v2, div.body-copy",
                date_selector="time, div.published-info time, div.timestamp",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="article.story-package-module__story, article.story-list, div.single-story-module",
                fallback_content_selector="div.body-copy-v2, div.body-content, article.feature-article"
            ),
            # Русские технологические новости
            "habr": NewsSource(
                name="Хабр",
                url="https://habr.com/ru/all/",
                article_selector="article.tm-articles-list__item, article.post, article.post_preview, div[class*='article'], div[class*='post']",
                title_selector="h2.tm-title a, h2.tm-article-snippet__title span, h2.post__title a, a.post__title_link, a.tm-title__link, span.tm-article-snippet__title-link",
                content_selector="div.article-formatted-body, div.post__text, div.post__text-html, div.tm-article-body, article.tm-article-blocks",
                date_selector="span.tm-article-snippet__datetime-published time, div.post__time, span.post__time, span[data-time], span.tm-article-snippet__datetime",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="article.post, div.post_preview, div.posts_list, article.tm-articles-list__item",
                fallback_content_selector="div.post__text, div.post__text-html, div.post__content-html, div.tm-article-body"
            ),
            # Добавленные новые источники
            # Технологические и IT новости
            "arstechnica": NewsSource(
                name="Ars Technica",
                url="https://arstechnica.com/",
                article_selector="article, div.article, li.article",
                title_selector="h2 a, h1.heading, header h1, h3 a",
                content_selector="div.article-content, section.article-guts, div.article-guts",
                date_selector="time, span.date, header time",
                date_format="%Y-%m-%dT%H:%M:%S%z",
                fallback_article_selector="div.listing, section.archive, ul.stories li",
                fallback_content_selector="div.article-content, div.post-content"
            ),
            "techradar": NewsSource(
                name="TechRadar",
                url="https://www.techradar.com/news",
                article_selector="div.listingResult, article.article-card, div[data-page='listingPage'] article",
                title_selector="h3 a, h3.article-name a, h2 a",
                content_selector="div#article-body, div.content-body, div.text-copy",
                date_selector="time, span.relative-date, span.published-date",
                date_format="%Y-%m-%dT%H:%M:%S%z",
                fallback_article_selector="div.box, article.news-article, article.review",
                fallback_content_selector="div.text-copy, div.article-body, div#article-body"
            ),
            "zdnet": NewsSource(
                name="ZDNet",
                url="https://www.zdnet.com/",
                article_selector="article.item, div.river-well, div.riverPost-card",
                title_selector="h3 a, div.title a, h1.storyTitle, h2 a",
                content_selector="div.storyBody, div.article-body, div.contentBody",
                date_selector="time, span.datePublished, div.meta time",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.content, div.story, article.article",
                fallback_content_selector="div.article-body, div.content-body, div.contentBody"
            ),
            # Научные новости
            "sciencedaily": NewsSource(
                name="Science Daily",
                url="https://www.sciencedaily.com/news/computers_math/computer_science/",
                article_selector="div.latest-head, ul.latest-head li, div.latest-summary",
                title_selector="h3 a, h4 a, a.latest-head, a.headline",
                content_selector="div#text, div.story, div.article-text",
                date_selector="dd.date, span.date, div.date",
                date_format="%B %d, %Y",
                fallback_article_selector="div.headline, ul.featured-stories li, div.summary",
                fallback_content_selector="div.article-main, div.story_text, div#story_text"
            ),
            "technologyreview": NewsSource(
                name="MIT Technology Review",
                url="https://www.technologyreview.com/",
                article_selector="div[class*='card'], article, div.contentItem, div.feedItem",
                title_selector="h3 a, h2 a, div.contentItem__title a, a.feedItem__link",
                content_selector="div.article__body, div.contentItem__content, div.gated-article-body",
                date_selector="time, div.byline time, div.meta__pubdate",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.feed-item, article.article, div.card",
                fallback_content_selector="div.body, div.article-body, div.content-body"
            ),
            # Бизнес и финансовые новости
            "businessinsider": NewsSource(
                name="Business Insider",
                url="https://www.businessinsider.com/tech",
                article_selector="div.tout-title-link, div.river-post, article.summary-list-item",
                title_selector="h2 a, a.tout-title-link, h3 a",
                content_selector="div.content-lock-content, section.post-content, div.article-body-text",
                date_selector="time, span.publish-date, span.byline-timestamp",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.river-post, article.post, div.post-container",
                fallback_content_selector="div.post-content, section.post-content-inner"
            ),
            "venturebeat": NewsSource(
                name="VentureBeat",
                url="https://venturebeat.com/",
                article_selector="article.ArticleListing, div.ArticleCard, div.ArticleItem",
                title_selector="h2 a, h3 a, span.ArticleTitle a",
                content_selector="div.article-content, div.content-container, div.article-body",
                date_selector="time, span.ArticleTimestamp, div.meta time",
                date_format="%Y-%m-%dT%H:%M:%S%z",
                fallback_article_selector="div.article, article.list-item, div.featured-story",
                fallback_content_selector="div.entry-content, div.article-body, div.content"
            ),
            # Российские источники технологических новостей
            "vc": NewsSource(
                name="VC.ru",
                url="https://vc.ru/",
                article_selector="div.feed__item, div.content-feed__item, div.l-inline",
                title_selector="div.content-title a, h2.content-title, div.content-header__title a",
                content_selector="div.content--full, div.l-entry__content, div.content",
                date_selector="time, span.time_published, span.entry_time",
                date_format="%Y-%m-%dT%H:%M:%S%z",
                fallback_article_selector="div.block-entry, div.entry, div.feed-item",
                fallback_content_selector="div.b-text, div.entry-content, div.content-body"
            ),
            "tadviser": NewsSource(
                name="TAdviser",
                url="https://www.tadviser.ru/index.php/ИТ-новости",
                article_selector="div.news_short, div.news_block, div.news_item",
                title_selector="a.news_title, div.news_title a, h3 a",
                content_selector="div.news_content, div.text, div.mw-parser-output",
                date_selector="span.news_date, div.date, span.date",
                date_format="%d.%m.%Y",
                fallback_article_selector="div.short_news, div.news_wrap, div.news_list",
                fallback_content_selector="div.article-content, div.content-text, div.mw-content-text"
            ),
            # Технологические блоги
            "engadget": NewsSource(
                name="Engadget",
                url="https://www.engadget.com/",
                article_selector="div.o-hit, article.c-entry-box--compact, div.c-entry-box",
                title_selector="h2 a, h2.c-entry-box--compact__title a, div.c-entry-box__title a",
                content_selector="div.c-entry-content, div.article-text, div.l-col__main",
                date_selector="time, div.c-byline time, span.c-byline__item",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.o-hit__body, article.c-entry, div.article-card",
                fallback_content_selector="div.article-content, div.c-entry-content, div.article-body"
            ),
            "mashable": NewsSource(
                name="Mashable",
                url="https://mashable.com/tech",
                article_selector="div.flex-1, article.w-full, div.w-full",
                title_selector="h2 a, h3 a, span.font-bold a",
                content_selector="div.article-content, div.w-full, div.article-body",
                date_selector="time, span.text-xs, div.byline",
                date_format="%Y-%m-%dT%H:%M:%S.%fZ",
                fallback_article_selector="div.card, article.article, div.flex-1",
                fallback_content_selector="div.post-content, div.article-content, section.article-body"
            ),
        }
        return sources
    
    def _get_random_user_agent(self) -> str:
        """Получить случайный user agent для избежания блокировки"""
        return random.choice(self.user_agent_list)
    
    def _get_headers(self) -> Dict[str, str]:
        """Создать заголовки для запросов"""
        return {
            'User-Agent': self._get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
            'Connection': 'keep-alive',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        }
    
    def _parse_date(self, date_text: str, date_format: str) -> Optional[datetime]:
        """Разбор строки даты в объект datetime с несколькими попытками возврата"""
        if not date_text:
            return datetime.now()
            
        date_text = date_text.strip()
        
        # Попробовать с указанным форматом
        try:
            return datetime.strptime(date_text, date_format)
        except ValueError:
            pass
        
        # Попробовать общие форматы
        common_formats = [
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%B %d, %Y",
            "%d %B %Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
            "%a, %d %b %Y %H:%M:%S %z",
            # Add more specific formats for popular sites
            "%B %d, %Y %I:%M %p",  # "May 16, 2025 12:45 PM" (Wired format)
            "%Y-%m-%dT%H:%M:%S%z",  # ISO format with timezone
            "%d.%m.%Y",  # European format
            "%d.%m.%Y %H:%M",  # European format with time
        ]
        
        for fmt in common_formats:
            try:
                return datetime.strptime(date_text, fmt)
            except ValueError:
                continue
        
        # Попробовать извлечь дату с помощью регулярного выражения для ISO формата
        iso_match = re.search(r'(\d{4}-\d{2}-\d{2})', date_text)
        if iso_match:
            try:
                return datetime.strptime(iso_match.group(1), "%Y-%m-%d")
            except ValueError:
                pass
        
        # Try to extract month name, day and year pattern (e.g. "May 16, 2025")
        month_day_year = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', date_text)
        if month_day_year:
            try:
                month, day, year = month_day_year.groups()
                month_num = {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4,
                    'may': 5, 'june': 6, 'july': 7, 'august': 8,
                    'september': 9, 'october': 10, 'november': 11, 'december': 12
                }.get(month.lower(), 1)
                return datetime(int(year), month_num, int(day))
            except (ValueError, KeyError):
                pass
        
        # Обработать относительные даты, такие как "2 дня назад"
        relative_match = re.search(r'(\d+)\s+(day|hour|minute|second)s?\s+ago', date_text, re.IGNORECASE)
        if relative_match:
            try:
                value = int(relative_match.group(1))
                unit = relative_match.group(2).lower()
                
                if unit == 'day':
                    return datetime.now() - timedelta(days=value)
                elif unit == 'hour':
                    return datetime.now() - timedelta(hours=value)
                elif unit == 'minute':
                    return datetime.now() - timedelta(minutes=value)
                elif unit == 'second':
                    return datetime.now() - timedelta(seconds=value)
            except (ValueError, IndexError):
                pass
        
        # Последняя возможность - вернуть текущую дату
        logger.warning(f"Не удалось разобрать дату: {date_text} с любым известным форматом, используя текущую дату")
        return datetime.now()
    
    def _clean_text(self, text: str) -> str:
        """Очистить текст, удалив лишние пробелы"""
        if not text:
            return ""
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def _extract_article_url(self, article_element, source: NewsSource) -> str:
        """Извлечь URL статьи из элемента"""
        try:
            # Try with direct title selector
            a_tag = article_element.select_one(source.title_selector)
            if a_tag and a_tag.has_attr('href'):
                url = a_tag['href']
                # Сделать URL абсолютным, если он относительный
                if not url.startswith('http'):
                    parsed_base = urlparse(source.url)
                    base_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
                    url = urljoin(base_url, url)
                return url
            
            # If title selector doesn't work, try with any a tag
            all_links = article_element.select('a')
            for link in all_links:
                if link.has_attr('href') and len(link.text.strip()) > 10:  # Only links with text
                    url = link['href']
                    if not url.startswith('http'):
                        parsed_base = urlparse(source.url)
                        base_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
                        url = urljoin(base_url, url)
                    return url
            
            # Try with the article element itself if it's an a tag
            if article_element.name == 'a' and article_element.has_attr('href'):
                url = article_element['href']
                if not url.startswith('http'):
                    parsed_base = urlparse(source.url)
                    base_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
                    url = urljoin(base_url, url)
                return url
                
        except Exception as e:
            logger.error(f"Error extracting URL: {str(e)}")
        return ""
    
    def _check_if_article_exists(self, url: str) -> bool:
        """Проверяет, существует ли статья с данным URL в базе данных"""
        if not url:
            return False
        return self.db.query(Article).filter(Article.url == url).first() is not None
    
    def _delay_between_requests(self):
        """Добавить задержку между запросами, чтобы избежать перегрузки сайта"""
        min_delay = float(os.environ.get("MIN_REQUEST_DELAY", "3.0"))
        max_delay = float(os.environ.get("MAX_REQUEST_DELAY", "6.0"))
        time.sleep(random.uniform(min_delay, max_delay))
    
    def _safe_request(self, url: str, timeout: int = 30, max_retries: int = 5) -> Tuple[bool, Optional[requests.Response]]:
        """Сделать безопасный HTTP-запрос с повторами и обработкой ошибок"""
        headers = self._get_headers()
        retries = 0
        
        # Определение возможных прокси
        proxies = None
        use_proxies = os.environ.get("USE_PROXIES", "false").lower() == "true"
        if use_proxies:
            http_proxy = os.environ.get("HTTP_PROXY")
            https_proxy = os.environ.get("HTTPS_PROXY")
            if http_proxy or https_proxy:
                proxies = {
                    "http": http_proxy,
                    "https": https_proxy
                }
                logger.info(f"Используем прокси для запроса к {url}")
        
        # Проверяем, требуется ли специальная обработка для сайта с ограниченным доступом
        is_restricted_site = any(restricted_domain in url for restricted_domain in [
            "bloomberg.com", "wsj.com", "ft.com", "nytimes.com", 
            "wapo.st", "washingtonpost.com", "economist.com"
        ])
        
        if is_restricted_site:
            logger.warning(f"Сайт с ограниченным доступом: {url}")
            # Если сайт с ограничениями и прокси не настроены, увеличим задержки
            if not proxies:
                # Дополнительные параметры для обхода ограничений
                headers["Cache-Control"] = "max-age=0"
                headers["Upgrade-Insecure-Requests"] = "1"
                headers["Accept-Language"] = "en-US,en;q=0.9"
                # Добавляем случайный параметр для обхода кэширования
                url_with_param = url
                if "?" in url:
                    url_with_param += f"&_={int(time.time())}"
                else:
                    url_with_param += f"?_={int(time.time())}"
                url = url_with_param
        
        while retries < max_retries:
            try:
                if proxies:
                    response = self.session.get(url, headers=headers, timeout=timeout, proxies=proxies)
                else:
                    response = self.session.get(url, headers=headers, timeout=timeout)
                
                if response.status_code == 200:
                    # Проверка на наличие блокирующего контента (например, paywall)
                    if is_restricted_site and self._is_paywall_content(response.text):
                        logger.warning(f"Обнаружен paywall на {url}, попытка использовать альтернативный метод")
                        # Если обнаружен paywall, и у нас есть прокси, попробуем другой прокси
                        if proxies and os.environ.get("PROXY_ROTATION", "false").lower() == "true":
                            # Ротация прокси
                            http_proxies = os.environ.get("HTTP_PROXIES", "").split(",")
                            https_proxies = os.environ.get("HTTPS_PROXIES", "").split(",")
                            
                            if http_proxies and len(http_proxies) > 1:
                                current_idx = http_proxies.index(proxies["http"]) if proxies["http"] in http_proxies else -1
                                next_idx = (current_idx + 1) % len(http_proxies)
                                proxies["http"] = http_proxies[next_idx]
                                
                            if https_proxies and len(https_proxies) > 1:
                                current_idx = https_proxies.index(proxies["https"]) if proxies["https"] in https_proxies else -1
                                next_idx = (current_idx + 1) % len(https_proxies)
                                proxies["https"] = https_proxies[next_idx]
                            
                            logger.info(f"Переключение на другой прокси для {url}")
                            retries += 1
                            time.sleep(random.uniform(3.0, 7.0))
                            continue
                        
                        # Если нет прокси или ротация не включена, создаем минимальный ответ
                        logger.warning(f"Невозможно обойти ограничения для {url}, возвращаем частичные данные")
                        return True, response
                    
                    return True, response
                
                if response.status_code == 403 or response.status_code == 429:
                    # Запрещено или ограничено - подождите дольше и повторите с новыми заголовками
                    logger.warning(f"Ограничено или запрещено доступом к {url}, ожидание перед повтором (статус {response.status_code})")
                    
                    # Увеличиваем время ожидания с каждой попыткой
                    wait_time = random.uniform(10.0 + retries * 5, 20.0 + retries * 5)
                    logger.info(f"Ожидание {wait_time:.1f} секунд перед повтором запроса")
                    time.sleep(wait_time)
                    
                    # Получаем новые заголовки и меняем User-Agent
                    headers = self._get_headers()
                    
                    # Если включена ротация прокси, пытаемся использовать другой прокси
                    if proxies and os.environ.get("PROXY_ROTATION", "false").lower() == "true":
                        http_proxies = os.environ.get("HTTP_PROXIES", "").split(",")
                        https_proxies = os.environ.get("HTTPS_PROXIES", "").split(",")
                        
                        if http_proxies and len(http_proxies) > 1:
                            current_idx = http_proxies.index(proxies["http"]) if proxies["http"] in http_proxies else -1
                            next_idx = (current_idx + 1) % len(http_proxies)
                            proxies["http"] = http_proxies[next_idx]
                            
                        if https_proxies and len(https_proxies) > 1:
                            current_idx = https_proxies.index(proxies["https"]) if proxies["https"] in https_proxies else -1
                            next_idx = (current_idx + 1) % len(https_proxies)
                            proxies["https"] = https_proxies[next_idx]
                        
                        logger.info(f"Переключение на другой прокси после ограничения доступа")
                elif response.status_code in [404, 410]:
                    # Ресурс не найден или удален
                    logger.error(f"Ресурс не найден или удален: {url} (статус {response.status_code})")
                    return False, None
                elif response.status_code >= 500:
                    # Серверная ошибка, возможно временная
                    logger.error(f"Серверная ошибка при доступе к {url}: {response.status_code}")
                    time.sleep(random.uniform(5.0, 10.0))
                else:
                    logger.error(f"HTTP-ошибка при доступе к {url}: {response.status_code}")
                    
                retries += 1
                
            except requests.exceptions.Timeout:
                logger.warning(f"Таймаут при доступе к {url}, попытка {retries + 1}/{max_retries}")
                retries += 1
                time.sleep(random.uniform(3.0, 7.0))
            except requests.exceptions.ProxyError:
                logger.error(f"Ошибка прокси при доступе к {url}")
                # Если включена ротация прокси, пытаемся использовать другой прокси
                if proxies and os.environ.get("PROXY_ROTATION", "false").lower() == "true":
                    http_proxies = os.environ.get("HTTP_PROXIES", "").split(",")
                    https_proxies = os.environ.get("HTTPS_PROXIES", "").split(",")
                    
                    if http_proxies and len(http_proxies) > 1:
                        current_idx = http_proxies.index(proxies["http"]) if proxies["http"] in http_proxies else -1
                        next_idx = (current_idx + 1) % len(http_proxies)
                        proxies["http"] = http_proxies[next_idx]
                        
                    if https_proxies and len(https_proxies) > 1:
                        current_idx = https_proxies.index(proxies["https"]) if proxies["https"] in https_proxies else -1
                        next_idx = (current_idx + 1) % len(https_proxies)
                        proxies["https"] = https_proxies[next_idx]
                    
                    logger.info(f"Переключение на другой прокси после ошибки прокси")
                    retries += 1
                    time.sleep(random.uniform(3.0, 7.0))
                else:
                    # Если прокси не настроены или ротация отключена, отключаем прокси
                    proxies = None
                    logger.info(f"Отключение прокси после ошибки")
                    retries += 1
                    time.sleep(random.uniform(3.0, 7.0))
            except requests.exceptions.ConnectionError:
                logger.error(f"Ошибка соединения при доступе к {url}")
                retries += 1
                time.sleep(random.uniform(5.0, 10.0))
            except requests.exceptions.RequestException as e:
                logger.error(f"Ошибка при доступе к {url}: {str(e)}")
                retries += 1
                time.sleep(random.uniform(3.0, 7.0))
        
        return False, None
    
    def _is_paywall_content(self, html_content: str) -> bool:
        """Проверяет, содержит ли HTML контент признаки paywall или других ограничений доступа"""
        # Ключевые слова, которые могут указывать на paywall
        paywall_indicators = [
            "subscribe", "subscription", "premium", "paywall", "sign in", 
            "sign up", "members", "регистрация", "подписка", "платный доступ",
            "create account", "become a member", "paid content", "continue reading",
            "register to continue", "continue for", "unlock", "create a free account"
        ]
        
        # Проверяем наличие индикаторов paywall в нижнем регистре
        html_lower = html_content.lower()
        
        # Проверяем наличие паттернов, которые могут указывать на paywall
        # Например, элементы, закрывающие контент
        overlay_patterns = [
            'class="[^"]*paywall', 'class="[^"]*modal', 'class="[^"]*subscribe',
            'id="[^"]*paywall', 'id="[^"]*modal', 'id="[^"]*subscribe',
            'class="[^"]*wall', 'class="[^"]*block', 'class="[^"]*overlay'
        ]
        
        # Считаем количество индикаторов
        indicator_count = sum(1 for indicator in paywall_indicators if indicator in html_lower)
        overlay_count = sum(1 for pattern in overlay_patterns if re.search(pattern, html_lower))
        
        # Проверяем количество доступного текста
        soup = BeautifulSoup(html_content, 'html.parser')
        text_content = soup.get_text()
        
        # Если текста слишком мало, возможно, это paywall
        if len(text_content.strip()) < 1000 and (indicator_count > 3 or overlay_count > 1):
            return True
            
        # Если достаточно много индикаторов paywall, считаем, что это paywall
        return indicator_count > 5 or overlay_count > 2
    
    def scrape_source(self, source_key: str, topic: Topic, max_articles: int = 5) -> List[Article]:
        """Скрапинг конкретного источника новостей для статей"""
        if source_key not in self.sources:
            logger.error(f"Неизвестный источник: {source_key}")
            return []
        
        source = self.sources[source_key]
        logger.info(f"Скрапинг {source.name} для {topic.name} статей")
        
        articles = []
        try:
            # Проверить доступность URL
            success, response = self._safe_request(source.url)
            if not success:
                logger.error(f"Не удалось доступиться к {source.url} после нескольких повторов")
                return []
            
            soup = BeautifulSoup(response.text, 'html.parser')
            article_elements = soup.select(source.article_selector)
            
            if not article_elements and source.fallback_article_selector:
                logger.warning(f"Не найдены элементы с основным селектором, пытаемся использовать резервный для {source.name}")
                article_elements = soup.select(source.fallback_article_selector)
            
            if not article_elements:
                logger.warning(f"Не найдены элементы с основным селектором, пытаемся использовать резервный для {source.name}")
                # Крайний случай: пытаемся найти любые элементы, которые могут содержать статьи
                article_elements = soup.select('article, div.article, div.story, div.post, div[class*="article"], div[class*="post"], div[class*="story"], a[href*="/20"], a[href*="article"], div.headline, h2 a, h3 a')
                
                # Try to find any div that contains an anchor with substantial text
                if not article_elements:
                    for link in soup.select('a'):
                        if link.has_attr('href') and 'http' in link['href'] and len(link.text.strip()) > 15:
                            article_elements.append(link)
                
                if not article_elements:
                    # Сохраняем HTML для диагностики
                    diagnostic_filename = f'debug_{source_key}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html'
                    with open(diagnostic_filename, 'w', encoding='utf-8') as f:
                        f.write(response.text)
                    logger.warning(f"Сохранен HTML для диагностики в файл {diagnostic_filename}")
                    return []
                
            logger.info(f"Найдено {len(article_elements)} элементов статей из {source.name}")
            
            for article_element in article_elements[:max_articles]:  # Ограничение на указанное максимальное количество статей
                try:
                    # Извлечь URL статьи и проверить, существует ли она в базе данных
                    url = self._extract_article_url(article_element, source)
                    
                    if not url:
                        logger.warning(f"Не удалось извлечь URL из статьи в {source.name}")
                        continue
                        
                    if self._check_if_article_exists(url):
                        logger.info(f"Статья уже существует: {url}")
                        continue
                    
                    # Extract title from the listing page
                    title_element = article_element.select_one(source.title_selector)
                    
                    # Специальная обработка для Habr
                    if source.name == "Хабр" and (not title_element or not title_element.text.strip()):
                        # Пробуем различные селекторы, специфичные для Habr
                        potential_selectors = [
                            "h2.tm-title a", "h2.tm-article-snippet__title span", 
                            "a.tm-title__link", "a.tm-article-snippet__title-link",
                            "h2 a", "h2 span", ".article-formatted-body h1",
                            "span.tm-article-snippet__title-link"
                        ]
                        
                        for selector in potential_selectors:
                            title_element = article_element.select_one(selector)
                            if title_element and title_element.text.strip():
                                break
                                
                        # Если всё еще не найден, попробуем искать любой заголовок
                        if not title_element or not title_element.text.strip():
                            for header in article_element.select('h1, h2, h3'):
                                if header.text.strip():
                                    title_element = header
                                    break
                    
                    if not title_element:
                        logger.warning(f"Не найден заголовок с селектором '{source.title_selector}' в {source.name}")
                        # Попробуем найти любой заголовок в элементе
                        for header_selector in ['h1, h2, h3, h4, .title, [class*="title"], a', 'a[href]', '[class*="title"]', '[class*="headline"]']:
                            title_element = article_element.select_one(header_selector)
                            if title_element and title_element.text.strip():
                                break
                        
                        # Special case for Habr - try to extract from URL
                        if source.name == "Хабр" and url:
                            # Extract the last part of the URL which often contains the title
                            path_parts = url.split('/')
                            if len(path_parts) > 4:
                                # The title is usually in the last part, with hyphens
                                slug = path_parts[-1].split('?')[0].replace('-', ' ').title()
                                # Create a fake element with the title
                                if len(slug) > 10:
                                    title_element = type('obj', (object,), {'text': slug})
                        
                        # Special case for The Verge and CNET
                        if source.name in ["The Verge", "CNET"] and not title_element:
                            # Find any link with substantial text that might be a title
                            for link in article_element.select('a'):
                                if link.has_attr('href') and len(link.text.strip()) > 15:
                                    title_element = link
                                    break
                        
                        # Special case for Bloomberg
                        if source.name == "Bloomberg" and not title_element:
                            # For Bloomberg, try to get title from the URL or other elements
                            if url:
                                # Try to extract title from URL
                                parts = url.split('/')
                                if len(parts) > 4:
                                    # Extract the slug part (last part of URL)
                                    slug = parts[-1].split('?')[0].replace('-', ' ').title()
                                    if len(slug) > 10:
                                        title_element = type('obj', (object,), {'text': slug})
                                        
                        if not title_element or not title_element.text.strip():
                            logger.warning(f"Не удалось найти заголовок для статьи {url}, пропускаем")
                            continue
                    
                    title = self._clean_text(title_element.text)
                    if not title:
                        logger.warning(f"Пустой заголовок для статьи {url}, пропускаем")
                        continue
                        
                    logger.info(f"Найдена статья: {title}")
                    
                    # Посетить страницу статьи, чтобы получить содержимое
                    self._delay_between_requests()
                    
                    success, article_response = self._safe_request(url)
                    if not success:
                        logger.error(f"Не удалось доступиться к URL статьи {url}")
                        continue
                    
                    article_soup = BeautifulSoup(article_response.text, 'html.parser')
                    
                    # If title is still empty or too short, try to extract it from the article page
                    if len(title) < 10:
                        article_title_element = article_soup.select_one('h1, h1.tm-article-snippet__title, h1.post__title')
                        if article_title_element and article_title_element.text.strip():
                            title = self._clean_text(article_title_element.text)
                            logger.info(f"Заголовок извлечен из страницы статьи: {title}")
                    
                    # Extract content
                    content_element = article_soup.select_one(source.content_selector)
                    if not content_element and source.fallback_content_selector:
                        content_element = article_soup.select_one(source.fallback_content_selector)
                    
                    if not content_element:
                        # Попробуем найти содержимое по общим селекторам
                        content_element = article_soup.select_one('article, main, [class*="article-body"], [class*="content"], [class*="post-content"]')
                    
                    if not content_element:
                        logger.warning(f"Не найдено содержимое для статьи в {url}")
                        # Создать минимальную статью без содержимого
                        content = f"Сводка недоступна. Посмотрите оригинальную статью по ссылке: {url}"
                    else:
                        # Удалить скрипты, стили и другие неконтентные элементы
                        for tag in content_element.select('script, style, meta, link, [class*="ad"], [id*="ad"], [class*="banner"]'):
                            tag.decompose()
                        content = self._clean_text(content_element.text)
                        
                        # Обрезать очень длинное содержимое
                        if len(content) > 10000:
                            content = content[:10000] + "... (содержимое обрезано)"
                    
                    # Извлечь дату
                    date_element = article_soup.select_one(source.date_selector)
                    published_at = datetime.now()
                    if date_element:
                        date_text = date_element.text
                        # Если дата имеет машиночитаемый атрибут, используйте его
                        if date_element.has_attr('datetime'):
                            date_text = date_element['datetime']
                        
                        published_at = self._parse_date(date_text, source.date_format)
                    
                    # Создать и сохранить статью
                    article = Article(
                        title=title,
                        content=content,
                        url=url,
                        source=source.name,
                        published_at=published_at,
                        topic_id=topic.id
                    )
                    
                    articles.append(article)
                    logger.info(f"Создана статья: {title} ({url})")
                    
                except Exception as e:
                    logger.error(f"Ошибка при обработке статьи: {str(e)}")
                    # Логируем полный стек-трейс для отладки
                    import traceback
                    logger.error(traceback.format_exc())
            
            # Сохранить статьи в базу данных
            if articles:
                try:
                    for article in articles:
                        self.db.add(article)
                    self.db.commit()
                    logger.info(f"Сохранено {len(articles)} новых статей из {source.name} в базу данных")
                except Exception as e:
                    logger.error(f"Ошибка при сохранении статей в базу данных: {str(e)}")
                    self.db.rollback()
            else:
                logger.warning(f"Не найдено новых статей из {source.name}")
            
            return articles
            
        except Exception as e:
            logger.error(f"Ошибка при скрапинге {source.name}: {str(e)}")
            return []
    
    def scrape_all_sources(self, topic: Topic, max_articles_per_source: int = 5) -> List[Article]:
        """Скрапинг всех настроенных источников для конкретной темы"""
        all_articles = []
        
        # Рандомизировать источники для равномерной нагрузки и избежания шаблонов
        source_keys = list(self.sources.keys())
        random.shuffle(source_keys)
        
        logger.info(f"Начинаю скрапинг для темы '{topic.name}' из {len(source_keys)} источников")
        
        for source_key in source_keys:
            try:
                logger.info(f"Скрапинг источника {source_key} для темы '{topic.name}'")
                articles = self.scrape_source(source_key, topic, max_articles_per_source)
                
                if articles:
                    logger.info(f"Найдено {len(articles)} статей из источника {source_key}")
                    all_articles.extend(articles)
                else:
                    logger.info(f"Не найдено новых статей из источника {source_key}")
                    
                # Большая задержка между разными источниками
                time.sleep(random.uniform(5.0, 10.0))
            except Exception as e:
                logger.error(f"Ошибка при скрапинге {source_key} для {topic.name}: {str(e)}")
                # Логируем полный стек-трейс для отладки
                import traceback
                logger.error(traceback.format_exc())
        
        if not all_articles:
            logger.warning(f"Не найдено статей для темы {topic.name} из любого источника")
            
            # Проверяем, есть ли уже статьи в базе для этой темы
            existing_articles_count = self.db.query(Article).filter(Article.topic_id == topic.id).count()
            
            if existing_articles_count > 0:
                logger.info(f"В базе уже есть {existing_articles_count} статей для темы {topic.name}")
                # Возвращаем пустой список, так как новых статей нет, но старые существуют
                return []
                
            # Создаем заглушку статьи, если не удалось найти ни одной и нет существующих
            current_date = datetime.now().strftime("%Y-%m-%d")
            
            # Создаем значимое содержимое для заглушки статьи
            fallback_content = f"""
            <h2>Новости по теме {topic.name} временно недоступны</h2>
            <p>Наш сервис новостей в настоящий момент не может получить актуальные статьи по теме "{topic.name}".</p>
            <p>Это может быть вызвано следующими причинами:</p>
            <ul>
                <li>Временная недоступность новостных источников</li>
                <li>Изменения в структуре новостных сайтов</li>
                <li>Ограничения доступа к контенту</li>
            </ul>
            <p>Пожалуйста, проверьте наличие новостей позже.</p>
            <p>Последняя проверка: {current_date}</p>
            """
            
            fallback_article = Article(
                title=f"Дайджест новостей: {topic.name} [{current_date}]",
                content=fallback_content,
                url=f"https://aidigestaggregator.com/placeholder/{topic.name.lower().replace(' ', '-')}",
                source="System",
                published_at=datetime.now(),
                topic_id=topic.id
            )
            
            # Проверяем, не существует ли уже такая заглушка
            placeholder_exists = self.db.query(Article).filter(
                Article.source == "System",
                Article.topic_id == topic.id,
                Article.published_at >= datetime.now() - timedelta(days=1)
            ).first()
            
            if not placeholder_exists:
                logger.info(f"Создаю заглушку статьи для темы {topic.name}")
                self.db.add(fallback_article)
                self.db.commit()
                all_articles.append(fallback_article)
            else:
                logger.info(f"Заглушка для темы {topic.name} уже существует, пропускаю создание")
        else:
            logger.info(f"Всего собрано статей для темы {topic.name}: {len(all_articles)}")
            
        return all_articles
    
    def scrape_for_all_topics(self) -> Dict[str, int]:
        """Скрапинг для всех тем в базе данных"""
        results = {}
        topics = self.db.query(Topic).all()
        
        if not topics:
            logger.warning("Не найдено тем для скрапинга")
            return results
        
        logger.info(f"Начало скрапинга для {len(topics)} тем")
        
        # Группируем источники по тегам
        sources_by_tags = self._group_sources_by_tags()
        
        for topic in topics:
            try:
                # Определяем подходящие источники для темы
                topic_sources = self._get_sources_for_topic(topic, sources_by_tags)
                
                if not topic_sources:
                    logger.warning(f"Не найдено подходящих источников для темы '{topic.name}'")
                    results[topic.name] = 0
                    continue
                
                logger.info(f"Скрапинг для темы '{topic.name}' из {len(topic_sources)} источников")
                
                # Скрапим только из подходящих источников
                articles = []
                for source_key in topic_sources:
                    source_articles = self.scrape_source(source_key, topic)
                    articles.extend(source_articles)
                
                results[topic.name] = len(articles)
                logger.info(f"Для темы '{topic.name}' найдено {len(articles)} статей")
                
            except Exception as e:
                logger.error(f"Ошибка при скрапинге для темы '{topic.name}': {str(e)}")
                results[topic.name] = 0
        
        return results

    def _group_sources_by_tags(self) -> Dict[str, List[str]]:
        """Группировка источников по тегам"""
        # Определяем теги для каждого источника
        source_tags = {
            # Технологические источники
            "verge": ["technology", "tech", "gadgets", "reviews"],
            "techcrunch": ["technology", "tech", "startups", "business"],
            "cnet": ["technology", "tech", "reviews", "gadgets"],
            "wired": ["technology", "tech", "science", "culture"],
            "arstechnica": ["technology", "tech", "science", "it"],
            "techradar": ["technology", "tech", "reviews", "gadgets"],
            "zdnet": ["technology", "tech", "business", "it"],
            
            # Научные источники
            "sciencedaily": ["science", "research", "academic"],
            "technologyreview": ["technology", "science", "research", "innovation"],
            
            # Бизнес источники
            "bloomberg": ["business", "finance", "economy"],
            "businessinsider": ["business", "finance", "tech"],
            
            # Агрегаторы
            "hackernews": ["technology", "programming", "startups"],
            
            # Русскоязычные источники
            "habr": ["technology", "programming", "it", "russian"]
        }
        
        # Инвертируем словарь для получения источников по тегам
        tags_to_sources = {}
        for source, tags in source_tags.items():
            for tag in tags:
                if tag not in tags_to_sources:
                    tags_to_sources[tag] = []
                tags_to_sources[tag].append(source)
        
        return tags_to_sources
    
    def _get_sources_for_topic(self, topic: Topic, sources_by_tags: Dict[str, List[str]]) -> List[str]:
        """Определение подходящих источников для темы"""
        # Если у темы есть теги, используем их
        if topic.tags:
            try:
                topic_tags = json.loads(topic.tags)
                if isinstance(topic_tags, list) and topic_tags:
                    # Собираем все источники для указанных тегов
                    sources = set()
                    for tag in topic_tags:
                        if tag in sources_by_tags:
                            sources.update(sources_by_tags[tag])
                    
                    if sources:
                        return list(sources)
            except (json.JSONDecodeError, TypeError):
                logger.warning(f"Неверный формат тегов для темы '{topic.name}'")
        
        # Если у темы нет тегов или они некорректны, определяем теги по имени и описанию
        potential_tags = self._extract_potential_tags(topic)
        
        # Собираем источники для потенциальных тегов
        sources = set()
        for tag in potential_tags:
            if tag in sources_by_tags:
                sources.update(sources_by_tags[tag])
        
        # Если не нашли подходящих источников, возвращаем все источники
        if not sources:
            return list(self.sources.keys())
        
        return list(sources)
    
    def _extract_potential_tags(self, topic: Topic) -> List[str]:
        """Извлечение потенциальных тегов из темы"""
        potential_tags = []
        
        # Словарь соответствия ключевых слов тегам
        keyword_to_tag = {
            "технологии": ["technology", "tech"],
            "технология": ["technology", "tech"],
            "tech": ["technology", "tech"],
            "technology": ["technology", "tech"],
            "it": ["technology", "it"],
            "программирование": ["programming", "technology"],
            "programming": ["programming", "technology"],
            "бизнес": ["business", "finance"],
            "business": ["business", "finance"],
            "финансы": ["finance", "business"],
            "finance": ["finance", "business"],
            "наука": ["science", "research"],
            "science": ["science", "research"],
            "исследования": ["research", "science"],
            "research": ["research", "science"],
            "стартапы": ["startups", "business"],
            "startups": ["startups", "business"],
            "гаджеты": ["gadgets", "tech"],
            "gadgets": ["gadgets", "tech"],
            "обзоры": ["reviews", "tech"],
            "reviews": ["reviews", "tech"],
            "инновации": ["innovation", "technology"],
            "innovation": ["innovation", "technology"],
            "культура": ["culture"],
            "culture": ["culture"],
            "русский": ["russian"],
            "russian": ["russian"]
        }
        
        # Проверяем имя темы
        name_lower = topic.name.lower()
        for keyword, tags in keyword_to_tag.items():
            if keyword in name_lower:
                potential_tags.extend(tags)
        
        # Проверяем описание темы, если оно есть
        if topic.description:
            desc_lower = topic.description.lower()
            for keyword, tags in keyword_to_tag.items():
                if keyword in desc_lower:
                    potential_tags.extend(tags)
        
        # Удаляем дубликаты
        return list(set(potential_tags))
    
    def get_articles_count_by_date(self, days: int = 30) -> int:
        """Получить количество статей, собранных за последние X дней"""
        cutoff_date = datetime.now() - timedelta(days=days)
        count = self.db.query(Article).filter(Article.published_at >= cutoff_date).count()
        return count 