import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AdminAccountsTab from "./AdminAccountsTab";
import { setAdminTierAction, setAdminCapabilitiesAction } from "./admin-accounts-actions";
import type { AdminAccount } from "./admin-accounts-data";

vi.mock("./admin-accounts-actions", () => ({
  setAdminTierAction: vi.fn(),
  setAdminCapabilitiesAction: vi.fn(),
}));

const accounts: AdminAccount[] = [
  { id: "master1", name: "김대표", email: "official@alton.education", tier: "master", capabilities: [] },
  { id: "admin1", name: "박운영", email: "ops@alton.education", tier: "full", capabilities: [] },
  { id: "admin2", name: "이보조", email: "assist@alton.education", tier: "supervisor", capabilities: ["매칭권한"] },
];

describe("AdminAccountsTab — 관리자 계정 구조(2026-09-22 시작)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (setAdminTierAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (setAdminCapabilitiesAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("마스터 계정에는 등급 변경 버튼이 없다", () => {
    render(<AdminAccountsTab initialAccounts={accounts} />);
    expect(screen.getByText("김대표")).toBeInTheDocument();
    expect(screen.getByText("마스터")).toBeInTheDocument();
  });

  it("전체 관리자를 중간 관리자로 바꾸면 setAdminTierAction이 호출되고 capability 선택지가 나타난다", async () => {
    render(<AdminAccountsTab initialAccounts={accounts} />);
    const opsCard = screen.getByTestId("admin-account-admin1");
    fireEvent.click(within(opsCard).getByText("중간 관리자(제한)"));
    await waitFor(() => expect(setAdminTierAction).toHaveBeenCalledWith("admin1", "supervisor"));
    expect(await within(opsCard).findByText("상담·체험수업 관리")).toBeInTheDocument();
  });

  it("중간 관리자의 capability 버튼을 누르면 setAdminCapabilitiesAction이 새 목록으로 호출된다", async () => {
    render(<AdminAccountsTab initialAccounts={accounts} />);
    const assistCard = screen.getByTestId("admin-account-admin2");
    fireEvent.click(within(assistCard).getByText("결제·수강권 관리"));
    await waitFor(() =>
      expect(setAdminCapabilitiesAction).toHaveBeenCalledWith("admin2", expect.arrayContaining(["매칭권한", "manage_payments"]))
    );
  });

  it("액션이 실패하면 에러 문구를 보여주고 상태를 되돌린다", async () => {
    (setAdminTierAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("마스터 관리자만 사용할 수 있습니다."));
    render(<AdminAccountsTab initialAccounts={accounts} />);
    const opsCard = screen.getByTestId("admin-account-admin1");
    fireEvent.click(within(opsCard).getByText("중간 관리자(제한)"));
    expect(await screen.findByText("마스터 관리자만 사용할 수 있습니다.")).toBeInTheDocument();
  });
});
