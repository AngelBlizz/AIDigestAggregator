import sqlite3
import os
import datetime

# Initial topics to create
sample_topics = [
    {
        "name": "Technology",
        "description": "News about technology innovations, AI, smartphones, and software development.",
        "category": "tech"
    },
    {
        "name": "Business",
        "description": "Business news, market analysis, economic trends, and corporate updates.",
        "category": "business"
    },
    {
        "name": "Health",
        "description": "Health-related news, medical breakthroughs, wellness advice, and healthcare policy.",
        "category": "health"
    },
    {
        "name": "Politics",
        "description": "Political news and analysis, government policy, elections, and global politics.",
        "category": "politics"
    },
    {
        "name": "Science",
        "description": "Scientific discoveries, research breakthroughs, space exploration, and environmental science.",
        "category": "science"
    },
    {
        "name": "Entertainment",
        "description": "Entertainment news including movies, music, celebrities, and cultural events.",
        "category": "entertainment"
    },
    {
        "name": "Sports",
        "description": "Sports news, match updates, athlete profiles, and sporting events.",
        "category": "sports"
    },
    {
        "name": "World",
        "description": "International news and events from around the globe.",
        "category": "world"
    }
]

# Connect to the database
db_path = os.path.join('backend', 'news_digest.db')
print(f"Database path: {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if topics already exist
cursor.execute("SELECT COUNT(*) FROM topics")
count = cursor.fetchone()[0]
print(f"Current topic count: {count}")

if count == 0:
    print("No topics found. Creating sample topics...")
    # Create topics
    current_time = datetime.datetime.now().isoformat()
    for topic in sample_topics:
        cursor.execute(
            "INSERT INTO topics (name, description, category, created_at) VALUES (?, ?, ?, ?)",
            (topic["name"], topic["description"], topic["category"], current_time)
        )
    
    conn.commit()
    print(f"Added {len(sample_topics)} sample topics")
else:
    print("Topics already exist, skipping creation")

# Check topics after update
cursor.execute("SELECT id, name, category FROM topics")
topics = cursor.fetchall()
print("\nTopics in the database:")
for topic in topics:
    print(f"- ID: {topic[0]}, Name: {topic[1]}, Category: {topic[2]}")

conn.close()
print("\nOperation completed.") 