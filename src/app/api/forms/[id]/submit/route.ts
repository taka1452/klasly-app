import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Public submission endpoint. Anyone (logged in or not) can submit to an
 * active public form. Writes a row to custom_form_submissions using the
 * service role, because anonymous callers don't have row-insert RLS.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Service key missing" }, { status: 500 });
    }
    const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

    const { data: form } = await svc
      .from("custom_forms")
      .select("id, studio_id, name, is_active, is_public, requires_signature, fields")
      .eq("id", id)
      .single();

    if (!form || !form.is_active) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Non-public forms require an authenticated user.
    let submitterProfileId: string | null = null;
    if (!form.is_public) {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      submitterProfileId = user.id;
    } else {
      // Try to attach the logged-in user if there is one.
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) submitterProfileId = user.id;
    }

    const body = await request.json();
    const responses = body.responses || {};
    const signatureData: string | null = body.signature_data || null;

    if (form.requires_signature && !signatureData) {
      return NextResponse.json({ error: "Signature required" }, { status: 400 });
    }

    // Minimal required-field validation mirroring the client.
    type Field = { id: string; label: string; type: string; required: boolean };
    for (const field of form.fields as Field[]) {
      if (field.required) {
        const val = responses[field.id];
        const empty =
          val === null ||
          val === undefined ||
          (typeof val === "string" && val.trim().length === 0) ||
          (Array.isArray(val) && val.length === 0) ||
          (field.type === "acknowledgement" && val !== true);
        if (empty) {
          return NextResponse.json(
            { error: `Missing required field: ${field.label}` },
            { status: 400 }
          );
        }
      }
    }

    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      null;

    const { data: inserted, error } = await svc
      .from("custom_form_submissions")
      .insert({
        form_id: form.id,
        studio_id: form.studio_id,
        submitter_profile_id: submitterProfileId,
        submitter_name:
          typeof body.submitter_name === "string"
            ? body.submitter_name.trim() || null
            : null,
        submitter_email:
          typeof body.submitter_email === "string"
            ? body.submitter_email.trim().toLowerCase() || null
            : null,
        submitter_phone:
          typeof body.submitter_phone === "string"
            ? body.submitter_phone.trim() || null
            : null,
        responses,
        signature_data: signatureData,
        signed_at: signatureData ? new Date().toISOString() : null,
        ip_address: ip,
        user_agent: request.headers.get("user-agent") ?? null,
      })
      .select("id, submitted_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, submission: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // List submissions — admin-only.
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: profile } = await svc
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "owner" && profile.role !== "manager") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await svc
    .from("custom_form_submissions")
    .select("*")
    .eq("form_id", id)
    .eq("studio_id", profile.studio_id)
    .order("submitted_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
