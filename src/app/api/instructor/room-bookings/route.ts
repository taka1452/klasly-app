import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getInstructorContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.role !== "instructor") return null;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!instructor) return null;

  return { supabase, studioId: profile.studio_id, instructorId: instructor.id };
}

// GET: 自分のルームブッキング一覧
export async function GET(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = ctx.supabase
      .from("instructor_room_bookings")
      .select("*, rooms(name, capacity)")
      .eq("instructor_id", ctx.instructorId)
      .eq("status", "confirmed")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (from) query = query.gte("booking_date", from);
    if (to) query = query.lte("booking_date", to);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: 新規ルームブッキング作成
export async function POST(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { room_id, title, booking_date, start_time, end_time, is_public, notes } = body;

    if (!room_id || !title || !booking_date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "room_id, title, booking_date, start_time, end_time are required" },
        { status: 400 }
      );
    }

    // 時間帯バリデーション
    if (end_time <= start_time) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // 部屋がこのスタジオに属しているか確認
    const { data: room } = await ctx.supabase
      .from("rooms")
      .select("id, studio_id, is_active")
      .eq("id", room_id)
      .single();

    if (!room || room.studio_id !== ctx.studioId || !room.is_active) {
      return NextResponse.json(
        { error: "Room not found or inactive" },
        { status: 404 }
      );
    }

    // 重複チェック: 同じ部屋・日付で時間帯が重なるブッキングがないか
    const { data: conflicts } = await ctx.supabase
      .from("instructor_room_bookings")
      .select("id, title, start_time, end_time")
      .eq("room_id", room_id)
      .eq("booking_date", booking_date)
      .eq("status", "confirmed")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "This room is already booked during that time",
          conflicts,
        },
        { status: 409 }
      );
    }

    const { data: booking, error: insertError } = await ctx.supabase
      .from("instructor_room_bookings")
      .insert({
        studio_id: ctx.studioId,
        instructor_id: ctx.instructorId,
        room_id,
        title,
        booking_date,
        start_time,
        end_time,
        is_public: is_public ?? true,
        notes: notes || null,
        status: "confirmed",
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(booking, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
