import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { unwrapRelation } from "@/lib/supabase/relation";

export default async function ReviewsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) redirect("/login");

  // Fetch reviews
  const { data: reviews } = await supabase
    .from("class_reviews")
    .select(`
      id,
      rating,
      comment,
      created_at,
      members (
        profiles (full_name)
      ),
      classes (name),
      class_sessions (session_date)
    `)
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Compute averages by class
  const { data: avgData } = await supabase
    .from("class_reviews")
    .select("class_id, rating")
    .eq("studio_id", profile.studio_id);

  const classStats: Record<string, { total: number; count: number }> = {};
  (avgData || []).forEach((r) => {
    if (!classStats[r.class_id]) classStats[r.class_id] = { total: 0, count: 0 };
    classStats[r.class_id].total += r.rating;
    classStats[r.class_id].count += 1;
  });

  const totalReviews = (reviews || []).length;
  const overallAvg = totalReviews > 0
    ? (reviews || []).reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Class Reviews</h1>
      <p className="mt-1 text-sm text-gray-500">
        See what members think about your classes
      </p>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Total Reviews</p>
          <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Average Rating</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-gray-900">
              {overallAvg > 0 ? overallAvg.toFixed(1) : "—"}
            </p>
            {overallAvg > 0 && (
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <div className="mt-8 space-y-4">
        {(reviews || []).length === 0 ? (
          <div className="card">
            <p className="text-sm text-gray-500">
              No reviews yet. Reviews will appear here after members rate their classes.
            </p>
          </div>
        ) : (
          (reviews || []).map((review) => {
            const memberRel = unwrapRelation<{ profiles: { full_name: string } | { full_name: string }[] }>(review.members);
            const profileRel = memberRel ? unwrapRelation<{ full_name: string }>(memberRel.profiles) : null;
            const memberName = profileRel?.full_name || "Member";
            const classRel = unwrapRelation<{ name: string }>(review.classes);
            const sessionRel = unwrapRelation<{ session_date: string }>(review.class_sessions);

            return (
              <div key={review.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{classRel?.name || "Class"}</p>
                    <p className="text-sm text-gray-500">
                      by {memberName} · {sessionRel?.session_date && formatDate(sessionRel.session_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? "text-yellow-400" : "text-gray-300"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-gray-700">{review.comment}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
