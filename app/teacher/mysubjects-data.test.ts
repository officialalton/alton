import { describe, expect, it, vi } from "vitest";
import { loadMySubjects } from "./mysubjects-data";

// 2026-09-09(UAT 지적) 회귀 테스트: loadMySubjects()가 레거시 enrollments만
// 조회해 R5 매칭 모델(teacher_assignments + subject_enrollments)로 배정된
// v3 담당 과목을 놓치던 문제. 두 소스를 합쳐서 반환해야 한다.

function makeSupabase(params: {
  enrollments: Array<{ subject_id: string; subject: { name: string } }>;
  assignments: Array<{ subject_enrollment: { subject_id: string; subject: { name: string } } }>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "enrollments") {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: params.enrollments }) }) }) };
      }
      if (table === "teacher_assignments") {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: params.assignments }) }) }) };
      }
      if (table === "teacher_curriculum_templates") {
        return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [] }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadMySubjects", () => {
  it("레거시 enrollments 담당 과목만 있어도 그대로 반환한다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ subject_id: "sub1", subject: { name: "SAT Math" } }],
      assignments: [],
    });
    const result = await loadMySubjects(supabase as never, "t1");
    expect(result.map((s) => s.subjectId)).toEqual(["sub1"]);
  });

  it("teacher_assignments(v3 매칭 모델)로만 배정된 과목도 반환한다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [{ subject_enrollment: { subject_id: "sub2", subject: { name: "AP Calculus AB" } } }],
    });
    const result = await loadMySubjects(supabase as never, "t1");
    expect(result.map((s) => s.subjectId)).toEqual(["sub2"]);
    expect(result[0].subjectName).toBe("AP Calculus AB");
  });

  it("두 소스에 겹치지 않는 과목이 있으면 합쳐서 반환한다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ subject_id: "sub1", subject: { name: "SAT Math" } }],
      assignments: [{ subject_enrollment: { subject_id: "sub2", subject: { name: "AP Calculus AB" } } }],
    });
    const result = await loadMySubjects(supabase as never, "t1");
    expect(result.map((s) => s.subjectId).sort()).toEqual(["sub1", "sub2"]);
  });

  it("같은 과목이 legacy enrollments와 v3 teacher_assignments 양쪽에 있어도 중복 표시되지 않는다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ subject_id: "sub1", subject: { name: "SAT Math" } }],
      assignments: [{ subject_enrollment: { subject_id: "sub1", subject: { name: "SAT Math" } } }],
    });
    const result = await loadMySubjects(supabase as never, "t1");
    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe("sub1");
  });

  it("teacher1의 실제 활성 v3 배정 시나리오 — legacy enrollments가 비어있어도 v3 배정만으로 노출된다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [{ subject_enrollment: { subject_id: "fff052c7-e78f-4100-9dcb-ace4d3bbd2bb", subject: { name: "AP Calculus AB" } } }],
    });
    const result = await loadMySubjects(supabase as never, "2606bc3f-1d16-4f60-8e0e-5a2c2184e1d2");
    expect(result).toEqual([
      { subjectId: "fff052c7-e78f-4100-9dcb-ace4d3bbd2bb", subjectName: "AP Calculus AB", templateId: null, units: [] },
    ]);
  });
});
