import { describe, expect, it, vi } from "vitest";
import { loadTeacherList } from "./teacher-data";

// M4 골든패스 실사용 버그 #1 재현 테스트 — "세온장/테스트1" 시나리오: 체험 수업만
// 진행한 학생은 legacy `enrollments`(정규 전환 후에만 생성) 행이 없고 v3
// `subject_enrollments` + `teacher_assignments`(status: active)만 있다. 수정 전
// loadTeacherList()는 legacy `enrollments`만 조회해 항상 빈 배열을 반환했다
// ("매칭된 선생님이 없습니다"). 이 테스트는 legacy `enrollments`를 텅 비워 둔 채
// v3 배정만으로 선생님 목록이 채워지는지 고정한다.
function makeSupabase() {
  const subjectEnrollments = [{ id: "se1", subject: { name: "테스트1" } }];
  const teacherAssignments = [
    { teacher_id: "teacher-test1", subject_enrollment_id: "se1", status: "active" },
  ];
  const profiles = [{ id: "teacher-test1", name: "Teacher test1" }];
  const teachers = [{ id: "teacher-test1", school: "테스트 학교" }];

  return {
    from: vi.fn((table: string) => {
      if (table === "enrollments") {
        // legacy 테이블 — 절대 호출되지 않거나, 호출되더라도 항상 비어 있어야 한다.
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
      }
      if (table === "subject_enrollments") {
        return { select: () => ({ eq: () => Promise.resolve({ data: subjectEnrollments }) }) };
      }
      if (table === "teacher_assignments") {
        return {
          select: () => ({
            in: () => ({ in: () => Promise.resolve({ data: teacherAssignments }) }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ in: () => Promise.resolve({ data: profiles }) }) };
      }
      if (table === "teachers") {
        return { select: () => ({ in: () => Promise.resolve({ data: teachers }) }) };
      }
      if (table === "sessions") {
        return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadTeacherList — M4 골든패스 실사용 버그 #1", () => {
  it("체험 수업만 있는 학생(legacy enrollments 없음)도 v3 배정 기준으로 매칭된 선생님을 찾는다", async () => {
    const supabase = makeSupabase();
    const teachers = await loadTeacherList(supabase as never, "student-se-on-jang");

    expect(teachers).toHaveLength(1);
    expect(teachers[0].teacherId).toBe("teacher-test1");
    expect(teachers[0].name).toBe("Teacher test1");
    expect(teachers[0].school).toBe("테스트 학교");
    expect(teachers[0].subjects[0].subjectName).toBe("테스트1");
  });
});
