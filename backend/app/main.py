from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.core.config import settings
from app.api.api_v1.api import api_router
from app.db.create_tables import create_tables

# Создать таблицы при запуске приложения
create_tables()

app = FastAPI(
    title="AI News Digest Aggregator",
    description="Интеллектуальная система для агрегации и анализа новостного контента",
    version=settings.VERSION,
)

# Настройка CORS с более безопасными настройками
allowed_origins = [
    "http://localhost:3000",  # React frontend по умолчанию
    "http://localhost:8000",  # FastAPI backend (если нужно)
]

# В режиме разработки разрешать больше источников - должно быть ограничено в производстве
if settings.ENV == "development": 
    allowed_origins.extend([
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8080",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Type"],
    max_age=86400,  # Кэшировать preflight запросы на 1 день
)

# Добавить промежуточное ПО для доверенных хостов
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"]
)

# Обработчик ошибок валидации - преобразует ошибки в единый формат
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Преобразуем ошибки валидации в единый формат
    errors = []
    for error in exc.errors():
        errors.append({
            "loc": ".".join([str(loc) for loc in error["loc"]]),
            "msg": error["msg"]
        })
    
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": errors}
    )

# Включить API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "message": "Добро пожаловать в API AI News Digest Aggregator",
        "version": settings.VERSION,
        "status": "active"
    } 