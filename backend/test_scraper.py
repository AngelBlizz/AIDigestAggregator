import logging
from app.db.session import get_db
from app.services.news_scraper import NewsScraper
from app.models.models import Topic
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def test_scraper():
    """Test the news scraper with a single source"""
    try:
        # Get database session
        db = next(get_db())
        
        # Initialize scraper
        scraper = NewsScraper(db)
        
        # Check for existing topics
        topics = db.query(Topic).all()
        
        if not topics:
            # Create a test topic if none exists
            logger.info("Creating test topic since none exists")
            test_topic = Topic(
                name="Technology",
                description="News about technology and innovations",
                keywords="tech, technology, AI, artificial intelligence, innovation"
            )
            db.add(test_topic)
            db.commit()
            db.refresh(test_topic)
            topic = test_topic
        else:
            # Use the first available topic
            topic = topics[0]
            
        logger.info(f"Using topic: {topic.name}")
        
        # Test each source one by one
        sources = list(scraper.sources.keys())
        logger.info(f"Testing {len(sources)} sources: {', '.join(sources)}")
        
        for source_key in sources:
            logger.info(f"\n\n--- Testing source: {source_key} ---")
            try:
                # Try to scrape articles from this source
                articles = scraper.scrape_source(source_key, topic, max_articles=2)
                
                # Report results
                if articles:
                    logger.info(f"SUCCESS: Got {len(articles)} articles from {source_key}")
                    for article in articles:
                        logger.info(f"  - {article.title[:50]}... ({article.url})")
                else:
                    logger.warning(f"WARNING: No articles found from {source_key}")
            except Exception as e:
                logger.error(f"ERROR with {source_key}: {str(e)}")
                
        logger.info("\n\nTest completed!")
            
    except Exception as e:
        logger.error(f"Error testing scraper: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting scraper test...")
    test_scraper() 