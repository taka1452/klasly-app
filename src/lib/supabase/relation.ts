/**
 * Supabase のリレーションクエリ結果を安全に単一オブジェクトとして取得するヘルパー。
 *
 * Supabase の .select("table(col1, col2)") は、リレーションの種類（1:1 or 1:N）に
 * よって結果が単一オブジェクトまたは配列で返る。TypeScript の型推論が正確でない
 * ケースがあるため、このヘルパーで安全に変換する。
 *
 * @example
 * const { data } = await supabase.from("bookings").select("member_id, studio_passes(id, name)").single();
 * const pass = unwrapRelation<{ id: string; name: string }>(data?.studio_passes);
 */
export function unwrapRelation<T>(
  value: T | T[] | null | undefined
): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/**
 * リレーション結果を配列として安全に取得するヘルパー。
 *
 * @example
 * const items = unwrapRelationArray<{ id: string }>(data?.items);
 */
export function unwrapRelationArray<T>(
  value: T | T[] | null | undefined
): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}
