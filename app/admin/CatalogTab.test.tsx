import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CatalogTab from "./CatalogTab";
import type { AdminSubject } from "./subject-data";

const subjects: AdminSubject[] = [
  { subjectId: "sub1", subjectName: "SAT Math", units: [] },
];

describe("CatalogTab", () => {
  it("기본 서브탭은 과목 템플릿이다", () => {
    render(<CatalogTab subjects={subjects} />);
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
  });

  it("다른 서브탭을 누르면 준비 중 문구를 보여준다", () => {
    render(<CatalogTab subjects={subjects} />);
    fireEvent.click(screen.getByText("교재 문서"));
    expect(screen.getByText("교재 문서 탭은 준비 중입니다.")).toBeInTheDocument();
  });
});
