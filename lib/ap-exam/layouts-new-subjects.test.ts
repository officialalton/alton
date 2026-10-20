// 2026-10-20 신규 10과목 기반 작업 테스트(레이아웃·이름·분류·FRQ 유형). 기존 14과목 동작은 layouts.test.ts 가 지킨다.
import { describe, expect, it } from "vitest";
import { AP_LAYOUTS, AP_NEW_SUBJECT_FRQ_TYPES, AP_PENDING_PUBLIC_SUBJECTS, AP_SUBJECT_NAME, apBadgeText, isOfficialFullLayout, totalMinutes } from "./layouts";
import { AP_SUBJECTS } from "../problem-taxonomy";
import { AP_SUBJECT_CODES } from "../ap-curriculum/types";

const NEW = AP_PENDING_PUBLIC_SUBJECTS;
describe("신규 10과목 레이아웃", () => {
  it("10과목 모두 코드·이름·레이아웃·분류·FRQ 유형·커리큘럼 코드를 가진다", () => {
    expect(NEW).toHaveLength(10);
    for (const c of NEW) {
      expect(AP_SUBJECT_NAME[c], c).toBeTruthy();
      expect(AP_LAYOUTS[c]?.length, c).toBeGreaterThan(0);
      expect(AP_SUBJECTS.some((a) => a.code === c), c).toBe(true);
      expect(AP_NEW_SUBJECT_FRQ_TYPES[c]?.length, c).toBeGreaterThan(0);
      expect((AP_SUBJECT_CODES as readonly string[]).includes(c), c).toBe(true);
      expect(AP_LAYOUTS[c].some((x) => x.kind === "mc") && AP_LAYOUTS[c].some((x) => x.kind === "frq"), c).toBe(true);
    }
  });
  it("공식 문항 수·시간(CED/AP Central 확인값)", () => {
    const sig = (c: string) => AP_LAYOUTS[c].map((x) => `${x.key}:${x.count}/${x.minutes}${x.calculator === "required" ? "R" : x.calculator === "not_allowed" ? "N" : x.calculator === "allowed" ? "A" : ""}`).join(" ");
    for (const c of ["ap_physics_2", "ap_physics_c_mechanics", "ap_physics_c_electricity_and_magnetism"]) expect(sig(c)).toBe("ap_mc:42/85A ap_frq:4/95A");
    expect(sig("ap_environmental_science")).toBe("ap_mc:80/90A ap_frq:3/70A");
    expect(sig("ap_us_government_and_politics")).toBe("ap_mc:55/80 ap_frq:4/100");
    expect(sig("ap_comparative_government_and_politics")).toBe("ap_mc:55/60 ap_frq:4/90");
    expect(sig("ap_human_geography")).toBe("ap_mc:60/60 ap_frq:3/75");
    expect(sig("ap_computer_science_principles")).toBe("ap_mc:70/120 ap_frq:2/60");
    expect(sig("ap_european_history")).toBe("ap_mc:55/55 ap_saq:3/40 ap_frq:2/100");
    expect(sig("ap_precalculus")).toBe("ap_mc_a:29/65N ap_mc_b:13/40R ap_frq_a:2/35R ap_frq_b:2/35N");
    expect(totalMinutes("ap_precalculus", "full_practice")).toBe(175); // 2시간 55분
    expect(totalMinutes("ap_physics_2", "full_practice")).toBe(180);
  });
  it("FRQ 유형 수는 레이아웃과 맞고, 배점 합은 공식 값(확인된 과목)과 같다", () => {
    const sum = (c: string) => AP_NEW_SUBJECT_FRQ_TYPES[c].reduce((a, t) => a + (t.points ?? 0), 0);
    expect(sum("ap_physics_2")).toBe(40);
    expect(sum("ap_physics_c_electricity_and_magnetism")).toBe(40);
    expect(sum("ap_us_government_and_politics")).toBe(17);
    expect(sum("ap_comparative_government_and_politics")).toBe(19);
    expect(sum("ap_human_geography")).toBe(21);
    expect(AP_NEW_SUBJECT_FRQ_TYPES.ap_precalculus.map((t) => t.points)).toEqual([6, 6, 6, 6]);
    expect(AP_NEW_SUBJECT_FRQ_TYPES.ap_physics_c_mechanics.every((t) => t.points === null)).toBe(true); // 미확인 값은 비워 둔다
    const frqCount = (c: string) => AP_LAYOUTS[c].filter((x) => x.kind === "frq").reduce((a, x) => a + x.count, 0);
    // Euro 는 SAQ 3 + DBQ + LEQ = 5유형, CSP 는 WR1·2a·2b·2c 4프롬프트(레이아웃 문항 2)라 유형 수가 다르다
    for (const c of NEW) if (c !== "ap_computer_science_principles") expect(AP_NEW_SUBJECT_FRQ_TYPES[c].length, c).toBe(c === "ap_european_history" ? 5 : frqCount(c));
    expect(AP_NEW_SUBJECT_FRQ_TYPES.ap_computer_science_principles).toHaveLength(4);
  });
  it("기존 14과목 레이아웃은 그대로", () => {
    expect(AP_LAYOUTS.ap_physics_1.map((x) => `${x.count}/${x.minutes}`)).toEqual(["42/85", "4/95"]);
    expect(AP_LAYOUTS.ap_us_history.map((x) => `${x.count}/${x.minutes}`)).toEqual(["55/55", "3/40", "2/100"]);
    expect(Object.keys(AP_SUBJECT_NAME).length - NEW.length).toBe(14);
  });
  it("Full Practice Exam 은 신규 과목에서도 공식 구성일 때만", () => {
    expect(isOfficialFullLayout("ap_precalculus", AP_LAYOUTS.ap_precalculus)).toBe(true);
    expect(isOfficialFullLayout("ap_precalculus", AP_LAYOUTS.ap_precalculus.slice(0, 2))).toBe(false);
    expect(apBadgeText({ subject: "ap_european_history", label: "full_practice", layout: AP_LAYOUTS.ap_european_history })).toBe("Full Practice Exam");
    expect(apBadgeText({ subject: "ap_european_history", label: "full_practice", layout: AP_LAYOUTS.ap_european_history.slice(0, 1) })).toBe("Practice Set");
  });
});
