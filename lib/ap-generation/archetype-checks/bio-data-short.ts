// (b) 이 원형(frq_bio_data_short)만의 **내부 설계 조건** — 공식 근거가 아니고 전역 수용 게이트도 아니다. 원형 설계가 의도한 평가 목적 분리를 지키는지만 본다.
// 공식 근거 여부: 공식 짧은 데이터 FRQ(분석한 2023~2026 채점 가이드)는 파트마다 데이터 스킬(4.x 표현·5.x 통계·6.x 논증)을 평가하고 개념 설명은 일부 파트에 있다고 보는 것이 우리의 읽기이며, "파트의 3/4 이 개념을 요구해야 한다"는 규칙은 공식 근거가 없다(그래서 폐기). 코드: archetype_design:data_short:*.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type ArchIssue = { code: string; message: string };
const MECH = /(shape|structure|active site|denatur|optimum)/i;
const PURPOSES = ["table_interpretation", "quantitative_analysis", "statistical_reasoning", "biological_explanation"] as const;
export function bioDataShortDesignChecks(p: Json): ArchIssue[] {
  const out: ArchIssue[] = []; const add = (c: string, m: string) => out.push({ code: `archetype_design:data_short:${c}`, message: m }); const parts: Json[] = p.parts ?? [];
  // 평가 목적 선언: 파트마다 purpose, 네 목적이 한 번씩
  const got = parts.map((x) => x.purpose); if (parts.some((x) => !PURPOSES.includes(x.purpose))) add("purpose_missing", "파트마다 평가 목적(purpose)을 선언해야 한다");
  else if (new Set(got).size !== parts.length) add("purpose_not_distinct", "평가 목적이 파트마다 달라야 한다(표 해석·정량·통계 추론·생물학적 설명)");
  // 개념은 필요한 곳에서만: concept_needed 파트는 기제를 채점하고, 아닌 파트는 기제 키워드를 넣지 않는다(키워드 채우기 금지)
  for (const x of parts) {
    const rubricText = (x.rubric_rows ?? []).flatMap((r: Json) => r.required_elements ?? []).join(" "); const hasMech = MECH.test(x.prompt ?? "") || MECH.test(rubricText);
    if (x.concept_needed) { if (!(x.rubric_rows ?? []).some((r: Json) => r.uses_concept && (r.required_elements ?? []).some((e: string) => MECH.test(String(e))))) add("concept_part_not_scored", `파트 ${x.label}: 개념 파트인데 루브릭이 기제(구조·활성 부위·최적 조건)를 채점하지 않는다`); }
    else if (hasMech) add("concept_keyword_stuffing", `파트 ${x.label}: 개념이 필요 없는 파트에 기제 키워드가 들어 있다`);
  }
  if (!parts.some((x) => x.concept_needed)) add("no_concept_part", "토픽 개념을 실제로 요구하는 파트가 하나도 없다");
  // 표 해석 파트: 값을 인용하게 한다(단순 읽기 개선), 통계 파트: 특정 두 수준을 지정하고 범위 비교를 요구
  const A = parts.find((x) => x.purpose === "table_interpretation"); if (A && !/values?|data/i.test(A.prompt ?? "")) add("table_part_no_evidence", "표 해석 파트가 표 값 인용을 요구하지 않는다");
  const C = parts.find((x) => x.purpose === "statistical_reasoning"); if (C && /if any/i.test(C.prompt ?? "")) add("stat_part_open_ended", "통계 파트가 '있다면'식 열린 질문이다(특정 두 수준을 지정해야 한다)");
  return out;
}
