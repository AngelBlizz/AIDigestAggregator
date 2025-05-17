import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Slider,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Snackbar,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { digestAPI, topicAPI, articleAPI } from '../services/api';
import { Topic } from '../types';
import { getTranslation } from '../services/translationService';
import { RootState } from '../store';

const DigestGenerator: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useSelector((state: RootState) => state.settings);
  
  // State for form fields
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // State for generation parameters
  const [generationParams, setGenerationParams] = useState({
    topics: [] as number[],
    sources: [] as string[],
    days: 7,
    maxArticles: 10,
    includeSentiment: true,
    includeKeywords: true,
    minSentimentScore: -1,
    maxSentimentScore: 1,
    autoScrape: true,
  });

  const translate = (text: string): string => {
    return getTranslation(text, language);
  };
  
  // Fetch topics and sources when component mounts
  useEffect(() => {
    fetchTopicsAndSources();
  }, []);
  
  const fetchTopicsAndSources = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch user's topics
      const topicsResponse = await topicAPI.getTopics();
      
      if (topicsResponse && topicsResponse.data) {
        const loadedTopics = Array.isArray(topicsResponse.data) ? topicsResponse.data : [];
        setTopics(loadedTopics);
        
        // Default: select all user topics that are marked as selected
        const selectedTopics = loadedTopics
          .filter(topic => topic.is_selected)
          .map(topic => topic.id);
        
        setGenerationParams(prev => ({
          ...prev,
          topics: selectedTopics
        }));
      } else {
        setTopics([]);
      }
      
      // Fetch available news sources
      const sourcesResponse = await articleAPI.getSources();
      
      if (sourcesResponse && sourcesResponse.data) {
        setSources(Array.isArray(sourcesResponse.data) ? sourcesResponse.data : []);
      } else {
        setSources([]);
      }
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(translate('Failed to load topics and sources. Please try again later.'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerateDigest = async () => {
    // Validate form
    if (!generationParams.topics || generationParams.topics.length === 0) {
      setError(translate('Please select at least one topic for your digest.'));
      return;
    }
    
    setGenerating(true);
    setError(null);
    
    try {
      // Call API to generate digest with properly formatted parameters
      const response = await digestAPI.generateDigest({
        ...generationParams,
        // Make sure topics is an array of numbers, not strings
        topics: generationParams.topics.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
      });
      
      setSuccess(true);
      
      // Redirect to the new digest after a short delay
      setTimeout(() => {
        if (response && response.data && response.data.id) {
          navigate(`/digests/${response.data.id}`);
        } else {
          // If ID not received, redirect to digest list
          navigate('/digests');
        }
      }, 1500);
    } catch (err: any) {
      console.error('Error generating digest:', err);
      const errorMessage = err.response?.data?.detail || translate('Failed to generate digest. Please try again.');
      setError(errorMessage);
      
      // Log detailed error information for debugging
      if (err.response?.data) {
        console.error('Response data:', err.response.data);
      }
    } finally {
      setGenerating(false);
    }
  };
  
  const handleSelectChange = (event: SelectChangeEvent<unknown>) => {
    const { name, value } = event.target;
    
    // Handle topics selection (needs special handling for proper type conversion)
    if (name === 'topics') {
      // Convert string IDs to numbers
      const numericValues = Array.isArray(value) 
        ? value.map(val => typeof val === 'string' ? parseInt(val, 10) : val)
        : [];
      
      setGenerationParams({
        ...generationParams,
        topics: numericValues as number[]
      });
    } else {
      setGenerationParams({
        ...generationParams,
        [name]: value
      });
    }
  };
  
  const handleDaysChange = (_: Event, newValue: number | number[]) => {
    setGenerationParams({
      ...generationParams,
      days: newValue as number
    });
  };
  
  const handleMaxArticlesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    if (!isNaN(value) && value > 0) {
      setGenerationParams({
        ...generationParams,
        maxArticles: value
      });
    }
  };
  
  const handleSentimentRangeChange = (_: Event, newValue: number | number[]) => {
    const [min, max] = newValue as number[];
    setGenerationParams({
      ...generationParams,
      minSentimentScore: min,
      maxSentimentScore: max
    });
  };
  
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setGenerationParams({
      ...generationParams,
      [name]: checked
    });
  };
  
  const handleCloseSnackbar = () => {
    setSuccess(false);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">{translate('Generate New Digest')}</Typography>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/digests')}
          >
            {translate('Back to Digests')}
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            {translate('Customize Your Digest')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {translate('Select topics, sources, and other parameters to create a personalized digest.')}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Grid container spacing={3}>
            {/* Topics Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={loading || generating} error={error?.includes('topic')}>
                <InputLabel id="topics-select-label">{translate('Topics')}</InputLabel>
                <Select
                  labelId="topics-select-label"
                  id="topics-select"
                  multiple
                  name="topics"
                  value={generationParams.topics}
                  onChange={handleSelectChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as number[]).map((value) => {
                        const topic = topics.find(t => t.id === value);
                        return topic ? (
                          <Chip key={value} label={topic.name} size="small" />
                        ) : null;
                      })}
                    </Box>
                  )}
                >
                  {topics.map((topic) => (
                    <MenuItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="error">
                  {error?.includes('topic') && translate('At least one topic must be selected')}
                </Typography>
              </FormControl>
            </Grid>
            
            {/* Sources Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={loading || generating}>
                <InputLabel id="sources-select-label">{translate('News Sources')}</InputLabel>
                <Select
                  labelId="sources-select-label"
                  id="sources-select"
                  multiple
                  name="sources"
                  value={generationParams.sources}
                  onChange={handleSelectChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {sources.map((source) => (
                    <MenuItem key={source} value={source}>
                      {source}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  {translate('Leave empty to include all sources')}
                </Typography>
              </FormControl>
            </Grid>
            
            {/* Time Range */}
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                {translate('Time Range (in days)')}
              </Typography>
              <Slider
                value={generationParams.days}
                onChange={handleDaysChange}
                valueLabelDisplay="auto"
                step={1}
                marks
                min={1}
                max={30}
                disabled={loading || generating}
              />
              <Typography variant="caption" color="text.secondary">
                {generationParams.days === 1 
                  ? translate('Last 24 hours')
                  : translate(`Last ${generationParams.days} days`)}
              </Typography>
            </Grid>
            
            {/* Max Articles */}
            <Grid item xs={12} md={6}>
              <TextField
                label={translate('Maximum Articles')}
                type="number"
                value={generationParams.maxArticles}
                onChange={handleMaxArticlesChange}
                fullWidth
                InputProps={{ inputProps: { min: 1, max: 50 } }}
                disabled={loading || generating}
              />
              <Typography variant="caption" color="text.secondary">
                {translate('Maximum number of articles to include')}
              </Typography>
            </Grid>
            
            {/* Advanced Options */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                {translate('Advanced Options')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={generationParams.includeSentiment}
                        onChange={handleCheckboxChange}
                        name="includeSentiment"
                        disabled={loading || generating}
                      />
                    }
                    label={translate('Include Sentiment Analysis')}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={generationParams.includeKeywords}
                        onChange={handleCheckboxChange}
                        name="includeKeywords"
                        disabled={loading || generating}
                      />
                    }
                    label={translate('Include Keywords Analysis')}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={generationParams.autoScrape}
                        onChange={handleCheckboxChange}
                        name="autoScrape"
                        disabled={loading || generating}
                      />
                    }
                    label={translate('Auto-Scrape Latest News First')}
                  />
                </Grid>
                {generationParams.includeSentiment && (
                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      {translate('Sentiment Range (-1 to 1)')}
                    </Typography>
                    <Slider
                      value={[generationParams.minSentimentScore, generationParams.maxSentimentScore]}
                      onChange={handleSentimentRangeChange}
                      valueLabelDisplay="auto"
                      step={0.1}
                      marks={[
                        { value: -1, label: translate('Negative') },
                        { value: 0, label: translate('Neutral') },
                        { value: 1, label: translate('Positive') },
                      ]}
                      min={-1}
                      max={1}
                      disabled={loading || generating}
                    />
                  </Grid>
                )}
              </Grid>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={generating ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
              onClick={handleGenerateDigest}
              disabled={loading || generating || generationParams.topics.length === 0}
            >
              {generating ? translate('Generating...') : translate('Generate Digest')}
            </Button>
          </Box>
        </Paper>
        
        <Snackbar
          open={success}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          message={translate('Digest created successfully! Redirecting...')}
        />
      </Box>
    </Container>
  );
};

export default DigestGenerator; 