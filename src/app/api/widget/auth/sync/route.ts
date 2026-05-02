import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/widget/auth/sync
 *
 * Bridges a widget session (access_token + refresh_token held in
 * localStorage by the widget client) into the main-site cookie session
 * managed by @supabase/ssr.
 *
 * The widget client uses localStorage so it works inside cross-origin
 * iframes where 3rd-party cookies are blocked. When a member needs to
 * leave the widget for a flow that lives on the main site (e.g. paying
 * for a pass), this endpoint hands the session over to the cookie store
 * so the next navigation is already authenticated.
 */
export async function POST(request: Request) {
  let body: { access_token?: unknown; refresh_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accessToken =
    typeof body.access_token === "string" ? body.access_token : "";
  const refreshToken =
    typeof body.refresh_token === "string" ? body.refresh_token : "";

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: "Missing access_token or refresh_token" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true });
}
