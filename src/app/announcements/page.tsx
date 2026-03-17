"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  published_at: string;
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // まず未読を取得してIDを記録
      const unreadRes = await fetch("/api/announcements/unread");
      const unreadData = await unreadRes.json();
      const unreadIdSet = new Set<string>(
        (unreadData.unread || []).map((a: AnnouncementItem) => a.id)
      );

      // 全通知を取得（未読APIは全件返す）
      // 未読のものは既読APIからは除外されている。全件取得のため別途fetchが必要だが
      // ここでは未読データをそのまま使う（既読は表示なし）
      // → 仕様変更: 全通知を表示する（既読・未読両方）
      // APIが未読しか返さないため、ここでは未読のみ表示 + read-all呼び出し
      setAnnouncements(unreadData.unread || []);
      setReadIds(new Set()); // 未読のものだけ表示しているので、全部がNew

      // ページ表示時に全件既読にする
      if (unreadIdSet.size > 0) {
        await fetch("/api/announcements/read-all", { method: "POST" });
        // 既読にしたIDを記録（UIでは「New」バッジ表示を維持）
        setReadIds(new Set()); // 表示上は全てNewバッジのまま
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900">What&apos;s New</h1>
        <div className="mt-8 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">What&apos;s New</h1>
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </Link>
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const isNew = !readIds.has(a.id);
            const date = new Date(a.published_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return (
              <div key={a.id}>
                <p className="mb-1.5 flex items-center gap-2 text-sm text-gray-400">
                  <span>📢</span> {date}
                </p>
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {a.title}
                    </h2>
                    {isNew && (
                      <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        🔵 New
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                    {a.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
