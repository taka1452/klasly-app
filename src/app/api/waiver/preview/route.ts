import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Public API - returns waiver content for a valid unused token.
 * Used by the waiver sign page to display the template.
 * GET /api/waiver/preview?token=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { error: "Invalid link" },
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

    const { data: signature } = await supabase
      .from("waiver_signatures")
      .select("id, member_id, token_used")
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

    const { data: member } = await supabase
      .from("members")
      .select("studio_id")
      .eq("id", signature.member_id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 400 }
      );
    }

    const { data: template } = await supabase
      .from("waiver_templates")
      .select("title, content")
      .eq("studio_id", member.studio_id)
      .single();

    const { data: studio } = await supabase
      .from("studios")
      .select("name")
      .eq("id", member.studio_id)
      .single();

    if (!template) {
      return NextResponse.json(
        { error: "Waiver template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      title: template.title,
      content: template.content,
      studioName: studio?.name || "Studio",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
