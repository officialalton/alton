import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let failing = false;
const signOut = vi.fn(async (..._a: unknown[]) => {
  if (failing) await Promise.resolve().then(() => { throw new Error("network"); });
  return { error: null };
});
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}));

import { POST } from "./route";

const req = () => new NextRequest("https://app.test/admin?tab=home", { method: "POST" });

describe("POST /logout", () => {
  beforeEach(() => { failing = false; signOut.mockClear(); });

  it("signs out locally and 303-redirects to /login", async () => {
    const res = await POST(req());
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.test/login");
  });

  it("still lands on /login when signOut throws", async () => {
    failing = true;
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.test/login");
  });
});
