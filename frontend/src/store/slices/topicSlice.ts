import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Topic {
  id: number;
  name: string;
  description: string;
  category?: string;
}

interface TopicState {
  topics: Topic[];
  selectedTopics: number[];
  loading: boolean;
  error: string | null;
}

const initialState: TopicState = {
  topics: [],
  selectedTopics: [],
  loading: false,
  error: null,
};

const topicSlice = createSlice({
  name: 'topic',
  initialState,
  reducers: {
    fetchTopicsStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchTopicsSuccess: (state, action: PayloadAction<Topic[]>) => {
      state.loading = false;
      state.topics = action.payload;
    },
    fetchTopicsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setSelectedTopics: (state, action: PayloadAction<number[]>) => {
      state.selectedTopics = action.payload;
    },
    toggleTopic: (state, action: PayloadAction<number>) => {
      const topicId = action.payload;
      const index = state.selectedTopics.indexOf(topicId);
      
      if (index === -1) {
        state.selectedTopics.push(topicId);
      } else {
        state.selectedTopics.splice(index, 1);
      }
    },
  },
});

export const {
  fetchTopicsStart,
  fetchTopicsSuccess,
  fetchTopicsFailure,
  setSelectedTopics,
  toggleTopic,
} = topicSlice.actions;

export default topicSlice.reducer; 