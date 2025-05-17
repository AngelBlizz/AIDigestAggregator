import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { scraperAPI, topicAPI } from '../services/api';
import { NewsSource, Topic, ScraperResponse } from '../types';

const ScraperManager: React.FC = () => {
  // State for news sources
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // State for source editing
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null);
  const [openSourceDialog, setOpenSourceDialog] = useState<boolean>(false);
  const [sourceFormErrors, setSourceFormErrors] = useState<Record<string, string>>({});
  
  // State for scraper run dialog
  const [openRunDialog, setOpenRunDialog] = useState<boolean>(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [runningScrapers, setRunningScrapers] = useState<boolean>(false);
  
  // State for notifications
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });
  
  // State for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);
  
  // Default source for new entries
  const defaultSource: NewsSource = {
    key: '',
    name: '',
    url: '',
    article_selector: '',
    title_selector: '',
    content_selector: '',
    date_selector: '',
    date_format: 'YYYY-MM-DD',
  };
  
  // Load sources on component mount
  useEffect(() => {
    loadSources();
    loadTopics();
  }, []);
  
  // Load news sources from API
  const loadSources = async () => {
    setLoading(true);
    try {
      const response = await scraperAPI.getSourcesDetails();
      // Проверка структуры ответа и инициализация массивом, если данные отсутствуют
      if (response.data && response.data.sources && Array.isArray(response.data.sources)) {
        setSources(response.data.sources);
      } else if (Array.isArray(response.data)) {
        setSources(response.data);
      } else {
        console.error('Invalid sources data format:', response.data);
        setSources([]); // Инициализация пустым массивом
        showNotification('Некорректный формат данных источников', 'error');
      }
    } catch (error) {
      console.error('Error loading sources:', error);
      setSources([]); // Инициализация пустым массивом при ошибке
      showNotification('Не удалось загрузить источники новостей', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Load topics for scraper run dialog
  const loadTopics = async () => {
    try {
      const response = await topicAPI.getTopics();
      setTopics(response.data || []);
    } catch (error) {
      console.error('Error loading topics:', error);
      setTopics([]); // Инициализация пустым массивом при ошибке
    }
  };
  
  // Handle refreshing sources list
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSources();
    setRefreshing(false);
    showNotification('Список источников обновлен', 'success');
  };
  
  // Show notification
  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setNotification({
      open: true,
      message,
      severity,
    });
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification({
      ...notification,
      open: false,
    });
  };
  
  // Handle opening the source dialog for editing
  const handleEditSource = (source: NewsSource) => {
    setEditingSource({ ...source });
    setOpenSourceDialog(true);
  };
  
  // Handle opening the source dialog for creating new source
  const handleAddSource = () => {
    setEditingSource({ ...defaultSource, key: generateSourceKey() });
    setOpenSourceDialog(true);
    setSourceFormErrors({});
  };
  
  // Generate a source key based on name
  const generateSourceKey = () => {
    return `source_${new Date().getTime()}`;
  };
  
  // Handle closing the source dialog
  const handleCloseSourceDialog = () => {
    setOpenSourceDialog(false);
    setSourceFormErrors({});
  };
  
  // Handle changes to the source form fields
  const handleSourceChange = (field: keyof NewsSource, value: string) => {
    if (!editingSource) return;
    
    // Generate key from name if it's a new source
    if (field === 'name' && editingSource.key === defaultSource.key) {
      setEditingSource({
        ...editingSource,
        [field]: value,
        key: value.toLowerCase().replace(/\s+/g, '_'),
      });
    } else {
      setEditingSource({
        ...editingSource,
        [field]: value,
      });
    }
    
    // Clear error for this field
    if (sourceFormErrors[field]) {
      setSourceFormErrors({
        ...sourceFormErrors,
        [field]: '',
      });
    }
  };
  
  // Validate source form
  const validateSourceForm = (): boolean => {
    const errors: Record<string, string> = {};
    const requiredFields: (keyof NewsSource)[] = [
      'key', 'name', 'url', 'article_selector', 'title_selector', 'content_selector',
    ];
    
    requiredFields.forEach(field => {
      if (!editingSource || !editingSource[field]) {
        errors[field] = 'This field is required';
      }
    });
    
    // Validate URL format
    if (editingSource?.url && !/^https?:\/\/.+/.test(editingSource.url)) {
      errors.url = 'URL must start with http:// or https://';
    }
    
    // Check if key already exists (for new sources)
    const isNewSource = !sources.some(s => s.key === editingSource?.key);
    if (isNewSource && sources.some(s => s.key === editingSource?.key)) {
      errors.key = 'A source with this key already exists';
    }
    
    setSourceFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle saving a source
  const handleSaveSource = async () => {
    if (!validateSourceForm() || !editingSource) return;
    
    try {
      // In a real implementation, you would call an API to save the source
      // For now, we'll simulate it by updating the local state
      
      const isNewSource = !sources.some(s => s.key === editingSource.key);
      let updatedSources;
      
      if (isNewSource) {
        updatedSources = [...sources, editingSource];
        showNotification(`Source "${editingSource.name}" added successfully`, 'success');
      } else {
        updatedSources = sources.map(s => 
          s.key === editingSource.key ? editingSource : s
        );
        showNotification(`Source "${editingSource.name}" updated successfully`, 'success');
      }
      
      setSources(updatedSources);
      handleCloseSourceDialog();
      
    } catch (error) {
      console.error('Error saving source:', error);
      showNotification('Failed to save source', 'error');
    }
  };
  
  // Handle opening delete confirmation dialog
  const handleDeleteClick = (sourceKey: string) => {
    setSourceToDelete(sourceKey);
    setDeleteConfirmOpen(true);
  };
  
  // Handle confirming source deletion
  const handleConfirmDelete = async () => {
    if (!sourceToDelete) return;
    
    try {
      // In a real implementation, you would call an API to delete the source
      // For now, we'll simulate it by updating the local state
      const updatedSources = sources.filter(s => s.key !== sourceToDelete);
      const sourceName = sources.find(s => s.key === sourceToDelete)?.name || 'Source';
      
      setSources(updatedSources);
      showNotification(`Source "${sourceName}" deleted successfully`, 'success');
      
    } catch (error) {
      console.error('Error deleting source:', error);
      showNotification('Failed to delete source', 'error');
    } finally {
      setDeleteConfirmOpen(false);
      setSourceToDelete(null);
    }
  };
  
  // Handle opening run scraper dialog
  const handleOpenRunDialog = () => {
    setOpenRunDialog(true);
    setSelectedTopicId(null);
  };
  
  // Handle running the scraper
  const handleRunScraper = async () => {
    setRunningScrapers(true);
    
    try {
      const response = await scraperAPI.runScraper(selectedTopicId || undefined);
      const result = response.data as ScraperResponse;
      
      showNotification(result.message || 'Scraper started successfully', 'success');
      
    } catch (error) {
      console.error('Error running scraper:', error);
      showNotification('Failed to run scraper', 'error');
    } finally {
      setRunningScrapers(false);
      setOpenRunDialog(false);
    }
  };

  // Handle running the user-specific scraper
  const handleRunUserScraper = async () => {
    setRunningScrapers(true);
    try {
      const response = await scraperAPI.runUserScraper(selectedTopicId || undefined);
      showNotification(
        'Сбор новостей для пользователя запущен успешно. Это может занять несколько минут.',
        'success'
      );
    } catch (error) {
      console.error('Error running user scraper:', error);
      showNotification('Ошибка при запуске сбора новостей для пользователя', 'error');
    } finally {
      setRunningScrapers(false);
      setOpenRunDialog(false);
      setSelectedTopicId(null);
    }
  };

  // Handle running the analyzer
  const handleRunAnalyzer = async () => {
    setRunningScrapers(true);
    try {
      const response = await scraperAPI.runAnalyzer();
      showNotification(
        'Анализатор запущен успешно. Это может занять некоторое время.',
        'success'
      );
    } catch (error) {
      console.error('Error running analyzer:', error);
      showNotification('Ошибка при запуске анализатора', 'error');
    } finally {
      setRunningScrapers(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" gutterBottom>Управление источниками новостей</Typography>
        
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body1">
            Настройка источников новостей и ручной запуск скрапера.
          </Typography>
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={handleRefresh}
              disabled={refreshing}
              sx={{ mr: 1 }}
            >
              Обновить
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<PlayArrowIcon />} 
              onClick={handleOpenRunDialog}
              sx={{ mr: 1 }}
            >
              Запустить скрапер
            </Button>
            <Button 
              variant="contained" 
              color="secondary" 
              startIcon={<PlayArrowIcon />} 
              onClick={() => {
                setSelectedTopicId(null);
                handleRunUserScraper();
              }}
              sx={{ mr: 1 }}
            >
              Собрать для моих тем
            </Button>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<RefreshIcon />} 
              onClick={handleRunAnalyzer}
            >
              Запустить анализатор
            </Button>
          </Box>
        </Box>
        
        {/* News Sources Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Источники новостей</Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<AddIcon />}
              onClick={handleAddSource}
            >
              Добавить источник
            </Button>
          </Box>
          
          <TableContainer sx={{ maxHeight: 600 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : sources.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1">No news sources configured.</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Add a source to start scraping news.
                </Typography>
              </Box>
            ) : (
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell>Article Selector</TableCell>
                    <TableCell>Title Selector</TableCell>
                    <TableCell>Content Selector</TableCell>
                    <TableCell>Date Format</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.key} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {source.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Key: {source.key}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={source.url}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {source.url}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={source.article_selector} 
                          size="small" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={source.title_selector} 
                          size="small" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={source.content_selector} 
                          size="small" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>{source.date_format}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={() => handleEditSource(source)}
                          size="small"
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDeleteClick(source.key)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </Paper>
        
        {/* Source Edit Dialog */}
        <Dialog open={openSourceDialog} onClose={handleCloseSourceDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingSource && sources.some(s => s.key === editingSource.key)
              ? `Edit Source: ${editingSource.name}`
              : 'Add New Source'
            }
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Name"
                  fullWidth
                  value={editingSource?.name || ''}
                  onChange={(e) => handleSourceChange('name', e.target.value)}
                  error={!!sourceFormErrors.name}
                  helperText={sourceFormErrors.name}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Key (unique identifier)"
                  fullWidth
                  value={editingSource?.key || ''}
                  onChange={(e) => handleSourceChange('key', e.target.value)}
                  error={!!sourceFormErrors.key}
                  helperText={sourceFormErrors.key || 'Unique identifier for this source'}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Website URL"
                  fullWidth
                  value={editingSource?.url || ''}
                  onChange={(e) => handleSourceChange('url', e.target.value)}
                  error={!!sourceFormErrors.url}
                  helperText={sourceFormErrors.url || 'Full URL to the news source website'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Article Selector"
                  fullWidth
                  value={editingSource?.article_selector || ''}
                  onChange={(e) => handleSourceChange('article_selector', e.target.value)}
                  error={!!sourceFormErrors.article_selector}
                  helperText={sourceFormErrors.article_selector || 'CSS selector for article elements'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Title Selector"
                  fullWidth
                  value={editingSource?.title_selector || ''}
                  onChange={(e) => handleSourceChange('title_selector', e.target.value)}
                  error={!!sourceFormErrors.title_selector}
                  helperText={sourceFormErrors.title_selector || 'CSS selector for article title'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Content Selector"
                  fullWidth
                  value={editingSource?.content_selector || ''}
                  onChange={(e) => handleSourceChange('content_selector', e.target.value)}
                  error={!!sourceFormErrors.content_selector}
                  helperText={sourceFormErrors.content_selector || 'CSS selector for article content'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date Selector"
                  fullWidth
                  value={editingSource?.date_selector || ''}
                  onChange={(e) => handleSourceChange('date_selector', e.target.value)}
                  error={!!sourceFormErrors.date_selector}
                  helperText={sourceFormErrors.date_selector || 'CSS selector for article date'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date Format"
                  fullWidth
                  value={editingSource?.date_format || ''}
                  onChange={(e) => handleSourceChange('date_format', e.target.value)}
                  helperText="Format string for parsing dates (e.g., YYYY-MM-DD)"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSourceDialog}>Cancel</Button>
            <Button onClick={handleSaveSource} variant="contained" color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Run Scraper Dialog */}
        <Dialog open={openRunDialog} onClose={() => setOpenRunDialog(false)}>
          <DialogTitle>Запустить сбор новостей</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Выберите тему для сбора статей или оставьте пустым для сбора по всем темам.
            </DialogContentText>
            <FormControl fullWidth margin="normal">
              <InputLabel id="topic-select-label">Тема</InputLabel>
              <Select
                labelId="topic-select-label"
                id="topic-select"
                value={selectedTopicId || ''}
                onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : null)}
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
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenRunDialog(false)} color="primary">
              Отмена
            </Button>
            <Button 
              onClick={handleRunScraper} 
              color="primary" 
              disabled={runningScrapers}
            >
              {runningScrapers ? <CircularProgress size={24} /> : 'Запустить (админ)'}
            </Button>
            <Button 
              onClick={handleRunUserScraper} 
              color="secondary" 
              disabled={runningScrapers}
            >
              {runningScrapers ? <CircularProgress size={24} /> : 'Запустить для моих тем'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
          <DialogTitle>Delete News Source</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this news source? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmDelete} color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Notification Snackbar */}
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default ScraperManager; 