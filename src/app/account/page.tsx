import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountForm from "@/components/account/account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          Account
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Manage your profile, sign-in details, and photo.
        </p>
      </header>
      <AccountForm />
    </div>
  );
}
