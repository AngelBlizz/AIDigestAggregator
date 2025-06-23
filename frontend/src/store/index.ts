import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import digestReducer from './slices/digestSlice';
import topicReducer from './slices/topicSlice';
import settingsReducer from './slices/settingsSlice';
import userTopicReducer from './slices/userTopicSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    digest: digestReducer,
    topic: topicReducer,
    settings: settingsReducer,
    userTopic: userTopicReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 