import { describe, expect, it } from "vitest";
import { countUnreadInquiries } from "./messenger-unread-data";

describe("countUnreadInquiries", () => {
  const lr = new Map([["h1", "2026-09-29T10:00:00Z"]]);
  it("읽음 이후 보호자 메시지가 있는 문의만, 문의당 1회 센다", () => {
    expect(
      countUnreadInquiries(
        [
          { inquiryId: "i1", householdId: "h1", createdAt: "2026-09-29T11:00:00Z" },
          { inquiryId: "i1", householdId: "h1", createdAt: "2026-09-29T12:00:00Z" },
          { inquiryId: "i2", householdId: "h1", createdAt: "2026-09-29T09:00:00Z" },
          { inquiryId: "i3", householdId: "h2", createdAt: "2026-01-01T00:00:00Z" },
        ],
        lr
      )
    ).toBe(2);
  });
  it("메시지가 없으면 0", () => expect(countUnreadInquiries([], lr)).toBe(0));
});
