import Link from "next/link";
import { redirect } from "next/navigation";
import TemplateList from "@/components/classes/template-list";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import ContextHelpLink from "@/components/help/context-help-link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classes - Klasly",
};

export default async function ClassesPage() {
  // マネージャー権限チェック（can_manage_classes）
  const permCheck = await checkManagerPermission("can_manage_classes");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">Manage class templates</p>
          <ContextHelpLink href="/help/classes-scheduling/create-recurring-class" />
        </div>
        <Link href="/classes/new" className="btn-primary">
          + New Template
        </Link>
      </div>

      <div className="mt-6">
        <TemplateList />
      </div>
    </div>
  );
}
