import { describe, expect, it } from "vitest";
import { AP_LAYOUTS, apBadgeText, apGuidanceLines, apPartialOfLayout, isOfficialFullLayout } from "./layouts";

const ab = AP_LAYOUTS.ap_calculus_ab;
describe("AP 표시 문구", () => {
  it("부분 구성 판별", () => {
    expect(apPartialOfLayout(ab.filter((x) => x.key === "ap_mc_a"))).toBe("noncalc_mc");
    expect(apPartialOfLayout(ab.filter((x) => x.key === "ap_mc_b"))).toBe("calc_mc");
    expect(apPartialOfLayout(ab.filter((x) => x.kind === "frq"))).toBe("frq");
    expect(apPartialOfLayout(ab)).toBeNull();
    expect(apPartialOfLayout(ab.filter((x) => x.kind === "mc"))).toBeNull(); // MC 전체는 부분 연습 정의가 아니다
  });
  it("Full Practice Exam 은 공식 구성(문항 수·시간 포함)일 때만", () => {
    expect(isOfficialFullLayout("ap_calculus_ab", ab)).toBe(true);
    expect(isOfficialFullLayout("ap_calculus_ab", ab.map((x) => (x.key === "ap_mc_a" ? { ...x, count: 28 } : x)))).toBe(false);
    expect(isOfficialFullLayout("ap_calculus_ab", ab.slice(0, 3))).toBe(false);
    expect(apBadgeText({ subject: "ap_calculus_ab", label: "full_practice", layout: ab })).toBe("Full Practice Exam");
    expect(apBadgeText({ subject: "ap_calculus_ab", label: "full_practice", layout: ab.slice(0, 1) })).toBe("Non-Calculator Practice");
    expect(apBadgeText({ subject: "ap_calculus_ab", label: "full_practice", layout: null })).toBe("Practice Set"); // 구성을 모르면 풀 시험이라고 말하지 않는다
    expect(apBadgeText({ subject: "ap_biology", label: "mc_practice", layout: null })).toBe("AP Multiple-Choice Practice");
  });
  it("시작 안내는 레이아웃 값을 그대로 쓴다", () => {
    expect(apGuidanceLines({ subject: "ap_calculus_ab", layout: ab.filter((x) => x.key === "ap_mc_b") })[0]).toBe("Practice for AP Calculus AB Section I, Part B: 13 multiple-choice questions in 38 minutes. A graphing calculator is required.");
    expect(apGuidanceLines({ subject: "ap_calculus_bc", layout: AP_LAYOUTS.ap_calculus_bc.filter((x) => x.key === "ap_mc_a") })[0]).toContain("AP Calculus BC Section I, Part A: 29");
    expect(apGuidanceLines({ subject: "ap_calculus_ab", layout: null })).toEqual([]);
  });
});

describe("이름 기반 보조 판별", () => {
  it("레이아웃이 없을 때만 정확한 세트 이름으로 파트 배지·안내", () => {
    expect(apBadgeText({ subject: "ap_calculus_ab", label: "mc_practice", layout: null, name: "AP Calculus AB — Non-Calculator Practice" })).toBe("Non-Calculator Practice");
    expect(apBadgeText({ subject: "ap_calculus_ab", label: "frq_practice", layout: undefined, name: "AP Calculus AB — Free-Response Practice 2" })).toBe("Free-Response Practice");
    expect(apBadgeText({ subject: "ap_calculus_ab", label: "mc_practice", layout: null, name: "Some other name" })).toBe("AP Multiple-Choice Practice");
    expect(apBadgeText({ subject: "ap_biology", label: "mc_practice", layout: null, name: "AP Biology — Non-Calculator Practice" })).toBe("AP Multiple-Choice Practice");
    expect(apGuidanceLines({ subject: "ap_calculus_ab", layout: null, name: "AP Calculus AB — Calculator Practice" })[0]).toContain("Part B: 13 multiple-choice questions in 38 minutes");
  });
});
