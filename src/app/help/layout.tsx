import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Center - Klasly",
  description:
    "Guides and answers for using Klasly. Get help as a studio owner, instructor, or member.",
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
