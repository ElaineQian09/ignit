import { embedTexts, toVectorString } from "@/lib/embeddings";
import { createClient } from "@/lib/supabase/server";

export interface MemoryAgentInput {
  userId: string;
  task: string;
  limit?: number;
}

export interface MemoryAgentOutput {
  memories: string[];
}

interface MatchedMemoryLogRow {
  id: string;
  summary: string;
  similarity: number;
  created_at: string;
}

export async function memoryAgent({
  userId,
  task,
  limit = 5
}: MemoryAgentInput): Promise<MemoryAgentOutput> {
  const supabase = await createClient();
  const reader = supabase as unknown as {
    rpc: (
      fn: string,
      args: {
        query_embedding: string;
        match_user_id: string;
        match_count: number;
      }
    ) => Promise<{
      data: MatchedMemoryLogRow[] | null;
      error: { message: string } | null;
    }>;
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => {
            limit: (
              value: number
            ) => Promise<{ data: Array<{ summary: string }> | null }>;
          };
        };
      };
    };
  };

  try {
    const embeddings = await embedTexts([task]);

    if (embeddings[0]) {
      const { data, error } = await reader.rpc("match_memory_logs", {
        query_embedding: toVectorString(embeddings[0]),
        match_user_id: userId,
        match_count: limit
      });

      if (!error) {
        const matches = ((data ?? []) as MatchedMemoryLogRow[])
          .filter((row) => row.summary)
          .map((row) => row.summary.trim())
          .filter(Boolean)
          .slice(0, limit);

        if (matches.length > 0) {
          return { memories: matches };
        }
      }
    }
  } catch (error) {
    console.error("Memory agent retrieval failed:", error);
  }

  const { data: fallbackLogs } = await reader
    .from("memory_logs")
    .select("summary")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    memories: ((fallbackLogs ?? []) as Array<{ summary: string }>)
      .map((row) => row.summary.trim())
      .filter(Boolean)
      .slice(0, limit)
  };
}
