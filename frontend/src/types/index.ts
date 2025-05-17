// User types
export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// Digest types
export interface Digest {
  id: number;
  title: string;
  summary: string;
  status: 'unread' | 'read';
  created_at: string;
  updated_at: string;
  articles: Article[];
}

export interface Article {
  id: number;
  title: string;
  content: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
  created_at: string;
  keywords: string[];
  entities: Entity[];
  key_phrases: string[];
  sentiment_score: number;
  sentiment_details: SentimentDetails;
  topic_id: number;
}

export interface SentimentDetails {
  polarity: number;
  subjectivity: number;
  positive_sentences: number;
  negative_sentences: number;
  neutral_sentences: number;
  total_sentences: number;
}

export interface Entity {
  name: string;
  type: string;
  count: number;
}

// Topic types
export interface Topic {
  id: number;
  name: string;
  description: string;
  category: string;
  is_selected: boolean;
  created_at: string;
}

// Stats types
export interface DigestStats {
  total_digests: number;
  unread_digests: number;
  total_articles: number;
  topics_count: number;
  recent_digests: Digest[];
}

// Analytics types
export interface AnalyticsSummary {
  total_articles: number;
  total_digests: number;
  avg_sentiment_score: number;
  positive_articles: number;
  negative_articles: number;
  neutral_articles: number;
  most_popular_topics: TopicItem[];
  most_active_sources: SourceItem[];
}

export interface TopicItem {
  name: string;
  count: number;
}

export interface SourceItem {
  name: string;
  count: number;
}

export interface TopicStat {
  id: number;
  name: string;
  category: string;
  article_count: number;
}

export interface TopicDistribution {
  topics: TopicStat[];
}

export interface TimePeriod {
  period: string;
  avg_sentiment: number;
  article_count: number;
}

export interface SentimentAnalytics {
  time_periods: TimePeriod[];
}

export interface SourceStat {
  name: string;
  article_count: number;
  avg_sentiment: number;
}

export interface SourceAnalytics {
  sources: SourceStat[];
}

// Articles Search types
export interface ArticleSearchParams {
  q?: string;
  topic_id?: number;
  topic_ids?: string;
  source?: string;
  sources?: string;
  sentiment?: string;
  min_sentiment?: number;
  max_sentiment?: number;
  keyword?: string;
  entity?: string;
  entity_type?: string;
  days?: number;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  sort_order?: string;
  skip?: number;
  limit?: number;
}

export interface ArticleSearchResult {
  items: Article[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  filters: {
    available_sources: string[];
    available_topics: {id: number; name: string}[];
  };
}

// Scraper types
export interface NewsSource {
  key: string;
  name: string;
  url: string;
  article_selector: string;
  title_selector: string;
  content_selector: string;
  date_selector: string;
  date_format: string;
}

export interface ScraperResponse {
  status: string;
  message: string;
  for_topic_id?: number;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ProfileForm {
  name: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface TopicForm {
  name: string;
  description: string;
  category: string;
} 