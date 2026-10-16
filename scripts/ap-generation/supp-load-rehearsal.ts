// 보강(supplement) 배치 오너 실행 절차(docs/ap/owner-run-graph-load.md 의 "보강 배치" 절) 예행 연습 — **로컬 격리 스택 전용**(.env.local 이 격리 스택 값이어야 함, 공유 544xx·원격 거부).
//   npx tsx scripts/ap-generation/supp-load-rehearsal.ts [--execute]
// 배치마다: 적재 dry-run → (execute 시) 적재 → 렌더 검증 dry-run/기록 → 화면 검증 dry-run/기록 → 사후 멱등 확인(적재 dry-run 새 키 0·갱신 0, 렌더·화면 "이미 검증됨").
// 각 단계 기대 건수를 파싱해 표로 낸다. 키는 출력하지 않는다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { SUPP_BATCHES } from "./supp-batches";
import { assertIsolatedApiOrExit } from "../../lib/dev/stack-identity";

// 모든 env 파일을 읽은 뒤 대상을 정하고 docker 로 API 가 격리 스택(ALTON_<이름>)의 kong 컨테이너인지 확인한다(공유 ALTON·불일치면 쓰기 전에 종료).
assertIsolatedApiOrExit(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
const execute = process.argv.includes("--execute");
const EVIDENCE = "data/ap/screen-evidence/evidence-supp.json";
// 배치 = 보강 배치 레지스트리(supp-batches.ts) 중 통과 키가 있는 것. 배치 이름은 supp-<n>-2026-10-09 형식이다.
const SUMMARY = JSON.parse(readFileSync("data/ap/stock/supp-load-summary.json", "utf-8")) as { file: string; pass: number; passKeysFile: string }[];
export const BATCHES: [string, string, string][] = SUPP_BATCHES.filter((b) => SUMMARY.some((s) => s.file === b.file && s.pass > 0)).map((b) => [b.file.replace(/\.json$/, ""), b.file.replace(/-items\.json$/, "").replace(/^supp-/, "supp-") + "-2026-10-09", SUMMARY.find((s) => s.file === b.file)!.passKeysFile.replace(/\.json$/, "")]);
const run = (args: string[]) => { try { return execFileSync("npx", ["tsx", ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return String((e as { stdout?: string }).stdout ?? "") + String((e as { stderr?: string }).stderr ?? ""); } };
const pick = (s: string, re: RegExp) => s.match(re)?.slice(1).join("/") ?? "?";
const rows: string[] = [];
const imp = (f: string, b: string, ex: boolean) => run(["scripts/ap-generation/import-candidates.ts", "--items", `data/ap/stock/${f}.json`, "--batch", b, "--supplement", ex ? "--execute" : "--report"]);
const ver = (mode: "render" | "screen", k: string, ex: boolean) => run(["scripts/ap-generation/mark-verified.ts", mode === "render" ? "--render" : "--screen", ...(mode === "render" ? ["--report", "data/ap/render-check/report.json"] : ["--evidence", EVIDENCE]), "--keys-file", `data/ap/stock/${k}.json`, ...(ex ? ["--execute"] : [])]);
for (const [f, b, k] of BATCHES) {
  const n = (JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as unknown[]).length, nk = (JSON.parse(readFileSync(`data/ap/stock/${k}.json`, "utf-8")) as unknown[]).length;
  const d1 = imp(f, b, false); const plan = pick(d1, /새 키 insert (\d+), 기존 행 update (\d+), 변경 없음 (\d+), 검증·변환 보존만 (\d+)/);
  let load = "-", rd = "-", sd = "-", post = "-";
  if (execute) {
    load = pick(imp(f, b, true), /insert (\d+), update (\d+)/);
    rd = pick(ver("render", k, true), /렌더 검증 기록 (\d+)건, 건너뜀 (\d+)건, 이미 검증됨 (\d+)건/);
    sd = pick(ver("screen", k, true), /신규 (\d+)건, 라벨 갱신 (\d+)건, 이미 같은 증거 (\d+)건/);
    post = `${pick(imp(f, b, false), /새 키 insert (\d+), 기존 행 update (\d+)/)} | ${pick(ver("render", k, false), /이미 검증됨 (\d+)건/)} | ${pick(ver("screen", k, false), /이미 같은 증거 (\d+)건/)}`;
  } else { rd = pick(ver("render", k, false), /렌더 검증 대상 (\d+)건, 건너뜀 (\d+)건/); sd = pick(ver("screen", k, false), /신규 (\d+)건, 라벨 갱신 (\d+)건/); }
  rows.push(`| ${f}.json | ${b} | ${n} (통과 ${nk}) | 새/갱신/무변경/보존 ${plan} | ${load} | 렌더 ${rd} | 화면 ${sd} | ${post} |`);
  console.log(rows[rows.length - 1]);
}
