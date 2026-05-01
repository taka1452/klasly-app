import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { sendEmail } from "@/lib/email/send";
import { contractSignRequest } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";

/**
 * POST /api/contracts/envelopes/[id]/resend
 *
 * Re-sends the sign-request email to whichever signer is currently
 * blocking the envelope (i.e. the lowest sign_order with status !=
 * signed). Useful when the original email got lost in spam or the
 * signer simply forgot.
 *
 * Body (optional): { signer_id: string } — to pick a specific signer
 * (e.g. "resend signer 3" even though signer 2 hasn't signed yet).
 * Without it we resend to the natural next signer.
 *
 * The sign_token is rotated so the previously emailed link becomes
 * invalid. This guards against an old link landing on a phishing site
 * via a forwarded email.
 *
 * Jamie feedback 2026-04-30 follow-up: studios need a "ping the
 * pending signer" affordance — common in DocuSign / Jotform.
 */
export async function POST(
  request: Request,
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

    const body = await request.json().catch(() => ({}));
    const targetSignerId =
      typeof body?.signer_id === "string" ? body.signer_id : null;

    const { data: envelope } = await ctx.supabase
      .from("contract_envelopes")
      .select("id, title, status, studio_id")
      .eq("id", id)
      .single();
    if (!envelope || envelope.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }
    if (envelope.status !== "in_progress") {
      return NextResponse.json(
        { error: `Envelope is ${envelope.status} — can't resend.` },
        { status: 400 }
      );
    }

    // Find the signer to resend to.
    let query = ctx.supabase
      .from("contract_envelope_signers")
      .select("id, sign_order, name, email, role_label, status")
      .eq("envelope_id", id)
      .neq("status", "signed")
      .neq("status", "declined")
      .order("sign_order", { ascending: true })
      .limit(1);
    if (targetSignerId) {
      query = ctx.supabase
        .from("contract_envelope_signers")
        .select("id, sign_order, name, email, role_label, status")
        .eq("envelope_id", id)
        .eq("id", targetSignerId)
        .limit(1);
    }
    const { data: signers } = await query;
    const signer = (signers ?? [])[0];
    if (!signer) {
      return NextResponse.json(
        { error: "No pending signer to resend to" },
        { status: 400 }
      );
    }
    if (signer.status === "signed") {
      return NextResponse.json(
        { error: "That signer already signed." },
        { status: 400 }
      );
    }

    // Rotate the sign_token so the old link is invalidated. crypto.
    // randomUUID() is available in Node 19+; the runtime here supports it.
    const newToken = crypto.randomUUID();
    const { data: updated, error: updErr } = await ctx.supabase
      .from("contract_envelope_signers")
      .update({
        sign_token: newToken,
        status: "notified",
        notified_at: new Date().toISOString(),
      })
      .eq("id", signer.id)
      .select("sign_token")
      .single();
    if (updErr || !updated) {
      return NextResponse.json(
        { error: updErr?.message || "Failed to rotate token" },
        { status: 500 }
      );
    }

    const { count: totalSigners } = await ctx.supabase
      .from("contract_envelope_signers")
      .select("*", { count: "exact", head: true })
      .eq("envelope_id", id);

    const { data: studio } = await ctx.supabase
      .from("studios")
      .select("name")
      .eq("id", envelope.studio_id)
      .single();

    const tpl = contractSignRequest({
      signerName: signer.name,
      studioName: studio?.name ?? "Klasly",
      contractTitle: envelope.title,
      roleLabel: signer.role_label,
      signLink: `${getAppUrl()}/contracts/sign/${updated.sign_token}`,
      totalSigners: totalSigners ?? 0,
      signOrder: signer.sign_order,
    });

    try {
      await sendEmail({
        to: signer.email,
        subject: `Reminder: ${tpl.subject}`,
        html: tpl.html,
        studioId: envelope.studio_id,
        templateName: "contract_sign_resend",
      });
    } catch (err) {
      console.error("[contract-resend] email failed", err);
      // The token has already rotated. We surface the error so the admin
      // can retry, but don't roll back the rotation — the old link is
      // now invalid which is the safer state.
      return NextResponse.json(
        {
          error:
            "Token rotated but email send failed. Try again — the next attempt will rotate again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signer_id: signer.id,
      signer_email: signer.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
