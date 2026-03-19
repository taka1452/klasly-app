import Link from "next/link";

export default async function PurchaseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const hasSession = !!params.session_id;

  if (!hasSession) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">No purchase found</h1>
        <p className="mt-2 text-gray-600">
          It looks like you arrived here without completing a purchase.
        </p>
        <div className="mt-6">
          <Link href="/purchase" className="btn-primary inline-block">
            Go to Purchase
          </Link>
        </div>
      </div>
    );
  }

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
