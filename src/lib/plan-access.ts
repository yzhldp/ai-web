/** 方案可见性：公开 / 私有 */
export type PlanVisibility = "public" | "private";

/** 判断可见性所需的最小方案信息 */
export interface PlanAccessInfo {
  userId: string;
  visibility: string;
}

/**
 * 判断当前用户是否可以访问方案
 * 规则：作者始终可访问；其他用户仅可访问公开方案。
 * 未知 visibility 值按私有处理，避免脏数据导致越权。
 */
export function canAccessPlan(
  plan: PlanAccessInfo,
  viewerId: string
): boolean {
  return plan.userId === viewerId || plan.visibility === "public";
}

/** 判断当前用户是否为方案作者 */
export function isPlanOwner(plan: PlanAccessInfo, viewerId: string): boolean {
  return plan.userId === viewerId;
}
