import { describe, expect, it } from "vitest";
import { loadCurricula } from "./curriculum-data";

// 성능 개선(계획 문서 2026-09-09-codebase-review-and-performance-diagnosis.md
// 5절 P0): enrollment마다 순차 3쿼리(N+1)였던 것을 enrollment 수와 무관하게
// 고정 4쿼리(profiles/templates/units/legacy_sessions)로 배치 조회하도록
// 재작성했다. 이 테스트는 (1) 쿼리 수가 enrollment 수와 무관하게 고정인지,
// (2) 매핑 결과가 기존과 동일한 모양인지를 함께 확인한다.

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
        maybeSingle: () => Promise<{ data: unknown }>;
        then: (resolve: (value: { data: unknown[] }) => unknown) => Promise<unknown>;
      } = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        or: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
        then: (resolve) => Promise.resolve({ data: rows }).then(resolve),
      };
      return builder;
    },
  };
}

describe("loadCurricula", () => {
  it("active enrollment가 없으면 빈 배열을 반환하고, enrollments 조회 1건만 발생한다", async () => {
    const mock = makeSupabaseMock({ enrollments: [] });
    const result = await loadCurricula(mock as never, "student1");
    expect(result).toEqual([]);
    expect(mock.callCounts.enrollments).toBe(1);
  });

  it("enrollment가 여러 개여도 배치 쿼리 4회(profiles/templates/units/legacy_sessions)만 발생하고, 단원별 세션 상태를 정확히 매핑한다(N+1 방지 회귀 테스트)", async () => {
    const mock = makeSupabaseMock({
      enrollments: [
        {
          id: "enr1",
          teacher_id: "t1",
          subject_id: "sub1",
          total_sessions: 10,
          current_session: 2,
          subject: { name: "수학" },
        },
        {
          id: "enr2",
          teacher_id: "t1",
          subject_id: "sub2",
          total_sessions: 8,
          current_session: 1,
          subject: { name: "영어" },
        },
      ],
      profiles: [{ id: "t1", name: "김선생" }],
      teacher_curriculum_templates: [
        { id: "tmpl1", teacher_id: "t1", subject_id: "sub1" },
        { id: "tmpl2", teacher_id: "t1", subject_id: "sub2" },
      ],
      teacher_curriculum_template_units: [
        { id: "u1", template_id: "tmpl1", position: 1, unit_title: "1단원", note: null, teacher_comment: null },
        { id: "u2", template_id: "tmpl1", position: 2, unit_title: "2단원", note: null, teacher_comment: null },
        { id: "u3", template_id: "tmpl2", position: 1, unit_title: "영단원1", note: null, teacher_comment: null },
      ],
      legacy_sessions: [
        { id: "s1", status: "completed", scheduled_at: "2026-01-01", source_template_unit_id: "u1", enrollment_id: "enr1" },
        { id: "s2", status: "upcoming", scheduled_at: "2026-02-01", source_template_unit_id: "u2", enrollment_id: "enr1" },
      ],
    });

    const result = await loadCurricula(mock as never, "student1");

    // enrollments(1) + profiles(1) + teacher_curriculum_templates(1) +
    // teacher_curriculum_template_units(1) + legacy_sessions(1) = 5회 총.
    // enrollment 수(2)와 무관하게 고정 — 기존 3N(=6)회보다 적고, N=10이어도
    // 그대로 5회여야 하는 것이 이 회귀 테스트의 핵심.
    expect(mock.callCounts.enrollments).toBe(1);
    expect(mock.callCounts.profiles).toBe(1);
    expect(mock.callCounts.teacher_curriculum_templates).toBe(1);
    expect(mock.callCounts.teacher_curriculum_template_units).toBe(1);
    expect(mock.callCounts.legacy_sessions).toBe(1);

    expect(result).toHaveLength(2);
    const math = result.find((r) => r.enrollmentId === "enr1")!;
    expect(math.subjectName).toBe("수학");
    expect(math.teacherName).toBe("김선생");
    expect(math.units).toEqual([
      { position: 1, unitTitle: "1단원", note: null, teacherComment: null, status: "done", sessionId: "s1", scheduledAt: "2026-01-01" },
      { position: 2, unitTitle: "2단원", note: null, teacherComment: null, status: "in_progress", sessionId: "s2", scheduledAt: "2026-02-01" },
    ]);

    const english = result.find((r) => r.enrollmentId === "enr2")!;
    expect(english.subjectName).toBe("영어");
    // enr2는 legacy_sessions가 없으므로 단원은 있지만 세션 매칭 없이 upcoming.
    expect(english.units).toEqual([
      { position: 1, unitTitle: "영단원1", note: null, teacherComment: null, status: "upcoming", sessionId: null, scheduledAt: null },
    ]);
  });
});
