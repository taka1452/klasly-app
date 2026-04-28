import { ImageResponse } from "next/og";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { getWrapped, isWrappedActive } from "@/lib/wrapped";
import { RANK_LABEL } from "@/lib/rank";

export const runtime = "nodejs";

const RANK_BG: Record<string, string> = {
  bronze: "linear-gradient(135deg, #b45309, #78350f)",
  silver: "linear-gradient(135deg, #cbd5e1, #64748b)",
  gold: "linear-gradient(135deg, #fde047, #ca8a04)",
  platinum: "linear-gradient(135deg, #67e8f9, #0891b2)",
  diamond: "linear-gradient(135deg, #f0abfc, #a855f7)",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(year)) {
    return new Response("Bad year", { status: 400 });
  }

  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "1";

  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    : serverSupabase;

  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!member) return new Response("No member", { status: 404 });

  const features = await getStudioFeatures(member.studio_id);
  if (features[FEATURE_KEYS.MEMBER_LEVELS] !== true) {
    return new Response("Feature disabled", { status: 403 });
  }
  if (!isPreview && !isWrappedActive(year)) {
    return new Response("Out of season", { status: 403 });
  }

  const wrapped = await getWrapped(member.id, year);
  if (!wrapped) return new Response("No data", { status: 404 });

  const hours = Math.floor(wrapped.totalMinutes / 60);
  const rank = wrapped.rankAfter;
  const rankInitial = RANK_LABEL[rank][0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "white",
          padding: "80px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            color: "#94a3b8",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <span>Klasly · {year}</span>
          <span>Wrapped</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            gap: 48,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 36, color: "#94a3b8" }}>
              Classes attended
            </span>
            <span
              style={{
                fontSize: 220,
                fontWeight: 800,
                lineHeight: 1,
                marginTop: 8,
                background: "linear-gradient(135deg, #38bdf8, #c084fc, #fbbf24)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {wrapped.totalClasses}
            </span>
          </div>

          <div
            style={{ display: "flex", gap: 64, fontSize: 40, color: "#e2e8f0" }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 28, color: "#94a3b8" }}>Time on mat</span>
              <span style={{ fontSize: 64, fontWeight: 700, marginTop: 4 }}>
                {hours} hr
              </span>
            </div>
            {wrapped.studioPercentile !== null && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 28, color: "#94a3b8" }}>
                  Studio rank
                </span>
                <span style={{ fontSize: 64, fontWeight: 700, marginTop: 4 }}>
                  Top {wrapped.studioPercentile}%
                </span>
              </div>
            )}
          </div>

          {wrapped.topInstructor && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 28, color: "#94a3b8" }}>
                Most-with instructor
              </span>
              <span style={{ fontSize: 56, fontWeight: 700, marginTop: 4 }}>
                {wrapped.topInstructor.name}
              </span>
            </div>
          )}

          {wrapped.topClassType && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 28, color: "#94a3b8" }}>
                Favorite style
              </span>
              <span style={{ fontSize: 56, fontWeight: 700, marginTop: 4 }}>
                {wrapped.topClassType.name}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginTop: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 9999,
              background: RANK_BG[rank] ?? RANK_BG.bronze,
              fontSize: 48,
              fontWeight: 800,
              color: "white",
            }}
          >
            {rankInitial}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 24, color: "#94a3b8" }}>
              {wrapped.rankChanged
                ? `${RANK_LABEL[wrapped.rankBefore]} → ${RANK_LABEL[rank]}`
                : "Current rank"}
            </span>
            <span style={{ fontSize: 44, fontWeight: 700 }}>
              {RANK_LABEL[rank]} member
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    }
  );
}
