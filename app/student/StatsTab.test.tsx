import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StatsTab, { StatsPanel } from "./StatsTab";
import type { StatsData } from "./stats-data";
import { buildExtendedStats } from "@/lib/student-stats/metrics";
import type { RawStatsAggregate, StatsTier } from "@/lib/student-stats/types";

const raw: RawStatsAggregate = {
  skills: [
    { code: "linear_functions", label: "Linear functions", domain: "algebra", total: 10, correct: 4, recentTotal: 4, recentCorrect: 3, priorTotal: 6, priorCorrect: 1 },
  ],
  skillWeekly: [{ week: "2026-09-14", total: 10, correct: 4 }],
  entitlements: { remaining: 8, expiringSoon: 3, nextExpiresAt: "2026-10-05T00:00:00Z", groups: [{ label: "정규 수업", remaining: 8, expiresAt: "2026-10-05T00:00:00Z", isPaid: true }] },
  mock: [{ attemptId: "a", gradedAt: "2026-09-10T00:00:00Z", format: "mst", rwRoute: "higher", mathRoute: "higher",
    sections: [{ section: "rw", total: 6, correct: 5 }, { section: "math", total: 4, correct: 4 }],
    domains: [{ domain: "algebra", total: 4, correct: 4 }] }],
  homework: { assigned: 10, submitted: 8, onTime: 6, graded: 5, correct: 4, weekly: [{ week: "2026-09-14", assigned: 10, submitted: 8, graded: 5, correct: 4 }] },
  overdue: { homework: 1, vocabQuiz: 0, mockExam: 0, manual: 0 },
  habits: [{ week: "2026-09-14", homework: 3, lesson: 2, vocab: 4 }],
  vocabQuizzes: [{ at: "2026-09-12T00:00:00Z", score: 8, total: 10 }],
  ops: [{ month: "2026-09", completed: 6, noShow: 1, late: 1, cancelled: 1, lateCancel: 0 }],
  staff: { reviewsByTeacher: [{ teacherId: "t", teacherName: "김선생", sessions: 4, finalized: 2, draft: 1, missing: 1, avgHoursToFinalize: 6 }], grading: { pending: 2, oldestPendingAt: "2026-09-20T00:00:00Z", avgHoursToGrade: 10 } },
};
const data = (tier: StatsTier): StatsData => ({
  attendanceRate: 92,
  ...(tier === "family" ? {} : { satisfactionAvg: 4.5 }),
  bySubject: [{ subjectName: "SAT Math", pct: 100 }],
  extended: buildExtendedStats(raw, tier),
});

describe("StatsTab — 기존 요약", () => {
  it("데이터가 없으면 대시로 보여준다(확장 없음, 만족도 키 있음)", () => {
    render(<StatsTab data={{ attendanceRate: null, satisfactionAvg: null, bySubject: [] }} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("아직 집계할 수업 기록이 없습니다.")).toBeInTheDocument();
  });
  it("참여율/만족도/과목별 참여율", () => {
    render(<StatsTab data={{ attendanceRate: 92, satisfactionAvg: 4.5, bySubject: [{ subjectName: "SAT Math", pct: 100 }] }} />);
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("4.5 / 5")).toBeInTheDocument();
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
  });
});

describe("StatsTab — 역할별 노출", () => {
  it("학생 본인·학부모(family): 만족도·모의고사 강약·선생님 피드백 섹션 없음", () => {
    render(<StatsTab data={data("family")} />);
    expect(screen.queryByText("선생님 피드백 만족도")).toBeNull();
    expect(screen.queryByText("영역별 강약")).toBeNull();
    expect(screen.queryByText(/선생님 피드백 \(관리자\)/)).toBeNull();
    expect(screen.getByText("학습 성과")).toBeInTheDocument();
    expect(screen.getByText("모의고사")).toBeInTheDocument();
    expect(screen.getByText("수업권")).toBeInTheDocument();
    expect(screen.getByText("Linear functions")).toBeInTheDocument();
    expect(screen.getByText(/최근 4주 ▲/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/higher|lower|경로|난이도|정책/);
  });
  it("컨설턴트(staff): 만족도·강약 보임, 선생님 피드백(관리자) 없음", () => {
    render(<StatsTab data={data("staff")} />);
    expect(screen.getByText("선생님 피드백 만족도")).toBeInTheDocument();
    expect(screen.getByText("영역별 강약")).toBeInTheDocument();
    expect(screen.queryByText(/선생님 피드백 \(관리자\)/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/higher|lower|경로|정책/);
  });
  it("관리자: 선생님 리뷰 작성 현황·채점 대기 보임", () => {
    render(<StatsTab data={data("admin")} />);
    expect(screen.getByText("선생님 피드백 (관리자)")).toBeInTheDocument();
    expect(screen.getByText("김선생")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
  });
  it("빈 확장 데이터: 각 섹션이 빈 상태 문구를 보여준다", () => {
    const empty: RawStatsAggregate = { ...raw, skills: [], skillWeekly: [], entitlements: null, mock: [], homework: { assigned: 0, submitted: 0, onTime: 0, graded: 0, correct: 0, weekly: [] },
      overdue: { homework: 0, vocabQuiz: 0, mockExam: 0, manual: 0 }, habits: [], vocabQuizzes: [], ops: [], staff: null };
    render(<StatsTab data={{ attendanceRate: null, bySubject: [], extended: buildExtendedStats(empty, "family") }} />);
    expect(screen.getByText("아직 채점된 문제가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("채점이 끝난 모의고사가 아직 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("배정된 과제가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 12주 동안 기록된 학습 활동이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 6개월 수업 기록이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("사용 가능한 수업권이 없습니다.")).toBeInTheDocument();
  });
});

describe("StatsPanel — 로딩·오류·재시도", () => {
  it("로딩 스켈레톤 → 데이터", async () => {
    render(<StatsPanel load={async () => data("family")} />);
    expect(screen.getByRole("status", { name: "통계 불러오는 중" })).toBeInTheDocument();
    await screen.findByText("수업 참여율");
  });
  it("오류는 알림과 다시 시도 버튼, 재시도하면 불러온다", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("통계를 불러오지 못했습니다.")).mockResolvedValue(data("family"));
    render(<StatsPanel load={load} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("통계를 불러오지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getByText("수업 참여율")).toBeInTheDocument());
    expect(load).toHaveBeenCalledTimes(2);
  });
});
