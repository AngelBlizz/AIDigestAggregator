import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UserTopic {
  id: number;
  name: string;
  description: string;
  keywords?: string;
  is_active: boolean;
  user_id: number;
  created_at: string;
  updated_at?: string;
}

interface UserTopicState {
  userTopics: UserTopic[];
  loading: boolean;
  error: string | null;
}

const initialState: UserTopicState = {
  userTopics: [],
  loading: false,
  error: null,
};

const userTopicSlice = createSlice({
  name: 'userTopic',
  initialState,
  reducers: {
    fetchUserTopicsStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchUserTopicsSuccess: (state, action: PayloadAction<UserTopic[]>) => {
      state.loading = false;
      state.userTopics = action.payload;
    },
    fetchUserTopicsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    addUserTopic: (state, action: PayloadAction<UserTopic>) => {
      state.userTopics.push(action.payload);
    },
    updateUserTopic: (state, action: PayloadAction<UserTopic>) => {
      const index = state.userTopics.findIndex(topic => topic.id === action.payload.id);
      if (index !== -1) {
        state.userTopics[index] = action.payload;
      }
    },
    removeUserTopic: (state, action: PayloadAction<number>) => {
      state.userTopics = state.userTopics.filter(topic => topic.id !== action.payload);
    },
    toggleUserTopicActive: (state, action: PayloadAction<number>) => {
      const topic = state.userTopics.find(t => t.id === action.payload);
      if (topic) {
        topic.is_active = !topic.is_active;
      }
    },
  },
});

export const {
  fetchUserTopicsStart,
  fetchUserTopicsSuccess,
  fetchUserTopicsFailure,
  addUserTopic,
  updateUserTopic,
  removeUserTopic,
  toggleUserTopicActive,
} = userTopicSlice.actions;

export default userTopicSlice.reducer; 