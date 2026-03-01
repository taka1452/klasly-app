"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WaiverGate({
  children,
  needsWaiver,
}: {
  children: React.ReactNode;
  needsWaiver: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!needsWaiver) return;
    if (pathname !== "/waiver") {
      router.replace("/waiver");
    }
  }, [needsWaiver, pathname, router]);

  if (needsWaiver && pathname !== "/waiver") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return <>{children}</>;
}
