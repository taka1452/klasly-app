import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { messageNotification } from "@/lib/email/templates";
import { sendPushNotification } from "@/lib/push/send";
import { pushNewMessage } from "@/lib/push/templates";

// ============================================================
// GET /api/messages
//   オーナー: スタジオ内の会話一覧（メンバーごとの最新メッセージ + 未読数）
//   メンバー: オーナーとの会話スレッド一覧（最新メッセージ + 未読数）
// ============================================================
export async function GET() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = createAdminClient();

  // プロフィール取得
  const { data: profile } = await adminDb
    .from("profiles")
    .select("id, role, studio_id, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 400 });
  }

  if (profile.role === "owner") {
    // オーナー: スタジオ内の全メッセージを取得して、メンバーごとにグループ化
    const { data: messages, error } = await adminDb
      .from("messages")
      .select(
        "id, sender_id, recipient_id, content, read_at, created_at, sender:profiles!messages_sender_id_fkey(id, full_name, email, role), recipient:profiles!messages_recipient_id_fkey(id, full_name, email, role)"
      )
      .eq("studio_id", profile.studio_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[messages GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // メンバーごとにグループ化して最新メッセージ + 未読数を計算
    const conversationMap = new Map<
      string,
      {
        memberId: string;
        memberName: string;
        memberEmail: string;
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
      }
    >();

    type ProfileInfo = { id: string; full_name: string | null; email: string | null; role: string };
    for (const msg of messages ?? []) {
      const sender = (msg.sender as unknown) as ProfileInfo | null;
      const recipient = (msg.recipient as unknown) as ProfileInfo | null;

      // 相手（メンバー）のIDを特定
      const isOwnerSender = sender?.role === "owner";
      const member = isOwnerSender ? recipient : sender;
      if (!member || member.role === "owner") continue;

      const memberId = member.id;
      if (!conversationMap.has(memberId)) {
        conversationMap.set(memberId, {
          memberId,
          memberName: member.full_name || member.email || "Member",
          memberEmail: member.email || "",
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        });
      }

      // 未読カウント（オーナーが受信者で未読のもの）
      const conv = conversationMap.get(memberId)!;
      if (!isOwnerSender && !msg.read_at) {
        conv.unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationMap.values());
    return NextResponse.json({ conversations });
  } else {
    // メンバー: オーナーとの会話
    const { data: ownerProfile } = await adminDb
      .from("profiles")
      .select("id, full_name, email")
      .eq("studio_id", profile.studio_id)
      .eq("role", "owner")
      .single();

    if (!ownerProfile) {
      return NextResponse.json({ conversations: [] });
    }

    // 自分とオーナー間のメッセージを取得（最新1件 + 未読数）
    const { data: messages } = await adminDb
      .from("messages")
      .select("id, sender_id, content, read_at, created_at")
      .eq("studio_id", profile.studio_id)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const lastMsg = messages?.[0];
    const unreadCount = (messages ?? []).filter(
      (m) => m.sender_id !== user.id && !m.read_at
    ).length;

    const conversations = lastMsg
      ? [
          {
            memberId: ownerProfile.id,
            memberName: ownerProfile.full_name || ownerProfile.email || "Studio",
            memberEmail: ownerProfile.email || "",
            lastMessage: lastMsg.content,
            lastMessageAt: lastMsg.created_at,
            unreadCount,
          },
        ]
      : [];

    return NextResponse.json({ conversations });
  }
}

// ============================================================
// POST /api/messages
//   メッセージ送信 + Resend でメール通知
//   Body: { recipient_id: string; content: string }
// ============================================================
export async function POST(request: NextRequest) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { recipient_id, content } = body as {
    recipient_id: string;
    content: string;
  };

  if (!recipient_id || !content?.trim()) {
    return NextResponse.json(
      { error: "recipient_id and content are required" },
      { status: 400 }
    );
  }

  const adminDb = createAdminClient();

  // 送信者プロフィール取得
  const { data: senderProfile } = await adminDb
    .from("profiles")
    .select("id, full_name, email, role, studio_id")
    .eq("id", user.id)
    .single();

  if (!senderProfile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 400 });
  }

  // 受信者プロフィール取得
  const { data: recipientProfile } = await adminDb
    .from("profiles")
    .select("id, full_name, email, role, studio_id")
    .eq("id", recipient_id)
    .single();

  if (!recipientProfile) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  // スタジオが一致するか確認
  const studioId = senderProfile.studio_id;
  if (recipientProfile.studio_id !== studioId) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 403 });
  }

  // メッセージ INSERT
  const { data: message, error } = await adminDb
    .from("messages")
    .insert({
      studio_id: studioId,
      sender_id: user.id,
      recipient_id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("[messages POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // スタジオ名取得
  const { data: studio } = await adminDb
    .from("studios")
    .select("name")
    .eq("id", studioId)
    .single();

  // メール通知（非同期、失敗してもOK）
  if (recipientProfile.email) {
    const template = messageNotification({
      recipientName:
        recipientProfile.full_name || recipientProfile.email || "Member",
      senderName:
        senderProfile.full_name || senderProfile.email || "Studio",
      preview: content.trim(),
      studioName: studio?.name || "Studio",
    });
    await sendEmail({
      to: recipientProfile.email,
      subject: template.subject,
      html: template.html,
      studioId,
      templateName: "message_notification",
    });
  }

  // Push notification: new message
  sendPushNotification({
    profileId: recipient_id,
    studioId,
    type: "new_message",
    payload: pushNewMessage({
      senderName: senderProfile.full_name || senderProfile.email || "Studio",
    }),
  }).catch((err) => console.error("Push notification failed:", err));

  return NextResponse.json({ message }, { status: 201 });
}
