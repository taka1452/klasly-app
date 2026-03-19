"use client";

import { useState, useCallback } from "react";

type ToastState = {
  message: string;
  variant: "success" | "error";
} | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const showError = useCallback((msg: string) => {
    setToast({ message: msg, variant: "error" });
  }, []);

  const showSuccess = useCallback((msg: string) => {
    setToast({ message: msg, variant: "success" });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showError, showSuccess, dismiss };
}
