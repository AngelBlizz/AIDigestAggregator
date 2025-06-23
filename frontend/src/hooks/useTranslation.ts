import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { getTranslation } from '../services/translationService';

export const useTranslation = () => {
  const { language } = useSelector((state: RootState) => state.settings);
  
  const translate = (text: string): string => {
    return getTranslation(text, language);
  };
  
  return { translate, language };
}; 