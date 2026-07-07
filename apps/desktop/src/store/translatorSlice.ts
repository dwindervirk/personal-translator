import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { ProviderName, ProviderConfig } from "@repo/shared";

export type AppStatus = "IDLE" | "RECORDING" | "TRANSLATING" | "PLAYBACK_ACTIVE" | "ERROR";

const STORAGE_KEYS_PREFIX = "translator_api_key_";
const STORAGE_PROVIDER = "translator_selected_provider";

function storageKey(provider: string): string {
  return STORAGE_KEYS_PREFIX + provider;
}

function getStoredApiKey(provider: string): string | null {
  try {
    return localStorage.getItem(storageKey(provider));
  } catch {
    return null;
  }
}

function setStoredApiKey(provider: string, key: string) {
  try {
    localStorage.setItem(storageKey(provider), key);
  } catch { /* ignore */ }
}

function removeStoredApiKey(provider: string) {
  try {
    localStorage.removeItem(storageKey(provider));
  } catch { /* ignore */ }
}

function getStoredProvider(): string {
  try {
    return localStorage.getItem(STORAGE_PROVIDER) ?? "sarvam";
  } catch {
    return "sarvam";
  }
}

function setStoredProvider(provider: string) {
  try {
    localStorage.setItem(STORAGE_PROVIDER, provider);
  } catch { /* ignore */ }
}

export interface TranslatorState {
  status: AppStatus;
  sourceLanguage: string;
  targetLanguage: string;
  apiKeys: Record<string, string>;
  selectedProvider: string;
  showSettings: boolean;
  error: string | null;
  loading: boolean;
}

export const loadApiKey = createAsyncThunk(
  "translator/loadApiKey",
  async (provider: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const key: string | null = await invoke("get_api_key");
      if (key) return { provider, key };
    } catch { /* fall through */ }

    return { provider, key: getStoredApiKey(provider) };
  }
);

export const saveApiKey = createAsyncThunk(
  "translator/saveApiKey",
  async ({ provider, key }: { provider: string; key: string }) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_api_key", { key });
    } catch { /* fall through */ }

    setStoredApiKey(provider, key);
    return { provider, key };
  }
);

export const clearApiKeyAction = createAsyncThunk(
  "translator/clearApiKey",
  async (provider: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_api_key");
    } catch { /* fall through */ }

    removeStoredApiKey(provider);
    return provider;
  }
);

export const loadAllApiKeys = createAsyncThunk(
  "translator/loadAllApiKeys",
  async () => {
    const providers: string[] = ["sarvam", "huggingface"];
    const apiKeys: Record<string, string> = {};
    for (const p of providers) {
      const key = getStoredApiKey(p);
      if (key) apiKeys[p] = key;
    }
    return apiKeys;
  }
);

const initialState: TranslatorState = {
  status: "IDLE",
  sourceLanguage: "unknown",
  targetLanguage: "en-IN",
  apiKeys: {},
  selectedProvider: getStoredProvider(),
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
    setSelectedProvider(state, action: PayloadAction<string>) {
      state.selectedProvider = action.payload;
      setStoredProvider(action.payload);
    },
    setProviderApiKey(state, action: PayloadAction<{ provider: string; key: string }>) {
      state.apiKeys[action.payload.provider] = action.payload.key;
    },
    reset(state) {
      state.status = "IDLE";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadApiKey.fulfilled, (state, action) => {
        const { provider, key } = action.payload;
        if (key) {
          state.apiKeys[provider] = key;
        }
        state.showSettings = !Object.values(state.apiKeys).some(Boolean);
        state.loading = false;
      })
      .addCase(loadApiKey.rejected, (state) => {
        state.loading = false;
      })
      .addCase(loadAllApiKeys.fulfilled, (state, action) => {
        state.apiKeys = { ...state.apiKeys, ...action.payload };
        state.loading = false;
      })
      .addCase(saveApiKey.fulfilled, (state, action) => {
        const { provider, key } = action.payload;
        state.apiKeys[provider] = key;
        state.selectedProvider = provider;
        state.showSettings = false;
        state.error = null;
      })
      .addCase(clearApiKeyAction.fulfilled, (state, action) => {
        const provider = action.payload;
        delete state.apiKeys[provider];
        state.showSettings = !Object.values(state.apiKeys).some(Boolean);
      });
  },
});

export const {
  setStatus,
  setError,
  setSourceLanguage,
  setTargetLanguage,
  setShowSettings,
  setSelectedProvider,
  setProviderApiKey,
  reset,
} = translatorSlice.actions;
