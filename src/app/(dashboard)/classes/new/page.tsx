import Link from "next/link";
import { redirect } from "next/navigation";
import TemplateForm from "@/components/classes/template-form";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Class Template - Klasly",
};

export default async function NewClassTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const permCheck = await checkManagerPermission("can_manage_classes");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }

  const { duplicate } = await searchParams;

  // If duplicating, fetch the source template data
  let duplicateData: Record<string, unknown> | null = null;
  if (duplicate) {
    const serverSupabase = await createServerClient();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    const { data: template } = await supabase
      .from("class_templates")
      .select("*")
      .eq("id", duplicate)
      .single();

    if (template) {
      duplicateData = {
        name: `${template.name} (Copy)`,
        description: template.description || "",
        duration_minutes: template.duration_minutes,
        capacity: template.capacity,
        price_cents: template.price_cents,
        location: template.location || "",
        instructor_id: template.instructor_id || "",
        room_id: template.room_id || "",
        is_public: template.is_public ?? true,
        class_type: template.is_online ? "online" : template.online_link ? "hybrid" : "in-person",
        online_link: template.online_link || "",
        image_url: template.image_url || "",
        transition_minutes: template.transition_minutes || 0,
      };
    }
  }

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
          {duplicateData ? "Duplicate Class Template" : "New Class Template"}
        </h1>
      </div>

      <TemplateForm duplicateData={duplicateData} />
    </div>
  );
}
