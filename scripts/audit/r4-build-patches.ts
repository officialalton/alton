// 라운드 4 패치 JSON 생성(2026-10-14). 읽기 전용 SELECT 만(dbSelect), DB 에 쓰지 않는다.
//  (1) 공개된 AP·SAT 문항 중 금액 `$` 가 한 문장에 둘 이상 있거나 수식 구분자와 짝지어질 수 있는 본문(passage·question·explanation·explanation_en)을 `\$` 로 바꾼다
//      (lib/currency-dollars.ts — 화면 모양은 그대로, 수정 도구·게시 검사의 `$` 짝 맞춤과 어긋나지 않게). 선택지·진술·그림 표는 건드리지 않는다.
//  (2) micro-p2-a:ap_microeconomics-m32-k0(MC): 표 설명의 "한계비용 $26" 이 화면에 없어 풀 수 없던 문항 — 고친 변환기(convert.ts frqLostSetup)의 지문을 새 버전 passage 로 싣는다.
//  (3) micro-p1-b:ap_microeconomics-f05-k0(FRQ): 라운드 3 에서 보류(HOLD)했던 지문(`$3`, `$55`)을 이스케이프해 싣는다(위 (1)이 해설을 같이 고친다).
//   npx tsx scripts/audit/r4-build-patches.ts   → data/audit/2026-10-13-r4-patches.json (+ overrides) + 콘솔 요약
import { writeFileSync } from "node:fs";
import { planConversion } from "../../lib/ap-exam/convert";
import { escapeCurrencyDollars } from "../../lib/currency-dollars";
import { splitLearningContent } from "../../lib/render-learning-content";
import type { Patch } from "../../lib/audit-fix/plan";
import { dbSelect } from "./apply-audit-fixes";

type Row = { pid: string; exam: string | null; key: string | null; idx: number | null; vid: string; passage: string | null; question: string | null; explanation: string | null; explanation_en: string | null; sets: number };
const FIELDS = ["passage", "question", "explanation", "explanation_en"] as const;
const rows = dbSelect<Row>(`select p.id as pid, p.exam_system as exam, p.ap_candidate_key as key, p.ap_item_index as idx, pv.id as vid, pv.passage, pv.question, pv.explanation, pv.explanation_en,
  (select count(*) from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id and s.status = 'published' and s.archived_at is null where i.problem_id = p.id) as sets
  from problems p join problem_versions pv on pv.id = p.published_version_id
  where p.status::text = 'confirmed' and p.archived_at is null and (p.exam_system like 'sat%' or p.exam_system = 'ap' or p.ap_candidate_key is not null)
    and concat_ws(' ', pv.passage, pv.question, pv.explanation, pv.explanation_en) ~ '\\$[0-9]' order by p.exam_system, p.ap_candidate_key, p.id`);

// 화면 모양(글 조각은 이어 붙이고 수식은 html)이 이스케이프 전후로 같은지.
const view = (s: string) => {
  const out: string[] = [];
  for (const p of splitLearningContent(s)) {
    const piece = p.kind === "text" ? p.value : p.kind === "math" ? `<M:${p.html}>` : `<${p.kind}>`;
    if (p.kind === "text" && out.length && !out[out.length - 1].startsWith("<")) out[out.length - 1] += piece; else out.push(piece);
  }
  return JSON.stringify(out);
};

const SPECIAL = ["micro-p2-a:ap_microeconomics-m32-k0", "micro-p1-b:ap_microeconomics-f05-k0"];
const cands = dbSelect<{ key: string; sub: string; kind: string; keyword_code: string; diff: string | null; payload: Record<string, unknown> }>(
  `select candidate_key as key, ap_subject_code as sub, kind, keyword_code, difficulty_provisional as diff, payload from ap_candidate_items where candidate_key = any (array[${SPECIAL.map((k) => `'${k}'`).join(",")}])`);
const specialRows = dbSelect<Row>(`select p.id as pid, p.exam_system as exam, p.ap_candidate_key as key, p.ap_item_index as idx, pv.id as vid, pv.passage, pv.question, pv.explanation, pv.explanation_en, 0 as sets
  from problems p join problem_versions pv on pv.id = p.published_version_id where p.ap_candidate_key = any (array[${SPECIAL.map((k) => `'${k}'`).join(",")}]) and p.status::text = 'confirmed'`);
for (const s of specialRows) if (!rows.some((r) => r.pid === s.pid)) rows.push(s);

const patches: Patch[] = []; const log: string[] = []; const counts = { escape: 0, special: 0, held: 0 };
const bySystem: Record<string, number> = {};
for (const r of rows) {
  const changes: Patch["changes"] = [];
  for (const f of FIELDS) {
    const cur = r[f]; if (!cur) continue;
    const next = escapeCurrencyDollars(cur);
    if (next === cur) continue;
    if (view(next) !== view(cur)) { log.push(`HOLD ${r.key ?? r.pid} ${f}: rendered view differs after escape`); counts.held++; continue; }
    changes.push({ field: f, old: cur, new: next });
  }
  const spec = r.key && SPECIAL.includes(r.key) ? cands.find((c) => c.key === r.key) : undefined;
  if (spec) {
    const plan = planConversion({ candidateKey: spec.key, apSubjectCode: spec.sub, kind: spec.kind, payload: spec.payload, keywordCode: spec.keyword_code, difficultyProvisional: spec.diff } as never);
    if (!plan.ok) { log.push(`HOLD ${spec.key}: ${plan.reason}`); counts.held++; }
    else {
      const next = plan.items[r.idx ?? 0]?.passage ?? null;
      if (next && next !== r.passage && !changes.some((c) => c.field === "passage")) { changes.push({ field: "passage", old: r.passage, new: next }); counts.special++; }
      else if (next && next !== r.passage) { const c = changes.find((x) => x.field === "passage")!; c.new = next; counts.special++; }
    }
  }
  if (!changes.length) continue;
  counts.escape += spec ? 0 : 1;
  bySystem[r.exam ?? "?"] = (bySystem[r.exam ?? "?"] ?? 0) + 1;
  patches.push({
    id: `R4-${r.pid.slice(0, 8)}`, problemId: r.pid, expectVersionId: r.vid, kind: r.exam?.startsWith("sat") ? "sat" : "ap",
    why: spec ? "AP item whose stimulus description (a stated condition such as the marginal cost, or currency amounts) was missing or unsafe on the student screen: adds/repairs the passage and escapes currency dollars (\\$)." : "Currency amounts written with bare $ are stored as \\$ so they can never be paired as a math span (rendered view unchanged).",
    changes,
  });
  log.push(`${r.exam}  ${r.key ?? r.pid}  sets=${r.sets}  ${changes.map((c) => c.field).join("+")}`);
}
writeFileSync("data/audit/2026-10-13-r4-patches.json", JSON.stringify({ kind: "ap_sat_currency_dollar_patch_list_round4", generatedBy: "scripts/audit/r4-build-patches.ts", count: patches.length, patches }, null, 1) + "\n");
writeFileSync("data/audit/2026-10-13-r4-overrides.json", "{}\n");
for (const l of log) console.log(l);
console.log(`patches ${patches.length} (currency-escape ${counts.escape}, special ${SPECIAL.length}); by exam_system ${JSON.stringify(bySystem)}; held ${counts.held}`);
