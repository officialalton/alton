"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCOUNT_STATUS_LABEL, CONSULT_STAGES, consultStageLabel } from "@/lib/free-accounts/consult-stage";
import type { FreeAccountRow, FreeAccountsListParams } from "@/lib/free-accounts/types";
import { listFreeAccountsAction } from "../free-accounts-actions";

const PAGE = 25;
const COLS: { id: NonNullable<FreeAccountsListParams["sort"]> | null; label: string }[] = [
  { id: "name", label: "Name" }, { id: "email", label: "Email" }, { id: "joined_at", label: "Joined" },
  { id: "last_active_at", label: "Last Active" }, { id: "completed_tests", label: "Completed Tests" },
  { id: "consult_stage", label: "Consultation Status" }, { id: null, label: "Account Status" },
];
const d = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const SEL = "px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] bg-white";

export default function AccountsList({ onOpen, refreshKey }: { onOpen: (id: string) => void; refreshKey: number }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [f, setF] = useState<Omit<FreeAccountsListParams, "search" | "limit" | "offset">>({ scope: "free", sort: "joined_at", dir: "desc", includeTest: false });
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ rows: FreeAccountRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    const my = ++seq.current;
    listFreeAccountsAction({ ...f, search: debounced, limit: PAGE, offset: page * PAGE })
      .then((r) => { if (my === seq.current) { setData(r); setError(null); } })
      .catch((e) => { if (my === seq.current) setError(e instanceof Error ? e.message : "Couldn't load accounts."); });
  }, [f, debounced, page]);
  // 필터·정렬·페이지·검색이 바뀔 때만 RPC 1회(응시 이력 행은 읽지 않는다).
  useEffect(() => { load(); }, [load, refreshKey]);

  const set = (patch: Partial<typeof f>) => { setF((p) => ({ ...p, ...patch })); setPage(0); };
  const sortBy = (id: NonNullable<FreeAccountsListParams["sort"]>) =>
    set({ sort: id, dir: f.sort === id && f.dir === "desc" ? "asc" : "desc" });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div data-testid="free-accounts-list">
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" aria-label="Search by name or email"
          className="min-w-[220px] flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
        <label className="text-[11.5px] text-grey-500">Show
          <select className={SEL + " ml-1"} value={f.scope} onChange={(e) => set({ scope: e.target.value as "free" | "converted" | "all" })}>
            <option value="free">Free active</option><option value="converted">Converted to tutoring</option><option value="all">All</option>
          </select></label>
        <label className="text-[11.5px] text-grey-500">Attempts
          <select className={SEL + " ml-1"} value={f.hasAttempts === undefined || f.hasAttempts === null ? "" : String(f.hasAttempts)}
            onChange={(e) => set({ hasAttempts: e.target.value === "" ? null : e.target.value === "true" })}>
            <option value="">Any</option><option value="true">Has attempts</option><option value="false">No attempts</option>
          </select></label>
        <label className="text-[11.5px] text-grey-500">Consultation status
          <select className={SEL + " ml-1"} value={f.consultStage ?? ""} onChange={(e) => set({ consultStage: e.target.value || null })}>
            <option value="">Any</option>{CONSULT_STAGES.map((s) => <option key={s} value={s}>{consultStageLabel(s)}</option>)}
          </select></label>
        <label className="text-[11.5px] text-grey-500">Account status
          <select className={SEL + " ml-1"} value={f.accountStatus ?? ""} onChange={(e) => set({ accountStatus: e.target.value || null })}>
            <option value="">Open accounts</option><option value="any">Any (incl. closed)</option>
            {Object.entries(ACCOUNT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className="text-[11.5px] text-grey-500">Joined
          <input type="date" className={SEL + " ml-1"} aria-label="Joined from" onChange={(e) => set({ joinedFrom: e.target.value ? new Date(`${e.target.value}T00:00:00+09:00`).toISOString() : undefined })} />
          <input type="date" className={SEL + " ml-1"} aria-label="Joined to" onChange={(e) => set({ joinedTo: e.target.value ? new Date(`${e.target.value}T23:59:59+09:00`).toISOString() : undefined })} /></label>
        <label className="text-[11.5px] text-grey-500">Last active
          <input type="date" className={SEL + " ml-1"} aria-label="Active from" onChange={(e) => set({ activeFrom: e.target.value ? new Date(`${e.target.value}T00:00:00+09:00`).toISOString() : undefined })} />
          <input type="date" className={SEL + " ml-1"} aria-label="Active to" onChange={(e) => set({ activeTo: e.target.value ? new Date(`${e.target.value}T23:59:59+09:00`).toISOString() : undefined })} /></label>
        <label className="text-[12px] text-ink flex items-center gap-1.5"><input type="checkbox" checked={!!f.includeTest} onChange={(e) => set({ includeTest: e.target.checked })} />Include test accounts</label>
      </div>
      {error && <p className="text-[12.5px] text-red">Couldn&apos;t load accounts. {error}</p>}
      {!data && !error && <p className="text-[12.5px] text-grey-500" aria-busy="true">Loading…</p>}
      {data && data.rows.length === 0 && <p className="text-[12.5px] text-grey-500">No accounts match these filters.</p>}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto border-[1.5px] border-grey-200 rounded-xl">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-grey-500 bg-grey-50">
                {COLS.map((c) => (
                  <th key={c.label} className="px-3 py-2 font-semibold whitespace-nowrap">
                    {c.id ? <button onClick={() => sortBy(c.id!)} aria-label={`Sort by ${c.label}`}>{c.label}{f.sort === c.id ? (f.dir === "asc" ? " ↑" : " ↓") : ""}</button> : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.studentId} onClick={() => onOpen(r.studentId)} className="border-t border-grey-100 cursor-pointer hover:bg-grey-50" data-testid="free-account-row">
                  <td className="px-3 py-2 font-semibold text-ink">{r.name || "No name"}{r.isTestAccount && <span className="ml-1 text-[10.5px] text-grey-500">(test)</span>}</td>
                  <td className="px-3 py-2 text-grey-500">{r.email}</td>
                  <td className="px-3 py-2">{d(r.joinedAt)}</td>
                  <td className="px-3 py-2">{d(r.lastActiveAt)}</td>
                  <td className="px-3 py-2">{r.completedTests}{r.inProgressTests > 0 && <span className="text-grey-500"> (+{r.inProgressTests} in progress)</span>}</td>
                  <td className="px-3 py-2">{consultStageLabel(r.consultStage)}{r.consultFlags.includes("invite_needs_review") && <span className="text-red"> · review</span>}</td>
                  <td className="px-3 py-2">{ACCOUNT_STATUS_LABEL[r.accountStatus] ?? r.accountStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between mt-3 text-[12.5px] text-grey-500">
          <span>{data.total} account{data.total === 1 ? "" : "s"}</span>
          <span className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className={SEL}>Previous</button>
            Page {page + 1} of {pages}
            <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className={SEL}>Next</button>
          </span>
        </div>
      )}
    </div>
  );
}
