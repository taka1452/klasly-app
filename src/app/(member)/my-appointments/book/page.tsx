"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { csrfFetch } from "@/lib/api/csrf-client";

type Instructor = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  specialties: string | null;
};

type AppointmentType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  buffer_minutes: number;
  is_active: boolean;
};

type TimeSlot = {
  start_time: string;
  end_time: string;
};

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Generate next N calendar dates starting from today */
function getNextDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export default function BookAppointmentPage() {
  const { isEnabled } = useFeature();
  const enabled = isEnabled(FEATURE_KEYS.APPOINTMENTS);
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1: Instructors
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [selectedInstructor, setSelectedInstructor] =
    useState<Instructor | null>(null);

  // Step 2: Appointment Types
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(
    null
  );

  // Step 3: Date + Time
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Step 4: Booking
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const dates = getNextDates(14);

  // Fetch instructors on mount
  useEffect(() => {
    if (!enabled) {
      setLoadingInstructors(false);
      return;
    }
    fetch("/api/appointments/instructors")
      .then((res) => res.json())
      .then((data) => setInstructors(data.instructors ?? []))
      .catch(() => setInstructors([]))
      .finally(() => setLoadingInstructors(false));
  }, [enabled]);

  // Fetch types when instructor is selected
  useEffect(() => {
    if (!selectedInstructor) return;
    setLoadingTypes(true);
    // Fetch all active types from the studio (member-accessible via appointments list endpoint)
    fetch("/api/appointments/types/member")
      .then((res) => res.json())
      .then((data) => {
        const active = (data.types ?? data ?? []).filter(
          (t: AppointmentType) => t.is_active
        );
        setTypes(active);
      })
      .catch(() => setTypes([]))
      .finally(() => setLoadingTypes(false));
  }, [selectedInstructor]);

  // Fetch slots when date is selected
  useEffect(() => {
    if (!selectedInstructor || !selectedType || !selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    const params = new URLSearchParams({
      instructor_id: selectedInstructor.id,
      date: selectedDate,
      appointment_type_id: selectedType.id,
    });
    fetch(`/api/appointments/available-slots?${params}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedInstructor, selectedType, selectedDate]);

  async function handleBook() {
    if (!selectedInstructor || !selectedType || !selectedDate || !selectedSlot)
      return;
    setBooking(true);
    setBookingError(null);
    try {
      const res = await csrfFetch("/api/appointments/book", {
        method: "POST",
        body: JSON.stringify({
          instructor_id: selectedInstructor.id,
          appointment_type_id: selectedType.id,
          date: selectedDate,
          start_time: selectedSlot.start_time,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setBookingError(
          data.error || "Failed to book appointment. Please try again."
        );
        return;
      }
      router.push("/my-appointments?booked=1");
    } catch {
      setBookingError("Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (!enabled) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          The appointments feature is not enabled for this studio.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/my-appointments"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to Appointments
      </Link>

      <h1 className="mt-4 text-xl font-bold text-gray-900 md:text-2xl">
        Book an Appointment
      </h1>

      {/* Step indicator */}
      <div className="mt-4 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                step === s
                  ? "bg-brand-600 text-white"
                  : step > s
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {step > s ? "\u2713" : s}
            </div>
            {s < 4 && (
              <div
                className={`h-0.5 w-6 ${
                  step > s ? "bg-green-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Instructor */}
      {step === 1 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Step 1: Select Instructor
          </h2>
          {loadingInstructors && (
            <p className="text-sm text-gray-500">Loading instructors...</p>
          )}
          {!loadingInstructors && instructors.length === 0 && (
            <div className="card">
              <p className="text-sm text-gray-500">
                No instructors with appointment availability found.
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {instructors.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => {
                  setSelectedInstructor(inst);
                  setSelectedType(null);
                  setSelectedDate(null);
                  setSelectedSlot(null);
                  setStep(2);
                }}
                className={`card text-left transition hover:ring-2 hover:ring-brand-300 ${
                  selectedInstructor?.id === inst.id
                    ? "ring-2 ring-brand-500"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {inst.avatar_url ? (
                    <img
                      src={inst.avatar_url}
                      alt={inst.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold">
                      {inst.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{inst.name}</p>
                    {inst.specialties && (
                      <p className="text-xs text-gray-500">
                        {inst.specialties}
                      </p>
                    )}
                  </div>
                </div>
                {inst.bio && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {inst.bio}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Service Type */}
      {step === 2 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Step 2: Select Service
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Booking with{" "}
            <span className="font-medium text-gray-700">
              {selectedInstructor?.name}
            </span>
          </p>
          {loadingTypes && (
            <p className="text-sm text-gray-500">Loading services...</p>
          )}
          {!loadingTypes && types.length === 0 && (
            <div className="card">
              <p className="text-sm text-gray-500">
                No appointment types available.
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedType(t);
                  setSelectedDate(null);
                  setSelectedSlot(null);
                  setStep(3);
                }}
                className={`card text-left transition hover:ring-2 hover:ring-brand-300 ${
                  selectedType?.id === t.id ? "ring-2 ring-brand-500" : ""
                }`}
              >
                <p className="font-medium text-gray-900">{t.name}</p>
                {t.description && (
                  <p className="mt-1 text-sm text-gray-600">{t.description}</p>
                )}
                <div className="mt-2 flex gap-3 text-xs text-gray-500">
                  <span>{t.duration_minutes} min</span>
                  <span>{formatPrice(t.price_cents)}</span>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn-secondary mt-4"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* Step 3: Select Date + Time */}
      {step === 3 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Step 3: Select Date &amp; Time
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            {selectedType?.name} with{" "}
            <span className="font-medium text-gray-700">
              {selectedInstructor?.name}
            </span>
          </p>

          {/* Date picker: next 14 days */}
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-gray-700">
              Select a date
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {dates.map((d) => {
                const dateObj = new Date(d + "T00:00:00");
                const dayName = dateObj.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const dayNum = dateObj.getDate();
                const isSelected = selectedDate === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedSlot(null);
                    }}
                    className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm transition ${
                      isSelected
                        ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xs">{dayName}</span>
                    <span className="text-base font-medium">{dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                Available times for {formatDate(selectedDate)}
              </p>
              {loadingSlots && (
                <p className="text-sm text-gray-500">Loading time slots...</p>
              )}
              {!loadingSlots && slots.length === 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">
                    No available slots for this date. Try another date.
                  </p>
                </div>
              )}
              {!loadingSlots && slots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const isSelected =
                      selectedSlot?.start_time === slot.start_time;
                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep(4);
                        }}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                          isSelected
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50"
                        }`}
                      >
                        {formatTime(slot.start_time)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-secondary mt-4"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* Step 4: Confirm & Book */}
      {step === 4 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Step 4: Confirm Booking
          </h2>

          <div className="card">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Instructor</span>
                <span className="font-medium text-gray-900">
                  {selectedInstructor?.name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span className="font-medium text-gray-900">
                  {selectedType?.name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium text-gray-900">
                  {selectedType?.duration_minutes} minutes
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-medium text-gray-900">
                  {selectedDate && formatDate(selectedDate)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time</span>
                <span className="font-medium text-gray-900">
                  {selectedSlot &&
                    `${formatTime(selectedSlot.start_time)} \u2013 ${formatTime(selectedSlot.end_time)}`}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Price</span>
                  <span className="text-base font-semibold text-gray-900">
                    {selectedType && formatPrice(selectedType.price_cents)}
                  </span>
                </div>
              </div>
            </div>

            {bookingError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                {bookingError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-secondary"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={handleBook}
                disabled={booking}
                className="btn-primary flex-1"
              >
                {booking ? "Booking..." : "Book Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
