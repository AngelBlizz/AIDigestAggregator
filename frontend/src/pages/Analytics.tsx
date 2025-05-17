import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  Card, 
  CardContent, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button, 
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Alert,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import BarChartIcon from '@mui/icons-material/BarChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import PieChartIcon from '@mui/icons-material/PieChart';
import SourceIcon from '@mui/icons-material/Source';
import SummarizeIcon from '@mui/icons-material/Summarize';

// Charts
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { analyticsAPI } from '../services/api';
import { 
  AnalyticsSummary, 
  TopicDistribution, 
  SentimentAnalytics, 
  SourceAnalytics,
  TimePeriod,
  TopicStat,
  SourceStat,
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

const Analytics: React.FC = () => {
  const theme = useTheme();
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
  
  // Colors for charts
  const COLORS = [
    '#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c',
    '#d0ed57', '#ffc658', '#ff8042', '#ff6361', '#bc5090',
  ];

  // Sentiment colors
  const sentimentColors = {
    positive: '#4caf50',
    neutral: '#ffeb3b',
    negative: '#f44336'
  };

  const translate = (text: string): string => {
    return getTranslation(text, language);
  };

  useEffect(() => {
    fetchData();
  }, [days, interval]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Загрузка данных аналитики отдельными запросами с обработкой ошибок
      try {
        const summaryRes = await analyticsAPI.getSummary(days);
        if (summaryRes && summaryRes.data) {
          setSummary(summaryRes.data);
        } else {
          setSummary(null);
        }
      } catch (error) {
        console.error('Error fetching summary data:', error);
        setSummary(null);
      }
      
      try {
        const topicRes = await analyticsAPI.getTopicDistribution(days);
        if (topicRes && topicRes.data) {
          setTopicDistribution(topicRes.data);
        } else {
          setTopicDistribution(null);
        }
      } catch (error) {
        console.error('Error fetching topic distribution:', error);
        setTopicDistribution(null);
      }
      
      try {
        const sentimentRes = await analyticsAPI.getSentimentOverTime({ days, interval });
        if (sentimentRes && sentimentRes.data) {
          setSentimentData(sentimentRes.data);
        } else {
          setSentimentData(null);
        }
      } catch (error) {
        console.error('Error fetching sentiment data:', error);
        setSentimentData(null);
      }
      
      try {
        const sourceRes = await analyticsAPI.getSourcesAnalytics(days);
        if (sourceRes && sourceRes.data) {
          setSourceData(sourceRes.data);
        } else {
          setSourceData(null);
        }
      } catch (error) {
        console.error('Error fetching source analytics:', error);
        setSourceData(null);
      }
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError(translate('Failed to fetch analytics data'));
    } finally {
      setLoading(false);
    }
  };

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

  // Formatters for charts
  const sentimentFormatter = (value: number) => {
    if (value > 0.5) return translate('Very Positive');
    if (value > 0.2) return translate('Positive');
    if (value > -0.2) return translate('Neutral');
    if (value > -0.5) return translate('Negative');
    return translate('Very Negative');
  };

  const percentFormatter = (value: number) => `${Math.round(value * 100)}%`;

  if (loading && !summary && !error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Создаем временные данные, если настоящие недоступны
  const mockSummary: AnalyticsSummary = summary || {
    total_articles: 0,
    total_digests: 0,
    avg_sentiment_score: 0,
    positive_articles: 0,
    negative_articles: 0,
    neutral_articles: 0,
    most_popular_topics: [],
    most_active_sources: []
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" gutterBottom>
          {translate('Analytics Dashboard')}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <FormControl variant="outlined" size="small" sx={{ mr: 2, minWidth: 120 }}>
              <InputLabel>{translate('Time Period')}</InputLabel>
              <Select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                label={translate('Time Period')}
              >
                <MenuItem value={7}>{translate('Last 7 days')}</MenuItem>
                <MenuItem value={14}>{translate('Last 14 days')}</MenuItem>
                <MenuItem value={30}>{translate('Last 30 days')}</MenuItem>
                <MenuItem value={90}>{translate('Last 90 days')}</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{translate('Interval')}</InputLabel>
              <Select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                label={translate('Interval')}
              >
                <MenuItem value="day">{translate('Daily')}</MenuItem>
                <MenuItem value="week">{translate('Weekly')}</MenuItem>
                <MenuItem value="month">{translate('Monthly')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />} 
              onClick={handleExportCSV}
              sx={{ mr: 1 }}
            >
              {translate('Export CSV')}
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />} 
              onClick={handleExportJSON}
            >
              {translate('Export JSON')}
            </Button>
          </Box>
        </Box>
        
        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {translate('Total Articles')}
                </Typography>
                <Typography variant="h3">
                  {mockSummary.total_articles}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {translate('Total Digests')}
                </Typography>
                <Typography variant="h3">
                  {mockSummary.total_digests}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {translate('Average Sentiment')}
                </Typography>
                <Typography variant="h3" color={mockSummary.avg_sentiment_score > 0 ? 'success.main' : 'error.main'}>
                  {mockSummary.avg_sentiment_score.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {translate('Positive Articles')}
                </Typography>
                <Typography variant="h3" color="success.main">
                  {mockSummary.positive_articles}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Tab Navigation */}
        <Paper sx={{ mb: 4 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab icon={<SummarizeIcon />} label={translate('Overview')} />
            <Tab icon={<BarChartIcon />} label={translate('Topics')} />
            <Tab icon={<TimelineIcon />} label={translate('Sentiment')} />
            <Tab icon={<SourceIcon />} label={translate('Sources')} />
          </Tabs>
          
          {/* Overview Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    {translate('Sentiment Distribution')}
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    {mockSummary && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: translate('Positive'), value: mockSummary.positive_articles },
                              { name: translate('Neutral'), value: mockSummary.neutral_articles },
                              { name: translate('Negative'), value: mockSummary.negative_articles },
                            ]}
                            nameKey="name"
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            label
                          >
                            <Cell fill={sentimentColors.positive} />
                            <Cell fill={sentimentColors.neutral} />
                            <Cell fill={sentimentColors.negative} />
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    {translate('Popular Topics')}
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    {mockSummary && mockSummary.most_popular_topics.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={mockSummary.most_popular_topics.slice(0, 5)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="count" fill="#8884d8" name={translate('Articles')} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Typography variant="body1" color="textSecondary">
                          {translate('No topic data available')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* Topics Tab */}
          <TabPanel value={tabValue} index={1}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {translate('Content Distribution by Topic')}
              </Typography>
              <Box sx={{ height: 400 }}>
                {topicDistribution && topicDistribution.topics && topicDistribution.topics.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topicDistribution.topics}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="article_count" fill="#8884d8" name={translate('Articles')} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography variant="body1" color="textSecondary">
                      {translate('No topic distribution data available')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </TabPanel>
          
          {/* Sentiment Tab */}
          <TabPanel value={tabValue} index={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {translate('Sentiment Trends Over Time')}
              </Typography>
              <Box sx={{ height: 400 }}>
                {sentimentData && sentimentData.time_periods && sentimentData.time_periods.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={sentimentData.time_periods}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis 
                        domain={[-1, 1]} 
                        tickFormatter={sentimentFormatter}
                      />
                      <Tooltip formatter={(value) => [sentimentFormatter(value as number), translate('Sentiment')]} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="avg_sentiment" 
                        stroke="#8884d8" 
                        name={translate('Average Sentiment')} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography variant="body1" color="textSecondary">
                      {translate('No sentiment data available')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </TabPanel>
          
          {/* Sources Tab */}
          <TabPanel value={tabValue} index={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {translate('Content by Source')}
              </Typography>
              <Box sx={{ height: 400 }}>
                {sourceData && sourceData.sources && sourceData.sources.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sourceData.sources.slice(0, 10)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        domain={[-1, 1]} 
                        tickFormatter={sentimentFormatter}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        yAxisId="left" 
                        dataKey="article_count" 
                        fill="#8884d8" 
                        name={translate('Articles')} 
                      />
                      <Bar 
                        yAxisId="right" 
                        dataKey="avg_sentiment" 
                        fill="#82ca9d" 
                        name={translate('Avg Sentiment')} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography variant="body1" color="textSecondary">
                      {translate('No source data available')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
};

export default Analytics; 