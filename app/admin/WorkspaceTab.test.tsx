import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceTab from "./WorkspaceTab";
import type { WorkspaceProvisioningItem } from "./workspace-data";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const startMock = vi.fn();
const suspendMock = vi.fn();
const reactivateMock = vi.fn();
const checklistMock = vi.fn();
vi.mock("./workspace-actions", () => ({
  startTeacherWorkspaceProvisioning: (...args: unknown[]) => startMock(...args),
  suspendTeacher: (...args: unknown[]) => suspendMock(...args),
  reactivateTeacher: (...args: unknown[]) => reactivateMock(...args),
  getTeacherActivationChecklist: (...args: unknown[]) => checklistMock(...args),
}));

const items: WorkspaceProvisioningItem[] = [
  {
    id: "prov1",
    workspaceEmail: "newteacher@alton.education",
    personalContactEmail: "personal@example.com",
    status: "linked",
    linkedTeacherId: "teacher1",
    linkedTeacherName: "김새로운",
    createdAt: "2026-08-01T00:00:00Z",
    workspaceCreatedAt: "2026-08-01T01:00:00Z",
    firstLoginAt: "2026-08-02T00:00:00Z",
    linkedAt: "2026-08-02T00:00:00Z",
  },
];

describe("WorkspaceTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("프로비저닝이 없으면 안내 문구를 보여준다", () => {
    render(<WorkspaceTab provisionings={[]} />);
    expect(screen.getByText("진행 중인 프로비저닝이 없습니다.")).toBeInTheDocument();
  });

  it("연결된 선생님 행에 체크리스트 확인/중단/복귀 버튼을 보여준다", () => {
    render(<WorkspaceTab provisionings={items} />);
    expect(screen.getByText("newteacher@alton.education")).toBeInTheDocument();
    expect(screen.getByText("연결된 선생님: 김새로운")).toBeInTheDocument();
    expect(screen.getByText("활성화 선행조건 확인")).toBeInTheDocument();
    expect(screen.getByText("중단(inactive)")).toBeInTheDocument();
    expect(screen.getByText("복귀(active)")).toBeInTheDocument();
  });

  it("체크리스트 확인 버튼을 누르면 조건별 상태를 보여준다", async () => {
    checklistMock.mockResolvedValue({
      ok: true,
      data: [
        { condition: "workspace_issued", satisfied: true, evidence_at: "2026-08-01T00:00:00Z" },
        { condition: "valid_rate", satisfied: false, evidence_at: null },
      ],
    });
    render(<WorkspaceTab provisionings={items} />);
    fireEvent.click(screen.getByText("활성화 선행조건 확인"));

    await waitFor(() => {
      expect(screen.getByText(/Workspace 계정 발급/)).toBeInTheDocument();
      expect(screen.getByText(/유효한 현재 시급 이력/)).toBeInTheDocument();
    });
    expect(checklistMock).toHaveBeenCalledWith("teacher1");
  });

  it("프로비저닝 시작 폼 제출 시 필수 필드로 startTeacherWorkspaceProvisioning을 호출한다", async () => {
    startMock.mockResolvedValue({ ok: true });
    render(<WorkspaceTab provisionings={[]} />);

    fireEvent.change(screen.getByPlaceholderText("workspace_email (xxx@alton.education)"), {
      target: { value: "another@alton.education" },
    });
    fireEvent.change(screen.getByPlaceholderText("personal_contact_email"), {
      target: { value: "another@personal.example" },
    });
    fireEvent.click(screen.getByText("프로비저닝 시작"));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceEmail: "another@alton.education",
          personalContactEmail: "another@personal.example",
          workspaceRecoveryEmail: "another@personal.example",
        })
      );
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("startTeacherWorkspaceProvisioning이 실패를 반환하면 화면에 실제 오류 메시지를 보여주고 새로고침하지 않는다", async () => {
    startMock.mockResolvedValue({
      ok: false,
      error: "이미 진행 중이거나 완료된 프로비저닝입니다(상태: first_login_pending).",
    });
    render(<WorkspaceTab provisionings={[]} />);

    fireEvent.change(screen.getByPlaceholderText("workspace_email (xxx@alton.education)"), {
      target: { value: "teacher-provisioning-test@alton.education" },
    });
    fireEvent.change(screen.getByPlaceholderText("personal_contact_email"), {
      target: { value: "matchbox512@gmail.com" },
    });
    fireEvent.click(screen.getByText("프로비저닝 시작"));

    await waitFor(() => {
      expect(
        screen.getByText("이미 진행 중이거나 완료된 프로비저닝입니다(상태: first_login_pending).")
      ).toBeInTheDocument();
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
