import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Tab, 
  Tabs, 
  Button, 
  FormControl, 
  InputLabel, 
  MenuItem, 
  Select, 
  TextField, 
  Grid, 
  Divider, 
  Alert,
  CircularProgress,
  FormHelperText,
  Stack,
  Snackbar,
  IconButton,
  SelectChangeEvent
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import StorageIcon from '@mui/icons-material/Storage';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CloseIcon from '@mui/icons-material/Close';
import LanguageIcon from '@mui/icons-material/Language';
import DownloadIcon from '@mui/icons-material/Download';
import TopicModelingVisual from '../components/TopicModelingVisual';
import LanguageDetector from '../components/LanguageDetector';
import { nlpAPI, topicAPI, scraperAPI } from '../services/api';

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
      id={`nlp-tabpanel-${index}`}
      aria-labelledby={`nlp-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const NLPAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<number | ''>('');
  const [daysFilter, setDaysFilter] = useState<number>(30);
  const [numTopics, setNumTopics] = useState<number>(5);
  const [topicModelingData, setTopicModelingData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    // Загрузка списка тем при инициализации
    const fetchTopics = async () => {
      try {
        const response = await topicAPI.getTopics();
        setTopics(response.data);
      } catch (err) {
        console.error('Ошибка при загрузке тем:', err);
        setError('Не удалось загрузить список тем');
      }
    };

    fetchTopics();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleTopicChange = (event: SelectChangeEvent<number | string>) => {
    setSelectedTopic(event.target.value as number | '');
  };

  const handleDaysChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setDaysFilter(isNaN(value) ? 30 : Math.max(1, Math.min(365, value)));
  };

  const handleNumTopicsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setNumTopics(isNaN(value) ? 5 : Math.max(2, Math.min(20, value)));
  };

  const runTopicModeling = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        days: daysFilter,
        num_topics: numTopics
      };

      if (selectedTopic !== '') {
        params.topic_id = selectedTopic;
      }

      const response = await nlpAPI.getTopicModeling(params);
      setTopicModelingData(response.data);
      
      setNotification({
        open: true,
        message: 'Тематическое моделирование успешно выполнено',
        severity: 'success'
      });
    } catch (err: any) {
      console.error('Ошибка при выполнении тематического моделирования:', err);
      setError(err.response?.data?.message || 'Ошибка при выполнении тематического моделирования');
      
      setNotification({
        open: true,
        message: 'Ошибка при выполнении тематического моделирования',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const runRecategorizeArticles = async () => {
    setLoading(true);
    
    try {
      await scraperAPI.recategorizeArticles();
      
      setNotification({
        open: true,
        message: 'Задача перекатегоризации статей запущена в фоновом режиме',
        severity: 'info'
      });
    } catch (err: any) {
      console.error('Ошибка при запуске перекатегоризации:', err);
      
      setNotification({
        open: true,
        message: 'Ошибка при запуске перекатегоризации статей',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification({...notification, open: false});
  };

  const handleExportResults = () => {
    if (!topicModelingData) return;
    
    // Создаем Blob для экспорта данных
    const dataStr = JSON.stringify(topicModelingData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    
    // Создаем ссылку для скачивания
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Формируем имя файла с датой
    const date = new Date().toISOString().slice(0, 10);
    const topicName = selectedTopic !== '' 
      ? topics.find(t => t.id === selectedTopic)?.name || 'custom-topic'
      : 'all-topics';
    
    link.download = `topic-modeling-${topicName}-${date}.json`;
    
    // Запускаем скачивание и освобождаем ресурсы
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setNotification({
      open: true,
      message: 'Результаты анализа успешно экспортированы',
      severity: 'success'
    });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Расширенный NLP-анализ
      </Typography>
      
      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Тематическое моделирование" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="Определение языка" icon={<LanguageIcon />} iconPosition="start" />
          <Tab label="Управление данными" icon={<StorageIcon />} iconPosition="start" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Параметры тематического моделирования
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Тематическое моделирование позволяет выявить скрытые темы в коллекции документов.
              Вы можете настроить параметры анализа для получения оптимальных результатов.
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel id="topic-select-label">Тема</InputLabel>
                  <Select
                    labelId="topic-select-label"
                    id="topic-select"
                    value={selectedTopic}
                    onChange={handleTopicChange}
                    label="Тема"
                  >
                    <MenuItem value="">
                      <em>Все темы</em>
                    </MenuItem>
                    {topics.map((topic) => (
                      <MenuItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Выберите тему или используйте все</FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Период (дней)"
                  variant="outlined"
                  type="number"
                  size="small"
                  value={daysFilter}
                  onChange={handleDaysChange}
                  inputProps={{ min: 1, max: 365 }}
                  helperText="За сколько дней анализировать статьи"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Количество тем"
                  variant="outlined"
                  type="number"
                  size="small"
                  value={numTopics}
                  onChange={handleNumTopicsChange}
                  inputProps={{ min: 2, max: 20 }}
                  helperText="Количество тем для моделирования"
                />
              </Grid>
            </Grid>
            
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={runTopicModeling}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AnalyticsIcon />}
              >
                {loading ? 'Выполняется...' : 'Запустить тематическое моделирование'}
              </Button>
              
              {topicModelingData && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleExportResults}
                  startIcon={<DownloadIcon />}
                >
                  Экспортировать результаты
                </Button>
              )}
            </Stack>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <TopicModelingVisual 
            data={topicModelingData} 
            loading={loading} 
            error={error}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <LanguageDetector />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Управление статьями и категориями
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Здесь вы можете запускать различные процессы для обработки и категоризации статей.
            </Typography>
            
            <Stack spacing={2}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Перекатегоризация статей использует улучшенный алгоритм сопоставления тем для перераспределения статей по темам,
                основываясь на их содержимом. Этот процесс выполняется в фоновом режиме и может занять некоторое время.
              </Alert>
              
              <Button
                variant="outlined"
                color="primary"
                onClick={runRecategorizeArticles}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AutorenewIcon />}
              >
                {loading ? 'Запуск...' : 'Запустить перекатегоризацию статей'}
              </Button>
              
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => scraperAPI.runAnalyzer()}
                startIcon={<RefreshIcon />}
              >
                Запустить анализ неанализированных статей
              </Button>
            </Stack>
          </Box>
        </TabPanel>
      </Paper>
      
      {/* Уведомление */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        message={notification.message}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleCloseNotification}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Box>
  );
};

export default NLPAnalytics; 