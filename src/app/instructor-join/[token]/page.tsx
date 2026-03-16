"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function InstructorJoinPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studioName, setStudioName] = useState("");
  const [inviteRole, setInviteRole] = useState<"instructor" | "manager">("instructor");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/instructor-join/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Invalid invite link");
          return;
        }
        const data = await res.json();
        setStudioName(data.studioName);
        setInviteRole(data.inviteRole ?? "instructor");
      } catch {
        setError("Failed to validate invite link");
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  async function handleJoin() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructor-join/${token}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to join");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push(inviteRole === "manager" ? "/dashboard" : "/instructor"), 2000);
    } catch {
      setError("Failed to join studio");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-600">Validating invite link...</p>
        </div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Invalid Invite Link
          </h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Welcome to {studioName}!
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            You have successfully joined as {inviteRole === "manager" ? "a manager" : "an instructor"}. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
          <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Join {studioName}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          You&apos;ve been invited to join as {inviteRole === "manager" ? "a manager" : "an instructor"} at{" "}
          <span className="font-medium">{studioName}</span>.
        </p>
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining}
          className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {joining ? "Joining..." : `Accept & Join as ${inviteRole === "manager" ? "Manager" : "Instructor"}`}
        </button>
        <p className="mt-4 text-xs text-gray-400">
          You need to be logged in to accept this invitation.
        </p>
      </div>
    </div>
  );
}
