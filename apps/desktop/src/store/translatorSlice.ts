import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type AppStatus = "IDLE" | "RECORDING" | "TRANSLATING" | "PLAYBACK_ACTIVE" | "ERROR";

export interface TranslatorState {
  status: AppStatus;
  sourceLanguage: string;
  targetLanguage: string;
  apiKey: string | null;
  showSettings: boolean;
  error: string | null;
}

function loadApiKey(): string | null {
  try {
    return localStorage.getItem("translator_api_key");
  } catch {
    return null;
  }
}

const initialState: TranslatorState = {
  status: "IDLE",
  sourceLanguage: "unknown",
  targetLanguage: "en-IN",
  apiKey: loadApiKey(),
  showSettings: !loadApiKey(),
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
    setShowSettings(state, action: PayloadAction<boolean>) {
      state.showSettings = action.payload;
    },
    setApiKey(state, action: PayloadAction<string>) {
      state.apiKey = action.payload;
      state.showSettings = false;
      state.error = null;
      try {
        localStorage.setItem("translator_api_key", action.payload);
      } catch {
        // localStorage unavailable
      }
    },
    clearApiKey(state) {
      state.apiKey = null;
      state.showSettings = true;
      try {
        localStorage.removeItem("translator_api_key");
      } catch {
        // localStorage unavailable
      }
    },
    reset(state) {
      state.status = "IDLE";
      state.error = null;
    },
  },
});

export const {
  setStatus,
  setError,
  setSourceLanguage,
  setTargetLanguage,
  setShowSettings,
  setApiKey,
  clearApiKey,
  reset,
} = translatorSlice.actions;
