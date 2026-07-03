import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type AppStatus = "IDLE" | "RECORDING" | "TRANSLATING" | "PLAYBACK_ACTIVE" | "ERROR";

export interface TranslatorState {
  status: AppStatus;
  sourceLanguage: string;
  targetLanguage: string;
  error: string | null;
}

const initialState: TranslatorState = {
  status: "IDLE",
  sourceLanguage: "unknown",
  targetLanguage: "en-IN",
  error: null,
};

export const translatorSlice = createSlice({
  name: "translator",
  initialState,
  reducers: {
    setStatus(state, action: PayloadAction<AppStatus>) {
      state.status = action.payload;
      state.error = null;
    },
    setError(state, action: PayloadAction<string>) {
      state.status = "ERROR";
      state.error = action.payload;
    },
    setSourceLanguage(state, action: PayloadAction<string>) {
      state.sourceLanguage = action.payload;
    },
    setTargetLanguage(state, action: PayloadAction<string>) {
      state.targetLanguage = action.payload;
    },
    reset(state) {
      state.status = "IDLE";
      state.error = null;
    },
  },
});

export const { setStatus, setError, setSourceLanguage, setTargetLanguage, reset } =
  translatorSlice.actions;
