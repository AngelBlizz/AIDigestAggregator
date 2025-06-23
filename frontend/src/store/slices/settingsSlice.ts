import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  language: string;
  theme: 'light' | 'dark';
  notifications: boolean;
}

const initialState: SettingsState = {
  language: 'en', // Английский язык по умолчанию
  theme: 'light', // Светлая тема по умолчанию
  notifications: true,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    toggleNotifications: (state) => {
      state.notifications = !state.notifications;
    },
  },
});

export const { setLanguage, setTheme, toggleNotifications } = settingsSlice.actions;
export default settingsSlice.reducer; 