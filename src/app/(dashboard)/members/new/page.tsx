import { redirect } from "next/navigation";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import NewMemberForm from "./new-member-form";

export default async function NewMemberPage() {
  const permCheck = await checkManagerPermission("can_manage_members");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }

  return <NewMemberForm />;
}
