"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ErrorAlert from "@/components/ui/error-alert";

type InstructorOption = { id: string; full_name: string; isMe?: boolean };

type TemplateData = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  capacity: number;
  price_cents: number | null;
  class_type: "in_person" | "online" | "hybrid";
  location: string | null;
  online_link: string | null;
  image_url: string | null;
  is_public: boolean;
  is_active: boolean;
  instructor_id: string | null;
  instructors: {
    id: string;
    profiles: { full_name: string } | null;
  } | null;
};

type Props = {
  templateId?: string;
};

export default function TemplateForm({ templateId }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classType, setClassType] = useState<"in_person" | "online" | "hybrid">(
    "in_person"
  );
  const [durationHours, setDurationHours] = useState(1);
  const [durationMins, setDurationMins] = useState(0);
  const [capacity, setCapacity] = useState(15);
  const [priceDollars, setPriceDollars] = useState("");
  const [location, setLocation] = useState("");
  const [onlineLink, setOnlineLink] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!templateId);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch instructors
  useEffect(() => {
    async function fetchInstructors() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("profiles")
          .select("studio_id")
          .eq("id", user?.id)
          .single();
        if (!profile?.studio_id) return;
        const { data } = await supabase
          .from("instructors")
          .select("id, profile_id, profiles(full_name)")
          .eq("studio_id", profile.studio_id)
          .order("created_at", { ascending: false });
        const list = (data || []).map((i) => {
          const p = i.profiles as { full_name?: string } | null;
          const raw = Array.isArray(p) ? p[0] : p;
          const isMe = i.profile_id === user?.id;
          return { id: i.id, full_name: raw?.full_name || "\u2014", isMe };
        });
        list.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : 0));
        setInstructors(list);
      } catch {
        // non-critical
      }
    }
    fetchInstructors();
  }, []);

  // Fetch existing template for edit mode
  useEffect(() => {
    if (!templateId) return;
    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/class-templates/${templateId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch template");
        }
        const t: TemplateData = await res.json();
        setName(t.name);
        setDescription(t.description || "");
        setClassType(t.class_type);
        setDurationHours(Math.floor(t.duration_minutes / 60));
        setDurationMins(t.duration_minutes % 60);
        setCapacity(t.capacity);
        setPriceDollars(
          t.price_cents !== null && t.price_cents !== undefined
            ? (t.price_cents / 100).toFixed(2)
            : ""
        );
        setLocation(t.location || "");
        setOnlineLink(t.online_link || "");
        setInstructorId(t.instructor_id || "");
        setIsPublic(t.is_public ?? true);
        if (t.image_url) {
          setExistingImageUrl(t.image_url);
          setImagePreview(t.image_url);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load template"
        );
      } finally {
        setFetching(false);
      }
    }
    fetchTemplate();
  }, [templateId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!name.trim()) {
      setError("Name is required.");
      setLoading(false);
      return;
    }

    if (durationHours === 0 && durationMins === 0) {
      setError("Duration must be greater than 0.");
      setLoading(false);
      return;
    }

    if (classType === "online" && !onlineLink.trim()) {
      setError("Online link is required for online classes.");
      setLoading(false);
      return;
    }

    const priceCents =
      priceDollars.trim() === ""
        ? null
        : Math.round(parseFloat(priceDollars) * 100);

    if (priceCents !== null && isNaN(priceCents)) {
      setError("Price must be a valid number.");
      setLoading(false);
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      class_type: classType,
      duration_minutes: durationHours * 60 + durationMins,
      capacity,
      price_cents: priceCents,
      location: classType !== "online" ? location.trim() || null : null,
      online_link:
        classType === "online" || classType === "hybrid"
          ? onlineLink.trim() || null
          : null,
      instructor_id: instructorId || null,
      is_public: isPublic,
    };

    try {
      const url = templateId
        ? `/api/class-templates/${templateId}`
        : "/api/class-templates";
      const method = templateId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save template");
      }

      const savedTemplate = await res.json();
      const savedId = templateId || savedTemplate.id;

      // Upload image if selected
      if (imageFile && savedId) {
        const form = new FormData();
        form.append("file", imageFile);
        const imgRes = await fetch(`/api/class-templates/${savedId}/image`, {
          method: "POST",
          body: form,
        });
        if (!imgRes.ok) {
          const imgData = await imgRes.json().catch(() => ({}));
          console.error("Image upload failed:", imgData.error);
        }
      }

      router.push("/classes");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!templateId) return;
    if (!confirm("Are you sure you want to deactivate this template?")) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/class-templates/${templateId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete template");
      }
      router.push("/classes");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="card max-w-xl">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="card max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <ErrorAlert error={error} onDismiss={() => setError("")} />
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning Yoga"
            required
            className="input-field mt-1"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A relaxing start to your day..."
            className="input-field mt-1"
          />
        </div>

        {/* Class Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Class Type
          </label>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="classType"
                checked={classType === "in_person"}
                onChange={() => setClassType("in_person")}
                className="text-brand-600"
              />
              In-person
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="classType"
                checked={classType === "online"}
                onChange={() => setClassType("online")}
                className="text-brand-600"
              />
              Online
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="classType"
                checked={classType === "hybrid"}
                onChange={() => setClassType("hybrid")}
                className="text-brand-600"
              />
              Hybrid
            </label>
          </div>
        </div>

        {/* Online Link (online/hybrid) */}
        {(classType === "online" || classType === "hybrid") && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Online Link (Zoom, Google Meet, etc.)
              {classType === "online" && (
                <span className="text-red-500"> *</span>
              )}
            </label>
            <input
              type="url"
              value={onlineLink}
              onChange={(e) => setOnlineLink(e.target.value)}
              placeholder="https://zoom.us/j/123456789"
              required={classType === "online"}
              className="input-field mt-1"
            />
          </div>
        )}

        {/* Duration & Capacity */}
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

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Price (USD)
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              $
            </span>
            <input
              type="number"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="input-field pl-7"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Leave blank for free or studio pricing.
          </p>
        </div>

        {/* Location (in-person/hybrid) */}
        {classType !== "online" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Main studio"
              className="input-field mt-1"
            />
          </div>
        )}

        {/* Instructor */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Instructor
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
                {i.isMe ? " (Me)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Public toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPublicTemplate"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          <label
            htmlFor="isPublicTemplate"
            className="text-sm font-medium text-gray-700"
          >
            Public{" "}
            <span className="font-normal text-gray-500">
              (visible to members on the schedule)
            </span>
          </label>
        </div>

        {/* Class Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Class Image (optional)
          </label>
          <div className="mt-2">
            {imagePreview && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Class preview"
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (existingImageUrl && templateId) {
                      await fetch(`/api/class-templates/${templateId}/image`, { method: "DELETE" });
                    }
                    setImageFile(null);
                    setImagePreview(null);
                    setExistingImageUrl(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setError("Image must be under 2MB");
                  return;
                }
                setImageFile(file);
                const reader = new FileReader();
                reader.onload = () => setImagePreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
              className="text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading
              ? "Saving..."
              : templateId
                ? "Save changes"
                : "Create template"}
          </button>
          <Link href="/classes" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>

      {/* Delete (edit mode only) */}
      {templateId && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-amber-600">Danger Zone</h3>
          <p className="mt-1 text-xs text-gray-500">
            Deactivating this template will hide it from the list. It can be
            restored later.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading}
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {deleteLoading ? "Deactivating..." : "Deactivate template"}
          </button>
        </div>
      )}
    </div>
  );
}
