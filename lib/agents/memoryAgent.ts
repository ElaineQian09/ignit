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

export interface MemoryAgentDependencies {
  embedTask: (task: string) => Promise<number[] | null>;
  matchMemories: (args: {
    userId: string;
    queryEmbedding: string;
    limit: number;
  }) => Promise<Array<{ summary: string | null }>>;
  listRecentMemories: (args: {
    userId: string;
    limit: number;
  }) => Promise<Array<{ summary: string | null }>>;
}

interface MatchedMemoryLogRow {
  id: string;
  summary: string | null;
  similarity: number;
  created_at: string;
}

function sanitizeMemories(rows: Array<{ summary: string | null }>, limit: number) {
  return rows
    .map((row) => row.summary?.trim() ?? "")
    .filter(Boolean)
    .slice(0, limit);
}

async function defaultEmbedTask(task: string) {
  const [embedding] = await embedTexts([task]);
  return embedding ?? null;
}

async function defaultMatchMemories({
  userId,
  queryEmbedding,
  limit
}: {
  userId: string;
  queryEmbedding: string;
  limit: number;
}) {
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
  };
  const { data, error } = await reader.rpc("match_memory_logs", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: limit
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MatchedMemoryLogRow[];
}

async function defaultListRecentMemories({
  userId,
  limit
}: {
  userId: string;
  limit: number;
}) {
  const supabase = await createClient();
  const reader = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => {
            limit: (
              value: number
            ) => Promise<{ data: Array<{ summary: string | null }> | null }>;
          };
        };
      };
    };
  };
  const { data } = await reader
    .from("memory_logs")
    .select("summary")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Array<{ summary: string | null }>;
}

export function createMemoryAgent(
  dependencies: MemoryAgentDependencies = {
    embedTask: defaultEmbedTask,
    matchMemories: defaultMatchMemories,
    listRecentMemories: defaultListRecentMemories
  }
) {
  return async function memoryAgent({
    userId,
    task,
    limit = 5
  }: MemoryAgentInput): Promise<MemoryAgentOutput> {
    const normalizedTask = task.trim();

    if (!normalizedTask) {
      return { memories: [] };
    }

    try {
      const embedding = await dependencies.embedTask(normalizedTask);

      if (embedding) {
        const matches = await dependencies.matchMemories({
          userId,
          queryEmbedding: toVectorString(embedding),
          limit
        });
        const memories = sanitizeMemories(matches, limit);

        if (memories.length > 0) {
          return { memories };
        }
      }
    } catch (error) {
      console.error("Memory agent retrieval failed:", error);
    }

    const fallbackLogs = await dependencies.listRecentMemories({
      userId,
      limit
    });

    return {
      memories: sanitizeMemories(fallbackLogs, limit)
    };
  };
}

export const memoryAgent = createMemoryAgent();
