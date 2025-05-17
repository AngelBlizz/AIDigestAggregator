from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class TopicItem(BaseModel):
    name: str
    count: int

class SourceItem(BaseModel):
    name: str
    count: int

class AnalyticsSummary(BaseModel):
    total_articles: int
    total_digests: int
    avg_sentiment_score: float
    positive_articles: int
    negative_articles: int
    neutral_articles: int
    most_popular_topics: List[TopicItem]
    most_active_sources: List[SourceItem]

class TopicStat(BaseModel):
    id: int
    name: str
    category: str
    article_count: int

class TopicDistribution(BaseModel):
    topics: List[TopicStat]

class TimePeriod(BaseModel):
    period: str
    avg_sentiment: float
    article_count: int

class SentimentAnalytics(BaseModel):
    time_periods: List[TimePeriod]

class SourceStat(BaseModel):
    name: str
    article_count: int
    avg_sentiment: float

class SourceAnalytics(BaseModel):
    sources: List[SourceStat]

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