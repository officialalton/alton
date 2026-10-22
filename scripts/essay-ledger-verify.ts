// 비용 원장 실제 경로 검증(격리 스택 전용, 2026-10-22). 실제 createSupabaseEssayStore + processEssay + 격리 DB(원장 RPC·테이블)를 쓰고, 모델 클라이언트만 스텁이다(Anthropic 호출 0).
//   전제: 격리 스택(ALTON_ledgerv, API 57421·DB 57422)과 시드(학생 2·응시 2·세트 항목 12). 운영 한도·환경변수는 이 프로세스 안에서만 낮춘다.
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:57421 SUPABASE_SECRET_KEY=<service role> DB_URL=postgresql://postgres:postgres@127.0.0.1:57422/postgres npx tsx scripts/essay-ledger-verify.ts
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseEssayStore } from "../lib/essay-grading/store";
import { processEssay, type Job } from "../lib/essay-grading/queue";
import { costUsd, limits, worstCaseUsd } from "../lib/essay-grading/costs";
import type { GraderClient, GraderRequest } from "../lib/essay-grading/client";

const API = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const DB = process.env.DB_URL ?? "";
if (!/^http:\/\/127\.0\.0\.1:57421$/.test(API) || !/127\.0\.0\.1:57422/.test(DB)) { console.error("격리 스택(57421/57422)이 아니면 실행하지 않습니다."); process.exit(1); }
process.env.AI_ESSAY_GRADING_ENABLED = "true";
const admin = createClient(API, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const psql = (sql: string) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "|", "-c", sql], { encoding: "utf-8" }).trim();

const S1 = "00000000-0000-4000-8000-0000000000a1", S2 = "00000000-0000-4000-8000-0000000000a2";
const A1 = "00000000-0000-4000-8000-0000000000b1", A2 = "00000000-0000-4000-8000-0000000000b2";
const item = (n: number) => `00000000-0000-4000-8000-00000000d0${String(n).padStart(2, "0")}`;
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i % 7}`).join(" ");
const good = () => ({ thesis: 1, evidence: 3, sophistication: 0, thesis_rationale: "You state a clear claim.", evidence_rationale: "You use specific details.", sophistication_rationale: "Limited nuance.", improve: ["Explain the evidence more."] });
const job = (a: string, s: string, i: number, over: Partial<Job> = {}): Job => ({ attemptId: a, setItemId: item(i), partLabel: "a", studentId: s, taskPrompt: "Write an argument.", sources: [{ id: "A", body: "Source text." }], essay: words(200), anchors: [{ tier: "high", text: words(300) }, { tier: "mid", text: words(200) }, { tier: "low", text: words(100) }], ...over });
type Client = GraderClient & { calls: number };
const client = (fn: (r: GraderRequest, n: number) => unknown | Promise<unknown>): Client => { const c: Client = { calls: 0, async grade(r) { c.calls++; return { output: await fn(r, c.calls), inputTokens: 5000, outputTokens: 600, model: "stub" }; } }; return c; };
const reset = () => { psql("truncate essay_ai_cost_events, mock_exam_essay_scores cascade;"); };
const rows = () => psql("select status, attempts_made, coalesce(last_error,''), cost_usd, coalesce(to_char(next_retry_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI'),'') from mock_exam_essay_scores order by created_at");
const events = () => psql("select state, cost_usd, (call_started_at is not null) as started, to_char(occurred_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS') from essay_ai_cost_events order by created_at");
const spend = (iso: string) => psql(`select essay_ai_month_spend('${iso}'::timestamptz)`);
const status = () => psql("select * from essay_ai_ledger_status()");

let fails = 0;
const results: string[] = [];
function check(name: string, ok: boolean, evidence: string) { if (!ok) fails++; results.push(`${ok ? "PASS" : "FAIL"} ${name}\n    ${evidence.replace(/\n/g, "\n    ")}`); }
const one = costUsd(10_000, 1_200); // 호출 4회(채점 2 × 각 1호출) 아님: processEssay 는 정상 경로에서 2회 호출 → 입력 10000·출력 1200
const L = limits(); const worst = worstCaseUsd(L);

async function main() {
  // S1 예약 → 정산(정상 경로)
  reset();
  let store = createSupabaseEssayStore(admin as never); let c = client(() => good());
  let out = await processEssay({ store, client: c }, job(A1, S1, 1));
  check("S1 reserve→settle (done)", out.status === "done" && c.calls === 2 && events() === `settled|${one.toFixed(5)}|t|${events().split("|")[3]}` && Number(spend(new Date().toISOString())) === one,
    `outcome=${out.status} calls=${c.calls} expected_cost=${one}\nevents: ${events()}\nrows: ${rows()}\nmonth_spend=${spend(new Date().toISOString())}`);

  // S2 호출 중 예외 → unsettled(예약 유지), 재시도 불가 시각 전에는 claim 못 함, 이후 재시도 성공 시 행 비용 누적
  reset(); let clock = new Date();
  store = createSupabaseEssayStore(admin as never, () => clock);
  c = client(() => { throw new Error("socket hang up"); });
  out = await processEssay({ store, client: c, now: () => clock }, job(A1, S1, 2));
  const unsettledSpend = Number(spend(clock.toISOString()));
  check("S2a mid-call failure leaves reservation as unsettled (counted at worst case)", out.status === "failed" && /^reserved\|/.test(events()) && events().split("|")[2] === "t" && Math.abs(unsettledSpend - worst) < 1e-6,
    `outcome=${JSON.stringify(out)} worst_case=${worst}\nevents: ${events()}\nrows: ${rows()}\nmonth_spend=${unsettledSpend}`);
  const early = await processEssay({ store, client: client(() => good()), now: () => clock }, job(A1, S1, 2));
  check("S2b retry blocked before next_retry_at", early.status === "already", `outcome=${JSON.stringify(early)}`);
  // 잘못된 출력 2회(정산되는 실패) → 비용 누적 후 다음 재시도 성공
  reset(); clock = new Date(); store = createSupabaseEssayStore(admin as never, () => clock);
  const bad = client(() => ({ nope: true }));
  out = await processEssay({ store, client: bad, now: () => clock }, job(A1, S1, 3));
  const afterBad = psql("select cost_usd from mock_exam_essay_scores");
  clock = new Date(clock.getTime() + 3 * 60 * 60_000);
  const okc = client(() => good());
  const out2 = await processEssay({ store, client: okc, now: () => clock }, job(A1, S1, 3));
  const rowCost = Number(psql("select cost_usd from mock_exam_essay_scores"));
  const settledCount = psql("select count(*) from essay_ai_cost_events where state='settled'");
  check("S2c retry accumulates cost on the row and ledger (no overwrite)", out.status === "failed" && out2.status === "done" && Math.abs(rowCost - (Number(afterBad) + one)) < 1e-6 && settledCount === "2",
    `first=${JSON.stringify(out)} (cost after first=${afterBad}) second=${out2.status} row_cost=${rowCost} expected=${(Number(afterBad) + one).toFixed(5)} settled_events=${settledCount}\nevents: ${events()}\nrows: ${rows()}`);

  // S3 일일 상한(격리에서만 낮춤) → 대기(failed+next_retry_at=다음 UTC 자정), 모델 호출 없음, 다음 날 처리
  reset(); clock = new Date(); store = createSupabaseEssayStore(admin as never, () => clock);
  process.env.AI_ESSAY_DAILY_CAP = "2";
  c = client(() => good());
  const o1 = await processEssay({ store, client: c, now: () => clock }, job(A2, S2, 4));
  const o2 = await processEssay({ store, client: c, now: () => clock }, job(A2, S2, 5));
  const callsBefore = c.calls;
  const o3 = await processEssay({ store, client: c, now: () => clock }, job(A2, S2, 6));
  const nextMidnight = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate() + 1)).toISOString().slice(0, 16);
  const waitRow = psql(`select status||'|'||last_error||'|'||attempts_made||'|'||to_char(next_retry_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI') from mock_exam_essay_scores where set_item_id='${item(6)}'`);
  const evBeforeNextDay = psql("select count(*) from essay_ai_cost_events");
  clock = new Date(clock.getTime() + 24 * 60 * 60_000 + 60_000);
  const o4 = await processEssay({ store, client: c, now: () => clock }, job(A2, S2, 6));
  check("S3 daily cap → wait until UTC midnight (no model call), then processed after reset", o1.status === "done" && o2.status === "done" && o3.status === "failed" && c.calls === callsBefore + (o4.status === "done" ? 2 : 0) && waitRow === `failed|daily_cap|0|${nextMidnight}` && evBeforeNextDay === "2" && o4.status === "done",
    `o1=${o1.status} o2=${o2.status} o3=${JSON.stringify(o3)} wait_row=${waitRow} (expected failed|daily_cap|0|${nextMidnight})\ncalls_before_o3=${callsBefore} total_calls=${c.calls}; events_before_next_day=${evBeforeNextDay}; after reset o4=${o4.status}\nrows: ${rows()}`);
  delete process.env.AI_ESSAY_DAILY_CAP;

  // S4 월 예산 → 사전 검사·예약 거절(대기, 다음 UTC 월 시작), 모델 호출 없음
  reset(); clock = new Date(); store = createSupabaseEssayStore(admin as never, () => clock);
  process.env.AI_ESSAY_MONTHLY_BUDGET_USD = String(Math.round((worst + 0.01) * 1000) / 1000);
  c = client(() => good());
  const m1 = await processEssay({ store, client: c, now: () => clock }, job(A1, S1, 7));
  const m2 = await processEssay({ store, client: c, now: () => clock }, job(A2, S2, 8));
  const nextMonth = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth() + 1, 1)).toISOString().slice(0, 16);
  const m2row = psql(`select status||'|'||last_error||'|'||attempts_made||'|'||to_char(next_retry_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI') from mock_exam_essay_scores where set_item_id='${item(8)}'`);
  check("S4 monthly budget exhausted → wait until next UTC month, no model call", m1.status === "done" && m2.status === "failed" && c.calls === 2 && m2row === `failed|monthly_budget|0|${nextMonth}`,
    `budget=${process.env.AI_ESSAY_MONTHLY_BUDGET_USD} worst_case=${worst}\nm1=${m1.status} m2=${JSON.stringify(m2)} model_calls=${c.calls} (expected 2: first essay only)\nm2 row=${m2row} (expected failed|monthly_budget|0|${nextMonth})\nevents: ${events()}`);

  // S5 기준 답안 3개 미만 → 이용 불가(no_reference_answers), 모델 호출 없음, 시도 횟수 미소모, 이벤트 없음
  reset(); delete process.env.AI_ESSAY_MONTHLY_BUDGET_USD; clock = new Date(); store = createSupabaseEssayStore(admin as never, () => clock);
  c = client(() => good());
  const n1 = await processEssay({ store, client: c, now: () => clock }, job(A1, S1, 9, { anchors: [{ tier: "high", text: words(300) }, { tier: "low", text: words(100) }] }));
  check("S5 <3 reference answers → 'unavailable' (no call, no attempt used, no ledger event)", n1.status === "failed" && (n1 as { error?: string }).error === "no_reference_answers" && c.calls === 0 && psql("select count(*) from essay_ai_cost_events") === "0",
    `outcome=${JSON.stringify(n1)} calls=${c.calls}\nrows: ${rows()}\nevents_count=${psql("select count(*) from essay_ai_cost_events")}`);

  // S6 동시성: 예산이 한 건의 최악 비용만 허용할 때 동시 두 요청 → 예약은 1건만 성공, 모델 호출은 한 건분(2회)뿐
  reset(); clock = new Date(); store = createSupabaseEssayStore(admin as never, () => clock);
  process.env.AI_ESSAY_MONTHLY_BUDGET_USD = String(Math.round((worst + 0.01) * 1000) / 1000);
  const slow = client(async () => { await new Promise((r) => setTimeout(r, 400)); return good(); });
  const [p1, p2] = await Promise.all([
    processEssay({ store: createSupabaseEssayStore(admin as never, () => clock), client: slow, now: () => clock }, job(A1, S1, 10)),
    processEssay({ store: createSupabaseEssayStore(admin as never, () => clock), client: slow, now: () => clock }, job(A2, S2, 11)),
  ]);
  const settledSum = Number(psql("select coalesce(sum(cost_usd),0) from essay_ai_cost_events where state='settled'"));
  const done = [p1, p2].filter((x) => x.status === "done").length;
  check("S6 concurrency: two simultaneous requests cannot both reserve (budget fits one worst case)", done === 1 && slow.calls === 2 && settledSum <= Number(process.env.AI_ESSAY_MONTHLY_BUDGET_USD) + 1e-9,
    `p1=${JSON.stringify(p1)} p2=${JSON.stringify(p2)} model_calls=${slow.calls} (expected 2)\nbudget=${process.env.AI_ESSAY_MONTHLY_BUDGET_USD} settled_sum=${settledSum}\nevents: ${events()}\nrows: ${rows()}`);
  delete process.env.AI_ESSAY_MONTHLY_BUDGET_USD;

  // S7 UTC 월 경계: 9/30 23:59:30Z 에 정산된 비용은 9월, 10/1 00:00:10Z 기준 월 지출에는 없다. 로스앤젤레스 시각이 아니라 UTC.
  reset(); const boundary = new Date("2026-09-30T23:59:30Z"); store = createSupabaseEssayStore(admin as never, () => boundary);
  c = client(() => good());
  const b1 = await processEssay({ store, client: c, now: () => boundary }, job(A1, S1, 12));
  const sepSpend = spend("2026-09-30T23:59:59Z"), octSpend = spend("2026-10-01T00:00:10Z");
  check("S7 UTC month boundary (event at 2026-09-30T23:59:30Z counts for September, not October)", b1.status === "done" && Number(sepSpend) === one && Number(octSpend) === 0,
    `outcome=${b1.status} spend@Sep30 23:59:59Z=${sepSpend} spend@Oct1 00:00:10Z=${octSpend} expected_cost=${one}\nevents: ${events()}`);

  reset();
  console.log(results.join("\n"));
  console.log(`\nledger_status(after reset)=${status()}`);
  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 2);
}
main().catch((e) => { console.error(e); process.exit(1); });
