import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultantAgreementSection from "./ConsultantAgreementSection";
import * as actions from "./consultant-agreement-actions";
import type { ConsultantAgreementState } from "@/lib/consultant-agreements/send";

vi.mock("./consultant-agreement-actions", () => ({
  getConsultantAgreementStateAction: vi.fn(),
  saveConsultantAgreementInputsAction: vi.fn(),
  sendConsultantAgreementAction: vi.fn(),
  retryConsultantAgreementArchiveAction: vi.fn(),
}));

const state = (over: Partial<ConsultantAgreementState>): ConsultantAgreementState => ({
  status: "not_sent",
  sentAt: null,
  signedAt: null,
  archive: null,
  inputs: null,
  missing: [],
  ready: false,
  checklist: [
    { key: "workspace", label: "컨설턴트 Google 계정 등록·연결 완료", ok: true },
    { key: "payout_account", label: "수취 계좌 등록(정산 > 수취 계좌)", ok: false },
  ],
  ...over,
});

describe("ConsultantAgreementSection", () => {
  it("shows the checklist with ✓/✗ and keeps the send button disabled until everything is ready", async () => {
    vi.mocked(actions.getConsultantAgreementStateAction).mockResolvedValue({ ok: true, data: state({}) });
    render(<ConsultantAgreementSection consultantId="c1" />);
    await waitFor(() => expect(screen.getByTestId("consultant-agreement-checklist")).toBeTruthy());
    expect(screen.getByText(/✓ 컨설턴트 Google 계정/)).toBeTruthy();
    expect(screen.getByText(/✗ 수취 계좌 등록/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "계약서 발송" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("enables the send button when ready and hides the form once signed", async () => {
    vi.mocked(actions.getConsultantAgreementStateAction).mockResolvedValue({ ok: true, data: state({ ready: true }) });
    const { unmount } = render(<ConsultantAgreementSection consultantId="c1" />);
    await waitFor(() => expect((screen.getByRole("button", { name: "계약서 발송" }) as HTMLButtonElement).disabled).toBe(false));
    unmount();
    vi.mocked(actions.getConsultantAgreementStateAction).mockResolvedValue({ ok: true, data: state({ status: "signed", archive: { status: "succeeded", lastError: null, retryCount: 0 } }) });
    render(<ConsultantAgreementSection consultantId="c1" />);
    await waitFor(() => expect(screen.getByTestId("consultant-agreement-archive").textContent).toContain("완료"));
    expect(screen.queryByRole("button", { name: "계약서 발송" })).toBeNull();
  });
});
