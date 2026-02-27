import Link from "next/link";

export default function PlanLockScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Your account has been suspended.
        </h1>
        <p className="mt-4 text-gray-600">
          Please reactivate your subscription to continue.
        </p>
        <Link href="/settings/billing" className="btn-primary mt-8 inline-block">
          Reactivate
        </Link>
      </div>
    </div>
  );
}
