import { describe, expect, it } from "vitest";
import { loadStudentCreditHistoryBatch, loadTeacherQcWarningsBatch } from "./users-data";

// 성능 corrective(2026-09-09, 성능 측정 라운드) 회귀 테스트: app/admin/page.tsx가
// 학생/교사 전원에 대해 loadStudentCreditHistory/loadTeacherQcWarnings를 개별
// 호출하던 N+1(admin 페이지 웜 TTFB 최악의 원인으로 실측 확인)을 .in() 배치
// 조회로 교체했다. 이 테스트는 (1) 학생/교사 수와 무관하게 쿼리가 정확히 1회만
// 발생하는지, (2) 여러 학생/교사에 대한 매핑·정렬·빈 값 처리가 기존 단건 버전과
// 동일한지를 검증한다.

function makeSupabaseMock(tables: Record<string, unknown[]>) {
  const callCounts: Record<string, number> = {};
  return {
    callCounts,
    from: (table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const rows = tables[table] ?? [];
      const builder: {
        select: () => typeof builder;
        in: () => typeof builder;
        order: () => Promise<{ data: unknown[] }>;
      } = {
        select: () => builder,
        in: () => builder,
        order: () => Promise.resolve({ data: rows }),
      };
      return builder;
    },
  };
}

describe("loadStudentCreditHistoryBatch", () => {
  it("학생 ID가 없으면 쿼리 없이 빈 배열 맵을 반환한다", async () => {
    const mock = makeSupabaseMock({ credit_transactions: [] });
    const result = await loadStudentCreditHistoryBatch(mock as never, []);
    expect(result).toEqual({});
    expect(mock.callCounts.credit_transactions).toBeUndefined();
  });

  it("학생 수와 무관하게 쿼리가 정확히 1회만 발생하고, 학생별로 정확히 매핑·정렬되며, 거래 내역이 없는 학생은 빈 배열을 받는다", async () => {
    const mock = makeSupabaseMock({
      credit_transactions: [
        { id: "t1", student_id: "s1", type: "grant", amount: 10, reason: null, created_at: "2026-02-01" },
        { id: "t2", student_id: "s1", type: "adjust", amount: -2, reason: "조정", created_at: "2026-01-01" },
        { id: "t3", student_id: "s2", type: "grant", amount: 5, reason: null, created_at: "2026-01-15" },
      ],
    });

    const result = await loadStudentCreditHistoryBatch(mock as never, ["s1", "s2", "s3"]);

    expect(mock.callCounts.credit_transactions).toBe(1);
    expect(result.s1).toEqual([
      { id: "t1", type: "grant", amount: 10, reason: null, createdAt: "2026-02-01" },
      { id: "t2", type: "adjust", amount: -2, reason: "조정", createdAt: "2026-01-01" },
    ]);
    expect(result.s2).toEqual([
      { id: "t3", type: "grant", amount: 5, reason: null, createdAt: "2026-01-15" },
    ]);
    // 거래 내역이 전혀 없는 학생(s3)도 키는 존재하고 빈 배열 — 기존 단건 버전과 동일한 처리.
    expect(result.s3).toEqual([]);
  });
});

describe("loadTeacherQcWarningsBatch", () => {
  it("교사 ID가 없으면 쿼리 없이 빈 배열 맵을 반환한다", async () => {
    const mock = makeSupabaseMock({ teacher_qc_warnings: [] });
    const result = await loadTeacherQcWarningsBatch(mock as never, []);
    expect(result).toEqual({});
    expect(mock.callCounts.teacher_qc_warnings).toBeUndefined();
  });

  it("교사 수와 무관하게 쿼리가 정확히 1회만 발생하고, 교사별로 정확히 매핑·정렬되며 학생 이름이 없으면 null을 반환한다", async () => {
    const mock = makeSupabaseMock({
      teacher_qc_warnings: [
        {
          id: "w1",
          teacher_id: "t1",
          type: "late",
          detail: "5분 지각",
          occurred_at: "2026-02-01",
          student: { profile: { name: "김학생" } },
        },
        {
          id: "w2",
          teacher_id: "t1",
          type: "no_show",
          detail: null,
          occurred_at: "2026-01-01",
          student: null,
        },
        {
          id: "w3",
          teacher_id: "t2",
          type: "late",
          detail: "3분 지각",
          occurred_at: "2026-01-20",
          student: [{ profile: { name: "이학생" } }],
        },
      ],
    });

    const result = await loadTeacherQcWarningsBatch(mock as never, ["t1", "t2", "t3"]);

    expect(mock.callCounts.teacher_qc_warnings).toBe(1);
    expect(result.t1).toEqual([
      { id: "w1", type: "late", detail: "5분 지각", occurredAt: "2026-02-01", studentName: "김학생" },
      { id: "w2", type: "no_show", detail: null, occurredAt: "2026-01-01", studentName: null },
    ]);
    expect(result.t2).toEqual([
      { id: "w3", type: "late", detail: "3분 지각", occurredAt: "2026-01-20", studentName: "이학생" },
    ]);
    // QC 경고가 전혀 없는 교사(t3)도 키는 존재하고 빈 배열.
    expect(result.t3).toEqual([]);
  });
});
