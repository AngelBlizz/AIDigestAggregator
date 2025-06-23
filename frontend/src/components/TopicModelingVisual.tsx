import React from 'react';
import { Box, Typography, Paper, Chip, Grid, CircularProgress, 
  Alert, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Tooltip, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type Topic = {
  id: number;
  keywords: string[];
};

type ArticleTopic = {
  article_id: number;
  article_title: string;
  top_topic_id: number;
  top_topic_prob: number;
  full_distribution: number[];
};

interface TopicModelingResultProps {
  data: {
    status: string;
    article_count: number;
    topics: Topic[];
    article_topics: ArticleTopic[];
  } | null;
  loading: boolean;
  error: string | null;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

const TopicModelingVisual: React.FC<TopicModelingResultProps> = ({ data, loading, error }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data || data.status !== 'success') {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Результаты тематического моделирования пока не получены. Запустите анализ, чтобы увидеть данные.
      </Alert>
    );
  }

  // Подготовка данных для круговой диаграммы
  const pieData = data.topics.map((topic, index) => ({
    name: `Тема ${topic.id + 1}`,
    value: data.article_topics.filter(at => at.top_topic_id === topic.id).length,
    id: topic.id
  }));

  // Подготовка данных для гистограммы распределения тем
  const topicDistribution = data.topics.map((topic, index) => {
    const articlesInTopic = data.article_topics.filter(at => at.top_topic_id === topic.id).length;
    const percentage = (articlesInTopic / data.article_count) * 100;
    
    return {
      topic: `Тема ${topic.id + 1}`,
      count: articlesInTopic,
      percentage: parseFloat(percentage.toFixed(1))
    };
  });

  // Функция для получения цвета темы
  const getTopicColor = (topicId: number) => {
    return COLORS[topicId % COLORS.length];
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Результаты тематического моделирования
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Проанализировано статей: {data.article_count}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Распределение статей по темам */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Распределение статей по темам
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getTopicColor(entry.id)} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value, name) => [`Статей: ${value}`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Гистограмма распределения тем */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Гистограмма распределения тем
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topicDistribution}
                  margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="topic" angle={-45} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" orientation="left" stroke={theme.palette.primary.main} />
                  <YAxis yAxisId="right" orientation="right" stroke={theme.palette.secondary.main} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar 
                    yAxisId="left" 
                    dataKey="count" 
                    name="Количество статей" 
                    fill={theme.palette.primary.main} 
                  />
                  <Bar 
                    yAxisId="right" 
                    dataKey="percentage" 
                    name="Процент (%)" 
                    fill={theme.palette.secondary.main} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Ключевые слова по темам */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Ключевые слова по темам
            </Typography>
            <Grid container spacing={2}>
              {data.topics.map((topic) => (
                <Grid item xs={12} sm={6} md={4} key={topic.id}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      border: `1px solid ${getTopicColor(topic.id)}`,
                      height: '100%'
                    }}
                    elevation={1}
                  >
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Тема {topic.id + 1}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {topic.keywords.map((keyword, idx) => (
                        <Chip 
                          key={idx} 
                          label={keyword} 
                          size="small" 
                          sx={{ 
                            bgcolor: idx < 3 ? `${getTopicColor(topic.id)}30` : 'inherit',
                            fontWeight: idx < 3 ? 'bold' : 'normal'
                          }} 
                        />
                      ))}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Таблица с распределением статей по темам */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Топ статей по темам
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Заголовок статьи</TableCell>
                    <TableCell>Основная тема</TableCell>
                    <TableCell align="right">Вероятность (%)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.article_topics
                    .sort((a, b) => b.top_topic_prob - a.top_topic_prob)
                    .slice(0, 20)
                    .map((article) => (
                    <TableRow key={article.article_id}>
                      <TableCell>
                        <Tooltip title={article.article_title}>
                          <Typography noWrap sx={{ maxWidth: 400 }}>
                            {article.article_title}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`Тема ${article.top_topic_id + 1}`} 
                          size="small" 
                          sx={{ bgcolor: `${getTopicColor(article.top_topic_id)}30` }} 
                        />
                      </TableCell>
                      <TableCell align="right">
                        {(article.top_topic_prob * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TopicModelingVisual; 