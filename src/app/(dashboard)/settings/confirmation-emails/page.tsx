import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import ConfirmationEmailsClient from "@/components/settings/confirmation-emails-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confirmation Emails - Klasly",
};

export default async function ConfirmationEmailsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.role !== "owner") {
    redirect("/settings");
  }

  const { data: studio } = await supabase
    .from("studios")
    .select(
      "class_confirmation_subject, class_confirmation_body, event_confirmation_subject, event_confirmation_body, confirmation_sender_name"
    )
    .eq("id", profile.studio_id)
    .single();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Confirmation emails
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Set the default subject and body for booking confirmation emails.
          Leave blank to use the Klasly default. Per-class overrides take
          priority over these settings.
        </p>
      </div>
      <ConfirmationEmailsClient
        initial={{
          classSubject: studio?.class_confirmation_subject ?? "",
          classBody: studio?.class_confirmation_body ?? "",
          eventSubject: studio?.event_confirmation_subject ?? "",
          eventBody: studio?.event_confirmation_body ?? "",
          senderName: studio?.confirmation_sender_name ?? "",
        }}
      />
    </div>
  );
}
