from fastapi import APIRouter

from app.api.api_v1.endpoints import auth, digests, topics, stats, articles, scraper, analytics, user_topics

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(digests.router, prefix="/digests", tags=["digests"])
api_router.include_router(topics.router, prefix="/topics", tags=["topics"])
api_router.include_router(user_topics.router, prefix="/user-topics", tags=["user-topics"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
api_router.include_router(articles.router, prefix="/articles", tags=["articles"])
api_router.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])


# Пока что достаточно минимального маршрутизатора, чтобы запустить приложение 