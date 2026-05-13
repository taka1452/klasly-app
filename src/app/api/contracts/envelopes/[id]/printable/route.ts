import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

/**
 * GET /api/contracts/envelopes/[id]/printable
 *
 * Returns the joined data needed to render a print-friendly signed
 * envelope: form fields + each signer's submission responses + their
 * signature_data and timestamp. The print page calls this once and
 * formats it as a clean letter-style document.
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
        "id, title, status, created_at, completed_at, form_id, studio_id, contract_envelope_signers(id, sign_order, role_label, name, email, status, signed_at, signature_data, ip_address)"
      )
      .eq("id", id)
      .single();

    if (!envelope || envelope.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }
    if (envelope.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed contracts can be printed" },
        { status: 400 }
      );
    }

    // Collect signer emails so we can fetch their form submissions.
    const signerEmails = (envelope.contract_envelope_signers ?? []).map(
      (s: { email: string }) => s.email
    );

    const [{ data: form }, { data: studio }, { data: submissions }] =
      await Promise.all([
        ctx.supabase
          .from("custom_forms")
          .select("id, name, intro_text, fields")
          .eq("id", envelope.form_id)
          .single(),
        ctx.supabase
          .from("studios")
          .select("name")
          .eq("id", envelope.studio_id)
          .single(),
        ctx.supabase
          .from("custom_form_submissions")
          .select(
            "id, submitter_name, submitter_email, responses, signature_data, signed_at"
          )
          .eq("form_id", envelope.form_id)
          .in("submitter_email", signerEmails),
      ]);

    return NextResponse.json({
      envelope: {
        id: envelope.id,
        title: envelope.title,
        status: envelope.status,
        created_at: envelope.created_at,
        completed_at: envelope.completed_at,
      },
      studio: { name: studio?.name ?? "" },
      form: {
        id: form?.id,
        name: form?.name,
        intro_text: form?.intro_text,
        fields: form?.fields ?? [],
      },
      signers: (envelope.contract_envelope_signers ?? []).sort(
        (a: { sign_order: number }, b: { sign_order: number }) =>
          a.sign_order - b.sign_order
      ),
      submissions: submissions ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
