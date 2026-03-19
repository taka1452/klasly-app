import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

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

    // 過去日バリデーション
    const today = new Date().toISOString().split("T")[0];
    if (booking_date < today) {
      return NextResponse.json(
        { error: "Cannot book a room in the past" },
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

    // Time quota enforcement: check instructor's membership tier
    const { data: membership } = await ctx.supabase
      .from("instructor_memberships")
      .select("tier_id, instructor_membership_tiers(monthly_minutes)")
      .eq("instructor_id", ctx.instructorId)
      .eq("status", "active")
      .maybeSingle();

    if (membership) {
      const rawTier = membership.instructor_membership_tiers as unknown;
      const tierData = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as { monthly_minutes: number } | null;
      const monthlyMinutes = tierData?.monthly_minutes ?? -1;

      if (monthlyMinutes !== -1) {
        // Calculate requested duration
        const [sh, sm] = start_time.split(":").map(Number);
        const [eh, em] = end_time.split(":").map(Number);
        const requestedMinutes = (eh * 60 + em) - (sh * 60 + sm);

        // Get used minutes for the booking month
        const bookingMonth = new Date(booking_date);
        const year = bookingMonth.getFullYear();
        const month = bookingMonth.getMonth() + 1;

        const { data: usedData } = await ctx.supabase.rpc("get_instructor_used_minutes", {
          p_instructor_id: ctx.instructorId,
          p_year: year,
          p_month: month,
        });

        const usedMinutes = typeof usedData === "number" ? usedData : 0;
        const remainingMinutes = monthlyMinutes - usedMinutes;

        if (requestedMinutes > remainingMinutes) {
          const usedH = Math.floor(usedMinutes / 60);
          const usedM = usedMinutes % 60;
          const limitH = Math.floor(monthlyMinutes / 60);
          const limitM = monthlyMinutes % 60;
          return NextResponse.json(
            {
              error: `Monthly time limit exceeded. Used: ${usedH}h${usedM > 0 ? ` ${usedM}m` : ""} / Limit: ${limitH}h${limitM > 0 ? ` ${limitM}m` : ""}. Remaining: ${Math.floor(remainingMinutes / 60)}h${remainingMinutes % 60 > 0 ? ` ${remainingMinutes % 60}m` : ""}.`,
            },
            { status: 403 }
          );
        }
      }
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
