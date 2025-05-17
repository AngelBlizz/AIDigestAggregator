import React from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Container,
  useTheme,
  useMediaQuery,
  CssBaseline,
} from '@mui/material';
import { Login as LoginIcon, PersonAdd as RegisterIcon } from '@mui/icons-material';
import { RootState } from '../store';
import { getTranslation } from '../services/translationService';

const PublicLayout: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { language } = useSelector((state: RootState) => state.settings);

  const translate = (text: string): string => {
    return getTranslation(text, language);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar 
        position="static" 
        color="transparent" 
        elevation={0}
        sx={{ 
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            {/* App Logo/Title */}
            <Typography 
              variant="h5" 
              component="div" 
              sx={{ 
                fontWeight: 700,
                cursor: 'pointer',
                background: 'linear-gradient(45deg, #6366F1 30%, #10B981 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
              onClick={() => navigate('/')}
            >
              {language === 'ru' ? 'AI Агрегатор Дайджестов' : 'AI Digest Aggregator'}
            </Typography>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                component={RouterLink}
                to="/login"
                color="primary"
                variant="outlined"
                startIcon={!isMobile && <LoginIcon />}
                sx={{ fontWeight: 600 }}
              >
                {translate('Login')}
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                color="primary"
                variant="contained"
                startIcon={!isMobile && <RegisterIcon />}
                sx={{ 
                  fontWeight: 600,
                  background: 'linear-gradient(to right, #6366F1, #10B981)',
                  '&:hover': {
                    background: 'linear-gradient(to right, #4F46E5, #059669)',
                  }
                }}
              >
                {translate('Register')}
              </Button>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Box sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
      
      <Box 
        component="footer" 
        sx={{ 
          py: 3, 
          borderTop: '1px solid', 
          borderColor: 'grey.200',
          mt: 'auto',
          bgcolor: 'background.paper'
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} {language === 'ru' ? 'AI Агрегатор Дайджестов' : 'AI Digest Aggregator'}. {translate('All rights reserved')}.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default PublicLayout; 