import OpenAI from "openai";

import { getOpenAIEnv } from "@/lib/env";

export const MEMORY_EMBEDDING_DIMENSION = 1536;

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

  const { apiKey, embeddingModel } = getOpenAIEnv();

  if (!apiKey) {
    return [];
  }

  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model: embeddingModel,
    input: normalized
  });

  return response.data.map((item) => item.embedding);
}
