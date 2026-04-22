"use client";

import { useState, useEffect, useCallback } from "react";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  target_roles: string[];
  is_active: boolean;
  published_at: string;
  created_at: string;
};

const ROLE_OPTIONS = ["owner", "instructor", "member"] as const;

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 新規作成フォーム
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [roles, setRoles] = useState<string[]>(["owner", "instructor", "member"]);
  const [creating, setCreating] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const res = await fetch("/api/admin/announcements");
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);

    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, target_roles: roles }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create announcement");
    } else {
      setTitle("");
      setBody("");
      setRoles(["owner", "instructor", "member"]);
      await fetchAnnouncements();
    }

    setCreating(false);
  }

  async function toggleActive(id: string, currentState: boolean) {
    const res = await fetch("/api/admin/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !currentState }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update announcement");
    }
    await fetchAnnouncements();
  }

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Announcements</h1>

      {/* 新規作成フォーム */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white">Create Announcement</h2>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="New Feature: Schedule Visibility"
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              placeholder="Describe the update..."
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Target Roles
            </label>
            <div className="flex gap-4">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="rounded accent-brand-500"
                  />
                  <span className="capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || roles.length === 0}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {creating ? "Publishing..." : "Publish"}
          </button>
        </form>
      </div>

      {/* 通知一覧 */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white">All Announcements</h2>

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading...</p>
        ) : announcements.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No announcements yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-left text-slate-400">
                <th className="p-2">Title</th>
                <th className="p-2">Roles</th>
                <th className="p-2">Published</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((a) => (
                <tr key={a.id} className="border-b border-slate-700">
                  <td className="p-2 text-white">{a.title}</td>
                  <td className="p-2 text-slate-300">
                    {(a.target_roles || []).join(", ")}
                  </td>
                  <td className="p-2 text-slate-300">
                    {new Date(a.published_at).toLocaleDateString()}
                  </td>
                  <td className="p-2">
                    {a.is_active ? (
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => toggleActive(a.id, a.is_active)}
                      className="rounded border border-slate-500 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      {a.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
