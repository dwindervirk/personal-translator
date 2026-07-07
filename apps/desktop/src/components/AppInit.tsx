"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadAllApiKeys, loadApiKey } from "@/store/translatorSlice";

export function AppInit({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const selectedProvider = useAppSelector((s) => s.translator.selectedProvider);

  useEffect(() => {
    dispatch(loadAllApiKeys());
  }, [dispatch]);

  useEffect(() => {
    dispatch(loadApiKey(selectedProvider));
  }, [dispatch, selectedProvider]);

  return <>{children}</>;
}
