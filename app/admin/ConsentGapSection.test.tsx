import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConsentGapSection from "./ConsentGapSection";

// P4-3 1단계 — `신규 > 보호자 동의 대기`에서 `문서 > 동의서`로 옮기며 컴포넌트를
// 꺼냈다. 표시 동작은 그대로여야 하므로 기존 케이스를 여기로 옮겨 고정한다.
const gaps = [
  { childId: "s1", childName: "지훈", hasDob: false, hasActiveConsent: false },
];
const completed = [{ childId: "s2", childName: "이서아" }];

describe("ConsentGapSection", () => {
  it("대기 목록이 기본으로 보이고, 완료 탭을 누르면 완료 목록을 보여준다", () => {
    render(<ConsentGapSection gaps={gaps} completed={completed} />);
    expect(screen.getByText("지훈")).toBeInTheDocument();
    expect(screen.queryByText("이서아")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("완료 (1)"));
    expect(screen.getByText("이서아")).toBeInTheDocument();
    expect(screen.queryByText("지훈")).not.toBeInTheDocument();
  });

  it("막힌 사유를 사람이 읽는 말로 보여준다", () => {
    render(<ConsentGapSection gaps={gaps} completed={completed} />);
    // 두 사유가 한 줄에 함께 렌더된다(상위 컨테이너도 같은 글자를 포함하므로
    // 가장 안쪽 줄 하나만 골라 본다).
    const line = screen
      .getAllByText((_, el) => {
        const text = el?.textContent ?? "";
        return (
          text.includes("생년월일 미입력") &&
          text.includes("유효한 보호자 동의 없음") &&
          !Array.from(el?.children ?? []).some((c) =>
            (c.textContent ?? "").includes("생년월일 미입력")
          )
        );
      })
      .at(-1);
    expect(line).toBeTruthy();
  });

  it("대기·완료가 모두 비어도 각각 안내 문구를 보여준다", () => {
    render(<ConsentGapSection gaps={[]} completed={[]} />);
    expect(screen.getByText("막혀 있는 학생이 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("완료 (0)"));
    expect(screen.getByText("완료된 동의가 없습니다.")).toBeInTheDocument();
  });
});
