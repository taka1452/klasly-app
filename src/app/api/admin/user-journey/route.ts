import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextRequest, NextResponse } from "next/server";

type JourneyStage =
  | "signed_up"
  | "studio_created"
  | "payment_complete"
  | "tour_complete"
  | "active_use";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20"))
  );
  const stageFilter = searchParams.get("stage") ?? "all";
  const offset = (page - 1) * limit;

  // Get all owners with studio info
  const { data: owners } = await supabase
    .from("profiles")
    .select(
      "id, email, studio_id, onboarding_completed, onboarding_completed_at, created_at"
    )
    .eq("role", "owner")
    .order("created_at", { ascending: false });

  if (!owners || owners.length === 0) {
    return NextResponse.json({ users: [], total: 0, page, pageSize: limit });
  }

  // Get all studios (non-demo)
  const studioIds = owners
    .map((o) => o.studio_id)
    .filter(Boolean) as string[];
  const { data: studios } =
    studioIds.length > 0
      ? await supabase
          .from("studios")
          .select(
            "id, name, stripe_subscription_id, stripe_connect_onboarding_complete, is_demo, created_at"
          )
          .in("id", studioIds)
      : { data: [] };

  const studioMap = new Map((studios || []).map((s) => [s.id, s]));

  // Get class counts per studio
  const { data: classCounts } =
    studioIds.length > 0
      ? await supabase.from("classes").select("studio_id")
      : { data: [] };

  const classCountMap = new Map<string, number>();
  (classCounts || []).forEach((c) => {
    classCountMap.set(
      c.studio_id,
      (classCountMap.get(c.studio_id) ?? 0) + 1
    );
  });

  // Get instructor counts per studio
  const { data: instructorCounts } =
    studioIds.length > 0
      ? await supabase.from("instructors").select("studio_id")
      : { data: [] };

  const instructorCountMap = new Map<string, number>();
  (instructorCounts || []).forEach((i) => {
    instructorCountMap.set(
      i.studio_id,
      (instructorCountMap.get(i.studio_id) ?? 0) + 1
    );
  });

  // Get member counts per studio
  const { data: memberCounts } =
    studioIds.length > 0
      ? await supabase
          .from("members")
          .select("studio_id")
          .eq("status", "active")
      : { data: [] };

  const memberCountMap = new Map<string, number>();
  (memberCounts || []).forEach((m) => {
    memberCountMap.set(
      m.studio_id,
      (memberCountMap.get(m.studio_id) ?? 0) + 1
    );
  });

  // Compute stage for each owner
  type UserJourneyItem = {
    profileId: string;
    email: string;
    studioId: string | null;
    studioName: string | null;
    stage: JourneyStage;
    createdAt: string;
    setupProgress: {
      hasClasses: boolean;
      hasInstructors: boolean;
      hasMembers: boolean;
      stripeConnect: boolean;
    };
  };

  const allUsers: UserJourneyItem[] = owners
    .filter((o) => {
      const studio = o.studio_id ? studioMap.get(o.studio_id) : null;
      return !studio || !studio.is_demo; // include non-studio users + non-demo studios
    })
    .map((owner) => {
      const studio = owner.studio_id
        ? studioMap.get(owner.studio_id)
        : null;
      const sid = owner.studio_id ?? "";

      let stage: JourneyStage;
      if (!owner.studio_id || !studio) {
        stage = "signed_up";
      } else if (!studio.stripe_subscription_id) {
        stage = "studio_created";
      } else if (!owner.onboarding_completed) {
        stage = "payment_complete";
      } else if ((classCountMap.get(sid) ?? 0) === 0) {
        stage = "tour_complete";
      } else {
        stage = "active_use";
      }

      return {
        profileId: owner.id,
        email: owner.email ?? "",
        studioId: owner.studio_id,
        studioName: studio?.name ?? null,
        stage,
        createdAt: owner.created_at,
        setupProgress: {
          hasClasses: (classCountMap.get(sid) ?? 0) > 0,
          hasInstructors: (instructorCountMap.get(sid) ?? 0) > 0,
          hasMembers: (memberCountMap.get(sid) ?? 0) > 0,
          stripeConnect:
            studio?.stripe_connect_onboarding_complete ?? false,
        },
      };
    });

  // Filter by stage
  const filtered =
    stageFilter === "all"
      ? allUsers
      : allUsers.filter((u) => u.stage === stageFilter);

  // Paginate
  const paginated = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    users: paginated,
    total: filtered.length,
    page,
    pageSize: limit,
  });
}
