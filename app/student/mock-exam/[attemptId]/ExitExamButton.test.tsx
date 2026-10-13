import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import ExitExamButton from "./ExitExamButton";

afterEach(() => { cleanup(); push.mockReset(); });

function renderBtn(onBeforeExit?: () => Promise<void> | void) {
  return render(<ExitExamButton consequences={<p>Answers saved.</p>} onBeforeExit={onBeforeExit} />);
}
const beforeUnload = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

describe("ExitExamButton", () => {
  it("opens an alertdialog with default focus on 'Stay in exam'", () => {
    renderBtn();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByTestId("exam-exit-open"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Answers saved.");
    expect(screen.getByTestId("exam-exit-stay")).toHaveFocus();
  });

  it("Stay closes the dialog without saving or navigating", () => {
    const save = vi.fn();
    renderBtn(save);
    fireEvent.click(screen.getByTestId("exam-exit-open"));
    fireEvent.click(screen.getByTestId("exam-exit-stay"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("Esc means stay", () => {
    renderBtn();
    fireEvent.click(screen.getByTestId("exam-exit-open"));
    fireEvent.keyDown(screen.getByTestId("exam-exit-stay"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("traps Tab focus between the two buttons", () => {
    renderBtn();
    fireEvent.click(screen.getByTestId("exam-exit-open"));
    const stay = screen.getByTestId("exam-exit-stay");
    const confirm = screen.getByTestId("exam-exit-confirm");
    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(stay).toHaveFocus();
    fireEvent.keyDown(stay, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it("Confirm saves first, then navigates to the Practice Tests list, once", async () => {
    const order: string[] = [];
    const save = vi.fn(async () => { order.push("save"); });
    push.mockImplementation(() => { order.push("push"); });
    renderBtn(save);
    fireEvent.click(screen.getByTestId("exam-exit-open"));
    await act(async () => { fireEvent.click(screen.getByTestId("exam-exit-confirm")); });
    expect(order).toEqual(["save", "push"]);
    expect(push).toHaveBeenCalledWith("/student?tab=mock-exam");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("still navigates when the save routine throws", async () => {
    renderBtn(async () => { throw new Error("offline"); });
    fireEvent.click(screen.getByTestId("exam-exit-open"));
    await act(async () => { fireEvent.click(screen.getByTestId("exam-exit-confirm")); });
    expect(push).toHaveBeenCalledWith("/student?tab=mock-exam");
  });

  it("beforeunload prompts while in the exam, not after a confirmed exit or once unmounted (submit)", async () => {
    const { unmount } = renderBtn();
    expect(beforeUnload()).toBe(true);
    fireEvent.click(screen.getByTestId("exam-exit-open"));
    await act(async () => { fireEvent.click(screen.getByTestId("exam-exit-confirm")); });
    expect(beforeUnload()).toBe(false);
    unmount();
    expect(beforeUnload()).toBe(false);
  });
});
