import aiohttp
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from bs4 import BeautifulSoup
import json
import logging
import traceback
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
from app.models.models import Article, Topic

# Configure logging
logger = logging.getLogger(__name__)

class NewsAggregator:
    """Service for aggregating news articles from various sources"""
    
    def __init__(self, db: Session):
        self.db = db
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        self.api_keys_available = self._check_api_keys()
    
    def _check_api_keys(self) -> Dict[str, bool]:
        """Check which API keys are available and log warnings for missing ones"""
        api_keys = {
            "NEWS_API_KEY": bool(settings.NEWS_API_KEY),
            "NYTIMES_API_KEY": bool(settings.NYTIMES_API_KEY),
        }
        
        for key, available in api_keys.items():
            if not available:
                logger.warning(f"{key} is not set in environment variables. Related functionality will be limited.")
        
        return api_keys

    async def fetch_news_api(self) -> List[Dict[str, Any]]:
        """Fetch news from NewsAPI"""
        if not self.api_keys_available["NEWS_API_KEY"]:
            logger.warning("NEWS_API_KEY not available, skipping NewsAPI fetch")
            return []
            
        try:
            logger.info("Fetching articles from NewsAPI")
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{settings.NEWS_SOURCES[0]}/v2/top-headlines",
                    headers=self.headers,
                    params={
                        "apiKey": settings.NEWS_API_KEY, 
                        "pageSize": 20, 
                        "language": "en"
                    },
                    timeout=15
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        articles = data.get("articles", [])
                        logger.info(f"Successfully fetched {len(articles)} articles from NewsAPI")
                        return articles
                    else:
                        response_text = await response.text()
                        logger.error(f"Failed to fetch news from NewsAPI. Status code: {response.status}, Response: {response_text}")
                        return []
        except aiohttp.ClientError as e:
            logger.error(f"Client error when fetching from NewsAPI: {str(e)}")
            return []
        except asyncio.TimeoutError:
            logger.error("Timeout when fetching from NewsAPI")
            return []
        except Exception as e:
            logger.error(f"Unexpected error when fetching from NewsAPI: {str(e)}")
            logger.error(traceback.format_exc())
            return []

    async def fetch_nytimes(self) -> List[Dict[str, Any]]:
        """Fetch news from NYTimes API"""
        if not self.api_keys_available["NYTIMES_API_KEY"]:
            logger.warning("NYTIMES_API_KEY not available, skipping NYTimes fetch")
            return []
            
        try:
            logger.info("Fetching articles from NYTimes API")
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{settings.NEWS_SOURCES[1]}/svc/news/v3/content/all/all.json",
                    headers=self.headers,
                    params={"api-key": settings.NYTIMES_API_KEY},
                    timeout=15
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        articles = data.get("results", [])
                        logger.info(f"Successfully fetched {len(articles)} articles from NYTimes")
                        return articles
                    else:
                        response_text = await response.text()
                        logger.error(f"Failed to fetch news from NYTimes. Status code: {response.status}, Response: {response_text}")
                        return []
        except aiohttp.ClientError as e:
            logger.error(f"Client error when fetching from NYTimes: {str(e)}")
            return []
        except asyncio.TimeoutError:
            logger.error("Timeout when fetching from NYTimes")
            return []
        except Exception as e:
            logger.error(f"Unexpected error when fetching from NYTimes: {str(e)}")
            logger.error(traceback.format_exc())
            return []

    async def extract_content(self, url: str) -> str:
        """Extract main content from an article URL"""
        if not url:
            return ""
            
        try:
            logger.debug(f"Extracting content from {url}")
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, 
                    headers=self.headers, 
                    timeout=15
                ) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Remove unwanted elements
                        for element in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                            element.decompose()
                        
                        # Try different content selectors
                        selectors = [
                            'article', 'main', 
                            'div.content', 'div.article-content', 'div.story-content',
                            '.article-body', '.story-body', '.entry-content'
                        ]
                        
                        for selector in selectors:
                            content_element = soup.select_one(selector)
                            if content_element:
                                text = content_element.get_text(strip=True, separator=' ')
                                if len(text) > 200:  # Only accept if it has substantial content
                                    return text
                        
                        # Fallback to body text if no other selector worked
                        body_text = soup.body.get_text(strip=True, separator=' ') if soup.body else ""
                        return body_text
                    else:
                        logger.warning(f"Could not extract content from {url} - Status code: {response.status}")
                        return ""
        except Exception as e:
            logger.error(f"Error extracting content from {url}: {str(e)}")
            return ""

    def _find_matching_topic(self, article_title: str, article_content: str) -> Optional[int]:
        """Find a matching topic for an article based on keywords in the title and content"""
        try:
            topics = self.db.query(Topic).all()
            
            # Convert title and content to lowercase for case-insensitive matching
            title_lower = article_title.lower()
            content_lower = article_content.lower() if article_content else ""
            
            for topic in topics:
                # Check if topic name is in the title or content
                if topic.name.lower() in title_lower or topic.name.lower() in content_lower:
                    return topic.id
                    
                # Check if topic description contains additional keywords
                if topic.description:
                    keywords = [word.strip().lower() for word in topic.description.split(',')]
                    for keyword in keywords:
                        if keyword and len(keyword) > 3 and (keyword in title_lower or keyword in content_lower):
                            return topic.id
            
            return None
        except Exception as e:
            logger.error(f"Error finding matching topic: {str(e)}")
            return None

    async def process_articles(self, articles: List[Dict[str, Any]], source: str):
        """Process and save articles to the database"""
        if not articles:
            logger.info(f"No articles to process from {source}")
            return
            
        logger.info(f"Processing {len(articles)} articles from {source}")
        processed_count = 0
        
        for article in articles:
            try:
                # Skip articles without URL
                if not article.get('url'):
                    continue
                    
                # Check if article already exists
                existing = self.db.query(Article).filter(Article.url == article.get('url')).first()
                if existing:
                    # Вместо пропуска, обновляем существующую статью, если она изменилась
                    try:
                        # Обновляем только если содержимое изменилось
                        if content and content != existing.content:
                            existing.content = content
                            existing.updated_at = datetime.now(timezone.utc)
                            self.db.add(existing)
                            processed_count += 1
                            logger.info(f"Обновлена существующая статья: {existing.url}")
                    except Exception as e:
                        logger.error(f"Ошибка при обновлении существующей статьи {existing.url}: {str(e)}")
                    continue

                # Extract content if not provided
                content = article.get('content') or article.get('abstract')
                if not content and article.get('url'):
                    content = await self.extract_content(article.get('url'))
                    
                # Skip articles without content
                if not content:
                    logger.debug(f"Skipping article without content: {article.get('url')}")
                    continue

                # Format publication date
                published_at = None
                pub_date_field = article.get('publishedAt') or article.get('published_date')
                
                if pub_date_field:
                    try:
                        # Handle different date formats
                        if 'T' in pub_date_field:
                            published_at = datetime.fromisoformat(pub_date_field.replace('Z', '+00:00'))
                        else:
                            published_at = datetime.strptime(pub_date_field, "%Y-%m-%d")
                    except (ValueError, TypeError):
                        published_at = datetime.now(timezone.utc)
                else:
                    published_at = datetime.now(timezone.utc)

                # Find appropriate topic
                title = article.get('title', 'Untitled')
                topic_id = self._find_matching_topic(title, content)

                # Create new article
                new_article = Article(
                    title=title,
                    content=content,
                    url=article.get('url'),
                    source=source,
                    published_at=published_at,
                    topic_id=topic_id,
                    sentiment_score=0.0,  # Will be analyzed later
                    keywords="[]",
                    summary=""
                )
                
                self.db.add(new_article)
                processed_count += 1
                
                # Commit in batches to avoid long transactions
                if processed_count % 10 == 0:
                    try:
                        self.db.commit()
                    except SQLAlchemyError as e:
                        logger.error(f"Database error during batch commit: {str(e)}")
                        self.db.rollback()
                
            except SQLAlchemyError as e:
                logger.error(f"SQLAlchemy error processing article {article.get('url')}: {str(e)}")
                # Если ошибка связана с уникальным ограничением, продолжаем с следующей статьей
                self.db.rollback()
            except Exception as e:
                logger.error(f"Error processing article {article.get('url')}: {str(e)}")
        
        # Final commit for remaining articles
        try:
            self.db.commit()
            logger.info(f"Successfully processed {processed_count} articles from {source}")
        except SQLAlchemyError as e:
            logger.error(f"Database error during final commit: {str(e)}")
            self.db.rollback()

    async def aggregate_news(self):
        """Main method to aggregate news from all sources"""
        # Check if any API keys are available
        if not any(self.api_keys_available.values()):
            logger.warning("No API keys configured for news sources. Skipping aggregation.")
            return
            
        logger.info("Starting news aggregation process")
        
        tasks = []
        
        if self.api_keys_available["NEWS_API_KEY"]:
            tasks.append(self.fetch_news_api())
            
        if self.api_keys_available["NYTIMES_API_KEY"]:
            tasks.append(self.fetch_nytimes())
        
        if not tasks:
            logger.info("No tasks to perform for news aggregation. Check API keys.")
            return
            
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process successful results
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error in task {i}: {str(result)}")
                    continue
                    
                if i == 0 and self.api_keys_available["NEWS_API_KEY"]:
                    await self.process_articles(result, "NewsAPI")
                elif i == (0 if not self.api_keys_available["NEWS_API_KEY"] else 1) and self.api_keys_available["NYTIMES_API_KEY"]:
                    await self.process_articles(result, "NYTimes")
            
            logger.info("News aggregation process completed")
        except Exception as e:
            logger.error(f"Error in news aggregation: {str(e)}")
            logger.error(traceback.format_exc()) 