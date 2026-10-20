// 추가 라운드(2026-10-19) 세트별 문항 설계표(내용·기능·표현·추론·중복) 생성기. 배정 보고서의 키를 재고 파일에서 찾아 후보 payload 로부터 표를 만든다(무료·읽기 전용).
//   npx tsx scripts/ap-generation/new6-design-table.ts <배정보고서.json> <세트 id> <출력.json> <재고 파일 접두 정규식>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const [rep, setId, out, fileRe] = process.argv.slice(2);
const set = (JSON.parse(readFileSync(rep, "utf-8")) as { sets: { id: string; mcA: string[]; frqA: string[] }[] }).sets.find((s) => s.id === setId)!;
const keys = [...set.mcA, ...set.frqA];
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const byKey = new Map<string, J>();
for (const f of readdirSync("data/ap/stock").filter((x) => new RegExp(fileRe).test(x) && x.endsWith("-items.json"))) for (const r of JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8")) as J[]) if (!byKey.has(r.stockKey)) byKey.set(r.stockKey, r);
const rows = keys.map((k) => {
  const r = byKey.get(k); if (!r) return { key: k, missing: true };
  const p = r.payload as J; const items = Array.isArray(p.items) ? (p.items as J[]) : [p];
  const diff = Array.isArray(r.difficulty) ? r.difficulty : [r.difficulty];
  return {
    key: k, kind: r.kind, archetype: r.archetype, family: r.itemFamilyId, duplicateOf: r.duplicateOf ?? null,
    content: items.map((i) => i.topic ?? p.topic ?? r.keywordCode), function: items.map((i) => i.skill ?? p.skill ?? r.skillPrimary),
    representation: p.stimulus?.kind ?? p.set_intro ? (p.stimulus?.kind ?? "text") : p.kind ?? "text_only", reasoning: diff.map((d: J | null) => (d ? { label: d.label, steps: d.reasoning_steps ?? null } : null)),
    independentSolve: r.verification?.passed ?? r.validation, validation: r.validation,
  };
});
writeFileSync(out, JSON.stringify({ set: setId, report: rep, generatedBy: "scripts/ap-generation/new6-design-table.ts", note: "내용=토픽, 기능=스킬, 표현=자료 형태, 추론=난이도 판정기 라벨·풀이 단계, 중복=원형·문항군. 정답 유일성: 파이프라인의 독립 풀이(Opus·Sonnet)+검토+패널 기록은 각 후보 verification/review 에 있다.", rows }, null, 1));
console.log(rows.length, "rows;", rows.filter((r) => (r as J).missing).length, "missing");
