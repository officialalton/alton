"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addUniversitySourceUrl,
  addUniversityUpdate,
  deleteAdmissionMetric,
  deleteUniversityAffiliation,
  deleteUniversityDemographic,
  deleteUniversityEssayPrompt,
  deleteUniversityFinancialAidProgram,
  deleteUniversityMajor,
  getUniversityDetail,
  listAdmissionMetrics,
  listUniversityAffiliations,
  listUniversityDemographics,
  listUniversityEssayPrompts,
  listUniversityFinancialAidPrograms,
  listUniversities,
  listUniversityDataReports,
  listUniversitySourceUrls,
  resolveUniversityDataReport,
  reviewUniversityEssayPrompt,
  reviewUniversitySourceUrl,
  updateUniversityBasics,
  upsertAdmissionCycle,
  upsertAdmissionMetric,
  upsertUniversityAffiliation,
  upsertUniversityDemographic,
  upsertUniversityEssayPrompt,
  upsertUniversityFinancialAidProgram,
  upsertUniversityMajor,
  type AdmissionCycle,
  type AdmissionMetric,
  type AdmissionMetricCohort,
  type AdmissionMetricKey,
  type AdmissionMetricVerificationStatus,
  type AffiliationKind,
  type DemographicCategory,
  type EligibilityScope,
  type FinancialAidProgramType,
  type PopulationScope,
  type UniversityEssayPrompt,
  type UniversityEssayPromptStatus,
  type UniversityEssayPromptType,
  type SourceUrlType,
  type UniversityDataReport,
  type UniversityDetail,
  type UniversityMajor,
  type UniversitySourceUrl,
  type UniversitySummary,
  type UniversityUpdateEntry,
  type ValueStatus,
  type VerificationStatus,
} from "@/lib/universities/actions";
import {
  getLatestRefreshJob,
  listQueuedRefreshJobs,
  listUpdateProposals,
  requestUniversityRefresh,
  retryQueuedRefreshJob,
  reviewUpdateProposal,
  rollbackAppliedProposal,
  type QueuedRefreshJob,
  type RefreshJob,
  type UpdateProposal,
} from "@/lib/universities/refresh-actions";

const ADMISSION_METRIC_KEY_OPTIONS: { value: AdmissionMetricKey; label: string }[] = [
  { value: "sat_total_25", label: "SAT 총점 25th" },
  { value: "sat_total_75", label: "SAT 총점 75th" },
  { value: "sat_ebrw_25", label: "SAT EBRW 25th" },
  { value: "sat_ebrw_75", label: "SAT EBRW 75th" },
  { value: "sat_math_25", label: "SAT Math 25th" },
  { value: "sat_math_75", label: "SAT Math 75th" },
  { value: "act_composite_25", label: "ACT Composite 25th" },
  { value: "act_composite_75", label: "ACT Composite 75th" },
  { value: "gpa_average", label: "GPA 평균" },
  { value: "top10pct_pct", label: "상위 10% 비율" },
  { value: "ap_ib_indicator", label: "AP/IB 지표" },
  { value: "applicants_count", label: "지원자 수" },
  { value: "admitted_count", label: "합격자 수" },
  { value: "enrolled_count", label: "등록자 수" },
  { value: "admit_rate", label: "합격률" },
  { value: "yield_rate", label: "등록률(수율)" },
];

const ADMISSION_METRIC_COHORT_OPTIONS: { value: AdmissionMetricCohort; label: string }[] = [
  { value: "applicant", label: "지원자" },
  { value: "admitted", label: "합격자" },
  { value: "enrolled", label: "등록자" },
];

const ADMISSION_METRIC_VERIFICATION_OPTIONS: { value: AdmissionMetricVerificationStatus; label: string }[] = [
  { value: "official", label: "공식" },
  { value: "secondary", label: "참고(2차자료)" },
  { value: "unverified", label: "미검증" },
];

const SOURCE_TYPE_OPTIONS: { value: SourceUrlType; label: string }[] = [
  { value: "admissions_homepage", label: "입학처 홈페이지" },
  { value: "common_data_set", label: "Common Data Set" },
  { value: "catalog_programs", label: "카탈로그/전공" },
  { value: "deadlines", label: "지원 마감일" },
  { value: "essay_prompts", label: "에세이 문항" },
  { value: "admitted_profile", label: "합격자 프로필" },
  { value: "financial_aid", label: "재정지원" },
  { value: "other", label: "기타" },
];

const CURRENT_CYCLE_YEAR = 2027;

const SETTING_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "urban", label: "도시" },
  { value: "suburban", label: "교외" },
  { value: "rural", label: "시골" },
  { value: "town", label: "소도시" },
];
const CALENDAR_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "semester", label: "학기제(Semester)" },
  { value: "quarter", label: "쿼터제(Quarter)" },
  { value: "trimester", label: "트라이메스터" },
  { value: "4-1-4", label: "4-1-4제" },
  { value: "other", label: "기타" },
];

/** 지시서 E: 200개교 확대 상태 배지. 재검증 없이 verified_pilot로 표시하지 않는다는 원칙을
 * 화면에서도 그대로 드러낸다(색상만으로 구분하지 않고 텍스트로 명확히 표기). */
function DataCollectionStatusBadge({
  status,
  verifiedAt,
}: {
  status: "verified_pilot" | "sources_pending_review" | "unconfirmed";
  /** 마무리 세션 추가: verified_pilot로 바뀐 시각(재검증 시점). 과거 데이터는 없을 수 있다. */
  verifiedAt?: string | null;
}) {
  const style =
    status === "verified_pilot"
      ? "bg-green-100 text-green-700"
      : status === "sources_pending_review"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-grey-100 text-grey-500";
  const text = status === "verified_pilot" ? "실검증 완료(UAT)" : status === "sources_pending_review" ? "출처 검토 필요" : "미확인";
  const verifiedAtLabel =
    status === "verified_pilot" && verifiedAt ? new Date(verifiedAt).toLocaleDateString("ko-KR") : null;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style}`}>
      {text}
      {verifiedAtLabel ? ` · ${verifiedAtLabel}` : ""}
    </span>
  );
}

/** 텍스트·숫자·날짜 입력 공용 라벨+인풋. onChange는 항상 문자열을 받는다(호출부에서 파싱). */
function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: "text" | "number" | "date";
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs text-grey-600">
      {label}
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
      />
    </label>
  );
}

export default function UniversitiesPanel({ initialUniversities }: { initialUniversities: UniversitySummary[] }) {
  const [universities, setUniversities] = useState(initialUniversities);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UniversityDetail | null>(null);
  const [cycles, setCycles] = useState<AdmissionCycle[]>([]);
  const [updates, setUpdates] = useState<UniversityUpdateEntry[]>([]);

  function runSearch(nextSearch: string) {
    setSearch(nextSearch);
    startTransition(async () => {
      setError(null);
      try {
        setUniversities(await listUniversities({ search: nextSearch }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "검색 중 오류가 발생했습니다.");
      }
    });
  }

  function openDetail(id: string) {
    setSelectedId(id);
    startTransition(async () => {
      setError(null);
      try {
        const d = await getUniversityDetail(id);
        setDetail(d.university);
        setCycles(d.cycles);
        setUpdates(d.updates);
      } catch (e) {
        setError(e instanceof Error ? e.message : "상세 조회 중 오류가 발생했습니다.");
      }
    });
  }

  function refreshDetail() {
    if (!selectedId) return;
    openDetail(selectedId);
  }

  return (
    <div className="mt-6">
      <QueuedRefreshJobsSection setError={setError} />
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.2fr]">
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="학교명으로 검색"
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-red">{error}</p>}
        <p className="mt-2 text-xs text-grey-500">{universities.length}개교</p>
        <ul className="mt-2 max-h-[70vh] divide-y divide-grey-200 overflow-y-auto rounded border border-grey-200 bg-white">
          {universities.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => openDetail(u.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-grey-50 ${
                  selectedId === u.id ? "bg-grey-100" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="mr-2 text-grey-400">#{u.rankFinal ?? "-"}</span>
                  {u.name}
                  <DataCollectionStatusBadge status={u.dataCollectionStatus} verifiedAt={u.dataCollectionStatusVerifiedAt} />
                </span>
                <span className="text-xs text-grey-400">{u.latestCycleYear ?? "미입력"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        {!detail && <p className="text-sm text-grey-500">왼쪽 목록에서 대학을 선택하세요.</p>}
        {detail && (
          <UniversityDetailPanel
            detail={detail}
            cycles={cycles}
            updates={updates}
            isPending={isPending}
            startTransition={startTransition}
            onSaved={refreshDetail}
            setError={setError}
          />
        )}
      </div>
      </div>
    </div>
  );
}

/** 마무리 세션 추가: 동시 실행 한도(3) 초과로 'queued'에 머물러 있는 작업 전체를 대학 구분
 * 없이 한 화면에서 보여주고, 관리자가 수동으로 즉시 재시도할 수 있게 한다. 자동 워커/폴러는
 * 이번 세션 범위 밖(비용·인프라 결정 필요 항목으로 남겨둠). */
function QueuedRefreshJobsSection({ setError }: { setError: (msg: string | null) => void }) {
  const [jobs, setJobs] = useState<QueuedRefreshJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    setLoading(true);
    startTransition(async () => {
      try {
        setJobs(await listQueuedRefreshJobs());
      } catch (e) {
        setError(e instanceof Error ? e.message : "대기 중인 작업 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 로드
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry(jobId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await retryQueuedRefreshJob(jobId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "재시도 중 오류가 발생했습니다.");
      }
    });
  }

  if (!loading && jobs.length === 0) return null;

  return (
    <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">대기 중인 갱신 작업{jobs.length > 0 ? ` (${jobs.length})` : ""}</h3>
        <button
          type="button"
          disabled={isPending}
          onClick={refresh}
          className="rounded border border-grey-300 px-2 py-1 text-xs text-grey-600 disabled:opacity-50"
        >
          새로고침
        </button>
      </div>
      <p className="mt-1 text-xs text-grey-500">
        동시 실행 한도(3개교)를 초과해 대기 중인 작업입니다. 자동으로 실행되지 않으니(자동 워커 미도입 —
        결정 필요) 아래에서 직접 재시도하세요.
      </p>
      {loading && <p className="mt-2 text-xs text-grey-400">불러오는 중…</p>}
      <ul className="mt-2 space-y-1">
        {jobs.map((j) => (
          <li key={j.id} className="flex items-center justify-between rounded border border-grey-100 bg-white px-2 py-1 text-xs">
            <span>
              {j.universityName} <span className="text-grey-400">· {new Date(j.createdAt).toLocaleString("ko-KR")}</span>
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => retry(j.id)}
              className="rounded bg-ink px-2 py-1 text-[11px] text-white disabled:opacity-50"
            >
              지금 재시도
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UniversityDetailPanel({
  detail,
  cycles,
  updates,
  isPending,
  startTransition,
  onSaved,
  setError,
}: {
  detail: UniversityDetail;
  cycles: AdmissionCycle[];
  updates: UniversityUpdateEntry[];
  isPending: boolean;
  startTransition: (fn: () => Promise<void> | void) => void;
  onSaved: () => void;
  setError: (msg: string | null) => void;
}) {
  const existing = cycles.find((c) => c.cycleYear === CURRENT_CYCLE_YEAR);
  const [testPolicy, setTestPolicy] = useState(existing?.testPolicy ?? "optional");
  const [gpaAverage, setGpaAverage] = useState(existing?.gpaAverage?.toString() ?? "");
  const [rdDeadline, setRdDeadline] = useState(existing?.rdDeadline ?? "");
  const [applicationOpensDate, setApplicationOpensDate] = useState(existing?.applicationOpensDate ?? "");
  const [essayCount, setEssayCount] = useState(existing?.essayCount?.toString() ?? "");
  const [acceptanceRate, setAcceptanceRate] = useState(existing?.acceptanceRate?.toString() ?? "");
  // Part 3 — 재학생/입시 통계.
  const [pellGrantPct, setPellGrantPct] = useState(existing?.pellGrantPct?.toString() ?? "");
  const [studentFacultyRatio, setStudentFacultyRatio] = useState(existing?.studentFacultyRatio ?? "");
  const [gradRate4yr, setGradRate4yr] = useState(existing?.gradRate4yr?.toString() ?? "");
  const [gradRate6yr, setGradRate6yr] = useState(existing?.gradRate6yr?.toString() ?? "");
  const [retentionRate, setRetentionRate] = useState(existing?.retentionRate?.toString() ?? "");
  const [totalApplicants, setTotalApplicants] = useState(existing?.totalApplicants?.toString() ?? "");
  const [yieldRate, setYieldRate] = useState(existing?.yieldRate?.toString() ?? "");
  const [internationalPct, setInternationalPct] = useState(existing?.internationalPct?.toString() ?? "");
  const [womenPct, setWomenPct] = useState(existing?.womenPct?.toString() ?? "");
  // Part 5 — 비용/재정지원, ED2/restrictive EA, 학사 상세, 합격자 프로필.
  const [tuitionInState, setTuitionInState] = useState(existing?.tuitionInState?.toString() ?? "");
  const [tuitionOutState, setTuitionOutState] = useState(existing?.tuitionOutState?.toString() ?? "");
  const [roomBoardCost, setRoomBoardCost] = useState(existing?.roomBoardCost?.toString() ?? "");
  const [avgNetPrice, setAvgNetPrice] = useState(existing?.avgNetPrice?.toString() ?? "");
  const [pctReceivingAid, setPctReceivingAid] = useState(existing?.pctReceivingAid?.toString() ?? "");
  const [avgAidAward, setAvgAidAward] = useState(existing?.avgAidAward?.toString() ?? "");
  const [eaRestrictive, setEaRestrictive] = useState(existing?.eaRestrictive ?? false);
  const [ed2Deadline, setEd2Deadline] = useState(existing?.ed2Deadline ?? "");
  const [classSizeUnder20Pct, setClassSizeUnder20Pct] = useState(existing?.classSizeUnder20Pct?.toString() ?? "");
  const [classSizeOver50Pct, setClassSizeOver50Pct] = useState(existing?.classSizeOver50Pct?.toString() ?? "");
  const [studyAbroadPct, setStudyAbroadPct] = useState(existing?.studyAbroadPct?.toString() ?? "");
  const [admittedAvgApExams, setAdmittedAvgApExams] = useState(existing?.admittedAvgApExams?.toString() ?? "");
  const [admittedWeightedGpaAvg, setAdmittedWeightedGpaAvg] = useState(existing?.admittedWeightedGpaAvg?.toString() ?? "");
  const [admittedTop10pctClassRankPct, setAdmittedTop10pctClassRankPct] = useState(existing?.admittedTop10pctClassRankPct?.toString() ?? "");

  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDate, setUpdateDate] = useState("");
  const [updateSummary, setUpdateSummary] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");

  // 기본 정보(Part 5) — 자주 안 바뀌는 학교 소개·캠퍼스 정보.
  const [overviewText, setOverviewText] = useState(detail.overviewText ?? "");
  const [setting, setSetting] = useState(detail.setting ?? "");
  const [campusSizeAcres, setCampusSizeAcres] = useState(detail.campusSizeAcres?.toString() ?? "");
  const [ncaaDivision, setNcaaDivision] = useState(detail.ncaaDivision ?? "");
  const [religiousAffiliation, setReligiousAffiliation] = useState(detail.religiousAffiliation ?? "");
  const [calendarSystem, setCalendarSystem] = useState(detail.calendarSystem ?? "");
  const [honorsCollege, setHonorsCollege] = useState(detail.honorsCollege ?? false);
  const [strengthsPrograms, setStrengthsPrograms] = useState(detail.strengthsPrograms.join(", "));
  // Part 11 — 공식 연락처.
  const [officialAddress, setOfficialAddress] = useState(detail.officialAddress ?? "");
  const [officialPhone, setOfficialPhone] = useState(detail.officialPhone ?? "");

  function saveBasics() {
    setError(null);
    startTransition(async () => {
      try {
        await updateUniversityBasics({
          universityId: detail.id,
          applicationPlatform: detail.applicationPlatform,
          overviewText: overviewText || null,
          setting: setting || null,
          campusSizeAcres: campusSizeAcres ? Number(campusSizeAcres) : null,
          ncaaDivision: ncaaDivision || null,
          religiousAffiliation: religiousAffiliation || null,
          calendarSystem: calendarSystem || null,
          honorsCollege,
          strengthsPrograms: strengthsPrograms.split(",").map((s) => s.trim()).filter(Boolean),
          officialAddress: officialAddress || null,
          officialPhone: officialPhone || null,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }

  function saveCycle() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertAdmissionCycle({
          universityId: detail.id,
          cycleYear: CURRENT_CYCLE_YEAR,
          testPolicy,
          gpaAverage: gpaAverage ? Number(gpaAverage) : null,
          rdDeadline: rdDeadline || null,
          applicationOpensDate: applicationOpensDate || null,
          essayCount: essayCount ? Number(essayCount) : null,
          acceptanceRate: acceptanceRate ? Number(acceptanceRate) : null,
          pellGrantPct: pellGrantPct ? Number(pellGrantPct) : null,
          studentFacultyRatio: studentFacultyRatio || null,
          gradRate4yr: gradRate4yr ? Number(gradRate4yr) : null,
          gradRate6yr: gradRate6yr ? Number(gradRate6yr) : null,
          retentionRate: retentionRate ? Number(retentionRate) : null,
          totalApplicants: totalApplicants ? Number(totalApplicants) : null,
          yieldRate: yieldRate ? Number(yieldRate) : null,
          internationalPct: internationalPct ? Number(internationalPct) : null,
          womenPct: womenPct ? Number(womenPct) : null,
          tuitionInState: tuitionInState ? Number(tuitionInState) : null,
          tuitionOutState: tuitionOutState ? Number(tuitionOutState) : null,
          roomBoardCost: roomBoardCost ? Number(roomBoardCost) : null,
          avgNetPrice: avgNetPrice ? Number(avgNetPrice) : null,
          pctReceivingAid: pctReceivingAid ? Number(pctReceivingAid) : null,
          avgAidAward: avgAidAward ? Number(avgAidAward) : null,
          eaRestrictive,
          ed2Deadline: ed2Deadline || null,
          classSizeUnder20Pct: classSizeUnder20Pct ? Number(classSizeUnder20Pct) : null,
          classSizeOver50Pct: classSizeOver50Pct ? Number(classSizeOver50Pct) : null,
          studyAbroadPct: studyAbroadPct ? Number(studyAbroadPct) : null,
          admittedAvgApExams: admittedAvgApExams ? Number(admittedAvgApExams) : null,
          admittedWeightedGpaAvg: admittedWeightedGpaAvg ? Number(admittedWeightedGpaAvg) : null,
          admittedTop10pctClassRankPct: admittedTop10pctClassRankPct ? Number(admittedTop10pctClassRankPct) : null,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }

  function saveUpdate() {
    setError(null);
    startTransition(async () => {
      try {
        await addUniversityUpdate({
          universityId: detail.id,
          title: updateTitle,
          updateDate,
          summary: updateSummary || null,
          sourceUrl: updateUrl || null,
        });
        setUpdateTitle("");
        setUpdateDate("");
        setUpdateSummary("");
        setUpdateUrl("");
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="rounded border border-grey-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        {detail.name}
        <DataCollectionStatusBadge status={detail.dataCollectionStatus} verifiedAt={detail.dataCollectionStatusVerifiedAt} />
      </h2>
      <p className="text-xs text-grey-500">
        #{detail.rankFinal ?? "-"} · {detail.city ?? "-"}, {detail.state ?? "-"} · {detail.publicPrivate ?? "-"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {detail.admissionsHomepageUrl && (
          <a href={detail.admissionsHomepageUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            입학처
          </a>
        )}
        {detail.commonDataSetUrl && (
          <a href={detail.commonDataSetUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            CDS
          </a>
        )}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-ink">기본 정보</h3>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs text-grey-600">
          학교 소개(3~5문장)
          <textarea
            value={overviewText}
            onChange={(e) => setOverviewText(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-grey-600">
          캠퍼스 소재 유형
          <select value={setting} onChange={(e) => setSetting(e.target.value)} className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm">
            {SETTING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <Field label="캠퍼스 크기(acre)" type="number" value={campusSizeAcres} onChange={setCampusSizeAcres} />
        <Field label="NCAA 디비전" value={ncaaDivision} onChange={setNcaaDivision} />
        <Field label="종교 계열" value={religiousAffiliation} onChange={setReligiousAffiliation} />
        <label className="text-xs text-grey-600">
          학사력
          <select value={calendarSystem} onChange={(e) => setCalendarSystem(e.target.value)} className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm">
            {CALENDAR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-grey-600">
          <input type="checkbox" checked={honorsCollege} onChange={(e) => setHonorsCollege(e.target.checked)} />
          Honors College 있음
        </label>
        <label className="col-span-2 text-xs text-grey-600">
          강점 분야(쉼표로 구분)
          <input
            type="text"
            value={strengthsPrograms}
            onChange={(e) => setStrengthsPrograms(e.target.value)}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          />
        </label>
        <Field label="공식 주소" value={officialAddress} onChange={setOfficialAddress} />
        <Field label="공식 대표 전화번호" value={officialPhone} onChange={setOfficialPhone} />
      </div>
      <button type="button" disabled={isPending} onClick={saveBasics} className="mt-3 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50">
        기본 정보 저장
      </button>

      <h3 className="mt-6 text-sm font-semibold text-ink">{CURRENT_CYCLE_YEAR} 입시 사이클 — 시험·입시</h3>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="text-xs text-grey-600">
          시험 정책
          <select
            value={testPolicy ?? "optional"}
            onChange={(e) => setTestPolicy(e.target.value)}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          >
            <option value="required">필수</option>
            <option value="optional">선택</option>
            <option value="not_considered">미반영</option>
          </select>
        </label>
        <Field label="GPA 평균" type="number" value={gpaAverage} onChange={setGpaAverage} />
        <Field label="지원접수 시작일" type="date" value={applicationOpensDate} onChange={setApplicationOpensDate} />
        <Field label="RD 마감일" type="date" value={rdDeadline} onChange={setRdDeadline} />
        <Field label="ED2 마감일" type="date" value={ed2Deadline} onChange={setEd2Deadline} />
        <Field label="필수 에세이 개수" type="number" value={essayCount} onChange={setEssayCount} />
        <Field label="합격률(%) — 과거 실적 참고용" type="number" value={acceptanceRate} onChange={setAcceptanceRate} />
        <Field label="지원자 수" type="number" value={totalApplicants} onChange={setTotalApplicants} />
        <Field label="등록률(yield, %)" type="number" value={yieldRate} onChange={setYieldRate} />
        <label className="flex items-center gap-2 text-xs text-grey-600">
          <input type="checkbox" checked={eaRestrictive} onChange={(e) => setEaRestrictive(e.target.checked)} />
          Restrictive/Single-Choice EA
        </label>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-ink">재학생 통계</h3>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Field label="재적 유지율(%)" type="number" value={retentionRate} onChange={setRetentionRate} />
        <Field label="4년 졸업률(%)" type="number" value={gradRate4yr} onChange={setGradRate4yr} />
        <Field label="6년 졸업률(%)" type="number" value={gradRate6yr} onChange={setGradRate6yr} />
        <Field label="Pell Grant 수혜율(%)" type="number" value={pellGrantPct} onChange={setPellGrantPct} />
        <Field label="국제학생 비율(%)" type="number" value={internationalPct} onChange={setInternationalPct} />
        <Field label="여학생 비율(%)" type="number" value={womenPct} onChange={setWomenPct} />
        <Field label="학생 대 교수 비율" value={studentFacultyRatio} onChange={setStudentFacultyRatio} />
      </div>

      <h3 className="mt-6 text-sm font-semibold text-ink">비용 · 재정지원</h3>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Field label="등록금(주내, $)" type="number" value={tuitionInState} onChange={setTuitionInState} />
        <Field label="등록금(주외/유학생, $)" type="number" value={tuitionOutState} onChange={setTuitionOutState} />
        <Field label="기숙사·식비($)" type="number" value={roomBoardCost} onChange={setRoomBoardCost} />
        <Field label="평균 순부담액($)" type="number" value={avgNetPrice} onChange={setAvgNetPrice} />
        <Field label="재정지원 수혜율(%)" type="number" value={pctReceivingAid} onChange={setPctReceivingAid} />
        <Field label="평균 지원액($)" type="number" value={avgAidAward} onChange={setAvgAidAward} />
      </div>

      <h3 className="mt-6 text-sm font-semibold text-ink">학사 · 합격자 프로필</h3>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Field label="강의 20명 이하 비율(%)" type="number" value={classSizeUnder20Pct} onChange={setClassSizeUnder20Pct} />
        <Field label="강의 50명 이상 비율(%)" type="number" value={classSizeOver50Pct} onChange={setClassSizeOver50Pct} />
        <Field label="교환학생 참여율(%)" type="number" value={studyAbroadPct} onChange={setStudyAbroadPct} />
        <Field label="합격자 평균 AP 시험 수" type="number" value={admittedAvgApExams} onChange={setAdmittedAvgApExams} />
        <Field label="합격자 평균 가중 GPA" type="number" value={admittedWeightedGpaAvg} onChange={setAdmittedWeightedGpaAvg} />
        <Field label="합격자 고교 상위 10% 비율(%)" type="number" value={admittedTop10pctClassRankPct} onChange={setAdmittedTop10pctClassRankPct} />
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={saveCycle}
        className="mt-3 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        사이클 저장
      </button>

      <h3 className="mt-6 text-sm font-semibold text-ink">업데이트 타임라인</h3>
      <ul className="mt-2 space-y-1 text-xs text-grey-600">
        {updates.length === 0 && <li className="text-grey-400">등록된 업데이트가 없습니다.</li>}
        {updates.map((u) => (
          <li key={u.id} className="rounded border border-grey-100 p-2">
            <span className="font-medium text-ink">{u.title}</span> — {u.updateDate}
            {u.summary && <p className="mt-1">{u.summary}</p>}
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-2">
        <input
          type="text"
          placeholder="제목"
          value={updateTitle}
          onChange={(e) => setUpdateTitle(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={updateDate}
          onChange={(e) => setUpdateDate(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <textarea
          placeholder="요약"
          value={updateSummary}
          onChange={(e) => setUpdateSummary(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          placeholder="출처 URL"
          value={updateUrl}
          onChange={(e) => setUpdateUrl(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={saveUpdate}
          className="rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          업데이트 추가
        </button>
      </div>

      <AdmissionMetricsSection universityId={detail.id} setError={setError} />
      <EssayPromptsSection universityId={detail.id} setError={setError} />
      <SourceUrlsSection universityId={detail.id} setError={setError} />
      <AffiliationsSection universityId={detail.id} setError={setError} />
      <DemographicsSection universityId={detail.id} setError={setError} />
      <FinancialAidProgramsSection universityId={detail.id} setError={setError} />
      <MajorsAdminSection universityId={detail.id} setError={setError} />
      <ReportsInboxSection universityId={detail.id} setError={setError} />
      <RefreshAndProposalsSection universityId={detail.id} setError={setError} />
    </div>
  );
}

/** 대학 상세 화면의 "정보 수집 봇" 섹션 — 갱신 요청 버튼 + job 상태 + 변경안 검토(승인/수정후승인/보류/거절/롤백). */
function RefreshAndProposalsSection({
  universityId,
  setError,
}: {
  universityId: string;
  setError: (msg: string | null) => void;
}) {
  const [job, setJob] = useState<RefreshJob | null>(null);
  const [proposals, setProposals] = useState<UpdateProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  function refresh() {
    setLoading(true);
    startTransition(async () => {
      try {
        const [latestJob, list] = await Promise.all([getLatestRefreshJob(universityId), listUpdateProposals(universityId)]);
        setJob(latestJob);
        setProposals(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "갱신 상태 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function requestRefresh() {
    setError(null);
    startTransition(async () => {
      try {
        await requestUniversityRefresh(universityId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "갱신 요청 중 오류가 발생했습니다.");
      }
    });
  }

  function review(proposalId: string, decision: "approved" | "held" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await reviewUpdateProposal({ proposalId, decision, reviewReason: reasons[proposalId] ?? null });
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "변경안 처리 중 오류가 발생했습니다.");
      }
    });
  }

  function rollback(proposalId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await rollbackAppliedProposal(proposalId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "롤백 중 오류가 발생했습니다.");
      }
    });
  }

  const jobStatusLabel: Record<RefreshJob["status"], string> = {
    queued: "대기중",
    running: "실행중",
    succeeded: "완료",
    failed: "실패",
  };
  const resultTypeLabel: Record<UpdateProposal["resultType"], string> = {
    no_change: "변경없음",
    new: "신규",
    changed: "변경됨",
    source_conflict: "출처충돌",
    fetch_failed: "수집실패",
  };
  const statusLabel: Record<UpdateProposal["status"], string> = {
    pending: "검토대기",
    approved: "승인됨",
    approved_with_edit: "수정후승인",
    held: "보류",
    rejected: "거절",
  };
  const statusClass: Record<UpdateProposal["status"], string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    approved_with_edit: "bg-green-100 text-green-700",
    held: "bg-grey-200 text-grey-600",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">정보 수집 봇 / 변경안 검토</h3>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={isPending || job?.status === "queued" || job?.status === "running"}
          onClick={requestRefresh}
          className="rounded bg-ink px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          최신 정보 확인 요청
        </button>
        {job && (
          <span className="text-xs text-grey-500">
            최근 작업: {jobStatusLabel[job.status]}
            {job.errorSummary ? ` — ${job.errorSummary}` : ""}
          </span>
        )}
      </div>
      {loading && <p className="mt-2 text-xs text-grey-400">불러오는 중…</p>}
      <ul className="mt-3 space-y-2 text-xs text-grey-600">
        {!loading && proposals.length === 0 && <li className="text-grey-400">아직 변경안이 없습니다.</li>}
        {proposals.map((p) => (
          <li key={p.id} className="rounded border border-grey-100 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">
                {p.fieldArea} · {p.targetTable}
                {p.cycleYear ? ` · ${p.cycleYear}` : ""}
              </span>
              <span className="flex gap-1">
                <span className="rounded bg-grey-100 px-1.5 py-0.5 text-[11px] text-grey-600">
                  {resultTypeLabel[p.resultType]}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${statusClass[p.status]}`}>{statusLabel[p.status]}</span>
              </span>
            </div>
            {p.evidenceLocation && (
              <p className="mt-1 truncate text-grey-400">
                출처: <a href={p.evidenceLocation} target="_blank" rel="noreferrer" className="underline">{p.evidenceLocation}</a>
              </p>
            )}
            {p.evidenceExcerpt && <p className="mt-1 whitespace-pre-wrap text-grey-700">{p.evidenceExcerpt}</p>}
            {p.status === "pending" && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  placeholder="검토 사유(선택)"
                  value={reasons[p.id] ?? ""}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  className="w-full rounded border border-grey-300 px-2 py-1 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => review(p.id, "approved")}
                    className="rounded bg-ink px-2 py-1 text-[11px] text-white disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => review(p.id, "held")}
                    className="rounded border border-grey-300 px-2 py-1 text-[11px] text-grey-700 disabled:opacity-50"
                  >
                    보류
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => review(p.id, "rejected")}
                    className="rounded border border-grey-300 px-2 py-1 text-[11px] text-grey-700 disabled:opacity-50"
                  >
                    거절
                  </button>
                </div>
              </div>
            )}
            {p.appliedAt && (p.status === "approved" || p.status === "approved_with_edit") && (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => rollback(p.id)}
                  className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-700 disabled:opacity-50"
                >
                  승인 취소(롤백)
                </button>
              </div>
            )}
            {p.reviewReason && <p className="mt-1 text-grey-400">검토 사유: {p.reviewReason}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 대학 상세 화면의 "오류 신고함" 섹션 — 해당 대학에 접수된 신고 목록 + 상태 전이 처리. */
function ReportsInboxSection({
  universityId,
  setError,
}: {
  universityId: string;
  setError: (msg: string | null) => void;
}) {
  const [items, setItems] = useState<UniversityDataReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  function refresh() {
    setLoading(true);
    startTransition(async () => {
      try {
        const all = await listUniversityDataReports();
        setItems(all.filter((r) => r.universityId === universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "신고 목록 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function transition(reportId: string, status: "in_review" | "resolved" | "dismissed") {
    setError(null);
    startTransition(async () => {
      try {
        await resolveUniversityDataReport({ reportId, status, resolutionNote: notes[reportId] ?? null });
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "신고 처리 중 오류가 발생했습니다.");
      }
    });
  }

  const statusLabel: Record<UniversityDataReport["status"], string> = {
    open: "접수",
    in_review: "확인중",
    resolved: "수정완료",
    dismissed: "확인불가",
  };
  const statusClass: Record<UniversityDataReport["status"], string> = {
    open: "bg-yellow-100 text-yellow-700",
    in_review: "bg-blue-100 text-blue-700",
    resolved: "bg-green-100 text-green-700",
    dismissed: "bg-grey-200 text-grey-600",
  };

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">오류 신고함</h3>
      {loading && <p className="text-xs text-grey-400">불러오는 중…</p>}
      <ul className="mt-2 space-y-2 text-xs text-grey-600">
        {!loading && items.length === 0 && <li className="text-grey-400">접수된 신고가 없습니다.</li>}
        {items.map((r) => (
          <li key={r.id} className="rounded border border-grey-100 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{r.fieldPath ?? "일반 신고"}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${statusClass[r.status]}`}>
                {statusLabel[r.status]}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-grey-700">{r.message}</p>
            {r.reportedValue && <p className="mt-1 text-grey-400">신고된 값: {r.reportedValue}</p>}
            <p className="mt-1 text-grey-400">
              신고자 역할: {r.reporterRole ?? "알 수 없음"} · {new Date(r.createdAt).toLocaleString("ko-KR")}
            </p>
            {r.status !== "resolved" && r.status !== "dismissed" && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  placeholder="처리 메모"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="w-full rounded border border-grey-300 px-2 py-1 text-xs"
                />
                <div className="flex gap-2">
                  {r.status === "open" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => transition(r.id, "in_review")}
                      className="rounded border border-grey-300 px-2 py-1 text-[11px] text-grey-700 disabled:opacity-50"
                    >
                      확인중으로 변경
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => transition(r.id, "resolved")}
                    className="rounded bg-ink px-2 py-1 text-[11px] text-white disabled:opacity-50"
                  >
                    수정완료
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => transition(r.id, "dismissed")}
                    className="rounded border border-grey-300 px-2 py-1 text-[11px] text-grey-700 disabled:opacity-50"
                  >
                    정보정확함/확인불가
                  </button>
                </div>
              </div>
            )}
            {r.resolutionNote && r.status === "resolved" && (
              <p className="mt-1 text-green-700">처리 메모: {r.resolutionNote}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 대학 상세 화면의 "학업 지표" 섹션 — 연도×대상집단×지표 편집(P7, 2026-09-23). */
function AdmissionMetricsSection({
  universityId,
  setError,
}: {
  universityId: string;
  setError: (msg: string | null) => void;
}) {
  const [items, setItems] = useState<AdmissionMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [cycleYear, setCycleYear] = useState(String(CURRENT_CYCLE_YEAR));
  const [cohort, setCohort] = useState<AdmissionMetricCohort>("admitted");
  const [metricKey, setMetricKey] = useState<AdmissionMetricKey>("sat_total_25");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [submittersOnly, setSubmittersOnly] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<AdmissionMetricVerificationStatus>("secondary");
  const [notes, setNotes] = useState("");

  function refresh() {
    setLoading(true);
    startTransition(async () => {
      try {
        setItems(await listAdmissionMetrics(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "학업 지표 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function save() {
    if (!cycleYear.trim() || !value.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertAdmissionMetric({
          universityId,
          cycleYear: Number(cycleYear),
          cohort,
          metricKey,
          value: Number(value),
          unit: unit.trim() || null,
          submittersOnly,
          verificationStatus,
          notes: notes.trim() || null,
        });
        setValue("");
        setUnit("");
        setNotes("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "학업 지표 저장 중 오류가 발생했습니다.");
      }
    });
  }

  function remove(metricId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAdmissionMetric(metricId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "학업 지표 삭제 중 오류가 발생했습니다.");
      }
    });
  }

  const cohortLabel: Record<AdmissionMetricCohort, string> = {
    applicant: "지원자",
    admitted: "합격자",
    enrolled: "등록자",
  };
  const verificationLabel: Record<AdmissionMetricVerificationStatus, string> = {
    official: "공식",
    secondary: "참고(2차자료)",
    unverified: "미검증",
  };

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">학업 지표(합격·등록 학생 프로필)</h3>
      {loading && <p className="text-xs text-grey-400">불러오는 중…</p>}
      <table className="mt-2 w-full text-xs text-grey-600">
        <thead>
          <tr className="text-left text-grey-400">
            <th className="pr-2">연도</th>
            <th className="pr-2">대상집단</th>
            <th className="pr-2">지표</th>
            <th className="pr-2">값</th>
            <th className="pr-2">검증상태</th>
            <th className="pr-2">비고</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7} className="text-grey-400">
                등록된 학업 지표가 없습니다.
              </td>
            </tr>
          )}
          {items.map((m) => (
            <tr key={m.id} className="border-t border-grey-100">
              <td className="pr-2 py-1">{m.cycleYear}</td>
              <td className="pr-2 py-1">{cohortLabel[m.cohort]}</td>
              <td className="pr-2 py-1">{ADMISSION_METRIC_KEY_OPTIONS.find((o) => o.value === m.metricKey)?.label ?? m.metricKey}</td>
              <td className="pr-2 py-1">
                {m.value ?? m.valueText ?? "-"}
                {m.unit ? ` ${m.unit}` : ""}
                {m.submittersOnly ? " (제출자만)" : ""}
              </td>
              <td className="pr-2 py-1">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    m.verificationStatus === "official"
                      ? "bg-green-100 text-green-700"
                      : m.verificationStatus === "secondary"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red"
                  }`}
                >
                  {verificationLabel[m.verificationStatus]}
                </span>
              </td>
              <td className="pr-2 py-1 max-w-[200px] truncate" title={m.notes ?? undefined}>
                {m.notes ?? ""}
              </td>
              <td className="py-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => remove(m.id)}
                  className="rounded border border-grey-300 px-2 py-0.5 text-[11px] text-grey-700 disabled:opacity-50"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          type="number"
          placeholder="연도"
          value={cycleYear}
          onChange={(e) => setCycleYear(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <select value={cohort} onChange={(e) => setCohort(e.target.value as AdmissionMetricCohort)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {ADMISSION_METRIC_COHORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value as AdmissionMetricKey)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {ADMISSION_METRIC_KEY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="값"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          placeholder="단위(예: score, pct, count)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <select
          value={verificationStatus}
          onChange={(e) => setVerificationStatus(e.target.value as AdmissionMetricVerificationStatus)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        >
          {ADMISSION_METRIC_VERIFICATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-grey-600">
          <input type="checkbox" checked={submittersOnly} onChange={(e) => setSubmittersOnly(e.target.checked)} />
          제출자만
        </label>
        <input
          type="text"
          placeholder="비고(출처/메모)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4"
        />
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={save}
        className="mt-2 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        학업 지표 저장
      </button>
    </div>
  );
}

const ESSAY_PROMPT_TYPE_OPTIONS: { value: UniversityEssayPromptType; label: string }[] = [
  { value: "common_app", label: "공통 지원서(Common App 등)" },
  { value: "school_specific", label: "대학 자체 추가 에세이" },
  { value: "short_answer", label: "짧은 답변/활동 설명" },
  { value: "program_conditional", label: "단과대/전공별 조건부" },
];

const ESSAY_PROMPT_STATUS_OPTIONS: { value: UniversityEssayPromptStatus; label: string }[] = [
  { value: "confirmed_current_year", label: "올해 문항 확인 완료" },
  { value: "unconfirmed_current_year", label: "올해 문항 확인 중" },
  { value: "prior_year_reference", label: "지난 연도 참고용" },
];

/** 대학 상세 화면의 "에세이 문항" 섹션 — 지원연도별 유형별 문항 등록/수정/검토/삭제. */
function EssayPromptsSection({
  universityId,
  setError,
}: {
  universityId: string;
  setError: (msg: string | null) => void;
}) {
  const [items, setItems] = useState<UniversityEssayPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [cycleYear, setCycleYear] = useState(String(CURRENT_CYCLE_YEAR));
  const [promptType, setPromptType] = useState<UniversityEssayPromptType>("school_specific");
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [topicSummary, setTopicSummary] = useState("");
  const [selectCount, setSelectCount] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [wordLimitMax, setWordLimitMax] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [applicationPaths, setApplicationPaths] = useState("");
  const [promptStatus, setPromptStatus] = useState<UniversityEssayPromptStatus>("unconfirmed_current_year");
  const [notes, setNotes] = useState("");

  function refresh() {
    setLoading(true);
    startTransition(async () => {
      try {
        setItems(await listUniversityEssayPrompts(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "에세이 문항 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function save() {
    if (!cycleYear.trim() || (!promptText.trim() && !topicSummary.trim())) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertUniversityEssayPrompt({
          universityId,
          cycleYear: Number(cycleYear),
          promptType,
          title: title.trim() || null,
          promptText: promptText.trim() || null,
          topicSummary: topicSummary.trim() || null,
          selectCount: selectCount.trim() ? Number(selectCount) : null,
          groupSize: groupSize.trim() ? Number(groupSize) : null,
          isRequired,
          wordLimitMax: wordLimitMax.trim() ? Number(wordLimitMax) : null,
          applicationPaths: applicationPaths.trim()
            ? applicationPaths.split(",").map((s) => s.trim()).filter(Boolean)
            : null,
          promptStatus,
          notes: notes.trim() || null,
        });
        setTitle("");
        setPromptText("");
        setTopicSummary("");
        setSelectCount("");
        setGroupSize("");
        setWordLimitMax("");
        setApplicationPaths("");
        setNotes("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "에세이 문항 저장 중 오류가 발생했습니다.");
      }
    });
  }

  function setStatus(promptId: string, status: UniversityEssayPromptStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await reviewUniversityEssayPrompt({ promptId, promptStatus: status });
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "검토상태 갱신 중 오류가 발생했습니다.");
      }
    });
  }

  function remove(promptId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteUniversityEssayPrompt(promptId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "에세이 문항 삭제 중 오류가 발생했습니다.");
      }
    });
  }

  const typeLabel: Record<UniversityEssayPromptType, string> = {
    common_app: "공통지원서",
    school_specific: "자체 에세이",
    short_answer: "짧은답변",
    program_conditional: "조건부",
  };
  const statusLabel: Record<UniversityEssayPromptStatus, string> = {
    confirmed_current_year: "올해 확인완료",
    unconfirmed_current_year: "올해 확인중",
    prior_year_reference: "작년 참고용",
  };

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">지원요강·에세이 문항</h3>
      {loading && <p className="text-xs text-grey-400">불러오는 중…</p>}
      <table className="mt-2 w-full text-xs text-grey-600">
        <thead>
          <tr className="text-left text-grey-400">
            <th className="pr-2">연도</th>
            <th className="pr-2">유형</th>
            <th className="pr-2">제목/주제</th>
            <th className="pr-2">선택규칙</th>
            <th className="pr-2">확인상태</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={6} className="text-grey-400">
                등록된 에세이 문항이 없습니다.
              </td>
            </tr>
          )}
          {items.map((p) => (
            <tr key={p.id} className="border-t border-grey-100">
              <td className="pr-2 py-1">{p.cycleYear}</td>
              <td className="pr-2 py-1">{typeLabel[p.promptType]}</td>
              <td className="pr-2 py-1 max-w-[220px] truncate" title={p.promptText ?? p.topicSummary ?? undefined}>
                {p.title ?? p.promptText ?? p.topicSummary ?? "-"}
              </td>
              <td className="pr-2 py-1">
                {p.selectCount != null ? `${p.groupSize ?? "?"}개 중 ${p.selectCount}개 선택` : p.isRequired ? "필수" : "선택"}
              </td>
              <td className="pr-2 py-1">
                <select
                  value={p.promptStatus}
                  onChange={(e) => setStatus(p.id, e.target.value as UniversityEssayPromptStatus)}
                  disabled={isPending}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    p.promptStatus === "confirmed_current_year"
                      ? "bg-green-100 text-green-700"
                      : p.promptStatus === "unconfirmed_current_year"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-grey-100 text-grey-600"
                  }`}
                >
                  {ESSAY_PROMPT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {statusLabel[o.value]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => remove(p.id)}
                  className="rounded border border-grey-300 px-2 py-0.5 text-[11px] text-grey-700 disabled:opacity-50"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          type="number"
          placeholder="연도"
          value={cycleYear}
          onChange={(e) => setCycleYear(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <select value={promptType} onChange={(e) => setPromptType(e.target.value as UniversityEssayPromptType)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {ESSAY_PROMPT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="제목(라벨)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="number"
          placeholder="글자수(단어) 상한"
          value={wordLimitMax}
          onChange={(e) => setWordLimitMax(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <textarea
          placeholder="문항 원문(확보된 경우)"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4"
          rows={2}
        />
        <textarea
          placeholder="주제 요약(원문 미확보 시)"
          value={topicSummary}
          onChange={(e) => setTopicSummary(e.target.value)}
          className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4"
          rows={2}
        />
        <input
          type="number"
          placeholder="선택 개수(M, 예: 4)"
          value={selectCount}
          onChange={(e) => setSelectCount(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="number"
          placeholder="그룹 전체 문항수(N, 예: 8)"
          value={groupSize}
          onChange={(e) => setGroupSize(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          placeholder="적용 경로(콤마 구분: ED,EA,RD,transfer,international)"
          value={applicationPaths}
          onChange={(e) => setApplicationPaths(e.target.value)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <select
          value={promptStatus}
          onChange={(e) => setPromptStatus(e.target.value as UniversityEssayPromptStatus)}
          className="rounded border border-grey-300 px-2 py-1 text-sm"
        >
          {ESSAY_PROMPT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-grey-600">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
          필수 문항(선택그룹 아님)
        </label>
        <input
          type="text"
          placeholder="비고(출처/메모)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4"
        />
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={save}
        className="mt-2 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        에세이 문항 저장
      </button>
    </div>
  );
}

/** 대학 상세 화면의 "출처 URL" 섹션 — 목록 조회, 직접 등록(즉시 승인), 제안 승인/반려. */
function SourceUrlsSection({
  universityId,
  setError,
}: {
  universityId: string;
  setError: (msg: string | null) => void;
}) {
  const [items, setItems] = useState<UniversitySourceUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<SourceUrlType>("admissions_homepage");
  const [newCycleYear, setNewCycleYear] = useState("");
  const [newIsOfficial, setNewIsOfficial] = useState(true);

  function refresh() {
    setLoading(true);
    startTransition(async () => {
      try {
        setItems(await listUniversitySourceUrls(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "출처 URL 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function addUrl() {
    if (!newUrl.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addUniversitySourceUrl({
          universityId,
          url: newUrl.trim(),
          sourceType: newType,
          cycleYear: newCycleYear ? Number(newCycleYear) : null,
          isOfficial: newIsOfficial,
        });
        setNewUrl("");
        setNewCycleYear("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "출처 URL 등록 중 오류가 발생했습니다.");
      }
    });
  }

  function review(sourceUrlId: string, approve: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await reviewUniversitySourceUrl({ sourceUrlId, approve });
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "검토 처리 중 오류가 발생했습니다.");
      }
    });
  }

  const statusLabel: Record<UniversitySourceUrl["status"], string> = {
    pending: "검토 대기",
    approved: "승인됨",
    rejected: "반려됨",
  };

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">출처 URL</h3>
      {loading && <p className="text-xs text-grey-400">불러오는 중…</p>}
      <ul className="mt-2 space-y-1 text-xs text-grey-600">
        {!loading && items.length === 0 && <li className="text-grey-400">등록된 출처 URL이 없습니다.</li>}
        {items.map((s) => (
          <li key={s.id} className="rounded border border-grey-100 p-2">
            <div className="flex items-center justify-between gap-2">
              <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-blue-600 underline">
                {s.url}
              </a>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                  s.status === "approved"
                    ? "bg-green-100 text-green-700"
                    : s.status === "rejected"
                      ? "bg-red-100 text-red"
                      : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {statusLabel[s.status]}
              </span>
            </div>
            <p className="mt-1 text-grey-500">
              {SOURCE_TYPE_OPTIONS.find((o) => o.value === s.sourceType)?.label ?? s.sourceType}
              {s.cycleYear ? ` · ${s.cycleYear}` : ""} · {s.isOfficial ? "공식" : "비공식/참고"}
            </p>
            {s.status === "pending" && (
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => review(s.id, true)}
                  className="rounded bg-ink px-2 py-1 text-[11px] text-white disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => review(s.id, false)}
                  className="rounded border border-grey-300 px-2 py-1 text-[11px] text-grey-700 disabled:opacity-50"
                >
                  반려
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-2">
        <input
          type="text"
          placeholder="https://... (공식 출처 URL)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as SourceUrlType)}
            className="flex-1 rounded border border-grey-300 px-2 py-1 text-sm"
          >
            {SOURCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="연도"
            value={newCycleYear}
            onChange={(e) => setNewCycleYear(e.target.value)}
            className="w-24 rounded border border-grey-300 px-2 py-1 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-grey-600">
          <input type="checkbox" checked={newIsOfficial} onChange={(e) => setNewIsOfficial(e.target.checked)} />
          공식 출처
        </label>
        <button
          type="button"
          disabled={isPending}
          onClick={addUrl}
          className="rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          출처 URL 등록(즉시 승인)
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Part 11(2026-09-23) — Overview/Cost & Aid 확장 관리자 편집. 세 섹션 다 같은 패턴:
// 목록 + 최소 입력폼 + 검증상태(공식/참고/미검증 — 미검증은 학생 화면에 안 보임).
// =============================================================================

const VERIFICATION_OPTIONS: { value: VerificationStatus; label: string }[] = [
  { value: "official", label: "공식(1차 출처)" },
  { value: "secondary", label: "참고(2차 자료)" },
  { value: "unverified", label: "미검증(학생 화면 비노출)" },
];
const VALUE_STATUS_OPTIONS: { value: ValueStatus; label: string }[] = [
  { value: "reported", label: "실제 값 있음" },
  { value: "not_applicable", label: "해당 없음" },
  { value: "not_disclosed_by_school", label: "학교가 공개하지 않음" },
];

function AffiliationsSection({ universityId, setError }: { universityId: string; setError: (msg: string | null) => void }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listUniversityAffiliations>>>([]);
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<AffiliationKind>("ncaa_sport");
  const [label, setLabel] = useState("");
  const [division, setDivision] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [notes, setNotes] = useState("");

  function refresh() {
    startTransition(async () => {
      try {
        setItems(await listUniversityAffiliations(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "소속·태그 조회 중 오류가 발생했습니다.");
      }
    });
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function save() {
    if (!label.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertUniversityAffiliation({ universityId, kind, label: label.trim(), division: division.trim() || null, verificationStatus, notes: notes.trim() || null });
        setLabel("");
        setDivision("");
        setNotes("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteUniversityAffiliation(id);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">소속·태그(Ivy League, NCAA 종목 등)</h3>
      <p className="text-xs text-grey-400">확인되지 않은 홍보성 태그를 만들지 않도록, 항목마다 검증상태를 명시한다.</p>
      <ul className="mt-2 space-y-1 text-xs">
        {items.length === 0 && <li className="text-grey-400">등록된 항목이 없습니다.</li>}
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between border-t border-grey-100 py-1">
            <span>
              [{a.kind}] {a.label}
              {a.division ? ` (${a.division})` : ""}
              <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${a.verificationStatus === "official" ? "bg-green-100 text-green-700" : a.verificationStatus === "secondary" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red"}`}>
                {VERIFICATION_OPTIONS.find((o) => o.value === a.verificationStatus)?.label}
              </span>
            </span>
            <button type="button" disabled={isPending} onClick={() => remove(a.id)} className="rounded border border-grey-300 px-2 py-0.5 text-[11px] text-grey-700 disabled:opacity-50">삭제</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={kind} onChange={(e) => setKind(e.target.value as AffiliationKind)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          <option value="ncaa_sport">NCAA 종목</option>
          <option value="athletic_conference">체육 컨퍼런스</option>
          <option value="ivy_league">Ivy League</option>
          <option value="consortium">컨소시엄</option>
          <option value="other">기타</option>
        </select>
        <input type="text" placeholder="라벨(예: Basketball)" value={label} onChange={(e) => setLabel(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <input type="text" placeholder="Division(선택)" value={division} onChange={(e) => setDivision(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {VERIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" placeholder="비고/출처" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4" />
      </div>
      <button type="button" disabled={isPending} onClick={save} className="mt-2 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50">저장</button>
    </div>
  );
}

const DEMOGRAPHIC_CATEGORY_OPTIONS: { value: DemographicCategory; label: string }[] = [
  { value: "gender_male", label: "성별: 남" },
  { value: "gender_female", label: "성별: 여" },
  { value: "gender_other", label: "성별: 기타" },
  { value: "race_white", label: "인종: White" },
  { value: "race_black", label: "인종: Black" },
  { value: "race_hispanic", label: "인종: Hispanic" },
  { value: "race_asian_pacific_islander", label: "인종: Asian/Pacific Islander" },
  { value: "race_native_american", label: "인종: Native American" },
  { value: "race_two_or_more", label: "인종: 둘 이상" },
  { value: "race_unknown", label: "인종: 미상" },
  { value: "race_international", label: "인종: 국제학생" },
];

function DemographicsSection({ universityId, setError }: { universityId: string; setError: (msg: string | null) => void }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listUniversityDemographics>>>([]);
  const [isPending, startTransition] = useTransition();
  const [cycleYear, setCycleYear] = useState(String(CURRENT_CYCLE_YEAR));
  const [category, setCategory] = useState<DemographicCategory>("gender_male");
  const [populationScope, setPopulationScope] = useState<PopulationScope>("all_students");
  const [pct, setPct] = useState("");
  const [valueStatus, setValueStatus] = useState<ValueStatus>("reported");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [notes, setNotes] = useState("");

  function refresh() {
    startTransition(async () => {
      try {
        setItems(await listUniversityDemographics(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "재학생 구성 조회 중 오류가 발생했습니다.");
      }
    });
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function save() {
    if (!cycleYear.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertUniversityDemographic({
          universityId, cycleYear: Number(cycleYear), category, populationScope,
          pct: valueStatus === "reported" && pct.trim() ? Number(pct) : null,
          valueStatus, verificationStatus, notes: notes.trim() || null,
        });
        setPct("");
        setNotes("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteUniversityDemographic(id);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">재학생 구성(성별·인종/민족)</h3>
      <p className="text-xs text-grey-400">입시 코호트(지원자/합격자/등록자)와 다른 개념 — 현재 재학 중인 학생 집단 구성. 집계 대상(전체/미국 내 학생)을 반드시 구분한다.</p>
      <table className="mt-2 w-full text-xs text-grey-600">
        <thead><tr className="text-left text-grey-400"><th className="pr-2">연도</th><th className="pr-2">분류</th><th className="pr-2">대상</th><th className="pr-2">값</th><th className="pr-2">검증</th><th /></tr></thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={6} className="text-grey-400">등록된 항목이 없습니다.</td></tr>}
          {items.map((d) => (
            <tr key={d.id} className="border-t border-grey-100">
              <td className="py-1 pr-2">{d.cycleYear}</td>
              <td className="py-1 pr-2">{DEMOGRAPHIC_CATEGORY_OPTIONS.find((o) => o.value === d.category)?.label}</td>
              <td className="py-1 pr-2">{d.populationScope === "us_students_only" ? "미국 내 학생" : "전체 학생"}</td>
              <td className="py-1 pr-2">{d.valueStatus === "reported" ? `${d.pct ?? "-"}%` : VALUE_STATUS_OPTIONS.find((o) => o.value === d.valueStatus)?.label}</td>
              <td className="py-1 pr-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${d.verificationStatus === "official" ? "bg-green-100 text-green-700" : d.verificationStatus === "secondary" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red"}`}>
                  {VERIFICATION_OPTIONS.find((o) => o.value === d.verificationStatus)?.label}
                </span>
              </td>
              <td className="py-1"><button type="button" disabled={isPending} onClick={() => remove(d.id)} className="rounded border border-grey-300 px-2 py-0.5 text-[11px] text-grey-700 disabled:opacity-50">삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="number" placeholder="연도" value={cycleYear} onChange={(e) => setCycleYear(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value as DemographicCategory)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {DEMOGRAPHIC_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={populationScope} onChange={(e) => setPopulationScope(e.target.value as PopulationScope)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          <option value="all_students">전체 학생 대상</option>
          <option value="us_students_only">미국 내 학생만 대상</option>
        </select>
        <select value={valueStatus} onChange={(e) => setValueStatus(e.target.value as ValueStatus)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {VALUE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {valueStatus === "reported" && (
          <input type="number" placeholder="비율(%)" value={pct} onChange={(e) => setPct(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        )}
        <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {VERIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" placeholder="비고/출처(원문 분류 등)" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4" />
      </div>
      <button type="button" disabled={isPending} onClick={save} className="mt-2 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50">저장</button>
    </div>
  );
}

const FINANCIAL_AID_PROGRAM_TYPE_OPTIONS: { value: FinancialAidProgramType; label: string }[] = [
  { value: "need_based_grant", label: "재정필요 기반 보조금(Grant)" },
  { value: "merit_scholarship", label: "성적 기반 장학금" },
  { value: "federal_loan", label: "연방 학자금 대출" },
  { value: "work_study", label: "근로장학(Work-Study)" },
];
const ELIGIBILITY_SCOPE_OPTIONS: { value: EligibilityScope; label: string }[] = [
  { value: "us_citizen_permanent_resident", label: "미국 시민·영주권자만" },
  { value: "all_students", label: "국제학생 포함 전원" },
  { value: "other", label: "기타(비고에 명시)" },
];

function FinancialAidProgramsSection({ universityId, setError }: { universityId: string; setError: (msg: string | null) => void }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listUniversityFinancialAidPrograms>>>([]);
  const [isPending, startTransition] = useTransition();
  const [programType, setProgramType] = useState<FinancialAidProgramType>("need_based_grant");
  const [name, setName] = useState("");
  const [eligibilityScope, setEligibilityScope] = useState<EligibilityScope>("other");
  const [recipientPct, setRecipientPct] = useState("");
  const [avgAwardAmount, setAvgAwardAmount] = useState("");
  const [renewalCondition, setRenewalCondition] = useState("");
  const [valueStatus, setValueStatus] = useState<ValueStatus>("reported");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [notes, setNotes] = useState("");

  function refresh() {
    startTransition(async () => {
      try {
        setItems(await listUniversityFinancialAidPrograms(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "재정지원 프로그램 조회 중 오류가 발생했습니다.");
      }
    });
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function save() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertUniversityFinancialAidProgram({
          universityId, programType, name: name.trim(), eligibilityScope,
          recipientPct: recipientPct.trim() ? Number(recipientPct) : null,
          avgAwardAmount: avgAwardAmount.trim() ? Number(avgAwardAmount) : null,
          renewalCondition: renewalCondition.trim() || null,
          valueStatus, verificationStatus, notes: notes.trim() || null,
        });
        setName("");
        setRecipientPct("");
        setAvgAwardAmount("");
        setRenewalCondition("");
        setNotes("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteUniversityFinancialAidProgram(id);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">재정지원 프로그램(장학금·대출·근로장학)</h3>
      <p className="text-xs text-grey-400">연방 대출·근로장학은 보통 미국 시민·영주권자만 대상이다 — eligibility_scope를 정확히 채워 국제학생에게 잘못 노출되지 않게 한다.</p>
      <ul className="mt-2 space-y-1 text-xs">
        {items.length === 0 && <li className="text-grey-400">등록된 프로그램이 없습니다.</li>}
        {items.map((f) => (
          <li key={f.id} className="flex items-center justify-between border-t border-grey-100 py-1">
            <span>
              [{FINANCIAL_AID_PROGRAM_TYPE_OPTIONS.find((o) => o.value === f.programType)?.label}] {f.name}
              {" · "}{ELIGIBILITY_SCOPE_OPTIONS.find((o) => o.value === f.eligibilityScope)?.label}
              {f.recipientPct != null ? ` · 수혜율 ${f.recipientPct}%` : ""}
              <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${f.verificationStatus === "official" ? "bg-green-100 text-green-700" : f.verificationStatus === "secondary" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red"}`}>
                {VERIFICATION_OPTIONS.find((o) => o.value === f.verificationStatus)?.label}
              </span>
            </span>
            <button type="button" disabled={isPending} onClick={() => remove(f.id)} className="rounded border border-grey-300 px-2 py-0.5 text-[11px] text-grey-700 disabled:opacity-50">삭제</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={programType} onChange={(e) => setProgramType(e.target.value as FinancialAidProgramType)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {FINANCIAL_AID_PROGRAM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" placeholder="프로그램명" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <select value={eligibilityScope} onChange={(e) => setEligibilityScope(e.target.value as EligibilityScope)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {ELIGIBILITY_SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={valueStatus} onChange={(e) => setValueStatus(e.target.value as ValueStatus)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {VALUE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" placeholder="수혜율(%)" value={recipientPct} onChange={(e) => setRecipientPct(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <input type="number" placeholder="평균 지급액($)" value={avgAwardAmount} onChange={(e) => setAvgAwardAmount(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <input type="text" placeholder="갱신조건" value={renewalCondition} onChange={(e) => setRenewalCondition(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)} className="rounded border border-grey-300 px-2 py-1 text-sm">
          {VERIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" placeholder="비고/출처" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4" />
      </div>
      <button type="button" disabled={isPending} onClick={save} className="mt-2 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50">저장</button>
    </div>
  );
}

function MajorsAdminSection({ universityId, setError }: { universityId: string; setError: (msg: string | null) => void }) {
  const [items, setItems] = useState<UniversityMajor[]>([]);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("");
  const [isTrack, setIsTrack] = useState(false);
  const [parentMajorId, setParentMajorId] = useState("");

  function refresh() {
    startTransition(async () => {
      try {
        const d = await getUniversityDetail(universityId);
        setItems(d.majors);
      } catch (e) {
        setError(e instanceof Error ? e.message : "전공 조회 중 오류가 발생했습니다.");
      }
    });
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function save() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertUniversityMajor({
          universityId, name: name.trim(), category: category.trim() || null,
          degreeLevel: degreeLevel.trim() || null, isTrack, parentMajorId: isTrack && parentMajorId ? parentMajorId : null,
        });
        setName("");
        setDegreeLevel("");
        setIsTrack(false);
        setParentMajorId("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteUniversityMajor(id);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
      }
    });
  }

  const parentCandidates = items.filter((m) => !m.isTrack);

  return (
    <div className="mt-6 border-t border-grey-200 pt-4">
      <h3 className="text-sm font-semibold text-ink">전공 목록(학위·트랙 구분)</h3>
      <p className="text-xs text-grey-400">전공 수 집계는 트랙(is_track=true)을 제외한다 — 트랙까지 합쳐 전공 수를 부풀리지 않는다.</p>
      <p className="mt-1 text-xs text-grey-500">총 {items.length}건 · 독립 전공 {items.filter((m) => !m.isTrack).length}건 · 트랙 {items.filter((m) => m.isTrack).length}건</p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
        {items.length === 0 && <li className="text-grey-400">등록된 전공이 없습니다.</li>}
        {items.map((m) => (
          <li key={m.id} className="flex items-center justify-between border-t border-grey-100 py-1">
            <span>
              {m.isTrack ? "↳ " : ""}{m.name}
              {m.degreeLevel ? ` (${m.degreeLevel})` : ""}
              {m.category ? ` · ${m.category}` : ""}
            </span>
            <button type="button" disabled={isPending} onClick={() => remove(m.id)} className="rounded border border-grey-300 px-2 py-0.5 text-[11px] text-grey-700 disabled:opacity-50">삭제</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="text" placeholder="전공명" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <input type="text" placeholder="분야(카테고리)" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <input type="text" placeholder="학위(예: BA, BS)" value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)} className="rounded border border-grey-300 px-2 py-1 text-sm" />
        <label className="flex items-center gap-2 text-xs text-grey-600">
          <input type="checkbox" checked={isTrack} onChange={(e) => setIsTrack(e.target.checked)} />
          트랙(상위 전공의 세부)
        </label>
        {isTrack && (
          <select value={parentMajorId} onChange={(e) => setParentMajorId(e.target.value)} className="col-span-2 rounded border border-grey-300 px-2 py-1 text-sm sm:col-span-4">
            <option value="">상위 전공 선택</option>
            {parentCandidates.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>
      <button type="button" disabled={isPending} onClick={save} className="mt-2 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50">저장</button>
    </div>
  );
}
