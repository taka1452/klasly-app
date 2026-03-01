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

    if (ownerProfile?.role !== "owner") {
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

    // instructors から削除
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
