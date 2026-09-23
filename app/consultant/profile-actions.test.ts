import { describe, it, expect, vi } from "vitest";

const { requireConsultantMock } = vi.hoisted(() => ({ requireConsultantMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireConsultant: requireConsultantMock }));

import { getMyConsultantProfileAction, updateMyConsultantProfileAction } from "./profile-actions";

function makeSupabase(row: Record<string, unknown>) {
  const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
  return {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
      update: updateMock,
    }),
    _updateMock: updateMock,
  };
}

describe("getMyConsultantProfileAction", () => {
  it("본인 프로필 필드를 매핑해서 반환한다", async () => {
    const supabase = makeSupabase({
      name: "지만",
      date_of_birth: "1990-01-01",
      gender: "male",
      career_bio: "5년 경력",
      hire_date: "2024-01-01",
      timezone: "Asia/Seoul",
    });
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });

    const result = await getMyConsultantProfileAction();

    expect(result).toEqual({
      name: "지만",
      dateOfBirth: "1990-01-01",
      gender: "male",
      careerBio: "5년 경력",
      hireDate: "2024-01-01",
      timezone: "Asia/Seoul",
    });
  });
});

describe("updateMyConsultantProfileAction", () => {
  it("gender/careerBio/timezone만 본인 행에 업데이트한다(hireDate 등은 받지 않음)", async () => {
    const supabase = makeSupabase({});
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });

    await updateMyConsultantProfileAction({ gender: "female", careerBio: "업데이트", timezone: "America/New_York" });

    expect(supabase._updateMock).toHaveBeenCalledWith({
      gender: "female",
      career_bio: "업데이트",
      timezone: "America/New_York",
    });
  });

  it("타입 상 hireDate 파라미터 자체가 없다 — 함수 시그니처로 관리자 전용 필드를 원천 차단", async () => {
    const supabase = makeSupabase({});
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });
    // @ts-expect-error hireDate는 updateMyConsultantProfileAction의 파라미터 타입에 없다
    await updateMyConsultantProfileAction({ hireDate: "2020-01-01" });
    expect(supabase._updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ hire_date: expect.anything() }));
  });
});
