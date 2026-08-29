import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generatePayoutsMock = vi.fn();
vi.mock("@/app/admin/payouts-actions", () => ({
  generatePayouts: generatePayoutsMock,
}));

describe("GET /api/cron/generate-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    generatePayoutsMock.mockResolvedValue({ created: 3, skippedNoRate: [] });
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
    expect(generatePayoutsMock).toHaveBeenCalled();
  });

  it("CRON_SECRET이 틀리면 401을 반환하고 실행하지 않는다", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/cron/generate-payouts", {
      headers: { authorization: "Bearer wrong" },
    });

    const res = await GET(request);
    expect(res.status).toBe(401);
    expect(generatePayoutsMock).not.toHaveBeenCalled();
  });
});
