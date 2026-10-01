import { describe, expect, it } from "vitest";
import { loadTeacherCandidatesBySubject } from "./matching-data";

function makeSupabaseMock(links: unknown[], unitRows: { template_id: string }[]) {
  return {
    from: (table: string) => {
      if (table === "teacher_curriculum_templates") {
        return { select: () => Promise.resolve({ data: links }) };
      }
      if (table === "teacher_curriculum_template_units") {
        return { select: () => ({ in: () => Promise.resolve({ data: unitRows }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("loadTeacherCandidatesBySubject", () => {
  it("과목별로 active 선생님만 후보로 묶는다(운영본에 단원이 있는 경우만)", async () => {
    const supabase = makeSupabaseMock(
      [
        { id: "tpl1", subject_id: "sub1", teacher: { id: "t1", status: "active", profile: { name: "김선생" } } },
        { id: "tpl2", subject_id: "sub1", teacher: { id: "t2", status: "pending", profile: { name: "이선생" } } },
        { id: "tpl3", subject_id: "sub2", teacher: { id: "t1", status: "active", profile: { name: "김선생" } } },
      ],
      [{ template_id: "tpl1" }, { template_id: "tpl2" }, { template_id: "tpl3" }]
    );
    const result = await loadTeacherCandidatesBySubject(supabase);
    expect(result["sub1"]).toEqual([{ id: "t1", name: "김선생" }]);
    expect(result["sub2"]).toEqual([{ id: "t1", name: "김선생" }]);
  });

  it("링크가 없으면 빈 객체를 반환한다", async () => {
    const supabase = makeSupabaseMock([], []);
    const result = await loadTeacherCandidatesBySubject(supabase);
    expect(result).toEqual({});
  });

  it("2026-09-10(C-1): 단원이 0개인 운영본을 가진 선생님은 후보에서 제외한다", async () => {
    const supabase = makeSupabaseMock(
      [{ id: "tpl-empty", subject_id: "sub1", teacher: { id: "t1", status: "active", profile: { name: "김선생" } } }],
      [] // tpl-empty에 단원 없음
    );
    const result = await loadTeacherCandidatesBySubject(supabase);
    expect(result["sub1"] ?? []).toEqual([]);
  });
});
