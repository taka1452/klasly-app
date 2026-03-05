"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCredits } from "@/lib/utils";

type Props = {
  memberId: string;
  currentCredits: number;
};

export default function MemberAdjustCredits({ memberId, currentCredits }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unlimited, setUnlimited] = useState(false);
  const [value, setValue] = useState(
    currentCredits === -1 ? "0" : String(currentCredits)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function openModal() {
    setUnlimited(currentCredits === -1);
    setValue(currentCredits === -1 ? "0" : String(currentCredits));
    setError("");
    setSaved(false);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const credits = unlimited ? -1 : parseInt(value, 10);
    if (!unlimited && (!Number.isInteger(credits) || credits < 0)) {
      setError("Enter a non-negative number.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/members/adjust-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, credits }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to update");
      return;
    }
    setSaved(true);
    setTimeout(() => {
      setOpen(false);
      router.refresh();
    }, 800);
  }

  return (
    <>
      <dt className="text-xs text-gray-400">Credits</dt>
      <dd className="flex items-center gap-2 text-sm font-medium text-gray-900">
        {formatCredits(currentCredits)}
        <button
          type="button"
          onClick={openModal}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Adjust
        </button>
      </dd>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 z-20 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <h3 className="font-medium text-gray-900">Adjust Credits</h3>
            <p className="mt-1 text-xs text-gray-500">
              Set the credit count for this member.
            </p>
            {saved ? (
              <p className="mt-4 text-center text-sm font-medium text-green-600">Saved!</p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={unlimited}
                    onChange={(e) => setUnlimited(e.target.checked)}
                    className="rounded border-gray-300 text-brand-600"
                  />
                  Unlimited (subscription)
                </label>
                {!unlimited && (
                  <div>
                    <label htmlFor="credits-input" className="block text-xs font-medium text-gray-500">
                      Number of credits
                    </label>
                    <input
                      id="credits-input"
                      type="number"
                      min={0}
                      step={1}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary text-sm"
                  >
                    {loading ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
