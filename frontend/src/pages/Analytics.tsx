import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button, 
  CircularProgress,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { useSelector } from 'react-redux';
import DownloadIcon from '@mui/icons-material/Download';
import TimelineIcon from '@mui/icons-material/Timeline';
import PieChartIcon from '@mui/icons-material/PieChart';
import SourceIcon from '@mui/icons-material/Source';
import SummarizeIcon from '@mui/icons-material/Summarize';
import RefreshIcon from '@mui/icons-material/Refresh';

import { analyticsAPI } from '../services/api';
import { 
  AnalyticsSummary, 
  TopicDistribution, 
  SentimentAnalytics, 
  SourceAnalytics,
  TopicStat,
} from '../types';
import { RootState } from '../store';
import { getTranslation } from '../services/translationService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface NoDataFallbackProps {
  message?: string;
  actionButton?: React.ReactNode | null;
}

const NoDataFallback: React.FC<NoDataFallbackProps> = ({ message = 'No data available', actionButton = null }) => (
  <Box 
    sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      py: 5
    }}
  >
    <Box sx={{ textAlign: 'center', mb: 3 }}>
      <SummarizeIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {message}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Запустите скрапер через вкладку "Сбор данных" и дождитесь обработки статей.
      </Typography>
    </Box>
    {actionButton}
  </Box>
);

const Analytics: React.FC = () => {
  const { language } = useSelector((state: RootState) => state.settings);
  const [days, setDays] = useState<number>(30);
  const [interval, setInterval] = useState<string>('day');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // State for analytics data
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topicDistribution, setTopicDistribution] = useState<TopicDistribution | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentAnalytics | null>(null);
  const [sourceData, setSourceData] = useState<SourceAnalytics | null>(null);
  const [noData, setNoData] = useState<boolean>(false);
  
  const translate = (text: string): string => {
    return getTranslation(text, language);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoData(false);
    
    let hasAnyData = false;
    
    try {
      // Загрузка данных аналитики отдельными запросами с обработкой ошибок
      try {
        const summaryRes = await analyticsAPI.getSummary(days);
        if (summaryRes && summaryRes.data && summaryRes.data.total_articles > 0) {
          setSummary(summaryRes.data);
          hasAnyData = true;
        } else {
          setSummary(null);
          console.warn('No summary data received');
        }
      } catch (error) {
        console.error('Error fetching summary data:', error);
        setSummary(null);
      }
      
      try {
        const topicRes = await analyticsAPI.getTopicDistribution(days);
        if (topicRes && topicRes.data && topicRes.data.topics && topicRes.data.topics.length > 0) {
          setTopicDistribution(topicRes.data);
          if (topicRes.data.topics.some((topic: TopicStat) => topic.article_count > 0)) {
            hasAnyData = true;
          }
        } else {
          setTopicDistribution(null);
          console.warn('No topic distribution data received');
        }
      } catch (error) {
        console.error('Error fetching topic distribution:', error);
        setTopicDistribution(null);
      }
      
      try {
        const sentimentRes = await analyticsAPI.getSentimentOverTime({ days, interval });
        if (sentimentRes && sentimentRes.data && sentimentRes.data.time_periods && sentimentRes.data.time_periods.length > 0) {
          setSentimentData(sentimentRes.data);
          hasAnyData = true;
        } else {
          setSentimentData(null);
          console.warn('No sentiment data received');
        }
      } catch (error) {
        console.error('Error fetching sentiment data:', error);
        setSentimentData(null);
      }
      
      try {
        const sourceRes = await analyticsAPI.getSourcesAnalytics(days);
        if (sourceRes && sourceRes.data && sourceRes.data.sources && sourceRes.data.sources.length > 0) {
          setSourceData(sourceRes.data);
          hasAnyData = true;
        } else {
          setSourceData(null);
          console.warn('No source analytics data received');
        }
      } catch (error) {
        console.error('Error fetching source analytics:', error);
        setSourceData(null);
      }
      
      setNoData(!hasAnyData);
    } catch (err: any) {
      console.error('Error loading analytics data:', err);
      setError(err.message || 'Failed to load analytics data');
      setNoData(true);
    } finally {
      setLoading(false);
    }
  }, [days, interval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExportCSV = async () => {
    try {
      const response = await analyticsAPI.exportCSV(days);
      
      // Create a blob and download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await analyticsAPI.exportJSON(days);
      
      // Create a blob and download link
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting JSON:', error);
    }
  };

  // Add a refresh button to NoDataFallback
  const refreshButton = (
    <Button 
      variant="outlined" 
      startIcon={<RefreshIcon />}
      onClick={fetchData}
      sx={{ mt: 2 }}
    >
      Обновить данные
    </Button>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {translate('Analytics')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {translate('Explore insights about your content and user engagement')}
        </Typography>
      </Box>
      
      <Paper sx={{ mb: 4, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="time-period-label">
                {translate('Time Period')}
              </InputLabel>
              <Select
                labelId="time-period-label"
                id="time-period-select"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                label={translate('Time Period')}
                disabled={loading}
              >
                <MenuItem value={7}>{translate('Last 7 days')}</MenuItem>
                <MenuItem value={14}>{translate('Last 14 days')}</MenuItem>
                <MenuItem value={30}>{translate('Last 30 days')}</MenuItem>
                <MenuItem value={90}>{translate('Last 3 months')}</MenuItem>
                <MenuItem value={180}>{translate('Last 6 months')}</MenuItem>
                <MenuItem value={365}>{translate('Last year')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="interval-label">
                {translate('Chart Interval')}
              </InputLabel>
              <Select
                labelId="interval-label"
                id="interval-select"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                label={translate('Chart Interval')}
                disabled={loading}
              >
                <MenuItem value="day">{translate('Daily')}</MenuItem>
                <MenuItem value="week">{translate('Weekly')}</MenuItem>
                <MenuItem value="month">{translate('Monthly')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4} md={3} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
            <Button 
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              {translate('Refresh')}
            </Button>
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportCSV}
              disabled={loading || noData}
            >
              CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportJSON}
              disabled={loading || noData}
            >
              JSON
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      ) : noData ? (
        <NoDataFallback 
          message="No analytics data available for the selected period" 
          actionButton={refreshButton}
        />
      ) : (
        <>
          {/* Tabs and analytics content */}
          <Paper sx={{ mb: 4 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab icon={<SummarizeIcon />} label={translate('Summary')} iconPosition="start" />
              <Tab icon={<PieChartIcon />} label={translate('Topics')} iconPosition="start" />
              <Tab icon={<TimelineIcon />} label={translate('Sentiment')} iconPosition="start" />
              <Tab icon={<SourceIcon />} label={translate('Sources')} iconPosition="start" />
            </Tabs>

            {/* Implement the tab panels here - they are missing in the current code! */}
            <TabPanel value={tabValue} index={0}>
              {summary ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">{translate('Summary Data')}</Typography>
                  <Typography>
                    {translate('Total Articles')}: {summary.total_articles}
                  </Typography>
                  <Typography>
                    {translate('Total Digests')}: {summary.total_digests}
                  </Typography>
                </Box>
              ) : (
                <NoDataFallback message={translate('No summary data available')} />
              )}
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              {topicDistribution && topicDistribution.topics && topicDistribution.topics.length > 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">{translate('Topics Distribution')}</Typography>
                  {topicDistribution.topics.map((topic, index) => (
                    <Typography key={index}>
                      {topic.name}: {topic.article_count} articles
                    </Typography>
                  ))}
                </Box>
              ) : (
                <NoDataFallback message={translate('No topic data available')} />
              )}
            </TabPanel>
            
            <TabPanel value={tabValue} index={2}>
              {sentimentData && sentimentData.time_periods && sentimentData.time_periods.length > 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">{translate('Sentiment Analysis')}</Typography>
                  {sentimentData.time_periods.map((period, index) => (
                    <Typography key={index}>
                      {period.period}: {period.avg_sentiment.toFixed(2)} ({period.article_count} articles)
                    </Typography>
                  ))}
                </Box>
              ) : (
                <NoDataFallback message={translate('No sentiment data available')} />
              )}
            </TabPanel>
            
            <TabPanel value={tabValue} index={3}>
              {sourceData && sourceData.sources && sourceData.sources.length > 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">{translate('Sources Analysis')}</Typography>
                  {sourceData.sources.map((source, index) => (
                    <Typography key={index}>
                      {source.name}: {source.article_count} articles
                    </Typography>
                  ))}
                </Box>
              ) : (
                <NoDataFallback message={translate('No source data available')} />
              )}
            </TabPanel>
          </Paper>
        </>
      )}
    </Container>
  );
};

export default Analytics; 