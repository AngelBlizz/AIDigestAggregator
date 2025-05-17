import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Container,
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  VpnKey as VpnKeyIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Notifications as NotificationsIcon,
  Translate as TranslateIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { RootState } from '../store';
import { updateProfile } from '../store/slices/authSlice';
import { setLanguage } from '../store/slices/settingsSlice';
import { getTranslation } from '../services/translationService';
import { useAppDispatch } from '../hooks';
import { User } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { language } = useSelector((state: RootState) => state.settings);
  
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Профиль
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Пароль
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Языковые настройки
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' },
  ];
  
  // Translate function
  const translate = (text: string): string => {
    return getTranslation(text, language);
  };
  
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleEditProfile = () => {
    setIsEditingProfile(true);
  };
  
  const handleCancelEditProfile = () => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
    setIsEditingProfile(false);
  };
  
  const handleUpdateProfile = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await dispatch(updateProfile({ name, email })).unwrap();
      setSuccess(translate('Profile updated successfully'));
      setIsEditingProfile(false);
    } catch (err: any) {
      setError(err?.message || translate('Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleChangePassword = async () => {
    // Валидация паролей
    if (newPassword !== confirmPassword) {
      setError(translate('New passwords do not match'));
      return;
    }
    
    if (newPassword.length < 8) {
      setError(translate('Password must be at least 8 characters long'));
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await dispatch(updateProfile({
        // Отправляем пароль согласно API
        password: newPassword
      })).unwrap();
      
      setSuccess(translate('Password changed successfully'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || translate('Failed to change password'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleChangeLanguage = (lang: string) => {
    dispatch(setLanguage(lang));
    setSuccess(translate('Language changed successfully'));
  };
  
  // Форматирование даты (если есть)
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };
  
  // Determine if user has the right shape for our User type
  const userHasCreatedAt = user && 'created_at' in user;
  
  return (
    <Container maxWidth="lg">
      <Box 
        sx={{ 
          mb: 4,
          p: 3,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #3f51b5 0%, #757de8 100%)',
          boxShadow: '0 10px 15px rgba(63, 81, 181, 0.1)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
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
            {translate("Your Profile")}
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 3, opacity: 0.9, maxWidth: '800px' }}>
            {translate("Manage your personal information, security settings, and preferences.")}
          </Typography>
        </Box>
      </Box>
      
      {(success || error) && (
        <Box sx={{ mb: 3 }}>
          {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        </Box>
      )}
      
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: 4, 
          border: '1px solid',
          borderColor: 'grey.200',
          mb: 4,
        }}
      >
        <Box sx={{ p: 2 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ 
              '& .MuiTab-root': { 
                minWidth: 'unset',
                fontWeight: 600,
                textTransform: 'none',
                px: 3
              } 
            }}
          >
            <Tab 
              icon={<PersonIcon fontSize="small" />} 
              iconPosition="start" 
              label={translate("Profile")} 
            />
            <Tab 
              icon={<VpnKeyIcon fontSize="small" />} 
              iconPosition="start" 
              label={translate("Security")} 
            />
            <Tab 
              icon={<TranslateIcon fontSize="small" />} 
              iconPosition="start" 
              label={translate("Language")} 
            />
            <Tab 
              icon={<NotificationsIcon fontSize="small" />} 
              iconPosition="start" 
              label={translate("Notifications")} 
            />
            <Tab 
              icon={<SettingsIcon fontSize="small" />} 
              iconPosition="start" 
              label={translate("Preferences")} 
            />
          </Tabs>
        </Box>
        
        <Divider />
        
        <Box sx={{ px: 3 }}>
          {/* Профиль */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Avatar
                    src=""
                    alt={user?.name || 'User'}
                    sx={{ 
                      width: 150, 
                      height: 150, 
                      mb: 2, 
                      bgcolor: 'primary.main',
                      fontSize: '3rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </Avatar>
                  
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    {user?.name}
                  </Typography>
                  
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    {user?.email}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary">
                    {translate("Member since")}: {userHasCreatedAt ? formatDate((user as User).created_at) : ''}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={8}>
                <Card 
                  elevation={0} 
                  sx={{ 
                    borderRadius: 4, 
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {translate("Personal Information")}
                      </Typography>
                      
                      {!isEditingProfile ? (
                        <Button 
                          variant="outlined" 
                          startIcon={<EditIcon />} 
                          onClick={handleEditProfile}
                          size="small"
                        >
                          {translate("Edit")}
                        </Button>
                      ) : (
                        <Button 
                          variant="text" 
                          onClick={handleCancelEditProfile}
                          size="small"
                        >
                          {translate("Cancel")}
                        </Button>
                      )}
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          label={translate("Name")}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          fullWidth
                          disabled={!isEditingProfile}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label={translate("Email")}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          fullWidth
                          disabled={!isEditingProfile}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            ),
                          }}
                        />
                      </Grid>
                      
                      {isEditingProfile && (
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button 
                              variant="contained" 
                              color="primary" 
                              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                              onClick={handleUpdateProfile}
                              disabled={loading}
                            >
                              {translate("Save Changes")}
                            </Button>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* Безопасность */}
          <TabPanel value={tabValue} index={1}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: 4, 
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {translate("Change Password")}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {translate("Please enter your current password and choose a new secure password.")}
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      label={translate("Current Password")}
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      fullWidth
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <VpnKeyIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        ),
                        endAdornment: (
                          <IconButton
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            edge="end"
                          >
                            {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={translate("New Password")}
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      fullWidth
                      variant="outlined"
                      InputProps={{
                        endAdornment: (
                          <IconButton
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            edge="end"
                          >
                            {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={translate("Confirm New Password")}
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      fullWidth
                      variant="outlined"
                      InputProps={{
                        endAdornment: (
                          <IconButton
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        onClick={handleChangePassword}
                        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                      >
                        {translate("Change Password")}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>
          
          {/* Язык */}
          <TabPanel value={tabValue} index={2}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: 4, 
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {translate("Language Settings")}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {translate("Choose your preferred language for the interface.")}
                </Typography>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                  {languages.map((lang) => (
                    <Chip
                      key={lang.code}
                      label={lang.name}
                      onClick={() => handleChangeLanguage(lang.code)}
                      color={language === lang.code ? 'primary' : 'default'}
                      variant={language === lang.code ? 'filled' : 'outlined'}
                      sx={{ 
                        p: 2, 
                        fontSize: '1rem',
                        fontWeight: language === lang.code ? 600 : 400,
                        borderWidth: 2,
                        '&:hover': {
                          borderWidth: 2,
                        },
                      }}
                      icon={<TranslateIcon />}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </TabPanel>
          
          {/* Уведомления */}
          <TabPanel value={tabValue} index={3}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: 4, 
                border: '1px solid',
                borderColor: 'grey.200',
                p: 4,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 200,
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <NotificationsIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {translate("Notification Settings")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {translate("Notification settings will be available in future updates.")}
                </Typography>
              </Box>
            </Card>
          </TabPanel>
          
          {/* Настройки */}
          <TabPanel value={tabValue} index={4}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: 4, 
                border: '1px solid',
                borderColor: 'grey.200',
                p: 4,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 200,
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <SettingsIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {translate("Preference Settings")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {translate("Additional preferences will be available in future updates.")}
                </Typography>
              </Box>
            </Card>
          </TabPanel>
        </Box>
      </Paper>
    </Container>
  );
};

export default Profile; 