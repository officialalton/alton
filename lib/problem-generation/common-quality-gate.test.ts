import { describe, it, expect } from "vitest";
import { findBannedWords, checkExplanationDerivation, checkTagConsistency, categorizeFailureCode, summarizeForAdmin } from "./common-quality-gate";

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
