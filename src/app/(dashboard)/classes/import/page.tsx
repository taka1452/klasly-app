import { redirect } from "next/navigation";

/**
 * Import has moved to /calendar/import.
 * This redirect ensures old links still work.
 */
export default function ImportRedirect() {
  redirect("/calendar/import");
}
