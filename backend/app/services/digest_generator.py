from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.models import User, Article, Digest, DigestArticle, Topic
from app.schemas.digest import DigestGenerationParams
import json
import logging
from app.services.news_scraper import NewsScraper

# Настраиваем логгирование
logger = logging.getLogger(__name__)

class DigestGenerator:
    def __init__(self, db: Session):
        self.db = db
        self.scraper = NewsScraper(db)

    def get_user_topics(self, user_id: int) -> List[Topic]:
        """Получение тем, которыми интересуется пользователь"""
        user = self.db.query(User).filter(User.id == user_id).first()
        return user.topics if user else []

    def get_recent_articles(self, 
                           topic_ids: List[int], 
                           days: int = 3, 
                           sources: Optional[List[str]] = None,
                           min_sentiment: Optional[float] = None,
                           max_sentiment: Optional[float] = None,
                           auto_scrape: bool = True) -> List[Article]:
        """Получение недавних статей по набору тем с дополнительной фильтрацией"""
        if not topic_ids:
            return []
            
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Создаем базовый запрос
        query = self.db.query(Article).filter(
            Article.topic_id.in_(topic_ids),
            Article.published_at >= cutoff_date
        )
        
        # Фильтруем по источникам, если указаны
        if sources:
            query = query.filter(Article.source.in_(sources))
            
        # Фильтруем по тональности, если указаны границы
        if min_sentiment is not None:
            query = query.filter(Article.sentiment_score >= min_sentiment)
            
        if max_sentiment is not None:
            query = query.filter(Article.sentiment_score <= max_sentiment)
            
        # Сортируем по дате публикации (сначала новые)
        articles = query.order_by(Article.published_at.desc()).all()
        
        # Если статей не найдено и включен автоматический скрапинг, запускаем скрапер
        if not articles and auto_scrape:
            logger.info(f"Не найдено статей по темам {topic_ids}, запускается scraper...")
            try:
                # Получаем объекты тем из базы данных
                topics = self.db.query(Topic).filter(Topic.id.in_(topic_ids)).all()
                
                if topics:
                    # Запускаем скрапер для каждой темы
                    for topic in topics:
                        self.scraper.scrape_all_sources(topic, max_articles_per_source=3)
                    
                    # Повторно пробуем получить статьи
                    articles = query.order_by(Article.published_at.desc()).all()
                    logger.info(f"После скрапинга: найдено {len(articles)} статей")
            except Exception as e:
                logger.error(f"Ошибка при автоматическом скрапинге: {str(e)}")
        
        return articles

    def rank_articles(self, articles: List[Article], include_sentiment: bool = True) -> List[Article]:
        """Ранжирование статей на основе различных факторов"""
        if not articles:
            return []
            
        ranked_articles = []
        
        for article in articles:
            # Рассчитываем общий рейтинг на основе нескольких факторов
            score = 0
            
            # Фактор 1: Новизна (0-1)
            hours_old = (datetime.now() - article.published_at).total_seconds() / 3600
            recency_score = 1 / (1 + hours_old/24)  # Затухание в течение 24 часов
            score += recency_score * 0.4
            
            # Фактор 2: Влияние тональности (0-1), если включено
            if include_sentiment and article.sentiment_score is not None:
                # Абсолютное значение тональности - более сильная тональность считается более важной
                sentiment_impact = abs(article.sentiment_score)
                score += sentiment_impact * 0.2
                
                # Бонус для очень положительных или очень отрицательных статей
                if article.sentiment_score > 0.5 or article.sentiment_score < -0.5:
                    score += 0.1
            
            # Фактор 3: Длина контента (0-1)
            if article.content:
                content_length = len(article.content.split())
                length_score = min(content_length / 1000, 1)  # Нормализация до 1000 слов
                score += length_score * 0.2
            
            # Фактор 4: Наличие ключевых слов и сущностей
            if article.keywords:
                try:
                    keywords = json.loads(article.keywords) if isinstance(article.keywords, str) else article.keywords
                    if len(keywords) > 5:
                        score += 0.1
                except:
                    pass
            
            if article.entities:
                try:
                    entities = json.loads(article.entities) if isinstance(article.entities, str) else article.entities
                    if len(entities) > 3:
                        score += 0.1
                except:
                    pass
            
            ranked_articles.append((article, score))
        
        # Сортируем по рейтингу (по убыванию)
        ranked_articles.sort(key=lambda x: x[1], reverse=True)
        return [article for article, _ in ranked_articles]

    def generate_digest_with_params(self, 
                                   user_id: int, 
                                   params: DigestGenerationParams) -> Optional[Digest]:
        """Генерация персонализированного дайджеста с учетом пользовательских параметров"""
        try:
            # Получаем темы пользователя
            user_topics = self.get_user_topics(user_id)
            
            if not user_topics:
                logger.warning(f"У пользователя {user_id} нет выбранных тем")
                return None
            
            # Если темы не указаны в параметрах, берем все темы пользователя
            topic_ids = params.topics if params.topics else [topic.id for topic in user_topics]
            
            # Проверяем, что выбранные темы принадлежат пользователю
            user_topic_ids = {topic.id for topic in user_topics}
            topic_ids = [tid for tid in topic_ids if tid in user_topic_ids]
            
            if not topic_ids:
                logger.warning(f"Не найдено допустимых тем для генерации дайджеста")
                return None
            
            # Получаем статьи с учетом всех фильтров, включая автоматический скрапинг
            articles = self.get_recent_articles(
                topic_ids=topic_ids,
                days=params.days,
                sources=params.sources,
                min_sentiment=params.minSentimentScore,
                max_sentiment=params.maxSentimentScore,
                auto_scrape=params.autoScrape if hasattr(params, 'autoScrape') else True
            )
            
            if not articles:
                logger.warning(f"Не найдено статей по выбранным темам и фильтрам, даже после скрапинга")
                return None
            
            # Ранжируем статьи
            ranked_articles = self.rank_articles(
                articles, 
                include_sentiment=params.includeSentiment
            )
            
            # Создаем новый дайджест
            digest = Digest(
                user_id=user_id,
                title=f"Ваш персонализированный дайджест — {datetime.now().strftime('%d.%m.%Y')}",
                created_at=datetime.now(),
                is_read=False
            )
            self.db.add(digest)
            self.db.flush()  # Получаем ID дайджеста
            
            # Добавляем топ-статьи в дайджест
            max_articles = min(params.maxArticles, len(ranked_articles))
            
            for i, article in enumerate(ranked_articles[:max_articles]):
                digest_article = DigestArticle(
                    digest_id=digest.id,
                    article_id=article.id,
                    topic_id=article.topic_id,
                    order=i + 1
                )
                self.db.add(digest_article)
            
            self.db.commit()
            self.db.refresh(digest)
            
            logger.info(f"Сгенерирован дайджест {digest.id} для пользователя {user_id} с {max_articles} статьями")
            return digest
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Ошибка при генерации дайджеста: {str(e)}")
            return None

    def generate_digest(self, user_id: int, max_articles: int = 10) -> Optional[Digest]:
        """Генерация базового дайджеста (для обратной совместимости)"""
        # Создаем параметры по умолчанию
        params = DigestGenerationParams(
            topics=[],  # Все темы пользователя
            days=3,
            maxArticles=max_articles,
            includeSentiment=True,
            includeKeywords=True,
            autoScrape=True
        )
        
        return self.generate_digest_with_params(user_id, params)

    def generate_digests_for_all_users(self):
        """Генерация дайджестов для всех активных пользователей"""
        logger.info("Начало пакетной генерации дайджестов для всех пользователей")
        
        active_users = self.db.query(User).filter(User.is_active == True).all()
        success_count = 0
        
        for user in active_users:
            # Проверяем, есть ли у пользователя дайджест за сегодня
            today = datetime.now().date()
            existing_digest = self.db.query(Digest).filter(
                Digest.user_id == user.id,
                Digest.created_at >= today
            ).first()
            
            if not existing_digest:
                digest = self.generate_digest(user.id)
                if digest:
                    success_count += 1
        
        logger.info(f"Пакетная генерация дайджестов завершена. Сгенерировано {success_count} дайджестов для {len(active_users)} пользователей") 