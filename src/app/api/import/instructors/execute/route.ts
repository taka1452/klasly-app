import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { validateEmail } from "@/lib/import/csv-utils";

type RowResult = { row: number; email: string; reason: string };

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
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
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
      return NextResponse.json({ error: "Studio not found. Complete onboarding first." }, { status: 400 });
    }

    const body = await request.json();
    const {
      csvData,
      nameMode = "combined",
      firstNameColumn,
      lastNameColumn,
      combinedNameColumn,
      mapping = {},
    } = body as {
      csvData?: string;
      nameMode?: "combined" | "separate";
      firstNameColumn?: string;
      lastNameColumn?: string;
      combinedNameColumn?: string;
      mapping?: Record<string, string>;
    };

    if (!csvData || typeof csvData !== "string") {
      return NextResponse.json({ error: "Missing csvData (base64)" }, { status: 400 });
    }

    let csvText: string;
    try {
      csvText = Buffer.from(csvData, "base64").toString("utf-8");
    } catch {
      return NextResponse.json({ error: "Invalid base64 csvData" }, { status: 400 });
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

    function getCell(row: Record<string, string>, col: string): string {
      return col && columns.includes(col) ? (row[col] ?? "").trim() : "";
    }

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-indexed + header row

      // Resolve name
      let fullName: string;
      if (nameMode === "separate") {
        const first = getCell(row, firstNameColumn ?? "");
        const last = getCell(row, lastNameColumn ?? "");
        fullName = [first, last].filter(Boolean).join(" ").trim();
      } else {
        fullName = getCell(row, combinedNameColumn ?? "");
      }

      // Resolve email
      const email = mapping.email ? getCell(row, mapping.email) : "";

      if (!email) {
        skipped.push({ row: rowNum, email: "", reason: "Email is required" });
        continue;
      }
      if (!validateEmail(email)) {
        errors.push({ row: rowNum, email, reason: "Invalid email format" });
        continue;
      }
      if (!fullName) {
        skipped.push({ row: rowNum, email, reason: "Name is required" });
        continue;
      }

      // Check duplicate within this studio
      const { data: existing } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("studio_id", studioId)
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        skipped.push({ row: rowNum, email, reason: "Email already exists in this studio" });
        continue;
      }

      const phone = mapping.phone ? getCell(row, mapping.phone) || null : null;
      const bio = mapping.bio ? getCell(row, mapping.bio) || null : null;
      const specialtiesRaw = mapping.specialties ? getCell(row, mapping.specialties) : "";
      const specialties = specialtiesRaw
        ? specialtiesRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

      // Create profile record (data-only, no auth user)
      const profileId = randomUUID();
      const { error: profileError } = await adminSupabase.from("profiles").insert({
        id: profileId,
        studio_id: studioId,
        role: "instructor",
        full_name: fullName,
        email,
        phone,
      });

      if (profileError) {
        errors.push({ row: rowNum, email, reason: profileError.message });
        continue;
      }

      const { error: instructorError } = await adminSupabase.from("instructors").insert({
        studio_id: studioId,
        profile_id: profileId,
        bio,
        specialties,
      });

      if (instructorError) {
        // Rollback profile
        await adminSupabase.from("profiles").delete().eq("id", profileId);
        errors.push({ row: rowNum, email, reason: instructorError.message });
        continue;
      }

      imported++;
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
