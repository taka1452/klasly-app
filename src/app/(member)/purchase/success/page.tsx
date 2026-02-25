import Link from "next/link";

export default function PurchaseSuccessPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-bold text-gray-900">Purchase complete!</h1>
      <p className="mt-2 text-gray-600">
        Thank you for your purchase. Your credits or membership have been
        updated.
      </p>
      <Link href="/schedule" className="btn-primary mt-6 inline-block">
        View Schedule
      </Link>
    </div>
  );
}
