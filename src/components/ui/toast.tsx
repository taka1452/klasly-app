"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  onClose: () => void;
  duration?: number;
};

export default function Toast({
  message,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[10002] -translate-x-1/2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg animate-[fadeIn_0.2s_ease-out]"
    >
      {message}
    </div>
  );
}
