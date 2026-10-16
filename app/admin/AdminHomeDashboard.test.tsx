import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    render(<AdminHomeDashboard data={baseData} onNavigate={vi.fn()} />);
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
    render(<AdminHomeDashboard data={data} onNavigate={vi.fn()} />);
    expect(screen.getByText("상담 요청 대기 (1)")).toBeInTheDocument();
    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("학생 매칭 대기 (1)")).toBeInTheDocument();
    expect(screen.getByText("선생님 승인 대기 (1)")).toBeInTheDocument();
    expect(screen.getByText("경고 2회")).toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 정리 1차): 카드를 누르면 실제 구현된 관리 탭으로 이동한다", () => {
    const data: AdminDashboardData = {
      ...baseData,
      pendingConsults: [
        { id: "c1", personName: "김민지", email: "minji@example.com", submittedAt: "2026-08-01T00:00:00.000Z" },
      ],
      pendingStudents: [{ id: "s1", name: "지훈" }],
      pendingTeachers: [{ id: "t1", name: "이도현 선생님" }],
    };
    const onNavigate = vi.fn();
    render(<AdminHomeDashboard data={data} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("상담 요청 대기 (1)"));
    expect(onNavigate).toHaveBeenCalledWith("consult");

    fireEvent.click(screen.getByText("선생님 승인 대기 (1)"));
    expect(onNavigate).toHaveBeenCalledWith("users");

    fireEvent.click(screen.getByText("학생 매칭 대기 (1)"));
    expect(onNavigate).toHaveBeenCalledWith("matching");
  });

  it("2026-09-10(UI/UX 정리 1차): 카드는 대기 건수가 많은 순으로 정렬된다", () => {
    const data: AdminDashboardData = {
      ...baseData,
      pendingConsults: [
        { id: "c1", personName: "김민지", email: "minji@example.com", submittedAt: "2026-08-01T00:00:00.000Z" },
      ],
      pendingTeachers: [
        { id: "t1", name: "이도현 선생님" },
        { id: "t2", name: "박서연 선생님" },
      ],
    };
    render(<AdminHomeDashboard data={data} onNavigate={vi.fn()} />);
    const titles = screen.getAllByRole("heading", { level: 2 }).map((el) => el.textContent);
    expect(titles[0]).toBe("선생님 승인 대기 (2)");
    expect(titles[1]).toBe("상담 요청 대기 (1)");
  });
});
