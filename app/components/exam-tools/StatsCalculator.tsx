"use client";

import { useState } from "react";
import type { InferResult } from "@/lib/stats-calc/infer";
import { STATS_MODES, resultToText, type FieldDef, type ModeDef } from "@/lib/stats-calc/modes";

// 통계 계산기(오프라인·서버 호출 없음). 입력 → 계산 → 결과(통계량·df·p값·구간)와 사용한 규칙을 보여 준다.
// 시험 풀이를 대신해 주지 않는다: 입력한 숫자로 계산만 한다.

const GROUPS = ["Distributions", "Data", "Tests and intervals"] as const;
const initial = (m: ModeDef) => Object.fromEntries(m.fields.map((f) => [f.key, f.def ?? ""]));

function Field({ f, id, value, onChange }: { f: FieldDef; id: string; value: string; onChange: (v: string) => void }) {
  const base = "w-full rounded-md border border-grey-300 bg-white px-2.5 py-2 text-[16px] text-ink min-h-[44px] md:min-h-0 md:text-[14px]";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-bold text-grey-700">{f.label}</label>
      {f.kind === "select" ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : f.kind === "list" || f.kind === "matrix" ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={f.kind === "matrix" ? 4 : 3} spellCheck={false} className={`${base} font-mono`} aria-describedby={f.hint ? `${id}-hint` : undefined} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" autoComplete="off" spellCheck={false} className={base} aria-describedby={f.hint ? `${id}-hint` : undefined} />
      )}
      {f.hint && <p id={`${id}-hint`} className="mt-0.5 text-[11px] text-grey-500">{f.hint}</p>}
    </div>
  );
}

export default function StatsCalculator() {
  const [modeId, setModeId] = useState(STATS_MODES[0].id);
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(STATS_MODES.map((m) => [m.id, initial(m)])));
  const [result, setResult] = useState<InferResult | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const mode = STATS_MODES.find((m) => m.id === modeId)!;
  const values = inputs[modeId];

  function setField(key: string, v: string) { setInputs((s) => ({ ...s, [modeId]: { ...s[modeId], [key]: v } })); }
  function calculate(e?: React.FormEvent) { e?.preventDefault(); setCopied(null); setResult(mode.run(values)); }
  function reset() { setInputs((s) => ({ ...s, [modeId]: initial(mode) })); setResult(null); setCopied(null); }
  async function copy() {
    if (!result?.ok) return;
    try { await navigator.clipboard.writeText(resultToText(result)); setCopied("ok"); } catch { setCopied("fail"); }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 text-[13px]" data-testid="stats-calculator">
      <div>
        <label htmlFor="stats-mode" className="mb-1 block text-[12px] font-bold text-grey-700">Function</label>
        <select id="stats-mode" value={modeId} onChange={(e) => { setModeId(e.target.value); setResult(null); setCopied(null); }} data-testid="stats-mode"
          className="w-full rounded-md border border-grey-300 bg-white px-2.5 py-2 text-[16px] font-semibold text-ink min-h-[44px] md:min-h-0 md:text-[14px]">
          {GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {STATS_MODES.filter((m) => m.group === g).map((m) => <option key={m.id} value={m.id}>{m.label}{m.outside2027 ? " *" : ""}</option>)}
            </optgroup>
          ))}
        </select>
        {mode.help && <p className="mt-1 text-[11.5px] text-grey-600">{mode.help}</p>}
        {mode.outside2027 && <p className="mt-1 text-[11.5px] text-grey-500">* Available on many calculators but not part of the 2027 AP Statistics course content.</p>}
      </div>

      <form onSubmit={calculate} className="space-y-2.5" aria-label={mode.label} data-testid="stats-form">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {mode.fields.map((f) => (
            <div key={f.key} className={f.kind === "list" || f.kind === "matrix" ? "sm:col-span-2" : ""}>
              <Field f={f} id={`stats-${modeId}-${f.key}`} value={values[f.key]} onChange={(v) => setField(f.key, v)} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="submit" data-testid="stats-calculate" className="min-h-[44px] rounded-md bg-ink px-4 py-2 text-[13px] font-bold text-white">Calculate</button>
          <button type="button" onClick={reset} data-testid="stats-clear" className="min-h-[44px] rounded-md border border-grey-300 px-4 py-2 text-[13px] font-bold text-grey-600">Clear</button>
        </div>
      </form>

      <div aria-live="polite" data-testid="stats-result-region">
        {result && !result.ok && <p role="alert" className="rounded-md border border-red/40 bg-red/5 px-3 py-2 text-[12.5px] font-semibold text-red" data-testid="stats-error">{result.error}</p>}
        {result?.ok && (
          <section className="rounded-lg border border-grey-200 bg-grey-50 p-3" data-testid="stats-result" aria-label="Result">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-extrabold text-ink">{result.title}</h3>
              <button type="button" onClick={copy} data-testid="stats-copy" className="min-h-[44px] rounded-md border border-grey-300 bg-white px-3 py-1 text-[12px] md:min-h-[36px] font-bold text-grey-700">
                {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed — select the text" : "Copy results"}
              </button>
            </div>
            <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 select-text">
              {result.rows.map(([k, val]) => (<div key={k} className="contents"><dt className="break-words font-semibold text-grey-600">{k}</dt><dd className="break-words font-mono text-ink">{val}</dd></div>))}
            </dl>
            {result.tables.map((t) => (
              <div key={t.title} className="mt-3 overflow-x-auto">
                <p className="mb-1 text-[11.5px] font-bold text-grey-600">{t.title}</p>
                <table className="border-collapse whitespace-nowrap text-[12px]"><tbody>
                  {t.rows.map((row, i) => (<tr key={i}>{row.map((c, j) => (i === 0 || j === 0 ? <th key={j} scope={i === 0 ? "col" : "row"} className="border border-grey-200 px-2 py-0.5 text-left font-bold">{c}</th> : <td key={j} className="border border-grey-200 px-2 py-0.5 font-mono">{c}</td>))}</tr>))}
                </tbody></table>
              </div>
            ))}
            {result.notes.length > 0 && <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[11.5px] text-grey-600">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          </section>
        )}
      </div>
    </div>
  );
}
