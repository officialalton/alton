import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SetPasswordPage from "./page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const setSessionMock = vi.fn();
const updateUserMock = vi.fn();
const verifyOtpMock = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      setSession: setSessionMock,
      updateUser: updateUserMock,
      verifyOtp: verifyOtpMock,
    },
  }),
}));

function fillAndSubmit(password = "password123") {
  fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: password } });
  fireEvent.click(screen.getByLabelText(/이용약관/));
  fireEvent.click(screen.getByText("비밀번호 설정하고 계속하기"));
}

describe("SetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSessionMock.mockResolvedValue({ error: null });
    updateUserMock.mockResolvedValue({ error: null });
    verifyOtpMock.mockResolvedValue({ error: null });
    window.location.hash = "";
    window.location.search = "";
  });

  it("URL에 role=parent가 있으면 추천인 코드 입력을 보여준다", () => {
    Object.defineProperty(window, "location", {
      value: { hash: "", search: "?role=parent" },
      writable: true,
    });
    render(<SetPasswordPage />);
    expect(screen.getByLabelText(/추천인 코드/)).toBeInTheDocument();
  });

  it("role 파라미터가 없으면(예: 비밀번호 재설정 링크) 추천인 코드 입력을 숨긴다", () => {
    Object.defineProperty(window, "location", {
      value: { hash: "", search: "" },
      writable: true,
    });
    render(<SetPasswordPage />);
    expect(screen.queryByLabelText(/추천인 코드/)).not.toBeInTheDocument();
  });

  it("URL 해시에 토큰이 있으면 updateUser 전에 그 세션을 명시적으로 적용한다", async () => {
    window.location.hash = "#access_token=tok-a&refresh_token=ref-a&type=invite";
    render(<SetPasswordPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(setSessionMock).toHaveBeenCalledWith({
        access_token: "tok-a",
        refresh_token: "ref-a",
      });
    });
    expect(updateUserMock).toHaveBeenCalledWith({ password: "password123" });
    // setSession이 updateUser보다 먼저 호출돼야 브라우저에 남아있던 다른 계정
    // 세션이 아니라 초대받은 계정 세션에 비밀번호가 적용된다.
    const setSessionOrder = setSessionMock.mock.invocationCallOrder[0];
    const updateUserOrder = updateUserMock.mock.invocationCallOrder[0];
    expect(setSessionOrder).toBeLessThan(updateUserOrder);
  });

  it("세션 적용이 실패하면 updateUser를 호출하지 않고 에러를 보여준다", async () => {
    window.location.hash = "#access_token=tok-a&refresh_token=ref-a&type=invite";
    setSessionMock.mockResolvedValue({ error: { message: "세션 오류" } });
    render(<SetPasswordPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText("세션 오류")).toBeInTheDocument();
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("해시에도 쿼리에도 토큰이 없으면 updateUser를 호출하지 않고 에러를 보여준다", async () => {
    // 다른 계정(예: 같은 컴퓨터를 쓰는 부모/학생)이 이미 로그인된 브라우저에서
    // 토큰 없이 이 페이지에 도달했을 때, 그 계정의 비밀번호를 엉뚱하게 바꿔버리면
    // 안 된다 — 반드시 명시적으로 실패해야 한다.
    render(<SetPasswordPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/링크가 만료되었거나 유효하지 않아요/)).toBeInTheDocument();
    });
    expect(setSessionMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("쿼리에 token_hash와 type이 있으면 updateUser 전에 verifyOtp로 세션을 생성한다", async () => {
    Object.defineProperty(window, "location", {
      value: { hash: "", search: "?token_hash=hash-a&type=invite" },
      writable: true,
    });
    render(<SetPasswordPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(verifyOtpMock).toHaveBeenCalledWith({ type: "invite", token_hash: "hash-a" });
    });
    expect(updateUserMock).toHaveBeenCalledWith({ password: "password123" });
    const verifyOtpOrder = verifyOtpMock.mock.invocationCallOrder[0];
    const updateUserOrder = updateUserMock.mock.invocationCallOrder[0];
    expect(verifyOtpOrder).toBeLessThan(updateUserOrder);
  });

  it("verifyOtp가 실패하면 updateUser를 호출하지 않고 에러를 보여준다", async () => {
    Object.defineProperty(window, "location", {
      value: { hash: "", search: "?token_hash=hash-a&type=invite" },
      writable: true,
    });
    verifyOtpMock.mockResolvedValue({ error: { message: "OTP 오류" } });
    render(<SetPasswordPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/링크가 만료되었거나 이미 사용됐어요/)).toBeInTheDocument();
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("비밀번호 설정에 성공하면 /post-auth로 이동한다", async () => {
    window.location.hash = "#access_token=tok-a&refresh_token=ref-a&type=invite";
    render(<SetPasswordPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/post-auth");
    });
  });
});
