from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any

# Общие свойства
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False

# Свойства, которые принимаются через API при создании
class UserCreate(UserBase):
    password: str

# Свойства, которые принимаются через API при обновлении
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    password: Optional[str] = None

# Дополнительные свойства, возвращаемые через API
class UserResponse(UserBase):
    id: int
    
    class Config:
        from_attributes = True

# Ответ токена
class Token(BaseModel):
    access_token: str
    token_type: str

class UserInDB(UserBase):
    id: int
    hashed_password: str
    
    class Config:
        from_attributes = True

class TokenPayload(BaseModel):
    sub: str
    exp: int
    iat: int
    type: str

# Стандартизированная модель ответа аутентификации
class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse 