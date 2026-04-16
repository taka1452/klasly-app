import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

function getActivityStatus(lastActiveAt: string | null): "active" | "inactive" | "dormant" {
  if (!lastActiveAt) return "dormant";
  const elapsed = Date.now() - new Date(lastActiveAt).getTime();
  if (elapsed <= THIRTY_DAYS) return "active";
  if (elapsed <= NINETY_DAYS) return "inactive";
  return "dormant";
}

/**
 * Returns the most recent of the two timestamps, or null if both are null.
 */
function latestTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
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
    .select("id, full_name, email, role, last_active_at")
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

  // profiles.last_active_at を優先し、ない場合は auth.users.last_sign_in_at にフォールバック
  const results = await Promise.all(
    profiles.map(async (profile) => {
      let lastSignInAt: string | null = null;

      try {
        const { data } = await supabase.auth.admin.getUserById(profile.id);
        lastSignInAt = data?.user?.last_sign_in_at ?? null;
      } catch {
        // auth user が見つからない場合は null のまま
      }

      const lastActiveAt = latestTimestamp(profile.last_active_at ?? null, lastSignInAt);

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        // Keep the old field name for backward compatibility with clients,
        // but the value is now "last active", not just "last sign in".
        last_sign_in_at: lastActiveAt,
        last_active_at: lastActiveAt,
        status: getActivityStatus(lastActiveAt),
      };
    })
  );

  // active → inactive → dormant の順、同じステータス内は最終操作日時降順
  const order = { active: 0, inactive: 1, dormant: 2 };
  results.sort((a, b) => {
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    if (!a.last_active_at) return 1;
    if (!b.last_active_at) return -1;
    return new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime();
  });

  return NextResponse.json(results);
}
