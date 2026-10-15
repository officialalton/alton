// 빌드 산출물(.next)의 PDF 라우트 추적 목록만으로 pdf.js 가 워커를 찾아 PDF 를 읽는지 확인한다(next.config.ts PDF_ROUTES).
//   npx next build && npx tsx scripts/verify-pdf-trace.ts
// 각 라우트의 *.nft.json 에 적힌 파일만 빈 폴더에 복사하고(심볼릭 제외), 거기서 lib/curriculum-assets/pdf.ts·lib/universities/crawler.ts 와 같은 방식
// (createRequire(...).resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs"))으로 워커를 찾아 표본 PDF 의 페이지 수·텍스트를 읽는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildSamplePdf } from "../lib/curriculum-assets/sample-pdf";

const root = process.cwd();
const cfg = fs.readFileSync("next.config.ts", "utf-8");
const routes = [...(/const PDF_ROUTES = \[([^\]]*)\]/.exec(cfg)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
if (!routes.length) throw new Error("PDF_ROUTES 를 읽지 못했습니다.");
const nfts: string[] = [];
const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "page.js.nft.json") nfts.push(p); } };
walk(".next/server/app");
const routeRe = (r: string) => new RegExp("^\\.next/server/app" + r.replace(/\/page$/, "").replace(/\*/g, "\\[[^/]+\\]") + "/page\\.js\\.nft\\.json$");
const sample = buildSamplePdf(["Hello trace", "Page two"]);
let failures = 0;
for (const r of routes) {
  const hit = nfts.filter((f) => routeRe(r).test(f));
  if (!hit.length) { console.log(`FAIL ${r}: 빌드 trace 없음`); failures++; continue; }
  for (const f of hit) {
    const files = (JSON.parse(fs.readFileSync(f, "utf-8")) as { files: string[] }).files.map((x) => path.resolve(path.dirname(f), x));
    const hasWorker = files.some((x) => x.endsWith("pdfjs-dist/legacy/build/pdf.worker.min.mjs")), hasMain = files.some((x) => x.endsWith("pdfjs-dist/legacy/build/pdf.mjs"));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pdftrace-"));
    for (const x of files) { if (!x.startsWith(root + "/node_modules/")) continue; const st = fs.lstatSync(x); if (!st.isFile()) continue; const dst = path.join(tmp, path.relative(root, x)); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(x, dst); }
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }));
    fs.writeFileSync(path.join(tmp, "probe.mjs"), `import { createRequire } from "node:module";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const req = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = req.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const data = new Uint8Array(Buffer.from(process.argv[2], "base64"));
const doc = await pdfjs.getDocument({ data, disableFontFace: true, verbosity: 0 }).promise;
const page = await doc.getPage(1); const t = (await page.getTextContent()).items.map((i) => i.str).join(" ");
console.log(JSON.stringify({ pages: doc.numPages, text: t }));
process.exit(0);
`);
    let out = ""; try { out = execFileSync("node", ["probe.mjs", Buffer.from(sample).toString("base64")], { cwd: tmp, encoding: "utf-8", timeout: 60000 }).trim(); } catch (e) { out = "ERR " + String((e as Error).message).slice(0, 200); }
    const ok = hasWorker && hasMain && out.startsWith("{") && JSON.parse(out).pages === 2 && JSON.parse(out).text.includes("Hello trace");
    console.log(`${ok ? "ok  " : "FAIL"} ${r}  trace=${path.relative(root, f)} worker=${hasWorker} main=${hasMain} -> ${out}`);
    if (!ok) failures++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(failures ? `실패 ${failures}건` : "모든 PDF 라우트 통과");
process.exitCode = failures ? 1 : 0;
