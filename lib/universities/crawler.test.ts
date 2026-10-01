import { describe, expect, it } from "vitest";
import { checkUrlSafety, isPathAllowedByRobots, isPrivateOrLoopbackIp, extractDeadlineCandidates, extractHtmlText } from "./crawler";

describe("crawler SSRF 방지(checkUrlSafety)", () => {
  it("http(s) 이외의 스킴은 거부한다", async () => {
    const result = await checkUrlSafety("file:///etc/passwd");
    expect(result.safe).toBe(false);
  });

  it("ftp 스킴도 거부한다", async () => {
    const result = await checkUrlSafety("ftp://example.com/file");
    expect(result.safe).toBe(false);
  });

  it("사설/루프백 IP 리터럴 호스트는 DNS 조회 없이 즉시 차단한다", async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://172.16.0.1/",
      "http://192.168.1.1/",
      "http://169.254.169.254/", // 클라우드 메타데이터 엔드포인트
    ]) {
      const result = await checkUrlSafety(url);
      expect(result.safe, `${url} 는 차단돼야 함`).toBe(false);
    }
  });

  it("localhost 호스트명은 차단한다", async () => {
    const result = await checkUrlSafety("http://localhost:8080/");
    expect(result.safe).toBe(false);
  });

  it("파싱 불가능한 URL은 차단한다", async () => {
    const result = await checkUrlSafety("not a url");
    expect(result.safe).toBe(false);
  });
});

describe("isPrivateOrLoopbackIp", () => {
  it("IPv4 사설 대역을 인식한다", () => {
    expect(isPrivateOrLoopbackIp("10.1.2.3", 4)).toBe(true);
    expect(isPrivateOrLoopbackIp("172.20.0.1", 4)).toBe(true);
    expect(isPrivateOrLoopbackIp("192.168.0.1", 4)).toBe(true);
    expect(isPrivateOrLoopbackIp("127.0.0.1", 4)).toBe(true);
    expect(isPrivateOrLoopbackIp("169.254.1.1", 4)).toBe(true);
    expect(isPrivateOrLoopbackIp("8.8.8.8", 4)).toBe(false);
    expect(isPrivateOrLoopbackIp("140.180.1.1", 4)).toBe(false);
  });

  it("IPv6 loopback/link-local/ULA를 인식한다", () => {
    expect(isPrivateOrLoopbackIp("::1", 6)).toBe(true);
    expect(isPrivateOrLoopbackIp("fe80::1", 6)).toBe(true);
    expect(isPrivateOrLoopbackIp("fc00::1", 6)).toBe(true);
    expect(isPrivateOrLoopbackIp("2001:4860:4860::8888", 6)).toBe(false);
  });
});

describe("robots.txt 파서(isPathAllowedByRobots)", () => {
  it("규칙이 없으면 허용", () => {
    expect(isPathAllowedByRobots("", "/admissions")).toBe(true);
  });

  it("User-agent: * 그룹의 Disallow 경로를 막는다", () => {
    const robots = "User-agent: *\nDisallow: /private/\nDisallow: /admin\n";
    expect(isPathAllowedByRobots(robots, "/private/data")).toBe(false);
    expect(isPathAllowedByRobots(robots, "/admin/x")).toBe(false);
    expect(isPathAllowedByRobots(robots, "/admissions")).toBe(true);
  });

  it("다른 User-agent 그룹의 규칙은 무시한다(우리 봇은 * 그룹만 본다)", () => {
    const robots = "User-agent: Googlebot\nDisallow: /admissions\nUser-agent: *\nDisallow: /only-this\n";
    expect(isPathAllowedByRobots(robots, "/admissions")).toBe(true);
    expect(isPathAllowedByRobots(robots, "/only-this")).toBe(false);
  });
});

describe("extractDeadlineCandidates", () => {
  it("Early Decision/Early Action/Regular Decision 문구를 찾는다", () => {
    const text = "Apply Early Decision by November 1. Regular Decision deadline is January 1.";
    const found = extractDeadlineCandidates(text);
    const labels = found.map((f) => f.label);
    expect(labels).toContain("Early Decision");
    expect(labels).toContain("Regular Decision");
  });

  it("아무 패턴도 없으면 빈 배열", () => {
    expect(extractDeadlineCandidates("Hello world")).toEqual([]);
  });
});

describe("extractHtmlText", () => {
  it("script/style/태그를 제거하고 본문만 남긴다", () => {
    const html = "<html><head><style>.a{}</style></head><body><script>bad()</script><p>Hello &amp; World</p></body></html>";
    expect(extractHtmlText(html)).toBe("Hello & World");
  });
});
