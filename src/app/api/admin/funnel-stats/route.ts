import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  await requireAdmin();
  const supabase = createAdminClient();

  // Stage 1: signed_up - profiles where role='owner'
  const { count: signedUp } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");

  // Stage 2: studio_created - profiles where role='owner' AND studio_id IS NOT NULL
  const { count: studioCreated } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")
    .not("studio_id", "is", null);

  // Stage 3: payment_complete - studios with stripe_subscription_id, not demo
  const { count: paymentComplete } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .not("stripe_subscription_id", "is", null)
    .eq("is_demo", false);

  // Stage 4: tour_complete - need to join profiles (onboarding_completed=true) with studios (is_demo=false)
  // Query profiles with onboarding_completed and then filter by non-demo studio
  const { data: tourProfiles } = await supabase
    .from("profiles")
    .select("id, studio_id")
    .eq("role", "owner")
    .eq("onboarding_completed", true)
    .not("studio_id", "is", null);

  // Filter out demo studios
  let tourComplete = 0;
  if (tourProfiles && tourProfiles.length > 0) {
    const studioIds = tourProfiles
      .map((p) => p.studio_id)
      .filter(Boolean) as string[];
    if (studioIds.length > 0) {
      const { data: nonDemoStudios } = await supabase
        .from("studios")
        .select("id")
        .in("id", studioIds)
        .eq("is_demo", false);
      tourComplete = nonDemoStudios?.length ?? 0;
    }
  }

  // Stage 5: active_use - studios with at least 1 class, not demo
  const { data: studiosWithClasses } = await supabase
    .from("classes")
    .select("studio_id")
    .limit(1000);

  const uniqueStudiosWithClasses = new Set(
    (studiosWithClasses || []).map((c) => c.studio_id)
  );

  // Get non-demo studios
  const { data: allNonDemo } = await supabase
    .from("studios")
    .select("id")
    .eq("is_demo", false);

  const activeUse = (allNonDemo || []).filter((s) =>
    uniqueStudiosWithClasses.has(s.id)
  ).length;

  const stages = [
    { name: "signed_up", count: signedUp ?? 0 },
    { name: "studio_created", count: studioCreated ?? 0 },
    { name: "payment_complete", count: paymentComplete ?? 0 },
    { name: "tour_complete", count: tourComplete },
    { name: "active_use", count: activeUse },
  ];

  // Calculate conversion rates
  const stagesWithRate = stages.map((stage, i) => ({
    ...stage,
    rate:
      i === 0
        ? 100
        : stages[i - 1].count > 0
          ? Math.round((stage.count / stages[i - 1].count) * 100)
          : 0,
  }));

  return NextResponse.json({ stages: stagesWithRate });
}
