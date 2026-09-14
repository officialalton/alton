import { describe, expect, it, vi } from "vitest";
import { loadChildren } from "./children-data";

// household_members 조회(2건: guardian household_id 조회 → child 목록 조회)와,
// 자녀별로 호출되는 subject_enrollments(active 여부)/consultations(closure_type)
// 조회를 함께 라우팅하는 헬퍼. 기본은 "숨길 이유 없음"(active 수강 없음, 종료 상담
// 없음) — 각 테스트가 필요한 자녀만 override한다.
function makeSupabase(opts: {
  householdIds: string[];
  childRows: { profile_id: string; is_primary: boolean; profile: { name: string } }[];
  activeEnrollmentsByChild?: Record<string, boolean>;
  latestClosureTypeByChild?: Record<string, string | null>;
}) {
  const activeEnrollmentsByChild = opts.activeEnrollmentsByChild ?? {};
  const latestClosureTypeByChild = opts.latestClosureTypeByChild ?? {};

  return {
    from: vi.fn((table: string) => {
      if (table === "household_members") {
        return {
          select: (cols: string) => {
            if (cols === "household_id") {
              return {
                eq: () => ({
                  eq: () => Promise.resolve({ data: opts.householdIds.map((id) => ({ household_id: id })) }),
                }),
              };
            }
            return {
              in: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: opts.childRows }),
                }),
              }),
            };
          },
        };
      }
      if (table === "subject_enrollments") {
        return {
          select: () => ({
            eq: (col: string, childId: string) => ({
              eq: () => ({
                limit: () =>
                  Promise.resolve({
                    data: activeEnrollmentsByChild[childId] ? [{ id: "e1" }] : [],
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "consultations") {
        return {
          select: () => ({
            eq: (col: string, childId: string) => ({
              order: () => ({
                order: () => ({
                  limit: () => {
                    const closureType = latestClosureTypeByChild[childId];
                    return Promise.resolve({
                      data: closureType === undefined ? [] : [{ closure_type: closureType }],
                    });
                  },
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadChildren", () => {
  it("이 보호자가 속한 household의 자녀를 is_primary 우선순으로 반환한다", async () => {
    const supabase = makeSupabase({
      householdIds: ["h1"],
      childRows: [
        { profile_id: "s1", is_primary: true, profile: { name: "지훈" } },
        { profile_id: "s2", is_primary: false, profile: { name: "이서아" } },
      ],
    });

    const result = await loadChildren(supabase as never, "parent1");
    expect(result).toEqual([
      { studentId: "s1", name: "지훈", isPrimary: true },
      { studentId: "s2", name: "이서아", isPrimary: false },
    ]);
  });

  it("보호자가 속한 household가 없으면 빈 배열을 반환하고 자녀 조회를 하지 않는다", async () => {
    const childQueryMock = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "household_members") throw new Error(`unexpected table ${table}`);
        return {
          select: (cols: string) => {
            if (cols === "household_id") {
              return { eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
            }
            childQueryMock();
            return { in: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) };
          },
        };
      }),
    };

    const result = await loadChildren(supabase as never, "parent-without-household");
    expect(result).toEqual([]);
    expect(childQueryMock).not.toHaveBeenCalled();
  });

  it("여러 household에 걸친 자녀도 하나로 합쳐 반환한다(복수 household를 가진 보호자)", async () => {
    const supabase = makeSupabase({
      householdIds: ["h1", "h2"],
      childRows: [{ profile_id: "s3", is_primary: true, profile: { name: "박준서" } }],
    });

    const result = await loadChildren(supabase as never, "parent-in-two-households");
    expect(result).toEqual([{ studentId: "s3", name: "박준서", isPrimary: true }]);
  });

  it("체험 없이 상담이 종료되고 active 수강이 없는 자녀는 탭 목록에서 제외한다", async () => {
    const supabase = makeSupabase({
      householdIds: ["h1"],
      childRows: [
        { profile_id: "s1", is_primary: true, profile: { name: "중도종료" } },
        { profile_id: "s2", is_primary: false, profile: { name: "정상진행" } },
      ],
      latestClosureTypeByChild: { s1: "no_trial", s2: null },
    });

    const result = await loadChildren(supabase as never, "parent1");
    expect(result).toEqual([{ studentId: "s2", name: "정상진행", isPrimary: false }]);
  });

  it("체험 후 정규 미전환으로 종료된 자녀도 제외한다", async () => {
    const supabase = makeSupabase({
      householdIds: ["h1"],
      childRows: [{ profile_id: "s1", is_primary: true, profile: { name: "체험종료" } }],
      latestClosureTypeByChild: { s1: "trial_no_convert" },
    });

    const result = await loadChildren(supabase as never, "parent1");
    expect(result).toEqual([]);
  });

  it("상담이 중도 종료됐어도 active subject_enrollments가 있으면 제외하지 않는다", async () => {
    const supabase = makeSupabase({
      householdIds: ["h1"],
      childRows: [{ profile_id: "s1", is_primary: true, profile: { name: "정규전환" } }],
      latestClosureTypeByChild: { s1: "trial_no_convert" },
      activeEnrollmentsByChild: { s1: true },
    });

    const result = await loadChildren(supabase as never, "parent1");
    expect(result).toEqual([{ studentId: "s1", name: "정규전환", isPrimary: true }]);
  });

  it("정규 계약 날인 등 진행 중 종료 유형은 숨기지 않는다", async () => {
    const supabase = makeSupabase({
      householdIds: ["h1"],
      childRows: [{ profile_id: "s1", is_primary: true, profile: { name: "계약완료" } }],
      latestClosureTypeByChild: { s1: "contract_signed" },
    });

    const result = await loadChildren(supabase as never, "parent1");
    expect(result).toEqual([{ studentId: "s1", name: "계약완료", isPrimary: true }]);
  });
});
