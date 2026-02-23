"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NewMemberPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [planType, setPlanType] = useState("drop_in");
  const [credits, setCredits] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    // 現在のユーザーの studio_id を取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user!.id)
      .single();

    if (!ownerProfile?.studio_id) {
      setError("Studio not found.");
      setLoading(false);
      return;
    }

    // 1. API Route で会員の Auth ユーザーを作成
    const res = await fetch("/api/members/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        planType,
        credits: planType === "monthly" ? -1 : credits,
        studioId: ownerProfile.studio_id,
      }),
    });

    const result = await res.json();

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
      <div className="mb-6">
        <Link
          href="/members"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to members
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Add new member
        </h1>
      </div>

      <div className="card max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
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
              Phone (optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Plan type *
            </label>
            <select
              value={planType}
              onChange={(e) => {
                setPlanType(e.target.value);
                if (e.target.value === "monthly") setCredits(-1);
                else setCredits(0);
              }}
              className="input-field mt-1"
            >
              <option value="drop_in">Drop-in</option>
              <option value="pack">Class Pack</option>
              <option value="monthly">Monthly (Unlimited)</option>
            </select>
          </div>

          {planType === "pack" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Number of credits *
              </label>
              <input
                type="number"
                value={credits}
                onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
                min={1}
                placeholder="10"
                required
                className="input-field mt-1"
              />
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
