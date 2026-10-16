// 2026-10-05 — 기존 단어(definition_en 이 null 인 행)에 영어 뜻을 채운다.
// 기본은 dry-run(대상 건수만 출력, Anthropic 호출·DB 쓰기 없음). --execute 일 때만 AI 호출 후 UPDATE.
// 멱등: definition_en is null 인 행만 선택하고, UPDATE 도 `definition_en is null` 조건을 다시 건다.
// 실행: npx tsx scripts/vocab/backfill-definition-en.ts [--execute] [--table=vocab_library_words|vocab_words] [--batch=25] [--limit=N]
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  BACKFILL_TOOL, buildBackfillPrompt, parseBackfillResponse, parseBackfillArgs, chunk, type BackfillRow,
} from "../../lib/vocab/backfill";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// 라이브러리는 definition_ko, 학생 개인 단어장은 definition 컬럼에 한국어 뜻이 있다.
const KO_COLUMN = { vocab_library_words: "definition_ko", vocab_words: "definition" } as const;
const EXAMPLE_COLUMN = { vocab_library_words: "example1", vocab_words: "example" } as const;

async function main() {
  const args = parseBackfillArgs(process.argv.slice(2));
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  console.log(`mode=${args.execute ? "EXECUTE" : "dry-run"} target=${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  for (const table of args.tables) {
    const koCol = KO_COLUMN[table];
    const exCol = EXAMPLE_COLUMN[table];
    let q = admin.from(table).select(`id, word, ${koCol}, ${exCol}`).is("definition_en", null).order("id", { ascending: true });
    q = q.limit(args.limit ?? 100_000);
    const { data, error } = await q;
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    const rows: BackfillRow[] = (data ?? []).map((r) => {
      const row = r as unknown as Record<string, string | null>;
      return { id: row.id as string, word: row.word as string, definitionKo: row[koCol], example: row[exCol] };
    });
    console.log(`${table}: definition_en 이 null 인 행 ${rows.length}건`);
    if (!args.execute || rows.length === 0) continue;

    const { getAnthropic } = await import("../../lib/problem-generation/core");
    let updated = 0;
    let failed = 0;
    for (const batch of chunk(rows, args.batchSize)) {
      try {
        const message = await getAnthropic().messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
          tools: [BACKFILL_TOOL],
          tool_choice: { type: "tool", name: BACKFILL_TOOL.name },
          messages: [{ role: "user", content: buildBackfillPrompt(batch) }],
        }, { timeout: 60_000 });
        const toolUse = message.content.find((b) => b.type === "tool_use");
        const { accepted, rejected } = parseBackfillResponse(batch, toolUse && toolUse.type === "tool_use" ? toolUse.input : null);
        failed += rejected.length;
        for (const [id, en] of accepted) {
          const { error: upErr } = await admin.from(table).update({ definition_en: en }).eq("id", id).is("definition_en", null);
          if (upErr) { failed++; console.error(`  update 실패 ${id}: ${upErr.message}`); } else updated++;
        }
      } catch (e) {
        failed += batch.length;
        console.error(`  배치 오류(건너뜀): ${e instanceof Error ? e.message : e}`);
      }
      console.log(`  진행: updated=${updated} failed=${failed}`);
    }
    console.log(`${table}: 완료 updated=${updated} failed=${failed} (실패분은 다시 실행하면 이어서 처리됨)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
