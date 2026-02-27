import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { waiverInvite } from "@/lib/email/templates";
import { WAIVER_FROM_EMAIL } from "@/lib/email/client";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Bulk send waiver invites to all unsigned members.
 * Skips members who already have an unused (token_used = false) invite.
 */
export async function POST() {
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

    const { data: unsignedMembers } = await adminSupabase
      .from("members")
      .select("id, profile_id")
      .eq("studio_id", ownerProfile.studio_id)
      .eq("waiver_signed", false)
      .eq("status", "active");

    if (!unsignedMembers?.length) {
      return NextResponse.json({ sent: 0 });
    }

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", ownerProfile.studio_id)
      .single();
    const studioName = studio?.name ?? "Studio";

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let sent = 0;

    for (const member of unsignedMembers) {
      const { data: existing } = await adminSupabase
        .from("waiver_signatures")
        .select("id")
        .eq("member_id", member.id)
        .eq("token_used", false)
        .single();

      if (existing) {
        continue; // Skip: already has unused invite
      }

      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", member.profile_id)
        .single();

      if (!profile?.email) {
        continue; // Skip: no email
      }

      const token = randomUUID();

      const { error: insertError } = await adminSupabase
        .from("waiver_signatures")
        .insert({
          member_id: member.id,
          sign_token: token,
          signed_name: "",
          signed_at: null,
          token_used: false,
        });

      if (insertError) {
        continue; // Skip on insert error, don't fail entire batch
      }

      const signUrl = `${baseUrl}/waiver/sign/${token}`;
      const { subject, html } = waiverInvite({
        memberName: profile?.full_name ?? "Member",
        studioName,
        signUrl,
      });

      sendEmail({
        to: profile.email,
        subject,
        html,
        from: WAIVER_FROM_EMAIL,
      });

      sent++;
    }

    return NextResponse.json({ sent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
