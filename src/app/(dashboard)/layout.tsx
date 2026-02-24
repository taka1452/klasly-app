import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Sidebar from "@/components/ui/sidebar";
import Header from "@/components/ui/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // プロフィール取得（service_role で RLS をバイパス）
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { data: profile } = serviceRoleKey
    ? await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
      .from("profiles")
      .select("*, studios(*)")
      .eq("id", user.id)
      .single()
    : await supabase
        .from("profiles")
        .select("*, studios(*)")
        .eq("id", user.id)
        .single();

  // スタジオ未作成の場合はオンボーディングへ
  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  // 会員は会員用画面へ
  if (profile?.role === "member") {
    redirect("/schedule");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentRole={profile.role}
        studioName={profile.studios?.name || "My Studio"}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={profile.full_name || user.email || "User"}
          userEmail={user.email || ""}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
