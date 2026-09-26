import { describe, it, expect } from "vitest";
import { findBannedWords, checkExplanationDerivation, checkTagConsistency, categorizeFailureCode, summarizeForAdmin, isMostlyKorean } from "./common-quality-gate";

describe("isMostlyKorean", () => {
  it("한국어 서술문은 참이다", () => {
    expect(isMostlyKorean("지문 전체의 중심 생각: 산호초의 생태적 중요성이 색깔이나 성장 속도가 아니라 서식지의 물리적 복잡성에서 비롯된다는 것.")).toBe(true);
  });
  // 실측(command_of_evidence_text 5문항 배치, `scripts/evidence-model-verify.ts --only=command_of_evidence_text`) —
  // 같은 skill_code 안에서도 evidence_target이 한국어 서술문이 아니라 영어 명제 문장으로 나오는
  // 문항이 섞여 있었다("Which quotation ... best illustrates ..." 유형 질문은 target도 영어로 나오는 경향).
  it("영어 명제 문장은 거짓이다(실측 사례, command_of_evidence_text)", () => {
    expect(isMostlyKorean("Extreme sexual dimorphism in anglerfish evolved as an adaptation to mate scarcity in the deep sea.")).toBe(false);
  });
  it("빈 문자열/글자 없는 문자열은 거짓이다", () => {
    expect(isMostlyKorean("")).toBe(false);
    expect(isMostlyKorean("123 -- !!")).toBe(false);
  });
});

describe("findBannedWords", () => {
  it("ALTON 브랜드명·내부 필드명이 학생 노출 필드에 있으면 잡는다", () => {
    expect(findBannedWords({ 해설: "이 문제는 ALTON 내부 검토용입니다." }).length).toBeGreaterThan(0);
    expect(findBannedWords({ 해설: "evidence_span 값을 참고하세요." }).length).toBeGreaterThan(0);
  });
  it("정상 텍스트는 통과한다", () => {
    expect(findBannedWords({ 해설: "이 문제의 정답은 함수의 기울기가 3이기 때문입니다." })).toEqual([]);
  });
});

describe("checkExplanationDerivation", () => {
  it("핵심 값이 해설에 없으면 실패한다", () => {
    const issues = checkExplanationDerivation("정답은 B입니다.", ["기울기 3", "$40"]);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("explanation_no_derivation");
  });
  it("핵심 값 중 하나라도 있으면 통과한다", () => {
    expect(checkExplanationDerivation("기울기 3을 대입하면 정답은 B입니다.", ["기울기 3", "$40"])).toEqual([]);
  });
  it("keyFacts가 없으면 건너뛴다(오탐 방지)", () => {
    expect(checkExplanationDerivation("정답은 B입니다.", [])).toEqual([]);
  });

  // 2026-09-18 — R&W 근거 모델(evidence-model) 4개 스킬에서 이 검사가 거의 100% 오탐이던
  // 결함 수정 검증. 호출부(pipeline.ts)가 evidence_span(영어 축자 인용)을 keyFacts에서 빼고
  // evidence_target(한국어로 합성된 서술문)만 넘기도록 고쳤고, 이 검사 자체도 완전 축어 포함이
  // 실패하면 "의미 있는 단어 상당수가 해설에 등장하는가"의 부분 일치로 완화했다.
  // 아래 실제 값은 `scripts/evidence-model-verify.ts --only=central_ideas_details --count=3`을
  // 로컬 Supabase + 실제 Anthropic 호출로 돌려 얻은 실제 생성 결과다
  // (`docs/2026-09-18-problem-bank-full-reset-progress.jsonl`의 실패 패턴과 동일한 스킬).
  describe("evidence-model target(한국어 합성 서술문) 실측 검증", () => {
    const realExplanation =
      "지문은 산호초가 시각적으로 아름답다는 통념을 언급한 뒤, 실제 생태적 중요성은 색깔이 아니라 복잡한 서식지 구조 때문이라고 결론짓는다. " +
      "따라서 정답은 C이다. A는 지문이 명시적으로 부정하는 '색채' 요인을 원인으로 제시하므로 인과관계를 왜곡했다. " +
      "B는 산호 골격 형성 과정이라는 세부 사실만 다루어 전체 요지인 생태적 중요성의 이유를 놓쳤다(TOO_NARROW_DETAIL). " +
      "D는 '1% 미만'이라는 세부 통계는 맞지만 이를 중심 생각처럼 제시하며 정작 핵심 이유(구조적 복잡성)를 언급하지 않아 질문에 정확히 답하지 못한다(WRONG_FOCUS).";
    const realEvidenceTarget = "지문 전체의 중심 생각: 산호초의 생태적 중요성이 색깔이나 성장 속도가 아니라 산호가 만드는 서식지의 물리적 복잡성에서 비롯된다는 것.";
    const realEvidenceSpan =
      "a disproportion attributable not to the corals' color or growth rate but to the sheer physical complexity of the habitat they slowly construct";

    it("한국어로 정확히 도출된 해설은 evidence_target과 부분 일치만 해도 통과한다(실측 사례, 완전 축자 일치는 아님)", () => {
      expect(checkExplanationDerivation(realExplanation, [realEvidenceTarget], 1)).toEqual([]);
    });

    it("영어 evidence_span을 keyFacts에 넣으면(수정 전 버그 재현) 한국어 해설과 절대 안 맞는다 — 그래서 호출부가 이제 evidence_span을 빼야 한다는 근거", () => {
      // 이 자체는 여전히 실패해야 정상이다(한국어 해설이 영어 문장을 축자 포함할 리 없음) —
      // 회귀 방지용이 아니라 "왜 evidenceSpan을 keyFacts에서 뺐는지"를 문서화하는 테스트다.
      expect(checkExplanationDerivation(realExplanation, [realEvidenceSpan], 1).length).toBe(1);
    });

    it("질문만 재진술하고 실제 도출 과정이 없는 해설은 여전히 거부한다(과도한 완화가 아님을 확인)", () => {
      const restatedOnly = "정답은 C이다. 지문의 중심 생각을 가장 잘 나타낸 선택지를 고르면 된다.";
      const issues = checkExplanationDerivation(restatedOnly, [realEvidenceTarget], 1);
      expect(issues.length).toBe(1);
      expect(issues[0].code).toBe("explanation_no_derivation");
    });
  });

  // 2026-09-18 2차 실측(inferences/command_of_evidence_text 5문항씩 재검증) — target이
  // 스킬이 아니라 문항마다 한국어 서술문일 때도, 영어 명제 문장일 때도 있다는 걸 확인했다.
  // 아래는 실제로 통과·저장된 cross_text_connections 문항의 target/explanation 그대로다
  // (problem=e762374d-41f8-4d06-84e2-55fbfc24cf1c, `scripts/evidence-model-verify.ts
  // --only=cross_text_connections --count=5` 실행 결과).
  describe("cross_text_connections 실측(한국어 target, 자연스러운 의역 해설)", () => {
    // 실제 저장된 explanation 원문(problem_versions.id=0e69c001-69e7-4c44-9eda-01a13f14a872,
    // 로컬 Supabase `psql`로 직접 조회) — target을 문장 그대로 옮기지 않고 다른 어순·조사·
    // 표현으로 다시 썼다(옛 완전 축어 포함 검사라면 거부됐을 정상 사례).
    const realTarget =
      "Text 2는 혼잡 요금이 저소득 통근자에게 불균형한 부담을 주고 혼잡을 주변 지역으로 이전시킬 뿐이라는 점에서, " +
      "Text 1이 말하는 '도로 공간의 효율적 재배분'이라는 평가에 반박한다.";
    const realExplanation =
      "Text 2는 요금이 저소득 통근자에게 불균형하게 부담이 되고, 혼잡이 인근 지역으로 이동할 뿐이라는 점을 지적하여 " +
      "Text 1의 '효율적 재배분' 주장에 반박한다. A가 이 핵심을 정확히 담고 있다.";

    it("완전히 다른 어순·표현이어도 핵심 단어(혼잡·재배분·반박 등)가 상당수 겹치면 통과한다", () => {
      expect(checkExplanationDerivation(realExplanation, [realTarget], 1)).toEqual([]);
    });
  });

  // 실측(inferences 5문항 재검증)에서 target이 영어 명제 문장으로 나온 실패 사례 — pipeline.ts는
  // 이런 문항에서 이 검사 자체를 건너뛰지만(isMostlyKorean 게이트), 함수 자체는 여전히
  // "영어 target을 한국어 해설과 맞추려 하면 실패한다"는 원래 동작을 유지해야
  // 한다(회귀 시 이 값싼 검사가 다시 영어 target을 그대로 받으면 어떤 결과가 나오는지 문서화).
  describe("영어 target(2026-09-18 실측, command_of_evidence_text)", () => {
    const englishTarget =
      "The pidgin's grammar was shaped by convergence on patterns shared across multiple source languages rather than by dominance of a single source language.";
    const koreanExplanationDerivingIt =
      "지문의 근거는 두 부분으로 구성된다: (1) 여러 언어에 공통으로 나타난 문법 규칙은 살아남는다, " +
      "(2) 한 언어에만 있는 고유 규칙은 사라진다. 선택지 B는 이 두 조건을 모두 구체적 사례로 만족시킨다.";

    it("영어 target을 그대로 keyFacts에 넣으면 정상적으로 도출한 한국어 해설도 실패한다 — 그래서 pipeline.ts가 isMostlyKorean으로 이 경우를 건너뛴다", () => {
      expect(checkExplanationDerivation(koreanExplanationDerivingIt, [englishTarget], 1).length).toBe(1);
    });

    it("isMostlyKorean이 영어 target을 한국어로 오판하지 않는다", () => {
      expect(isMostlyKorean(englishTarget)).toBe(false);
    });
  });
});

describe("checkTagConsistency", () => {
  it("spr인데 options가 남아있으면 실패한다", () => {
    expect(checkTagConsistency({ format: "spr", options: ["3", "4"], answers: ["3"] }).length).toBeGreaterThan(0);
  });
  it("mc인데 answers가 채워져 있으면 실패한다", () => {
    expect(checkTagConsistency({ format: "mc", options: ["3", "4"], answers: ["3"] }).length).toBeGreaterThan(0);
  });
  it("정상 spr/mc는 통과한다", () => {
    expect(checkTagConsistency({ format: "spr", options: null, answers: ["3"] })).toEqual([]);
    expect(checkTagConsistency({ format: "mc", options: ["3", "4"], answers: null })).toEqual([]);
  });
});

describe("categorizeFailureCode / summarizeForAdmin", () => {
  it("코드를 다섯 분류 중 하나로 매핑한다", () => {
    expect(categorizeFailureCode("latex_leak")).toBe("rendering");
    expect(categorizeFailureCode("forbidden_word")).toBe("forbidden_word");
    expect(categorizeFailureCode("option_duplicate")).toBe("answer_evidence");
    expect(categorizeFailureCode("tag_consistency")).toBe("tag_consistency");
  });
  it("관리자에게는 원문 대신 분류 라벨만 준다", () => {
    const summary = summarizeForAdmin([{ code: "forbidden_word", message: "내부 검증 원문 — 절대 노출 금지 문자열" }]);
    expect(summary.publishable).toBe(false);
    expect(summary.archiveReasonLabel).toBe("금칙어 검출");
    expect(summary.archiveReasonLabel).not.toContain("내부 검증 원문");
  });
});
