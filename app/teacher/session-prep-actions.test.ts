import { describe, expect, it, vi } from "vitest";

const { mockSupabase, state } = vi.hoisted(() => {
  const state: {
    role: string;
    assignment: { id: string } | null;
    selectionRow: { subject_enrollment_id: string } | null;
    rpcResult: { data: unknown; error: unknown };
  } = {
    role: "teacher",
    assignment: { id: "assign1" },
    selectionRow: { subject_enrollment_id: "enr1" },
    rpcResult: { data: [], error: null },
  };

  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "teacher1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: state.role } }) }) }),
        };
      }
      if (table === "teacher_assignments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ in: () => ({ maybeSingle: () => Promise.resolve({ data: state.assignment }) }) }),
            }),
          }),
        };
      }
      if (table === "session_prepared_selections") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.selectionRow, error: null }) }),
          }),
          insert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: { id: "sel1" }, error: null }) }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === "session_prepared_selection_units") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
            }),
          }),
          insert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: { id: "unit1" }, error: null }) }),
          }),
          delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        };
      }
      if (table === "session_prepared_selection_unit_keywords") {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === "session_prepared_selection_content_items") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
            }),
          }),
          insert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: { id: "item1" }, error: null }) }),
          }),
          update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
    rpc: vi.fn(() => Promise.resolve(state.rpcResult)),
  };
  return { mockSupabase, state };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import {
  createPreparedSelection,
  addUnitToSelection,
  removeUnitFromSelection,
  setSelectionActiveKeywords,
  pickContentItem,
  excludeContentItem,
  includeContentItem,
  reorderContentItems,
  attachSelectionToSession,
  detachSelectionFromSession,
} from "./session-prep-actions";

describe("담당 학생 인가 — 준비된 선택 최상위 액션", () => {
  it("담당이 아닌 선생님은 준비된 선택을 만들 수 없다", async () => {
    state.assignment = null;
    await expect(createPreparedSelection("enr1")).rejects.toThrow(
      "담당 학생의 세션 준비만 조정할 수 있습니다."
    );
  });

  it("담당 선생님은 준비된 선택을 만들 수 있다", async () => {
    state.assignment = { id: "assign1" };
    const id = await createPreparedSelection("enr1");
    expect(id).toBe("sel1");
  });
});

describe("담당 학생 인가 — 준비된 선택 하위 테이블 액션(prepared_selection_id로 역조회)", () => {
  it("존재하는 선택이지만 담당이 아닌 선생님이면 하위 액션도 거부한다", async () => {
    state.selectionRow = { subject_enrollment_id: "enr1" };
    state.assignment = null;
    await expect(addUnitToSelection("sel1", "overlay-unit-1")).rejects.toThrow(
      "담당 학생의 세션 준비만 조정할 수 있습니다."
    );
  });

  it("담당 선생님이면 단원 추가/제거, 키워드 설정, 콘텐츠 pick/exclude/include를 할 수 있다", async () => {
    state.assignment = { id: "assign1" };
    await expect(addUnitToSelection("sel1", "overlay-unit-1")).resolves.toBe("unit1");
    await expect(removeUnitFromSelection("sel1", "unit1")).resolves.toBeUndefined();
    await expect(setSelectionActiveKeywords("sel1", "unit1", ["kw1", "kw2"])).resolves.toBeUndefined();
    await expect(pickContentItem("sel1", "material_section", "sec1")).resolves.toBe("item1");
    await expect(excludeContentItem("sel1", "item1")).resolves.toBeUndefined();
    await expect(includeContentItem("sel1", "item1")).resolves.toBeUndefined();
  });
});

describe("reorderContentItems — 단일 RPC 호출로 재정렬", () => {
  it("reorder_prepared_selection_content_items RPC를 정확히 한 번 호출한다", async () => {
    state.assignment = { id: "assign1" };
    state.rpcResult = { data: [], error: null };
    mockSupabase.rpc.mockClear();
    await reorderContentItems("sel1", ["item2", "item1"]);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("reorder_prepared_selection_content_items", {
      p_prepared_selection_id: "sel1",
      p_ordered_content_item_ids: ["item2", "item1"],
    });
  });
});

describe("attach/detach", () => {
  it("담당 선생님은 세션에 붙이고 뗄 수 있다", async () => {
    state.assignment = { id: "assign1" };
    await expect(attachSelectionToSession("sel1", "session1")).resolves.toBeUndefined();
    await expect(detachSelectionFromSession("sel1")).resolves.toBeUndefined();
  });
});
