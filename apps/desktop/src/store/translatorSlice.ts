import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

export type AppStatus = "IDLE" | "RECORDING" | "TRANSLATING" | "PLAYBACK_ACTIVE" | "ERROR";

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

async function isTauri(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("get_api_key", { provider: "sarvam" });
    return true;
  } catch { return false; }
}

function storageKey(provider: string): string {
  return `translator_api_key_${provider}`;
}

export const loadApiKeys = createAsyncThunk("translator/loadApiKeys", async () => {
  const keys: Record<string, string> = {};
  for (const provider of ["sarvam", "gemini"]) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const key: string | null = await invoke("get_api_key", { provider });
      if (key) { keys[provider] = key; continue; }
    } catch { /* fall through */ }
    try {
      const stored = localStorage.getItem(storageKey(provider));
      if (stored) keys[provider] = stored;
    } catch { /* ignore */ }
  }
  return keys;
});

export const saveApiKey = createAsyncThunk(
  "translator/saveApiKey",
  async ({ provider, key }: { provider: string; key: string }) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_api_key", { provider, key });
    } catch { /* fall through */ }
    try { localStorage.setItem(storageKey(provider), key); } catch {}
    return { provider, key };
  }
);

export const clearApiKeyAction = createAsyncThunk(
  "translator/clearApiKey",
  async ({ provider }: { provider: string }) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_api_key", { provider });
    } catch { /* fall through */ }
    try { localStorage.removeItem(storageKey(provider)); } catch {}
    return provider;
  }
);

function getSavedProvider(): string {
  try { return localStorage.getItem("translator_selected_provider") ?? "sarvam"; } catch { return "sarvam"; }
}

const initialState: TranslatorState = {
  status: "IDLE",
  sourceLanguage: "unknown",
  targetLanguage: "en-IN",
  apiKeys: {},
  selectedProvider: getSavedProvider(),
  showSettings: true,
  error: null,
  loading: true,
};

export const translatorSlice = createSlice({
  name: "translator",
  initialState,
  reducers: {
    setStatus(state, action: PayloadAction<AppStatus>) { state.status = action.payload; state.error = null; },
    setError(state, action: PayloadAction<string>) { state.status = "ERROR"; state.error = action.payload; },
    setSourceLanguage(state, action: PayloadAction<string>) { state.sourceLanguage = action.payload; },
    setTargetLanguage(state, action: PayloadAction<string>) { state.targetLanguage = action.payload; },
    setShowSettings(state, action: PayloadAction<boolean>) { state.showSettings = action.payload; },
    setSelectedProvider(state, action: PayloadAction<string>) {
      state.selectedProvider = action.payload;
      try { localStorage.setItem("translator_selected_provider", action.payload); } catch {}
    },
    reset(state) { state.status = "IDLE"; state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadApiKeys.fulfilled, (state, action) => {
        state.apiKeys = action.payload;
        const hasAny = Object.values(action.payload).some(Boolean);
        state.showSettings = !hasAny;
        state.loading = false;
        if (!state.apiKeys[state.selectedProvider]) {
          const remaining = Object.keys(state.apiKeys).filter((k) => state.apiKeys[k]);
          if (remaining.length > 0) {
            state.selectedProvider = remaining.includes("gemini") ? "gemini" : remaining[0];
            try { localStorage.setItem("translator_selected_provider", state.selectedProvider); } catch {}
          }
        }
      })
      .addCase(loadApiKeys.rejected, (state) => { state.loading = false; })
      .addCase(saveApiKey.fulfilled, (state, action) => {
        state.apiKeys[action.payload.provider] = action.payload.key;
        state.showSettings = false;
        state.error = null;
      })
      .addCase(clearApiKeyAction.fulfilled, (state, action) => {
        delete state.apiKeys[action.payload];
        const remaining = Object.keys(state.apiKeys).filter((k) => state.apiKeys[k]);
        if (remaining.length === 0) {
          state.showSettings = true;
        } else {
          if (!state.apiKeys[state.selectedProvider]) {
            const best = remaining.includes("gemini") ? "gemini" : remaining[0];
            state.selectedProvider = best;
            try { localStorage.setItem("translator_selected_provider", best); } catch {}
          }
        }
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
  reset,
} = translatorSlice.actions;
