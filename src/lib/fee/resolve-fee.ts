/**
 * 料金解決ロジック
 *
 * 優先順位:
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

export type ClassFeeOverrideInput = {
  fee_type: FeeType;
  fee_value: number;
} | null;

export type FeeScheduleInput = {
  fee_type: FeeType;
  fee_value: number;
  day_of_week: number[] | null;
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string;
  priority: number;
  is_active: boolean;
};

export type StudioFeeDefaults = {
  studio_fee_type: FeeType;
  studio_fee_percentage: number;
};

/**
 * resolveStudioFee — 料金解決（全優先度対応）
 *
 * @param studioDefaults       スタジオのデフォルト設定
 * @param instructorOverride   インストラクター別オーバーライド（nullable）
 * @param classFeeOverride     クラス別オーバーライド（nullable, Phase 3a）
 * @param feeSchedules         時間帯スケジュール一覧（Phase 3b）
 * @param sessionTime          セッション開始時刻 "HH:MM" （スケジュール判定用）
 * @param sessionDayOfWeek     セッション曜日 0=日 ... 6=土
 * @returns 解決された料金情報
 */
export function resolveStudioFee(
  studioDefaults: StudioFeeDefaults,
  instructorOverride?: InstructorFeeOverride,
  classFeeOverride?: ClassFeeOverrideInput,
  feeSchedules?: FeeScheduleInput[],
  sessionTime?: string,
  sessionDayOfWeek?: number
): ResolvedFee {
  // Priority 1: Class-specific override (Phase 3a)
  if (classFeeOverride) {
    return {
      feeType: classFeeOverride.fee_type,
      feeValue: Number(classFeeOverride.fee_value),
      feeSource: "class_override",
    };
  }

  // Priority 2: Time-based fee schedule (Phase 3b)
  if (feeSchedules && feeSchedules.length > 0 && sessionTime !== undefined) {
    const matched = matchFeeSchedule(feeSchedules, sessionTime, sessionDayOfWeek);
    if (matched) {
      return {
        feeType: matched.fee_type,
        feeValue: Number(matched.fee_value),
        feeSource: "fee_schedule",
      };
    }
  }

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
 * matchFeeSchedule — 時間帯スケジュールのマッチング
 *
 * アクティブなスケジュールを priority DESC でソートし、
 * 最初にマッチしたものを返す。
 */
function matchFeeSchedule(
  schedules: FeeScheduleInput[],
  sessionTime: string,
  sessionDayOfWeek?: number
): FeeScheduleInput | null {
  // Filter active only, sort by priority descending
  const active = schedules
    .filter((s) => s.is_active)
    .sort((a, b) => b.priority - a.priority);

  for (const schedule of active) {
    // Check day of week
    if (schedule.day_of_week !== null && sessionDayOfWeek !== undefined) {
      if (!schedule.day_of_week.includes(sessionDayOfWeek)) {
        continue;
      }
    }

    // Check time range
    const normalizedSession = normalizeTime(sessionTime);
    const normalizedStart = normalizeTime(schedule.start_time);
    const normalizedEnd = normalizeTime(schedule.end_time);

    if (normalizedSession >= normalizedStart && normalizedSession < normalizedEnd) {
      return schedule;
    }
  }

  return null;
}

/**
 * normalizeTime — "HH:MM:SS" or "HH:MM" → "HH:MM" for comparison
 */
function normalizeTime(time: string): string {
  return time.substring(0, 5);
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
