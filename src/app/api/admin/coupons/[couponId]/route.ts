import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { z } from "zod";
import { parseBody } from "@/lib/api/parse-body";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { couponId } = await params;

    const schema = z.object({ status: z.enum(["active", "inactive"]).default("active") });
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const status = body.status;

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
