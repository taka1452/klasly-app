"use client";

import { useMemo } from "react";
import { markdownToHtml } from "@/lib/waiver-content";
import { useSanitizedHtml } from "@/lib/sanitize";

const SAFE_MARKDOWN_OPTIONS = {
  ALLOWED_TAGS: ["p", "strong", "em", "ul", "ol", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre", "hr"],
  ALLOWED_ATTR: [],
};

type Props = {
  content: string;
  className?: string;
};

/**
 * Renders markdown content as sanitized HTML.
 * Disallows images and links for security.
 */
export default function SafeMarkdown({ content, className = "" }: Props) {
  const raw = useMemo(() => (content ? markdownToHtml(content) : ""), [content]);
  const html = useSanitizedHtml(raw, SAFE_MARKDOWN_OPTIONS);

  if (!html) return null;

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
