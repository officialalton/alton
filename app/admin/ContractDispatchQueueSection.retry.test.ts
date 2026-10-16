import { describe, expect, it, vi } from "vitest";

vi.mock("./contract-dispatch-actions", () => ({
  listContractDispatchJobs: vi.fn(),
  runContractDispatchQueueAction: vi.fn(),
  retryContractDispatchJobAction: vi.fn(),
  setContractAutoDispatchEnabledAction: vi.fn(),
}));
vi.mock("./use-tab-cached-data", () => ({ useTabCachedData: vi.fn() }));

import { describeRetryOutcome } from "./ContractDispatchQueueSection";

// 2026-09-29(D7) — 재시도 버튼이 무엇을 했는지 관리자에게 말한다(특히 게이트 OFF 무동작).
describe("describeRetryOutcome", () => {
  it("게이트 OFF 면 아무 것도 보내지 않았다고 명시한다", () => {
    expect(describeRetryOutcome({ outcome: "disabled" })).toContain("아무 것도 보내지 않았습니다");
  });
  it("모든 결과에 사람이 읽을 문구가 있다", () => {
    for (const r of [{ outcome: "sent" }, { outcome: "already_sent" }, { outcome: "skipped_no_guardian" }, { outcome: "busy" }] as const) {
      expect(describeRetryOutcome(r).length).toBeGreaterThan(5);
    }
    expect(describeRetryOutcome({ outcome: "failed", error: "DocuSign 오류" })).toContain("DocuSign 오류");
  });
});
