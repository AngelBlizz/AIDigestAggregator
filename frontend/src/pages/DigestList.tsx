import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Tabs,
  Tab,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormControlLabel,
  Checkbox,
  Slider,
  InputAdornment,
  Snackbar,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import { format } from 'date-fns';
import { RootState } from '../store';
import {
  fetchDigestsStart,
  fetchDigestsSuccess,
  fetchDigestsFailure,
  markDigestAsRead,
} from '../store/slices/digestSlice';
import { digestAPI } from '../services/api';
import { useAppDispatch } from '../hooks';
import DigestCard from '../components/DigestCard';

interface Topic {
  id: number;
  name: string;
  description: string;
  category?: string;
}

interface DigestStats {
  total_digests: number;
  unread_digests: number;
  total_articles: number;
  topics_count: number;
}

const DigestList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { digests, loading, error } = useSelector((state: RootState) => state.digest);
  const { topics } = useSelector((state: RootState) => state.topic);
  const [status, setStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<DigestStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openGenerateDialog, setOpenGenerateDialog] = useState(false);
  const [generationParams, setGenerationParams] = useState({
    topics: [] as number[],
    sources: [] as string[],
    days: 3,
    maxArticles: 10,
    includeSentiment: true,
    includeKeywords: true,
    minSentimentScore: -1,
    maxSentimentScore: 1,
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  const fetchDigests = async (statusFilter: string | null = null) => {
    try {
      dispatch(fetchDigestsStart());
      const response = await digestAPI.getDigests({ 
        status: statusFilter || undefined 
      });
      dispatch(fetchDigestsSuccess(response.data));
    } catch (error) {
      dispatch(fetchDigestsFailure('Failed to fetch digests'));
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await digestAPI.getDigestStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchDigests(status);
    fetchStats();
  }, [status]);

  const handleViewDigest = (digestId: number) => {
    // Mark digest as read
    handleMarkAsRead(digestId);
    // Navigate to digest detail page
    navigate(`/digests/${digestId}`);
  };

  // Enhanced error handling
  const handleApiError = (error: any, operation: string) => {
    console.error(`Error ${operation}:`, error);
    let errorMessage = `Failed to ${operation}`;
    
    if (error.response) {
      // Extract detailed error information from the response
      const status = error.response.status;
      const detail = error.response?.data?.detail;
      
      if (status === 404) {
        errorMessage = `Digest not found (404)`;
      } else if (detail) {
        errorMessage = detail;
      } else {
        errorMessage = `Error ${status}: ${errorMessage}`;
      }
    }
    
    showSnackbar(errorMessage, 'error');
  };

  const handleMarkAsRead = async (digestId: number) => {
    try {
      await digestAPI.markAsRead(digestId);
      dispatch(markDigestAsRead(digestId));
      fetchStats(); // Update stats after marking as read
      showSnackbar('Digest marked as read', 'success');
    } catch (error) {
      handleApiError(error, 'mark digest as read');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleGenerateDigest = async () => {
    try {
      setGenerating(true);
      
      // Validate parameters
      if (generationParams.topics.length === 0) {
        showSnackbar('Please select at least one topic', 'warning');
        return;
      }
      
      await digestAPI.generateDigest(generationParams);
      fetchDigests(status);
      fetchStats();
      setOpenGenerateDialog(false);
      showSnackbar('Digest generated successfully', 'success');
    } catch (error) {
      console.error('Failed to generate digest:', error);
      showSnackbar('Failed to generate digest', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerationParamChange = (name: string, value: any) => {
    setGenerationParams({
      ...generationParams,
      [name]: value,
    });
  };

  const handleSelectChange = (event: SelectChangeEvent<string[] | number[]>) => {
    const { name, value } = event.target;
    handleGenerationParamChange(name as string, value);
  };

  const handleSliderChange = (name: string) => (event: Event, newValue: number | number[]) => {
    handleGenerationParamChange(name, newValue);
  };

  const handleCheckboxChange = (name: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    handleGenerationParamChange(name, event.target.checked);
  };

  const handleNumberInputChange = (name: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
      handleGenerationParamChange(name, value);
    }
  };

  const handleStatusChange = (_: React.SyntheticEvent, newValue: string) => {
    setStatus(newValue === 'all' ? null : newValue);
  };

  const handleRefresh = () => {
    fetchDigests(status);
    fetchStats();
  };

  const renderDigestList = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      );
    }

    if (!digests || digests.length === 0) {
      return (
        <Paper sx={{ p: 3, my: 2, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>No digests found</Typography>
          <Typography color="text.secondary" paragraph>
            {status === 'read' 
              ? "You don't have any read digests yet." 
              : status === 'unread' 
                ? "You don't have any unread digests."
                : "You haven't created any digests yet. Generate your first digest to get started!"}
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => navigate('/digests/create')}
          >
            Generate New Digest
          </Button>
        </Paper>
      );
    }

    return (
      <Grid container spacing={3} sx={{ my: 2 }}>
        {digests.map((digest) => (
          <Grid item xs={12} sm={6} md={4} key={digest.id}>
            <DigestCard
              digest={digest}
              onViewClick={handleViewDigest}
              onMarkAsReadClick={!digest.is_read ? handleMarkAsRead : undefined}
            />
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Your Digests</Typography>
        <Stack direction="row" spacing={2}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />} 
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => navigate('/digests/create')}
          >
            Generate New Digest
          </Button>
        </Stack>
      </Box>

      {stats && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Digest Statistics</Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Total Digests</Typography>
              <Typography variant="h5">{stats.total_digests}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Unread Digests</Typography>
              <Typography variant="h5">{stats.unread_digests}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Total Articles</Typography>
              <Typography variant="h5">{stats.total_articles}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Topic Subscriptions</Typography>
              <Typography variant="h5">{stats.topics_count}</Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={status === null ? 'all' : status}
          onChange={handleStatusChange}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab label="All Digests" value="all" />
          <Tab label="Unread" value="unread" />
          <Tab label="Read" value="read" />
        </Tabs>
      </Paper>

      {renderDigestList()}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Advanced Digest Generation Dialog */}
      <Dialog 
        open={openGenerateDialog} 
        onClose={() => setOpenGenerateDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Generate Customized Digest</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph sx={{ mt: 1 }}>
            Customize parameters for your new digest to get the most relevant news content.
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="topics-label">Select Topics</InputLabel>
                <Select
                  labelId="topics-label"
                  multiple
                  name="topics"
                  value={generationParams.topics}
                  onChange={handleSelectChange}
                  renderValue={(selected) => {
                    const topicNames = selected.map(id => {
                      const topic = topics.find(t => t.id === id);
                      return topic ? topic.name : '';
                    });
                    return topicNames.join(', ');
                  }}
                  label="Select Topics"
                >
                  {topics.map((topic) => (
                    <MenuItem key={topic.id} value={topic.id}>
                      <Checkbox checked={generationParams.topics.indexOf(topic.id) > -1} />
                      {topic.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel id="sources-label">Preferred Sources</InputLabel>
                <Select
                  labelId="sources-label"
                  multiple
                  name="sources"
                  value={generationParams.sources}
                  onChange={handleSelectChange}
                  renderValue={(selected) => (selected as string[]).join(', ')}
                  label="Preferred Sources"
                >
                  {['BBC', 'CNN', 'Reuters', 'AP', 'Guardian', 'NYTimes'].map((source) => (
                    <MenuItem key={source} value={source}>
                      <Checkbox checked={generationParams.sources.indexOf(source) > -1} />
                      {source}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 2 }}>
                <Typography id="days-slider-label" gutterBottom>
                  Time Range (Days)
                </Typography>
                <Slider
                  value={generationParams.days}
                  onChange={handleSliderChange('days')}
                  aria-labelledby="days-slider-label"
                  valueLabelDisplay="auto"
                  step={1}
                  marks
                  min={1}
                  max={7}
                />
              </Box>

              <TextField
                margin="normal"
                fullWidth
                label="Maximum Articles"
                type="number"
                name="maxArticles"
                value={generationParams.maxArticles}
                onChange={handleNumberInputChange('maxArticles')}
                InputProps={{
                  inputProps: { min: 5, max: 30 }
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                Content Analysis Options
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={generationParams.includeSentiment}
                    onChange={handleCheckboxChange('includeSentiment')}
                    name="includeSentiment"
                  />
                }
                label="Include Sentiment Analysis"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={generationParams.includeKeywords}
                    onChange={handleCheckboxChange('includeKeywords')}
                    name="includeKeywords"
                  />
                }
                label="Include Keywords and Entities"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography id="sentiment-range-slider" gutterBottom>
                Sentiment Range (from negative to positive)
              </Typography>
              <Slider
                value={[generationParams.minSentimentScore, generationParams.maxSentimentScore]}
                onChange={(event, newValue) => {
                  const [min, max] = newValue as number[];
                  setGenerationParams({
                    ...generationParams,
                    minSentimentScore: min,
                    maxSentimentScore: max,
                  });
                }}
                valueLabelDisplay="auto"
                aria-labelledby="sentiment-range-slider"
                min={-1}
                max={1}
                step={0.1}
                disabled={!generationParams.includeSentiment}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGenerateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleGenerateDigest} 
            variant="contained" 
            color="primary"
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Digest'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DigestList; 