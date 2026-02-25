import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-bold text-gray-900">
        Your plan has been upgraded!
      </h1>
      <p className="mt-2 text-gray-600">
        Thank you for your subscription. You now have access to all features of
        your new plan.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6 inline-block">
        Go to Dashboard
      </Link>
    </div>
  );
}
