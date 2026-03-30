"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CancellationPolicyTier } from "@/types/database";
import HelpTip from "@/components/ui/help-tip";

type OptionDraft = {
  id?: string;
  name: string;
  description: string;
  priceDollars: string;
  capacity: string;
  earlyBirdDollars: string;
  earlyBirdDeadline: string;
};

type ScheduleItemDraft = {
  id?: string;
  day_number: number;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
};

type PackingItemDraft = {
  item: string;
  category: string;
};

const STEPS = [
  "Basic Info",
  "Gallery & Details",
  "Room Options",
  "Schedule",
  "Payment",
  "Cancellation Policy",
  "Application Form",
];

function generatePolicyText(tiers: CancellationPolicyTier[]): string {
  if (tiers.length === 0) return "";
  const sorted = [...tiers].sort((a, b) => b.days_before - a.days_before);
  return sorted
    .map((t) => {
      const days = `${t.days_before}+ days before`;
      const refund =
        t.refund_percent === 100
          ? "Full refund"
          : t.refund_percent === 0
            ? "No refund"
            : `${t.refund_percent}% refund`;
      const fee = t.fee_cents > 0 ? ` minus $${(t.fee_cents / 100).toFixed(0)} fee` : "";
      const note = t.note ? ` — ${t.note}` : "";
      return `${days}: ${refund}${fee}${note}`;
    })
    .join("\n");
}

export default function EditEventPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [currentStatus, setCurrentStatus] = useState("draft");

  // Step 2: Gallery & Details
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [packingList, setPackingList] = useState<PackingItemDraft[]>([]);
  const [accessInfo, setAccessInfo] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);

  // Step 3: Options
  const [options, setOptions] = useState<OptionDraft[]>([
    { name: "", description: "", priceDollars: "", capacity: "10", earlyBirdDollars: "", earlyBirdDeadline: "" },
  ]);

  // Step 4: Schedule
  const [scheduleItems, setScheduleItems] = useState<ScheduleItemDraft[]>([]);

  // Step 5: Payment
  const [paymentType, setPaymentType] = useState<"full" | "installment">("full");

  // Step 6: Cancellation
  const [policyTiers, setPolicyTiers] = useState<CancellationPolicyTier[]>([]);
  const [policyText, setPolicyText] = useState("");

  // Step 7: Application Form
  type AppField = { id: string; label: string; type: string; required: boolean; placeholder: string; options: string };
  const [appFields, setAppFields] = useState<AppField[]>([]);

  // Load existing event
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: event } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (!event) {
        setError("Event not found.");
        setLoading(false);
        return;
      }

      setName(event.name || "");
      setDescription(event.description || "");
      setLocationName(event.location_name || "");
      setLocationAddress(event.location_address || "");
      setStartDate(event.start_date || "");
      setEndDate(event.end_date || "");
      setImageUrl(event.image_url || "");
      setIsPublic(event.is_public ?? true);
      setCurrentStatus(event.status || "draft");
      setPaymentType(event.payment_type || "full");
      setPolicyTiers(
        Array.isArray(event.cancellation_policy) ? event.cancellation_policy : [],
      );
      setPolicyText(event.cancellation_policy_text || "");

      // Gallery & Details fields
      setGalleryImages(Array.isArray(event.gallery_images) ? event.gallery_images : []);
      setPackingList(
        Array.isArray(event.packing_list)
          ? event.packing_list.map((p: { item: string; category?: string }) => ({
              item: p.item,
              category: p.category || "",
            }))
          : []
      );
      setAccessInfo(event.access_info || "");
      setLocationLat(event.location_lat ? String(event.location_lat) : "");
      setLocationLng(event.location_lng ? String(event.location_lng) : "");
      setWaitlistEnabled(event.waitlist_enabled ?? false);

      // Load application fields
      if (Array.isArray(event.application_fields) && event.application_fields.length > 0) {
        setAppFields(
          event.application_fields.map((f: { id: string; label: string; type: string; required: boolean; placeholder?: string; options?: string[] }) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            required: f.required,
            placeholder: f.placeholder || "",
            options: Array.isArray(f.options) ? f.options.join(", ") : "",
          })),
        );
      }

      // Load options (with early bird)
      const { data: opts } = await supabase
        .from("event_options")
        .select("*")
        .eq("event_id", id)
        .order("sort_order");

      if (opts && opts.length > 0) {
        setOptions(
          opts.map((o) => ({
            id: o.id,
            name: o.name,
            description: o.description || "",
            priceDollars: (o.price_cents / 100).toString(),
            capacity: o.capacity.toString(),
            earlyBirdDollars: o.early_bird_price_cents ? (o.early_bird_price_cents / 100).toString() : "",
            earlyBirdDeadline: o.early_bird_deadline || "",
          })),
        );
      }

      // Load schedule items
      const { data: schedItems } = await supabase
        .from("event_schedule_items")
        .select("*")
        .eq("event_id", id)
        .order("day_number")
        .order("sort_order");
      if (schedItems && schedItems.length > 0) {
        setScheduleItems(
          schedItems.map((s) => ({
            id: s.id,
            day_number: s.day_number,
            start_time: s.start_time || "",
            end_time: s.end_time || "",
            title: s.title,
            description: s.description || "",
          })),
        );
      }

      setLoading(false);
    }
    load();
  }, [id]);

  // Gallery helpers
  function addGalleryImage() {
    if (newGalleryUrl.trim()) {
      setGalleryImages((g) => [...g, newGalleryUrl.trim()]);
      setNewGalleryUrl("");
    }
  }
  function removeGalleryImage(i: number) {
    setGalleryImages((g) => g.filter((_, idx) => idx !== i));
  }

  // Packing list helpers
  function addPackingItem() {
    setPackingList((p) => [...p, { item: "", category: "" }]);
  }
  function removePackingItem(i: number) {
    setPackingList((p) => p.filter((_, idx) => idx !== i));
  }
  function updatePackingItem(i: number, field: keyof PackingItemDraft, value: string) {
    setPackingList((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }

  // Schedule helpers
  function addScheduleItem() {
    const dayNum = scheduleItems.length > 0
      ? scheduleItems[scheduleItems.length - 1].day_number
      : 1;
    setScheduleItems((s) => [...s, { day_number: dayNum, start_time: "", end_time: "", title: "", description: "" }]);
  }
  function removeScheduleItem(i: number) {
    setScheduleItems((s) => s.filter((_, idx) => idx !== i));
  }
  function updateScheduleItem(i: number, field: keyof ScheduleItemDraft, value: string | number) {
    setScheduleItems((s) => s.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }

  // Option helpers
  function addOption() {
    setOptions((o) => [...o, { name: "", description: "", priceDollars: "", capacity: "10", earlyBirdDollars: "", earlyBirdDeadline: "" }]);
  }
  const [optionsWithBookings, setOptionsWithBookings] = useState<Set<string>>(new Set());

  // Load booking counts for existing options
  useEffect(() => {
    async function loadOptionBookings() {
      const supabase = createClient();
      const { data } = await supabase
        .from("event_bookings")
        .select("event_option_id")
        .eq("event_id", id)
        .not("booking_status", "eq", "cancelled");
      if (data) {
        const ids = new Set(data.map((b) => b.event_option_id).filter(Boolean) as string[]);
        setOptionsWithBookings(ids);
      }
    }
    if (id) loadOptionBookings();
  }, [id]);

  function removeOption(i: number) {
    const opt = options[i];
    if (opt.id && optionsWithBookings.has(opt.id)) {
      setError("This option has active bookings and cannot be removed. Cancel the bookings first.");
      return;
    }
    setOptions((o) => o.filter((_, idx) => idx !== i));
  }
  function updateOption(i: number, field: keyof OptionDraft, value: string) {
    setOptions((o) => o.map((opt, idx) => (idx === i ? { ...opt, [field]: value } : opt)));
  }

  function addTier() {
    setPolicyTiers((t) => [...t, { days_before: 30, refund_percent: 100, fee_cents: 0, note: "" }]);
  }
  function removeTier(i: number) {
    setPolicyTiers((t) => t.filter((_, idx) => idx !== i));
  }
  function updateTier(i: number, field: keyof CancellationPolicyTier, value: string | number) {
    setPolicyTiers((t) =>
      t.map((tier, idx) => (idx === i ? { ...tier, [field]: value } : tier)),
    );
  }

  function addAppField() {
    setAppFields((f) => [...f, { id: `f${Date.now()}`, label: "", type: "text", required: false, placeholder: "", options: "" }]);
  }
  function removeAppField(i: number) {
    setAppFields((f) => f.filter((_, idx) => idx !== i));
  }
  function updateAppField(i: number, field: keyof AppField, value: string | boolean) {
    setAppFields((f) => f.map((af, idx) => (idx === i ? { ...af, [field]: value } : af)));
  }

  async function handleSave(status: "draft" | "published") {
    setError("");
    if (status === "published") {
      if (!name.trim()) { setError("Event name is required. (Step 1: Basic Info)"); setStep(0); return; }
      if (!startDate || !endDate) { setError("Start and end dates are required. (Step 1: Basic Info)"); setStep(0); return; }
      const validOptions = options.filter((o) => o.name.trim());
      if (validOptions.length === 0) { setError("At least one room option with a name is required. (Step 3: Room Options)"); setStep(2); return; }
    }

    setSaving(true);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("events")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        location_name: locationName.trim() || null,
        location_address: locationAddress.trim() || null,
        start_date: startDate,
        end_date: endDate || startDate,
        image_url: imageUrl.trim() || null,
        is_public: isPublic,
        status,
        payment_type: paymentType,
        installment_count: paymentType === "installment" ? 3 : 1,
        cancellation_policy: policyTiers,
        cancellation_policy_text: policyText.trim() || null,
        application_fields: appFields.filter((f) => f.label.trim()).map((f) => ({
          id: f.id,
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          placeholder: f.placeholder.trim(),
          ...(["select", "radio", "checkbox"].includes(f.type)
            ? { options: f.options.split(",").map((o) => o.trim()).filter(Boolean) }
            : {}),
        })),
        gallery_images: galleryImages.length > 0 ? galleryImages : [],
        packing_list: packingList.filter((p) => p.item.trim()).map((p) => ({
          item: p.item.trim(),
          ...(p.category.trim() ? { category: p.category.trim() } : {}),
        })),
        access_info: accessInfo.trim() || null,
        location_lat: locationLat ? parseFloat(locationLat) : null,
        location_lng: locationLng ? parseFloat(locationLng) : null,
        waitlist_enabled: waitlistEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Update existing options and insert new ones (preserve options with bookings)
    const validOptions = options.filter((o) => o.name.trim());
    const existingOptionIds = validOptions.filter((o) => o.id).map((o) => o.id!);

    // Only delete options that have no bookings and are no longer in the list
    const { data: currentOptions } = await supabase
      .from("event_options")
      .select("id")
      .eq("event_id", id);

    const idsToKeep = new Set(existingOptionIds);
    const idsToDelete = (currentOptions || [])
      .map((o) => o.id)
      .filter((oid) => !idsToKeep.has(oid) && !optionsWithBookings.has(oid));

    if (idsToDelete.length > 0) {
      await supabase.from("event_options").delete().in("id", idsToDelete);
    }

    // Upsert options: update existing, insert new (with early bird)
    for (let idx = 0; idx < validOptions.length; idx++) {
      const o = validOptions[idx];
      const optionData = {
        event_id: id,
        name: o.name.trim(),
        description: o.description.trim() || null,
        price_cents: Math.round(parseFloat(o.priceDollars || "0") * 100),
        capacity: parseInt(o.capacity || "10", 10),
        sort_order: idx,
        early_bird_price_cents: o.earlyBirdDollars ? Math.round(parseFloat(o.earlyBirdDollars) * 100) : null,
        early_bird_deadline: o.earlyBirdDeadline || null,
      };
      if (o.id) {
        await supabase.from("event_options").update(optionData).eq("id", o.id);
      } else {
        await supabase.from("event_options").insert(optionData);
      }
    }

    // Save schedule items: delete old, insert new
    await supabase.from("event_schedule_items").delete().eq("event_id", id);
    const validScheduleItems = scheduleItems.filter((s) => s.title.trim());
    if (validScheduleItems.length > 0) {
      await supabase.from("event_schedule_items").insert(
        validScheduleItems.map((s, idx) => ({
          event_id: id,
          day_number: s.day_number,
          start_time: s.start_time || null,
          end_time: s.end_time || null,
          title: s.title.trim(),
          description: s.description.trim() || null,
          sort_order: idx,
        })),
      );
    }

    router.push(`/events/${id}/manage`);
    router.refresh();
  }

  const maxPrice = Math.max(
    ...options.map((o) => parseFloat(o.priceDollars || "0")),
    0,
  );

  // Calculate number of days for schedule
  const daysCount = startDate && endDate
    ? Math.ceil((new Date(endDate + "T00:00:00").getTime() - new Date(startDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 1;

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-gray-500">Loading event...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/events/${id}/manage`} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to event
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit Event</h1>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 rounded-lg px-1 py-2 text-xs font-medium transition ${
              i === step
                ? "bg-brand-600 text-white"
                : i < step
                  ? "bg-brand-100 text-brand-700"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            <span className="hidden sm:inline">{i + 1}. {s}</span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="card">
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Event Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bali Yoga Retreat 2026" required className="input-field mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe your event..." className="input-field mt-1" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Location Name</label>
                <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Villa Harmony" className="input-field mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location Address</label>
                <input type="text" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="Ubud, Bali, Indonesia" className="input-field mt-1" />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="input-field mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required className="input-field mt-1" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cover Image URL</label>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/retreat-image.jpg" className="input-field mt-1" />
              <p className="mt-1 text-xs text-gray-400">Main hero image for your event page.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Visibility
                <HelpTip text="Private events are only visible to logged-in members. Use for corporate retreats." helpSlug="events-retreats" />
              </label>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={isPublic} onChange={() => setIsPublic(true)} className="text-brand-600" />
                  Public
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={!isPublic} onChange={() => setIsPublic(false)} className="text-brand-600" />
                  Members only
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Gallery & Details */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Gallery */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Photo Gallery</label>
              <p className="mt-1 text-xs text-gray-400">Add multiple photos to showcase your retreat venue and activities.</p>
              {galleryImages.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {galleryImages.map((url, i) => (
                    <div key={i} className="group relative aspect-[4/3] overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(i)}
                        className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  type="url"
                  value={newGalleryUrl}
                  onChange={(e) => setNewGalleryUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="input-field flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGalleryImage(); } }}
                />
                <button type="button" onClick={addGalleryImage} className="btn-secondary text-sm whitespace-nowrap">
                  + Add
                </button>
              </div>
            </div>

            {/* Packing List */}
            <div>
              <label className="block text-sm font-medium text-gray-700">What to Bring</label>
              <p className="mt-1 text-xs text-gray-400">List items guests should bring. Optionally group by category.</p>
              {packingList.map((item, i) => (
                <div key={i} className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={item.item}
                    onChange={(e) => updatePackingItem(i, "item", e.target.value)}
                    placeholder="Yoga mat"
                    className="input-field flex-1"
                  />
                  <input
                    type="text"
                    value={item.category}
                    onChange={(e) => updatePackingItem(i, "category", e.target.value)}
                    placeholder="Category (optional)"
                    className="input-field w-36"
                  />
                  <button type="button" onClick={() => removePackingItem(i)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPackingItem} className="btn-secondary mt-2 text-sm">
                + Add Item
              </button>
            </div>

            {/* Access Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Getting There / Access Info</label>
              <textarea
                value={accessInfo}
                onChange={(e) => setAccessInfo(e.target.value)}
                rows={3}
                placeholder="Nearest airport, shuttle service, parking info..."
                className="input-field mt-1"
              />
            </div>

            {/* Map Coordinates */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Latitude (optional)</label>
                <input
                  type="number"
                  value={locationLat}
                  onChange={(e) => setLocationLat(e.target.value)}
                  placeholder="-8.5069"
                  step="any"
                  className="input-field mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Longitude (optional)</label>
                <input
                  type="number"
                  value={locationLng}
                  onChange={(e) => setLocationLng(e.target.value)}
                  placeholder="115.2625"
                  step="any"
                  className="input-field mt-1"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Coordinates enable an embedded Google Map on your event page. You can find these on Google Maps.</p>

            {/* Waitlist */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={waitlistEnabled}
                  onChange={(e) => setWaitlistEnabled(e.target.checked)}
                  className="rounded accent-brand-600"
                />
                Enable waitlist when sold out
              </label>
              <p className="mt-1 text-xs text-gray-400">Guests can join a waitlist when all options are full.</p>
            </div>
          </div>
        )}

        {/* Step 3: Room Options */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add room types or ticket tiers. Each option can have its own price, capacity, and optional early bird pricing.
            </p>
            {options.map((opt, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Option {i + 1}</span>
                    {opt.id && optionsWithBookings.has(opt.id) && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        Has bookings
                      </span>
                    )}
                  </div>
                  {options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={!!(opt.id && optionsWithBookings.has(opt.id))}
                      className={`text-xs ${opt.id && optionsWithBookings.has(opt.id) ? "cursor-not-allowed text-gray-300" : "text-red-500 hover:text-red-700"}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Name *</label>
                    <input type="text" value={opt.name} onChange={(e) => updateOption(i, "name", e.target.value)} placeholder="Shared Room" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Description</label>
                    <input type="text" value={opt.description} onChange={(e) => updateOption(i, "description", e.target.value)} placeholder="Twin beds, ocean view" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price ($)</label>
                    <input type="number" value={opt.priceDollars} onChange={(e) => updateOption(i, "priceDollars", e.target.value)} placeholder="1500" min="0" step="0.01" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Capacity</label>
                    <input type="number" value={opt.capacity} onChange={(e) => updateOption(i, "capacity", e.target.value)} placeholder="10" min="1" className="input-field mt-1" />
                  </div>
                </div>
                {/* Early Bird */}
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xs font-medium text-green-700 mb-2">Early Bird Pricing (optional)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Early Bird Price ($)</label>
                      <input type="number" value={opt.earlyBirdDollars} onChange={(e) => updateOption(i, "earlyBirdDollars", e.target.value)} placeholder="1200" min="0" step="0.01" className="input-field mt-1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Deadline</label>
                      <input type="datetime-local" value={opt.earlyBirdDeadline} onChange={(e) => updateOption(i, "earlyBirdDeadline", e.target.value)} className="input-field mt-1" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addOption} className="btn-secondary text-sm">
              + Add Option
            </button>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Create a daily timetable for your retreat. This will be shown on the event page.
              {startDate && endDate && (
                <span className="ml-1 font-medium">({daysCount} days)</span>
              )}
            </p>
            {scheduleItems.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-500">No schedule yet. Add activities to create a daily timetable.</p>
                <button type="button" onClick={addScheduleItem} className="btn-secondary mt-4 text-sm">
                  + Add Activity
                </button>
              </div>
            ) : (
              <>
                {scheduleItems.map((item, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Activity {i + 1}</span>
                      <button type="button" onClick={() => removeScheduleItem(i)} className="text-xs text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Day</label>
                        <select
                          value={item.day_number}
                          onChange={(e) => updateScheduleItem(i, "day_number", parseInt(e.target.value, 10))}
                          className="input-field mt-1"
                        >
                          {Array.from({ length: Math.max(daysCount, 1) }, (_, d) => (
                            <option key={d + 1} value={d + 1}>Day {d + 1}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Start Time</label>
                        <input type="time" value={item.start_time} onChange={(e) => updateScheduleItem(i, "start_time", e.target.value)} className="input-field mt-1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">End Time</label>
                        <input type="time" value={item.end_time} onChange={(e) => updateScheduleItem(i, "end_time", e.target.value)} className="input-field mt-1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Title *</label>
                        <input type="text" value={item.title} onChange={(e) => updateScheduleItem(i, "title", e.target.value)} placeholder="Morning Yoga" className="input-field mt-1" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Description</label>
                      <input type="text" value={item.description} onChange={(e) => updateScheduleItem(i, "description", e.target.value)} placeholder="Gentle flow to start the day" className="input-field mt-1" />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addScheduleItem} className="btn-secondary text-sm">
                  + Add Activity
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 5: Payment */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Payment Type</label>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50">
                  <input type="radio" checked={paymentType === "full"} onChange={() => setPaymentType("full")} className="mt-0.5 text-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Full payment</p>
                    <p className="text-xs text-gray-500">Members pay the full amount at booking.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50">
                  <input type="radio" checked={paymentType === "installment"} onChange={() => setPaymentType("installment")} className="mt-0.5 text-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">3 installments</p>
                    <p className="text-xs text-gray-500">Members pay 1/3 at booking, 1/3 after 30 days, 1/3 after 60 days.</p>
                  </div>
                </label>
              </div>
            </div>
            {paymentType === "installment" && maxPrice > 0 && (
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-800">Payment Preview</p>
                <p className="mt-1 text-xs text-blue-700">
                  For the ${maxPrice.toFixed(0)} option:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-blue-700">
                  <li>1st payment (at booking): ${(maxPrice / 3).toFixed(2)}</li>
                  <li>2nd payment (after 30 days): ${(maxPrice / 3).toFixed(2)}</li>
                  <li>3rd payment (after 60 days): ${(maxPrice - (Math.floor(maxPrice / 3 * 100) / 100) * 2).toFixed(2)}</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Cancellation Policy */}
        {step === 5 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Define refund tiers based on how far in advance a guest cancels.
            </p>
            {policyTiers.map((tier, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Tier {i + 1}</span>
                  <button type="button" onClick={() => removeTier(i)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Days before start</label>
                    <input type="number" value={tier.days_before} onChange={(e) => updateTier(i, "days_before", parseInt(e.target.value || "0", 10))} min="0" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Refund %</label>
                    <input type="number" value={tier.refund_percent} onChange={(e) => updateTier(i, "refund_percent", parseInt(e.target.value || "0", 10))} min="0" max="100" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Fee ($)</label>
                    <input type="number" value={tier.fee_cents / 100} onChange={(e) => updateTier(i, "fee_cents", Math.round(parseFloat(e.target.value || "0") * 100))} min="0" step="1" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Note</label>
                    <input type="text" value={tier.note} onChange={(e) => updateTier(i, "note", e.target.value)} placeholder="Optional note" className="input-field mt-1" />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addTier} className="btn-secondary text-sm">
              + Add Tier
            </button>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Policy Text</label>
                {policyTiers.length > 0 && (
                  <button type="button" onClick={() => setPolicyText(generatePolicyText(policyTiers))} className="text-xs text-brand-600 hover:text-brand-700">
                    Auto-generate from tiers
                  </button>
                )}
              </div>
              <textarea value={policyText} onChange={(e) => setPolicyText(e.target.value)} rows={4} placeholder="Describe your cancellation policy..." className="input-field mt-1" />
            </div>
          </div>
        )}

        {/* Step 7: Application Form */}
        {step === 6 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add custom questions for guests to answer when booking (e.g. dietary restrictions, experience level).
            </p>
            {appFields.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-500">
                  No application form. Guests will only provide their name and email.
                </p>
                <button type="button" onClick={addAppField} className="btn-secondary mt-4 text-sm">
                  + Add Question
                </button>
              </div>
            ) : (
              <>
                {appFields.map((af, i) => (
                  <div key={af.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Question {i + 1}</span>
                      <button type="button" onClick={() => removeAppField(i)} className="text-xs text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Label *</label>
                        <input type="text" value={af.label} onChange={(e) => updateAppField(i, "label", e.target.value)} placeholder="e.g. Dietary restrictions" className="input-field mt-1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Type</label>
                        <select value={af.type} onChange={(e) => updateAppField(i, "type", e.target.value)} className="input-field mt-1">
                          <option value="text">Short text</option>
                          <option value="textarea">Long text</option>
                          <option value="select">Dropdown</option>
                          <option value="radio">Radio buttons</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </div>
                    </div>
                    {["select", "radio"].includes(af.type) && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Options (comma-separated)</label>
                        <input type="text" value={af.options} onChange={(e) => updateAppField(i, "options", e.target.value)} placeholder="Beginner, Intermediate, Advanced" className="input-field mt-1" />
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {["text", "textarea"].includes(af.type) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Placeholder</label>
                          <input type="text" value={af.placeholder} onChange={(e) => updateAppField(i, "placeholder", e.target.value)} placeholder="e.g. Vegan, Gluten-free" className="input-field mt-1" />
                        </div>
                      )}
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={af.required} onChange={(e) => updateAppField(i, "required", e.target.checked)} className="rounded accent-brand-600" />
                          Required
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addAppField} className="btn-secondary text-sm">
                  + Add Question
                </button>
              </>
            )}
          </div>
        )}

        {/* Navigation + Save */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6">
          <div>
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary text-sm">
                &larr; Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="btn-primary text-sm">
                Next &rarr;
              </button>
            ) : (
              <>
                <button type="button" onClick={() => handleSave("draft")} disabled={saving} className="btn-secondary">
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button type="button" onClick={() => handleSave("published")} disabled={saving} className="btn-primary">
                  {saving ? "Publishing..." : currentStatus === "published" ? "Update" : "Publish"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
