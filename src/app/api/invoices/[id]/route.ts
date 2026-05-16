import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  resolveDiscountCode,
  recordDiscountRedemption,
} from "@/lib/discounts/apply";

/**
 * Per-invoice operations: view / update / delete / transition state.
 *
 * Routes:
 *   GET    /api/invoices/:id            — single invoice with instructor + studio info
 *   PATCH  /api/invoices/:id            — update (adjustments_cents, notes) while draft
 *   POST   /api/invoices/:id?action=send
 *   POST   /api/invoices/:id?action=mark_paid
 *   POST   /api/invoices/:id?action=void
 *   DELETE /api/invoices/:id            — drafts only
 */

async function getAdminContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;

  if (profile.role === "owner") {
    return { supabase, studioId: profile.studio_id, userId: user.id, role: "owner" as const };
  }
  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select("can_manage_contracts_tiers, can_view_payments")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_manage_contracts_tiers && !manager?.can_view_payments) {
      return null;
    }
    return {
      supabase,
      studioId: profile.studio_id,
      userId: user.id,
      role: "manager" as const,
    };
  }
  return null;
}

async function loadInvoice(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  studioId: string,
  id: string
) {
  const { data } = await supabase
    .from("instructor_invoices")
    .select(
      "*, instructors(id, profile_id, profiles(full_name, email))"
    )
    .eq("id", id)
    .eq("studio_id", studioId)
    .single();
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await loadInvoice(ctx.supabase, ctx.studioId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const invoice = await loadInvoice(ctx.supabase, ctx.studioId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be edited. Void or delete first." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.adjustments_cents === "number") {
    updates.adjustments_cents = body.adjustments_cents;
  }
  if (body.adjustments_note !== undefined) {
    updates.adjustments_note =
      typeof body.adjustments_note === "string" && body.adjustments_note.trim().length > 0
        ? body.adjustments_note.trim()
        : null;
  }
  if (body.notes !== undefined) {
    updates.notes =
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;
  }

  // Optional discount_code (Sarah's "discount before sending"). Admin
  // types a code on the draft; we resolve via the shared helper and
  // store the resolved amount on the invoice. Pass an empty string to
  // clear an applied code.
  if (body.discount_code !== undefined) {
    if (typeof body.discount_code !== "string" || !body.discount_code.trim()) {
      updates.discount_code_id = null;
      updates.discount_amount_off_cents = 0;
    } else {
      const grossForDiscount =
        (invoice.tier_charge_cents || 0) +
        (invoice.overage_charge_cents || 0) +
        (invoice.flat_fee_cents || 0) +
        ((updates.adjustments_cents as number) ??
          (invoice.adjustments_cents || 0));
      const result = await resolveDiscountCode(ctx.supabase, {
        studioId: ctx.studioId,
        memberId: null,
        amountCents: Math.max(0, grossForDiscount),
        context: "contract_invoice",
        codeInput: body.discount_code,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.reason, code: "DISCOUNT_INVALID" },
          { status: 400 }
        );
      }
      updates.discount_code_id = result.code.id;
      updates.discount_amount_off_cents = result.amountOffCents;
    }
  }

  // Recalculate total_cents. Adjustments can be negative (refund-style
  // credit). Discount subtracts on top — keep it separate from
  // adjustments so we can attribute the savings to a specific code.
  const resolvedAdjustments =
    (updates.adjustments_cents as number) ?? (invoice.adjustments_cents || 0);
  const resolvedDiscountOff =
    (updates.discount_amount_off_cents as number) ??
    (invoice.discount_amount_off_cents || 0);
  const newTotal =
    (invoice.tier_charge_cents || 0) +
    (invoice.overage_charge_cents || 0) +
    (invoice.flat_fee_cents || 0) +
    resolvedAdjustments -
    resolvedDiscountOff;
  updates.total_cents = Math.max(0, newTotal);

  const { data, error } = await ctx.supabase
    .from("instructor_invoices")
    .update(updates)
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await loadInvoice(ctx.supabase, ctx.studioId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be deleted. Use void instead." },
      { status: 400 }
    );
  }

  const { error } = await ctx.supabase
    .from("instructor_invoices")
    .delete()
    .eq("id", id)
    .eq("studio_id", ctx.studioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  const invoice = await loadInvoice(ctx.supabase, ctx.studioId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "send") {
    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be sent." },
        { status: 400 }
      );
    }

    const { data: updated, error } = await ctx.supabase
      .from("instructor_invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Record the discount redemption now that the invoice has actually
    // been issued. Once recorded the used_count / one-time-per-member
    // checks lock the code for the same member next time.
    if (updated?.discount_code_id && (updated.discount_amount_off_cents ?? 0) > 0) {
      try {
        await recordDiscountRedemption(ctx.supabase, {
          studioId: ctx.studioId,
          discountCodeId: updated.discount_code_id as string,
          memberId: null,
          amountOffCents: updated.discount_amount_off_cents as number,
          context: "contract_invoice",
          contextId: updated.id as string,
        });
      } catch (err) {
        console.warn("[invoices] discount redemption record failed:", err);
      }
    }

    // Email best-effort — never block the transition on email failure.
    void sendInvoiceEmail(ctx.supabase, ctx.studioId, updated).catch((err) =>
      console.warn("[invoices] email send failed", err)
    );

    return NextResponse.json(updated);
  }

  if (action === "mark_paid") {
    if (invoice.status === "void") {
      return NextResponse.json({ error: "Cannot mark void invoice paid" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const paidAt = body.paid_at || new Date().toISOString();
    const { data: updated, error } = await ctx.supabase
      .from("instructor_invoices")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  if (action === "void") {
    const { data: updated, error } = await ctx.supabase
      .from("instructor_invoices")
      .update({ status: "void" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function sendInvoiceEmail(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  studioId: string,
  invoice: Record<string, unknown>
): Promise<void> {
  try {
    const instructorId = invoice.instructor_id as string;
    const { data: instr } = await supabase
      .from("instructors")
      .select("profiles(email, full_name)")
      .eq("id", instructorId)
      .single();
    const rawProfile = instr?.profiles as unknown;
    const prof = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as
      | { email?: string; full_name?: string }
      | null;
    if (!prof?.email) return;

    const { data: studio } = await supabase
      .from("studios")
      .select("name")
      .eq("id", studioId)
      .single();

    const { sendEmail } = await import("@/lib/email/send");

    const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const subject = `Invoice for ${invoice.period_start} from ${studio?.name || "your studio"}`;
    const html = `
      <p>Hi ${prof.full_name || "there"},</p>
      <p>Your monthly invoice for <strong>${invoice.period_start}</strong> &ndash; <strong>${invoice.period_end}</strong> is ready.</p>
      <table cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
        <tr><td>Tier${invoice.tier_name ? ` (${invoice.tier_name})` : ""}</td><td style="text-align:right;">${dollars((invoice.tier_charge_cents as number) || 0)}</td></tr>
        <tr><td>Overage charges</td><td style="text-align:right;">${dollars((invoice.overage_charge_cents as number) || 0)}</td></tr>
        <tr><td>Flat / per-class fees</td><td style="text-align:right;">${dollars((invoice.flat_fee_cents as number) || 0)}</td></tr>
        <tr><td>Adjustments</td><td style="text-align:right;">${dollars((invoice.adjustments_cents as number) || 0)}</td></tr>
        ${(invoice.discount_amount_off_cents as number) > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-${dollars((invoice.discount_amount_off_cents as number) || 0)}</td></tr>` : ""}
        <tr style="border-top:1px solid #ccc;font-weight:bold;"><td>Total</td><td style="text-align:right;">${dollars((invoice.total_cents as number) || 0)}</td></tr>
      </table>
      ${invoice.notes ? `<p>${String(invoice.notes).replace(/</g, "&lt;")}</p>` : ""}
      <p>Thanks,<br/>${studio?.name || "Your studio"}</p>
    `;

    await sendEmail({
      to: prof.email,
      subject,
      html,
      studioId,
      templateName: "instructorInvoice",
    });
  } catch (err) {
    console.warn("[invoices] email error:", err);
  }
}
