import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Container,
  Typography,
  TextField,
  Button,
  Link,
  Box,
  Alert,
  IconButton,
  InputAdornment,
  Avatar,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { login } from '../store/slices/authSlice';
import { RootState } from '../store';
import { useAppDispatch } from '../hooks';
import { getTranslation } from '../services/translationService';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const { language } = useSelector((state: RootState) => state.settings);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);

  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: '',
  });
  
  // Translate function
  const translate = (text: string): string => {
    return getTranslation(text, language);
  };

  const validateForm = () => {
    let isValid = true;
    const errors = {
      email: '',
      password: '',
    };

    if (!formData.email) {
      errors.email = translate('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = translate('Email is invalid');
      isValid = false;
    }

    if (!formData.password) {
      errors.password = translate('Password is required');
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = translate('Password must be at least 6 characters');
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const resultAction = await dispatch(login(formData));
      if (login.fulfilled.match(resultAction)) {
        navigate('/');
      }
    } catch (error: any) {
      console.error(translate('Login error:'), error);
    }
  };
  
  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container component="main" maxWidth="sm" sx={{ flex: 1, display: 'flex', alignItems: 'center', py: 4 }}>
      <Card 
        elevation={0} 
        sx={{ 
          width: '100%',
          borderRadius: 4,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
          <Box 
            sx={{ 
              width: { xs: '100%', md: '40%' },
              background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
              color: 'white',
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
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
              <Avatar 
                sx={{ 
                  width: 60, 
                  height: 60, 
                  bgcolor: 'white', 
                  color: 'primary.main',
                  mb: 2,
                }}
              >
                <AutoAwesomeIcon fontSize="large" />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {translate("Welcome back")}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
                {translate("Log in to your account to view your digests and explore content.")}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  • {translate("Generate AI-powered content digests")}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  • {translate("Customize topics of interest")}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  • {translate("Analyze sentiment and trends")}
                </Typography>
              </Box>
            </Box>
          </Box>
          
          <CardContent 
            sx={{ 
              width: { xs: '100%', md: '60%' }, 
              p: 4,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {translate("Login")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {translate("Enter your credentials to access your account")}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label={translate("Email address")}
                name="email"
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={handleChange}
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label={translate("Password")}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                error={!!validationErrors.password}
                helperText={validationErrors.password}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePassword}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Link component={RouterLink} to="/forgot-password" variant="body2">
                  {translate("Forgot password?")}
                </Link>
              </Box>
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ 
                  py: 1.5, 
                  fontWeight: 600,
                  background: 'linear-gradient(to right, #6366F1, #818CF8)',
                  '&:hover': {
                    background: 'linear-gradient(to right, #4F46E5, #6366F1)',
                  },
                }}
                disabled={loading}
              >
                {loading ? translate('Logging in...') : translate('Login')}
              </Button>
              
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {translate("OR")}
                </Typography>
              </Divider>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {translate("Don't have an account?")}
                </Typography>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="outlined"
                  fullWidth
                  sx={{ py: 1.5, fontWeight: 600 }}
                >
                  {translate("Create Account")}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Box>
      </Card>
    </Container>
  );
};

export default Login; 