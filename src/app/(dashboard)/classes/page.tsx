import Link from "next/link";
import { redirect } from "next/navigation";
import TemplateList from "@/components/classes/template-list";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import PageHeader from "@/components/ui/page-header";
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
      <PageHeader
        title="Classes"
        subtitle="Manage class templates"
        helpHref="/help/classes-scheduling/create-recurring-class"
        actions={
          <Link href="/classes/new" className="btn-primary">
            + New Template
          </Link>
        }
      />

      <div className="mt-6">
        <TemplateList />
      </div>
    </div>
  );
}
