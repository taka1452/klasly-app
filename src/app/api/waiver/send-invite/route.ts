import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { waiverInvite } from "@/lib/email/templates";
import { WAIVER_FROM_EMAIL } from "@/lib/email/client";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

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

    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id, profile_id")
      .eq("id", memberId)
      .eq("studio_id", ownerProfile.studio_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
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

    const token = randomUUID();

    const { error: insertError } = await adminSupabase
      .from("waiver_signatures")
      .insert({
        member_id: memberId,
        sign_token: token,
        signed_name: "",
        signed_at: null,
        token_used: false,
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", member.profile_id)
      .single();

    const memberEmail = profile?.email;
    if (!memberEmail) {
      return NextResponse.json(
        { error: "Member has no email address" },
        { status: 400 }
      );
    }

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", ownerProfile.studio_id)
      .single();

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signUrl = `${baseUrl}/waiver/sign/${token}`;

    const { subject, html } = waiverInvite({
      memberName: profile?.full_name || "Member",
      studioName: studio?.name || "Studio",
      signUrl,
    });

    await sendEmail({
      to: memberEmail,
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
