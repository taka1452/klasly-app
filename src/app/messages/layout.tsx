import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import MemberHeader from "@/components/member/member-header";

/**
 * /messages レイアウト
 * ルートグループ外に配置することでオーナー・メンバー両方がアクセス可能。
 * ロールに応じて適切なナビゲーション chrome を描画する。
 */
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  if (profile.role === "instructor") {
    redirect("/instructor");
  }

  if (profile.role === "owner") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* オーナー用ヘッダー: ダッシュボードに戻るリンク付き */}
        <header className="border-b border-gray-200 bg-white">
          <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-sm font-semibold text-gray-900">Messages</h1>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    );
  }

  // メンバー用レイアウト
  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader
        userName={profile.full_name || user.email || "Member"}
        userEmail={user.email || ""}
      />
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex gap-6">
            <Link
              href="/schedule"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Schedule
            </Link>
            <Link
              href="/my-bookings"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              My Bookings
            </Link>
            <Link
              href="/purchase"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Purchase
            </Link>
            <Link
              href="/my-payments"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Payments
            </Link>
            <Link
              href="/messages"
              className="text-sm font-semibold text-brand-700 hover:text-brand-900"
            >
              Messages
            </Link>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
