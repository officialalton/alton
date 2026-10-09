// 오너 실행 절차(docs/ap/owner-run-graph-load.md) 예행 연습 — **로컬 격리 스택 전용**(.env.local 이 격리 스택 값이어야 함, 공유 544xx·원격 거부).
//   npx tsx scripts/ap-generation/graph-load-rehearsal.ts [--execute]
// 배치마다: 적재 dry-run → (execute 시) 적재 → 렌더 검증 dry-run/기록 → 화면 검증 dry-run/기록 → 사후 멱등 확인(적재 dry-run 새 키 0·갱신 0, 렌더·화면 "이미 검증됨").
// 각 단계 기대 건수를 파싱해 표로 낸다. 키는 출력하지 않는다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadEnvLocal } from "../keywords/db";

loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):(\d+)/.test(url) || /:544\d\d\b/.test(url)) { console.error("로컬 격리 스택(545xx 등)이 아닙니다. 중단."); process.exit(1); }
const execute = process.argv.includes("--execute");
const EVIDENCE = "data/ap/screen-evidence/evidence-graph-s1s3.json";
export const BATCHES: [string, string, string][] = [
  ["graph-s1-items", "graph-s1-ab-2026-10-09", "graph-s1-pass-keys"], ["graph-s2a-items", "graph-s2-ab-2026-10-09", "graph-s2a-pass-keys"], ["graph-s2b-items", "graph-s2-bc-2026-10-09", "graph-s2b-pass-keys"],
  ["graph-s3a-items", "graph-s3a-ab-2026-10-09", "graph-s3a-pass-keys"], ["graph-s3b-items", "graph-s3a-bc-2026-10-09", "graph-s3b-pass-keys"], ["graph-s3c-items", "graph-s3b-ab-2026-10-09", "graph-s3c-pass-keys"],
  ["graph-s3d-items", "graph-s3b-bc-2026-10-09", "graph-s3d-pass-keys"], ["graph-s3e-items", "graph-s3c-ab-2026-10-09", "graph-s3e-pass-keys"], ["graph-s3f-items", "graph-s3c-bc-2026-10-09", "graph-s3f-pass-keys"],
  ["graph-s3g-items", "graph-s3d-bc-2026-10-09", "graph-s3g-pass-keys"],
];
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
