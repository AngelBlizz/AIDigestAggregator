import React from 'react';
import { 
  Card, 
  CardContent, 
  CardActions, 
  Typography, 
  Button, 
  Box, 
  Badge, 
  Chip, 
  CardHeader,
  Avatar
} from '@mui/material';
import { 
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  NavigateNext as NavigateNextIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';

interface DigestCardProps {
  digest: {
    id: number;
    title: string;
    created_at: string;
    is_read: boolean;
    articles: Array<{
      id: number;
      title: string;
      source?: string;
      topic_name?: string;
    }>;
  };
  onViewClick: (id: number) => void;
  onMarkAsReadClick?: (id: number) => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  overflow: 'hidden',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
}));

const DigestBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -5,
    top: 5,
    padding: '0 6px',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  }
}));

const DigestAvatar = styled(Avatar)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
}));

const ReadStatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'isRead',
})<{ isRead: boolean }>(({ theme, isRead }) => ({
  backgroundColor: isRead ? theme.palette.grey[200] : theme.palette.secondary.light,
  color: isRead ? theme.palette.text.secondary : theme.palette.secondary.contrastText,
  fontWeight: 600,
  fontSize: '0.7rem',
  height: 24,
}));

const DigestTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: 1,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const ArticleList = styled(Box)(({ theme }) => ({
  margin: theme.spacing(2, 0),
}));

const ArticleItem = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 0),
  borderBottom: `1px dashed ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const ArticleItemTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.text.primary,
  display: '-webkit-box',
  WebkitLineClamp: 1,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const SourceLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
}));

const DigestCardActions = styled(CardActions)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1, 2),
  justifyContent: 'space-between',
}));

const DigestCard: React.FC<DigestCardProps> = ({ 
  digest, 
  onViewClick,
  onMarkAsReadClick
}) => {
  const { id, title, created_at, is_read, articles = [] } = digest;
  
  // Format the created date
  const formattedDate = created_at 
    ? format(new Date(created_at), 'MMM dd, yyyy')
    : 'Unknown date';
  
  // Display a maximum of 3 articles in the preview
  const previewArticles = articles.slice(0, 3);
  const remainingCount = articles.length - previewArticles.length;
  
  return (
    <DigestBadge badgeContent={!is_read ? 'NEW' : 0} color="primary" invisible={is_read}>
      <StyledCard>
        <CardHeader
          avatar={
            <DigestAvatar>
              <DescriptionIcon />
            </DigestAvatar>
          }
          title={
            <DigestTitle variant="h6">
              {title}
            </DigestTitle>
          }
          subheader={formattedDate}
          action={
            <ReadStatusChip 
              isRead={is_read}
              label={is_read ? 'Read' : 'Unread'} 
              icon={is_read ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
              size="small"
            />
          }
        />
        <CardContent sx={{ flexGrow: 1, pt: 0 }}>
          <ArticleList>
            {previewArticles.map((article) => (
              <ArticleItem key={article.id}>
                <ArticleItemTitle variant="body2">
                  {article.title}
                </ArticleItemTitle>
                {article.source && (
                  <SourceLabel>
                    {article.source} {article.topic_name && `• ${article.topic_name}`}
                  </SourceLabel>
                )}
              </ArticleItem>
            ))}
            
            {remainingCount > 0 && (
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                <Chip 
                  label={`+${remainingCount} more articles`} 
                  size="small" 
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              </Box>
            )}
          </ArticleList>
        </CardContent>
        <DigestCardActions>
          <Button 
            size="small" 
            variant="contained" 
            color="primary"
            onClick={() => onViewClick(id)}
            endIcon={<NavigateNextIcon />}
          >
            View Digest
          </Button>
          
          {onMarkAsReadClick && !is_read && (
            <Button 
              size="small"
              onClick={() => onMarkAsReadClick(id)}
              startIcon={<VisibilityIcon />}
            >
              Mark as Read
            </Button>
          )}
        </DigestCardActions>
      </StyledCard>
    </DigestBadge>
  );
};

export default DigestCard; 