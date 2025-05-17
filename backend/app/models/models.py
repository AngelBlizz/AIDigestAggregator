from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime, Table, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.hybrid import hybrid_property
from app.db.base_class import Base

# Таблица ассоциации для многих-ко-многим отношения между пользователями и темами
user_topics = Table(
    'user_topics',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('topic_id', Integer, ForeignKey('topics.id'))
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)  # Добавляем флаг суперпользователя
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    topics = relationship("Topic", secondary=user_topics, back_populates="users")
    digests = relationship("Digest", back_populates="user")

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    category = Column(String, default="other")  # Добавляем категорию для тем
    
    # Это используется для отслеживания, выбрана ли тема пользователем
    # Она не хранится в базе данных, а вычисляется во время выполнения
    is_selected = None

    # Relationships
    users = relationship("User", secondary=user_topics, back_populates="topics")
    articles = relationship("Article", back_populates="topic")

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    url = Column(String, unique=True)
    source = Column(String)
    published_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    topic_id = Column(Integer, ForeignKey("topics.id"))
    
    # NLP Analysis fields
    sentiment_score = Column(Float, nullable=True)
    sentiment_details = Column(Text, nullable=True)  # Хранение детального анализа тональности в JSON
    keywords = Column(Text, nullable=True)  # Хранение в JSON формате
    entities = Column(Text, nullable=True)  # Хранение именованных сущностей в JSON
    key_phrases = Column(Text, nullable=True)  # Хранение ключевых фраз в JSON
    summary = Column(Text, nullable=True)

    # Relationships
    topic = relationship("Topic", back_populates="articles")
    digest_articles = relationship("DigestArticle", back_populates="article")

class Digest(Base):
    __tablename__ = "digests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", back_populates="digests")
    articles = relationship("DigestArticle", back_populates="digest")

class DigestArticle(Base):
    __tablename__ = "digest_articles"

    id = Column(Integer, primary_key=True, index=True)
    digest_id = Column(Integer, ForeignKey("digests.id"))
    article_id = Column(Integer, ForeignKey("articles.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    order = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    digest = relationship("Digest", back_populates="articles")
    article = relationship("Article", back_populates="digest_articles")
    topic = relationship("Topic")

class NewsSource(Base):
    __tablename__ = "news_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    article_selector = Column(String, nullable=False)
    title_selector = Column(String, nullable=False)
    content_selector = Column(String, nullable=False)
    date_selector = Column(String, nullable=True)
    date_format = Column(String, nullable=True)
    fallback_article_selector = Column(String, nullable=True)
    fallback_content_selector = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True) 