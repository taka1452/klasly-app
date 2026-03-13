import type { Metadata } from "next";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Klasly Booking Widget",
  description: "Book your classes",
  // Prevent search engine indexing of widget pages
  robots: "noindex, nofollow",
};

/**
 * Widget 用の最小レイアウト。
 * ヘッダー・サイドバー・フッターなし。
 * iframe 内に表示されるため、背景は透明。
 */
export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-transparent min-h-0">{children}</body>
    </html>
  );
}
