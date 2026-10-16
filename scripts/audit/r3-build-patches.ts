// 라운드 3 패치 JSON 생성(2026-10-13). 읽기 전용 SELECT 만: 공개된 AP FRQ 중 stimulus.description(실험 설정·조건)이 학생 화면에 없는 문항을 찾아,
// 고친 변환기(lib/ap-exam/convert.ts frqLostSetup)가 만드는 지문을 "새 문제 버전의 passage" 패치로 쓴다. DB 에 쓰지 않는다.
//   npx tsx scripts/audit/r3-build-patches.ts [--only-physics]   → data/audit/2026-10-13-r3-patches.json (+ 콘솔 요약)
import { writeFileSync } from "node:fs";
import { planConversion } from "../../lib/ap-exam/convert";
import { mathDelimitersBalanced, type Patch } from "../../lib/audit-fix/plan";
import { dbSelect } from "./apply-audit-fixes";

type Row = { key: string; idx: number; sub: string; kind: string; keyword_code: string; diff: string | null; payload: Record<string, unknown>; passage: string | null; version_id: string; sets: number };
const rows = dbSelect<Row>(`select p.ap_candidate_key as key, p.ap_item_index as idx, c.ap_subject_code as sub, c.kind, c.keyword_code, c.difficulty_provisional as diff, c.payload, pv.passage, pv.id as version_id,
  (select count(*) from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id and s.status = 'published' and s.archived_at is null where i.problem_id = p.id) as sets
  from problems p join ap_candidate_items c on c.candidate_key = p.ap_candidate_key join problem_versions pv on pv.id = p.published_version_id
  where p.status::text = 'confirmed' and c.kind = 'frq_bundle' and length(coalesce(c.payload->'stimulus'->>'description', '')) > 0 order by p.ap_candidate_key`);
const patches: Patch[] = [];
for (const r of rows) {
  const cand = { candidateKey: r.key, apSubjectCode: r.sub, kind: r.kind, payload: r.payload, keywordCode: r.keyword_code, difficultyProvisional: r.diff } as never;
  const plan = planConversion(cand);
  if (!plan.ok) { console.log(`skip ${r.key}: ${plan.reason}`); continue; }
  const next = plan.items[0].passage;
  if (!next || next === r.passage) continue;
  // 통화 기호($3, $55)가 수식 구분자로 읽히는 문항은 렌더 검사가 막는다(해설에도 같은 문제) — 별도 정정 대상으로 남기고 이 패치에서는 뺀다.
  if (!mathDelimitersBalanced(next) || /(?<!\\)\$\d/.test(next)) { console.log(`HOLD ${r.key}: unbalanced $ (currency) in passage — needs a separate text fix`); continue; }
  patches.push({
    id: `R3-${r.key.replace(/[^A-Za-z0-9]+/g, "_")}`, apCandidateKey: r.key, expectVersionId: r.version_id, kind: "ap",
    why: "AP FRQ: stimulus.description (experiment setup / conditions) was never shown to students because table/diagram figures carry no description. New problem version adds it as the passage (convert.ts frqLostSetup).",
    changes: [{ field: "passage", old: r.passage, new: next }],
  });
  console.log(`${r.sub}  ${r.key}  sets=${r.sets}  +passage: ${next.slice(0, 90)}`);
}
writeFileSync("data/audit/2026-10-13-r3-patches.json", JSON.stringify({ kind: "ap_frq_passage_patch_list_round3", generatedBy: "scripts/audit/r3-build-patches.ts", count: patches.length, patches }, null, 1) + "\n");
writeFileSync("data/audit/2026-10-13-r3-overrides.json", "{}\n");
console.log(`patches ${patches.length}`);
