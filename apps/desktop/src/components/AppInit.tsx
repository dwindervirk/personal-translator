"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { loadApiKeys } from "@/store/translatorSlice";

export function AppInit({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(loadApiKeys());
  }, [dispatch]);

  return <>{children}</>;
}
