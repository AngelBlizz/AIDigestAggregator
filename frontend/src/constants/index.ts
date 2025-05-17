// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PROFILE: '/auth/profile',
  },
  DIGESTS: {
    LIST: '/digests',
    DETAIL: (id: number) => `/digests/${id}`,
    MARK_AS_READ: (id: number) => `/digests/${id}/read`,
    STATS: '/digests/stats',
  },
  TOPICS: {
    LIST: '/topics',
    DETAIL: (id: number) => `/topics/${id}`,
    TOGGLE: (id: number) => `/topics/${id}/toggle`,
  },
};

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  DIGESTS: '/digests',
  DIGEST_DETAIL: (id: number) => `/digests/${id}`,
  TOPICS: '/topics',
  PROFILE: '/profile',
  NOT_FOUND: '*',
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50],
};

// Form validation
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 500,
};

// Status
export const STATUS = {
  UNREAD: 'unread',
  READ: 'read',
} as const;

// Sentiment
export const SENTIMENT = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
};

// Error messages
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters long',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  INVALID_CREDENTIALS: 'Invalid email or password',
  SERVER_ERROR: 'An error occurred on the server',
  NETWORK_ERROR: 'Network error. Please check your connection',
};

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in',
  REGISTER_SUCCESS: 'Successfully registered',
  PROFILE_UPDATE_SUCCESS: 'Profile updated successfully',
  DIGEST_MARKED_AS_READ: 'Digest marked as read',
  TOPIC_CREATED: 'Topic created successfully',
  TOPIC_UPDATED: 'Topic updated successfully',
  TOPIC_DELETED: 'Topic deleted successfully',
  TOPIC_TOGGLED: 'Topic preference updated',
}; 