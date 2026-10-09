import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NONPROD_REF, checkRenderedMatchesDb, itemContentHash, judgeScreenEntries, resolveVerifyTarget, validateScreenEntry, type ScreenEntry } from "./verify-guard";

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
describe("screen evidence", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "apv-"));
  writeFileSync(path.join(dir, "s.png"), "x");
  const payload = { stimulus: "s", stem: "q", options: ["A", "B"], key_index: 0 };
  const pass = { result: "pass" as const };
  const checks = { options_visible: pass, figure_rendered: pass, no_clipping: pass, no_answer_before_submit: pass, frq_input_works: { result: "na" as const } };
  const mk = (vp: string, o: Partial<ScreenEntry> = {}): ScreenEntry => ({ candidate_key: "k", checker_kind: "automated", content_hash: itemContentHash(payload), kind: "mc", viewport: vp, screenshot: "s.png", timestamp: "2026-10-08T10:00:00Z", checker: "automated-playwright", checks, ...o });
  it("완전한 항목만 통과(스크린샷 존재만으로는 불가)", () => {
    expect(validateScreenEntry(mk("390x844"), dir)).toBeNull();
    expect(validateScreenEntry(mk("390x844", { checks: undefined }), dir)).toMatch(/checks 누락/);
    expect(validateScreenEntry(mk("390x844", { checks: { ...checks, no_clipping: undefined } }), dir)).toMatch(/미실시/);
    expect(validateScreenEntry(mk("390x844", { checks: { ...checks, options_visible: { result: "fail", note: "cut" } } }), dir)).toMatch(/실패/);
    expect(validateScreenEntry(mk("390x844", { checks: { ...checks, options_visible: { result: "na" } } }), dir)).toMatch(/na 불가/);
    expect(validateScreenEntry(mk("390x844", { checks: { ...checks, figure_rendered: { result: "na" } } }), dir)).toMatch(/사유/);
    expect(validateScreenEntry(mk("390x844", { kind: "frq_bundle" }), dir)).toMatch(/FRQ/);
    expect(validateScreenEntry(mk("390x844", { screenshot: "none.png" }), dir)).toMatch(/없음/);
    expect(validateScreenEntry(mk("390x844", { content_hash: "abc" }), dir)).toMatch(/content_hash/);
    expect(validateScreenEntry(mk("bad"), dir)).toMatch(/viewport/);
    expect(validateScreenEntry(mk("390x844", { checker_kind: undefined }), dir)).toMatch(/checker_kind/);
    expect(validateScreenEntry(mk("390x844", { checker_kind: "robot" as never }), dir)).toMatch(/checker_kind/);
    expect(validateScreenEntry(mk("390x844", { checker: "playwright" }), dir)).toMatch(/automated-/);
    expect(validateScreenEntry(mk("390x844", { checker_kind: "human", checker: "automated-playwright" }), dir)).toMatch(/사람 검토/);
    expect(validateScreenEntry(mk("390x844", { checker_kind: "human", checker: "Jiman" }), dir)).toBeNull();
    expect(validateScreenEntry(mk("390x844", { timestamp: "2999-01-01T00:00:00Z" }), dir)).toMatch(/미래/);
  });
  it("후보 판정: 해시 일치 + 모바일·데스크톱 모두 필요, 내용 변경 시 재사용 불가", () => {
    expect(judgeScreenEntries([mk("390x844"), mk("1280x800")], payload, dir)).toEqual({ ok: true });
    expect(judgeScreenEntries([mk("390x844")], payload, dir).ok).toBe(false);
    expect(judgeScreenEntries([mk("1280x800")], payload, dir).ok).toBe(false);
    const r = judgeScreenEntries([mk("390x844"), mk("1280x800")], { ...payload, options: ["A", "C"] }, dir);
    expect(r.ok).toBe(false); expect(!r.ok && r.reason).toMatch(/content_hash/);
    expect(judgeScreenEntries([mk("390x844"), mk("1280x800", { checks: { ...checks, no_clipping: { result: "fail" } } })], payload, dir).ok).toBe(false);
  });
  it("결과 화면 점검(v2): 실패·na 는 거부, 없으면 requireResult 일 때만 거부", () => {
    const withRc = (rc: unknown) => mk("390x844", { checks: { ...checks, result_no_raw_tex: rc as never } });
    expect(validateScreenEntry(withRc({ result: "pass" }), dir)).toBeNull();
    expect(validateScreenEntry(withRc({ result: "fail", note: "\\frac" }), dir)).toMatch(/결과 화면 점검 실패/);
    expect(validateScreenEntry(withRc({ result: "na" }), dir)).toMatch(/na 불가/);
    expect(validateScreenEntry(mk("390x844"), dir)).toBeNull();
    expect(validateScreenEntry(mk("390x844"), dir, Date.now(), { requireResult: true })).toMatch(/결과 화면 점검 미실시/);
    expect(judgeScreenEntries([withRc({ result: "pass" }), { ...withRc({ result: "pass" }), viewport: "1280x800" }], payload, dir, { requireResult: true })).toEqual({ ok: true });
  });
});
