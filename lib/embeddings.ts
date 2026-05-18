import OpenAI from "openai";

import { getOpenAIEnv } from "@/lib/env";

export const MEMORY_EMBEDDING_DIMENSION = 1536;
const EMBEDDING_BACKOFF_MS = 15 * 60 * 1000;
let embeddingsDisabledUntil = 0;
let lastEmbeddingDisableReason: string | null = null;

function toFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function toVectorString(values: number[]) {
  return `[${values.map((value) => toFiniteNumber(value).toFixed(8)).join(",")}]`;
}

export async function embedTexts(texts: string[]) {
  const normalized = texts.map((text) => text.trim()).filter(Boolean);

  if (normalized.length === 0) {
    return [];
  }

  if (Date.now() < embeddingsDisabledUntil) {
    return [];
  }

  const { apiKey, embeddingModel } = getOpenAIEnv();

  if (!apiKey) {
    return [];
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: normalized
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      const shouldBackOff =
        error.status === 429 ||
        error.code === "insufficient_quota" ||
        error.code === "rate_limit_exceeded";

      if (shouldBackOff) {
        embeddingsDisabledUntil = Date.now() + EMBEDDING_BACKOFF_MS;
        const reason =
          error.code === "insufficient_quota"
            ? "OpenAI embedding quota is exhausted"
            : "OpenAI embedding requests are rate limited";

        if (lastEmbeddingDisableReason !== reason) {
          console.warn(`${reason}; disabling embeddings for 15 minutes.`);
          lastEmbeddingDisableReason = reason;
        }

        return [];
      }
    }

    throw error;
  }
}
