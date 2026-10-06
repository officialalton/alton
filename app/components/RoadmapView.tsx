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
  canProposeSourceUrl = false,
}: {
  data: RoadmapData;
  readOnly?: boolean;
  /** 컨설턴트 포털에서만 true — 대학 탐색 화면에 출처 URL 제안 폼을 노출한다. */
  canProposeSourceUrl?: boolean;
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
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  const nextMilestone = data.milestones
    .filter((m) => m.status !== "done")
    .sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"))[0];

  return (
    <div className="max-w-[720px] px-6 py-6">
      {/* 상단 요약 — 프로필 탭은 아래 ProfileSections가 학년·목표 대학/전공을
          그대로 다시 보여주므로 이 카드와 내용이 겹친다(2026-09-23 사용자
          지적: "Roadmap 상단의 중복 요약 노출"). 로드맵/대학 탐색 탭에서만
          맥락 요약으로 보여준다. */}
      {subTab !== "profile" && (
      <div className={cardClass}>
        <div className={cardTitleClass}>Roadmap summary</div>
        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Profile completeness</div>
            <div className="font-bold text-ink">
              {data.completeness.filledSections} / {data.completeness.totalSections} sections
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Current grade</div>
            <div className="font-bold text-ink">{data.grade ?? "Not entered"}</div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Target colleges / majors</div>
            <div className="font-bold text-ink">
              {[...data.collegeInterests.targetColleges.slice(0, 2), ...data.collegeInterests.intendedMajors.slice(0, 1)]
                .join(", ") || "Not entered"}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Next key milestone</div>
            <div className="font-bold text-ink">
              {nextMilestone ? `${nextMilestone.title}${nextMilestone.targetDate ? ` (${nextMilestone.targetDate})` : ""}` : "None"}
            </div>
          </div>
        </div>
      </div>
      )}

      {error && (
        <div className="mb-4 text-[12px] text-red bg-red/10 rounded-lg px-3 py-2">{error}</div>
      )}
      {savedFlash && (
        <div className="mb-4 text-[12px] text-green bg-green/10 rounded-lg px-3 py-2">Saved.</div>
      )}

      <PillSubTabs
        items={[
          { id: "profile", label: "Profile" },
          { id: "roadmap", label: "Roadmap" },
          { id: "colleges", label: "College Explore" },
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
        <CollegeExploreSection canProposeSourceUrl={canProposeSourceUrl} />
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
          { id: "summary", label: "Summary" },
          { id: "demographics", label: "Demographics" },
          { id: "academics", label: "Academics" },
          { id: "colleges", label: "College Interests" },
          { id: "activities", label: "Activities & Awards" },
          { id: "prep", label: "Prep Status" },
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
        <div className={cardTitleClass}>1b. Curriculum</div>
        {readOnly ? (
          <div className="text-[12.5px] space-y-1">
            <div>Expected graduation year: {data.academicProfile.graduationYear ?? "Not entered"}</div>
            <div>Curriculum: {data.academicProfile.curriculumType ?? "Not entered"}</div>
            <div>Current subjects: {data.academicProfile.currentSubjects.join(", ") || "Not entered"}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Expected graduation year</label>
              <input
                className={inputClass}
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Curriculum</label>
              <input
                className={inputClass}
                placeholder="e.g. Korean public / US / IB"
                value={curriculumType}
                onChange={(e) => setCurriculumType(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Current subjects (comma-separated)</label>
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
                Save
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
        <div className={cardTitleClass}>3. Interests and college goals</div>
        {readOnly ? (
          <div className="text-[12.5px] space-y-1">
            <div>Intended majors: {data.collegeInterests.intendedMajors.join(", ") || "Not entered"}</div>
            <div>Career interests: {data.collegeInterests.careerInterests.join(", ") || "Not entered"}</div>
            <div>Target countries: {data.collegeInterests.targetCountries.join(", ") || "Not entered"}</div>
            <div>Target college types: {data.collegeInterests.targetCollegeTypes.join(", ") || "Not entered"}</div>
            <div>Target colleges: {data.collegeInterests.targetColleges.join(", ") || "Not entered"}</div>
            <div>Target application timing: {data.collegeInterests.targetApplicationTiming ?? "Not entered"}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Intended majors (comma-separated)</label>
              <input className={inputClass} value={majors} onChange={(e) => setMajors(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Career interests (comma-separated)</label>
              <input className={inputClass} value={careers} onChange={(e) => setCareers(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Target countries (comma-separated)</label>
              <input className={inputClass} value={countries} onChange={(e) => setCountries(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Target college types (comma-separated)</label>
              <input className={inputClass} value={collegeTypes} onChange={(e) => setCollegeTypes(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Target colleges (comma-separated)</label>
              <input className={inputClass} value={colleges} onChange={(e) => setColleges(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Target application timing</label>
              <input
                className={inputClass}
                placeholder="e.g. Fall 2027 (Regular Decision)"
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
                Save
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
        <div className={cardTitleClass}>Academic summary</div>
        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Grade / School</div>
            <div className="font-bold text-ink">
              {data.grade ?? "Not entered"} / {data.schoolName ?? "Not entered"}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">GPA</div>
            <div className="font-bold text-ink">
              {data.gpa ?? "Not entered"}{data.gpaScale ? ` / ${data.gpaScale}` : ""}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Curriculum / Graduation</div>
            <div className="font-bold text-ink">
              {data.academicProfile.curriculumType ?? "Not entered"}
              {data.academicProfile.graduationYear ? ` / ${data.academicProfile.graduationYear}` : ""}
            </div>
          </div>
          <div>
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Courses</div>
            <div className="font-bold text-ink">
              {activeCourses.length} in progress, {completedCourses.length} completed
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">Latest test score</div>
            <div className="font-bold text-ink">
              {latestTest
                ? `${latestTest.testType} ${latestTest.score ?? "-"} (${latestTest.testDate ?? "date not entered"})`
                : "Not entered"}
            </div>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>College interests summary</div>
        <div className="text-[12.5px] space-y-1">
          <div>Intended majors: {data.collegeInterests.intendedMajors.join(", ") || "Not entered"}</div>
          <div>Target colleges: {data.collegeInterests.targetColleges.join(", ") || "Not entered"}</div>
          <div>Target application timing: {data.collegeInterests.targetApplicationTiming ?? "Not entered"}</div>
        </div>
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>Activities, awards, and prep summary</div>
        <div className="text-[12.5px] space-y-1">
          <div>Activities: {data.activities.length}</div>
          <div>Awards: {data.awards.length}</div>
          <div>
            Prep items: {data.prepItems.filter((p) => p.status === "done").length} / {data.prepItems.length} done
          </div>
        </div>
      </div>
    </>
  );
}

const COURSE_STATUS_LABELS: Record<"taking" | "completed", string> = {
  taking: "In progress",
  completed: "Completed",
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
      <div className={cardTitleClass}>1c. Courses</div>
      {data.courses.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">No courses added yet.</div>}
      {data.courses.map((c) => (
        <div key={c.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 py-1.5">
          <div>
            <span className="font-bold text-ink">{c.courseName}</span>
            <span className="text-grey-500"> / {COURSE_STATUS_LABELS[c.status]}</span>
            {c.score && <span className="text-grey-500"> / Score {c.score}</span>}
            {c.academicYear && <span className="text-grey-500"> / {c.academicYear}</span>}
            {c.gradeLevel && <span className="text-grey-500"> · {c.gradeLevel}</span>}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" className="text-[11px] font-bold text-grey-500" disabled={pending} onClick={() => startEdit(c)}>
                Edit
              </button>
              <button
                type="button"
                className={dangerBtn}
                disabled={pending}
                onClick={() => run(() => roadmapActions.removeCourse(data.studentId, c.id))}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <input className={inputClass} placeholder="Course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "taking" | "completed")}>
            <option value="taking">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <input className={inputClass} placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} />
          <input
            className={inputClass}
            type="number"
            placeholder="Academic year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Grade taken (e.g. 10th)"
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
              {editingId ? "Save changes" : "Add course"}
            </button>
            {editingId && (
              <button type="button" className="text-[11px] font-bold text-grey-500" onClick={resetForm}>
                Cancel
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
      <div className={cardTitleClass}>1. Grade, school, and GPA</div>
      {readOnly ? (
        <div className="text-[12.5px] space-y-1">
          <div>Grade: {data.grade ?? "Not entered"}</div>
          <div>School: {data.schoolName ?? "Not entered"}</div>
          <div>
            GPA: {data.gpa ?? "Not entered"}
            {data.gpa != null && data.gpaScale ? ` / ${data.gpaScale}` : ""}
          </div>
          <div>
            Class rank: {data.classRank ?? "Not entered"}
            {data.classSize ? ` / ${data.classSize}` : ""}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Grade</label>
            <input className={inputClass} placeholder="e.g. 11th grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>School</label>
            <input className={inputClass} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Unweighted GPA</label>
            <input className={inputClass} type="number" step="0.01" min={0} value={gpa} onChange={(e) => setGpa(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>GPA scale</label>
            <select className={inputClass} value={gpaScale} onChange={(e) => setGpaScale(e.target.value)}>
              {GPA_SCALES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Class rank (optional)</label>
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
            <label className={labelClass}>Class size (optional)</label>
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
              My school doesn&apos;t rank students
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
              Save
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
      <div className={cardTitleClass}>0. Demographics (optional)</div>
      <p className="text-[11.5px] text-grey-500 mb-2">
        All fields are optional and are not visible to teachers (only the student, parents, and admins can see them).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Country of residence</label>
          <input className={inputClass} value={homeCountry} onChange={(e) => setHomeCountry(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>ZIP / postal code</label>
          <input className={inputClass} value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Residency status</label>
          <select className={inputClass} value={residencyStatus} onChange={(e) => setResidencyStatus(e.target.value as ResidencyStatus | "")}>
            <option value="">Not specified</option>
            <option value="us_resident">US resident</option>
            <option value="international">Applying as an international student</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Gender</label>
          <input className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Race / ethnicity</label>
          <input className={inputClass} value={raceEthnicity} onChange={(e) => setRaceEthnicity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Financial aid plans</label>
          <select
            className={inputClass}
            value={financialAidIntent}
            onChange={(e) => setFinancialAidIntent(e.target.value as FinancialAidIntent | "")}
          >
            <option value="">Not specified</option>
            <option value="planning">Planning to apply</option>
            <option value="not_planning">Not applying</option>
            <option value="not_sure">Not sure yet</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Max annual budget (USD)</label>
          <input className={inputClass} type="number" min={0} value={maxAnnualBudget} onChange={(e) => setMaxAnnualBudget(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Household income range</label>
          <input
            className={inputClass}
            placeholder="e.g. $60,001–$100,000"
            value={householdIncomeRange}
            onChange={(e) => setHouseholdIncomeRange(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>First-generation college student</label>
          <select className={inputClass} value={firstGeneration} onChange={(e) => setFirstGeneration(e.target.value as FirstGeneration | "")}>
            <option value="">Not specified</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Recruited athlete</label>
          <select className={inputClass} value={recruitedAthlete} onChange={(e) => setRecruitedAthlete(e.target.value as RecruitedAthlete | "")}>
            <option value="">Not specified</option>
            <option value="yes">Yes</option>
            <option value="maybe">Considering</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Parents&apos; colleges (legacy, comma-separated)</label>
          <input className={inputClass} value={legacySchools} onChange={(e) => setLegacySchools(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Religious affiliation</label>
          <input className={inputClass} value={religiousAffiliation} onChange={(e) => setReligiousAffiliation(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Special school types of interest</label>
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
            Save
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
    actual: "Past score",
    target: "Target score",
    planned: "Next test plan",
  };

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>2. Test scores</div>
      <div className="space-y-2 mb-3">
        {data.testRecords.length === 0 && <div className="text-[12.5px] text-grey-300">No test records yet.</div>}
        {data.testRecords.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 pb-1.5">
            <div>
              <span className="font-bold text-ink">{r.testType}</span> · {kindLabel[r.recordKind]}
              {r.testDate && <span className="text-grey-500"> · {r.testDate}</span>}
              {r.score !== null && <span className="text-grey-500"> / Total {r.score}</span>}
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
                Delete
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
            <option value="actual">Past score</option>
            <option value="target">Target score</option>
            <option value="planned">Next test plan</option>
          </select>
          <input className={inputClass} type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          <input
            className={inputClass}
            type="number"
            placeholder="Total score (optional)"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <div className="col-span-2 text-[11px] font-bold text-grey-300 uppercase tracking-wide">
            Section scores (optional)
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
            placeholder="Notes (optional)"
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
              Add
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
        AP exams (optional)
      </div>
      {data.apExams.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">No AP exams added yet.</div>}
      {data.apExams.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 py-1.5">
          <div>
            <span className="font-bold text-ink">{a.courseName}</span>
            {a.examYear && <span className="text-grey-500"> · {a.examYear}</span>}
            {a.score !== null && <span className="text-grey-500"> / Score {a.score}</span>}
          </div>
          {!readOnly && (
            <button
              type="button"
              className={dangerBtn}
              disabled={pending}
              onClick={() => run(() => roadmapActions.removeApExam(data.studentId, a.id))}
            >
              Delete
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <input
            className={inputClass}
            placeholder="Exam name (e.g. AP Physics C)"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
          />
          <input className={inputClass} type="number" placeholder="Year" value={examYear} onChange={(e) => setExamYear(e.target.value)} />
          <input className={inputClass} type="number" min={1} max={5} placeholder="Score (1–5)" value={apScore} onChange={(e) => setApScore(e.target.value)} />
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
              Add
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
      <div className={cardTitleClass}>4. Activities and awards</div>
      <div className="text-[11px] font-bold text-grey-300 mt-2 mb-1">Activities</div>
      {data.activities.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">No activities added yet.</div>}
      {data.activities.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 py-1.5">
          <div>
            <span className="font-bold text-ink">{a.activityName}</span>
            {a.field && <span className="text-grey-500"> · {a.field}</span>}
            {a.role && <span className="text-grey-500"> · {a.role}</span>}
            {a.tier && <span className="text-grey-500"> / {ACTIVITY_TIER_LABELS[a.tier]}</span>}
            {a.leadershipSummary && <div className="text-grey-300 text-[11.5px]">Leadership: {a.leadershipSummary}</div>}
            {a.achievementSummary && <div className="text-grey-300 text-[11.5px]">Achievements: {a.achievementSummary}</div>}
          </div>
          {!readOnly && (
            <button
              type="button"
              className={dangerBtn}
              disabled={pending}
              onClick={() => run(() => roadmapActions.removeActivity(data.studentId, a.id))}
            >
              Delete
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <input
            className={inputClass}
            placeholder="Activity name"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
          />
          <input className={inputClass} placeholder="Field" value={field} onChange={(e) => setField(e.target.value)} />
          <input className={inputClass} placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
          <select className={inputClass + " col-span-3"} value={tier} onChange={(e) => setTier(e.target.value as ActivityTier | "")}>
            <option value="">Tier (optional, self-assessed)</option>
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
              Add activity
            </button>
          </div>
        </div>
      )}

      <div className="text-[11px] font-bold text-grey-300 mt-4 mb-1">Awards</div>
      {data.awards.length === 0 && <div className="text-[12.5px] text-grey-300 mb-2">No awards added yet.</div>}
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
              Delete
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <input
            className={inputClass}
            placeholder="Award name"
            value={awardName}
            onChange={(e) => setAwardName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Level (school, national, etc.)"
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
            Add award
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
      <div className={cardTitleClass}>5. Prep status</div>
      <div className="space-y-2">
        {data.prepItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-[12.5px] border-b border-grey-100 pb-1.5">
            <div>
              <span className="font-bold text-ink">
                {item.itemType === "other" ? item.customLabel : PREP_ITEM_LABELS[item.itemType]}
              </span>
              {item.notes && <span className="text-grey-300"> / {item.notes}</span>}
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
              placeholder="Other prep item name"
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
              Add
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
      <div className={cardTitleClass}>Goals</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Target colleges</label>
          <div className="text-[12.5px] text-ink">
            {data.collegeInterests.targetColleges.join(", ") || "Not entered (fill in under 'Interests and college goals')"}
          </div>
        </div>
        {readOnly ? (
          <>
            <div>
              <div className={labelClass}>Target GPA</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetGpa ?? "Not entered"}</div>
            </div>
            <div>
              <div className={labelClass}>Target SAT</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetSat ?? "Not entered"}</div>
            </div>
            <div>
              <div className={labelClass}>Target number of APs</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetApCount ?? "Not entered"}</div>
            </div>
            <div className="col-span-2">
              <div className={labelClass}>Target extracurricular</div>
              <div className="text-[12.5px] text-ink">{data.academicProfile.targetExtracurricular ?? "Not entered"}</div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelClass}>Target GPA</label>
              <input className={inputClass} type="number" step="0.01" min={0} value={targetGpa} onChange={(e) => setTargetGpa(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Target SAT</label>
              <input className={inputClass} type="number" min={400} max={1600} value={targetSat} onChange={(e) => setTargetSat(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Target number of APs</label>
              <input className={inputClass} type="number" min={0} value={targetApCount} onChange={(e) => setTargetApCount(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Target extracurricular</label>
              <input
                className={inputClass}
                placeholder="e.g. Place in a national robotics competition"
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
                Save
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
            { id: "milestones", label: "Milestones" },
            { id: "goals", label: "Goals" },
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
          { id: "milestones", label: "Milestones" },
          { id: "goals", label: "Goals" },
        ]}
        activeId={roadmapSubTab}
        onSelect={(id) => setRoadmapSubTab(id as "milestones" | "goals")}
        className="mb-4"
      />
      <div className={cardClass}>
        <div className={cardTitleClass}>Monthly and semester milestones</div>
        {sorted.length === 0 && <div className="text-[12.5px] text-grey-300">No milestones added yet.</div>}
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
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <div className="text-[11.5px] text-grey-300 mt-0.5">
                {m.targetPeriod || m.targetDate || "Timing TBD"}
              </div>
              {m.description && <div className="text-[12.5px] text-grey-500 mt-1">{m.description}</div>}
              {m.notes && <div className="text-[12px] text-grey-300 mt-1">Notes: {m.notes}</div>}
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <input className={inputClass} placeholder="Task (title)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input
              className={inputClass}
              placeholder="Timing (e.g. November 2026)"
              value={targetPeriod}
              onChange={(e) => setTargetPeriod(e.target.value)}
            />
            <input className={inputClass} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            <input className={inputClass} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
                Add milestone
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={cardClass}>
        <div className={cardTitleClass}>AI monthly review</div>
        <div className="text-[12.5px] text-grey-300">
          {data.latestMonthlyReview?.status === "generated"
            ? data.latestMonthlyReview.content
            : "No roadmap review has been generated yet. Coming soon."}
        </div>
      </div>
    </>
  );
}
