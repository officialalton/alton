import { describe, expect, it, vi } from "vitest";
import { loadLibraryDoc } from "./materials-data";

function makeSupabaseMock(attempts: { problem_id: string; correct: boolean | null; response: unknown }[]) {
  const tables: Record<string, unknown> = {
    curriculum_docs: [{ id: "doc1", title: "이차방정식", status: "published" }],
    curriculum_doc_sections: [
      { id: "sec1", position: 1, title: "개념", body: "<p>본문</p>" },
    ],
    problems: [
      {
        id: "prob1",
        format: "mc",
        passage: "판별식이 0이면?",
        options: ["A", "B"],
        correct_index: 1,
        explanation: "해설",
        difficulty: "easy",
        skill_type: null,
        section_id: "sec1",
      },
    ],
  };

  return {
    from: (table: string) => {
      if (table === "session_problem_attempts") {
        const builder = {
          select: () => builder,
          is: () => builder,
          eq: () => builder,
          in: () => builder,
          order: () => builder,
          then: (resolve: (v: { data: typeof attempts }) => unknown) =>
            resolve({ data: attempts }),
        };
        return builder;
      }
      const rows = (tables[table] as unknown[]) ?? [];
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
        then: (resolve: (v: { data: typeof rows }) => unknown) =>
          resolve({ data: rows }),
      };
      return builder;
    },
  } as never;
}

describe("loadLibraryDoc", () => {
  it("studentId가 있으면 이전 시도 기록으로 done/correct 상태를 재구성한다", async () => {
    const supabase = makeSupabaseMock([
      { problem_id: "prob1", correct: true, response: 1 },
    ]);
    const doc = await loadLibraryDoc(supabase, "doc1", "student1");
    const problem = doc!.sections[0].problems[0];
    expect(problem.done).toBe(true);
    expect(problem.correct).toBe(true);
  });

  it("studentId가 없으면(교사/학부모 등) 시도 상태를 조회하지 않고 done=false로 반환한다", async () => {
    const supabase = makeSupabaseMock([]);
    const doc = await loadLibraryDoc(supabase, "doc1", null);
    const problem = doc!.sections[0].problems[0];
    expect(problem.done).toBe(false);
    expect(problem.correct).toBe(null);
  });
});
