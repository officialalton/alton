// AP 샘플 생성 칸(= 키워드 코드 × 스킬 × 구조) 계산. 공식 단원 비중에 비례해 MC 칸을 배분한다. 입력은 data/ap/curriculum-2027/*.json 뿐.
//   npx tsx scripts/ap-generation/cells.ts      → data/ap/sample-2027/cells.json 과 요약 출력(DB·API 없음)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ApCurriculumFile, ApTopic } from "../../lib/ap-curriculum/types";

export type Cell = {
  cellId: string;
  subject: string;
  kind: "mc" | "frq_bundle";
  unitCode: string;
  keywordCode: string; // 주 토픽(공식 코드)
  extraKeywordCodes: string[];
  skill: string;
  structure: "standalone" | "shared_stimulus_set" | "frq_multipart";
  itemsPerCandidate: number; // 세트면 문항 수
  candidates: number; // 칸당 후보 수(수율 25% 가정 → 4)
  calculator: "allowed" | "not_allowed" | "required" | "na";
  frqTemplate?: string;
  note?: string;
};

export const SAMPLE_PLAN = {
  ap_calculus_ab: { mc: 30, frq: [
    { tpl: "table_rate_context_calc", kw: "6.2", extra: ["2.3", "8.1"], skill: "2.B" },
    { tpl: "fprime_graph_justify", kw: "5.9", extra: ["5.6", "5.4"], skill: "3.E" },
    { tpl: "differential_equation", kw: "7.6", extra: ["7.3", "7.4"], skill: "1.E" },
    { tpl: "area_volume_setup_calc", kw: "8.4", extra: ["8.7", "8.8"], skill: "1.D" },
  ], sets: [] as { unit: string; items: number }[], calcShare: 0.3 },
  ap_biology: { mc: 30, frq: [
    { tpl: "long_experiment_graph", kw: "4.5", extra: ["4.3"], skill: "4.A" },
    { tpl: "long_experiment_interpret", kw: "6.5", extra: ["6.7"], skill: "6.B" },
    { tpl: "short_scientific_investigation", kw: "8.1", extra: [], skill: "3.C" },
    { tpl: "short_model_visual", kw: "3.2", extra: [], skill: "2.B" },
  ], sets: [{ unit: "7", items: 4 }, { unit: "8", items: 4 }], calcShare: 0 },
  ap_microeconomics: { mc: 30, frq: [
    { tpl: "long_graph_calc_explain", kw: "4.2", extra: ["3.5", "2.6"], skill: "4.A" },
    { tpl: "short_game_theory", kw: "4.5", extra: [], skill: "2.C" },
    { tpl: "short_market_numeric", kw: "2.6", extra: ["2.3"], skill: "3.C" },
  ], sets: [{ unit: "2", items: 2 }, { unit: "3", items: 2 }, { unit: "4", items: 2 }], calcShare: 0 },
} as const;

function largestRemainder(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const base = raw.map(Math.floor);
  let left = total - base.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) base[i] += 1; });
  return base;
}

/** 단원 안에서 토픽을 고르게 흩어 뽑는다(수업 비중이 큰 토픽 우선, 같은 토픽 중복은 칸이 토픽 수보다 많을 때만). */
function pickTopics(topics: ApTopic[], n: number): ApTopic[] {
  const pool = [...topics].filter((t) => t.skills.length > 0 || true);
  const out: ApTopic[] = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(((i + 0.5) * pool.length) / n) % pool.length]);
  return out;
}

export function buildCells(f: ApCurriculumFile, plan: (typeof SAMPLE_PLAN)[keyof typeof SAMPLE_PLAN]): Cell[] {
  const code = f.subject.apCode;
  const unitW = f.units.map((u) => {
    const w = f.weights.find((x) => x.axis === "unit" && x.code === u.code && x.section === "mc");
    return w ? ((w.min ?? 0) + (w.max ?? w.min ?? 0)) / 2 : 1;
  });
  const perUnit = largestRemainder(unitW, plan.mc);
  const cells: Cell[] = [];
  let seq = 0;
  f.units.forEach((u, ui) => {
    let n = perUnit[ui];
    const sets = plan.sets.filter((s) => s.unit === u.code);
    const topics = u.topics.filter((t) => t.scope !== "bc_only");
    for (const s of sets) {
      const picks = pickTopics(topics, s.items);
      cells.push({
        cellId: `${code}-c${String(++seq).padStart(3, "0")}`, subject: code, kind: "mc", unitCode: u.code, keywordCode: picks[0].code,
        extraKeywordCodes: picks.slice(1).map((t) => t.code), skill: picks[0].skills[0] ?? "", structure: "shared_stimulus_set",
        itemsPerCandidate: s.items, candidates: 4, calculator: "na", note: `set of ${s.items} items sharing one stimulus; stimulus-based skills vary by item`,
      });
      n -= s.items;
    }
    if (n < 0) n = 0;
    pickTopics(topics, n).forEach((t) =>
      cells.push({ cellId: `${code}-c${String(++seq).padStart(3, "0")}`, subject: code, kind: "mc", unitCode: u.code, keywordCode: t.code, extraKeywordCodes: [], skill: t.skills[0] ?? "", structure: "standalone", itemsPerCandidate: 1, candidates: 4, calculator: "na" }),
    );
  });
  // 계산기 파트(Calculus): 표 자료·수치 계산이 자연스러운 토픽(단원 4·6·8, 5 일부)부터 약 30%를 calculator required 로 표시
  if (plan.calcShare > 0) {
    const mc = cells.filter((c) => c.kind === "mc");
    const want = Math.round(mc.length * plan.calcShare);
    const pref = mc.filter((c) => ["4", "6", "8", "5"].includes(c.unitCode)).slice(0, want);
    mc.forEach((c) => (c.calculator = "not_allowed"));
    pref.forEach((c) => (c.calculator = "required"));
  }
  // FRQ 번들: 템플릿마다 단원·토픽을 명시(공식 FRQ 유형 대표성)
  plan.frq.forEach((fr, i) => {
    const unit = f.units.find((u) => u.topics.some((t) => t.code === fr.kw))!;
    cells.push({ cellId: `${code}-f${String(i + 1).padStart(2, "0")}`, subject: code, kind: "frq_bundle", unitCode: unit.code, keywordCode: fr.kw, extraKeywordCodes: [...fr.extra], skill: fr.skill, structure: "frq_multipart", itemsPerCandidate: 1, candidates: 4, calculator: /calc/.test(fr.tpl) ? "required" : "na", frqTemplate: fr.tpl });
  });
  assignMcSkills(f, cells);
  return cells;
}

const NOT_ASSESSED_MC: Record<string, string[]> = {
  ap_calculus_ab: ["1.A", "1.B", "3.A", "4.A", "4.B", "4.C", "4.D", "4.E"],
  ap_microeconomics: ["4.A", "4.B", "4.C"],
};
/** MC 칸의 스킬: 토픽의 권장 스킬 중 MC에서 평가되는 것을 우선하고, 공식 스킬 범주 비중(MC)에 맞춰 범주별 할당량을 채운다. */
function assignMcSkills(f: ApCurriculumFile, cells: Cell[]) {
  const code = f.subject.apCode;
  const skip = new Set(NOT_ASSESSED_MC[code] ?? []);
  const mc = cells.filter((c) => c.kind === "mc");
  const topicSkills = new Map(f.units.flatMap((u) => u.topics.map((t) => [t.code, t.skills.filter((x) => !skip.has(x))] as const)));
  const catOf = (sk: string) => sk.split(".")[0];
  const calc = code === "ap_calculus_ab";
  const defaults: Record<string, string> = calc ? { "1": "1.E", "2": "2.B", "3": "3.D" } : code === "ap_microeconomics" ? { "1": "1.A", "2": "2.A", "3": "3.A" } : {};
  const needle: Record<string, string> = calc ? { "1": "implementing", "2": "connecting", "3": "justification" } : { "1": "principles", "2": "interpretation", "3": "manipulation" };
  const mid = (x: { min: number | null; max: number | null }) => ((x.min ?? 0) + (x.max ?? x.min ?? 0)) / 2;
  const quota: Record<string, number> = {};
  const cats = Object.keys(defaults);
  if (cats.length) {
    const ws = cats.map((c) => { const row = f.weights.find((x) => x.axis === "skill" && x.section === "mc" && x.code.toLowerCase().includes(needle[c])); return row ? mid(row) : 1; });
    largestRemainder(ws, mc.reduce((n, c) => n + c.itemsPerCandidate, 0)).forEach((n, i) => (quota[cats[i]] = n));
  }
  for (const c of mc) {
    const own = (topicSkills.get(c.keywordCode) ?? [])[0];
    if (!cats.length) { c.skill = own ?? c.skill; continue; }
    const ownCat = own ? catOf(own) : undefined;
    if (own && ownCat && (quota[ownCat] ?? 0) >= c.itemsPerCandidate) { c.skill = own; quota[ownCat] -= c.itemsPerCandidate; continue; }
    const cat = [...cats].sort((a, b) => quota[b] - quota[a])[0];
    c.skill = defaults[cat]; quota[cat] -= c.itemsPerCandidate;
    c.note = `${c.note ?? ""} skill reassigned to meet official MC skill-category weights`.trim();
  }
}

if (require.main === module || process.argv[1]?.endsWith("cells.ts")) {
  const dir = path.resolve(process.cwd(), "data/ap/curriculum-2027");
  const all: Cell[] = [];
  for (const [code, plan] of Object.entries(SAMPLE_PLAN)) {
    const f = JSON.parse(readFileSync(path.join(dir, `${code}.json`), "utf-8")) as ApCurriculumFile;
    const cells = buildCells(f, plan);
    all.push(...cells);
    const mc = cells.filter((c) => c.kind === "mc");
    const items = mc.reduce((s, c) => s + c.itemsPerCandidate, 0);
    const byUnit = f.units.map((u) => `${u.code}:${mc.filter((c) => c.unitCode === u.code).reduce((s, c) => s + c.itemsPerCandidate, 0)}`).join(" ");
    console.log(`${code}: MC items=${items} (cells ${mc.length}), FRQ bundles=${cells.length - mc.length}; by unit ${byUnit}; candidates=${cells.reduce((s, c) => s + c.candidates, 0)}`);
  }
  writeFileSync(path.resolve(process.cwd(), "data/ap/sample-2027/cells.json"), JSON.stringify(all, null, 1));
}
