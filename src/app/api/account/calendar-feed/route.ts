import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { randomUUID } from "node:crypto";

/**
 * Manage the per-user iCalendar subscription token.
 *
 *   GET    → returns { token, url } if one exists, else { token: null }
 *   POST   → generate a new token (idempotent: regenerates and returns the new one)
 *   DELETE → revoke (sets token to NULL)
 *
 * The actual feed is served at /api/ical/<token>.
 */

function feedUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/api/ical/${token}`;
}

function getOrigin(request: Request): string {
  // Prefer absolute URL from incoming request; fall back to NEXT_PUBLIC_APP_URL.
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.klasly.app";
  }
}

export async function GET(request: Request) {
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
    .select("calendar_feed_token")
    .eq("id", user.id)
    .single();

  const token = profile?.calendar_feed_token ?? null;
  return NextResponse.json({
    token,
    url: token ? feedUrl(getOrigin(request), token) : null,
  });
}

export async function POST(request: Request) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = createAdminClient();
  const newToken = randomUUID();

  const { error } = await adminDb
    .from("profiles")
    .update({ calendar_feed_token: newToken })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    token: newToken,
    url: feedUrl(getOrigin(request), newToken),
  });
}

export async function DELETE() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("profiles")
    .update({ calendar_feed_token: null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
