import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Studio Closures (holiday calendar) API.
 *
 * Owners + managers with can_manage_settings can mark whole days as
 * closed without having to cancel each session individually.
 *
 * - GET    /api/studio/closures          → list upcoming closures
 * - POST   /api/studio/closures          → add a closure (and optionally
 *                                          auto-cancel matching sessions)
 * - DELETE /api/studio/closures?id=...   → remove a closure (sessions stay
 *                                          cancelled — restore manually)
 */

type Ctx = {
  studioId: string;
  userId: string;
  adminDb: SupabaseClient;
};

async function authorize(): Promise<
  | { ok: true; ctx: Ctx }
  | { ok: false; response: NextResponse }
> {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminDb = createAdminClient();

  const { data: profile } = await adminDb
    .from("profiles")
    .select("role, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  // Owner: always allowed.
  // Manager: requires can_manage_settings.
  if (profile.role !== "owner") {
    if (profile.role !== "manager") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    const { data: mgr } = await adminDb
      .from("managers")
      .select("can_manage_settings")
      .eq("profile_id", user.id)
      .single();
    if (!mgr?.can_manage_settings) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return {
    ok: true,
    ctx: { studioId: profile.studio_id, userId: user.id, adminDb },
  };
}

// ---------- GET ----------

export async function GET() {
  const auth = await authorize();
  if (!auth.ok) return auth.response;
  const { studioId, adminDb } = auth.ctx;

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await adminDb
    .from("studio_closures")
    .select("id, closure_date, label, reason, created_at")
    .eq("studio_id", studioId)
    .gte("closure_date", today)
    .order("closure_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ closures: data ?? [] });
}

// ---------- POST ----------

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;
  const { studioId, userId, adminDb } = auth.ctx;

  const body = (await request.json().catch(() => ({}))) as {
    closure_date?: string;
    label?: string;
    reason?: string;
    cancel_sessions?: boolean;
  };

  const closureDate = (body.closure_date ?? "").trim();
  const label = (body.label ?? "").trim();
  const reason = body.reason?.trim() || null;
  const cancelSessions = body.cancel_sessions !== false; // default true

  if (!/^\d{4}-\d{2}-\d{2}$/.test(closureDate)) {
    return NextResponse.json(
      { error: "closure_date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  // Insert (unique per studio_id + closure_date)
  const { data: inserted, error: insertErr } = await adminDb
    .from("studio_closures")
    .insert({
      studio_id: studioId,
      closure_date: closureDate,
      label,
      reason,
      created_by: userId,
    })
    .select("id, closure_date, label, reason, created_at")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "A closure already exists for that date" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  let sessionsCancelled = 0;
  let bookingsCancelled = 0;

  if (cancelSessions) {
    const result = await cancelSessionsOnDate(
      adminDb,
      studioId,
      closureDate,
      `Studio closed: ${label}`
    );
    sessionsCancelled = result.sessionsCancelled;
    bookingsCancelled = result.bookingsCancelled;
  }

  return NextResponse.json({
    closure: inserted,
    sessions_cancelled: sessionsCancelled,
    bookings_cancelled: bookingsCancelled,
  });
}

// ---------- DELETE ----------

export async function DELETE(request: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;
  const { studioId, adminDb } = auth.ctx;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await adminDb
    .from("studio_closures")
    .delete()
    .eq("id", id)
    .eq("studio_id", studioId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ---------- helpers ----------

/**
 * Cancel every non-cancelled session in this studio on the given date,
 * then auto-cancel its bookings (refund credit / pass) using the same
 * pattern as DELETE /api/sessions/[id].
 */
async function cancelSessionsOnDate(
  adminDb: SupabaseClient,
  studioId: string,
  date: string,
  cancellationReason: string
): Promise<{ sessionsCancelled: number; bookingsCancelled: number }> {
  const { data: sessions } = await adminDb
    .from("class_sessions")
    .select("id")
    .eq("studio_id", studioId)
    .eq("session_date", date)
    .eq("is_cancelled", false);

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  if (sessionIds.length === 0) {
    return { sessionsCancelled: 0, bookingsCancelled: 0 };
  }

  await adminDb
    .from("class_sessions")
    .update({
      is_cancelled: true,
      cancellation_reason: cancellationReason,
    })
    .in("id", sessionIds);

  // Refund bookings
  const { data: bookings } = await adminDb
    .from("bookings")
    .select("id, status, member_id, session_id, booked_via_pass")
    .in("session_id", sessionIds)
    .in("status", ["confirmed", "waitlist"]);

  if (!bookings || bookings.length === 0) {
    return { sessionsCancelled: sessionIds.length, bookingsCancelled: 0 };
  }

  const bookingIds = bookings.map((b: { id: string }) => b.id);
  await adminDb
    .from("bookings")
    .update({ status: "cancelled" })
    .in("id", bookingIds);

  for (const b of bookings) {
    if (b.status !== "confirmed") continue;

    if (b.booked_via_pass) {
      const { data: usageRows } = await adminDb
        .from("pass_class_usage")
        .select("id, pass_subscription_id, pass_subscriptions(id, member_id)")
        .eq("session_id", b.session_id);

      if (usageRows) {
        for (const usage of usageRows) {
          const sub = (
            Array.isArray(usage.pass_subscriptions)
              ? usage.pass_subscriptions[0]
              : usage.pass_subscriptions
          ) as { id: string; member_id: string } | null;
          if (!sub || sub.member_id !== b.member_id) continue;

          await adminDb
            .from("pass_class_usage")
            .delete()
            .eq("id", usage.id);
          await adminDb.rpc("decrement_pass_usage", {
            p_subscription_id: sub.id,
          });
          break;
        }
      }
    } else {
      await adminDb.rpc("increment_member_credits", {
        p_member_id: b.member_id,
      });
    }
  }

  return {
    sessionsCancelled: sessionIds.length,
    bookingsCancelled: bookings.length,
  };
}
