import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { guardianWaiverInvite } from "@/lib/email/templates";
import { WAIVER_FROM_EMAIL } from "@/lib/email/client";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * POST /api/waiver/send-guardian-invite
 * Send a waiver signing request to a minor member's guardian.
 */
export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: ownerProfile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (ownerProfile?.role !== "owner" || !ownerProfile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { member_id: memberId } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: "Missing member_id" },
        { status: 400 }
      );
    }

    // Get member and verify it belongs to this studio
    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id, profile_id, is_minor, guardian_email")
      .eq("id", memberId)
      .eq("studio_id", ownerProfile.studio_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (!member.is_minor) {
      return NextResponse.json(
        { error: "This member is not marked as a minor" },
        { status: 400 }
      );
    }

    if (!member.guardian_email) {
      return NextResponse.json(
        { error: "No guardian email set for this member" },
        { status: 400 }
      );
    }

    // Get waiver template
    const { data: template } = await adminSupabase
      .from("waiver_templates")
      .select("id")
      .eq("studio_id", ownerProfile.studio_id)
      .single();

    if (!template) {
      return NextResponse.json(
        { error: "No waiver template configured. Please create one first." },
        { status: 400 }
      );
    }

    // Create waiver signature record
    const token = randomUUID();

    const { error: insertError } = await adminSupabase
      .from("waiver_signatures")
      .insert({
        member_id: memberId,
        studio_id: ownerProfile.studio_id,
        template_id: template.id,
        sign_token: token,
        signed_name: "",
        signed_at: null,
        token_used: false,
        is_minor: true,
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Get member name and studio name for email
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name")
      .eq("id", member.profile_id)
      .single();

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", ownerProfile.studio_id)
      .single();

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signUrl = `${baseUrl}/waiver/guardian-sign?token=${token}`;

    const { subject, html } = guardianWaiverInvite({
      memberName: profile?.full_name ?? "Member",
      studioName: studio?.name ?? "Studio",
      signUrl,
    });

    await sendEmail({
      to: member.guardian_email,
      subject,
      html,
      from: WAIVER_FROM_EMAIL,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
