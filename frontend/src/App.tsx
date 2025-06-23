import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';

// Components
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DigestList from './pages/DigestList';
import DigestDetail from './pages/DigestDetail';
import UserTopics from './pages/UserTopics';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import Analytics from './pages/Analytics';
import AdvancedSearch from './pages/AdvancedSearch';
import ScraperManager from './pages/ScraperManager';
import ArticleDetail from './pages/ArticleDetail';
import DigestGenerator from './pages/DigestGenerator';
import NLPAnalytics from './pages/NLPAnalytics';

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            {/* Public routes with PublicLayout */}
            <Route element={<PublicLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            
            {/* Protected routes - all wrapped in Layout */}
            <Route 
              path="/" 
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              {/* Default redirect to dashboard */}
              <Route index element={<Dashboard />} />
              
              {/* Main navigation routes */}
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Digest routes */}
              <Route path="digests">
                <Route index element={<DigestList />} />
                <Route path="create" element={<DigestGenerator />} />
                <Route path=":id" element={<DigestDetail />} />
              </Route>
              
              {/* Search route */}
              <Route path="search" element={<AdvancedSearch />} />
              
              {/* Topics route */}
              <Route path="topics" element={<UserTopics />} />
              
              {/* Analytics route */}
              <Route path="analytics" element={<Analytics />} />
              
              {/* NLP Analytics route */}
              <Route path="nlp-analytics" element={<NLPAnalytics />} />
              
              {/* Scraper management route */}
              <Route path="scraper" element={<ScraperManager />} />
              
              {/* Article details route */}
              <Route path="articles/:id" element={<ArticleDetail />} />
              
              {/* User profile route */}
              <Route path="profile" element={<Profile />} />
            </Route>
            
            {/* Fallback route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 