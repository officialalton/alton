import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { applyCaps, gutenbergPath, gutenbergRows, medlineRows, plosRows, toJsonl, type Row } from "./lists";
import { checkRoot, planRows, type Manifest } from "./collect";
import { medlineItems, pickGutenbergFile, plosItems, stripGutenberg } from "./postprocess";

// 모든 픽스처는 합성 문장(실제 작품·논문 문장 아님).
const manifest: Manifest = { storageRoot: "/tmp/x", userAgent: "t", globalMaxMB: 10, minFreeDiskGB: 1, sources: [
  { id: "gutenberg", license: "public_domain_us", licenseEvidenceUrl: "u", delayMs: 0, approved: true, maxTotalMB: 5 },
  { id: "plos", license: "cc_by", licenseEvidenceUrl: "u", delayMs: 0, approved: true, maxTotalMB: 2 },
  { id: "nasa", license: "us_gov_work", licenseEvidenceUrl: "u", delayMs: 0, approved: false },
] };

describe("목록 생성기", () => {
  it("Gutenberg 번호 → 공식 미러 계층 경로", () => {
    expect(gutenbergPath(12345)).toBe("1/2/3/4/12345");
    expect(gutenbergPath(123)).toBe("1/2/123");
    expect(gutenbergPath(12)).toBe("1/12");
    expect(() => gutenbergPath(5)).toThrow();
  });
  it("선별 결과 → rsync 행, 용량·파일 수 상한 적용", () => {
    const sel = Array.from({ length: 400 }, (_, i) => ({ id: 1000 + i, title: `t${i}`, author: "Doe, Jane", birth: 1850, death: 1910, locc: "PR", issued: "2000-01-01" }));
    const r = gutenbergRows(sel);
    expect(r.rows.length).toBeLessThanOrEqual(165);
    expect(r.estMB).toBeLessThanOrEqual(100);
    expect(r.rows[0]).toMatchObject({ sourceId: "gutenberg", method: "rsync", rsyncSource: "rsync.ibiblio.org::gutenberg/1/0/0/1000/", isTranslation: false });
    expect(r.dropped).toBe(400 - r.rows.length);
  });
  it("PLOS 는 API 페이지만(전체 덤프 URL 없음), 페이지당 rows ≤ 100, 총 20쪽 이하", () => {
    const r = plosRows(5000);
    expect(r.rows.length).toBeLessThanOrEqual(20);
    for (const row of r.rows) { expect(row.url).toMatch(/^https:\/\/api\.plos\.org\/search\?/); expect(row.url).toContain("rows=100"); expect(row.url).not.toContain("allofplos"); }
  });
  it("MedlinePlus 는 공식 XML 경로, 날짜 형식 검사", () => {
    expect(medlineRows("2026-09-30").rows[0].url).toBe("https://medlineplus.gov/xml/mplus_topics_2026-09-30.xml");
    expect(() => medlineRows("yesterday")).toThrow();
    expect(toJsonl([{ sourceId: "a", relPath: "b" }]).trim().split("\n")).toHaveLength(1);
    expect(applyCaps([{ estMB: 3 }, { estMB: 3 }], { maxFiles: 5, maxMB: 5 }, 1).kept).toHaveLength(1);
  });
});

describe("수집 계획(dry-run 경로, 네트워크 없음)", () => {
  const root = path.join(os.tmpdir(), "rwc-test");
  const rows: Row[] = [
    { sourceId: "gutenberg", method: "rsync", rsyncSource: "rsync.ibiblio.org::gutenberg/1/2/123/", relPath: "gutenberg/raw/123", estMB: 1 },
    { sourceId: "gutenberg", method: "rsync", rsyncSource: "evil.example.org::x/1/", relPath: "gutenberg/raw/9", estMB: 1 },
    { sourceId: "gutenberg", method: "rsync", rsyncSource: "rsync.ibiblio.org::gutenberg/1/2/124/", relPath: "gutenberg/raw/124", isTranslation: true },
    { sourceId: "nasa", method: "http", url: "https://www.nasa.gov/a", relPath: "nasa/a.html" },
    { sourceId: "plos", method: "http", url: "http://api.plos.org/search", relPath: "plos/raw/p0.json" },
    { sourceId: "plos", method: "http", url: "https://api.plos.org/search?x", relPath: "../escape.json" },
    { sourceId: "plos", method: "http", url: "https://api.plos.org/search?a", relPath: "plos/raw/p1.json", estMB: 1.5 },
    { sourceId: "plos", method: "http", url: "https://api.plos.org/search?b", relPath: "plos/raw/p2.json", estMB: 1.5 },
    { sourceId: "unknown", method: "http", url: "https://x.org", relPath: "u/x" },
  ];
  it("미승인·번역본·비공식 경로·http·경로 탈출·상한 초과를 거부하고 허용분만 계획", () => {
    const plan = planRows(manifest, rows, root, () => false);
    expect(plan.allowed.map((r) => r.relPath)).toEqual(["gutenberg/raw/123", "plos/raw/p1.json"]);
    const why = plan.rejected.join("\n");
    expect(why).toContain("공식 미러");
    expect(why).toContain("번역본");
    expect(why).toContain("미승인");
    expect(why).toContain("https 가 아닌");
    expect(why).toContain("storageRoot 밖");
    expect(why).toContain("용량 상한");
    expect(why).toContain("매니페스트에 없는");
    expect(plan.perSource.gutenberg.files).toBe(1);
  });
  it("재실행 안전: .meta.json 이 있으면 건너뛴다", () => {
    const plan = planRows(manifest, [rows[0]], root, (p) => p.endsWith("gutenberg/raw/123.meta.json"));
    expect(plan.allowed).toHaveLength(0);
    expect(plan.skipped).toBe(1);
  });
  it("저장 경로는 저장소·iCloud 안이면 거부", () => {
    expect(checkRoot("/repo/data/x", "/repo")).toContain("저장소 안");
    expect(checkRoot("/Users/a/Library/Mobile Documents/com~apple~CloudDocs/x", "/repo")).toContain("iCloud");
    expect(checkRoot("/Users/a/Developer/ALTON-data/rw-corpus", "/repo")).toBeNull();
  });
  it("CLI dry-run 은 네트워크 없이 계획만 출력한다(로컬 픽스처, 임시 저장 경로)", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "rwc-cli-"));
    const manifestPath = path.join(tmp, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, storageRoot: path.join(tmp, "store") }));
    const list = path.join(tmp, "list.jsonl");
    writeFileSync(list, toJsonl(rows));
    const out = execFileSync("npx", ["tsx", path.resolve(__dirname, "collect.ts"), "--list", list], { env: { ...process.env, RW_CORPUS_MANIFEST: manifestPath, RW_CORPUS_ROOT: path.join(tmp, "store") }, encoding: "utf-8" });
    const j = JSON.parse(out.slice(out.indexOf("{")));
    expect(j.mode).toBe("dry-run");
    expect(j.planned).toBe(2);
    expect(j.rejectedCount).toBeGreaterThanOrEqual(6);
    expect(j.contactSet).toBe(Boolean(process.env.CORPUS_CONTACT));
  }, 60000);
});

describe("후처리(합성 픽스처)", () => {
  it("Gutenberg: 파일 선택 우선순위와 머리·꼬리 제거, 고지 없으면 제외", () => {
    expect(pickGutenbergFile(["12-8.txt", "12.txt", "12-0.txt"], "12")).toBe("12-0.txt");
    expect(pickGutenbergFile(["12-8.txt", "12.txt"], "12")).toBe("12.txt");
    const body = "synthetic sentence. ".repeat(200);
    const raw = `HEADER\n*** START OF THE PROJECT GUTENBERG EBOOK SYNTHETIC ***\n${body}\n*** END OF THE PROJECT GUTENBERG EBOOK SYNTHETIC ***\nFOOTER`;
    const out = stripGutenberg(raw)!;
    expect(out.startsWith("synthetic sentence.")).toBe(true);
    expect(out).not.toContain("HEADER");
    expect(out).not.toContain("FOOTER");
    expect(stripGutenberg("no markers here")).toBeNull();
  });
  it("MedlinePlus: 요약만, 한국어/스페인어·저작권 표시·길이 범위 밖 제외", () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
    const xml = `<health-topics><health-topic id="1" title="Synthetic A" url="https://x/a" language="English"><full-summary>&lt;p&gt;${words(80)}&lt;/p&gt;</full-summary></health-topic>` +
      `<health-topic id="2" title="Synthetic B" url="https://x/b" language="Spanish"><full-summary>&lt;p&gt;${words(80)}&lt;/p&gt;</full-summary></health-topic>` +
      `<health-topic id="3" title="Synthetic C" url="https://x/c" language="English"><full-summary>&lt;p&gt;${words(80)} A.D.A.M. content&lt;/p&gt;</full-summary></health-topic>` +
      `<health-topic id="4" title="Synthetic D" url="https://x/d" language="English"><full-summary>&lt;p&gt;${words(10)}&lt;/p&gt;</full-summary></health-topic></health-topics>`;
    const items = medlineItems(xml, "2026-09-30");
    expect(items.map((i) => i.id)).toEqual(["medlineplus-1"]);
    expect(items[0].text).not.toContain("<p>");
  });
  it("PLOS: 초록 120~260단어만, 출처 메타 포함", () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
    const json = JSON.stringify({ response: { docs: [
      { id: "10.1371/synthetic.1", title: "Synthetic one", author_display: ["A B"], journal: "PLOS ONE", publication_date: "2020-01-01T00:00:00Z", abstract: [words(150)] },
      { id: "10.1371/synthetic.2", title: "Too short", abstract: [words(30)] },
      { id: "10.1371/synthetic.3", title: "Too long", abstract: [words(400)] },
    ] } });
    const items = plosItems(json);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "plos-10.1371_synthetic.1", url: "https://doi.org/10.1371/synthetic.1" });
    expect((items[0].extra as { authors: string[] }).authors).toEqual(["A B"]);
  });
  void mkdirSync; void readFileSync;
});
