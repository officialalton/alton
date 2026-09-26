// 문제은행 화면 공통 규칙(2026-09-14 제품 오너 — 생성·편집 재구성).
// "관리자가 문제별 내부 데이터 구조를 판단하지 않아도, 시험 체계와 문제 유형에 맞는 작성 흐름만 보게 한다."
import { AP_SUBJECT_BY_CODE, type ExamSystem } from "@/lib/problem-taxonomy";
import type { MaterialNeed } from "@/lib/problem-material-need";

export const FORMAT_LABEL: Record<string, string> = { mc: "객관식", spr: "숫자 입력(SPR)", essay: "서술형", math: "풀이형" };

/** 문항 체계별로 고를 수 있는 답안 형식. AP 는 과목별(지원 과목이 없어 지금은 비어 있다). */
export function formatsForExamSystem(system: ExamSystem | null, apSubject?: string | null): string[] {
  if (system === "sat_rw") return ["mc"];
  if (system === "sat_math") return ["mc", "spr"];
  if (system === "ap") return AP_SUBJECT_BY_CODE.get(apSubject ?? "")?.formats ?? [];
  // 미지정(옛 문제): 전부 — 숨겨서 잃는 값이 없게.
  return ["mc", "spr", "essay", "math"];
}

/** 편집 화면에서 어떤 구역을 보이는가. 숨긴 값은 지우지 않고 저장 때 그대로 넘긴다. */
export type EditorVisibility = {
  /** 로마숫자 진술(Math 객관식 전용). */
  statements: boolean;
  /** SPR 정답 입력. */
  spr: boolean;
  /** 자료 구역(도형·좌표평면·표/그래프·그래프 선택지). */
  material: boolean;
  /** 자료 구역에서 보이는 도구. */
  tools: ("plane" | "geometry" | "data" | "figure_choice" | "figure_set")[];
  /** 그림 파일 올리기(Math 전용). */
  upload: boolean;
  /** 도형 데이터 고급 편집(JSON). */
  advancedJson: boolean;
  /** RW 구조 요약·유형별 안내. */
  rwHints: boolean;
  /** 옛 문제(체계 미지정) — 전부 보인다. */
  legacyAll: boolean;
};

export function editorVisibility(input: { examSystem: string | null; format: string; need: MaterialNeed; hasStatements: boolean; hasFigure: boolean; text: string }): EditorVisibility {
  const { examSystem, format, need } = input;
  if (examSystem === "sat_rw") {
    // 지문·질문·선택지·정답·해설만 기본. 유형이 정량 근거면 표·그래프 자료만 추가.
    const material = need.kind === "data" || (input.hasFigure && need.level !== "none");
    return { statements: false, spr: false, material, tools: material ? ["data"] : [], upload: false, advancedJson: false, rwHints: true, legacyAll: false };
  }
  if (examSystem === "sat_math") {
    const tools: EditorVisibility["tools"] = [];
    if (need.kind) tools.push(need.kind);
    // 좌표·데이터 문항에서 지문이 두 자료(Figure A / Table B)를 부르면 복수 자료 도구도 보인다.
    if (/\b(Figure [AB]|Table [AB]|Graph [AB])\b/.test(input.text) && !tools.includes("figure_set")) tools.push("figure_set");
    return {
      statements: format === "mc",
      spr: format === "spr",
      material: need.level !== "none" || input.hasFigure,
      tools,
      upload: need.level !== "none" || input.hasFigure,
      advancedJson: true,
      rwHints: false,
      legacyAll: false,
    };
  }
  if (examSystem === "ap") {
    return { statements: false, spr: false, material: false, tools: [], upload: false, advancedJson: false, rwHints: false, legacyAll: false };
  }
  return { statements: format === "mc", spr: format === "spr", material: true, tools: ["geometry", "plane", "data", "figure_choice", "figure_set"], upload: true, advancedJson: true, rwHints: true, legacyAll: true };
}

/** 문항 체계·답안 형식을 바꿀 때 무엇이 유지되고 무엇이 비활성화되는지(숨김 — 삭제 아님). */
export function compatibilityPreview(input: {
  from: { examSystem: string | null; format: string };
  to: { examSystem: string | null; format: string };
  content: { hasOptions: boolean; hasAnswers: boolean; hasStatements: boolean; figureType: string | null; hasSkill: boolean };
}): { kept: string[]; disabled: string[] } {
  const kept: string[] = ["지문 / 자료 본문", "질문", "해설", "관리 과목·키워드"];
  const disabled: string[] = [];
  const c = input.content;
  const toRw = input.to.examSystem === "sat_rw";
  const toAp = input.to.examSystem === "ap";
  const systemChanged = input.from.examSystem !== input.to.examSystem;
  if (systemChanged && c.hasSkill) disabled.push("시험 분류(영역·세부 기술) — 새 체계에서 다시 고릅니다");
  if (input.to.format === "mc") { if (c.hasOptions) kept.push("선택지·정답"); } else if (c.hasOptions) disabled.push("선택지·정답(객관식 전용)");
  if (input.to.format === "spr") { if (c.hasAnswers) kept.push("SPR 정답"); } else if (c.hasAnswers) disabled.push("SPR 정답(숫자 입력 전용)");
  if (c.hasStatements) { if (input.to.format === "mc" && !toRw && !toAp) kept.push("로마숫자 진술"); else disabled.push("로마숫자 진술(SAT Math 객관식 전용)"); }
  if (c.figureType) {
    const dataLike = c.figureType === "data" || c.figureType === "figure_set" || c.figureType === "image";
    if (toAp) disabled.push(`자료(${c.figureType}) — AP 는 준비 중`);
    else if (toRw && !dataLike) disabled.push(`도형·좌표평면·그래프 선택지 자료(${c.figureType}) — R&W 에서는 표·그래프 자료만`);
    else kept.push(`자료(${c.figureType})`);
  }
  return { kept, disabled };
}
