import { describe, expect, it, vi } from "vitest";

const { mockSupabase, state } = vi.hoisted(() => {
  const state: {
    role: string;
    assignment: { id: string } | null;
    rpcResult: { data: unknown[]; error: unknown };
  } = { role: "teacher", assignment: { id: "assign1" }, rpcResult: { data: [], error: null } };

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
      if (table === "curriculum_overlay_units") {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
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

import { excludeUnit, moveUnit, setUnitStatus } from "./student-curriculum-actions";

describe("담당 학생 인가", () => {
  it("담당이 아닌 선생님이 호출하면 거부한다", async () => {
    state.assignment = null;
    await expect(excludeUnit("enr1", "unit1")).rejects.toThrow(
      "담당 학생의 커리큘럼만 조정할 수 있습니다."
    );
  });

  it("담당 선생님이면 상태를 변경할 수 있다", async () => {
    state.assignment = { id: "assign1" };
    await expect(setUnitStatus("enr1", "unit1", "completed")).resolves.toBeUndefined();
  });
});

describe("moveUnit — 단일 RPC 호출로 재정렬", () => {
  it("reorder_curriculum_overlay_units RPC를 한 번만 호출한다", async () => {
    state.assignment = { id: "assign1" };
    state.rpcResult = {
      data: [
        { id: "u2", source_unit_id: null, position: 1, unit_title: "B", note: null, status: "not_started", status_changed_at: null },
        { id: "u1", source_unit_id: null, position: 2, unit_title: "A", note: null, status: "not_started", status_changed_at: null },
      ],
      error: null,
    };
    mockSupabase.rpc.mockClear();
    const result = await moveUnit("enr1", "overlay1", ["u1", "u2"], "u2", -1);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("reorder_curriculum_overlay_units", {
      p_overlay_id: "overlay1",
      p_ordered_unit_ids: ["u2", "u1"],
    });
    expect(result.map((u) => u.id)).toEqual(["u2", "u1"]);
  });

  it("이동할 수 없는 방향(맨 위에서 위로)이면 RPC를 호출하지 않는다", async () => {
    state.assignment = { id: "assign1" };
    mockSupabase.rpc.mockClear();
    const result = await moveUnit("enr1", "overlay1", ["u1", "u2"], "u1", -1);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
