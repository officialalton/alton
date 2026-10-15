// AP Psychology PS1/PS2 난이도(인지 요구) 감사(읽기 전용, DB 없음): 배정 보고서의 MC 를 판정기 라벨(difficulty.label·reasoning_steps)과
// 모델 없는 대리 지표(풀이 단계 수 = blueprint.student_thinking 길이, 자료 종류, 연구 설계/통계 원형 여부)로 센다.
//   npx tsx scripts/audit/psych-difficulty-audit.ts [--assign data/ap/stock/exact-assign-psych-ps1-ps2.json] [--md docs/ap/psychology-difficulty-audit.md --title "..."]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STOCK_FILES } from "../ap-generation/keys-file";
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
type J = Record<string, any>;
const raws = new Map<string, J>();
for (const f of STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as J[]) if (r.apSubjectCode === "ap_psychology" && !raws.has(r.stockKey)) raws.set(r.stockKey, r); }
const rep = JSON.parse(readFileSync(arg("--assign", "data/ap/stock/exact-assign-psych-ps1-ps2.json"), "utf-8")) as { sets: { id: string; mcA: string[] }[] };
const out: string[] = [];
const kindOf = (a: string) => (/^ps_stat_|^ps_data_|^ps_hd_s/.test(a) ? "stats/data" : /^ps_r_|^ps_hd_r/.test(a) ? "research-design" : /^pss_/.test(a) ? "set" : "concept");
for (const s of rep.sets) {
  const rows: { prac: string; label: string; steps: number; think: number; stim: string; kind: string }[] = [];
  for (const k of s.mcA) { const r = raws.get(k)!; const its: J[] = r.payload.items ?? [r.payload]; const ds: J[] = Array.isArray(r.difficulty) ? r.difficulty : [r.difficulty];
    its.forEach((it, i) => { const d = ds[i] ?? ds[0] ?? {}; rows.push({ prac: String(it.skill).split(".")[0], label: d.label ?? "?", steps: Number(d.reasoning_steps ?? 0), think: (it.blueprint?.student_thinking ?? []).length, stim: (it.stimulus ?? r.payload.stimulus)?.kind ?? "none", kind: kindOf(String(it.archetype ?? r.payload.archetype)) }); }); }
  const n = rows.length; const c = (f: (r: typeof rows[0]) => boolean) => rows.filter(f).length;
  const g = (f: (r: typeof rows[0]) => string) => { const m: Record<string, number> = {}; for (const r of rows) m[f(r)] = (m[f(r)] ?? 0) + 1; return JSON.stringify(Object.fromEntries(Object.entries(m).sort())); };
  out.push(`### ${s.id} (MC ${n})`, `- 판정기 라벨 exam_prep ${c((r) => r.label === "exam_prep")}/${n}; 판정기 reasoning_steps 분포 ${g((r) => String(r.steps))}; 평균 ${(rows.reduce((a, r) => a + r.steps, 0) / n).toFixed(2)}`,
    `- 모델 없는 대리: 풀이 단계(student_thinking 길이) 분포 ${g((r) => String(r.think))}; 자료(표·그래프) 있는 문항 ${c((r) => r.stim !== "none" && r.stim !== "text")}/${n}; 원형 종류 ${g((r) => r.kind)}; Practice ${g((r) => r.prac)}`,
    `- 응용·분석(연구설계/통계/자료 원형 또는 라벨 exam_prep) ${c((r) => r.kind === "stats/data" || r.kind === "research-design" || r.label === "exam_prep")}/${n}`);
}
const txt = out.join("\n"); console.log(txt);
if (arg("--md")) writeFileSync(arg("--md"), `${arg("--title", "# AP Psychology 난이도 감사")}\n\n${txt}\n`);
