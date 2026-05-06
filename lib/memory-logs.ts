import { embedTexts, toVectorString } from "@/lib/embeddings";
import type { Json } from "@/types/database";
import type { MemoryLog } from "@/types/domain";

export interface MemoryLogInsertEntry {
  user_id: string;
  event_type: MemoryLog["event_type"];
  summary: string;
  metadata?: Json | Record<string, unknown> | null;
}

type MemoryLogWriter = {
  from: (table: string) => {
    insert: (
      values: unknown
    ) => Promise<{ error: { message: string } | null }>;
  };
};

export async function insertMemoryLogs(
  writable: MemoryLogWriter,
  entries: MemoryLogInsertEntry[]
) {
  if (entries.length === 0) {
    return { error: null as { message: string } | null };
  }

  let embeddings: number[][] = [];

  try {
    embeddings = await embedTexts(entries.map((entry) => entry.summary));
  } catch (error) {
    console.error("Embedding memory logs failed:", error);
  }

  return writable.from("memory_logs").insert(
    entries.map((entry, index) => ({
      user_id: entry.user_id,
      event_type: entry.event_type,
      summary: entry.summary,
      metadata: (entry.metadata ?? null) as Json,
      embedding: embeddings[index] ? toVectorString(embeddings[index]) : null
    }))
  );
}
