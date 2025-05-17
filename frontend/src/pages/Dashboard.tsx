import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
  CircularProgress,
  Divider,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  useTheme,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Bookmark as BookmarkIcon,
  Topic as TopicIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Speed as SpeedIcon,
  MenuBook as MenuBookIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircleOutline as CheckCircleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { RootState } from '../store';
import { fetchDigestsStart, fetchDigestsSuccess, fetchDigestsFailure } from '../store/slices/digestSlice';
import { fetchTopicsStart, fetchTopicsSuccess, fetchTopicsFailure } from '../store/slices/topicSlice';
import { useAppDispatch } from '../hooks';
import { digestAPI, statsAPI, articleAPI, topicAPI } from '../services/api';
import { getTranslation } from '../services/translationService';

// Define analytics data interfaces
interface SentimentStats {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

interface TopicStats {
  topic_id: number;
  topic_name: string;
  article_count: number;
  percentage: number;
}

interface TrendingTopic {
  topic_id: number;
  topic_name: string;
  growth_rate: number;
}

interface Article {
  id: number;
  title: string;
  content: string;
  summary?: string;
  url: string;
  source: string;
  published_at: string;
  sentiment_score?: number;
}

interface ArticleSearchResult {
  items: Article[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  filters: any;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const { digests, loading: digestsLoading, error: digestsError } = useSelector((state: RootState) => state.digest);
  const { topics, loading: topicsLoading, error: topicsError } = useSelector((state: RootState) => state.topic);
  const { language } = useSelector((state: RootState) => state.settings);
  
  const [sentimentStats, setSentimentStats] = useState<SentimentStats | null>(null);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Translate function
  const translate = (text: string): string => {
    return getTranslation(text, language);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch digests
        dispatch(fetchDigestsStart());
        const digestsResponse = await digestAPI.getDigests();
        
        // Убедимся, что каждый дайджест имеет свойство articles, даже если оно пустое
        const digestsWithArticles = digestsResponse.data.map((digest: any) => ({
          ...digest,
          articles: digest.articles || []
        }));
        
        dispatch(fetchDigestsSuccess(digestsWithArticles));

        // Fetch topics
        dispatch(fetchTopicsStart());
        const topicsResponse = await topicAPI.getTopics();
        dispatch(fetchTopicsSuccess(topicsResponse.data));
      } catch (error) {
        dispatch(fetchDigestsFailure('Failed to fetch data'));
        dispatch(fetchTopicsFailure('Failed to fetch data'));
      }
    };

    fetchData();
  }, [dispatch]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setStatsLoading(true);
      setStatsError(null);
      
      try {
        // Fetch sentiment statistics
        const sentimentResponse = await statsAPI.getSentimentStats();
        setSentimentStats(sentimentResponse.data);
        
        // Fetch topic statistics
        const topicStatsResponse = await statsAPI.getTopicStats();
        setTopicStats(topicStatsResponse.data || []);
        
        // Fetch trending topics (this would need to be implemented on backend)
        // Using mock data for now
        setTrendingTopics([
          { topic_id: 1, topic_name: 'Technology', growth_rate: 12.5 },
          { topic_id: 2, topic_name: 'Politics', growth_rate: 8.3 },
          { topic_id: 3, topic_name: 'Health', growth_rate: -4.1 },
        ]);
        
        // Fetch recent articles
        const articlesResponse = await articleAPI.searchArticles({
          limit: 5,
          days: 3,
        });
        
        // Правильно обрабатываем ответ API
        if (articlesResponse.data && typeof articlesResponse.data === 'object') {
          // Если ответ соответствует интерфейсу ArticleSearchResult
          if ('items' in articlesResponse.data) {
            setRecentArticles(articlesResponse.data.items || []);
          } 
          // Если ответ - это непосредственно массив статей
          else if (Array.isArray(articlesResponse.data)) {
            setRecentArticles(articlesResponse.data);
          }
          else {
            setRecentArticles([]);
          }
        } else {
          setRecentArticles([]);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setStatsError('Failed to fetch analytics data');
        setRecentArticles([]);
      } finally {
        setStatsLoading(false);
      }
    };
    
    fetchAnalytics();
  }, []);

  if (digestsLoading || topicsLoading || statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Обезопасим доступ к данным, с которыми будем работать
  const recentDigests = digests && Array.isArray(digests) ? digests.slice(0, 3) : [];
  const unreadDigests = digests && Array.isArray(digests) ? digests.filter(digest => !digest.is_read).length : 0;
  
  // Calculate sentiment percentages
  const getSentimentPercentage = (type: 'positive' | 'neutral' | 'negative') => {
    if (!sentimentStats || sentimentStats.total === 0) return 0;
    return Math.round((sentimentStats[type] / sentimentStats.total) * 100);
  };

  return (
    <Box>
      {/* Modern hero header */}
      <Box 
        sx={{
          borderRadius: 4,
          mb: 4,
          p: 4,
          background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 50%, #10B981 100%)',
          boxShadow: '0 10px 20px rgba(99, 102, 241, 0.15)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            {translate("Welcome to Your Dashboard")}
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 3, opacity: 0.9, maxWidth: '800px' }}>
            {translate("Here's a summary of your content aggregation, digest statistics, and trending topics. Generate new digests or explore recent content.")}
          </Typography>
          
          <Button 
            variant="contained" 
            color="secondary"
            size="large"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => navigate('/digests/create')}
            sx={{ 
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              mr: 2,
              px: 3,
              py: 1.2,
            }}
          >
            {translate("Generate New Digest")}
          </Button>
          <Button 
            variant="outlined" 
            color="inherit"
            size="large"
            onClick={() => navigate('/search')}
            sx={{ 
              borderWidth: 2,
              px: 3,
              py: 1.2,
              '&:hover': { borderWidth: 2 }
            }}
          >
            {translate("Advanced Search")}
          </Button>
        </Box>
      </Box>

      {/* Отображение ошибок загрузки данных */}
      {(digestsError || topicsError || statsError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {digestsError && <div>Error loading digests: {digestsError}</div>}
          {topicsError && <div>Error loading topics: {topicsError}</div>}
          {statsError && <div>Error loading analytics: {statsError}</div>}
        </Alert>
      )}

      {/* Summary stats cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            height: '100%',
            transition: 'transform 0.3s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                  <MenuBookIcon />
                </Avatar>
                <Typography variant="subtitle1" color="text.secondary">
                  {translate("Total Digests")}
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold">
                {digests && Array.isArray(digests) ? digests.length : 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            height: '100%',
            transition: 'transform 0.3s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'info.light', mr: 2 }}>
                  <CheckCircleIcon />
                </Avatar>
                <Typography variant="subtitle1" color="text.secondary">
                  {translate("Unread Digests")}
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold">
                {unreadDigests}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            height: '100%',
            transition: 'transform 0.3s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'secondary.light', mr: 2 }}>
                  <TopicIcon />
                </Avatar>
                <Typography variant="subtitle1" color="text.secondary">
                  {translate("Topic Subscriptions")}
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold">
                {topics && Array.isArray(topics) ? topics.length : 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            height: '100%',
            transition: 'transform 0.3s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'warning.light', mr: 2 }}>
                  <SpeedIcon />
                </Avatar>
                <Typography variant="subtitle1" color="text.secondary">
                  {translate("Articles This Week")}
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold">
                {recentArticles && Array.isArray(recentArticles) && recentArticles.length > 0 ? recentArticles.length : '0'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Sentiment Analysis */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            p: 3, 
            height: '100%',
            transition: 'all 0.3s',
            '&:hover': {
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {translate("Content Sentiment Analysis")}
            </Typography>
            
            {statsError ? (
              <Alert severity="error">{statsError}</Alert>
            ) : !sentimentStats ? (
              <Typography variant="body2" color="text.secondary">{translate("No sentiment data available")}</Typography>
            ) : (
              <Box>
                <Box sx={{ mb: 3, mt: 2 }}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body1" fontWeight={500}>
                      {translate("Positive Content")}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} color="success.main">
                      {`${getSentimentPercentage('positive')}%`}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={getSentimentPercentage('positive')} 
                    color="success"
                    sx={{ height: 12, borderRadius: 6, mb: 3 }}
                  />
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body1" fontWeight={500}>
                      {translate("Neutral Content")}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} color="info.main">
                      {`${getSentimentPercentage('neutral')}%`}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={getSentimentPercentage('neutral')} 
                    color="info"
                    sx={{ height: 12, borderRadius: 6, mb: 3 }}
                  />
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body1" fontWeight={500}>
                      {translate("Negative Content")}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} color="error.main">
                      {`${getSentimentPercentage('negative')}%`}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={getSentimentPercentage('negative')} 
                    color="error"
                    sx={{ height: 12, borderRadius: 6 }}
                  />
                </Box>
                
                <Box sx={{ 
                  mt: 4, 
                  pt: 2, 
                  borderTop: '1px solid',
                  borderColor: 'grey.200',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Chip 
                    label={`${sentimentStats.total} Articles Analyzed`}
                    color="primary" 
                    variant="outlined"
                    sx={{ borderRadius: 3, fontWeight: 500 }}
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Button 
                    variant="text" 
                    color="primary"
                    size="small"
                    onClick={() => navigate('/analytics')}
                  >
                    {translate("View Detailed Analytics")}
                  </Button>
                </Box>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Trending Topics */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            p: 3, 
            height: '100%',
            transition: 'all 0.3s',
            '&:hover': {
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {translate("Trending Topics")}
            </Typography>
            
            {trendingTopics.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{translate("No trending topics available")}</Typography>
            ) : (
              <List sx={{ pt: 1 }}>
                {trendingTopics.map((topic) => (
                  <ListItem 
                    key={topic.topic_id}
                    disablePadding
                    sx={{ 
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'grey.100',
                      backgroundColor: 'grey.50',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {topic.growth_rate > 0 ? (
                        <Avatar sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: 'success.light',
                        }}>
                          <TrendingUpIcon fontSize="small" />
                        </Avatar>
                      ) : (
                        <Avatar sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: 'error.light',
                        }}>
                          <TrendingDownIcon fontSize="small" />
                        </Avatar>
                      )}
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Typography fontWeight={500} variant="body1">{topic.topic_name}</Typography>
                      }
                      secondary={
                        <Typography variant="body2" sx={{ color: topic.growth_rate > 0 ? 'success.main' : 'error.main', fontWeight: 500 }}>
                          {`${topic.growth_rate > 0 ? '+' : ''}${topic.growth_rate}% ${translate("in the last week")}`}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
            
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                size="large"
                onClick={() => navigate('/topics')}
                sx={{ mt: 2 }}
              >
                {translate("Manage Topic Preferences")}
              </Button>
            </Box>
          </Card>
        </Grid>
        
        {/* Topic Distribution */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            p: 3, 
            transition: 'all 0.3s',
            '&:hover': {
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {translate("Content Distribution by Topic")}
            </Typography>
            
            {topicStats.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{translate("No topic distribution data available")}</Typography>
            ) : (
              <Grid container spacing={3} sx={{ mt: 1 }}>
                {topicStats.slice(0, 6).map((stat) => (
                  <Grid item xs={12} sm={6} key={stat.topic_id}>
                    <Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body1" fontWeight={500}>{stat.topic_name}</Typography>
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>{stat.percentage}%</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={stat.percentage} 
                        sx={{ 
                          height: 10, 
                          borderRadius: 5, 
                          mt: 1,
                          mb: 2,
                          background: theme.palette.grey[100],
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </Card>
        </Grid>

        {/* Recent Digests */}
        <Grid item xs={12}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2,
            mt: 4,
          }}>
            <Typography variant="h5" fontWeight="bold">
              {translate("Recent Digests")}
            </Typography>
            <Button 
              variant="outlined"
              color="primary"
              endIcon={<AddIcon />}
              onClick={() => navigate('/digests/create')}
            >
              {translate("Create New")}
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            {recentDigests.length === 0 ? (
              <Grid item xs={12}>
                <Card elevation={0} sx={{ 
                  borderRadius: 4, 
                  border: '1px solid',
                  borderColor: 'grey.200',
                  p: 4, 
                  textAlign: 'center',
                  minHeight: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Typography variant="h6" gutterBottom color="text.secondary">
                    {translate("No digests available yet")}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500 }}>
                    {translate("Create your first AI-powered content digest to get started. You can select topics, choose sources, and customize settings.")}
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => navigate('/digests/create')}
                  >
                    {translate("Generate Your First Digest")}
                  </Button>
                </Card>
              </Grid>
            ) : (
              recentDigests.map((digest) => (
                <Grid item xs={12} md={4} key={digest.id}>
                  <Card sx={{ 
                    borderRadius: 4, 
                    overflow: 'hidden',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <Box sx={{ 
                      height: 8, 
                      bgcolor: digest.is_read ? 'success.main' : 'primary.main' 
                    }} />
                    <CardContent sx={{ p: 3, flexGrow: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="overline" color="text.secondary">
                          {format(new Date(digest.created_at), 'MMM d, yyyy')}
                        </Typography>
                        <Chip 
                          size="small" 
                          label={digest.is_read ? translate('Read') : translate('Unread')} 
                          color={digest.is_read ? 'success' : 'primary'} 
                          variant="outlined"
                          sx={{ borderRadius: 3, fontWeight: 500 }}
                        />
                      </Box>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                        {digest.title}
                      </Typography>
                      
                      <Box 
                        display="flex" 
                        alignItems="center" 
                        sx={{ 
                          px: 2, 
                          py: 1, 
                          bgcolor: 'grey.50',
                          borderRadius: 2
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {translate("Articles")}:
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" sx={{ ml: 1 }}>
                          {digest.articles && digest.articles.length ? digest.articles.length : 0}
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        color="primary"
                        onClick={() => navigate(`/digests/${digest.id}`)}
                      >
                        {translate("View Digest")}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </Grid>
        
        {/* Recent Articles */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{ 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'grey.200',
            p: 3, 
            mt: 4,
            transition: 'all 0.3s',
            '&:hover': {
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
            }
          }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {translate("Recent Articles")}
            </Typography>
            
            {recentArticles.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                {translate("No recent articles available")}
              </Typography>
            ) : (
              <List sx={{ py: 0 }}>
                {recentArticles.map((article) => (
                  <React.Fragment key={article.id}>
                    <ListItem 
                      alignItems="flex-start" 
                      sx={{ 
                        px: 2, 
                        py: 2,
                        borderRadius: 2,
                        '&:hover': { bgcolor: 'grey.50' },
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/articles/${article.id}`)}
                    >
                      <ListItemIcon sx={{ mt: 1 }}>
                        {article.sentiment_score && article.sentiment_score > 0.2 ? (
                          <Avatar sx={{ bgcolor: 'success.light' }}>
                            <ThumbUpIcon fontSize="small" />
                          </Avatar>
                        ) : article.sentiment_score && article.sentiment_score < -0.2 ? (
                          <Avatar sx={{ bgcolor: 'error.light' }}>
                            <ThumbDownIcon fontSize="small" />
                          </Avatar>
                        ) : (
                          <Avatar sx={{ bgcolor: 'info.light' }}>
                            <BookmarkIcon fontSize="small" />
                          </Avatar>
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" fontWeight={500}>
                            {article.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Box display="flex" alignItems="center" sx={{ mb: 0.5, mt: 0.5 }}>
                              <Chip 
                                size="small" 
                                label={article.source || translate('Unknown')} 
                                sx={{ 
                                  height: 24, 
                                  borderRadius: 3, 
                                  mr: 1,
                                  bgcolor: 'grey.100',
                                }} 
                              />
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(article.published_at), 'MMM d, yyyy')}
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {article.summary ? article.summary.substring(0, 120) + '...' : translate('No summary available')}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider component="li" variant="inset" sx={{ ml: 7 }} />
                  </React.Fragment>
                ))}
              </List>
            )}
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/search')}
              >
                {translate("Advanced Search")}
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 