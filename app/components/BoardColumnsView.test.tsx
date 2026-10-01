import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import BoardColumnsView from "./BoardColumnsView";
import type { BoardCard } from "@/lib/board/types";

const manual = (o: Partial<BoardCard>): BoardCard => ({
  id: "m1", sourceType: "manual", sourceId: "m1", title: "수학 모의고사 1회 풀기", subtitle: null, status: "backlog",
  dueAt: null, dueStartAt: null, href: null, createdByLabel: "담당 선생님", ...o,
});

describe("BoardColumnsView 카드 상세(감사 필드)", () => {
  afterEach(cleanup);

  it("수동 할 일 상세에 생성·최종 편집(이름·날짜)을 표시한다", () => {
    render(
      <BoardColumnsView
        cards={[manual({ audit: { createdByName: "김선생", createdAt: "2026-09-20T01:30:00Z", updatedByName: "박컨설턴트", updatedAt: "2026-09-21T05:05:00Z" } })]}
      />,
    );
    const text = screen.getByTestId("board-card-audit").textContent ?? "";
    expect(text).toContain("생성: 김선생 · 2026. 09. 20. 10:30");
    expect(text).toContain("최종 편집: 박컨설턴트 · 2026. 09. 21. 14:05");
  });

  it("편집자·편집일을 모르는 기존 할 일은 '알 수 없음'으로 표시한다", () => {
    render(<BoardColumnsView cards={[manual({ audit: { createdByName: null, createdAt: "2026-09-20T01:30:00Z", updatedByName: null, updatedAt: null } })]} />);
    const text = screen.getByTestId("board-card-audit").textContent ?? "";
    expect(text).toContain("생성: 알 수 없음");
    expect(text).toContain("최종 편집: 알 수 없음 · 알 수 없음");
  });

  it("자동 카드(감사 정보 없음)에는 상세를 만들지 않는다", () => {
    render(<BoardColumnsView cards={[manual({ id: "h1", sourceType: "homework", audit: null })]} />);
    expect(screen.queryByTestId("board-card-audit")).toBeNull();
  });
});
