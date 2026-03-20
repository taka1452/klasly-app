import { redirect } from "next/navigation";

/**
 * /schedule/new redirects to the class template creation page.
 * The workflow is: create a template, then schedule sessions from it.
 */
export default function NewClassPage() {
  redirect("/classes/new");
}
