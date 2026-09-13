import { describe, expect, it, vi } from "vitest";
import { loadMySubjects } from "./mysubjects-data";

// 2026-09-09(UAT 지적) 회귀 테스트: loadMySubjects()가 레거시 enrollments만
// 조회해 R5 매칭 모델(teacher_assignments + subject_enrollments)로 배정된
// v3 담당 과목을 놓치던 문제. 두 소스를 합쳐서 반환해야 한다.

// 2026-09-12(UAT 지적) 추가: 세 번째 소스 teacher_curriculum_templates —
// 관리자가 담당 과목을 배정하면 이 행만 생긴다. 학생이 매칭되기 전에도
// 과목이 보여야 한다.
function makeSupabase(params: {
  enrollments: Array<{ subject_id: string; subject: { name: string } }>;
  assignments: Array<{ subject_enrollment: { subject_id: string; subject: { name: string } } }>;
  assigned?: Array<{ subject_id: string; subject: { name: string; archived_at?: string | null } }>;
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
        // 같은 표를 두 번 읽는다: 담당 과목 목록(.eq()으로 끝남)과 과목별
        // 템플릿 id 조회(.eq().in()). 하나의 mock이 둘 다 받아야 한다.
        return {
          select: () => ({
            eq: () => {
              const result = Promise.resolve({ data: params.assigned ?? [] });
              return Object.assign(result, {
                in: () => Promise.resolve({ data: [] }),
              });
            },
          }),
        };
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

describe("loadMySubjects — 배정만 된 과목", () => {
  it("학생 매칭이 없어도 관리자가 배정한 담당 과목이 보인다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [],
      assigned: [{ subject_id: "sub3", subject: { name: "SAT Reading Test 1" } }],
    });
    const result = await loadMySubjects(supabase as never, "t1");
    expect(result.map((s) => s.subjectId)).toEqual(["sub3"]);
    expect(result[0].subjectName).toBe("SAT Reading Test 1");
  });

  it("보관된 과목은 담당 과목 목록에 넣지 않는다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [],
      assigned: [
        { subject_id: "sub3", subject: { name: "SAT Reading Test 1" } },
        { subject_id: "sub9", subject: { name: "테스트 과목 1", archived_at: "2026-09-11T00:00:00Z" } },
      ],
    });
    const result = await loadMySubjects(supabase as never, "t1");
    expect(result.map((s) => s.subjectId)).toEqual(["sub3"]);
  });
});
