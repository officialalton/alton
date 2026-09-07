import { describe, expect, it, vi } from "vitest";

// R9(Task 2) — assignSectionKeyword/assignProblemKeyword의 앱 레벨 과목 검증.
// DB 트리거(20261228000000_r9_curriculum_content_foundation.sql)가 최종 방어선이지만,
// 이 계층에서 먼저 걸러 더 읽기 쉬운 에러를 준다(app/admin/curriculum-content-foundation.
// integration.test.ts가 DB 트리거 쪽을 검증한다).

const { mockSupabase, state } = vi.hoisted(() => {
  const state: {
    section?: { curriculum_doc_id: string; doc: { subject_id: string; status: string } };
    problem?: { subject_id: string | null; status: string };
    keyword?: { subject_id: string };
    insertError?: { code: string; message: string } | null;
  } = { insertError: null };

  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: "admin" } }) }) }) };
      }
      if (table === "curriculum_doc_sections") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.section }) }) }),
          insert: () => ({ error: null }),
        };
      }
      if (table === "problems") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.problem }) }) }),
        };
      }
      if (table === "subject_keywords") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.keyword }) }) }),
        };
      }
      if (table === "curriculum_doc_section_keywords" || table === "problem_keywords") {
        return {
          insert: () => Promise.resolve({ error: state.insertError }),
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
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function AnthropicMock(this: unknown) {
    return { messages: { create: vi.fn() } };
  }),
}));

import { assignSectionKeyword, assignProblemKeyword } from "./curriculum-doc-actions";

describe("assignSectionKeyword", () => {
  it("교재와 키워드의 과목이 다르면 거부한다(교차 과목 태깅 방지)", async () => {
    state.section = {
      curriculum_doc_id: "doc1",
      doc: { subject_id: "sub-math", status: "published" },
    };
    state.keyword = { subject_id: "sub-rw" };
    await expect(assignSectionKeyword("sec1", "kw1")).rejects.toThrow(
      "교재와 키워드는 같은 과목이어야 합니다."
    );
  });

  it("같은 과목이면 관계를 생성한다", async () => {
    state.section = {
      curriculum_doc_id: "doc1",
      doc: { subject_id: "sub-math", status: "published" },
    };
    state.keyword = { subject_id: "sub-math" };
    state.insertError = null;
    await expect(assignSectionKeyword("sec1", "kw1")).resolves.toBeUndefined();
  });

  it("이미 태그된 관계(23505)는 조용히 무시한다(멱등)", async () => {
    state.section = {
      curriculum_doc_id: "doc1",
      doc: { subject_id: "sub-math", status: "published" },
    };
    state.keyword = { subject_id: "sub-math" };
    state.insertError = { code: "23505", message: "duplicate" };
    await expect(assignSectionKeyword("sec1", "kw1")).resolves.toBeUndefined();
  });
});

describe("assignProblemKeyword", () => {
  it("문제와 키워드의 과목이 다르면 거부한다", async () => {
    state.problem = { subject_id: "sub-math", status: "confirmed" };
    state.keyword = { subject_id: "sub-rw" };
    await expect(assignProblemKeyword("prob1", "kw1")).rejects.toThrow(
      "문제와 키워드는 같은 과목이어야 합니다."
    );
  });
});
