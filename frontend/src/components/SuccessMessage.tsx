import React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';

interface SuccessMessageProps {
  message: string;
  title?: string;
  fullWidth?: boolean;
}

const SuccessMessage: React.FC<SuccessMessageProps> = ({
  message,
  title = 'Success',
  fullWidth = false,
}) => {
  return (
    <Box width={fullWidth ? '100%' : 'auto'} my={2}>
      <Alert severity="success">
        <AlertTitle>{title}</AlertTitle>
        {message}
      </Alert>
    </Box>
  );
};

export default SuccessMessage; 