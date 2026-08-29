import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generatePayoutsAsCronMock = vi.fn();
vi.mock("@/app/admin/payouts-cron", () => ({
  generatePayoutsAsCron: generatePayoutsAsCronMock,
}));

describe("GET /api/cron/generate-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    generatePayoutsAsCronMock.mockResolvedValue({ created: 3, skippedNoRate: [] });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("올바른 CRON_SECRET이면 전월 기준으로 generatePayouts를 실행한다", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/cron/generate-payouts", {
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(generatePayoutsAsCronMock).toHaveBeenCalled();
  });

  it("CRON_SECRET이 틀리면 401을 반환하고 실행하지 않는다", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/cron/generate-payouts", {
      headers: { authorization: "Bearer wrong" },
    });

    const res = await GET(request);
    expect(res.status).toBe(401);
    expect(generatePayoutsAsCronMock).not.toHaveBeenCalled();
  });
});
