// docs/ap/sample-report-run2.md — Calc AB run1(LLM 생성) vs run2(코드 우선 생성) 전/후 비교. 입력: data/ap/sample-2027/{run1,run2a,run2b,run2,run2bc}. API·DB 없음.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const root = path.resolve(process.cwd(), "data/ap/sample-2027");
const rd = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf-8")) as J;
const has = (p: string) => existsSync(path.join(root, p));
const fam = (r: string): string => /key_mismatch|numeric_check|wrong_key|multiple_correct|criterion_failed_key|solver_disagree|fable/.test(r) ? "key / numeric correctness" : /stimulus|wrong_stimulus|missing_set_stimulus|missing_stimulus/.test(r) ? "stimulus / data completeness" : /distractor|explanation|misconception/.test(r) ? "distractors / explanation" : /scope|out_of_scope|skill|reference|resembles|unfair/.test(r) ? "scope / skill / reference pattern" : /exam_suitability|time|calculator|decimal/.test(r) ? "exam suitability" : /duplicate/.test(r) ? "duplicate" : "other gates";
function stats(run: string, subject: string) {
  const c = rd(`${run}/candidates.json`) as J[]; const rep = rd(`${run}/report.json`);
  const xs = c.filter((x) => x.apSubjectCode === subject); const fam_: Record<string, number> = {};
  xs.filter((x) => x.rejectionReason).forEach((x) => { const seen = new Set<string>(); String(x.rejectionReason).split("; ").forEach((r) => seen.add(fam(r))); seen.forEach((f) => (fam_[f] = (fam_[f] ?? 0) + 1)); });
  const ad = xs.filter((x) => (x.reviewState === "pending_expert_review" || x.reviewState === "auto_passed") && !x.reserve);
  const mcAd = ad.filter((x) => x.kind === "mc").length; const frqAd = ad.length - mcAd;
  const bs = rep.bySubject?.[subject];
  return { candidates: xs.length, passed: xs.filter((x) => !x.rejectionReason).length, adopted: ad.length, mcAd, frqAd, rejected: xs.filter((x) => x.rejectionReason).length, fam: fam_, cost: bs ? bs.costUsd : rep.totalCostUsd, callsPerAdopted: bs ? bs.callsPerAdopted : rep.callsPerAdopted, fileRep: rep };
}
const lines: string[] = [];
const r1 = stats("run1", "ap_calculus_ab");
const hist: [string, string][] = [["run2a", "코드 우선 1차(원형 30+FRQ 4, 초기 게이트)"], ["run2b", "게이트·원형 1차 수정 후(문장 LLM, 해설 코드화)"], ["run2", "최종(원인별 수정 반복, 결과 누적)"]];
lines.push("# AP Calculus AB 샘플 2차(run2) — 코드 우선 생성 파이프라인 전/후 비교", "", "대상: 안 B의 Calc AB 칸(MC 30 + FRQ 4). run1 = LLM이 정답·표·루브릭까지 생성, run2 = **Python 원형이 정답·표·그래프·루브릭 구조를 계산하고 LLM은 문장만**, 해설은 코드가 작성. 가이드: `docs/ap/generation-guides/calc-core.md`·`calc-ab.md`(설정 `lib/ap-generation/subjects/calc-ab.ts`).", "");
lines.push("## 결과 요약", "", "| 항목 | run1(이전) | run2(코드 우선 최종) |", "|---|---|---|");
const f = rd("run2/report.json"); const r2 = stats("run2", "ap_calculus_ab");
lines.push(`| 후보 수 | ${r1.candidates} | ${f.candidates} |`, `| 자동 검수 전체 통과 | ${r1.passed} (${(r1.passed / r1.candidates * 100).toFixed(0)}%) | ${f.passedAll} (${(f.passedAll / f.candidates * 100).toFixed(0)}%) |`, `| 채택(칸당 1) MC / FRQ | ${r1.mcAd}/30, ${r1.frqAd}/4 | ${f.mcAdopted}/30, ${f.frqAdopted}/4 |`, `| 수율(채택/후보) | ${(r1.adopted / r1.candidates * 100).toFixed(1)}% | ${(f.yield * 100).toFixed(1)}% |`, `| 비용(과목 합) | $${r1.cost} | 최종 상태 재현 비용 $${f.totalCostUsd} (반복 4회 누적 신규 지출 $${f.newSpendSinceBaseline}) |`, `| 호출/채택 | ${r1.callsPerAdopted} | ${f.callsPerAdopted} |`, `| 중복 게이트 탈락 | 0(사후 쌍 비교 0쌍) | ${f.duplicateRejected} |`, "");
lines.push("## 반려 원인 계열(후보당 1회 집계) — 원인별 전/후", "", "| 계열 | run1 | run2 최종 |", "|---|---|---|");
for (const k of ["key / numeric correctness", "stimulus / data completeness", "distractors / explanation", "scope / skill / reference pattern", "exam suitability", "duplicate", "other gates"]) lines.push(`| ${k} | ${r1.fam[k] ?? 0} | ${r2.fam[k] ?? 0} |`);
lines.push("", "## 반복 이력(같은 칸·후보 구조, 원인을 고친 단계별)", "", "| 단계 | 설명 | 후보 | 통과 | 채택 MC/FRQ | 미충전 칸 | 신규 지출(누적) |", "|---|---|---|---|---|---|---|");
for (const [d, t] of hist) if (has(`${d}/report.json`)) { const r = rd(`${d}/report.json`); lines.push(`| ${d} | ${t} | ${r.candidates} | ${r.passedAll} | ${r.mcAdopted}/${r.frqAdopted} | ${r.unfilledCells.length} | $${r.newSpendSinceBaseline} |`); }
lines.push("", "## 원인 분석으로 고친 것(규칙 완화 없이 생성기·게이트 수정)", "",
"1. **LLM이 계산한 표·키 수치 오류 → 코드가 계산**: run1에서 표 값 오류·키 오류(검증 코드 불일치 포함)가 반려의 큰 몫이었다. 원형이 sympy+독립 수치 경로로 모든 값을 계산해 해소.",
"2. **오답이 서술된 오개념과 값이 맞지 않음 → 값을 오개념 공식에서 직접 계산하고 `why`에 실제 수치를 넣은 한 문장**으로 작성(검토에서 반복 지적된 항목: 곱의 미분, 몫 규칙, 음함수, 연쇄법칙, 치환 적분, 관련 변화율, 최적화).",
"3. **해설 속 LLM 환각 파생 수치 → 해설을 코드가 작성**(정답 근거 + 선택지별 오개념). LLM은 지문 문장만.",
"4. **계산기 불가 문항의 소수 선택지(π·e 근사) → 정확값 표기**(`fmt` 개선) + 결정적 게이트 `decimal_options_in_no_calculator_item`.",
"5. **토픽·스킬 불일치**: `lim_table` 1.3→1.4(표), `motion_calc` 4.1→4.2, `ivt` 1.15→1.16, `linearization`에 과대/과소 판단 추가(1.F), `lhopital` 3.D→1.E, `accum_context_calc` 3.D→1.D, `cont_piece` 3.D→1.E(스킬 비중 P3 20% 이내).",
"6. **FRQ 재설계**: 표 FRQ를 6.2 중심 한 시나리오로(감소 모형·좌합 과대·IVT 조건), f' 그래프 FRQ를 정수 넓이·병합된 증가 구간으로(검토가 잡은 실제 오류: 인접 구간 미병합), 미분방정식 FRQ의 템플릿 변수 누출 제거와 H>Ta 조건 명시, 면적·부피 FRQ에서 단원 밖 파트(평행 접선) 제거 → 평균값(8.1).",
"7. **검토기 설정 오류 수정**: 공식 FRQ가 1/1/2/5점 파트 구조인데 '1~3점' 요구, 일반 교과서형을 '공식 문항 유사'로 오탐 → 프롬프트·참조 프로필 정정(기준 완화가 아니라 기준 오류 수정). 정당화 문항의 번호 문자 정규식 오탐(f(c))도 수정.",
"", "## 정직한 한계", "",
"- **최종 run2 수치는 같은 후보 집합에 대해 원인을 고치며 반복한 누적 결과**다. 반복 중 검토기(LLM)에 맞춰 튜닝했을 위험이 있다 → 채택 후보 전원이 전문가 검수 대기이며, 전문가 검수가 필수 게이트는 아니되 샘플링으로 검증해야 한다.",
"- LLM 지문 다듬기는 수치·수식 보존 게이트 때문에 11/136만 채택되어 사실상 **코드 템플릿 지문**이 쓰였다(정확성 우선). 지문 자연스러움 개선은 후속.",
"- 계산기 필요 MC는 6/30(20%)로 공식 파트 B 비율(약 31%)에 못 미친다(원형 부족).",
"- 공식 FRQ 6유형 중 4유형만 구현(입자 운동·음함수/관련 변화율 FRQ 미구현).",
"- 그림 렌더링 전: 그래프 자료는 데이터 명세만 있다.");
if (has("run2bc/report.json")) {
  const b = rd("run2bc/report.json"); const sh = has("run2bc/shared_from_ab.json") ? rd("run2bc/shared_from_ab.json") : { mcShared: [], frqShared: [] };
  const bcc = (rd("run2bc/candidates.json") as J[]).filter((x) => (x.reviewState === "pending_expert_review" || x.reviewState === "auto_passed") && !x.reserve);
  const byUnit: Record<string, number> = {}; bcc.filter((x) => x.kind === "mc").forEach((x) => (byUnit[x.unitCode] = (byUnit[x.unitCode] ?? 0) + 1));
  lines.push("", "## Calculus BC 샘플(같은 파이프라인, BC 전용 칸만 새로 생성 + AB 공유분 재태깅)", "",
    `- BC 전용 칸: MC ${b.mcAdopted}/16 채택, FRQ ${b.frqAdopted}/2 채택(급수·매개). 후보 ${b.candidates}, 전체 통과 ${b.passedAll}, 수율 ${(b.yield * 100).toFixed(1)}%, 신규 지출(누적, 반복 포함) $${b.newSpendSinceBaseline}, 호출/채택 ${b.callsPerAdopted}. 미충전 칸: ${b.unfilledCells.join(", ") || "없음"}.`,
    `- BC 전용 MC 채택 단원 분포: ${JSON.stringify(byUnit)}`,
    `- AB 채택 문항 재사용(content_key 공유 태깅): MC ${sh.mcShared.length}개 + FRQ ${sh.frqShared.length}개 (\`data/ap/sample-2027/run2bc/shared_from_ab.json\`). BC 샘플 총계: MC ${b.mcAdopted + sh.mcShared.length}/30, FRQ ${b.frqAdopted + sh.frqShared.length}/4.`,
    "- 반려 원인 상위: " + Object.entries(b.rejectionReasons as Record<string, number>).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(", "));
}
writeFileSync(path.resolve(process.cwd(), "docs/ap/sample-report-run2.md"), lines.join("\n") + "\n");
console.log(lines.slice(0, 22).join("\n"));
