"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadApiKeys, setSelectedProvider } from "@/store/translatorSlice";

export function AppInit({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { apiKeys, selectedProvider, showSettings } = useAppSelector((state) => state.translator);

  useEffect(() => {
    dispatch(loadApiKeys());
  }, [dispatch]);

  useEffect(() => {
    if (showSettings) return;
    const hasAny = Object.values(apiKeys).some(Boolean);
    if (hasAny && !apiKeys[selectedProvider]) {
      const remaining = Object.keys(apiKeys).filter((k) => apiKeys[k]);
      if (remaining.length > 0) {
        const best = remaining.includes("gemini") ? "gemini" : remaining[0];
        dispatch(setSelectedProvider(best));
      }
    }
  }, [apiKeys, selectedProvider, showSettings, dispatch]);

  return <>{children}</>;
}
