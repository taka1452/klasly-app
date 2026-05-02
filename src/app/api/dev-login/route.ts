import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  // Body credentials take precedence so the dev login can target any
  // test account; env vars remain the fallback for one-click owner sign-in.
  const email = (body.email || process.env.DEV_LOGIN_EMAIL || "").trim();
  const password = (body.password || process.env.DEV_LOGIN_PASSWORD || "").trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
