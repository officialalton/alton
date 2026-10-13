// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const overview = vi.fn();
const step = vi.fn();
const check = vi.fn();
const partial = vi.fn();
vi.mock("../ap-stock-actions", () => ({
  getApStockOverviewAction: () => overview(),
  apStockStepAction: (i: unknown) => step(i),
  apStockLoadCheckAction: () => check(),
  apStockAssembleAction: vi.fn(),
  apStockAssemblePartialAction: (i: unknown) => partial(i),
}));
vi.mock("../ap-new-version-actions", () => ({
  getApNewVersionOverviewAction: () => Promise.resolve({ target: { ref: "x", kind: "remote", canWrite: true, reason: null }, sets: [], plans: [] }),
  apNewVersionPreviewAction: vi.fn(), apNewVersionDraftAction: vi.fn(), apNewVersionPublishAction: vi.fn(), apSetAccessTierAction: vi.fn(),
}));
import ApStockPanel from "./ApStockPanel";

const ov = (canWrite: boolean) => ({
  target: { ref: "worpsqwqgnspddnrtnvq", kind: "remote", canWrite, reason: canWrite ? null : "허용 목록에 없어 쓰기를 거부합니다." },
  batches: [{ id: "graph-s1", title: "그래프 배치 s1", hasLoadStep: true, artifactsOk: true }],
  assignments: [], history: [],
});
const res = (o: Record<string, unknown> = {}) => ({ action: "render_verify", mode: "dry_run", executed: false, target: { ref: "x", kind: "remote", canWrite: true, reason: null }, scope: {}, counts: { toRecord: 3 }, lines: ["건너뜀 k1: 해시 불일치"], planHash: "h1", blocked: null, ok: true, ...o });

beforeEach(() => { overview.mockReset(); step.mockReset(); check.mockReset(); partial.mockReset(); });
afterEach(cleanup);

describe("ApStockPanel", () => {
  it("로딩 후 연결된 프로젝트와 쓰기 허용 여부를 보여준다", async () => {
    overview.mockResolvedValue(ov(true));
    render(<ApStockPanel />);
    expect(screen.getByText("불러오는 중...")).toBeTruthy();
    expect(await screen.findByTestId("ap-stock-target")).toHaveProperty("textContent", expect.stringContaining("worpsqwqgnspddnrtnvq"));
    expect(screen.getByTestId("ap-stock-target").textContent).toContain("쓰기 허용");
    expect(screen.getByText("작업 이력이 없습니다.")).toBeTruthy();
  });
  it("오류 상태", async () => {
    overview.mockRejectedValue(new Error("x"));
    render(<ApStockPanel />);
    expect(await screen.findByText("AP 재고 관리 정보를 불러오지 못했습니다.")).toBeTruthy();
  });
  it("쓰기 차단 대상이면 사유를 보이고 실행 버튼이 항상 비활성", async () => {
    overview.mockResolvedValue(ov(false)); step.mockResolvedValue(res());
    render(<ApStockPanel />);
    expect((await screen.findByTestId("ap-stock-target-reason")).textContent).toContain("허용 목록");
    const card = screen.getByTestId("ap-step-render");
    fireEvent.click(card.querySelectorAll("button")[0]);
    await waitFor(() => expect(screen.getAllByTestId("ap-stock-result").length).toBeGreaterThan(0));
    fireEvent.click(card.querySelector("input[type=checkbox]")!);
    expect((card.querySelectorAll("button")[1] as HTMLButtonElement).disabled).toBe(true);
  });
  it("미리보기 → 확인 체크 → 실행: 같은 해시로 실행 요청, 확인 전에는 비활성", async () => {
    overview.mockResolvedValue(ov(true));
    step.mockImplementation(async (i: { execute: boolean }) => (i.execute ? res({ mode: "execute", executed: true, counts: { recordedNow: 3 } }) : res()));
    render(<ApStockPanel />);
    const card = await screen.findByTestId("ap-step-render");
    const [previewBtn, runBtn] = Array.from(card.querySelectorAll("button")) as HTMLButtonElement[];
    expect(runBtn.disabled).toBe(true);
    fireEvent.click(previewBtn);
    await waitFor(() => expect(card.textContent).toContain("미리보기"));
    expect(runBtn.disabled).toBe(true); // 확인 체크 전
    fireEvent.click(card.querySelector("input[type=checkbox]")!);
    expect(runBtn.disabled).toBe(false);
    fireEvent.click(runBtn);
    await waitFor(() => expect(step).toHaveBeenCalledTimes(2));
    expect(step.mock.calls[1][0]).toMatchObject({ step: "render", batchId: "graph-s1", execute: true, planHash: "h1" });
    await waitFor(() => expect(card.textContent).toContain("실행 완료"));
  });
  it("적재 점검: 부족한 배치를 강조한다", async () => {
    overview.mockResolvedValue(ov(true));
    check.mockResolvedValue({ result: res(), totals: { keys: 4, ready: 3, shortBatches: 1, dbRows: 9 }, batches: [{ id: "a", label: "A", keys: 3, loaded: 3, render: 3, screen: 3, ready: 3, missingKeys: [], short: false }, { id: "b", label: "B", keys: 1, loaded: 0, render: 0, screen: 0, ready: 0, missingKeys: ["k"], short: true }] });
    render(<ApStockPanel />);
    fireEvent.click(await screen.findByText("점검 실행"));
    const t = await screen.findByTestId("ap-stock-check");
    expect(t.querySelectorAll("tr[data-short='1']")).toHaveLength(1);
    expect(t.textContent).toContain("← 부족");
  });
  it("부분 연습 세트 초안 저장: 계획이 없으면 빈 상태, 있으면 미리보기 → 확인 → 같은 해시로 저장(보관 안내 포함)", async () => {
    overview.mockResolvedValue({ ...ov(true), partialPlans: [] });
    const { unmount } = render(<ApStockPanel />);
    expect(await screen.findByTestId("ap-partial-empty")).toBeTruthy();
    unmount();
    overview.mockResolvedValue({ ...ov(true), partialPlans: [{ file: "partial-rebuild-ab-plan.json", sets: [{ id: "PC", name: "AP Calculus AB — Calculator Practice", partial: "calc_mc" }] }] });
    partial.mockImplementation(async (i: { execute: boolean }) => (i.execute ? res({ action: "assemble_draft", mode: "execute", executed: true, lines: ["초안 세트 abc 저장"] }) : res({ action: "assemble_draft", planHash: "ph1", lines: ["저장할 초안: AP Calculus AB — Calculator Practice ... 다루는 단원: Units 1, 2"] })));
    render(<ApStockPanel />);
    const card = await screen.findByTestId("ap-partial");
    expect(card.textContent).toContain("보관");
    fireEvent.change(screen.getByLabelText("부분 세트 선택"), { target: { value: "PC" } });
    const [previewBtn, runBtn] = Array.from(card.querySelectorAll("button")) as HTMLButtonElement[];
    expect(runBtn.disabled).toBe(true);
    fireEvent.click(previewBtn);
    await waitFor(() => expect(card.textContent).toContain("다루는 단원"));
    fireEvent.click(card.querySelector("input[type=checkbox]")!);
    expect(runBtn.disabled).toBe(false);
    fireEvent.click(runBtn);
    await waitFor(() => expect(partial).toHaveBeenCalledTimes(2));
    expect(partial.mock.calls[1][0]).toMatchObject({ planFile: "partial-rebuild-ab-plan.json", setId: "PC", execute: true, planHash: "ph1", tier: "free" });
  });
});
