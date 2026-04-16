"use client";

import { useMemo, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Eye, Pencil } from "lucide-react";
import DOMPurify from "dompurify";
import { markdownToHtml } from "@/lib/waiver-content";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
};

/**
 * Lightweight Markdown editor with a toolbar and live preview.
 * Stores Markdown in the underlying value (compatible with markdownToHtml rendering).
 *
 * Toolbar: Bold, Italic, Bullet list, Numbered list, Preview toggle.
 * Keyboard: Ctrl/Cmd + B / I.
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  id,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function wrapSelection(prefix: string, suffix: string = prefix) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const placeholder = selected || "text";
    const next = `${before}${prefix}${placeholder}${suffix}${after}`;
    onChange(next);
    // Restore cursor/selection after React re-renders
    requestAnimationFrame(() => {
      ta.focus();
      const newStart = start + prefix.length;
      const newEnd = newStart + placeholder.length;
      ta.setSelectionRange(newStart, newEnd);
    });
  }

  function prefixSelectedLines(prefix: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const nextNewline = value.indexOf("\n", end);
    const lineEnd = nextNewline === -1 ? value.length : nextNewline;
    const chunk = value.slice(lineStart, lineEnd);
    const prefixed = chunk
      .split("\n")
      .map((l) => (l.length > 0 ? `${prefix}${l}` : l))
      .join("\n");
    const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
  }

  const previewHtml = useMemo(() => {
    if (!value.trim()) return "";
    const raw = markdownToHtml(value);
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ["strong", "em", "ul", "ol", "li", "br", "p"],
      ALLOWED_ATTR: [],
    });
  }, [value]);

  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1.5 py-1">
        <ToolbarButton
          title="Bold (Ctrl+B)"
          onClick={() => wrapSelection("**")}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic (Ctrl+I)"
          onClick={() => wrapSelection("*")}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-gray-300" aria-hidden />
        <ToolbarButton
          title="Bullet list"
          onClick={() => prefixSelectedLines("- ")}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          onClick={() => prefixSelectedLines("1. ")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          {preview ? (
            <>
              <Pencil className="h-3 w-3" /> Edit
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Preview
            </>
          )}
        </button>
      </div>

      {/* Editor / Preview body */}
      {preview ? (
        <div
          className="min-h-[96px] px-3 py-2 text-sm text-gray-700 [&_em]:italic [&_ol]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{
            __html:
              previewHtml ||
              '<p class="text-gray-400">Nothing to preview.</p>',
          }}
        />
      ) : (
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const key = e.key.toLowerCase();
            if (key === "b") {
              e.preventDefault();
              wrapSelection("**");
            } else if (key === "i") {
              e.preventDefault();
              wrapSelection("*");
            }
          }}
          rows={rows}
          placeholder={placeholder}
          className="block w-full resize-y border-0 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        />
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
    >
      {children}
    </button>
  );
}
