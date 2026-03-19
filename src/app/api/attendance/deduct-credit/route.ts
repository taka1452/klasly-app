import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

export async function POST(request: Request) {
  try {
    // Owner または can_manage_bookings 権限を持つ Manager
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (ctx.role === "manager" && !ctx.permissions?.can_manage_bookings) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminSupabase = ctx.supabase;

    const body = await request.json();
    const { member_id, booking_id, drop_in_id } = body;

    if (!member_id) {
      return NextResponse.json(
        { error: "Missing required field: member_id" },
        { status: 400 }
      );
    }

    if (!booking_id && !drop_in_id) {
      return NextResponse.json(
        { error: "Either booking_id or drop_in_id is required" },
        { status: 400 }
      );
    }

    if (booking_id && drop_in_id) {
      return NextResponse.json(
        { error: "Provide only one of booking_id or drop_in_id" },
        { status: 400 }
      );
    }

    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id, plan_type, credits")
      .eq("id", member_id)
      .single();

    if (!member || member.studio_id !== ctx.studioId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (member.credits === -1) {
      return NextResponse.json(
        { error: "Monthly plan members don't use credits" },
        { status: 400 }
      );
    }

    if (member.credits === 0) {
      return NextResponse.json(
        { error: "No credits remaining" },
        { status: 400 }
      );
    }

    if (booking_id) {
      const { data: booking } = await adminSupabase
        .from("bookings")
        .select("id, credit_deducted, studio_id")
        .eq("id", booking_id)
        .single();

      if (!booking || booking.studio_id !== ctx.studioId) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      if (booking.credit_deducted) {
        return NextResponse.json(
          { error: "Credit already deducted" },
          { status: 400 }
        );
      }

      // Atomic credit deduction
      const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
        p_member_id: member_id,
      });
      if (creditResult === -99) {
        return NextResponse.json({ error: "No credits remaining" }, { status: 400 });
      }

      await adminSupabase
        .from("bookings")
        .update({ credit_deducted: true })
        .eq("id", booking_id);
    } else {
      const { data: dropIn } = await adminSupabase
        .from("drop_in_attendances")
        .select("id, credit_deducted, studio_id")
        .eq("id", drop_in_id)
        .single();

      if (!dropIn || dropIn.studio_id !== ctx.studioId) {
        return NextResponse.json(
          { error: "Drop-in attendance not found" },
          { status: 404 }
        );
      }

      if (dropIn.credit_deducted) {
        return NextResponse.json(
          { error: "Credit already deducted" },
          { status: 400 }
        );
      }

      // Atomic credit deduction
      const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
        p_member_id: member_id,
      });
      if (creditResult === -99) {
        return NextResponse.json({ error: "No credits remaining" }, { status: 400 });
      }

      await adminSupabase
        .from("drop_in_attendances")
        .update({ credit_deducted: true })
        .eq("id", drop_in_id);
    }

    // Fetch updated credits for response
    const { data: updated } = await adminSupabase
      .from("members")
      .select("credits")
      .eq("id", member_id)
      .single();

    return NextResponse.json({
      success: true,
      credits_remaining: updated?.credits ?? member.credits - 1,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
