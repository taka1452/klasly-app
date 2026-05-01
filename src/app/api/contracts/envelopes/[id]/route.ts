import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

/**
 * GET /api/contracts/envelopes/[id]
 * Owner / manager reads a single envelope with all its signers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: envelope } = await ctx.supabase
      .from("contract_envelopes")
      .select(
        "id, title, status, created_at, completed_at, form_id, instructor_id, created_by, studio_id, contract_envelope_signers(id, sign_order, role_label, name, email, status, signed_at, declined_at, notified_at)"
      )
      .eq("id", id)
      .single();

    if (!envelope || envelope.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    return NextResponse.json({ envelope });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
