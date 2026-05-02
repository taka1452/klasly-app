"use client";

import { useEffect, useState } from "react";

type SanitizeOptions = {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
};

type DOMPurifyLike = {
  sanitize: (raw: string, opts?: SanitizeOptions) => string;
};

/**
 * Returns sanitized HTML for `raw`. DOMPurify needs `window`, so we
 * import + run it inside an effect — server-render returns an empty
 * string and the real value materialises on hydrate. Pass `options` to
 * restrict the allowed tag/attribute set; passing `null` means use
 * DOMPurify's defaults.
 */
export function useSanitizedHtml(
  raw: string,
  options: SanitizeOptions | null = null
): string {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!raw) {
      setHtml("");
      return;
    }
    import("dompurify").then((mod) => {
      if (cancelled) return;
      const purify = ((mod as { default?: DOMPurifyLike }).default ??
        (mod as unknown as DOMPurifyLike)) as DOMPurifyLike;
      setHtml(options ? purify.sanitize(raw, options) : purify.sanitize(raw));
    });
    return () => {
      cancelled = true;
    };
  }, [raw, options]);

  return html;
}
