"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type SOAPNoteItem = {
  id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  session_date: string;
  is_confidential: boolean;
  created_at: string;
};

export default function MemberSOAPNotesPage() {
  const { memberId } = useParams() as { memberId: string };
  const [notes, setNotes] = useState<SOAPNoteItem[]>([]);
  const [memberName, setMemberName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [isConfidential, setIsConfidential] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    const res = await fetch(`/api/soap-notes?member_id=${memberId}`);
    if (res.ok) {
      const data = await res.json();
      setNotes(data.notes || []);
    }
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    fetchNotes();
    // メンバー名取得
    fetch("/api/instructor/members")
      .then((r) => r.json())
      .then((data) => {
        const m = (data.members || []).find(
          (m: { id: string }) => m.id === memberId
        );
        if (m) setMemberName(m.name);
      })
      .catch(() => {});
  }, [memberId, fetchNotes]);

  function resetForm() {
    setSessionDate(new Date().toISOString().split("T")[0]);
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    setIsConfidential(true);
    setEditingId(null);
    setError("");
  }

  function startEdit(note: SOAPNoteItem) {
    setEditingId(note.id);
    setSessionDate(note.session_date);
    setSubjective(note.subjective || "");
    setObjective(note.objective || "");
    setAssessment(note.assessment || "");
    setPlan(note.plan || "");
    setIsConfidential(note.is_confidential);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body = {
      member_id: memberId,
      session_date: sessionDate,
      subjective,
      objective,
      assessment,
      plan,
      is_confidential: isConfidential,
    };

    let res: Response;
    if (editingId) {
      res = await fetch(`/api/soap-notes/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/soap-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
    } else {
      resetForm();
      setShowForm(false);
      await fetchNotes();
    }

    setSaving(false);
  }

  async function handleDelete(noteId: string) {
    if (!confirm("Delete this SOAP note?")) return;

    const res = await fetch(`/api/soap-notes/${noteId}`, { method: "DELETE" });
    if (res.ok) {
      await fetchNotes();
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/instructor/soap-notes"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to members
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          SOAP Notes {memberName && `- ${memberName}`}
        </h1>
      </div>

      {!showForm && (
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary mb-6"
        >
          + New SOAP Note
        </button>
      )}

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingId ? "Edit SOAP Note" : "New SOAP Note"}
          </h2>

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Session Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                className="input-field mt-1 w-48"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                S - Subjective (client&apos;s complaint)
              </label>
              <textarea
                value={subjective}
                onChange={(e) => setSubjective(e.target.value)}
                rows={2}
                placeholder="What the client reports..."
                className="input-field mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                O - Objective (your findings)
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={2}
                placeholder="What you observed..."
                className="input-field mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                A - Assessment (your judgment)
              </label>
              <textarea
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                rows={2}
                placeholder="Your assessment..."
                className="input-field mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                P - Plan (next steps)
              </label>
              <textarea
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                rows={2}
                placeholder="Follow-up plan..."
                className="input-field mt-1 w-full"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              Confidential (only you can view this note)
            </label>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
        </div>
      ) : notes.length === 0 ? (
        <div className="card">
          <p className="text-sm text-gray-500">No SOAP notes yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => {
            const date = new Date(note.session_date).toLocaleDateString(
              "en-US",
              { year: "numeric", month: "long", day: "numeric" }
            );
            return (
              <div key={note.id}>
                <p className="mb-1 text-sm text-gray-400">📋 {date}</p>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="space-y-2 text-sm">
                    {note.subjective && (
                      <p>
                        <span className="font-semibold text-gray-700">S:</span>{" "}
                        <span className="text-gray-600">{note.subjective}</span>
                      </p>
                    )}
                    {note.objective && (
                      <p>
                        <span className="font-semibold text-gray-700">O:</span>{" "}
                        <span className="text-gray-600">{note.objective}</span>
                      </p>
                    )}
                    {note.assessment && (
                      <p>
                        <span className="font-semibold text-gray-700">A:</span>{" "}
                        <span className="text-gray-600">{note.assessment}</span>
                      </p>
                    )}
                    {note.plan && (
                      <p>
                        <span className="font-semibold text-gray-700">P:</span>{" "}
                        <span className="text-gray-600">{note.plan}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {note.is_confidential ? (
                      <span className="text-xs text-gray-400">🔒 Private</span>
                    ) : (
                      <span className="text-xs text-emerald-500">
                        🔓 Shared with studio
                      </span>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(note)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
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
