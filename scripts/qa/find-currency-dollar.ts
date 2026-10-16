// 2026-10-02 UAT C3 — 생성 규칙(금액은 'dollars' 또는 \$)을 어기고 맨 `$`를 통화로 쓴 공개 문항을 찾는다.
// 읽기 전용. 결과는 data/qa/currency-dollar-<날짜>.json.
// 실행: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/qa/find-currency-dollar.ts
import { fetchPublishedVersions, writeReport } from "./published-versions";

// 이스케이프(\$)가 아닌 `$` 바로 뒤에 숫자, 그리고 그 숫자 덩어리 뒤가 공백·문장부호(수식 닫힘 `$` 아님).
const CURRENCY = /(?<!\\)\$\d[\d,]*(?:\.\d+)?(?=[\s,.;:!?)]|$)/;

async function main() {
  const rows = await fetchPublishedVersions();
  const hits: { problemId: string; field: string; sample: string }[] = [];
  for (const r of rows) {
    const fields: [string, string | null][] = [["passage", r.passage], ["question", r.question], ...(r.options ?? []).map((o, i) => [`options[${i}]`, o] as [string, string])];
    for (const [field, t] of fields) {
      const m = t ? CURRENCY.exec(t) : null;
      if (m && t) hits.push({ problemId: r.problem_id, field, sample: t.slice(Math.max(0, m.index - 30), m.index + 40) });
    }
  }
  const ids = [...new Set(hits.map((h) => h.problemId))];
  const file = writeReport("currency-dollar", { scanned: rows.length, problems: ids.length, ids, hits });
  console.log(`scanned=${rows.length} problems=${ids.length}`, "→", file);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
