from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime

class TopicItem(BaseModel):
    name: str
    count: int

class SourceItem(BaseModel):
    name: str
    count: int

class SentimentDistribution(BaseModel):
    date: str
    score: float

class TimePeriod(BaseModel):
    period: str
    avg_sentiment: float
    article_count: int

class SentimentAnalytics(BaseModel):
    positive_count: int
    negative_count: int
    neutral_count: int
    average_sentiment: float
    sentiment_over_time: List[Dict[str, Any]]

class SourceAnalytics(BaseModel):
    source: str
    count: int
    percentage: float

class TopicDistribution(BaseModel):
    topic_id: int
    topic_name: str
    count: int
    percentage: float

class AnalyticsSummary(BaseModel):
    total_articles: int
    total_digests: int
    avg_sentiment_score: float
    positive_articles: int
    negative_articles: int
    neutral_articles: int
    most_popular_topics: List[TopicItem]
    most_active_sources: List[SourceItem]
    topics_distribution: List[Dict[str, Any]]
    sentiment_analytics: SentimentAnalytics
    sources_analytics: List[SourceAnalytics]

class TopicStat(BaseModel):
    id: int
    name: str
    category: str
    article_count: int

class SourceStat(BaseModel):
    name: str
    article_count: int
    avg_sentiment: float

class EntityFrequency(BaseModel):
    entity: str
    entity_type: str
    count: int

class KeywordFrequency(BaseModel):
    keyword: str
    count: int

class ContentAnalytics(BaseModel):
    total_words: int
    avg_article_length: int
    entities: List[EntityFrequency]
    keywords: List[KeywordFrequency]

class SentimentStats(BaseModel):
    positive: int
    neutral: int
    negative: int
    total: int
    average_score: float
    distribution: List[SentimentDistribution]

class TopicStats(BaseModel):
    topic_id: int
    topic_name: str
    article_count: int
    percentage: float

class SourceStats(BaseModel):
    source: str
    article_count: int
    percentage: float

class EntityStats(BaseModel):
    name: str
    type: str
    count: int 