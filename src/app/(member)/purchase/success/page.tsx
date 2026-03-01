import Link from "next/link";

export default function PurchaseSuccessPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-bold text-gray-900">Purchase complete!</h1>
      <p className="mt-2 text-gray-600">
        Thank you for your purchase. Your credits or membership have been
        updated.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Your payment is being processed. It will appear in your payment history
        shortly.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/schedule" className="btn-primary inline-block">
          View Schedule
        </Link>
        <Link
          href="/my-payments"
          className="btn-secondary inline-block"
        >
          View Payment History
        </Link>
      </div>
    </div>
  );
}
