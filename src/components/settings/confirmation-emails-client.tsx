"use client";

import { useState } from "react";

type Initial = {
  classSubject: string;
  classBody: string;
  eventSubject: string;
  eventBody: string;
  senderName: string;
};

const VAR_HELP = (
  <p className="text-xs text-gray-500">
    Variables: <code className="font-mono">{`{memberName}`}</code>,{" "}
    <code className="font-mono">{`{className}`}</code> (or{" "}
    <code className="font-mono">{`{eventName}`}</code>),{" "}
    <code className="font-mono">{`{sessionDate}`}</code>,{" "}
    <code className="font-mono">{`{startTime}`}</code>,{" "}
    <code className="font-mono">{`{studioName}`}</code>. The class/event
    details block is always appended automatically.
  </p>
);

export default function ConfirmationEmailsClient({ initial }: { initial: Initial }) {
  const [classSubject, setClassSubject] = useState(initial.classSubject);
  const [classBody, setClassBody] = useState(initial.classBody);
  const [eventSubject, setEventSubject] = useState(initial.eventSubject);
  const [eventBody, setEventBody] = useState(initial.eventBody);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [testSending, setTestSending] = useState<"class" | "event" | null>(null);
  const [testToast, setTestToast] = useState("");
  const [error, setError] = useState("");

  async function sendTest(kind: "class" | "event") {
    setTestSending(kind);
    setError("");
    setTestToast("");
    const subject = kind === "class" ? classSubject : eventSubject;
    const body = kind === "class" ? classBody : eventBody;
    const res = await fetch("/api/studio/confirmation-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, subject, body }),
    });
    setTestSending(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to send test");
      return;
    }
    const d = await res.json();
    setTestToast(`Preview sent to ${d.sent_to}`);
    setTimeout(() => setTestToast(""), 4000);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/studio/confirmation-emails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_confirmation_subject: classSubject.trim() || null,
        class_confirmation_body: classBody.trim() || null,
        event_confirmation_subject: eventSubject.trim() || null,
        event_confirmation_body: eventBody.trim() || null,
        confirmation_sender_name: senderName.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      return;
    }
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {savedToast && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Saved.
        </div>
      )}
      {testToast && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          {testToast}
        </div>
      )}

      <div className="card">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-gray-900">Class bookings</h2>
          <button
            type="button"
            onClick={() => sendTest("class")}
            disabled={testSending !== null}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            {testSending === "class" ? "Sending…" : "Send test to me"}
          </button>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              type="text"
              value={classSubject}
              onChange={(e) => setClassSubject(e.target.value)}
              placeholder="Booking Confirmed - {className}"
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Body
            </label>
            <textarea
              value={classBody}
              onChange={(e) => setClassBody(e.target.value)}
              rows={6}
              placeholder={`Hi {memberName},\n\nThanks for booking {className}! Looking forward to seeing you on {sessionDate}.`}
              className="input-field mt-1"
            />
          </div>
          {VAR_HELP}
        </div>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-gray-900">Event bookings</h2>
          <button
            type="button"
            onClick={() => sendTest("event")}
            disabled={testSending !== null}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            {testSending === "event" ? "Sending…" : "Send test to me"}
          </button>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              type="text"
              value={eventSubject}
              onChange={(e) => setEventSubject(e.target.value)}
              placeholder="Your spot is confirmed - {eventName}"
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Body
            </label>
            <textarea
              value={eventBody}
              onChange={(e) => setEventBody(e.target.value)}
              rows={6}
              placeholder={`Hi {memberName},\n\nWe're so glad to have you joining us for {eventName}. Here's what to expect...`}
              className="input-field mt-1"
            />
          </div>
          {VAR_HELP}
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-gray-900">Sender name</h2>
        <div className="mt-3">
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Your studio name"
            className="input-field"
          />
          <p className="mt-1 text-xs text-gray-500">
            Appears as the &quot;From&quot; name on confirmation emails. Leave
            blank to use Klasly default.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary text-sm"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
