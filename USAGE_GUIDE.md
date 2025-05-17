# AI News Digest Aggregator - Usage Guide

## Introduction

Welcome to the AI News Digest Aggregator, an intelligent system that collects, analyzes, and organizes news content into personalized digests. This guide will help you get started with the application.

## Quick Start

For the easiest way to start the application, simply run:

```bash
python start_app.py
```

This script will:
1. Check if your database has necessary data
2. Start the backend services
3. Start the frontend development server
4. Open the application in your default web browser

## Manual Setup

If you prefer to start services manually, follow these steps:

### Backend Setup

1. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r backend/requirements.txt
```

3. Initialize the database with sample data (if needed):
```bash
python fix_services.py
```

4. Start the backend services:
```bash
python backend/manage_processes.py --start all
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Features

### News Aggregation

The system automatically collects news from various sources using:
- NewsAPI
- NYTimes API
- Web scraping (for configured sources)

To manually trigger news collection, you can:
1. Log in as an admin
2. Navigate to Scraper Manager
3. Click "Run Scraper" for specific topics or all topics

### Digest Generation

Digests are collections of articles based on your topic preferences:

1. Set up your preferred topics in the "Topic Preferences" section
2. Navigate to the "Generate Digest" page
3. Configure digest parameters (topics, sentiment, etc.)
4. Click "Generate Digest"

### Article Analysis

All collected articles are automatically analyzed for:
- Sentiment (positive, neutral, negative)
- Key entities and topics
- Summarization

### Advanced Search

Use the Advanced Search feature to find articles with filters for:
- Keywords and text
- Sources
- Date range
- Topic
- Sentiment

## Troubleshooting

### Database Issues

If you experience database problems:
```bash
python fix_services.py
```
This will ensure your database has necessary sample data.

### Backend Services

To check the status of backend services:
```bash
python backend/manage_processes.py --status
```

To restart all services:
```bash
python backend/manage_processes.py --restart all
```

### API Keys

For full functionality, you should set up API keys in a `.env` file in the backend directory:

```
NEWS_API_KEY=your_news_api_key
NYTIMES_API_KEY=your_nytimes_api_key
```

You can obtain these keys from:
- [NewsAPI](https://newsapi.org/register)
- [NYTimes API](https://developer.nytimes.com/get-started)

## Customization

### Adding New Topics

You can add new topics through the admin interface or by editing the database directly.

### Styling

The application uses a modern Material UI theme. You can customize it by editing:
```
frontend/src/theme.ts
```

## Contributing

If you'd like to contribute to the project:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License. 