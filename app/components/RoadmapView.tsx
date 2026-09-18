"use client";

import { useState, useTransition } from "react";
import PillSubTabs from "./PillSubTabs";
import CollegeExploreSection from "./CollegeExploreSection";
import type {
  RoadmapData,
  PrepItemType,
  PrepStatus,
  MilestoneStatus,
  TestType,
  TestRecordKind,
  ActivityTier,
  FinancialAidIntent,
  FirstGeneration,
  RecruitedAthlete,
  ResidencyStatus,
} from "@/lib/roadmap/types";
import { PREP_ITEM_LABELS, PREP_STATUS_LABELS, MILESTONE_STATUS_LABELS, ACTIVITY_TIER_LABELS } from "@/lib/roadmap/types";
import * as roadmapActions from "@/lib/roadmap/actions";

const inputClass = "px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] w-full";
const labelClass = "text-[11px] font-bold text-grey-500 mb-1 block";
const cardClass = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4";
const cardTitleClass = "text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2";
const smallBtn = "text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-40";
const dangerBtn = "text-[11px] font-bold text-red px-2 py-1";

function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 학생/학부모(쓰기)·교사(읽기전용)·관리자(쓰기) 4개 진입점이 공유하는 화면.
// readOnly=true면 모든 입력·버튼을 숨기고 값만 보여준다(교사 전용).
export default function RoadmapView({
  data,
  readOnly = false,
}: {
  data: RoadmapData;
  readOnly?: boolean;
}) {
  const [subTab, setSubTab] = useState<"profile" | "roadmap" | "colleges">("profile");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      }
    });
  }

  const nextMilestone = data.milestones
    .filter((m) => m.status !== "done")
    .sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"))[0];

  return (
    <div className="max-w-[720px] px-6 py-6">
      {/* 상단 요약 */}
      <div className={cardClass}>
        <div className={cardTitleClass}>로드맵 요약</div>
        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">프로필 완성도</div>
            <div className="font-bold text-ink">
              {data.completeness.filledSections} / {data.completeness.totalSections} 섹션
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">현재 학년</div>
            <div className="font-bold text-ink">{data.grade ?? "미입력"}</div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">목표 대학/전공</div>
            <div className="font-bold text-ink">
              {[...data.collegeInterests.targetColleges.slice(0, 2), ...data.collegeInterests.intendedMajors.slice(0, 1)]
                .join(" · ") || "미입력"}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">다음 핵심 마일스톤</div>
            <div className="font-bold text-ink">
              {nextMilestone ? `${nextMilestone.title}${nextMilestone.targetDate ? ` (${nextMilestone.targetDate})` : ""}` : "없음"}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-[12px] text-red bg-red/10 rounded-lg px-3 py-2">{error}</div>
      )}

      <PillSubTabs
        items={[
          { id: "profile", label: "프로필" },
          { id: "roadmap", label: "로드맵" },
          { id: "colleges", label: "대학 탐색" },
        ]}
        activeId={subTab}
        onSelect={setSubTab}
        className="mb-4"
      />

      {subTab === "profile" ? (
        <ProfileSections data={data} readOnly={readOnly} pending={pending} run={run} />
      ) : subTab === "roadmap" ? (
        <RoadmapSection data={data} readOnly={readOnly} pending={pending} run={run} />
      ) : (
        <CollegeExploreSection />
      )}
    </div>
  );
}

function ProfileSections({
  data,
  readOnly,
  pending,
  run,
}: {
  data: RoadmapData;
  readOnly: boolean;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [graduationYear, setGraduationYear] = useState(
    data.academicProfile.graduationYear?.toString() ?? ""
  );
  const [curriculumType, setCurriculumType] = useState(data.academicProfile.curriculumType ?? "");
  const [currentSubjects, setCurrentSubjects] = useState(data.academicProfile.currentSubjects.join(", "));

  const [majors, setMajors] = useState(data.collegeInterests.intendedMajors.join(", "));
  const [careers, setCareers] = useState(data.collegeInterests.careerInterests.join(", "));
  const [countries, setCountries] = useState(data.collegeInterests.targetCountries.join(", "));
  const [collegeTypes, setCollegeTypes] = useState(data.collegeInterests.targetCollegeTypes.join(", "));
  const [colleges, setColleges] = useState(data.collegeInterests.targetColleges.join(", "));
  const [applicationTiming, setApplicationTiming] = useState(data.collegeInterests.targetApplicationTiming ?? "");

  const [honorsCount, setHonorsCount] = useState(data.academicProfile.honorsCount?.toString() ?? "");
  const [apCount, setApCount] = useState(data.academicProfile.apCount?.toString() ?? "");
  const [collegeCoursesCount, setCollegeCoursesCount] = useState(data.academicProfile.collegeCoursesCount?.toString() ?? "");
  const [ibHlCount, setIbHlCount] = useState(data.academicProfile.ibHlCount?.toString() ?? "");
  const [ibSlCount, setIbSlCount] = useState(data.academicProfile.ibSlCount?.toString() ?? "");
  const [schoolApIbOfferedCount, setSchoolApIbOfferedCount] = useState(
    data.academicProfile.schoolApIbOfferedCount?.toString() ?? ""
  );

  return (
    <>
      {/* 0. 인구통계(CollegeVine Demographics 탭 동등 항목, 2026-09-19) */}
      <DemographicsCard data={data} readOnly={readOnly} pending={pending} run={run} />

      {/* 1. 기본 학업 정보 */}
      <div className={cardClass}>
        <div className={cardTitleClass}>1. 기본 학업 정보</div>
        <div className="text-[12.5px] text-grey-500 mb-2">
          학년 <span className="font-bold text-ink">{data.grade ?? "미입력"}</span> · 학교{" "}
          <span className="font-bold text-ink">{data.schoolName ?? "미입력"}</span> · GPA{" "}
          <span className="font-bold text-ink">{data.gpa ?? "미입력"}</span>
          <span className="text-grey-300"> (학년/학교/GPA는 계정 설정 화면에서 수정)</span>
        </div>
        {readOnly ? (
          <div className="text-[12.5px] space-y-1">
            <div>졸업 예정 연도: {data.academicProfile.graduationYear ?? "미입력"}</div>
            <div>교육과정: {data.academicProfile.curriculumType ?? "미입력"}</div>
            <div>현재 수강 과목: {data.academicProfile.currentSubjects.join(", ") || "미입력"}</div>
            <div>
              Honors {data.academicProfile.honorsCount ?? "-"} · AP {data.academicProfile.apCount ?? "-"} · 지역대학{" "}
              {data.academicProfile.collegeCoursesCount ?? "-"} · IB HL {data.academicProfile.ibHlCount ?? "-"} · IB SL{" "}
              {data.academicProfile.ibSlCount ?? "-"}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>졸업 예정 연도</label>
              <input
                className={inputClass}
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>교육과정</label>
              <input
                className={inputClass}
                placeholder="예: 국내 일반고/미국계/IB"
                value={curriculumType}
                onChange={(e) => setCurriculumType(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>현재 수강 과목(쉼표로 구분)</label>
              <input className={inputClass} value={currentSubjects} onChange={(e) => setCurrentSubjects(e.target.value)} />
            </div>
            <div className="col-span-2 text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-1">
              수강과목 개수(졸업까지 계획, CollegeVine Coursework 탭 동등 항목)
            </div>
            <div>
              <label className={labelClass}>Honors 과목 수</label>
              <input className={inputClass} type="number" min={0} value={honorsCount} onChange={(e) => setHonorsCount(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>AP 과목 수</label>
              <input className={inputClass} type="number" min={0} value={apCount} onChange={(e) => setApCount(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>지역 대학 수강 과목 수</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={collegeCoursesCount}
                onChange={(e) => setCollegeCoursesCount(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>IB HL 과목 수</label>
              <input className={inputClass} type="number" min={0} value={ibHlCount} onChange={(e) => setIbHlCount(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>IB SL 과목 수</label>
              <input className={inputClass} type="number" min={0} value={ibSlCount} onChange={(e) => setIbSlCount(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>학교가 제공하는 AP/IB 과목 수(선택)</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={schoolApIbOfferedCount}
                onChange={(e) => setSchoolApIbOfferedCount(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <button
                type="button"
                disabled={pending}
                className={smallBtn}
                onClick={() =>
                  run(() =>
                    roadmapActions.saveAcademicProfile({
                      studentId: data.studentId,
                      graduationYear: graduationYear ? Number(graduationYear) : null,
                      curriculumType: curriculumType || null,
                      currentSubjects: parseList(currentSubjects),
                      honorsCount: honorsCount ? Number(honorsCount) : null,
                      apCount: apCount ? Number(apCount) : null,
                      collegeCoursesCount: collegeCoursesCount ? Number(collegeCoursesCount) : null,
                      ibHlCount: ibHlCount ? Number(ibHlCount) : null,
                      ibSlCount: ibSlCount ? Number(ibSlCount) : null,
                      schoolApIbOfferedCount: schoolApIbOfferedCount ? Number(schoolApIbOfferedCount) : null,
                    })
                  )
                }
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. 시험 정보 */}
      <TestRecordsCard data={data} readOnly={readOnly} pending={pending} run={run} />

      {/* 3. 관심 분야와 대학 목표 */}
      <div className={cardClass}>
        <div className={cardTitleClass}>3. 관심 분야와 대학 목표</div>
        {readOnly ? (
          <div className="text-[12.5px] space-y-1">
            <div>관심 전공: {data.collegeInterests.intendedMajors.join(", ") || "미입력"}</div>
            <div>관심 진로: {data.collegeInterests.careerInterests.join(", ") || "미입력"}</div>
            <div>희망 국가: {data.collegeInterests.targetCountries.join(", ") || "미입력"}</div>
            <div>희망 대학 유형: {data.collegeInterests.targetCollegeTypes.join(", ") || "미입력"}</div>
            <div>관심 대학: {data.collegeInterests.targetColleges.join(", ") || "미입력"}</div>
            <div>지원 목표 시기: {data.collegeInterests.targetApplicationTiming ?? "미입력"}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>관심 전공(쉼표 구분)</label>
              <input className={inputClass} value={majors} onChange={(e) => setMajors(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>관심 진로(쉼표 구분)</label>
              <input className={inputClass} value={careers} onChange={(e) => setCareers(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>희망 국가(쉼표 구분)</label>
              <input className={inputClass} value={countries} onChange={(e) => setCountries(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>희망 대학 유형(쉼표 구분)</label>
              <input className={inputClass} value={collegeTypes} onChange={(e) => setCollegeTypes(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>관심 대학 목록(쉼표 구분)</label>
              <input className={inputClass} value={colleges} onChange={(e) => setColleges(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>지원 목표 시기</label>
              <input
                className={inputClass}
                placeholder="예: 2027년 가을(Regular Decision)"
                value={applicationTiming}
                onChange={(e) => setApplicationTiming(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <button
                type="button"
                disabled={pending}
                className={smallBtn}
                onClick={() =>
                  run(() =>
                    roadmapActions.saveCollegeInterests({
                      studentId: data.studentId,
                      intendedMajors: parseList(majors),
                      careerInterests: parseList(careers),
                      targetCountries: parseList(countries),
                      targetCollegeTypes: parseList(collegeTypes),
                      targetColleges: parseList(colleges),
                      targetApplicationTiming: applicationTiming || null,
                    })
                  )
                }
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. 활동과 수상 */}
      <ActivitiesAndAwardsCard data={data} readOnly={readOnly} pending={pending} run={run} />

      {/* 5. 준비 현황 */}
      <PrepStatusCard data={data} readOnly={readOnly} pending={pending} run={run} />
    </>
  );
}

const SPECIAL_SCHOOL_OPTIONS = ["HBCU", "여대", "군사학교", "인문대(Liberal Arts)", "본국 내 학교만", "기타"];

function DemographicsCard({
  data,
  readOnly,
  pending,
  run,
}: {
  data: RoadmapData;
  readOnly: boolean;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const d = data.demographics;
  const [homeCountry, setHomeCountry] = useState(d.homeCountry ?? "");
  const [zipCode, setZipCode] = useState(d.zipCode ?? "");
  const [residencyStatus, setResidencyStatus] = useState<ResidencyStatus | "">(d.residencyStatus ?? "");
  const [gender, setGender] = useState(d.gender ?? "");
  const [raceEthnicity, setRaceEthnicity] = useState(d.raceEthnicity ?? "");
  const [financialAidIntent, setFinancialAidIntent] = useState<FinancialAidIntent | "">(d.financialAidIntent ?? "");
  const [maxAnnualBudget, setMaxAnnualBudget] = useState(d.maxAnnualBudget?.toString() ?? "");
  const [householdIncomeRange, setHouseholdIncomeRange] = useState(d.householdIncomeRange ?? "");
  const [firstGeneration, setFirstGeneration] = useState<FirstGeneration | "">(d.firstGeneration ?? "");
  const [legacySchools, setLegacySchools] = useState(d.legacySchools.join(", "));
  const [religiousAffiliation, setReligiousAffiliation] = useState(d.religiousAffiliation ?? "");
  const [recruitedAthlete, setRecruitedAthlete] = useState<RecruitedAthlete | "">(d.recruitedAthlete ?? "");
  const [specialSchoolInterests, setSpecialSchoolInterests] = useState<string[]>(d.specialSchoolInterests);

  function toggleSpecialSchool(opt: string) {
    setSpecialSchoolInterests((cur) => (cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt]));
  }

  if (readOnly) {
    // 교사는 RLS 자체가 이 데이터를 안 돌려준다(민감정보) — 화면에서도 섹션을 아예 숨긴다.
    return null;
  }

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>0. 인구통계(선택 입력)</div>
      <p className="text-[11.5px] text-grey-500 mb-2">
        전부 선택 입력이며, 선생님에게는 보이지 않습니다(학생·보호자·관리자만 조회).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>거주 국가</label>
          <input className={inputClass} value={homeCountry} onChange={(e) => setHomeCountry(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>우편번호</label>
          <input className={inputClass} value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>거주 자격</label>
          <select className={inputClass} value={residencyStatus} onChange={(e) => setResidencyStatus(e.target.value as ResidencyStatus | "")}>
            <option value="">선택 안 함</option>
            <option value="us_resident">미국 거주자격 있음</option>
            <option value="international">국제학생으로 지원</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>성별</label>
          <input className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>인종·민족</label>
          <input className={inputClass} value={raceEthnicity} onChange={(e) => setRaceEthnicity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>재정지원 신청 계획</label>
          <select
            className={inputClass}
            value={financialAidIntent}
            onChange={(e) => setFinancialAidIntent(e.target.value as FinancialAidIntent | "")}
          >
            <option value="">선택 안 함</option>
            <option value="planning">신청 예정</option>
            <option value="not_planning">신청 안 함</option>
            <option value="not_sure">아직 모름</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>연간 최대 지불 가능액(USD)</label>
          <input className={inputClass} type="number" min={0} value={maxAnnualBudget} onChange={(e) => setMaxAnnualBudget(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>가구 소득 구간</label>
          <input
            className={inputClass}
            placeholder="예: $60,001–$100,000"
            value={householdIncomeRange}
            onChange={(e) => setHouseholdIncomeRange(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>1세대 대학생 여부</label>
          <select className={inputClass} value={firstGeneration} onChange={(e) => setFirstGeneration(e.target.value as FirstGeneration | "")}>
            <option value="">선택 안 함</option>
            <option value="yes">예</option>
            <option value="no">아니오</option>
            <option value="prefer_not_to_say">밝히지 않음</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>운동부 리크루트 여부</label>
          <select className={inputClass} value={recruitedAthlete} onChange={(e) => setRecruitedAthlete(e.target.value as RecruitedAthlete | "")}>
            <option value="">선택 안 함</option>
            <option value="yes">예</option>
            <option value="maybe">고려 중</option>
            <option value="no">아니오</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>부모님 출신 대학(Legacy, 쉼표 구분)</label>
          <input className={inputClass} value={legacySchools} onChange={(e) => setLegacySchools(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>종교</label>
          <input className={inputClass} value={religiousAffiliation} onChange={(e) => setReligiousAffiliation(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>관심 있는 특수 학교 유형</label>
          <div className="flex flex-wrap gap-1.5">
            {SPECIAL_SCHOOL_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleSpecialSchool(opt)}
                className={
                  "text-[11.5px] font-bold px-2.5 py-1 rounded-full border-[1.5px] " +
                  (specialSchoolInterests.includes(opt) ? "bg-ink text-white border-ink" : "bg-white text-grey-500 border-grey-200")
                }
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <button
            type="button"
            disabled={pending}
            className={smallBtn}
            onClick={() =>
              run(() =>
                roadmapActions.saveDemographics({
                  studentId: data.studentId,
                  homeCountry: homeCountry || null,
                  zipCode: zipCode || null,
                  residencyStatus: residencyStatus || null,
                  gender: gender || null,
                  raceEthnicity: raceEthnicity || null,
                  financialAidIntent: financialAidIntent || null,
                  maxAnnualBudget: maxAnnualBudget ? Number(maxAnnualBudget) : null,
                  householdIncomeRange: householdIncomeRange || null,
                  firstGeneration: firstGeneration || null,
                  legacySchools: parseList(legacySchools),
                  religiousAffiliation: religiousAffiliation || null,
                  recruitedAthlete: recruitedAthlete || null,
                  specialSchoolInterests,
                })
              )
            }
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function TestRecordsCard({
  data,
  readOnly,
  pending,
  run,
}: {
  data: RoadmapData;
  readOnly: boolean;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [testType, setTestType] = useState<TestType>("SAT");
  const [recordKind, setRecordKind] = useState<TestRecordKind>("actual");
  const [testDate, setTestDate] = useState("");
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [scoreMath, setScoreMath] = useState("");
  const [scoreReadingWriting, setScoreReadingWriting] = useState("");
  const [scoreEnglish, setScoreEnglish] = useState("");
  const [scoreScience, setScoreScience] = useState("");

  const kindLabel: Record<TestRecordKind, string> = {
    actual: "응시 이력",
    target: "목표 점수",
    planned: "다음 응시 계획",
  };

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>2. 시험 정보</div>
      <div className="space-y-2 mb-3">
        {data.testRecords.length === 0 && <div className="text-[12.5px] text-grey-300">등록된 시험 정보가 없습니다.</div>}
        {data.testRecords.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 pb-1.5">
            <div>
              <span className="font-bold text-ink">{r.testType}</span> · {kindLabel[r.recordKind]}
              {r.testDate && <span className="text-grey-500"> · {r.testDate}</span>}
              {r.score !== null && <span className="text-grey-500"> · 합계 {r.score}점</span>}
              {(r.scoreMath !== null || r.scoreReadingWriting !== null || r.scoreEnglish !== null || r.scoreScience !== null) && (
                <span className="text-grey-300">
                  {" "}
                  (Math {r.scoreMath ?? "-"}
                  {r.testType === "ACT" ? `, Reading ${r.scoreReadingWriting ?? "-"}, English ${r.scoreEnglish ?? "-"}, Science ${r.scoreScience ?? "-"}` : `, RW ${r.scoreReadingWriting ?? "-"}`}
                  )
                </span>
              )}
              {r.notes && <span className="text-grey-300"> ({r.notes})</span>}
            </div>
            {!readOnly && (
              <button
                type="button"
                className={dangerBtn}
                disabled={pending}
                onClick={() => run(() => roadmapActions.removeTestRecord(data.studentId, r.id))}
              >
                삭제
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="grid grid-cols-2 gap-2">
          <select className={inputClass} value={testType} onChange={(e) => setTestType(e.target.value as TestType)}>
            <option value="SAT">SAT</option>
            <option value="ACT">ACT</option>
            <option value="PSAT">PSAT</option>
          </select>
          <select
            className={inputClass}
            value={recordKind}
            onChange={(e) => setRecordKind(e.target.value as TestRecordKind)}
          >
            <option value="actual">응시 이력</option>
            <option value="target">목표 점수</option>
            <option value="planned">다음 응시 계획</option>
          </select>
          <input className={inputClass} type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          <input
            className={inputClass}
            type="number"
            placeholder="합계 점수(선택)"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <div className="col-span-2 text-[11px] font-bold text-grey-300 uppercase tracking-wide">
            섹션별 점수(선택, CollegeVine Test scores 탭 동등 항목)
          </div>
          <input
            className={inputClass}
            type="number"
            placeholder="Math"
            value={scoreMath}
            onChange={(e) => setScoreMath(e.target.value)}
          />
          <input
            className={inputClass}
            type="number"
            placeholder={testType === "ACT" ? "Reading" : "Reading and Writing"}
            value={scoreReadingWriting}
            onChange={(e) => setScoreReadingWriting(e.target.value)}
          />
          {testType === "ACT" && (
            <>
              <input
                className={inputClass}
                type="number"
                placeholder="English"
                value={scoreEnglish}
                onChange={(e) => setScoreEnglish(e.target.value)}
              />
              <input
                className={inputClass}
                type="number"
                placeholder="Science"
                value={scoreScience}
                onChange={(e) => setScoreScience(e.target.value)}
              />
            </>
          )}
          <input
            className={inputClass + " col-span-2"}
            placeholder="메모(선택)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="col-span-2">
            <button
              type="button"
              className={smallBtn}
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await roadmapActions.addTestRecord({
                    studentId: data.studentId,
                    testType,
                    recordKind,
                    testDate: testDate || null,
                    score: score ? Number(score) : null,
                    notes: notes || null,
                    scoreMath: scoreMath ? Number(scoreMath) : null,
                    scoreReadingWriting: scoreReadingWriting ? Number(scoreReadingWriting) : null,
                    scoreEnglish: scoreEnglish ? Number(scoreEnglish) : null,
                    scoreScience: scoreScience ? Number(scoreScience) : null,
                  });
                  setTestDate("");
                  setScore("");
                  setNotes("");
                  setScoreMath("");
                  setScoreReadingWriting("");
                  setScoreEnglish("");
                  setScoreScience("");
                })
              }
            >
              추가
            </button>
          </div>
        </div>
      )}

      <ApExamsSection data={data} readOnly={readOnly} pending={pending} run={run} />
    </div>
  );
}

function ApExamsSection({
  data,
  readOnly,
  pending,
  run,
}: {
  data: RoadmapData;
  readOnly: boolean;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [courseName, setCourseName] = useState("");
  const [examYear, setExamYear] = useState("");
  const [apScore, setApScore] = useState("");

  return (
    <div className="mt-4 pt-3 border-t border-grey-100">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
        AP 시험(CollegeVine AP Exams 동등 항목, 선택)
      </div>
      {data.apExams.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">등록된 AP 시험이 없습니다.</div>}
      {data.apExams.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 py-1.5">
          <div>
            <span className="font-bold text-ink">{a.courseName}</span>
            {a.examYear && <span className="text-grey-500"> · {a.examYear}</span>}
            {a.score !== null && <span className="text-grey-500"> · {a.score}점</span>}
          </div>
          {!readOnly && (
            <button
              type="button"
              className={dangerBtn}
              disabled={pending}
              onClick={() => run(() => roadmapActions.removeApExam(data.studentId, a.id))}
            >
              삭제
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <input
            className={inputClass}
            placeholder="과목명(예: AP Physics C)"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
          />
          <input className={inputClass} type="number" placeholder="연도" value={examYear} onChange={(e) => setExamYear(e.target.value)} />
          <input className={inputClass} type="number" min={1} max={5} placeholder="점수(1-5)" value={apScore} onChange={(e) => setApScore(e.target.value)} />
          <div className="col-span-3">
            <button
              type="button"
              className={smallBtn}
              disabled={pending || !courseName.trim()}
              onClick={() =>
                run(async () => {
                  await roadmapActions.addApExam({
                    studentId: data.studentId,
                    courseName,
                    status: "completed",
                    examYear: examYear ? Number(examYear) : null,
                    score: apScore ? Number(apScore) : null,
                  });
                  setCourseName("");
                  setExamYear("");
                  setApScore("");
                })
              }
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivitiesAndAwardsCard({
  data,
  readOnly,
  pending,
  run,
}: {
  data: RoadmapData;
  readOnly: boolean;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [activityName, setActivityName] = useState("");
  const [field, setField] = useState("");
  const [role, setRole] = useState("");
  const [tier, setTier] = useState<ActivityTier | "">("");

  const [awardName, setAwardName] = useState("");
  const [awardLevel, setAwardLevel] = useState("");

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>4. 활동과 수상</div>
      <div className="text-[11px] font-bold text-grey-300 mt-2 mb-1">활동</div>
      {data.activities.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">등록된 활동이 없습니다.</div>}
      {data.activities.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 py-1.5">
          <div>
            <span className="font-bold text-ink">{a.activityName}</span>
            {a.field && <span className="text-grey-500"> · {a.field}</span>}
            {a.role && <span className="text-grey-500"> · {a.role}</span>}
            {a.tier && <span className="text-grey-500"> · {ACTIVITY_TIER_LABELS[a.tier]}</span>}
            {a.leadershipSummary && <div className="text-grey-300 text-[11.5px]">리더십: {a.leadershipSummary}</div>}
            {a.achievementSummary && <div className="text-grey-300 text-[11.5px]">성과: {a.achievementSummary}</div>}
          </div>
          {!readOnly && (
            <button
              type="button"
              className={dangerBtn}
              disabled={pending}
              onClick={() => run(() => roadmapActions.removeActivity(data.studentId, a.id))}
            >
              삭제
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <input
            className={inputClass}
            placeholder="활동명"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
          />
          <input className={inputClass} placeholder="분야" value={field} onChange={(e) => setField(e.target.value)} />
          <input className={inputClass} placeholder="역할" value={role} onChange={(e) => setRole(e.target.value)} />
          <select className={inputClass + " col-span-3"} value={tier} onChange={(e) => setTier(e.target.value as ActivityTier | "")}>
            <option value="">등급(선택, 자기평가)</option>
            {(Object.keys(ACTIVITY_TIER_LABELS) as ActivityTier[]).map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TIER_LABELS[t]}
              </option>
            ))}
          </select>
          <div className="col-span-3">
            <button
              type="button"
              className={smallBtn}
              disabled={pending || !activityName.trim()}
              onClick={() =>
                run(async () => {
                  await roadmapActions.addActivity({
                    studentId: data.studentId,
                    activityName,
                    description: null,
                    field: field || null,
                    role: role || null,
                    tier: tier || null,
                    startDate: null,
                    endDate: null,
                    isOngoing: false,
                    totalHours: null,
                    leadershipSummary: null,
                    achievementSummary: null,
                  });
                  setActivityName("");
                  setField("");
                  setRole("");
                  setTier("");
                })
              }
            >
              활동 추가
            </button>
          </div>
        </div>
      )}

      <div className="text-[11px] font-bold text-grey-300 mt-4 mb-1">수상</div>
      {data.awards.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">등록된 수상이 없습니다.</div>}
      {data.awards.map((aw) => (
        <div key={aw.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 py-1.5">
          <div>
            <span className="font-bold text-ink">{aw.awardName}</span>
            {aw.awardLevel && <span className="text-grey-500"> · {aw.awardLevel}</span>}
            {aw.awardedDate && <span className="text-grey-300"> · {aw.awardedDate}</span>}
          </div>
          {!readOnly && (
            <button
              type="button"
              className={dangerBtn}
              disabled={pending}
              onClick={() => run(() => roadmapActions.removeAward(data.studentId, aw.id))}
            >
              삭제
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <input
            className={inputClass}
            placeholder="수상명"
            value={awardName}
            onChange={(e) => setAwardName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="수상 수준(교내/전국 등)"
            value={awardLevel}
            onChange={(e) => setAwardLevel(e.target.value)}
          />
          <button
            type="button"
            className={smallBtn}
            disabled={pending || !awardName.trim()}
            onClick={() =>
              run(async () => {
                await roadmapActions.addAward({
                  studentId: data.studentId,
                  awardName,
                  awardLevel: awardLevel || null,
                  awardedDate: null,
                  relatedActivityId: null,
                  notes: null,
                });
                setAwardName("");
                setAwardLevel("");
              })
            }
          >
            수상 추가
          </button>
        </div>
      )}
    </div>
  );
}

const PREP_TYPES: PrepItemType[] = ["essay", "recommendation", "portfolio", "volunteering", "internship"];

function PrepStatusCard({
  data,
  readOnly,
  pending,
  run,
}: {
  data: RoadmapData;
  readOnly: boolean;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const existingTypes = new Set(data.prepItems.filter((p) => p.itemType !== "other").map((p) => p.itemType));
  const [customLabel, setCustomLabel] = useState("");

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>5. 준비 현황</div>
      <div className="space-y-2">
        {data.prepItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 pb-1.5">
            <div>
              <span className="font-bold text-ink">
                {item.itemType === "other" ? item.customLabel : PREP_ITEM_LABELS[item.itemType]}
              </span>
              {item.notes && <span className="text-grey-300"> · {item.notes}</span>}
            </div>
            {readOnly ? (
              <span className="text-[11px] font-bold text-grey-500">{PREP_STATUS_LABELS[item.status]}</span>
            ) : (
              <select
                className="text-[11px] font-bold border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
                value={item.status}
                disabled={pending}
                onChange={(e) =>
                  run(() =>
                    roadmapActions.savePrepItem({
                      studentId: data.studentId,
                      id: item.id,
                      itemType: item.itemType,
                      customLabel: item.customLabel,
                      status: e.target.value as PrepStatus,
                      notes: item.notes,
                    })
                  )
                }
              >
                {Object.entries(PREP_STATUS_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {PREP_TYPES.filter((t) => !existingTypes.has(t)).map((t) => (
              <button
                key={t}
                type="button"
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-grey-100 text-grey-500"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    roadmapActions.savePrepItem({
                      studentId: data.studentId,
                      id: null,
                      itemType: t,
                      customLabel: null,
                      status: "not_started",
                      notes: null,
                    })
                  )
                }
              >
                + {PREP_ITEM_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="기타 준비 항목 이름"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
            />
            <button
              type="button"
              className={smallBtn}
              disabled={pending || !customLabel.trim()}
              onClick={() =>
                run(async () => {
                  await roadmapActions.savePrepItem({
                    studentId: data.studentId,
                    id: null,
                    itemType: "other",
                    customLabel,
                    status: "not_started",
                    notes: null,
                  });
                  setCustomLabel("");
                })
              }
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoadmapSection({
  data,
  readOnly,
  pending,
  run,
}: {
  data: RoadmapData;
  readOnly: boolean;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [title, setTitle] = useState("");
  const [targetPeriod, setTargetPeriod] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const sorted = [...data.milestones].sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"));

  return (
    <>
      <div className={cardClass}>
        <div className={cardTitleClass}>월별·학기별 마일스톤</div>
        {sorted.length === 0 && <div className="text-[12.5px] text-grey-300">등록된 마일스톤이 없습니다.</div>}
        <div className="space-y-3">
          {sorted.map((m) => (
            <div key={m.id} className="border-b border-grey-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[13px] text-ink">{m.title}</div>
                {readOnly ? (
                  <span className="text-[11px] font-bold text-grey-500">{MILESTONE_STATUS_LABELS[m.status]}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      className="text-[11px] font-bold border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
                      value={m.status}
                      disabled={pending}
                      onChange={(e) =>
                        run(() =>
                          roadmapActions.saveMilestone({
                            studentId: data.studentId,
                            id: m.id,
                            title: m.title,
                            description: m.description,
                            targetPeriod: m.targetPeriod,
                            targetDate: m.targetDate,
                            status: e.target.value as MilestoneStatus,
                            notes: m.notes,
                            relatedLinks: m.relatedLinks,
                          })
                        )
                      }
                    >
                      {Object.entries(MILESTONE_STATUS_LABELS).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={dangerBtn}
                      disabled={pending}
                      onClick={() => run(() => roadmapActions.removeMilestone(data.studentId, m.id))}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
              <div className="text-[11.5px] text-grey-300 mt-0.5">
                {m.targetPeriod || m.targetDate || "시점 미정"}
              </div>
              {m.description && <div className="text-[12.5px] text-grey-500 mt-1">{m.description}</div>}
              {m.notes && <div className="text-[12px] text-grey-300 mt-1">메모: {m.notes}</div>}
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <input className={inputClass} placeholder="할 일(제목)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input
              className={inputClass}
              placeholder="시점(예: 2026년 11월)"
              value={targetPeriod}
              onChange={(e) => setTargetPeriod(e.target.value)}
            />
            <input className={inputClass} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            <input className={inputClass} placeholder="메모(선택)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="col-span-2">
              <button
                type="button"
                className={smallBtn}
                disabled={pending || !title.trim()}
                onClick={() =>
                  run(async () => {
                    await roadmapActions.saveMilestone({
                      studentId: data.studentId,
                      id: null,
                      title,
                      description: null,
                      targetPeriod: targetPeriod || null,
                      targetDate: targetDate || null,
                      status: "todo",
                      notes: notes || null,
                      relatedLinks: [],
                    });
                    setTitle("");
                    setTargetPeriod("");
                    setTargetDate("");
                    setNotes("");
                  })
                }
              >
                마일스톤 추가
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>AI 월간 종합 리뷰</div>
        <div className="text-[12.5px] text-grey-300">
          {data.latestMonthlyReview?.status === "generated"
            ? data.latestMonthlyReview.content
            : "아직 생성된 로드맵 리뷰가 없습니다. 준비 중입니다."}
        </div>
      </div>
    </>
  );
}
