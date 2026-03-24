import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

const VALID_CODES: string[] = SUPPORTED_CURRENCIES.map((c) => c.code);

// ============================================================
// PATCH /api/studio/currency
//   Body: { currency: string }
//   オーナーのみ操作可能
// ============================================================
export async function PATCH(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createAdminClient();

    const { data: profile } = await adminDb
      .from("profiles")
      .select("role, studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { currency } = body as { currency: string };

    if (!currency || !VALID_CODES.includes(currency.toLowerCase())) {
      return NextResponse.json(
        {
          error: `Invalid currency. Must be one of: ${VALID_CODES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { error } = await adminDb
      .from("studios")
      .update({ currency: currency.toLowerCase() })
      .eq("id", profile.studio_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, currency: currency.toLowerCase() });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
