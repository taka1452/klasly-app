import { redirect } from "next/navigation";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import SettingsConnectClient from "./connect-client";

export default async function SettingsConnectPage() {
  const { allowed, role } = await checkManagerPermission();
  if (!allowed || role !== "owner") {
    redirect("/settings");
  }
  return <SettingsConnectClient />;
}
