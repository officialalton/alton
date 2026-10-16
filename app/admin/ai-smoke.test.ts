// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// AI 생성 실제 호출 검증(2026-09-13 승인). 문제 1개만 만든다.
// 기본적으로 건너뛴다 — ALTON_AI_SMOKE=1 일 때만 돈다.
// 이 액션의 인가는 로그인 세션을 읽는다. 여기서 확인하려는 것은 인가가 아니라
// **키와 모델로 실제 호출이 되는가**이므로 그 부분만 관리자로 흉내 낸다.
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { role: "admin" } }) }) }),
    }),
  }),
}));

const on = process.env.ALTON_AI_SMOKE === "1";

describe.skipIf(!on)("AI 문제 생성 — 실제 호출", () => {
  it("claude-sonnet-5 로 객관식 1개를 만든다", async () => {
    const { generateSectionProblems } = await import("@/app/admin/curriculum-doc-actions");
    const out = await generateSectionProblems({
      sectionTitle: "Words in Context",
      subjectName: "SAT Reading",
      skillType: "Words in Context",
      difficulty: "medium",
      format: "mc",
      count: 1,
    });
    console.log(JSON.stringify(out, null, 2));
    expect(out).toHaveLength(1);
    expect(out[0].passage.length).toBeGreaterThan(10);
    expect(out[0].options).toHaveLength(4);
    expect(out[0].correctIndex).toBeGreaterThanOrEqual(0);
  }, 120000);
});
