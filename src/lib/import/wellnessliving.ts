/**
 * WellnessLiving CSV pre-processing.
 *
 * WellnessLiving exports pack name+phone, email, and a status code into
 * a single multi-line "Client" cell:
 *
 *   "Donald Marshall+1503 688 6646\nmarxmarshall2@comcast.net\nA"
 *
 * Each row represents one purchased pass — the same member can appear
 * many times. This module detects that format, parses the Client cell,
 * filters WellnessLiving system/noise rows, de-duplicates by email, and
 * returns flat records the standard importer can map.
 */

const NOISE_PREFIXES = [
  "please read the special instructions",
  "payment link and registration link",
];

export function isWellnessLivingFormat(columns: string[]): boolean {
  const lower = columns.map((c) => c.toLowerCase().trim());
  return (
    lower.includes("client") &&
    lower.includes("purchase option") &&
    lower.includes("available")
  );
}

function parseClientCell(raw: string): {
  name: string;
  phone: string;
  email: string;
  statusCode: string;
} {
  const lines = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const firstLine = lines[0] || "";
  const phoneMatch = firstLine.match(/^(.+?)\+(\d[\d\s]+)$/);
  let name = firstLine;
  let phone = "";
  if (phoneMatch) {
    name = phoneMatch[1].trim();
    phone = "+" + phoneMatch[2].replace(/\s+/g, "");
  }

  const email = lines[1] || "";
  const statusCode = lines[2] || "";

  return { name, phone, email, statusCode };
}

function parseVisits(raw: string): number {
  const match = raw.match(/(\d+)\s*visits?/i);
  return match ? parseInt(match[1], 10) : 0;
}

function statusFromCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === "A") return "active";
  if (c === "L") return "cancelled";
  if (c === "P") return "paused";
  return "active";
}

/**
 * Transform WellnessLiving records into flat, one-row-per-member records.
 *
 * Pass details are aggregated into a "notes" column so the studio owner
 * can reference them when assigning Klasly passes later.
 */
export type WellnessLivingOptions = {
  /** Skip rows where the status code is "L" (cancelled in WellnessLiving). */
  skipCancelled?: boolean;
};

export function normalizeWellnessLiving(
  records: Record<string, string>[],
  options: WellnessLivingOptions = {}
): Record<string, string>[] {
  type Parsed = {
    name: string;
    email: string;
    phone: string;
    status: string;
    passName: string;
    credits: number;
  };

  const parsed: Parsed[] = [];

  for (const row of records) {
    const client = row["Client"] || "";
    const purchaseOption = (row["Purchase Option"] || "").trim();
    const available = row["Available"] || "";

    if (
      NOISE_PREFIXES.some((p) =>
        purchaseOption.toLowerCase().startsWith(p)
      )
    ) {
      continue;
    }

    const { name, phone, email, statusCode } = parseClientCell(client);
    if (!email || !name) continue;

    const status = statusFromCode(statusCode);
    if (options.skipCancelled && status === "cancelled") {
      continue;
    }

    parsed.push({
      name,
      email: email.trim().toLowerCase(),
      phone,
      status,
      passName: purchaseOption,
      credits: parseVisits(available),
    });
  }

  const byEmail = new Map<string, Parsed[]>();
  for (const row of parsed) {
    const existing = byEmail.get(row.email) || [];
    existing.push(row);
    byEmail.set(row.email, existing);
  }

  const result: Record<string, string>[] = [];
  const emails = Array.from(byEmail.keys());
  for (const em of emails) {
    const rows = byEmail.get(em)!;
    const first = rows[0];

    const passMap: Record<string, number> = {};
    for (const r of rows) {
      if (r.passName) {
        passMap[r.passName] = (passMap[r.passName] || 0) + r.credits;
      }
    }

    const passEntries = Object.entries(passMap);
    const passLines = passEntries
      .map(([pName, credits]) => `${pName} (${credits} visits)`)
      .join("; ");

    const totalCredits = passEntries.reduce((a, [, c]) => a + c, 0);

    result.push({
      name: first.name,
      email: em,
      phone: first.phone,
      status: first.status,
      notes: passLines,
      credits: String(totalCredits),
    });
  }

  return result;
}
