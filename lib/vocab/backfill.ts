import { hasHangul } from "./definition";

export type BackfillRow = { id: string; word: string; definitionKo: string | null; example: string | null };

export const BACKFILL_TOOL = {
  name: "english_definitions",
  description: "Write one concise English definition per SAT vocabulary word.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string" as const, description: "The id exactly as given." },
            definition_en: { type: "string" as const, description: "Concise, student-friendly English definition of the sense implied by the Korean meaning/example. No Korean characters." },
          },
          required: ["id", "definition_en"],
        },
      },
    },
    required: ["items"],
  },
};

export function buildBackfillPrompt(rows: BackfillRow[]): string {
  const lines = rows.map((r) => JSON.stringify({ id: r.id, word: r.word, korean_meaning: r.definitionKo, example: r.example }));
  return `For each SAT/AP vocabulary entry below, write one concise, student-friendly English definition (no Korean characters) matching the sense given by korean_meaning and the example. Return every id exactly once.\n${lines.join("\n")}`;
}

/** AI 응답을 요청한 행에 대해서만 검증한다 — 모르는 id·한글 포함·빈 값·중복은 버린다. */
export function parseBackfillResponse(rows: BackfillRow[], raw: unknown): { accepted: Map<string, string>; rejected: string[] } {
  const wanted = new Set(rows.map((r) => r.id));
  const accepted = new Map<string, string>();
  const items = (raw as { items?: unknown })?.items;
  if (Array.isArray(items)) {
    for (const it of items) {
      const { id, definition_en } = (it ?? {}) as { id?: unknown; definition_en?: unknown };
      if (typeof id !== "string" || !wanted.has(id) || accepted.has(id)) continue;
      const en = typeof definition_en === "string" ? definition_en.trim() : "";
      if (en.length < 2 || hasHangul(en)) continue;
      accepted.set(id, en);
    }
  }
  return { accepted, rejected: rows.filter((r) => !accepted.has(r.id)).map((r) => r.id) };
}

export function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export type BackfillArgs = { execute: boolean; batchSize: number; limit: number | null; tables: ("vocab_library_words" | "vocab_words")[] };

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const batchSize = Number(get("batch") ?? 25);
  const limitRaw = get("limit");
  const t = get("table");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error("--batch must be an integer 1..100");
  if (t && t !== "vocab_library_words" && t !== "vocab_words") throw new Error("--table must be vocab_library_words or vocab_words");
  return {
    execute: argv.includes("--execute"),
    batchSize,
    limit: limitRaw ? Number(limitRaw) : null,
    tables: t ? [t as BackfillArgs["tables"][number]] : ["vocab_library_words", "vocab_words"],
  };
}
