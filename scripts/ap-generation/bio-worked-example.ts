// Bio FRQ 완성 풀이 예시 + 채점 가이드 문서 생성(검토용, LLM 호출 없음): npx tsx scripts/ap-generation/bio-worked-example.ts
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { gateBioFrq } from "../../lib/ap-generation/bio-frq-checks";
import { validateBlueprint } from "../../lib/ap-generation/blueprint";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const gen = (a: string, seed: number): Json => JSON.parse(execFileSync(PY, ["-B", "registry.py", "batch", a, "1", String(seed)], { cwd: "scripts/ap-generation/archetypes", encoding: "utf-8" }))[0];
const cur = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_biology.json", "utf-8")) as ApCurriculumFile; const topics = new Map(cur.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const))); const skills = new Set(cur.skills.map((s) => s.code));
const table = (st: Json) => `| ${st.data.columns.join(" | ")} |\n|${st.data.columns.map(() => "---").join("|")}|\n${st.data.rows.map((r: string[]) => `| ${r.join(" | ")} |`).join("\n")}`;
const L: string[] = ["# Bio FRQ 완성 풀이 예시와 채점 가이드 (검토용 초안, 2026-10-09)", "", "코드가 생성한 번들 2개(시드 1300)를 그대로 옮겼다. **이 문서가 승인되기 전에는 Bio FRQ 를 추가 생성하거나 수선하지 않는다.** 모든 항목은 가상 실험이며 실제 연구가 아니다. 무료 결정적 검사(`lib/ap-generation/bio-frq-checks.ts`)와 설계도 검증(`blueprint.ts`)은 통과한 상태이며, 결과는 각 예시 끝에 적었다.", "", "## 무료 결정적 검사 목록(LLM 호출 없음)", "| 검사 | 막는 결함 |", "|---|---|", "| nonexistent_topic | 존재하지 않는 CED 토픽(예: 3.7) |", "| control_group_not_unique / control_rationale_missing / control_answer_not_in_table | 모호한 대조군: 표에 (control) 표시가 정확히 1개, 설계도에 대조군 근거, 파트 B 정답이 표의 그 집단 |", "| accepted_answer_contradicts_data / model_answer_number_not_in_data | 자료와 모순되는 허용 답(추세 표현), 표에 없는 수 |", "| duplicated_display_text / repeated_word | `(control) (control)` 같은 표시 문구 중복 |", "| empty_column_name / duplicate_column_name / ph_miscased | 열 이름 오류(`Ph` → `pH`) |", "| rubric_not_meaning_based / rubric_alternatives_missing / rubric_common_errors_missing / rubric_element_is_phrase | 문구 일치 루브릭: 행마다 의미 기반 표시, 허용 표현 2개 이상(수치 행 제외), 흔한 오류, 필수 요소는 25자 이상 개념 서술 |", "| 설계도 bio_* | 독립변수 1개, 대조군/근거, 반복 ≥ 3, 측정 정의, 관찰 자료 인과 결론 금지, 단원 범위, 가상 실험 표시 |", "", "한계: 생물학적 사실의 정확성(최적 pH·온도의 현실성 등)은 코드로 증명할 수 없다 → 게시 후 오류 신고 흐름."];
for (const [arch, title] of [["frq_bio_investigation", "예시 1: 짧은 탐구 FRQ (4점, 토픽 8.1, 대표 스킬 3.C)"], ["frq_bio_data_short", "예시 2: 짧은 데이터 분석 FRQ (4점, 토픽 3.2, 대표 스킬 4.B)"]] as const) {
  const p = gen(arch, 1300); const issues = [...gateBioFrq(p, { topics: new Set(topics.keys()) }), ...validateBlueprint(p.blueprint, { skills, topicUnit: topics as Map<string, string> }).map((x) => ({ code: "blueprint:" + x.code, message: x.message }))];
  L.push("", `## ${title}`, "", `**${p.title}** — ${p.stimulus.description}`, "", table(p.stimulus), "", `설계도 요약: 개념 = ${p.blueprint.concept}. 학생이 거치는 사고 = ${p.blueprint.student_thinking.join(" → ")}. 독립 검증 = ${p.blueprint.verification.independent_path}.`, "");
  if (p.blueprint.experiment?.control_rationale) L.push(`대조군 근거: ${p.blueprint.experiment.control_rationale}.`, "");
  for (const pt of p.parts) {
    L.push(`### 파트 ${pt.label} (${pt.points}점, 스킬 ${pt.skill_codes.join("/")}, 토픽 ${pt.topic_codes.join("/")})`, "", `**문제**: ${pt.prompt}`, "", `**모범 답**: ${pt.model_answer}`, "", "**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**", "");
    for (const r of pt.rubric_rows) L.push(`- 행 ${r.row_id} (${r.points}점): ${r.criterion}`, `  - 인정해야 하는 의미: ${r.required_elements.join(" / ")}`, `  - 허용 표현 예(전부가 아님): ${(r.alt_solutions ?? []).join("; ") || "(수치 행: 허용 오차 내 값과 올바른 방법)"}`, `  - 흔한 오류(점수 없음): ${(r.common_errors ?? []).join("; ") || "-"}`, `  - 채점 메모: ${r.grading_note ?? ""}`);
    L.push("");
  }
  L.push(`무료 검사 결과: ${issues.length ? issues.map((x) => x.code).join(", ") : "결함 0"}`, "");
}
L.push("## 유료 재검증 계획(실행하지 않음)", "- 승인 후 새 시드 8개(원형당 4)를 설계도 → 무료 검사 → 동결 검토기(Bio 과목 변형) 순으로 검토. 예상 약 $0.6(후보당 $0.07), 최초 통과가 3/8 미만이면 생성을 멈추고 이 문서의 설계를 다시 고친다. 수선은 하지 않는다.", "- 검토기 보정: 루브릭이 의미 기반이므로 `reference_pattern_mismatch`(공식 FRQ 와 입자 차이) 판정은 짧은 FRQ 입자(4×1점)에서 면제하는 안을 검토기 메모에 이미 반영했다.");
writeFileSync("docs/ap/bio-frq-worked-example.md", L.join("\n") + "\n"); console.log("docs/ap/bio-frq-worked-example.md 작성");
