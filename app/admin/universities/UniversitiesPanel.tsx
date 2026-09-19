"use client";

import { useState, useTransition } from "react";
import {
  addUniversityUpdate,
  getUniversityDetail,
  listUniversities,
  updateUniversityBasics,
  upsertAdmissionCycle,
  type AdmissionCycle,
  type UniversityDetail,
  type UniversitySummary,
  type UniversityUpdateEntry,
} from "@/lib/universities/actions";

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
    </div>
  );
}
