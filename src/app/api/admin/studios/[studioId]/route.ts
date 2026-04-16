import { NextResponse } from "next/server";
import { requireAdmin, getAdminEmail } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { insertAdminLog } from "@/lib/admin/logs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const { data: studio, error: studioError } = await supabase
      .from("studios")
      .select("*")
      .eq("id", studioId)
      .single();

    if (studioError || !studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const { data: owner } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .single();

    const { count: membersActive } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("status", "active");
    const { count: membersPaused } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("status", "paused");
    const { count: membersCancelled } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("status", "cancelled");

    const { count: instructorsCount } = await supabase
      .from("instructors")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId);

    const { count: classesActive } = await supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("is_active", true);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: bookings30d } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .gte("created_at", thirtyDaysAgo);

    const { count: attended30d } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("attended", true)
      .gte("created_at", thirtyDaysAgo);

    const { count: dropIn30d } = await supabase
      .from("drop_in_attendances")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .gte("attended_at", thirtyDaysAgo);

    const { count: membersTotal } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId);
    const { count: waiverSigned } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("waiver_signed", true);

    const { data: payments } = await supabase
      .from("payments")
      .select("id, amount, type, status, paid_at, created_at, stripe_payment_intent_id")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      studio: {
        ...studio,
        owner_name: owner?.full_name ?? null,
        owner_email: owner?.email ?? null,
      },
      usage: {
        members_active: membersActive ?? 0,
        members_paused: membersPaused ?? 0,
        members_cancelled: membersCancelled ?? 0,
        instructors: instructorsCount ?? 0,
        active_classes: classesActive ?? 0,
        bookings_30d: bookings30d ?? 0,
        attendance_30d: (attended30d ?? 0) + (dropIn30d ?? 0),
        waiver_signed: waiverSigned ?? 0,
        waiver_total: membersTotal ?? 0,
      },
      payments: payments ?? [],
    });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const adminEmail = await getAdminEmail();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    // plan_status, trial_ends_at, cancel_at_period_end は Stripe 同期が必要なため
    // 専用エンドポイント (extend-trial, cancel, reset-trial) を使用すること
    if (body.admin_memo !== undefined) updates.admin_memo = body.admin_memo;
    if (body.is_demo !== undefined) updates.is_demo = Boolean(body.is_demo);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabase.from("studios").update(updates).eq("id", studioId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await insertAdminLog(supabase, {
      action: "studio-patch",
      studio_id: studioId,
      admin_email: adminEmail,
      status: "success",
      details: { fields: Object.keys(updates) },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
