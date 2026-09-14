import { describe, expect, it } from "vitest";
import {
  formatCurriculumProgressLabel,
  loadCurriculumOverlayProgressByEnrollment,
  getCurriculumOverlayProgress,
} from "./curriculum-overlay-progress";

function makeSupabaseMock(overlays: unknown[], units: unknown[]) {
  return {
    from: (table: string) => {
      if (table === "student_curriculum_overlays") {
        return { select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: overlays }) }) }) };
      }
      if (table === "curriculum_overlay_units") {
        return { select: () => ({ in: () => Promise.resolve({ data: units }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("formatCurriculumProgressLabel", () => {
  it("전체 단원이 0개면 '진도 미시작 · 회차 0개'", () => {
    expect(formatCurriculumProgressLabel({ totalUnits: 0, doneUnits: 0, sourceLabel: null })).toBe(
      "진도 미시작 · 회차 0개"
    );
  });

  it("수업 전(완료 0)이면 '진도 미시작 · 회차 N개'", () => {
    expect(formatCurriculumProgressLabel({ totalUnits: 12, doneUnits: 0, sourceLabel: "공통 커리큘럼 기준" })).toBe(
      "진도 미시작 · 회차 12개"
    );
  });

  it("진행 중이면 '진행 N / 전체 M회차'이고 '0/0회차'나 단순 '운영 커리큘럼' 표기가 없다", () => {
    const label = formatCurriculumProgressLabel({ totalUnits: 12, doneUnits: 3, sourceLabel: "교사 운영 커리큘럼 기준" });
    expect(label).toBe("진행 3 / 전체 12회차");
    expect(label).not.toContain("0/0");
    expect(label).not.toBe("운영 커리큘럼");
  });
});

describe("loadCurriculumOverlayProgressByEnrollment", () => {
  it("완료(completed)·건너뜀(skipped)만 진행분으로 세고, reinforcement_needed/in_progress/not_started는 세지 않는다", async () => {
    const supabase = makeSupabaseMock(
      [{ id: "ov1", subject_enrollment_id: "e1" }],
      [
        { overlay_id: "ov1", status: "completed", source_kind: "teacher_template" },
        { overlay_id: "ov1", status: "skipped", source_kind: "teacher_template" },
        { overlay_id: "ov1", status: "reinforcement_needed", source_kind: "teacher_template" },
        { overlay_id: "ov1", status: "in_progress", source_kind: "teacher_template" },
        { overlay_id: "ov1", status: "not_started", source_kind: "teacher_template" },
      ]
    );
    const map = await loadCurriculumOverlayProgressByEnrollment(supabase, ["e1"]);
    const progress = getCurriculumOverlayProgress(map, "e1");
    expect(progress.totalUnits).toBe(5);
    expect(progress.doneUnits).toBe(2);
    expect(progress.sourceLabel).toBe("교사 운영 커리큘럼 기준");
  });

  it("단원 출처에 teacher_template이 하나도 없으면 '공통 커리큘럼 기준'", async () => {
    const supabase = makeSupabaseMock(
      [{ id: "ov1", subject_enrollment_id: "e1" }],
      [
        { overlay_id: "ov1", status: "not_started", source_kind: "subject_template" },
        { overlay_id: "ov1", status: "not_started", source_kind: "student_added" },
      ]
    );
    const map = await loadCurriculumOverlayProgressByEnrollment(supabase, ["e1"]);
    expect(getCurriculumOverlayProgress(map, "e1").sourceLabel).toBe("공통 커리큘럼 기준");
  });

  it("활성 오버레이가 아예 없는 subject_enrollment는 기본값(전체 0)을 반환한다", async () => {
    const supabase = makeSupabaseMock([], []);
    const map = await loadCurriculumOverlayProgressByEnrollment(supabase, ["e1"]);
    const progress = getCurriculumOverlayProgress(map, "e1");
    expect(progress).toEqual({ totalUnits: 0, doneUnits: 0, sourceLabel: null });
  });

  it("빈 목록이면 조회 없이 빈 Map을 반환한다", async () => {
    const map = await loadCurriculumOverlayProgressByEnrollment({} as never, []);
    expect(map.size).toBe(0);
  });
});
