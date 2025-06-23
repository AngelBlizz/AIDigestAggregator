import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  CircularProgress, 
  Alert,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { nlpAPI } from '../services/api';

interface LanguageDetectionResult {
  status: string;
  language: string;
  text_sample: string;
}

// Словарь соответствия кодов языков их названиям
const languageNames: Record<string, string> = {
  'en': 'Английский',
  'ru': 'Русский',
  'de': 'Немецкий',
  'fr': 'Французский',
  'es': 'Испанский',
  'it': 'Итальянский',
  'pt': 'Португальский',
  'nl': 'Нидерландский',
  'pl': 'Польский',
  'cs': 'Чешский',
  'ja': 'Японский',
  'zh': 'Китайский',
  'ar': 'Арабский',
  'hi': 'Хинди',
  'ko': 'Корейский',
  'tr': 'Турецкий',
  'vi': 'Вьетнамский',
  'sv': 'Шведский',
  'da': 'Датский',
  'fi': 'Финский',
  'no': 'Норвежский',
  'uk': 'Украинский',
  'bg': 'Болгарский',
  'el': 'Греческий',
  'ro': 'Румынский',
  'sk': 'Словацкий',
  'th': 'Тайский',
};

interface HistoryItem extends LanguageDetectionResult {
  id: number;
  timestamp: Date;
}

const LanguageDetector: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [result, setResult] = useState<LanguageDetectionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleDetectLanguage = async () => {
    if (!text.trim()) {
      setError('Введите текст для определения языка');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await nlpAPI.detectLanguage(text);
      const resultData = response.data;
      setResult(resultData);
      
      // Добавляем результат в историю
      if (resultData.status === 'success') {
        const historyItem: HistoryItem = {
          ...resultData,
          id: Date.now(),
          timestamp: new Date()
        };
        setHistory(prev => [historyItem, ...prev].slice(0, 10)); // Ограничиваем историю 10 элементами
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при определении языка');
    } finally {
      setLoading(false);
    }
  };

  // Получение полного названия языка по коду
  const getLanguageName = (code: string): string => {
    return languageNames[code] || `Язык (${code})`;
  };

  // Получение флага эмодзи для языка
  const getLanguageFlag = (code: string): string => {
    const flagMap: Record<string, string> = {
      'en': '🇬🇧',
      'ru': '🇷🇺',
      'de': '🇩🇪',
      'fr': '🇫🇷',
      'es': '🇪🇸',
      'it': '🇮🇹',
      'pt': '🇵🇹',
      'nl': '🇳🇱',
      'pl': '🇵🇱',
      'cs': '🇨🇿',
      'ja': '🇯🇵',
      'zh': '🇨🇳',
      'ar': '🇸🇦',
      'hi': '🇮🇳',
      'ko': '🇰🇷',
      'tr': '🇹🇷',
      'vi': '🇻🇳',
      'sv': '🇸🇪',
      'da': '🇩🇰',
      'fi': '🇫🇮',
      'no': '🇳🇴',
      'uk': '🇺🇦',
      'bg': '🇧🇬',
      'el': '🇬🇷',
      'ro': '🇷🇴',
      'sk': '🇸🇰',
      'th': '🇹🇭',
    };
    
    return flagMap[code] || '🌐';
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleDeleteHistoryItem = (id: number) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleUseHistoryItem = (text: string) => {
    setText(text);
  };

  const renderComparisonTable = () => {
    if (history.length < 2) return null;
    
    // Группируем по языкам для сравнения
    const languageGroups: Record<string, number> = {};
    history.forEach(item => {
      languageGroups[item.language] = (languageGroups[item.language] || 0) + 1;
    });
    
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Сравнение обнаруженных языков
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(languageGroups)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, count]) => (
            <Grid item xs={6} sm={4} md={3} key={lang}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h3" component="span" sx={{ mr: 1 }}>
                      {getLanguageFlag(lang)}
                    </Typography>
                    <Typography variant="h6">
                      {getLanguageName(lang)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Обнаружен {count} {count === 1 ? 'раз' : 'раза'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Определение языка текста
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Введите текст для анализа"
              variant="outlined"
              value={text}
              onChange={handleTextChange}
              placeholder="Вставьте текст на любом языке для определения..."
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleDetectLanguage}
                disabled={loading || !text.trim()}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LanguageIcon />}
              >
                {loading ? 'Определение...' : 'Определить язык'}
              </Button>
              
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => setShowHistory(!showHistory)}
                startIcon={<HistoryIcon />}
                disabled={history.length === 0}
              >
                {showHistory ? 'Скрыть историю' : 'Показать историю'}
              </Button>
              
              {history.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleClearHistory}
                  startIcon={<DeleteIcon />}
                >
                  Очистить историю
                </Button>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && result.status === 'success' && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Typography variant="h1" component="span">
                  {getLanguageFlag(result.language)}
                </Typography>
              </Grid>
              <Grid item xs>
                <Typography variant="h6" gutterBottom>
                  Определен язык: 
                  <Chip 
                    label={getLanguageName(result.language)} 
                    color="primary" 
                    sx={{ ml: 1 }}
                  />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Код языка: {result.language}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight="bold">
                    Анализируемый текст:
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', mt: 1 }}>
                    <Typography variant="body2">
                      {result.text_sample}
                    </Typography>
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {showHistory && history.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                История определений
              </Typography>
              <Chip 
                icon={<CompareArrowsIcon />} 
                label={`${history.length} элементов`} 
                color="primary" 
                variant="outlined" 
              />
            </Box>
            
            <List>
              {history.map((item) => (
                <React.Fragment key={item.id}>
                  <ListItem
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleUseHistoryItem(item.text_sample)}
                    secondaryAction={
                      <IconButton edge="end" onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteHistoryItem(item.id);
                      }}>
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemIcon>
                      <Typography variant="h6">
                        {getLanguageFlag(item.language)}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body1">
                            {getLanguageName(item.language)}
                          </Typography>
                          <Tooltip title="Использовать этот текст">
                            <Chip 
                              size="small" 
                              label="Повторить" 
                              color="secondary" 
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUseHistoryItem(item.text_sample);
                              }}
                              sx={{ ml: 1 }}
                            />
                          </Tooltip>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 500 }}>
                            {item.text_sample.length > 100 
                              ? `${item.text_sample.substring(0, 100)}...` 
                              : item.text_sample}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.timestamp.toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
            
            {history.length > 1 && renderComparisonTable()}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default LanguageDetector; 