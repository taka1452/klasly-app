import { redirect } from "next/navigation";

export default function RentalRedirectPage() {
  redirect("/settings/contracts?tab=flat");
}
