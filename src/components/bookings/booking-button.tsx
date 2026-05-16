"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PassInfo = {
  hasPass: boolean;
  hasCapacity: boolean;
  classesUsed: number;
  maxClasses: number | null;
};

type Props = {
  sessionId: string;
  capacity: number;
  memberId: string | null;
  existingBooking: { id: string; status: string } | null;
  memberCredits: number;
  confirmedCount: number;
  canBook?: boolean;
  /** クレジット不要モード: false の場合クレジット0でも予約ボタンを表示 */
  requiresCredits?: boolean;
  /** instructor_direct モードの場合 true → "Book & Pay" フローを使用 */
  payPerClass?: boolean;
  /** payPerClass 時に表示する料金（cents） */
  classPrice?: number;
  /** Active pass information */
  passInfo?: PassInfo;
  /** For hybrid classes, require the member to choose attendance method */
  classType?: "in_person" | "online" | "hybrid";
  /** Called after a successful booking action (instead of router.refresh) */
  onSuccess?: () => void;
  "data-tour"?: string;
};

export default function BookingButton({
  sessionId,
  capacity,
  memberId,
  existingBooking,
  memberCredits,
  confirmedCount,
  canBook = true,
  requiresCredits = true,
  payPerClass = false,
  classPrice,
  passInfo,
  classType,
  onSuccess,
  "data-tour": dataTour,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isHybrid = classType === "hybrid";
  const [attendanceMethod, setAttendanceMethod] = useState<"in_person" | "online">("in_person");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sliding-scale / "Pay What You Can": the checkout API tells us when the
  // class is sliding scale on the first POST (returns 422 with min/suggested).
  // We then surface an amount picker right under the button and the user
  // submits a second request with `customAmount`.
  const [slidingScale, setSlidingScale] = useState<
    | {
        minCents: number;
        suggestedCents: number;
        currency: string;
        amountDollars: string;
      }
    | null
  >(null);

  // Optional attendee-entered discount code (Have a code? expander).
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");

  // Sign-waiver modal (T2-1). When the API returns WAIVERS_REQUIRED with
  // a list of missing template ids, we fetch their content and let the
  // member sign in-place. After all are signed, we retry the booking.
  const [waiverModal, setWaiverModal] = useState<
    | {
        templates: { id: string; title: string; content: string }[];
        currentIdx: number;
        typedName: string;
        agreed: boolean;
        signedIds: Set<string>;
        retryAction: "book" | "rebook";
        retryUsePass: boolean;
        submitting: boolean;
      }
    | null
  >(null);

  async function openWaiverModal(
    missingIds: string[],
    action: "book" | "rebook",
    usePass: boolean
  ) {
    try {
      const res = await fetch(
        `/api/waiver-templates?ids=${encodeURIComponent(missingIds.join(","))}`
      );
      if (!res.ok) {
        setError(
          "Required waivers not available — open Settings → Waivers to sign manually."
        );
        return;
      }
      const data = (await res.json()) as { id: string; title: string; content: string }[];
      if (!data?.length) {
        setError("Required waivers not available.");
        return;
      }
      // Preserve the ordering of missingIds so the modal walks through
      // them in the order the API returned them as required.
      const map = new Map(data.map((t) => [t.id, t]));
      const ordered = missingIds
        .map((id) => map.get(id))
        .filter((t): t is { id: string; title: string; content: string } => !!t);
      setWaiverModal({
        templates: ordered,
        currentIdx: 0,
        typedName: "",
        agreed: false,
        signedIds: new Set(),
        retryAction: action,
        retryUsePass: usePass,
        submitting: false,
      });
    } catch {
      setError("Failed to load waivers");
    }
  }

  async function submitWaiverSignature() {
    if (!waiverModal || !memberId) return;
    const tmpl = waiverModal.templates[waiverModal.currentIdx];
    if (!tmpl) return;
    if (!waiverModal.typedName.trim() || !waiverModal.agreed) return;

    setWaiverModal({ ...waiverModal, submitting: true });
    try {
      const res = await fetch("/api/waiver/sign-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          signedName: waiverModal.typedName.trim(),
          templateId: tmpl.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to sign waiver");
        setWaiverModal({ ...waiverModal, submitting: false });
        return;
      }

      // Mark signed, advance to next or retry the booking.
      const newSigned = new Set(waiverModal.signedIds);
      newSigned.add(tmpl.id);
      const nextIdx = waiverModal.currentIdx + 1;
      if (nextIdx < waiverModal.templates.length) {
        setWaiverModal({
          ...waiverModal,
          currentIdx: nextIdx,
          typedName: "",
          agreed: false,
          signedIds: newSigned,
          submitting: false,
        });
      } else {
        // All signed — retry the booking that triggered the modal.
        const action = waiverModal.retryAction;
        const usePass = waiverModal.retryUsePass;
        setWaiverModal(null);
        handleBook(action, usePass);
      }
    } catch {
      setError("Failed to sign waiver");
      setWaiverModal((prev) => (prev ? { ...prev, submitting: false } : prev));
    }
  }

  const isFull = confirmedCount >= capacity;
  const showWaitlist = isFull;
  // Pass holders can always book (no credit check needed)
  const hasActivePass = passInfo?.hasPass && passInfo?.hasCapacity;
  const passLimitReached = passInfo?.hasPass && !passInfo?.hasCapacity;
  // クレジット必須モードのときのみ 0 クレジットをブロック
  // payPerClass モードではクレジットチェックを無効化（決済で代替）
  // Pass holders bypass credit check
  const hasNoCredits = !hasActivePass && !payPerClass && requiresCredits && memberCredits === 0;

  const tourProps = dataTour ? { "data-tour": dataTour } : {};

  if (!memberId) {
    return (
      <span className="text-sm text-gray-500" {...tourProps}>
        Member access required
      </span>
    );
  }

  if (!canBook) {
    return (
      <span className="text-sm text-amber-600" {...tourProps}>
        Bookings are temporarily unavailable
      </span>
    );
  }

  async function handlePayAndBook(customAmountCents?: number) {
    if (!memberId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/class-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          memberId,
          ...(typeof customAmountCents === "number"
            ? { customAmount: customAmountCents }
            : {}),
          ...(discountCode.trim() ? { discountCode: discountCode.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (res.status === 422 && data?.code === "SLIDING_SCALE_AMOUNT_REQUIRED") {
        // First-time entry into the sliding-scale flow — show the picker
        // pre-filled at the suggested price.
        setSlidingScale({
          minCents: data.min_cents ?? 0,
          suggestedCents: data.suggested_cents ?? 0,
          currency: (data.currency as string) || "usd",
          amountDollars: ((data.suggested_cents ?? 0) / 100).toFixed(2),
        });
        return;
      }

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function submitSlidingScale() {
    if (!slidingScale) return;
    const parsed = parseFloat(slidingScale.amountDollars);
    if (!Number.isFinite(parsed)) {
      setError("Please enter a valid amount.");
      return;
    }
    const cents = Math.round(parsed * 100);
    if (cents < slidingScale.minCents) {
      setError(
        `Amount must be at least $${(slidingScale.minCents / 100).toFixed(2)}.`
      );
      return;
    }
    setError("");
    handlePayAndBook(cents);
  }

  async function handleBook(
    action: "book" | "rebook" | "cancel" | "leave_waitlist",
    usePass = false
  ) {
    const status = showWaitlist ? "waitlist" : "confirmed";
    if (
      !usePass &&
      requiresCredits &&
      (action === "book" || action === "rebook") &&
      status === "confirmed" &&
      memberCredits >= 0 &&
      memberCredits < 1
    ) {
      setError("No credits remaining. Please purchase a plan.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sessionId,
          memberId,
          usePass,
          ...(isHybrid && (action === "book" || action === "rebook") ? { attendanceMethod } : {}),
        }),
      });
      const data = await res.json();

      if (
        !res.ok &&
        data?.code === "WAIVERS_REQUIRED" &&
        Array.isArray(data.missing_waiver_template_ids) &&
        (action === "book" || action === "rebook")
      ) {
        await openWaiverModal(
          data.missing_waiver_template_ids,
          action,
          usePass
        );
        return;
      }

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (existingBooking) {
    if (existingBooking.status === "cancelled") {
      // Pass holder can rebook with pass
      if (hasActivePass) {
        return (
          <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
            {error && <p className="text-xs text-red-600 text-right">{error}</p>}
            {isHybrid && (
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
                  <input type="radio" name={`attendance-${sessionId}`} checked={attendanceMethod === "in_person"} onChange={() => setAttendanceMethod("in_person")} className="accent-brand-600" />
                  In-person
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
                  <input type="radio" name={`attendance-${sessionId}`} checked={attendanceMethod === "online"} onChange={() => setAttendanceMethod("online")} className="accent-brand-600" />
                  Online
                </label>
              </div>
            )}
            <button
              type="button"
              onClick={() => handleBook("rebook", true)}
              disabled={loading}
              className="btn-primary text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
            >
              {loading ? "…" : "Re-book with Pass"}
            </button>
          </div>
        );
      }
      if (hasNoCredits) {
        return (
          <div className="flex w-full flex-col items-end gap-2 text-right sm:w-auto" {...tourProps}>
            <span className="text-sm text-amber-600">
              No credits remaining. Please purchase a plan to book classes.
            </span>
            <Link
              href="/purchase"
              className="text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
            >
              Purchase
            </Link>
          </div>
        );
      }
      return (
        <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
          {error && <p className="text-xs text-red-600 text-right">{error}</p>}
          {isHybrid && (
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
                <input type="radio" name={`attendance-${sessionId}`} checked={attendanceMethod === "in_person"} onChange={() => setAttendanceMethod("in_person")} className="accent-brand-600" />
                In-person
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
                <input type="radio" name={`attendance-${sessionId}`} checked={attendanceMethod === "online"} onChange={() => setAttendanceMethod("online")} className="accent-brand-600" />
                Online
              </label>
            </div>
          )}
          <button
            type="button"
            onClick={() => handleBook("rebook")}
            disabled={loading}
            className="btn-primary text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
          >
            {loading ? "…" : "Re-book"}
          </button>
        </div>
      );
    }
    if (existingBooking.status === "waitlist") {
      return (
        <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
          {error && <p className="text-xs text-red-600 text-right">{error}</p>}
          <button
            type="button"
            onClick={() => handleBook("leave_waitlist")}
            disabled={loading}
            className="btn-secondary text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
          >
            {loading ? "…" : "Leave waitlist"}
          </button>
        </div>
      );
    }
    return (
      <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        {confirmCancel ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Cancel booking?</span>
            <button
              type="button"
              onClick={() => {
                setConfirmCancel(false);
                handleBook("cancel");
              }}
              disabled={loading}
              className="text-sm font-medium text-red-600 transition-colors duration-150 hover:text-red-700"
            >
              {loading ? "…" : "Yes, Cancel"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              disabled={loading}
              className="text-sm text-gray-500 transition-colors duration-150 hover:text-gray-700"
            >
              Keep
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-600">Booked ✓</span>
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={loading}
              className="text-sm text-gray-500 underline transition-colors duration-150 hover:text-red-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // Pass holder with capacity: show "Book with Pass" button
  if (hasActivePass && !showWaitlist) {
    return (
      <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        {isHybrid && (
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
              <input type="radio" name={`attendance-${sessionId}`} checked={attendanceMethod === "in_person"} onChange={() => setAttendanceMethod("in_person")} className="accent-brand-600" />
              In-person
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
              <input type="radio" name={`attendance-${sessionId}`} checked={attendanceMethod === "online"} onChange={() => setAttendanceMethod("online")} className="accent-brand-600" />
              Online
            </label>
          </div>
        )}
        <button
          type="button"
          onClick={() => handleBook("book", true)}
          disabled={loading}
          className="btn-primary text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
        >
          {loading ? "…" : "Book with Pass"}
        </button>
        <span className="text-xs text-gray-400">No payment required</span>
      </div>
    );
  }

  // Pass limit reached: show message + fallback to regular booking
  if (passLimitReached && !showWaitlist) {
    return (
      <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        <span className="text-xs text-amber-600">Pass limit reached</span>
        {hasNoCredits ? (
          <Link
            href="/purchase"
            className="text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            Purchase credits
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => handleBook("book")}
            disabled={loading}
            className="btn-primary text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
          >
            {loading ? "…" : "Book"}
          </button>
        )}
      </div>
    );
  }

  if (!existingBooking && hasNoCredits && !showWaitlist) {
    return (
      <div className="flex w-full flex-col items-end gap-2 text-right sm:w-auto" {...tourProps}>
        <span className="text-sm text-amber-600">
          No credits remaining. Please purchase a plan to book classes.
        </span>
        <Link
          href="/purchase"
          className="text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          Purchase
        </Link>
      </div>
    );
  }

  // Pay-per-class mode: show "Book & Pay" when member has no credits
  if (payPerClass && !existingBooking && memberCredits === 0 && !showWaitlist) {
    const priceLabel = classPrice ? `$${(classPrice / 100).toFixed(2)}` : "";

    if (slidingScale) {
      const minLabel = `$${(slidingScale.minCents / 100).toFixed(2)}`;
      const sugLabel = `$${(slidingScale.suggestedCents / 100).toFixed(2)}`;
      return (
        <div
          className="flex w-full flex-col items-end gap-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3 sm:w-auto"
          {...tourProps}
        >
          <div className="w-full">
            <p className="text-xs font-medium text-gray-700">
              Pay What You Can
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Minimum {minLabel} · Suggested {sugLabel}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                min={slidingScale.minCents / 100}
                step="0.01"
                value={slidingScale.amountDollars}
                onChange={(e) =>
                  setSlidingScale((prev) =>
                    prev ? { ...prev, amountDollars: e.target.value } : prev
                  )
                }
                className="input-field w-24 text-sm"
                autoFocus
              />
            </div>
            {error && (
              <p className="mt-1 text-xs text-red-600">{error}</p>
            )}
          </div>
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSlidingScale(null);
                setError("");
              }}
              disabled={loading}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitSlidingScale}
              disabled={loading}
              className="btn-primary text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
            >
              {loading ? "…" : "Continue"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        {discountOpen ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="Code"
              className="input-field h-7 w-28 text-xs uppercase"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setDiscountOpen(false);
                setDiscountCode("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDiscountOpen(true)}
            className="text-xs text-gray-500 underline-offset-2 hover:text-brand-600 hover:underline"
          >
            Have a code?
          </button>
        )}
        <button
          type="button"
          onClick={() => handlePayAndBook()}
          disabled={loading}
          className="btn-primary text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
        >
          {loading ? "…" : `Book & Pay${priceLabel ? ` ${priceLabel}` : ""}`}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col items-end gap-1 sm:w-auto" {...tourProps}>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        {isHybrid && (
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
              <input
                type="radio"
                name={`attendance-${sessionId}`}
                checked={attendanceMethod === "in_person"}
                onChange={() => setAttendanceMethod("in_person")}
                className="accent-brand-600"
              />
              In-person
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-150 hover:bg-gray-100">
              <input
                type="radio"
                name={`attendance-${sessionId}`}
                checked={attendanceMethod === "online"}
                onChange={() => setAttendanceMethod("online")}
                className="accent-brand-600"
              />
              Online
            </label>
          </div>
        )}
        <button
          type="button"
          onClick={() => handleBook("book")}
          disabled={loading}
          className={`text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100 ${showWaitlist ? "btn-secondary" : "btn-primary"}`}
        >
          {loading ? "…" : showWaitlist ? "Waitlist" : "Book"}
        </button>
      </div>
      {/* T2-1: Sign-waiver modal. Body-portaled so it overlays the page
          regardless of which return path renders the button. */}
      {mounted && waiverModal && (() => {
        const cur = waiverModal.templates[waiverModal.currentIdx];
        if (!cur) return null;
        return createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="border-b border-gray-200 px-5 py-3">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Sign waiver {waiverModal.currentIdx + 1} of{" "}
                  {waiverModal.templates.length}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">
                  {cur.title}
                </h2>
              </div>
              <div
                className="prose prose-sm max-w-none overflow-y-auto px-5 py-4"
                style={{ maxHeight: "50vh" }}
                dangerouslySetInnerHTML={{ __html: cur.content }}
              />
              <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={waiverModal.agreed}
                    onChange={(e) =>
                      setWaiverModal((prev) =>
                        prev ? { ...prev, agreed: e.target.checked } : prev
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <span>
                    I have read and agree to the terms of this waiver. By
                    typing my name below, I am providing my legal electronic
                    signature.
                  </span>
                </label>
                <input
                  type="text"
                  value={waiverModal.typedName}
                  onChange={(e) =>
                    setWaiverModal((prev) =>
                      prev ? { ...prev, typedName: e.target.value } : prev
                    )
                  }
                  placeholder="Type your full legal name"
                  className="input-field w-full"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setWaiverModal(null)}
                    disabled={waiverModal.submitting}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitWaiverSignature}
                    disabled={
                      waiverModal.submitting ||
                      !waiverModal.typedName.trim() ||
                      !waiverModal.agreed
                    }
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {waiverModal.submitting
                      ? "Signing…"
                      : waiverModal.currentIdx + 1 < waiverModal.templates.length
                        ? "Sign and continue"
                        : "Sign and book"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </>
  );
}
