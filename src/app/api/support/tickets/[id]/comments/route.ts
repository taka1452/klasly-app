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
 * Add a comment to a ticket. User must be owner of the ticket's studio.
 */
export async function POST(
  request: Request,
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

    const { id: ticketId } = await params;

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, studio_id")
      .eq("id", ticketId)
      .single();

    if (!ticket || ticket.studio_id !== studioId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const content = (body.content ?? "").trim();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const createdBy = user.email ?? user.id;

    const { data: comment, error } = await supabase
      .from("support_ticket_comments")
      .insert({
        ticket_id: ticketId,
        content,
        created_by: createdBy,
      })
      .select("id, content, created_by, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    return NextResponse.json({ comment });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
