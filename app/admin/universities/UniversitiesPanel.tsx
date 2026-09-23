"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addUniversitySourceUrl,
  addUniversityUpdate,
  deleteAdmissionMetric,
  deleteUniversityEssayPrompt,
  getUniversityDetail,
  listAdmissionMetrics,
  listUniversityEssayPrompts,
  listUniversities,
  listUniversityDataReports,
  listUniversitySourceUrls,
  resolveUniversityDataReport,
  reviewUniversityEssayPrompt,
  reviewUniversitySourceUrl,
  updateUniversityBasics,
  upsertAdmissionCycle,
  upsertAdmissionMetric,
  upsertUniversityEssayPrompt,
  type AdmissionCycle,
  type AdmissionMetric,
  type AdmissionMetricCohort,
  type AdmissionMetricKey,
  type AdmissionMetricVerificationStatus,
  type UniversityEssayPrompt,
  type UniversityEssayPromptStatus,
  type UniversityEssayPromptType,
  type SourceUrlType,
  type UniversityDataReport,
  type UniversityDetail,
  type UniversitySourceUrl,
  type UniversitySummary,
  type UniversityUpdateEntry,
} from "@/lib/universities/actions";

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
                <span>
                  <span className="mr-2 text-grey-400">#{u.rankFinal ?? "-"}</span>
                  {u.name}
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
      <h2 className="text-lg font-semibold text-ink">{detail.name}</h2>
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
      <ReportsInboxSection universityId={detail.id} setError={setError} />
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
