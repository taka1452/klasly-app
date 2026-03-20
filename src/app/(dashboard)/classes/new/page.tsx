import { redirect } from "next/navigation";

/**
 * /classes/new now redirects to the templates page.
 * The new workflow is: create a template, then schedule sessions from it.
 */
export default function NewClassPage() {
  redirect("/classes/templates/new");
}
