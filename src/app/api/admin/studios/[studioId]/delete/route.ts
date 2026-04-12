import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/parse-body";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
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
    if (studio.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(studio.stripe_subscription_id as string);
      } catch (stripeErr: unknown) {
        // 既にキャンセル済み or 存在しない場合は続行
        const code = (stripeErr as { code?: string })?.code;
        if (code !== "resource_missing") {
          console.error("[Admin] delete: Stripe subscription cancel failed", stripeErr);
          const message = stripeErr instanceof Error ? stripeErr.message : "Stripe cancel failed";
          return NextResponse.json(
            { error: `Failed to cancel Stripe subscription: ${message}. Studio not deleted.` },
            { status: 502 }
          );
        }
      }
    }

    const { error } = await supabase
      .from("studios")
      .delete()
      .eq("id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
