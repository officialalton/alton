// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const overview = vi.fn(); const preview = vi.fn(); const draft = vi.fn(); const publish = vi.fn(); const tier = vi.fn();
vi.mock("../ap-new-version-actions", () => ({
  getApNewVersionOverviewAction: () => overview(), apNewVersionPreviewAction: (i: unknown) => preview(i), apNewVersionDraftAction: (i: unknown) => draft(i),
  apNewVersionPublishAction: (i: unknown) => publish(i), apSetAccessTierAction: (i: unknown) => tier(i),
}));
import ApNewVersionPanel from "./ApNewVersionPanel";

const set = (o: Record<string, unknown> = {}) => ({ id: "s1", name: "AP Calculus AB — Practice Exam", versionNo: 1, status: "published", accessTier: "free", plannedTier: null, apLabel: "full_practice", apSubject: "ap_calculus_ab", groupId: "g1", ...o });
const ov = (sets: unknown[], canWrite = true, plans: unknown[] = [{ file: "ab1-v2-swap-plan.json", set: "AB1", sourceSetName: "x", swapCount: 2 }]) => ({ target: { ref: "r", kind: "remote", canWrite, reason: null }, sets, plans });
const res = (o: Record<string, unknown> = {}) => ({ action: "new_version_preview", mode: "dry_run", executed: false, target: { ref: "r", kind: "remote", canWrite: true, reason: null }, scope: {}, counts: {}, lines: ["교체 2건"], planHash: "h1", blocked: null, ok: true, ...o });
const comp = (mc: number) => ({ mc, frq: 6, unitCounts: { "1": 5 }, calculator: { not_allowed: 29, required: 13, other: 0 } });
const prev = (o: Record<string, unknown> = {}) => ({ ...res(), preview: { ok: true, issues: [], source: { versionNo: 1 }, newVersionNo: 2, attempts: { total: 3, byStatus: { graded: 3 } }, before: comp(42), after: comp(42) }, ...o });

beforeEach(() => { [overview, preview, draft, publish, tier].forEach((m) => m.mockReset()); });
afterEach(cleanup);

describe("ApNewVersionPanel — 새 버전", () => {
  it("미리보기 전에는 실행이 막히고, 미리보기 → 확인 체크 → 같은 해시로 초안 만들기", async () => {
    overview.mockResolvedValue(ov([set()])); preview.mockResolvedValue(prev()); draft.mockResolvedValue(res({ action: "new_version_draft", mode: "execute", executed: true, lines: ["v2 초안 생성"] }));
    render(<ApNewVersionPanel canWrite />);
    const card = await screen.findByTestId("ap-nv-create");
    const run = screen.getByText("새 버전 초안 만들기") as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    fireEvent.change(card.querySelectorAll("select")[0], { target: { value: "s1" } });
    fireEvent.change(card.querySelectorAll("select")[1], { target: { value: "ab1-v2-swap-plan.json" } });
    fireEvent.click(screen.getByText("미리보기(검증)"));
    await screen.findByTestId("ap-nv-composition");
    expect(screen.getByTestId("ap-nv-attempts").textContent).toContain("기존 응시 3건은 v1 에 그대로");
    expect(run.disabled).toBe(true);
    fireEvent.click(card.querySelector("input[type=checkbox]")!);
    expect(run.disabled).toBe(false);
    fireEvent.click(run);
    await waitFor(() => expect(draft).toHaveBeenCalledWith({ sourceSetId: "s1", planHash: "h1", planFile: "ab1-v2-swap-plan.json" }));
    await screen.findByTestId("ap-nv-result");
  });
  it("검증 위반이면 확인 체크도 막힌다(계획 해시 없음)", async () => {
    overview.mockResolvedValue(ov([set()])); preview.mockResolvedValue(prev({ planHash: null, ok: false, blocked: "검증 위반", lines: ["위반: family_cap"] }));
    render(<ApNewVersionPanel canWrite />);
    const card = await screen.findByTestId("ap-nv-create");
    fireEvent.change(card.querySelectorAll("select")[0], { target: { value: "s1" } });
    fireEvent.change(card.querySelector("textarea")!, { target: { value: "ap_mc_a 3 some-key" } });
    fireEvent.click(screen.getByText("미리보기(검증)"));
    await screen.findByTestId("ap-nv-preview");
    expect((card.querySelector("input[type=checkbox]") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByText("새 버전 초안 만들기") as HTMLButtonElement).disabled).toBe(true);
    expect(preview).toHaveBeenCalledWith({ sourceSetId: "s1", manual: [{ section: "ap_mc_a", position: 3, addKey: "some-key" }] });
  });
  it("쓰기 차단 대상이면 확인해도 실행 버튼이 비활성", async () => {
    overview.mockResolvedValue(ov([set()], false)); preview.mockResolvedValue(prev());
    render(<ApNewVersionPanel canWrite />);
    const card = await screen.findByTestId("ap-nv-create");
    fireEvent.change(card.querySelectorAll("select")[0], { target: { value: "s1" } });
    fireEvent.change(card.querySelectorAll("select")[1], { target: { value: "ab1-v2-swap-plan.json" } });
    fireEvent.click(screen.getByText("미리보기(검증)")); await screen.findByTestId("ap-nv-composition");
    fireEvent.click(card.querySelector("input[type=checkbox]")!);
    expect((screen.getByText("새 버전 초안 만들기") as HTMLButtonElement).disabled).toBe(true);
  });
  it("공개 단계는 별도: v2 이상 초안만 고르고 확인 후 공개", async () => {
    overview.mockResolvedValue(ov([set(), set({ id: "d2", versionNo: 2, status: "draft" }), set({ id: "d1", name: "BC1", versionNo: 1, status: "draft" })]));
    publish.mockImplementation(async (i: { execute: boolean }) => (i.execute ? res({ executed: true, mode: "execute" }) : res({ action: "new_version_publish" })));
    render(<ApNewVersionPanel canWrite />);
    const card = await screen.findByTestId("ap-nv-publish");
    const sel = card.querySelector("select")!; expect(sel.querySelectorAll("option")).toHaveLength(2); // 선택 + v2 초안 1개
    fireEvent.change(sel, { target: { value: "d2" } });
    fireEvent.click(screen.getByText("미리보기", { selector: "[data-testid=ap-nv-publish] button" }));
    await screen.findByTestId("ap-nv-publish-preview");
    fireEvent.click(card.querySelector("input[type=checkbox]")!);
    fireEvent.click(screen.getByText("새 버전 공개"));
    await waitFor(() => expect(publish).toHaveBeenLastCalledWith({ newSetId: "d2", execute: true, planHash: "h1" }));
  });
  it("오류와 빈 상태", async () => {
    overview.mockRejectedValue(new Error("x"));
    render(<ApNewVersionPanel canWrite />);
    expect(await screen.findByText("AP 세트 정보를 불러오지 못했습니다.")).toBeTruthy();
    cleanup(); overview.mockResolvedValue(ov([], true, []));
    render(<ApNewVersionPanel canWrite />);
    expect(await screen.findByText("공개 중인 AP 세트가 없습니다.")).toBeTruthy();
    expect(screen.getByText("AP 세트가 없습니다.")).toBeTruthy();
  });
});

describe("ApNewVersionPanel — 공개 범위", () => {
  it("공개 중 튜터링 세트를 무료로: 미리보기 → 확인 → 적용(같은 해시)", async () => {
    overview.mockResolvedValue(ov([set({ id: "ab2", name: "AB2", accessTier: "tutoring" })]));
    tier.mockImplementation(async (i: { execute: boolean }) => (i.execute ? res({ executed: true, mode: "execute", action: "set_access_tier" }) : res({ action: "set_access_tier" })));
    render(<ApNewVersionPanel canWrite />);
    const row = await screen.findByTestId("ap-tier-row-ab2");
    expect(screen.getByTestId("ap-tier-current").textContent).toBe("튜터링");
    fireEvent.click(screen.getByText("무료(으)로 변경 미리보기"));
    await screen.findByTestId("ap-tier-preview");
    const apply = screen.getByText("무료(으)로 적용") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(row.querySelector("input[type=checkbox]")!);
    fireEvent.click(apply);
    await waitFor(() => expect(tier).toHaveBeenLastCalledWith({ setId: "ab2", tier: "free", execute: true, planHash: "h1" }));
  });
  it("초안은 '공개 때 적용'으로 표시한다", async () => {
    overview.mockResolvedValue(ov([set({ id: "bc1", name: "BC1", status: "draft", accessTier: "tutoring", plannedTier: "free" })]));
    render(<ApNewVersionPanel canWrite />);
    await screen.findByTestId("ap-tier-row-bc1");
    expect(screen.getByTestId("ap-tier-current").textContent).toBe("무료(공개 때 적용)");
  });
});
