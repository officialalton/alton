import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ConsentGapPanel from "./ConsentGapPanel";
import { invalidateConsentCaches } from "./consent-cache";
import { listConsentGapsAction, listCompletedConsentsAction } from "./consent-actions";
import {
  setActiveAdminUser,
  clearAdminTabCache,
  getCachedTabData,
  setCachedTabData,
} from "./tab-data-cache";

vi.mock("./consent-actions", () => ({
  listConsentGapsAction: vi.fn(),
  listCompletedConsentsAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // 캐시는 모듈 상태라 테스트 사이에 남는다 — 케이스마다 비우고 시작한다.
  clearAdminTabCache();
  setActiveAdminUser("admin-1");
  (listConsentGapsAction as ReturnType<typeof vi.fn>).mockResolvedValue([
    { childId: "s1", childName: "지훈", hasDob: false, hasActiveConsent: false },
  ]);
  (listCompletedConsentsAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("ConsentGapPanel", () => {
  it("대기·완료를 각각 불러와 보여준다", async () => {
    render(<ConsentGapPanel />);
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    expect(listConsentGapsAction).toHaveBeenCalled();
    expect(listCompletedConsentsAction).toHaveBeenCalled();
  });

  it("불러오지 못하면 사유를 보여준다", async () => {
    (listConsentGapsAction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("관리자만 사용할 수 있습니다.")
    );
    render(<ConsentGapPanel />);
    await waitFor(() =>
      expect(screen.getByText("관리자만 사용할 수 있습니다.")).toBeInTheDocument()
    );
  });

  it("새로고침하면 캐시를 버리고 다시 읽는다(이전 상태가 계속 보이지 않는다)", async () => {
    render(<ConsentGapPanel />);
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    const firstCallCount = (listConsentGapsAction as ReturnType<typeof vi.fn>).mock.calls.length;

    (listConsentGapsAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    fireEvent.click(screen.getByText("새로고침"));

    await waitFor(() =>
      expect((listConsentGapsAction as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        firstCallCount
      )
    );
    await waitFor(() => expect(screen.queryByText("지훈")).not.toBeInTheDocument());
  });
});

describe("invalidateConsentCaches", () => {
  it("두 탭이 공유하는 캐시를 함께 버린다", () => {
    setActiveAdminUser("admin-1");
    setCachedTabData("consent-gaps", [{ childId: "s1" }]);
    setCachedTabData("consent-completed", [{ childId: "s2" }]);
    expect(getCachedTabData("consent-gaps")).not.toBeNull();

    invalidateConsentCaches();

    expect(getCachedTabData("consent-gaps")).toBeNull();
    expect(getCachedTabData("consent-completed")).toBeNull();
  });
});

// 실제 운영 흐름 — 보호자가 앱 밖에서 동의를 마친 뒤 관리자가 동의서 탭으로
// 돌아온다. 이때 TTL이 남아 있어도 이전 상태를 보여주면 안 된다.
describe("보호자가 동의를 마친 뒤 관리자가 탭으로 돌아오는 흐름", () => {
  it("탭에 다시 들어오면 TTL과 무관하게 최신 상태를 읽는다", async () => {
    const first = render(<ConsentGapPanel />);
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    expect(listConsentGapsAction).toHaveBeenCalledTimes(1);
    first.unmount();

    // 그 사이 보호자가 동의를 마쳤다 — 서버는 이제 빈 목록을 준다.
    (listConsentGapsAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // TTL(30초)이 한참 남은 시점에 바로 다시 들어온다.
    const again = render(<ConsentGapPanel />);
    await waitFor(() => expect(listConsentGapsAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(again.queryByText("지훈")).not.toBeInTheDocument());
  });

  it("다시 읽는 동안에도 화면이 비지 않는다(직전 데이터를 보여준다)", async () => {
    const first = render(<ConsentGapPanel />);
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    first.unmount();

    let resolveFetch: (v: unknown[]) => void = () => {};
    (listConsentGapsAction as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => (resolveFetch = r as (v: unknown[]) => void))
    );

    const again = render(<ConsentGapPanel />);
    // 응답이 오기 전에도 캐시에 있던 직전 데이터가 보인다.
    expect(again.getByText("지훈")).toBeInTheDocument();
    resolveFetch([]);
    await waitFor(() => expect(again.queryByText("지훈")).not.toBeInTheDocument());
  });
});
