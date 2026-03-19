"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  onClose: () => void;
  duration?: number;
  variant?: "success" | "error";
};

export default function Toast({
  message,
  onClose,
  duration = 3000,
  variant = "success",
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const bg = variant === "error" ? "bg-red-600" : "bg-emerald-600";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-[10002] -translate-x-1/2 rounded-lg ${bg} px-4 py-3 text-sm font-medium text-white shadow-lg animate-[fadeIn_0.2s_ease-out]`}
    >
      {message}
    </div>
  );
}
