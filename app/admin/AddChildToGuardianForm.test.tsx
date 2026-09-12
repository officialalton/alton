import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-11(P4-1) — 자녀 추가 폼: 보호자 검색 → 선택 → 자녀 1명 입력 → 발송.
// UI 기준 검증: 검색 빈 상태, 후보 선택, 발송 시 guardianId만 서버로 보냄,
// 중복 이메일의 인라인 안내, 성공 시 폼 닫힘 + 목록 갱신 콜백.

const { searchMock, sendMock } = vi.hoisted(() => ({ searchMock: vi.fn(), sendMock: vi.fn() }));
vi.mock("./direct-account-actions", () => ({
  searchPrimaryGuardiansAction: searchMock,
  sendAddChildToGuardianNoticeAction: sendMock,
}));

import AddChildToGuardianForm from "./AddChildToGuardianForm";

const GUARDIAN = {
  guardianId: "g1",
  name: "김보호자",
  email: "guardian1@example.com",
  childrenNames: ["김첫째"],
};

beforeEach(() => {
  vi.clearAllMocks();
  searchMock.mockResolvedValue([GUARDIAN]);
  sendMock.mockResolvedValue({ status: "sent", linkId: "link1", sentAt: "2026-09-11T00:00:00Z", localRedeemUrl: null });
});

function openForm() {
  render(<AddChildToGuardianForm onSent={vi.fn()} />);
  fireEvent.click(screen.getByText("+ 자녀 추가"));
}

async function selectGuardian() {
  fireEvent.change(screen.getByLabelText("보호자 검색"), { target: { value: "김보호자" } });
  const candidate = await screen.findByTestId("guardian-candidate-g1");
  fireEvent.click(candidate);
}

describe("AddChildToGuardianForm", () => {
  it("검색 결과가 없으면 주 보호자만 검색된다는 빈 상태를 보여준다", async () => {
    searchMock.mockResolvedValue([]);
    openForm();
    fireEvent.change(screen.getByLabelText("보호자 검색"), { target: { value: "없는이름" } });
    expect(await screen.findByTestId("guardian-search-empty")).toHaveTextContent("주 보호자만 검색됩니다.");
  });

  it("2자 미만 입력이면 검색하지 않는다", async () => {
    openForm();
    fireEvent.change(screen.getByLabelText("보호자 검색"), { target: { value: "김" } });
    await new Promise((r) => setTimeout(r, 400));
    expect(searchMock).not.toHaveBeenCalled();
    expect(screen.getByText("2자 이상 입력해주세요.")).toBeInTheDocument();
  });

  it("보호자를 고르면 기존 자녀를 함께 보여주고, 발송은 guardianId로만 호출한다", async () => {
    openForm();
    await selectGuardian();
    expect(screen.getByText("기존 자녀: 김첫째")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("학생 이름"), { target: { value: "김둘째" } });
    fireEvent.change(screen.getByPlaceholderText("학생 이메일"), { target: { value: "child2@example.com" } });
    fireEvent.click(screen.getByText("자녀 추가 안내 발송"));

    await waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith({
        guardianId: "g1",
        student: { name: "김둘째", email: "child2@example.com", grade: undefined, subject: undefined },
      })
    );
    // 성공하면 폼이 닫힌다.
    await waitFor(() => expect(screen.getByText("+ 자녀 추가")).toBeInTheDocument());
  });

  it("보호자를 고르기 전에는 발송 버튼이 비활성이다", async () => {
    openForm();
    expect(screen.queryByText("자녀 추가 안내 발송")).toBeDisabled();
  });

  it("자녀 이메일이 중복이면 입력란 아래에 인라인으로 안내하고 폼을 닫지 않는다", async () => {
    sendMock.mockResolvedValue({
      status: "duplicate_emails",
      collisions: [{ name: "김둘째", email: "taken@example.com" }],
    });
    openForm();
    await selectGuardian();
    fireEvent.change(screen.getByPlaceholderText("학생 이름"), { target: { value: "김둘째" } });
    fireEvent.change(screen.getByPlaceholderText("학생 이메일"), { target: { value: "taken@example.com" } });
    fireEvent.click(screen.getByText("자녀 추가 안내 발송"));

    expect(await screen.findByTestId("duplicate-email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("학생 이메일")).toHaveValue("taken@example.com");

    // 이메일을 고치면 안내가 사라진다(재시도 경로).
    fireEvent.change(screen.getByPlaceholderText("학생 이메일"), { target: { value: "other@example.com" } });
    expect(screen.queryByTestId("duplicate-email")).not.toBeInTheDocument();
  });

  it("발송이 실패하면 오류 배너를 보여주고 폼을 유지한다", async () => {
    sendMock.mockResolvedValue({ status: "failed", linkId: "link1", error: "메일 발송 실패" });
    openForm();
    await selectGuardian();
    fireEvent.change(screen.getByPlaceholderText("학생 이름"), { target: { value: "김둘째" } });
    fireEvent.change(screen.getByPlaceholderText("학생 이메일"), { target: { value: "child2@example.com" } });
    fireEvent.click(screen.getByText("자녀 추가 안내 발송"));

    expect(await screen.findByText("발송 실패(관리자 조치 필요) — 메일 발송 실패")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("학생 이름")).toHaveValue("김둘째");
  });
});
