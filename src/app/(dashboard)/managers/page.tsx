import { redirect } from "next/navigation";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import ManagersClient from "./managers-client";

export default async function ManagersPage() {
  const { allowed, role } = await checkManagerPermission();
  if (!allowed || role !== "owner") {
    redirect("/dashboard");
  }
  return <ManagersClient />;
}
