import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Switch,
  Snackbar,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { RootState } from '../store';
import { useAppDispatch } from '../hooks';
import { userTopicAPI, topicAPI } from '../services/api';
import {
  fetchUserTopicsStart,
  fetchUserTopicsSuccess,
  fetchUserTopicsFailure,
  addUserTopic,
  updateUserTopic,
  removeUserTopic,
  toggleUserTopicActive,
  UserTopic
} from '../store/slices/userTopicSlice';
import { fetchTopicsStart, fetchTopicsSuccess, fetchTopicsFailure } from '../store/slices/topicSlice';
import { useTranslation } from '../hooks/useTranslation';

interface UserTopicFormData {
  name: string;
  description: string;
  keywords: string;
  is_active: boolean;
}

const UserTopicsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { translate } = useTranslation();
  const { userTopics, loading, error } = useSelector((state: RootState) => state.userTopic);
  const { topics } = useSelector((state: RootState) => state.topic);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<number | null>(null);
  const [topicForm, setTopicForm] = useState<UserTopicFormData>({
    name: '',
    description: '',
    keywords: '',
    is_active: true
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<number | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchUserTopics = async () => {
      try {
        dispatch(fetchUserTopicsStart());
        const response = await userTopicAPI.getUserTopics();
        dispatch(fetchUserTopicsSuccess(response.data));
      } catch (error) {
        dispatch(fetchUserTopicsFailure('Failed to fetch user topics'));
      }
    };

    fetchUserTopics();
  }, [dispatch]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        dispatch(fetchTopicsStart());
        const response = await topicAPI.getTopics();
        dispatch(fetchTopicsSuccess(response.data));
      } catch (error) {
        dispatch(fetchTopicsFailure('Failed to fetch topics'));
      }
    };

    fetchTopics();
  }, [dispatch]);

  const handleCreateUserTopic = async () => {
    try {
      setIsSubmitting(true);
      
      // Подготовка данных для отправки
      const formData = { ...topicForm };
      
      // Проверяем, что keywords - валидный JSON
      if (formData.keywords) {
        try {
          // Если keywords уже в JSON формате, оставляем как есть
          JSON.parse(formData.keywords);
        } catch (e) {
          // Если не JSON, преобразуем в массив и затем в JSON строку
          const keywordArray = formData.keywords.split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);
          formData.keywords = JSON.stringify(keywordArray);
        }
      }
      
      console.log('Sending data to API:', formData);
      const response = await userTopicAPI.createUserTopic(formData);
      console.log('API response:', response);
      
      dispatch(addUserTopic(response.data));
      setOpenDialog(false);
      resetForm();
      showSnackbar(translate('Topic created successfully'));
    } catch (error: any) {
      console.error('Failed to create topic:', error);
      let errorMessage = translate('Failed to create topic');
      
      if (error.response) {
        console.error('Error response:', error.response.data);
        if (error.response.data?.detail) {
          errorMessage += `: ${error.response.data.detail}`;
        }
      }
      
      showSnackbar(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUserTopic = async () => {
    if (!currentTopic) return;
    
    try {
      setIsSubmitting(true);
      
      // Подготовка данных для отправки
      const formData = { ...topicForm };
      
      // Проверяем, что keywords - валидный JSON
      if (formData.keywords) {
        try {
          // Если keywords уже в JSON формате, оставляем как есть
          JSON.parse(formData.keywords);
        } catch (e) {
          // Если не JSON, преобразуем в массив и затем в JSON строку
          const keywordArray = formData.keywords.split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);
          formData.keywords = JSON.stringify(keywordArray);
        }
      }
      
      const response = await userTopicAPI.updateUserTopic(currentTopic, formData);
      dispatch(updateUserTopic(response.data));
      setEditDialogOpen(false);
      resetForm();
      showSnackbar(translate('Topic updated successfully'));
    } catch (error) {
      console.error('Failed to update topic:', error);
      showSnackbar(translate('Failed to update topic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUserTopic = async () => {
    if (!topicToDelete) return;
    
    try {
      setIsSubmitting(true);
      await userTopicAPI.deleteUserTopic(topicToDelete);
      dispatch(removeUserTopic(topicToDelete));
      setDeleteConfirmOpen(false);
      showSnackbar(translate('Topic deleted successfully'));
    } catch (error) {
      console.error('Failed to delete topic:', error);
      showSnackbar(translate('Failed to delete topic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (topicId: number) => {
    try {
      const topic = userTopics.find(t => t.id === topicId);
      if (!topic) return;
      
      await userTopicAPI.updateUserTopic(topicId, { is_active: !topic.is_active });
      dispatch(toggleUserTopicActive(topicId));
      showSnackbar(topic.is_active 
        ? translate('Topic deactivated') 
        : translate('Topic activated'));
    } catch (error) {
      console.error('Failed to toggle topic active state:', error);
      showSnackbar(translate('Failed to update topic'));
    }
  };

  const handleCopyFromTopic = async (topicId: number) => {
    try {
      setIsSubmitting(true);
      console.log(`Copying topic with ID: ${topicId}`);
      const response = await userTopicAPI.copyFromTopic(topicId);
      console.log('API response:', response);
      
      dispatch(addUserTopic(response.data));
      setCopyDialogOpen(false);
      showSnackbar(translate('Topic copied successfully'));
    } catch (error: any) {
      console.error('Failed to copy topic:', error);
      let errorMessage = translate('Failed to copy topic');
      
      if (error.response) {
        console.error('Error response:', error.response.data);
        if (error.response.data?.detail) {
          errorMessage += `: ${error.response.data.detail}`;
        }
      }
      
      showSnackbar(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyAllTopics = async () => {
    try {
      setIsSubmitting(true);
      console.log('Copying all topics');
      const response = await userTopicAPI.copyAllTopics();
      console.log('API response:', response);
      
      response.data.forEach((topic: UserTopic) => {
        dispatch(addUserTopic(topic));
      });
      setCopyDialogOpen(false);
      showSnackbar(translate('All topics copied successfully'));
    } catch (error: any) {
      console.error('Failed to copy all topics:', error);
      let errorMessage = translate('Failed to copy topics');
      
      if (error.response) {
        console.error('Error response:', error.response.data);
        if (error.response.data?.detail) {
          errorMessage += `: ${error.response.data.detail}`;
        }
      }
      
      showSnackbar(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (topic: UserTopic) => {
    setCurrentTopic(topic.id);
    setTopicForm({
      name: topic.name,
      description: topic.description,
      keywords: topic.keywords || '',
      is_active: topic.is_active
    });
    setEditDialogOpen(true);
  };

  const confirmDelete = (topicId: number) => {
    setTopicToDelete(topicId);
    setDeleteConfirmOpen(true);
  };

  const resetForm = () => {
    setTopicForm({
      name: '',
      description: '',
      keywords: '',
      is_active: true
    });
    setCurrentTopic(null);
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name) {
      setTopicForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name) {
      setTopicForm(prev => ({ ...prev, [name]: checked }));
    }
  };

  // Render keywords as chips
  const renderKeywords = (keywordsStr: string | undefined) => {
    if (!keywordsStr) return null;
    
    try {
      // Пытаемся распарсить как JSON
      const keywords = JSON.parse(keywordsStr);
      if (Array.isArray(keywords)) {
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {keywords.map((keyword, idx) => (
              <Chip key={idx} label={keyword} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        );
      }
    } catch (e) {
      // Если не получилось распарсить как JSON, разбиваем по запятым
      const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
      if (keywords.length > 0) {
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {keywords.map((keyword, idx) => (
              <Chip key={idx} label={keyword} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        );
      }
    }
    
    return null;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          {translate('My Topics')}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<CopyIcon />}
            onClick={() => setCopyDialogOpen(true)}
            sx={{ mr: 2 }}
          >
            {translate('Copy from General Topics')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            {translate('Add New Topic')}
          </Button>
        </Box>
      </Box>

      <Typography variant="body1" color="text.secondary" paragraph>
        {translate('Manage your topics to customize your news experience. These topics will be used for content aggregation and digest generation.')}
      </Typography>

      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && userTopics.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {translate('No topics available')}
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {translate('Create your own topics or copy them from general topics.')}
          </Typography>
          <Box>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<CopyIcon />}
              onClick={() => setCopyDialogOpen(true)}
              sx={{ mr: 2 }}
            >
              {translate('Copy from General Topics')}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              {translate('Create First Topic')}
            </Button>
          </Box>
        </Paper>
      )}

      {!loading && !error && userTopics.length > 0 && (
        <Grid container spacing={3}>
          {userTopics.map((topic) => (
            <Grid item xs={12} sm={6} md={4} key={topic.id}>
              <Card 
                variant="outlined" 
                sx={{ 
                  height: '100%',
                  opacity: topic.is_active ? 1 : 0.7,
                  transition: 'all 0.3s',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" component="div">
                      {topic.name}
                    </Typography>
                    <Tooltip title={topic.is_active ? translate('Active') : translate('Inactive')}>
                      <Switch
                        checked={topic.is_active}
                        onChange={() => handleToggleActive(topic.id)}
                        color="primary"
                      />
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {topic.description}
                  </Typography>
                  {renderKeywords(topic.keywords)}
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    startIcon={<EditIcon />}
                    onClick={() => openEditDialog(topic)}
                  >
                    {translate('Edit')}
                  </Button>
                  <Button 
                    size="small" 
                    color="error" 
                    startIcon={<DeleteIcon />}
                    onClick={() => confirmDelete(topic.id)}
                  >
                    {translate('Delete')}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Topic Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{translate('Add New Topic')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label={translate('Topic Name')}
            fullWidth
            value={topicForm.name}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            name="description"
            label={translate('Description')}
            fullWidth
            multiline
            rows={3}
            value={topicForm.description}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            name="keywords"
            label={translate('Keywords (comma separated or JSON array)')}
            fullWidth
            multiline
            rows={2}
            value={topicForm.keywords}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
            helperText={translate('Example: technology,ai,machine learning or ["technology","ai","machine learning"]')}
          />
          
          <Box display="flex" alignItems="center">
            <Switch
              name="is_active"
              checked={topicForm.is_active}
              onChange={handleSwitchChange}
              color="primary"
            />
            <Typography variant="body2">
              {translate('Active')}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={isSubmitting}>
            {translate('Cancel')}
          </Button>
          <Button 
            onClick={handleCreateUserTopic} 
            color="primary" 
            variant="contained"
            disabled={isSubmitting || !topicForm.name}
          >
            {isSubmitting ? (
              <CircularProgress size={24} />
            ) : (
              translate('Create')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Topic Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{translate('Edit Topic')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label={translate('Topic Name')}
            fullWidth
            value={topicForm.name}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            name="description"
            label={translate('Description')}
            fullWidth
            multiline
            rows={3}
            value={topicForm.description}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            name="keywords"
            label={translate('Keywords (comma separated or JSON array)')}
            fullWidth
            multiline
            rows={2}
            value={topicForm.keywords}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
            helperText={translate('Example: technology,ai,machine learning or ["technology","ai","machine learning"]')}
          />
          
          <Box display="flex" alignItems="center">
            <Switch
              name="is_active"
              checked={topicForm.is_active}
              onChange={handleSwitchChange}
              color="primary"
            />
            <Typography variant="body2">
              {translate('Active')}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
            {translate('Cancel')}
          </Button>
          <Button 
            onClick={handleUpdateUserTopic} 
            color="primary" 
            variant="contained"
            disabled={isSubmitting || !topicForm.name}
          >
            {isSubmitting ? (
              <CircularProgress size={24} />
            ) : (
              translate('Update')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{translate('Delete Topic')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('Are you sure you want to delete this topic? This action cannot be undone.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={isSubmitting}>
            {translate('Cancel')}
          </Button>
          <Button 
            onClick={handleDeleteUserTopic} 
            color="error" 
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <CircularProgress size={24} />
            ) : (
              translate('Delete')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy Topics Dialog */}
      <Dialog open={copyDialogOpen} onClose={() => setCopyDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{translate('Copy from General Topics')}</DialogTitle>
        <DialogContent>
          {topics.length === 0 ? (
            <Typography color="text.secondary">
              {translate('No general topics available to copy')}
            </Typography>
          ) : (
            <>
              <Box display="flex" justifyContent="flex-end" mb={2}>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={handleCopyAllTopics}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} />
                  ) : (
                    translate('Copy All Topics')
                  )}
                </Button>
              </Box>
              <Grid container spacing={2}>
                {topics.map((topic) => (
                  <Grid item xs={12} sm={6} key={topic.id}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight="bold">
                          {topic.name}
                        </Typography>
                        <IconButton 
                          color="primary" 
                          onClick={() => handleCopyFromTopic(topic.id)}
                          disabled={isSubmitting}
                        >
                          <CopyIcon />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {topic.description}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)}>
            {translate('Close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default UserTopicsPage; 