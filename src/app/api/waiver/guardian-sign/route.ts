import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/waiver/guardian-sign
 * Public API — no auth required. Token serves as authentication.
 * Processes guardian signature for minor waivers.
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const {
      token,
      guardian_name: guardianName,
      guardian_relationship: guardianRelationship,
      agreed,
    } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    if (agreed !== true) {
      return NextResponse.json(
        { error: "You must agree to the waiver" },
        { status: 400 }
      );
    }

    const trimmedName =
      typeof guardianName === "string" ? guardianName.trim() : "";

    if (!trimmedName) {
      return NextResponse.json(
        { error: "Please enter your name" },
        { status: 400 }
      );
    }

    if (!["parent", "legal_guardian"].includes(guardianRelationship)) {
      return NextResponse.json(
        { error: "Invalid relationship" },
        { status: 400 }
      );
    }

    const { data: signature } = await supabase
      .from("waiver_signatures")
      .select("id, token_used, member_id")
      .eq("sign_token", token)
      .single();

    if (!signature) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }

    if (signature.token_used) {
      return NextResponse.json(
        { error: "This link has already been used" },
        { status: 400 }
      );
    }

    // 保護者署名は未成年メンバーのみ許可
    const { data: member } = await supabase
      .from("members")
      .select("is_minor")
      .eq("id", signature.member_id)
      .single();

    if (!member?.is_minor) {
      return NextResponse.json(
        { error: "Guardian signatures are only for minor members" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("waiver_signatures")
      .update({
        signed_name: trimmedName,
        guardian_name: trimmedName,
        guardian_email: null, // Already stored on member record
        guardian_relationship: guardianRelationship,
        signed_at: new Date().toISOString(),
        token_used: true,
      })
      .eq("id", signature.id);

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
