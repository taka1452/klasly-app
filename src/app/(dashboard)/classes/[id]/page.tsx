import Link from "next/link";
import TemplateForm from "@/components/classes/template-form";
import UpcomingSessions from "@/components/classes/upcoming-sessions";
import TemplateHistory from "@/components/classes/template-history";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Class Template - Klasly",
};

export default async function EditClassTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/classes"
          className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">&larr;</span>
          Classes
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Edit Class Template
        </h1>
      </div>

      <TemplateForm templateId={id} />
      <UpcomingSessions templateId={id} />
      <TemplateHistory templateId={id} />
    </div>
  );
}
