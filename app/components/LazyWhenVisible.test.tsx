import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import LazyWhenVisible from "./LazyWhenVisible";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LazyWhenVisible", () => {
  it("eager 는 바로 그린다", () => {
    render(<LazyWhenVisible eager><p>본문</p></LazyWhenVisible>);
    expect(screen.getByText("본문")).toBeTruthy();
  });

  it("IntersectionObserver 가 없는 환경은 즉시 그린다(내용이 영영 안 보이지 않게)", () => {
    render(<LazyWhenVisible><p>본문</p></LazyWhenVisible>);
    expect(screen.getByText("본문")).toBeTruthy();
  });

  it("화면 근처에 오기 전에는 자리표시만, 들어오면 한 번 그리고 계속 유지한다", () => {
    let cb: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(c: IntersectionObserverCallback) {
          cb = c;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    render(<LazyWhenVisible><p>본문</p></LazyWhenVisible>);
    expect(screen.queryByText("본문")).toBeNull();
    expect(screen.getByTestId("lazy-placeholder")).toBeTruthy();
    act(() => cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText("본문")).toBeTruthy();
    expect(screen.queryByTestId("lazy-placeholder")).toBeNull();
  });
});
