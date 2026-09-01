import { describe, expect, it, vi } from "vitest";
import {
  loadConsultations,
  loadTrialSessions,
  loadProposals,
  loadConsentGaps,
  loadAiNotesConsentEvents,
  loadDriveArtifactIssues,
} from "./consultation-data";

describe("loadConsultations", () => {
  it("상담 목록에 분류 태그를 조인해 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "consultations") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "c1",
                      contact_name: "김민지",
                      contact_email: "minji@example.com",
                      contact_phone: null,
                      student_grade: "10학년",
                      category: "family",
                      concerns: null,
                      status: "requested",
                      scheduled_at: null,
                      completed_at: null,
                      cancelled_at: null,
                      no_show_at: null,
                      cancellation_reason: null,
                      household_id: null,
                      child_id: null,
                      duplicate_of_consultation_id: null,
                      requested_at: "2026-08-01T00:00:00Z",
                    },
                  ],
                }),
            }),
          };
        }
        if (table === "consultation_classification_tags") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ consultation_id: "c1", classification_tags: { label: "SAT" } }],
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadConsultations(supabase as never);
    expect(result).toHaveLength(1);
    expect(result[0].tagLabels).toEqual(["SAT"]);
    expect(result[0].contactName).toBe("김민지");
  });

  it("상담이 없으면 빈 배열을 반환한다", async () => {
    const fromMock = vi.fn(() => ({ select: () => ({ order: () => Promise.resolve({ data: [] }) }) }));
    const result = await loadConsultations({ from: fromMock } as never);
    expect(result).toEqual([]);
  });
});

describe("loadTrialSessions", () => {
  it("체험 목록에 학생/과목/선생님 이름을 조인해 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trial_sessions") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "t1",
                      consultation_id: "c1",
                      child_id: "s1",
                      subject_id: "sub1",
                      teacher_id: "te1",
                      scheduled_at: "2026-08-05T00:00:00Z",
                      status: "scheduled",
                      goal: "SAT 900점",
                      result_notes: null,
                      recommendation: null,
                      recommended_teacher_id: null,
                      payable: true,
                      exception_approved_by: null,
                      exception_reason: null,
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
                    { id: "s1", name: "지훈" },
                    { id: "te1", name: "박선생" },
                  ],
                }),
            }),
          };
        }
        if (table === "subjects") {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [{ id: "sub1", name: "SAT Math" }] }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadTrialSessions(supabase as never);
    expect(result).toEqual([
      {
        id: "t1",
        consultationId: "c1",
        childId: "s1",
        childName: "지훈",
        subjectId: "sub1",
        subjectName: "SAT Math",
        teacherId: "te1",
        teacherName: "박선생",
        scheduledAt: "2026-08-05T00:00:00Z",
        status: "scheduled",
        goal: "SAT 900점",
        resultNotes: null,
        recommendation: null,
        recommendedTeacherId: null,
        payable: true,
        exceptionApprovedBy: null,
        exceptionReason: null,
      },
    ]);
  });
});

describe("loadProposals", () => {
  it("제안서 목록을 매핑해 반환한다", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: "p1",
                  consultation_id: "c1",
                  trial_session_id: "t1",
                  version_number: 1,
                  supersedes_proposal_id: null,
                  status: "draft",
                  recommended_subjects: [],
                  recommended_teacher_id: null,
                  recommended_session_count: 10,
                  sent_at: null,
                  responded_at: null,
                  created_at: "2026-08-06T00:00:00Z",
                },
              ],
            }),
        }),
      })),
    };

    const result = await loadProposals(supabase as never);
    expect(result[0].versionNumber).toBe(1);
    expect(result[0].recommendedSessionCount).toBe(10);
  });
});

describe("loadConsentGaps", () => {
  it("생년월일 미입력 학생을 동의 유무와 무관하게 포함한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ id: "s1", name: "지훈", date_of_birth: null, role: "student" }],
                }),
            }),
          };
        }
        if (table === "guardian_consents") {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [] }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadConsentGaps(supabase as never);
    expect(result).toEqual([{ childId: "s1", childName: "지훈", hasDob: false, hasActiveConsent: false }]);
  });

  it("동의가 있고 dob도 있으면(성인 취급 아님) 결과에서 제외한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ id: "s1", name: "지훈", date_of_birth: "2015-01-01", role: "student" }],
                }),
            }),
          };
        }
        if (table === "guardian_consents") {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [{ student_id: "s1", revoked_at: null }] }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadConsentGaps(supabase as never);
    expect(result).toEqual([]);
  });
});

describe("loadAiNotesConsentEvents", () => {
  it("학생 이름을 조인해 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "ai_notes_consent_events") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "e1",
                      student_id: "s1",
                      opted_in: true,
                      policy_version: "v1",
                      effective_at: "2026-08-01T00:00:00Z",
                      revoked_at: null,
                    },
                  ],
                }),
            }),
          };
        }
        if (table === "profiles") {
          return { select: () => ({ in: () => Promise.resolve({ data: [{ id: "s1", name: "지훈" }] }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadAiNotesConsentEvents(supabase as never);
    expect(result[0].studentName).toBe("지훈");
  });
});

describe("loadDriveArtifactIssues", () => {
  it("재시도 대상 상태만 조회한다", async () => {
    const inMock = vi.fn(() =>
      Promise.resolve({ data: [{ id: "d1", contract_id: "ct1", artifact_type: "signed_document", sync_status: "retryable_failed" }] })
    );
    const supabase = { from: vi.fn(() => ({ select: () => ({ in: inMock }) })) };

    const result = await loadDriveArtifactIssues(supabase as never);
    expect(result).toEqual([
      { id: "d1", contractId: "ct1", artifactType: "signed_document", syncStatus: "retryable_failed" },
    ]);
    expect(inMock).toHaveBeenCalledWith("sync_status", ["retryable_failed", "manual_review"]);
  });
});
