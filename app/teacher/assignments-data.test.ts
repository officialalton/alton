import { describe, expect, it, vi } from "vitest";
import { loadTeacherAssignments } from "./assignments-data";

// M4 골든패스 실사용 버그 #2 재현 — 선생님 포털 "학생" 탭(구 RosterTab/roster-data.ts,
// legacy `enrollments` 기반)이 "담당 중인 학생이 없습니다"로 뜨던 문제. #6에서
// "학생" 탭 자체를 없애고 "배정" 탭(assignments-data.ts, 이미 v3 스키마 기준)으로
// 통합했다 — 이 테스트는 그 통합된 탭이 학년/연락처까지 포함해 학생을 정상적으로
// 찾아내는지 고정한다.
function makeSupabase() {
  const assignments = [
    {
      id: "ta1",
      subject_enrollment_id: "se1",
      status: "active",
      effective_from: "2026-08-01T00:00:00Z",
      effective_until: null,
    },
  ];
  const enrollments = [{ id: "se1", child_id: "student-se-on-jang", subject_id: "sub1", subject: { name: "테스트1" } }];
  const students = [{ id: "student-se-on-jang", name: "세온장", phone: "010-1111-2222" }];
  const studentRows = [{ id: "student-se-on-jang", grade: "고1" }];

  return {
    from: vi.fn((table: string) => {
      if (table === "teacher_assignments") {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: assignments }) }) }),
        };
      }
      if (table === "subject_enrollments") {
        return { select: () => ({ in: () => Promise.resolve({ data: enrollments }) }) };
      }
      if (table === "profiles") {
        return { select: () => ({ in: () => Promise.resolve({ data: students }) }) };
      }
      if (table === "students") {
        return { select: () => ({ in: () => Promise.resolve({ data: studentRows }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadTeacherAssignments — M4 골든패스 실사용 버그 #2/#6", () => {
  it("배정 탭에서 담당 학생을 학년/연락처와 함께 찾는다", async () => {
    const supabase = makeSupabase();
    const { current, past } = await loadTeacherAssignments(supabase as never, "teacher-test1");

    expect(past).toHaveLength(0);
    expect(current).toHaveLength(1);
    expect(current[0].studentName).toBe("세온장");
    expect(current[0].studentGrade).toBe("고1");
    expect(current[0].studentPhone).toBe("010-1111-2222");
    expect(current[0].subjectName).toBe("테스트1");
  });
});
