import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  contractSignRequest,
  contractSignComplete,
} from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";

/**
 * GET /api/contracts/sign/[token]
 *
 * Public endpoint — anyone with the token can read the envelope, the
 * form definition, and their own signer state. We don't expose other
 * signers' details (only the count) so the URL stays a one-way share.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const svc = serviceClient();
    if (!svc) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

    const { data: signer } = await svc
      .from("contract_envelope_signers")
      .select(
        "id, envelope_id, sign_order, name, email, role_label, status, signed_at"
      )
      .eq("sign_token", token)
      .single();
    if (!signer) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    }

    const { data: envelope } = await svc
      .from("contract_envelopes")
      .select("id, title, status, form_id, studio_id")
      .eq("id", signer.envelope_id)
      .single();
    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    const [{ data: form }, { data: studio }, { count: totalSigners }] =
      await Promise.all([
        svc
          .from("custom_forms")
          .select("id, name, intro_text, success_message, fields, requires_signature")
          .eq("id", envelope.form_id)
          .single(),
        svc.from("studios").select("name").eq("id", envelope.studio_id).single(),
        svc
          .from("contract_envelope_signers")
          .select("*", { count: "exact", head: true })
          .eq("envelope_id", envelope.id),
      ]);

    if (!form) {
      return NextResponse.json({ error: "Contract form missing" }, { status: 404 });
    }

    return NextResponse.json({
      envelope: {
        id: envelope.id,
        title: envelope.title,
        status: envelope.status,
        studio_name: studio?.name ?? "Klasly",
      },
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role_label: signer.role_label,
        status: signer.status,
        signed_at: signer.signed_at,
        sign_order: signer.sign_order,
        total_signers: totalSigners ?? 0,
      },
      form: {
        id: form.id,
        name: form.name,
        intro_text: form.intro_text,
        success_message: form.success_message,
        fields: form.fields,
        requires_signature: form.requires_signature,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/contracts/sign/[token]
 *
 * Submit a signature. Body:
 *   { responses: {[fieldId]: ...}, signature_data: string, name?: string }
 *
 * Side-effects:
 * - Marks this signer's row signed.
 * - If a next signer exists, emails them their sign link.
 * - If this was the last signer, marks envelope completed and emails the
 *   creator.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const svc = serviceClient();
    if (!svc) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

    const { data: signer } = await svc
      .from("contract_envelope_signers")
      .select("id, envelope_id, sign_order, name, email, role_label, status")
      .eq("sign_token", token)
      .single();
    if (!signer) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    }
    if (signer.status === "signed") {
      return NextResponse.json(
        { error: "You've already signed this contract." },
        { status: 400 }
      );
    }
    if (signer.status === "declined") {
      return NextResponse.json(
        { error: "This signing link was declined." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const responses =
      typeof body.responses === "object" && body.responses ? body.responses : {};
    const signatureData =
      typeof body.signature_data === "string" ? body.signature_data : "";

    if (!signatureData || signatureData.trim().length === 0) {
      return NextResponse.json(
        { error: "Signature is required" },
        { status: 400 }
      );
    }
    // Sanity bound — a typed-name signature shouldn't be more than ~200
    // chars. Stops a malicious caller filling the column with megabytes.
    if (signatureData.length > 500) {
      return NextResponse.json(
        { error: "Signature too long" },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      null;

    // Atomic sign — the Postgres function locks the signer row, verifies
    // the prior-unsigned condition inside the same transaction, and
    // marks the row signed. Closes the race window where two signers
    // could simultaneously pass a separate prior-check.
    const { data: rpcResult, error: rpcErr } = await svc.rpc(
      "sign_contract_signer",
      {
        p_signer_id: signer.id,
        p_signature_data: signatureData,
        p_ip_address: ip,
        p_user_agent: request.headers.get("user-agent") ?? null,
      }
    );
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }
    const result = rpcResult as { success?: boolean; error?: string };
    if (result?.error === "prior_unsigned") {
      return NextResponse.json(
        { error: "Earlier signer hasn't signed yet — they need to sign first." },
        { status: 400 }
      );
    }
    if (result?.error === "already_signed") {
      return NextResponse.json(
        { error: "You've already signed this contract." },
        { status: 400 }
      );
    }
    if (result?.error === "declined" || result?.error === "not_found") {
      return NextResponse.json(
        { error: "This signing link is no longer valid." },
        { status: 400 }
      );
    }
    if (!result?.success) {
      return NextResponse.json(
        { error: "Could not record signature" },
        { status: 500 }
      );
    }

    // Persist the per-signer responses on a custom_form_submissions row
    // so the existing submissions UI (and CSV export) shows them just
    // like a normal one-shot form fill. We tag the signature_data and
    // submitter info from the signer.
    const { data: envelope } = await svc
      .from("contract_envelopes")
      .select("id, studio_id, form_id, title, instructor_id, created_by")
      .eq("id", signer.envelope_id)
      .single();

    if (envelope) {
      await svc.from("custom_form_submissions").insert({
        form_id: envelope.form_id,
        studio_id: envelope.studio_id,
        submitter_name: signer.name,
        submitter_email: signer.email,
        responses,
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        ip_address: ip,
        user_agent: request.headers.get("user-agent") ?? null,
      });
    }

    // Advance: email the next signer, or close the envelope.
    const { data: next } = await svc
      .from("contract_envelope_signers")
      .select("id, name, email, role_label, sign_order, sign_token")
      .eq("envelope_id", signer.envelope_id)
      .gt("sign_order", signer.sign_order)
      .order("sign_order", { ascending: true })
      .limit(1);

    const studioName =
      (
        await svc
          .from("studios")
          .select("name")
          .eq("id", envelope?.studio_id ?? "")
          .single()
      ).data?.name ?? "Klasly";

    const { count: totalSigners } = await svc
      .from("contract_envelope_signers")
      .select("*", { count: "exact", head: true })
      .eq("envelope_id", signer.envelope_id);

    if (next && next.length > 0 && envelope) {
      const nextSigner = next[0];
      await svc
        .from("contract_envelope_signers")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", nextSigner.id);
      const link = `${getAppUrl()}/contracts/sign/${nextSigner.sign_token}`;
      const tpl = contractSignRequest({
        signerName: nextSigner.name,
        studioName,
        contractTitle: envelope.title,
        roleLabel: nextSigner.role_label,
        signLink: link,
        totalSigners: totalSigners ?? 0,
        signOrder: nextSigner.sign_order,
      });
      // Email failure must not bubble up — the signer's signature is
      // already stored, and we don't want the API to return 500 with a
      // "couldn't sign" message that misleads the signer. Log and move
      // on; the studio admin can resend from the envelope detail.
      try {
        await sendEmail({
          to: nextSigner.email,
          subject: tpl.subject,
          html: tpl.html,
          studioId: envelope.studio_id,
          templateName: "contract_sign_request",
        });
      } catch (err) {
        console.error("[contract-sign] next signer email failed", err);
      }
    } else if (envelope) {
      // Last signer just signed — mark envelope completed.
      await svc
        .from("contract_envelopes")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", envelope.id);

      // Notify the creator that the contract is fully signed.
      if (envelope.created_by) {
        const { data: creator } = await svc
          .from("profiles")
          .select("full_name, email")
          .eq("id", envelope.created_by)
          .single();
        if (creator?.email) {
          const tpl = contractSignComplete({
            adminName: creator.full_name ?? "there",
            studioName,
            contractTitle: envelope.title,
            signerCount: totalSigners ?? 0,
            envelopeUrl: `${getAppUrl()}/settings/forms`,
          });
          try {
            await sendEmail({
              to: creator.email,
              subject: tpl.subject,
              html: tpl.html,
              studioId: envelope.studio_id,
              templateName: "contract_sign_complete",
            });
          } catch (err) {
            console.error("[contract-sign] completion email failed", err);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/contracts/sign/[token]
 *
 * Signer declines to sign. Marks their row declined and voids the entire
 * envelope (a multi-sig contract is moot if any party refuses). Notifies
 * the creator so the studio knows to follow up.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const svc = serviceClient();
    if (!svc) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

    const { data: signer } = await svc
      .from("contract_envelope_signers")
      .select("id, envelope_id, name, status")
      .eq("sign_token", token)
      .single();
    if (!signer) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    }
    if (signer.status === "signed") {
      return NextResponse.json(
        { error: "You've already signed this contract — contact the studio to revoke." },
        { status: 400 }
      );
    }
    if (signer.status === "declined") {
      return NextResponse.json({ success: true, alreadyDeclined: true });
    }

    let reason: string | null = null;
    try {
      const body = (await request.json()) as { reason?: unknown };
      if (typeof body.reason === "string" && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 500);
      }
    } catch {
      // Body optional; decline can be a bare DELETE
    }

    await svc
      .from("contract_envelope_signers")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", signer.id);

    // Void the envelope — once one signer refuses, the document can't
    // close cleanly. Studio can re-send a fresh envelope if circumstances
    // change. We don't wipe earlier signatures: they're audit history.
    await svc
      .from("contract_envelopes")
      .update({ status: "voided" })
      .eq("id", signer.envelope_id);

    // Best-effort: notify the creator. Email failure must not break the
    // decline action itself.
    try {
      const { data: envelope } = await svc
        .from("contract_envelopes")
        .select("title, studio_id, created_by")
        .eq("id", signer.envelope_id)
        .single();
      if (envelope?.created_by) {
        const { data: creator } = await svc
          .from("profiles")
          .select("full_name, email")
          .eq("id", envelope.created_by)
          .single();
        if (creator?.email) {
          const escHtml = (s: string) =>
            s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const safeName = escHtml(signer.name);
          const safeTitle = escHtml(envelope.title);
          const safeCreator = escHtml(creator.full_name ?? "there");
          const safeReason = reason ? escHtml(reason) : null;
          await sendEmail({
            to: creator.email,
            subject: `Contract declined — ${envelope.title}`,
            html: `<p>Hi ${safeCreator},</p><p><strong>${safeName}</strong> declined to sign <strong>${safeTitle}</strong>${safeReason ? `: &ldquo;${safeReason}&rdquo;` : "."}</p><p>The envelope has been marked voided. You can send a fresh contract whenever you're ready.</p>`,
            studioId: envelope.studio_id,
            templateName: "contract_declined",
          });
        }
      }
    } catch (err) {
      console.error("[contract-sign] decline email failed", err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}
