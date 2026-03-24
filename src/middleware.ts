import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { validateCsrfInMiddleware } from "@/lib/api/csrf-middleware";
import { checkRateLimit } from "@/lib/rate-limit-edge";

export async function middleware(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // ── API ルート: CSRF 検証 + レート制限 ──
  if (isApiRoute) {
    // 1. CSRF 検証（POST/PUT/PATCH/DELETE のみ、除外パスあり）
    const csrfError = await validateCsrfInMiddleware(request);
    if (csrfError) return csrfError;

    // 2. レート制限（POST/PUT/PATCH/DELETE のみ）
    const rateLimitError = await checkRateLimit(request);
    if (rateLimitError) return rateLimitError;

    // API ルートは認証チェック不要（各ルートで実施）
    return NextResponse.next();
  }

  // ── ページルート: 認証チェック ──
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションの更新
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 認証不要ページの判定
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/set-password") ||
    request.nextUrl.pathname.startsWith("/auth");

  const isPublicPage =
    request.nextUrl.pathname.startsWith("/privacy") ||
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/cookies") ||
    request.nextUrl.pathname.startsWith("/help") ||
    request.nextUrl.pathname.startsWith("/events") ||
    request.nextUrl.pathname.startsWith("/ref");

  const isWaiverPage = request.nextUrl.pathname.startsWith("/waiver");
  const isWidgetPage = request.nextUrl.pathname.startsWith("/widget");
  const isInstructorJoinPage = request.nextUrl.pathname.startsWith("/instructor-join");

  // 未ログインユーザーを認証ページ・公開ページ・waiver署名ページ・ウィジェットページ以外からリダイレクト
  if (!user && !isAuthPage && !isPublicPage && !isWaiverPage && !isWidgetPage && !isInstructorJoinPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ログイン済みユーザーが認証ページにアクセスしたらホームへ（/でロールに応じてリダイレクト）
  // （ただし auth/callback, set-password, onboarding は除外）
  // waiver署名ページはログイン済みでもアクセス可能（メールリンク経由）
  if (
    user &&
    isAuthPage &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/set-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ロール別リダイレクトは Server Component（layout）で実施
  // - member → /dashboard 等: (dashboard)/layout.tsx で /schedule へリダイレクト
  // - owner → /schedule, /my-bookings: (member)/layout.tsx で /dashboard へリダイレクト

  return supabaseResponse;
}

export const config = {
  matcher: [
    // 静的ファイル以外すべて（API ルートも含む）
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|sw\\.js|manifest\\.json|icons/).*)",
  ],
};
