"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WidgetThemeProvider } from "@/components/widget/widget-theme-provider";
import { WidgetAuthProvider } from "@/components/widget/widget-auth-provider";
import WidgetSchedule from "@/components/widget/widget-schedule";
import UTMTrackerSimple from "@/components/tracking/utm-tracker-simple";

function WidgetContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studioId = params.studioId as string;
  const theme = searchParams.get("theme") || "green";

  return (
    <WidgetThemeProvider theme={theme}>
      <WidgetAuthProvider studioId={studioId}>
        <UTMTrackerSimple studioId={studioId} />
        <WidgetSchedule studioId={studioId} />
      </WidgetAuthProvider>
    </WidgetThemeProvider>
  );
}

export default function WidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
        </div>
      }
    >
      <WidgetContent />
    </Suspense>
  );
}
