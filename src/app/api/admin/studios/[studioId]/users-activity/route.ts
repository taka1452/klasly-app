import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

function getActivityStatus(lastSignInAt: string | null): "active" | "inactive" | "dormant" {
  if (!lastSignInAt) return "dormant";
  const elapsed = Date.now() - new Date(lastSignInAt).getTime();
  if (elapsed <= THIRTY_DAYS) return "active";
  if (elapsed <= NINETY_DAYS) return "inactive";
  return "dormant";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { studioId } = await params;
  const supabase = createAdminClient();

  // スタジオに所属する owner / manager / instructor を取得
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("studio_id", studioId)
    .in("role", ["owner", "manager", "instructor"]);

  if (profilesError) {
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json([]);
  }

  // auth.users から last_sign_in_at を取得
  const results = await Promise.all(
    profiles.map(async (profile) => {
      let lastSignInAt: string | null = null;

      try {
        const { data } = await supabase.auth.admin.getUserById(profile.id);
        lastSignInAt = data?.user?.last_sign_in_at ?? null;
      } catch {
        // auth user が見つからない場合は null のまま
      }

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        last_sign_in_at: lastSignInAt,
        status: getActivityStatus(lastSignInAt),
      };
    })
  );

  // active → inactive → dormant の順、同じステータス内は最終ログイン降順
  const order = { active: 0, inactive: 1, dormant: 2 };
  results.sort((a, b) => {
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    if (!a.last_sign_in_at) return 1;
    if (!b.last_sign_in_at) return -1;
    return new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime();
  });

  return NextResponse.json(results);
}
