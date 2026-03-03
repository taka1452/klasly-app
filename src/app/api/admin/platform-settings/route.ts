import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { data: rows, error } = await supabase
      .from("platform_settings")
      .select("key, value, updated_at")
      .order("key");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: rows ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 404 });
  }
}

const VALID_KEYS = ["platform_fee_percent"] as const;

function validatePlatformFeePercent(value: string): boolean {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return false;
  return n >= 0 && n <= 30;
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const body = await request.json();
    const { key, value } = body;

    if (typeof key !== "string" || typeof value !== "string") {
      return NextResponse.json(
        { error: "key and value are required (strings)" },
        { status: 400 }
      );
    }

    if (!VALID_KEYS.includes(key as (typeof VALID_KEYS)[number])) {
      return NextResponse.json(
        { error: "Invalid key" },
        { status: 400 }
      );
    }

    if (key === "platform_fee_percent" && !validatePlatformFeePercent(value)) {
      return NextResponse.json(
        { error: "platform_fee_percent must be a number between 0 and 30" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("platform_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 404 });
  }
}
