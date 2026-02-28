import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { couponId } = await params;

    const body = await request.json().catch(() => ({}));
    const status = body.status === "inactive" ? "inactive" : "active";

    const { error } = await supabase.from("coupons").update({ status }).eq("id", couponId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
