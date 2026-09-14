import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UnitPreviewView from "./UnitPreviewView";
import type { UnitPreview } from "@/app/student/curriculum-overlay-actions";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

function makePreview(over: Partial<UnitPreview> = {}): UnitPreview {
  return {
    unitId: "u1",
    unitTitle: "Speaking",
    goal: "말하기 유형을 구분한다",
    frozen: false,
    sessionId: null,
    materials: [
      {
        curriculumDocId: "d1",
        title: "Speaking 2",
        versionId: "v1",
        sections: [{ id: "s1", title: "새 섹션", body: "본문입니다" }],
      },
    ],
    problems: [
      { problemId: "p1", versionId: "pv1", format: "mc", passage: "지문 A", options: ["가", "나"] },
    ],
    ...over,
  };
}

describe("학생 회차 수업 준비 화면", () => {
  it("교재 탭이 기본이고, 문제 탭으로 바꾸면 지문·선택지만 보인다 — 정답 표시는 없다", () => {
    render(
      <UnitPreviewView preview={makePreview()} subjectName="SAT Reading" studentName={null} backHref="/student" />
    );
    expect(screen.getByText("Speaking")).toBeInTheDocument();
    expect(screen.getByText("수업 전")).toBeInTheDocument();
    expect(screen.getByText("말하기 유형을 구분한다")).toBeInTheDocument();
    expect(screen.getByText("본문입니다")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "문제" }));
    expect(screen.getByText("지문 A")).toBeInTheDocument();
    expect(screen.getByText("가")).toBeInTheDocument();
    expect(screen.queryByText("정답")).not.toBeInTheDocument();
    expect(screen.queryByText(/풀이판/)).not.toBeInTheDocument();
    expect(screen.getByText(/풀이와 제출은 수업에서 합니다/)).toBeInTheDocument();
  });

  it("예약된 수업이 있으면 그 수업으로 가는 길을 함께 보여준다", () => {
    render(
      <UnitPreviewView
        preview={makePreview({ sessionId: "s9" })}
        subjectName={null}
        studentName={null}
        backHref="/student"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "예약된 수업 →" }));
    expect(push).toHaveBeenCalledWith("/session/s9");
  });

  it("보호자가 보면 누구의 회차인지 머리말에 적는다", () => {
    render(
      <UnitPreviewView
        preview={makePreview()}
        subjectName="SAT Reading"
        studentName="지훈"
        backHref="/parent"
      />
    );
    expect(screen.getByText("지훈 학생 · SAT Reading")).toBeInTheDocument();
  });

  it("아직 담긴 것이 없으면 빈 상태를 말한다", () => {
    render(
      <UnitPreviewView
        preview={makePreview({ materials: [], problems: [] })}
        subjectName={null}
        studentName={null}
        backHref="/student"
        initialTab="problems"
      />
    );
    expect(screen.getByText("아직 준비된 문제가 없습니다")).toBeInTheDocument();
  });
});
