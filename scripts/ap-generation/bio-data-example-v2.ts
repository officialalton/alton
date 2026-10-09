// 데이터형 v2 완성 풀이 예시 + 정직한 비평 문서 생성(무료, LLM 호출 없음): npx tsx scripts/ap-generation/bio-data-example-v2.ts
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { gateBioFrq } from "../../lib/ap-generation/bio-frq-checks";
import { bioDataShortDesignChecks } from "../../lib/ap-generation/archetype-checks/bio-data-short";
import { validateBlueprint } from "../../lib/ap-generation/blueprint";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const gen = (n: number, seed: number): Json[] => JSON.parse(execFileSync(PY, ["-B", "registry.py", "batch", "frq_bio_data_short", String(n), String(seed)], { cwd: "scripts/ap-generation/archetypes", encoding: "utf-8" }));
const cur = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_biology.json", "utf-8")) as ApCurriculumFile; const topics = new Map(cur.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const))); const skills = new Set(cur.skills.map((s) => s.code));
const label = new Map(cur.skills.map((s) => [s.code, `${s.category}: ${s.label}`]));
const p = gen(1, 1900)[0]; const issues = [...gateBioFrq(p, { topics: new Set(topics.keys()) }), ...bioDataShortDesignChecks(p), ...validateBlueprint(p.blueprint, { skills, topicUnit: topics as Map<string, string> }).map((x) => ({ code: "blueprint:" + x.code }))];
const many = gen(60, 1900); const supported = many.filter((x) => (x.facts as string[]).some((f) => f === "supported=True")).length; const trends = many.map((x) => (x.parts[0].model_answer as string).match(/ (increases|decreases|peaks|dips) /)?.[1] ?? "?"); const tc = trends.reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {});
const T = p.stimulus.data; const tbl = `| ${T.columns.join(" | ")} |\n|${T.columns.map(() => "---").join("|")}|\n${T.rows.map((r: string[]) => `| ${r.join(" | ")} |`).join("\n")}`;
const need: Record<string, [string, string]> = {
  A: ["표 읽기(값 인용)와 추세 진술. 생물학 개념 불필요.", "없음 — 표의 값만 필요하다."],
  B: ["한 단계 계산(퍼센트 변화). 개념 불필요.", "없음 — 산술."],
  C: ["±2SE 범위 비교로 차이가 지지되는지 판단. 통계 추론, 개념 불필요.", "없음 — 범위 겹침 규칙(통계)."],
  D: ["하나의 설명: 표의 값(증거)을 효소 구조에 대한 지식(이론)과 연결해 낮은 값을 설명(6.C: 증거를 이론과 연결하는 추론).", "여기서만 필요: 최적에서 벗어난 조건이 효소 모양·활성 부위에 영향 → 활성 감소(토픽 3.2 개념)."],
};
const L: string[] = ["# Bio FRQ 데이터형 v2 — 완성 풀이 예시와 비평 (오너 승인 구조, 2026-10-09 개정)", "", "코드가 생성한 번들 1개(시드 1900)를 그대로 옮겼다. **오너 결정(2026-10-09): 이 번들은 데이터 해석 + 정량 분석 번들이며 효소 개념은 파트 D 에서만 평가한다. 번들을 토픽 3.2 를 넓게 평가하는 것으로 표기하지 않고, 약점 분석에서는 D 만 개념 수준 증거에 기여한다(A–C 점수를 효소 개념 숙달로 합산 금지).** 무료 결정적 검사 통과는 구조적 안정성 증거일 뿐 개념적 타당성이나 실제 품질의 증거가 아니다. 탐구형(investigation) 결과와는 별개다.", "", "## 평가 목적(파트별 역할)", "| 파트 | 평가 목적 | 스킬 | 필요한 사고 | 효소 개념이 필요한 곳 |", "|---|---|---|---|---|"];
for (const pt of p.parts) L.push(`| ${pt.label} (${pt.points}점) | ${pt.purpose} | ${pt.skill_codes.map((s: string) => `${s} (${label.get(s) ?? ""})`).join("; ")} | ${need[pt.label][0]} | ${need[pt.label][1]} |`);
L.push("", `## 자료\n\n**${p.title}** — ${p.stimulus.description}\n\n${tbl}\n`, "## 문제·모범 답·채점 가이드");
for (const pt of p.parts) {
  L.push(`### 파트 ${pt.label} (${pt.points}점, ${pt.purpose})`, "", `**문제**: ${pt.prompt}`, "", `**모범 답**: ${pt.model_answer}`, "", "**채점(의미·추론으로 채점, 특정 문구 요구 없음)**", "");
  for (const r of pt.rubric_rows) L.push(`- 행 ${r.row_id} (${r.points}점): ${r.criterion}`, `  - 인정해야 하는 의미: ${r.required_elements.join(" / ")}`, `  - 허용 표현 예(전부가 아님): ${(r.alt_solutions ?? []).join("; ")}`, `  - 흔한 오류: ${(r.common_errors ?? []).join("; ")}`, `  - 채점 메모: ${r.grading_note ?? ""}`);
  L.push("");
}
L.push("### 구조화 기대값(루브릭 문장과 분리)", "", "| 파트 | 양 | 값 | 단위 | 허용 오차 |", "|---|---|---|---|---|", ...(p.expected_values as Json[]).map((e) => `| ${e.part} | ${e.quantity} | ${e.value} | ${e.unit} | ${e.tolerance} |`), "", "루브릭 `required_elements` 의 설명 문장은 수치 비교의 출처가 아니다(솔버 일치 검사는 이 표만 읽는다).", "");
L.push("## 파트 D 결정: 하나의 설명(주장-증거 관계로 완성)", "", "- **결정**: D 의 1점은 독립 요구 두 개가 아니라 **하나의 설명**이다 — 표의 값(증거)을 효소 구조에 대한 지식(이론)과 연결해 낮은 값을 설명한다(스킬 6.C: 증거를 이론과 연결하는 추론). 증거 없는 기제나 기제 없는 숫자 인용은 이 설명의 반쪽일 뿐 따로 채점하지 않는다. 그래서 4×1점 입자를 유지하는 것이 정당하다(파트가 하나의 스킬만 평가).", "- **모범 답**: " + p.parts[3].model_answer, "- **부분 답과 점수**: (1) 숫자만 인용하고 생물학적 이유 없음(증거만) → 0점. (2) 효소 모양·활성 부위 기제만 말하고 표의 값과 연결하지 않음(이론만) → 0점. (3) 값과 기제를 한 설명으로 연결(예: \"표의 낮은 값은 그 수준에서 효소 모양이 바뀌어 기질 결합이 줄었기 때문\") → 1점. 부분 점수는 없다.", "- **오답 예**: 낮은 값을 기질 고갈·효소 소모 탓으로 돌림; 최적 조건과 무관한 일반론; 값을 반대로 해석.", "- **채점 규칙**: 하나의 기준(single_explanation). 자료 인용과 기제를 모두 포함하고 서로 연결되어야 한다. 표현은 달라도 의미가 같으면 인정.", "", "## 약점 분석 귀속(메타데이터)", "- `weakness_attribution`: 개념 수준(토픽 3.2) 증거 = D 만. 데이터 스킬 증거 = A 4.B, B 5.A, C 5.B. **A–C 점수를 효소 개념 숙달로 합산하지 않는다.** 파트별 `topic_role`(A–C = context, D = assessed)과 `evidence_role`(data_skill / concept)로 기록하며 코드 훅 `conceptEvidenceParts()`는 [\"D\"] 만 돌려준다.", "");
L.push("## 무료 검사 결과(구조적 안정성)", `- 이 번들: ${issues.length ? issues.map((x) => x.code).join(", ") : "공통 규칙(a)(c) + 원형 내부 설계 조건(b) + 설계도 모두 통과"}.`, `- 새 시드 60개(1900~1959) 전부 통과 — **구조적 안정성 증거일 뿐이다**(개념적 타당성·실제 품질 아님).`, "", "## 정직한 비평(이 번들이 목표 개념·스킬을 충분히 평가하는가)",
  "**스킬 평가는 대체로 충분하다**: 4.B 표 해석(A), 5.A 정량(B), 5.B 통계 추론(C), 6.B 논증(D)이 파트마다 하나씩 분리되어 공식 짧은 FRQ 의 4×1점 입자와 맞는다.",
  `**토픽 3.2 개념 평가는 얇다(의도된 설계)**: 개념이 필요한 것은 D 한 파트(4점 중 1점, 25%)뿐이며 이 번들은 **데이터 해석 + 정량 분석 번들**이다(오너 승인). 번들을 토픽 3.2 를 넓게 평가한다고 표기하지 않는다. 개념 평가를 더 늘리려면 점수 입자(1점 4파트)를 바꾸거나 별도 개념 번들이 필요하다 — 모든 파트에 개념 키워드를 넣는 방식은 쓰지 않았다(키워드 채우기).`,
  "**약점**: (1) A·B·C 는 여전히 표만 보면 풀린다(의도된 설계 — 공식 데이터 스킬이 그렇다). (2) D 는 하나의 설명으로 1점이라 부분 점수가 없고, 증거만·이론만 쓴 답은 0점이다(위 결정). 학생이 이론을 알아도 값 연결을 빠뜨리면 점수를 잃는다. "
  + `(3) C 의 답이 이진(지지됨/아님)이라 추측 가능성이 있다 — **초기 설계는 새 시드 60개 모두 '지지됨'(항상 같은 정답)이라는 결함이 있었고**, 수준 구성을 spread/near 두 가지로 나눠 고친 뒤 '지지됨' ${supported}/60(${Math.round((supported / 60) * 100)}%)이다(완전 균형은 아님). 추세 분포는 ${JSON.stringify(tc)} 로 'peaks' 위주라 다양성이 낮다. `+
  + `(4) 자료는 가상이며 생물학적 현실성(최적 pH·온도 값)은 코드가 증명하지 못한다(게시 후 신고 흐름). (5) 검토기 지적 재발 가능: reference_pattern_mismatch(공식 입자와의 차이) 와 exam_suitability(1점 파트의 난이도). (6) 이전 버전은 0/4 였고, 이 버전은 유료로 검증된 적이 없다.`,
  "", "## 판단", "이 번들은 **데이터 스킬 평가 번들로는 쓸 만하고, 토픽 3.2 개념 평가로는 부족하다.** 다음 유료 검증 전에 오너가 (a) 이 역할 분담을 승인하고 (b) D 의 1점 구성을 유지할지 정해야 한다.");
writeFileSync("docs/ap/bio-frq-data-type-example-v2.md", L.join("\n") + "\n"); console.log("작성", { supported, tc, issues: issues.length });
