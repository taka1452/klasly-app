import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { DEFAULT_FEATURES, type FeatureKey } from "./feature-keys";

/**
 * Get a Supabase client that can read studio_features.
 * Uses service role key if available, otherwise falls back to server client.
 */
async function getSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );
  }
  return createServerClient();
}

/**
 * Check if a single feature is enabled for a studio (server-side).
 *
 * Usage:
 *   const enabled = await isFeatureEnabled(studioId, FEATURE_KEYS.ROOM_MANAGEMENT);
 *   if (!enabled) redirect('/dashboard');
 */
export async function isFeatureEnabled(
  studioId: string,
  featureKey: FeatureKey
): Promise<boolean> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("studio_features")
    .select("enabled")
    .eq("studio_id", studioId)
    .eq("feature_key", featureKey)
    .single();

  // No record = use default value
  if (error || !data) {
    return DEFAULT_FEATURES[featureKey] ?? false;
  }

  return data.enabled;
}

/**
 * Get all feature flags for a studio in one query (server-side).
 * Returns a complete map with defaults filled in for missing records.
 *
 * Usage:
 *   const features = await getStudioFeatures(studioId);
 *   if (features['collective.room_management']) { ... }
 */
export async function getStudioFeatures(
  studioId: string
): Promise<Record<string, boolean>> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("studio_features")
    .select("feature_key, enabled")
    .eq("studio_id", studioId);

  // Start with defaults
  const features: Record<string, boolean> = { ...DEFAULT_FEATURES };

  // Override with DB records
  if (data && !error) {
    for (const row of data) {
      features[row.feature_key] = row.enabled;
    }
  }

  return features;
}
