import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { rankFromCount, RANK_LABEL, RANK_GRADIENT_CLASS, type Rank } from "@/lib/rank";
import RankCard from "@/components/levels/rank-card";
import { getMemberPercentile } from "@/lib/percentile";
import { unwrapRelation } from "@/lib/supabase/relation";

type AttendanceRow = {
  attended_at: string;
  duration_minutes: number;
  instructor_id: string | null;
  class_type: string | null;
  class_name: string | null;
  instructor_name: string | null;
};

const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function MyStatsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id, lifetime_classes_attended, current_rank, joined_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          You are not a member of any studio yet.
        </p>
      </div>
    );
  }

  const features = await getStudioFeatures(member.studio_id);
  if (features[FEATURE_KEYS.MEMBER_LEVELS] !== true) {
    redirect("/my-bookings");
  }

  const lifetime = member.lifetime_classes_attended ?? 0;
  const rank = ((member.current_rank as Rank | undefined) ?? rankFromCount(lifetime)) as Rank;

  // Pull all attended sessions (booking-attended + drop-in) joined with
  // class & instructor info. Single query each, merged in JS.
  const [bookingsRes, dropInsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `id, attended, member_id, session_id,
         class_sessions:session_id (
           session_date, duration_minutes, instructor_id,
           classes:class_id ( name, class_type )
         )`
      )
      .eq("member_id", member.id)
      .eq("attended", true),
    supabase
      .from("drop_in_attendances")
      .select(
        `attended_at, member_id, session_id,
         class_sessions:session_id (
           session_date, duration_minutes, instructor_id,
           classes:class_id ( name, class_type )
         )`
      )
      .eq("member_id", member.id),
  ]);

  type SessionRel = {
    session_date: string | null;
    duration_minutes: number | null;
    instructor_id: string | null;
    classes: { name: string | null; class_type: string | null } | { name: string | null; class_type: string | null }[] | null;
  };

  const rows: AttendanceRow[] = [];

  for (const b of bookingsRes.data ?? []) {
    const s = unwrapRelation<SessionRel>(b.class_sessions);
    if (!s?.session_date) continue;
    const cls = unwrapRelation<{ name: string | null; class_type: string | null }>(s.classes);
    rows.push({
      attended_at: s.session_date,
      duration_minutes: s.duration_minutes ?? 0,
      instructor_id: s.instructor_id,
      class_type: cls?.class_type ?? null,
      class_name: cls?.name ?? null,
      instructor_name: null,
    });
  }
  for (const d of dropInsRes.data ?? []) {
    const s = unwrapRelation<SessionRel>(d.class_sessions);
    if (!s) continue;
    const cls = unwrapRelation<{ name: string | null; class_type: string | null }>(s.classes);
    rows.push({
      attended_at: (d.attended_at ?? s.session_date ?? "").slice(0, 10),
      duration_minutes: s.duration_minutes ?? 0,
      instructor_id: s.instructor_id,
      class_type: cls?.class_type ?? null,
      class_name: cls?.name ?? null,
      instructor_name: null,
    });
  }

  // Resolve instructor names
  const instructorIds = Array.from(
    new Set(rows.map((r) => r.instructor_id).filter((x): x is string => !!x))
  );
  const instructorNameById: Record<string, string> = {};
  if (instructorIds.length > 0) {
    const { data: instructors } = await supabase
      .from("instructors")
      .select("id, profile_id, profiles:profile_id ( full_name )")
      .in("id", instructorIds);
    for (const i of instructors ?? []) {
      const p = unwrapRelation<{ full_name: string | null }>(i.profiles);
      instructorNameById[i.id] = p?.full_name ?? "Instructor";
    }
  }

  // Aggregations
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const totalMinutes = rows.reduce((acc, r) => acc + (r.duration_minutes || 0), 0);
  const thisMonth = rows.filter((r) => {
    const d = new Date(r.attended_at);
    return d.getFullYear() === yyyy && d.getMonth() === mm;
  }).length;
  const thisYear = rows.filter((r) => new Date(r.attended_at).getFullYear() === yyyy).length;

  const instructorCounts: Record<string, number> = {};
  for (const r of rows) {
    if (!r.instructor_id) continue;
    instructorCounts[r.instructor_id] = (instructorCounts[r.instructor_id] || 0) + 1;
  }
  const topInstructors = Object.entries(instructorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      name: instructorNameById[id] ?? "Instructor",
      count,
    }));

  const classTypeCounts: Record<string, number> = {};
  for (const r of rows) {
    const key = (r.class_type || r.class_name || "Other").trim() || "Other";
    classTypeCounts[key] = (classTypeCounts[key] || 0) + 1;
  }
  const classTypeTotal = Object.values(classTypeCounts).reduce((a, b) => a + b, 0);
  const classTypes = Object.entries(classTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      pct: classTypeTotal === 0 ? 0 : Math.round((count / classTypeTotal) * 100),
    }));

  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const d = new Date(r.attended_at);
    if (!isNaN(d.getTime())) dowCounts[d.getDay()]++;
  }
  const topDow = dowCounts.indexOf(Math.max(...dowCounts));

  const [studioPct, systemPct] = await Promise.all([
    getMemberPercentile(member.id, "studio"),
    getMemberPercentile(member.id, "system"),
  ]);

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Your Practice</h1>
        <p className="mt-1 text-sm text-gray-500">
          A snapshot of your journey across this studio.
        </p>
      </div>

      <RankCard rank={rank} lifetimeClasses={lifetime} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="This month" value={thisMonth} suffix="classes" />
        <StatTile label="This year" value={thisYear} suffix="classes" />
        <StatTile
          label="Total practice"
          value={totalHours}
          suffix={`hr ${remainingMinutes}min`}
        />
      </div>

      {topInstructors.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Favorite instructors</h2>
          <ol className="space-y-2">
            {topInstructors.map((t, i) => (
              <li key={t.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                    {i + 1}
                  </span>
                  <span className="text-gray-900">{t.name}</span>
                </span>
                <span className="text-gray-500">{t.count}×</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {classTypes.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Class mix</h2>
          <ul className="space-y-2.5">
            {classTypes.map((c) => (
              <li key={c.name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-500">
                    {c.count} · {c.pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full bg-gradient-to-r ${RANK_GRADIENT_CLASS[rank]}`}
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dowCounts.some((c) => c > 0) && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Your weekly rhythm</h2>
          <div className="grid grid-cols-7 gap-1">
            {dowCounts.map((c, i) => {
              const max = Math.max(...dowCounts, 1);
              const intensity = Math.round((c / max) * 100);
              return (
                <div key={i} className="text-center">
                  <div
                    className={`mx-auto h-12 w-full rounded ${
                      i === topDow ? "bg-yellow-400" : "bg-gray-200"
                    }`}
                    style={{ opacity: c === 0 ? 0.25 : 0.4 + intensity / 200 }}
                    title={`${DOW_LABEL[i]}: ${c}`}
                  />
                  <p className="mt-1 text-[10px] text-gray-500">{DOW_LABEL[i]}</p>
                  <p className="text-xs font-medium text-gray-700">{c}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Most-attended day: <span className="font-medium text-gray-700">{DOW_LABEL[topDow]}</span>
          </p>
        </section>
      )}

      {(studioPct.topPercent !== null || systemPct.topPercent !== null) && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Where you stand</h2>
          <ul className="space-y-2 text-sm">
            {studioPct.topPercent !== null && (
              <li className="flex items-baseline justify-between">
                <span className="text-gray-700">In this studio</span>
                <span className="text-gray-900">
                  Top <span className="font-semibold">{studioPct.topPercent}%</span>
                  <span className="ml-1 text-xs text-gray-400">
                    of {studioPct.totalMembers}
                  </span>
                </span>
              </li>
            )}
            {systemPct.topPercent !== null && (
              <li className="flex items-baseline justify-between">
                <span className="text-gray-700">Across all studios</span>
                <span className="text-gray-900">
                  Top <span className="font-semibold">{systemPct.topPercent}%</span>
                  <span className="ml-1 text-xs text-gray-400">
                    of {systemPct.totalMembers}
                  </span>
                </span>
              </li>
            )}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Member names are never shared. Only your own ranking is visible to you.
          </p>
        </section>
      )}

      <div className="flex justify-center pt-2">
        <Link
          href="/my-bookings"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          ← Back to bookings
        </Link>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{suffix}</p>
    </div>
  );
}
