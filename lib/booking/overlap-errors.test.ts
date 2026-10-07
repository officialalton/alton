import { describe, it, expect } from "vitest";
import { parseOverlapError, friendlyDbMessage, OVERLAP_MESSAGES } from "./overlap-errors";

describe("parseOverlapError", () => {
  const cases: Array<[string, unknown, "teacher_overlap" | "student_overlap" | "consultant_overlap"]> = [
    ["teacher_buffer_violation 토큰", new Error("teacher_buffer_violation"), "teacher_overlap"],
    ["23P01 reservations_no_overlap 원문", { code: "23P01", message: 'conflicting key value violates exclusion constraint "reservations_no_overlap"' }, "teacher_overlap"],
    ["student_time_overlap 트리거", { code: "P0001", message: "student_time_overlap: 이미 같은 시간에 다른 수업이 있습니다." }, "student_overlap"],
    ["학생 겹침 한글만", "이미 같은 시간에 다른 수업이 있습니다.", "student_overlap"],
    ["컨설턴트 상담 겹침", { code: "23P01", message: "같은 컨설턴트의 상담 일정과 시간이 겹칩니다. 다른 시간을 선택해 주세요." }, "consultant_overlap"],
    ["컨설턴트 미팅 겹침", new Error("같은 컨설턴트의 다른 미팅과 시간이 겹칩니다. 다른 시간을 선택해 주세요."), "consultant_overlap"],
    ["student_time_overlap English", { code: "P0001", message: "student_time_overlap: You already have another lesson at the same time." }, "student_overlap"],
    ["consultant meeting overlap English", { code: "23P01", message: "This time overlaps another meeting with the same consultant. Please choose a different time." }, "consultant_overlap"],
    ["consultant consultation overlap English", new Error("This time overlaps a consultation with the same consultant. Please choose a different time."), "consultant_overlap"],
  ];
  it.each(cases)("%s -> 친절한 문구·사유", (_n, input, reason) => {
    const r = parseOverlapError(input);
    expect(r?.reason).toBe(reason);
    expect(r?.message).toBe(OVERLAP_MESSAGES[reason]);
    expect(r?.message).not.toMatch(/reservations_no_overlap|teacher_buffer|student_time_overlap|23P01/);
  });

  it("겹침이 아니면 null, 원문은 그대로 통과한다", () => {
    for (const x of [new Error("permission denied"), "", null, undefined, { code: "23505", message: "duplicate key" }]) {
      expect(parseOverlapError(x)).toBeNull();
    }
    expect(friendlyDbMessage(new Error("permission denied"))).toBe("permission denied");
    expect(friendlyDbMessage({ message: "duplicate key" })).toBe("duplicate key");
  });

  it("friendlyDbMessage는 겹침이면 친절한 문구로 바꾼다", () => {
    expect(friendlyDbMessage({ message: "teacher_buffer_violation" })).toBe(OVERLAP_MESSAGES.teacher_overlap);
  });
});
