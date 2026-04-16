"use client";

import { useMemo } from "react";
import { markdownToHtml } from "@/lib/waiver-content";
import DOMPurify from "dompurify";

type Props = {
  content: string;
  className?: string;
};

/**
 * Renders markdown content as sanitized HTML.
 * Disallows images and links for security.
 */
export default function SafeMarkdown({ content, className = "" }: Props) {
  const html = useMemo(() => {
    if (!content) return "";
    const raw = markdownToHtml(content);
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ["p", "strong", "em", "ul", "ol", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre", "hr"],
      ALLOWED_ATTR: [],
    });
  }, [content]);

  if (!html) return null;

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
