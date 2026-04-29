import { redirect } from "next/navigation";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import ClosuresClient from "./closures-client";

export default async function StudioClosuresPage() {
  const { allowed, role } = await checkManagerPermission("can_manage_settings");

  // Owner is always allowed; managers need can_manage_settings.
  if (!allowed || (role !== "owner" && role !== "manager")) {
    redirect("/settings");
  }

  return <ClosuresClient />;
}
