import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

// ============================================================
// GET /api/messages/[memberId]
//   特定メンバーとのスレッドを時系列で取得
// ============================================================
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
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
    .select("id, role, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 400 });
  }

  // 自分と相手のIDペア
  const myId = user.id;
  const otherId = memberId;

  // 両方向のメッセージを取得
  const { data: messages, error } = await adminDb
    .from("messages")
    .select(
      "id, sender_id, recipient_id, content, read_at, created_at, sender:profiles!messages_sender_id_fkey(id, full_name, role), recipient:profiles!messages_recipient_id_fkey(id, full_name, role)"
    )
    .eq("studio_id", profile.studio_id)
    .or(
      `and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[messages/[memberId] GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}

// ============================================================
// PATCH /api/messages/[memberId]
//   スレッド内の未読メッセージを既読に更新（read_at = now()）
//   自分が受信者のメッセージのみ
// ============================================================
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
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
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 400 });
  }

  // 自分が受信者で、送信者が memberId で、未読のメッセージを既読に
  const { error } = await adminDb
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("studio_id", profile.studio_id)
    .eq("sender_id", memberId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("[messages/[memberId] PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
