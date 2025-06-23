from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

# Topic schemas
class TopicBase(BaseModel):
    name: str = Field(..., description="Название темы")
    description: Optional[str] = Field(None, description="Описание темы")
    tags: Optional[str] = Field(None, description="Теги для улучшения парсинга в формате JSON")

class TopicCreate(TopicBase):
    pass

class TopicUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Название темы")
    description: Optional[str] = Field(None, description="Описание темы")
    tags: Optional[str] = Field(None, description="Теги для улучшения парсинга в формате JSON")

class TopicResponse(TopicBase):
    id: int
    category: Optional[str] = "other"
    is_selected: Optional[bool] = False
    created_at: datetime

    class Config:
        orm_mode = True

# Схемы для персональных тем пользователей
class UserTopicBase(BaseModel):
    name: str = Field(..., description="Название персональной темы")
    description: Optional[str] = Field(None, description="Описание персональной темы")
    keywords: Optional[str] = Field(None, description="Ключевые слова для поиска в формате JSON")
    is_active: bool = True

class UserTopicCreate(UserTopicBase):
    pass

class UserTopicUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Название персональной темы")
    description: Optional[str] = Field(None, description="Описание персональной темы")
    keywords: Optional[str] = Field(None, description="Ключевые слова для поиска в формате JSON")
    is_active: Optional[bool] = None

class UserTopicResponse(UserTopicBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True 