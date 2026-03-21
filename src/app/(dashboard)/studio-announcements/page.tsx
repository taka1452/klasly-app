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

const ROLE_OPTIONS = ["instructor", "member"] as const;

export default function StudioAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [roles, setRoles] = useState<string[]>(["instructor", "member"]);
  const [creating, setCreating] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const res = await fetch("/api/announcements/manage");
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

    const res = await fetch("/api/announcements/manage", {
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
      setRoles(["instructor", "member"]);
      await fetchAnnouncements();
    }

    setCreating(false);
  }

  async function toggleActive(id: string, currentState: boolean) {
    await fetch("/api/announcements/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !currentState }),
    });
    await fetchAnnouncements();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    await fetch(`/api/announcements/manage?id=${id}`, { method: "DELETE" });
    await fetchAnnouncements();
  }

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
      <p className="mt-1 text-sm text-gray-500">
        Create announcements for your studio members and instructors.
      </p>

      {/* 新規作成フォーム */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Create Announcement
        </h2>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. New class schedule starting next week"
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              placeholder="Describe the update..."
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Roles
            </label>
            <div className="flex gap-4">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <span className="capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || roles.length === 0}
            className="btn-primary"
          >
            {creating ? "Publishing..." : "Publish"}
          </button>
        </form>
      </div>

      {/* アナウンス一覧 */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-gray-900">
          All Announcements
        </h2>

        {loading ? (
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        ) : announcements.length === 0 ? (
          <div className="mt-4 text-center py-6">
            <p className="text-sm text-gray-500">No announcements yet.</p>
            <p className="mt-1 text-xs text-gray-400">Create your first announcement above to notify your instructors and members.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="p-2 font-medium">Title</th>
                  <th className="p-2 font-medium">Roles</th>
                  <th className="p-2 font-medium">Published</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="p-2 text-gray-900">{a.title}</td>
                    <td className="p-2 text-gray-600">
                      {(a.target_roles || []).join(", ")}
                    </td>
                    <td className="p-2 text-gray-600">
                      {new Date(a.published_at).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      {a.is_active ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleActive(a.id, a.is_active)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          {a.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
