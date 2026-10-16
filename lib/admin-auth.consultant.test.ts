import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-29 온보딩 시나리오 감사 — 배정 이후의 상담 진행은 담당 컨설턴트의 몫이다.
// 관리자·컨설턴트만 통과하고, 상담 단위 작업은 "그 상담의 담당 컨설턴트"만 통과해야 한다.

const state = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  profile: { role: "consultant", admin_tier: null } as { role: string; admin_tier: string | null } | null,
  consultation: { admissions_consultant_id: "u1" } as { admissions_consultant_id: string | null } | null,
  hasCapability: false,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: state.profile }),
          maybeSingle: async () => ({ data: table === "consultations" ? state.consultation : null }),
        }),
      }),
    }),
    rpc: async () => ({ data: state.hasCapability }),
  }),
}));

import { requireAdminCapabilityOrAssignedConsultant, requireAdminOrConsultant } from "./admin-auth";

beforeEach(() => {
  state.user = { id: "u1" };
  state.profile = { role: "consultant", admin_tier: null };
  state.consultation = { admissions_consultant_id: "u1" };
  state.hasCapability = false;
});

describe("requireAdminOrConsultant", () => {
  it("컨설턴트·관리자는 통과한다", async () => {
    await expect(requireAdminOrConsultant()).resolves.toMatchObject({ role: "consultant", actorUserId: "u1" });
    state.profile = { role: "admin", admin_tier: "full" };
    await expect(requireAdminOrConsultant()).resolves.toMatchObject({ role: "admin" });
  });
  it("선생님·학부모·비로그인은 거절한다", async () => {
    state.profile = { role: "teacher", admin_tier: null };
    await expect(requireAdminOrConsultant()).rejects.toThrow("관리자 또는 담당 컨설턴트만");
    state.user = null;
    await expect(requireAdminOrConsultant()).rejects.toThrow("로그인이 필요합니다.");
  });
});

describe("requireAdminCapabilityOrAssignedConsultant", () => {
  it("담당 컨설턴트는 통과, 다른 컨설턴트는 거절한다", async () => {
    await expect(requireAdminCapabilityOrAssignedConsultant("manage_consultations", "c1")).resolves.toMatchObject({ actorUserId: "u1" });
    state.consultation = { admissions_consultant_id: "someone-else" };
    await expect(requireAdminCapabilityOrAssignedConsultant("manage_consultations", "c1")).rejects.toThrow("담당 컨설턴트만");
    state.consultation = null;
    await expect(requireAdminCapabilityOrAssignedConsultant("manage_consultations", "c1")).rejects.toThrow("담당 컨설턴트만");
  });
  it("관리자는 통과하고, 중간 관리자(supervisor)·기타 역할은 capability 가 있어야 한다", async () => {
    state.profile = { role: "admin", admin_tier: "full" };
    await expect(requireAdminCapabilityOrAssignedConsultant("manage_consultations", "c1")).resolves.toBeTruthy();
    state.profile = { role: "admin", admin_tier: "supervisor" };
    await expect(requireAdminCapabilityOrAssignedConsultant("manage_consultations", "c1")).rejects.toThrow("권한이 없습니다");
    state.hasCapability = true;
    await expect(requireAdminCapabilityOrAssignedConsultant("manage_consultations", "c1")).resolves.toBeTruthy();
  });
});
