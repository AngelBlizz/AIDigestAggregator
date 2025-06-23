import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Snackbar,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  SelectChangeEvent,
  Tooltip,
  AlertTitle
} from '@mui/material';
import { 
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import { RootState } from '../store';
import {
  fetchTopicsStart,
  fetchTopicsSuccess,
  fetchTopicsFailure,
  setSelectedTopics,
  toggleTopic,
} from '../store/slices/topicSlice';
import { topicAPI, scraperAPI } from '../services/api';
import { useAppDispatch } from '../hooks';
import { Link } from 'react-router-dom';

// Define topic categories
const TOPIC_CATEGORIES = [
  { id: 'technology', name: 'Technology' },
  { id: 'business', name: 'Business' },
  { id: 'politics', name: 'Politics' },
  { id: 'health', name: 'Health' },
  { id: 'science', name: 'Science' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'sports', name: 'Sports' },
  { id: 'other', name: 'Other' }
];

// Define the Topic interface with optional is_selected
interface Topic {
  id: number;
  name: string;
  description: string;
  category?: string;
}

// Define TopicFormData
interface TopicFormData {
  name: string;
  description: string;
  category: string;
}

// Create a dedicated component for topic cards
const TopicCard: React.FC<{
  topic: Topic;
  isSelected: boolean;
  onToggle: (id: number) => void;
  onEdit: (topic: Topic) => void;
  onDelete: (id: number) => void;
}> = ({ topic, isSelected, onToggle, onEdit, onDelete }) => (
  <Grid item xs={12} sm={6} md={4}>
    <Card variant="outlined" sx={{ position: 'relative' }}>
      {isSelected && (
        <Chip 
          label="Выбрано" 
          color="primary" 
          size="small" 
          sx={{ 
            position: 'absolute', 
            top: -10, 
            right: 16,
            zIndex: 1 
          }} 
        />
      )}
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {topic.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {topic.description}
        </Typography>
        {topic.category && (
          <Chip 
            label={TOPIC_CATEGORIES.find(cat => cat.id === topic.category)?.name || topic.category} 
            size="small" 
            sx={{ mt: 1 }} 
          />
        )}
      </CardContent>
      <CardActions>
        <Switch
          edge="end"
          checked={isSelected}
          onChange={() => onToggle(topic.id)}
          inputProps={{ 'aria-labelledby': `topic-${topic.id}` }}
        />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            color="primary" 
            onClick={() => onEdit(topic)}
          >
            <EditIcon />
          </IconButton>
          <IconButton 
            size="small" 
            color="error" 
            onClick={() => onDelete(topic.id)}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </CardActions>
    </Card>
  </Grid>
);

const TopicPreferences: React.FC = () => {
  const dispatch = useAppDispatch();
  const { topics, selectedTopics, loading, error } = useSelector((state: RootState) => state.topic);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<number | null>(null);
  const [topicForm, setTopicForm] = useState<TopicFormData>({ 
    name: '', 
    description: '', 
    category: 'other' 
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleToggleTopic = async (topicId: number) => {
    try {
      await topicAPI.toggleTopic(topicId);
      dispatch(toggleTopic(topicId));
      showSnackbar('Topic subscription updated');
    } catch (error) {
      console.error('Failed to toggle topic:', error);
      showSnackbar('Failed to update subscription');
    }
  };

  const handleCreateTopic = async () => {
    try {
      const response = await topicAPI.createTopic(topicForm);
      dispatch(fetchTopicsSuccess([...topics, response.data]));
      setOpenDialog(false);
      resetForm();
      showSnackbar('Topic created successfully');
    } catch (error) {
      console.error('Failed to create topic:', error);
      showSnackbar('Failed to create topic');
    }
  };

  const handleUpdateTopic = async () => {
    if (!currentTopic) return;
    
    try {
      await topicAPI.updateTopic(currentTopic, topicForm);
      
      // Update the local state
      const updatedTopics = topics.map(topic => 
        topic.id === currentTopic 
          ? { ...topic, ...topicForm } 
          : topic
      );
      
      dispatch(fetchTopicsSuccess(updatedTopics));
      setEditDialogOpen(false);
      resetForm();
      showSnackbar('Topic updated successfully');
    } catch (error) {
      console.error('Failed to update topic:', error);
      showSnackbar('Failed to update topic');
    }
  };

  const handleDeleteTopic = async () => {
    if (!topicToDelete) return;
    
    try {
      await topicAPI.deleteTopic(topicToDelete);
      
      // Remove from local state
      const updatedTopics = topics.filter(topic => topic.id !== topicToDelete);
      dispatch(fetchTopicsSuccess(updatedTopics));
      
      // Remove from selected topics if present
      if (selectedTopics.includes(topicToDelete)) {
        const updatedSelectedTopics = selectedTopics.filter(id => id !== topicToDelete);
        dispatch(setSelectedTopics(updatedSelectedTopics));
      }
      
      setDeleteConfirmOpen(false);
      showSnackbar('Topic deleted successfully');
    } catch (error) {
      console.error('Failed to delete topic:', error);
      showSnackbar('Failed to delete topic');
    }
  };

  const openEditDialog = (topic: Topic) => {
    setCurrentTopic(topic.id);
    setTopicForm({
      name: topic.name,
      description: topic.description,
      category: topic.category || 'other'
    });
    setEditDialogOpen(true);
  };

  const confirmDelete = (topicId: number) => {
    setTopicToDelete(topicId);
    setDeleteConfirmOpen(true);
  };

  const resetForm = () => {
    setTopicForm({ name: '', description: '', category: 'other' });
    setCurrentTopic(null);
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Split the form change handlers for different input types
  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name) {
      setTopicForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    if (name) {
      setTopicForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Group topics by category
  const getTopicsByCategory = () => {
    const categorizedTopics: { [key: string]: Topic[] } = {};
    
    // Initialize all categories with empty arrays
    TOPIC_CATEGORIES.forEach(category => {
      categorizedTopics[category.id] = [];
    });
    
    // Distribute topics by category
    topics.forEach(topic => {
      const category = topic.category || 'other';
      if (categorizedTopics[category]) {
        categorizedTopics[category].push(topic);
      } else {
        categorizedTopics['other'].push(topic);
      }
    });
    
    return categorizedTopics;
  };

  const topicsByCategory = getTopicsByCategory();

  const TopicHelpAlert = () => (
    <Alert severity="info" sx={{ mb: 4 }}>
      <AlertTitle>Как работать с темами</AlertTitle>
      <Typography variant="body2" paragraph>
        1. Создайте новую тему или выберите из существующих, нажав на переключатель "Выбрать"
      </Typography>
      <Typography variant="body2" paragraph>
        2. Выбранные темы будут использоваться для сбора новостей и аналитики
      </Typography>
      <Typography variant="body2" paragraph>
        3. После выбора тем, запустите скрапер через кнопку "Собрать новости" или на странице "Сбор данных"
      </Typography>
      <Typography variant="body2">
        Важно: новости собираются только для выбранных тем (отмеченных как "Выбрано")
      </Typography>
    </Alert>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Topic Preferences
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add New Topic
        </Button>
      </Box>

      <Typography variant="body1" color="text.secondary" paragraph>
        Customize your news digest by selecting topics you're interested in. Toggle the switch to subscribe or unsubscribe.
      </Typography>

      {Object.entries(topicsByCategory).map(([category, categoryTopics]) => (
        categoryTopics.length > 0 && (
          <Box key={category} sx={{ mb: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {TOPIC_CATEGORIES.find(cat => cat.id === category)?.name || 'Other'}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              {categoryTopics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  isSelected={selectedTopics.includes(topic.id)}
                  onToggle={handleToggleTopic}
                  onEdit={openEditDialog}
                  onDelete={confirmDelete}
                />
              ))}
            </Grid>
          </Box>
        )
      ))}

      <TopicHelpAlert />

      {topics.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No topics available
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{ mt: 2 }}
          >
            Add Your First Topic
          </Button>
        </Paper>
      ) : (
        TOPIC_CATEGORIES.map(category => {
          const categoryTopics = topicsByCategory[category.id];
          if (categoryTopics.length === 0) return null;
          
          return (
            <Box key={category.id} mb={4}>
              <Box display="flex" alignItems="center" mb={2}>
                <Typography variant="h6">{category.name}</Typography>
                <Divider sx={{ flexGrow: 1, ml: 2 }} />
              </Box>
              
              <Grid container spacing={2}>
                {categoryTopics.map((topic) => (
                  <Grid item xs={12} sm={6} md={4} key={topic.id}>
                    <Paper
                      sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        position: 'relative',
                        overflow: 'visible'
                      }}
                    >
                      {selectedTopics.includes(topic.id) && (
                        <Chip 
                          label="Выбрано" 
                          color="primary" 
                          size="small" 
                          sx={{ 
                            position: 'absolute', 
                            top: -10, 
                            right: 16,
                            zIndex: 1 
                          }} 
                        />
                      )}
                      <Card variant="outlined">
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6" component="div">
                              {topic.name}
                            </Typography>
                            <Switch
                              checked={selectedTopics.includes(topic.id)}
                              onChange={() => handleToggleTopic(topic.id)}
                              color="primary"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {topic.description}
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button size="small" onClick={() => openEditDialog(topic)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" onClick={() => confirmDelete(topic.id)}>
                            Delete
                          </Button>
                        </CardActions>
                      </Card>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          );
        })
      )}

      {/* Create Topic Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Topic</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Topic Name"
            fullWidth
            value={topicForm.name}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel id="category-label">Category</InputLabel>
            <Select
              labelId="category-label"
              name="category"
              value={topicForm.category}
              onChange={handleSelectChange}
              label="Category"
            >
              {TOPIC_CATEGORIES.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            margin="dense"
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={topicForm.description}
            onChange={handleTextFieldChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateTopic} color="primary" variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Topic Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Topic</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Topic Name"
            fullWidth
            value={topicForm.name}
            onChange={handleTextFieldChange}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel id="edit-category-label">Category</InputLabel>
            <Select
              labelId="edit-category-label"
              name="category"
              value={topicForm.category}
              onChange={handleSelectChange}
              label="Category"
            >
              {TOPIC_CATEGORIES.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            margin="dense"
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={topicForm.description}
            onChange={handleTextFieldChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateTopic} color="primary" variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this topic? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteTopic} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />

      {/* Run scraper button */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => {
            if (selectedTopics.length === 0) {
              showSnackbar('Выберите хотя бы одну тему для сбора новостей');
              return;
            }
            setIsSubmitting(true);
            scraperAPI.runUserScraper()
              .then(response => {
                setSuccess('Сбор новостей запущен для выбранных тем');
                setIsSubmitting(false);
              })
              .catch(err => {
                showSnackbar('Ошибка запуска скрапера: ' + (err.response?.data?.message || err.message));
                setIsSubmitting(false);
              });
          }}
          disabled={isSubmitting || selectedTopics.length === 0}
          startIcon={<UpdateIcon />}
        >
          Собрать новости для выбранных тем
        </Button>
        
        <Button 
          variant="outlined"
          component={Link}
          to="/scraper"
        >
          Перейти к странице сбора данных
        </Button>
      </Box>
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
    </Box>
  );
};

export default TopicPreferences; 