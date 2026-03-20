"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type EventOption = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number;
  remaining: number;
};

type AppFieldDef = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

type EventData = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location_name: string | null;
  payment_type: "full" | "installment";
  installment_count: number;
  cancellation_policy_text: string | null;
  application_fields: AppFieldDef[] | null;
  options: EventOption[];
};

export default function EventCheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = params.id as string;
  const preselectedOption = searchParams.get("option");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [user, setUser] = useState<{ name: string; email: string; phone: string } | null>(null);

  // Form state
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"full" | "installment">("full");
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [appResponses, setAppResponses] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      // Fetch event
      const res = await fetch(`/api/events/${eventId}/checkout-data`);
      if (!res.ok) {
        setError("Event not found");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEvent(data);

      if (preselectedOption) {
        setSelectedOption(preselectedOption);
      }

      // If logged in, pre-fill info
      if (authUser) {
        const meta = authUser.user_metadata ?? {};
        setGuestName(meta.full_name || meta.name || "");
        setGuestEmail(authUser.email || "");
        setGuestPhone(meta.phone || "");
        setUser({
          name: meta.full_name || meta.name || "",
          email: authUser.email || "",
          phone: meta.phone || "",
        });
      }

      setLoading(false);
    }
    load();
  }, [eventId, preselectedOption]);

  const selectedOpt = event?.options.find((o) => o.id === selectedOption);
  const totalCents = selectedOpt?.price_cents ?? 0;
  const totalDisplay = `$${(totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const installmentCount = event?.installment_count || 3;
  const baseInstallment = Math.floor(totalCents / installmentCount);
  const firstInstallment = baseInstallment + (totalCents - baseInstallment * installmentCount);

  function getInstallmentDates() {
    const dates: string[] = [];
    for (let i = 0; i < installmentCount; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i * 30);
      dates.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    }
    return dates;
  }

  const hasAppFields = (event?.application_fields ?? []).length > 0;
  const stepLabels = hasAppFields
    ? ["Select Option", "Your Info", "Application", "Payment"]
    : ["Select Option", "Your Info", "Payment"];
  const paymentStep = hasAppFields ? 4 : 3;
  const appStep = hasAppFields ? 3 : -1;

  const canProceedStep1 = !!selectedOption && selectedOpt && selectedOpt.remaining > 0;
  const canProceedStep2 = guestName.trim() !== "" && guestEmail.trim() !== "";

  function validateAppFields(): boolean {
    if (!hasAppFields || !event?.application_fields) return true;
    for (const field of event.application_fields) {
      if (field.required) {
        const val = appResponses[field.id];
        if (val === undefined || val === "" || val === false) return false;
      }
    }
    return true;
  }

  const canProceedApp = validateAppFields();
  const canSubmit = agreedToPolicy || !event?.cancellation_policy_text;

  async function handleSubmit() {
    if (!event || !selectedOpt) return;

    // Validate required application fields
    if (!validateAppFields()) {
      setError("Please fill in all required application fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/events/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          event_option_id: selectedOption,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone || null,
          payment_choice:
            event.payment_type === "installment" ? paymentChoice : "full",
          ...(hasAppFields ? { application_responses: appResponses } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed");
        setSubmitting(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!event) return null;

  const totalSteps = event.cancellation_policy_text ? 3 : 2;
  // Step 1: Option + Info, Step 2: Payment, Step 3: Policy (if exists)
  // Simplified: Step 1=Option, Step 2=Info, Step 3=Payment+Policy

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <button
        onClick={() => router.push(`/events/${eventId}`)}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to event
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Book: {event.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {event.start_date} – {event.end_date}
        {event.location_name && ` · ${event.location_name}`}
      </p>

      {/* Step indicators */}
      <div className="mt-6 mb-8 flex gap-2">
        {stepLabels.map((label, i) => (
          <button
            key={label}
            onClick={() => {
              if (i + 1 < step) setStep(i + 1);
            }}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition ${
              step === i + 1
                ? "bg-blue-600 text-white"
                : step > i + 1
                  ? "bg-blue-100 text-blue-700 cursor-pointer"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* STEP 1: Select Option */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Choose your option</h2>
          {event.options.map((opt) => {
            const isSoldOut = opt.remaining <= 0;
            return (
              <label
                key={opt.id}
                className={`block cursor-pointer rounded-xl border-2 p-5 transition ${
                  selectedOption === opt.id
                    ? "border-blue-500 bg-blue-50"
                    : isSoldOut
                      ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="option"
                      value={opt.id}
                      checked={selectedOption === opt.id}
                      onChange={() => !isSoldOut && setSelectedOption(opt.id)}
                      disabled={isSoldOut}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{opt.name}</p>
                      {opt.description && (
                        <p className="mt-1 text-sm text-gray-500">{opt.description}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {isSoldOut ? (
                          <span className="text-red-600 font-medium">Sold Out</span>
                        ) : (
                          `${opt.remaining} spot${opt.remaining !== 1 ? "s" : ""} remaining`
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      ${(opt.price_cents / 100).toLocaleString()}
                    </p>
                    {event.payment_type === "installment" && (
                      <p className="text-xs text-gray-500">
                        or {installmentCount} x ${Math.floor(opt.price_cents / 100 / installmentCount).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
          <div className="flex justify-end pt-4">
            <button
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Guest Info */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Information</h2>
          {user && (
            <p className="text-sm text-gray-500">
              Pre-filled from your account. You can edit if needed.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              disabled={!canProceedStep2}
              onClick={() => setStep(hasAppFields ? appStep : paymentStep)}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* STEP: Application Form */}
      {step === appStep && hasAppFields && event.application_fields && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Application Form</h2>
          <p className="text-sm text-gray-500">Please answer the following questions.</p>
          {event.application_fields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              {field.type === "text" && (
                <input
                  type="text"
                  value={(appResponses[field.id] as string) || ""}
                  onChange={(e) => setAppResponses((r) => ({ ...r, [field.id]: e.target.value }))}
                  placeholder={field.placeholder || ""}
                  className="input-field mt-1"
                />
              )}
              {field.type === "textarea" && (
                <textarea
                  value={(appResponses[field.id] as string) || ""}
                  onChange={(e) => setAppResponses((r) => ({ ...r, [field.id]: e.target.value }))}
                  placeholder={field.placeholder || ""}
                  rows={3}
                  className="input-field mt-1"
                />
              )}
              {field.type === "select" && (
                <select
                  value={(appResponses[field.id] as string) || ""}
                  onChange={(e) => setAppResponses((r) => ({ ...r, [field.id]: e.target.value }))}
                  className="input-field mt-1"
                >
                  <option value="">Select...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {field.type === "radio" && (
                <div className="mt-1 space-y-1">
                  {(field.options || []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name={field.id}
                        value={opt}
                        checked={appResponses[field.id] === opt}
                        onChange={() => setAppResponses((r) => ({ ...r, [field.id]: opt }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {field.type === "checkbox" && (
                <label className="mt-1 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!appResponses[field.id]}
                    onChange={(e) => setAppResponses((r) => ({ ...r, [field.id]: e.target.checked }))}
                    className="rounded"
                  />
                  Yes
                </label>
              )}
            </div>
          ))}
          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              disabled={!canProceedApp}
              onClick={() => setStep(paymentStep)}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* STEP: Payment */}
      {step === paymentStep && selectedOpt && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Payment</h2>

          {/* Order Summary */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Order Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{selectedOpt.name}</span>
              <span className="font-semibold text-gray-900">{totalDisplay}</span>
            </div>
          </div>

          {/* Payment choice for installment events */}
          {event.payment_type === "installment" && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Payment Method</h3>
              <label
                className={`block cursor-pointer rounded-xl border-2 p-4 transition ${
                  paymentChoice === "full"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="full"
                    checked={paymentChoice === "full"}
                    onChange={() => setPaymentChoice("full")}
                  />
                  <div>
                    <p className="font-medium text-gray-900">Pay in full</p>
                    <p className="text-sm text-gray-500">{totalDisplay}</p>
                  </div>
                </div>
              </label>
              <label
                className={`block cursor-pointer rounded-xl border-2 p-4 transition ${
                  paymentChoice === "installment"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="installment"
                    checked={paymentChoice === "installment"}
                    onChange={() => setPaymentChoice("installment")}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">
                      {installmentCount} installments
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-gray-500">
                      {getInstallmentDates().map((date, i) => {
                        const amt =
                          i === 0 ? firstInstallment : baseInstallment;
                        return (
                          <p key={i}>
                            ${(amt / 100).toFixed(2)} on {date}
                            {i === 0 && " (today)"}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Cancellation Policy */}
          {event.cancellation_policy_text && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-medium text-amber-800 mb-2">
                Cancellation Policy
              </h3>
              <p className="whitespace-pre-wrap text-sm text-amber-700 leading-relaxed">
                {event.cancellation_policy_text}
              </p>
              <label className="mt-4 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToPolicy}
                  onChange={(e) => setAgreedToPolicy(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-amber-900">
                  I agree to the cancellation policy
                </span>
              </label>
            </div>
          )}

          {/* Pay button */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(hasAppFields ? appStep : 2)}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Processing..."
                : paymentChoice === "installment" && event.payment_type === "installment"
                  ? `Pay $${(firstInstallment / 100).toFixed(2)} today`
                  : `Pay ${totalDisplay}`}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            You will be redirected to Stripe to complete your payment securely.
          </p>
        </div>
      )}
    </div>
  );
}
