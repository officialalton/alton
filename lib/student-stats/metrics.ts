import { estimateAttempt } from "@/lib/mock-exam/score-aggregate";
import type {
  EntitlementStats, ExtendedStats, HabitStats, HomeworkStats, MockStats, OpsStats, RawStatsAggregate,
  SkillStats, StatsTier, TeacherOpsStats, WeakSkill,
} from "./types";

// 통계 지표 계산 — 순수 함수(DB 접근 없음). 집계 RPC 원본 → 화면용 모양.

export const WEAK_MIN_SAMPLES = 3;
export const WEAK_LIMIT = 5;
const DELTA_MIN_SAMPLES = 3;

export function pct(correct: number, total: number): number | null {
  return total > 0 ? Math.round((correct / total) * 100) : null;
}
const num = (v: unknown) => Number(v ?? 0) || 0;

/** 약점 상위 N개: 표본이 충분한(>=3) skill 을 정답률 낮은 순(동률이면 표본 많은 순)으로. */
export function computeSkillStats(raw: Pick<RawStatsAggregate, "skills" | "skillWeekly">, limit = WEAK_LIMIT): SkillStats {
  const totalAnswered = raw.skills.reduce((a, s) => a + num(s.total), 0);
  const totalCorrect = raw.skills.reduce((a, s) => a + num(s.correct), 0);
  const weak: WeakSkill[] = raw.skills
    .filter((s) => num(s.total) >= WEAK_MIN_SAMPLES)
    .map((s) => {
      const recent = num(s.recentTotal) >= DELTA_MIN_SAMPLES ? pct(num(s.recentCorrect), num(s.recentTotal)) : null;
      const prior = num(s.priorTotal) >= DELTA_MIN_SAMPLES ? pct(num(s.priorCorrect), num(s.priorTotal)) : null;
      return {
        code: s.code,
        label: s.label,
        total: num(s.total),
        correct: num(s.correct),
        pct: pct(num(s.correct), num(s.total)) ?? 0,
        delta: recent !== null && prior !== null ? recent - prior : null,
      };
    })
    .sort((a, b) => a.pct - b.pct || b.total - a.total || a.code.localeCompare(b.code))
    .slice(0, limit);
  return {
    totalAnswered,
    overallPct: pct(totalCorrect, totalAnswered),
    weak,
    weekly: raw.skillWeekly.map((w) => ({ week: w.week, pct: pct(num(w.correct), num(w.total)), total: num(w.total) })),
  };
}

export function computeEntitlementStats(raw: RawStatsAggregate["entitlements"]): EntitlementStats {
  return {
    remaining: num(raw?.remaining),
    expiringSoon: num(raw?.expiringSoon),
    nextExpiresAt: raw?.nextExpiresAt ?? null,
    groups: (raw?.groups ?? []).map((g) => ({ label: g.label, remaining: num(g.remaining), expiresAt: g.expiresAt, isPaid: !!g.isPaid })),
  };
}

const SECTION_LABEL = { rw: "Reading & Writing", math: "Math" } as const;

/** 예상 점수 범위 추이. 경로(route)는 estimateScore 입력으로만 쓰고 출력에는 넣지 않는다(modelVersion 도 버린다). */
export function computeMockStats(raw: RawStatsAggregate["mock"], tier: StatsTier): MockStats {
  const points = raw.map((a) => {
    const total = a.sections.reduce((s, x) => s + num(x.total), 0);
    const correct = a.sections.reduce((s, x) => s + num(x.correct), 0);
    // 점수 추정은 공유 집계 모듈(lib/mock-exam/score-aggregate.ts)만 거친다 — 관리자 화면과 숫자가 일치해야 한다.
    const sec = (k: "rw" | "math") => {
      const x = a.sections.find((y) => y.section === k);
      return { total: x ? num(x.total) : 0, correct: x ? num(x.correct) : null, complete: !!x, route: k === "rw" ? a.rwRoute : a.mathRoute };
    };
    const est = estimateAttempt({
      attemptId: a.attemptId, examName: "", track: "sat", apSubject: null, format: a.format === "mst" ? "mst" : "fixed",
      status: "graded", startedAt: null, gradedAt: a.gradedAt, attemptSeq: 1, sections: { rw: sec("rw"), math: sec("math") },
    });
    return {
      gradedAt: a.gradedAt,
      accuracyPct: pct(correct, total),
      total: est.total ? { ...est.total } : null,
      rw: tier === "family" ? null : est.rw ? { ...est.rw } : null,
      math: tier === "family" ? null : est.math ? { ...est.math } : null,
    };
  });
  const out: MockStats = { points };
  if (tier !== "family") {
    const sec = new Map<"rw" | "math", { total: number; correct: number }>();
    const dom = new Map<string, { total: number; correct: number }>();
    for (const a of raw) {
      for (const s of a.sections) {
        const cur = sec.get(s.section) ?? { total: 0, correct: 0 };
        cur.total += num(s.total); cur.correct += num(s.correct);
        sec.set(s.section, cur);
      }
      for (const d of a.domains) {
        const cur = dom.get(d.domain) ?? { total: 0, correct: 0 };
        cur.total += num(d.total); cur.correct += num(d.correct);
        dom.set(d.domain, cur);
      }
    }
    out.strengths = {
      sections: (["rw", "math"] as const)
        .filter((k) => sec.has(k))
        .map((k) => ({ key: k, label: SECTION_LABEL[k], ...sec.get(k)!, pct: pct(sec.get(k)!.correct, sec.get(k)!.total) ?? 0 })),
      domains: [...dom.entries()]
        .map(([label, v]) => ({ label, ...v, pct: pct(v.correct, v.total) ?? 0 }))
        .sort((a, b) => a.pct - b.pct || a.label.localeCompare(b.label)),
    };
  }
  return out;
}

export function computeHomeworkStats(raw: RawStatsAggregate["homework"], overdue: RawStatsAggregate["overdue"]): HomeworkStats {
  const o = { homework: num(overdue?.homework), vocabQuiz: num(overdue?.vocabQuiz), mockExam: num(overdue?.mockExam), manual: num(overdue?.manual) };
  return {
    assigned: num(raw?.assigned),
    submitted: num(raw?.submitted),
    completionPct: pct(num(raw?.submitted), num(raw?.assigned)),
    onTimePct: pct(num(raw?.onTime), num(raw?.submitted)),
    accuracyPct: pct(num(raw?.correct), num(raw?.graded)),
    weekly: (raw?.weekly ?? []).map((w) => ({ week: w.week, accuracyPct: pct(num(w.correct), num(w.graded)), graded: num(w.graded) })),
    overdue: { ...o, total: o.homework + o.vocabQuiz + o.mockExam + o.manual },
  };
}

export function computeHabitStats(habits: RawStatsAggregate["habits"], quizzes: RawStatsAggregate["vocabQuizzes"]): HabitStats {
  return {
    weekly: (habits ?? []).map((h) => ({
      week: h.week, homework: num(h.homework), lesson: num(h.lesson), vocab: num(h.vocab),
      total: num(h.homework) + num(h.lesson) + num(h.vocab),
    })),
    vocabQuizzes: (quizzes ?? []).map((q) => ({ at: q.at, score: num(q.score), total: num(q.total), pct: pct(num(q.score), num(q.total)) ?? 0 })),
  };
}

export function computeOpsStats(months: RawStatsAggregate["ops"]): OpsStats {
  const ms = (months ?? []).map((m) => ({
    month: m.month, completed: num(m.completed), noShow: num(m.noShow), late: num(m.late),
    cancelled: num(m.cancelled), lateCancel: num(m.lateCancel),
  }));
  const sum = (k: "completed" | "noShow" | "late" | "cancelled" | "lateCancel") => ms.reduce((a, m) => a + m[k], 0);
  return { months: ms, totals: { completed: sum("completed"), noShow: sum("noShow"), late: sum("late"), cancelled: sum("cancelled"), lateCancel: sum("lateCancel") } };
}

export function computeTeacherOps(raw: NonNullable<RawStatsAggregate["staff"]>): TeacherOpsStats {
  return {
    reviews: raw.reviewsByTeacher.map((r) => ({
      teacherName: r.teacherName ?? "(No name)", sessions: num(r.sessions), finalized: num(r.finalized),
      draft: num(r.draft), missing: Math.max(0, num(r.missing)),
      avgHoursToFinalize: r.avgHoursToFinalize === null ? null : num(r.avgHoursToFinalize),
    })),
    grading: {
      pending: num(raw.grading?.pending),
      oldestPendingAt: raw.grading?.oldestPendingAt ?? null,
      avgHoursToGrade: raw.grading?.avgHoursToGrade == null ? null : num(raw.grading.avgHoursToGrade),
    },
  };
}

/** 등급별로 필드 자체를 빼서 조립한다 — 학생·학부모에는 직원 전용 키(strengths·teacherOps)가 없다. */
export function buildExtendedStats(raw: RawStatsAggregate, tier: StatsTier): ExtendedStats {
  const out: ExtendedStats = {
    tier,
    skills: computeSkillStats(raw),
    entitlements: computeEntitlementStats(raw.entitlements),
    mock: computeMockStats(raw.mock ?? [], tier),
    homework: computeHomeworkStats(raw.homework, raw.overdue),
    habits: computeHabitStats(raw.habits, raw.vocabQuizzes),
    ops: computeOpsStats(raw.ops),
  };
  if (tier === "admin" && raw.staff) out.teacherOps = computeTeacherOps(raw.staff);
  return out;
}
