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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { register } from '../store/slices/authSlice';
import { RootState } from '../store';
import { useAppDispatch } from '../hooks';
import { getTranslation } from '../services/translationService';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const { language } = useSelector((state: RootState) => state.settings);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const [validationErrors, setValidationErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: '',
  });
  
  // Translate function
  const translate = (text: string): string => {
    return getTranslation(text, language);
  };

  const validateForm = () => {
    let isValid = true;
    const errors = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: '',
    };

    if (!formData.name) {
      errors.name = translate('Name is required');
      isValid = false;
    }

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

    if (!formData.confirmPassword) {
      errors.confirmPassword = translate('Please confirm your password');
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = translate('Passwords do not match');
      isValid = false;
    }
    
    if (!agreeToTerms) {
      errors.terms = translate('You must agree to the Terms and Privacy Policy');
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
  
  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };
  
  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password
      };
      
      const resultAction = await dispatch(register(userData));
      if (register.fulfilled.match(resultAction)) {
        navigate('/');
      }
    } catch (error: any) {
      console.error(translate('Registration error:'), error);
    }
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
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
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
                  color: 'secondary.main',
                  mb: 2,
                }}
              >
                <AutoAwesomeIcon fontSize="large" />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {translate("Join AI Digest Aggregator")}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
                {translate("Create an account to start generating personalized content digests.")}
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
              {translate("Register")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {translate("Create your account to get started")}
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
                id="name"
                label={translate("Full Name")}
                name="name"
                autoFocus
                value={formData.name}
                onChange={handleChange}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label={translate("Email address")}
                name="email"
                autoComplete="email"
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
                autoComplete="new-password"
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
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label={translate("Confirm Password")}
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={!!validationErrors.confirmPassword}
                helperText={validationErrors.confirmPassword}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={handleToggleConfirmPassword}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2">
                    {translate("By signing up, you agree to our")} <Link component={RouterLink} to="/terms">{translate("Terms of Service")}</Link> {translate("and")} <Link component={RouterLink} to="/privacy">{translate("Privacy Policy")}</Link>
                  </Typography>
                }
              />
              {validationErrors.terms && (
                <Typography variant="caption" color="error" sx={{ display: 'block', ml: 2 }}>
                  {validationErrors.terms}
                </Typography>
              )}
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ 
                  mt: 3,
                  py: 1.5, 
                  fontWeight: 600,
                  background: 'linear-gradient(to right, #10B981, #34D399)',
                  '&:hover': {
                    background: 'linear-gradient(to right, #059669, #10B981)',
                  },
                }}
                disabled={loading}
              >
                {loading ? translate('Registering...') : translate('Sign up')}
              </Button>
              
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {translate("OR")}
                </Typography>
              </Divider>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {translate("Already have an account?")}
                </Typography>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  fullWidth
                  sx={{ py: 1.5, fontWeight: 600 }}
                >
                  {translate("Login")}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Box>
      </Card>
    </Container>
  );
};

export default Register; 