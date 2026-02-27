import Link from "next/link";

type Props = {
  planStatus: string;
  gracePeriodEndsAt: string | null;
};

export default function PlanBanner({ planStatus, gracePeriodEndsAt }: Props) {
  if (planStatus !== "past_due" && planStatus !== "grace") return null;

  const graceEndStr = gracePeriodEndsAt
    ? new Date(gracePeriodEndsAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const isPastDue = planStatus === "past_due";

  return (
    <div
      className={`rounded-lg px-4 py-3 ${
        isPastDue
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p
          className={`text-sm font-medium ${isPastDue ? "text-red-800" : "text-amber-800"}`}
        >
          {planStatus === "past_due"
            ? "Your payment failed. Please update your card to avoid losing access."
            : `Your account will be suspended on ${graceEndStr}. Update your payment method now.`}
        </p>
        <Link
          href="/settings/billing"
          className={`inline-flex items-center text-sm font-semibold ${isPastDue ? "text-red-700 hover:text-red-800" : "text-amber-700 hover:text-amber-800"}`}
        >
          Update payment →
        </Link>
      </div>
    </div>
  );
}
