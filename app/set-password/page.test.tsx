import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SetPasswordPage from "./page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const setSessionMock = vi.fn();
const updateUserMock = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      setSession: setSessionMock,
      updateUser: updateUserMock,
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
    window.location.hash = "";
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

  it("해시에 토큰이 없으면 setSession 없이 바로 updateUser를 호출한다", async () => {
    render(<SetPasswordPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ password: "password123" });
    });
    expect(setSessionMock).not.toHaveBeenCalled();
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
