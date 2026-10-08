// AP 그림 렌더링 게이트 실행(LLM·DB 없음). data/ap/stock/items.json 의 현재 재고 783행을 정규화·렌더·검사하고
// data/ap/render-check/ 에 스냅샷(SVG·HTML)과 report.json/report.md, 유형별 갤러리 HTML 을 쓴다.
//   npx tsx scripts/ap-generation/render-check.ts            # 스냅샷 + 보고서
//   npx tsx scripts/ap-generation/render-check.ts --png      # 갤러리를 PNG 로도 저장(Playwright chromium)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gateCandidate, type GateResult } from "../../lib/ap-figures/gate";
import { itemContentHash } from "../../lib/ap-generation/verify-guard";

const OUT = path.resolve(process.cwd(), "data/ap/render-check");
const items = JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as Parameters<typeof gateCandidate>[0][];
const safe = (s: string) => s.replace(/[^A-Za-z0-9_.-]+/g, "_");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const results: GateResult[] = items.map((c) => gateCandidate(c));
// 렌더한 문항 버전의 내용 해시(자료+선지+정답). mark-verified.ts 가 DB 후보와 대조한다.
const hashByKey = new Map(items.map((c) => { const k = (c as { stockKey?: string; candidateKey: string }).stockKey ?? (c as { candidateKey: string }).candidateKey; return [k, itemContentHash((c as { payload: Record<string, unknown> }).payload)] as const; }));

const shell = (title: string, body: string) => `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:Georgia,serif;margin:16px;background:#fff;color:#111">${body}</body>`;
for (const r of results) {
  if (!r.output || !r.spec) continue;
  const dir = path.join(OUT, safe(r.subject), safe(r.renderType.replace(":", "__")));
  mkdirSync(dir, { recursive: true });
  const ext = r.spec.type === "ap_table" ? "html" : "svg";
  writeFileSync(path.join(dir, `${safe(r.key)}.${ext}`), ext === "svg" ? r.output : shell(r.key, r.output));
}

// 유형별 요약
type Row = { type: string; total: number; pass: number; fail: number; notApplicable: number };
const byType = new Map<string, Row>();
for (const r of results) {
  const t = r.renderType;
  const row = byType.get(t) ?? { type: t, total: 0, pass: 0, fail: 0, notApplicable: 0 };
  row.total++; if (r.status === "pass") row.pass++; else if (r.status === "fail") row.fail++; else row.notApplicable++;
  byType.set(t, row);
}
const live = (r: GateResult) => r.validation === "auto_passed" || r.validation === "needs_revalidation";
const summarize = (rs: GateResult[]) => ({ total: rs.length, pass: rs.filter((r) => r.status === "pass").length, fail: rs.filter((r) => r.status === "fail").length, notApplicable: rs.filter((r) => r.status === "not_applicable").length });
const failCodes: Record<string, number> = {};
for (const r of results) for (const i of r.issues) if (i.level === "error") failCodes[i.code] = (failCodes[i.code] ?? 0) + 1;
const warnCodes: Record<string, number> = {};
for (const r of results) for (const i of r.issues) if (i.level === "warn") warnCodes[i.code] = (warnCodes[i.code] ?? 0) + 1;
const needCounts: Record<string, number> = {};
for (const r of results) needCounts[r.need] = (needCounts[r.need] ?? 0) + 1;
const bySubject: Record<string, ReturnType<typeof summarize>> = {};
for (const s of [...new Set(results.map((r) => r.subject))]) bySubject[s] = summarize(results.filter((r) => r.subject === s));

const report = {
  generatedAt: new Date().toISOString(),
  universe: "data/ap/stock/items.json (현재 재고 783행)",
  all: summarize(results),
  liveStates: summarize(results.filter(live)),
  byType: [...byType.values()].sort((a, b) => a.type.localeCompare(b.type)),
  bySubject,
  figureNeed: needCounts,
  errorCodes: failCodes,
  warnCodes,
  results: results.map((r) => ({ key: r.key, contentHash: hashByKey.get(r.key), subject: r.subject, kind: r.kind, validation: r.validation, stimKind: r.stimKind, renderType: r.renderType, need: r.need, needReason: r.needReason, status: r.status, issues: r.issues.filter((i) => i.level !== "info"), alt: r.alt })),
};
writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));

const md: string[] = [];
md.push("# AP 그림 렌더링 게이트 결과", "", `생성: ${report.generatedAt} · 대상: ${report.universe}`, "", "## 전체", "", `- 전체 ${report.all.total}행: 통과 ${report.all.pass} / 실패 ${report.all.fail} / 해당 없음(그림·표 없음) ${report.all.notApplicable}`, `- 현재 재고 중 게시 후보 상태(auto_passed + needs_revalidation) ${report.liveStates.total}행: 통과 ${report.liveStates.pass} / 실패 ${report.liveStates.fail} / 해당 없음 ${report.liveStates.notApplicable}`, "", "## 유형별(렌더 유형)", "", "| 유형 | 전체 | 통과 | 실패 | 해당 없음 |", "|---|---:|---:|---:|---:|");
for (const r of report.byType) md.push(`| ${r.type} | ${r.total} | ${r.pass} | ${r.fail} | ${r.notApplicable} |`);
md.push("", "## 과목별", "", "| 과목 | 전체 | 통과 | 실패 | 해당 없음 |", "|---|---:|---:|---:|---:|");
for (const [s, v] of Object.entries(bySubject)) md.push(`| ${s} | ${v.total} | ${v.pass} | ${v.fail} | ${v.notApplicable} |`);
md.push("", "## 그림 필요 분류(그림이 있어야 풀리는가)", "", `- required(그림·표가 있어야 풀림): ${needCounts.required ?? 0}`, `- supporting(보조 자료, 본문에도 정보 있음): ${needCounts.supporting ?? 0}`, `- text_only(본문만으로 충분): ${needCounts.text_only ?? 0}`);
md.push("", "## 실패 사유 코드", "", "| 코드 | 건수 |", "|---|---:|");
for (const [k, v] of Object.entries(failCodes).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${v} |`);
md.push("", "## 경고 코드(실패 아님)", "", "| 코드 | 건수 |", "|---|---:|");
for (const [k, v] of Object.entries(warnCodes).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${v} |`);
md.push("", "## 실패 목록(상위 60)", "");
for (const r of results.filter((x) => x.status === "fail").slice(0, 60)) md.push(`- \`${r.key}\` [${r.renderType}] ${r.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ")}`);
writeFileSync(path.join(OUT, "report.md"), md.join("\n") + "\n");

// 갤러리(유형별 한 페이지, 최대 24개씩): 사람이 눈으로 확인하는 용도
const groups = new Map<string, GateResult[]>();
for (const r of results) if (r.output && r.spec) { const k = `${r.subject}__${r.renderType.replace(":", "__")}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(r); }
const index: string[] = ["<h1>AP render check</h1><p><a href='report.md'>report.md</a></p><ul>"];
for (const [k, rs] of groups) {
  const pages = Math.ceil(rs.length / 24);
  for (let p = 0; p < pages; p++) {
    const chunk = rs.slice(p * 24, p * 24 + 24);
    const name = `gallery_${safe(k)}_${p + 1}.html`;
    writeFileSync(path.join(OUT, name), shell(k, `<h2>${k} (${p + 1}/${pages})</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(540px,1fr));gap:16px">${chunk.map((r) => `<div style="border:1px solid ${r.status === "pass" ? "#0f7b4a" : "#C8102E"};padding:8px"><div style="font:12px monospace">${r.key} — ${r.status}${r.issues.filter((i) => i.level === "error").length ? "<br>" + r.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ") : ""}</div>${r.output}</div>`).join("")}</div>`));
    index.push(`<li><a href="${name}">${k} ${p + 1}/${pages}</a> (${rs.length})</li>`);
  }
}
index.push("</ul>");
writeFileSync(path.join(OUT, "index.html"), shell("AP render check", index.join("")));
console.log(JSON.stringify({ all: report.all, live: report.liveStates, byType: report.byType, need: needCounts, errorCodes: failCodes }, null, 1));

async function pngs() {
  const { chromium } = await import("playwright");
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
  for (const [k, rs] of groups) {
    const pages = Math.ceil(rs.length / 24);
    for (let p = 0; p < pages; p++) { if (/__ap_table$/.test(k) && p > 0) continue; const name = `gallery_${safe(k)}_${p + 1}`; await pg.goto("file://" + path.join(OUT, name + ".html")); await pg.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true }); }
  }
  await b.close();
}
if (process.argv.includes("--png")) pngs().catch((e) => { console.error(e); process.exit(1); });
