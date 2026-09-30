// 원문 코퍼스 수집기(초안 — **실행은 총괄 승인 후**, 기본은 dry-run). 매니페스트(data/mock-exam-generation/rw-corpus/manifest.json) 기반.
//  - approved=true 인 원천만, 허용된 접근 방식(공식 미러·API·카탈로그·피드·bulk)에서 온 '다운로드 목록'(JSONL)만 받는다. 웹사이트 스크래핑·링크 따라가기 없음.
//  - 재개 가능: 이미 받은 파일(.meta.json 있음)은 건너뜀. 요청 간 지연(delayMs), User-Agent 명시, 호스트 허용 목록, 실패 재시도 3회(지수 백오프).
//  - 받을 때마다 라이선스·출처 메타(.meta.json: sourceUrl·license·licenseEvidenceUrl·retrievedAt·sha256·attribution)를 자동 기록. 본문은 storageRoot(저장소 밖)에만 저장.
// 다운로드 목록 행: {"sourceId":"gutenberg","url":"https://…","relPath":"gutenberg/1234.txt","attribution":null,"author":"…","work":"…","publishedYear":1898,"authorDeathYear":1920,"isTranslation":false}
// 실행 예: CORPUS_CONTACT=… npx tsx scripts/rw-corpus/collect.ts --list list.jsonl            (dry-run: 받을 목록·예상 용량·거부 사유만 출력)
//          CORPUS_CONTACT=… npx tsx scripts/rw-corpus/collect.ts --list list.jsonl --execute  (승인된 원천만 실제 다운로드)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

type Source = { id: string; license: string; licenseEvidenceUrl: string; delayMs: number; approved: boolean; access: string };
type Row = { sourceId: string; url: string; relPath: string; attribution?: string | null; author?: string | null; work?: string; publishedYear?: number | null; authorDeathYear?: number | null; isTranslation?: boolean };
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const manifest = JSON.parse(readFileSync("data/mock-exam-generation/rw-corpus/manifest.json", "utf-8")) as { storageRoot: string; userAgent: string; sources: Source[] };
  const root = manifest.storageRoot.replace(/^~/, os.homedir());
  const contact = process.env.CORPUS_CONTACT;
  const execute = process.argv.includes("--execute");
  if (execute && !contact) throw new Error("CORPUS_CONTACT(연락처) 환경변수 필요 — User-Agent 에 넣는다");
  const ua = manifest.userAgent.replace("CORPUS_CONTACT env", contact ?? "unset");
  const list = readFileSync(path.resolve(arg("--list") ?? ""), "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
  const bySource = new Map(manifest.sources.map((s) => [s.id, s]));
  const plan = { allowed: 0, rejected: [] as string[], skipped: 0 };
  let lastAt = 0;
  for (const row of list) {
    const src = bySource.get(row.sourceId);
    if (!src) { plan.rejected.push(`${row.url}: 매니페스트에 없는 원천`); continue; }
    if (!src.approved) { plan.rejected.push(`${row.url}: ${src.id} 미승인(approved=false)`); continue; }
    if (row.isTranslation) { plan.rejected.push(`${row.url}: 번역본 제외`); continue; }
    const dest = path.join(root, row.relPath);
    if (!path.resolve(dest).startsWith(path.resolve(root))) { plan.rejected.push(`${row.relPath}: 저장 경로가 storageRoot 밖`); continue; }
    if (existsSync(`${dest}.meta.json`)) { plan.skipped++; continue; }
    plan.allowed++;
    if (!execute) continue;
    // 속도 제한: 원천별 delayMs 이상 간격.
    const wait = Math.max(0, lastAt + src.delayMs - Date.now());
    if (wait) await sleep(wait);
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const res = await fetch(row.url, { headers: { "User-Agent": ua } });
        lastAt = Date.now();
        if (res.status === 429 || res.status >= 500) { await sleep(2000 * 2 ** a); continue; }
        if (!res.ok) { plan.rejected.push(`${row.url}: HTTP ${res.status}`); break; }
        const body = Buffer.from(await res.arrayBuffer());
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, body);
        writeFileSync(`${dest}.meta.json`, JSON.stringify({ corpusId: `${row.sourceId}:${path.basename(row.relPath)}`, sourceId: row.sourceId, author: row.author ?? null, work: row.work ?? "", publishedYear: row.publishedYear ?? null, authorDeathYear: row.authorDeathYear ?? null, isTranslation: false, sourceUrl: row.url, license: src.license, licenseEvidenceUrl: src.licenseEvidenceUrl, attribution: row.attribution ?? null, retrievedAt: new Date().toISOString(), sha256: createHash("sha256").update(body).digest("hex"), textPath: dest, koreaCopyrightChecked: false }, null, 1));
        ok = true;
      } catch (e) { await sleep(2000 * 2 ** a); if (a === 2) plan.rejected.push(`${row.url}: ${(e as Error).message}`); }
    }
  }
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", total: list.length, ...plan, rejected: plan.rejected.slice(0, 20), rejectedCount: plan.rejected.length }, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
