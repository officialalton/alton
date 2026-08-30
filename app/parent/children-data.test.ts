import { describe, expect, it, vi } from "vitest";
import { loadChildren } from "./children-data";

describe("loadChildren", () => {
  it("이 보호자가 속한 household의 자녀를 is_primary 우선순으로 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "household_members") throw new Error(`unexpected table ${table}`);
        return {
          select: (cols: string) => {
            if (cols === "household_id") {
              return { eq: () => ({ eq: () => Promise.resolve({ data: [{ household_id: "h1" }] }) }) };
            }
            return {
              in: () => ({
                eq: () => ({
                  order: () =>
                    Promise.resolve({
                      data: [
                        { profile_id: "s1", is_primary: true, profile: { name: "지훈" } },
                        { profile_id: "s2", is_primary: false, profile: { name: "이서아" } },
                      ],
                    }),
                }),
              }),
            };
          },
        };
      }),
    };

    const result = await loadChildren(supabase as never, "parent1");
    expect(result).toEqual([
      { studentId: "s1", name: "지훈", isPrimary: true },
      { studentId: "s2", name: "이서아", isPrimary: false },
    ]);
  });

  it("보호자가 속한 household가 없으면 빈 배열을 반환하고 자녀 조회를 하지 않는다", async () => {
    const childQueryMock = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "household_members") throw new Error(`unexpected table ${table}`);
        return {
          select: (cols: string) => {
            if (cols === "household_id") {
              return { eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
            }
            childQueryMock();
            return { in: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) };
          },
        };
      }),
    };

    const result = await loadChildren(supabase as never, "parent-without-household");
    expect(result).toEqual([]);
    expect(childQueryMock).not.toHaveBeenCalled();
  });

  it("여러 household에 걸친 자녀도 하나로 합쳐 반환한다(복수 household를 가진 보호자)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "household_members") throw new Error(`unexpected table ${table}`);
        return {
          select: (cols: string) => {
            if (cols === "household_id") {
              return {
                eq: () => ({
                  eq: () =>
                    Promise.resolve({ data: [{ household_id: "h1" }, { household_id: "h2" }] }),
                }),
              };
            }
            return {
              in: (col: string, ids: string[]) => {
                expect(ids).toEqual(["h1", "h2"]);
                return {
                  eq: () => ({
                    order: () =>
                      Promise.resolve({
                        data: [{ profile_id: "s3", is_primary: true, profile: { name: "박준서" } }],
                      }),
                  }),
                };
              },
            };
          },
        };
      }),
    };

    const result = await loadChildren(supabase as never, "parent-in-two-households");
    expect(result).toEqual([{ studentId: "s3", name: "박준서", isPrimary: true }]);
  });
});
