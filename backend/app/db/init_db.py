from sqlalchemy.orm import Session
import json
from datetime import datetime, timedelta

from app.core.security import get_password_hash
from app.models.models import User, Topic, Article, Digest, DigestArticle

# Примерные данные
def init_db(db: Session) -> None:
    # Создать темы по умолчанию
    topics = [
        {"name": "Technology", "description": "News about technology and innovations"},
        {"name": "Business", "description": "Business and finance news"},
        {"name": "Science", "description": "Scientific discoveries and research"},
        {"name": "Health", "description": "Health and wellness news"},
        {"name": "Politics", "description": "Political news and analysis"}
    ]
    
    db_topics = []
    for topic_data in topics:
        topic = db.query(Topic).filter(Topic.name == topic_data["name"]).first()
        if not topic:
            topic = Topic(**topic_data)
            db.add(topic)
            db.flush()
        db_topics.append(topic)
    
    # Создать тестовый пользователь
    test_user = db.query(User).filter(User.email == "test@example.com").first()
    if not test_user:
        test_user = User(
            email="test@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True
        )
        db.add(test_user)
        db.flush()
    
    # Добавить темы к пользователю
    test_user.topics = db_topics[:3]  # Первые 3 темы
    
    # Создать примерные статьи
    articles = []
    for i, topic in enumerate(db_topics):
        for j in range(3):  # 3 статьи на тему
            article_title = f"Article {i+1}-{j+1} about {topic.name}"
            
            # Проверить, существует ли статья
            existing_article = db.query(Article).filter(Article.title == article_title).first()
            if existing_article:
                articles.append(existing_article)
                continue
            
            article = Article(
                title=article_title,
                content=f"This is the content of article {i+1}-{j+1} about {topic.name}. It contains detailed information on the subject.",
                url=f"https://example.com/articles/{i+1}-{j+1}",
                source="Sample News",
                published_at=datetime.utcnow() - timedelta(days=j),
                topic_id=topic.id,
                sentiment_score=0.5 - (j * 0.2),  # Sample sentiment scores
                keywords=json.dumps([f"keyword{i+1}", f"keyword{j+1}", topic.name.lower()]),
                summary=f"This is a summary of article {i+1}-{j+1} about {topic.name}."
            )
            db.add(article)
            db.flush()
            articles.append(article)
    
    # Создать примерные дайджесты
    for i in range(3):
        digest_title = f"Daily Digest {i+1}"
        
        # Проверить, существует ли дайджест
        existing_digest = db.query(Digest).filter(
            Digest.title == digest_title,
            Digest.user_id == test_user.id
        ).first()
        
        if existing_digest:
            continue
        
        digest = Digest(
            title=digest_title,
            user_id=test_user.id,
            created_at=datetime.utcnow() - timedelta(days=i),
            is_read=i > 0  # Только первый дайджест не прочитан
        )
        db.add(digest)
        db.flush()
        
        # Добавить статьи в дайджест
        for j, article in enumerate(articles[i*5:i*5+5]):  # 5 статей на дайджест
            digest_article = DigestArticle(
                digest_id=digest.id,
                article_id=article.id,
                order=j+1
            )
            db.add(digest_article)
    
    db.commit() 