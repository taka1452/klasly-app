import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, rating, comment } = await req.json();

  if (!sessionId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get member
  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Get session details and verify attendance
  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, class_id, instructor_id, session_date")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Ensure session is in the past
  const today = new Date().toISOString().split("T")[0];
  if (session.session_date > today) {
    return NextResponse.json({ error: "Cannot review future classes" }, { status: 400 });
  }

  // Verify member had a confirmed booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("session_id", sessionId)
    .eq("member_id", member.id)
    .eq("status", "confirmed")
    .single();

  if (!booking) {
    return NextResponse.json(
      { error: "You must attend a class before reviewing it" },
      { status: 403 }
    );
  }

  // Check for existing review
  const { data: existing } = await supabase
    .from("class_reviews")
    .select("id")
    .eq("member_id", member.id)
    .eq("session_id", sessionId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  // Insert review
  const { error } = await supabase.from("class_reviews").insert({
    studio_id: member.studio_id,
    member_id: member.id,
    session_id: sessionId,
    class_id: session.class_id,
    instructor_id: session.instructor_id,
    rating,
    comment: comment || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studioId = searchParams.get("studioId");

  if (!studioId) {
    return NextResponse.json({ error: "studioId required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: reviews, error } = await supabase
    .from("class_reviews")
    .select(`
      id,
      rating,
      comment,
      created_at,
      class_id,
      instructor_id,
      members (
        profiles (full_name)
      ),
      classes (name),
      class_sessions (session_date)
    `)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reviews });
}
