import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getStudioIdForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", userId)
    .single();
  const p = data as { studio_id: string | null; role: string } | null;
  return p?.role === "owner" && p?.studio_id ? p.studio_id : null;
}

/**
 * Get a single ticket with comments. User must be owner of the ticket's studio.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const studioId = await getStudioIdForUser(supabase, user.id);
    if (!studioId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const { data: comments } = await supabase
      .from("support_ticket_comments")
      .select("id, content, created_by, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ticket,
      comments: comments ?? [],
    });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
