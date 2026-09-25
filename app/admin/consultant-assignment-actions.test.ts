import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "admin" } });
const getUserByIdMock = vi.fn().mockResolvedValue({ data: { user: { email: "consultant@example.com" } } });

function tableStub(rows: unknown) {
  return { data: rows };
}

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: (cols: string) => {
            if (cols === "role") return { eq: () => ({ single: profileSingleMock }) };
            // consultant profile fetch (id, name, gender, career_bio, hire_date)
            if (cols.includes("career_bio")) {
              return {
                eq: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "consultant1", name: "김상담", gender: null, career_bio: null, hire_date: null },
                    error: null,
                  }),
                }),
              };
            }
            // guardian profiles fetch (id, name)
            return { in: () => Promise.resolve(tableStub([{ id: "guardian1", name: "보호자맘" }])) };
          },
        };
      }
      if (table === "consultant_assignments") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve(
                tableStub([
                  {
                    student_id: "student1",
                    student: { id: "student1", name: "학생일" },
                  },
                ])
              ),
          }),
        };
      }
      if (table === "consultant_assignment_history") {
        return {
          select: () => ({
            or: () => ({
              order: () => Promise.resolve(tableStub([])),
            }),
          }),
        };
      }
      if (table === "household_members") {
        return {
          select: (cols: string) => {
            if (cols.includes("profile_id")) {
              return {
                in: (col: string, ids: string[]) => ({
                  eq: (roleCol: string, roleVal: string) => {
                    if (roleVal === "child") {
                      return Promise.resolve(
                        tableStub(
                          ids.includes("student1")
                            ? [{ household_id: "household1", profile_id: "student1" }]
                            : []
                        )
                      );
                    }
                    if (roleVal === "guardian") {
                      return Promise.resolve(
                        tableStub(
                          ids.includes("household1")
                            ? [{ household_id: "household1", profile_id: "guardian1" }]
                            : []
                        )
                      );
                    }
                    return Promise.resolve(tableStub([]));
                  },
                }),
              };
            }
            throw new Error(`unexpected household_members select ${cols}`);
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: getUserByIdMock } },
  }),
}));

vi.mock("@/app/consultant/intake-data", () => ({
  loadUnassignedConsultations: vi.fn(),
  loadAssignedAwaitingSchedule: vi.fn(),
}));

vi.mock("@/lib/consultation/notifications", () => ({
  sendConsultationSchedulingLinkEmail: vi.fn(),
}));

describe("getConsultantDetailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    getUserByIdMock.mockResolvedValue({ data: { user: { email: "consultant@example.com" } } });
  });

  it("household_members를 profile_id/role='child'|'guardian'로 조회해 담당 학생의 보호자 이름을 채운다", async () => {
    const { getConsultantDetailAction } = await import("./consultant-assignment-actions");

    const result = await getConsultantDetailAction("consultant1");

    expect(result.currentStudents).toHaveLength(1);
    expect(result.currentStudents[0]).toMatchObject({
      id: "student1",
      name: "학생일",
      householdId: "household1",
      guardianNames: ["보호자맘"],
    });
  });
});
