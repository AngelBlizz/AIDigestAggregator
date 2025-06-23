import axios from 'axios';
import { getToken } from '../utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор запросов для добавления токена авторизации
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор ответов для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Аутентификации
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', 
      // Используем URLSearchParams для отправки данных в формате формы вместо JSON
      new URLSearchParams({
        username: credentials.email, // FastAPI OAuth2 ожидает 'username'
        password: credentials.password,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    ),
  register: (userData: { name: string; email: string; password: string }) =>
    api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: { name?: string; email?: string; password?: string }) =>
    api.put('/auth/profile', data),
};

// API Дайджестов
export const digestAPI = {
  getDigests: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/digests', { params }),
  getDigest: (id: number) => api.get(`/digests/${id}`),
  markAsRead: (id: number) => api.patch(`/digests/${id}/read`),
  getDigestStats: () => api.get('/digests/stats'),
  generateDigest: (params?: { 
    topics?: number[]; 
    sources?: string[]; 
    days?: number;
    maxArticles?: number;
    includeSentiment?: boolean;
    includeKeywords?: boolean;
    minSentimentScore?: number;
    maxSentimentScore?: number;
  }) => api.post('/digests/generate', params),
};

// API Тем
export const topicAPI = {
  getTopics: () => api.get('/topics'),
  createTopic: (data: { name: string; description: string; category?: string; tags?: string }) =>
    api.post('/topics', data),
  updateTopic: (id: number, data: { name?: string; description?: string; category?: string; tags?: string }) =>
    api.put(`/topics/${id}`, data),
  deleteTopic: (id: number) => api.delete(`/topics/${id}`),
  toggleTopic: (id: number) => api.patch(`/topics/${id}/toggle`),
};

// API Персональных тем пользователя
export const userTopicAPI = {
  getUserTopics: () => api.get('/user-topics'),
  createUserTopic: (data: { name: string; description: string; keywords?: string; is_active?: boolean }) =>
    api.post('/user-topics', data),
  updateUserTopic: (id: number, data: { name?: string; description?: string; keywords?: string; is_active?: boolean }) =>
    api.put(`/user-topics/${id}`, data),
  deleteUserTopic: (id: number) => api.delete(`/user-topics/${id}`),
  copyFromTopic: (topicId: number) => api.post(`/user-topics/copy-from-topic/${topicId}`),
  copyAllTopics: () => api.post('/user-topics/copy-all-topics'),
};

// API Статей
export const articleAPI = {
  searchArticles: (params?: { 
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
  }) => api.get('/articles', { params }),
  getArticle: (id: number) => api.get(`/articles/${id}`),
  getSources: () => api.get('/articles/sources/list'),
  getEntityTypes: () => api.get('/articles/entity-types/list'),
};

// API Статистики
export const statsAPI = {
  getSentimentStats: () => api.get('/stats/sentiment'),
  getTopicStats: () => api.get('/stats/topics'),
};

// API Аналитики
export const analyticsAPI = {
  getSummary: (days?: number) => api.get('/analytics/summary', { params: { days } }),
  getTopicDistribution: (days?: number) => api.get('/analytics/topic-distribution', { params: { days } }),
  getSentimentOverTime: (params?: { days?: number; interval?: string }) => 
    api.get('/analytics/sentiment-over-time', { params }),
  getSourcesAnalytics: (days?: number) => api.get('/analytics/sources', { params: { days } }),
  exportCSV: (days?: number) => api.get('/analytics/export/csv', { 
    params: { days },
    responseType: 'blob'
  }),
  exportJSON: (days?: number) => api.get('/analytics/export/json', { 
    params: { days },
    responseType: 'blob'
  }),
};

// API Сбора новостей
export const scraperAPI = {
  getSources: () => api.get('/scraper/sources'),
  getSourcesDetails: () => api.get('/scraper/sources/details'),
  runScraper: (topic_id?: number) => api.post('/scraper/run', { topic_id }),
  runUserScraper: (topic_id?: number) => api.post('/scraper/run-user-scraper', { topic_id }),
  runAnalyzer: () => api.post('/scraper/analyze'),
  runTopicModeling: (params?: { topic_id?: number; days?: number; num_topics?: number }) => 
    api.post('/scraper/topic-modeling', null, { params }),
  recategorizeArticles: () => api.post('/scraper/recategorize-articles'),
  detectLanguage: (text: string) => api.get('/scraper/language-detection', { params: { text } }),
};

// API NLP-анализа
export const nlpAPI = {
  getTopicModeling: (params?: { topic_id?: number; days?: number; num_topics?: number }) => 
    api.post('/scraper/topic-modeling', null, { params }),
  detectLanguage: (text: string) => api.get('/scraper/language-detection', { params: { text } }),
};

export default api; 