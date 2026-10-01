import { describe, expect, it } from "vitest";
import {
  buildExtendedStats, computeHabitStats, computeHomeworkStats, computeMockStats, computeOpsStats, computeSkillStats, pct,
} from "./metrics";
import type { RawStatsAggregate } from "./types";

const skill = (code: string, total: number, correct: number, extra: Partial<RawStatsAggregate["skills"][number]> = {}) => ({
  code, label: code, domain: null, total, correct, recentTotal: 0, recentCorrect: 0, priorTotal: 0, priorCorrect: 0, ...extra,
});
const weeks = (n = 12) => Array.from({ length: n }, (_, i) => ({ week: `2026-07-${String(i + 1).padStart(2, "0")}`, total: 0, correct: 0 }));

describe("pct", () => {
  it("분모 0 이면 null, 반올림", () => {
    expect(pct(0, 0)).toBeNull();
    expect(pct(2, 3)).toBe(67);
  });
});

describe("computeSkillStats", () => {
  it("표본 3개 미만은 약점 후보에서 제외하고, 낮은 정답률 순(동률이면 표본 많은 순) 상위 N개", () => {
    const s = computeSkillStats({
      skills: [skill("a", 2, 0), skill("b", 10, 3), skill("c", 4, 1), skill("d", 8, 6), skill("e", 5, 1), skill("f", 6, 2), skill("g", 3, 3)],
      skillWeekly: weeks(),
    }, 3);
    expect(s.weak.map((w) => w.code)).toEqual(["e", "c", "b"]);
    expect(s.totalAnswered).toBe(38);
    expect(s.overallPct).toBe(Math.round((16 / 38) * 100));
  });
  it("최근 4주 변화는 양쪽 표본이 3개 이상일 때만", () => {
    const s = computeSkillStats({
      skills: [
        skill("up", 12, 6, { recentTotal: 4, recentCorrect: 4, priorTotal: 8, priorCorrect: 2 }),
        skill("few", 6, 3, { recentTotal: 2, recentCorrect: 2, priorTotal: 4, priorCorrect: 1 }),
      ],
      skillWeekly: weeks(),
    });
    expect(s.weak.find((w) => w.code === "up")?.delta).toBe(75);
    expect(s.weak.find((w) => w.code === "few")?.delta).toBeNull();
  });
  it("기록이 없으면 빈 약점·null 정답률", () => {
    const s = computeSkillStats({ skills: [], skillWeekly: weeks() });
    expect(s).toMatchObject({ totalAnswered: 0, overallPct: null, weak: [] });
  });
  it("주별 정답률은 문제 수가 0인 주를 null 로", () => {
    const w = weeks(2); w[1] = { ...w[1], total: 4, correct: 3 };
    expect(computeSkillStats({ skills: [], skillWeekly: w }).weekly.map((x) => x.pct)).toEqual([null, 75]);
  });
});

describe("computeMockStats", () => {
  const raw: RawStatsAggregate["mock"] = [
    { attemptId: "a1", gradedAt: "2026-09-01T00:00:00Z", format: "mst", rwRoute: "higher", mathRoute: "lower",
      sections: [{ section: "rw", total: 6, correct: 5 }, { section: "math", total: 4, correct: 2 }],
      domains: [{ domain: "algebra", total: 4, correct: 2 }, { domain: "rw_craft_structure", total: 6, correct: 5 }] },
    { attemptId: "a2", gradedAt: "2026-09-10T00:00:00Z", format: "fixed", rwRoute: null, mathRoute: null,
      sections: [{ section: "rw", total: 10, correct: 7 }, { section: "math", total: 10, correct: 5 }], domains: [] },
  ];
  it("적응형만 예상 점수 범위를 갖고 고정형은 정답률만", () => {
    const m = computeMockStats(raw, "staff");
    expect(m.points[0].total).not.toBeNull();
    expect(m.points[0].total!.low).toBeLessThanOrEqual(m.points[0].total!.high);
    expect(m.points[1].total).toBeNull();
    expect(m.points[1].accuracyPct).toBe(60);
  });
  it("family 는 섹션 범위·강약 없음, staff 는 있음", () => {
    const fam = computeMockStats(raw, "family");
    expect(fam.points[0].rw).toBeNull();
    expect(fam.strengths).toBeUndefined();
    const st = computeMockStats(raw, "staff");
    expect(st.points[0].rw).not.toBeNull();
    expect(st.strengths?.sections.map((s) => s.key)).toEqual(["rw", "math"]);
    expect(st.strengths?.domains[0].label).toBe("algebra");
  });
  it("출력 어디에도 경로·정책 버전이 없다", () => {
    for (const tier of ["family", "staff", "admin"] as const) {
      expect(JSON.stringify(computeMockStats(raw, tier))).not.toMatch(/route|higher|lower|policy|modelVersion|difficult/i);
    }
  });
});

describe("과제·습관·운영", () => {
  it("과제 비율과 기한 초과 합계", () => {
    const h = computeHomeworkStats(
      { assigned: 10, submitted: 8, onTime: 6, graded: 5, correct: 4, weekly: [{ week: "w", assigned: 2, submitted: 2, graded: 0, correct: 0 }] },
      { homework: 1, vocabQuiz: 2, mockExam: 0, manual: 3 },
    );
    expect(h).toMatchObject({ completionPct: 80, onTimePct: 75, accuracyPct: 80 });
    expect(h.overdue.total).toBe(6);
    expect(h.weekly[0].accuracyPct).toBeNull();
  });
  it("과제가 없으면 비율은 null", () => {
    const h = computeHomeworkStats({ assigned: 0, submitted: 0, onTime: 0, graded: 0, correct: 0, weekly: [] }, { homework: 0, vocabQuiz: 0, mockExam: 0, manual: 0 });
    expect(h).toMatchObject({ completionPct: null, onTimePct: null, accuracyPct: null });
  });
  it("주간 활동량 합계와 단어 시험 %", () => {
    const hb = computeHabitStats([{ week: "w", homework: 2, lesson: 1, vocab: 3 }], [{ at: "2026-09-01T00:00:00Z", score: 7, total: 10 }]);
    expect(hb.weekly[0].total).toBe(6);
    expect(hb.vocabQuizzes[0].pct).toBe(70);
  });
  it("운영 지표 합계", () => {
    const o = computeOpsStats([
      { month: "2026-08", completed: 4, noShow: 1, late: 1, cancelled: 2, lateCancel: 1 },
      { month: "2026-09", completed: 5, noShow: 0, late: 2, cancelled: 0, lateCancel: 0 },
    ]);
    expect(o.totals).toEqual({ completed: 9, noShow: 1, late: 3, cancelled: 2, lateCancel: 1 });
  });
});

describe("역할별 노출 매트릭스 — 키 자체가 없다", () => {
  const raw: RawStatsAggregate = {
    skills: [], skillWeekly: [], entitlements: null,
    mock: [{ attemptId: "a", gradedAt: "2026-09-01T00:00:00Z", format: "mst", rwRoute: "lower", mathRoute: "lower",
      sections: [{ section: "rw", total: 6, correct: 3 }, { section: "math", total: 4, correct: 2 }], domains: [] }],
    homework: { assigned: 0, submitted: 0, onTime: 0, graded: 0, correct: 0, weekly: [] },
    overdue: { homework: 0, vocabQuiz: 0, mockExam: 0, manual: 0 }, habits: [], vocabQuizzes: [], ops: [],
    staff: { reviewsByTeacher: [{ teacherId: "t", teacherName: "김선생", sessions: 3, finalized: 1, draft: 1, missing: 1, avgHoursToFinalize: 5 }], grading: { pending: 2, oldestPendingAt: null, avgHoursToGrade: 12 } },
  };
  it("학생 본인·학부모(family): 직원 전용 항목 없음, 동일 payload", () => {
    const fam = buildExtendedStats(raw, "family");
    expect("teacherOps" in fam).toBe(false);
    expect("strengths" in fam.mock).toBe(false);
    expect(JSON.stringify(fam)).not.toMatch(/김선생|route|policy|modelVersion/);
  });
  it("컨설턴트(staff): teacherOps 없음, 강약 있음 / 관리자(admin): 둘 다 있음", () => {
    const st = buildExtendedStats(raw, "staff");
    expect(st.teacherOps).toBeUndefined();
    expect(st.mock.strengths).toBeDefined();
    const ad = buildExtendedStats(raw, "admin");
    expect(ad.teacherOps?.reviews[0]).toMatchObject({ teacherName: "김선생", missing: 1 });
    expect(ad.teacherOps?.grading.pending).toBe(2);
  });
});
