"use client";

import { Suspense, lazy, useEffect, useState, useTransition } from "react";
import {
  assembleMockExamSet,
  archiveMockExamSetAction,
  getMockExamSetContentAction,
  getMockExamSetItems,
  listMockExamSets,
  publishMockExamSet,
  listAllMockExamAttemptsAction,
  getMockExamPoolSummaryAction,
  listMockExamRoutingPoliciesAction,
  type MockExamRoutingPolicyRow,
  type MockExamPoolRow,
  type MockExamSetSummary,
  type MockExamAttemptHistoryRow,
  type MstReadinessReport,
  type MockExamSetItemDetail,
} from "../mock-exam-actions";
import type { DifficultyTier } from "@/lib/mock-exam/assemble";
import { describePolicy } from "@/lib/mock-exam/routing";
import type { MockExamSetContentItem } from "@/lib/mock-exam/set-content";
import { domainShort, skillLabel } from "@/lib/problem-taxonomy";
import MockExamSetContentViewer from "@/app/components/MockExamSetContentViewer";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate } from "@/lib/format-datetime";

// 대체 문항 필요 표시는 문제 오류 신고 기능(별도 액션 모듈) — 기존 화면 첫 렌더에 영향이 없도록 lazy 로 불러온다.
const ReplacementNeedsBlock = lazy(() => import("./ReplacementNeeds").then((m) => ({ default: m.ReplacementNeedsBlock })));
// hard 난이도 점검(2026-10-01) — 별도 서브탭이라 lazy 로 불러온다.
const DifficultyReviewPanel = lazy(() => import("./DifficultyReviewPanel"));
const ReplacementBadge = lazy(() => import("./ReplacementNeeds").then((m) => ({ default: m.ReplacementBadge })));

const TIER_LABEL: Record<DifficultyTier, string> = { foundation: "기본", standard: "표준", advanced: "상위" };
const STATUS_LABEL: Record<string, string> = { draft: "초안", published: "공개", archived: "보관" };

// 2026-09-21(UAT 지적) — 관리자 모의고사 관리 화면을 생성/검토/공개/보관/내역
// 서브탭으로 재구성한다. 기존엔 한 화면에 조립·목록·메타데이터만 있는 "검토" 테이블뿐이라
// 실제 문항 내용을 볼 수 없었고, 보관·전체 배정·전체 응시 내역을 볼 방법도 없었다.
const SUB_TABS = ["생성", "문항 풀", "난이도 점검", "검토", "내역", "공개", "보관"] as const;
type SubTab = (typeof SUB_TABS)[number];

export default function MockExamSetsPanel({ initialSets }: { initialSets: MockExamSetSummary[] }) {
  const [subTab, setSubTab] = useState<SubTab>("생성");

  return (
    <div className="mt-8 space-y-6">
      <div className="flex gap-1 border-b border-grey-200">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            aria-current={subTab === t ? "page" : undefined}
            className={
              "px-3 pb-2.5 -mb-px border-b-2 text-[13px] font-bold " +
              (subTab === t ? "text-ink border-ink" : "text-grey-500 border-transparent")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === "생성" && <CreateTab initialSets={initialSets} />}
      {subTab === "문항 풀" && <PoolTab />}
      {subTab === "난이도 점검" && (
        <Suspense fallback={<p className="text-sm text-grey-500">불러오는 중...</p>}>
          <DifficultyReviewPanel />
        </Suspense>
      )}
      {subTab === "검토" && <ReviewTab />}
      {subTab === "공개" && <PublishTab />}
      {subTab === "보관" && <ArchiveTab />}
      {subTab === "내역" && <HistoryTab />}
    </div>
  );
}

/**
 * 문항 풀(2026-09-29). 영역·세부 기술별로 모의고사에 쓸 수 있는 공개 문항(풀 = 모의고사용 + 기존)이 몇 개이고,
 * 그중 몇 개가 세트에 배정됐고 몇 개가 남았는지 본다. 일반용은 후보가 아니라 참고로만 보인다.
 * 배정은 서로 다른 문항 수 — 여러 세트에 있어도 1회, 공개·초안 세트에 모두 있으면 공개로만 센다, 보관 세트는 제외.
 */
function PoolTab() {
  const [rows, setRows] = useState<MockExamPoolRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMockExamPoolSummaryAction()
      .then((r) => { if (!cancelled) setRows(r); })
      .catch(() => { if (!cancelled) setError("문항 풀 현황을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, []);
  const t = (rows ?? []).reduce(
    (a, r) => ({
      pool: a.pool + r.mockExam + r.both, both: a.both + r.both, pub: a.pub + r.assignedPublished,
      draft: a.draft + r.assignedDraft, general: a.general + r.general,
    }),
    { pool: 0, both: 0, pub: 0, draft: 0, general: 0 },
  );
  const remaining = t.pool - t.pub - t.draft;
  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5" data-testid="mock-pool-summary">
      <h2 className="text-sm font-semibold text-ink">모의고사 문항 풀</h2>
      {rows && (
        <p className="mt-1 text-xs text-grey-500" data-testid="mock-pool-header">
          풀 {t.pool} · 배정 {t.pub + t.draft} · 남음 {remaining} · 일반용(제외) {t.general}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
      {!rows && !error && <p className="mt-2 text-xs text-grey-500">불러오는 중...</p>}
      {rows && rows.length === 0 && <p className="mt-2 text-sm text-grey-400">공개된 문항이 없습니다.</p>}
      {rows && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr className="text-left text-grey-500">
                <th className="py-1 pr-2">영역</th>
                <th className="py-1 pr-2">세부 기술</th>
                <th className="py-1 pr-2 text-right">풀</th>
                <th className="py-1 pr-2 text-right">공개 세트 배정</th>
                <th className="py-1 pr-2 text-right">초안·검토 배정</th>
                <th className="py-1 pr-2 text-right">남음</th>
                <th className="py-1 text-right">일반용(제외)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pool = r.mockExam + r.both;
                const rest = pool - r.assignedPublished - r.assignedDraft;
                return (
                  <tr key={`${r.satDomain}|${r.skillCode ?? ""}`} className="border-t border-grey-100">
                    <td className="py-1 pr-2">{domainShort(r.satDomain)}</td>
                    <td className="py-1 pr-2">{r.skillCode ? skillLabel(r.skillCode) : "(기술 미지정)"}</td>
                    <td className="py-1 pr-2 text-right">
                      {pool}
                      {r.both > 0 && <span className="ml-1 whitespace-nowrap text-grey-400">(기존 {r.both})</span>}
                    </td>
                    <td className="py-1 pr-2 text-right">{r.assignedPublished}</td>
                    <td className="py-1 pr-2 text-right">{r.assignedDraft}</td>
                    <td className={"py-1 pr-2 text-right font-medium " + (rest === 0 ? "text-red" : "text-ink")}>{rest}</td>
                    <td className="py-1 text-right text-grey-500">{r.general}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-grey-300 font-semibold" data-testid="mock-pool-total">
                <td className="py-1 pr-2" colSpan={2}>합계</td>
                <td className="py-1 pr-2 text-right">{t.pool}</td>
                <td className="py-1 pr-2 text-right">{t.pub}</td>
                <td className="py-1 pr-2 text-right">{t.draft}</td>
                <td className="py-1 pr-2 text-right">{remaining}</td>
                <td className="py-1 text-right text-grey-500">{t.general}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11.5px] text-grey-500">
        공개된 문항 기준입니다. 풀은 모의고사용과 기존(양쪽) 문항이며 일반용은 조립에 쓰이지 않습니다. 배정은 서로 다른 문항 수이고
        (여러 세트에 있어도 1회, 보관된 세트 제외) 남음 = 풀 − 배정입니다.
      </p>
      <Suspense fallback={null}>
        <ReplacementNeedsBlock
          poolRest={Object.fromEntries(
            (rows ?? []).map((r) => [`${r.satDomain}|${r.skillCode ?? ""}`, r.mockExam + r.both - r.assignedPublished - r.assignedDraft]),
          )}
        />
      </Suspense>
    </section>
  );
}

function CreateTab({ initialSets }: { initialSets: MockExamSetSummary[] }) {
  const [sets, setSets] = useState(initialSets);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<DifficultyTier>("standard");
  const [rwCount, setRwCount] = useState(27);
  const [mathCount, setMathCount] = useState(22);
  const [format, setFormat] = useState<"fixed" | "mst">("fixed");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shortfallNotice, setShortfallNotice] = useState<string | null>(null);

  function refresh() {
    startTransition(async () => {
      setSets(await listMockExamSets());
    });
  }

  function handleAssemble() {
    setError(null);
    setShortfallNotice(null);
    startTransition(async () => {
      try {
        const result = await assembleMockExamSet({ name, difficultyTier: tier, rwCount, mathCount, format });
        if (result.readiness && !result.readiness.ready) {
          setShortfallNotice(`이 4모듈 세트는 아직 공개할 수 없습니다 — ${readinessSummary(result.readiness)}`);
        } else if (result.readiness && skillWarningText(result.readiness)) {
          setShortfallNotice(skillWarningText(result.readiness));
        } else if (result.shortfalls.length > 0) {
          setShortfallNotice(
            `일부 영역·난이도 셀에서 목표 문항 수를 채우지 못했습니다: ${result.shortfalls
              .map((s) => `${s.section}/${s.satDomain}/${s.difficulty} (필요 ${s.needed}, 확보 ${s.found})`)
              .join(", ")}`,
          );
        }
        setName("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "조립 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">새 세트 조립</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="col-span-2 flex flex-col gap-1 text-xs text-grey-500 sm:col-span-1">
            이름
            <input
              className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 표준 세트 A"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-grey-500">
            난이도 등급
            <select
              className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
              value={tier}
              onChange={(e) => setTier(e.target.value as DifficultyTier)}
            >
              {(Object.keys(TIER_LABEL) as DifficultyTier[]).map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-grey-500">
            형식
            <select
              className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
              value={format}
              onChange={(e) => setFormat(e.target.value as "fixed" | "mst")}
              data-testid="set-format"
            >
              <option value="fixed">고정형 (섹션별 타이머)</option>
              <option value="mst">Digital SAT 4모듈 (27·27 / 휴식 / 22·22)</option>
            </select>
          </label>
          {format === "fixed" && (
            <>
              <label className="flex flex-col gap-1 text-xs text-grey-500">
                R&W 문항 수
                <input
                  type="number"
                  min={1}
                  className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
                  value={rwCount}
                  onChange={(e) => setRwCount(Number(e.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-grey-500">
                Math 문항 수
                <input
                  type="number"
                  min={1}
                  className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
                  value={mathCount}
                  onChange={(e) => setMathCount(Number(e.target.value))}
                />
              </label>
            </>
          )}
        </div>
        {format === "mst" && (
          <p className="mt-2 text-xs text-grey-500">
            R&W Module 1·2 각 27문항(32분), 10분 휴식, Math Module 1·2 각 22문항(35분). 모듈 간 문항이 겹치지 않게 조립합니다.
            Module 2는 Module 1 성과에 따라 higher/lower 두 변형(각각 같은 정원)으로 조립되어 문항이 모듈당 최대 3배 필요합니다.
          </p>
        )}
        {format === "mst" && <RoutingPolicyInfo />}
        <button
          type="button"
          disabled={isPending || !name.trim()}
          onClick={handleAssemble}
          className="mt-4 rounded bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          조립하기
        </button>
        {error ? <p className="mt-2 text-sm text-red">{error}</p> : null}
        {shortfallNotice ? <p className="mt-2 text-sm text-orange-600">{shortfallNotice}</p> : null}
      </section>

      <SetListTable sets={sets} emptyLabel="아직 조립된 세트가 없습니다." />
    </div>
  );
}

/** 활성 라우팅 정책(읽기 전용). 값은 DB 데이터 — 제품 오너 조정은 새 정책 버전 발행으로 한다. */
function RoutingPolicyInfo() {
  const [rows, setRows] = useState<MockExamRoutingPolicyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    listMockExamRoutingPoliciesAction()
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "라우팅 정책을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, []);
  if (error) return <p className="mt-2 text-xs text-red">{error}</p>;
  if (rows === null) return null;
  const active = rows.filter((r) => r.active);
  return (
    <div className="mt-2 rounded border border-grey-200 p-2 text-xs text-grey-600" data-testid="routing-policy-info">
      <p className="font-semibold text-ink">Module 2 라우팅 정책(활성, 직원 전용 정보)</p>
      {active.length === 0 ? (
        <p className="text-red">활성 정책이 없습니다 — 라우팅 세트는 공개할 수 없습니다.</p>
      ) : (
        active.map((p) => (
          <p key={p.section}>
            {p.section === "rw" ? "R&W" : "Math"} v{p.version}: {describePolicy(p)}
          </p>
        ))
      )}
    </div>
  );
}

/** 4모듈(mst) 세트의 출시 가능 여부. incomplete면 공개가 DB에서 거부되므로 관리자가 먼저 알 수 있게 표시한다. */
function ReadinessBadge({ set }: { set: MockExamSetSummary }) {
  if (set.format !== "mst") return null;
  const missing = set.readinessReport?.modules.filter((m) => !m.ok) ?? [];
  return (
    <span
      className={`ml-1.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold ${set.readinessStatus === "ready" ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}
      title={missing.map((m) => `${MODULE_LABEL[m.moduleKey] ?? m.moduleKey}${m.route ? ` (${m.route})` : ""}: ${m.found}/${m.needed}`).join("\n")}
      data-testid="readiness-badge"
    >
      {set.readinessStatus === "ready" ? "4모듈 · 준비 완료" : "4모듈 · 문항 부족"}
    </span>
  );
}

const MODULE_LABEL: Record<string, string> = {
  rw_m1: "R&W Module 1",
  rw_m2: "R&W Module 2",
  math_m1: "Math Module 1",
  math_m2: "Math Module 2",
};

/** 4모듈 세트 검수: 문항별 M1 / M2(higher·lower) 배정 가능 플래그(난이도 라벨에서 파생). */
function MstModuleFlags({ examSetId }: { examSetId: string }) {
  const [rows, setRows] = useState<MockExamSetItemDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getMockExamSetItems(examSetId)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "배정 플래그를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [examSetId]);
  if (error) return <p className="mb-2 text-sm text-red">{error}</p>;
  if (rows === null) return <p className="mb-2 text-xs text-grey-400">배정 플래그 불러오는 중…</p>;
  const mark = (v: boolean) => (v ? "O" : "-");
  return (
    <details className="mb-3 rounded-lg border border-grey-200 p-3" data-testid="mst-module-flags">
      <summary className="cursor-pointer text-xs font-semibold text-ink">모듈 배정 플래그 ({rows.length}문항)</summary>
      <table className="mt-2 w-full text-left text-[11.5px]">
        <thead>
          <tr className="text-grey-500">
            <th className="py-1">모듈</th>
            <th>영역</th>
            <th>skill</th>
            <th>난이도</th>
            <th>경로</th>
            <th>M1</th>
            <th>M2 higher</th>
            <th>M2 lower</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-grey-100">
              <td className="py-1">{MODULE_LABEL[r.moduleKey ?? ""] ?? "-"}</td>
              <td>{r.satDomain}</td>
              <td>{r.skillCode ?? "-"}</td>
              <td>{r.difficulty}</td>
              <td>{r.route ?? "-"}</td>
              <td>{mark(r.m1Eligible)}</td>
              <td>{mark(r.m2HigherEligible)}</td>
              <td>{mark(r.m2LowerEligible)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** skill 쏠림은 차단 사유가 아니라 참고용 경고다(2026-09-29). */
function skillWarningText(r: MstReadinessReport): string {
  const w = (r.skillWarnings ?? []).map((v) => `${MODULE_LABEL[v.moduleKey] ?? v.moduleKey}/${v.satDomain}/${v.skillCode} ${v.count}개(권장 상한 ${v.cap})`);
  return w.length ? `skill 분포 경고(출시에는 영향 없음): ${w.join(", ")}` : "";
}

function readinessSummary(r: MstReadinessReport): string {
  const mods = r.modules.filter((m) => !m.ok).map((m) => `${MODULE_LABEL[m.moduleKey] ?? m.moduleKey}${m.route ? `(${m.route})` : ""} ${m.found}/${m.needed}`);
  const cells = r.shortfalls.map((s) => `${MODULE_LABEL[s.moduleKey ?? ""] ?? s.section}/${s.satDomain}/${s.difficulty}${s.format ? `/${s.format}` : ""} (필요 ${s.needed}, 확보 ${s.found})`);
  const skills = (r.skillViolations ?? []).map((v) => `${MODULE_LABEL[v.moduleKey] ?? v.moduleKey}/${v.satDomain}/${v.skillCode} ${v.count}개(상한 ${v.cap})`);
  const extra = [
    skills.length ? ` · skill 쏠림: ${skills.join(", ")}` : "",
    (r.eligibilityViolations ?? []).length ? ` · Module 1 배정 불가 문항 ${r.eligibilityViolations.length}` : "",
    (r.similarityViolations ?? []).length ? ` · 유사문항 그룹 중복 ${r.similarityViolations.length}` : "",
    r.missingSnapshotCount ? ` · 스냅샷 누락 ${r.missingSnapshotCount}` : "",
    r.routeShapeViolationCount ? ` · 경로 구성 오류 ${r.routeShapeViolationCount}` : "",
    (r.variantEligibilityViolations ?? []).length ? ` · 변형 배정 불가 문항 ${r.variantEligibilityViolations.length}` : "",
    (r.routingPolicyMissing ?? []).length ? ` · 라우팅 정책 없음(${r.routingPolicyMissing.join(", ")})` : "",
  ].join("");
  return `모듈 정원 미달: ${mods.join(", ") || "없음"}${cells.length ? ` · 부족 셀: ${cells.join(", ")}` : ""}${r.duplicateCount ? ` · 중복 문항 ${r.duplicateCount}` : ""}${extra}`;
}

function SetListTable({ sets, emptyLabel }: { sets: MockExamSetSummary[]; emptyLabel: string }) {
  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">세트 목록</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-grey-500">
            <th className="py-1">이름</th>
            <th>등급</th>
            <th>상태</th>
            <th>R&W</th>
            <th>Math</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id} className="border-t border-grey-100">
              <td className="py-2">
                {s.name} <span className="text-xs text-grey-400">v{s.versionNo}</span>
                {s.status !== "archived" && (
                  <Suspense fallback={null}>
                    <ReplacementBadge examSetId={s.id} />
                  </Suspense>
                )}
              </td>
              <td>{TIER_LABEL[s.difficultyTier]}</td>
              <td>
                <span className={s.status === "published" ? "text-green" : s.status === "draft" ? "text-grey-500" : "text-grey-300"}>
                  {STATUS_LABEL[s.status]}
                </span>
                <ReadinessBadge set={s} />
              </td>
              <td>{s.rwCount}</td>
              <td>{s.mathCount}</td>
            </tr>
          ))}
          {sets.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-sm text-grey-400">
                {emptyLabel}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

/** 검토 — 아직 공개 전(초안)인 세트만. 실제 문항 내용을 확인한 뒤 그 자리에서 바로 공개할 수 있다. */
function ReviewTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  function refresh() {
    listMockExamSets().then((all) => setSets(all.filter((s) => s.status === "draft")));
  }
  useEffect(refresh, []);

  function openContent(setId: string) {
    setSelectedId(setId);
    setItems(null);
    setError(null);
    setPublishError(null);
    setConfirmingArchive(false);
    getMockExamSetContentAction(setId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "문항을 불러오지 못했습니다."));
  }

  async function handlePublish(setId: string) {
    setPublishBusy(true);
    setPublishError(null);
    try {
      await publishMockExamSet(setId);
      setSelectedId(null);
      setItems(null);
      refresh();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "공개 중 오류가 발생했습니다.");
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleArchive(setId: string) {
    setArchiveBusy(true);
    setPublishError(null);
    try {
      await archiveMockExamSetAction(setId);
      setSelectedId(null);
      setItems(null);
      setConfirmingArchive(false);
      refresh();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "보관 처리 중 오류가 발생했습니다.");
    } finally {
      setArchiveBusy(false);
    }
  }

  if (sets === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">검토 대기 중인 초안</h2>
        <p className="mt-1 text-xs text-grey-500">공개 전 세트의 실제 지문·질문·선택지·정답·해설을 확인합니다.</p>
        <ul className="mt-3 flex flex-col gap-1">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => openContent(s.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                  selectedId === s.id ? "bg-ink text-white" : "bg-grey-100 text-ink hover:bg-grey-200"
                }`}
              >
                {s.name} v{s.versionNo} · {TIER_LABEL[s.difficultyTier]} · R&W {s.rwCount} · Math {s.mathCount}
              </button>
            </li>
          ))}
          {sets.length === 0 && <li className="text-sm text-grey-400">검토할 초안이 없습니다.</li>}
        </ul>
      </section>

      {selectedId && (
        <section className="rounded-xl border border-grey-200 bg-white p-5">
          {error ? (
            <p className="text-sm text-red">{error}</p>
          ) : items === null ? (
            <p className="text-sm text-grey-400">불러오는 중…</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">문항 내용</span>
                <div className="flex items-center gap-2">
                  {confirmingArchive ? (
                    <>
                      <span className="text-xs text-grey-500">보관하면 학생에게 더 이상 보이지 않습니다.</span>
                      <button
                        type="button"
                        disabled={archiveBusy}
                        onClick={() => handleArchive(selectedId)}
                        className="rounded bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                      >
                        {archiveBusy ? "처리 중..." : "확인 — 보관"}
                      </button>
                      <button type="button" onClick={() => setConfirmingArchive(false)} className="text-xs font-semibold text-grey-500">
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingArchive(true)}
                      className="rounded border border-grey-200 px-3 py-1.5 text-xs font-bold text-grey-600"
                    >
                      보관 처리
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={publishBusy || sets?.find((s) => s.id === selectedId)?.readinessStatus === "incomplete"}
                    onClick={() => handlePublish(selectedId)}
                    className="rounded bg-ink px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    data-testid="publish-set"
                  >
                    {publishBusy ? "공개 중..." : "이 세트 공개하기"}
                  </button>
                </div>
              </div>
              {(() => {
                const r = sets?.find((s) => s.id === selectedId)?.readinessReport;
                if (!r) return null;
                const warn = skillWarningText(r);
                return (
                  <>
                    {!r.ready && (
                      <p className="mb-2 text-sm text-red" data-testid="readiness-detail">
                        공개 불가 — {readinessSummary(r)}
                      </p>
                    )}
                    {warn && (
                      <p className="mb-2 text-sm text-grey-500" data-testid="skill-warning">
                        {warn}
                      </p>
                    )}
                  </>
                );
              })()}
              {publishError && <p className="mb-2 text-sm text-red">{publishError}</p>}
              {sets?.find((s) => s.id === selectedId)?.format === "mst" && <MstModuleFlags examSetId={selectedId} />}
              <MockExamSetContentViewer items={items} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** 공개 — 이미 학생에게 노출 중인 세트를 확인·필요하면 여기서 보관 처리한다. */
function PublishTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  function refresh() {
    listMockExamSets().then((all) => setSets(all.filter((s) => s.status === "published")));
  }
  useEffect(refresh, []);

  function openContent(setId: string) {
    setSelectedId(setId);
    setItems(null);
    setError(null);
    setArchiveError(null);
    setConfirmingArchive(false);
    getMockExamSetContentAction(setId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "문항을 불러오지 못했습니다."));
  }

  async function handleArchive(setId: string) {
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await archiveMockExamSetAction(setId);
      setSelectedId(null);
      setItems(null);
      setConfirmingArchive(false);
      refresh();
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "보관 처리 중 오류가 발생했습니다.");
    } finally {
      setArchiveBusy(false);
    }
  }

  if (sets === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">공개된 세트</h2>
        <p className="mt-1 text-xs text-grey-500">지금 학생에게 공개되는 세트의 실제 문항 내용을 확인합니다.</p>
        <ul className="mt-3 flex flex-col gap-1">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => openContent(s.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                  selectedId === s.id ? "bg-ink text-white" : "bg-grey-100 text-ink hover:bg-grey-200"
                }`}
              >
                {s.name} v{s.versionNo} · {TIER_LABEL[s.difficultyTier]} · R&W {s.rwCount} · Math {s.mathCount}
              </button>
            </li>
          ))}
          {sets.length === 0 && <li className="text-sm text-grey-400">공개된 세트가 없습니다.</li>}
        </ul>
      </section>

      {selectedId && (
        <section className="rounded-xl border border-grey-200 bg-white p-5">
          {error ? (
            <p className="text-sm text-red">{error}</p>
          ) : items === null ? (
            <p className="text-sm text-grey-400">불러오는 중…</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">문항 내용</span>
                {confirmingArchive ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-grey-500">보관하면 학생에게 더 이상 보이지 않습니다.</span>
                    <button
                      type="button"
                      disabled={archiveBusy}
                      onClick={() => handleArchive(selectedId)}
                      className="rounded bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      {archiveBusy ? "처리 중..." : "확인 — 보관"}
                    </button>
                    <button type="button" onClick={() => setConfirmingArchive(false)} className="text-xs font-semibold text-grey-500">
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingArchive(true)}
                    className="rounded border border-grey-200 px-3 py-1.5 text-xs font-bold text-grey-600"
                  >
                    보관 처리
                  </button>
                )}
              </div>
              {archiveError && <p className="mb-2 text-sm text-red">{archiveError}</p>}
              <MockExamSetContentViewer items={items} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** 보관 — 보관된 세트만 읽기 전용으로 확인한다. 보관 처리 자체는 검토·공개 탭에서 한다
 * (2026-09-21 UAT 지적: "보관은 보관된 내역만 볼 수 있게, 검토·공개 쪽에서 보관 처리"). */
function ArchiveTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMockExamSets({ archivedOnly: true }).then(setSets);
  }, []);

  function openContent(setId: string) {
    setSelectedId(setId);
    setItems(null);
    setError(null);
    getMockExamSetContentAction(setId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "문항을 불러오지 못했습니다."));
  }

  if (sets === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">보관된 세트</h2>
        <p className="mt-1 text-xs text-grey-500">학생에게 더 이상 보이지 않는 세트입니다. 보관 처리는 &ldquo;검토&rdquo;·&ldquo;공개&rdquo; 탭에서 합니다.</p>
        <ul className="mt-3 flex flex-col gap-1">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => openContent(s.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                  selectedId === s.id ? "bg-ink text-white" : "bg-grey-100 text-ink hover:bg-grey-200"
                }`}
              >
                {s.name} v{s.versionNo} · {TIER_LABEL[s.difficultyTier]} · R&W {s.rwCount} · Math {s.mathCount}
              </button>
            </li>
          ))}
          {sets.length === 0 && <li className="text-sm text-grey-400">보관된 세트가 없습니다.</li>}
        </ul>
      </section>

      {selectedId && (
        <section className="rounded-xl border border-grey-200 bg-white p-5">
          {error ? (
            <p className="text-sm text-red">{error}</p>
          ) : items === null ? (
            <p className="text-sm text-grey-400">불러오는 중…</p>
          ) : (
            <MockExamSetContentViewer items={items} />
          )}
        </section>
      )}
    </div>
  );
}

function HistoryTab() {
  const tz = useViewerTimezone();
  const [rows, setRows] = useState<MockExamAttemptHistoryRow[] | null>(null);

  useEffect(() => {
    listAllMockExamAttemptsAction().then(setRows);
  }, []);

  if (rows === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">응시 내역(전체 · 학생이 직접 시작한 응시)</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-grey-500">
            <th className="py-1">학생</th>
            <th>세트</th>
            <th>상태</th>
            <th>시작</th>
            <th>제출</th>
            <th>정답</th>
            <th>M2 경로(직원 전용)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.attemptId} className="border-t border-grey-100">
              <td className="py-2">{r.studentName ?? r.studentId}</td>
              <td>{r.examSetName}</td>
              <td>{STATUS_LABEL[r.status] ?? r.status}</td>
              <td>{r.startedAt ? fmtDate(r.startedAt, undefined, tz) : "-"}</td>
              <td>{r.submittedAt ? fmtDate(r.submittedAt, undefined, tz) : "-"}</td>
              <td>{r.correctCount !== null ? `${r.correctCount}/${r.totalCount}` : "-"}</td>
              <td data-testid="history-route">
                {r.rwRoute || r.mathRoute
                  ? `R&W ${r.rwRoute ?? "-"}${r.rwPolicyVersion != null ? ` (정책 v${r.rwPolicyVersion})` : ""} · Math ${r.mathRoute ?? "-"}${r.mathPolicyVersion != null ? ` (정책 v${r.mathPolicyVersion})` : ""}`
                  : "-"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-sm text-grey-400">
                응시 기록이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
