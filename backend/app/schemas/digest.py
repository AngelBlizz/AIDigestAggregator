from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
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
    keywords: List[str] = Field(default_factory=list)
    entities: List[Entity] = Field(default_factory=list)
    key_phrases: List[str] = Field(default_factory=list)
    sentiment_details: Optional[Dict[str, Any]] = None
    topic_id: int  # Добавляем топик для фильтрации
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        if obj is None:
            return None
            
        # Создаем словарь с данными модели
        data = {}
        for field in cls.__fields__:
            if hasattr(obj, field):
                data[field] = getattr(obj, field)
        
        # Преобразование строк JSON в объекты Python
        # Обработка ключевых слов
        if isinstance(data.get('keywords'), str):
            try:
                data['keywords'] = json.loads(data['keywords'])
            except (json.JSONDecodeError, TypeError):
                data['keywords'] = []
                
        # Обработка сущностей
        if isinstance(data.get('entities'), str):
            try:
                data['entities'] = json.loads(data['entities'])
            except (json.JSONDecodeError, TypeError):
                data['entities'] = []
                
        # Обработка ключевых фраз
        if isinstance(data.get('key_phrases'), str):
            try:
                data['key_phrases'] = json.loads(data['key_phrases'])
            except (json.JSONDecodeError, TypeError):
                data['key_phrases'] = []
                
        # Обработка sentiment_details
        if isinstance(data.get('sentiment_details'), str):
            try:
                data['sentiment_details'] = json.loads(data['sentiment_details'])
            except (json.JSONDecodeError, TypeError):
                data['sentiment_details'] = None
                
        return cls(**data)

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