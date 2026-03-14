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

// PATCH: ブッキング更新
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 自分のブッキングか確認
    const { data: existing } = await ctx.supabase
      .from("instructor_room_bookings")
      .select("id, instructor_id, room_id, booking_date")
      .eq("id", id)
      .single();

    if (!existing || existing.instructor_id !== ctx.instructorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.is_public !== undefined) updates.is_public = body.is_public;
    if (body.notes !== undefined) updates.notes = body.notes || null;

    // 時間変更がある場合は重複チェック
    if (updates.start_time || updates.end_time) {
      const newStart = (updates.start_time || body.start_time) as string;
      const newEnd = (updates.end_time || body.end_time) as string;

      if (newEnd <= newStart) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }

      const { data: conflicts } = await ctx.supabase
        .from("instructor_room_bookings")
        .select("id")
        .eq("room_id", existing.room_id)
        .eq("booking_date", existing.booking_date)
        .eq("status", "confirmed")
        .neq("id", id)
        .lt("start_time", newEnd)
        .gt("end_time", newStart);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: "This room is already booked during that time" },
          { status: 409 }
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from("instructor_room_bookings")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: ブッキングをキャンセル（ソフトデリート）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existing } = await ctx.supabase
      .from("instructor_room_bookings")
      .select("id, instructor_id")
      .eq("id", id)
      .single();

    if (!existing || existing.instructor_id !== ctx.instructorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await ctx.supabase
      .from("instructor_room_bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
