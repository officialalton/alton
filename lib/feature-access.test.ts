import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { requireUserMock, redirectMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("./auth", () => ({ requireUser: requireUserMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import {
  COMMON_FEATURE_KEYS,
  FEATURE_KEYS,
  FREE_FEATURE_KEYS,
  FeatureAccessDeniedError,
  TUTORING_FEATURE_KEYS,
  normalizeFeatureAccess,
  requireStudentFeature,
} from "./feature-access";

describe("FEATURE_KEYS", () => {
  it("공통·무료·과외 키의 합집합이 전체 목록과 정확히 같다(중복·누락 없음)", () => {
    const union = [...COMMON_FEATURE_KEYS, ...FREE_FEATURE_KEYS, ...TUTORING_FEATURE_KEYS];
    expect(new Set(union).size).toBe(union.length);
    expect([...union].sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it("DB 함수 student_feature_access가 돌려주는 키와 1:1이다(마이그레이션 본문에서 추출)", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../supabase/migrations/20262100000000_free_member_foundation.sql"),
      "utf-8",
    );
    const fnBody = sql.slice(sql.indexOf("function public.student_feature_access"), sql.indexOf("revoke execute on function public.student_feature_access"));
    const sqlKeys = new Set<string>();
    for (const m of fnBody.matchAll(/array\[([^\]]+)\]/g)) {
      for (const k of m[1].matchAll(/'([a-z_]+)'/g)) sqlKeys.add(k[1]);
    }
    expect([...sqlKeys].sort()).toEqual([...FEATURE_KEYS].sort());
  });
});

describe("normalizeFeatureAccess", () => {
  it("배열이 아니면 빈 배열, 모르는 키는 버리고 중복은 합친다", () => {
    expect(normalizeFeatureAccess(null)).toEqual([]);
    expect(normalizeFeatureAccess("mock_exam")).toEqual([]);
    expect(normalizeFeatureAccess(["mock_exam", "bogus", "mock_exam", 3, "vocab"])).toEqual(["mock_exam", "vocab"]);
  });
});

describe("requireStudentFeature", () => {
  const rpcMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      user: { id: "stu-1" },
      profile: { role: "student", name: "학생", timezone: null },
      supabase: { rpc: rpcMock },
    });
  });

  it("키가 있으면 통과하고 featureAccess를 함께 돌려준다", async () => {
    rpcMock.mockResolvedValue({ data: ["account", "mock_exam"], error: null });
    const ctx = await requireStudentFeature("mock_exam");
    expect(rpcMock).toHaveBeenCalledWith("student_feature_access", { p_student_id: "stu-1" });
    expect(ctx.featureAccess).toEqual(["account", "mock_exam"]);
  });

  it("키가 없으면 FeatureAccessDeniedError", async () => {
    rpcMock.mockResolvedValue({ data: ["account", "mock_exam"], error: null });
    await expect(requireStudentFeature("lesson_booking")).rejects.toBeInstanceOf(FeatureAccessDeniedError);
  });

  it("redirectTo를 주면 던지는 대신 리다이렉트한다", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(requireStudentFeature("roadmap", { redirectTo: "/student" })).rejects.toThrow("REDIRECT:/student");
  });

  it("RPC 오류는 fail-closed로 전파된다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(requireStudentFeature("mock_exam")).rejects.toThrow("Couldn't load student_feature_access");
  });

  it("학생이 아닌 역할은 RPC를 부르지 않고 기존 requireUser 결과만 돌려준다", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "adm" }, profile: { role: "admin" }, supabase: { rpc: rpcMock } });
    const ctx = await requireStudentFeature("mock_exam");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(ctx.featureAccess).toEqual([]);
  });
});
