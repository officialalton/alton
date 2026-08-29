import { describe, expect, it } from "vitest";
import { loadTeacherCandidatesBySubject } from "./matching-data";

function makeSupabaseMock(links: unknown[]) {
  return {
    from: () => ({
      select: () => Promise.resolve({ data: links }),
    }),
  } as never;
}

describe("loadTeacherCandidatesBySubject", () => {
  it("과목별로 active 선생님만 후보로 묶는다", async () => {
    const supabase = makeSupabaseMock([
      {
        subject_id: "sub1",
        teacher: { id: "t1", status: "active", profile: { name: "김선생" } },
      },
      {
        subject_id: "sub1",
        teacher: { id: "t2", status: "pending", profile: { name: "이선생" } },
      },
      {
        subject_id: "sub2",
        teacher: { id: "t1", status: "active", profile: { name: "김선생" } },
      },
    ]);
    const result = await loadTeacherCandidatesBySubject(supabase);
    expect(result["sub1"]).toEqual([{ id: "t1", name: "김선생" }]);
    expect(result["sub2"]).toEqual([{ id: "t1", name: "김선생" }]);
  });

  it("링크가 없으면 빈 객체를 반환한다", async () => {
    const supabase = makeSupabaseMock([]);
    const result = await loadTeacherCandidatesBySubject(supabase);
    expect(result).toEqual({});
  });
});
