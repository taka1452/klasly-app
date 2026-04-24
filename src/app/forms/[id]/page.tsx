import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CustomForm } from "@/lib/forms/types";
import PublicFormClient from "@/components/forms/public-form-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { title: "Form — Klasly" };
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  const { data } = await svc
    .from("custom_forms")
    .select("name")
    .eq("id", id)
    .single();
  return { title: `${data?.name || "Form"} — Klasly` };
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) notFound();

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: form } = await svc
    .from("custom_forms")
    .select(
      "id, studio_id, form_type, name, description, intro_text, success_message, fields, requires_signature, is_active, is_public, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (!form || !form.is_active || !form.is_public) notFound();

  // Get studio name for branding.
  const { data: studio } = await svc
    .from("studios")
    .select("name, logo_url")
    .eq("id", form.studio_id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {studio?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={studio.logo_url}
              alt={studio.name || "Studio"}
              className="h-10 w-10 rounded object-cover"
            />
          )}
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {studio?.name || "Studio"}
            </div>
            <div className="text-xs text-gray-500">{form.name}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <PublicFormClient form={form as CustomForm} />
      </main>
    </div>
  );
}
