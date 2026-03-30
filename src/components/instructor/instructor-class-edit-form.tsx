"use client";

import { useState } from "react";
import Toast from "@/components/ui/toast";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type RoomOption = { id: string; name: string };

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type Props = {
  classId: string;
  initialData: {
    name: string;
    description: string;
    dayOfWeek: number;
    startTime: string;
    durationMinutes: number;
    capacity: number;
    roomId: string;
    isPublic: boolean;
    isOnline: boolean;
    onlineLink: string;
    priceCents: number | null;
  };
  rooms: RoomOption[];
  onSaved: () => void;
};

export default function InstructorClassEditForm({
  classId,
  initialData,
  rooms,
  onSaved,
}: Props) {
  const { isEnabled } = useFeature();
  const onlineEnabled = isEnabled(FEATURE_KEYS.ONLINE_CLASSES);
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description);
  const [dayOfWeek, setDayOfWeek] = useState(initialData.dayOfWeek);
  const [startTime, setStartTime] = useState(initialData.startTime);
  const [durationHours, setDurationHours] = useState(Math.floor(initialData.durationMinutes / 60));
  const [durationMins, setDurationMins] = useState(initialData.durationMinutes % 60);
  const [capacity, setCapacity] = useState(initialData.capacity);
  const [roomId, setRoomId] = useState(initialData.roomId);
  const [isPublic, setIsPublic] = useState(initialData.isPublic);
  const [isOnline, setIsOnline] = useState(initialData.isOnline);
  const [onlineLink, setOnlineLink] = useState(initialData.onlineLink);
  const [priceDollars, setPriceDollars] = useState(
    initialData.priceCents != null ? (initialData.priceCents / 100).toFixed(2) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Class name is required");
      return;
    }

    setSaving(true);
    try {
      const priceCents = priceDollars.trim()
        ? Math.round(parseFloat(priceDollars) * 100)
        : null;

      const res = await fetch("/api/instructor/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: classId,
          name: name.trim(),
          description: description.trim() || null,
          day_of_week: dayOfWeek,
          start_time: startTime,
          duration_minutes: durationHours * 60 + durationMins,
          capacity,
          room_id: roomId || null,
          is_public: isPublic,
          is_online: isOnline,
          online_link: isOnline ? onlineLink.trim() || null : null,
          price_cents: priceCents,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
        return;
      }

      setToastMessage("Class updated");
      onSaved();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Edit Class</h2>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Class name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input-field mt-1" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-field mt-1" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Day of week *</label>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="input-field mt-1">
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Start time *</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="input-field mt-1" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Duration *</label>
          <div className="mt-1 flex items-center gap-2">
            <select value={durationHours} onChange={(e) => setDurationHours(parseInt(e.target.value, 10))} className="input-field">
              {[0, 1, 2, 3].map((h) => (<option key={h} value={h}>{h}</option>))}
            </select>
            <span className="text-sm text-gray-500">hr</span>
            <select value={durationMins} onChange={(e) => setDurationMins(parseInt(e.target.value, 10))} className="input-field">
              {[0, 15, 30, 45].map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
            <span className="text-sm text-gray-500">min</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Capacity *</label>
          <input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} min={1} required className="input-field mt-1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Price ($)</label>
          <input type="number" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} min="0" step="0.01" placeholder="No price" className="input-field mt-1" />
        </div>
      </div>

      {rooms.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Room</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input-field mt-1">
            <option value="">No room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Public (visible to members)
        </label>
        {onlineEnabled && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Online class
          </label>
        )}
      </div>

      {onlineEnabled && isOnline && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Online link</label>
          <input type="url" value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} placeholder="https://zoom.us/..." className="input-field mt-1" />
        </div>
      )}

      <div className="pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {toastMessage && (
        <Toast message={toastMessage} variant="success" onClose={() => setToastMessage(null)} />
      )}
    </form>
  );
}
