import Link from "next/link";
import TemplateForm from "@/components/classes/template-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Class Template - Klasly",
};

export default function NewClassTemplatePage() {
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
