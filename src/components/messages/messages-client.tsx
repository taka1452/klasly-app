"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import ContextHelpLink from "@/components/help/context-help-link";

type ConversationSummary = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender?: { id: string; full_name: string | null; role: string } | null;
};

type MessagesClientProps = {
  /** 自分のユーザーID */
  myId: string;
  /** "owner" | "member" */
  role: string;
  /** 初期会話一覧 */
  initialConversations: ConversationSummary[];
  /**
   * メンバーロールの場合: オーナーとの会話を開いた状態で初期表示
   * オーナーロールの場合: URLパラメータで選択済みメンバーID（省略可）
   */
  initialMemberId?: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function MessagesClient({
  myId,
  role,
  initialConversations,
  initialMemberId,
}: MessagesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMemberId ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Compose new message state
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const selectedConv = conversations.find((c) => c.memberId === selectedId);

  // スレッド取得 + 既読マーク
  useEffect(() => {
    if (!selectedId) return;
    setLoadingThread(true);
    setMessages([]);

    fetch(`/api/messages/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setLoadingThread(false);
        // 既読にする
        fetch(`/api/messages/${selectedId}`, { method: "PATCH" })
          .then((res) => {
            if (res.ok) {
              // 未読バッジをクリア
              setConversations((prev) =>
                prev.map((c) =>
                  c.memberId === selectedId ? { ...c, unreadCount: 0 } : c
                )
              );
            }
          })
          .catch(() => {
            // 既読マーク失敗は致命的ではないためサイレントに処理
          });
      })
      .catch(() => setLoadingThread(false));
  }, [selectedId]);

  // 新しいメッセージが追加されたらスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!content.trim() || !selectedId || sending) return;
    setSending(true);
    setSendError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: selectedId, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSendError(data.error || "Failed to send");
        setSending(false);
        return;
      }

      const data = await res.json();
      const newMsg = data.message as Message;
      setMessages((prev) => [...prev, newMsg]);
      setContent("");

      // 会話リストの最終メッセージを更新
      setConversations((prev) =>
        prev.map((c) =>
          c.memberId === selectedId
            ? {
                ...c,
                lastMessage: content,
                lastMessageAt: newMsg.created_at,
              }
            : c
        )
      );

      // サーバー側データを同期
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleComposeSend() {
    if (!composeRecipient || !composeBody.trim() || composeSending) return;
    setComposeSending(true);
    setComposeError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: composeRecipient,
          content: composeBody.trim(),
          subject: composeSubject.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setComposeError(data.error || "Failed to send");
        setComposeSending(false);
        return;
      }

      // Close modal and switch to that conversation
      setShowCompose(false);
      setComposeRecipient("");
      setComposeSubject("");
      setComposeBody("");
      setSelectedId(composeRecipient);

      // Update conversation list
      const recipient = conversations.find((c) => c.memberId === composeRecipient);
      if (recipient) {
        setConversations((prev) =>
          prev.map((c) =>
            c.memberId === composeRecipient
              ? { ...c, lastMessage: composeBody.trim(), lastMessageAt: new Date().toISOString() }
              : c
          )
        );
      }

      startTransition(() => { router.refresh(); });
    } catch {
      setComposeError("Network error. Please try again.");
    } finally {
      setComposeSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <>
    <div className="flex h-[calc(100vh-120px)] min-h-[500px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ===== 左カラム: 会話リスト ===== */}
      <div
        className={`flex w-full flex-col border-r border-gray-200 md:w-72 lg:w-80 ${
          selectedId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                Messages
                {totalUnread > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {totalUnread}
                  </span>
                )}
              </h2>
              <ContextHelpLink href="/help/messaging/send-message-member" />
            </div>
            {role === "owner" && (
              <button
                type="button"
                onClick={() => { setShowCompose(true); setComposeError(null); }}
                className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
                title="New Message"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No conversations yet.
              {role === "member" && (
                <p className="mt-1">Send a message to your studio!</p>
              )}
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.memberId}
                type="button"
                onClick={() => setSelectedId(conv.memberId)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  selectedId === conv.memberId ? "bg-blue-50" : ""
                }`}
              >
                {/* アバター */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {conv.memberName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {conv.memberName}
                    </span>
                    {conv.lastMessage && (
                      <span className="ml-2 shrink-0 text-xs text-gray-400">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs text-gray-500">
                      {conv.lastMessage || (
                        <span className="italic text-gray-400">No messages yet</span>
                      )}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="ml-2 inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* メンバー: オーナーへの新規会話開始（会話がまだない場合） */}
        {role === "member" && conversations.length === 0 && (
          <div className="border-t border-gray-200 p-3">
            <button
              type="button"
              onClick={() => {
                // /api/messages GET でオーナーIDを取得済みの想定
                // 会話がない場合は initialMemberId（オーナーID）を使用
                if (initialMemberId) setSelectedId(initialMemberId);
              }}
              className="btn-primary w-full text-sm"
            >
              Message your studio
            </button>
          </div>
        )}
      </div>

      {/* ===== 右カラム: スレッド ===== */}
      <div
        className={`flex flex-1 flex-col ${
          selectedId ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedId ? (
          <>
            {/* スレッドヘッダー */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <button
                type="button"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 md:hidden"
                onClick={() => setSelectedId(null)}
                aria-label="Back to conversations"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                  />
                </svg>
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {selectedConv?.memberName.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedConv?.memberName}
                </p>
                {selectedConv?.memberEmail && (
                  <p className="text-xs text-gray-400">
                    {selectedConv.memberEmail}
                  </p>
                )}
              </div>
            </div>

            {/* メッセージ一覧 */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {loadingThread && (
                <div className="text-center text-sm text-gray-400">
                  Loading…
                </div>
              )}
              {!loadingThread && messages.length === 0 && (
                <div className="text-center text-sm text-gray-400">
                  No messages yet. Start the conversation!
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender_id === myId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isMe
                          ? "rounded-br-sm bg-brand-500 text-white"
                          : "rounded-bl-sm bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {msg.content}
                      </p>
                      <p
                        className={`mt-1 text-right text-xs ${
                          isMe ? "text-brand-200" : "text-gray-400"
                        }`}
                      >
                        {formatTime(msg.created_at)}
                        {isMe && msg.read_at && (
                          <span className="ml-1">✓</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* 入力フォーム */}
            <div className="border-t border-gray-200 px-4 py-3 safe-bottom">
              {sendError && (
                <p className="mb-2 text-xs text-red-500">{sendError}</p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Type a message\u2026 (${typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318" : "Ctrl"}+Enter to send)`}
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  disabled={sending || isPending}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!content.trim() || sending || isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* スレッド未選択時の空状態 */
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-7 w-7 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600">
              Select a conversation
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Choose a member from the left to view messages
            </p>
          </div>
        )}
      </div>
    </div>

    {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCompose(false)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowCompose(false)}
              className="absolute right-4 top-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="mb-4 text-base font-semibold text-gray-900">New Message</h3>

            {composeError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{composeError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <select
                  value={composeRecipient}
                  onChange={(e) => setComposeRecipient(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Select a member...</option>
                  {conversations.map((c) => (
                    <option key={c.memberId} value={c.memberId}>
                      {c.memberName}{c.memberEmail ? ` (${c.memberEmail})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subject (optional)</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="e.g. Class schedule update"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  className="input-field resize-none text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleComposeSend}
                disabled={!composeRecipient || !composeBody.trim() || composeSending}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {composeSending ? "Sending..." : "Send Message"}
              </button>
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
