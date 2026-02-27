import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Public API - no auth required. Token serves as authentication.
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
    const { token, signed_name: signedName, agreed } = body;

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

    const { data: signature } = await supabase
      .from("waiver_signatures")
      .select("id, token_used")
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

    const trimmedName =
      typeof signedName === "string" ? signedName.trim() : "";

    if (!trimmedName) {
      return NextResponse.json(
        { error: "Please enter your name" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("waiver_signatures")
      .update({
        signed_name: trimmedName,
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
