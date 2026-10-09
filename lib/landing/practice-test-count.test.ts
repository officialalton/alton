import { describe, expect, it } from "vitest";
import { summarizeAvailability } from "./practice-test-count";

describe("summarizeAvailability", () => {
  it("SAT(null/sat)와 AP 과목별 세트·full 수를 센다", () => {
    const r = summarizeAvailability([
      { exam_program: null, ap_subject: null, ap_label: null },
      { exam_program: "sat", ap_subject: null, ap_label: null },
      { exam_program: "ap", ap_subject: "ap_calculus_ab", ap_label: "full_practice" },
      { exam_program: "ap", ap_subject: "ap_calculus_ab", ap_label: "mc_practice" },
      { exam_program: "ap", ap_subject: "ap_calculus_ab", ap_label: "frq_practice" },
      { exam_program: "ap", ap_subject: "ap_unknown", ap_label: "full_practice" },
    ]);
    expect(r.sat).toBe(2);
    expect(r.ap).toEqual([{ subject: "ap_calculus_ab", label: "AP Calculus AB", sets: 3, fullExams: 1 }]);
  });
  it("빈 입력은 빈 값", () => expect(summarizeAvailability([])).toEqual({ sat: 0, ap: [] }));
});
