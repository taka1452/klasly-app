import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminEmail } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { parseBody } from "@/lib/api/parse-body";
import { cancelSubscriptionSafe } from "@/lib/admin/stripe-helpers";
import { insertAdminLog } from "@/lib/admin/logs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const adminEmail = await getAdminEmail();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const schema = z.object({ confirm_name: z.string() });
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const confirmName = body.confirm_name.trim();

    const { data: studio } = await supabase
      .from("studios")
      .select("id, name, stripe_subscription_id")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    if (confirmName !== studio.name) {
      return NextResponse.json(
        { error: "Studio name does not match. Type the exact name to confirm." },
        { status: 400 }
      );
    }

    // Stripe subscription をキャンセルしてから DB を削除する
    // (orphaned subscription による継続課金を防止)
    const subId = studio.stripe_subscription_id as string | null;
    if (subId) {
      const stripeError = await cancelSubscriptionSafe(
        subId,
        `delete studio ${studioId}`
      );
      if (stripeError) {
        await insertAdminLog(supabase, {
          action: "delete-studio",
          studio_id: studioId,
          admin_email: adminEmail,
          status: "error",
          error_message: "Stripe subscription cancel failed",
          details: { studioName: studio.name },
        });
        return stripeError;
      }
    }

    const { error } = await supabase
      .from("studios")
      .delete()
      .eq("id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 削除成功後のログ（studio行は消えるので studio_id は null にする）
    await insertAdminLog(supabase, {
      action: "delete-studio",
      studio_id: null,
      admin_email: adminEmail,
      status: "success",
      details: { deletedStudioId: studioId, studioName: studio.name, hadSubscription: !!subId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
