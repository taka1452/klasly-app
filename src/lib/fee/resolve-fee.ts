/**
 * 料金解決ロジック
 *
 * 優先順位（Phase 3 で拡張予定）:
 * 1. class_fee_overrides   （クラス別: Phase 3a）
 * 2. fee_schedules         （時間帯別: Phase 3b）
 * 3. instructor_fee_overrides（インストラクター別: Phase 2a）
 * 4. studios デフォルト     （スタジオ全体: Phase 2b）
 */

export type FeeType = "percentage" | "fixed";

export type FeeSource =
  | "studio_default"
  | "instructor_override"
  | "class_override"     // Phase 3a
  | "fee_schedule";      // Phase 3b

export type ResolvedFee = {
  feeType: FeeType;
  feeValue: number;
  feeSource: FeeSource;
};

export type InstructorFeeOverride = {
  fee_type: FeeType;
  fee_value: number;
} | null;

export type StudioFeeDefaults = {
  studio_fee_type: FeeType;
  studio_fee_percentage: number;
};

/**
 * resolveStudioFee — 料金解決
 *
 * @param studioDefaults  スタジオのデフォルト設定
 * @param instructorOverride  インストラクター別オーバーライド（nullable）
 * @returns 解決された料金情報
 */
export function resolveStudioFee(
  studioDefaults: StudioFeeDefaults,
  instructorOverride?: InstructorFeeOverride
): ResolvedFee {
  // Priority 3: Instructor-specific override
  if (instructorOverride) {
    return {
      feeType: instructorOverride.fee_type,
      feeValue: Number(instructorOverride.fee_value),
      feeSource: "instructor_override",
    };
  }

  // Priority 4: Studio default
  return {
    feeType: studioDefaults.studio_fee_type ?? "percentage",
    feeValue: Number(studioDefaults.studio_fee_percentage),
    feeSource: "studio_default",
  };
}

/**
 * calculateStudioFee — 実際の手数料額（cents）を計算
 *
 * @param amount   決済額（cents）
 * @param resolved 解決された料金情報
 * @returns 手数料額（cents）
 */
export function calculateStudioFee(
  amount: number,
  resolved: ResolvedFee
): number {
  if (resolved.feeType === "fixed") {
    // Fixed amount in cents
    return Math.min(resolved.feeValue, amount);
  }
  // Percentage
  return Math.round(amount * (resolved.feeValue / 100));
}
