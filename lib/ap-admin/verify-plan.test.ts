import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decideRender, decideScreen, type VerifyDbRow } from "./verify-plan";
import { itemContentHash } from "../ap-generation/verify-guard";
import type { ScreenEntry } from "../ap-generation/verify-guard";

// 실제 커밋된 산출물(그래프 배치 s1 + 렌더 보고서 + 화면 증거 v3)로 mark-verified 와 같은 판정이 나오는지 확인한다.
const items = JSON.parse(readFileSync("data/ap/stock/graph-s1-items.json", "utf-8")) as { stockKey: string; apSubjectCode: string; kind: string; payload: Record<string, unknown> }[];
const passKeys = JSON.parse(readFileSync("data/ap/stock/graph-s1-pass-keys.json", "utf-8")) as string[];
const report = JSON.parse(readFileSync("data/ap/render-check/report.json", "utf-8")) as { results: { key: string; status: string; contentHash?: string }[] };
const ev = JSON.parse(readFileSync("data/ap/screen-evidence/evidence-graph-s1s3.json", "utf-8")) as { schema: string; generator?: string; entries: ScreenEntry[] };
const byRender = new Map(report.results.map((r) => [r.key, r]));
const it0 = items.find((i) => passKeys.includes(i.stockKey) && byRender.get(i.stockKey)?.contentHash === itemContentHash(i.payload) && ev.entries.some((e) => e.candidate_key === i.stockKey))!;
const row = (o: Partial<VerifyDbRow> = {}): VerifyDbRow => ({ candidate_key: it0.stockKey, ap_subject_code: it0.apSubjectCode, kind: it0.kind, payload: it0.payload, render_verified: false, screen_verified: false, screen_evidence: null, defect_flags: [], ...o });

describe("decideRender", () => {
  it("해시 일치 + 게이트 통과 → 기록 대상, 증거에 해시 포함", () => {
    expect(it0).toBeTruthy();
    const d = decideRender(row(), byRender.get(it0.stockKey), "report.json");
    expect(d.action).toBe("mark"); expect(d.evidence).toMatchObject({ contentHash: byRender.get(it0.stockKey)!.contentHash });
  });
  it("DB 문항 내용이 렌더 이후 바뀌면 건너뜀(해시 불일치)", () => {
    const d = decideRender(row({ payload: { ...it0.payload, stem: `${String(it0.payload.stem)} changed` } }), byRender.get(it0.stockKey), "r");
    expect(d).toMatchObject({ action: "skip" }); expect(d.reason).toMatch(/해시 불일치/);
  });
  it("보고서에 없음 · 이미 검증됨 · 결함 플래그", () => {
    expect(decideRender(row(), undefined, "r").action).toBe("skip");
    expect(decideRender(row({ render_verified: true }), undefined, "r").action).toBe("already");
    expect(decideRender(row({ defect_flags: ["x"] }), byRender.get(it0.stockKey), "r").action).toBe("skip");
  });
});

describe("decideScreen", () => {
  const es = ev.entries.filter((e) => e.candidate_key === it0.stockKey);
  it("렌더 검증이 먼저", () => { expect(decideScreen(row(), es, ev, process.cwd(), { skipScreenshotFiles: true }).reason).toMatch(/렌더 검증이 먼저/); });
  it("해시 일치 + 모바일·데스크톱 통과 → new, automated 한계 문구 포함, 두 번째는 already", () => {
    const d = decideScreen(row({ render_verified: true }), es, ev, process.cwd(), { skipScreenshotFiles: true });
    expect(d.action).toBe("new"); expect(d.evidence).toMatchObject({ checkerKind: "automated", contentHash: es[0].content_hash });
    expect(String((d.evidence as { limitations: string }).limitations)).toMatch(/Automated screen check/);
    const again = decideScreen(row({ render_verified: true, screen_verified: true, screen_evidence: d.evidence }), es, ev, process.cwd(), { skipScreenshotFiles: true });
    expect(again.action).toBe("already");
  });
  it("payload 변경(해시 불일치)은 거부, 한 뷰포트만 있으면 거부", () => {
    expect(decideScreen(row({ render_verified: true, payload: { ...it0.payload, stem: "other" } }), es, ev, process.cwd(), { skipScreenshotFiles: true }).reason).toMatch(/content_hash/);
    expect(decideScreen(row({ render_verified: true }), es.slice(0, 1), ev, process.cwd(), { skipScreenshotFiles: true }).action).toBe("skip");
  });
  it("스크린샷 실존 검사는 서버에서만 끄고, 기본(스크립트)은 파일이 없으면 거부", () => {
    expect(decideScreen(row({ render_verified: true }), es, ev, "/nonexistent-dir").reason).toMatch(/스크린샷 파일 없음/);
  });
});
