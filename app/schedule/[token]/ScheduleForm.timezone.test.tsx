import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.hoisted(() => vi.fn());
const redeemMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/schedule-actions", () => ({ listOpenSlotsForTokenAction: listMock, redeemSchedulingLinkAction: redeemMock }));

import ScheduleForm from "./ScheduleForm";
import { SCHEDULE_TIMEZONE_STORAGE_KEY } from "@/lib/schedule-timezone";
import { timezoneLabel } from "@/lib/timezone";
import { fmtDateTimeEn as fmtDateTime } from "@/lib/format-datetime-en";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 내일 15:00Z — 서울은 모레 00:00, LA 는 내일 07~08시(날짜가 다르다).
const d = new Date();
d.setUTCDate(d.getUTCDate() + 1);
d.setUTCHours(15, 0, 0, 0);
const SLOT = d.toISOString();
const dayIn = (tz: string) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: tz, day: "2-digit" }).format(d));


// 이 환경의 jsdom/Node 조합은 window.localStorage 가 완전한 Storage 가 아니라서 메모리 구현으로 대체한다.
function installStorage(opts: { throws?: boolean } = {}) {
  const m = new Map<string, string>();
  const boom = () => {
    throw new Error("blocked");
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: opts.throws ? boom : (k: string) => m.get(k) ?? null,
      setItem: opts.throws ? boom : (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
    },
  });
}

function mockBrowserZone(tz: string) {
  const real = Intl.DateTimeFormat;
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
    const f = new real(...args);
    if (args.length === 0) {
      const ro = f.resolvedOptions.bind(f);
      f.resolvedOptions = () => ({ ...ro(), timeZone: tz });
    }
    return f;
  } as unknown as typeof Intl.DateTimeFormat);
}

function badgeDayNumbers(): number[] {
  return screen
    .getAllByRole("button", { name: /^Day \d+/ })
    .filter((b) => b.querySelector("span.rounded-full"))
    .map((b) => Number(/Day (\d+)/.exec(b.getAttribute("aria-label") ?? b.textContent ?? "")?.[1]));
}

beforeEach(() => {
  listMock.mockReset();
  redeemMock.mockReset();
  listMock.mockResolvedValue({ ok: true, slots: [{ startsAt: SLOT }] });
  installStorage();
});
afterEach(() => vi.restoreAllMocks());

describe("ScheduleForm — 시간대 선택", () => {
  it("첫 방문은 브라우저 시간대(서울)로 바뀌고 선택기가 보인다", async () => {
    mockBrowserZone("Asia/Seoul");
    render(<ScheduleForm token="t" />);
    const select = (await screen.findByLabelText("Display timezone")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("Asia/Seoul"));
    expect(screen.getByText(`Display timezone: ${timezoneLabel("Asia/Seoul")}`)).toBeInTheDocument();
  });

  it("선택을 바꾸면 날짜 경계가 그 시간대로 다시 계산되고 localStorage 에 저장된다", async () => {
    mockBrowserZone("America/Los_Angeles");
    render(<ScheduleForm token="t" />);
    const select = (await screen.findByLabelText("Display timezone")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("America/Los_Angeles"));
    expect(badgeDayNumbers()).toContain(dayIn("America/Los_Angeles"));
    fireEvent.change(select, { target: { value: "Asia/Seoul" } });
    await waitFor(() => expect(badgeDayNumbers()).toContain(dayIn("Asia/Seoul")));
    expect(dayIn("Asia/Seoul")).not.toBe(dayIn("America/Los_Angeles"));
    expect(window.localStorage.getItem(SCHEDULE_TIMEZONE_STORAGE_KEY)).toBe("Asia/Seoul");
  });

  it("저장된 시간대가 브라우저 감지보다 우선한다", async () => {
    mockBrowserZone("Asia/Seoul");
    window.localStorage.setItem(SCHEDULE_TIMEZONE_STORAGE_KEY, "America/Chicago");
    render(<ScheduleForm token="t" />);
    const select = (await screen.findByLabelText("Display timezone")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("America/Chicago"));
  });

  it("localStorage 가 막혀도 동작한다", async () => {
    mockBrowserZone("Asia/Seoul");
    installStorage({ throws: true });
    render(<ScheduleForm token="t" />);
    const select = (await screen.findByLabelText("Display timezone")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("Asia/Seoul"));
    expect(() => fireEvent.change(select, { target: { value: "America/Denver" } })).not.toThrow();
    expect(select.value).toBe("America/Denver");
  });

  it("예약 확정 시 선택한 시간대를 redeem 에 넘기고 확정 화면도 그 시간대로 표시한다", async () => {
    mockBrowserZone("Asia/Seoul");
    redeemMock.mockResolvedValue({ ok: true });
    render(<ScheduleForm token="t" />);
    const select = (await screen.findByLabelText("Display timezone")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("Asia/Seoul"));
    fireEvent.click(badgeButton());
    fireEvent.click(await screen.findByRole("button", { name: /\b(AM|PM)\b/ }));
    fireEvent.click(screen.getByText("Confirm this time"));
    await waitFor(() => expect(screen.getByText("Your consultation is booked.")).toBeInTheDocument());
    expect(redeemMock).toHaveBeenCalledWith("t", SLOT, "Asia/Seoul");
    expect(screen.getByTestId("schedule-confirmed-time").textContent).toContain(timezoneLabel("Asia/Seoul"));
    expect(screen.getByTestId("schedule-confirmed-time").textContent).toContain(
      fmtDateTime(SLOT, { dateStyle: "full", timeStyle: "short" }, "Asia/Seoul"),
    );
  });
});

function badgeButton(): HTMLElement {
  const b = screen.getAllByRole("button", { name: /^Day \d+/ }).find((x) => x.querySelector("span.rounded-full"));
  if (!b) throw new Error("no badge");
  return b;
}

describe("ScheduleForm — hydration", () => {
  it("서버(기본 시간대) HTML 을 다른 시간대 브라우저에서 hydrate 해도 불일치가 없다", async () => {
    const html = renderToString(<ScheduleForm token="t" />);
    mockBrowserZone("Asia/Seoul");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => {
      errors.push(a);
    });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <ScheduleForm token="t" />, { onRecoverableError: (e) => errors.push(e) });
    });
    await waitFor(() => expect((container.querySelector("select") as HTMLSelectElement | null)?.value).toBe("Asia/Seoul"));
    expect(errors).toEqual([]);
    spy.mockRestore();
    act(() => root?.unmount());
    container.remove();
  });
});
