import { describe, expect, it, vi } from "vitest";

const { mockSupabase, state } = vi.hoisted(() => {
  const state: { user: { id: string } | null } = { user: { id: "student1" } };

  const mockSupabase = {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: state.user } })) },
    from: vi.fn((table: string) => {
      if (table === "student_curriculum_overlays") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { mockSupabase, state };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { loadMyCurriculumOverlay } from "./curriculum-overlay-actions";

// v3 커리큘럼 열람 결함 수정(2026-09-11) — 이 액션은 로그인 여부만 확인하고,
// 실제 본인 학생/보호자 범위는 RLS(is_enrollment_child_or_guardian)가 담당한다
// (마이그레이션 20261275000000). 여기서는 "로그인 안 함" 거부와 정상 위임만
// 검증한다 — 권한 스코프 자체는 RLS 통합 테스트에서 검증.
describe("loadMyCurriculumOverlay — 학생·학부모 공용 읽기 전용 액션", () => {
  it("로그인하지 않으면 거부한다", async () => {
    state.user = null;
    await expect(loadMyCurriculumOverlay("se1")).rejects.toThrow("로그인이 필요합니다.");
  });

  it("로그인한 사용자는 loadStudentCurriculum에 그대로 위임한다(오버레이 없으면 빈 결과)", async () => {
    state.user = { id: "student1" };
    const result = await loadMyCurriculumOverlay("se1");
    expect(result).toEqual({ overlayId: null, units: [] });
  });
});
