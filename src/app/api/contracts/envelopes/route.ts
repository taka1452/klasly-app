import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { sendEmail } from "@/lib/email/send";
import { contractSignRequest } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";

/**
 * POST /api/contracts/envelopes
 *
 * Owner / manager (with can_manage_contracts_tiers OR can_manage_settings)
 * sends a contract template out for ordered multi-signature signing.
 *
 * Body:
 *   {
 *     form_id: string,            // custom_forms row, must be form_type='contract'
 *     title?: string,             // defaults to the form's name
 *     instructor_id?: string,     // optional — surfaces the signed envelope on the instructor's profile
 *     signers: [
 *       { name, email, role_label?, profile_id? }, ...
 *     ]
 *   }
 *
 * Order is taken from the array order. The first signer is emailed
 * immediately; later signers wait for the previous to sign.
 *
 * Jamie feedback 2026-04-30: "Is there an option or ability to collect
 * multiple signatures in a specific order on contracts through Klasly,
 * similar to how Jotform works?"
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const formId = typeof body.form_id === "string" ? body.form_id : null;
    const title = typeof body.title === "string" ? body.title.trim() : null;
    const instructorId =
      typeof body.instructor_id === "string" && body.instructor_id ? body.instructor_id : null;
    const signers = Array.isArray(body.signers) ? body.signers : [];

    if (!formId) {
      return NextResponse.json({ error: "form_id is required" }, { status: 400 });
    }
    if (signers.length === 0) {
      return NextResponse.json({ error: "At least one signer is required" }, { status: 400 });
    }
    if (signers.length > 10) {
      // 10 is plenty for any realistic contract — guards against
      // accidental "loop and add 1000 signers" bugs in the UI.
      return NextResponse.json({ error: "Maximum 10 signers per contract" }, { status: 400 });
    }
    for (const s of signers) {
      if (!s.name || !s.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
        return NextResponse.json(
          { error: "Each signer needs a valid name and email" },
          { status: 400 }
        );
      }
    }

    // Validate the form belongs to this studio and is a contract type.
    const { data: form } = await ctx.supabase
      .from("custom_forms")
      .select("id, studio_id, name, form_type, is_active")
      .eq("id", formId)
      .single();
    if (!form || form.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Contract form not found" }, { status: 404 });
    }
    if (form.form_type !== "contract") {
      return NextResponse.json(
        { error: "Only forms of type 'contract' can be sent for signing" },
        { status: 400 }
      );
    }
    if (!form.is_active) {
      return NextResponse.json(
        { error: "This contract form is inactive — activate it first." },
        { status: 400 }
      );
    }

    // If an instructor was provided, confirm they belong to this studio.
    if (instructorId) {
      const { data: instr } = await ctx.supabase
        .from("instructors")
        .select("id, studio_id")
        .eq("id", instructorId)
        .single();
      if (!instr || instr.studio_id !== ctx.studioId) {
        return NextResponse.json(
          { error: "Instructor not found in this studio" },
          { status: 400 }
        );
      }
    }

    // Create the envelope.
    const { data: envelope, error: envErr } = await ctx.supabase
      .from("contract_envelopes")
      .insert({
        studio_id: ctx.studioId,
        form_id: formId,
        title: title || form.name,
        instructor_id: instructorId,
        status: "in_progress",
        created_by: ctx.userId,
      })
      .select("id, title")
      .single();
    if (envErr || !envelope) {
      return NextResponse.json(
        { error: envErr?.message || "Failed to create envelope" },
        { status: 500 }
      );
    }

    // Insert signers in order, then email signer 1.
    type SignerInput = {
      name: string;
      email: string;
      role_label?: string;
      profile_id?: string;
    };
    const rows = (signers as SignerInput[]).map((s, idx) => ({
      envelope_id: envelope.id,
      sign_order: idx + 1,
      role_label: s.role_label?.trim() || null,
      name: s.name.trim(),
      email: s.email.trim().toLowerCase(),
      profile_id: s.profile_id || null,
      status: idx === 0 ? "notified" : "pending",
      notified_at: idx === 0 ? new Date().toISOString() : null,
    }));
    const { data: insertedSigners, error: signersErr } = await ctx.supabase
      .from("contract_envelope_signers")
      .insert(rows)
      .select("id, sign_order, name, email, sign_token, role_label");
    if (signersErr || !insertedSigners) {
      // Roll back the envelope if signer inserts failed — otherwise we'd
      // leave a dangling envelope with no signers.
      await ctx.supabase.from("contract_envelopes").delete().eq("id", envelope.id);
      return NextResponse.json(
        { error: signersErr?.message || "Failed to create signers" },
        { status: 500 }
      );
    }

    // Get studio name once for the email.
    const { data: studio } = await ctx.supabase
      .from("studios")
      .select("name")
      .eq("id", ctx.studioId)
      .single();

    // Email signer 1.
    const firstSigner = insertedSigners.find((s) => s.sign_order === 1);
    if (!firstSigner) {
      // Should never happen, but guard against data inconsistency.
      await ctx.supabase.from("contract_envelopes").delete().eq("id", envelope.id);
      return NextResponse.json(
        { error: "Failed to locate first signer after insert" },
        { status: 500 }
      );
    }
    const appUrl = getAppUrl();
    const signLink = `${appUrl}/contracts/sign/${firstSigner.sign_token}`;
    const tpl = contractSignRequest({
      signerName: firstSigner.name,
      studioName: studio?.name ?? "Klasly",
      contractTitle: envelope.title,
      roleLabel: firstSigner.role_label,
      signLink,
      totalSigners: insertedSigners.length,
      signOrder: 1,
    });
    let emailSent = true;
    try {
      await sendEmail({
        to: firstSigner.email,
        subject: tpl.subject,
        html: tpl.html,
        studioId: ctx.studioId,
        templateName: "contract_sign_request",
      });
    } catch (err) {
      console.error("[contracts/envelopes] Failed to send signing email:", err);
      emailSent = false;
    }

    return NextResponse.json(
      {
        envelope_id: envelope.id,
        title: envelope.title,
        signer_count: insertedSigners.length,
        emailSent,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/contracts/envelopes?form_id=...&instructor_id=...
 *
 * List envelopes for the current studio, optionally filtered by form
 * (e.g. when viewing a contract template's submissions tab) or by
 * instructor (e.g. on the instructor profile page).
 */
export async function GET(request: Request) {
  try {
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const formId = url.searchParams.get("form_id");
    const instructorId = url.searchParams.get("instructor_id");

    let query = ctx.supabase
      .from("contract_envelopes")
      .select(
        "id, title, status, created_at, completed_at, form_id, instructor_id, contract_envelope_signers(id, sign_order, name, email, role_label, status, signed_at)"
      )
      .eq("studio_id", ctx.studioId)
      .order("created_at", { ascending: false });

    if (formId) query = query.eq("form_id", formId);
    if (instructorId) query = query.eq("instructor_id", instructorId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ envelopes: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
