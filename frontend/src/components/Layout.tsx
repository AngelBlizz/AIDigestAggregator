import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  Avatar,
  Button,
  AppBar,
  Menu,
  MenuItem,
  Badge,
  ListItemButton,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Article as ArticleIcon,
  Settings as SettingsIcon,
  LogoutOutlined as LogoutIcon,
  Search as SearchIcon,
  BarChartOutlined as AnalyticsIcon,
  LabelOutlined as TopicIcon,
  RssFeedOutlined as ScraperIcon,
  PersonOutlined as ProfileIcon,
  HomeOutlined as HomeIcon,
  NotificationsOutlined as NotificationIcon,
  AddCircleOutlineOutlined as CreateIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { getTranslation } from '../services/translationService';

// Adjusted width for the drawer
const drawerWidth = 260;

// Добавим глобальные стили для скроллбара
const scrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '4px',
    height: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#bdbdbd',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: '#9e9e9e',
  },
  '&': {
    scrollbarWidth: 'thin',
    scrollbarColor: '#bdbdbd transparent',
  },
  overflowX: 'hidden',
  overflowY: 'auto',
};

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useSelector((state: RootState) => state.auth);
  const { language } = useSelector((state: RootState) => state.settings);

  // Automatically close drawer on mobile
  React.useEffect(() => {
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [isMobile]);

  // Close the drawer when location changes on mobile
  React.useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location, isMobile]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerOpenToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    handleMenuClose();
  };

  const translate = (text: string): string => {
    return getTranslation(text, language);
  };

  const menuItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/' },
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Digests', icon: <ArticleIcon />, path: '/digests' },
    { text: 'Advanced Search', icon: <SearchIcon />, path: '/search' },
    { text: 'My Topics', icon: <TopicIcon />, path: '/topics' },
    { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
    { text: 'NLP Analytics', icon: <PsychologyIcon />, path: '/nlp-analytics' },
    { text: 'Scraper', icon: <ScraperIcon />, path: '/scraper' },
    { text: 'Profile', icon: <ProfileIcon />, path: '/profile' },
  ];

  // Check if a path is active
  const isPathActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  // Render drawer content
  const renderDrawerContent = () => (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      ...scrollbarStyles
    }}>
      {/* Logo and app title */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: drawerOpen ? 'space-between' : 'center',
          py: 2,
          px: drawerOpen ? 2 : 1,
          flexShrink: 0,
        }}
      >
        {drawerOpen && (
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              fontWeight: 700,
              background: 'linear-gradient(45deg, #6366F1 30%, #10B981 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            {language === 'ru' ? 'AI Агрегатор' : 'AI Aggregator'}
          </Typography>
        )}
        
        <IconButton onClick={handleDrawerOpenToggle}>
          {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>
      
      <Divider sx={{ flexShrink: 0 }} />
      
      {/* Create button */}
      <Box sx={{ py: 2, px: 2, flexShrink: 0 }}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          startIcon={<CreateIcon />}
          onClick={() => navigate('/digests/create')}
          sx={{ 
            py: 1.2,
            textAlign: 'left',
            justifyContent: 'flex-start',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {drawerOpen ? translate('Generate Digest') : ''}
        </Button>
      </Box>
      
      {/* Main navigation items */}
      <List component="nav" sx={{ px: 1, flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {menuItems.map((item) => (
          <ListItem 
            disablePadding 
            key={item.text}
            sx={{ mb: 0.5 }}
          >
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={isPathActive(item.path)}
              sx={{ 
                borderRadius: 2,
                py: 1,
                minHeight: 48,
                whiteSpace: 'nowrap',
              }}
            >
              <ListItemIcon sx={{ 
                minWidth: drawerOpen ? 40 : 'auto',
                mr: drawerOpen ? 1 : 'auto',
                justifyContent: 'center',
                color: isPathActive(item.path) ? 'primary.main' : 'grey.700'
              }}>
                {item.icon}
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={translate(item.text)} />}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Divider sx={{ flexShrink: 0 }} />
      
      {/* Logout Button */}
      <List component="nav" sx={{ px: 1, pt: 1, pb: 2, flexShrink: 0 }}>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={handleLogout}
            sx={{ 
              borderRadius: 2,
              py: 1,
              minHeight: 48,
              color: 'error.main',
              whiteSpace: 'nowrap',
            }}
          >
            <ListItemIcon sx={{ 
              minWidth: drawerOpen ? 40 : 'auto',
              mr: drawerOpen ? 1 : 'auto',
              justifyContent: 'center',
              color: 'error.main'
            }}>
              <LogoutIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={translate('Logout')} />}
          </ListItemButton>
        </ListItem>
      </List>
      
      {/* User profile section */}
      <Box sx={{ p: 2, flexShrink: 0 }}>
        {user && (
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: drawerOpen ? 1 : 0,
              borderRadius: 2,
              '&:hover': { bgcolor: 'grey.100' }
            }}
            onClick={handleProfileMenuOpen}
          >
            <Avatar 
              alt={user.name} 
              src="/static/images/avatar/2.jpg"
              sx={{ width: 36, height: 36 }}
            />
            {drawerOpen && (
              <Box sx={{ ml: 2, overflow: 'hidden' }}>
                <Typography variant="subtitle2" noWrap>{user.name}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* Top AppBar - only visible on mobile */}
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{
            boxShadow: 1,
            zIndex: (theme) => theme.zIndex.drawer + 1,
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography 
              variant="h6" 
              noWrap 
              component="div" 
              sx={{ 
                flexGrow: 1,
                cursor: 'pointer',
                fontWeight: 700,
                background: 'linear-gradient(45deg, #6366F1 30%, #10B981 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
              onClick={() => navigate('/')}
            >
              {language === 'ru' ? 'AI Агрегатор Дайджестов' : 'AI Digest Aggregator'}
            </Typography>
            <IconButton
              color="inherit"
              aria-label="notifications"
            >
              <Badge badgeContent={4} color="error">
                <NotificationIcon />
              </Badge>
            </IconButton>
            <IconButton
              edge="end"
              color="inherit"
              aria-label="account of current user"
              onClick={handleProfileMenuOpen}
              sx={{ ml: 1 }}
            >
              <Avatar alt={user?.name} src="/static/images/avatar/2.jpg" sx={{ width: 32, height: 32 }} />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}
      
      {/* Sidebar navigation - permanent on desktop, temporary on mobile */}
      <Box
        component="nav"
        sx={{ 
          width: { md: drawerOpen ? drawerWidth : 72 },
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        {/* Mobile drawer (temporary) */}
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                borderRight: '1px solid rgba(0, 0, 0, 0.08)',
              },
            }}
          >
            {renderDrawerContent()}
          </Drawer>
        ) : (
          // Desktop drawer (permanent)
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                width: drawerOpen ? drawerWidth : 72,
                boxSizing: 'border-box',
                borderRight: '1px solid rgba(0, 0, 0, 0.08)',
                transition: theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
                overflowX: 'hidden',
              },
            }}
            open
          >
            {renderDrawerContent()}
          </Drawer>
        )}
      </Box>
      
      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerOpen ? drawerWidth : 72}px)` },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          mt: { xs: 8, md: 0 },
          overflow: 'hidden',
        }}
      >
        {!isMobile && <Toolbar />}
        <Outlet />
      </Box>
      
      {/* User profile menu */}
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.08))',
            mt: 1.5,
            width: 200,
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
          <ListItemIcon>
            <ProfileIcon fontSize="small" />
          </ListItemIcon>
          {translate('Profile')}
        </MenuItem>
        <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          {translate('Settings')}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          {translate('Logout')}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout; 