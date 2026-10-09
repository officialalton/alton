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
const p = gen(1, 1800)[0]; const issues = [...gateBioFrq(p, { topics: new Set(topics.keys()) }), ...bioDataShortDesignChecks(p), ...validateBlueprint(p.blueprint, { skills, topicUnit: topics as Map<string, string> }).map((x) => ({ code: "blueprint:" + x.code }))];
const many = gen(60, 1800); const supported = many.filter((x) => (x.facts as string[]).some((f) => f === "supported=True")).length; const trends = many.map((x) => (x.parts[0].model_answer as string).match(/ (increases|decreases|peaks|dips) /)?.[1] ?? "?"); const tc = trends.reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {});
const T = p.stimulus.data; const tbl = `| ${T.columns.join(" | ")} |\n|${T.columns.map(() => "---").join("|")}|\n${T.rows.map((r: string[]) => `| ${r.join(" | ")} |`).join("\n")}`;
const need: Record<string, [string, string]> = {
  A: ["표 읽기(값 인용)와 추세 진술. 생물학 개념 불필요.", "없음 — 표의 값만 필요하다."],
  B: ["한 단계 계산(퍼센트 변화). 개념 불필요.", "없음 — 산술."],
  C: ["±2SE 범위 비교로 차이가 지지되는지 판단. 통계 추론, 개념 불필요.", "없음 — 범위 겹침 규칙(통계)."],
  D: ["자료로 주장을 뒷받침하고, 낮은 수준에서 활성이 낮은 **생물학적 이유**를 설명.", "여기서만 필요: 최적에서 벗어난 조건이 효소 모양·활성 부위에 영향 → 활성 감소(토픽 3.2 개념)."],
};
const L: string[] = ["# Bio FRQ 데이터형 v2 — 완성 풀이 예시와 비평 (검토용, 2026-10-09)", "", "코드가 생성한 번들 1개(시드 1800)를 그대로 옮겼다. **유료 호출 없음 — 이 설계는 검토기로 검증된 적이 없다.** 무료 결정적 검사 통과는 구조적 안정성 증거일 뿐 개념적 타당성이나 실제 품질의 증거가 아니다. 탐구형(investigation) 결과와는 별개다.", "", "## 평가 목적(파트별 역할)", "| 파트 | 평가 목적 | 스킬 | 필요한 사고 | 효소 개념이 필요한 곳 |", "|---|---|---|---|---|"];
for (const pt of p.parts) L.push(`| ${pt.label} (${pt.points}점) | ${pt.purpose} | ${pt.skill_codes.map((s: string) => `${s} (${label.get(s) ?? ""})`).join("; ")} | ${need[pt.label][0]} | ${need[pt.label][1]} |`);
L.push("", `## 자료\n\n**${p.title}** — ${p.stimulus.description}\n\n${tbl}\n`, "## 문제·모범 답·채점 가이드");
for (const pt of p.parts) {
  L.push(`### 파트 ${pt.label} (${pt.points}점, ${pt.purpose})`, "", `**문제**: ${pt.prompt}`, "", `**모범 답**: ${pt.model_answer}`, "", "**채점(의미·추론으로 채점, 특정 문구 요구 없음)**", "");
  for (const r of pt.rubric_rows) L.push(`- 행 ${r.row_id} (${r.points}점): ${r.criterion}`, `  - 인정해야 하는 의미: ${r.required_elements.join(" / ")}`, `  - 허용 표현 예(전부가 아님): ${(r.alt_solutions ?? []).join("; ")}`, `  - 흔한 오류: ${(r.common_errors ?? []).join("; ")}`, `  - 채점 메모: ${r.grading_note ?? ""}`);
  L.push("");
}
L.push("### 구조화 기대값(루브릭 문장과 분리)", "", "| 파트 | 양 | 값 | 단위 | 허용 오차 |", "|---|---|---|---|---|", ...(p.expected_values as Json[]).map((e) => `| ${e.part} | ${e.quantity} | ${e.value} | ${e.unit} | ${e.tolerance} |`), "", "루브릭 `required_elements` 의 설명 문장은 수치 비교의 출처가 아니다(솔버 일치 검사는 이 표만 읽는다).", "");
L.push("## 무료 검사 결과(구조적 안정성)", `- 이 번들: ${issues.length ? issues.map((x) => x.code).join(", ") : "공통 규칙(a)(c) + 원형 내부 설계 조건(b) + 설계도 모두 통과"}.`, `- 새 시드 60개(1800~1859) 전부 통과 — **구조적 안정성 증거일 뿐이다**(개념적 타당성·실제 품질 아님).`, "", "## 정직한 비평(이 번들이 목표 개념·스킬을 충분히 평가하는가)",
  "**스킬 평가는 대체로 충분하다**: 4.B 표 해석(A), 5.A 정량(B), 5.B 통계 추론(C), 6.B 논증(D)이 파트마다 하나씩 분리되어 공식 짧은 FRQ 의 4×1점 입자와 맞는다.",
  `**목표 개념(토픽 3.2 효소 기능에 대한 환경 영향) 평가는 얇다**: 개념이 필요한 것은 D 한 파트(4점 중 1점, 25%)뿐이다. 이 번들은 개념 이해 평가라기보다 **데이터 분석 번들에 개념 설명이 하나 붙은 형태**다. 개념 평가를 더 늘리려면 점수 입자(1점 4파트)를 바꾸거나 별도 개념 번들이 필요하다 — 모든 파트에 개념 키워드를 넣는 방식은 쓰지 않았다(키워드 채우기).`,
  "**약점**: (1) A·B·C 는 여전히 표만 보면 풀린다(의도된 설계 — 공식 데이터 스킬이 그렇다). (2) D 한 점에 '자료로 뒷받침' + '생물학적 이유' 두 요소를 모두 요구해 1점이 가혹할 수 있고 부분 점수가 없다. "
  + `(3) C 의 답이 이진(지지됨/아님)이라 추측 가능성이 있다 — **초기 설계는 새 시드 60개 모두 '지지됨'(항상 같은 정답)이라는 결함이 있었고**, 수준 구성을 spread/near 두 가지로 나눠 고친 뒤 '지지됨' ${supported}/60(${Math.round((supported / 60) * 100)}%)이다(완전 균형은 아님). 추세 분포는 ${JSON.stringify(tc)} 로 'peaks' 위주라 다양성이 낮다. `+
  + `(4) 자료는 가상이며 생물학적 현실성(최적 pH·온도 값)은 코드가 증명하지 못한다(게시 후 신고 흐름). (5) 검토기 지적 재발 가능: reference_pattern_mismatch(공식 입자와의 차이) 와 exam_suitability(1점 파트의 난이도). (6) 이전 버전은 0/4 였고, 이 버전은 유료로 검증된 적이 없다.`,
  "", "## 판단", "이 번들은 **데이터 스킬 평가 번들로는 쓸 만하고, 토픽 3.2 개념 평가로는 부족하다.** 다음 유료 검증 전에 오너가 (a) 이 역할 분담을 승인하고 (b) D 의 1점 구성을 유지할지 정해야 한다.");
writeFileSync("docs/ap/bio-frq-data-type-example-v2.md", L.join("\n") + "\n"); console.log("작성", { supported, tc, issues: issues.length });
