from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.models import User, Article, Digest, DigestArticle, Topic
from app.schemas.digest import DigestGenerationParams
import json
import logging
from app.services.news_scraper import NewsScraper
from collections import Counter

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
            logger.warning("Не указаны ID тем для получения статей")
            return []
        
        # Проверка на корректность параметра days
        try:
            days = int(days)
            if days <= 0:
                days = 3
                logger.warning(f"Указано некорректное значение days: {days}, используется значение по умолчанию: 3")
        except (ValueError, TypeError):
            days = 3
            logger.warning(f"Не удалось преобразовать days в число, используется значение по умолчанию: 3")
        
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Создаем базовый запрос
        query = self.db.query(Article).filter(
            Article.topic_id.in_(topic_ids),
            Article.published_at >= cutoff_date
        )
        
        # Фильтруем по источникам, если указаны
        if sources and isinstance(sources, list) and len(sources) > 0:
            # Убираем пустые значения
            sources = [s for s in sources if s and isinstance(s, str)]
            if sources:
                query = query.filter(Article.source.in_(sources))
                logger.info(f"Применена фильтрация по источникам: {sources}")
        
        # Фильтруем по тональности, если указаны границы
        if min_sentiment is not None:
            try:
                min_sentiment = float(min_sentiment)
                query = query.filter(Article.sentiment_score >= min_sentiment)
                logger.info(f"Применена фильтрация по минимальной тональности: {min_sentiment}")
            except (ValueError, TypeError):
                logger.warning(f"Не удалось преобразовать min_sentiment в число: {min_sentiment}")
        
        if max_sentiment is not None:
            try:
                max_sentiment = float(max_sentiment)
                query = query.filter(Article.sentiment_score <= max_sentiment)
                logger.info(f"Применена фильтрация по максимальной тональности: {max_sentiment}")
            except (ValueError, TypeError):
                logger.warning(f"Не удалось преобразовать max_sentiment в число: {max_sentiment}")
        
        # Сортируем по дате публикации (сначала новые)
        articles = query.order_by(Article.published_at.desc()).all()
        
        logger.info(f"Найдено {len(articles)} статей для тем {topic_ids}")
        
        # Если статей не найдено и включен автоматический скрапинг, запускаем скрапер
        if not articles and auto_scrape:
            logger.info(f"Не найдено статей по темам {topic_ids}, запускается scraper...")
            try:
                # Получаем объекты тем из базы данных
                topics = self.db.query(Topic).filter(Topic.id.in_(topic_ids)).all()
                
                if topics:
                    # Запускаем скрапер для каждой темы
                    total_scraped = 0
                    for topic in topics:
                        logger.info(f"Запуск скрапера для темы: {topic.name}")
                        scraped_articles = self.scraper.scrape_all_sources(topic, max_articles_per_source=3)
                        total_scraped += len(scraped_articles)
                        logger.info(f"Собрано {len(scraped_articles)} статей для темы {topic.name}")
                    
                    # Если были собраны новые статьи, запускаем NLP-анализатор
                    if total_scraped > 0:
                        from app.services.nlp_analyzer import NLPAnalyzer
                        logger.info("Запуск NLP-анализатора для новых статей")
                        analyzer = NLPAnalyzer(self.db)
                        analyzer.process_unanalyzed_articles()
                    
                    # Повторно пробуем получить статьи
                    articles = query.order_by(Article.published_at.desc()).all()
                    logger.info(f"После скрапинга: найдено {len(articles)} статей")
                else:
                    logger.warning(f"Не найдены темы с ID {topic_ids}")
            except Exception as e:
                logger.error(f"Ошибка при автоматическом скрапинге: {str(e)}")
                # Логируем полный стек-трейс для отладки
                import traceback
                logger.error(traceback.format_exc())
        
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

    def create_digest_content(self, articles: List[Article], include_sentiment: bool = True, include_keywords: bool = True) -> Dict[str, Any]:
        """Создание содержимого дайджеста на основе отобранных статей"""
        try:
            if not articles:
                return {"title": "No articles found", "summary": "No relevant articles were found for your selected topics."}
            
            # Общее количество статей
            total_articles = len(articles)
            
            # Формируем заголовок на основе тем или содержимого
            title = self._generate_digest_title(articles)
            
            # Создаем общее резюме дайджеста
            summary_parts = []
            
            # Добавляем информацию о количестве статей и периоде
            date_range = self._get_date_range(articles)
            summary_parts.append(f"This digest contains {total_articles} articles{' from ' + date_range if date_range else ''}.")
            
            # Добавляем информацию о тональности, если запрошено
            if include_sentiment and any(a.sentiment_score is not None for a in articles):
                sentiment_info = self._analyze_overall_sentiment(articles)
                if sentiment_info:
                    summary_parts.append(sentiment_info)
            
            # Добавляем основные темы и ключевые слова, если запрошено
            if include_keywords:
                keywords_info = self._extract_common_keywords(articles)
                if keywords_info:
                    summary_parts.append(keywords_info)
            
            # Собираем суммарное содержание каждой статьи
            article_summaries = []
            for i, article in enumerate(articles[:10]):  # Ограничиваем 10 статьями
                try:
                    # Формируем сводку по статье
                    article_summary = f"**{article.title}**\n\n"
                    
                    # Добавляем краткое содержание, если оно есть
                    if article.summary and len(article.summary.strip()) > 10:
                        article_summary += f"{article.summary.strip()}\n\n"
                    else:
                        # Если нет готового summary, берем первый абзац из контента
                        content = article.content.strip() if article.content else ""
                        if content:
                            paragraphs = content.split('\n\n')
                            if paragraphs:
                                first_paragraph = paragraphs[0].strip()
                                # Ограничиваем размер первого абзаца
                                if len(first_paragraph) > 300:
                                    first_paragraph = first_paragraph[:297] + "..."
                                article_summary += f"{first_paragraph}\n\n"
                    
                    # Добавляем информацию об источнике и дате
                    source_info = f"Source: {article.source}"
                    if article.published_at:
                        source_info += f" | {article.published_at.strftime('%Y-%m-%d')}"
                    article_summary += source_info
                    
                    article_summaries.append(article_summary)
                except Exception as e:
                    logger.error(f"Error processing article for digest: {str(e)}")
                    continue
            
            # Соединяем все части резюме
            main_summary = " ".join(summary_parts)
            
            # Соединяем резюме и содержание статей
            full_summary = f"{main_summary}\n\n"
            full_summary += "\n\n---\n\n".join(article_summaries)
            
            return {
                "title": title,
                "summary": full_summary,
                "articles": articles
            }
        except Exception as e:
            logger.error(f"Error creating digest content: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "title": "Digest Generation Error",
                "summary": f"An error occurred while generating the digest: {str(e)}",
                "articles": articles if 'articles' in locals() else []
            }

    def _generate_digest_title(self, articles: List[Article]) -> str:
        """Генерация заголовка дайджеста на основе статей"""
        try:
            # Если у нас только одна статья, можно использовать её заголовок
            if len(articles) == 1:
                return f"Digest: {articles[0].title}"
            
            # Попробуем определить темы статей
            topics = set()
            for article in articles:
                if article.topic_id:
                    topic = self.db.query(Topic).filter(Topic.id == article.topic_id).first()
                    if topic:
                        topics.add(topic.name)
            
            # Если нашли темы, используем их в заголовке
            if topics:
                if len(topics) == 1:
                    return f"Digest: Latest in {next(iter(topics))}"
                elif len(topics) <= 3:
                    return f"Digest: Latest in {', '.join(list(topics)[:-1])} and {list(topics)[-1]}"
                else:
                    return f"Digest: Multi-topic News Update"
            
            # Если темы не определены, генерируем заголовок на основе дат
            date_range = self._get_date_range(articles)
            if date_range:
                return f"News Digest: {date_range}"
            
            # Если всё не сработало, даем стандартный заголовок
            return "Your Personalized News Digest"
        except Exception as e:
            logger.error(f"Error generating digest title: {str(e)}")
            return "News Digest"

    def _get_date_range(self, articles: List[Article]) -> str:
        """Получение текстового представления диапазона дат статей"""
        try:
            dates = [a.published_at for a in articles if a.published_at]
            if not dates:
                return ""
            
            min_date = min(dates)
            max_date = max(dates)
            
            # Если все статьи одного дня
            if min_date.date() == max_date.date():
                return min_date.strftime("%B %d, %Y")
            
            # Если разные дни, но один месяц и год
            if min_date.month == max_date.month and min_date.year == max_date.year:
                return f"{min_date.strftime('%B %d')} - {max_date.strftime('%d, %Y')}"
            
            # Если разные месяцы, но один год
            if min_date.year == max_date.year:
                return f"{min_date.strftime('%B %d')} - {max_date.strftime('%B %d, %Y')}"
            
            # Если всё разное
            return f"{min_date.strftime('%B %d, %Y')} - {max_date.strftime('%B %d, %Y')}"
        except Exception as e:
            logger.error(f"Error generating date range: {str(e)}")
            return ""

    def _analyze_overall_sentiment(self, articles: List[Article]) -> str:
        """Анализирует общую тональность статей и формирует текстовое описание"""
        try:
            # Собираем значения тональности
            sentiment_values = [a.sentiment_score for a in articles if a.sentiment_score is not None]
            if not sentiment_values:
                return ""
            
            avg_sentiment = sum(sentiment_values) / len(sentiment_values)
            
            # Распределение по категориям
            positive = sum(1 for s in sentiment_values if s > 0.2)
            negative = sum(1 for s in sentiment_values if s < -0.2)
            neutral = len(sentiment_values) - positive - negative
            
            # Определяем преобладающую тональность
            if positive > negative and positive > neutral:
                overall = "predominantly positive"
            elif negative > positive and negative > neutral:
                overall = "predominantly negative"
            elif neutral > positive and neutral > negative:
                overall = "mostly neutral"
            else:
                overall = "mixed"
            
            # Формируем текстовое описание
            return f"The overall sentiment of these articles is {overall} (average score: {avg_sentiment:.2f}), " \
                   f"with {positive} positive, {neutral} neutral, and {negative} negative articles."
        except Exception as e:
            logger.error(f"Error analyzing overall sentiment: {str(e)}")
            return ""

    def _extract_common_keywords(self, articles: List[Article]) -> str:
        """Извлекает общие ключевые слова из статей"""
        try:
            # Собираем все ключевые слова
            all_keywords = []
            for article in articles:
                if article.keywords:
                    try:
                        if isinstance(article.keywords, str):
                            keywords = json.loads(article.keywords)
                        else:
                            keywords = article.keywords
                        
                        if isinstance(keywords, list):
                            all_keywords.extend(keywords)
                    except:
                        continue
            
            if not all_keywords:
                return ""
            
            # Считаем частоту встречаемости
            keyword_counter = Counter(all_keywords)
            
            # Выбираем топ-5 ключевых слов
            top_keywords = [kw for kw, _ in keyword_counter.most_common(5)]
            
            if not top_keywords:
                return ""
            
            # Формируем текстовое описание
            return f"Main topics: {', '.join(top_keywords)}."
        except Exception as e:
            logger.error(f"Error extracting common keywords: {str(e)}")
            return ""

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
                min_sentiment=params.min_sentiment_score,
                max_sentiment=params.max_sentiment_score,
                auto_scrape=True
            )
            
            if not articles:
                logger.warning(f"Не найдено статей для генерации дайджеста")
                return None
                
            # Ранжируем статьи по релевантности
            ranked_articles = self.rank_articles(articles, include_sentiment=params.include_sentiment)
            
            # Ограничиваем количество статей
            max_articles = params.max_articles if params.max_articles else 10
            selected_articles = ranked_articles[:max_articles]
            
            # Генерируем содержимое дайджеста
            digest_content = self.create_digest_content(
                selected_articles,
                include_sentiment=params.include_sentiment,
                include_keywords=params.include_keywords
            )
            
            # Создаем дайджест в базе данных
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"Не найден пользователь с ID {user_id}")
                return None
                
            # Создаем запись дайджеста
            digest = Digest(
                title=digest_content['title'],
                summary=digest_content['summary'],
                user_id=user_id,
                status="unread"
            )
            self.db.add(digest)
            self.db.commit()
            self.db.refresh(digest)
            
            # Связываем дайджест со статьями
            for i, article in enumerate(selected_articles):
                digest_article = DigestArticle(
                    digest_id=digest.id,
                    article_id=article.id,
                    position=i
                )
                self.db.add(digest_article)
                
            # Сохраняем изменения
            self.db.commit()
            
            # Возвращаем созданный дайджест
            return digest
            
        except Exception as e:
            logger.error(f"Error generating digest with params: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return None

    def generate_digest(self, user_id: int, max_articles: int = 10) -> Optional[Digest]:
        """Упрощенная версия генерации дайджеста с параметрами по умолчанию"""
        params = DigestGenerationParams(
            max_articles=max_articles,
            days=7,
            include_sentiment=True,
            include_keywords=True
        )
        return self.generate_digest_with_params(user_id, params)

    def generate_digests_for_all_users(self):
        """Генерация дайджестов для всех активных пользователей"""
        try:
            # Получаем активных пользователей
            active_users = self.db.query(User).all()
            
            logger.info(f"Запуск пакетной генерации дайджестов для {len(active_users)} пользователей")
            
            success_count = 0
            for user in active_users:
                try:
                    digest = self.generate_digest(user.id)
                    if digest:
                        success_count += 1
                except Exception as e:
                    logger.error(f"Ошибка при генерации дайджеста для пользователя {user.id}: {str(e)}")
                    continue
            
            logger.info(f"Пакетная генерация дайджестов завершена. Сгенерировано {success_count} дайджестов для {len(active_users)} пользователей")
        except Exception as e:
            logger.error(f"Error in batch digest generation: {str(e)}")
            import traceback
            logger.error(traceback.format_exc()) 