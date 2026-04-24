import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Studio integration connections (Google, Mailchimp, Zoom...).
 *
 *   GET  /api/integrations                 — list connections
 *   POST /api/integrations                 — upsert/update a connection's
 *                                             metadata + status
 *
 * The actual OAuth callback lives per-provider (e.g. /auth/google/callback)
 * and writes tokens here. This API is the read/update surface for the
 * settings UI.
 */

async function getAdminContext() {
  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;
  if (profile.role === "owner") return { supabase, studioId: profile.studio_id };
  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select("can_manage_settings")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_manage_settings) return null;
    return { supabase, studioId: profile.studio_id };
  }
  return null;
}

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("integration_connections")
    .select("id, provider, status, connected_email, scopes, expires_at, metadata, created_at, updated_at")
    .eq("studio_id", ctx.studioId)
    .order("provider");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const provider = body.provider as string;
  const status = body.status as string | undefined;
  const metadata = body.metadata ?? {};

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    studio_id: ctx.studioId,
    provider,
    metadata,
  };
  if (status) updates.status = status;
  if (body.connected_email !== undefined) updates.connected_email = body.connected_email;
  if (Array.isArray(body.scopes)) updates.scopes = body.scopes;

  const { data, error } = await ctx.supabase
    .from("integration_connections")
    .upsert(updates, { onConflict: "studio_id,provider" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
