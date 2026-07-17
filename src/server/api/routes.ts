import { ServiceNotFoundError } from "@/server/services/errors";
import { ApiConflictError, ApiValidationError } from "@/server/api/http";

export function requireFound<T>(value: T | null, message: string): T {
  if (value === null) throw new ServiceNotFoundError(message);
  return value;
}

export function unwrapCheckoutResult<T extends { ok: true }>(result: T | { ok: false; message: string }): T {
  if (result.ok) return result;
  const message = result.message;
  if (/库存不足/u.test(message)) throw new ApiConflictError("商品库存不足，请刷新后重试");
  if (/余额已变化/u.test(message)) throw new ApiConflictError("购物卡余额已变化，请重试支付");
  if (/令牌不可用/u.test(message)) throw new ApiConflictError("结算令牌不可用");
  if (/已下架|规格已变化|不能混合/u.test(message)) {
    throw new ApiConflictError("商品信息已变化，请刷新后重试");
  }
  if (/^请选择/u.test(message) || /选择数量超出限制/u.test(message)) {
    throw new ApiValidationError(message);
  }
  throw new Error("checkout failed");
}

export function unwrapRechargeResult(
  result: { ok: true; balance: number; idempotent: boolean } | { ok: false; message: string },
) {
  if (result.ok) return { balance: result.balance, idempotent: result.idempotent };
  if (result.message === "充值令牌不可用") throw new ApiConflictError("充值令牌不可用");
  throw new Error("recharge failed");
}
