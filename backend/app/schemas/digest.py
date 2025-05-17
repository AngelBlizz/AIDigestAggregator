from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

# Entity schema
class Entity(BaseModel):
    name: str
    type: str
    count: int

# Article schemas
class ArticleBase(BaseModel):
    title: str
    content: str
    summary: Optional[str] = None
    url: str
    source: str
    published_at: datetime
    
class ArticleResponse(ArticleBase):
    id: int
    created_at: datetime
    sentiment_score: Optional[float] = None
    keywords: Optional[List[str]] = []
    entities: Optional[List[Entity]] = []
    key_phrases: Optional[List[str]] = []
    sentiment_details: Optional[Dict[str, Any]] = None
    topic_id: int  # Добавляем топик для фильтрации
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        # Преобразование строк JSON в объекты Python
        # Обработка ключевых слов
        if isinstance(obj.keywords, str):
            try:
                obj.keywords = json.loads(obj.keywords)
            except:
                obj.keywords = []
                
        # Обработка сущностей
        if isinstance(obj.entities, str):
            try:
                obj.entities = json.loads(obj.entities)
            except:
                obj.entities = []
                
        # Обработка ключевых фраз
        if isinstance(obj.key_phrases, str):
            try:
                obj.key_phrases = json.loads(obj.key_phrases)
            except:
                obj.key_phrases = []
                
        # Обработка sentiment_details
        if isinstance(obj.sentiment_details, str):
            try:
                obj.sentiment_details = json.loads(obj.sentiment_details)
            except:
                obj.sentiment_details = None
                
        return super().from_orm(obj)

# Параметры запроса для расширенного поиска статей
class ArticleSearchParams(BaseModel):
    query: Optional[str] = None
    topic_id: Optional[int] = None
    topic_ids: Optional[List[int]] = None
    source: Optional[str] = None
    sources: Optional[List[str]] = None
    sentiment: Optional[str] = None
    min_sentiment: Optional[float] = None
    max_sentiment: Optional[float] = None
    keyword: Optional[str] = None
    entity: Optional[str] = None
    entity_type: Optional[str] = None
    days: Optional[int] = 7
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    sort_by: Optional[str] = "date"
    sort_order: Optional[str] = "desc"
    skip: int = 0
    limit: int = 20

# Результат поиска статей
class ArticleSearchResult(BaseModel):
    items: List[ArticleResponse]
    total: int
    page: int
    pages: int
    limit: int
    filters: Dict[str, Any]

# Digest generation parameters
class DigestGenerationParams(BaseModel):
    topics: Optional[List[int]] = []
    sources: Optional[List[str]] = []
    days: Optional[int] = 3
    maxArticles: Optional[int] = 10
    includeSentiment: Optional[bool] = True
    includeKeywords: Optional[bool] = True
    minSentimentScore: Optional[float] = -1.0
    maxSentimentScore: Optional[float] = 1.0
    autoScrape: Optional[bool] = True

# Digest schemas
class DigestBase(BaseModel):
    title: str

class DigestCreate(DigestBase):
    pass

class DigestListResponse(DigestBase):
    id: int
    created_at: datetime
    is_read: bool
    
    class Config:
        from_attributes = True

class DigestResponse(DigestListResponse):
    articles: List[ArticleResponse]
    
    class Config:
        from_attributes = True

class DigestStats(BaseModel):
    total_digests: int
    unread_digests: int
    total_articles: int
    topics_count: int
    recent_digests: List[DigestListResponse]
    
    class Config:
        from_attributes = True 