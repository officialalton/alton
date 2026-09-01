import { describe, expect, it, vi } from "vitest";
import { loadFamilyContracts, loadPendingConsults, loadAcceptedProposalsForContract } from "./contracts-data";

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

function makeContractsSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === "contracts") {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: "ct1",
                    household_id: "h1",
                    child_id: "s1",
                    status: "signed",
                    void_reason: null,
                    voided_at: null,
                    created_at: "2026-08-01T00:00:00Z",
                  },
                ],
              }),
          }),
        };
      }
      if (table === "household_members") {
        return {
          select: () => ({
            in: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ household_id: "h1", profile_id: "p1", is_primary: true }],
                }),
            }),
          }),
        };
      }
      if (table === "contract_versions") {
        return {
          select: () => ({
            in: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "cv1",
                      contract_id: "ct1",
                      version_number: 1,
                      version_status: "active",
                      company_signed_at: "2026-08-01T00:00:00Z",
                      docusign_envelope_id: "env1",
                      docusign_envelope_status: "completed",
                      docusign_status_updated_at: "2026-08-02T00:00:00Z",
                      proposal_id: "prop1",
                      created_at: "2026-08-01T00:00:00Z",
                    },
                  ],
                }),
            }),
          }),
        };
      }
      if (table === "drive_artifacts") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [],
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
}

describe("loadFamilyContracts", () => {
  it("contracts(v3 스키마)를 household_members/profiles/contract_versions/drive_artifacts와 조인해 반환한다", async () => {
    const supabase = makeContractsSupabase();

    const result = await loadFamilyContracts(supabase as never);
    expect(result).toEqual([
      {
        id: "ct1",
        householdId: "h1",
        childId: "s1",
        parentName: "김민지",
        studentName: "지훈",
        status: "signed",
        voidReason: null,
        voidedAt: null,
        signedAt: "2026-08-02T00:00:00Z",
        versions: [
          {
            id: "cv1",
            versionNumber: 1,
            versionStatus: "active",
            companySignedAt: "2026-08-01T00:00:00Z",
            docusignEnvelopeId: "env1",
            docusignEnvelopeStatus: "completed",
            docusignStatusUpdatedAt: "2026-08-02T00:00:00Z",
            proposalId: "prop1",
            createdAt: "2026-08-01T00:00:00Z",
          },
        ],
        driveArtifacts: [],
      },
    ]);
  });

  it("계약이 없으면 빈 배열을 반환하고 나머지 테이블을 조회하지 않는다", async () => {
    const fromMock = vi.fn(() => ({
      select: () => ({ order: () => Promise.resolve({ data: [] }) }),
    }));
    const supabase = { from: fromMock };

    const result = await loadFamilyContracts(supabase as never);
    expect(result).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});

describe("loadAcceptedProposalsForContract", () => {
  it("아직 계약 버전이 없는 수락된 제안서만 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "proposals") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ id: "prop1", consultation_id: "cons1", status: "accepted" }],
                }),
            }),
          };
        }
        if (table === "contract_versions") {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [] }),
            }),
          };
        }
        if (table === "consultations") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ id: "cons1", household_id: "h1", child_id: "s1", contact_name: "김민지" }],
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadAcceptedProposalsForContract(supabase as never);
    expect(result).toEqual([
      {
        proposalId: "prop1",
        consultationId: "cons1",
        householdId: "h1",
        childId: "s1",
        contactName: "김민지",
      },
    ]);
  });
});
