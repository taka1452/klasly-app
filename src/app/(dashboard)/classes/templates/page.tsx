import Link from "next/link";
import TemplateList from "@/components/classes/template-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class Templates - Klasly",
};

export default function ClassTemplatesPage() {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reusable class blueprints. Schedule sessions from these templates.
          </p>
        </div>
        <Link href="/classes/templates/new" className="btn-primary">
          + New Template
        </Link>
      </div>

      <div className="mt-6">
        <TemplateList />
      </div>
    </div>
  );
}
