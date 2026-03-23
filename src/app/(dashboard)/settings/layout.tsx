import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import SettingsLayout from "@/components/settings/settings-layout";

export default async function SettingsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : supabase;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("studios(payout_model)")
    .eq("id", user.id)
    .single();

  const studioData = profile?.studios as { payout_model?: string } | null;
  const isCollectiveMode = studioData?.payout_model === "instructor_direct";

  return (
    <SettingsLayout isCollectiveMode={isCollectiveMode}>
      {children}
    </SettingsLayout>
  );
}
