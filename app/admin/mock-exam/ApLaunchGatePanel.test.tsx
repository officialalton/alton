// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const status = vi.fn();
vi.mock("../ap-stock-actions", () => ({ apLaunchGateStatusAction: () => status() }));
import ApLaunchGatePanel from "./ApLaunchGatePanel";

const rep = {
  sets: [
    { id: "A", name: "AP Calculus AB — Practice Exam", status: "published", label: "full_practice", versionNo: 2, itemCount: 48, readyCount: 48, blockedCount: 0, openBlockers: 0, openDefectReports: 0, openErrorReports: 0, ready: true, verdict: "출시 게이트 통과 가능", blocked: [] },
    { id: "B", name: "AP Calculus BC — Practice Exam", status: "draft", label: "full_practice", versionNo: 1, itemCount: 48, readyCount: 47, blockedCount: 1, openBlockers: 1, openDefectReports: 0, openErrorReports: 2, ready: false, verdict: "출시 차단 — 문항 1건 미충족", blocked: [{ section: "ap_mc_a", position: 3, candidateKey: "k-bad", reasons: ["미해결 launch 차단 결함 1건(오답 키)"] }] },
  ],
  totals: { sets: 2, readySets: 1, blockedItems: 1, openBlockers: 1, openDefectReports: 0, openErrorReports: 2, globalOpenBlockers: 1 },
};
beforeEach(() => { status.mockReset(); });
afterEach(cleanup);

describe("ApLaunchGatePanel", () => {
  it("세트별 판정과 차단 문항 사유를 보여 준다", async () => {
    status.mockResolvedValue(rep);
    render(<ApLaunchGatePanel />);
    expect(screen.getByText("불러오는 중...", { selector: "p" })).toBeTruthy();
    expect((await screen.findByTestId("ap-launch-gate-totals")).textContent).toContain("출시 게이트 통과 가능 1개");
    expect(screen.getByText("출시 게이트 통과 가능", { selector: "td" })).toBeTruthy();
    expect(screen.getByText("출시 차단 — 문항 1건 미충족")).toBeTruthy();
    expect(screen.getByTestId("ap-launch-blocked-B").textContent).toContain("k-bad");
    expect(screen.getByTestId("ap-launch-blocked-B").textContent).toContain("오답 키");
    expect(screen.queryByTestId("ap-launch-blocked-A")).toBeNull();
  });
  it("세트 없음 빈 상태", async () => {
    status.mockResolvedValue({ sets: [], totals: { ...rep.totals, sets: 0 } });
    render(<ApLaunchGatePanel />);
    expect(await screen.findByText("비보관 AP 세트가 없습니다.")).toBeTruthy();
  });
  it("오류 상태", async () => {
    status.mockRejectedValue(new Error("x"));
    render(<ApLaunchGatePanel />);
    expect((await screen.findByRole("alert")).textContent).toContain("불러오지 못했습니다");
  });
});
