import { afterEach, describe, expect, it } from "vitest";
import { connectAllowlisted } from "./target";

// publish-to-bank / assemble-ap-set 의 접속 허용 목록(mark-verified 와 같은 규칙). 네트워크 호출 없음(클라이언트 생성만).
const save = { ...process.env };
afterEach(() => { process.env = { ...save }; });
const env = (url: string) => { process.env.NEXT_PUBLIC_SUPABASE_URL = url; process.env.SUPABASE_SECRET_KEY = "k"; };
describe("connectAllowlisted", () => {
  it("로컬 기본, 비프로덕션은 ref + 확인 플래그 + 호스트 일치", async () => {
    env("http://127.0.0.1:54521");
    expect((await connectAllowlisted(["x"])).label).toBe("local");
    env("https://worpsqwqgnspddnrtnvq.supabase.co");
    expect((await connectAllowlisted(["x", "--target", "worpsqwqgnspddnrtnvq", "--i-know-nonprod", "worpsqwqgnspddnrtnvq"])).label).toBe("nonprod(worpsqwqgnspddnrtnvq)");
    await expect(connectAllowlisted(["x"])).rejects.toThrow(/로컬이 아닙니다/);
    await expect(connectAllowlisted(["x", "--target", "worpsqwqgnspddnrtnvq"])).rejects.toThrow(/확인 플래그/);
  });
  it("프로덕션·다른 ref·호스트 불일치는 거부", async () => {
    env("https://abcdefghijklmnopqrst.supabase.co");
    await expect(connectAllowlisted(["x", "--target", "abcdefghijklmnopqrst", "--i-know-nonprod", "abcdefghijklmnopqrst"])).rejects.toThrow(/허용되지 않은/);
    await expect(connectAllowlisted(["x", "--target", "worpsqwqgnspddnrtnvq", "--i-know-nonprod", "worpsqwqgnspddnrtnvq"])).rejects.toThrow(/다릅니다/);
  });
});
