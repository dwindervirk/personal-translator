import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

export type AppStatus = "IDLE" | "RECORDING" | "TRANSLATING" | "PLAYBACK_ACTIVE" | "ERROR";

export interface TranslatorState {
  status: AppStatus;
  sourceLanguage: string;
  targetLanguage: string;
  apiKey: string | null;
  showSettings: boolean;
  error: string | null;
  loading: boolean;
}

async function isTauri(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("get_api_key");
    return true;
  } catch {
    return false;
  }
}

export const loadApiKey = createAsyncThunk("translator/loadApiKey", async () => {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const key: string | null = await invoke("get_api_key");
    if (key) return key;
  } catch {
    // Not in Tauri environment, fall through to localStorage
  }

  try {
    return localStorage.getItem("translator_api_key");
  } catch {
    return null;
  }
});

export const saveApiKey = createAsyncThunk("translator/saveApiKey", async (key: string) => {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_api_key", { key });
  } catch {
    // Not in Tauri environment, fall through to localStorage
  }

  try {
    localStorage.setItem("translator_api_key", key);
  } catch {
    // localStorage unavailable
  }

  return key;
});

export const clearApiKeyAction = createAsyncThunk("translator/clearApiKey", async () => {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("clear_api_key");
  } catch {
    // Not in Tauri environment, fall through to localStorage
  }

  try {
    localStorage.removeItem("translator_api_key");
  } catch {
    // localStorage unavailable
  }
});

const initialState: TranslatorState = {
  status: "IDLE",
  sourceLanguage: "unknown",
  targetLanguage: "en-IN",
  apiKey: null,
  showSettings: true,
  error: null,
  loading: true,
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
    reset(state) {
      state.status = "IDLE";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadApiKey.fulfilled, (state, action) => {
        state.apiKey = action.payload ?? null;
        state.showSettings = !action.payload;
        state.loading = false;
      })
      .addCase(loadApiKey.rejected, (state) => {
        state.loading = false;
      })
      .addCase(saveApiKey.fulfilled, (state, action) => {
        state.apiKey = action.payload;
        state.showSettings = false;
        state.error = null;
      })
      .addCase(clearApiKeyAction.fulfilled, (state) => {
        state.apiKey = null;
        state.showSettings = true;
      });
  },
});

export const {
  setStatus,
  setError,
  setSourceLanguage,
  setTargetLanguage,
  setShowSettings,
  reset,
} = translatorSlice.actions;
