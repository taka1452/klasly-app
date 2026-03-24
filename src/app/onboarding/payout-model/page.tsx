"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users } from "lucide-react";

type PayoutModel = "studio" | "instructor_direct";

export default function PayoutModelPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<PayoutModel>("studio");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/studio/payout-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_model: selected }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      router.push("/onboarding/first-class");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const options: {
    value: PayoutModel;
    icon: typeof Building2;
    title: string;
    description: string;
  }[] = [
    {
      value: "studio",
      icon: Building2,
      title: "Studio receives payments",
      description:
        "Members pay the studio. You handle instructor compensation separately.",
    },
    {
      value: "instructor_direct",
      icon: Users,
      title: "Instructors receive payments directly",
      description:
        "Members pay instructors directly. The studio takes a fee from each transaction.",
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-700">Klasly</h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            How does your studio handle payments?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            You can change this later in Settings.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`w-full rounded-xl border-2 p-5 text-left transition ${
                  isSelected
                    ? "border-brand-600 bg-brand-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 rounded-lg p-2 ${
                      isSelected
                        ? "bg-brand-100 text-brand-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {opt.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {opt.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="btn-primary mt-6 w-full"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
