import { describe, expect, it, vi, beforeEach } from "vitest";
import { recordManualGuardianConsentAndRefresh } from "./consent-mutations";
import { recordManualGuardianConsent } from "./consent-actions";
import {
  setActiveAdminUser,
  clearAdminTabCache,
  setCachedTabData,
  getCachedTabData,
} from "./tab-data-cache";

vi.mock("./consent-actions", () => ({ recordManualGuardianConsent: vi.fn() }));

const params = {
  studentId: "s1",
  policyVersionId: "p1",
  consentedBy: "g1",
  verificationReference: "통화 녹취 2026-09-12",
};

beforeEach(() => {
  vi.clearAllMocks();
  clearAdminTabCache();
  setActiveAdminUser("admin-1");
  setCachedTabData("consent-gaps", [{ childId: "s1" }]);
  setCachedTabData("consent-completed", []);
});

describe("recordManualGuardianConsentAndRefresh", () => {
  it("동의를 등록하면 공유 캐시를 함께 버린다(이전 상태가 계속 보이지 않는다)", async () => {
    await recordManualGuardianConsentAndRefresh(params);
    expect(recordManualGuardianConsent).toHaveBeenCalledWith(params);
    expect(getCachedTabData("consent-gaps")).toBeNull();
    expect(getCachedTabData("consent-completed")).toBeNull();
  });

  it("등록에 실패하면 캐시를 건드리지 않는다", async () => {
    (recordManualGuardianConsent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("증빙이 필요합니다.")
    );
    await expect(recordManualGuardianConsentAndRefresh(params)).rejects.toThrow("증빙이 필요합니다.");
    expect(getCachedTabData("consent-gaps")).not.toBeNull();
  });
});

// 변경 동작이 화면마다 흩어지면 무효화를 빠뜨리기 쉽다 — 진입점을 하나로 묶어
// 둔 것을 정적으로 고정한다.
describe("동의 변경 진입점은 하나다", () => {
  it("서버 액션을 화면이 직접 부르지 않는다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = "app/admin";
    const offenders: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".tsx")) continue;
      const src = fs.readFileSync(path.join(dir, f), "utf-8");
      if (src.includes("recordManualGuardianConsent")) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
