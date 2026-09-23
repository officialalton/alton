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
  // 2026-09-22(사용자 지적 — "저장 누르니까 아무 반응이 없다") — 저장 자체는
  // 되고 있었지만 성공 시 아무 표시가 없어 사용자가 반응이 없다고 느꼈다.
  // 저장 버튼을 누른 곳과 무관하게 화면 상단에 잠깐 "저장되었습니다"를 띄운다.
  const [savedFlash, setSavedFlash] = useState(false);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
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
      {savedFlash && (
        <div className="mb-4 text-[12px] text-green bg-green/10 rounded-lg px-3 py-2">저장되었습니다.</div>
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

  // 2026-09-22(사용자 지시) — 프로필 탭을 섹터별 서브서브탭으로 재구성하고,
  // 맨 앞에 "요약" 탭을 두어 각 섹션의 중요한 내용을 앞으로 데리고 온다.
  const [profileSubTab, setProfileSubTab] = useState<
    "summary" | "demographics" | "academics" | "colleges" | "activities" | "prep"
  >("summary");

  return (
    <>
      <PillSubTabs
        items={[
          { id: "summary", label: "요약" },
          { id: "demographics", label: "인구통계" },
          { id: "academics", label: "학업정보" },
          { id: "colleges", label: "대학 관심사" },
          { id: "activities", label: "활동/수상" },
          { id: "prep", label: "준비 현황" },
        ]}
        activeId={profileSubTab}
        onSelect={setProfileSubTab}
        className="mb-4"
      />

      {profileSubTab === "summary" && <ProfileSummaryCard data={data} />}

      {profileSubTab === "demographics" && (
        <DemographicsCard data={data} readOnly={readOnly} pending={pending} run={run} />
      )}

      {profileSubTab === "academics" && (
        <>
      {/* 1. 기본 학업 정보 · 성적 */}
      <GradesCard data={data} readOnly={readOnly} pending={pending} run={run} />

      <div className={cardClass}>
        <div className={cardTitleClass}>1b. 교육과정</div>
        {readOnly ? (
          <div className="text-[12.5px] space-y-1">
            <div>졸업 예정 연도: {data.academicProfile.graduationYear ?? "미입력"}</div>
            <div>교육과정: {data.academicProfile.curriculumType ?? "미입력"}</div>
            <div>현재 수강 과목: {data.academicProfile.currentSubjects.join(", ") || "미입력"}</div>
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
                      honorsCount: data.academicProfile.honorsCount,
                      apCount: data.academicProfile.apCount,
                      collegeCoursesCount: data.academicProfile.collegeCoursesCount,
                      ibHlCount: data.academicProfile.ibHlCount,
                      ibSlCount: data.academicProfile.ibSlCount,
                      schoolApIbOfferedCount: data.academicProfile.schoolApIbOfferedCount,
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

      {/* 1c. 수강 과목 목록(2026-09-22 사용자 지시 — 개수 입력 대신 과목별 추가/수정/삭제) */}
      <CoursesCard data={data} readOnly={readOnly} pending={pending} run={run} />

      {/* 2. 시험 정보 */}
      <TestRecordsCard data={data} readOnly={readOnly} pending={pending} run={run} />
        </>
      )}

      {profileSubTab === "colleges" && (
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
      )}

      {profileSubTab === "activities" && (
        /* 4. 활동과 수상 */
        <ActivitiesAndAwardsCard data={data} readOnly={readOnly} pending={pending} run={run} />
      )}

      {profileSubTab === "prep" && (
        /* 5. 준비 현황 */
        <PrepStatusCard data={data} readOnly={readOnly} pending={pending} run={run} />
      )}
    </>
  );
}

// 2026-09-22(사용자 지시) — 프로필 "요약" 서브서브탭: 각 섹션에서 작성된
// 중요한 내용을 앞으로 데리고 와서 한눈에 볼 수 있게 한다(읽기 전용 digest).
function ProfileSummaryCard({ data }: { data: RoadmapData }) {
  const latestTest = data.testRecords[0];
  const activeCourses = data.courses.filter((c) => c.status === "taking");
  const completedCourses = data.courses.filter((c) => c.status === "completed");

  return (
    <>
      <div className={cardClass}>
        <div className={cardTitleClass}>학업 요약</div>
        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">학년 · 학교</div>
            <div className="font-bold text-ink">
              {data.grade ?? "미입력"} · {data.schoolName ?? "미입력"}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">GPA</div>
            <div className="font-bold text-ink">
              {data.gpa ?? "미입력"}{data.gpaScale ? ` / ${data.gpaScale}` : ""}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">교육과정 · 졸업 예정</div>
            <div className="font-bold text-ink">
              {data.academicProfile.curriculumType ?? "미입력"}
              {data.academicProfile.graduationYear ? ` · ${data.academicProfile.graduationYear}년` : ""}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">수강 과목</div>
            <div className="font-bold text-ink">
              수강 중 {activeCourses.length} · 완료 {completedCourses.length}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">최근 시험 성적</div>
            <div className="font-bold text-ink">
              {latestTest
                ? `${latestTest.testType} ${latestTest.score ?? "-"}점 (${latestTest.testDate ?? "날짜 미입력"})`
                : "미입력"}
            </div>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>대학 관심사 요약</div>
        <div className="text-[12.5px] space-y-1">
          <div>관심 전공: {data.collegeInterests.intendedMajors.join(", ") || "미입력"}</div>
          <div>관심 대학: {data.collegeInterests.targetColleges.join(", ") || "미입력"}</div>
          <div>지원 목표 시기: {data.collegeInterests.targetApplicationTiming ?? "미입력"}</div>
        </div>
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>활동 · 수상 · 준비 현황 요약</div>
        <div className="text-[12.5px] space-y-1">
          <div>등록된 활동: {data.activities.length}개</div>
          <div>등록된 수상: {data.awards.length}개</div>
          <div>
            준비 항목: {data.prepItems.filter((p) => p.status === "done").length} / {data.prepItems.length} 완료
          </div>
        </div>
      </div>
    </>
  );
}

const COURSE_STATUS_LABELS: Record<"taking" | "completed", string> = {
  taking: "수강 중",
  completed: "완료",
};

// 2026-09-22(사용자 지시) — "수강 과목" 개수 입력을 과목별 목록(추가/수정/삭제)으로.
function CoursesCard({
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [status, setStatus] = useState<"taking" | "completed">("taking");
  const [score, setScore] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");

  function resetForm() {
    setEditingId(null);
    setCourseName("");
    setStatus("taking");
    setScore("");
    setAcademicYear("");
    setGradeLevel("");
  }

  function startEdit(c: (typeof data.courses)[number]) {
    setEditingId(c.id);
    setCourseName(c.courseName);
    setStatus(c.status);
    setScore(c.score ?? "");
    setAcademicYear(c.academicYear?.toString() ?? "");
    setGradeLevel(c.gradeLevel ?? "");
  }

  function handleSubmit() {
    const input = {
      studentId: data.studentId,
      courseName,
      status,
      score: score || null,
      academicYear: academicYear ? Number(academicYear) : null,
      gradeLevel: gradeLevel || null,
    };
    run(async () => {
      if (editingId) {
        await roadmapActions.updateCourse(editingId, input);
      } else {
        await roadmapActions.addCourse(input);
      }
      resetForm();
    });
  }

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>1c. 수강 과목</div>
      {data.courses.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">등록된 수강 과목이 없습니다.</div>}
      {data.courses.map((c) => (
        <div key={c.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 py-1.5">
          <div>
            <span className="font-bold text-ink">{c.courseName}</span>
            <span className="text-grey-500"> · {COURSE_STATUS_LABELS[c.status]}</span>
            {c.score && <span className="text-grey-500"> · 점수 {c.score}</span>}
            {c.academicYear && <span className="text-grey-500"> · {c.academicYear}년</span>}
            {c.gradeLevel && <span className="text-grey-500"> · {c.gradeLevel}</span>}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" className="text-[11px] font-bold text-grey-500" disabled={pending} onClick={() => startEdit(c)}>
                수정
              </button>
              <button
                type="button"
                className={dangerBtn}
                disabled={pending}
                onClick={() => run(() => roadmapActions.removeCourse(data.studentId, c.id))}
              >
                삭제
              </button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <input className={inputClass} placeholder="과목명" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "taking" | "completed")}>
            <option value="taking">수강 중</option>
            <option value="completed">완료</option>
          </select>
          <input className={inputClass} placeholder="점수" value={score} onChange={(e) => setScore(e.target.value)} />
          <input
            className={inputClass}
            type="number"
            placeholder="수강 년도"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="수강 학년(예: 10학년)"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={smallBtn}
              disabled={pending || !courseName.trim()}
              onClick={handleSubmit}
            >
              {editingId ? "수정 저장" : "과목 추가"}
            </button>
            {editingId && (
              <button type="button" className="text-[11px] font-bold text-grey-500" onClick={resetForm}>
                취소
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const GPA_SCALES = ["4.0", "4.3", "4.5", "5.0"];

function GradesCard({
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
  const [grade, setGrade] = useState(data.grade ?? "");
  const [schoolName, setSchoolName] = useState(data.schoolName ?? "");
  const [gpa, setGpa] = useState(data.gpa?.toString() ?? "");
  const [gpaScale, setGpaScale] = useState(data.gpaScale ?? "4.0");
  const [classRank, setClassRank] = useState(data.classRank?.toString() ?? "");
  const [classSize, setClassSize] = useState(data.classSize?.toString() ?? "");
  const [noClassRank, setNoClassRank] = useState(data.classRank == null && data.classSize == null);

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>1. 학년 · 학교 · 성적</div>
      {readOnly ? (
        <div className="text-[12.5px] space-y-1">
          <div>학년: {data.grade ?? "미입력"}</div>
          <div>학교: {data.schoolName ?? "미입력"}</div>
          <div>
            GPA: {data.gpa ?? "미입력"}
            {data.gpa != null && data.gpaScale ? ` / ${data.gpaScale}` : ""}
          </div>
          <div>
            학급 등수: {data.classRank ?? "미입력"}
            {data.classSize ? ` / ${data.classSize}명` : ""}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>학년</label>
            <input className={inputClass} placeholder="예: 11학년" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>학교</label>
            <input className={inputClass} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>비가중 GPA</label>
            <input className={inputClass} type="number" step="0.01" min={0} value={gpa} onChange={(e) => setGpa(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>GPA 척도</label>
            <select className={inputClass} value={gpaScale} onChange={(e) => setGpaScale(e.target.value)}>
              {GPA_SCALES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>학급 등수(선택)</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              disabled={noClassRank}
              value={classRank}
              onChange={(e) => setClassRank(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>학급 인원(선택)</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              disabled={noClassRank}
              value={classSize}
              onChange={(e) => setClassSize(e.target.value)}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="no-class-rank"
              checked={noClassRank}
              onChange={(e) => {
                setNoClassRank(e.target.checked);
                if (e.target.checked) {
                  setClassRank("");
                  setClassSize("");
                }
              }}
            />
            <label htmlFor="no-class-rank" className="text-[12px] text-grey-500">
              우리 학교는 학급 등수를 매기지 않습니다
            </label>
          </div>
          <div className="col-span-2">
            <button
              type="button"
              disabled={pending}
              className={smallBtn}
              onClick={() =>
                run(() =>
                  roadmapActions.saveGrades({
                    studentId: data.studentId,
                    grade: grade || null,
                    schoolName: schoolName || null,
                    gpa: gpa ? Number(gpa) : null,
                    gpaScale: gpa ? gpaScale : null,
                    classRank: noClassRank ? null : classRank ? Number(classRank) : null,
                    classSize: noClassRank ? null : classSize ? Number(classSize) : null,
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

// 2026-09-22(사용자 지시) — "목표 설정" 서브서브탭. 목표 학교는
// student_college_interests.target_colleges(3. 관심 분야와 대학 목표에서
// 이미 입력)를 그대로 보여준다 — 중복 입력란을 만들지 않는다.
function GoalsCard({
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
  const [targetGpa, setTargetGpa] = useState(data.academicProfile.targetGpa?.toString() ?? "");
  const [targetSat, setTargetSat] = useState(data.academicProfile.targetSat?.toString() ?? "");
  const [targetApCount, setTargetApCount] = useState(data.academicProfile.targetApCount?.toString() ?? "");
  const [targetExtracurricular, setTargetExtracurricular] = useState(data.academicProfile.targetExtracurricular ?? "");

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>목표 설정</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>목표 학교</label>
          <div className="text-[12.5px] text-ink">
            {data.collegeInterests.targetColleges.join(", ") || "미입력(위 '관심 분야와 대학 목표'에서 입력)"}
          </div>
        </div>
        {readOnly ? (
          <>
            <div>
              <div className={labelClass}>목표 GPA</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetGpa ?? "미입력"}</div>
            </div>
            <div>
              <div className={labelClass}>목표 SAT</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetSat ?? "미입력"}</div>
            </div>
            <div>
              <div className={labelClass}>목표 AP 과목 수</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetApCount ?? "미입력"}</div>
            </div>
            <div className="col-span-2">
              <div className={labelClass}>목표 Extracurricular</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetExtracurricular ?? "미입력"}</div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelClass}>목표 GPA</label>
              <input className={inputClass} type="number" step="0.01" min={0} value={targetGpa} onChange={(e) => setTargetGpa(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>목표 SAT</label>
              <input className={inputClass} type="number" min={400} max={1600} value={targetSat} onChange={(e) => setTargetSat(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>목표 AP 과목 수</label>
              <input className={inputClass} type="number" min={0} value={targetApCount} onChange={(e) => setTargetApCount(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>목표 Extracurricular</label>
              <input
                className={inputClass}
                placeholder="예: 전국 단위 로봇 대회 입상"
                value={targetExtracurricular}
                onChange={(e) => setTargetExtracurricular(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <button
                type="button"
                disabled={pending}
                className={smallBtn}
                onClick={() =>
                  run(() =>
                    roadmapActions.saveRoadmapGoals({
                      studentId: data.studentId,
                      targetGpa: targetGpa ? Number(targetGpa) : null,
                      targetSat: targetSat ? Number(targetSat) : null,
                      targetApCount: targetApCount ? Number(targetApCount) : null,
                      targetExtracurricular: targetExtracurricular || null,
                    })
                  )
                }
              >
                저장
              </button>
            </div>
          </>
        )}
      </div>
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
  // 2026-09-22(사용자 지시) — 로드맵 탭 안에 "목표 설정" 서브서브탭 추가.
  const [roadmapSubTab, setRoadmapSubTab] = useState<"milestones" | "goals">("milestones");

  const sorted = [...data.milestones].sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"));

  if (roadmapSubTab === "goals") {
    return (
      <>
        <PillSubTabs
          items={[
            { id: "milestones", label: "마일스톤" },
            { id: "goals", label: "목표 설정" },
          ]}
          activeId={roadmapSubTab}
          onSelect={(id) => setRoadmapSubTab(id as "milestones" | "goals")}
          className="mb-4"
        />
        <GoalsCard data={data} readOnly={readOnly} pending={pending} run={run} />
      </>
    );
  }

  return (
    <>
      <PillSubTabs
        items={[
          { id: "milestones", label: "마일스톤" },
          { id: "goals", label: "목표 설정" },
        ]}
        activeId={roadmapSubTab}
        onSelect={(id) => setRoadmapSubTab(id as "milestones" | "goals")}
        className="mb-4"
      />
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
