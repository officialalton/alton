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

import { apCoverageLines, apUnitsFromDomains } from "./layouts";
describe("단원 안내", () => {
  it("sat_domain → 정렬된 단원", () => { expect(apUnitsFromDomains(["ap:8.2", "ap:4.3", "ap:5.1", "ap:4.1", null, "rw_x", "ap:6.7"])).toEqual(["4", "5", "6", "8"]); });
  it("부분 세트는 Covers + 전범위 아님 안내, 공식 풀 구성은 생략", () => {
    const l = apCoverageLines({ subject: "ap_calculus_ab", units: ["4", "5", "6", "8"], layout: AP_LAYOUTS.ap_calculus_ab.filter((x) => x.key === "ap_mc_b"), label: "mc_practice" });
    expect(l[0]).toBe("Covers Units 4, 5, 6, 8.");
    expect(l[1]).toMatch(/should not be read as achievement across the whole AP Calculus AB course/);
    expect(apCoverageLines({ subject: "ap_calculus_ab", units: ["4"], label: "mc_practice", result: true })).toEqual(["Covers Unit 4.", "Your result reflects only this unit. It is not a measure of your achievement across the whole AP Calculus AB course."]);
    expect(apCoverageLines({ subject: "ap_calculus_ab", units: ["1", "2"], layout: AP_LAYOUTS.ap_calculus_ab, label: "full_practice" })).toEqual([]);
    expect(apCoverageLines({ subject: "ap_calculus_ab", units: [], label: "mc_practice" })).toEqual([]);
  });
});

import { apSectionDisplayLabel, isShortFrqLayout } from "./layouts";
describe("짧은 FRQ 연습 세트 표기(공식 Part A/B 로 보이지 않게)", () => {
  const off = AP_LAYOUTS.ap_calculus_ab.filter((x) => x.kind === "frq");
  const one = [{ ...off[0], count: 4, minutes: 60 }];
  it("공식 6문항 구성은 공식 라벨 그대로, 그 외는 Practice Section", () => {
    expect(isShortFrqLayout(off)).toBe(false); expect(isShortFrqLayout(one)).toBe(true);
    expect(apSectionDisplayLabel(off[0], off)).toBe(off[0].label);
    expect(apSectionDisplayLabel(one[0], one)).toBe("Practice Section: Free Response (calculator allowed)");
    const two = [{ ...off[0], count: 1, minutes: 15 }, { ...off[1], count: 2, minutes: 30 }];
    expect(apSectionDisplayLabel(two[1], two)).toBe("Practice Section 2: Free Response (no calculator)");
  });
  it("안내: 4문항·60분 단일 구간 → Practice Section (…): calculator allowed.", () => {
    const g = apGuidanceLines({ subject: "ap_calculus_ab", layout: one });
    expect(g[1]).toBe("Practice Section (4 questions, 60 min): calculator allowed.");
    expect(g.join(" ")).not.toMatch(/Part [AB]/);
    expect(apGuidanceLines({ subject: "ap_calculus_ab", layout: off })[1]).toBe("Part A (2 questions, 30 min): calculator allowed. Part B (4 questions, 60 min): no calculator.");
  });
});
