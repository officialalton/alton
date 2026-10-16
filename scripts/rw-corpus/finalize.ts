// 수집 후처리 CLI(네트워크 없음) — 오너가 run.sh 끝에서 실행되거나 따로 실행. 요약(원천별 항목 수·용량·제외 사유·라이선스 분포)을 출력하고 summary.json 으로 남긴다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pickGutenbergFile, stripGutenberg, medlineItems, plosItems, type Item } from "./postprocess";

const repoRoot = path.resolve(__dirname, "../..");
const manifest = JSON.parse(readFileSync(path.join(repoRoot, "data/mock-exam-generation/rw-corpus/manifest.json"), "utf-8")) as { storageRoot: string; sources: { id: string; license: string; licenseEvidenceUrl: string }[] };
const root = manifest.storageRoot.replace(/^~/, os.homedir());
const srcMeta = (id: string) => manifest.sources.find((s) => s.id === id)!;
const summary: Record<string, { items: number; bytes: number; excluded: Record<string, number>; licenses: Record<string, number> }> = {};
const S = (id: string) => (summary[id] ??= { items: 0, bytes: 0, excluded: {}, licenses: {} });
const excl = (id: string, why: string) => (S(id).excluded[why] = (S(id).excluded[why] ?? 0) + 1);
function writeItem(sourceId: string, it: Item, base: Record<string, unknown>) {
  const dir = path.join(root, "items", sourceId);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${it.id}.txt`);
  writeFileSync(file, it.text);
  const sm = srcMeta(sourceId);
  writeFileSync(`${file}.meta.json`, JSON.stringify({ ...base, corpusId: `${sourceId}:${it.id}`, sourceId, work: it.title || base.work, sourceUrl: it.url ?? base.sourceUrl, license: sm.license, licenseEvidenceUrl: sm.licenseEvidenceUrl, textSha256: createHash("sha256").update(it.text).digest("hex"), wordCount: it.text.split(/\s+/).length, textPath: file, extra: it.extra ?? null }, null, 1));
  const s = S(sourceId); s.items++; s.bytes += Buffer.byteLength(it.text); s.licenses[sm.license] = (s.licenses[sm.license] ?? 0) + 1;
}
// Gutenberg
const gRaw = path.join(root, "gutenberg/raw");
if (existsSync(gRaw)) for (const d of readdirSync(gRaw)) {
  const dir = path.join(gRaw, d);
  if (!statSync(dir).isDirectory()) continue;
  const metaF = `${dir}.meta.json`;
  if (!existsSync(metaF)) { excl("gutenberg", "메타 없음(수집 미완료)"); continue; }
  const meta = JSON.parse(readFileSync(metaF, "utf-8")) as Record<string, unknown>;
  const pick = pickGutenbergFile(readdirSync(dir), d);
  if (!pick) { excl("gutenberg", ".txt 없음"); continue; }
  const body = stripGutenberg(readFileSync(path.join(dir, pick), "utf-8"));
  if (!body) { excl("gutenberg", "머리·꼬리 고지 없음 또는 본문 짧음"); continue; }
  writeItem("gutenberg", { id: `gutenberg-${d}`, title: String(meta.work ?? ""), text: body }, meta);
}
// MedlinePlus
const mRaw = path.join(root, "medlineplus/raw");
if (existsSync(mRaw)) for (const f of readdirSync(mRaw).filter((x) => x.endsWith(".xml"))) {
  const meta = existsSync(path.join(mRaw, `${f}.meta.json`)) ? (JSON.parse(readFileSync(path.join(mRaw, `${f}.meta.json`), "utf-8")) as Record<string, unknown>) : null;
  if (!meta) { excl("medlineplus", "메타 없음"); continue; }
  const date = /(\d{4}-\d{2}-\d{2})/.exec(f)?.[1] ?? "";
  for (const it of medlineItems(readFileSync(path.join(mRaw, f), "utf-8"), date)) writeItem("medlineplus", it, meta);
}
// PLOS
const pRaw = path.join(root, "plos/raw");
if (existsSync(pRaw)) for (const f of readdirSync(pRaw).filter((x) => x.endsWith(".json") && !x.endsWith(".meta.json"))) {
  const meta = existsSync(path.join(pRaw, `${f}.meta.json`)) ? (JSON.parse(readFileSync(path.join(pRaw, `${f}.meta.json`), "utf-8")) as Record<string, unknown>) : null;
  if (!meta) { excl("plos", "메타 없음"); continue; }
  for (const it of plosItems(readFileSync(path.join(pRaw, f), "utf-8"))) writeItem("plos", it, meta);
}
for (const v of Object.values(summary)) (v as { MB?: number }).MB = Math.round((v.bytes / 1024 ** 2) * 10) / 10;
writeFileSync(path.join(root, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
