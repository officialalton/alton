// hard 채택분 병합·중복 제거 (2026-09-30). DB·API 호출 없음.
// 실행: npx tsx scripts/mock-exam-generation/merge-adopted.ts  -> <run>/final/adopted-hard-all.json + 보고(콘솔)
//   입력 순서(앞이 우선): batch2/D-cross(①의 25건) -> batch3/pilot(10건) -> batch3/stage2a -> batch3/stage2b.
//   gid 는 출처별로 재부여(`<출처>:<원래 gid>`). 같은 skill 안에서 본문(3-gram, 숫자 마스킹) 유사도 0.6 이상이면 뒤쪽을 제외하고,
//   기존 통과 문항(final/passed.json)과의 유사도도 같은 기준으로 검사한다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const RUN = path.resolve("data/mock-exam-generation/mockgen-20260929");
const SOURCES = ["batch2/D-cross", "batch3/pilot", "batch3/stage2a", "batch3/stage2b"];
type Rec = { gid: string; skill: string; examSystem: string; recipeId: string | null; problem: { stimulus?: string | null; passage?: string | null; question?: string | null; options?: string[] | null; explanation?: string }; quality: unknown; source?: string; [k: string]: unknown };
const words = (r: Rec) => `${r.problem.stimulus ?? r.problem.passage ?? ""} ${r.problem.question ?? ""} ${(r.problem.options ?? []).join(" ")}`.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s]+/g, " ").split(/\s+/).filter(Boolean);
const shingles = (w: string[]) => { const s = new Set<string>(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s; };
const jac = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
const all: Rec[] = [];
for (const src of SOURCES) { const f = path.join(RUN, src, "adopted-hard.json"); if (!existsSync(f)) continue; for (const r of JSON.parse(readFileSync(f, "utf-8")) as Rec[]) all.push({ ...r, gid: `${src.replace("/", "-")}:${r.gid}`, source: src }); }
const existing = (JSON.parse(readFileSync(path.join(RUN, "final/passed.json"), "utf-8")) as Rec[]).map((r) => ({ skill: r.skill, gid: r.gid, sh: shingles(words(r)) }));
const kept: { r: Rec; sh: Set<string> }[] = [];
const dropped: { gid: string; of: string; score: number; kind: string }[] = [];
for (const r of all) {
  const sh = shingles(words(r));
  const dup = kept.find((k) => k.r.skill === r.skill && jac(sh, k.sh) >= 0.6);
  if (dup) { dropped.push({ gid: r.gid, of: dup.r.gid, score: +jac(sh, dup.sh).toFixed(2), kind: "adopted 간 중복" }); continue; }
  const ex = existing.find((e) => e.skill === r.skill && jac(sh, e.sh) >= 0.6);
  if (ex) { dropped.push({ gid: r.gid, of: ex.gid, score: +jac(sh, ex.sh).toFixed(2), kind: "기존 통과 문항과 유사" }); continue; }
  kept.push({ r, sh });
}
writeFileSync(path.join(RUN, "final/adopted-hard-all.json"), JSON.stringify(kept.map((k) => k.r), null, 1));
const bySkill: Record<string, number> = {};
for (const k of kept) bySkill[k.r.skill] = (bySkill[k.r.skill] ?? 0) + 1;
console.log(JSON.stringify({ input: all.length, kept: kept.length, dropped, bySkill, bySource: Object.fromEntries(SOURCES.map((s) => [s, kept.filter((k) => k.r.source === s).length])) }, null, 1));
