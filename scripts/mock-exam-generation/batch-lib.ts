// Message Batches 공용 헬퍼 (2026-09-30): 제출·폴링·결과 수집·재개·재시도·비용 집계. DB 접근 없음.
//   - 요청 집합마다 <dir>/<name>.state.json 에 batch id 와 요청 custom_id 목록을 남겨, 재실행하면 이미 끝난 custom_id 는 건너뛰고
//     진행 중이던 배치는 다시 제출하지 않고 이어서 폴링한다.
//   - 결과는 <dir>/<name>.results.jsonl (custom_id 별 message 전체 + usage). 만료·오류 요청은 새 배치로 최대 2회 재시도한다.
//   - 비용: usage 토큰 x 배치 단가. 캐시 쓰기(1h)는 입력 단가의 2배, 캐시 읽기는 0.1배로 계산(가정 — 실제 청구와 다를 수 있음).
//   - 예산 장부 <dir>/../ledger.json 에 누적 지출을 남기고, 제출 전 추정 비용이 상한을 넘으면 거부한다.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/** 배치 단가(USD / MTok, 입력·출력) — 총괄 제공(2026-09-30). 표준가의 50%가 이미 반영된 값. */
export const BATCH_PRICE: Record<string, { in: number; out: number }> = {
  "claude-fable-5-1": { in: 5, out: 25 },
  "claude-opus-5-5": { in: 2, out: 10 },
  "claude-sonnet-5-5": { in: 1, out: 5 },
  "claude-sonnet-5": { in: 1, out: 5 }, // 기존 기본 모델 — 별도 단가 미제공, Sonnet 5.5 와 같다고 가정
  "claude-haiku-4-5": { in: 0.5, out: 2.5 },
};
export type Usage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };
export const costOf = (model: string, u: Usage): number => {
  const p = BATCH_PRICE[model];
  if (!p) throw new Error(`단가 없음: ${model}`);
  return ((u.input_tokens ?? 0) * p.in + (u.output_tokens ?? 0) * p.out + (u.cache_creation_input_tokens ?? 0) * p.in * 2 + (u.cache_read_input_tokens ?? 0) * p.in * 0.1) / 1e6;
};
/** 제출 전 추정 비용(입력·출력 토큰 가정). */
export const estimate = (model: string, n: number, inTok: number, outTok: number) => (n * (inTok * BATCH_PRICE[model].in + outTok * BATCH_PRICE[model].out)) / 1e6;

export type BatchReq = { custom_id: string; params: Record<string, unknown> & { model: string } };
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ledger(dir: string) {
  const f = path.resolve(dir, "..", "ledger.json");
  const read = () => (existsSync(f) ? (JSON.parse(readFileSync(f, "utf-8")) as { spent: number; entries: unknown[] }) : { spent: 0, entries: [] });
  return { spent: () => read().spent, add: (usd: number, note: string) => { const l = read(); l.spent = Math.round((l.spent + usd) * 10000) / 10000; l.entries.push({ at: new Date().toISOString(), usd, note }); writeFileSync(f, JSON.stringify(l, null, 1)); } };
}

type Result = { custom_id: string; ok: boolean; model: string; message?: { content: { type: string; input?: unknown; text?: string }[] }; usage?: Usage; cost?: number; err?: string };

export async function runBatch(opts: { dir: string; name: string; requests: BatchReq[]; budgetUsd?: number; estimateUsd: number; pollMs?: number }): Promise<Map<string, Result>> {
  mkdirSync(opts.dir, { recursive: true });
  const stateF = path.join(opts.dir, `${opts.name}.state.json`);
  const resF = path.join(opts.dir, `${opts.name}.results.jsonl`);
  const led = ledger(opts.dir);
  const done = new Map<string, Result>();
  if (existsSync(resF)) for (const l of readFileSync(resF, "utf-8").split("\n").filter(Boolean)) { const r = JSON.parse(l) as Result; if (r.ok) done.set(r.custom_id, r); }
  const modelOf = new Map(opts.requests.map((r) => [r.custom_id, r.params.model]));
  for (let attempt = 0; attempt < 3; attempt++) {
    const todo = opts.requests.filter((r) => !done.has(r.custom_id));
    if (!todo.length) break;
    let state = existsSync(stateF) ? (JSON.parse(readFileSync(stateF, "utf-8")) as { batchId: string | null; ids: string[] }) : { batchId: null, ids: [] };
    // 진행 중이던 배치가 지금 todo 와 같은 요청 집합이면 이어서 폴링.
    const same = state.batchId && state.ids.length === todo.length && todo.every((r) => state.ids.includes(r.custom_id));
    if (!same) {
      const projected = led.spent() + opts.estimateUsd * (todo.length / opts.requests.length);
      if (opts.budgetUsd !== undefined && projected > opts.budgetUsd) throw new Error(`예산 초과 예상: 누적 ${led.spent().toFixed(2)} + 추정 ${(projected - led.spent()).toFixed(2)} > 상한 ${opts.budgetUsd}`);
      const b = await getClient().messages.batches.create({ requests: todo as never });
      state = { batchId: b.id, ids: todo.map((r) => r.custom_id) };
      writeFileSync(stateF, JSON.stringify(state));
      process.stderr.write(`[batch ${opts.name}] 제출 ${b.id} (${todo.length}건, 시도 ${attempt + 1})\n`);
    } else process.stderr.write(`[batch ${opts.name}] 이어서 폴링 ${state.batchId}\n`);
    for (;;) {
      const b = await getClient().messages.batches.retrieve(state.batchId!);
      if (b.processing_status === "ended") break;
      process.stderr.write(`[batch ${opts.name}] ${JSON.stringify(b.request_counts)}\n`);
      await sleep(opts.pollMs ?? 30000);
    }
    let cost = 0;
    let fatal = "";
    for await (const r of await getClient().messages.batches.results(state.batchId!)) {
      const model = modelOf.get(r.custom_id) ?? "";
      if (r.result.type === "succeeded") {
        const u = r.result.message.usage as Usage;
        const c = costOf(model, u);
        cost += c;
        const rec: Result = { custom_id: r.custom_id, ok: true, model, message: r.result.message as never, usage: u, cost: c };
        appendFileSync(resF, JSON.stringify(rec) + "\n");
        done.set(r.custom_id, rec);
      } else {
        const msg = r.result.type === "errored" ? JSON.stringify((r.result as { error?: unknown }).error).slice(0, 300) : r.result.type;
        appendFileSync(resF, JSON.stringify({ custom_id: r.custom_id, ok: false, model, err: msg }) + "\n");
        if (/invalid_request_error/.test(msg)) fatal = msg;
      }
    }
    led.add(cost, `${opts.name} batch ${state.batchId}`);
    if (fatal) { writeFileSync(stateF, JSON.stringify({ batchId: null, ids: [] })); throw new Error(`요청 형식 오류(재시도 안 함): ${fatal}`); }
    writeFileSync(stateF, JSON.stringify({ batchId: null, ids: [] }));
    process.stderr.write(`[batch ${opts.name}] 완료 성공 ${done.size}/${opts.requests.length}, 이번 비용 $${cost.toFixed(4)}, 누적 $${led.spent().toFixed(2)}\n`);
  }
  return done;
}

export const toolInput = (r: Result): Record<string, unknown> | null => {
  const tu = r.message?.content.find((c) => c.type === "tool_use");
  return tu ? ((tu.input as Record<string, unknown>) ?? null) : null;
};
