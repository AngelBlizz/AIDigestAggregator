import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Divider,
  Slider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Pagination,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ArticleIcon from '@mui/icons-material/Article';
import SortIcon from '@mui/icons-material/Sort';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { articleAPI, topicAPI } from '../services/api';
import { ArticleSearchParams, Article, Topic } from '../types';
import { getTranslation } from '../services/translationService';
import { RootState } from '../store';

const AdvancedSearch: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { language } = useSelector((state: RootState) => state.settings);
  
  // Translate function
  const translate = (text: string): string => {
    return getTranslation(text, language);
  };
  
  // State for search parameters
  const [searchParams, setSearchParams] = useState<ArticleSearchParams>({
    q: '',
    limit: 10,
    skip: 0,
    sort_by: 'published_at',
    sort_order: 'desc',
    days: 30
  });
  
  // State for results
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalArticles, setTotalArticles] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ days: number | null; start_date: string; end_date: string }>({
    days: 30,
    start_date: '',
    end_date: '',
  });
  const [sentimentRange, setSentimentRange] = useState<[number, number]>([-1, 1]);
  const [showFilters, setShowFilters] = useState<boolean>(true);
  
  useEffect(() => {
    // Load topics, sources, and entity types when component mounts
    const fetchFilters = async () => {
      try {
        const [topicsRes, sourcesRes, entityTypesRes] = await Promise.all([
          topicAPI.getTopics(),
          articleAPI.getSources(),
          articleAPI.getEntityTypes()
        ]);
        
        setTopics(topicsRes.data || []);
        setSources(sourcesRes.data || []);
        setEntityTypes(entityTypesRes.data || []);
      } catch (err) {
        console.error('Error loading filter options:', err);
        setError('Failed to load filter options');
      }
    };
    
    fetchFilters();
    
    // Initial search with a delay to allow filters to load
    setTimeout(() => {
      handleSearch();
    }, 500);
  }, []);
  
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Prepare search parameters
      const params: ArticleSearchParams = {
        ...searchParams
      };
      
      // Add topics if selected
      if (selectedTopics.length > 0) {
        params.topic_ids = selectedTopics.join(',');
      }
      
      // Add sources if selected
      if (selectedSources.length > 0) {
        params.sources = selectedSources.join(',');
      }
      
      // Add date filters
      if (dateRange.days) {
        params.days = dateRange.days;
      } else if (dateRange.start_date && dateRange.end_date) {
        params.start_date = dateRange.start_date;
        params.end_date = dateRange.end_date;
      }
      
      // Add sentiment range
      if (sentimentRange[0] !== -1 || sentimentRange[1] !== 1) {
        params.min_sentiment = sentimentRange[0];
        params.max_sentiment = sentimentRange[1];
      }
      
      console.log('Search parameters:', params);
      
      // Perform search
      const response = await articleAPI.searchArticles(params);
      console.log('Search response:', response);
      
      // Handle different response structures
      if (response.data && typeof response.data === 'object') {
        // Handle response that matches ArticleSearchResult interface
        if ('items' in response.data) {
          setArticles(response.data.items || []);
          setTotalArticles(response.data.total || 0);
        } 
        // Handle response that is an array of Articles
        else if (Array.isArray(response.data)) {
          setArticles(response.data);
          setTotalArticles(response.data.length);
        }
        // Unknown response format
        else {
          setArticles([]);
          setTotalArticles(0);
          setError('Unexpected response format');
        }
      } else {
        setArticles([]);
        setTotalArticles(0);
        setError('No results found');
      }
    } catch (error) {
      console.error('Error searching articles:', error);
      setError('Error occurred while searching articles');
      setArticles([]);
      setTotalArticles(0);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Perform search when page changes
    if (currentPage > 0) {
      setSearchParams(prev => ({
        ...prev,
        skip: (currentPage - 1) * (prev.limit || 10)
      }));
      handleSearch();
    }
  }, [currentPage]);
  
  const handleClearFilters = () => {
    setSearchParams({
      q: searchParams.q,
      limit: 10,
      skip: 0,
      sort_by: 'published_at',
      sort_order: 'desc',
      days: 30
    });
    setSelectedTopics([]);
    setSelectedSources([]);
    setDateRange({
      days: 30,
      start_date: '',
      end_date: '',
    });
    setSentimentRange([-1, 1]);
    setCurrentPage(1);
  };
  
  const handleTopicToggle = (topicId: number) => {
    setSelectedTopics(topics => {
      if (topics.includes(topicId)) {
        return topics.filter(id => id !== topicId);
      } else {
        return [...topics, topicId];
      }
    });
  };
  
  const handleSourceToggle = (source: string) => {
    setSelectedSources(sources => {
      if (sources.includes(source)) {
        return sources.filter(s => s !== source);
      } else {
        return [...sources, source];
      }
    });
  };
  
  const handleSentimentChange = (event: Event, newValue: number | number[]) => {
    setSentimentRange(newValue as [number, number]);
  };
  
  const handleViewArticle = (articleId: number) => {
    // Navigate to article detail page
    navigate(`/articles/${articleId}`);
  };
  
  // Format sentiment score for display
  const formatSentiment = (score: number) => {
    if (score > 0.5) return { text: translate('Very Positive'), color: '#2e7d32' };
    if (score > 0.2) return { text: translate('Positive'), color: '#4caf50' };
    if (score > -0.2) return { text: translate('Neutral'), color: '#ffc107' };
    if (score > -0.5) return { text: translate('Negative'), color: '#f44336' };
    return { text: translate('Very Negative'), color: '#b71c1c' };
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <Container maxWidth="xl">
      <Box 
        sx={{ 
          my: 4,
          p: 3,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
          boxShadow: '0 10px 15px rgba(59, 130, 246, 0.1)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          mb: 4
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
            {translate("Advanced Search")}
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 3, opacity: 0.9, maxWidth: '800px' }}>
            {translate("Search through all articles with powerful filters by topics, sources, date ranges and sentiment analysis.")}
          </Typography>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
        
      <Card elevation={0} sx={{ 
        borderRadius: 4, 
        border: '1px solid',
        borderColor: 'grey.200',
        mb: 3
      }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label={translate("Search")}
                variant="outlined"
                value={searchParams.q}
                onChange={(e) => setSearchParams({ ...searchParams, q: e.target.value })}
                InputProps={{
                  endAdornment: searchParams.q ? (
                    <IconButton size="small" onClick={() => setSearchParams({ ...searchParams, q: '' })}>
                      <ClearIcon />
                    </IconButton>
                  ) : null,
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>{translate("Sort By")}</InputLabel>
                <Select
                  value={searchParams.sort_by || 'published_at'}
                  label={translate("Sort By")}
                  onChange={(e) => setSearchParams({ ...searchParams, sort_by: e.target.value })}
                  startAdornment={<SortIcon sx={{ mr: 1 }} />}
                >
                  <MenuItem value="published_at">{translate("Date Published")}</MenuItem>
                  <MenuItem value="title">{translate("Title")}</MenuItem>
                  <MenuItem value="sentiment_score">{translate("Sentiment Score")}</MenuItem>
                  <MenuItem value="source">{translate("Source")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>{translate("Sort Order")}</InputLabel>
                <Select
                  value={searchParams.sort_order || 'desc'}
                  label={translate("Sort Order")}
                  onChange={(e) => setSearchParams({ ...searchParams, sort_order: e.target.value })}
                >
                  <MenuItem value="desc">{translate("Descending")}</MenuItem>
                  <MenuItem value="asc">{translate("Ascending")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <Button 
                fullWidth 
                variant="contained" 
                color="primary" 
                onClick={handleSearch}
                startIcon={<SearchIcon />}
                disabled={loading}
                sx={{ py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : translate("Search")}
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                  color="primary"
                >
                  {showFilters ? translate("Hide Filters") : translate("Show Filters")}
                </Button>
                
                {showFilters && (
                  <Button
                    startIcon={<ClearIcon />}
                    onClick={handleClearFilters}
                    color="secondary"
                  >
                    {translate("Clear Filters")}
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
          
          {showFilters && (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                {/* Topics Filter */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" gutterBottom>{translate("Topics")}</Typography>
                  <Paper elevation={0} sx={{ p: 2, maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', borderRadius: 2 }}>
                    <FormGroup>
                      {topics.map((topic) => (
                        <FormControlLabel
                          key={topic.id}
                          control={
                            <Checkbox
                              checked={selectedTopics.includes(topic.id)}
                              onChange={() => handleTopicToggle(topic.id)}
                              color="primary"
                            />
                          }
                          label={topic.name}
                        />
                      ))}
                    </FormGroup>
                  </Paper>
                </Grid>
                
                {/* Sources Filter */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" gutterBottom>{translate("Sources")}</Typography>
                  <Paper elevation={0} sx={{ p: 2, maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', borderRadius: 2 }}>
                    <FormGroup>
                      {sources.map((source) => (
                        <FormControlLabel
                          key={source}
                          control={
                            <Checkbox
                              checked={selectedSources.includes(source)}
                              onChange={() => handleSourceToggle(source)}
                              color="primary"
                            />
                          }
                          label={source}
                        />
                      ))}
                    </FormGroup>
                  </Paper>
                </Grid>
                
                {/* Date and Sentiment Filter */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" gutterBottom>{translate("Time Period")}</Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>{translate("Last Days")}</InputLabel>
                    <Select
                      value={dateRange.days === null ? '' : dateRange.days}
                      label={translate("Last Days")}
                      onChange={(e) => setDateRange({
                        ...dateRange,
                        days: e.target.value ? Number(e.target.value) : null
                      })}
                    >
                      <MenuItem value={7}>{translate("Last 7 days")}</MenuItem>
                      <MenuItem value={30}>{translate("Last 30 days")}</MenuItem>
                      <MenuItem value={90}>{translate("Last 90 days")}</MenuItem>
                      <MenuItem value={365}>{translate("Last year")}</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <Typography variant="subtitle1" gutterBottom>{translate("Sentiment Range")}</Typography>
                  <Box sx={{ px: 1 }}>
                    <Slider
                      value={sentimentRange}
                      onChange={handleSentimentChange}
                      valueLabelDisplay="auto"
                      min={-1}
                      max={1}
                      step={0.1}
                      marks={[
                        { value: -1, label: translate("Negative") },
                        { value: 0, label: translate("Neutral") },
                        { value: 1, label: translate("Positive") },
                      ]}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
      
      {/* Results */}
      <Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : articles.length === 0 ? (
          <Card elevation={0} sx={{ 
            p: 4, 
            textAlign: 'center',
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'grey.200',
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              {translate("No articles found")}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {translate("Try adjusting your search filters or search for different keywords.")}
            </Typography>
          </Card>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
              <Typography variant="subtitle1">
                {translate("Showing")} {articles.length} {translate("of")} {totalArticles} {translate("articles")}
              </Typography>
              <FormControl variant="outlined" size="small" sx={{ minWidth: 100 }}>
                <InputLabel>{translate("Items per page")}</InputLabel>
                <Select
                  value={searchParams.limit || 10}
                  onChange={(e) => {
                    setSearchParams({ ...searchParams, limit: Number(e.target.value) });
                    setCurrentPage(1);
                  }}
                  label={translate("Items per page")}
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <List sx={{ mb: 4 }}>
              {articles.map((article) => (
                <Card key={article.id} sx={{ 
                  mb: 2, 
                  borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                  },
                }} onClick={() => handleViewArticle(article.id)}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={9}>
                        <Typography variant="h6" gutterBottom>
                          {article.title}
                        </Typography>
                        <Box sx={{ display: 'flex', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                          <Chip 
                            size="small" 
                            label={article.source} 
                            color="primary"
                            variant="outlined"
                          />
                          <Chip 
                            size="small" 
                            label={formatDate(article.published_at)}
                            variant="outlined"
                          />
                          {article.sentiment_score !== undefined && (
                            <Chip 
                              size="small" 
                              label={formatSentiment(article.sentiment_score).text}
                              sx={{ color: formatSentiment(article.sentiment_score).color, borderColor: formatSentiment(article.sentiment_score).color }}
                              variant="outlined"
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {article.summary ? article.summary.substring(0, 200) + '...' : 
                           article.content ? article.content.substring(0, 200) + '...' : 
                           translate("No summary available")}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Button 
                          variant="contained" 
                          color="primary"
                          fullWidth
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewArticle(article.id);
                          }}
                          sx={{ mb: 1 }}
                        >
                          {translate("View Article")}
                        </Button>
                        <Button 
                          variant="outlined"
                          component="a"
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          fullWidth
                          onClick={(e) => e.stopPropagation()}
                        >
                          {translate("Original Source")}
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </List>
            
            {totalArticles > (searchParams.limit || 10) && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
                <Pagination 
                  count={Math.ceil(totalArticles / (searchParams.limit || 10))} 
                  page={currentPage}
                  onChange={(event, page) => setCurrentPage(page)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </Box>
    </Container>
  );
};

export default AdvancedSearch; 