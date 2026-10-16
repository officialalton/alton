// S3 투영(무료·읽기 전용, LLM·DB 없음): 커밋된 재고에 "S3 신규 원형 N 개가 통과해 exam_prep 로 판정된다"는 가정을 얹어 풀 세트의 MC exam_prep 비율이 어디까지 오르는지 계산한다.
//   npx tsx scripts/ap-generation/stats-s3-projection.ts [--pass N] [--sets ST1,ST2] [--seeds 2]
// --pass: 원형 10개 중 통과하는 수(기본 8, 앞에서부터). --seeds: 원형당 통과한 시드 수(1 이면 세트 하나만 채울 수 있다). 세트 안에서는 같은 원형을 한 번만 쓸 수 있다(문항군 규칙).
// 실제 판정이 아니라 가정이다 — 유료 런 뒤에는 stats-assign.ts --prefer-exam-prep 의 실제 출력으로 대체한다.
import { readFileSync } from "node:fs";
import { solveStatsSets, verifyStatsAssignment } from "./stats-assign";
import { loadStatsPool, type StatsItem } from "./stats-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PASS = Number(arg("--pass", "8")), IDS = arg("--sets", "ST1").split(","), SEEDS = Number(arg("--seeds", "2"));
const guide = JSON.parse(readFileSync("lib/ap-generation/subjects/stats-archetypes.json", "utf-8")) as { id: string; topic: string; skill: string }[];
const S3 = ["st_t_procedure_conditions", "st_ci_test_consistency", "st_sampling_dist_xbar", "st_residual_r2_model", "st_outlier_effect", "st_power_table_change", "st_two_draw_conditional", "st_phat_normal_prob", "st_block_table", "st_chisq_setup"];
const { pool } = loadStatsPool({});
const synth: StatsItem[] = [];
S3.slice(0, PASS).forEach((id) => {
  const g = guide.find((x) => x.id === id)!;
  for (let s = 0; s < SEEDS; s++) synth.push({ key: `synthetic-${id}-${s}`, kind: "mc", shared: false, members: [{ unit: Number(g.topic.split(".")[0]), skill: Number(g.skill[0]), topic: g.topic, skillCode: g.skill }], fam: `synthetic-${id}`, frqType: "", archetype: id, screen: true, batch: "synthetic-s3", renderType: "x", stimKind: "none", exam: 1 });
});
const mcq = (r: { singles: StatsItem[]; sets: StatsItem[] }) => r.singles.length + 3 * r.sets.length;
const show = (label: string, items: StatsItem[], prefer: boolean) => {
  const { res, out } = solveStatsSets(IDS, items, { timeMs: 90000, preferExamPrep: prefer });
  const bad = verifyStatsAssignment(out);
  console.log(`${label}: status=${res.status} 검증기 위반 ${bad.length} ${out.map((r) => { const ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0); return `${r.id} exam_prep ${ex}/${mcq(r) + r.virtual.length} = ${((ex / 42) * 100).toFixed(0)}% (가상 ${r.virtual.length + r.frqVirtual.length})`; }).join("; ")}`);
};
console.log(`가정: S3 원형 ${PASS}/10 통과 × 시드 ${SEEDS} (전부 exam_prep 판정) — 세트 ${IDS.join(",")}`);
show("현재 재고, 기본 배정      ", pool, false);
show("현재 재고, 난이도 우선    ", pool, true);
show("재고 + S3 가정, 난이도 우선", [...pool, ...synth], true);
