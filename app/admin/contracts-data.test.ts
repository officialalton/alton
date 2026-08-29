import { describe, expect, it, vi } from "vitest";
import { loadFamilyContracts, loadPendingConsults } from "./contracts-data";

describe("loadPendingConsults", () => {
  it("아직 계약으로 전환되지 않은 상담 신청만 반환한다", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          is: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: "c1",
                    person_name: "김민지",
                    email: "minji@example.com",
                    student_grade: "10학년",
                    submitted_at: "2026-08-01T00:00:00Z",
                  },
                ],
              }),
          }),
        }),
      })),
    };

    const result = await loadPendingConsults(supabase as never);
    expect(result).toEqual([
      {
        id: "c1",
        personName: "김민지",
        email: "minji@example.com",
        studentGrade: "10학년",
        submittedAt: "2026-08-01T00:00:00Z",
      },
    ]);
  });
});

describe("loadFamilyContracts", () => {
  it("contracts를 profiles 이름과 조인해 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "contracts") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "ct1",
                      parent_id: "p1",
                      student_id: "s1",
                      status: "signed",
                      signed_at: "2026-08-02T00:00:00Z",
                      created_at: "2026-08-01T00:00:00Z",
                    },
                  ],
                }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { id: "p1", name: "김민지" },
                    { id: "s1", name: "지훈" },
                  ],
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadFamilyContracts(supabase as never);
    expect(result).toEqual([
      {
        id: "ct1",
        parentName: "김민지",
        studentName: "지훈",
        status: "signed",
        signedAt: "2026-08-02T00:00:00Z",
      },
    ]);
  });

  it("계약이 없으면 빈 배열을 반환하고 profiles를 조회하지 않는다", async () => {
    const fromMock = vi.fn(() => ({
      select: () => ({ order: () => Promise.resolve({ data: [] }) }),
    }));
    const supabase = { from: fromMock };

    const result = await loadFamilyContracts(supabase as never);
    expect(result).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
