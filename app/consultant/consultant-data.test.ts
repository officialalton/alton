import { describe, it, expect } from "vitest";
import { loadMyAssignedStudents, loadMyEndedAssignedStudents } from "./consultant-data";

// Phase B(1, 2026-09-23) — Students 탭의 Active/Ended 분리 로직 검증.
// consultant_assignment_history.prior_consultant_id=본인 행 중, 학생이 지금도
// 본인 담당(재배정)이면 Ended 목록에서 빠져야 한다.

type Row = Record<string, unknown>;

function makeSupabase(tables: Record<string, Row[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => {
          const rows = (tables[table] ?? []).filter((r) => r[col] === val);
          const chain = {
            not: () => chain,
            order: () => Promise.resolve({ data: rows, error: null }),
            then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null }),
          };
          return chain;
        },
      }),
    }),
  };
}

describe("loadMyAssignedStudents", () => {
  it("본인 담당 학생만 반환한다", async () => {
    const supabase = makeSupabase({
      consultant_assignments: [
        { student_id: "s1", consultant_id: "c1", student: { id: "s1", name: "학생1" } },
      ],
    });
    const result = await loadMyAssignedStudents(supabase as never, "c1");
    expect(result).toEqual([{ id: "s1", name: "학생1" }]);
  });
});

describe("loadMyEndedAssignedStudents", () => {
  it("본인이 해제된 학생만 반환하고, 다시 재배정된 학생은 제외한다", async () => {
    const supabase = makeSupabase({
      consultant_assignment_history: [
        {
          student_id: "s-ended",
          prior_consultant_id: "c1",
          changed_at: "2026-09-20T00:00:00Z",
          reason: "담당 변경",
          student: { id: "s-ended", name: "종료학생" },
        },
        {
          student_id: "s-reassigned",
          prior_consultant_id: "c1",
          changed_at: "2026-09-19T00:00:00Z",
          reason: "임시 변경",
          student: { id: "s-reassigned", name: "재배정학생" },
        },
      ],
      consultant_assignments: [{ student_id: "s-reassigned", consultant_id: "c1" }],
    });
    const result = await loadMyEndedAssignedStudents(supabase as never, "c1");
    expect(result).toEqual([
      { id: "s-ended", name: "종료학생", endedAt: "2026-09-20T00:00:00Z", reason: "담당 변경" },
    ]);
  });

  it("이력이 없으면 빈 배열을 반환한다", async () => {
    const supabase = makeSupabase({ consultant_assignment_history: [], consultant_assignments: [] });
    const result = await loadMyEndedAssignedStudents(supabase as never, "c1");
    expect(result).toEqual([]);
  });
});
