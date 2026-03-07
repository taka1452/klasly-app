import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import MessagesClient from "@/components/messages/messages-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages - Klasly",
};

/**
 * /messages ページ
 * オーナー: スタジオ内の全メンバーとの会話一覧
 * メンバー: オーナーとの1対1スレッド
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const params = await searchParams;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, studio_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  // ============================================================
  // 会話一覧を取得
  // ============================================================
  let conversations: {
    memberId: string;
    memberName: string;
    memberEmail: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
  }[] = [];

  let initialMemberId: string | null = null;

  if (profile.role === "owner") {
    // 全メッセージ取得してメンバーごとにグループ化
    const { data: messages } = await supabase
      .from("messages")
      .select(
        "id, sender_id, recipient_id, content, read_at, created_at, sender:profiles!messages_sender_id_fkey(id, full_name, email, role), recipient:profiles!messages_recipient_id_fkey(id, full_name, email, role)"
      )
      .eq("studio_id", profile.studio_id)
      .order("created_at", { ascending: false });

    const convMap = new Map<
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

    type ProfileInfo = {
      id: string;
      full_name: string | null;
      email: string | null;
      role: string;
    };
    for (const msg of messages ?? []) {
      const sender = (msg.sender as unknown) as ProfileInfo | null;
      const recipient = (msg.recipient as unknown) as ProfileInfo | null;

      const isOwnerSender = sender?.role === "owner";
      const member = isOwnerSender ? recipient : sender;
      if (!member || member.role === "owner") continue;

      const memberId = member.id;
      if (!convMap.has(memberId)) {
        convMap.set(memberId, {
          memberId,
          memberName: member.full_name || member.email || "Member",
          memberEmail: member.email || "",
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        });
      }
      const conv = convMap.get(memberId)!;
      if (!isOwnerSender && !msg.read_at) {
        conv.unreadCount += 1;
      }
    }
    conversations = Array.from(convMap.values());

    // URLパラメータでメンバーが指定されていれば初期選択
    initialMemberId = params.member ?? null;
  } else {
    // メンバー: オーナーとのスレッド
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("studio_id", profile.studio_id)
      .eq("role", "owner")
      .single();

    if (ownerProfile) {
      initialMemberId = ownerProfile.id;

      const { data: messages } = await supabase
        .from("messages")
        .select("id, sender_id, content, read_at, created_at")
        .eq("studio_id", profile.studio_id)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      const lastMsg = messages?.[0];
      const unreadCount = (messages ?? []).filter(
        (m) => m.sender_id !== user.id && !m.read_at
      ).length;

      conversations = lastMsg
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
        : [
            {
              memberId: ownerProfile.id,
              memberName: ownerProfile.full_name || ownerProfile.email || "Studio",
              memberEmail: ownerProfile.email || "",
              lastMessage: "",
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
            },
          ];
    }
  }

  return (
    <MessagesClient
      myId={user.id}
      role={profile.role}
      initialConversations={conversations}
      initialMemberId={initialMemberId}
    />
  );
}
