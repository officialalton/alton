"use client";

import { useMemo, useState } from "react";
import { FORMULA_DISCLAIMER, STATS_FORMULAS, TABLE_CALCULATOR_NOTE } from "@/lib/stats-calc/formulas";
import { REF_TABLES, type RefTable } from "@/lib/stats-calc/tables";
import { TabBar } from "./Tabs";

type RefTab = "formulas" | "tables";
const TABLE_TABS = [{ id: "z", label: "z" }, { id: "t", label: "t" }, { id: "chi", label: "χ²" }] as const;

function FormulaList() {
  return (
    <div className="space-y-4 p-3 text-[13px]" data-testid="stats-formulas">
      <p className="rounded-md bg-grey-100 px-3 py-2 text-[11.5px] font-bold text-grey-700" data-testid="stats-reference-disclaimer">{FORMULA_DISCLAIMER}</p>
      {STATS_FORMULAS.map((s) => (
        <section key={s.id} aria-labelledby={`f-${s.id}`}>
          <h3 id={`f-${s.id}`} className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-grey-200 pb-1 text-[12.5px] font-extrabold text-ink">
            <span>{s.title}</span><span className="text-[10.5px] font-semibold text-grey-500">Topics {s.topics}</span>
          </h3>
          <dl className="space-y-2">
            {s.items.map((it) => (
              <div key={it.name}>
                <dt className="text-[11.5px] font-semibold text-grey-600">{it.name}</dt>
                <dd className="font-mono text-[13px] leading-snug text-ink">{it.expr}{it.note && <span className="mt-0.5 block font-sans text-[11.5px] text-grey-500">{it.note}</span>}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function TableView({ table, query }: { table: RefTable; query: string }) {
  const q = query.trim();
  const rows = q ? table.rows.filter((r) => r.label.startsWith(q) || r.label === q) : table.rows;
  return (
    <div>
      <p className="mb-2 text-[12px] font-bold text-ink">{table.title}</p>
      <div className="max-h-[48vh] overflow-auto rounded-md border border-grey-200" tabIndex={0} aria-label={`${table.title} (scrollable)`}>
        <table className="w-full border-collapse text-right font-mono text-[12px]" data-testid={`stats-table-${table.id}`}>
          <thead className="sticky top-0 bg-ink text-white"><tr><th scope="col" className="px-2 py-1 text-left">{table.id === "z" ? "z" : "df"}</th>{table.columns.map((c) => <th key={c} scope="col" className="px-2 py-1">{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (<tr key={r.label} className="odd:bg-grey-50"><th scope="row" className="px-2 py-0.5 text-left font-bold">{r.label}</th>{r.cells.map((c, i) => <td key={i} className="px-2 py-0.5">{c}</td>)}</tr>))}
            {rows.length === 0 && <tr><td colSpan={table.columns.length + 1} className="px-2 py-3 text-center font-sans text-grey-500">No row starts with “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-grey-600">{table.note}</p>
    </div>
  );
}

function Tables() {
  const [which, setWhich] = useState<"z" | "t" | "chi">("z");
  const [query, setQuery] = useState("");
  const table = useMemo(() => REF_TABLES[which](), [which]);
  return (
    <div className="space-y-3 p-3 text-[13px]" data-testid="stats-tables">
      <div className="flex flex-wrap items-end gap-3">
        <TabBar tabs={TABLE_TABS.map((t) => ({ id: t.id, label: t.label }))} value={which} onChange={(id) => { setWhich(id); setQuery(""); }} label="Distribution table" idPrefix="stats-tbl" />
        <div className="min-w-[8rem] flex-1">
          <label htmlFor="stats-table-search" className="mb-0.5 block text-[11.5px] font-bold text-grey-700">Find row ({which === "z" ? "e.g. 1.9 or -0.3" : "df, e.g. 12"})</label>
          <input id="stats-table-search" value={query} onChange={(e) => setQuery(e.target.value)} inputMode="decimal" autoComplete="off" className="w-full rounded-md border border-grey-300 px-2.5 py-1.5 text-[13px]" />
        </div>
      </div>
      <TableView table={table} query={query} />
      <p className="text-[11.5px] text-grey-600" data-testid="stats-table-hint">
        Between two rows? Interpolate linearly between the neighbouring values, or use the next smaller df (conservative). {TABLE_CALCULATOR_NOTE}
      </p>
      <p className="text-[11px] text-grey-500">Values are computed by ALTON from the distribution functions, rounded to the shown digits.</p>
    </div>
  );
}

export default function StatsReference() {
  const [tab, setTab] = useState<RefTab>("formulas");
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="stats-reference">
      <div className="border-b border-grey-200 px-3 py-2">
        <TabBar tabs={[{ id: "formulas", label: "Formulas" }, { id: "tables", label: "Tables" }]} value={tab} onChange={setTab} label="Reference sections" idPrefix="stats-ref" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel" id={`stats-ref-panel-${tab}`} aria-labelledby={`stats-ref-tab-${tab}`}>
        {tab === "formulas" ? <FormulaList /> : <Tables />}
      </div>
    </div>
  );
}
