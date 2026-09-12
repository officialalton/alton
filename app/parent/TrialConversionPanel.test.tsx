import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TrialConversionPanel from "./TrialConversionPanel";
import { confirmRegularProgressIntent, hasConfirmedRegularProgressIntent } from "./trial-conversion-actions";
import type { SubjectEnrollmentView } from "@/app/student/enrollment-data";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("./trial-conversion-actions", () => ({
  confirmRegularProgressIntent: vi.fn(),
  hasConfirmedRegularProgressIntent: vi.fn(),
}));

const enrollment = { id: "se1", subjectName: "SAT Math" } as SubjectEnrollmentView;

describe("TrialConversionPanel (2026-09-10, P0-5 — 체험 리뷰 확정 게이트 제거)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hasConfirmedRegularProgressIntent as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  });

  it("체험 리뷰 상태와 무관하게 정규 진행 희망 버튼을 바로 보여준다(리뷰 미작성 상태 포함)", async () => {
    render(<TrialConversionPanel enrollments={[enrollment]} />);
    expect(await screen.findByRole("button", { name: "정규 진행 희망합니다" })).toBeInTheDocument();
    expect(screen.getByText(/계약 체결이나 결제가 아니며/)).toBeInTheDocument();
  });

  it("정규 진행 희망 클릭 후에는 접수 완료 안내로 바뀌고 중복 클릭이 불가능하다", async () => {
    (confirmRegularProgressIntent as ReturnType<typeof vi.fn>).mockResolvedValue({ selectionId: "sel1" });

    render(<TrialConversionPanel enrollments={[enrollment]} />);
    const button = await screen.findByRole("button", { name: "정규 진행 희망합니다" });
    fireEvent.click(button);

    await screen.findByText(/접수 완료/);
    expect(screen.queryByRole("button", { name: "정규 진행 희망합니다" })).toBeNull();
    expect(confirmRegularProgressIntent).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalled();
  });

  it("이미 접수된 상태라면(예: 새로고침 후) 클릭 없이도 바로 '접수 완료'를 보여준다 — 버튼이 다시 나타나 중복 클릭을 유도하지 않는다", async () => {
    (hasConfirmedRegularProgressIntent as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    render(<TrialConversionPanel enrollments={[enrollment]} />);

    await screen.findByText(/접수 완료/);
    expect(screen.queryByRole("button", { name: "정규 진행 희망합니다" })).toBeNull();
    expect(confirmRegularProgressIntent).not.toHaveBeenCalled();
  });

  it("focusSubjectEnrollmentId가 일치하는 항목만 강조 표시(scroll target) 클래스를 받는다", async () => {
    const other = { id: "se2", subjectName: "AP Physics" } as SubjectEnrollmentView;
    render(<TrialConversionPanel enrollments={[enrollment, other]} focusSubjectEnrollmentId="se2" />);

    await waitFor(() => expect(hasConfirmedRegularProgressIntent).toHaveBeenCalledTimes(2));

    const focusedRow = await screen.findByTestId("regular-intent-row-se2");
    const unfocusedRow = await screen.findByTestId("regular-intent-row-se1");
    expect(focusedRow.className).toContain("ring-2");
    expect(unfocusedRow.className).not.toContain("ring-2");
  });
});
