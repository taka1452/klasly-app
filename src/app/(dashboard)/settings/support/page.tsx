import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SupportTicketsClient from "@/components/settings/support-tickets-client";

export default async function SupportPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <svg
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-amber-800">
              Support is temporarily unavailable
            </h3>
            <p className="mt-1 text-sm text-amber-700">
              Please try again in a few minutes. If the issue persists, contact us at support@klasly.com.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner" || !profile?.studio_id) {
    return (
      <div>
        <Link
          href="/settings"
          className="group inline-flex items-center gap-1 text-sm text-gray-500 transition-colors duration-150 hover:text-gray-700"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">
            ←
          </span>
          Back to Settings
        </Link>
        <div className="mt-6 card max-w-lg">
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Owner-only area
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Support tickets are available to the studio owner. Ask the owner to
                open a ticket on your behalf, or return to settings.
              </p>
              <Link href="/settings" className="btn-primary mt-3 inline-flex">
                Back to Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, subject, status, priority, created_at")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <Link
        href="/settings"
        className="group inline-flex items-center gap-1 text-sm text-gray-500 transition-colors duration-150 hover:text-gray-700"
      >
        <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">
          ←
        </span>
        Back to Settings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
        Support
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Open a ticket or view your existing tickets.
      </p>

      <SupportTicketsClient initialTickets={tickets ?? []} />
    </div>
  );
}
