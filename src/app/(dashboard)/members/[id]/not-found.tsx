import Link from "next/link";

export default function MemberNotFound() {
  return (
    <div className="card max-w-md text-center">
      <h1 className="text-xl font-bold text-gray-900">Member not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        The member you are looking for does not exist or you do not have access.
      </p>
      <Link href="/members" className="btn-primary mt-6 inline-block">
        Back to members
      </Link>
    </div>
  );
}
