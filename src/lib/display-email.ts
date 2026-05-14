/**
 * Per-email display mask used for demo recordings.
 *
 * Auth, billing, and notification flows continue to use the real address —
 * only what the UI renders is swapped. Add entries here to mask additional
 * accounts; everything else passes through unchanged.
 */
const EMAIL_DISPLAY_MASK: Record<string, { email: string; name?: string }> = {
  "tybiz1452@gmail.com": { email: "demo@klasly.app", name: "Studio Owner" },
};

function lookup(email: string | null | undefined) {
  if (!email) return null;
  return EMAIL_DISPLAY_MASK[email.trim().toLowerCase()] ?? null;
}

export function maskEmailForDisplay(email: string | null | undefined): string {
  if (!email) return "";
  return lookup(email)?.email ?? email;
}

/**
 * If `name` is itself the real email (i.e. used as a fallback when the user has
 * no `full_name`), swap it for the masked label. Otherwise leave the name as-is.
 */
export function maskNameForDisplay(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback?: string,
): string {
  const safeName = name ?? "";
  const mask = lookup(email);
  if (!mask) return safeName;
  if (safeName === email || safeName.includes("@")) {
    return mask.name ?? fallback ?? mask.email;
  }
  return safeName;
}
