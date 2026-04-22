/**
 * Countries supported by Stripe Connect Express accounts.
 * Keep this list aligned with https://stripe.com/global — add new entries as
 * Stripe expands coverage.
 */
export const STRIPE_CONNECT_COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "IE", name: "Ireland" },
  { code: "PT", name: "Portugal" },
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "CH", name: "Switzerland" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
];

const VALID_CODES = new Set(STRIPE_CONNECT_COUNTRIES.map((c) => c.code));

export function isSupportedConnectCountry(code: unknown): code is string {
  return typeof code === "string" && VALID_CODES.has(code);
}

/**
 * Best-effort default country from a studio's timezone. Falls back to "US"
 * when we can't recognise the zone — users can always override in the UI.
 */
export function defaultCountryFromTimezone(tz: string | null | undefined): string {
  if (!tz) return "US";
  if (tz.startsWith("America/")) {
    if (tz.includes("Toronto") || tz.includes("Vancouver") || tz.includes("Montreal") || tz.includes("Halifax") || tz.includes("Edmonton") || tz.includes("Winnipeg")) {
      return "CA";
    }
    if (tz.includes("Mexico") || tz.includes("Tijuana") || tz.includes("Cancun") || tz.includes("Monterrey")) {
      return "MX";
    }
    if (tz.includes("Sao_Paulo") || tz.includes("Bahia") || tz.includes("Recife")) {
      return "BR";
    }
    return "US";
  }
  if (tz === "Pacific/Auckland") return "NZ";
  if (tz.startsWith("Australia/")) return "AU";
  if (tz === "Asia/Tokyo") return "JP";
  if (tz === "Asia/Singapore") return "SG";
  if (tz === "Asia/Hong_Kong") return "HK";
  if (tz === "Europe/London") return "GB";
  if (tz === "Europe/Dublin") return "IE";
  if (tz === "Europe/Berlin") return "DE";
  if (tz === "Europe/Paris") return "FR";
  if (tz === "Europe/Rome") return "IT";
  if (tz === "Europe/Madrid") return "ES";
  if (tz === "Europe/Amsterdam") return "NL";
  if (tz === "Europe/Brussels") return "BE";
  if (tz === "Europe/Vienna") return "AT";
  if (tz === "Europe/Lisbon") return "PT";
  if (tz === "Europe/Copenhagen") return "DK";
  if (tz === "Europe/Stockholm") return "SE";
  if (tz === "Europe/Oslo") return "NO";
  if (tz === "Europe/Helsinki") return "FI";
  if (tz === "Europe/Zurich") return "CH";
  return "US";
}
