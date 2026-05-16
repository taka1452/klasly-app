"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ErrorAlert from "@/components/ui/error-alert";
import MarkdownEditor from "@/components/ui/markdown-editor";
import { CalendarPlus, CheckCircle } from "lucide-react";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { useViewerPermissions } from "@/lib/auth/viewer-context";

type InstructorOption = { id: string; full_name: string; isMe?: boolean };
type RoomOption = { id: string; name: string };
type WaiverOption = { id: string; title: string };

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
  room_id: string | null;
  recurrence_end_date: string | null;
  transition_minutes: number | null;
  special_instructions: string | null;
  cancellation_policy: string | null;
  pricing_mode: "fixed" | "sliding_scale" | null;
  price_min_cents: number | null;
  required_waiver_template_ids: string[] | null;
  confirmation_subject_override: string | null;
  confirmation_body_override: string | null;
  instructors: {
    id: string;
    profiles: { full_name: string } | null;
  } | null;
};

type Props = {
  templateId?: string;
  duplicateData?: Record<string, unknown> | null;
};

export default function TemplateForm({ templateId, duplicateData }: Props) {
  const router = useRouter();
  const { isEnabled } = useFeature();
  const onlineEnabled = isEnabled(FEATURE_KEYS.ONLINE_CLASSES);
  // Owners always edit price; managers need either the broad Classes
  // permission or the more granular Class Pricing toggle. (Jamie feedback
  // 2026-04-30: Sarah enabled Class Pricing for me but I still don't see
  // the price field show up.)
  const { canManageClassPricing } = useViewerPermissions();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classType, setClassType] = useState<"in_person" | "online" | "hybrid">(
    "in_person"
  );
  const [durationHours, setDurationHours] = useState(1);
  const [durationMins, setDurationMins] = useState(0);
  const [capacity, setCapacity] = useState(15);
  const [priceDollars, setPriceDollars] = useState("");
  const [pricingMode, setPricingMode] = useState<"fixed" | "sliding_scale">("fixed");
  const [priceMinDollars, setPriceMinDollars] = useState("");
  const [onlineLink, setOnlineLink] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [transitionMinutes, setTransitionMinutes] = useState(0);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [waivers, setWaivers] = useState<WaiverOption[]>([]);
  const [requiredWaiverIds, setRequiredWaiverIds] = useState<string[]>([]);
  const [confirmationSubjectOverride, setConfirmationSubjectOverride] = useState("");
  const [confirmationBodyOverride, setConfirmationBodyOverride] = useState("");
  const [showEmailOverride, setShowEmailOverride] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!templateId);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // State for post-creation "Schedule Now" flow
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Fetch instructors, rooms and waivers via API
  useEffect(() => {
    async function fetchData() {
      try {
        const [instrRes, roomsRes, waiversRes] = await Promise.all([
          fetch("/api/dashboard/instructors"),
          fetch("/api/dashboard/rooms"),
          fetch("/api/waiver-templates"),
        ]);

        if (instrRes.ok) {
          const data: { id: string; name: string }[] = await instrRes.json();
          setInstructors(data.map((i) => ({ id: i.id, full_name: i.name })));
        }

        if (roomsRes.ok) {
          const roomsData = await roomsRes.json();
          const list: RoomOption[] = (
            Array.isArray(roomsData) ? roomsData : roomsData?.rooms || []
          ).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            name: r.name as string,
          }));
          setRooms(list);
        }

        if (waiversRes.ok) {
          const w = await waiversRes.json();
          const list: WaiverOption[] = (Array.isArray(w) ? w : w?.templates || [])
            .filter((t: { is_active?: boolean }) => t.is_active !== false)
            .map((t: Record<string, unknown>) => ({
              id: t.id as string,
              title: (t.title as string) || "Untitled waiver",
            }));
          setWaivers(list);
        }
      } catch {
        // non-critical
      }
    }
    fetchData();
  }, []);

  // Pre-fill form with duplicate data
  useEffect(() => {
    if (!duplicateData) return;
    setName((duplicateData.name as string) || "");
    setDescription((duplicateData.description as string) || "");
    setSpecialInstructions((duplicateData.special_instructions as string) || "");
    setCancellationPolicy((duplicateData.cancellation_policy as string) || "");
    const ct = (duplicateData.class_type as string) || "in_person";
    setClassType(ct as "in_person" | "online" | "hybrid");
    const dm = (duplicateData.duration_minutes as number) || 60;
    setDurationHours(Math.floor(dm / 60));
    setDurationMins(dm % 60);
    setCapacity((duplicateData.capacity as number) || 15);
    const pc = duplicateData.price_cents as number | null;
    setPriceDollars(pc != null ? (pc / 100).toFixed(2) : "");
    setOnlineLink((duplicateData.online_link as string) || "");
    setInstructorId((duplicateData.instructor_id as string) || "");
    setRoomId((duplicateData.room_id as string) || "");
    setIsPublic((duplicateData.is_public as boolean) ?? true);
    setTransitionMinutes((duplicateData.transition_minutes as number) || 0);
    if (duplicateData.image_url) {
      setExistingImageUrl(duplicateData.image_url as string);
      setImagePreview(duplicateData.image_url as string);
    }
  }, [duplicateData]);

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
        setPricingMode((t.pricing_mode as "fixed" | "sliding_scale") || "fixed");
        setPriceMinDollars(
          t.price_min_cents !== null && t.price_min_cents !== undefined
            ? (t.price_min_cents / 100).toFixed(2)
            : ""
        );
        setOnlineLink(t.online_link || "");
        setInstructorId(t.instructor_id || "");
        setRoomId(t.room_id || "");
        setIsPublic(t.is_public ?? true);
        setRecurrenceEndDate(t.recurrence_end_date || "");
        setTransitionMinutes(t.transition_minutes || 0);
        setSpecialInstructions(t.special_instructions || "");
        setCancellationPolicy(t.cancellation_policy || "");
        setRequiredWaiverIds(
          Array.isArray(t.required_waiver_template_ids)
            ? t.required_waiver_template_ids
            : []
        );
        setConfirmationSubjectOverride(t.confirmation_subject_override || "");
        setConfirmationBodyOverride(t.confirmation_body_override || "");
        if (t.confirmation_subject_override || t.confirmation_body_override) {
          setShowEmailOverride(true);
        }
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

    let priceMinCents: number | null = null;
    if (pricingMode === "sliding_scale") {
      if (priceCents === null) {
        setError("Sliding scale requires a suggested price.");
        setLoading(false);
        return;
      }
      priceMinCents =
        priceMinDollars.trim() === ""
          ? 0
          : Math.round(parseFloat(priceMinDollars) * 100);
      if (isNaN(priceMinCents) || priceMinCents < 0) {
        setError("Minimum price must be $0 or higher.");
        setLoading(false);
        return;
      }
      if (priceMinCents > priceCents) {
        setError("Minimum price cannot be more than the suggested price.");
        setLoading(false);
        return;
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      class_type: classType,
      duration_minutes: durationHours * 60 + durationMins,
      capacity,
      price_cents: priceCents,
      location: null,
      online_link:
        classType === "online" || classType === "hybrid"
          ? onlineLink.trim() || null
          : null,
      instructor_id: instructorId || null,
      room_id: classType !== "online" ? roomId || null : null,
      is_public: isPublic,
      recurrence_end_date: recurrenceEndDate || null,
      transition_minutes: transitionMinutes || null,
      special_instructions: specialInstructions.trim() || null,
      cancellation_policy: cancellationPolicy.trim() || null,
      pricing_mode: pricingMode,
      price_min_cents: pricingMode === "sliding_scale" ? priceMinCents : null,
      required_waiver_template_ids: requiredWaiverIds,
      confirmation_subject_override: showEmailOverride
        ? confirmationSubjectOverride.trim() || null
        : null,
      confirmation_body_override: showEmailOverride
        ? confirmationBodyOverride.trim() || null
        : null,
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

      if (templateId) {
        // Edit mode: go back to classes list
        router.push("/classes");
        router.refresh();
      } else {
        // Create mode: show "Schedule Now" option
        setCreatedId(savedId);
      }
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

  // Post-creation success screen. A class "template" on its own has no sessions
  // on the calendar yet — so we nudge the user to schedule it, but also make
  // it crystal-clear what each button does and give them a "view the class"
  // escape hatch (Jamie feedback 2026-04: the previous screen felt like a
  // dead end after "Back to Classes").
  if (createdId) {
    return (
      <div className="card max-w-xl">
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Class created: {name}
          </h2>
          <p className="text-sm text-gray-500 mb-2">
            This is a <strong>class template</strong> — a reusable definition. To
            put it on your schedule, add one or more sessions (a date + time)
            next.
          </p>
          <p className="mb-6 text-xs text-gray-400">
            You can always add sessions later from the class detail page.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/calendar?schedule=${createdId}`}
              className="btn-primary inline-flex items-center gap-2"
            >
              <CalendarPlus className="h-4 w-4" />
              Schedule sessions now
            </Link>
            <Link href={`/classes/${createdId}`} className="btn-secondary">
              View class detail
            </Link>
            <Link href="/classes" className="btn-secondary">
              Back to all classes
            </Link>
          </div>
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
          <MarkdownEditor
            value={description}
            onChange={setDescription}
            rows={4}
            placeholder="A relaxing start to your day..."
          />
        </div>

        {/* Special instructions — visually distinct so it doesn't get
            confused with Description. Description = marketing copy that
            sells the class; Special instructions = logistics members need
            to know (props to bring, arrive-early, accessibility). */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <label className="block text-sm font-semibold text-amber-900">
            Special instructions
            <span className="ml-2 text-xs font-normal text-amber-700">(optional)</span>
          </label>
          <p className="mt-0.5 text-xs text-amber-800/80">
            Logistics members need before showing up — props to bring,
            arrive-early, accessibility notes. Distinct from Description.
          </p>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={3}
            placeholder="e.g. Bring your own mat and a blanket. Arrive 10 minutes early to set up props."
            className="input-field mt-2 bg-white"
          />
          <p className="mt-1 text-xs text-amber-700/80">
            Shown on the class detail page and in booking confirmation emails.
          </p>
        </div>

        {/* Required waivers — members must sign every listed waiver before
            they can book. Already-signed waivers are skipped at checkout. */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Required waivers{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          {waivers.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">
              No waiver templates configured yet.{" "}
              <Link
                href="/settings/waiver"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Create one →
              </Link>
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-gray-500">
                Members must sign every selected waiver before booking. Leave
                empty to use only your studio-wide waiver.
              </p>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {waivers.map((w) => (
                  <label
                    key={w.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={requiredWaiverIds.includes(w.id)}
                      onChange={() =>
                        setRequiredWaiverIds((prev) =>
                          prev.includes(w.id)
                            ? prev.filter((x) => x !== w.id)
                            : [...prev, w.id]
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    <span className="text-sm text-gray-700">{w.title}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Cancellation policy — falls back to the studio-wide policy when
            blank. Per-class override is useful for retreats or workshops
            with stricter refund windows. */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Cancellation policy{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={cancellationPolicy}
            onChange={(e) => setCancellationPolicy(e.target.value)}
            rows={3}
            placeholder="e.g. Full refund up to 24 hours before. After that, the session is non-refundable."
            className="input-field mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">
            Shown on the booking page and in confirmation emails. Leave blank
            to use your studio-wide policy.
          </p>
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
            {onlineEnabled && (
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
            )}
            {onlineEnabled && (
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
            )}
          </div>
        </div>

        {/* Online Link (online/hybrid) */}
        {onlineEnabled && (classType === "online" || classType === "hybrid") && (
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

        {/* Price (gated on Class Pricing permission for managers) */}
        {canManageClassPricing && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Pricing
            </label>
            <div className="mt-2 flex gap-2">
              {(
                [
                  { value: "fixed" as const, label: "Fixed price" },
                  { value: "sliding_scale" as const, label: "Pay What You Can" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPricingMode(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    pricingMode === opt.value
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600">
                {pricingMode === "sliding_scale"
                  ? "Suggested price (USD)"
                  : "Price (USD)"}
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
              {pricingMode === "fixed" && (
                <p className="mt-1 text-xs text-gray-500">
                  Leave blank for free or studio pricing.
                </p>
              )}
            </div>

            {pricingMode === "sliding_scale" && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600">
                  Minimum price (USD)
                </label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    value={priceMinDollars}
                    onChange={(e) => setPriceMinDollars(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="input-field pl-7"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Attendees can pay anything from the minimum up to the
                  suggested price (or more) at checkout. Use $0.00 to allow
                  fully free claims.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Room (in-person/hybrid) */}
        {classType !== "online" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Default Room{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            {rooms.length > 0 ? (
              <>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="input-field mt-1"
                >
                  <option value="">No room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  This room will be pre-selected when scheduling sessions.
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                No rooms configured.{" "}
                <Link
                  href="/rooms"
                  className="font-medium text-brand-600 hover:text-brand-700"
                >
                  Add a room →
                </Link>
              </p>
            )}
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

        {/* Recurrence End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Recurrence End Date{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="date"
            value={recurrenceEndDate}
            onChange={(e) => setRecurrenceEndDate(e.target.value)}
            className="input-field mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">
            Weekly sessions will stop being generated after this date. Leave blank for no end date.
          </p>
        </div>

        {/* Transition Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Transition Time{" "}
            <span className="font-normal text-gray-400">(between classes)</span>
          </label>
          <select
            value={transitionMinutes}
            onChange={(e) => setTransitionMinutes(parseInt(e.target.value, 10))}
            className="input-field mt-1"
          >
            <option value={0}>None</option>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Buffer time after each session to prevent back-to-back classes.
          </p>
        </div>

        {/* Confirmation email override — when set, replaces the studio
            default for this class only. Variables {memberName} {className}
            {sessionDate} {startTime} {studioName} are substituted at send
            time. */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showEmailOverride}
              onChange={(e) => setShowEmailOverride(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            Custom confirmation email for this class
          </label>
          {showEmailOverride && (
            <div className="mt-3 rounded-lg border border-gray-200 p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Subject{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={confirmationSubjectOverride}
                  onChange={(e) =>
                    setConfirmationSubjectOverride(e.target.value)
                  }
                  placeholder="See you at {className}, {memberName}!"
                  className="input-field mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Body{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={confirmationBodyOverride}
                  onChange={(e) =>
                    setConfirmationBodyOverride(e.target.value)
                  }
                  rows={5}
                  placeholder={`Hi {memberName},\n\nThanks for booking {className}! A few things to know before you arrive...`}
                  className="input-field mt-1"
                />
              </div>
              <p className="text-xs text-gray-500">
                Available variables:{" "}
                <code className="font-mono">{`{memberName}`}</code>,{" "}
                <code className="font-mono">{`{className}`}</code>,{" "}
                <code className="font-mono">{`{sessionDate}`}</code>,{" "}
                <code className="font-mono">{`{startTime}`}</code>,{" "}
                <code className="font-mono">{`{studioName}`}</code>. The
                class details block is always appended automatically.
              </p>
            </div>
          )}
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
                  loading="lazy"
                  decoding="async"
                  className="h-20 w-20 min-w-[5rem] rounded-lg object-cover"
                  style={{ width: 80, height: 80 }}
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
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
              Upload Image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
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
              />
            </label>
            <span className="text-xs text-gray-400">JPG, PNG, WebP · Max 2MB</span>
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
