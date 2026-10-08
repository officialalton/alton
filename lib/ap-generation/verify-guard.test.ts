import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NONPROD_REF, checkRenderedMatchesDb, itemContentHash, resolveVerifyTarget, validateScreenEntry } from "./verify-guard";

const L = "http://127.0.0.1:54422";
const NP = `https://${NONPROD_REF}.supabase.co`;
describe("resolveVerifyTarget", () => {
  it("기본·local 은 로컬 URL 만", () => {
    expect(resolveVerifyTarget({ url: L })).toEqual({ kind: "local" });
    expect(() => resolveVerifyTarget({ url: NP })).toThrow(/로컬이 아닙니다/);
  });
  it("비프로덕션은 ref + 확인 플래그 + 호스트 일치 모두 필요", () => {
    expect(resolveVerifyTarget({ url: NP, target: NONPROD_REF, confirm: NONPROD_REF })).toEqual({ kind: "nonprod", ref: NONPROD_REF });
    expect(() => resolveVerifyTarget({ url: NP, target: NONPROD_REF })).toThrow(/확인 플래그/);
    expect(() => resolveVerifyTarget({ url: NP, target: NONPROD_REF, confirm: "x" })).toThrow(/확인 플래그/);
    expect(() => resolveVerifyTarget({ url: L, target: NONPROD_REF, confirm: NONPROD_REF })).toThrow(/다릅니다/);
  });
  it("다른 ref·프로덕션·URL 없음은 거부", () => {
    expect(() => resolveVerifyTarget({ url: "https://abcdefghijklmnopqrst.supabase.co", target: "abcdefghijklmnopqrst", confirm: "abcdefghijklmnopqrst" })).toThrow(/허용되지 않은/);
    expect(() => resolveVerifyTarget({ url: "https://abcdefghijklmnopqrst.supabase.co", target: NONPROD_REF, confirm: NONPROD_REF })).toThrow(/다릅니다/);
    expect(() => resolveVerifyTarget({ url: undefined })).toThrow();
    expect(() => resolveVerifyTarget({ url: "https://evil.com/127.0.0.1" })).toThrow();
  });
});
describe("content hash", () => {
  const p = { stimulus: "{\"a\":1,\"b\":2}", stem: "s", options: ["A", "B"], key_index: 1 };
  it("키 순서 무관, 자료·선지·정답 변경은 감지, 무관 필드는 무시", () => {
    expect(itemContentHash({ ...p, extra: 1 })).toBe(itemContentHash({ key_index: 1, options: ["A", "B"], stem: "s", stimulus: p.stimulus }));
    expect(itemContentHash({ ...p, options: ["A", "C"] })).not.toBe(itemContentHash(p));
    expect(itemContentHash({ ...p, key_index: 0 })).not.toBe(itemContentHash(p));
    expect(itemContentHash({ ...p, stimulus: "{}" })).not.toBe(itemContentHash(p));
  });
  it("보고서 행과 DB payload 대조", () => {
    const h = itemContentHash(p);
    expect(checkRenderedMatchesDb({ key: "k", status: "pass", contentHash: h }, p)).toEqual({ ok: true });
    expect(checkRenderedMatchesDb({ key: "k", status: "not_applicable", contentHash: h }, p).ok).toBe(true);
    expect(checkRenderedMatchesDb({ key: "k", status: "pass", contentHash: h }, { ...p, key_index: 0 }).ok).toBe(false);
    expect(checkRenderedMatchesDb({ key: "k", status: "fail", contentHash: h }, p).ok).toBe(false);
    expect(checkRenderedMatchesDb({ key: "k", status: "pass" }, p).ok).toBe(false);
    expect(checkRenderedMatchesDb(undefined, p).ok).toBe(false);
  });
});
describe("validateScreenEntry", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "apv-"));
  writeFileSync(path.join(dir, "s.png"), "x");
  const ok = { candidate_key: "k", viewport: "390x844", screenshot: "s.png", timestamp: "2026-10-08T10:00:00Z", checker: "jiman" };
  it("완전한 증거만 통과", () => {
    expect(validateScreenEntry(ok, dir)).toBeNull();
    for (const f of Object.keys(ok)) expect(validateScreenEntry({ ...ok, [f]: "" }, dir)).toMatch(/누락/);
    expect(validateScreenEntry({ ...ok, screenshot: "none.png" }, dir)).toMatch(/없음/);
    expect(validateScreenEntry({ ...ok, timestamp: "garbage" }, dir)).toMatch(/형식/);
    expect(validateScreenEntry({ ...ok, timestamp: "2999-01-01T00:00:00Z" }, dir)).toMatch(/미래/);
  });
});
