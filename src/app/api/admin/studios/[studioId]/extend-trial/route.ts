import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const body = await request.json();
    const days = typeof body.days === "number" ? body.days : parseInt(String(body.days), 10);
    if (Number.isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: "Invalid days (1–365)" },
        { status: 400 }
      );
    }

    const { data: studio } = await supabase
      .from("studios")
      .select("id, trial_ends_at")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const base = (studio.trial_ends_at && new Date(studio.trial_ends_at) > new Date())
      ? new Date(studio.trial_ends_at)
      : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + days);

    const { error } = await supabase
      .from("studios")
      .update({ trial_ends_at: newEnd.toISOString().split("T")[0] })
      .eq("id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      trial_ends_at: newEnd.toISOString().split("T")[0],
    });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
