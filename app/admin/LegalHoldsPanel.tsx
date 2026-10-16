"use client";

import { useCallback, useEffect, useState } from "react";
import {
  decideLegalHoldRequestAction,
  extendLegalHoldAction,
  loadLegalHoldsAction,
  placeLegalHoldAction,
  releaseLegalHoldAction,
  requestLegalHoldAction,
  searchHoldTargetsAction,
} from "./retention-actions";
import {
  HOLD_SUBJECT_LABEL,
  HOLD_SUBJECT_TYPES,
  NAME_SEARCHABLE_TYPES,
  isReviewOverdue,
  type HoldRequestRow,
  type HoldRow,
  type HoldSubjectType,
  type LegalHoldsView,
  type ActionResult,
} from "./retention-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate } from "@/lib/format-datetime";

const EVENT_LABEL: Record<string, string> = {
  placed: "설정",
  extended: "연장",
  released: "해제",
  review_notice: "재검토 알림",
};
const REQ_STATUS_LABEL: Record<string, string> = { pending: "대기", approved: "승인", rejected: "반려" };

const inputCls = "text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 w-full";
const btnCls = "text-[12.5px] font-semibold rounded-lg px-3 py-1.5 border-[1.5px] border-grey-200 text-ink disabled:opacity-50";
const primaryCls = "text-[12.5px] font-semibold rounded-lg px-3 py-1.5 bg-navy text-white disabled:opacity-50";

function targetText(type: HoldSubjectType, label: string | null, id: string | null) {
  const base = HOLD_SUBJECT_LABEL[type];
  if (type === "global") return base;
  return `${base} · ${label || id || "-"}`;
}

function TargetPicker({
  type,
  onType,
  targetId,
  onTarget,
}: {
  type: HoldSubjectType;
  onType: (t: HoldSubjectType) => void;
  targetId: string | null;
  onTarget: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; label: string }[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const byName = NAME_SEARCHABLE_TYPES.includes(type);

  async function search() {
    setSearching(true);
    try {
      setResults(await searchHoldTargetsAction(type, q));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        aria-label="대상 종류"
        value={type}
        onChange={(e) => {
          onType(e.target.value as HoldSubjectType);
          onTarget(null);
          setResults(null);
          setPicked(null);
          setQ("");
        }}
        className={inputCls}
      >
        {HOLD_SUBJECT_TYPES.map((t) => (
          <option key={t} value={t}>
            {HOLD_SUBJECT_LABEL[t]}
          </option>
        ))}
      </select>
      {type !== "global" && (
        <>
          <div className="flex gap-2">
            <input
              aria-label={byName ? "이름으로 검색" : "대상 ID(UUID)"}
              placeholder={byName ? "이름으로 검색" : "대상 ID(UUID) 입력"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={inputCls}
            />
            <button type="button" onClick={search} disabled={searching || !q.trim()} className={btnCls}>
              {searching ? "검색 중…" : "검색"}
            </button>
          </div>
          {results && results.length === 0 && <p className="text-[12px] text-grey-500">검색 결과가 없습니다.</p>}
          {results && results.length > 0 && (
            <ul className="border border-grey-200 rounded-lg divide-y divide-grey-100">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onTarget(r.id);
                      setPicked(r.label);
                    }}
                    className={"w-full text-left text-[12.5px] px-3 py-1.5 " + (targetId === r.id ? "bg-navy/10 font-semibold" : "")}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {targetId && <p className="text-[12px] text-grey-600">선택됨: {picked}</p>}
        </>
      )}
    </div>
  );
}

function NewHoldForm({ isHolder, onDone, onCancel }: { isHolder: boolean; onDone: (msg: string) => void; onCancel: () => void }) {
  const [type, setType] = useState<HoldSubjectType>("profile");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reviewBy, setReviewBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res: ActionResult = isHolder
      ? await placeLegalHoldAction({ subjectType: type, subjectId: targetId, reason, reviewBy })
      : await requestLegalHoldAction({ subjectType: type, subjectId: targetId, reason });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone(isHolder ? "보류를 설정했습니다." : "보류를 요청했습니다. 담당자가 검토합니다.");
  }

  return (
    <div className="border border-grey-200 rounded-xl p-4 mb-5 space-y-3 bg-white" data-testid="new-hold-form">
      <h3 className="text-[13.5px] font-extrabold text-ink">{isHolder ? "보류 설정" : "보류 요청"}</h3>
      <TargetPicker type={type} onType={setType} targetId={targetId} onTarget={setTargetId} />
      <textarea
        aria-label="사유"
        placeholder="사유(10자 이상)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className={inputCls}
      />
      {isHolder && (
        <label className="block text-[12px] text-grey-600">
          재검토일(내일부터 12개월 이내, 자동 해제되지 않습니다)
          <input type="date" aria-label="재검토일" value={reviewBy} onChange={(e) => setReviewBy(e.target.value)} className={inputCls + " mt-1"} />
        </label>
      )}
      {error && <p role="alert" className="text-[12.5px] text-red">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className={primaryCls}>
          {busy ? "처리 중…" : isHolder ? "보류 설정" : "요청 보내기"}
        </button>
        <button type="button" onClick={onCancel} className={btnCls}>
          취소
        </button>
      </div>
    </div>
  );
}

function HoldCard({ hold, isHolder, onChanged }: { hold: HoldRow; isHolder: boolean; onChanged: (msg: string) => void }) {
  const tz = useViewerTimezone();
  const [mode, setMode] = useState<null | "extend" | "release" | "history">(null);
  const [note, setNote] = useState("");
  const [reviewBy, setReviewBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = !hold.releasedAt;
  const overdue = active && isReviewOverdue(hold.reviewBy);
  const dt = (v: string) => fmtDate(new Date(v), { year: "numeric", month: "short", day: "numeric" }, tz);

  async function run() {
    setBusy(true);
    setError(null);
    const res = mode === "extend" ? await extendLegalHoldAction(hold.id, note, reviewBy) : await releaseLegalHoldAction(hold.id, note);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onChanged(mode === "extend" ? "재검토일을 연장했습니다." : "보류를 해제했습니다.");
  }

  return (
    <li
      data-testid={`hold-${hold.id}`}
      className={"border rounded-xl p-4 bg-white " + (overdue ? "border-red" : "border-grey-200")}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[13.5px] font-extrabold text-ink">{targetText(hold.subjectType, hold.subjectLabel, hold.subjectId)}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-grey-100 text-grey-600">범위 {hold.scope.join(", ")}</span>
        {!active && <span className="text-[11px] px-2 py-0.5 rounded-full bg-grey-100 text-grey-600">해제됨</span>}
        {overdue && (
          <span data-testid="overdue-badge" className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">
            재검토 기한 경과 — 해제 전까지 보류 유지
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-grey-700 whitespace-pre-wrap break-words">{hold.reason}</p>
      <p className="text-[12px] text-grey-500 mt-1">
        설정 {hold.setByName || "-"} · {dt(hold.setAt)} ·{" "}
        <span className={overdue ? "text-red font-bold" : ""} data-testid="review-by">
          재검토일 {hold.reviewBy}
        </span>
        {!active && ` · 해제 ${hold.releasedByName || "-"} ${hold.releasedAt ? dt(hold.releasedAt) : ""}${hold.releaseNote ? ` (${hold.releaseNote})` : ""}`}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" className={btnCls} onClick={() => setMode(mode === "history" ? null : "history")}>
          이력 {hold.events.length}건
        </button>
        {active && isHolder && (
          <>
            <button type="button" className={btnCls} onClick={() => setMode("extend")}>
              연장
            </button>
            <button type="button" className={btnCls} onClick={() => setMode("release")}>
              해제
            </button>
          </>
        )}
      </div>
      {mode === "history" && (
        <ul className="mt-3 text-[12px] text-grey-600 space-y-1">
          {hold.events.map((e) => (
            <li key={e.id}>
              {dt(e.createdAt)} · {EVENT_LABEL[e.eventType] ?? e.eventType}
              {e.actorName ? ` · ${e.actorName}` : ""}
              {e.reviewBy ? ` · 재검토일 ${e.reviewBy}` : ""}
              {e.note ? ` · ${e.note}` : ""}
            </li>
          ))}
        </ul>
      )}
      {(mode === "extend" || mode === "release") && (
        <div className="mt-3 space-y-2">
          <textarea
            aria-label={mode === "extend" ? "연장 사유" : "해제 사유"}
            placeholder={mode === "extend" ? "연장 사유(10자 이상)" : "해제 사유(10자 이상)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputCls}
          />
          {mode === "extend" && (
            <input type="date" aria-label="새 재검토일" value={reviewBy} onChange={(e) => setReviewBy(e.target.value)} className={inputCls} />
          )}
          {error && <p role="alert" className="text-[12.5px] text-red">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={run} disabled={busy} className={primaryCls}>
              {busy ? "처리 중…" : mode === "extend" ? "연장 확정" : "해제 확정"}
            </button>
            <button type="button" onClick={() => setMode(null)} className={btnCls}>
              취소
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function RequestCard({ req, isHolder, onChanged }: { req: HoldRequestRow; isHolder: boolean; onChanged: (msg: string) => void }) {
  const tz = useViewerTimezone();
  const [reviewBy, setReviewBy] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const res = await decideLegalHoldRequestAction(req.id, approve, note, reviewBy || null);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onChanged(approve ? "요청을 승인해 보류를 설정했습니다." : "요청을 반려했습니다.");
  }

  return (
    <li data-testid={`request-${req.id}`} className="border border-grey-200 rounded-xl p-4 bg-white">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[13.5px] font-extrabold text-ink">{targetText(req.subjectType, req.subjectLabel, req.subjectId)}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-grey-100 text-grey-600">{REQ_STATUS_LABEL[req.status]}</span>
      </div>
      <p className="text-[12.5px] text-grey-700 whitespace-pre-wrap break-words">{req.reason}</p>
      <p className="text-[12px] text-grey-500 mt-1">
        요청 {req.requestedByName || "-"} · {fmtDate(new Date(req.requestedAt), { year: "numeric", month: "short", day: "numeric" }, tz)}
        {req.status !== "pending" && ` · ${req.decidedByName || "-"} ${REQ_STATUS_LABEL[req.status]}${req.decisionNote ? ` (${req.decisionNote})` : ""}`}
      </p>
      {isHolder && req.status === "pending" && (
        <div className="mt-3 space-y-2">
          <label className="block text-[12px] text-grey-600">
            승인 시 재검토일(필수)
            <input type="date" aria-label="승인 재검토일" value={reviewBy} onChange={(e) => setReviewBy(e.target.value)} className={inputCls + " mt-1"} />
          </label>
          <input aria-label="처리 메모" placeholder="메모(선택)" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          {error && <p role="alert" className="text-[12.5px] text-red">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className={primaryCls} disabled={busy} onClick={() => decide(true)}>
              승인
            </button>
            <button type="button" className={btnCls} disabled={busy} onClick={() => decide(false)}>
              반려
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function LegalHoldsPanel() {
  const [view, setView] = useState<LegalHoldsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [showReleased, setShowReleased] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLegalHoldsAction()
      .then((v) => {
        if (!cancelled) {
          setView(v);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "보류 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const changed = useCallback((msg: string) => {
    setToast(msg);
    setShowForm(false);
    setVersion((v) => v + 1);
  }, []);

  if (error) return <p role="alert" className="text-[13px] text-red">{error}</p>;
  if (!view) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  const active = view.holds.filter((h) => !h.releasedAt);
  const released = view.holds.filter((h) => h.releasedAt);
  const pending = view.requests.filter((r) => r.status === "pending");
  const decided = view.requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <p className="text-[12.5px] text-grey-500 mb-3">
        보류가 걸린 대상은 보존 기간이 지나도 삭제·비식별화되지 않습니다. 재검토일이 지나도 자동 해제되지 않고, 담당자가 연장하거나 해제해야 합니다.
        {!view.isHolder && " 보류 설정·연장·해제는 지정된 담당자만 할 수 있어, 여기서는 요청만 보냅니다."}
      </p>
      {toast && (
        <p role="status" className="text-[12.5px] text-green mb-3">
          {toast}
        </p>
      )}
      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)} className={primaryCls + " mb-5"}>
          {view.isHolder ? "보류 설정" : "보류 요청"}
        </button>
      )}
      {showForm && <NewHoldForm isHolder={view.isHolder} onDone={changed} onCancel={() => setShowForm(false)} />}

      {view.isHolder && pending.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[13.5px] font-extrabold text-ink mb-2">대기 중 요청 {pending.length}건</h3>
          <ul className="space-y-3">
            {pending.map((r) => (
              <RequestCard key={r.id} req={r} isHolder onChanged={changed} />
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h3 className="text-[13.5px] font-extrabold text-ink mb-2">활성 보류 {active.length}건</h3>
        {active.length === 0 ? (
          <p className="text-[13px] text-grey-500">활성 보류가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((h) => (
              <HoldCard key={h.id} hold={h} isHolder={view.isHolder} onChanged={changed} />
            ))}
          </ul>
        )}
      </section>

      {!view.isHolder && view.requests.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[13.5px] font-extrabold text-ink mb-2">내 요청</h3>
          <ul className="space-y-3">
            {view.requests.map((r) => (
              <RequestCard key={r.id} req={r} isHolder={false} onChanged={changed} />
            ))}
          </ul>
        </section>
      )}

      {view.isHolder && decided.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[13.5px] font-extrabold text-ink mb-2">처리된 요청</h3>
          <ul className="space-y-3">
            {decided.map((r) => (
              <RequestCard key={r.id} req={r} isHolder onChanged={changed} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <button type="button" className={btnCls + " mb-3"} onClick={() => setShowReleased((v) => !v)}>
          해제된 보류 {released.length}건 {showReleased ? "접기" : "보기"}
        </button>
        {showReleased && (
          <ul className="space-y-3">
            {released.map((h) => (
              <HoldCard key={h.id} hold={h} isHolder={false} onChanged={changed} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
