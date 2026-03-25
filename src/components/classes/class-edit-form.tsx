"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { usePlanAccess } from "@/components/ui/plan-access-provider";
import HelpTip from "@/components/ui/help-tip";
import Link from "next/link";

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type InstructorOption = { id: string; full_name: string };
type RoomOption = { id: string; name: string; capacity: number | null };

type Props = {
  classId: string;
  instructors: InstructorOption[];
  rooms: RoomOption[];
  initialData: {
    name: string;
    description: string;
    dayOfWeek: number;
    startTime: string;
    durationMinutes: number;
    capacity: number;
    location: string;
    instructorId: string;
    roomId: string;
    isPublic: boolean;
    classType: "in-person" | "online" | "hybrid";
    onlineLink: string;
  };
};

export default function ClassEditForm({
  classId,
  instructors,
  rooms,
  initialData,
}: Props) {
  const router = useRouter();
  const planAccess = usePlanAccess();
  const { isEnabled } = useFeature();
  const onlineEnabled = isEnabled(FEATURE_KEYS.ONLINE_CLASSES);
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description);
  const [dayOfWeek, setDayOfWeek] = useState(initialData.dayOfWeek);
  const [startTime, setStartTime] = useState(initialData.startTime);
  const [durationHours, setDurationHours] = useState(
    Math.floor(initialData.durationMinutes / 60)
  );
  const [durationMins, setDurationMins] = useState(
    initialData.durationMinutes % 60
  );
  const [capacity, setCapacity] = useState(initialData.capacity);
  const [location, setLocation] = useState(initialData.location);
  const [instructorId, setInstructorId] = useState(initialData.instructorId);
  const [roomId, setRoomId] = useState(initialData.roomId);
  const [isPublic, setIsPublic] = useState(initialData.isPublic);
  const [classType, setClassType] = useState<"in-person" | "online" | "hybrid">(initialData.classType);
  const [onlineLink, setOnlineLink] = useState(initialData.onlineLink);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  if (planAccess && !planAccess.canEdit) {
    return (
      <div className="card">
        <p className="text-gray-600">
          Your plan doesn&apos;t allow editing classes. Please update your billing to continue.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Update billing →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);

    const startTimeFormatted =
      startTime.length === 5 ? `${startTime}:00` : startTime;

    const isOnline = classType === "online";
    const showOnlineLink = classType === "online" || classType === "hybrid";

    if (classType === "online" && !onlineLink.trim()) {
      setError("Online link is required for online classes.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("classes")
      .update({
        name,
        description: description || null,
        day_of_week: dayOfWeek,
        start_time: startTimeFormatted,
        duration_minutes: durationHours * 60 + durationMins,
        capacity,
        location: isOnline ? null : location || null,
        instructor_id: instructorId || null,
        room_id: isOnline ? null : roomId || null,
        is_public: isPublic,
        is_online: isOnline,
        online_link: showOnlineLink ? onlineLink || null : null,
      })
      .eq("id", classId)
      .select("id");

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    if (!updated || updated.length === 0) {
      setError("Could not save changes. You may not have permission to edit this class.");
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900">Edit class</h2>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            Changes saved successfully!
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Instructor (optional)
          </label>
          <select
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
            className="input-field mt-1"
          >
            <option value="">No instructor</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Class name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input-field mt-1"
          />
        </div>

        {onlineEnabled && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Class Type
                <HelpTip
                  text="Choose In-person, Online, or Hybrid. Online classes include a video link sent after booking."
                  helpSlug="online-classes"
                />
              </label>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="classTypeEdit"
                    checked={classType === "in-person"}
                    onChange={() => setClassType("in-person")}
                    className="text-brand-600"
                  />
                  In-person
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="classTypeEdit"
                    checked={classType === "online"}
                    onChange={() => setClassType("online")}
                    className="text-brand-600"
                  />
                  Online
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="classTypeEdit"
                    checked={classType === "hybrid"}
                    onChange={() => setClassType("hybrid")}
                    className="text-brand-600"
                  />
                  Hybrid
                </label>
              </div>
              {classType === "hybrid" && (
                <p className="mt-1 text-xs text-gray-500">
                  Default is in-person. You can switch individual sessions to online.
                </p>
              )}
            </div>

            {(classType === "online" || classType === "hybrid") && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Online Link (Zoom, Google Meet, etc.)
                  {classType === "online" && <span className="text-red-500"> *</span>}
                </label>
                <input
                  type="url"
                  value={onlineLink}
                  onChange={(e) => setOnlineLink(e.target.value)}
                  placeholder="https://zoom.us/j/123456789"
                  required={classType === "online"}
                  className="input-field mt-1"
                />
                {classType === "hybrid" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Default link for online sessions. Can be overridden per session.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Day of week
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
              className="input-field mt-1"
            >
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Start time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input-field mt-1"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Duration
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
                className="input-field"
              >
                {[0, 1, 2, 3].map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">hr</span>
              <select
                value={durationMins}
                onChange={(e) => setDurationMins(parseInt(e.target.value, 10))}
                className="input-field"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">min</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Capacity
              <HelpTip
                text="Maximum number of members who can book this class. Waitlist kicks in after this limit."
                helpSlug="bookings"
              />
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 15)}
              min={1}
              className="input-field mt-1"
            />
          </div>
        </div>

        {classType !== "online" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Room
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="input-field mt-1"
              >
                <option value="">No room assigned</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.capacity ? ` (cap. ${r.capacity})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field mt-1"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPublicEdit"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          <label htmlFor="isPublicEdit" className="text-sm font-medium text-gray-700">
            Public{" "}
            <span className="font-normal text-gray-500">
              (visible to members on the schedule)
            </span>
          </label>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
