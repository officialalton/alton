import { describe, expect, it } from "vitest";
import { ADMIN_TAB_IDS, resolveAdminTab } from "./admin-tabs";

describe("resolveAdminTab (2026-09-10, P1-3 — AdminShell·admin/page.tsx 공유 탭 판정)", () => {
  it("유효한 탭 id는 그대로 반환한다", () => {
    for (const id of ADMIN_TAB_IDS) {
      expect(resolveAdminTab(id)).toBe(id);
    }
  });

  it("없거나 모르는 값은 home으로 정규화한다", () => {
    expect(resolveAdminTab(undefined)).toBe("home");
    expect(resolveAdminTab(null)).toBe("home");
    expect(resolveAdminTab("")).toBe("home");
    expect(resolveAdminTab("not-a-real-tab")).toBe("home");
  });

  it("Inquiries 탭은 사라졌고 옛 ?tab=inquiry는 messenger로 매핑된다(2026-09-29)", () => {
    expect((ADMIN_TAB_IDS as readonly string[]).includes("inquiry")).toBe(false);
    expect(resolveAdminTab("inquiry")).toBe("messenger");
  });

  it("옛 free-members 탭 id는 free-accounts로 매핑된다(2026-10-06)", () => {
    expect((ADMIN_TAB_IDS as readonly string[]).includes("free-members")).toBe(false);
    expect(resolveAdminTab("free-members")).toBe("free-accounts");
  });
});
