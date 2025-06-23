import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Link,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
} from '@mui/material';
import { 
  ThumbUp as ThumbUpIcon, 
  ThumbDown as ThumbDownIcon,
  BookmarkBorder as BookmarkIcon,
  Bookmark as BookmarkFilledIcon,
  Share as ShareIcon,
  ArrowBack as BackIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Language as LanguageIcon,
  EmojiObjects as InsightIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { RootState } from '../store';
import {
  fetchDigestDetailStart,
  fetchDigestDetailSuccess,
  fetchDigestDetailFailure,
  markDigestAsRead,
} from '../store/slices/digestSlice';
import { digestAPI } from '../services/api';
import { useAppDispatch } from '../hooks';
import { useSelector } from 'react-redux';

// Enum for sentiment types
enum SentimentType {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
}

// Function to determine sentiment type based on sentiment score
const getSentimentType = (score: number): SentimentType => {
  if (score > 0.2) return SentimentType.POSITIVE;
  if (score < -0.2) return SentimentType.NEGATIVE;
  return SentimentType.NEUTRAL;
};

// Get sentiment color based on sentiment type
const getSentimentColor = (sentiment: SentimentType) => {
  switch (sentiment) {
    case SentimentType.POSITIVE:
      return 'success';
    case SentimentType.NEGATIVE:
      return 'error';
    default:
      return 'default';
  }
};

interface Article {
  id: number;
  title: string;
  content: string;
  summary?: string;
  url: string;
  source: string;
  published_at: string;
  sentiment_score?: number;
  keywords?: string[];
  entities?: {
    name: string;
    type: string;
    count: number;
  }[];
  key_phrases?: string[];
}

interface ArticleAnalysisProps {
  article: Article;
}

// New ArticleAnalysis component that shows detailed analysis of an article
const ArticleAnalysis: React.FC<ArticleAnalysisProps> = ({ article }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>Content Analysis</Typography>
      
      {/* Sentiment Analysis */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom>Sentiment Analysis</Typography>
        {article.sentiment_score !== undefined ? (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">Negative</Typography>
              <Typography variant="body2">Neutral</Typography>
              <Typography variant="body2">Positive</Typography>
            </Box>
            <Box position="relative" width="100%" height={30} mb={1} sx={{ background: '#f0f0f0', borderRadius: 1 }}>
              <Box 
                position="absolute" 
                height="100%" 
                sx={{
                  left: '50%',
                  width: '4px',
                  bgcolor: 'divider',
                  transform: 'translateX(-50%)',
                }}
              />
              <Tooltip 
                title={`Sentiment score: ${article.sentiment_score.toFixed(2)}`} 
                arrow
                placement="top"
              >
                <Box 
                  position="absolute" 
                  height="100%" 
                  width="10px"
                  sx={{
                    left: `${(article.sentiment_score + 1) * 50}%`,
                    transform: 'translateX(-50%)',
                    bgcolor: article.sentiment_score > 0.2 ? 'success.main' : article.sentiment_score < -0.2 ? 'error.main' : 'warning.main',
                    borderRadius: 1,
                  }}
                />
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" align="center">
              This article has a {
                article.sentiment_score > 0.2 ? 'positive' : 
                article.sentiment_score < -0.2 ? 'negative' : 'neutral'
              } tone.
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No sentiment analysis available for this article.
          </Typography>
        )}
      </Box>
      
      {/* Key Entities */}
      {article.entities && article.entities.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom>Key Entities</Typography>
          <Grid container spacing={1}>
            {article.entities.slice(0, 8).map((entity, index) => (
              <Grid item key={index}>
                <Chip 
                  label={entity.name} 
                  size="small" 
                  color={entity.type === 'PERSON' ? 'primary' : entity.type === 'ORGANIZATION' ? 'secondary' : 'default'}
                  variant="outlined"
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      
      {/* Keywords */}
      {article.keywords && article.keywords.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom>Keywords</Typography>
          <Grid container spacing={1}>
            {article.keywords.slice(0, 10).map((keyword, index) => (
              <Grid item key={index}>
                <Chip label={keyword} size="small" />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      
      {/* Key Insights */}
      {article.key_phrases && article.key_phrases.length > 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>Key Insights</Typography>
          <List dense>
            {article.key_phrases.slice(0, 3).map((phrase, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <InsightIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={phrase} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

const DigestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentDigest: digest, loading: loadingState, error: errorState } = useSelector((state: RootState) => state.digest);
  const [loading, setLoading] = useState(loadingState);
  const [error, setError] = useState<string | null>(errorState);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [savedArticles, setSavedArticles] = useState<number[]>([]);
  const [expandedArticles, setExpandedArticles] = useState<number[]>([]);

  useEffect(() => {
    const fetchDigest = async () => {
      if (!id) return;
      
      dispatch(fetchDigestDetailStart());
      setLoading(true);
      setError(null);
      
      try {
        const response = await digestAPI.getDigest(Number(id));
        
        if (response && response.data) {
          dispatch(fetchDigestDetailSuccess(response.data));
          
          // Проверяем наличие статей в дайджесте
          if (!response.data.articles || response.data.articles.length === 0) {
            console.warn("Digest has no articles");
            setError("Этот дайджест не содержит статей");
          }
        } else {
          console.error("Failed to fetch digest: No data received");
          setError("Не удалось загрузить данные дайджеста");
          dispatch(fetchDigestDetailFailure("Failed to fetch digest"));
        }
      } catch (err) {
        console.error("Error fetching digest:", err);
        setError("Ошибка при загрузке дайджеста. Пожалуйста, попробуйте позже.");
        dispatch(fetchDigestDetailFailure("Error fetching digest"));
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDigest();
    }
  }, [id, dispatch]);

  const handleMarkAsRead = async () => {
    if (!digest) return;

    try {
      await digestAPI.markAsRead(digest.id);
      dispatch(markDigestAsRead(digest.id));
      showSnackbar('Digest marked as read');
    } catch (error) {
      console.error('Failed to mark digest as read:', error);
    }
  };

  const handleSaveArticle = (articleId: number) => {
    // In a real app, you would save this to the backend
    if (savedArticles.includes(articleId)) {
      setSavedArticles(savedArticles.filter(id => id !== articleId));
      showSnackbar('Article removed from bookmarks');
    } else {
      setSavedArticles([...savedArticles, articleId]);
      showSnackbar('Article saved to bookmarks');
    }
  };

  const toggleArticleExpand = (articleId: number) => {
    if (expandedArticles.includes(articleId)) {
      setExpandedArticles(expandedArticles.filter(id => id !== articleId));
    } else {
      setExpandedArticles([...expandedArticles, articleId]);
    }
  };

  const handleShareDigest = () => {
    // In a real app, you would implement sharing functionality
    if (navigator.share) {
      navigator.share({
        title: digest?.title || 'AI Digest',
        text: 'Check out this interesting news digest!',
        url: window.location.href,
      }).then(() => {
        showSnackbar('Shared successfully');
      }).catch((error) => {
        console.error('Error sharing', error);
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      showSnackbar('Link copied to clipboard');
    }
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!digest) {
    return (
      <Box mt={3}>
        <Alert severity="warning">Digest not found</Alert>
      </Box>
    );
  }

  const getDigestSentimentOverview = () => {
    if (!digest.articles || digest.articles.length === 0) return null;
    
    const articlesWithSentiment = digest.articles.filter(a => a.sentiment_score !== undefined);
    if (articlesWithSentiment.length === 0) return null;
    
    const positive = articlesWithSentiment.filter(a => (a.sentiment_score || 0) > 0.2).length;
    const negative = articlesWithSentiment.filter(a => (a.sentiment_score || 0) < -0.2).length;
    const neutral = articlesWithSentiment.length - positive - negative;
    
    const total = articlesWithSentiment.length;
    
    return {
      positive: Math.round((positive / total) * 100),
      negative: Math.round((negative / total) * 100),
      neutral: Math.round((neutral / total) * 100),
    };
  };

  const sentimentOverview = getDigestSentimentOverview();

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/digests')}
        sx={{ mb: 3 }}
      >
        Back to Digests
      </Button>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          {digest.title}
        </Typography>
        <Box>
          <Tooltip title="Share Digest">
            <IconButton onClick={handleShareDigest} color="primary">
              <ShareIcon />
            </IconButton>
          </Tooltip>
          {!digest.is_read && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleMarkAsRead}
              startIcon={<CheckIcon />}
            >
              Mark as Read
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Created:</strong> {format(new Date(digest.created_at), 'PPP')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Status:</strong> {' '}
                <Chip 
                  size="small" 
                  label={digest.is_read ? 'Read' : 'Unread'} 
                  color={digest.is_read ? 'success' : 'primary'} 
                />
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Articles:</strong> {digest.articles.length}
              </Typography>
              
              {sentimentOverview && (
                <Box display="flex" alignItems="center" mt={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                    <strong>Sentiment:</strong>
                  </Typography>
                  <Tooltip title={`Positive: ${sentimentOverview.positive}%`}>
                    <Box sx={{ 
                      width: sentimentOverview.positive > 0 ? `${sentimentOverview.positive}px` : '5px', 
                      height: '12px', 
                      bgcolor: 'success.main', 
                      borderRadius: '3px 0 0 3px',
                    }} />
                  </Tooltip>
                  <Tooltip title={`Neutral: ${sentimentOverview.neutral}%`}>
                    <Box sx={{ 
                      width: sentimentOverview.neutral > 0 ? `${sentimentOverview.neutral}px` : '5px', 
                      height: '12px', 
                      bgcolor: 'info.main'
                    }} />
                  </Tooltip>
                  <Tooltip title={`Negative: ${sentimentOverview.negative}%`}>
                    <Box sx={{ 
                      width: sentimentOverview.negative > 0 ? `${sentimentOverview.negative}px` : '5px',
                      height: '12px', 
                      bgcolor: 'error.main',
                      borderRadius: '0 3px 3px 0',
                    }} />
                  </Tooltip>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Check for articles */}
      {!digest.articles || digest.articles.length === 0 ? (
        <Alert severity="info" sx={{ mt: 3 }}>
          Этот дайджест не содержит статей. Возможно, скрапер не смог найти подходящие статьи или произошла ошибка при обработке.
        </Alert>
      ) : (
        <>
          <Typography variant="h5" gutterBottom>
            Articles
          </Typography>

          {digest.articles.map((article, index) => (
            <Card key={article.id} sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {article.title}
                </Typography>
                
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  <Chip 
                    size="small" 
                    icon={<LanguageIcon fontSize="small" />}
                    label={`Source: ${article.source}`} 
                    variant="outlined" 
                  />
                  
                  {article.sentiment_score !== undefined && (
                    <Chip 
                      size="small" 
                      icon={article.sentiment_score > 0 ? <ThumbUpIcon /> : article.sentiment_score < 0 ? <ThumbDownIcon /> : undefined}
                      label={getSentimentType(article.sentiment_score)}
                      color={getSentimentColor(getSentimentType(article.sentiment_score))}
                    />
                  )}
                  
                  <Chip 
                    size="small" 
                    icon={<TimeIcon fontSize="small" />}
                    label={`Published: ${format(new Date(article.published_at), 'PPP')}`}
                    variant="outlined"
                  />
                </Box>
                
                {article.summary && (
                  <Typography variant="body1" paragraph>
                    {article.summary}
                  </Typography>
                )}
                
                {/* Article content is now in a collapsible section */}
                <Collapse in={expandedArticles.includes(article.id)}>
                  <Box mb={3}>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {article.content}
                    </Typography>
                  </Box>
                  
                  {/* Article analytics */}
                  <Box mb={2}>
                    <Divider sx={{ my: 2 }} />
                    <ArticleAnalysis article={article} />
                  </Box>
                </Collapse>
                
              </CardContent>
              
              <CardActions>
                <Button 
                  size="small" 
                  component={Link} 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  color="primary"
                  sx={{ mr: 1 }}
                >
                  Read Full Article
                </Button>
                
                <IconButton 
                  size="small"
                  aria-label={expandedArticles.includes(article.id) ? 'show less' : 'show more'}
                  onClick={() => toggleArticleExpand(article.id)}
                >
                  {expandedArticles.includes(article.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                
                <IconButton 
                  size="small" 
                  onClick={() => handleSaveArticle(article.id)}
                  color={savedArticles.includes(article.id) ? "success" : "default"}
                  aria-label={savedArticles.includes(article.id) ? 'remove from bookmarks' : 'add to bookmarks'}
                  sx={{ ml: 'auto' }}
                >
                  {savedArticles.includes(article.id) ? <BookmarkFilledIcon /> : <BookmarkIcon />}
                </IconButton>
              </CardActions>
            </Card>
          ))}
        </>
      )}
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default DigestDetail; 