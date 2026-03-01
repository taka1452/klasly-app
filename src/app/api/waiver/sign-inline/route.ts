import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Inline waiver sign - for logged-in members. No token link required.
 * Verifies the member belongs to the current user (profile_id) and records the signature.
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

    const body = await request.json();
    const { memberId, signedName } = body;

    if (!memberId || typeof signedName !== "string") {
      return NextResponse.json(
        { error: "Missing memberId or signedName" },
        { status: 400 }
      );
    }

    const trimmedName = signedName.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Please enter your name" },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: member } = await supabase
      .from("members")
      .select("id, profile_id, studio_id")
      .eq("id", memberId)
      .single();

    if (!member || member.profile_id !== user.id) {
      return NextResponse.json(
        { error: "Member not found or access denied" },
        { status: 403 }
      );
    }

    const signToken = randomUUID();
    const signedAt = new Date().toISOString();

    const { error: insertError } = await supabase.from("waiver_signatures").insert({
      member_id: memberId,
      studio_id: member.studio_id,
      sign_token: signToken,
      signed_name: trimmedName,
      signed_at: signedAt,
      token_used: true,
    });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("members")
      .update({
        waiver_signed: true,
        waiver_signed_at: signedAt,
      })
      .eq("id", memberId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
