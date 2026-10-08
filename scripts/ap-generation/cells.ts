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
  ap_calculus_ab: { mc: 30, frq: ["table_rate_context_calc", "fprime_graph_justify", "differential_equation", "area_volume_setup_calc"], sets: [] as { unit: string; items: number }[], calcShare: 0.3 },
  ap_biology: { mc: 30, frq: ["long_experiment_graph", "long_experiment_interpret", "short_scientific_investigation", "short_model_visual"], sets: [{ unit: "7", items: 4 }, { unit: "8", items: 4 }], calcShare: 0 },
  ap_microeconomics: { mc: 30, frq: ["long_graph_calc_explain", "short_game_theory", "short_market_numeric"], sets: [{ unit: "2", items: 2 }, { unit: "3", items: 2 }, { unit: "4", items: 2 }], calcShare: 0 },
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
  // FRQ 번들
  plan.frq.forEach((tpl, i) => {
    const unitOrder = f.units.map((u) => u.code);
    const unit = f.units[Math.min(unitOrder.length - 1, Math.floor(((i + 0.5) * unitOrder.length) / plan.frq.length))];
    const t = unit.topics.filter((x) => x.scope !== "bc_only")[Math.floor(unit.topics.length / 2)];
    cells.push({ cellId: `${code}-f${String(i + 1).padStart(2, "0")}`, subject: code, kind: "frq_bundle", unitCode: unit.code, keywordCode: t.code, extraKeywordCodes: [], skill: t.skills[0] ?? "", structure: "frq_multipart", itemsPerCandidate: 1, candidates: 4, calculator: /calc/.test(tpl) ? "required" : "na", frqTemplate: tpl });
  });
  return cells;
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
