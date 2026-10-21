import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MockExamResultView from "./MockExamResultView";
import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";

describe("MockExamResultView AP guard", () => {
  it("shows a clear message instead of crashing on AP data", () => {
    const ap = { id: "x", examProgram: "ap", items: [], sections: undefined } as unknown as MockExamAttemptDetail;
    render(<MockExamResultView attempt={ap} readOnly reportRole={null} />);
    expect(screen.getByRole("alert").textContent).toMatch(/AP attempt/);
  });
});
