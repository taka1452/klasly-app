import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

/**
 * POST /api/contracts/envelopes/[id]/void
 *
 * Owner / manager voids an in-progress envelope (e.g. wrong terms,
 * wrong signers, contract being re-issued under different conditions).
 * Already-signed envelopes can't be voided — those are sealed history.
 *
 * Voiding does NOT delete signers or signatures. It changes the
 * envelope's status to 'voided' so it stops blocking the workflow and
 * doesn't surface as an active contract on the instructor profile.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      ctx.role === "manager" &&
      !ctx.permissions?.can_manage_contracts_tiers &&
      !ctx.permissions?.can_manage_settings
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: envelope } = await ctx.supabase
      .from("contract_envelopes")
      .select("id, status, studio_id")
      .eq("id", id)
      .single();
    if (!envelope || envelope.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }
    if (envelope.status === "completed") {
      return NextResponse.json(
        { error: "Completed contracts can't be voided — they're sealed history." },
        { status: 400 }
      );
    }
    if (envelope.status === "voided") {
      return NextResponse.json({ success: true, alreadyVoided: true });
    }

    const { error } = await ctx.supabase
      .from("contract_envelopes")
      .update({ status: "voided", voided_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
