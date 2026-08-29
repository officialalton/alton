import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DevLogTab from "./DevLogTab";

describe("DevLogTab", () => {
  it("완료 항목과 남은 항목을 구분해서 보여준다", () => {
    const content = "## Phase 1\n- [x] 완료된 티켓\n- [ ] 진행 예정 티켓\n";
    render(<DevLogTab content={content} />);

    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.getByText("완료된 티켓")).toBeInTheDocument();
    expect(screen.getByText("진행 예정 티켓")).toBeInTheDocument();
  });
});
