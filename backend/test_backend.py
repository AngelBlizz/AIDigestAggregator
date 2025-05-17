"""
Тестирование бэкенда
"""
import sys
import os
print("Текущая директория:", os.getcwd())

try:
    from app.db.session import SessionLocal
    from app.models.models import User, Topic, Article
    
    # Пробуем подключиться к базе данных
    db = SessionLocal()
    print("Подключение к БД установлено")
    
    # Проверяем наличие пользователей и тем
    user_count = db.query(User).count()
    topic_count = db.query(Topic).count()
    article_count = db.query(Article).count()
    
    print(f"В базе данных: {user_count} пользователей, {topic_count} тем, {article_count} статей")
    
    # Если есть темы, пробуем получить статьи по ним
    if topic_count > 0:
        topics = db.query(Topic).all()
        print("Темы в базе данных:")
        for topic in topics:
            articles_count = db.query(Article).filter(Article.topic_id == topic.id).count()
            print(f"  - {topic.name}: {articles_count} статей")
    
    # Закрываем соединение
    db.close()
    
except Exception as e:
    print(f"Ошибка: {str(e)}")
    import traceback
    traceback.print_exc() 