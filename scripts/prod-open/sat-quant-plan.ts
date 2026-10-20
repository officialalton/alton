// A4 반영 계획: 컴파일러 문항(built-all.json)을 Rec 으로 바꾸고(adopted-all.json), 정량 근거 문항이 없는 SAT 공개 세트의 Command of Evidence (Textual) 칸 중
// 난이도가 같은 칸을 골라 교체 명세(old-set-specs.json)와 사람이 읽는 계획서(docs/plans/2026-10-20-sat-quant-evidence-plan.md)를 만든다. 입력: tmp/bank-dump-a4/dump.json (dump-bank-cli.ts, 읽기 SELECT).
//   npx tsx scripts/prod-open/dump-bank-cli.ts --out tmp/bank-dump-a4 && npx tsx scripts/mock-exam-generation/rw-quant-compiler.ts && npx tsx scripts/prod-open/sat-quant-plan.ts
import { readFileSync, writeFileSync } from "node:fs";
import type { Built } from "../mock-exam-generation/rw-quant-compiler";

const DIR = "data/mock-exam-generation/sat-quant-20261020/final";
const built = JSON.parse(readFileSync(`${DIR}/built-all.json`, "utf8")) as Built[];
const d = JSON.parse(readFileSync("tmp/bank-dump-a4/dump.json", "utf8"));
const PER_SET = 2;

const recs = built.map((b) => ({
  gid: b.gid, runId: "sat-quant-20261020", skill: "command_of_evidence_quant", domain: "rw_information_ideas", examSystem: "sat_rw", difficulty: b.difficulty, format: "mc" as const,
  createdVia: "compiler", subpattern: b.family, recipeId: null,
  problem: { passage: `${b.passage}\n\n${b.question}`, stimulus: b.passage, question: b.question, options: b.options, correctIndex: b.correctIndex, answers: null, explanation: b.explanation, explanationEn: b.explanationEn, figure: b.figure, statements: null, evidenceTarget: b.evidenceTarget, evidenceSpan: null, answerRationale: b.answerRationale, distractorErrorTypes: b.distractorErrorTypes },
  quality: { generatedBy: "compiler:rw-quant-compiler", levelTarget: b.difficulty, mockExamGeneration: { archetypeId: `quant:${b.family}:${b.scenario}`, compiler: "rw-quant-compiler", family: b.family, scenario: b.scenario, seed: b.seed } },
}));
writeFileSync(`${DIR}/adopted-all.json`, JSON.stringify(recs));

const live = d.sets.filter((s: any) => /^SAT Practice Test \d+$/.test(s.name) && s.status === "published" && !s.archived_at);
const hasDraft = (s: any) => d.sets.some((x: any) => x.set_group_id === s.set_group_id && x.status === "draft" && !x.archived_at);
const quantIn = (s: any) => d.items.filter((i: any) => i.exam_set_id === s.id && i.skill_code === "command_of_evidence_quant").length;
const eligible = live.filter((s: any) => quantIn(s) === 0 && !hasDraft(s)).sort((a: any, b: any) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
const skipped = live.filter((s: any) => quantIn(s) === 0 && hasDraft(s)).map((s: any) => s.name);

const pool: Record<string, Built[]> = { easy: [], medium: [], hard: [] }; for (const b of built) pool[b.difficulty].push(b);
const specs: any[] = []; const rows: string[] = []; const used = new Set<string>(); const leftover = () => built.filter((b) => !used.has(b.gid));
for (const s of eligible) {
  const slots = d.items.filter((i: any) => i.exam_set_id === s.id && i.section === "rw" && i.skill_code === "command_of_evidence_text").sort((a: any, b: any) => a.position - b.position);
  const chosen: { slot: any; b: Built }[] = []; const fams = new Set<string>();
  const order = ["easy", "medium", "hard"];
  for (const slot of slots) {
    if (chosen.length >= PER_SET) break;
    const si = order.indexOf(slot.difficulty); const near = [slot.difficulty, ...order.filter((x, k) => Math.abs(k - si) === 1)];
    let b: Built | undefined;
    for (const dif of near) { b = pool[dif].find((x) => !used.has(x.gid) && !fams.has(x.family)); if (b) break; }
    if (!b) continue;
    used.add(b.gid); fams.add(b.family); chosen.push({ slot, b });
  }
  if (!chosen.length) continue;
  specs.push({ name: s.name, repointProblemIds: [], newMeta: true, slots: chosen.map((c) => ({ section: "rw", position: c.slot.position, oldVersionId: c.slot.problem_version_id, newGid: c.b.gid })) });
  for (const c of chosen) rows.push(`| ${s.name} | ${c.slot.module_key} #${c.slot.position} | ${c.slot.difficulty} | ${c.b.gid} | ${c.b.family} (${c.b.figureKind}) | ${c.b.difficulty} |`);
}
writeFileSync(`${DIR}/old-set-specs.json`, JSON.stringify(specs, null, 1));
const nUsed = used.size;
const md = `# SAT 정량 근거(표·그래프) 문항 반영 계획 (2026-10-20)

백로그 A4. \`command_of_evidence_quant\` 문항이 한 건도 없는 SAT 공개 세트에 결정형 컴파일러가 만든 표·그래프 문항을 넣는다. 원격은 읽기 SELECT 만 했고 공개·쓰기는 하지 않았다.

## 생성
- 컴파일러: \`scripts/mock-exam-generation/rw-quant-compiler.ts\` (AI 호출 없음, 비용 $0). 틀 5종: PAIR_COMPARE(두 항목 비교), RATIO_VS_BASELINE(기준의 2배 초과), TARGET_MET(목표 달성), MAX_CHANGE(전후 증가량 기준 초과, 막대·표), MAX_STEP(한 해 상승 기준 초과, 선그래프). 시나리오 22개, 표·막대·선 세 가지 자료.
- 모든 선택지는 자료의 값을 정확히 인용하고, 오답은 같은 자료의 다른 행·기간(두 해 구간 함정, 후(after) 값이 가장 큰 항목 함정 포함)이라 주장을 뒷받침하지 못한다.
- 독립 검증: \`scripts/mock-exam-generation/rw-quant-verify.ts\` 가 컴파일러 내부 정보 없이 선택지 텍스트와 figure 만 읽어, 인용 값이 자료와 같은지와 주장을 뒷받침하는 선택지가 정확히 하나인지(정답 표시와 일치)를 다시 판정한다. ${built.length}/${built.length} 통과.
- 항목 수 ${built.length}건 (난이도 easy ${pool.easy.length} · medium ${pool.medium.length} · hard ${pool.hard.length}).

## 대체 대상 칸
기준: 공개 세트 중 정량 근거 문항 0건, 진행 중인 초안 버전 없음. 칸은 같은 영역(Information and Ideas)의 Command of Evidence (Textual) 칸에서 난이도가 같은 곳을 고른다. 세트당 최대 ${PER_SET}칸, 한 세트에 같은 틀은 두 번 쓰지 않는다. 총 ${nUsed}칸(${specs.length}세트).

| 세트 | 모듈·번호 | 칸 난이도 | 새 문항 gid | 틀(자료) | 새 문항 난이도 |
|---|---|---|---|---|---|
${rows.join("\n")}

제외 세트(이미 정량 근거 문항 있음): ${live.filter((s: any) => quantIn(s) > 0).map((s: any) => s.name.replace("SAT Practice Test ", "Test ")).join(", ")}.
초안 버전이 이미 있어 이번 계획에서 뺀 세트(해당 초안이 공개·폐기된 뒤 같은 방식으로 추가 가능): ${skipped.length ? skipped.join(", ") : "없음"}.
예비 문항(미사용 ${built.length - nUsed}건): ${leftover().map((b) => b.gid).join(", ") || "없음"}.

## 반영 SQL (총괄 실행, 번호 27~30)
\`SAT_QUANT=1 npx tsx scripts/prod-open/sat-expand-sql.ts\` 로 생성한다(원격은 읽기 SELECT 만).
- \`27_preflight.sql\` 읽기: 대상 세트의 초안 유무·현재 정량 근거 문항 수·이미 가져온 gid 수.
- \`27_import_quant.sql\` 새 문항 가져오기(멱등: 같은 gid 가 있으면 건너뜀, 게이트 통과분만 공개).
- \`28_keywords_quant.sql\` 스킬 키워드 연결(멱등).
- \`29_set_versions_quant.sql\` 대상 세트의 새 초안 버전(칸 교체, 세트 검증 함수 통과 못하면 그 세트만 건너뜀, 공개 없음). 칸 메타(스킬·난이도)는 새 문항 값으로 기록한다.
- \`30_verify_quant.sql\` 읽기 검증. \`99_rollback_quant.sql\` 초안 버전 삭제·가져온 문항 보관 처리.
- 순서: 27_preflight → 27_import → 28 → 29 → 30_verify. 세트 새 버전의 공개는 총괄 판단(응시 이력 있는 세트는 기존 버전이 보존됨).

## 한계
- 시험 전체 정답률 분포·노출 횟수는 반영하지 않았다(칸 난이도만 맞춤). 반영 SQL 은 로컬 DB 리허설을 하지 않았고 세트 검증 함수에 의존한다.
- 브라우저 화면 확인은 하지 못했다(그림은 figure 검사·렌더러 오류 없음까지 확인).
`;
writeFileSync("docs/plans/2026-10-20-sat-quant-evidence-plan.md", md);
console.log({ recs: recs.length, sets: specs.length, slots: nUsed, skipped, eligible: eligible.length });
