import React, { useState, useEffect } from 'react';
import { Button, Menu, MenuItem, IconButton } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { useDispatch, useSelector } from 'react-redux';
import { setLanguage } from '../store/slices/settingsSlice';
import { RootState } from '../store';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
];

const LanguageSwitcher: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const dispatch = useDispatch();
  const currentLanguage = useSelector((state: RootState) => state.settings.language || 'en');
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageSelect = (code: string) => {
    dispatch(setLanguage(code));
    handleClose();
    
    // Сохраняем выбор языка в localStorage для сохранения между сессиями
    localStorage.setItem('preferredLanguage', code);
  };
  
  // При инициализации компонента загружаем сохраненный язык из localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage) {
      dispatch(setLanguage(savedLanguage));
    }
  }, [dispatch]);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        size="small"
        aria-controls="language-menu"
        aria-haspopup="true"
      >
        <LanguageIcon />
      </IconButton>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        {languages.map((lang) => (
          <MenuItem 
            key={lang.code} 
            onClick={() => handleLanguageSelect(lang.code)}
            selected={currentLanguage === lang.code}
          >
            {lang.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageSwitcher; 