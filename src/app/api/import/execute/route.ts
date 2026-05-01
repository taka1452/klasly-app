import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  validateEmail,
  normalizePlanType,
  normalizeStatus,
  parseCredits,
  type PlanType,
  type MemberStatus,
} from "@/lib/import/csv-utils";
import { checkPlanLimit } from "@/lib/plan-limits";
import { sendEmail } from "@/lib/email/send";
import { welcomeMember } from "@/lib/email/templates";

const BATCH_SIZE = 10;
const EMAIL_DELAY_MS = 50;

type RowResult = { row: number; email: string; reason: string };

function getCell(row: Record<string, string>, columnOrFixed: string): string {
  const v = row[columnOrFixed];
  return v != null ? String(v).trim() : "";
}

function resolveValue(
  row: Record<string, string>,
  mappingValue: string | undefined,
  columns: string[]
): string {
  if (!mappingValue) return "";
  const isColumn = columns.includes(mappingValue);
  return isColumn ? getCell(row, mappingValue) : mappingValue;
}

/**
 * Accept a wide range of date inputs (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY,
 * "Apr 15, 1992") and normalise to ISO YYYY-MM-DD or null. Returning null
 * on unparseable input is intentional — date_of_birth is optional during
 * import even though required on the manual form.
 *
 * Two pitfalls this guards against:
 * - Slash dates with a first segment > 12 (e.g. "15/4/1992") are
 *   unambiguously DD/MM/YYYY. We swap segments instead of producing a
 *   bogus "month=15" date.
 * - Human-readable strings ("Apr 15, 1992") parse via the local-time JS
 *   Date constructor; calling toISOString() in a negative-offset
 *   timezone (US/Pacific etc.) shifts the date back by one day. We pull
 *   year/month/day from the local-time fields instead.
 */
function normaliseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (slash) {
    let [, a, b, yyyy] = slash;
    let mm: string;
    let dd: string;
    if (Number(a) > 12 && Number(b) <= 12) {
      // First segment can't be a month — interpret as DD/MM/YYYY
      dd = a;
      mm = b;
    } else {
      // Default to MM/DD/YYYY (US convention dominates Mindbody / Zen
      // Planner exports). Ambiguous values like 4/5/1992 still parse as
      // April 5; users with EU-formatted data can pre-format to ISO.
      mm = a;
      dd = b;
    }
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) {
      return null;
    }
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  // Use local-time fields, not toISOString(), so a date like
  // "Apr 15, 1992" parsed in US/Pacific stays April 15 instead of
  // becoming April 14 after UTC conversion.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normaliseGender(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === "f" || v === "female" || v === "woman") return "female";
  if (v === "m" || v === "male" || v === "man") return "male";
  if (
    v === "prefer not to say" ||
    v === "prefer_not_to_say" ||
    v === "n/a" ||
    v === "other" ||
    v === "non-binary" ||
    v === "nonbinary"
  ) {
    return "prefer_not_to_say";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: ownerProfile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (ownerProfile?.role === "manager") {
      const { data: mgr } = await adminSupabase
        .from("managers")
        .select("can_manage_members")
        .eq("profile_id", user.id)
        .eq("studio_id", ownerProfile.studio_id)
        .single();
      if (!mgr?.can_manage_members) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (ownerProfile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studioId = ownerProfile.studio_id;
    if (!studioId) {
      return NextResponse.json(
        { error: "Studio not found. Complete onboarding first." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      csvData,
      nameMode = "combined",
      firstNameColumn,
      lastNameColumn,
      combinedNameColumn,
      mapping = {},
      defaultPlanType = "drop_in",
      defaultCredits = 0,
      defaultStatus = "active",
      sendWelcomeEmail = false,
    } = body as {
      csvData?: string;
      nameMode?: "combined" | "separate";
      firstNameColumn?: string;
      lastNameColumn?: string;
      combinedNameColumn?: string;
      mapping?: Record<string, string>;
      defaultPlanType?: string;
      defaultCredits?: number;
      defaultStatus?: string;
      sendWelcomeEmail?: boolean;
    };

    if (!csvData || typeof csvData !== "string") {
      return NextResponse.json(
        { error: "Missing csvData (base64)" },
        { status: 400 }
      );
    }

    let csvText: string;
    try {
      csvText = Buffer.from(csvData, "base64").toString("utf-8");
    } catch {
      return NextResponse.json(
        { error: "Invalid base64 csvData" },
        { status: 400 }
      );
    }

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    const skipped: RowResult[] = [];
    const errors: RowResult[] = [];
    let imported = 0;

    // Pre-flight plan-limit check. We reject the entire import up-front when
    // the studio doesn't have enough headroom for the row count, instead of
    // letting the first ~N succeed and the rest fail mid-flight.
    const limitCheck = await checkPlanLimit(adminSupabase, studioId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Member limit reached. Your plan allows ${limitCheck.limit} members.`,
        },
        { status: 403 }
      );
    }
    if (
      typeof limitCheck.limit === "number" &&
      typeof limitCheck.currentCount === "number" &&
      limitCheck.currentCount + records.length > limitCheck.limit
    ) {
      const headroom = Math.max(0, limitCheck.limit - limitCheck.currentCount);
      return NextResponse.json(
        {
          error: `This CSV has ${records.length} rows but your plan only has room for ${headroom} more members (limit: ${limitCheck.limit}). Upgrade or split the import.`,
        },
        { status: 403 }
      );
    }

    const { data: studioRow } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", studioId)
      .single();
    const studioName = studioRow?.name ?? "Studio";

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-based + header

      let fullName: string;
      if (nameMode === "separate") {
        const first = getCell(row, firstNameColumn || "");
        const last = getCell(row, lastNameColumn || "");
        fullName = [first, last].filter(Boolean).join(" ").trim();
      } else {
        fullName = getCell(row, combinedNameColumn || "");
      }

      const email = resolveValue(row, mapping.email, columns);
      const emailTrimmed = email.trim();

      if (!emailTrimmed) {
        skipped.push({ row: rowNum, email: "", reason: "Email is required" });
        continue;
      }

      if (!validateEmail(emailTrimmed)) {
        errors.push({ row: rowNum, email: emailTrimmed, reason: "Invalid email format" });
        continue;
      }

      if (!fullName) {
        skipped.push({ row: rowNum, email: emailTrimmed, reason: "Name is required" });
        continue;
      }

      const { data: existingProfile } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("studio_id", studioId)
        .eq("email", emailTrimmed)
        .maybeSingle();

      if (existingProfile) {
        skipped.push({ row: rowNum, email: emailTrimmed, reason: "Email already exists" });
        continue;
      }

      const planType = normalizePlanType(
        resolveValue(row, mapping.plan_type, columns) || defaultPlanType
      ) as PlanType;
      const credits =
        mapping.credits && columns.includes(mapping.credits)
          ? parseCredits(resolveValue(row, mapping.credits, columns))
          : (defaultCredits ?? 0);
      const status = normalizeStatus(
        resolveValue(row, mapping.status, columns) || defaultStatus
      ) as MemberStatus;
      const phone = resolveValue(row, mapping.phone, columns) || null;
      const notes = resolveValue(row, mapping.notes, columns) || null;

      // Demographics added 2026-04-30 (Jamie feedback). Phone/DOB/gender
      // are required for manual member adds but kept optional during
      // import so legacy data without them still flows through.
      const dobRaw = resolveValue(row, mapping.date_of_birth, columns);
      const dateOfBirth = normaliseDate(dobRaw);
      const genderRaw = resolveValue(row, mapping.gender, columns);
      const gender = normaliseGender(genderRaw);
      const address = resolveValue(row, mapping.address, columns) || null;
      const referredBy = resolveValue(row, mapping.referred_by, columns) || null;
      const isMinorRaw = resolveValue(row, mapping.is_minor, columns);
      const guardianEmail = resolveValue(row, mapping.guardian_email, columns) || null;
      // Treat the column as a boolean only when it's clearly truthy. We do
      // not auto-derive `is_minor` from DOB here — that's a calculated
      // field on the manual form and CSV importers may already have their
      // own age logic.
      const isMinor =
        /^(1|true|yes|y)$/i.test(isMinorRaw.trim()) || Boolean(guardianEmail);

      const profileId = randomUUID();

      const { error: profileError } = await adminSupabase.from("profiles").insert({
        id: profileId,
        studio_id: studioId,
        role: "member",
        full_name: fullName,
        email: emailTrimmed,
        phone: phone || null,
      });

      if (profileError) {
        errors.push({ row: rowNum, email: emailTrimmed, reason: profileError.message });
        continue;
      }

      const creditsValue = planType === "monthly" ? -1 : credits;

      const { error: memberError } = await adminSupabase.from("members").insert({
        studio_id: studioId,
        profile_id: profileId,
        plan_type: planType,
        credits: creditsValue,
        status,
        notes: notes || null,
        date_of_birth: dateOfBirth,
        gender,
        address,
        referred_by: referredBy,
        is_minor: isMinor,
        guardian_email: isMinor ? guardianEmail : null,
      });

      if (memberError) {
        await adminSupabase.from("profiles").delete().eq("id", profileId);
        errors.push({ row: rowNum, email: emailTrimmed, reason: memberError.message });
        continue;
      }

      imported++;

      if (sendWelcomeEmail) {
        const { subject, html } = welcomeMember({
          memberName: fullName,
          studioName,
        });
        await sendEmail({ to: emailTrimmed, subject, html });
        if (imported % BATCH_SIZE === 0 && i < records.length - 1) {
          await new Promise((r) => setTimeout(r, EMAIL_DELAY_MS));
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: records.length,
        imported,
        skipped: skipped.length,
        errors: errors.length,
      },
      skipped,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
