import Link from "next/link";
import { redirect } from "next/navigation";
import TemplateForm from "@/components/classes/template-form";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Class Template - Klasly",
};

export default async function NewClassTemplatePage() {
  const permCheck = await checkManagerPermission("can_manage_classes");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/classes"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to classes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          New Class Template
        </h1>
      </div>

      <TemplateForm />
    </div>
  );
}
