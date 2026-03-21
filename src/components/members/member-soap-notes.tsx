"use client";

import { useState, useEffect } from "react";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type SOAPNoteView = {
  id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  session_date: string;
  is_confidential: boolean;
  instructors?: { profiles?: { full_name?: string } };
};

export default function MemberSOAPNotes({ memberId }: { memberId: string }) {
  const { isEnabled } = useFeature();
  const [notes, setNotes] = useState<SOAPNoteView[]>([]);
  const [confidentialCount, setConfidentialCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isEnabled(FEATURE_KEYS.SOAP_NOTES)) {
      setLoading(false);
      return;
    }

    fetch(`/api/soap-notes?member_id=${memberId}`)
      .then((res) => res.json())
      .then((data) => {
        setNotes(data.notes || []);
        setConfidentialCount(data.confidentialCount || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [memberId, isEnabled]);

  if (!isEnabled(FEATURE_KEYS.SOAP_NOTES)) return null;

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900">SOAP Notes</h3>
        <div className="mt-4 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900">SOAP Notes</h3>
      <p className="mt-1 text-xs text-gray-400">
        Shared by instructors. Confidential notes are only visible to the author.
      </p>

      {notes.length === 0 && confidentialCount === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No SOAP notes for this member.</p>
      ) : notes.length === 0 && confidentialCount > 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          This member has {confidentialCount} confidential note{confidentialCount > 1 ? "s" : ""} from their instructor(s). Confidential notes are only visible to the author.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {notes.map((note) => {
            const instructorName = (() => {
              const raw = note.instructors;
              if (!raw) return "Unknown";
              const profiles = (raw as { profiles?: { full_name?: string } }).profiles;
              if (Array.isArray(profiles)) return (profiles[0] as { full_name?: string })?.full_name || "Unknown";
              return profiles?.full_name || "Unknown";
            })();

            const date = new Date(note.session_date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return (
              <div key={note.id}>
                <p className="text-xs text-gray-400">
                  📋 {date} — by {instructorName}
                </p>
                <div className="mt-1 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                  {note.subjective && (
                    <p>
                      <span className="font-semibold text-gray-700">S:</span>{" "}
                      {note.subjective}
                    </p>
                  )}
                  {note.objective && (
                    <p>
                      <span className="font-semibold text-gray-700">O:</span>{" "}
                      {note.objective}
                    </p>
                  )}
                  {note.assessment && (
                    <p>
                      <span className="font-semibold text-gray-700">A:</span>{" "}
                      {note.assessment}
                    </p>
                  )}
                  {note.plan && (
                    <p>
                      <span className="font-semibold text-gray-700">P:</span>{" "}
                      {note.plan}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {confidentialCount > 0 && (
            <p className="text-xs text-gray-400 italic">
              + {confidentialCount} confidential note{confidentialCount > 1 ? "s" : ""} (visible only to the author)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
