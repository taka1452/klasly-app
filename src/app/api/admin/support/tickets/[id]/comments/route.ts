import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const serverSupabase = await createClient();
    const { id: ticketId } = await params;

    const {
      data: { user },
    } = await serverSupabase.auth.getUser();
    const createdBy = user?.email ?? user?.id ?? "admin";

    const body = await request.json().catch(() => ({}));
    const content = (body.content ?? "").trim();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const { data: ticket } = await supabase.from("support_tickets").select("id").eq("id", ticketId).single();

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

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
