import { redirect } from "next/navigation";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import { createClient } from "@/lib/supabase/server";
import { defaultCountryFromTimezone } from "@/lib/stripe/connect-countries";
import SettingsConnectClient from "./connect-client";

export default async function SettingsConnectPage() {
  const { allowed, role } = await checkManagerPermission();
  if (!allowed || role !== "owner") {
    redirect("/settings");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultCountry = "US";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();
    if (profile?.studio_id) {
      const { data: studio } = await supabase
        .from("studios")
        .select("timezone")
        .eq("id", profile.studio_id)
        .single();
      defaultCountry = defaultCountryFromTimezone(studio?.timezone);
    }
  }

  return <SettingsConnectClient defaultCountry={defaultCountry} />;
}
