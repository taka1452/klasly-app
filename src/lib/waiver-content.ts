/**
 * Convert HTML to Markdown for editing in the waiver settings textarea.
 * If the content doesn't look like HTML, return as-is (plain text / already markdown).
 */
import TurndownService from "turndown";
import { marked } from "marked";

export function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== "string") return "";
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("<") || !trimmed.includes(">")) {
    return trimmed;
  }
  try {
    const turndown = new TurndownService({ headingStyle: "atx" });
    return turndown.turndown(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Convert Markdown to HTML for storing in DB and displaying to members.
 */
export function markdownToHtml(md: string): string {
  if (!md || typeof md !== "string") return "";
  const trimmed = md.trim();
  if (!trimmed) return "";
  try {
    return (typeof marked.parse === "function"
      ? marked.parse(trimmed)
      : marked(trimmed)) as string;
  } catch {
    return trimmed;
  }
}
