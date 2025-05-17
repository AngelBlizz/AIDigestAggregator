import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  Chip,
  Divider,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Breadcrumbs,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ShareIcon from '@mui/icons-material/Share';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ArticleIcon from '@mui/icons-material/Article';
import { articleAPI } from '../services/api';
import { Article, Entity } from '../types';

const ArticleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (id) {
      loadArticle(parseInt(id));
    }
  }, [id]);
  
  const loadArticle = async (articleId: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await articleAPI.getArticle(articleId);
      setArticle(response.data);
    } catch (err) {
      console.error('Error loading article:', err);
      setError('Failed to load article details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Format sentiment score for display
  const formatSentiment = (score: number) => {
    if (score > 0.5) return { text: 'Very Positive', color: '#2e7d32' };
    if (score > 0.2) return { text: 'Positive', color: '#4caf50' };
    if (score > -0.2) return { text: 'Neutral', color: '#ffc107' };
    if (score > -0.5) return { text: 'Negative', color: '#f44336' };
    return { text: 'Very Negative', color: '#b71c1c' };
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  // Group entities by type
  const groupEntitiesByType = (entities: Entity[]): Record<string, Entity[]> => {
    return entities.reduce((groups, entity) => {
      const type = entity.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(entity);
      return groups;
    }, {} as Record<string, Entity[]>);
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error || !article) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" color="error" gutterBottom>
              {error || 'Article not found'}
            </Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              sx={{ mt: 2 }}
            >
              Go Back
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }
  
  const entityGroups = groupEntitiesByType(article.entities);
  const sentimentInfo = formatSentiment(article.sentiment_score);

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link 
            component="button"
            underline="hover" 
            color="inherit" 
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Link>
          <Link 
            component="button"
            underline="hover" 
            color="inherit" 
            onClick={() => navigate('/search')}
          >
            Search
          </Link>
          <Typography color="text.primary">Article</Typography>
        </Breadcrumbs>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<BookmarkIcon />}
              sx={{ mr: 1 }}
            >
              Save
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<ShareIcon />}
            >
              Share
            </Button>
          </Box>
        </Box>
        
        <Paper sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="textSecondary">
                  {article.source} • {formatDate(article.published_at)}
                </Typography>
                <Chip 
                  label={sentimentInfo.text} 
                  sx={{ backgroundColor: sentimentInfo.color, color: 'white' }}
                  size="small"
                />
              </Box>
              <Typography variant="h4" gutterBottom>
                {article.title}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {article.keywords.map((keyword, idx) => (
                  <Chip 
                    key={idx} 
                    label={keyword} 
                    size="small" 
                    variant="outlined" 
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            Summary
          </Typography>
          <Typography variant="body1" paragraph sx={{ fontStyle: 'italic', mb: 3 }}>
            {article.summary}
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            Content
          </Typography>
          <Typography variant="body1" paragraph sx={{ mb: 3, whiteSpace: 'pre-line' }}>
            {article.content}
          </Typography>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<OpenInNewIcon />}
              href={article.url}
              target="_blank"
              rel="noopener"
            >
              Read Original Article
            </Button>
          </Box>
        </Paper>
        
        <Grid container spacing={3}>
          {/* Entity Analysis */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                <ArticleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Entity Analysis
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {Object.keys(entityGroups).length > 0 ? (
                Object.entries(entityGroups).map(([type, entities]) => (
                  <Box key={type} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {type}s
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {entities.map((entity, idx) => (
                        <Chip 
                          key={idx} 
                          label={`${entity.name} (${entity.count})`} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No entities detected in this article.
                </Typography>
              )}
            </Paper>
          </Grid>
          
          {/* Sentiment Analysis */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Sentiment Analysis
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Overall Sentiment
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h4">
                      {article.sentiment_score.toFixed(2)}
                    </Typography>
                    <Chip 
                      label={sentimentInfo.text} 
                      sx={{ backgroundColor: sentimentInfo.color, color: 'white' }}
                    />
                  </Box>
                </CardContent>
              </Card>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                        Polarity
                      </Typography>
                      <Typography variant="h5">
                        {article.sentiment_details.polarity.toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                        Subjectivity
                      </Typography>
                      <Typography variant="h5">
                        {article.sentiment_details.subjectivity.toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Sentence Analysis
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Card sx={{ bgcolor: '#4caf50', color: 'white', textAlign: 'center' }}>
                      <CardContent>
                        <Typography variant="h5">
                          {article.sentiment_details.positive_sentences}
                        </Typography>
                        <Typography variant="body2">
                          Positive
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={4}>
                    <Card sx={{ bgcolor: '#ffc107', color: 'white', textAlign: 'center' }}>
                      <CardContent>
                        <Typography variant="h5">
                          {article.sentiment_details.neutral_sentences}
                        </Typography>
                        <Typography variant="body2">
                          Neutral
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={4}>
                    <Card sx={{ bgcolor: '#f44336', color: 'white', textAlign: 'center' }}>
                      <CardContent>
                        <Typography variant="h5">
                          {article.sentiment_details.negative_sentences}
                        </Typography>
                        <Typography variant="body2">
                          Negative
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ArticleDetail; 