"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  memberId: string;
  profileId: string;
  initialData: {
    fullName: string;
    phone: string;
    planType: string;
    credits: number;
    status: string;
    notes: string;
  };
};

export default function MemberEditForm({
  memberId,
  profileId,
  initialData,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialData.fullName);
  const [phone, setPhone] = useState(initialData.phone);
  const [planType, setPlanType] = useState(initialData.planType);
  const [credits, setCredits] = useState(initialData.credits);
  const [status, setStatus] = useState(initialData.status);
  const [notes, setNotes] = useState(initialData.notes);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);

    const supabase = createClient();

    // profiles テーブルを更新
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
      })
      .eq("id", profileId);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // members テーブルを更新
    const { error: memberError } = await supabase
      .from("members")
      .update({
        plan_type: planType,
        credits: planType === "monthly" ? -1 : credits,
        status,
        notes: notes || null,
      })
      .eq("id", memberId);

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900">Edit member</h2>

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

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field mt-1"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Plan type
            </label>
            <select
              value={planType}
              onChange={(e) => {
                setPlanType(e.target.value);
                if (e.target.value === "monthly") setCredits(-1);
              }}
              className="input-field mt-1"
            >
              <option value="drop_in">Drop-in</option>
              <option value="pack">Class Pack</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {planType !== "monthly" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Credits
              </label>
              <input
                type="number"
                value={credits}
                onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
                min={0}
                className="input-field mt-1"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field mt-1"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes about this member..."
            className="input-field mt-1"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
