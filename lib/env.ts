function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toPositiveInteger(
  value: string | undefined,
  fallback: number
) {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSupabaseEnv() {
  return {
    url: trimTrailingSlash(
      required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
    ),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
  };
}

export function getBaseUrl(origin?: string | null) {
  if (origin) {
    return trimTrailingSlash(origin);
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  }

  return "http://localhost:3000";
}

export function getOpenAIEnv() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small"
  };
}

export function getAiLimitEnv() {
  return {
    userDailyQuota: toPositiveInteger(process.env.AI_USER_DAILY_QUOTA, 40),
    ipHourlyRateLimit: toPositiveInteger(process.env.AI_IP_HOURLY_RATE_LIMIT, 60),
    userDailySpendLimitCents: toPositiveInteger(
      process.env.AI_USER_DAILY_SPEND_LIMIT_CENTS,
      100
    ),
    generationEstimatedSpendCents: toPositiveInteger(
      process.env.AI_GENERATION_ESTIMATED_SPEND_CENTS,
      5
    ),
    embeddingEstimatedSpendCents: toPositiveInteger(
      process.env.AI_EMBEDDING_ESTIMATED_SPEND_CENTS,
      1
    )
  };
}
