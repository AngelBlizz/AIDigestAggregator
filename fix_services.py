import sqlite3
import os
import sys
import json
import datetime
from random import choice, randint, uniform

# Function to create a database connection
def get_db_connection():
    db_path = os.path.join('backend', 'news_digest.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# Sample article content
def generate_sample_article_content(topic):
    topics_content = {
        "Technology": [
            "The latest advances in artificial intelligence are transforming industries from healthcare to finance. Companies are investing heavily in AI-powered solutions to streamline operations and enhance customer experiences.",
            "5G technology continues to expand globally, promising faster speeds and more reliable connections for mobile users. Telecommunications companies are racing to build infrastructure to support the next generation of connected devices.",
            "Cybersecurity threats are evolving rapidly as attackers employ increasingly sophisticated techniques. Organizations must adapt their security posture to address these emerging challenges and protect sensitive data."
        ],
        "Business": [
            "Global markets react to economic policy changes as central banks adjust interest rates. Investors are closely monitoring indicators for signs of inflation or recession risks in major economies.",
            "Startups in the fintech sector raised record funding this quarter, indicating strong investor confidence in financial technology innovation. New payment solutions and blockchain applications are attracting significant attention.",
            "Supply chain disruptions continue to affect manufacturing across multiple sectors. Companies are implementing resilience strategies to mitigate risks and ensure consistent product availability."
        ],
        "Health": [
            "Researchers have made a breakthrough in understanding key mechanisms of autoimmune diseases. This discovery could lead to new therapeutic approaches for conditions like rheumatoid arthritis and multiple sclerosis.",
            "Public health officials are emphasizing preventive care approaches to address rising healthcare costs. Programs focusing on nutrition, exercise, and early screening are showing promising results in improving community health outcomes.",
            "Telemedicine adoption continues to grow even as pandemic restrictions ease. Patients and healthcare providers alike are embracing the convenience and accessibility of virtual medical consultations."
        ],
        "Politics": [
            "Lawmakers are debating comprehensive infrastructure legislation aimed at modernizing transportation systems and expanding broadband access across rural areas. The bill faces scrutiny over funding mechanisms and implementation timelines.",
            "Diplomatic relations between major powers show signs of improvement following high-level talks. Negotiators have reached preliminary agreements on trade and security cooperation that could ease international tensions.",
            "Election reforms are being considered in several regions to address voter access and security concerns. Proposals include expanded early voting options and updated verification procedures."
        ],
        "Science": [
            "Astronomers have detected unusual signals from a distant galaxy that challenge existing models of cosmic formation. Researchers are analyzing the data to determine if this represents a previously unknown astronomical phenomenon.",
            "Climate scientists have compiled new evidence of accelerating polar ice melt and its effects on ocean currents. The findings have implications for weather patterns and coastal communities worldwide.",
            "Advances in quantum computing have achieved a significant milestone with researchers demonstrating practical quantum advantage for specific computational problems. Tech companies are racing to develop commercial applications."
        ]
    }
    
    if topic in topics_content:
        return choice(topics_content[topic])
    return "Sample article content for general news and information about current events and trends."

# Create sample articles for topics
def create_sample_articles():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if articles already exist
    cursor.execute("SELECT COUNT(*) FROM articles")
    count = cursor.fetchone()[0]
    
    if count > 0:
        print(f"Articles already exist ({count} found). Skipping article creation.")
        conn.close()
        return
    
    # Get topics
    cursor.execute("SELECT id, name FROM topics")
    topics = cursor.fetchall()
    
    if not topics:
        print("No topics found. Please run create_sample_topics.py first.")
        conn.close()
        return
    
    print(f"Creating sample articles for {len(topics)} topics...")
    
    # Sample sources
    sources = ["BBC News", "The New York Times", "TechCrunch", "Reuters", "Bloomberg", "CNN", "The Guardian"]
    
    # Create sample articles
    articles_created = 0
    
    for topic in topics:
        # Create 3-7 articles per topic
        for _ in range(randint(3, 7)):
            now = datetime.datetime.now()
            days_ago = randint(0, 7)  # Articles from the past week
            published_at = now - datetime.timedelta(days=days_ago, hours=randint(0, 23), minutes=randint(0, 59))
            
            title = f"Sample article about {topic['name']}: {randint(1000, 9999)}"
            content = generate_sample_article_content(topic['name'])
            source = choice(sources)
            url = f"https://example.com/news/{topic['id']}/{articles_created + 1}"
            
            # Generate random sentiment score between -1 and 1
            sentiment_score = round(uniform(-0.9, 0.9), 2)
            
            # Generate keywords (JSON array as string)
            keywords = json.dumps([f"keyword{i}" for i in range(1, randint(3, 8))])
            
            # Generate a summary
            summary = content[:100] + "..."
            
            cursor.execute(
                """
                INSERT INTO articles (
                    title, content, url, source, published_at, 
                    created_at, topic_id, sentiment_score, keywords, summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    title, content, url, source, published_at.isoformat(), 
                    now.isoformat(), topic['id'], sentiment_score, keywords, summary
                )
            )
            articles_created += 1
    
    conn.commit()
    print(f"Created {articles_created} sample articles")
    conn.close()

# Create sample digests
def create_sample_digests():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if digests already exist
    cursor.execute("SELECT COUNT(*) FROM digests")
    count = cursor.fetchone()[0]
    
    if count > 0:
        print(f"Digests already exist ({count} found). Skipping digest creation.")
        conn.close()
        return
    
    # Get users and articles
    cursor.execute("SELECT id FROM users")
    users = cursor.fetchall()
    
    if not users:
        print("No users found. Please create some users first.")
        conn.close()
        return
    
    cursor.execute("SELECT id FROM articles")
    articles = cursor.fetchall()
    
    if not articles:
        print("No articles found. Please run create_sample_articles first.")
        conn.close()
        return
    
    print(f"Creating sample digests for {len(users)} users...")
    
    # Create sample digests
    digests_created = 0
    digest_articles_created = 0
    
    for user in users:
        # Create 1-3 digests per user
        for i in range(randint(1, 3)):
            now = datetime.datetime.now()
            days_ago = randint(0, 7)  # Digests from the past week
            created_at = now - datetime.timedelta(days=days_ago)
            
            digest_title = f"Your News Digest — {created_at.strftime('%d.%m.%Y')}"
            is_read = randint(0, 1) == 1  # 50% chance of being read
            
            cursor.execute(
                "INSERT INTO digests (user_id, title, created_at, is_read) VALUES (?, ?, ?, ?)",
                (user['id'], digest_title, created_at.isoformat(), is_read)
            )
            digest_id = cursor.lastrowid
            digests_created += 1
            
            # Add 5-10 articles to each digest
            article_ids = [article['id'] for article in articles]
            selected_articles = []
            
            # Randomly select articles without repetition
            for _ in range(min(randint(5, 10), len(article_ids))):
                if not article_ids:
                    break
                    
                article_id = choice(article_ids)
                article_ids.remove(article_id)
                selected_articles.append(article_id)
            
            # Add articles to digest
            for idx, article_id in enumerate(selected_articles):
                cursor.execute(
                    "INSERT INTO digest_articles (digest_id, article_id, order, created_at) VALUES (?, ?, ?, ?)",
                    (digest_id, article_id, idx + 1, now.isoformat())
                )
                digest_articles_created += 1
    
    conn.commit()
    print(f"Created {digests_created} digests with {digest_articles_created} total digest articles")
    conn.close()

# Assign topics to users
def assign_topics_to_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user_topics already has entries
    cursor.execute("SELECT COUNT(*) FROM user_topics")
    count = cursor.fetchone()[0]
    
    if count > 0:
        print(f"User topic assignments already exist ({count} found). Skipping assignment.")
        conn.close()
        return
    
    # Get users and topics
    cursor.execute("SELECT id FROM users")
    users = cursor.fetchall()
    
    if not users:
        print("No users found. Please create some users first.")
        conn.close()
        return
    
    cursor.execute("SELECT id FROM topics")
    topics = cursor.fetchall()
    
    if not topics:
        print("No topics found. Please run create_sample_topics.py first.")
        conn.close()
        return
    
    print(f"Assigning topics to {len(users)} users...")
    
    # Assign topics to users
    assignments_created = 0
    
    for user in users:
        # Assign 2-5 random topics to each user
        topic_ids = [topic['id'] for topic in topics]
        num_topics = min(randint(2, 5), len(topic_ids))
        
        selected_topics = []
        for _ in range(num_topics):
            if not topic_ids:
                break
                
            topic_id = choice(topic_ids)
            topic_ids.remove(topic_id)
            selected_topics.append(topic_id)
        
        # Add topics to user
        for topic_id in selected_topics:
            cursor.execute(
                "INSERT INTO user_topics (user_id, topic_id) VALUES (?, ?)",
                (user['id'], topic_id)
            )
            assignments_created += 1
    
    conn.commit()
    print(f"Created {assignments_created} user-topic assignments")
    conn.close()

def main():
    print("Starting services fix and initialization...\n")
    
    print("Step 1: Assigning topics to users...")
    assign_topics_to_users()
    print()
    
    print("Step 2: Creating sample articles...")
    create_sample_articles()
    print()
    
    print("Step 3: Creating sample digests...")
    create_sample_digests()
    print()
    
    print("Services initialization completed successfully!")
    print("\nYou can now run the backend server and frontend to view the content:")
    print("1. Start backend: python backend/manage_processes.py --start all")
    print("2. Start frontend: cd frontend && npm start")

if __name__ == "__main__":
    main() 