// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preview = vi.fn(); const exec = vi.fn(); const refresh = vi.fn(); const overview = vi.fn();
vi.mock("../ap-explanation-fix-actions", () => ({ apExplanationFixPreviewAction: () => preview(), apExplanationFixExecuteAction: (i: unknown) => exec(i), apRefreshDraftAction: (i: unknown) => refresh(i) }));
vi.mock("../ap-new-version-actions", () => ({ getApNewVersionOverviewAction: () => overview() }));
import ApExplanationFixPanel from "./ApExplanationFixPanel";

const res = (o: Record<string, unknown> = {}) => ({ action: "explanation_fix_preview", mode: "dry_run", executed: false, target: { ref: "r", kind: "remote", canWrite: true, reason: null }, scope: {}, counts: {}, lines: ["교정 대상 3건"], planHash: "h1", blocked: null, ok: true, ...o });
beforeEach(() => { [preview, exec, refresh, overview].forEach((m) => m.mockReset()); overview.mockResolvedValue({ sets: [{ id: "s1", name: "AP Calculus AB — Practice Exam", versionNo: 1, status: "published" }] }); });
afterEach(cleanup);

describe("ApExplanationFixPanel", () => {
  it("미리보기 전에는 실행이 막히고, 미리보기 → 확인 → 같은 해시로 실행", async () => {
    preview.mockResolvedValue(res()); exec.mockResolvedValue(res({ action: "explanation_fix", mode: "execute", executed: true, lines: ["3건 완료"] }));
    render(<ApExplanationFixPanel canWrite />);
    const run = screen.getByText("설명 수정 새 버전 실행") as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    fireEvent.click(screen.getByText("미리보기(읽기 전용)"));
    await screen.findByTestId("ap-fix-preview");
    expect(run.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("ap-fix-problems").querySelector("input[type=checkbox]")!);
    expect(run.disabled).toBe(false);
    fireEvent.click(run);
    await waitFor(() => expect(exec).toHaveBeenCalledWith({ planHash: "h1" }));
    await screen.findByTestId("ap-fix-result");
  });
  it("쓰기 금지 환경이면 확인해도 실행 버튼이 잠긴다", async () => {
    preview.mockResolvedValue(res());
    render(<ApExplanationFixPanel canWrite={false} />);
    fireEvent.click(screen.getByText("미리보기(읽기 전용)")); await screen.findByTestId("ap-fix-preview");
    fireEvent.click(screen.getByTestId("ap-fix-problems").querySelector("input[type=checkbox]")!);
    expect((screen.getByText("설명 수정 새 버전 실행") as HTMLButtonElement).disabled).toBe(true);
  });
  it("세트 단위: 공개 세트 선택 → 미리보기 → 확인 → 초안 만들기", async () => {
    refresh.mockResolvedValueOnce(res({ action: "set_refresh_draft", lines: ["3문항"] })).mockResolvedValueOnce(res({ action: "set_refresh_draft", mode: "execute", executed: true, lines: ["v2 초안"] }));
    render(<ApExplanationFixPanel canWrite />);
    const sel = await screen.findByLabelText("공개 세트"); await screen.findByText(/AP Calculus AB — Practice Exam v1/);
    fireEvent.change(sel, { target: { value: "s1" } });
    fireEvent.click(screen.getByTestId("ap-fix-sets").querySelectorAll("button")[0]);
    await screen.findByTestId("ap-fix-set-preview");
    fireEvent.click(screen.getByTestId("ap-fix-sets").querySelector("input[type=checkbox]")!);
    fireEvent.click(screen.getByText("새 버전 초안 만들기"));
    await waitFor(() => expect(refresh).toHaveBeenLastCalledWith({ sourceSetId: "s1", execute: true, planHash: "h1" }));
  });
});
