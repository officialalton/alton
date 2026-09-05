"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  submitCompleteProfile,
  addApCourse,
  removeApCourse,
  addExtracurricularActivity,
  removeExtracurricularActivity,
} from "./actions";

type ApCourse = {
  id: string;
  course_name: string;
  status: "planned" | "taking" | "completed";
  exam_year: number | null;
  score: number | null;
};

type Activity = {
  id: string;
  activity_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
};

const AP_STATUS_LABEL: Record<ApCourse["status"], string> = {
  planned: "이수 예정",
  taking: "이수 중",
  completed: "이수 완료",
};

export default function CompleteProfileForm({
  hasDateOfBirth,
  initialSchoolName,
  initialGrade,
  initialSatScore,
  initialGpa,
  initialTargetColleges,
  initialIntendedMajors,
  initialApCourses,
  initialActivities,
}: {
  hasDateOfBirth: boolean;
  initialSchoolName: string;
  initialGrade: string;
  initialSatScore: number;
  initialGpa: number | null;
  initialTargetColleges: string[];
  initialIntendedMajors: string[];
  initialApCourses: ApCourse[];
  initialActivities: Activity[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [grade, setGrade] = useState(initialGrade);
  const [satScore, setSatScore] = useState(String(initialSatScore ?? 0));
  const [gpa, setGpa] = useState(initialGpa != null ? String(initialGpa) : "");
  const [targetColleges, setTargetColleges] = useState<string[]>(initialTargetColleges);
  const [intendedMajors, setIntendedMajors] = useState<string[]>(initialIntendedMajors);
  const [targetCollegeInput, setTargetCollegeInput] = useState("");
  const [intendedMajorInput, setIntendedMajorInput] = useState("");

  const [apCourses, setApCourses] = useState<ApCourse[]>(initialApCourses);
  const [apCourseName, setApCourseName] = useState("");
  const [apStatus, setApStatus] = useState<ApCourse["status"]>("planned");
  const [apExamYear, setApExamYear] = useState("");
  const [apScore, setApScore] = useState("");
  const [apError, setApError] = useState<string | null>(null);

  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [activityName, setActivityName] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityStart, setActivityStart] = useState("");
  const [activityEnd, setActivityEnd] = useState("");
  const [activityOngoing, setActivityOngoing] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  function addTag(list: string[], setList: (v: string[]) => void, value: string, clear: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      clear();
      return;
    }
    setList([...list, trimmed]);
    clear();
  }

  async function handleAddApCourse() {
    setApError(null);
    if (!apCourseName.trim()) {
      setApError("과목명을 입력해주세요.");
      return;
    }
    try {
      await addApCourse({
        courseName: apCourseName.trim(),
        status: apStatus,
        examYear: apExamYear ? Number(apExamYear) : null,
        score: apScore ? Number(apScore) : null,
      });
      setApCourses((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          course_name: apCourseName.trim(),
          status: apStatus,
          exam_year: apExamYear ? Number(apExamYear) : null,
          score: apScore ? Number(apScore) : null,
        },
      ]);
      setApCourseName("");
      setApExamYear("");
      setApScore("");
    } catch (e) {
      setApError(e instanceof Error ? e.message : "추가에 실패했어요.");
    }
  }

  async function handleRemoveApCourse(id: string) {
    setApCourses((prev) => prev.filter((c) => c.id !== id));
    if (!id.startsWith("temp-")) {
      try {
        await removeApCourse(id);
      } catch {
        // 조용히 무시 — 다음 새로고침에서 실제 상태로 맞춰진다.
      }
    }
  }

  async function handleAddActivity() {
    setActivityError(null);
    if (!activityName.trim()) {
      setActivityError("활동명을 입력해주세요.");
      return;
    }
    try {
      await addExtracurricularActivity({
        activityName: activityName.trim(),
        description: activityDescription.trim() || null,
        startDate: activityStart || null,
        endDate: activityOngoing ? null : activityEnd || null,
        isOngoing: activityOngoing,
      });
      setActivities((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          activity_name: activityName.trim(),
          description: activityDescription.trim() || null,
          start_date: activityStart || null,
          end_date: activityOngoing ? null : activityEnd || null,
          is_ongoing: activityOngoing,
        },
      ]);
      setActivityName("");
      setActivityDescription("");
      setActivityStart("");
      setActivityEnd("");
      setActivityOngoing(false);
    } catch (e) {
      setActivityError(e instanceof Error ? e.message : "추가에 실패했어요.");
    }
  }

  async function handleRemoveActivity(id: string) {
    setActivities((prev) => prev.filter((a) => a.id !== id));
    if (!id.startsWith("temp-")) {
      try {
        await removeExtracurricularActivity(id);
      } catch {
        // 조용히 무시
      }
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!hasDateOfBirth && !dateOfBirth) {
      setError("생년월일은 필수 항목입니다.");
      return;
    }
    if (!schoolName.trim()) {
      setError("학교명은 필수 항목입니다.");
      return;
    }
    if (!grade.trim()) {
      setError("학년은 필수 항목입니다.");
      return;
    }

    startTransition(async () => {
      try {
        await submitCompleteProfile({
          dateOfBirth: hasDateOfBirth ? null : dateOfBirth,
          schoolName: schoolName.trim(),
          grade: grade.trim(),
          satScore: satScore ? Number(satScore) : 0,
          gpa: gpa ? Number(gpa) : null,
          targetColleges,
          intendedMajors,
        });
        router.push("/student");
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장에 실패했어요.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="dateOfBirth" className="block text-[13px] font-bold text-ink mb-1.5">
          생년월일 <span className="text-red">*</span>
        </label>
        {hasDateOfBirth ? (
          <p className="text-[13.5px] text-grey-500 px-3.5 py-3 bg-grey-100 rounded-lg">
            이미 등록되어 있습니다. 변경이 필요하면 보호자 또는 관리자에게 요청해주세요.
          </p>
        ) : (
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            required
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
          />
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="schoolName" className="block text-[13px] font-bold text-ink mb-1.5">
          학교명 <span className="text-red">*</span>
        </label>
        <input
          id="schoolName"
          name="schoolName"
          type="text"
          required
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder="예: OO국제학교"
          className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="grade" className="block text-[13px] font-bold text-ink mb-1.5">
          학년 <span className="text-red">*</span>
        </label>
        <input
          id="grade"
          name="grade"
          type="text"
          required
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="예: 10학년"
          className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor="satScore" className="block text-[13px] font-bold text-ink mb-1.5">
            기존 SAT 점수
          </label>
          <input
            id="satScore"
            name="satScore"
            type="number"
            min={0}
            max={1600}
            value={satScore}
            onChange={(e) => setSatScore(e.target.value)}
            placeholder="없으면 0"
            className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
          />
        </div>
        <div>
          <label htmlFor="gpa" className="block text-[13px] font-bold text-ink mb-1.5">
            GPA (선택)
          </label>
          <input
            id="gpa"
            name="gpa"
            type="number"
            step="0.01"
            min={0}
            max={5}
            value={gpa}
            onChange={(e) => setGpa(e.target.value)}
            placeholder="예: 3.85"
            className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      {/* AP 이수 상황 — 구조화 리스트 */}
      <div className="mb-5">
        <label className="block text-[13px] font-bold text-ink mb-1.5">AP 이수 상황 (선택)</label>
        {apCourses.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {apCourses.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between text-[13px] bg-grey-100 rounded-lg px-3 py-2"
              >
                <span>
                  {c.course_name} · {AP_STATUS_LABEL[c.status]}
                  {c.exam_year ? ` · ${c.exam_year}년` : ""}
                  {c.score ? ` · ${c.score}점` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveApCourse(c.id)}
                  className="text-grey-500 hover:text-red text-[12px]"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 mb-1.5">
          <input
            type="text"
            value={apCourseName}
            onChange={(e) => setApCourseName(e.target.value)}
            placeholder="과목명 (예: AP Calculus BC)"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] focus:outline-none focus:border-ink"
          />
          <select
            value={apStatus}
            onChange={(e) => setApStatus(e.target.value as ApCourse["status"])}
            className="px-2 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          >
            <option value="planned">이수 예정</option>
            <option value="taking">이수 중</option>
            <option value="completed">이수 완료</option>
          </select>
        </div>
        <div className="flex gap-2 mb-1.5">
          <input
            type="number"
            value={apExamYear}
            onChange={(e) => setApExamYear(e.target.value)}
            placeholder="시험 연도 (선택)"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] focus:outline-none focus:border-ink"
          />
          <input
            type="number"
            min={1}
            max={5}
            value={apScore}
            onChange={(e) => setApScore(e.target.value)}
            placeholder="점수 1~5 (선택)"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] focus:outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={handleAddApCourse}
            className="px-3.5 py-2 bg-grey-200 rounded-lg text-[13px] font-bold hover:bg-grey-300"
          >
            추가
          </button>
        </div>
        {apError && <p className="text-[12px] text-red">{apError}</p>}
      </div>

      {/* 비교과 현황 — 구조화 리스트 */}
      <div className="mb-5">
        <label className="block text-[13px] font-bold text-ink mb-1.5">비교과 활동 현황 (선택)</label>
        {activities.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between text-[13px] bg-grey-100 rounded-lg px-3 py-2"
              >
                <span>
                  {a.activity_name}
                  {a.description ? ` · ${a.description}` : ""}
                  {a.is_ongoing ? " · 진행 중" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveActivity(a.id)}
                  className="text-grey-500 hover:text-red text-[12px]"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="text"
          value={activityName}
          onChange={(e) => setActivityName(e.target.value)}
          placeholder="활동명 (예: 교내 토론 동아리)"
          className="w-full mb-1.5 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] focus:outline-none focus:border-ink"
        />
        <textarea
          value={activityDescription}
          onChange={(e) => setActivityDescription(e.target.value)}
          placeholder="간단한 설명 (선택)"
          rows={2}
          className="w-full mb-1.5 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] focus:outline-none focus:border-ink"
        />
        <div className="flex gap-2 items-center mb-1.5">
          <input
            type="date"
            value={activityStart}
            onChange={(e) => setActivityStart(e.target.value)}
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
          <input
            type="date"
            value={activityEnd}
            onChange={(e) => setActivityEnd(e.target.value)}
            disabled={activityOngoing}
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] disabled:opacity-50"
          />
          <label className="flex items-center gap-1 text-[12px] text-grey-500 whitespace-nowrap">
            <input
              type="checkbox"
              checked={activityOngoing}
              onChange={(e) => setActivityOngoing(e.target.checked)}
            />
            진행 중
          </label>
          <button
            type="button"
            onClick={handleAddActivity}
            className="px-3.5 py-2 bg-grey-200 rounded-lg text-[13px] font-bold hover:bg-grey-300"
          >
            추가
          </button>
        </div>
        {activityError && <p className="text-[12px] text-red">{activityError}</p>}
      </div>

      {/* 목표 대학 */}
      <div className="mb-4">
        <label className="block text-[13px] font-bold text-ink mb-1.5">목표 대학 (선택)</label>
        {targetColleges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {targetColleges.map((college) => (
              <span
                key={college}
                className="flex items-center gap-1 bg-grey-100 rounded-full px-3 py-1 text-[12.5px]"
              >
                {college}
                <button
                  type="button"
                  onClick={() => setTargetColleges((prev) => prev.filter((c) => c !== college))}
                  className="text-grey-500 hover:text-red"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={targetCollegeInput}
            onChange={(e) => setTargetCollegeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(targetColleges, setTargetColleges, targetCollegeInput, () =>
                  setTargetCollegeInput("")
                );
              }
            }}
            placeholder="대학명을 입력 후 Enter"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] focus:outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={() =>
              addTag(targetColleges, setTargetColleges, targetCollegeInput, () =>
                setTargetCollegeInput("")
              )
            }
            className="px-3.5 py-2 bg-grey-200 rounded-lg text-[13px] font-bold hover:bg-grey-300"
          >
            추가
          </button>
        </div>
      </div>

      {/* 관심 전공 */}
      <div className="mb-6">
        <label className="block text-[13px] font-bold text-ink mb-1.5">관심 전공 (선택)</label>
        {intendedMajors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {intendedMajors.map((major) => (
              <span
                key={major}
                className="flex items-center gap-1 bg-grey-100 rounded-full px-3 py-1 text-[12.5px]"
              >
                {major}
                <button
                  type="button"
                  onClick={() => setIntendedMajors((prev) => prev.filter((m) => m !== major))}
                  className="text-grey-500 hover:text-red"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={intendedMajorInput}
            onChange={(e) => setIntendedMajorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(intendedMajors, setIntendedMajors, intendedMajorInput, () =>
                  setIntendedMajorInput("")
                );
              }
            }}
            placeholder="전공명을 입력 후 Enter"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] focus:outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={() =>
              addTag(intendedMajors, setIntendedMajors, intendedMajorInput, () =>
                setIntendedMajorInput("")
              )
            }
            className="px-3.5 py-2 bg-grey-200 rounded-lg text-[13px] font-bold hover:bg-grey-300"
          >
            추가
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] text-red mb-4">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26] disabled:opacity-60"
      >
        {isPending ? "저장 중..." : "프로필 완성하고 시작하기"}
      </button>
    </form>
  );
}
