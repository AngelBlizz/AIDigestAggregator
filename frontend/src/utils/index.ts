import { format, formatDistanceToNow } from 'date-fns';

// Форматирование даты
export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date: string | Date): string => {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};

export const formatTimeAgo = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

// Форматирование строк
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// Форматирование массивов
export const formatKeywords = (keywords: string[]): string => {
  return keywords.join(', ');
};

// Форматирование URL
export const formatUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

// Форматирование эмоциональной окраски
export const getSentimentColor = (sentiment: 'positive' | 'neutral' | 'negative'): string => {
  switch (sentiment) {
    case 'positive':
      return '#2e7d32';
    case 'neutral':
      return '#ed6c02';
    case 'negative':
      return '#d32f2f';
    default:
      return '#757575';
  }
};

// Форматирование статуса
export const getStatusColor = (status: 'unread' | 'read'): string => {
  switch (status) {
    case 'unread':
      return '#1976d2';
    case 'read':
      return '#757575';
    default:
      return '#757575';
  }
};

// Валидация
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

// Хранилище
export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

export const removeToken = (): void => {
  localStorage.removeItem('token');
};

// Обработка ошибок
export const getErrorMessage = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An error occurred';
}; 