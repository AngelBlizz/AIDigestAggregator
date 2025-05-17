import React from 'react';
import { Card, CardContent, CardActions, Typography, Button, Box, Chip, CardMedia, Grid } from '@mui/material';
import { ThumbUp, ThumbDown, Launch, Bookmark, BookmarkBorder } from '@mui/icons-material';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';

interface ArticleCardProps {
  article: {
    id: number;
    title: string;
    content?: string;
    summary?: string;
    url: string;
    source: string;
    published_at: string;
    sentiment_score?: number;
    image_url?: string;
    topic_name?: string;
  };
  onSaveClick?: (id: number) => void;
  isSaved?: boolean;
  onClick?: () => void;
  elevation?: number;
}

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
}));

const CardImageWrapper = styled(CardMedia)(({ theme }) => ({
  height: 160,
  position: 'relative',
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
}));

const SourceChip = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  right: 12,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  zIndex: 2,
  fontWeight: 600,
  fontSize: '0.75rem',
}));

const TopicChip = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  left: 12,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  zIndex: 2,
  fontWeight: 600,
  fontSize: '0.75rem',
}));

const ArticleTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  marginBottom: theme.spacing(1),
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minHeight: '2.6em',
}));

const ArticleSummary = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginBottom: theme.spacing(1),
  minHeight: '4.5em',
}));

const PublishedDate = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.85rem',
  marginTop: theme.spacing(1),
}));

const sentimentColor = (score: number | undefined) => {
  if (score === undefined) return '#9e9e9e';
  if (score > 0.5) return '#4caf50';
  if (score > 0.1) return '#8bc34a';
  if (score > -0.1) return '#9e9e9e';
  if (score > -0.5) return '#ff9800';
  return '#f44336';
};

const SentimentChip = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'sentimentScore',
})<{ sentimentScore?: number }>(({ theme, sentimentScore }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  backgroundColor: sentimentColor(sentimentScore),
  color: sentimentScore && Math.abs(sentimentScore) > 0.1 ? '#fff' : '#333',
  padding: '4px 8px',
  borderRadius: 16,
  fontSize: '0.75rem',
  fontWeight: 600,
}));

const ArticleCardActions = styled(CardActions)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1, 2),
  justifyContent: 'space-between',
}));

const ArticleCard: React.FC<ArticleCardProps> = ({ 
  article, 
  onSaveClick, 
  isSaved = false, 
  onClick,
  elevation = 3
}) => {
  const { 
    id, 
    title, 
    summary, 
    content, 
    url, 
    source, 
    published_at, 
    sentiment_score,
    image_url,
    topic_name
  } = article;
  
  // Format the published date
  const formattedDate = published_at 
    ? format(new Date(published_at), 'MMM dd, yyyy')
    : 'Unknown date';
  
  // Generate a placeholder image using the title
  const placeholderImage = `https://source.unsplash.com/300x200/?${
    topic_name?.toLowerCase() || 'news'
  }`;
  
  return (
    <StyledCard elevation={elevation} onClick={onClick}>
      <Box sx={{ position: 'relative' }}>
        <CardImageWrapper
          image={image_url || placeholderImage}
          title={title}
        />
        {source && <SourceChip label={source} size="small" />}
        {topic_name && <TopicChip label={topic_name} size="small" />}
      </Box>
      <CardContent sx={{ flexGrow: 1, padding: 2, display: 'flex', flexDirection: 'column' }}>
        <ArticleTitle variant="h6">
          {title}
        </ArticleTitle>
        <ArticleSummary variant="body2">
          {summary || content?.substring(0, 150) || 'No content available'}
        </ArticleSummary>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
          <PublishedDate variant="caption">
            {formattedDate}
          </PublishedDate>
          {sentiment_score !== undefined && (
            <SentimentChip sentimentScore={sentiment_score}>
              {sentiment_score > 0.1 ? <ThumbUp fontSize="small" /> : 
               sentiment_score < -0.1 ? <ThumbDown fontSize="small" /> : null}
              {sentiment_score > 0.5 ? 'Positive' : 
               sentiment_score > 0.1 ? 'Slightly Positive' : 
               sentiment_score > -0.1 ? 'Neutral' : 
               sentiment_score > -0.5 ? 'Slightly Negative' : 'Negative'}
            </SentimentChip>
          )}
        </Box>
      </CardContent>
      <ArticleCardActions>
        <Button 
          size="small" 
          startIcon={<Launch />} 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Read More
        </Button>
        {onSaveClick && (
          <Button 
            size="small" 
            startIcon={isSaved ? <Bookmark /> : <BookmarkBorder />}
            onClick={(e) => {
              e.stopPropagation();
              onSaveClick(id);
            }}
          >
            {isSaved ? 'Saved' : 'Save'}
          </Button>
        )}
      </ArticleCardActions>
    </StyledCard>
  );
};

export default ArticleCard; 