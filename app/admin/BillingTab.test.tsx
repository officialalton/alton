import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BillingTab from "./BillingTab";
import type { StudentListItem } from "./users-data";

vi.mock("./users-actions", () => ({
  setStudentStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
}));

const students: StudentListItem[] = [
  {
    id: "s1",
    name: "지훈",
    email: "jihoon@example.com",
    grade: "10학년",
    status: "active",
    creditBalance: 14,
    parentNames: ["김민지"],
    subjectNames: ["SAT Math"],
  },
];

describe("BillingTab", () => {
  it("패키지 가격과 학생별 수업권 잔액을 보여준다", () => {
    render(<BillingTab initialStudents={students} creditHistoryByStudent={{}} />);
    expect(screen.getByText("10장")).toBeInTheDocument();
    expect(screen.getByText("지훈")).toBeInTheDocument();
    expect(screen.getByText("14장")).toBeInTheDocument();
  });

  it("학생을 클릭하면 상세(조정 UI)로 이동한다", () => {
    render(<BillingTab initialStudents={students} creditHistoryByStudent={{}} />);
    fireEvent.click(screen.getByText("지훈"));
    expect(screen.getByText("조정 적용")).toBeInTheDocument();
  });
});
