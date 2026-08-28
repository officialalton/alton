import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminHomeDashboard from "./AdminHomeDashboard";
import type { AdminDashboardData } from "./dashboard-data";

const baseData: AdminDashboardData = {
  adminName: "관리자",
  pendingConsults: [],
  upcomingConsults: [],
  pendingStudents: [],
  pendingTeachers: [],
  qcWarnings: [],
};

describe("AdminHomeDashboard", () => {
  it("데이터가 없으면 각 카드에 안내 문구를 보여준다", () => {
    render(<AdminHomeDashboard data={baseData} />);
    expect(screen.getByText("대기 중인 상담 요청이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("예정된 상담이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("승인 대기 중인 선생님이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("경고가 있는 선생님이 없습니다.")).toBeInTheDocument();
  });

  it("대기 중인 상담/학생/선생님/QC 경고를 카운트와 함께 보여준다", () => {
    const data: AdminDashboardData = {
      ...baseData,
      pendingConsults: [
        { id: "c1", personName: "김민지", email: "minji@example.com", submittedAt: "2026-08-01T00:00:00.000Z" },
      ],
      pendingStudents: [{ id: "s1", name: "지훈" }],
      pendingTeachers: [{ id: "t1", name: "이도현 선생님" }],
      qcWarnings: [{ teacherId: "t2", teacherName: "박서연 선생님", count: 2 }],
    };
    render(<AdminHomeDashboard data={data} />);
    expect(screen.getByText("상담 요청 대기 (1)")).toBeInTheDocument();
    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("학생 매칭 대기 (1)")).toBeInTheDocument();
    expect(screen.getByText("선생님 승인 대기 (1)")).toBeInTheDocument();
    expect(screen.getByText("경고 2회")).toBeInTheDocument();
  });
});
