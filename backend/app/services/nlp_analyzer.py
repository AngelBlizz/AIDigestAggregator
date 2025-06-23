import spacy
from typing import List, Dict, Any, Set, Tuple
from textblob import TextBlob
import json
from app.core.config import settings
from app.models.models import Article, Topic
from sqlalchemy.orm import Session
import re
from collections import Counter
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from langdetect import detect, LangDetectException

# Загрузка необходимых ресурсов NLTK
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
    
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

logger = logging.getLogger(__name__)

class NLPAnalyzer:
    def __init__(self, db: Session):
        self.db = db
        # Загружаем модели spaCy для разных языков
        self.nlp_models = {}
        
        # Основная модель (английская)
        try:
            self.nlp_models['en'] = spacy.load("en_core_web_sm")
        except:
            logger.warning("Не удалось загрузить модель en_core_web_sm")
            
        # Пытаемся загрузить русскую модель, если доступна
        try:
            self.nlp_models['ru'] = spacy.load("ru_core_news_sm")
        except:
            logger.warning("Не удалось загрузить модель ru_core_news_sm")
        
        # Устанавливаем основную модель
        if 'en' in self.nlp_models:
            self.nlp = self.nlp_models['en']
        elif len(self.nlp_models) > 0:
            # Берем первую доступную модель
            self.nlp = next(iter(self.nlp_models.values()))
        else:
            # Если ни одна модель не загрузилась, используем стандартную англ. модель
            self.nlp = spacy.load("en_core_web_sm")
        
        # Словари стоп-слов для разных языков
        self.stop_words = {
            'en': set(stopwords.words('english')),
            'ru': set(stopwords.words('russian')) if 'russian' in stopwords._fileids else set()
        }
        
        # Инициализируем TF-IDF векторизатор для темы
        self.tfidf_vectorizer = TfidfVectorizer(
            analyzer='word',
            stop_words='english',
            max_features=5000,
            ngram_range=(1, 2)
        )

    def detect_language(self, text: str) -> str:
        """Определяем язык текста с использованием langdetect"""
        if not text or len(text.strip()) < 10:
            return 'en'  # По умолчанию - английский для коротких текстов
            
        try:
            lang = detect(text)
            # Поддерживаем только языки, для которых у нас есть ресурсы
            return lang if lang in self.nlp_models else 'en'
        except LangDetectException:
            # В случае ошибки определения языка - английский
            return 'en'

    def analyze_sentiment(self, text: str) -> Dict[str, float]:
        """Анализ тональности текста с расширенными метриками"""
        blob = TextBlob(text)
        
        # Основной показатель полярности от -1 до 1
        polarity = blob.sentiment.polarity
        
        # Субъективность (0 - объективно, 1 - субъективно)
        subjectivity = blob.sentiment.subjectivity
        
        # Дополнительные метрики
        sentences = blob.sentences
        sentence_polarities = [sentence.sentiment.polarity for sentence in sentences]
        
        # Анализируем распределение тональности
        positive = sum(1 for p in sentence_polarities if p > 0.2)
        negative = sum(1 for p in sentence_polarities if p < -0.2)
        neutral = len(sentence_polarities) - positive - negative
        
        return {
            "polarity": polarity,
            "subjectivity": subjectivity,
            "positive_sentences": positive,
            "negative_sentences": negative,
            "neutral_sentences": neutral,
            "total_sentences": len(sentence_polarities)
        }

    def extract_entities(self, text: str) -> List[Dict[str, str]]:
        """Извлечение именованных сущностей из текста с учетом языка"""
        lang = self.detect_language(text)
        
        # Используем соответствующую языковую модель, если доступна
        if lang in self.nlp_models:
            doc = self.nlp_models[lang](text)
        else:
            doc = self.nlp(text)
            
        entities = []
        
        for ent in doc.ents:
            entities.append({
                "name": ent.text,
                "type": ent.label_,
                "count": 1  # Начальное значение счетчика
            })
        
        # Объединяем дубликаты и считаем количество
        entity_count = {}
        for entity in entities:
            key = f"{entity['name']}|{entity['type']}"
            if key in entity_count:
                entity_count[key]["count"] += 1
            else:
                entity_count[key] = entity
        
        # Сортируем по частоте упоминаний
        sorted_entities = sorted(entity_count.values(), key=lambda x: x["count"], reverse=True)
        return sorted_entities[:20]  # Ограничиваем 20 самыми частыми

    def extract_keywords(self, text: str, max_keywords: int = 15) -> List[str]:
        """Улучшенное извлечение ключевых слов из текста с учетом языка"""
        lang = self.detect_language(text)
        
        # Используем соответствующую языковую модель, если доступна
        if lang in self.nlp_models:
            doc = self.nlp_models[lang](text)
        else:
            doc = self.nlp(text)
        
        # Получаем существительные, именованные сущности и фразы
        keywords = []
        
        # Получаем стоп-слова для определенного языка
        stop_words = self.stop_words.get(lang, set())
        
        # Добавляем существительные и прилагательные
        for token in doc:
            if token.pos_ in ['NOUN', 'PROPN', 'ADJ'] and not token.is_stop and len(token.text) > 2:
                keywords.append(token.text.lower())
        
        # Добавляем именные группы
        for chunk in doc.noun_chunks:
            clean_chunk = ' '.join([t.text for t in chunk if not t.is_stop and len(t.text) > 2])
            if clean_chunk and len(clean_chunk.split()) <= 3:
                keywords.append(clean_chunk.lower())
        
        # Добавляем именованные сущности
        for ent in doc.ents:
            if ent.label_ in ['ORG', 'PERSON', 'GPE', 'PRODUCT', 'EVENT', 'WORK_OF_ART']:
                keywords.append(ent.text.lower())
        
        # Удаляем дубликаты и сортируем по частоте
        keyword_freq = {}
        for keyword in keywords:
            keyword_freq[keyword] = keyword_freq.get(keyword, 0) + 1
        
        # Сортируем по частоте
        sorted_keywords = sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)
        return [k for k, v in sorted_keywords[:max_keywords]]

    def extract_key_phrases(self, text: str, max_phrases: int = 5) -> List[str]:
        """Извлечение ключевых фраз (важных утверждений) из текста"""
        # Разбиваем на предложения
        sentences = sent_tokenize(text)
        
        # Оцениваем важность каждого предложения
        sentence_scores = []
        for sentence in sentences:
            if len(sentence.split()) < 5:  # Пропускаем короткие предложения
                continue
                
            # Оцениваем предложение по нескольким параметрам
            score = 0
            
            # 1. Длина предложения (оптимально 10-20 слов)
            words = len(sentence.split())
            if 10 <= words <= 20:
                score += 0.3
            elif words < 10:
                score += 0.1
            else:
                score += 0.2
                
            # 2. Наличие числовых данных
            if re.search(r'\d+', sentence):
                score += 0.25
                
            # 3. Наличие именованных сущностей
            doc = self.nlp(sentence)
            if doc.ents:
                score += 0.25 * len(doc.ents)
                
            # 4. Наличие ключевых маркеров важности
            importance_markers = ['important', 'significant', 'key', 'major', 'critical', 'essential']
            for marker in importance_markers:
                if marker in sentence.lower():
                    score += 0.15
                    
            sentence_scores.append((sentence, score))
            
        # Сортируем предложения по важности
        sentence_scores.sort(key=lambda x: x[1], reverse=True)
        return [sentence for sentence, _ in sentence_scores[:max_phrases]]

    def generate_summary(self, text: str, max_sentences: int = 3) -> str:
        """Улучшенная генерация краткого содержания текста"""
        # Разбиваем на предложения
        sentences = sent_tokenize(text)
        
        if len(sentences) <= max_sentences:
            return " ".join(sentences)
            
        # Создаем представление документа
        doc = self.nlp(text)
        
        # Оцениваем важность каждого предложения
        sentence_scores = {}
        
        # Подсчитываем частоту слов (без стоп-слов)
        word_frequencies = {}
        for token in doc:
            if not token.is_stop and not token.is_punct and token.text.lower() not in self.stop_words:
                word_frequencies[token.text.lower()] = word_frequencies.get(token.text.lower(), 0) + 1
                
        # Нормализуем частоты
        max_frequency = max(word_frequencies.values()) if word_frequencies else 1
        for word in word_frequencies:
            word_frequencies[word] = word_frequencies[word] / max_frequency
            
        # Оцениваем каждое предложение
        for i, sentence in enumerate(sentences):
            for word in nltk.word_tokenize(sentence.lower()):
                if word in word_frequencies:
                    if i in sentence_scores:
                        sentence_scores[i] += word_frequencies[word]
                    else:
                        sentence_scores[i] = word_frequencies[word]
                        
            # Даем бонус первым предложениям (обычно они содержат основную информацию)
            if i == 0:
                sentence_scores[i] = sentence_scores.get(i, 0) + 0.5
            elif i == 1:
                sentence_scores[i] = sentence_scores.get(i, 0) + 0.3
                
        # Выбираем лучшие предложения
        ranked_sentences = sorted([(i, score) for i, score in sentence_scores.items()], 
                                  key=lambda x: x[1], reverse=True)
        
        # Восстанавливаем порядок предложений в тексте
        selected_indices = sorted([i for i, _ in ranked_sentences[:max_sentences]])
        summary = " ".join([sentences[i] for i in selected_indices])
        
        return summary

    def analyze_article(self, article: Article) -> Dict[str, Any]:
        """Комплексный анализ статьи"""
        # Объединяем заголовок и содержимое для анализа
        full_text = f"{article.title} {article.content}"
        
        # Проводим анализ
        sentiment_analysis = self.analyze_sentiment(full_text)
        keywords = self.extract_keywords(full_text)
        entities = self.extract_entities(full_text)
        key_phrases = self.extract_key_phrases(article.content)
        summary = self.generate_summary(article.content)
        
        return {
            "sentiment_score": sentiment_analysis["polarity"],
            "sentiment_details": json.dumps(sentiment_analysis),
            "keywords": json.dumps(keywords),
            "entities": json.dumps(entities),
            "key_phrases": json.dumps(key_phrases),
            "summary": summary
        }

    def process_unanalyzed_articles(self):
        """Обработка всех статей, которые еще не были проанализированы"""
        # Находим статьи без анализа
        try:
            unanalyzed_articles = self.db.query(Article).filter(
                (Article.sentiment_score.is_(None)) | 
                (Article.keywords.is_(None)) | 
                (Article.summary.is_(None))
            ).all()
            
            logger.info(f"Найдено {len(unanalyzed_articles)} статей для NLP-анализа")
            
            if not unanalyzed_articles:
                logger.info("Нет статей для анализа")
                return 0
            
            processed_count = 0
            error_count = 0
            
            for article in unanalyzed_articles:
                try:
                    logger.info(f"Анализ статьи ID={article.id}: '{article.title[:50]}...'")
                    analysis = self.analyze_article(article)
                    
                    # Обновляем статью с результатами анализа
                    article.sentiment_score = analysis["sentiment_score"]
                    article.keywords = analysis["keywords"]
                    article.entities = analysis.get("entities", "[]")
                    article.key_phrases = analysis.get("key_phrases", "[]")
                    article.sentiment_details = analysis.get("sentiment_details", "{}")
                    article.summary = analysis["summary"]
                    
                    # Проверяем, соответствует ли статья текущей теме, и предлагаем лучшую тему, если нет
                    self.verify_article_topic(article)
                    
                    self.db.add(article)
                    processed_count += 1
                    
                    # Периодически коммитим изменения, чтобы не держать большую транзакцию
                    if processed_count % 10 == 0:
                        self.db.commit()
                        logger.info(f"Промежуточный коммит: обработано {processed_count} статей")
                        
                except Exception as e:
                    error_count += 1
                    logger.error(f"Ошибка при анализе статьи ID={article.id}: {str(e)}")
                    # Продолжаем с другими статьями
            
            # Финальный коммит
            self.db.commit()
            logger.info(f"NLP-анализ завершен: обработано {processed_count} статей, ошибок: {error_count}")
            return processed_count
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Ошибка при обработке статей: {str(e)}")
            # Логируем полный стек-трейс для отладки
            import traceback
            logger.error(traceback.format_exc())
            return 0 
            
    def verify_article_topic(self, article: Article) -> bool:
        """Проверяет, соответствует ли статья своей текущей теме, и предлагает лучшую тему, если нет"""
        try:
            # Получаем ключевые слова статьи
            if not article.keywords:
                logger.warning(f"Статья ID={article.id} не имеет ключевых слов для проверки темы")
                return False
                
            # Извлекаем ключевые слова из JSON
            article_keywords = json.loads(article.keywords) if isinstance(article.keywords, str) else article.keywords
            
            # Если ключевые слова отсутствуют, не можем сопоставить
            if not article_keywords:
                logger.warning(f"Статья ID={article.id} имеет пустой список ключевых слов")
                return False
                
            # Получаем текущую тему статьи
            current_topic = self.db.query(Topic).filter(Topic.id == article.topic_id).first()
            if not current_topic:
                logger.warning(f"Не найдена тема с ID={article.topic_id} для статьи ID={article.id}")
                return False
                
            # Получаем все темы из базы данных
            all_topics = self.db.query(Topic).all()
            if not all_topics:
                logger.warning("В базе данных нет тем для сопоставления")
                return False
                
            # Оцениваем соответствие для текущей темы
            current_topic_score = self._calculate_topic_similarity(article, current_topic, article_keywords)
            
            # Оцениваем соответствие для всех других тем
            topic_scores = []
            for topic in all_topics:
                if topic.id != current_topic.id:
                    similarity = self._calculate_topic_similarity(article, topic, article_keywords)
                    topic_scores.append((topic, similarity))
                    
            # Сортируем темы по оценке соответствия (по убыванию)
            topic_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Если есть темы с лучшим соответствием, чем текущая
            if topic_scores and topic_scores[0][1] > current_topic_score * 1.5:  # Требуем значительное превосходство
                better_topic = topic_scores[0][0]
                logger.info(f"Найдена лучшая тема для статьи ID={article.id}: '{better_topic.name}' "
                          f"(оценка: {topic_scores[0][1]:.2f}) vs текущая '{current_topic.name}' "
                          f"(оценка: {current_topic_score:.2f})")
                
                # Перемещаем статью в лучшую тему
                article.topic_id = better_topic.id
                logger.info(f"Статья ID={article.id} перемещена из темы '{current_topic.name}' в '{better_topic.name}'")
                return True
                
            # Текущая тема - лучшая или близка к лучшей
            logger.info(f"Статья ID={article.id} соответствует своей текущей теме '{current_topic.name}' "
                      f"(оценка: {current_topic_score:.2f})")
            return False
            
        except Exception as e:
            logger.error(f"Ошибка при проверке темы для статьи ID={article.id}: {str(e)}")
            # Логируем полный стек-трейс для отладки
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def _calculate_topic_similarity(self, article: Article, topic: Topic, article_keywords: List[str]) -> float:
        """Рассчитывает оценку соответствия статьи указанной теме с использованием TF-IDF и косинусного сходства"""
        # Базовые веса для разных компонентов
        TITLE_WEIGHT = 3.0
        KEYWORD_WEIGHT = 1.0
        CONTENT_WEIGHT = 0.5
        ENTITY_WEIGHT = 1.5
        TFIDF_WEIGHT = 2.0  # Вес для TF-IDF сходства
        
        # Инициализируем общую оценку
        total_score = 0.0
        
        # Разбиваем ключевые слова темы
        topic_keywords = []
        
        # Основное ключевое слово темы (имя темы)
        topic_main_keyword = topic.name.lower()
        topic_keywords.append(topic_main_keyword)
        
        # Дополнительные ключевые слова темы, если есть
        if topic.keywords:
            try:
                additional_keywords = json.loads(topic.keywords) if isinstance(topic.keywords, str) else topic.keywords
                if isinstance(additional_keywords, list):
                    topic_keywords.extend([kw.lower() for kw in additional_keywords if kw])
            except:
                pass
        
        # Вычисляем TF-IDF сходство между статьей и темой
        tfidf_score = 0.0
        if article.content and topic_keywords:
            try:
                # Создаем корпус из содержимого статьи и описания темы
                corpus = [article.content]
                topic_text = " ".join(topic_keywords)
                corpus.append(topic_text)
                
                # Трансформируем в TF-IDF векторы
                tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus)
                
                # Вычисляем косинусное сходство между векторами
                similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
                tfidf_score = similarity * TFIDF_WEIGHT
            except Exception as e:
                logger.warning(f"Ошибка при расчете TF-IDF сходства: {str(e)}")
        
        # Проверяем наличие темы в заголовке (высший приоритет)
        if article.title:
            title_lower = article.title.lower()
            for keyword in topic_keywords:
                if keyword in title_lower:
                    # Полное слово в заголовке - очень сильный индикатор
                    total_score += TITLE_WEIGHT
                    break
        
        # Проверяем наличие ключевых слов темы в ключевых словах статьи
        for topic_kw in topic_keywords:
            for article_kw in article_keywords:
                article_kw_lower = article_kw.lower()
                
                # Точное совпадение
                if topic_kw == article_kw_lower:
                    total_score += KEYWORD_WEIGHT
                # Частичное совпадение (ключевое слово темы содержится в ключевом слове статьи)
                elif topic_kw in article_kw_lower:
                    total_score += KEYWORD_WEIGHT * 0.7
                # Проверка на основу слова (стемминг)
                elif self._check_stem_match(topic_kw, article_kw_lower):
                    total_score += KEYWORD_WEIGHT * 0.5
        
        # Проверяем наличие сущностей, связанных с темой
        if article.entities:
            try:
                entities = json.loads(article.entities) if isinstance(article.entities, str) else article.entities
                if isinstance(entities, list):
                    for entity in entities:
                        if isinstance(entity, dict) and "name" in entity:
                            entity_name = entity["name"].lower()
                            for topic_kw in topic_keywords:
                                if topic_kw in entity_name or self._check_stem_match(topic_kw, entity_name):
                                    # Сущности имеют больший вес, чем обычные ключевые слова
                                    total_score += ENTITY_WEIGHT
                                    # Учитываем частоту упоминания сущности, если она указана
                                    if "count" in entity:
                                        try:
                                            count = int(entity["count"])
                                            if count > 1:
                                                total_score += ENTITY_WEIGHT * min(count - 1, 3) * 0.2  # Ограничиваем бонус
                                        except:
                                            pass
            except:
                pass
        
        # Проверяем наличие темы в содержимом (менее важно, но все же значимо)
        if article.content:
            content_lower = article.content.lower()
            for keyword in topic_keywords:
                # Считаем количество вхождений ключевого слова в контент
                occurrences = content_lower.count(keyword)
                if occurrences > 0:
                    # Ограничиваем максимальное количество учитываемых вхождений
                    normalized_occurrences = min(occurrences, 10)
                    total_score += CONTENT_WEIGHT * normalized_occurrences * 0.1
        
        # Добавляем TF-IDF оценку сходства
        total_score += tfidf_score
        
        # Нормализуем оценку относительно количества ключевых слов темы
        topic_keywords_count = max(len(topic_keywords), 1)
        normalized_score = total_score / topic_keywords_count
        
        return normalized_score
    
    def _check_stem_match(self, word1: str, word2: str) -> bool:
        """Проверяет, имеют ли два слова общую основу (стемминг) с улучшенным алгоритмом"""
        # Если одно из слов короткое, используем точное совпадение
        if len(word1) < 4 or len(word2) < 4:
            return word1 == word2
            
        # Используем улучшенный алгоритм стемминга
        # Вместо простого префикса проверяем соотношение общего префикса к длине слов
        common_prefix_length = 0
        for c1, c2 in zip(word1, word2):
            if c1 != c2:
                break
            common_prefix_length += 1
            
        # Учитываем отношение длины общего префикса к длине слов
        min_length = min(len(word1), len(word2))
        similarity = common_prefix_length / min_length
        
        # Если общий префикс составляет не менее 70% от длины самого короткого слова
        return similarity >= 0.7
    
    def recategorize_all_articles(self):
        """Перекатегоризирует все статьи на основе улучшенного алгоритма сопоставления тем"""
        try:
            # Получаем все статьи, у которых есть ключевые слова
            articles = self.db.query(Article).filter(Article.keywords.isnot(None)).all()
            
            if not articles:
                logger.info("Нет статей для перекатегоризации")
                return 0, 0
                
            logger.info(f"Найдено {len(articles)} статей для перекатегоризации")
            
            moved_count = 0
            error_count = 0
            
            for article in articles:
                try:
                    if self.verify_article_topic(article):
                        moved_count += 1
                        
                    # Периодически коммитим изменения
                    if moved_count > 0 and moved_count % 10 == 0:
                        self.db.commit()
                        logger.info(f"Промежуточный коммит: перемещено {moved_count} статей")
                except Exception as e:
                    error_count += 1
                    logger.error(f"Ошибка при перекатегоризации статьи ID={article.id}: {str(e)}")
            
            # Финальный коммит
            self.db.commit()
            logger.info(f"Перекатегоризация завершена: перемещено {moved_count} статей, ошибок: {error_count}")
            
            return moved_count, error_count
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Ошибка при перекатегоризации статей: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return 0, 0

    # Новый метод для тематического моделирования с использованием LDA
    def topic_modeling(self, articles: List[Article], num_topics: int = 5) -> Dict[str, Any]:
        """Выполняет тематическое моделирование набора статей с использованием LDA"""
        try:
            from sklearn.decomposition import LatentDirichletAllocation
            
            # Получаем содержимое статей
            texts = [article.content for article in articles if article.content]
            
            if not texts:
                logger.warning("Нет текстов для тематического моделирования")
                return {"topics": [], "success": False}
                
            # Трансформируем тексты в TF-IDF представление
            tfidf = self.tfidf_vectorizer.fit_transform(texts)
            
            # Применяем LDA
            lda = LatentDirichletAllocation(
                n_components=num_topics,
                max_iter=10,
                learning_method='online',
                random_state=0
            )
            lda.fit(tfidf)
            
            # Получаем топ-слов для каждой темы
            feature_names = self.tfidf_vectorizer.get_feature_names_out()
            topics = []
            
            for topic_idx, topic in enumerate(lda.components_):
                top_words_idx = topic.argsort()[:-11:-1]  # Топ-10 слов
                top_words = [feature_names[i] for i in top_words_idx]
                topics.append({
                    "id": topic_idx,
                    "keywords": top_words
                })
            
            # Определяем топ-тему для каждой статьи
            article_topics = []
            topic_distributions = lda.transform(tfidf)
            
            for i, article in enumerate(articles):
                if i < len(topic_distributions):
                    # Получаем индекс темы с максимальной вероятностью
                    top_topic_idx = topic_distributions[i].argmax()
                    # Получаем вероятность топ-темы
                    top_topic_prob = topic_distributions[i][top_topic_idx]
                    
                    article_topics.append({
                        "article_id": article.id,
                        "article_title": article.title,
                        "top_topic_id": int(top_topic_idx),
                        "top_topic_prob": float(top_topic_prob),
                        "full_distribution": [float(prob) for prob in topic_distributions[i]]
                    })
            
            return {
                "topics": topics,
                "article_topics": article_topics,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Ошибка при тематическом моделировании: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"topics": [], "success": False, "error": str(e)} 