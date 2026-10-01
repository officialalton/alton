"use client";

// 2026-09-19(제품 오너 지시) — 200개교 데이터를 모으기 전에 그 데이터를 보여줄 학생·학부모용
// "대학 탐색" 화면을 먼저 만든다. 로드맵 탭의 세 번째 서브탭으로 들어간다(2026-09-18 결정:
// 대학 관련 학생 진입점은 로드맵 탭 안에 둔다). 읽기 전용 — 합격 확률/가능성 예측은 정책상 없다.
//
// 2026-09-23(College Explore UI 개편 지시서) — 목록·상세 화면을 검색 중심 구조로 다시 짰다.
// 데이터 모델·관리자 편집 기능은 그대로 재사용(지시서 요구사항). 핵심 변경:
// (1) 목록에 검색+간단 필터(지역/유형/확인상태), 순위는 이름보다 덜 강조.
// (2) 상세 화면을 헤더→지원 준비 요약→섹션 탐색(Admissions/Student Profile/Essays/
//     Costs&Aid/Majors/Sources&Updates)→출처 순으로 재구성.
// (3) "지원 연도" 선택을 상세 화면 전체의 단일 기준으로 통일(기존엔 입시 카드·학업 지표·
//     에세이가 각자 다른 연도를 암묵적으로 썼다) — pickForYear()가 선택 연도에 데이터가
//     없으면 가장 가까운 다른 연도로 대체하고 "통계 기준 연도"를 명시한다.
// (4) SAT/ACT 25~75th를 숫자 나열 대신 범위 막대(RangeBar)로, 요약 카드와 Student Profile의
//     중복 수치를 제거(요약은 헤드라인만, 근거·대상집단·세부값은 Student Profile에서).
// (5) 특정 수치·마감일·에세이 문항 옆에 신고 버튼을 둬 신고 폼에 항목명을 미리 채운다.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  listUniversities,
  getUniversityDetailForStudent,
  loadAdmissionMetrics,
  loadUniversityAffiliations,
  loadUniversityDemographics,
  loadUniversityEssayPrompts,
  loadUniversityFinancialAidPrograms,
  type UniversitySummary,
  type UniversityDetail,
  type AdmissionCycle,
  type AdmissionMetric,
  type AdmissionMetricCohort,
  type UniversityAffiliation,
  type UniversityDemographic,
  type UniversityFinancialAidProgram,
  type UniversityMajor,
  type UniversityUpdateEntry,
  type UniversityEssayPrompt,
  type UniversitySourceUrl,
} from "@/lib/universities/actions";
import { listMySubmittedSourceUrls, proposeUniversitySourceUrl, reportUniversityDataIssue } from "@/lib/universities/user-actions";
import { requestUniversityRefresh } from "@/lib/universities/refresh-actions";

// ---------------------------------------------------------------------------
// 공통 라벨·스타일
// ---------------------------------------------------------------------------

const SOURCE_TYPE_LABEL: Record<string, string> = {
  admissions_homepage: "입학처 홈페이지",
  common_data_set: "Common Data Set",
  catalog_programs: "카탈로그/전공",
  deadlines: "지원 마감일",
  essay_prompts: "에세이 문항",
  admitted_profile: "합격자 프로필",
  financial_aid: "재정지원",
  other: "기타",
};

const DATA_STATUS_LABEL: Record<UniversitySummary["dataCollectionStatus"], string> = {
  verified_pilot: "정보 확인됨",
  sources_pending_review: "정보 확인 중",
  unconfirmed: "정보 확인 필요",
};
const DATA_STATUS_CLASS: Record<UniversitySummary["dataCollectionStatus"], string> = {
  verified_pilot: "bg-green-bg text-green",
  sources_pending_review: "bg-yellow-bg text-yellow",
  unconfirmed: "bg-grey-100 text-grey-500",
};

const cardClass = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4";
const cardTitleClass = "text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2";
const SETTING_LABEL: Record<string, string> = { urban: "도시", suburban: "교외", rural: "시골", town: "소도시" };
const CALENDAR_LABEL: Record<string, string> = { semester: "학기제(Semester)", quarter: "쿼터제(Quarter)", trimester: "트라이메스터", "4-1-4": "4-1-4제", other: "기타" };

function StatusChip({ status }: { status: UniversitySummary["dataCollectionStatus"] }) {
  return (
    <span className={`shrink-0 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${DATA_STATUS_CLASS[status]}`}>
      {DATA_STATUS_LABEL[status]}
    </span>
  );
}

/** 특정 수치·항목 옆에 두는 작은 신고 버튼 — 누르면 상세 화면 하단 신고 폼이 그 항목명으로 미리 채워져 열린다. */
function FlagButton({ label, onFlag }: { label: string; onFlag: (label: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onFlag(label)}
      aria-label={`${label} 정보 오류 신고`}
      title="이 항목 신고"
      className="ml-1 align-middle text-[10px] text-grey-300 hover:text-red"
    >
      ⚑
    </button>
  );
}

// ---------------------------------------------------------------------------
// 목록 화면
// ---------------------------------------------------------------------------

type TypeFilter = "all" | "Public" | "Private";
type StatusFilter = "all" | UniversitySummary["dataCollectionStatus"];

export default function CollegeExploreSection({ canProposeSourceUrl = false }: { canProposeSourceUrl?: boolean }) {
  const [search, setSearch] = useState("");
  const [list, setList] = useState<UniversitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    startTransition(async () => {
      try {
        const rows = await listUniversities({ search: search.trim() || undefined });
        setList(rows);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "대학 목록을 불러오지 못했습니다.");
      }
    });
  }, [search]);

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const u of list ?? []) if (u.state) set.add(u.state);
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    return (list ?? []).filter((u) => {
      if (stateFilter !== "all" && u.state !== stateFilter) return false;
      if (typeFilter !== "all" && u.publicPrivate !== typeFilter) return false;
      if (statusFilter !== "all" && u.dataCollectionStatus !== statusFilter) return false;
      return true;
    });
  }, [list, stateFilter, typeFilter, statusFilter]);

  if (selectedId) {
    return <CollegeDetail universityId={selectedId} onBack={() => setSelectedId(null)} canProposeSourceUrl={canProposeSourceUrl} />;
  }

  return (
    <div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="대학 이름으로 검색 (예: Stanford)"
        className="w-full mb-2.5 px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[14px]"
        aria-label="대학 검색"
      />
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          aria-label="지역(주) 필터"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
        >
          <option value="all">전체 지역</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="공립/사립 필터"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
        >
          <option value="all">공립/사립 전체</option>
          <option value="Public">공립</option>
          <option value="Private">사립</option>
        </select>
        <select
          aria-label="정보 확인 상태 필터"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
        >
          <option value="all">확인 상태 전체</option>
          <option value="verified_pilot">정보 확인됨</option>
          <option value="sources_pending_review">정보 확인 중</option>
          <option value="unconfirmed">정보 확인 필요</option>
        </select>
      </div>
      {error && <div className="mb-3 text-[12px] text-red bg-red-bg rounded-lg px-3 py-2">{error}</div>}
      {list === null && !error && <p className="text-[12.5px] text-grey-500">불러오는 중…</p>}
      {list !== null && filtered.length === 0 && <p className="text-[12.5px] text-grey-500">일치하는 대학이 없습니다.</p>}
      <div className={pending ? "opacity-60" : ""}>
        {filtered.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSelectedId(u.id)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2 hover:bg-grey-100"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-[14px] text-ink">{u.name}</span>
              <StatusChip status={u.dataCollectionStatus} />
            </div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              {[u.city, u.state].filter(Boolean).join(", ") || u.country}
              {u.publicPrivate ? ` · ${u.publicPrivate === "Public" ? "공립" : u.publicPrivate === "Private" ? "사립" : u.publicPrivate}` : ""}
            </div>
            {u.rankFinal != null && (
              <div className="text-[10.5px] text-grey-300 mt-1">
                참고 순위 #{u.rankFinal}
                {u.rankConfidence ? ` · 신뢰도 ${u.rankConfidence}` : ""}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 연도 선택 공통 로직 — 상세 화면 전체가 이 하나의 selectedYear를 기준으로 삼는다.
// 선택 연도에 데이터가 없으면 가장 가까운(우선 더 최근) 다른 연도로 대체하고,
// 대체됐는지(effectiveYear !== selectedYear) 여부를 반환해 화면에서 "통계 기준 연도"로
// 명시할 수 있게 한다.
// ---------------------------------------------------------------------------

export function pickForYear<T>(items: T[], getYear: (t: T) => number, selectedYear: number): { year: number; items: T[] } | null {
  if (items.length === 0) return null;
  const exact = items.filter((i) => getYear(i) === selectedYear);
  if (exact.length > 0) return { year: selectedYear, items: exact };

  const years = Array.from(new Set(items.map(getYear))).sort((a, b) => b - a);
  const olderOrEqual = years.filter((y) => y <= selectedYear);
  const chosenYear = olderOrEqual.length > 0 ? olderOrEqual[0] : years[years.length - 1];
  return { year: chosenYear, items: items.filter((i) => getYear(i) === chosenYear) };
}

function YearFallbackNotice({ selectedYear, effectiveYear }: { selectedYear: number; effectiveYear: number }) {
  if (selectedYear === effectiveYear) return null;
  return (
    <p className="text-[11px] text-yellow bg-yellow-bg rounded-lg px-2.5 py-1.5 mb-3 inline-block">
      {selectedYear}년 자료가 아직 없어 <b>통계 기준 연도 {effectiveYear}</b>의 자료를 보여줍니다 — 현재 지원 요건이 아닐 수 있습니다.
    </p>
  );
}

// ---------------------------------------------------------------------------
// SAT/ACT 25–75th 범위 막대
// ---------------------------------------------------------------------------

function RangeBar({ label, lo, hi, scaleMin, scaleMax, suffix = "" }: { label: string; lo: number; hi: number; scaleMin: number; scaleMax: number; suffix?: string }) {
  const span = scaleMax - scaleMin;
  const left = Math.max(0, Math.min(100, ((lo - scaleMin) / span) * 100));
  const right = Math.max(0, Math.min(100, ((hi - scaleMin) / span) * 100));
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-bold text-grey-500">{label}</span>
        <span className="text-[13px] font-bold text-ink">
          {lo}–{hi}
          {suffix}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-grey-100" role="img" aria-label={`${label} 중간 50% 구간 ${lo}에서 ${hi}${suffix}`}>
        <div
          className="absolute h-2 rounded-full bg-blue"
          style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-grey-300 mt-0.5">
        <span>{scaleMin}</span>
        <span>{scaleMax}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 상세 화면
// ---------------------------------------------------------------------------

// College Explore UI·데이터 구조 확장 지시서(2026-09-23, 2차) — 탭 구성을
// Overview/Admissions/Cost & Aid/Majors/Sources & Updates 5개로 재편(기존
// Admissions/Student Profile/Essays 3개를 Admissions 하나로 합침 — 지시서:
// "Admissions: 지원 방식·요건·마감일, 합격률과 과거 지원 결과, SAT/ACT/GPA 등
// 실제 공개 통계, 에세이").
const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "admissions", label: "Admissions" },
  { id: "costs", label: "Cost & Aid" },
  { id: "majors", label: "Majors" },
  { id: "sources", label: "Sources & Updates" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

type DetailData = {
  university: UniversityDetail;
  cycles: AdmissionCycle[];
  updates: UniversityUpdateEntry[];
  majors: UniversityMajor[];
  sourceUrls: UniversitySourceUrl[];
};

function CollegeDetail({
  universityId,
  onBack,
  canProposeSourceUrl = false,
}: {
  universityId: string;
  onBack: () => void;
  canProposeSourceUrl?: boolean;
}) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [metrics, setMetrics] = useState<AdmissionMetric[] | null>(null);
  const [essays, setEssays] = useState<UniversityEssayPrompt[] | null>(null);
  const [affiliations, setAffiliations] = useState<UniversityAffiliation[] | null>(null);
  const [demographics, setDemographics] = useState<UniversityDemographic[] | null>(null);
  const [financialAidPrograms, setFinancialAidPrograms] = useState<UniversityFinancialAidProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFieldPath, setReportFieldPath] = useState("");

  useEffect(() => {
    let cancelled = false;
    getUniversityDetailForStudent(universityId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "대학 정보를 불러오지 못했습니다.");
      });
    loadAdmissionMetrics(universityId)
      .then((m) => {
        if (!cancelled) setMetrics(m);
      })
      .catch(() => {
        if (!cancelled) setMetrics([]);
      });
    // 연도 전환이 화면 안에서 즉시 이뤄지도록(재조회 없이) 전체 연도를 한 번에 받는다.
    loadUniversityEssayPrompts(universityId)
      .then((rows) => {
        if (!cancelled) setEssays(rows);
      })
      .catch(() => {
        if (!cancelled) setEssays([]);
      });
    loadUniversityAffiliations(universityId)
      .then((rows) => {
        if (!cancelled) setAffiliations(rows);
      })
      .catch(() => {
        if (!cancelled) setAffiliations([]);
      });
    loadUniversityDemographics(universityId)
      .then((rows) => {
        if (!cancelled) setDemographics(rows);
      })
      .catch(() => {
        if (!cancelled) setDemographics([]);
      });
    loadUniversityFinancialAidPrograms(universityId)
      .then((rows) => {
        if (!cancelled) setFinancialAidPrograms(rows);
      })
      .catch(() => {
        if (!cancelled) setFinancialAidPrograms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [universityId]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const c of detail?.cycles ?? []) set.add(c.cycleYear);
    for (const m of metrics ?? []) set.add(m.cycleYear);
    for (const e of essays ?? []) set.add(e.cycleYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [detail, metrics, essays]);

  function flagField(label: string) {
    setReportFieldPath(label);
    setReportOpen(true);
    setActiveSection("sources");
  }

  const year = selectedYear ?? availableYears[0] ?? new Date().getFullYear();
  const cyclePick = detail ? pickForYear(detail.cycles, (c) => c.cycleYear, year) : null;
  const metricsPick = metrics ? pickForYear(metrics, (m) => m.cycleYear, year) : null;
  const essaysPick = essays ? pickForYear(essays, (e) => e.cycleYear, year) : null;

  return (
    <div>
      <button type="button" onClick={onBack} className="text-[12px] font-bold text-grey-500 mb-3">
        ← 목록으로
      </button>
      {error && <div className="mb-3 text-[12px] text-red bg-red-bg rounded-lg px-3 py-2">{error}</div>}
      {!detail && !error && <p className="text-[12.5px] text-grey-500">불러오는 중…</p>}
      {detail && (
        <>
          <HeaderCard
            university={detail.university}
            availableYears={availableYears}
            selectedYear={year}
            onChangeYear={setSelectedYear}
          />

          <SummaryCard cycle={cyclePick?.items[0] ?? null} metrics={metricsPick?.items ?? []} onFlag={flagField} onJumpToProfile={() => setActiveSection("admissions")} />

          <div className="mb-4 flex gap-4 overflow-x-auto border-b border-grey-200 -mx-1 px-1" role="tablist" aria-label="대학 정보 섹션">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeSection === s.id}
                onClick={() => setActiveSection(s.id)}
                className={`whitespace-nowrap pb-2 text-[13px] font-bold border-b-2 -mb-px ${
                  activeSection === s.id ? "border-ink text-ink" : "border-transparent text-grey-400"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {activeSection === "overview" && (
            <OverviewSection
              university={detail.university}
              cycle={cyclePick?.items[0] ?? null}
              metrics={metricsPick?.items ?? []}
              affiliations={affiliations}
              demographics={demographics}
              onFlag={flagField}
            />
          )}
          {activeSection === "admissions" && (
            <>
              <AdmissionsSection cyclePick={cyclePick} selectedYear={year} onFlag={flagField} />
              <StudentProfileSection metricsPick={metricsPick} selectedYear={year} onFlag={flagField} />
              <EssaysSection essaysPick={essaysPick} selectedYear={year} onFlag={flagField} />
            </>
          )}
          {activeSection === "costs" && (
            <CostsAidSection cyclePick={cyclePick} selectedYear={year} financialAidPrograms={financialAidPrograms} onFlag={flagField} />
          )}
          {activeSection === "majors" && <MajorsSection majors={detail.majors} />}
          {activeSection === "sources" && (
            <SourcesSection
              sourceUrls={detail.sourceUrls}
              updates={detail.updates}
              universityId={universityId}
              canProposeSourceUrl={canProposeSourceUrl}
              reportOpen={reportOpen}
              reportFieldPath={reportFieldPath}
              onReportOpenChange={setReportOpen}
              onReportFieldPathChange={setReportFieldPath}
            />
          )}
        </>
      )}
    </div>
  );
}

function HeaderCard({
  university,
  availableYears,
  selectedYear,
  onChangeYear,
}: {
  university: UniversityDetail;
  availableYears: number[];
  selectedYear: number;
  onChangeYear: (y: number) => void;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[17px] font-bold text-ink mb-0.5">{university.name}</div>
          <div className="text-[12.5px] text-grey-500">
            {[university.city, university.state].filter(Boolean).join(", ") || university.country}
            {university.publicPrivate ? ` · ${university.publicPrivate === "Public" ? "공립" : university.publicPrivate === "Private" ? "사립" : university.publicPrivate}` : ""}
            {university.setting ? ` · ${SETTING_LABEL[university.setting] ?? university.setting}` : ""}
          </div>
        </div>
        {availableYears.length > 0 && (
          <select
            aria-label="지원 연도 선택"
            value={selectedYear}
            onChange={(e) => onChangeYear(Number(e.target.value))}
            className="text-[12.5px] font-bold border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 shrink-0"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y} 지원 사이클
              </option>
            ))}
          </select>
        )}
      </div>
      {university.overviewText && <p className="text-[13.5px] text-ink leading-[1.6] mt-3">{university.overviewText}</p>}
      {university.strengthsPrograms.length > 0 && (
        <div className="text-[12.5px] text-ink mt-2">강점 분야: {university.strengthsPrograms.join(", ")}</div>
      )}
      <div className="text-[12px] text-grey-500 mt-1">
        {[
          university.calendarSystem ? `학사력 ${CALENDAR_LABEL[university.calendarSystem] ?? university.calendarSystem}` : null,
          university.ncaaDivision ? `NCAA ${university.ncaaDivision}` : null,
          university.religiousAffiliation ? `종교 ${university.religiousAffiliation}` : null,
          university.honorsCollege ? "Honors College 있음" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div className="flex gap-3 mt-2.5 text-[12px]">
        {university.admissionsHomepageUrl && (
          <a href={university.admissionsHomepageUrl} target="_blank" rel="noreferrer" className="text-ink underline">
            공식 입학처 홈페이지
          </a>
        )}
      </div>
    </div>
  );
}

const ADMISSION_METRIC_VERIFICATION_LABEL: Record<string, string> = {
  official: "공식 확인",
  secondary: "참고 자료",
  unverified: "미검증",
};

const ADMISSION_METRIC_COHORT_LABEL: Record<AdmissionMetricCohort, string> = {
  applicant: "지원자 기준",
  admitted: "합격자 기준",
  enrolled: "등록자 기준",
};

// CDS 정의상 SAT/ACT/GPA/석차 지표는 실제로는 "등록자(enrolled)" 코호트 값이다(과거 일부
// 학교 데이터가 admitted로 잘못 표시돼 들어와 있었음). admitted로 찾다가 없으면 enrolled도
// 허용해 정확히 재분류된 학교의 값이 빈칸으로 사라지지 않도록 한다.
const ADMISSION_METRIC_COHORT_FALLBACK: Record<string, AdmissionMetricCohort> = {
  sat_total_25: "enrolled", sat_total_75: "enrolled",
  sat_ebrw_25: "enrolled", sat_ebrw_75: "enrolled",
  sat_math_25: "enrolled", sat_math_75: "enrolled",
  act_composite_25: "enrolled", act_composite_75: "enrolled",
  gpa_average: "enrolled", top10pct_pct: "enrolled", ap_ib_indicator: "enrolled",
};

function findMetric(metrics: AdmissionMetric[], key: string, cohort: AdmissionMetricCohort) {
  const fallback = ADMISSION_METRIC_COHORT_FALLBACK[key];
  return metrics.find((m) => m.metricKey === key && m.cohort === cohort) ?? (fallback ? metrics.find((m) => m.metricKey === key && m.cohort === fallback) : undefined);
}

/** 상세 화면 상단 — "지원 준비 요약". 가장 중요한 결정 정보만 담고, SAT·GPA·합격률
 * 세부값은 중복시키지 않고 Student Profile 링크로 넘긴다. */
function SummaryCard({
  cycle,
  metrics,
  onFlag,
  onJumpToProfile,
}: {
  cycle: AdmissionCycle | null;
  metrics: AdmissionMetric[];
  onFlag: (label: string) => void;
  onJumpToProfile: () => void;
}) {
  const satTotal25 = findMetric(metrics, "sat_total_25", "admitted");
  const satTotal75 = findMetric(metrics, "sat_total_75", "admitted");
  const admitRate = findMetric(metrics, "admit_rate", "admitted");

  const deadlineParts = cycle
    ? [
        cycle.edDeadline ? `ED ${cycle.edDeadline}` : null,
        cycle.ed2Deadline ? `ED2 ${cycle.ed2Deadline}` : null,
        cycle.eaDeadline ? `${cycle.eaRestrictive ? "REA" : "EA"} ${cycle.eaDeadline}` : null,
        cycle.rdDeadline ? `RD ${cycle.rdDeadline}` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>지원 준비 요약</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">
            시험 정책 <FlagButton label="시험 정책(SAT/ACT optional 여부)" onFlag={onFlag} />
          </div>
          <div className="font-bold text-ink text-[13px]">{cycle?.testPolicy ?? "확인 필요"}</div>
        </div>
        <div>
          <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">
            지원 마감(ED/EA/RD) <FlagButton label="지원 마감일" onFlag={onFlag} />
          </div>
          <div className="font-bold text-ink text-[13px]">{deadlineParts.length ? deadlineParts.join(" / ") : "확인 필요"}</div>
        </div>
        <div>
          <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">
            지원비 <FlagButton label="지원비" onFlag={onFlag} />
          </div>
          <div className="font-bold text-ink text-[13px]">{cycle?.applicationFee != null ? `$${cycle.applicationFee}` : "확인 필요"}</div>
        </div>
        <div>
          <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">에세이·추천서</div>
          <div className="font-bold text-ink text-[13px]">
            {cycle?.essayCount != null || cycle?.recommendationLetterCount != null
              ? `에세이 ${cycle?.essayCount ?? "?"}개 · 추천서 ${cycle?.recommendationLetterCount ?? "?"}통`
              : "확인 필요"}
          </div>
        </div>
      </div>

      {(satTotal25 || admitRate) && (
        <div className="mt-3 pt-3 border-t border-grey-100 flex flex-wrap items-center gap-4">
          {satTotal25 && satTotal75 && (
            <div>
              <div className="text-grey-300 text-[10.5px] font-bold">SAT 중간 50%(합산)</div>
              <div className="font-bold text-ink text-[14px]">
                {satTotal25.value}–{satTotal75.value}
              </div>
            </div>
          )}
          {admitRate && (
            <div>
              <div className="text-grey-300 text-[10.5px] font-bold">합격률</div>
              <div className="font-bold text-ink text-[14px]">{admitRate.value}%</div>
            </div>
          )}
          <button type="button" onClick={onJumpToProfile} className="text-[11.5px] font-bold text-blue underline">
            근거·세부값 Admissions에서 보기 →
          </button>
        </div>
      )}
    </div>
  );
}

const DEMOGRAPHIC_CATEGORY_LABEL: Record<string, string> = {
  gender_male: "남", gender_female: "여", gender_other: "기타",
  race_white: "White", race_black: "Black", race_hispanic: "Hispanic",
  race_asian_pacific_islander: "Asian/Pacific Islander", race_native_american: "Native American",
  race_two_or_more: "둘 이상", race_unknown: "미상", race_international: "국제학생",
};
/** Overview 섹션 — 학교 기본정보·재학생 현황·학업 환경. 재학생 구성(demographics)은
 * 입시 사이클과 다른 개념이라 전역 연도 선택과 무관하게 그 항목 자체의 최신 기준연도를
 * 쓰고, 화면에 그 연도를 명시한다(지시서: "각 묶음에 실제 기준 연도와 대상 집단을 표시"). */
function OverviewSection({
  university,
  cycle,
  metrics,
  affiliations,
  demographics,
  onFlag,
}: {
  university: UniversityDetail;
  cycle: AdmissionCycle | null;
  metrics: AdmissionMetric[];
  affiliations: UniversityAffiliation[] | null;
  demographics: UniversityDemographic[] | null;
  onFlag: (label: string) => void;
}) {
  const totalEnrollment = findMetric(metrics, "total_undergrad_enrollment", "enrolled");

  const latestDemographicYear = demographics && demographics.length > 0 ? Math.max(...demographics.map((d) => d.cycleYear)) : null;
  const latestDemographics = demographics?.filter((d) => d.cycleYear === latestDemographicYear) ?? [];
  const genderRows = latestDemographics.filter((d) => d.category.startsWith("gender_"));
  const raceRows = latestDemographics.filter((d) => d.category.startsWith("race_"));
  const raceScope = raceRows[0]?.populationScope;

  const sports = (affiliations ?? []).filter((a) => a.kind === "ncaa_sport");
  const otherAffiliations = (affiliations ?? []).filter((a) => a.kind !== "ncaa_sport");

  return (
    <>
      <div className={cardClass}>
        <div className={cardTitleClass}>학교 기본정보</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stat("공식 주소", university.officialAddress, onFlag)}
          {stat("공식 대표 전화", university.officialPhone, onFlag)}
        </div>
        {(sports.length > 0 || otherAffiliations.length > 0) && (
          <div className="mt-3 pt-3 border-t border-grey-100">
            <div className="text-grey-300 text-[10.5px] font-bold mb-1.5">소속·인증(공식 확인분만 표시)</div>
            <div className="flex flex-wrap gap-1.5">
              {otherAffiliations.map((a) => (
                <span key={a.id} className="text-[11.5px] px-2.5 py-1 bg-grey-100 rounded-full text-ink">{a.label}</span>
              ))}
              {sports.map((a) => (
                <span key={a.id} className="text-[11.5px] px-2.5 py-1 bg-grey-100 rounded-full text-ink">{a.label}{a.division ? ` (${a.division})` : ""}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>재학생 현황</div>
        <div className="grid grid-cols-2 gap-3">
          {stat("학부 재학생 총수", totalEnrollment?.value, onFlag)}
          {stat("학생 대 교수 비율", cycle?.studentFacultyRatio, onFlag)}
          {stat("1년 재학유지율", cycle?.retentionRate != null ? `${cycle.retentionRate}%` : null, onFlag)}
          {stat("4년 졸업률", cycle?.gradRate4yr != null ? `${cycle.gradRate4yr}%` : null, onFlag)}
          {stat("6년 졸업률", cycle?.gradRate6yr != null ? `${cycle.gradRate6yr}%` : null, onFlag)}
          {stat("국제학생 비율", cycle?.internationalPct != null ? `${cycle.internationalPct}%` : null, onFlag)}
        </div>

        {genderRows.length > 0 && (
          <div className="mt-3 pt-3 border-t border-grey-100">
            <div className="text-grey-300 text-[10.5px] font-bold mb-1">
              성별 구성 <span className="font-normal text-grey-400">({latestDemographicYear}학년도 기준)</span>
            </div>
            <div className="flex gap-4 text-[13px] text-ink font-bold">
              {genderRows.map((d) => (
                <span key={d.id}>{DEMOGRAPHIC_CATEGORY_LABEL[d.category]}: {d.valueStatus === "reported" ? `${d.pct}%` : "미공개"}</span>
              ))}
            </div>
          </div>
        )}

        {raceRows.length > 0 && (
          <div className="mt-3 pt-3 border-t border-grey-100">
            <div className="text-grey-300 text-[10.5px] font-bold mb-1">
              인종·민족 구성{" "}
              <span className="font-normal text-grey-400">
                ({latestDemographicYear}학년도 기준 · {raceScope === "us_students_only" ? "미국 내 학생 대상" : "전체 학생 대상"})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[12px] text-ink">
              {raceRows.map((d) => (
                <span key={d.id}>{DEMOGRAPHIC_CATEGORY_LABEL[d.category]}: {d.valueStatus === "reported" ? `${d.pct}%` : "미공개"}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Admissions 섹션 — 요약 카드와 겹치지 않는 나머지 입시 제도 정보. */
function AdmissionsSection({
  cyclePick,
  selectedYear,
  onFlag,
}: {
  cyclePick: { year: number; items: AdmissionCycle[] } | null;
  selectedYear: number;
  onFlag: (label: string) => void;
}) {
  const cycle = cyclePick?.items[0];
  if (!cycle) {
    return <div className={cardClass}><p className="text-[12.5px] text-grey-500">이 연도의 입시 제도 정보가 아직 없습니다.</p></div>;
  }
  return (
    <div className={cardClass}>
      {cyclePick && <YearFallbackNotice selectedYear={selectedYear} effectiveYear={cyclePick.year} />}
      <div className="grid grid-cols-2 gap-4">
        {stat("지원접수 시작일", cycle.applicationOpensDate, onFlag)}
        {stat("인터뷰", cycle.interviewRequired === true ? "필요/권장" : cycle.interviewRequired === false ? "없음" : null, onFlag)}
        {stat("포트폴리오", cycle.portfolioRequired ? "필요" : null, onFlag)}
        {stat("추천 이수 과정", cycle.recommendedCoursework, onFlag)}
        {stat("AP/IB 정책", cycle.apIbPolicy, onFlag)}
        {stat("국제학생 TOEFL 최소 점수", cycle.toeflMin, onFlag)}
        {stat("국제학생 IELTS 최소 점수", cycle.ieltsMin, onFlag)}
      </div>
    </div>
  );
}

/** Student Profile 섹션 — SAT/ACT 범위 막대 + GPA/지원결과 그룹 + 접을 수 있는 CDS 세부 그룹. */
function StudentProfileSection({
  metricsPick,
  selectedYear,
  onFlag,
}: {
  metricsPick: { year: number; items: AdmissionMetric[] } | null;
  selectedYear: number;
  onFlag: (label: string) => void;
}) {
  const metrics = metricsPick?.items ?? [];
  if (metrics.length === 0) {
    return <div className={cardClass}><p className="text-[12.5px] text-grey-500">이 연도의 학업 지표가 아직 없습니다.</p></div>;
  }

  const satEbrw25 = findMetric(metrics, "sat_ebrw_25", "admitted");
  const satEbrw75 = findMetric(metrics, "sat_ebrw_75", "admitted");
  const satMath25 = findMetric(metrics, "sat_math_25", "admitted");
  const satMath75 = findMetric(metrics, "sat_math_75", "admitted");
  const satTotal25 = findMetric(metrics, "sat_total_25", "admitted");
  const satTotal75 = findMetric(metrics, "sat_total_75", "admitted");
  const actComposite25 = findMetric(metrics, "act_composite_25", "admitted");
  const actComposite75 = findMetric(metrics, "act_composite_75", "admitted");
  const gpaAverage = findMetric(metrics, "gpa_average", "admitted");
  const applicants = findMetric(metrics, "applicants_count", "applicant");
  const admitted = findMetric(metrics, "admitted_count", "admitted");
  const enrolled = findMetric(metrics, "enrolled_count", "enrolled");
  const admitRate = findMetric(metrics, "admit_rate", "admitted");
  const yieldRate = findMetric(metrics, "yield_rate", "enrolled");

  const anySatRange = satTotal25 && satTotal75;
  const anyActRange = actComposite25 && actComposite75;
  const anyUnconfirmed = metrics.some((m) => m.verificationStatus !== "official");

  return (
    <div className={cardClass}>
      {metricsPick && <YearFallbackNotice selectedYear={selectedYear} effectiveYear={metricsPick.year} />}

      {(anySatRange || anyActRange) && (
        <div className="mb-4">
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">시험 점수(합격자, 중간 50%)</div>
          {anySatRange && (
            <RangeBar label={`SAT 총점 ${metricSentenceSuffix(satTotal25)}`} lo={Number(satTotal25!.value)} hi={Number(satTotal75!.value)} scaleMin={400} scaleMax={1600} />
          )}
          {satEbrw25 && satEbrw75 && <RangeBar label="SAT EBRW" lo={Number(satEbrw25.value)} hi={Number(satEbrw75.value)} scaleMin={200} scaleMax={800} />}
          {satMath25 && satMath75 && <RangeBar label="SAT Math" lo={Number(satMath25.value)} hi={Number(satMath75.value)} scaleMin={200} scaleMax={800} />}
          {anyActRange && <RangeBar label={`ACT Composite ${metricSentenceSuffix(actComposite25)}`} lo={Number(actComposite25!.value)} hi={Number(actComposite75!.value)} scaleMin={1} scaleMax={36} />}
          <FlagButton label="SAT/ACT 점수 범위" onFlag={onFlag} />
        </div>
      )}

      <div className="mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">GPA</div>
        <div className="text-[13px] text-ink">
          {gpaAverage ? (
            <>
              평균 {gpaAverage.value} <span className="text-grey-500 text-[11.5px]">({ADMISSION_METRIC_COHORT_LABEL[gpaAverage.cohort]}{gpaAverage.submittersOnly ? " · 점수 제출자만" : ""})</span>
            </>
          ) : (
            <span className="text-grey-400">미공개</span>
          )}
          <FlagButton label="GPA" onFlag={onFlag} />
        </div>
      </div>

      <div className="mb-1">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">지원 결과</div>
        <div className="grid grid-cols-2 gap-3">
          {stat("지원자 수", applicants?.value, onFlag)}
          {stat("합격자 수", admitted?.value, onFlag)}
          {stat("등록자 수", enrolled?.value, onFlag)}
          {stat("합격률", admitRate?.value != null ? `${admitRate.value}%` : null, onFlag)}
          {stat("등록률(수율)", yieldRate?.value != null ? `${yieldRate.value}%` : null, onFlag)}
        </div>
      </div>

      {anyUnconfirmed && (
        <p className="text-[11px] text-grey-400 mt-3">일부 수치는 공식 확인 전(참고/미검증) 자료입니다 — 각 항목 아래 표시를 확인하세요.</p>
      )}

      <CdsDetailGroups metrics={metrics} />
    </div>
  );
}

function metricSentenceSuffix(m: AdmissionMetric | undefined) {
  if (!m) return "";
  return `(${ADMISSION_METRIC_COHORT_LABEL[m.cohort]}${m.submittersOnly ? " · 제출자만" : ""})`;
}

const CDS_DETAIL_GROUPS: { title: string; rows: { metricKey: string; cohort: AdmissionMetricCohort; label: string }[] }[] = [
  {
    title: "SAT 세부",
    rows: [
      { metricKey: "sat_total_50", cohort: "enrolled", label: "SAT 총점 50th" },
      { metricKey: "sat_ebrw_50", cohort: "enrolled", label: "SAT EBRW 50th" },
      { metricKey: "sat_math_50", cohort: "enrolled", label: "SAT Math 50th" },
      { metricKey: "sat_submitted_pct", cohort: "enrolled", label: "SAT 제출률" },
    ],
  },
  {
    title: "ACT 세부",
    rows: [
      { metricKey: "act_composite_50", cohort: "enrolled", label: "ACT Composite 50th" },
      { metricKey: "act_math_25", cohort: "enrolled", label: "ACT Math 25th" },
      { metricKey: "act_math_50", cohort: "enrolled", label: "ACT Math 50th" },
      { metricKey: "act_math_75", cohort: "enrolled", label: "ACT Math 75th" },
      { metricKey: "act_english_25", cohort: "enrolled", label: "ACT English 25th" },
      { metricKey: "act_english_50", cohort: "enrolled", label: "ACT English 50th" },
      { metricKey: "act_english_75", cohort: "enrolled", label: "ACT English 75th" },
      { metricKey: "act_reading_25", cohort: "enrolled", label: "ACT Reading 25th" },
      { metricKey: "act_reading_50", cohort: "enrolled", label: "ACT Reading 50th" },
      { metricKey: "act_reading_75", cohort: "enrolled", label: "ACT Reading 75th" },
      { metricKey: "act_science_25", cohort: "enrolled", label: "ACT Science 25th" },
      { metricKey: "act_science_50", cohort: "enrolled", label: "ACT Science 50th" },
      { metricKey: "act_science_75", cohort: "enrolled", label: "ACT Science 75th" },
      { metricKey: "act_writing_25", cohort: "enrolled", label: "ACT Writing 25th" },
      { metricKey: "act_writing_50", cohort: "enrolled", label: "ACT Writing 50th" },
      { metricKey: "act_writing_75", cohort: "enrolled", label: "ACT Writing 75th" },
      { metricKey: "act_submitted_pct", cohort: "enrolled", label: "ACT 제출률" },
    ],
  },
  {
    title: "GPA 세부",
    rows: [
      { metricKey: "gpa_4_0_pct_all", cohort: "enrolled", label: "GPA 4.0 비율(전체)" },
      { metricKey: "gpa_4_0_pct_submitters", cohort: "enrolled", label: "GPA 4.0 비율(점수 제출자)" },
      { metricKey: "gpa_4_0_pct_nonsubmitters", cohort: "enrolled", label: "GPA 4.0 비율(점수 미제출자)" },
      { metricKey: "top10pct_pct", cohort: "enrolled", label: "고교 상위 10% 비율" },
    ],
  },
  {
    title: "지원 결과 세부",
    rows: [
      { metricKey: "waitlist_offered", cohort: "admitted", label: "대기자명단 제안 인원" },
      { metricKey: "waitlist_accepted", cohort: "admitted", label: "대기자명단 수락 인원" },
      { metricKey: "waitlist_admitted", cohort: "admitted", label: "대기자명단 중 최종 합격" },
    ],
  },
  {
    title: "재학 지표",
    rows: [
      { metricKey: "retention_rate_year1", cohort: "enrolled", label: "1년 재학유지율" },
      { metricKey: "grad_rate_6yr", cohort: "enrolled", label: "6년 졸업률" },
      { metricKey: "tuition_total", cohort: "enrolled", label: "연간 등록금+기숙사+식비" },
    ],
  },
];

function CdsDetailGroups({ metrics }: { metrics: AdmissionMetric[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const groupsWithData = CDS_DETAIL_GROUPS.map((g) => ({
    ...g,
    rows: g.rows.map((r) => ({ ...r, found: findMetric(metrics, r.metricKey, r.cohort) })).filter((r) => r.found),
  })).filter((g) => g.rows.length > 0);

  if (groupsWithData.length === 0) return null;

  return (
    <div className="mt-4 border-t border-grey-100 pt-3">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">Common Data Set 상세 지표</div>
      <div className="flex flex-wrap gap-2">
        {groupsWithData.map((g) => (
          <button
            key={g.title}
            type="button"
            onClick={() => setExpanded((v) => (v === g.title ? null : g.title))}
            className={`text-[11.5px] font-bold px-2.5 py-1 rounded-full border-[1.5px] ${
              expanded === g.title ? "border-ink bg-ink text-white" : "border-grey-200 text-ink"
            }`}
          >
            {g.title} ({g.rows.length})
          </button>
        ))}
      </div>
      {groupsWithData
        .filter((g) => g.title === expanded)
        .map((g) => (
          <div key={g.title} className="grid grid-cols-2 gap-3 mt-3">
            {g.rows.map((r) => {
              const m = r.found!;
              const value = m.value != null ? `${m.value}${m.unit ? ` ${m.unit}` : ""}` : (m.valueText ?? "확인 필요");
              return (
                <div key={r.metricKey}>
                  <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">{r.label}</div>
                  <div className="font-bold text-ink text-[12.5px]">
                    {value}
                    {m.submittersOnly ? " (제출자만)" : ""}
                  </div>
                  <div className="text-[10px] text-grey-400 mt-0.5">
                    {ADMISSION_METRIC_COHORT_LABEL[m.cohort]} · {ADMISSION_METRIC_VERIFICATION_LABEL[m.verificationStatus]}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Costs & Aid
// ---------------------------------------------------------------------------

const FINANCIAL_AID_PROGRAM_TYPE_LABEL: Record<string, string> = {
  need_based_grant: "재정필요 기반 보조금(Grant)",
  merit_scholarship: "성적 기반 장학금",
  federal_loan: "연방 학자금 대출",
  work_study: "근로장학(Work-Study)",
};
const ELIGIBILITY_SCOPE_LABEL: Record<string, string> = {
  us_citizen_permanent_resident: "미국 시민·영주권자만 대상",
  all_students: "국제학생 포함 전원 대상",
  other: "대상 조건 별도 확인 필요",
};

function CostsAidSection({
  cyclePick,
  selectedYear,
  financialAidPrograms,
  onFlag,
}: {
  cyclePick: { year: number; items: AdmissionCycle[] } | null;
  selectedYear: number;
  financialAidPrograms: UniversityFinancialAidProgram[] | null;
  onFlag: (label: string) => void;
}) {
  const cycle = cyclePick?.items[0];
  const hasCostData = cycle && (cycle.tuitionInState != null || cycle.tuitionOutState != null || cycle.avgNetPrice != null);

  return (
    <>
      <div className={cardClass}>
        <div className={cardTitleClass}>학비·총비용</div>
        {!hasCostData ? (
          <p className="text-[12.5px] text-grey-500">이 연도의 비용 정보가 아직 없습니다 — 공식 정보 확인 중입니다.</p>
        ) : (
          <>
            {cyclePick && <YearFallbackNotice selectedYear={selectedYear} effectiveYear={cyclePick.year} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border-[1.5px] border-grey-100 rounded-lg px-3 py-2.5">
                <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">
                  등록금(주내·재학주 거주 시민 기준) <FlagButton label="주내 등록금" onFlag={onFlag} />
                </div>
                <div className="font-bold text-ink text-[14px]">{cycle!.tuitionInState != null ? `$${cycle!.tuitionInState.toLocaleString()}` : "확인 필요"}</div>
              </div>
              <div className="border-[1.5px] border-grey-100 rounded-lg px-3 py-2.5">
                <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">
                  등록금(주외/유학생 기준) <FlagButton label="주외·유학생 등록금" onFlag={onFlag} />
                </div>
                <div className="font-bold text-ink text-[14px]">{cycle!.tuitionOutState != null ? `$${cycle!.tuitionOutState.toLocaleString()}` : "확인 필요"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {stat("기숙사·식비", cycle!.roomBoardCost != null ? `$${cycle!.roomBoardCost.toLocaleString()}` : null, onFlag)}
              {stat("평균 순부담액(net price, 전체 학생 평균)", cycle!.avgNetPrice != null ? `$${cycle!.avgNetPrice.toLocaleString()}` : null, onFlag)}
              {stat("재정지원 수혜율(전체)", cycle!.pctReceivingAid != null ? `${cycle!.pctReceivingAid}%` : null, onFlag)}
              {stat("평균 지원액", cycle!.avgAidAward != null ? `$${cycle!.avgAidAward.toLocaleString()}` : null, onFlag)}
              {stat("Pell Grant 수혜율", cycle!.pellGrantPct != null ? `${cycle!.pellGrantPct}%` : null, onFlag)}
            </div>
            <p className="text-[11px] text-grey-400 mt-3">
              등록금과 총비용(기숙사·식비 포함)은 다른 금액입니다. 평균 순부담액(net price)은 재정지원을 받은 재학생
              {cyclePick ? ` ${cyclePick.year}년` : ""} 평균이며, 개별 가정의 예상 비용으로 쓸 수 없습니다.
            </p>
          </>
        )}
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>보조금·장학금·대출·근로장학</div>
        {financialAidPrograms === null ? (
          <p className="text-[12.5px] text-grey-500">불러오는 중…</p>
        ) : financialAidPrograms.length === 0 ? (
          <p className="text-[12.5px] text-grey-500">공식 정보 확인 중입니다 — 아직 등록된 프로그램이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {financialAidPrograms.map((f) => (
              <div key={f.id} className="border-[1.5px] border-grey-100 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold text-ink">
                    {f.name} <span className="text-[11px] font-semibold text-grey-500">({FINANCIAL_AID_PROGRAM_TYPE_LABEL[f.programType] ?? f.programType})</span>
                  </div>
                  <FlagButton label={f.name} onFlag={onFlag} />
                </div>
                <div className={`mt-1 text-[11.5px] font-bold ${f.eligibilityScope === "us_citizen_permanent_resident" ? "text-red" : "text-grey-500"}`}>
                  {ELIGIBILITY_SCOPE_LABEL[f.eligibilityScope] ?? f.eligibilityScope}
                </div>
                {f.valueStatus !== "reported" ? (
                  <div className="text-[12px] text-grey-400 mt-1">{f.valueStatus === "not_applicable" ? "이 학교엔 해당 없음" : "학교가 세부 수치를 공개하지 않음"}</div>
                ) : (
                  <div className="text-[12px] text-ink mt-1">
                    {f.recipientPct != null && `수혜율 ${f.recipientPct}%`}
                    {f.recipientPct != null && f.avgAwardAmount != null && " · "}
                    {f.avgAwardAmount != null && `평균 ${f.programType === "federal_loan" ? "대출" : "지급"}액 $${f.avgAwardAmount.toLocaleString()}`}
                  </div>
                )}
                {f.renewalCondition && <div className="text-[11px] text-grey-500 mt-0.5">갱신 조건: {f.renewalCondition}</div>}
                {f.description && <div className="text-[11.5px] text-grey-600 mt-1">{f.description}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Majors — 검색·분류·접기
// ---------------------------------------------------------------------------

function MajorsSection({ majors }: { majors: UniversityMajor[] }) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // 지시서: "전공·학위·세부 트랙을 같은 항목으로 혼동하지 않도록" — 전공 수 집계는
  // 트랙(is_track=true)을 제외한다.
  const independentCount = majors.filter((m) => !m.isTrack).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return majors;
    return majors.filter((m) => m.name.toLowerCase().includes(q));
  }, [majors, search]);

  const byCategory = useMemo(() => {
    const map = new Map<string, UniversityMajor[]>();
    for (const m of filtered) {
      const key = m.category ?? "기타";
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (majors.length === 0) {
    return <div className={cardClass}><p className="text-[12.5px] text-grey-500">전공 목록이 아직 없습니다.</p></div>;
  }

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>전공 ({independentCount}개)</div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="전공 이름으로 검색"
        aria-label="전공 검색"
        className="w-full mb-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
      />
      {byCategory.length === 0 && <p className="text-[12.5px] text-grey-500">일치하는 전공이 없습니다.</p>}
      {byCategory.map(([category, items]) => {
        const isSingleCategory = byCategory.length === 1;
        const isOpen = isSingleCategory || expandedCategory === category || search.trim().length > 0;
        return (
          <div key={category} className="mb-2">
            {!isSingleCategory && (
              <button
                type="button"
                onClick={() => setExpandedCategory((v) => (v === category ? null : category))}
                className="text-[12.5px] font-bold text-ink mb-1.5"
              >
                {isOpen ? "▾" : "▸"} {category} ({items.length})
              </button>
            )}
            {isOpen && (
              <div className="flex flex-wrap gap-1.5">
                {items.map((m) => (
                  <span key={m.id} className={`text-[11.5px] px-2.5 py-1 rounded-full text-ink ${m.isTrack ? "bg-grey-100/60 border border-dashed border-grey-200" : "bg-grey-100"}`}>
                    {m.isTrack ? "↳ " : ""}
                    {m.name}
                    {m.degreeLevel ? ` (${m.degreeLevel})` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Essays
// ---------------------------------------------------------------------------

const ESSAY_TYPE_LABEL: Record<string, string> = {
  common_app: "공통 지원서(Common App 등)",
  school_specific: "대학 자체 추가 에세이",
  short_answer: "짧은 답변 / 활동 설명",
  program_conditional: "단과대·전공별 조건부 문항",
};

const APPLICATION_PATH_LABEL: Record<string, string> = {
  ED: "조기전형(ED)",
  ED2: "조기전형2(ED2)",
  EA: "얼리액션(EA)",
  RD: "정시(RD)",
  transfer: "편입",
  international: "국제학생",
};

function EssaysSection({
  essaysPick,
  selectedYear,
  onFlag,
}: {
  essaysPick: { year: number; items: UniversityEssayPrompt[] } | null;
  selectedYear: number;
  onFlag: (label: string) => void;
}) {
  const [majorFilter, setMajorFilter] = useState<string>("all");
  const essays = useMemo(() => essaysPick?.items ?? [], [essaysPick]);

  const allMajors = useMemo(() => {
    const set = new Set<string>();
    for (const e of essays) for (const m of e.appliesToMajors ?? []) set.add(m);
    return Array.from(set).sort();
  }, [essays]);

  const shown = majorFilter === "all" ? essays : essays.filter((e) => !e.appliesToMajors || e.appliesToMajors.length === 0 || e.appliesToMajors.includes(majorFilter));
  const hiddenByFilter = essays.length - shown.length;

  if (essays.length === 0) {
    return <div className={cardClass}><p className="text-[12.5px] text-grey-500">이 연도의 에세이 문항 정보가 아직 없습니다.</p></div>;
  }

  const byType: Record<string, UniversityEssayPrompt[]> = {};
  for (const e of shown) (byType[e.promptType] ??= []).push(e);

  const requiredCount = shown.filter((e) => e.isRequired && e.selectionGroupId == null).length;
  const groups = new Map<string, UniversityEssayPrompt[]>();
  for (const e of shown) {
    if (e.selectionGroupId) {
      const arr = groups.get(e.selectionGroupId) ?? [];
      arr.push(e);
      groups.set(e.selectionGroupId, arr);
    }
  }

  function statusBadge(e: UniversityEssayPrompt) {
    if (e.promptStatus === "confirmed_current_year") {
      return <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] bg-green-bg text-green">이번 연도 확인완료</span>;
    }
    if (e.promptStatus === "prior_year_reference") {
      return <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] bg-grey-200 text-grey-500">지난 연도 참고용</span>;
    }
    return <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] bg-yellow-bg text-yellow">확인 중</span>;
  }

  const isPriorYearOverall = essaysPick && essaysPick.year !== selectedYear;

  return (
    <div className={cardClass}>
      {essaysPick && <YearFallbackNotice selectedYear={selectedYear} effectiveYear={essaysPick.year} />}
      {isPriorYearOverall && (
        <div className="mb-3 text-[11.5px] font-bold text-grey-500 bg-grey-100 rounded-lg px-3 py-2">
          지난 {essaysPick!.year}년 문항입니다 — 올해 문항이 아직 확인되지 않았습니다. 참고용으로만 보세요.
        </div>
      )}

      {allMajors.length > 0 && (
        <div className="mb-3">
          <label className="text-[11px] font-bold text-grey-500 mr-2">지원 전공으로 조건부 문항 필터링</label>
          <select
            value={majorFilter}
            onChange={(e) => setMajorFilter(e.target.value)}
            className="text-[11.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
          >
            <option value="all">전체 보기</option>
            {allMajors.map((m) => (
              <option key={m} value={m}>
                {m} 지원자
              </option>
            ))}
          </select>
          {hiddenByFilter > 0 && <span className="text-[11px] text-grey-400 ml-2">해당 없는 조건부 문항 {hiddenByFilter}개 숨김</span>}
        </div>
      )}

      {(requiredCount > 0 || groups.size > 0) && (
        <div className="mb-3 text-[13px] text-ink bg-grey-100 rounded-lg px-3 py-2.5">
          <b>이번 지원에 써야 할 것</b>: 필수 문항 {requiredCount}개
          {Array.from(groups.entries()).map(([gid, rows]) => (
            <span key={gid}>
              {", "}
              {rows[0]?.groupSize ?? rows.length}개 중 {rows[0]?.selectCount ?? "?"}개 선택
            </span>
          ))}
          <div className="text-[11px] text-grey-500 mt-1">(선택 그룹은 전체 필수 개수에 별도로 더하지 않습니다 — 그룹당 한 번만 계산)</div>
        </div>
      )}

      {Object.entries(byType).map(([type, rows]) => (
        <div key={type} className="mb-4">
          <div className="text-[11px] font-bold text-grey-400 uppercase tracking-wide mb-1.5">{ESSAY_TYPE_LABEL[type] ?? type}</div>
          {rows.map((e) => (
            <div key={e.id} className="mb-2.5 border-[1.5px] border-grey-100 rounded-lg px-3 py-2.5">
              <div className="text-[13.5px] text-ink leading-[1.6]">
                {e.title && <span className="font-bold">{e.title}: </span>}
                {e.promptText ?? e.topicSummary ?? "(주제 미확보)"}
                {statusBadge(e)}
                <FlagButton label={e.title ?? `에세이 문항(${ESSAY_TYPE_LABEL[type] ?? type})`} onFlag={onFlag} />
              </div>
              <div className="text-[11.5px] text-grey-500 mt-1.5">
                {e.selectionGroupId
                  ? `${e.groupSize ?? "?"}개 중 ${e.selectCount ?? "?"}개 선택`
                  : e.isRequired
                    ? "필수"
                    : "선택"}
                {e.wordLimitMax ? ` · ${e.wordLimitMin ? `${e.wordLimitMin}~` : ""}${e.wordLimitMax}단어 이내` : ""}
                {e.charLimit ? ` · ${e.charLimit}자 이내` : ""}
                {e.appliesToSchool ? ` · 적용: ${e.appliesToSchool}` : ""}
                {e.appliesToMajors && e.appliesToMajors.length > 0 ? ` · 전공: ${e.appliesToMajors.join(", ")}` : ""}
                {e.applicationPaths && e.applicationPaths.length > 0
                  ? ` · 지원경로: ${e.applicationPaths.map((p) => APPLICATION_PATH_LABEL[p] ?? p).join(", ")}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources & Updates
// ---------------------------------------------------------------------------

function sourceTitle(s: UniversitySourceUrl): string {
  let host = s.url;
  try {
    host = new URL(s.url).hostname.replace(/^www\./, "");
  } catch {
    // URL 파싱 실패 시 원문 유지
  }
  return `${SOURCE_TYPE_LABEL[s.sourceType] ?? s.sourceType} · ${host}`;
}

function SourcesSection({
  sourceUrls,
  updates,
  universityId,
  canProposeSourceUrl,
  reportOpen,
  reportFieldPath,
  onReportOpenChange,
  onReportFieldPathChange,
}: {
  sourceUrls: UniversitySourceUrl[];
  updates: UniversityUpdateEntry[];
  universityId: string;
  canProposeSourceUrl: boolean;
  reportOpen: boolean;
  reportFieldPath: string;
  onReportOpenChange: (v: boolean) => void;
  onReportFieldPathChange: (v: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, UniversitySourceUrl[]>();
    for (const s of sourceUrls) {
      const arr = map.get(s.sourceType) ?? [];
      arr.push(s);
      map.set(s.sourceType, arr);
    }
    return Array.from(map.entries());
  }, [sourceUrls]);

  return (
    <>
      <div className={cardClass}>
        <div className={cardTitleClass}>승인된 공식 출처</div>
        {grouped.length === 0 && <p className="text-[12.5px] text-grey-500">등록된 출처가 없습니다.</p>}
        {grouped.map(([type, rows]) => (
          <div key={type} className="mb-3">
            <div className="text-[11px] font-bold text-grey-400 uppercase tracking-wide mb-1">{SOURCE_TYPE_LABEL[type] ?? type}</div>
            <ul className="space-y-1.5">
              {rows.map((s) => (
                <li key={s.id} className="text-[12.5px]">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {sourceTitle(s)}
                  </a>
                  <span className="ml-1.5 text-[11px] text-grey-500">
                    ({s.isOfficial ? "공식" : "참고"}
                    {s.cycleYear ? ` · ${s.cycleYear}` : ""})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {updates.length > 0 && (
        <div className={cardClass}>
          <div className={cardTitleClass}>최근 변경 사항</div>
          {updates.map((u) => (
            <div key={u.id} className="mb-2 text-[12.5px]">
              <div className="font-bold text-ink">{u.title}</div>
              <div className="text-[11px] text-grey-500">마지막 확인일 {u.updateDate}</div>
              {u.summary && <div className="text-grey-500 mt-0.5">{u.summary}</div>}
            </div>
          ))}
        </div>
      )}

      {canProposeSourceUrl && <ProposeSourceUrlSection universityId={universityId} />}

      <RefreshRequestButton universityId={universityId} />

      <ReportIssueForm
        universityId={universityId}
        open={reportOpen}
        onOpenChange={onReportOpenChange}
        fieldPath={reportFieldPath}
        onFieldPathChange={onReportFieldPathChange}
      />
    </>
  );
}

/** 컨설턴트 전용 — 출처 URL 제안 폼 + 내가 제안한 URL의 검토 상태. 관리자 승인 전까지는
 * "제안" 목록에서만 보이고 위 "승인된 공식 출처" 목록에는 나타나지 않는다(공식 출처처럼
 * 보이지 않게). */
function ProposeSourceUrlSection({ universityId }: { universityId: string }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listMySubmittedSourceUrls>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState("admissions_homepage");
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      try {
        setItems(await listMySubmittedSourceUrls(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "출처 목록을 불러오지 못했습니다.");
      }
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function submit() {
    if (!url.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await proposeUniversitySourceUrl({
          universityId,
          url: url.trim(),
          sourceType: sourceType as never,
          isOfficial: false,
        });
        setUrl("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "제안 등록 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>출처 URL 제안 (컨설턴트)</div>
      <p className="text-[11px] text-grey-500 mb-2">관리자 승인 전에는 위 &ldquo;승인된 공식 출처&rdquo; 목록에 나타나지 않습니다.</p>
      {error && <p className="text-[11.5px] text-red mb-2">{error}</p>}
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://... (승인 대기 상태로 등록됩니다)"
        className="w-full mb-2 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
      />
      <div className="flex gap-2 mb-2">
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        >
          {Object.entries(SOURCE_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !url.trim()}
          onClick={submit}
          className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
        >
          제안
        </button>
      </div>
      <div className="text-[11px] text-grey-500 mb-1">내가 제안한 URL 상태</div>
      {items === null && <p className="text-[11.5px] text-grey-400">불러오는 중…</p>}
      {items?.length === 0 && <p className="text-[11.5px] text-grey-400">제안한 출처가 없습니다.</p>}
      <ul className="space-y-1">
        {items?.map((s) => (
          <li key={s.id} className="text-[11.5px] text-grey-600">
            <span className="truncate">{s.url}</span>{" "}
            <span
              className={
                s.status === "approved" ? "text-green" : s.status === "rejected" ? "text-red" : "text-yellow"
              }
            >
              {s.status === "approved" ? "승인됨" : s.status === "rejected" ? "반려됨" : "검토 대기"}
            </span>
            {s.reviewNote && <span className="text-grey-400"> · {s.reviewNote}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "최신 정보 확인 요청" 버튼 — 학생/보호자/컨설턴트/관리자 전원 노출. 진행중/최근완료
 * 작업이 있으면 같은 상태를 그대로 보여준다(requestUniversityRefresh가 중복 큐잉하지 않음). */
function RefreshRequestButton({ universityId }: { universityId: string }) {
  const [job, setJob] = useState<{ status: "queued" | "running" | "succeeded" | "failed" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  function request() {
    setLoading(true);
    startTransition(async () => {
      try {
        const result = await requestUniversityRefresh(universityId);
        setJob(result);
      } catch {
        setJob(null);
      } finally {
        setLoading(false);
      }
    });
  }

  const statusLabel: Record<string, string> = {
    queued: "대기중",
    running: "확인중",
    succeeded: "확인 완료",
    failed: "확인 실패(다시 시도해 주세요)",
  };

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        disabled={loading || job?.status === "queued" || job?.status === "running"}
        onClick={request}
        className="text-[12px] font-bold text-grey-600 border-[1.5px] border-grey-200 rounded-xl px-4 py-2 hover:bg-grey-100 disabled:opacity-50"
      >
        최신 정보 확인 요청
      </button>
      {job && <span className="text-[11px] text-grey-500">{statusLabel[job.status]}</span>}
    </div>
  );
}

function ReportIssueForm({
  universityId,
  open,
  onOpenChange,
  fieldPath,
  onFieldPathChange,
}: {
  universityId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fieldPath: string;
  onFieldPathChange: (v: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function submit() {
    if (!message.trim()) return;
    setStatus("sending");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await reportUniversityDataIssue({
          universityId,
          fieldPath: fieldPath.trim() || null,
          message: message.trim(),
        });
        setStatus("sent");
        setMessage("");
        onFieldPathChange("");
      } catch (e) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "신고 접수 중 오류가 발생했습니다.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="w-full text-[12px] font-bold text-grey-500 border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-4 hover:bg-grey-100"
      >
        정보 오류 신고
      </button>
    );
  }

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>정보 오류 신고</div>
      {status === "sent" ? (
        <p className="text-[12.5px] text-ink">신고가 접수되었습니다. 검토 후 반영됩니다.</p>
      ) : (
        <>
          <input
            type="text"
            value={fieldPath}
            onChange={(e) => onFieldPathChange(e.target.value)}
            placeholder="어떤 항목인가요? (예: SAT 범위, 마감일 — 선택)"
            className="w-full mb-2 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="어떤 정보가 잘못됐는지 알려주세요."
            className="w-full mb-2 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            rows={3}
          />
          {errorMsg && <p className="text-[11.5px] text-red mb-2">{errorMsg}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={status === "sending" || !message.trim()}
              onClick={submit}
              className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
            >
              신고 제출
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border-[1.5px] border-grey-200 px-3 py-1.5 text-[12.5px] text-grey-600"
            >
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 공통 stat 헬퍼(신고 버튼 포함)
// ---------------------------------------------------------------------------

function stat(label: string, value: string | number | null | undefined, onFlag?: (label: string) => void) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">
        {label}
        {onFlag && <FlagButton label={label} onFlag={onFlag} />}
      </div>
      <div className="font-bold text-ink text-[12.5px]">{value}</div>
    </div>
  );
}
