"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WidgetThemeProvider } from "@/components/widget/widget-theme-provider";
import WidgetBuyButton from "@/components/widget/widget-buy-button";

function BuyWidgetContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studioId = params.studioId as string;
  const theme = searchParams.get("theme") || "green";

  return (
    <WidgetThemeProvider theme={theme}>
      <WidgetBuyButton studioId={studioId} />
    </WidgetThemeProvider>
  );
}

export default function BuyWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
        </div>
      }
    >
      <BuyWidgetContent />
    </Suspense>
  );
}
