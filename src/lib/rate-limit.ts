/**
 * 极简内存限流器（固定窗口）
 * 适用于单实例部署；多副本场景应替换为 Redis 等共享存储。
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** 超过该数量时清理过期键，避免内存无限增长 */
const MAX_KEYS = 5000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

/**
 * 消耗一次配额
 * @param key 限流维度（如 chat:minute:用户ID）
 * @param max 窗口内最大次数
 * @param windowMs 窗口长度（毫秒）
 */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfter: 0 };
  }

  if (bucket.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count, retryAfter: 0 };
}

/** 取客户端 IP，反代场景优先使用 X-Forwarded-For */
export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** 判断请求是否经由 HTTPS 到达 */
export function isHttpsRequest(request: Request) {
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");
  return proto === "https";
}
