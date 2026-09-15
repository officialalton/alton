"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { sanitizeDocHtml } from "@/lib/sanitize-doc-html";
import { stripInlineOptions } from "@/lib/problem-text";
import { TEMPLATE_FIGURE_TYPES, validateFigureSpec } from "@/lib/problem-figures/spec";
import { findProblemSkill } from "@/lib/problem-skills";
import type { DocProblem, DocSection, DocEditorData } from "./curriculum-doc-data";
import { loadCurriculumDocDetail } from "./curriculum-doc-data";
import type { SubjectKeyword } from "./subject-data";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase, user };
}

// 2026-09-10(P1 성능 배치) — "교재 문서" 목록은 경량 목록(loadCurriculumDocList)만
// SSR로 받는다. 관리자가 실제로 문서를 열 때(편집 화면 진입)만 이 액션으로
// 섹션·문제·키워드 전체를 조회한다.
export async function getCurriculumDocDetailAction(docId: string): Promise<DocEditorData | null> {
  const { supabase } = await requireAdmin();
  return loadCurriculumDocDetail(supabase, docId);
}

export async function createCurriculumDoc(params: {
  title: string;
  subjectId: string;
  unitId: string | null;
}): Promise<{ id: string }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("curriculum_docs")
    .insert({
      title: params.title,
      subject_id: params.subjectId,
      unit_id: params.unitId,
      owner_type: "admin",
      owner_teacher_id: null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDocTitle(docId: string, title: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_docs")
    .update({ title })
    .eq("id", docId);
  if (error) throw new Error(error.message);
}

export async function setDocPublished(docId: string, published: boolean): Promise<void> {
  const { supabase } = await requireAdmin();

  // 상태 변경과 버전 생성을 한 트랜잭션으로 묶는다(20261331000000).
  //
  // 예전에는 UPDATE 한 번, 캡처 RPC 한 번이라 캡처가 실패해도 상태 변경은 이미
  // 커밋돼 있었다 — "공개됐는데 그 시점 내용은 남지 않은" 상태가 남는다. 동시
  // 요청이 같은 버전 번호를 계산해 깨지는 것도 DB 쪽 advisory lock 으로 막는다.
  const { error } = await supabase.rpc("publish_curriculum_doc", {
    p_doc_id: docId,
    p_published: published,
  });
  if (error) throw new Error(error.message);
}

export async function addSection(
  docId: string,
  nextPosition: number,
  sectionType: "concept" | "problem"
): Promise<DocSection> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("curriculum_doc_sections")
    .insert({
      curriculum_doc_id: docId,
      position: nextPosition,
      title: "새 섹션",
      body: "",
      section_type: sectionType,
    })
    .select("id, position, title, body, teaching_tip, section_type")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    position: data.position,
    title: data.title,
    body: data.body ?? "",
    teachingTip: data.teaching_tip,
    sectionType: data.section_type,
    problems: [],
  };
}

export async function updateSection(
  sectionId: string,
  fields: { title?: string; body?: string; teachingTip?: string }
): Promise<void> {
  const { supabase } = await requireAdmin();
  const patch: Record<string, string | null> = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.body !== undefined) patch.body = sanitizeDocHtml(fields.body);
  if (fields.teachingTip !== undefined)
    patch.teaching_tip = fields.teachingTip ? sanitizeDocHtml(fields.teachingTip) : null;

  const { error } = await supabase
    .from("curriculum_doc_sections")
    .update(patch)
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
}

export async function removeSection(sectionId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_doc_sections")
    .delete()
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
}

export async function moveSection(sectionId: string, otherSectionId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: rows, error } = await supabase
    .from("curriculum_doc_sections")
    .select("id, position")
    .in("id", [sectionId, otherSectionId]);
  if (error) throw new Error(error.message);
  if (!rows || rows.length !== 2) return;

  const [a, b] = rows;
  const TEMP_OFFSET = -1000000;
  await supabase.from("curriculum_doc_sections").update({ position: TEMP_OFFSET }).eq("id", a.id);
  await supabase.from("curriculum_doc_sections").update({ position: a.position }).eq("id", b.id);
  await supabase.from("curriculum_doc_sections").update({ position: b.position }).eq("id", a.id);
}

// =========================================================================
// R9(Task 2) — 교재 조각(section)/문제 키워드 태깅
// DB 트리거(20261228000000_r9_curriculum_content_foundation.sql)가 "공개된
// 교재의 섹션만", "확정된 문제만" 관계에 들어갈 수 있게 막는다 — 여기서는
// 과목 불일치를 먼저 걸러 더 읽기 쉬운 에러를 주고, 그 외에는 트리거 에러를
// 그대로 올린다(예: draft 교재에 태그 시도).
// =========================================================================

// 2026-09-10(P0-2 확장) — Minified React error #441 마스킹 버그가 이
// 파일의 섹션·문제 키워드 액션에도 그대로 있었다(관리자 "교재 문서" 편집
// 화면에서 실사용 재현 — 이미 subject-actions.ts/session-prep-actions.ts에
// 적용한 것과 동일한 수정: throw 대신 { ok, error } 반환). 다만 이 파일이
// 호출부에서 쓰는 `KeywordTagger` 공용 컴포넌트는 Promise reject 계약을
// 그대로 쓰므로, 서버 액션 자체는 { ok, error }로 경계를 건너오고
// CurriculumDocEditor.tsx의 각 콜백이 그 결과를 다시 throw로 바꿔
// KeywordTagger의 기존 try/catch에 그대로 맞춘다(공용 컴포넌트 계약은
// 바꾸지 않음).
export type KeywordActionResult = { ok: true } | { ok: false; error: string };

/**
 * 교재의 대표 키워드를 지정하거나 바꾼다(교재당 1개). null이면 해제한다.
 *
 * 대표 키워드는 "이 교재가 어느 키워드의 기본 교재인가"를 말한다 — 회차에 그
 * 키워드가 붙으면 이 교재가 자동으로 구성에 들어간다. 그래서 섹션별 키워드
 * 태깅과는 다른 층이다: 섹션 키워드는 "이 조각이 무엇을 다루는가"(후보 검색용),
 * 대표 키워드는 "이 교재를 어디에 기본으로 넣을 것인가"(자동 구성용).
 *
 * 바꿔도 이미 구성에 들어간 교재가 회수되지는 않는다 — 선생님이 운영 중인 회차의
 * 자동분은 다음 키워드 변경 때 맞춰진다. 과거 수업에 고정된 내용은 스냅샷이라
 * 어느 쪽이든 영향을 받지 않는다.
 */
/**
 * 교재를 보관하거나 보관을 푼다.
 *
 * **삭제가 아니다.** 보관된 교재는 신규 선택과 자동 구성 후보에서 빠지지만,
 * 이미 회차에 담긴 것과 과거 수업에 고정된 내용은 그대로다 — 과거 수업이 읽는
 * 것은 시작 시점의 매니페스트 스냅샷이고 그 조회는 id로 한다.
 *
 * 보관하면 이 교재를 대표 키워드로 쓰던 회차들의 자동 구성이 다시 맞춰진다
 * (curriculum_docs_resync 트리거) — 선생님이 직접 담은 것은 건드리지 않는다.
 */
/**
 * 교재가 속한 단원을 바꾼다. null이면 단원 없음.
 *
 * 교재를 만들 때 단원을 안 정했으면 나중에 정할 길이 없었다 — 편집 화면에
 * 그 입력이 아예 없어서, 다시 만드는 것 말고는 방법이 없었다.
 */
export async function setDocUnit(
  docId: string,
  unitId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();

  if (unitId) {
    // 다른 과목의 단원을 붙이면 교재가 과목 경계를 넘어 새어 나간다.
    const [{ data: doc }, { data: unit }] = await Promise.all([
      supabase.from("curriculum_docs").select("subject_id").eq("id", docId).maybeSingle(),
      supabase.from("subject_template_units").select("subject_id").eq("id", unitId).maybeSingle(),
    ]);
    if (!doc || !unit) return { ok: false, error: "존재하지 않는 교재 또는 단원입니다." };
    if (doc.subject_id !== unit.subject_id) {
      return { ok: false, error: "교재와 단원은 같은 과목이어야 합니다." };
    }
  }

  const { error } = await supabase
    .from("curriculum_docs")
    .update({ unit_id: unitId })
    .eq("id", docId);
  if (error) {
    console.error(JSON.stringify({ event: "set_doc_unit_failed", message: error.message }));
    return { ok: false, error: "단원을 저장하지 못했습니다." };
  }
  return { ok: true };
}

export async function setDocArchived(
  docId: string,
  archived: boolean,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_docs")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_reason: archived ? reason?.trim() || null : null,
    })
    .eq("id", docId);
  if (error) {
    console.error(JSON.stringify({ event: "set_doc_archived_failed", message: error.message }));
    return { ok: false, error: archived ? "보관하지 못했습니다." : "보관을 풀지 못했습니다." };
  }
  return { ok: true };
}

export async function setDocPrimaryKeyword(
  docId: string,
  keywordId: string | null,
  position?: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();

  if (keywordId) {
    const [{ data: doc }, { data: keyword }] = await Promise.all([
      supabase.from("curriculum_docs").select("subject_id").eq("id", docId).maybeSingle(),
      supabase.from("subject_keywords").select("subject_id").eq("id", keywordId).maybeSingle(),
    ]);
    if (!doc || !keyword) return { ok: false, error: "존재하지 않는 교재 또는 키워드입니다." };
    // 트리거가 방어선이지만, 여기서 먼저 걸러 읽을 만한 문구를 준다.
    if (doc.subject_id !== keyword.subject_id) {
      return { ok: false, error: "대표 키워드는 교재와 같은 과목이어야 합니다." };
    }
  }

  const { error } = await supabase
    .from("curriculum_docs")
    .update({
      primary_keyword_id: keywordId,
      // 키워드를 해제하면 그 안의 순서도 의미가 없다.
      primary_keyword_position: keywordId ? position ?? null : null,
    })
    .eq("id", docId);
  if (error) return { ok: false, error: "대표 키워드를 저장하지 못했습니다." };
  return { ok: true };
}

export async function assignSectionKeyword(
  sectionId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();

  const { data: section } = await supabase
    .from("curriculum_doc_sections")
    .select("curriculum_doc_id, doc:curriculum_docs(subject_id, status)")
    .eq("id", sectionId)
    .single();
  const docRow = Array.isArray(section?.doc) ? section?.doc[0] : section?.doc;
  const { data: keyword } = await supabase
    .from("subject_keywords")
    .select("subject_id")
    .eq("id", keywordId)
    .single();
  if (!docRow || !keyword) return { ok: false, error: "존재하지 않는 섹션 또는 키워드입니다." };
  if (docRow.subject_id !== keyword.subject_id) {
    return { ok: false, error: "교재와 키워드는 같은 과목이어야 합니다." };
  }

  const { error } = await supabase
    .from("curriculum_doc_section_keywords")
    .insert({ section_id: sectionId, keyword_id: keywordId });
  if (error && error.code !== "23505") {
    // 23505(이미 태그됨)는 멱등 처리 — 에러 아님.
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeSectionKeyword(
  sectionId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_doc_section_keywords")
    .delete()
    .eq("section_id", sectionId)
    .eq("keyword_id", keywordId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function assignProblemKeyword(
  problemId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();

  const { data: problem } = await supabase
    .from("problems")
    .select("subject_id, status")
    .eq("id", problemId)
    .single();
  const { data: keyword } = await supabase
    .from("subject_keywords")
    .select("subject_id")
    .eq("id", keywordId)
    .single();
  if (!problem || !keyword) return { ok: false, error: "존재하지 않는 문제 또는 키워드입니다." };
  if (problem.subject_id && problem.subject_id !== keyword.subject_id) {
    return { ok: false, error: "문제와 키워드는 같은 과목이어야 합니다." };
  }

  const { error } = await supabase
    .from("problem_keywords")
    .insert({ problem_id: problemId, keyword_id: keywordId });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeProblemKeyword(
  problemId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("problem_keywords")
    .delete()
    .eq("problem_id", problemId)
    .eq("keyword_id", keywordId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type CreateSubjectKeywordForDocResult =
  | { ok: true; value: SubjectKeyword }
  | { ok: false; error: string };

export async function createSubjectKeywordForDoc(
  subjectId: string,
  label: string
): Promise<CreateSubjectKeywordForDocResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("subject_keywords")
    .insert({ subject_id: subjectId, label })
    .select("id, label, status")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "이미 존재하는 키워드입니다." };
    return { ok: false, error: error.message };
  }
  return { ok: true, value: { id: data.id, label: data.label, status: data.status } };
}

export type ProblemFormat = "mc" | "spr" | "essay" | "math";
/** 그림 요구(2026-09-14): 모델 재량에 맡기면 도형이 거의 안 나온다 — 필수면 그림 없는 문항은 버린다. */
export type FigurePolicy = "none" | "optional" | "require_plane" | "require_geometry";

/** 표준 렌더링 엔진 템플릿 1 — AI 도구 스키마 설명(2026-09-14). 좌표 없이 관계만. */
const PARALLEL_TRANSVERSAL_DESC =
  "평행선·횡단선·각(표준 템플릿, 좌표 없음 — 관계만): {type:'parallel_transversal', parallel:['m','n'](위,아래 평행선 이름 2개), transversals:[{id:'k'}](1~2개), points:[{id:'A', on:['m','k']}](교점 이름, 선택), angles:[{at:['m','k'], region:'NE'|'NW'|'SE'|'SW', label:'x°'}](어느 교점·어느 사분면·라벨; 라벨은 평문 'x°','37°','(2x + 10)°'), notToScale:true}. 지문이 말하는 선·점·각 이름은 여기 반드시 있어야 하고, 지문에 없는 것을 넣지 않는다. region 은 그림 배치용 내부 값이다 — **지문에는 north/south/east/west, region, quadrant 같은 방위 표현을 절대 쓰지 말고**(쓰면 검증에서 거부된다) 예: 'In the figure, lines m and n are parallel and line k is a transversal. If the angle marked 37° ... , what is the value of x?' 처럼 시험 문제처럼 \"the angle marked (3x + 25)°\", \"the angle at A\" 로 부른다. 평행선 3개·수직 횡단선·삼각형이 섞인 그림은 이 템플릿으로 만들 수 없다 — 그런 문항은 만들지 않는다.";
/** 표준 렌더링 엔진 템플릿 3 — 좌표평면(객체 id 기반). */
const PLANE_DESC =
  "좌표평면(표준 템플릿, 객체 id 기반): {type:'plane', axes:{x:{min,max,step?,title?:'Time (hours)'}, y:{min,max,step?,title?:'Cost (dollars)'}}, objects:[ {id:'P', kind:'point', at:[x,y], label:'P', open?}, {id:'l1', kind:'line', slope, intercept, label:'ℓ'} 또는 {kind:'line', through:['P','Q']}, {id:'f', kind:'function', fn:'linear'|'quadratic'|'exponential'|'abs'|'sqrt'|'cubic', params:[...](linear [a,b]=ax+b, quadratic [a,b,c], cubic [a,b,c,d], exponential [a,base,c]=a·base^x+c, abs [a,h,k]=a|x−h|+k, sqrt [a,h,k]=a√(x−h)+k), label:'f', domain?}, {id:'s', kind:'segment', from:'A', to:'B'}, {id:'d', kind:'scatter', points:[[x,y],...], fitLine?:{slope,intercept}} ]}. 격자·축·화살표·눈금 숫자·원점 O·라벨 자리는 렌더러가 정한다 — 좌표만 정확히. 지문에 나오는 좌표·점 이름·직선 이름·식(y = 2x − 3 등)은 데이터와 정확히 같아야 하고, 지문의 (x, y) 좌표는 점 객체이거나 어떤 그래프 위에 있어야 한다. 그래프가 축 범위 안에 잘 보이도록 min/max 를 잡는다.";
/** 표준 렌더링 엔진 템플릿 2 — 삼각형·직각삼각형·합동/닮음. 좌표 없이 관계만. */
const TRIANGLE_DESC =
  "삼각형(표준 템플릿, 좌표 없음 — 관계만): {type:'triangle', vertices:['A','B','C'](꼭짓점 3개; 표준 배치는 첫째 위, 둘째 왼쪽 아래, 셋째 오른쪽 아래), kind:'right'|'isosceles'|'equilateral'|'scalene', rightAngleAt:'B'(직각 꼭짓점; kind 'right' 면 필수), sides:[{between:['A','B'], label:'6', tick:1}](변 길이 라벨·등변 눗금 1~3), angles:[{at:'C', label:'37°', tick:1}](각 라벨·등각 호 1~2; 직각 꼭짓점엔 라벨 없음), altitude:{from:'A', foot:'D', label:'h'}(높이, 선택), second:{vertices:['D','E','F'], scale:0.6, sides, angles}(합동·닮음용 두 번째 삼각형, 다른 이름), notToScale:true}. " +
  "지문이 부르는 점·변·각·길이·직각은 데이터에 반드시 있고 값이 같아야 한다(지문 AB = 6 이면 sides 에 AB 라벨 '6'). 지문에 없는 라벨을 넣지 않는다. 라벨은 평문('6', 'x', '37°', 'θ', '√2').";
const FIGURE_POLICY_RULE: Record<FigurePolicy, string> = {
  none: "figure 를 만들지 않는다. 그림 없이 풀 수 있는 문항만 만든다.",
  optional: "그래프·도형이 꼭 필요한 문항에만 figure 데이터를 넣는다.",
  require_plane: "**모든 문항에 figure(type:'plane') 데이터가 있어야 한다.** 그래프를 읽어야만 풀 수 있는 문항(절편·교점·기울기·해 읽기·최솟값 등)으로 만든다. AI 는 좌표와 식만 정확히 내고 그림은 그리지 않는다. 지문의 좌표·점·직선 이름·식이 데이터와 정확히 같아야 하고, 답이 그림에 글자로 드러나지 않게 한다. 좌표를 자유롭게 찍는 옛 형식(type:'coordinate_plane')은 쓰지 않는다.",
  require_geometry: "**모든 문항에 표준 도형 템플릿 figure 데이터가 있어야 한다** — type 'parallel_transversal'(평행선 2개를 횡단선이 가로지르는 각 문제) 또는 'triangle'(삼각형·직각삼각형·합동/닮음). AI 는 좌표나 그림을 그리지 않고 **관계만** 낸다. 지문에서 부르는 선·점·변·각 이름과 값이 데이터와 정확히 같아야 한다. 라벨은 평문. 지문에는 north/south/east/west, region, quadrant 같은 방위 표현을 절대 쓰지 말고(검증에서 거부된다) 시험 문제처럼 \"the angle marked 37°\", \"the angle at A\", \"AB = 6\" 으로 부른다. 원·사각형·평행선 3개 등 두 템플릿으로 그릴 수 없는 문항은 만들지 않는다.",
};
export type ProblemDifficulty = "easy" | "medium" | "hard";

const FORMAT_LABEL: Record<ProblemFormat, string> = {
  mc: "객관식",
  spr: "숫자 입력(SPR)",
  essay: "서술형",
  math: "풀이형",
};

export async function generateSectionProblems(params: {
  sectionTitle: string;
  subjectName: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  count: number;
  figurePolicy?: FigurePolicy;
}): Promise<Omit<DocProblem, "id" | "keywords">[]> {
  await requireAdmin();
  const { sectionTitle, subjectName, skillType, difficulty, format, count } = params;
  const figurePolicy: FigurePolicy = params.figurePolicy ?? "optional";
  const clampedCount = Math.max(1, Math.min(10, count));

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    tools: [
      {
        name: "generate_problems",
        description: "SAT/AP 교재 섹션에 귀속될 문제 은행용 문제를 조건에 맞춰 생성한다.",
        input_schema: {
          type: "object",
          properties: {
            problems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  passage: {
                    type: "string",
                    description:
                      format === "mc"
                        ? "지문과 문제. 빈칸이 필요하면 ______로 표시. 선택지(A~D)는 여기에 쓰지 말고 options 에만 넣는다."
                        : "문제 지문",
                  },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description: "객관식일 때만 정확히 4개의 선택지",
                  },
                  correct_index: {
                    type: "number",
                    description: "객관식일 때만, 정답 선택지의 0-based 인덱스",
                  },
                  answers: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "숫자 입력(SPR)일 때만. 동치 정답 목록(예: [\"7/2\",\"3.5\"]). 정수·소수·분수 문자열, 기호 없이.",
                  },
                  figure: {
                    type: "object",
                    description:
                      "그래프·도형이 꼭 필요한 수학 문항에만. 그림 파일이 아니라 데이터다. " +
                      PLANE_DESC + " " +
                      "기하(둘 중 하나): " + PARALLEL_TRANSVERSAL_DESC + " " + TRIANGLE_DESC + " " +
                      "좌표평면의 좌표는 문제의 수치와 정확히 일치해야 한다. 좌표를 직접 찍는 옛 기하 형식(type:'geometry')은 쓰지 않는다.",
                  },
                  explanation: {
                    type: "string",
                    description: format === "mc" ? "정답 해설" : format === "spr" ? "풀이 과정과 정답" : "모범 답안 또는 풀이 과정",
                  },
                },
                required: ["passage", "explanation"],
              },
            },
          },
          required: ["problems"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "generate_problems" },
    messages: [
      {
        role: "user",
        content: `다음 조건에 맞는 SAT/AP 교재용 문제 ${clampedCount}개를 생성해주세요.
- 과목: ${subjectName}
- 교재 섹션: ${sectionTitle}
- 문제 유형(스킬): ${findProblemSkill(skillType)?.label ?? skillType}
- 난이도: ${difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "어려움"}
- 답안 형식: ${FORMAT_LABEL[format]}
${findProblemSkill(skillType) ? `유형 규칙(실제 SAT/AP 문항 말투를 그대로 따른다): ${findProblemSkill(skillType)!.rule}` : ""}
${format === "mc" ? "객관식은 반드시 선택지 4개와 정답 인덱스를 포함해주세요." : ""}
${format === "spr" ? "숫자 입력(SPR)은 SAT Math 학생 직접 입력 문항입니다: 정답이 하나의 수(정수·소수·분수)로 정해져야 하고, answers 에 동치 표현을 모두 넣어주세요(예: 7/2 와 3.5). 선택지는 만들지 마세요. 양수는 5자, 음수는 6자 안에 쓸 수 있는 값이어야 합니다." : ""}
언어: 문항(지문·질문·선택지·SPR 정답)은 실제 SAT/AP 시험과 같이 **영어**로 쓴다. 해설(explanation)만 한국어로 쓴다.
표기 규칙: 수식은 LaTeX 로 $…$(인라인)·$$…$$(블록) 안에 쓴다. 표가 필요하면 마크다운 파이프 표(| x | f(x) | / |---|---| / | 0 | 17 |)로 쓴다.
그림 규칙: ${FIGURE_POLICY_RULE[figurePolicy]}
선택지 규칙: 값이 숫자·식이면 선택지에 "x =" 같은 변수 이름을 붙이지 않고 값만 쓴다(예: "118", "$\\frac{3}{2}$", "$4x^2 - 1$"). 단위·기호(°, $, %)는 문제 문장에 두고 선택지에는 붙이지 않는다(SAT 관례). 각도는 LaTeX 로 $118^\\circ$ 로 쓴다.
이 문제들은 특정 학생이 아니라 이 교재를 배정받는 어떤 학생에게도 재사용될 문제
은행에 들어갑니다. 실전 SAT/AP 시험에 나올 법한 퀄리티로 만들어주세요.`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  type RawProblem = {
    passage: string;
    options?: string[];
    correct_index?: number;
    answers?: string[];
    figure?: unknown;
    explanation: string;
  };
  const input = toolUse.input as { problems?: unknown };
  // 모델이 배열 대신 객체({"0": {...}} 또는 문제 하나)를 주는 경우가 있다 — 배열로 정규화한다.
  const rawList: RawProblem[] = Array.isArray(input.problems)
    ? (input.problems as RawProblem[])
    : input.problems && typeof input.problems === "object"
      ? ("passage" in (input.problems as object)
          ? [input.problems as RawProblem]
          : (Object.values(input.problems as Record<string, RawProblem>) as RawProblem[]))
      : [];
  const raw = rawList.filter((p) => p && typeof p.passage === "string");
  if (raw.length === 0) throw new Error("AI 응답에 문제가 없습니다.");

  const requiredTypes: readonly string[] | null =
    figurePolicy === "require_plane" ? ["plane"] : figurePolicy === "require_geometry" ? TEMPLATE_FIGURE_TYPES : null;
  const kept = requiredTypes
    ? raw.filter((p) => {
        const v = p.figure ? validateFigureSpec(p.figure) : null;
        return Boolean(v && v.ok && requiredTypes.includes(v.spec.type));
      })
    : raw;
  if (kept.length === 0) throw new Error("요구한 그림이 있는 문항이 하나도 만들어지지 않았습니다. 유형·개수를 바꿔 다시 시도하세요.");

  return kept.map((p) => ({
    format,
    // 그림 데이터는 모양이 맞을 때만 받는다 — 틀리면 그림 없는 문제로 두고 사람이 붙인다.
    figure: p.figure && validateFigureSpec(p.figure).ok ? p.figure : null,
    // 모델이 지문 끝에 선택지를 또 써도 저장 전에 뗀다 — 화면에서 두 번 보였다(2026-09-14).
    passage: stripInlineOptions(p.passage, p.options ?? null),
    options: format === "mc" ? p.options ?? null : null,
    correctIndex: format === "mc" ? p.correct_index ?? null : null,
    answers: format === "spr" ? (p.answers ?? []).map(String).filter(Boolean) : null,
    explanation: p.explanation,
    difficulty,
  }));
}

export async function regenerateProblem(params: {
  sectionTitle: string;
  subjectName: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  current: Omit<DocProblem, "id" | "keywords">;
  feedback: string;
}): Promise<Omit<DocProblem, "id" | "keywords">> {
  await requireAdmin();
  const { sectionTitle, subjectName, skillType, difficulty, format, current, feedback } = params;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "regenerate_problem",
        description: "기존 문제 초안을 선생님 피드백에 맞춰 수정한 새 버전을 생성한다.",
        input_schema: {
          type: "object",
          properties: {
            passage: { type: "string", description: "문제 지문. 선택지(A~D)는 여기에 쓰지 말고 options 에만 넣는다." },
            options: {
              type: "array",
              items: { type: "string" },
              description: "객관식일 때만 정확히 4개의 선택지",
            },
            correct_index: {
              type: "number",
              description: "객관식일 때만, 정답 선택지의 0-based 인덱스",
            },
            answers: {
              type: "array",
              items: { type: "string" },
              description: "숫자 입력(SPR)일 때만. 동치 정답 목록(예: [\"7/2\",\"3.5\"]).",
            },
            figure: { type: "object", description: "그래프·도형 데이터(generate_problems 의 figure 와 같은 모양). 필요할 때만." },
            explanation: {
              type: "string",
              description: format === "mc" ? "정답 해설" : format === "spr" ? "풀이 과정과 정답" : "모범 답안 또는 풀이 과정",
            },
          },
          required: ["passage", "explanation"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "regenerate_problem" },
    messages: [
      {
        role: "user",
        content: `아래 문제 초안을 선생님 피드백에 맞춰 수정해주세요.
- 과목: ${subjectName}
- 교재 섹션: ${sectionTitle}
- 문제 유형(스킬): ${skillType}
- 난이도: ${difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "어려움"}
- 답안 형식: ${FORMAT_LABEL[format]}

현재 초안:
지문: ${current.passage}
${current.options ? `선택지: ${current.options.join(" / ")}` : ""}
${current.correctIndex !== null ? `정답 인덱스: ${current.correctIndex}` : ""}
해설/모범답안: ${current.explanation}

선생님 피드백: ${feedback}

이 피드백을 반영해 문제를 다시 작성해주세요.${
          format === "mc" ? " 객관식은 반드시 선택지 4개와 정답 인덱스를 포함해주세요." : ""
        }`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  const raw = toolUse.input as {
    passage: string;
    options?: string[];
    correct_index?: number;
    answers?: string[];
    figure?: unknown;
    explanation: string;
  };

  return {
    format,
    passage: stripInlineOptions(raw.passage, raw.options ?? null),
    options: format === "mc" ? raw.options ?? null : null,
    correctIndex: format === "mc" ? raw.correct_index ?? null : null,
    answers: format === "spr" ? (raw.answers ?? []).map(String).filter(Boolean) : null,
    figure: raw.figure && validateFigureSpec(raw.figure).ok ? raw.figure : null,
    explanation: raw.explanation,
    difficulty,
  };
}

export async function confirmSectionProblems(
  sectionId: string,
  subjectId: string,
  drafts: Omit<DocProblem, "id" | "keywords">[]
): Promise<DocProblem[]> {
  const { supabase, user } = await requireAdmin();

  const created: DocProblem[] = [];
  for (const draft of drafts) {
    const { data, error } = await supabase
      .from("problems")
      .insert({
        format: draft.format,
        passage: draft.passage,
        options: draft.options,
        correct_index: draft.correctIndex,
        explanation: draft.explanation,
        difficulty: draft.difficulty,
        subject_id: subjectId,
        section_id: sectionId,
        status: "confirmed",
        created_by: user.id,
      })
      .select("id, format, passage, options, correct_index, explanation, difficulty")
      .single();
    if (error) throw new Error(error.message);
    created.push({
      id: data.id,
      format: data.format,
      passage: data.passage,
      options: data.options,
      correctIndex: data.correct_index,
      explanation: data.explanation,
      difficulty: data.difficulty,
      keywords: [],
    });
  }
  return created;
}

export async function removeSectionProblem(problemId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("problems").delete().eq("id", problemId);
  if (error) throw new Error(error.message);
}

export async function deleteCurriculumDoc(docId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: doc, error: fetchError } = await supabase
    .from("curriculum_docs")
    .select("status")
    .eq("id", docId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (doc.status === "published") {
    throw new Error("배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요.");
  }

  const { error } = await supabase.from("curriculum_docs").delete().eq("id", docId);
  if (error) throw new Error(error.message);
}


/**
 * 이미 있는 문제에 맞는 그림 데이터만 만든다(2026-09-14). 지문·선택지·해설을 주고 figure 하나를 받는다.
 * 저장하지 않는다 — 편집 칸에 채워 사람이 미리보기로 확인한 뒤 저장·확인·공개한다.
 */
export async function generateFigureForProblem(params: {
  passage: string;
  options: string[] | null;
  explanation: string;
  kind: "plane" | "parallel_transversal" | "triangle";
}): Promise<{ ok: true; figure: unknown } | { ok: false; error: string }> {
  await requireAdmin();
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "이 환경에는 AI 생성이 설정되어 있지 않습니다." };
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "make_figure",
        description: "주어진 수학 문제에 맞는 그림 데이터 하나를 만든다.",
        input_schema: {
          type: "object",
          properties: {
            figure: {
              type: "object",
              description:
                params.kind === "plane"
                  ? PLANE_DESC
                  : params.kind === "triangle"
                    ? TRIANGLE_DESC
                    : PARALLEL_TRANSVERSAL_DESC,
            },
          },
          required: ["figure"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "make_figure" },
    messages: [
      {
        role: "user",
        content: `다음 문제에 맞는 그림 데이터(${params.kind})를 만들어주세요. ${params.kind === "plane" ? "그림을 그리지 말고 축 범위와 객체(점·직선·함수·선분·산점도)의 수학적 정의만 적으세요. 지문의 좌표·점 이름·직선 이름·식과 정확히 같게, 정답이 라벨로 드러나면 안 됩니다." : params.kind === "parallel_transversal" ? "좌표나 그림을 그리지 말고 관계만 적으세요 — 평행선·횡단선·교점 이름과 각의 자리(어느 교점, 어느 사분면)·라벨. 지문이 부르는 이름과 정확히 같게, 지문에 없는 이름은 넣지 마세요. 정답 각의 크기가 라벨로 드러나면 안 됩니다." : params.kind === "triangle" ? "좌표나 그림을 그리지 말고 관계만 적으세요 — 꼭짓점 이름, 종류(직각·이등변·정삼각형·일반), 직각 위치, 지문이 준 변 길이·각 라벨(값 그대로), 등변·등각 표시, 높이, 닮음·합동이면 두 번째 삼각형. 지문에 없는 라벨은 넣지 말고, 구하라는 값(정답)은 라벨에 쓰지 마세요(미지수 문자면 됩니다)." : "좌표·길이·각은 문제의 수치와 정확히 일치해야 하고, 정답이 그림에 글자로 드러나면 안 됩니다."} 라벨은 문제의 기호와 같게, 각 라벨은 선과 겹치지 않게. 라벨은 LaTeX 가 아니라 평문으로(예: 'x°', '37°', 'AB' — '$x^\\circ$' 금지). 한 그림에는 문제에 필요한 한 가지 상황만 그리고 여러 도형을 섞지 않습니다.
지문: ${params.passage}
${params.options ? `선택지: ${params.options.join(" / ")}` : ""}
해설: ${params.explanation}`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return { ok: false, error: "AI 응답을 처리할 수 없습니다." };
  const figure = (toolUse.input as { figure?: unknown }).figure;
  const v = validateFigureSpec(figure);
  if (!v.ok) return { ok: false, error: `AI 가 만든 그림 데이터가 규격에 맞지 않습니다 — ${v.error}` };
  if (v.spec.type !== params.kind) return { ok: false, error: "요구한 종류의 그림이 아닙니다. 다시 시도하세요." };
  return { ok: true, figure };
}
