import { describe, expect, it, vi } from "vitest";
import { loadTeacherMaterialsLibrary } from "./materials-data";

// 2026-09-09(UAT 지적, 제품 오너 승인) — 교사 포털 "교재" 최초 구현 회귀 테스트.
// 레거시 enrollments와 v3 teacher_assignments 양쪽에서 담당 과목을 모으고,
// 공개된 교재만 노출해야 한다.

function makeSupabase(params: {
  enrollments: Array<{ subject_id: string; subject: { name: string } }>;
  assignments: Array<{ subject_enrollment: { subject_id: string; subject: { name: string } } }>;
  docs: Array<{ id: string; title: string; subject_id: string; unit_id: string | null }>;
  // 2026-09-12(UAT 지적): 관리자가 배정한 담당 과목. 학생 매칭이 없어도
  // 라이브러리가 비면 안 된다.
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
      if (table === "curriculum_docs") {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: params.docs }) }),
            }),
          }),
        };
      }
      if (table === "teacher_curriculum_templates") {
        return { select: () => ({ eq: () => Promise.resolve({ data: params.assigned ?? [] }) }) };
      }
      if (table === "subject_template_units") {
        return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadTeacherMaterialsLibrary", () => {
  it("담당 과목이 전혀 없으면 빈 배열을 반환하고 curriculum_docs는 조회하지 않는다", async () => {
    const supabase = makeSupabase({ enrollments: [], assignments: [], docs: [] });
    const result = await loadTeacherMaterialsLibrary(supabase as never, "t1");
    expect(result).toEqual([]);
  });

  it("v3 teacher_assignments로만 담당 중이어도(레거시 없음) 공개된 교재가 보인다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [{ subject_enrollment: { subject_id: "sub1", subject: { name: "AP Calculus AB" } } }],
      docs: [{ id: "doc1", title: "이차방정식 개념", subject_id: "sub1", unit_id: null }],
    });
    const result = await loadTeacherMaterialsLibrary(supabase as never, "2606bc3f-1d16-4f60-8e0e-5a2c2184e1d2");
    expect(result).toEqual([
      { subjectId: "sub1", subjectName: "AP Calculus AB", docs: [{ id: "doc1", title: "이차방정식 개념", unitTitle: null }] },
    ]);
  });

  it("담당 과목은 있어도 공개된 교재가 없으면 그 과목은 목록에서 빠진다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ subject_id: "sub1", subject: { name: "SAT Math" } }],
      assignments: [],
      docs: [],
    });
    const result = await loadTeacherMaterialsLibrary(supabase as never, "t1");
    expect(result).toEqual([]);
  });
});

describe("loadTeacherMaterialsLibrary — 배정만 된 과목", () => {
  it("학생 매칭이 없어도 배정된 과목의 공개 교재가 보인다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [],
      assigned: [{ subject_id: "sub3", subject: { name: "SAT Reading Test 1" } }],
      docs: [{ id: "d1", title: "지문 읽기", subject_id: "sub3", unit_id: null }],
    });
    const result = await loadTeacherMaterialsLibrary(supabase as never, "t1");
    expect(result.map((s) => s.subjectName)).toEqual(["SAT Reading Test 1"]);
    expect(result[0].docs.map((d) => d.title)).toEqual(["지문 읽기"]);
  });

  it("보관된 과목의 교재는 라이브러리에 넣지 않는다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [],
      assigned: [
        { subject_id: "sub9", subject: { name: "테스트 과목 1", archived_at: "2026-09-11T00:00:00Z" } },
      ],
      docs: [],
    });
    const result = await loadTeacherMaterialsLibrary(supabase as never, "t1");
    expect(result).toEqual([]);
  });
});
