import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authAPI } from '../services/api';
import { setToken, removeToken } from '../utils';
import { ROUTES } from '../constants';
import { AppDispatch } from '../store';

// Typed dispatch hook
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Custom hook for handling authentication
export const useAuth = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data;
      setToken(token);
      dispatch({ type: 'auth/loginSuccess', payload: user });
      navigate(ROUTES.DASHBOARD);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [dispatch, navigate]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.register({ name, email, password });
      const { token, user } = response.data;
      setToken(token);
      dispatch({ type: 'auth/registerSuccess', payload: user });
      navigate(ROUTES.DASHBOARD);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }, [dispatch, navigate]);

  const logout = useCallback(() => {
    removeToken();
    dispatch({ type: 'auth/logout' });
    navigate(ROUTES.LOGIN);
  }, [dispatch, navigate]);

  return {
    login,
    register,
    logout,
    loading,
    error,
  };
};

// Custom hook for handling form state
export const useForm = <T extends Record<string, any>>(initialState: T) => {
  const [values, setValues] = useState<T>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const setFieldValue = (name: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const setFieldError = (name: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const resetForm = () => {
    setValues(initialState);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    resetForm,
  };
};

// Custom hook for handling API requests
export const useApi = <T>(
  apiFunction: (...args: any[]) => Promise<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: any) => void
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: any[]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFunction(...args);
      setData(response);
      onSuccess?.(response);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'An error occurred';
      setError(errorMessage);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [apiFunction, onSuccess, onError]);

  return {
    data,
    loading,
    error,
    execute,
  };
};

// Custom hook for handling pagination
export const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const setTotalItems = (totalItems: number) => {
    setTotal(totalItems);
  };

  return {
    page,
    limit,
    total,
    handlePageChange,
    handleLimitChange,
    setTotalItems,
  };
}; 