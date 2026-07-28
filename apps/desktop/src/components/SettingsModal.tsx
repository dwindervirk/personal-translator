import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { saveApiKey, clearApiKeyAction, setShowSettings, setSelectedProvider } from "@/store/translatorSlice";
import { store } from "@/store";

const PROVIDERS = [
  { id: "sarvam", label: "Sarvam AI", keyPrefix: "sk_", placeholder: "Enter your Sarvam AI API key" },
  { id: "gemini", label: "Google Gemini", keyPrefix: "AIza", placeholder: "Paste your Gemini API key from Google AI Studio" },
];

function validateKey(providerId: string, key: string, apiKeys: Record<string, string>): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "Key cannot be empty";
  if (providerId === "sarvam" && !trimmed.startsWith("sk_")) {
    return "Sarvam key should start with \"sk_\"";
  }
  if (providerId === "gemini") {
    if (trimmed.length < 20) {
      return "The API key is too short. Please verify you copied the entire key.";
    }
    const hasValidPrefix = trimmed.startsWith("AIza") || trimmed.startsWith("AQ.");
    if (!hasValidPrefix) {
      return "Invalid key format. Gemini API keys must start with 'AIza' or 'AQ.'.";
    }
  }
  for (const [p, k] of Object.entries(apiKeys)) {
    if (p !== providerId && k === trimmed) return "This API key is already configured for another provider.";
  }
  return null;
}

export function SettingsModal() {
  const dispatch = useAppDispatch();
  const { apiKeys, selectedProvider, showSettings } = useAppSelector((state) => state.translator);
  const currentKey = apiKeys[selectedProvider] ?? null;
  const [inputValue, setInputValue] = useState(currentKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [pendingClearProvider, setPendingClearProvider] = useState<string | null>(null);

  const savedKeyForSelected = apiKeys[selectedProvider] ?? null;

  useEffect(() => {
    setInputValue(savedKeyForSelected ?? "");
  }, [savedKeyForSelected]);

  const currentProvider = useMemo(() => PROVIDERS.find((p) => p.id === selectedProvider), [selectedProvider]);

  const hasAnyKey = useMemo(() => Object.values(apiKeys).some(Boolean), [apiKeys]);
  const currentProviderHasKey = !!apiKeys[selectedProvider];

  const validationError = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return null;
    return validateKey(selectedProvider, trimmed, apiKeys);
  }, [inputValue, selectedProvider, apiKeys]);

  const handleSave = useCallback(() => {
    const trimmed = inputValue.trim();
    const error = validateKey(selectedProvider, trimmed, apiKeys);
    if (error) return;
    if (trimmed) {
      dispatch(saveApiKey({ provider: selectedProvider, key: trimmed }));
    }
  }, [inputValue, selectedProvider, apiKeys, dispatch]);

  const handleClear = useCallback(() => {
    if (pendingClearProvider === selectedProvider) {
      setInputValue("");
      dispatch(clearApiKeyAction({ provider: selectedProvider }));
      const remaining = Object.keys(apiKeys).filter((k) => k !== selectedProvider && apiKeys[k]);
      if (remaining.length > 0) {
        const best = remaining.includes("gemini") ? "gemini" : remaining[0];
        dispatch(setSelectedProvider(best));
      }
      setPendingClearProvider(null);
    } else {
      setPendingClearProvider(selectedProvider);
    }
  }, [selectedProvider, pendingClearProvider, apiKeys, dispatch]);

  const handleClose = useCallback(() => {
    if (pendingClearProvider) setPendingClearProvider(null);
    const freshState = store.getState().translator;
    const remaining = Object.keys(freshState.apiKeys).filter((k) => freshState.apiKeys[k]);
    if (remaining.length > 0 && !freshState.apiKeys[freshState.selectedProvider]) {
      const best = remaining.includes("gemini") ? "gemini" : remaining[0];
      dispatch(setSelectedProvider(best));
    }
    dispatch(setShowSettings(false));
  }, [dispatch, pendingClearProvider]);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value;
      setInputValue(apiKeys[newProvider] ?? "");
      setPendingClearProvider(null);
      setShowKey(false);
      dispatch(setSelectedProvider(newProvider));
    },
    [apiKeys, dispatch]
  );

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="mx-4 w-full max-w-md animate-scale-in rounded-2xl border border-border bg-surface-raised p-6 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Settings</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!hasAnyKey && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2.5 text-center text-sm text-warning">
            An API key is required for translation to work
          </div>
        )}

        {hasAnyKey && !currentProviderHasKey && (
          <div className="mb-4 rounded-lg border border-info/30 bg-info-muted px-3 py-2.5 text-center text-sm text-info">
            This provider has no key saved. Add one to use it.
          </div>
        )}

        {pendingClearProvider === selectedProvider && (
          <div className="mb-4 rounded-lg border border-error/30 bg-error-muted px-3 py-2.5 text-center text-sm text-error">
            Press "Clear" again to remove this key
          </div>
        )}

        <label className="mb-1.5 block text-sm font-medium text-muted">Provider</label>
        <div className="relative mb-5">
          <select
            value={selectedProvider}
            onChange={handleProviderChange}
            className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 pr-8 text-sm text-ink transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} className="bg-surface text-ink">
                {p.label} {apiKeys[p.id] && p.id !== pendingClearProvider ? "✓" : ""}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-muted">
          {currentProvider?.label ?? "Provider"} API Key
        </label>
        <div className="relative mb-4">
          <input
            type={showKey ? "text" : "password"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={currentProvider?.placeholder ?? "Enter API key"}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 pr-14 text-sm text-ink placeholder-muted/50 transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            tabIndex={-1}
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>

        {validationError && (
          <p className="-mt-3 mb-4 text-xs text-error">{validationError}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!inputValue.trim() || !!validationError}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          {currentKey && (
            <button
              onClick={handleClear}
              className="rounded-lg border border-error/40 px-4 py-2.5 text-sm font-medium text-error transition-colors duration-150 hover:bg-error-muted"
            >
              {pendingClearProvider === selectedProvider ? "Confirm Clear" : "Clear"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
