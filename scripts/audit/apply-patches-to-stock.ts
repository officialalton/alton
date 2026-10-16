// 라운드 2(D5): DB 에 없는 문항(R-* 7건·D-* 3건 + D-309f9901)의 "저장소 원본"에 라운드 1 패치의 새 지문을 반영한다 — 이 원본을 다시 임포트해도 결함이 되살아나지 않게 한다. 로컬 파일만 읽고 쓴다.
//   npx tsx scripts/audit/apply-patches-to-stock.ts            (미리보기)   |  --write  (파일에 쓴다)
// 파일 포맷을 보존하려고 JSON 파싱·재직렬화 대신 문자열 단위 치환을 쓴다(옛 지문이 파일 안에 정확히 기대한 횟수만큼 있어야 한다). 멱등: 이미 새 지문이면 건너뛴다.
import { readFileSync, writeFileSync } from "node:fs";

export const STOCK_ONLY_PATCH_IDS = [
  "R-d61e2d5e-4967-4995-bb5d-e6b76c7f9c7f", "R-45bc6500-05da-4836-866c-7a5994191c88", "R-f4dcff2e-6c99-4dad-bef6-8af843033ac9", "R-04f6acc4-4938-437e-bf33-bcb857df8185",
  "R-51fc09b3-4755-4fab-99e1-9633bcf8d8a5", "R-ef96f2f7-8419-4ac7-95c4-9188ff97ae3b", "R-be9e745f-1fc6-4071-b448-96a1927213dd",
  "D-d69794f8", "D-b43f2d6a", "D-0debec47", "D-309f9901",
];
type Ch = { field: string; old?: string; new?: string };
type P = { id: string; repoSource?: string; changes: Ch[] };

export function planStockFix(patches: P[], readFile: (f: string) => string): { file: string; patchId: string; status: "apply" | "already" | "error"; detail: string; from?: string; to?: string }[] {
  const texts = new Map<string, string>();
  const out: ReturnType<typeof planStockFix> = [];
  for (const id of STOCK_ONLY_PATCH_IDS) {
    const p = patches.find((x) => x.id === id);
    const ch = p?.changes.find((c) => c.field === "passage");
    if (!p || !p.repoSource || !ch?.old || !ch.new) { out.push({ file: p?.repoSource ?? "?", patchId: id, status: "error", detail: "patch without repoSource/passage change" }); continue; }
    if (!texts.has(p.repoSource)) texts.set(p.repoSource, readFile(p.repoSource));
    const t = texts.get(p.repoSource)!;
    const from = JSON.stringify(ch.old).slice(1, -1), to = JSON.stringify(ch.new).slice(1, -1);
    const nOld = t.split(from).length - 1, nNew = t.split(to).length - 1;
    if (nOld === 0 && nNew > 0) out.push({ file: p.repoSource, patchId: id, status: "already", detail: `new passage present ${nNew}x` });
    else if (nOld >= 1 && nOld <= 2) { out.push({ file: p.repoSource, patchId: id, status: "apply", detail: `old passage ${nOld}x (passage${nOld === 2 ? " + stimulus" : ""})`, from, to }); texts.set(p.repoSource, t.split(from).join(to)); }
    else out.push({ file: p.repoSource, patchId: id, status: "error", detail: `old passage occurs ${nOld}x (expected 1-2)` });
  }
  return out;
}

if (process.argv[1]?.endsWith("apply-patches-to-stock.ts")) {
  const patches = (JSON.parse(readFileSync("data/audit/2026-10-13-sat-patch-list.json", "utf-8")) as { patches: P[] }).patches;
  const res = planStockFix(patches, (f) => readFileSync(f, "utf-8"));
  for (const r of res) console.log(`[${r.patchId}] ${r.status} - ${r.detail}`);
  if (res.some((r) => r.status === "error")) { console.error("errors - nothing written"); process.exit(1); }
  if (process.argv.includes("--write")) {
    const byFile = new Map<string, string>();
    for (const r of res) if (r.status === "apply") { const t = byFile.get(r.file) ?? readFileSync(r.file, "utf-8"); byFile.set(r.file, t.split(r.from!).join(r.to!)); }
    for (const [f, t] of byFile) { writeFileSync(f, t); console.log(`wrote ${f}`); }
  }
}
