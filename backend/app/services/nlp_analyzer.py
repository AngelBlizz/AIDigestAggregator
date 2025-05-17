import spacy
from typing import List, Dict, Any, Set, Tuple
from textblob import TextBlob
import json
from app.core.config import settings
from app.models.models import Article
from sqlalchemy.orm import Session
import re
from collections import Counter
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize

# Загрузка необходимых ресурсов NLTK
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
    
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

class NLPAnalyzer:
    def __init__(self, db: Session):
        self.db = db
        # Загружаем модель spaCy для русского и английского языков
        try:
            self.nlp = spacy.load(settings.SPACY_MODEL)
        except:
            # Если модель не установлена, используем базовую английскую модель
            self.nlp = spacy.load("en_core_web_sm")
        
        self.stop_words = set(stopwords.words('english'))

    def detect_language(self, text: str) -> str:
        """Определяем язык текста"""
        # Простой способ определения языка — по наиболее распространенным буквам
        # В реальном проекте лучше использовать специализированную библиотеку, например, langdetect
        if re.search('[а-яА-Я]', text):
            return 'ru'
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
        """Извлечение именованных сущностей из текста"""
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
        """Улучшенное извлечение ключевых слов из текста"""
        doc = self.nlp(text)
        
        # Получаем существительные, именованные сущности и фразы
        keywords = []
        
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
        unanalyzed_articles = self.db.query(Article).filter(
            (Article.sentiment_score.is_(None)) | 
            (Article.keywords.is_(None)) | 
            (Article.summary.is_(None))
        ).all()
        
        for article in unanalyzed_articles:
            analysis = self.analyze_article(article)
            
            # Обновляем статью с результатами анализа
            article.sentiment_score = analysis["sentiment_score"]
            article.keywords = analysis["keywords"]
            article.entities = analysis.get("entities", "[]")
            article.key_phrases = analysis.get("key_phrases", "[]")
            article.sentiment_details = analysis.get("sentiment_details", "{}")
            article.summary = analysis["summary"]
            
            self.db.add(article)
        
        self.db.commit() 