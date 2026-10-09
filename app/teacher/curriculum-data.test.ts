import { describe, expect, it } from "vitest";
import { loadAllStudentCurricula } from "./curriculum-data";

// 2026-09-11(제품 오너 실사용 보고 — "학생별 커리큘럼" 진입이 매우 느림,
// 실측 Gateway Timeout 확인) — loadAllStudentCurricula()가 담당 학생마다
// loadCurricula()를 개별 호출하던 것(학생 수만큼 동시 쿼리)을 학생 수와
// 무관한 고정 쿼리 수로 배치 조회하도록 재작성했다. 이 테스트는 (1) 쿼리
// 횟수가 학생 수와 무관하게 고정인지, (2) 여러 학생의 결과가 올바르게
// enrollment 단위로 분리되는지를 확인한다(N+1 회귀 방지).

function makeSupabaseMock(tables: Record<string, unknown[]>) {
  const callCounts: Record<string, number> = {};
  return {
    callCounts,
    from: (table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const rows = tables[table] ?? [];
      const builder: {
        select: () => typeof builder;
        eq: () => typeof builder;
        in: () => typeof builder;
        or: () => typeof builder;
        order: () => typeof builder;
        then: (resolve: (value: { data: unknown[] }) => unknown) => Promise<unknown>;
      } = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        or: () => builder,
        order: () => builder,
        then: (resolve) => Promise.resolve({ data: rows }).then(resolve),
      };
      return builder;
    },
  };
}

describe("loadAllStudentCurricula", () => {
  it("담당 학생이 없으면 빈 배열을 반환하고 아무 쿼리도 하지 않는다", async () => {
    const mock = makeSupabaseMock({});
    const result = await loadAllStudentCurricula(mock as never, []);
    expect(result).toEqual([]);
    expect(Object.keys(mock.callCounts)).toEqual([]);
  });

  it("담당 학생이 여러 명이어도 쿼리는 학생 수와 무관하게 고정 횟수만 발생하고, 결과가 학생·enrollment별로 정확히 분리된다", async () => {
    const mock = makeSupabaseMock({
      enrollments: [
        { id: "enr1", student_id: "st1", teacher_id: "t1", subject_id: "sub1", subject: { name: "수학" } },
        { id: "enr2", student_id: "st2", teacher_id: "t1", subject_id: "sub2", subject: { name: "영어" } },
      ],
      profiles: [{ id: "t1", name: "박서연 선생님" }],
      teacher_curriculum_templates: [
        { id: "tpl1", teacher_id: "t1", subject_id: "sub1" },
        { id: "tpl2", teacher_id: "t1", subject_id: "sub2" },
      ],
      teacher_curriculum_template_units: [
        { id: "u1", template_id: "tpl1", position: 1, unit_title: "1단원", note: null, teacher_comment: null },
        { id: "u2", template_id: "tpl2", position: 1, unit_title: "Unit 1", note: null, teacher_comment: null },
      ],
      legacy_sessions: [
        { id: "sess1", status: "completed", scheduled_at: "2026-09-01", source_template_unit_id: "u1", enrollment_id: "enr1" },
      ],
    });

    const result = await loadAllStudentCurricula(mock as never, [
      { studentId: "st1", studentName: "지훈" },
      { studentId: "st2", studentName: "이서아" },
    ]);

    // 쿼리 그룹은 5개(enrollments/profiles/teacher_curriculum_templates/
    // teacher_curriculum_template_units/legacy_sessions) — 각 1회씩만,
    // 학생 수(2명)와 무관하게 고정.
    expect(mock.callCounts).toEqual({
      enrollments: 1,
      profiles: 1,
      teacher_curriculum_templates: 1,
      teacher_curriculum_template_units: 1,
      legacy_sessions: 1,
    });

    expect(result).toHaveLength(2);
    const byStudent = Object.fromEntries(result.map((c) => [c.studentId, c]));
    expect(byStudent.st1).toMatchObject({
      studentName: "지훈",
      enrollmentId: "enr1",
      subjectName: "수학",
      teacherName: "박서연 선생님",
      totalSessions: 1,
      units: [{ unitTitle: "1단원", status: "done" }],
    });
    expect(byStudent.st2).toMatchObject({
      studentName: "이서아",
      enrollmentId: "enr2",
      subjectName: "영어",
      totalSessions: 1,
      units: [{ unitTitle: "Unit 1", status: "upcoming" }],
    });
  });
});
