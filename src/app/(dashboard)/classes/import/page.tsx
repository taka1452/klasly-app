import { redirect } from "next/navigation";

/**
 * Import has moved to /schedule/import.
 * This redirect ensures old links still work.
 */
export default function ImportRedirect() {
  redirect("/schedule/import");
}
