from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Topic schemas
class TopicBase(BaseModel):
    name: str
    description: Optional[str] = None

class TopicCreate(TopicBase):
    pass

class TopicUpdate(TopicBase):
    name: Optional[str] = None
    description: Optional[str] = None

class TopicResponse(TopicBase):
    id: int
    created_at: datetime
    is_selected: bool = False
    
    class Config:
        from_attributes = True 