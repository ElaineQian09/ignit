import { getAiLimitEnv } from "@/lib/env";

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{
    data:
      | Array<{
          allowed: boolean;
          reason: string;
          retry_after_seconds: number | null;
        }>
      | null;
    error: { message: string } | null;
  }>;
};

export class AiUsageLimitError extends Error {
  retryAfterSeconds: number | null;
  status: number;

  constructor(message: string, status = 429, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "AiUsageLimitError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizeIp(ipAddress: string | null | undefined) {
  return ipAddress?.split(",")[0]?.trim().slice(0, 120) || "unknown";
}

export function getIpAddressFromHeaders(headers: Headers) {
  return normalizeIp(
    headers.get("x-forwarded-for") ??
      headers.get("x-real-ip") ??
      headers.get("cf-connecting-ip")
  );
}

function toLimitErrorMessage(reason: string) {
  switch (reason) {
    case "user_daily_quota_exceeded":
      return "Daily AI quota reached for this user.";
    case "ip_hourly_rate_limit_exceeded":
      return "Too many AI requests from this IP. Try again later.";
    case "user_daily_spend_limit_exceeded":
      return "Daily AI spend limit reached for this user.";
    case "unauthorized":
      return "Unable to authorize AI usage for this user.";
    default:
      return "AI request limit reached.";
  }
}

export async function reserveAiUsage(
  client: RpcClient,
  {
    userId,
    ipAddress,
    routeKey,
    requestCount = 1,
    estimatedSpendCents
  }: {
    userId: string;
    ipAddress: string | null | undefined;
    routeKey: string;
    requestCount?: number;
    estimatedSpendCents: number;
  }
) {
  const limits = getAiLimitEnv();
  const { data, error } = await client.rpc("check_and_record_ai_usage", {
    p_user_id: userId,
    p_ip_address: normalizeIp(ipAddress),
    p_route_key: routeKey,
    p_request_count: requestCount,
    p_estimated_spend_cents: estimatedSpendCents,
    p_user_daily_quota: limits.userDailyQuota,
    p_ip_hourly_rate_limit: limits.ipHourlyRateLimit,
    p_user_daily_spend_limit_cents: limits.userDailySpendLimitCents
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data?.[0];

  if (!result?.allowed) {
    throw new AiUsageLimitError(
      toLimitErrorMessage(result?.reason ?? "unknown"),
      429,
      result?.retry_after_seconds ?? null
    );
  }
}
