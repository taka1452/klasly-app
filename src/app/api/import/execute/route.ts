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

    if (ownerProfile?.role !== "owner") {
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

    const limitCheck = await checkPlanLimit(adminSupabase, studioId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Member limit reached. Your plan allows ${limitCheck.limit} members.`,
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
        sendEmail({ to: emailTrimmed, subject, html });
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
