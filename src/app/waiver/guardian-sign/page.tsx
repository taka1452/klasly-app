"use client";

import { Suspense } from "react";
import GuardianSignContent from "./guardian-sign-content";

export default function GuardianSignPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      }
    >
      <GuardianSignContent />
    </Suspense>
  );
}
