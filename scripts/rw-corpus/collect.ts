import { validateContact } from "./contact";
// 원문 코퍼스 수집기 — **오너가 터미널에서 직접 실행**(에이전트 실행 금지). 기본 dry-run, `--execute` 로 실제 수집.
//  - 매니페스트에서 approved=true 인 원천의 공식 경로(http API/파일, 공식 rsync 미러)만. 링크 따라가기·스크래핑 없음.
//  - 안전: User-Agent 에 연락처(CORPUS_CONTACT), 원천별 요청 간격(delayMs), 원천별·전체 용량 상한(maxTotalMB·globalMaxMB), 저장 경로가 저장소·iCloud 밖인지 검사,
//    디스크 여유 minFreeDiskGB 미만이면 중단, 번역본·미승인 원천 거부, 재개 가능(.meta.json 있는 항목은 건너뜀), 5xx·429 지수 백오프 3회.
//  - 받을 때마다 출처·라이선스·URL·시각·SHA-256 을 `<대상>.meta.json` 으로 기록(rsync 는 디렉터리 해시).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, statfsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { Row } from "./lists";

export type Source = { id: string; license: string; licenseEvidenceUrl: string; delayMs: number; approved: boolean; maxTotalMB?: number };
export type Manifest = { storageRoot: string; userAgent: string; globalMaxMB?: number; minFreeDiskGB?: number; sources: Source[] };
export type Plan = { allowed: Row[]; rejected: string[]; skipped: number; estMB: number; perSource: Record<string, { files: number; estMB: number }> };

/** 저장 경로 안전 검사: 저장소 안·iCloud(Mobile Documents/CloudDocs) 금지. */
export function checkRoot(root: string, repoRoot: string): string | null {
  const r = path.resolve(root), repo = path.resolve(repoRoot);
  if (r === repo || r.startsWith(repo + path.sep)) return "저장 경로가 저장소 안입니다(원문 본문은 저장소에 두지 않는다)";
  if (/Mobile Documents|CloudDocs|iCloud/i.test(r)) return "저장 경로가 iCloud 입니다";
  return null;
}
/** 순수 계획 함수 — 네트워크·디스크 쓰기 없음(exists 주입). dry-run 과 execute 가 같은 계획을 쓴다. */
export function planRows(manifest: Manifest, rows: Row[], root: string, exists: (p: string) => boolean): Plan {
  const by = new Map(manifest.sources.map((s) => [s.id, s]));
  const plan: Plan = { allowed: [], rejected: [], skipped: 0, estMB: 0, perSource: {} };
  const used: Record<string, number> = {};
  for (const row of rows) {
    const src = by.get(row.sourceId);
    const tag = row.url ?? row.rsyncSource ?? row.relPath;
    if (!src) { plan.rejected.push(`${tag}: 매니페스트에 없는 원천`); continue; }
    if (!src.approved) { plan.rejected.push(`${tag}: ${src.id} 미승인(approved=false)`); continue; }
    if (row.isTranslation) { plan.rejected.push(`${tag}: 번역본 제외`); continue; }
    const method = row.method ?? "http";
    if (method === "http" && !/^https:\/\//.test(row.url ?? "")) { plan.rejected.push(`${tag}: https 가 아닌 URL`); continue; }
    if (method === "rsync" && !/^rsync\.ibiblio\.org::gutenberg\//.test(row.rsyncSource ?? "")) { plan.rejected.push(`${tag}: 공식 미러(rsync.ibiblio.org::gutenberg) 밖의 rsync 경로`); continue; }
    const dest = path.join(root, row.relPath);
    if (!path.resolve(dest).startsWith(path.resolve(root) + path.sep)) { plan.rejected.push(`${row.relPath}: 저장 경로가 storageRoot 밖`); continue; }
    if (exists(`${dest.replace(/\/$/, "")}.meta.json`)) { plan.skipped++; continue; }
    const e = row.estMB ?? 0.5;
    if (src.maxTotalMB !== undefined && (used[src.id] ?? 0) + e > src.maxTotalMB) { plan.rejected.push(`${tag}: ${src.id} 원천 용량 상한(${src.maxTotalMB}MB) 초과`); continue; }
    if (manifest.globalMaxMB !== undefined && plan.estMB + e > manifest.globalMaxMB) { plan.rejected.push(`${tag}: 전체 용량 상한(${manifest.globalMaxMB}MB) 초과`); continue; }
    used[src.id] = (used[src.id] ?? 0) + e;
    plan.estMB += e;
    plan.allowed.push(row);
    const ps = (plan.perSource[src.id] ??= { files: 0, estMB: 0 });
    ps.files++; ps.estMB = Math.round((ps.estMB + e) * 10) / 10;
  }
  plan.estMB = Math.round(plan.estMB * 10) / 10;
  return plan;
}
export const dirSizeBytes = (p: string): number => {
  if (!existsSync(p)) return 0;
  const st = statSync(p);
  if (!st.isDirectory()) return st.size;
  return readdirSync(p).reduce((a, f) => a + dirSizeBytes(path.join(p, f)), 0);
};
export function freeDiskGB(p: string): number { const s = statfsSync(p); return (s.bavail * s.bsize) / 1024 ** 3; }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const repoRoot = path.resolve(__dirname, "../..");
  const manifest = JSON.parse(readFileSync(process.env.RW_CORPUS_MANIFEST ?? path.join(repoRoot, "data/mock-exam-generation/rw-corpus/manifest.json"), "utf-8")) as Manifest;
  const root = (process.env.RW_CORPUS_ROOT ?? manifest.storageRoot).replace(/^~/, os.homedir());
  const execute = process.argv.includes("--execute");
  const listPaths = (arg("--list") ?? "").split(",").filter(Boolean);
  if (!listPaths.length) throw new Error("--list a.jsonl[,b.jsonl,…] 필요");
  const rows = listPaths.flatMap((l) => readFileSync(path.resolve(l), "utf-8").split("\n").filter(Boolean).map((x) => JSON.parse(x) as Row));
  const bad = checkRoot(root, repoRoot);
  if (bad) throw new Error(bad);
  mkdirSync(root, { recursive: true });
  const free = freeDiskGB(root), minFree = manifest.minFreeDiskGB ?? 20;
  const plan = planRows(manifest, rows, root, existsSync);
  const needRsync = plan.allowed.some((r) => r.method === "rsync");
  const hasRsync = !needRsync || spawnSync("rsync", ["--version"]).status === 0;
  const contact = process.env.CORPUS_CONTACT;
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", storageRoot: root, freeDiskGB: +free.toFixed(1), minFreeDiskGB: minFree, rsyncAvailable: hasRsync, contactSet: Boolean(contact), planned: plan.allowed.length, estimatedMB: plan.estMB, perSource: plan.perSource, skippedExisting: plan.skipped, rejectedCount: plan.rejected.length, rejected: plan.rejected.slice(0, 15) }, null, 1));
  if (!execute) return;
  if (free < minFree) throw new Error(`디스크 여유 ${free.toFixed(1)}GB < ${minFree}GB — 중단`);
  const contactErr = validateContact(contact);
  if (contactErr) throw new Error(contactErr);
  if (!hasRsync) throw new Error("rsync 가 없습니다");
  const ua = manifest.userAgent.replace("contact via CORPUS_CONTACT env", `contact ${contact}`);
  if (/[^\x20-\x7e]/.test(ua)) throw new Error("User-Agent 에 비ASCII 문자가 있습니다 — CORPUS_CONTACT 를 영문 이메일로 지정하세요");
  const srcById = new Map(manifest.sources.map((s) => [s.id, s]));
  const fail: string[] = [];
  let done = 0, lastAt = 0;
  for (const row of plan.allowed) {
    const src = srcById.get(row.sourceId)!;
    const dest = path.join(root, row.relPath);
    // 용량 상한(실측): 원천별·전체
    const usedSrc = dirSizeBytes(path.join(root, row.sourceId)) / 1024 ** 2;
    const usedAll = manifest.sources.reduce((a, s) => a + dirSizeBytes(path.join(root, s.id)), 0) / 1024 ** 2;
    if ((src.maxTotalMB !== undefined && usedSrc > src.maxTotalMB) || (manifest.globalMaxMB !== undefined && usedAll > manifest.globalMaxMB)) { fail.push(`${row.relPath}: 용량 상한 도달 — 중단`); break; }
    if (freeDiskGB(root) < minFree) { fail.push("디스크 여유 부족 — 중단"); break; }
    const wait = Math.max(0, lastAt + src.delayMs - Date.now());
    if (wait) await sleep(wait);
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        if ((row.method ?? "http") === "rsync") {
          mkdirSync(dest, { recursive: true });
          const r = spawnSync("rsync", ["-a", "--include=*.txt", "--exclude=*", "--max-size=3m", "--timeout=60", row.rsyncSource!, `${dest}/`], { encoding: "utf-8" });
          lastAt = Date.now();
          if (r.status !== 0) { await sleep(2000 * 2 ** a); continue; }
          const files = readdirSync(dest).filter((f) => f.endsWith(".txt"));
          if (!files.length) { fail.push(`${row.rsyncSource}: .txt 없음`); break; }
          const h = createHash("sha256");
          for (const f of files.sort()) h.update(readFileSync(path.join(dest, f)));
          writeFileSync(`${dest}.meta.json`, JSON.stringify(meta(row, src, `https://www.gutenberg.org/ebooks/${path.basename(row.relPath)}`, h.digest("hex"), dest), null, 1));
          ok = true;
        } else {
          const res = await fetch(row.url!, { headers: { "User-Agent": ua } });
          lastAt = Date.now();
          if (res.status === 429 || res.status >= 500) { await sleep(3000 * 2 ** a); continue; }
          if (!res.ok) { fail.push(`${row.url}: HTTP ${res.status}`); break; }
          const body = Buffer.from(await res.arrayBuffer());
          mkdirSync(path.dirname(dest), { recursive: true });
          writeFileSync(dest, body);
          writeFileSync(`${dest}.meta.json`, JSON.stringify(meta(row, src, row.url!, createHash("sha256").update(body).digest("hex"), dest), null, 1));
          ok = true;
        }
        done++;
      } catch (e) { await sleep(2000 * 2 ** a); if (a === 2) fail.push(`${row.url ?? row.rsyncSource}: ${(e as Error).message}`); }
    }
  }
  console.log(JSON.stringify({ collected: done, failed: fail.length, failures: fail.slice(0, 20) }, null, 1));
}
const meta = (row: Row, src: Source, url: string, sha: string, dest: string) => ({ corpusId: `${row.sourceId}:${path.basename(row.relPath)}`, sourceId: row.sourceId, author: row.author ?? null, work: row.work ?? "", publishedYear: row.publishedYear ?? null, authorDeathYear: row.authorDeathYear ?? null, isTranslation: false, sourceUrl: url, license: src.license, licenseEvidenceUrl: src.licenseEvidenceUrl, attribution: row.attribution ?? null, retrievedAt: new Date().toISOString(), sha256: sha, textPath: dest, koreaCopyrightChecked: false });
if (require.main === module) main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
