import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Article {
  id: number;
  title: string;
  content: string;
  url: string;
  source: string;
  published_at: string;
  sentiment_score: number;
  keywords: string[];
  summary: string;
}

interface Digest {
  id: number;
  title: string;
  created_at: string;
  is_read: boolean;
  articles: Article[];
}

interface DigestState {
  digests: Digest[];
  currentDigest: Digest | null;
  loading: boolean;
  error: string | null;
}

const initialState: DigestState = {
  digests: [],
  currentDigest: null,
  loading: false,
  error: null,
};

const digestSlice = createSlice({
  name: 'digest',
  initialState,
  reducers: {
    fetchDigestsStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchDigestsSuccess: (state, action: PayloadAction<Digest[]>) => {
      state.loading = false;
      state.digests = action.payload;
    },
    fetchDigestsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    fetchDigestDetailStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchDigestDetailSuccess: (state, action: PayloadAction<Digest>) => {
      state.loading = false;
      state.currentDigest = action.payload;
    },
    fetchDigestDetailFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    markDigestAsRead: (state, action: PayloadAction<number>) => {
      const digest = state.digests.find(d => d.id === action.payload);
      if (digest) {
        digest.is_read = true;
      }
      if (state.currentDigest?.id === action.payload) {
        state.currentDigest.is_read = true;
      }
    },
  },
});

export const {
  fetchDigestsStart,
  fetchDigestsSuccess,
  fetchDigestsFailure,
  fetchDigestDetailStart,
  fetchDigestDetailSuccess,
  fetchDigestDetailFailure,
  markDigestAsRead,
} = digestSlice.actions;

export default digestSlice.reducer; 