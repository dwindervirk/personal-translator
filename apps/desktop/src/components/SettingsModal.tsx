"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { saveApiKey, clearApiKeyAction, setShowSettings, setSelectedProvider } from "@/store/translatorSlice";
import type { ProviderName } from "@repo/shared";

const PROVIDERS: { id: ProviderName; label: string; placeholder: string }[] = [
  { id: "sarvam", label: "Sarvam AI", placeholder: "sk_...your_key" },
  { id: "huggingface", label: "Hugging Face", placeholder: "hf_...your_token" },
];

export function SettingsModal() {
  const dispatch = useAppDispatch();
  const { apiKeys, selectedProvider, showSettings } = useAppSelector((state) => state.translator);
  const currentKey = apiKeys[selectedProvider] ?? null;
  const [inputValue, setInputValue] = useState(currentKey ?? "");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setInputValue(currentKey ?? "");
  }, [currentKey]);

  const selected = PROVIDERS.find((p) => p.id === selectedProvider) ?? PROVIDERS[0];

  const handleSave = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      dispatch(saveApiKey({ provider: selectedProvider, key: trimmed }));
    }
  }, [inputValue, selectedProvider, dispatch]);

  const handleClear = useCallback(() => {
    setInputValue("");
    dispatch(clearApiKeyAction(selectedProvider));
  }, [selectedProvider, dispatch]);

  const handleClose = useCallback(() => {
    dispatch(setShowSettings(false));
  }, [dispatch]);

  const hasAnyKey = Object.values(apiKeys).some(Boolean);

  if (!showSettings) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!hasAnyKey && (
          <div className="mb-4 rounded-lg border border-yellow-600/40 bg-yellow-900/20 px-3 py-2 text-sm text-yellow-300">
            An API key is required for translation. Select a provider and enter your key below.
          </div>
        )}

        <label className="mb-1 block text-sm text-gray-400">Provider</label>
        <select
          value={selectedProvider}
          onChange={(e) => {
            dispatch(setSelectedProvider(e.target.value));
          }}
          className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm text-gray-400">API Key ({selected.label})</label>
        <div className="relative mb-4">
          <input
            type={showKey ? "text" : "password"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={selected.placeholder}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
          >
            {showKey ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7A9.97 9.97 0 014.02 8.97m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!inputValue.trim()}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          {currentKey && (
            <button
              onClick={handleClear}
              className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/30"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
