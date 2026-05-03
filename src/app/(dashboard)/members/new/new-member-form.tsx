"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePlanAccess } from "@/components/ui/plan-access-provider";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import HelpTip from "@/components/ui/help-tip";
import HoneypotField from "@/components/ui/honeypot-field";
import ErrorAlert from "@/components/ui/error-alert";

export default function NewMemberForm() {
  const router = useRouter();
  const planAccess = usePlanAccess();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Jamie feedback 2026-04-30: removed the Plan Type picker from the Add
  // Member form — most studios end up with members on multiple plan types,
  // so this initial pick was misleading. New members default to a drop-in
  // plan with zero credits; admins can change it from the member detail
  // page once a real plan is purchased.
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"" | "female" | "male" | "prefer_not_to_say">("");
  const [address, setAddress] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleDateOfBirthChange(value: string) {
    setDateOfBirth(value);
    if (value) {
      const birth = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      setIsMinor(age < 18);
    }
  }

  if (planAccess && !planAccess.canCreate) {
    return (
      <div className="card max-w-xl">
        <p className="text-gray-600">
          Your plan doesn&apos;t allow this action. Please update your payment
          to add new members.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Go to Billing →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Honeypot check — bots fill hidden fields
    const honeypot = (e.target as HTMLFormElement).querySelector<HTMLInputElement>("#website");
    if (honeypot?.value) return;

    setLoading(true);

    // API Route で会員を作成（studio_id はサーバー側で取得）
    const res = await fetch("/api/members/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        // New members always start on drop-in / 0 credits; the admin (or
        // member) upgrades from their detail page once a plan is purchased.
        planType: "drop_in",
        credits: 0,
        dateOfBirth,
        gender,
        address: address.trim() || null,
        referredBy: referredBy.trim() || null,
        isMinor,
        guardianEmail: isMinor ? guardianEmail : null,
      }),
    });

    let result: { error?: string };
    try {
      result = await res.json();
    } catch {
      setError("Failed to create member. Please try again.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(result.error || "Failed to create member.");
      setLoading(false);
      return;
    }

    router.push("/members");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/members"
          className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">
            &larr;
          </span>
          Members
        </Link>
      </div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Add new member
          </h1>
          <FlowHintPanel flowType="members" />
          <FlowHintPanel flowType="member-invite" buttonLabel="Where to send invite?" />
        </div>
      </div>

      <div className="card max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <HoneypotField />
          {error && (
            <ErrorAlert error={error} onDismiss={() => setError("")} />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              className="input-field mt-1"
            />
            <p className="mt-1 text-xs text-gray-400">
              An invitation email will be sent to this address.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              required
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Date of Birth *
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => handleDateOfBirthChange(e.target.value)}
              required
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Gender *
            </label>
            <select
              value={gender}
              onChange={(e) =>
                setGender(e.target.value as "" | "female" | "male" | "prefer_not_to_say")
              }
              required
              className="input-field mt-1"
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Address (optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, ZIP"
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Referred by (optional)
            </label>
            <input
              type="text"
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
              placeholder="A friend, Instagram, walk-in, etc."
              className="input-field mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Where the member heard about your studio.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isMinor"
              checked={isMinor}
              onChange={(e) => setIsMinor(e.target.checked)}
              className="h-4 w-4 accent-gray-900"
            />
            <label htmlFor="isMinor" className="text-sm font-medium text-gray-700">
              This member is a minor
              <HelpTip
                text="Minor members require a guardian's email. The waiver will be sent to the guardian instead."
                helpSlug="minor-waivers"
              />
            </label>
          </div>

          {isMinor && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Guardian Email *
              </label>
              <input
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                placeholder="parent@example.com"
                required
                className="input-field mt-1"
              />
              <p className="mt-1 text-xs text-gray-400">
                The guardian will receive a waiver signing request at this email.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Adding..." : "Add member"}
            </button>
            <Link href="/members" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
