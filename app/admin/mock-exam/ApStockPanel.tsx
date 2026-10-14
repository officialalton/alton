"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apStockAssembleAction,
  apStockAssemblePartialAction,
  apStockLoadCheckAction,
  apStockStepAction,
  getApStockOverviewAction,
  type ApStockOverview,
} from "../ap-stock-actions";
import type { BatchCheck } from "@/lib/ap-admin/load-check";
import ApLoadBatchPanel from "./ApLoadBatchPanel";
import ApNewVersionPanel from "./ApNewVersionPanel";
import ApLaunchGatePanel from "./ApLaunchGatePanel";
import ApExplanationFixPanel from "./ApExplanationFixPanel";

// 'AP 재고 관리'(2026-10-12). 터미널 스크립트를 대체하는 관리자 화면: 점검 → (적재 · 렌더 기록 · 화면 기록 · 문제은행 변환) → 초안 세트.
// 모든 쓰기는 "미리보기 → 확인 체크 → 실행" 순서이고, 실행은 미리보기와 같은 계획일 때만 된다. 공개(게시)는 이 화면에 없다.

type Step = "import" | "render" | "screen" | "convert";
const STEP_LABEL: Record<Step, string> = { import: "① 후보 적재", render: "② 렌더 검증 기록", screen: "③ 화면 검증 기록", convert: "④ 문제은행 변환(모의고사용)" };
const STEP_HELP: Record<Step, string> = {
  import: "배치 파일의 후보를 DB 에 새 키만 추가합니다. 이미 검증·변환된 행은 덮어쓰지 않습니다.",
  render: "렌더 보고서의 해시가 현재 DB 문항 내용과 같은 후보만 렌더 검증으로 기록합니다.",
  screen: "화면 증거(모바일·데스크톱 전 항목 통과, 해시 일치)가 있는 후보만 화면 검증으로 기록합니다. 자동 점검은 그래프 의미·문장 자연스러움을 확인하지 않습니다.",
  convert: "렌더·화면 검증이 끝난 후보를 모의고사용 문제로 변환합니다(용도는 변환 때 고정, 한 번에 최대 20건).",
};
const ACTION_LABEL: Record<string, string> = { load_check: "적재 점검", import: "적재", render_verify: "렌더 기록", screen_verify: "화면 기록", convert: "변환", assemble_draft: "초안 세트", new_version_preview: "새 버전 미리보기", new_version_draft: "새 버전 초안", new_version_publish: "새 버전 공개", set_access_tier: "공개 범위 변경" };

type StepResult = Awaited<ReturnType<typeof apStockStepAction>>;

function ResultView({ r }: { r: StepResult }) {
  return (
    <div className="mt-2 rounded border border-grey-200 bg-grey-50 p-2 text-xs" data-testid="ap-stock-result">
      <p className="font-bold">{r.mode === "execute" ? (r.executed ? "실행 완료" : "실행 안 됨") : "미리보기"}{r.blocked ? ` — ${r.blocked}` : ""}</p>
      {Object.keys(r.counts).length > 0 && (
        <p className="mt-1 text-grey-600">{Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>
      )}
      {r.lines.length > 0 && (
        <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-4 text-grey-600">{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      )}
      {r.auditWarning && <p className="mt-1 text-red">{r.auditWarning}</p>}
    </div>
  );
}

function StepCard({ step, batchId, canWrite, onDone }: { step: Step; batchId: string; canWrite: boolean; onDone: () => void }) {
  const [preview, setPreview] = useState<StepResult | null>(null);
  const [result, setResult] = useState<StepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (execute: boolean) => {
    setBusy(true); setError(null);
    try {
      const r = await apStockStepAction({ step, batchId, execute, planHash: execute ? preview?.planHash ?? null : null });
      if (execute) { setResult(r); setPreview(null); setConfirm(false); onDone(); } else { setPreview(r); setResult(null); setConfirm(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "실패했습니다."); }
    finally { setBusy(false); }
  };
  const canRun = canWrite && !!preview?.planHash && !preview.blocked && confirm && !busy;
  return (
    <div className="rounded border border-grey-200 p-3" data-testid={`ap-step-${step}`}>
      <h4 className="text-[13px] font-bold">{STEP_LABEL[step]}</h4>
      <p className="mt-0.5 text-xs text-grey-500">{STEP_HELP[step]}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => run(false)} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">{busy ? "처리 중..." : "미리보기"}</button>
        <label className="flex items-center gap-1 text-xs text-grey-600">
          <input type="checkbox" checked={confirm} disabled={!preview?.planHash || !!preview?.blocked} onChange={(e) => setConfirm(e.target.checked)} />
          미리보기 결과를 확인했습니다
        </label>
        <button type="button" disabled={!canRun} onClick={() => run(true)} className="min-h-9 rounded bg-ink px-3 text-xs font-bold text-white disabled:opacity-40" title={canWrite ? undefined : "이 대상에는 쓸 수 없습니다"}>실행</button>
      </div>
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
      {preview && <ResultView r={preview} />}
      {result && <ResultView r={result} />}
    </div>
  );
}

function AssemblePanel({ ov, canWrite, onDone }: { ov: ApStockOverview; canWrite: boolean; onDone: () => void }) {
  const [file, setFile] = useState(ov.assignments[0]?.file ?? "");
  const sets = ov.assignments.find((a) => a.file === file)?.sets ?? [];
  const [setId, setSetId] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState<"free" | "tutoring">("free");
  const [preview, setPreview] = useState<StepResult | null>(null);
  const [result, setResult] = useState<StepResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = () => { setPreview(null); setResult(null); setConfirm(false); };
  const run = async (execute: boolean) => {
    if (!file || !setId) return;
    setBusy(true); setError(null);
    try {
      const r = await apStockAssembleAction({ reportFile: file, setId, name: name || undefined, tier, execute, planHash: execute ? preview?.planHash ?? null : null });
      if (execute) { setResult(r); setPreview(null); setConfirm(false); onDone(); } else { setPreview(r); setResult(null); }
    } catch (e) { setError(e instanceof Error ? e.message : "실패했습니다."); }
    finally { setBusy(false); }
  };
  if (ov.assignments.length === 0) return <p className="text-sm text-grey-400">저장소에 배정 보고서(exact-assign-*.json)가 없습니다.</p>;
  return (
    <div className="rounded border border-grey-200 p-3" data-testid="ap-assemble">
      <h4 className="text-[13px] font-bold">⑤ 초안 세트 저장(공개 안 함)</h4>
      <p className="mt-0.5 text-xs text-grey-500">미리 계산된 배정 보고서의 세트를 독립 검증(문항군·단원·스킬·계산기·그래프·FRQ, 게시 AB#1·기존 풀 세트와 동일 문항 0)한 뒤 초안으로만 저장합니다. 이름이 같거나 문항이 겹치면 저장을 거부합니다. 무거운 배정 계산(ILP)은 이 화면에서 돌리지 않습니다.</p>
      <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-0.5">배정 보고서
          <select className="min-h-9 rounded border border-grey-300 px-2" value={file} onChange={(e) => { setFile(e.target.value); setSetId(""); reset(); }}>
            {ov.assignments.map((a) => <option key={a.file} value={a.file}>{a.file}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">세트
          <select className="min-h-9 rounded border border-grey-300 px-2" value={setId} onChange={(e) => { setSetId(e.target.value); reset(); }}>
            <option value="">선택</option>
            {sets.map((s) => <option key={s.id} value={s.id} disabled={!s.saveable || s.virtual > 0}>{s.id}{s.virtual ? ` (가상 문항 ${s.virtual})` : ""}{!s.saveable ? " (저장 불가)" : ""}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">이름(비우면 기본값)
          <input className="min-h-9 rounded border border-grey-300 px-2" value={name} onChange={(e) => { setName(e.target.value); reset(); }} placeholder="AP Calculus BC — Practice Exam 1" />
        </label>
        <label className="flex flex-col gap-0.5">공개 범위(공개할 때 적용)
          <select aria-label="공개 범위" className="min-h-9 rounded border border-grey-300 px-2" value={tier} onChange={(e) => { setTier(e.target.value as "free" | "tutoring"); reset(); }}>
            <option value="free">무료 공개(기본)</option><option value="tutoring">튜터링 전용</option>
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !setId} onClick={() => run(false)} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">{busy ? "처리 중..." : "미리보기"}</button>
        <label className="flex items-center gap-1 text-xs text-grey-600"><input type="checkbox" checked={confirm} disabled={!preview?.planHash || !!preview?.blocked} onChange={(e) => setConfirm(e.target.checked)} />미리보기 결과를 확인했습니다</label>
        <button type="button" disabled={!canWrite || !confirm || !preview?.planHash || busy} onClick={() => run(true)} className="min-h-9 rounded bg-ink px-3 text-xs font-bold text-white disabled:opacity-40">초안으로 저장</button>
      </div>
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
      {preview && <ResultView r={preview} />}
      {result && <ResultView r={result} />}
    </div>
  );
}

function PartialPanel({ ov, canWrite, onDone }: { ov: ApStockOverview; canWrite: boolean; onDone: () => void }) {
  const plans = ov.partialPlans ?? [];
  const [file, setFile] = useState(plans[0]?.file ?? "");
  const sets = plans.find((a) => a.file === file)?.sets ?? [];
  const [setId, setSetId] = useState("");
  const [tier, setTier] = useState<"free" | "tutoring">("free");
  const [preview, setPreview] = useState<StepResult | null>(null);
  const [result, setResult] = useState<StepResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = () => { setPreview(null); setResult(null); setConfirm(false); };
  const run = async (execute: boolean) => {
    if (!file || !setId) return;
    setBusy(true); setError(null);
    try {
      const r = await apStockAssemblePartialAction({ planFile: file, setId, tier, execute, planHash: execute ? preview?.planHash ?? null : null });
      if (execute) { setResult(r); setPreview(null); setConfirm(false); onDone(); } else { setPreview(r); setResult(null); }
    } catch (e) { setError(e instanceof Error ? e.message : "실패했습니다."); }
    finally { setBusy(false); }
  };
  if (plans.length === 0) return <p className="text-sm text-grey-400" data-testid="ap-partial-empty">저장소에 부분 연습 세트 계획(data/ap/stock/assembled/partial-rebuild-*.json)이 없습니다.</p>;
  return (
    <div className="rounded border border-grey-200 p-3" data-testid="ap-partial">
      <h4 className="text-[13px] font-bold">⑤-b 부분 연습 세트 초안 저장(공개 안 함)</h4>
      <p className="mt-0.5 text-xs text-grey-500">Non-Calculator / Calculator / Free-Response 부분 세트를 계획 파일에서 골라 독립 검증(해당 이름의 공식 문항 수·계산기 파트·문항군 상한·AB 전용·다루는 단원, <b>풀 모의고사·다른 부분 세트(비보관 전부)와 동일 문항 0</b>)한 뒤 초안으로만 저장합니다. 같은 이름의 세트가 아직 보관되지 않았으면 거부하므로, 이전 부분 세트는 <b>먼저 '공개' 탭에서 보관</b>하세요.</p>
      <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-0.5">계획 파일
          <select aria-label="부분 세트 계획 파일" className="min-h-9 rounded border border-grey-300 px-2" value={file} onChange={(e) => { setFile(e.target.value); setSetId(""); reset(); }}>
            {plans.map((a) => <option key={a.file} value={a.file}>{a.file}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">세트
          <select aria-label="부분 세트 선택" className="min-h-9 rounded border border-grey-300 px-2" value={setId} onChange={(e) => { setSetId(e.target.value); reset(); }}>
            <option value="">선택</option>
            {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">공개 범위(공개할 때 적용)
          <select aria-label="부분 세트 공개 범위" className="min-h-9 rounded border border-grey-300 px-2" value={tier} onChange={(e) => { setTier(e.target.value as "free" | "tutoring"); reset(); }}>
            <option value="free">무료 공개(기본)</option><option value="tutoring">튜터링 전용</option>
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !setId} onClick={() => run(false)} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">{busy ? "처리 중..." : "미리보기"}</button>
        <label className="flex items-center gap-1 text-xs text-grey-600"><input type="checkbox" checked={confirm} disabled={!preview?.planHash || !!preview?.blocked} onChange={(e) => setConfirm(e.target.checked)} />미리보기 결과를 확인했습니다</label>
        <button type="button" disabled={!canWrite || !confirm || !preview?.planHash || busy} onClick={() => run(true)} className="min-h-9 rounded bg-ink px-3 text-xs font-bold text-white disabled:opacity-40">초안으로 저장</button>
      </div>
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
      {preview && <ResultView r={preview} />}
      {result && <ResultView r={result} />}
    </div>
  );
}

export default function ApStockPanel() {
  const [ov, setOv] = useState<ApStockOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState("");
  const [check, setCheck] = useState<{ batches: BatchCheck[]; totals: { keys: number; ready: number; shortBatches: number; dbRows: number } } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const load = useCallback(() => {
    getApStockOverviewAction().then((o) => { setOv(o); setBatchId((b) => b || o.batches[0]?.id || ""); }).catch(() => setError("AP 재고 관리 정보를 불러오지 못했습니다."));
  }, []);
  useEffect(() => { load(); }, [load]);

  const runCheck = async () => {
    setChecking(true); setCheckError(null);
    try { const r = await apStockLoadCheckAction(); setCheck({ batches: r.batches, totals: r.totals }); load(); }
    catch (e) { setCheckError(e instanceof Error ? e.message : "점검에 실패했습니다."); }
    finally { setChecking(false); }
  };

  if (error) return <p className="text-sm text-red">{error}</p>;
  if (!ov) return <p className="text-sm text-grey-500">불러오는 중...</p>;
  const batch = ov.batches.find((b) => b.id === batchId);
  const steps: Step[] = batch?.hasLoadStep ? ["import", "render", "screen", "convert"] : ["render", "screen", "convert"];

  return (
    <div className="space-y-6" data-testid="ap-stock-panel">
      <section>
        <h3 className="text-sm font-bold">연결된 Supabase 프로젝트</h3>
        <p className="mt-1 text-sm" data-testid="ap-stock-target">
          <span className="font-mono">{ov.target.ref}</span>{" "}
          <span className={ov.target.canWrite ? "font-bold text-green" : "font-bold text-red"}>{ov.target.canWrite ? "쓰기 허용(비프로덕션 허용 목록)" : "쓰기 차단 — 점검(읽기)만 가능"}</span>
        </p>
        {ov.target.reason && <p className="mt-1 text-xs text-red" data-testid="ap-stock-target-reason">{ov.target.reason}</p>}
        <p className="mt-1 text-xs text-grey-500">프로덕션 변경은 이 화면에서 할 수 없습니다(별도 승인 절차). 게시된 세트·응시·답안·결과는 읽지도 쓰지도 않습니다.</p>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">적재 점검(읽기 전용)</h3>
          <button type="button" disabled={checking} onClick={runCheck} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">{checking ? "점검 중..." : "점검 실행"}</button>
        </div>
        {checkError && <p className="mt-2 text-xs text-red" role="alert">{checkError}</p>}
        {!check && !checking && <p className="mt-2 text-xs text-grey-400">아직 점검하지 않았습니다. 배치별 통과 키 수와 DB 적재·렌더·화면·검수 환경 준비(review_env_ready) 수를 비교합니다.</p>}
        {check && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs" data-testid="ap-stock-check">
              <thead><tr className="text-left text-grey-500"><th className="py-1 pr-2">배치</th><th className="py-1 pr-2 text-right">통과 키</th><th className="py-1 pr-2 text-right">DB 적재</th><th className="py-1 pr-2 text-right">렌더</th><th className="py-1 pr-2 text-right">화면</th><th className="py-1 text-right">준비 완료</th></tr></thead>
              <tbody>
                {check.batches.map((b) => (
                  <tr key={b.id} className={"border-t border-grey-100 " + (b.short ? "bg-red/5 font-bold text-red" : "")} data-short={b.short ? "1" : "0"}>
                    <td className="py-1 pr-2">{b.label}{b.short ? " ← 부족" : ""}</td><td className="py-1 pr-2 text-right">{b.keys}</td><td className="py-1 pr-2 text-right">{b.loaded}</td><td className="py-1 pr-2 text-right">{b.render}</td><td className="py-1 pr-2 text-right">{b.screen}</td><td className="py-1 text-right">{b.ready}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-grey-500">합계: 통과 키 {check.totals.keys} 중 준비 완료 {check.totals.ready} · 부족한 배치 {check.totals.shortBatches}개 · DB 후보 행 {check.totals.dbRows}</p>
          </div>
        )}
      </section>

      <ApLaunchGatePanel />

      <section className="space-y-3">
        <ApLoadBatchPanel ov={ov} onDone={load} />
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">배치 작업</h3>
          <select aria-label="배치 선택" className="min-h-9 rounded border border-grey-300 px-2 text-xs" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {ov.batches.map((b) => <option key={b.id} value={b.id} disabled={!b.artifactsOk}>{b.title}{b.artifactsOk ? "" : " (산출물 없음)"}</option>)}
          </select>
        </div>
        {ov.batches.length === 0 ? <p className="text-sm text-grey-400">등록된 배치가 없습니다.</p> : steps.map((s) => <StepCard key={`${batchId}-${s}`} step={s} batchId={batchId} canWrite={ov.target.canWrite} onDone={load} />)}
        <AssemblePanel ov={ov} canWrite={ov.target.canWrite} onDone={load} />
        <PartialPanel ov={ov} canWrite={ov.target.canWrite} onDone={load} />
        <ApNewVersionPanel canWrite={ov.target.canWrite} />
        <ApExplanationFixPanel canWrite={ov.target.canWrite} />
      </section>

      <section>
        <h3 className="text-sm font-bold">작업 이력(최근 30건)</h3>
        {ov.history.length === 0 ? <p className="mt-2 text-xs text-grey-400">작업 이력이 없습니다.</p> : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs" data-testid="ap-stock-history">
              <thead><tr className="text-left text-grey-500"><th className="py-1 pr-2">시각</th><th className="py-1 pr-2">관리자</th><th className="py-1 pr-2">작업</th><th className="py-1 pr-2">구분</th><th className="py-1 pr-2">결과</th><th className="py-1 pr-2">대상</th><th className="py-1">건수</th></tr></thead>
              <tbody>
                {ov.history.map((h) => (
                  <tr key={h.id} className="border-t border-grey-100 align-top">
                    <td className="py-1 pr-2 whitespace-nowrap">{new Date(h.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td><td className="py-1 pr-2">{h.actor}</td>
                    <td className="py-1 pr-2">{ACTION_LABEL[h.action] ?? h.action}{typeof h.scope.batchId === "string" ? ` · ${h.scope.batchId}` : typeof h.scope.setId === "string" ? ` · ${h.scope.setId}` : ""}</td>
                    <td className="py-1 pr-2">{h.mode === "execute" ? "실행" : "미리보기"}</td><td className="py-1 pr-2">{h.status === "ok" ? "성공" : h.status === "refused" ? "거부" : "오류"}{h.note ? ` (${h.note})` : ""}</td>
                    <td className="py-1 pr-2 font-mono">{h.targetRef}</td><td className="py-1">{Object.entries(h.counts).map(([k, v]) => `${k} ${v}`).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
