import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instructorId } = await context.params;
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
        { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set." },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: ownerProfile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (ownerProfile?.role === "manager") {
      const { data: mgr } = await adminSupabase
        .from("managers")
        .select("can_manage_instructors")
        .eq("profile_id", user.id)
        .eq("studio_id", ownerProfile.studio_id)
        .single();

      if (!mgr?.can_manage_instructors) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (ownerProfile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: instructor, error: fetchError } = await adminSupabase
      .from("instructors")
      .select("id, studio_id, profile_id")
      .eq("id", instructorId)
      .single();

    if (fetchError || !instructor) {
      return NextResponse.json(
        { error: "Instructor not found" },
        { status: 404 }
      );
    }

    if (instructor.studio_id !== ownerProfile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profileId = instructor.profile_id as string;

    // クラスの担当を外す
    await adminSupabase
      .from("classes")
      .update({ instructor_id: null })
      .eq("instructor_id", instructorId);

    // SOAPノートの instructor_id を null にして記録を保持
    await adminSupabase
      .from("soap_notes")
      .update({ instructor_id: null })
      .eq("instructor_id", instructorId);

    // class_sessions の instructor_id を null にする
    await adminSupabase
      .from("class_sessions")
      .update({ instructor_id: null })
      .eq("instructor_id", instructorId);

    // instructor_earnings の instructor_id を null にして記録を保持（会計監査用）
    await adminSupabase
      .from("instructor_earnings")
      .update({ instructor_id: null })
      .eq("instructor_id", instructorId);

    // pass_distributions の instructor_id を null にして記録を保持
    await adminSupabase
      .from("pass_distributions")
      .update({ instructor_id: null })
      .eq("instructor_id", instructorId);

    // 未精算の overage_charges を確認
    const { count: pendingCharges } = await adminSupabase
      .from("instructor_overage_charges")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", instructorId)
      .eq("status", "pending");

    if (pendingCharges && pendingCharges > 0) {
      // pending の charges を waived に更新（削除による免除）
      await adminSupabase
        .from("instructor_overage_charges")
        .update({ status: "waived", waived_reason: "Instructor removed from studio" })
        .eq("instructor_id", instructorId)
        .eq("status", "pending");
    }

    // instructor_memberships の Stripe サブスクリプションをキャンセル
    const { data: memberships } = await adminSupabase
      .from("instructor_memberships")
      .select("stripe_subscription_id")
      .eq("instructor_id", instructorId)
      .not("stripe_subscription_id", "is", null);

    if (memberships && memberships.length > 0) {
      try {
        const { getStripe } = await import("@/lib/stripe/server");
        const stripe = getStripe();
        for (const m of memberships) {
          if (!m.stripe_subscription_id) continue;
          try {
            await stripe.subscriptions.cancel(m.stripe_subscription_id);
          } catch {
            // Subscription may already be cancelled
          }
        }
      } catch {
        console.error("[InstructorDelete] Failed to cancel Stripe subscriptions");
      }
    }

    // instructors から削除（CASCADE で memberships, fee_overrides, room_bookings が削除される）
    const { error: deleteError } = await adminSupabase
      .from("instructors")
      .delete()
      .eq("id", instructorId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    // 他ロールで使われていなければ Auth ユーザーを削除
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", profileId)
      .single();

    if (profile?.role === "owner") {
      return NextResponse.json({ success: true });
    }

    const { count: otherInstructors } = await adminSupabase
      .from("instructors")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);

    const { count: asMember } = await adminSupabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);

    const stillUsed =
      (otherInstructors ?? 0) > 0 || (asMember ?? 0) > 0;

    if (!stillUsed) {
      // メッセージの送受信者を null に設定（CASCADE 削除防止 — 会話履歴を保持）
      await adminSupabase
        .from("messages")
        .update({ sender_id: null })
        .eq("sender_id", profileId);
      await adminSupabase
        .from("messages")
        .update({ recipient_id: null })
        .eq("recipient_id", profileId);

      // プロフィールとAuthユーザーを削除
      await adminSupabase.from("profiles").delete().eq("id", profileId);
      const { error: authDeleteError } =
        await adminSupabase.auth.admin.deleteUser(profileId);
      if (authDeleteError) {
        console.error("Failed to delete auth user:", authDeleteError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
