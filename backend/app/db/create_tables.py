from sqlalchemy import inspect
import sqlalchemy as sa
from app.db.session import engine
from app.models.models import Base
from app.db.init_db import init_db
from app.db.session import SessionLocal
import logging

logger = logging.getLogger(__name__)

def create_tables():
    """
    Создает все таблицы в базе данных, если они еще не существуют.
    Также обновляет существующие таблицы, добавляя недостающие колонки (простая миграция).
    """
    inspector = inspect(engine)
    
    existing_tables = inspector.get_table_names()
    
    # Создаем недостающие таблицы
    tables_to_create = []
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            tables_to_create.append(table)
    
    if tables_to_create:
        logger.info(f"Создание таблиц: {', '.join(t.name for t in tables_to_create)}")
        Base.metadata.create_all(engine, tables=tables_to_create)
    
    # Обновляем схему существующих таблиц, добавляя недостающие колонки
    for table in Base.metadata.sorted_tables:
        if table.name in existing_tables:
            existing_columns = {column['name'] for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in existing_columns:
                    try:
                        logger.info(f"Добавление колонки {column.name} в таблицу {table.name}")
                        with engine.begin() as conn:
                            conn.execute(sa.text(
                                f"ALTER TABLE {table.name} ADD COLUMN {column.name} "
                                f"{_get_column_type_for_sqlite(column)}"
                            ))
                    except Exception as e:
                        logger.error(f"Ошибка добавления колонки {column.name} в таблицу {table.name}: {str(e)}")
    
    # Инициализируем базу данных тестовыми данными, если нужно
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()

def _get_column_type_for_sqlite(column):
    """
    Определяет тип колонки для SQLite на основе типа SQLAlchemy.
    """
    column_type = str(column.type)
    
    # Базовые типы SQLite
    if 'INTEGER' in column_type.upper():
        return 'INTEGER'
    elif 'VARCHAR' in column_type.upper() or 'String' in column_type:
        return 'TEXT'
    elif 'TEXT' in column_type.upper():
        return 'TEXT'
    elif 'FLOAT' in column_type.upper() or 'Float' in column_type:
        return 'REAL'
    elif 'BOOLEAN' in column_type.upper() or 'Boolean' in column_type:
        return 'INTEGER'
    elif 'DATETIME' in column_type.upper() or 'DateTime' in column_type:
        return 'TIMESTAMP'
    else:
        return 'TEXT'  # Для неизвестных типов используем TEXT 