import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { session_id, member_id } = body;

    if (!session_id || !member_id) {
      return NextResponse.json(
        { error: "Missing required fields: session_id, member_id" },
        { status: 400 }
      );
    }

    const { data: session } = await adminSupabase
      .from("class_sessions")
      .select("id, studio_id")
      .eq("id", session_id)
      .single();

    if (!session || session.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id, credits")
      .eq("id", member_id)
      .single();

    if (!member || member.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { data: existingBooking } = await adminSupabase
      .from("bookings")
      .select("id")
      .eq("session_id", session_id)
      .eq("member_id", member_id)
      .eq("status", "confirmed")
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json(
        { error: "Member already has a booking for this session" },
        { status: 409 }
      );
    }

    const { data: existingDropIn } = await adminSupabase
      .from("drop_in_attendances")
      .select("id")
      .eq("session_id", session_id)
      .eq("member_id", member_id)
      .maybeSingle();

    if (existingDropIn) {
      return NextResponse.json(
        { error: "Member already in drop-in list for this session" },
        { status: 409 }
      );
    }

    const credits = member.credits ?? 0;
    const isUnlimited = credits === -1;
    const shouldDeductCredit = !isUnlimited && credits >= 1;

    if (shouldDeductCredit) {
      const { error: updateErr } = await adminSupabase
        .from("members")
        .update({ credits: credits - 1 })
        .eq("id", member_id);

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message },
          { status: 500 }
        );
      }
    }

    const { data: dropIn, error } = await adminSupabase
      .from("drop_in_attendances")
      .insert({
        studio_id: profile.studio_id,
        session_id,
        member_id,
        credit_deducted: shouldDeductCredit,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      drop_in_id: dropIn.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { drop_in_id } = body;

    if (!drop_in_id) {
      return NextResponse.json(
        { error: "Missing required field: drop_in_id" },
        { status: 400 }
      );
    }

    const { data: dropIn } = await adminSupabase
      .from("drop_in_attendances")
      .select("id, member_id, credit_deducted")
      .eq("id", drop_in_id)
      .single();

    if (!dropIn || dropIn.member_id === undefined) {
      return NextResponse.json(
        { error: "Drop-in attendance not found" },
        { status: 404 }
      );
    }

    const { data: dropInFull } = await adminSupabase
      .from("drop_in_attendances")
      .select("studio_id")
      .eq("id", drop_in_id)
      .single();

    if (!dropInFull || dropInFull.studio_id !== profile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (dropIn.credit_deducted) {
      const { data: member } = await adminSupabase
        .from("members")
        .select("credits")
        .eq("id", dropIn.member_id)
        .single();

      if (member && member.credits !== -1) {
        await adminSupabase
          .from("members")
          .update({ credits: member.credits + 1 })
          .eq("id", dropIn.member_id);
      }
    }

    const { error } = await adminSupabase
      .from("drop_in_attendances")
      .delete()
      .eq("id", drop_in_id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
