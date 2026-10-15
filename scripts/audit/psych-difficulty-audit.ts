// AP Psychology PS1/PS2 난이도(인지 요구) 감사(읽기 전용, DB 없음): 배정 보고서의 MC 를 판정기 라벨(difficulty.label·reasoning_steps)과 모델 없는 대리 지표로 센다.
// 모델 없는 대리 지표 = (1) 풀이 단계 수(설계 기록 blueprint.student_thinking 길이) (2) 코드가 선언한 구조 신호(difficulty_signals: 단계·결합 개념 수) (3) 자료(표·그래프)가 있는 문항 (4) 원형 종류(개념 / 연구 설계 / 통계·자료 해석 / 세트) (5) Practice.
//   npx tsx scripts/audit/psych-difficulty-audit.ts [--assign data/ap/stock/exact-assign-psych-ps1-ps2.json[,<다른 보고서>]] [--titles "v2 게시 배정,v3 배정"] [--md docs/ap/psychology-difficulty-audit.md]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STOCK_FILES } from "../ap-generation/keys-file";
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
type J = Record<string, any>;
const raws = new Map<string, J>();
for (const f of STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as J[]) if (r.apSubjectCode === "ap_psychology" && !raws.has(r.stockKey)) raws.set(r.stockKey, r); }
const assigns = arg("--assign", "data/ap/stock/exact-assign-psych-ps1-ps2.json").split(","); const titles = arg("--titles", assigns.join(",")).split(",");
const kindOf = (a: string) => (/^ps_stat_|^ps_data_|^ps_hd_s_/.test(a) ? "통계·자료 해석" : /^ps_r_|^ps_hd_r_/.test(a) ? "연구 설계" : /^pss_/.test(a) ? "공유 세트" : "개념 적용");
type Row = { prac: string; label: string; steps: number; think: number; stim: string; kind: string; declared: boolean; sigSteps: number; sigConcepts: number };
const out: string[] = []; const md: string[] = [];
const g = (rows: Row[], f: (r: Row) => string) => { const m: Record<string, number> = {}; for (const r of rows) m[f(r)] = (m[f(r)] ?? 0) + 1; return Object.entries(m).sort().map(([k, v]) => `${k}:${v}`).join(" "); };
assigns.forEach((file, ai) => {
  const rep = JSON.parse(readFileSync(file, "utf-8")) as { sets: { id: string; mcA: string[] }[] };
  out.push(`## ${titles[ai] ?? file}`, ""); md.push(`## ${titles[ai] ?? file}`, "", "| 시험 | MC | exam_prep(판정기) | 판정기 평균 단계 | 설계 기록 풀이 단계 분포 | 선언된 구조 신호(3단계+2개념) | 자료(표·그래프) 있음 | 응용·분석 합계* | Practice 1/2/3 | 원형 종류 |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const s of rep.sets) {
    const rows: Row[] = [];
    for (const k of s.mcA) { const r = raws.get(k)!; const its: J[] = r.payload.items ?? [r.payload]; const ds: J[] = Array.isArray(r.difficulty) ? r.difficulty : [r.difficulty];
      its.forEach((it, i) => { const d = ds[i] ?? ds[0] ?? {}; const sg = it.difficulty_signals; rows.push({ prac: String(it.skill).split(".")[0], label: d.label ?? "?", steps: Number(d.reasoning_steps ?? 0), think: (it.blueprint?.student_thinking ?? []).length, stim: (it.stimulus ?? r.payload.stimulus)?.kind ?? "none", kind: kindOf(String(it.archetype ?? r.payload.archetype)), declared: !!sg && (sg.steps?.length ?? 0) >= 3 && (sg.concepts?.length ?? 0) >= 2, sigSteps: sg?.steps?.length ?? 0, sigConcepts: sg?.concepts?.length ?? 0 }); });
    }
    const n = rows.length; const c = (f: (r: Row) => boolean) => rows.filter(f).length;
    const exam = c((r) => r.label === "exam_prep"), hard = c((r) => r.kind === "통계·자료 해석" || r.kind === "연구 설계" || r.label === "exam_prep" || r.declared);
    out.push(`### ${s.id} (MC ${n})`, `- 판정기 라벨 exam_prep ${exam}/${n}; reasoning_steps 분포 ${g(rows, (r) => String(r.steps))}; 평균 ${(rows.reduce((a, r) => a + r.steps, 0) / n).toFixed(2)}`,
      `- 모델 없는 대리: 설계 기록 풀이 단계 ${g(rows, (r) => String(r.think))}; 선언된 구조 신호 ${c((r) => r.declared)}/${n}; 자료 있는 문항 ${c((r) => r.stim !== "none" && r.stim !== "text")}/${n}; 원형 종류 ${g(rows, (r) => r.kind)}; Practice ${g(rows, (r) => r.prac)}`, `- 응용·분석(연구설계/통계/자료 원형, 라벨 exam_prep, 선언된 구조 중 하나) ${hard}/${n}`);
    md.push(`| ${s.id} | ${n} | **${exam}** | ${(rows.reduce((a, r) => a + r.steps, 0) / n).toFixed(2)} | ${g(rows, (r) => String(r.think))} | ${c((r) => r.declared)} | ${c((r) => r.stim !== "none" && r.stim !== "text")} | ${hard} | ${["1", "2", "3"].map((p) => c((r) => r.prac === p)).join("/")} | ${g(rows, (r) => r.kind)} |`);
  }
  md.push("", "\\* 응용·분석 합계 = 연구 설계·통계·자료 해석 원형 또는 판정기 exam_prep 또는 선언된 구조 신호(3단계 + 2개념) 중 하나 이상에 해당하는 문항(중복 제외).", "");
});
console.log(out.join("\n"));
if (arg("--md")) writeFileSync(arg("--md"), `${arg("--title", "# AP Psychology 난이도 감사")}\n\n${md.join("\n")}\n`);
