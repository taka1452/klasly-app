import { createAdminClient } from "@/lib/admin/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const adminDb = createAdminClient();

  // コードの有効性を確認
  const { data: refCode } = await adminDb
    .from("referral_codes")
    .select("studio_id")
    .eq("code", upperCode)
    .single();

  if (!refCode) {
    // 無効なコードは通常のログインページにリダイレクト
    redirect("/login");
  }

  // 紹介者のスタジオ名を取得
  const { data: studio } = await adminDb
    .from("studios")
    .select("name")
    .eq("id", refCode.studio_id)
    .single();

  const studioName = studio?.name ?? "A Klasly studio";

  // cookieに保存（30日有効）
  const cookieStore = await cookies();
  cookieStore.set("klasly_referral", upperCode, {
    maxAge: 30 * 24 * 60 * 60, // 30日
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold text-brand-700">
            Klasly
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {/* Referral Banner */}
        <div className="mb-8 rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
          <div className="mb-3 text-3xl">🎁</div>
          <h1 className="text-xl font-bold text-gray-900">
            You&apos;ve been referred by {studioName}!
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign up now and get your first month free.
          </p>
        </div>

        {/* Main CTA */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">
            Run your studio with Klasly
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-600">
            The all-in-one platform for fitness and wellness studios.
            Manage classes, members, bookings, and payments — all in one place.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Start Free Trial →
            </Link>
            <p className="text-xs text-gray-500">
              30-day free trial · No credit card required
            </p>
          </div>

          <div className="mt-8 rounded-lg bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              How it works
            </h3>
            <div className="mt-3 flex flex-col gap-2 text-left text-sm text-gray-600">
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  1
                </span>
                <span>Sign up and set up your studio (takes 5 minutes)</span>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  2
                </span>
                <span>Enjoy a 30-day free trial with all features</span>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  3
                </span>
                <span>
                  When you subscribe, both you and {studioName} get 1 month free!
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <p className="text-xs text-gray-500">© 2026 Klasly. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-700">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-gray-500 hover:text-gray-700">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
