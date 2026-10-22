// 5세트 채우기(2026-10-21 오너 정리): 세트 간 금지 대상 = 동일 문항 + 구조 look-alike(같은 자료 구조·풀이 단계, 숫자·이름·문장만 다름). 평가 유형·스킬·코드 원형 자체는 금지하지 않는다.
// 이 스크립트는 공개 세트의 문항군(look-alike 군집 fam)·원형+토픽 키만 막고(원형 id 전체 차단 CHEM_BLOCK_ARCH 는 쓰지 않음) CH4,CH5 부족분을 센다. 읽기 전용·무료·DB 없음.
//   npx tsx scripts/ap-generation/chem-structure-block.ts [--cases N] [--write-report <경로>] [--sets CH4,CH5]
import { readFileSync, writeFileSync } from "node:fs";
import { loadRaws, sameStructure } from "./structure-compare";
const RAW = loadRaws();
import { loadChemPool, type ChemItem } from "./chem-pool";
import { LIB_SINGLES, LIB_SETS, solveChemSets, verifyChemAssignment, toReportSet, type ChemResult } from "./chem-assign";
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const pub = new Set<string>((JSON.parse(readFileSync("data/ap/stock/blocked-db-chem.json", "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets.flatMap((s) => [...(s.mcA ?? []), ...(s.frqA ?? [])]));
const { all } = loadChemPool({ requireScreen: false });
const pubItems = all.filter((c) => pub.has(c.key));
const atKey = (c: ChemItem) => (c.shared ? c.archetype : `${c.archetype}|${c.members[0]?.topic}`);
const pubFam = new Set(pubItems.map((c) => c.fam)), pubAT = new Set(pubItems.map(atKey)), pubArch = new Set(pubItems.map((c) => c.archetype));
const lookAlike = all.filter((c) => !pub.has(c.key) && pubFam.has(c.fam));            // 정책상 금지(구조 동일)
const sameKey = all.filter((c) => !pub.has(c.key) && !pubFam.has(c.fam) && pubAT.has(atKey(c))); // 원형+토픽이 같아 보수적으로 같은 군(금지)
const strictOnly = all.filter((c) => !pub.has(c.key) && !pubFam.has(c.fam) && !pubAT.has(atKey(c)) && pubArch.has(c.archetype)); // 원형만 같고 구조·토픽이 다름 = 허용
console.log(`공개 문항 ${pubItems.length}/${pub.size}(풀에 있는 것), 공개 군 ${pubFam.size}, 공개 원형 ${pubArch.size}`);
console.log(`재고(공개 제외) look-alike 금지 ${lookAlike.length}, 원형+토픽 동일 금지 ${sameKey.length}, 원형만 같아 엄격 규칙에선 막히나 정책상 허용 ${strictOnly.length}`);
const stem = (c: ChemItem) => c.key;
const nCase = Number(arg("--cases", "3"));
const show = (title: string, xs: ChemItem[]) => { console.log(`## ${title}`); for (const c of xs.slice(0, nCase)) { const p = pubItems.find((q) => q.fam === c.fam) ?? pubItems.find((q) => q.archetype === c.archetype); console.log(`- 후보 ${stem(c)} [${c.archetype} ${c.members[0]?.topic}] ↔ 공개 ${p ? stem(p) + ` [${p.archetype} ${p.members[0]?.topic}]` : "?"}`); } };
show("구조 동일(금지)", lookAlike); show("원형+토픽 동일(보수적 금지)", sameKey); show("원형만 동일, 토픽·구조 다름(허용)", strictOnly);
// 배정
const recov = new Set<string>((JSON.parse(readFileSync("data/ap/stock/lookalike-recheck-chem.json", "utf-8")) as { recoverable: string[] }).recoverable); // lookalike-recheck.ts: 자료·조건·과제가 달라 복구된 후보
const blockedKeys = new Set<string>([...pub, ...lookAlike.map((c) => c.key), ...sameKey.map((c) => c.key)].filter((k) => !recov.has(k)));
for (const k of (arg("--extra-block") ? (JSON.parse(readFileSync(arg("--extra-block"), "utf-8")) as string[]) : [])) blockedKeys.add(k); // 2026-10-22: 렌더·변환 결함 후보와 오너 판단 보류 후보를 배정에서 제외
// 새로 쓸 칸(가상)은 라이브러리 원형을 다시 쓸 수 있다(원형 재사용은 금지가 아니다). 단 만들어진 문항이 공개 문항과 구조 look-alike 가 아니어야 하며 생성 뒤 군집 검사로 확인한다.
void LIB_SINGLES; void LIB_SETS;
const ids = arg("--sets", "CH4,CH5").split(",");
const out: ChemResult[] = []; const bl = new Set(blockedKeys);
for (const id of ids) { const one = solveChemSets([id], all, { timeMs: 120000, blocked: bl, preferExamPrep: true }); out.push(...one.out); for (const it of [...one.out[0].singles, ...one.out[0].sets, ...one.out[0].frq]) { bl.add(it.key); for (const c of all) if (RAW.get(c.key) && RAW.get(it.key) && sameStructure(RAW.get(c.key)!, RAW.get(it.key)!)) bl.add(c.key); } } // 시험 사이 구조 동일 금지: 앞 시험에 쓴 문항군의 다른 변형도 막는다
const bad = verifyChemAssignment(out, blockedKeys);
console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
for (const r of out) { console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, 세트 ${r.sets.length}+가상 ${r.virtualSets.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}`); for (const v of r.virtual) console.log(`    가상 MC 단원 ${v.unit} P${v.practice} ${v.archetype} (${v.topic})`); r.virtualSets.forEach((v, i) => console.log(`    가상 세트 단원 ${v} ${r.virtualSetArchetypes[i]}`)); for (const v of r.frqVirtual) console.log(`    가상 FRQ ${v.type}`); }
const w = arg("--write-report"); if (w) writeFileSync(w, JSON.stringify({ sets: out.map(toReportSet), policy: "structure-level block (fam + archetype|topic), not archetype-wide" }, null, 1));
