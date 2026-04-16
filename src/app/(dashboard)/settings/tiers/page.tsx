import { redirect } from "next/navigation";

export default function TiersRedirectPage() {
  redirect("/settings/contracts?tab=hourly");
}
