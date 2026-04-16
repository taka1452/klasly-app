import { redirect } from "next/navigation";

export default function OverageRedirectPage() {
  redirect("/settings/contracts?tab=overage");
}
