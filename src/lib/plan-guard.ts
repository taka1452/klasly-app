/**
 * Pro プラン状態に基づくアクセス制御
 * plan_status: trialing | active | past_due | grace | canceled
 */

export type PlanAccess = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canExport: boolean;
  canBook: boolean;
  canPurchase: boolean;
  canAccessSettings: boolean;
  isFullyLocked: boolean;
};

const ACCESS: Record<string, PlanAccess> = {
  trialing: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canExport: true,
    canBook: true,
    canPurchase: true,
    canAccessSettings: true,
    isFullyLocked: false,
  },
  active: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canExport: true,
    canBook: true,
    canPurchase: true,
    canAccessSettings: true,
    isFullyLocked: false,
  },
  past_due: {
    canView: true,
    canCreate: false,
    canEdit: true,
    canExport: true,
    canBook: false,
    canPurchase: false,
    canAccessSettings: true,
    isFullyLocked: false,
  },
  grace: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canExport: true,
    canBook: false,
    canPurchase: false,
    canAccessSettings: true,
    isFullyLocked: false,
  },
  canceled: {
    canView: false,
    canCreate: false,
    canEdit: false,
    canExport: false,
    canBook: false,
    canPurchase: false,
    canAccessSettings: false,
    isFullyLocked: true,
  },
};

const DEFAULT_LOCKED: PlanAccess = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canExport: false,
  canBook: false,
  canPurchase: false,
  canAccessSettings: false,
  isFullyLocked: true,
};

export function getPlanAccess(planStatus: string | null | undefined): PlanAccess {
  const status = planStatus || "trialing";
  return ACCESS[status] ?? DEFAULT_LOCKED;
}
