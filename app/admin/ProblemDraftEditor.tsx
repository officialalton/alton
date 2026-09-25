"use client";

import { useMemo, useState } from "react";
import {
  createDraftVersionAction,
  publishDraftAction,
  uploadProblemImageAction,
  generateFigureForProblemAction,
  recheckDistractorRepairAction,
  type BankProblem,
  type ProblemContent,
} from "./problem-bank-actions";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import LearningText from "@/app/session/[id]/LearningText";
import RwStimulusView from "@/app/session/[id]/RwStimulusView";
import { describeRwStructure, parseRwStimulus, rwSkillCode } from "@/lib/rw-stimulus";
import { LEGACY_FIGURE_TYPES, validateFigureSpec } from "@/lib/problem-figures/spec";
import { checkFigureClient, figureAltClient } from "@/lib/problem-figures/check-client";
import { checkContent } from "@/lib/problem-content-check";
import { composeProblemText, splitLegacyQuestion } from "@/lib/problem-question";
import { judgeMaterialNeed, materialBlocker, MATERIAL_KIND_LABEL, MATERIAL_LEVEL_LABEL, type GeometryTemplate } from "@/lib/problem-material-need";
import { skillLabel } from "@/lib/problem-taxonomy";
import { isEvidenceModelSkill } from "@/lib/problem-generation/evidence-model-check";
import { editorVisibility, FORMAT_LABEL } from "./problem-bank-ui";

type Job = () => Promise<{ ok: true } | { ok: false; error: string }>;

function growToContent(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** 입력칸 위 역할 제목 — 모든 칸에 같은 모양으로 붙는다. */
export function FieldTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mt-3 mb-1.5">
      <div className="text-[12px] font-extrabold text-ink">{children}</div>
      {hint && <div className="text-[11.5px] text-grey-500 mt-0.5">{hint}</div>}
    </div>
  );
}

const RW_HINT: Record<string, string> = {
  words_in_context: "지문 1단락. 빈칸이면 ______ 를 정확히 한 곳에. 인용 단어형이면 질문에 “단어” 를 넣습니다.",
  text_structure_purpose: "지문 1단락. '밑줄 친 문장' 문항이면 그 문장 하나만 __문장__ 으로 감쌉니다.",
  cross_text_connections: "'Text 1' 과 'Text 2' 를 각각 제목 줄 한 줄로 두고 아래에 지문을 씁니다(각 60~110단어).",
  rhetorical_synthesis: "첫 줄 'While researching a topic, a student has taken the following notes:' 다음에 '- ' 메모 3~6줄. 질문은 'The student wants to … Which choice …?'",
  command_of_evidence_quant: "표·그래프는 아래 '표·그래프 자료' 로 만들고, 지문은 그 자료를 설명합니다(마크다운 표 금지).",
  command_of_evidence_text: "연구·주장 요약 지문. 질문은 'Which finding, if true, …' / 'Which quotation …'.",
  inferences: "지문이 미완성 문장으로 끝납니다(마지막에 ______ 하나).",
  central_ideas_details: "지문 1단락. 질문은 'Which choice best states the main idea …?' 또는 'According to the text, …?'.",
  transitions: "두 문장 사이에 ______ 하나. 선택지는 접속 표현.",
  boundaries: "한 문장 안에 ______ 하나. 선택지 4개는 문장부호·수일치만 다른 같은 어구.",
  form_structure_sense: "Boundaries 와 같은 모양. 선택지는 동사 형태·대명사·수 일치가 다른 어구.",
};

const GEOMETRY_LABEL: Record<GeometryTemplate, string> = {
  parallel_transversal: "평행선·횡단선",
  triangle: "삼각형",
  circle: "원",
  polygon: "사각형·다각형",
  solid: "입체",
  composite: "복합·음영",
};
const ALL_GEOMETRY: GeometryTemplate[] = ["parallel_transversal", "triangle", "circle", "polygon", "solid", "composite"];

/**
 * 초안 편집 — 문항 체계·유형에 필요한 구역만 보인다. 숨긴 값은 지우지 않고 저장 때 그대로 넘긴다.
 * 순서: 지문/자료 → 질문 → 답안 형식·선택지·정답 → 해설 → 학생 화면 미리보기 → 초안 저장/공개.
 */
export default function ProblemDraftEditor({
  problem,
  busy,
  onRun,
}: {
  problem: BankProblem;
  busy: boolean;
  onRun: (job: Job, done?: string) => Promise<void>;
}) {
  const source = problem.draft;
  const isMc = problem.format === "mc";
  const isSpr = problem.format === "spr";
  const examSystem = problem.examSystem;
  const rwCode = examSystem === "sat_rw" || !examSystem ? rwSkillCode(problem.skillCode ?? null) : null;

  // 옛 버전(question null)은 지문 안에 질문이 있다 — 자동으로 갈라내지 않고 그대로 보여준다. 관리자가 '질문 갈라내기'를 누르면 나눈다.
  const [passage, setPassage] = useState(source?.passage ?? "");
  const [question, setQuestion] = useState(source?.question ?? "");
  const legacyEmbedded = !question.trim() && splitLegacyQuestion(passage).question !== null;
  const fullText = composeProblemText(passage, question);

  const [explanation, setExplanation] = useState(source?.explanation ?? "");
  const [answersText, setAnswersText] = useState((source?.answers ?? []).join(", "));
  const [statementsText, setStatementsText] = useState((source?.statements ?? []).join("\n"));
  const statementsPayload = statementsText.split("\n").map((x) => x.replace(/^\s*(?:I{1,3}|IV|V)[.)]\s*/, "").trim()).filter(Boolean);
  const initialOptions = useMemo(() => {
    const existing = source?.options ?? [];
    return existing.length > 4 ? [...existing] : [0, 1, 2, 3].map((i) => existing[i] ?? "");
  }, [source]);
  const [options, setOptions] = useState<string[]>(initialOptions);
  const [correctIndex, setCorrectIndex] = useState<number | null>(source?.correctIndex ?? null);

  // 자료(그림) 데이터 — JSON 은 고급 편집에서만.
  const [figureText, setFigureText] = useState(source?.figure ? JSON.stringify(source.figure, null, 2) : "");
  const figureParsed: { spec: unknown | null; error: string | null } = (() => {
    if (!figureText.trim()) return { spec: null, error: null };
    try {
      const parsed = JSON.parse(figureText) as unknown;
      const v = validateFigureSpec(parsed);
      // 정규화된 spec 을 쓴다 — 옛 표기·교점 아닌 점이 있는 원문도 표준 모양으로 그려지고 저장된다.
      return v.ok ? { spec: v.spec, error: null } : { spec: null, error: v.error };
    } catch {
      return { spec: null, error: "JSON 을 읽을 수 없습니다." };
    }
  })();
  const figureIsLegacy = figureParsed.spec != null && LEGACY_FIGURE_TYPES.includes((figureParsed.spec as { type?: string }).type ?? "");
  const figureIsImage = figureParsed.spec != null && (figureParsed.spec as { type?: string }).type === "image";
  const [imageAlt, setImageAlt] = useState<string>(figureIsImage ? String((figureParsed.spec as { alt?: string }).alt ?? "") : "");
  const figureForSave: unknown | null = figureIsImage && figureParsed.spec ? { ...(figureParsed.spec as object), alt: imageAlt.trim() } : figureParsed.spec;
  const figureDirty = canonical(figureParsed.spec ?? null) !== canonical(source?.figure ?? null);
  const figureIssues = figureForSave ? checkFigureClient(figureForSave, fullText, isMc ? options : null, correctIndex) : [];
  const figureAlt = figureForSave ? figureAltClient(figureForSave) : null;
  const [figureNotice, setFigureNotice] = useState<string | null>(null);
  const [figureBusy, setFigureBusy] = useState(false);

  // 자료 필요성 판정 — 세부 기술·질문 문장에서 시스템이 먼저 판정한다.
  const need = judgeMaterialNeed({ examSystem, skillCode: problem.skillCode, text: fullText, format: problem.format });
  const blocker = fullText.trim() ? materialBlocker(need, figureForSave) : null;
  const vis = editorVisibility({ examSystem, format: problem.format, need, hasStatements: statementsPayload.length > 0, hasFigure: figureForSave != null, text: fullText });

  const contentIssues = checkContent({
    format: problem.format, passage: fullText, options: isMc ? options.map((o) => o.trim()).filter(Boolean) : null,
    correctIndex, explanation, answers: isSpr ? answersText.split(/[,\n]/).map((a) => a.trim()).filter(Boolean) : null,
    statements: statementsPayload.length ? statementsPayload : null, skillCode: problem.skillCode ?? null, figure: figureForSave,
  });
  const rwStructure = rwCode ? describeRwStructure(parseRwStimulus(fullText)) : null;

  const filledOptions = options.map((o) => o.trim());
  const optionsPayload = isMc && filledOptions.some(Boolean) ? filledOptions : null;
  const canSave = fullText.trim().length > 0 && !blocker;
  const missingAnswer = isMc && optionsPayload !== null && correctIndex === null;
  const apBlocked = examSystem === "ap";

  async function saveDraft(): Promise<{ ok: true; value: { versionId: string; answerFixed: boolean } } | { ok: false; error: string }> {
    return createDraftVersionAction({
      problemId: problem.id,
      passage: passage.trim(),
      question: question.trim() || null,
      options: optionsPayload,
      correctIndex: optionsPayload ? correctIndex : null,
      explanation: explanation.trim(),
      difficulty: problem.difficulty ?? "medium",
      // 숨긴 구역의 값은 지우지 않고 그대로 넘긴다.
      answers: vis.spr ? answersText.split(/[,\n]/).map((a) => a.trim()).filter(Boolean) : (source?.answers ?? null),
      statements: vis.statements || vis.legacyAll ? (statementsPayload.length ? statementsPayload : null) : (source?.statements ?? null),
      figure: figureForSave,
      // 2026-09-15 제품 오너 — 미리보기가 이제 자료를 항상 그려 보여주므로 별도 "확인함" 클릭을
      // 요구하지 않는다(공개 게이트도 이 값을 더 이상 보지 않는다, 20261374 참고).
      figureChecked: figureForSave != null,
    });
  }

  async function makeFigure(kind: "plane" | "parallel_transversal" | "triangle" | "circle" | "polygon" | "solid" | "composite" | "data" | "figure_choice" | "figure_set") {
    setFigureBusy(true);
    setFigureNotice(null);
    const r = await generateFigureForProblemAction({ passage: fullText, options: isMc ? options : null, explanation, kind, correctIndex: isMc ? correctIndex : null });
    setFigureBusy(false);
    if (!r.ok) {
      setFigureNotice(`그림을 만들지 못했습니다 — ${r.error}`);
      return;
    }
    setFigureText(JSON.stringify(r.value, null, 2));
    setFigureNotice("AI 가 자료 데이터를 만들었습니다. 미리보기와 검증 결과를 보고 초안을 저장한 뒤 '미리보기로 확인함'을 켜세요.");
  }

  if (apBlocked) {
    return (
      <div className="border-[1.5px] border-dashed border-grey-200 rounded-xl px-4 py-4 text-[12.5px] text-grey-500" data-testid="ap-pending">
        <b className="text-ink">AP 문항 작성은 준비 중입니다.</b> 이 문제는 AP 체계로 분류만 되어 있고, 지원 과목이 열리면 그 과목의 문제 형식과 자료 블록만 여기에 보입니다.
        SAT Math 입력을 임시로 재사용하지 않습니다. 저장된 내용은 그대로 남아 있습니다.
      </div>
    );
  }

  const geometryChoices: GeometryTemplate[] = need.geometry.length ? need.geometry : ALL_GEOMETRY;

  return (
    <div data-testid="draft-editor">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        {source ? "작업 중인 초안" : "새 초안 쓰기"} · {examSystem === "sat_rw" ? "SAT Reading & Writing" : examSystem === "sat_math" ? "SAT Math" : "문항 체계 미지정(옛 문제 — 모든 항목 표시)"}
        {problem.skillCode ? ` · ${skillLabel(problem.skillCode)}` : ""}
      </div>
      {!examSystem && (
        <p className="text-[11.5px] text-grey-500 mb-1">위 &apos;문항 체계 · 시험 분류&apos;에서 체계를 정하면 이 유형에 필요한 항목만 보입니다.</p>
      )}

      {/* 0. 학생 화면 미리보기 — 어떤 체계·유형이든 맨 위. 학생이 보는 그대로(자료 포함) 그린다. */}
      <FieldTitle hint="학생·교사 수업 화면과 같은 렌더입니다. 아래 칸을 고치면 바로 바뀝니다.">학생 화면 미리보기</FieldTitle>
      <div className="border-[1.5px] border-dashed border-grey-200 rounded-lg px-4 py-3" data-testid="passage-preview">
        {figureParsed.spec != null && (figureParsed.spec as { type?: string }).type !== "figure_choice" && (
          <div className="max-w-full mb-3"><ProblemFigure spec={figureParsed.spec} /></div>
        )}
        {fullText.trim() ? (
          <RwStimulusView passage={fullText} className="learning-body text-[14px] leading-[1.75] text-ink" />
        ) : (
          <p className="text-[12.5px] text-grey-500">지문·질문을 쓰면 여기에 보입니다.</p>
        )}
        {(source?.statements?.length || statementsPayload.length) && (vis.statements || vis.legacyAll) ? (
          <ol className="mt-2">
            {statementsPayload.map((st, i) => (
              <li key={i} className="text-[13.5px] text-ink py-0.5"><b className="mr-2">{["I", "II", "III", "IV", "V"][i]}.</b><LearningText text={st} className="inline" /></li>
            ))}
          </ol>
        ) : null}
        {isMc && options.some((o) => o.trim()) && (
          <ol className="mt-2">
            {options.map((o, i) =>
              o.trim() ? (
                <li key={i} className="text-[13.5px] text-ink py-0.5">
                  <span className="text-grey-500 mr-2 font-semibold">{String.fromCharCode(65 + i)})</span>
                  <LearningText text={o} className="learning-body inline" />
                  {correctIndex === i && <span className="text-[11px] text-grey-500 ml-2">정답</span>}
                </li>
              ) : null
            )}
          </ol>
        )}
      </div>

      {source?.repairStatus === "needs_distractor_repair" && (
        <div className="text-[12px] mb-2 border-[1.5px] border-red/40 bg-red/5 rounded-lg px-3 py-2" data-testid="repair-queue-notice">
          <b className="text-ink">오답 보강 대기</b> — 지문·질문·정답·자료는 검증을 통과했습니다. 아래 표시된 오답만 고쳐 초안 저장한 뒤 &apos;다시 검사&apos;를 누르세요. 통과해야 일반 초안이 되고, 공개·자동 구성·학생 화면에는 들어가지 않습니다.
        </div>
      )}
      {source?.quality && (
        <details className="text-[12px] mt-1 mb-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-2" data-testid="quality-details" open={source.repairStatus === "needs_distractor_repair"}>
          <summary className="cursor-pointer text-ink">
            추정 난이도 <b>{source.quality.estimatedDifficulty}</b>{source.quality.requestedDifficulty !== source.quality.estimatedDifficulty ? ` (요청 ${source.quality.requestedDifficulty})` : ""} · {source.quality.calibrated ? "학생 응답으로 보정됨" : "추정치 — 학생 응답이 쌓이면 보정"}
            {source.quality.needsReview && <span className="ml-2 font-bold text-red">검토 필요</span>}
          </summary>
          {source.quality.difficultyReasons.length > 0 && (
            <ul className="list-disc pl-5 mt-1 text-grey-500">{source.quality.difficultyReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
          {source.quality.needsReviewReasons.length > 0 && (
            <p className="mt-1 text-red">{source.quality.needsReviewReasons.join(" · ")}</p>
          )}
          <p className="mt-1 text-grey-500">독립 검사: {source.quality.independentReview.agrees ? "지정 정답과 일치" : "불일치 또는 미실행"} · 확신 {source.quality.independentReview.confidence}</p>
          {isMc && source.quality.distractors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {source.quality.distractors.map((d) => (
                <li key={d.index} className={d.obvious || d.kind === "irrelevant" ? "text-red" : "text-grey-500"}>
                  <b>{String.fromCharCode(65 + d.index)})</b> {d.kind}{d.obvious ? " · 명백함" : ""} — 그럴듯한 이유: {d.plausibleBecause || "—"} / 일부 일치: {d.matches || "—"} / 틀린 이유: {d.whyWrong || "—"}
                </li>
              ))}
            </ul>
          )}
          {source.repairStatus === "needs_distractor_repair" && (
            <RecheckButton problemId={problem.id} onDone={() => void onRun(() => Promise.resolve({ ok: true }), undefined)} />
          )}
        </details>
      )}

      {/* 근거 모델(2026-09-17, 내부 검토용 — 학생 비공개): 5개 R&W 세부 기술에서만, 값이 있을 때만 보인다. */}
      {source && isEvidenceModelSkill(problem.skillCode ?? null) && (source.evidenceTarget || source.evidenceSpan || source.answerRationale || source.distractorErrorTypes) && (
        <details className="text-[12px] mt-1 mb-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-2 bg-grey-100/60" data-testid="evidence-model-details">
          <summary className="cursor-pointer text-ink font-semibold">내부 검토용 — 학생 비공개 (근거 모델)</summary>
          {source.evidenceTarget && (
            <p className="mt-1 text-ink"><b className="text-grey-500">대상:</b> {source.evidenceTarget}</p>
          )}
          {source.evidenceSpan && (
            <p className="mt-1 text-ink"><b className="text-grey-500">근거 인용:</b> &ldquo;{source.evidenceSpan}&rdquo;</p>
          )}
          {source.answerRationale && (
            <p className="mt-1 text-ink"><b className="text-grey-500">근거→정답 논리:</b> {source.answerRationale}</p>
          )}
          {source.distractorErrorTypes && source.distractorErrorTypes.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-grey-500">
              {source.distractorErrorTypes.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </details>
      )}

      {/* 1. 지문 / 자료 */}
      <FieldTitle hint={rwCode && vis.rwHints ? RW_HINT[rwCode] : examSystem === "sat_math" ? "조건·상황 설명. 수식은 $…$ 안에. 묻는 문장은 아래 '질문'에 따로." : "본문·자료 설명. 질문은 아래 칸에 따로 씁니다."}>지문 / 자료</FieldTitle>
      <textarea
        aria-label="지문 / 자료"
        value={passage}
        onChange={(e) => setPassage(e.target.value)}
        ref={growToContent}
        onInput={(e) => growToContent(e.currentTarget)}
        rows={3}
        placeholder={examSystem === "sat_math" ? "예: In the xy-plane, line k passes through (0, 3) and (4, 11)." : "지문 / 자료 설명"}
        className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 resize-none overflow-hidden"
      />
      {rwStructure && vis.rwHints && (
        <p className="text-[11.5px] text-grey-500 mt-1" data-testid="rw-structure">구조: {rwStructure}</p>
      )}

      {/* 자료 판정 + 자료 구역 */}
      <div className={"mt-2 rounded-lg px-3 py-2 text-[12px] " + (need.level === "required" ? "bg-red/5 text-ink border-[1.5px] border-red/30" : need.level === "recommended" ? "bg-grey-100 text-ink" : "bg-grey-100 text-grey-500")} data-testid="material-need" data-level={need.level}>
        <b>{MATERIAL_LEVEL_LABEL[need.level]}</b>{need.kind ? ` · ${MATERIAL_KIND_LABEL[need.kind]}` : ""} — {need.reason}
        {need.level === "recommended" && !figureForSave && (
          <span className="text-grey-500"> 텍스트형 문항입니다. 자료를 붙이면 자료를 읽어야 풀리는 문항이 되므로 지문·질문도 함께 고쳐야 합니다.</span>
        )}
      </div>
      {vis.material && (
        <MaterialSection
          vis={vis}
          need={need}
          geometryChoices={geometryChoices}
          figureParsed={figureParsed}
          figureIsLegacy={figureIsLegacy}
          figureIsImage={figureIsImage}
          figureIssues={figureIssues}
          figureAlt={figureAlt}
          imageAlt={imageAlt}
          setImageAlt={setImageAlt}
          figureNotice={figureNotice}
          figureBusy={figureBusy || busy || !fullText.trim()}
          onMake={makeFigure}
          onUpload={async (file) => {
            const fd = new FormData();
            fd.set("file", file);
            fd.set("problemId", problem.id);
            const r = await uploadProblemImageAction(fd);
            if (!r.ok) {
              setFigureNotice(`그림을 올리지 못했습니다 — ${r.error}`);
              return;
            }
            setFigureText(JSON.stringify(r.value, null, 2));
            setFigureNotice("그림을 올렸습니다. 대체 설명을 적고 미리보기를 확인한 뒤 초안을 저장하세요.");
          }}
          figureText={figureText}
          setFigureText={setFigureText}
          figureDirty={figureDirty}
          isRw={examSystem === "sat_rw"}
        />
      )}

      {/* 2. 질문 */}
      <FieldTitle hint={rwCode ? "실제 SAT 문항 말투 그대로, 물음표로 끝납니다." : "묻는 문장 하나. 예: What is the value of x?"}>질문</FieldTitle>
      {legacyEmbedded && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-grey-500 mb-1" data-testid="question-embedded">
          옛 문제 — 질문이 지문 안에 있습니다. 그대로 두어도 화면에는 나오며, 갈라 두면 검증·자동 구성이 정확해집니다.
          <button
            type="button"
            className="font-bold text-ink underline"
            onClick={() => {
              const s = splitLegacyQuestion(passage);
              if (s.question) { setPassage(s.passage); setQuestion(s.question); }
            }}
          >
            질문 갈라내기
          </button>
        </div>
      )}
      <textarea
        aria-label="질문"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        ref={growToContent}
        onInput={(e) => growToContent(e.currentTarget)}
        rows={1}
        placeholder={rwCode === "words_in_context" ? "Which choice completes the text with the most logical and precise word or phrase?" : "질문"}
        className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 resize-none overflow-hidden"
      />
      {!question.trim() && !legacyEmbedded && fullText.trim() && (
        <p className="text-[11.5px] text-red mt-1" data-testid="question-missing">질문이 없습니다 — 질문 없는 문제는 자동 구성 후보에서 빠집니다.</p>
      )}

      {/* 3. 답안 형식 · 선택지 · 정답 */}
      <FieldTitle hint={`답안 형식: ${FORMAT_LABEL[problem.format] ?? problem.format}${isMc ? " · 정답은 하나만 고릅니다." : ""}`}>{isMc ? "선택지 · 정답" : isSpr ? "정답" : "답안 형식"}</FieldTitle>
      {isMc && (
        <div className="mb-1">
          {options.map((value, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <label className="flex items-center gap-1.5 shrink-0">
                <input type="radio" name={`correct-${problem.id}`} aria-label={`${i + 1}번이 정답`} checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
                <span className="text-[12px] font-bold text-grey-500 w-[18px]">{String.fromCharCode(65 + i)})</span>
              </label>
              <input
                aria-label={`선택지 ${i + 1}`}
                value={value}
                onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                placeholder={`선택지 ${i + 1}`}
                className="flex-1 text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
              />
            </div>
          ))}
          {options.length > 4 && <p className="text-[11.5px] text-red">선택지가 {options.length}개입니다. 기존 내용을 임의로 줄이지 않습니다 — 필요하면 직접 정리하세요.</p>}
        </div>
      )}
      {vis.spr && (
        <input
          aria-label="정답 목록"
          value={answersText}
          onChange={(e) => setAnswersText(e.target.value)}
          placeholder="예: 7/2, 3.5 — 동치 답은 쉼표로. 기호($, %, 쉼표)는 빼고."
          className="w-full text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
        />
      )}
      {vis.statements && (
        <details className="text-[12px] mt-1" open={statementsPayload.length > 0}>
          <summary className="cursor-pointer text-grey-500">로마숫자 진술 문항(I, II, III)이면 진술을 적습니다</summary>
          <textarea
            aria-label="진술 목록"
            value={statementsText}
            onChange={(e) => setStatementsText(e.target.value)}
            rows={2}
            placeholder={"한 줄에 하나. 예:\n$a > 0$\n$b < 0$"}
            className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mt-1"
          />
        </details>
      )}
      {(problem.format === "essay" || problem.format === "math") && (
        <p className="text-[12px] text-grey-500">학생이 글 또는 풀이로 답합니다. 채점 기준은 해설에 적습니다.</p>
      )}
      {contentIssues.length > 0 && (
        <ul className="text-[12px] text-red list-disc pl-5 mt-1" data-testid="content-issues">
          {contentIssues.map((i) => <li key={i.code + i.message}>{i.message}</li>)}
        </ul>
      )}

      {/* 4. 해설 */}
      <FieldTitle hint={isMc ? "정답인 이유(한국어)." : "풀이 과정 또는 채점 기준."}>해설</FieldTitle>
      <textarea
        aria-label="해설"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        ref={growToContent}
        onInput={(e) => growToContent(e.currentTarget)}
        rows={2}
        placeholder="해설"
        className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 resize-none overflow-hidden"
      />

      {/* 6. 초안 저장 / 공개 */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          disabled={!canSave || busy}
          onClick={() => void onRun(saveDraft, "초안을 저장했습니다. 아직 수업에 쓰이지 않습니다.")}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          초안 저장
        </button>
        <button
          disabled={!canSave || busy || missingAnswer}
          onClick={() =>
            void onRun(async () => {
              const saved = await saveDraft();
              if (!saved.ok) return saved;
              return publishDraftAction(saved.value.versionId);
            }, "공개했습니다. 공개 탭에서 볼 수 있습니다.")
          }
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          공개하기
        </button>
        {problem.keywords.length === 0 && <span className="text-[11.5px] text-grey-500">키워드가 없어 자동 구성에는 포함되지 않습니다. 공개는 됩니다.</span>}
      </div>
      {blocker && <p className="text-[11.5px] text-red mt-2" data-testid="material-blocker">{blocker}</p>}
      {missingAnswer && <p className="text-[11.5px] text-red mt-2">정답을 하나 골라주세요.</p>}
    </div>
  );
}

function MaterialSection(props: {
  vis: ReturnType<typeof editorVisibility>;
  need: ReturnType<typeof judgeMaterialNeed>;
  geometryChoices: GeometryTemplate[];
  figureParsed: { spec: unknown | null; error: string | null };
  figureIsLegacy: boolean;
  figureIsImage: boolean;
  figureIssues: { code: string; message: string }[];
  figureAlt: string | null;
  imageAlt: string;
  setImageAlt: (v: string) => void;
  figureNotice: string | null;
  figureBusy: boolean;
  onMake: (kind: "plane" | "parallel_transversal" | "triangle" | "circle" | "polygon" | "solid" | "composite" | "data" | "figure_choice" | "figure_set") => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  figureText: string;
  setFigureText: (v: string) => void;
  figureDirty: boolean;
  isRw: boolean;
}) {
  const { vis, need, figureParsed, figureIssues } = props;
  const title = props.isRw ? "표·그래프 자료" : need.kind ? `${MATERIAL_KIND_LABEL[need.kind]} 자료` : "자료";
  return (
    <div className="mt-2" data-testid="figure-section">
      <FieldTitle hint={props.isRw ? "AI 는 값·항목 이름·단위만 내고 표는 ALTON 표준 렌더러가 그립니다. 지문이 부르는 값과 같아야 합니다." : "AI 는 관계·값만 내고 좌표·라벨 자리는 ALTON 이 정합니다. 렌더된 미리보기를 보고 '미리보기로 확인함'을 켜야 공개됩니다."}>{title}</FieldTitle>

      {figureParsed.spec != null && (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-2 bg-white" data-testid="figure-preview">
          <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-2">자료 미리보기 (표준 렌더러)</div>
          <div className="max-w-full"><ProblemFigure spec={figureParsed.spec} /></div>
          {props.figureAlt && <p className="text-[11.5px] text-grey-500 mt-2">대체 설명: {props.figureAlt}</p>}
        </div>
      )}
      {props.figureIsLegacy && (
        <p className="text-[12px] font-bold text-red mb-1.5" data-testid="figure-legacy">
          재생성 필요 — 옛 형식 그림(좌표 자유 입력)은 지원이 끝나 공개할 수 없습니다. 아래 버튼으로 표준 자료로 다시 만드세요.
        </p>
      )}
      {figureIssues.length > 0 && !props.figureIsLegacy && (
        <ul className="text-[12px] text-red mb-1.5 list-disc pl-5" data-testid="figure-issues">
          {figureIssues.map((i) => <li key={i.code + i.message}>{i.message}</li>)}
        </ul>
      )}
      {figureParsed.spec != null && figureIssues.length === 0 && !props.figureIsLegacy && (
        <p className="text-[11.5px] text-green mb-1.5">표준 렌더링 검증 통과 — 지문 참조·라벨 중복·겹침·잘림 없음.</p>
      )}
      {props.figureIsImage && (
        <label className="flex flex-wrap items-center gap-2 text-[12px] text-ink mb-1.5">
          <span className="font-bold">대체 설명(필수)</span>
          <input aria-label="그림 대체 설명" value={props.imageAlt} onChange={(e) => props.setImageAlt(e.target.value)} placeholder="예: 삼각형 ABC, 변 AB = 6, 각 B 는 직각" className="flex-1 min-w-[240px] text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1" />
        </label>
      )}

      {/* 현재 문제에 필요한 표준 자료 유형만 — 모든 버튼을 한 줄에 나열하지 않는다. */}
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        {vis.tools.includes("data") && (
          <button type="button" disabled={props.figureBusy} onClick={() => void props.onMake("data")} className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
            {props.figureBusy ? "만드는 중…" : "AI로 표·그래프 데이터 만들기"}
          </button>
        )}
        {vis.tools.includes("plane") && (
          <button type="button" disabled={props.figureBusy} onClick={() => void props.onMake("plane")} className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
            {props.figureBusy ? "만드는 중…" : "AI로 좌표평면 데이터 만들기"}
          </button>
        )}
        {vis.tools.includes("geometry") &&
          props.geometryChoices.map((g) => (
            <button key={g} type="button" disabled={props.figureBusy} onClick={() => void props.onMake(g)} className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
              {props.figureBusy ? "만드는 중…" : `AI로 도형 데이터 만들기(${GEOMETRY_LABEL[g]})`}
            </button>
          ))}
        {vis.tools.includes("figure_choice") && (
          <button type="button" disabled={props.figureBusy} onClick={() => void props.onMake("figure_choice")} className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
            {props.figureBusy ? "만드는 중…" : "AI로 그래프/도형 선택지 4개 만들기"}
          </button>
        )}
        {vis.tools.includes("figure_set") && (
          <button type="button" disabled={props.figureBusy} onClick={() => void props.onMake("figure_set")} className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
            {props.figureBusy ? "만드는 중…" : "AI로 복수 자료(A/B) 만들기"}
          </button>
        )}
        {vis.upload && (
          <label className="inline-flex items-center gap-2 text-[12px] text-ink">
            <span className="font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 cursor-pointer">그림 파일 올리기</span>
            <input
              type="file"
              aria-label="그림 파일"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) await props.onUpload(file);
              }}
            />
            <span className="text-grey-500">표준 자료로 그릴 수 없을 때만 — PNG·SVG, 5MB 이하, 대체 설명 필수</span>
          </label>
        )}
      </div>
      {props.figureNotice && <p className="text-[11.5px] text-ink mb-1.5">{props.figureNotice}</p>}
      {figureParsed.error && <p className="text-[11.5px] text-red mb-1.5">자료 데이터 오류 — {figureParsed.error}</p>}

      {figureParsed.spec != null && (props.figureDirty || figureIssues.length > 0) && (
        <p className="text-[12.5px] text-grey-500 mb-1.5">
          {props.figureDirty ? "자료가 바뀌었습니다 — 먼저 초안을 저장하세요." : "검증 문제를 먼저 해결하세요."}
        </p>
      )}

      {(vis.advancedJson || vis.legacyAll) && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-grey-500">자료 데이터 편집(고급)</summary>
          <textarea
            aria-label="그림 데이터"
            value={props.figureText}
            onChange={(e) => props.setFigureText(e.target.value)}
            ref={growToContent}
            onInput={(e) => growToContent(e.currentTarget)}
            rows={2}
            className="w-full text-[12px] font-mono border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mt-1.5 mb-1.5 resize-none overflow-hidden"
          />
        </details>
      )}
      {!vis.advancedJson && !vis.legacyAll && (
        // R&W 에서는 JSON 을 보이지 않는다 — 검증(E2E)과 디버깅을 위해 숨은 칸으로만 둔다.
        <textarea aria-label="그림 데이터" value={props.figureText} readOnly hidden />
      )}
    </div>
  );
}

/** 공개본 조회 — 그 문제의 체계·유형에 필요한 항목만. */
/** 오답 보강 대기 초안을 다시 검사한다 — 통과하면 일반 초안으로 바뀐다(2026-09-15). */
function RecheckButton({ problemId, onDone }: { problemId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; reasons: string[] } | null>(null);
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setResult(null);
          const r = await recheckDistractorRepairAction(problemId);
          setBusy(false);
          if (r.ok) { setResult(r.value); onDone(); }
          else setResult({ passed: false, reasons: [r.error] });
        }}
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {busy ? "다시 검사하는 중…" : "다시 검사"}
      </button>
      {result && (
        <p className={"mt-1.5 " + (result.passed ? "text-green" : "text-red")}>
          {result.passed ? "통과했습니다 — 일반 초안으로 바뀌었습니다." : `아직 통과하지 못했습니다 — ${result.reasons.join(" / ")}`}
        </p>
      )}
    </div>
  );
}

/**
 * 2026-09-17(제품 오너 지시) — 자동 생성(AI/계산형 컴파일러) 문항은 검수 화면에서
 * 편집이 아니라 읽기 전용으로만 보인다. content를 명시적으로 받아, 아직 공개되지
 * 않은 초안(problem.draft)도 같은 뷰로 보여줄 수 있게 한다(기본은 공개본).
 */
export function PublishedContentView({ problem, content }: { problem: BankProblem; content?: ProblemContent }) {
  const p = content ?? problem.published!;
  // 2026-09-17(사용자 지시) — 해설을 한국어/영어 버튼으로 바꿔볼 수 있게 한다.
  // 영어 해설이 없는 문항(대부분의 기존 AI·수동 문항)은 버튼 자체를 숨긴다.
  const [explanationLang, setExplanationLang] = useState<"ko" | "en">("ko");
  const fullText = composeProblemText(p.passage, p.question);
  const need = judgeMaterialNeed({ examSystem: problem.examSystem, skillCode: problem.skillCode, text: fullText, format: problem.format });
  const vis = editorVisibility({ examSystem: problem.examSystem, format: problem.format, need, hasStatements: Boolean(p.statements?.length), hasFigure: p.figure != null, text: fullText });
  return (
    <div className="text-[13px] text-ink">
      <FieldTitle>지문 / 자료 · 질문</FieldTitle>
      {fullText ? <RwStimulusView passage={fullText} className="learning-body text-[13.5px] leading-[1.7]" /> : <span className="text-grey-500">(지문이 비어 있습니다)</span>}
      {/* 2026-09-19(제품 오너 발견) — 지문이 "as shown below"/"the figure below" 처럼 자료가
          아래에 있다고 서술하는데, 미리보기는 항상 자료를 지문보다 먼저 그렸다 — 서술과 화면
          순서가 어긋났다. 실제 SAT도 자료는 그 자료를 언급하는 문장 뒤에 온다 — 지문 다음으로
          옮긴다. */}
      {p.figure != null && (p.figure as { type?: string }).type !== "figure_choice" && (vis.material || vis.legacyAll) && (
        <div className="max-w-full mt-2 mb-2"><ProblemFigure spec={p.figure} /></div>
      )}
      {p.figure != null && (p.figure as { type?: string }).type === "figure_choice" && (
        <div className="max-w-full mt-2 mb-2" data-testid="published-figure-choice"><ProblemFigure spec={p.figure} /></div>
      )}
      {!problem.hasQuestion && <p className="text-[11.5px] text-red mt-1">질문 보완 필요 — 공개본은 자동으로 고치지 않습니다. 수정 초안에서 질문을 갈라내거나 재생성하세요.</p>}
      {(vis.statements || vis.legacyAll) && p.statements?.length ? (
        <>
          <FieldTitle>진술</FieldTitle>
          <ol>{p.statements.map((s, i) => <li key={i}><b className="mr-2">{["I", "II", "III", "IV", "V"][i]}.</b><LearningText text={s} className="inline" /></li>)}</ol>
        </>
      ) : null}
      {problem.format === "mc" && p.options && p.options.length > 0 && (p.figure as { type?: string } | null)?.type === "figure_choice" && (
        <p className="text-[12.5px] font-bold text-ink">정답: {p.correctIndex === null ? "미지정" : String.fromCharCode(65 + p.correctIndex)}</p>
      )}
      {problem.format === "mc" && p.options && p.options.length > 0 && (p.figure as { type?: string } | null)?.type !== "figure_choice" && (
        <>
          <FieldTitle>선택지 · 정답</FieldTitle>
          <ol className="space-y-0.5">
            {p.options.map((o, i) => (
              <li key={i} className={"text-[12.5px] " + (p.correctIndex === i ? "font-bold text-ink" : "text-grey-500")}>
                {String.fromCharCode(65 + i)}) <LearningText text={o || "(비어 있음)"} className="inline" />{p.correctIndex === i ? " · 정답" : ""}
              </li>
            ))}
          </ol>
        </>
      )}
      {(vis.spr || vis.legacyAll) && p.answers?.length ? (
        <>
          <FieldTitle>정답</FieldTitle>
          <p className="text-[12.5px]">{p.answers.join(", ")}</p>
        </>
      ) : null}
      {isEvidenceModelSkill(problem.skillCode ?? null) && (p.evidenceTarget || p.evidenceSpan || p.answerRationale || p.distractorErrorTypes) && (
        <details className="text-[12px] mt-2 mb-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-2 bg-grey-100/60" data-testid="evidence-model-details">
          <summary className="cursor-pointer text-ink font-semibold">내부 검토용 — 학생 비공개 (근거 모델)</summary>
          {p.evidenceTarget && (
            <p className="mt-1 text-ink"><b className="text-grey-500">대상:</b> {p.evidenceTarget}</p>
          )}
          {p.evidenceSpan && (
            <p className="mt-1 text-ink"><b className="text-grey-500">근거 인용:</b> &ldquo;{p.evidenceSpan}&rdquo;</p>
          )}
          {p.answerRationale && (
            <p className="mt-1 text-ink"><b className="text-grey-500">근거→정답 논리:</b> {p.answerRationale}</p>
          )}
          {p.distractorErrorTypes && p.distractorErrorTypes.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-grey-500">
              {p.distractorErrorTypes.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </details>
      )}
      {p.explanation && (
        <>
          <div className="flex items-center gap-2 mt-1">
            <FieldTitle>해설</FieldTitle>
            {p.explanationEn && (
              <div className="flex gap-1 mb-1.5" role="group" aria-label="해설 언어">
                <button
                  type="button"
                  onClick={() => setExplanationLang("ko")}
                  className={"text-[11px] font-bold px-2 py-0.5 rounded-full border-[1.5px] " + (explanationLang === "ko" ? "bg-ink text-white border-ink" : "bg-white text-grey-500 border-grey-200")}
                >
                  한국어
                </button>
                <button
                  type="button"
                  onClick={() => setExplanationLang("en")}
                  className={"text-[11px] font-bold px-2 py-0.5 rounded-full border-[1.5px] " + (explanationLang === "en" ? "bg-ink text-white border-ink" : "bg-white text-grey-500 border-grey-200")}
                >
                  English
                </button>
              </div>
            )}
          </div>
          <p className="text-[12.5px] text-grey-500 whitespace-pre-wrap leading-[1.6]">
            {explanationLang === "en" && p.explanationEn ? p.explanationEn : p.explanation}
          </p>
        </>
      )}
    </div>
  );
}
