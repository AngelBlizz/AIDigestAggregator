from pydantic import BaseModel, HttpUrl
from typing import List, Optional

class NewsSourceBase(BaseModel):
    name: str
    url: str
    article_selector: str
    title_selector: str
    content_selector: str
    date_selector: str
    date_format: str

class NewsSourceCreate(NewsSourceBase):
    pass

class NewsSourceUpdate(NewsSourceBase):
    name: Optional[str] = None
    url: Optional[str] = None
    article_selector: Optional[str] = None
    title_selector: Optional[str] = None
    content_selector: Optional[str] = None
    date_selector: Optional[str] = None
    date_format: Optional[str] = None

class NewsSourceResponse(NewsSourceBase):
    key: str
    
    class Config:
        from_attributes = True

class NewsSourceList(BaseModel):
    sources: List[NewsSourceResponse] 