import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role, studio_id")
      .eq("id", user.id)
      .single();

    // studio_id がない場合 → オンボーディングへ（role に関わらず）
    if (!profile?.studio_id) {
      redirect("/onboarding");
    }

    // Role 判定（studio_id がある場合のみ）
    if (profile?.role === "owner") {
      redirect("/dashboard");
    }
    if (profile?.role === "instructor") {
      redirect("/instructor");
    }
    if (profile?.role === "member") {
      redirect("/schedule");
    }
  }

  // 4. フォールバック
  redirect("/dashboard");
}
