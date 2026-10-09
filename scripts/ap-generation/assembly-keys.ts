// 실조립 준비(무료·DB 없음): exact-assign 보고서 -> 세트별 선택 파일(`assemble-ap-set.ts --keys-file` 형식) 내보내기 + 독립 검증.
//   export: npx tsx scripts/ap-generation/assembly-keys.ts export --report <exact-assign 보고서.json> --out-dir data/ap/stock/assembled
//           세트마다 <out-dir>/<세트>.keys.json = {set, keys:{mcA,mcB,frqA,frqB}}. 이미 있는 파일은 덮어쓰지 않는다(없을 때만 생성). AB#1(게시) 은 내보내지 않는다.
//   verify: npx tsx scripts/ap-generation/assembly-keys.ts verify --files a.keys.json,b.keys.json [--verified-keys <DB 검증 완료 키 목록>]
//           배정기(solver)와 별개로 재고를 다시 읽어 verifyAssignment 로 전 조건(게시 AB#1·세트 간 동일 문항 0, 문항군 1, 단원·스킬·계산기·그래프 하한, FRQ 6 서로 다른 유형, BC 전용 2) 재확인.
//           --verified-keys 가 있으면 모든 키가 그 목록(= DB 에서 render·screen 검증 기록이 확인된 키)에 있어야 통과. STRUCTURE_GROUPS_FILE 로 문항군 묶음 파일을 고른다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { verifyAssignment, type SetResult, type Spec } from "./exact-assign";
import { loadPool, published, type Item } from "./assign-pool";

type Keys = { mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] };
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SET_RE = /^(AB|BC)\d$/;

export function exportKeys(report: { sets: (Keys & { id: string; virtual?: unknown[]; frqVirtual?: unknown[] })[] }, outDir: string): string[] {
  mkdirSync(outDir, { recursive: true }); const made: string[] = [];
  for (const s of report.sets) {
    if (!SET_RE.test(s.id) || s.id === "AB1") throw new Error(`세트 ${s.id}: AB#1 은 게시 고정이라 내보내지 않는다.`);
    if (s.virtual?.length || s.frqVirtual?.length) throw new Error(`세트 ${s.id}: 가상 문항이 있어 조립 파일을 만들지 않는다.`);
    const f = path.join(outDir, `${s.id}.keys.json`);
    if (/ab-full-set-selection/.test(f) || existsSync(f)) throw new Error(`${f} 가 이미 있다(덮어쓰기 금지). 새 디렉터리를 쓰라.`);
    writeFileSync(f, JSON.stringify({ set: s.id, keys: { mcA: s.mcA, mcB: s.mcB, frqA: s.frqA, frqB: s.frqB } }, null, 1)); made.push(f);
  }
  return made;
}

export function verifyFiles(files: string[], o: { verified?: Set<string>; floor?: number } = {}): string[] {
  const { all } = loadPool({ strictFamilies: true }); const byKey = new Map<string, Item>(all.filter((c) => c.screen).map((c) => [c.key, c]));
  const pub = published(); const blocked = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
  const sets: Spec[] = []; const res: SetResult[] = []; const bad: string[] = [];
  for (const f of files) {
    const j = JSON.parse(readFileSync(f, "utf-8")) as { set: string; keys: Keys }; sets.push({ id: j.set, subj: j.set.startsWith("BC") ? "bc" : "ab", floor: o.floor ?? 10 });
    const get = (ks: string[]) => ks.map((k) => { const c = byKey.get(k); if (!c) bad.push(`${j.set}: 재고(화면 증거 보유)에 없는 키 ${k}`); if (o.verified && !o.verified.has(k)) bad.push(`${j.set}: DB 검증 목록에 없음 ${k}`); return c; }).filter((c): c is Item => !!c);
    res.push({ id: j.set, mcA: get(j.keys.mcA), mcB: get(j.keys.mcB), frqA: get(j.keys.frqA), frqB: get(j.keys.frqB), virtual: [], frqVirtual: [] });
  }
  return [...bad, ...verifyAssignment(sets, res, blocked)];
}

if (process.argv[1]?.endsWith("assembly-keys.ts")) {
  const cmd = process.argv[2];
  if (cmd === "export") { for (const f of exportKeys(JSON.parse(readFileSync(arg("--report"), "utf-8")), arg("--out-dir", "data/ap/stock/assembled"))) console.log(`생성: ${f}`); }
  else if (cmd === "verify") {
    const v = arg("--verified-keys") ? new Set(JSON.parse(readFileSync(arg("--verified-keys"), "utf-8")) as string[]) : undefined;
    const bad = verifyFiles(arg("--files").split(","), { verified: v }); console.log(`독립 검증 위반: ${bad.length ? bad.join("; ") : "0"}`); process.exit(bad.length ? 1 : 0);
  } else { console.error("사용: export|verify"); process.exit(2); }
}
