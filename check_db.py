import sqlite3
import os

print("Checking database tables...")
db_path = os.path.join('backend', 'news_digest.db')
print(f"Database path: {db_path}")
print(f"Database exists: {os.path.exists(db_path)}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("\nTables in the database:")
for table in tables:
    print(f"- {table[0]}")

# Check data in important tables
for table_name in ['users', 'topics', 'articles', 'digests', 'digest_articles']:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        print(f"\nCount of rows in {table_name}: {count}")
        
        if count > 0 and table_name == 'topics':
            cursor.execute(f"SELECT id, name, description FROM {table_name} LIMIT 5;")
            rows = cursor.fetchall()
            print("Sample topics:")
            for row in rows:
                print(f"  - ID: {row[0]}, Name: {row[1]}, Description: {row[2][:30]}...")
        
        if count > 0 and table_name == 'articles':
            cursor.execute(f"SELECT id, title, source, published_at FROM {table_name} LIMIT 5;")
            rows = cursor.fetchall()
            print("Sample articles:")
            for row in rows:
                print(f"  - ID: {row[0]}, Title: {row[1][:30]}..., Source: {row[2]}, Date: {row[3]}")
    except sqlite3.OperationalError as e:
        print(f"Error accessing {table_name}: {e}")

conn.close()
print("\nDatabase check completed.") 