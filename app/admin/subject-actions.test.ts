import { describe, expect, it, vi } from "vitest";

// R9(Task 2) — assignUnitKeyword의 앱 레벨 과목 검증(DB 트리거가 최종 방어선).

const { mockSupabase, state } = vi.hoisted(() => {
  const state: {
    unit?: { subject_id: string };
    keyword?: { subject_id: string };
    insertError?: { code: string; message: string } | null;
  } = { insertError: null };

  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: "admin" } }) }) }) };
      }
      if (table === "subject_template_units") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.unit }) }) }),
        };
      }
      if (table === "subject_keywords") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.keyword }) }) }),
        };
      }
      if (table === "subject_template_unit_keywords") {
        return { insert: () => Promise.resolve({ error: state.insertError }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { mockSupabase, state };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { assignUnitKeyword } from "./subject-actions";

describe("assignUnitKeyword", () => {
  // 2026-09-10(P0-2) — Minified React error #441 마스킹 버그 수정으로
  // assignUnitKeyword()가 이제 던지지 않고 { ok, error }를 반환한다.
  it("단원과 키워드의 과목이 다르면 거부한다(교차 과목 태깅 방지)", async () => {
    state.unit = { subject_id: "sub-math" };
    state.keyword = { subject_id: "sub-rw" };
    await expect(assignUnitKeyword("unit1", "kw1")).resolves.toEqual({
      ok: false,
      error: "단원과 키워드는 같은 과목이어야 합니다.",
    });
  });

  it("같은 과목이면 태그한다", async () => {
    state.unit = { subject_id: "sub-math" };
    state.keyword = { subject_id: "sub-math" };
    state.insertError = null;
    await expect(assignUnitKeyword("unit1", "kw1")).resolves.toEqual({ ok: true });
  });

  it("이미 태그된 관계(23505)는 조용히 무시한다(멱등)", async () => {
    state.unit = { subject_id: "sub-math" };
    state.keyword = { subject_id: "sub-math" };
    state.insertError = { code: "23505", message: "duplicate" };
    await expect(assignUnitKeyword("unit1", "kw1")).resolves.toEqual({ ok: true });
  });
});
