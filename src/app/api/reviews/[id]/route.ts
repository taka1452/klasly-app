import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { unwrapRelation } from "@/lib/supabase/relation";

const EDIT_WINDOW_DAYS = 7;

/**
 * Look up a review and verify it belongs to the authenticated user.
 * Returns the review row when ownership matches; otherwise an error response
 * (404 if not found, 403 if it belongs to someone else).
 */
async function loadOwnedReview(
  supabase: SupabaseClient,
  reviewId: string,
  profileId: string
): Promise<
  | {
      ok: true;
      review: {
        id: string;
        member_id: string;
        created_at: string;
      };
    }
  | { ok: false; response: NextResponse }
> {
  const { data: review } = await supabase
    .from("class_reviews")
    .select("id, member_id, created_at, members!inner(profile_id)")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      ),
    };
  }

  const reviewRow = review as {
    id: string;
    member_id: string;
    created_at: string;
    members?:
      | { profile_id?: string | null }
      | { profile_id?: string | null }[]
      | null;
  };

  const memberRel = unwrapRelation<{ profile_id?: string | null }>(
    reviewRow.members
  );
  if (!memberRel || memberRel.profile_id !== profileId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    review: {
      id: reviewRow.id,
      member_id: reviewRow.member_id,
      created_at: reviewRow.created_at,
    },
  };
}

/**
 * PATCH /api/reviews/[id]
 * Update the authenticated member's own review.
 * Body: { rating?: number (1-5), comment?: string (<=500 chars) }
 * Rejects edits older than 7 days from creation.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const lookup = await loadOwnedReview(supabase, id, user.id);
    if (!lookup.ok) return lookup.response;
    const review = lookup.review;

    // 7-day edit window
    const created = new Date(review.created_at).getTime();
    if (
      Number.isFinite(created) &&
      Date.now() - created > EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ) {
      return NextResponse.json(
        { error: `Reviews can only be edited within ${EDIT_WINDOW_DAYS} days of posting` },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { rating?: unknown; comment?: unknown }
      | null;
    if (!body || (body.rating === undefined && body.comment === undefined)) {
      return NextResponse.json(
        { error: "rating or comment required" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.rating !== undefined) {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "rating must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
      updates.rating = rating;
    }

    if (body.comment !== undefined) {
      if (body.comment === null) {
        updates.comment = null;
      } else if (typeof body.comment === "string") {
        const trimmed = body.comment.trim();
        if (trimmed.length > 500) {
          return NextResponse.json(
            { error: "comment must be 500 characters or fewer" },
            { status: 400 }
          );
        }
        updates.comment = trimmed.length === 0 ? null : trimmed;
      } else {
        return NextResponse.json(
          { error: "comment must be a string" },
          { status: 400 }
        );
      }
    }

    const { data: updated, error } = await supabase
      .from("class_reviews")
      .update(updates)
      .eq("id", review.id)
      .select("id, rating, comment, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ review: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/reviews/[id]
 * Hard-delete the authenticated member's own review.
 * (No soft-delete column exists on class_reviews.)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const lookup = await loadOwnedReview(supabase, id, user.id);
    if (!lookup.ok) return lookup.response;

    const { error } = await supabase
      .from("class_reviews")
      .delete()
      .eq("id", lookup.review.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
