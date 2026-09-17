"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBankProblemsAction,
  createBankProblemAction,
  createDraftFromPublishedAction,
  publishDraftAction,
  setProblemArchivedAction,
  setProblemKeywordAction,
  reassignProblemSubjectAction,
  updateProblemMetaAction,
  generateBankProblemsAction,
  problemQuestionAuditAction,
  type BankProblem,
  type ProblemBankFilter,
} from "./problem-bank-actions";
import { listSubjectCatalogAction } from "./subject-actions";
import ProblemDraftEditor, { FieldTitle, PublishedContentView } from "./ProblemDraftEditor";
import { compatibilityPreview, formatsForExamSystem, FORMAT_LABEL } from "./problem-bank-ui";
import { findProblemSkill } from "@/lib/problem-skills";
import {
  AP_SUBJECTS,
  EXAM_SYSTEMS,
  SKILL_BY_CODE,
  SKILL_CODES,
  domainShort,
  domainsForExamSystem,
  examSystemLabel,
  skillLabel,
  skillsForDomain,
  type ExamSystem,
} from "@/lib/problem-taxonomy";
import { judgeMaterialNeed, MATERIAL_KIND_LABEL, MATERIAL_LEVEL_LABEL } from "@/lib/problem-material-need";
import type { AdminSubject, SubjectKeyword } from "./subject-data";

// P2 3차·8차 — 관리자 문제은행. 교재와 독립된 진입점이다.
//
// 2026-09-14 제품 오너 — 생성·편집 재구성:
//   * 관리 과목(라이브러리·키워드·자동 구성)과 **문항 체계**(SAT R&W / SAT Math / AP)를 분리한다. 서로 바꿔도 다른 쪽은 유지.
//   * 생성 탭 안에 문항 체계 탭 → 1 관리 과목·키워드 → 2 문제 규격(영역/세부 기술/유형/난이도) → 3 자료·지문 → 4 질문 → 5 답안 → 6 해설 → 7 저장/공개.
//   * 관리자가 데이터 구조를 판단하지 않는다 — 자료 필요성은 시스템이 판정해 이유와 함께 보인다.
//   * 복수 AI 생성도 단건과 같은 계약(자료/지문·질문·답안·정답·해설)이고, 어긴 결과는 저장하지 않고 사유와 함께 분리한다.

type Bucket = "working" | "published" | "archived";

// 2026-09-17(제품 오너 지시) — 관리자는 AI 생성 문항의 오류를 고쳐 완성하지 않는다.
// 자동 검사를 통과한 완성 후보만 이 목록에 들어오고, 관리자는 '공개하기' 또는
// '보관하기'만 고른다. '오답 보강 대기' 버킷은 그 전제 자체(검사 실패분을 살려
// 관리자가 고친다)와 맞지 않아 없앤다 — 새 생성 경로는 애초에 그런 초안을
// 만들지 않는다(오답이 걸리면 저장하지 않고 다른 후보로 대체).
const BUCKETS: { key: Bucket; label: string; hint: string }[] = [
  { key: "working", label: "검수 대기", hint: "자동 검사를 통과한 완성 후보입니다. 학생에게 제공할 가치가 있는지 판단해 공개하거나 보관하세요." },
  { key: "published", label: "공개", hint: "지금 공개된 내용입니다. 회차 구성 후보가 됩니다." },
  { key: "archived", label: "보관", hint: "보관된 문제입니다. 과거 기록은 그대로 남습니다." },
];

const WORK_STATE_LABEL: Record<BankProblem["workState"], string> = {
  draft: "초안",
  in_review: "확인 중",
  published: "공개됨",
  none: "내용 없음",
};

const READINESS_NOTE: Record<BankProblem["readiness"], string | null> = {
  ok: null,
  not_confirmed: "아직 공개되지 않아 자동 구성에 포함되지 않습니다.",
  archived: "보관된 문제라 자동 구성에 포함되지 않습니다.",
  no_published_version: "공개된 버전이 없어 자동 구성에 포함되지 않습니다.",
  no_keyword: "키워드가 없어 자동 구성에 포함되지 않습니다. 키워드는 아래에서 붙일 수 있습니다.",
};

type Job = () => Promise<{ ok: true } | { ok: false; error: string }>;

export default function ProblemBankTab({ subjects }: { subjects: AdminSubject[] }) {
  const [catalog, setCatalog] = useState<AdminSubject[] | null>(subjects.length ? subjects : null);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSubjectCatalogAction()
      .then((rows) => {
        if (!cancelled) setCatalog(rows);
      })
      .catch(() => {
        if (!cancelled && !subjects.length) setCatalogError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [subjects.length]);

  const [bucket, setBucket] = useState<Bucket>("working");
  const [filter, setFilter] = useState<ProblemBankFilter>({});
  const [problems, setProblems] = useState<BankProblem[] | null>(null);
  const [audit, setAudit] = useState<{ withQuestion: number; draftWithout: number; publishedWithout: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 2026-09-15 — "전체 공개" 버튼의 "공개 중…" 표시는 이 액션 자체가 도는 동안만 켠다.
  // 예전엔 공용 busy(다른 액션, 예: AI 생성이 도는 동안도 true)를 그대로 써서 생성 중에도
  // 이 버튼이 "공개 중…"으로 보였다.
  const [publishingAll, setPublishingAll] = useState(false);

  const archived = bucket === "archived";

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [rows, a] = await Promise.all([
        listBankProblemsAction({ ...filter, archived: archived || undefined }),
        problemQuestionAuditAction(filter.subjectId),
      ]);
      setProblems(rows);
      setAudit(a.ok ? a.value : null);
    } catch {
      setProblems(null);
      setError("문제 목록을 불러오지 못했습니다.");
    }
  }, [filter, archived]);

  useEffect(() => {
    // 마운트·필터 변경 시 목록을 서버에서 읽어오는 정상적인 데이터 로딩 effect다 —
    // react-hooks/set-state-in-effect 는 이 패턴 자체를 "effect 안 setState"로 잡아낸다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const run = useCallback(
    async (job: Job, done?: string) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const result = await job();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (done) setNotice(done);
        await reload();
      } catch {
        setError("처리하지 못했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  const activeSubjects = useMemo(() => (catalog ?? []).filter((s) => !s.archivedAt), [catalog]);
  const keywordsBySubject = useMemo(() => {
    const map = new Map<string, SubjectKeyword[]>();
    for (const s of catalog ?? []) map.set(s.subjectId, s.keywords ?? []);
    return map;
  }, [catalog]);

  const visible = (problems ?? []).filter((p) => {
    if (bucket === "archived") return true;
    if (bucket === "published") return p.workState === "published";
    return p.workState === "draft" || p.workState === "in_review" || p.workState === "none";
  });
  const bucketHint = BUCKETS.find((b) => b.key === bucket)?.hint ?? "";
  const publishableDrafts = visible.filter((p) => p.draft?.versionId);

  async function publishAllVisible() {
    if (publishableDrafts.length === 0) return;
    if (typeof window !== "undefined" && !window.confirm(`지금 보이는 초안 ${publishableDrafts.length}개를 모두 공개할까요? 공개된 문제는 회차 구성 후보가 됩니다.`)) return;
    setPublishingAll(true);
    setError(null);
    setNotice(null);
    const failed: string[] = [];
    let done = 0;
    for (const p of publishableDrafts) {
      const versionId = p.draft?.versionId;
      if (!versionId) continue;
      const result = await publishDraftAction(versionId);
      if (result.ok) done += 1;
      else failed.push(`${(p.draft?.passage ?? p.draft?.question ?? "").slice(0, 30) || "(내용 없음)"} — ${result.error}`);
    }
    await reload();
    setPublishingAll(false);
    setNotice(`${done}개를 공개했습니다.${failed.length ? ` ${failed.length}개는 공개하지 못해 초안으로 남았습니다.` : ""}`);
    if (failed.length) setError(failed.join(" / "));
  }

  return (
    <div className="max-w-[880px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">문제은행</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        관리 과목은 문제를 보관하고 키워드·커리큘럼·자동 구성에 연결하는 단위이고, 문항 체계(SAT R&W / SAT Math / AP)는 어느 시험의 어떤 문항인가입니다.
        둘은 따로 관리됩니다. 공개된 문제만 회차 구성 후보가 됩니다.
      </p>

      <div className="flex gap-1 mb-2 border-b-[1.5px] border-grey-200">
        {BUCKETS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setBucket(t.key);
              setOpenId(null);
              void reload();
            }}
            className={"text-[13px] font-bold px-3.5 py-2 -mb-[1.5px] border-b-[2px] " + (bucket === t.key ? "border-ink text-ink" : "border-transparent text-grey-500")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-grey-500 mb-4">{bucketHint}</p>

      {catalog === null && !catalogError && <p className="text-[12.5px] text-grey-500 mb-3">과목을 불러오는 중...</p>}
      {catalogError && <p className="text-[12.5px] text-red mb-3">과목을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.</p>}
      {catalog !== null && activeSubjects.length === 0 && <p className="text-[12.5px] text-grey-500 mb-3">먼저 커리큘럼에서 과목을 만들어야 문제를 추가할 수 있습니다.</p>}

      <Filters
        subjects={activeSubjects}
        keywords={filter.subjectId ? keywordsBySubject.get(filter.subjectId) ?? [] : []}
        filter={filter}
        searchLabel={bucket === "working" ? "작성 중인 문제에서 찾기" : bucket === "published" ? "공개된 문제에서 찾기" : "보관된 문제에서 찾기"}
        onChange={(next) => setFilter((f) => ({ ...f, ...next }))}
      />

      {audit && (
        <p className="text-[12px] text-grey-500 mb-3" data-testid="question-audit">
          질문 집계{filter.subjectId ? "(이 과목)" : ""}: 질문 있음 <b className="text-ink">{audit.withQuestion}</b> · 질문 없는 초안 <b className="text-ink">{audit.draftWithout}</b> · 질문 없는 공개본{" "}
          <b className={audit.publishedWithout ? "text-red" : "text-ink"}>{audit.publishedWithout}</b>
          {audit.draftWithout + audit.publishedWithout > 0 && " — 질문 없는 문제는 자동 구성 후보에서 빠집니다. 공개본은 자동으로 고치지 않으니 '질문 보완 필요' 표시를 보고 수정 초안 또는 재생성으로 처리하세요."}
        </p>
      )}

      {bucket === "working" && (
        <NewProblemPanel
          subjects={activeSubjects}
          keywordsBySubject={keywordsBySubject}
          busy={busy}
          onCreate={async (p) => {
            await run(async () => {
              const r = await createBankProblemAction(p);
              if (!r.ok) return r;
              setOpenId(r.value);
              return { ok: true };
            }, "초안 문제를 만들었습니다. 아래에서 지문·질문·답안·해설을 쓰세요.");
          }}
          onGenerate={async (p) => {
            setBusy(true);
            setError(null);
            setNotice(null);
            try {
              const result = await generateBankProblemsAction(p);
              // reload() 는 오류를 지우므로, 목록을 다시 읽은 **뒤에** 결과를 보인다(예전엔 실패 사유가 사라졌다).
              await reload();
              if (!result.ok) setError(result.error);
              else {
                // 2026-09-17(제품 오너 지시) — 자동 통과 수/요청 수를 항상 분모로 보여준다.
                // 부족분은 관리자가 고칠 대상이 아니라 그냥 "덜 만들어졌다"는 사실이다.
                const { created, requested, shortfall } = result.value;
                setNotice(
                  `자동 통과 ${created}/${requested}` +
                    (shortfall > 0 ? `, 부족 ${shortfall}` : "") +
                    ". 통과한 것만 초안으로 저장했습니다 — 내용을 확인한 뒤 공개하세요."
                );
                if (result.value.failures.length) setError(`부족분 사유: ${result.value.failures.join(" / ")}`);
              }
            } catch {
              setError("문제를 생성하지 못했습니다.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      {notice && <p className="text-[12.5px] text-grey-500 mb-3">{notice}</p>}

      {bucket === "working" && publishableDrafts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 border-[1.5px] border-grey-200 rounded-xl px-4 py-2.5">
          <span className="text-[12.5px] text-ink">지금 보이는 초안 <b>{publishableDrafts.length}</b>개</span>
          <button type="button" disabled={busy || publishingAll} onClick={() => void publishAllVisible()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">
            {publishingAll ? "공개 중…" : `전체 공개 (${publishableDrafts.length})`}
          </button>
          <span className="text-[11.5px] text-grey-500">내용을 확인한 초안만 공개하세요 — 공개된 문제는 회차 구성 후보가 됩니다.</span>
        </div>
      )}

      {problems === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중...</p>
      ) : visible.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {bucket === "archived" ? "보관된 문제가 없습니다." : bucket === "published" ? "공개된 문제가 없습니다." : "작성 중인 문제가 없습니다."}
        </div>
      ) : (
        visible.map((p) => (
          <ProblemRow
            key={p.id}
            problem={p}
            keywords={p.subjectId ? keywordsBySubject.get(p.subjectId) ?? [] : []}
            activeSubjects={activeSubjects}
            open={openId === p.id}
            busy={busy}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            onArchive={(next) => void run(() => setProblemArchivedAction(p.id, next), next ? "보관했습니다. 과거 기록은 그대로 남습니다." : "보관을 풀었습니다.")}
            onRun={run}
            onNotice={setNotice}
          />
        ))
      )}
    </div>
  );
}

function Filters({
  subjects,
  keywords,
  filter,
  searchLabel,
  onChange,
}: {
  subjects: AdminSubject[];
  keywords: SubjectKeyword[];
  filter: ProblemBankFilter;
  searchLabel: string;
  onChange: (next: Partial<ProblemBankFilter>) => void;
}) {
  const system = (filter.examSystem as ExamSystem | undefined) ?? null;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <select aria-label="과목" value={filter.subjectId ?? ""} onChange={(e) => onChange({ subjectId: e.target.value || undefined, keywordId: undefined })} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
        <option value="">모든 과목</option>
        {subjects.map((s) => (
          <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
        ))}
      </select>
      <select aria-label="문항 체계 필터" value={filter.examSystem ?? ""} onChange={(e) => onChange({ examSystem: e.target.value || undefined, satDomain: undefined, skillCode: undefined })} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
        <option value="">모든 문항 체계</option>
        {EXAM_SYSTEMS.map((e) => (
          <option key={e.code} value={e.code}>{e.label}</option>
        ))}
      </select>
      <select aria-label="형식" value={filter.format ?? ""} onChange={(e) => onChange({ format: e.target.value || undefined })} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
        <option value="">모든 형식</option>
        <option value="mc">객관식</option>
        <option value="essay">서술형</option>
        <option value="spr">숫자 입력(SPR)</option>
        <option value="math">풀이형</option>
      </select>
      {system !== "ap" && (
        <>
          <select aria-label="SAT 영역" value={filter.satDomain ?? ""} onChange={(e) => onChange({ satDomain: e.target.value || undefined, skillCode: undefined })} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
            <option value="">모든 영역</option>
            {(system ? domainsForExamSystem(system) : domainsForExamSystem("sat_rw").concat(domainsForExamSystem("sat_math"))).map((d) => (
              <option key={d.code} value={d.code}>{d.label}</option>
            ))}
          </select>
          <select aria-label="세부 기술" value={filter.skillCode ?? ""} onChange={(e) => onChange({ skillCode: e.target.value || undefined })} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[260px]">
            <option value="">{filter.satDomain ? "모든 기술" : "모든 기술(영역 먼저 고르면 좁혀짐)"}</option>
            {(filter.satDomain ? skillsForDomain(filter.satDomain) : SKILL_CODES.filter((k) => !system || (system === "sat_rw" ? k.domain.startsWith("rw_") : !k.domain.startsWith("rw_")))).map((k) => (
              <option key={k.code} value={k.code}>{k.label}</option>
            ))}
          </select>
        </>
      )}
      <select aria-label="키워드" disabled={!filter.subjectId} value={filter.keywordId ?? ""} onChange={(e) => onChange({ keywordId: e.target.value || undefined })} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 disabled:opacity-50">
        <option value="">{filter.subjectId ? "모든 키워드" : "과목을 먼저 고르세요"}</option>
        {keywords.map((k) => (
          <option key={k.id} value={k.id}>{k.label}</option>
        ))}
      </select>
      <select aria-label="난이도 필터" value={filter.difficulty ?? ""} onChange={(e) => onChange({ difficulty: e.target.value || undefined })} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
        <option value="">모든 난이도</option>
        <option value="easy">쉬움</option>
        <option value="medium">보통</option>
        <option value="hard">어려움</option>
      </select>
      <input aria-label="문제 검색" value={filter.query ?? ""} onChange={(e) => onChange({ query: e.target.value || undefined })} placeholder={`${searchLabel}(지문·주제)`} className="flex-1 min-w-[180px] text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5" />
    </div>
  );
}

/**
 * 새 문제 — 문항 체계 탭 안에서 1 관리 과목·키워드 → 2 문제 규격 순서로 고른 뒤 '직접 쓰기'(초안 편집기로) 또는 'AI로 만들기'.
 * 그림 요구는 관리자가 고르지 않는다 — 세부 기술의 자료 판정이 정한다.
 */
function NewProblemPanel({
  subjects,
  keywordsBySubject,
  busy,
  onCreate,
  onGenerate,
}: {
  subjects: AdminSubject[];
  keywordsBySubject: Map<string, SubjectKeyword[]>;
  busy: boolean;
  onCreate: (p: { subjectId: string; format: string; skillType?: string; skillCode?: string; examSystem?: string; apSubject?: string; topic?: string; difficulty?: string; keywordIds?: string[] }) => void | Promise<void>;
  onGenerate: (p: { subjectId: string; skillType: string; skillCode?: string; examSystem?: string; apSubject?: string; topic?: string; difficulty: string; format: string; count: number; keywordIds?: string[]; figurePolicy?: string }) => void | Promise<void>;
}) {
  const [system, setSystem] = useState<ExamSystem>("sat_rw");
  const [subjectId, setSubjectId] = useState("");
  const [keywordIds, setKeywordIds] = useState<string[]>([]);
  const [apSubject, setApSubject] = useState("");
  const [satDomain, setSatDomain] = useState("");
  const [skillCode, setSkillCode] = useState("");
  const [skillType, setSkillType] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [format, setFormat] = useState("mc");
  // 2026-09-17(UAT 지적) — AI 생성(문항 하나당 여러 번 순차 모델 호출)은 개수가
  // 조금만 늘어도 이 비프로덕션 배포의 함수 제한 시간(Vercel Hobby 플랜, 300초
  // 고정 — 코드로 늘릴 수 없다)에 걸려 결과 없이 죽는다. 다만 계산형 컴파일러
  // 경로(예: linear_equations_two_var)는 AI를 아예 안 써서 이 위험이 없고, 오히려
  // "생성 실행 단위는 최소 10문항 배치"가 정책이므로 상한을 걸면 안 된다.
  const MATH_COMPILER_SKILLS = new Set(["linear_equations_two_var", "systems_linear", "linear_inequalities", "linear_equations_one_var", "linear_functions", "equivalent_expressions", "nonlinear_equations_systems", "nonlinear_functions"]);
  const isCompilerSkill = MATH_COMPILER_SKILLS.has(skillCode);
  const MAX_SAFE_GENERATE_COUNT = isCompilerSkill ? 10 : 2;
  const [count, setCount] = useState("1");

  const keywords = subjectId ? keywordsBySubject.get(subjectId) ?? [] : [];
  const formats = formatsForExamSystem(system, apSubject || null);
  const apMeta = AP_SUBJECTS.find((a) => a.code === apSubject) ?? null;
  const apReady = system !== "ap" || Boolean(apMeta?.supported);
  const need = judgeMaterialNeed({ examSystem: system, skillCode: skillCode || null, text: "" });
  // 자료를 넣을지는 생성 **전에** 정한다 — 그래프를 읽는 문항과 식만 있는 문항은 다른 문제다(2026-09-15 제품 오너).
  //   필수 → 자료 포함 고정, 권장 → 관리자가 '자료 포함(권장)' / '텍스트형' 중 선택(기본 자료 포함), 불필요 → 텍스트형 고정.
  //   자료 유형이 둘 이상 나오는 기술(예: Linear functions 는 좌표평면 그래프도 함수표도)은 유형까지 고른다. 세부 형태(막대/산점도, 삼각형/원)는 AI 가 문항 내용에 맞춰 정한다.
  const [materialChoice, setMaterialChoice] = useState<string>("with");
  const requireFor = (kind: string | null) => (kind === "plane" ? "require_plane" : kind === "geometry" ? "require_geometry" : kind === "figure_choice" ? "require_figure_choice" : "require_data");
  const chosenKind = materialChoice === "text" ? null : materialChoice === "with" ? need.kind : (materialChoice as typeof need.kind);
  const withMaterial = need.level !== "none" && chosenKind !== null;
  const figurePolicy = withMaterial ? requireFor(chosenKind) : "none";

  function switchSystem(next: ExamSystem) {
    setSystem(next);
    // 시험 분류는 문항 체계의 하위 — 체계를 바꾸면 다시 고른다. 관리 과목·키워드는 그대로.
    setSatDomain("");
    setSkillCode("");
    setSkillType("");
    setApSubject("");
    setFormat(formatsForExamSystem(next, null)[0] ?? "mc");
  }

  const specOk = system === "ap" ? Boolean(apSubject) : true;
  const canCreate = Boolean(subjectId) && specOk && apReady && !busy;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5" data-testid="new-problem-panel">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">새 문제</div>
      <div className="flex gap-1 mb-3 border-b-[1.5px] border-grey-200" role="tablist" aria-label="문항 체계">
        {EXAM_SYSTEMS.map((e) => (
          <button
            key={e.code}
            role="tab"
            aria-selected={system === e.code}
            onClick={() => switchSystem(e.code)}
            className={"text-[12.5px] font-bold px-3 py-1.5 -mb-[1.5px] border-b-[2px] " + (system === e.code ? "border-ink text-ink" : "border-transparent text-grey-500")}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* 1. 관리 과목과 키워드 */}
      <FieldTitle hint="문제를 보관하고 키워드·커리큘럼·자동 구성에 연결하는 라이브러리 단위입니다. 문항 체계와 별개입니다.">1. 관리 과목과 키워드</FieldTitle>
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="새 문제 과목" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setKeywordIds([]); }} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
          <option value="">과목 고르기…</option>
          {subjects.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
          ))}
        </select>
        {subjectId && keywords.length === 0 && <span className="text-[12px] text-grey-500">이 과목에 등록된 키워드가 없습니다. 커리큘럼에서 먼저 만드세요.</span>}
        {subjectId && keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => {
              const on = keywordIds.includes(k.id);
              return (
                <button key={k.id} type="button" aria-pressed={on} onClick={() => setKeywordIds((prev) => (on ? prev.filter((id) => id !== k.id) : [...prev, k.id]))} className={"text-[12px] font-bold px-2.5 py-1 rounded-full border-[1.5px] " + (on ? "bg-ink text-white border-ink" : "bg-white text-grey-500 border-grey-200")}>
                  {k.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. 문제 규격 */}
      <FieldTitle hint={system === "ap" ? "AP 과목을 먼저 고릅니다. 지원 과목에서만 문제 형식과 자료 블록이 열립니다." : "영역 → 세부 기술을 고르면 유형·답안 형식·자료 판정이 따라옵니다."}>2. 문제 규격</FieldTitle>
      {system === "ap" ? (
        <div className="flex flex-wrap gap-2 items-center">
          <select aria-label="AP 과목" value={apSubject} onChange={(e) => setApSubject(e.target.value)} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
            <option value="">AP 과목 고르기…</option>
            {AP_SUBJECTS.map((a) => (
              <option key={a.code} value={a.code}>{a.label}{a.supported ? "" : " — 준비 중"}</option>
            ))}
          </select>
          {apSubject && !apReady && (
            <span className="text-[12px] text-grey-500" data-testid="ap-pending-note">이 과목은 <b className="text-ink">준비 중</b>입니다. 문제 형식·자료 블록이 열리면 여기에 보입니다. SAT Math 입력을 임시로 쓰지 않습니다.</span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <select aria-label="SAT 영역" value={satDomain} onChange={(e) => { setSatDomain(e.target.value); setSkillCode(""); }} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
            <option value="">영역…</option>
            {domainsForExamSystem(system).map((d) => (
              <option key={d.code} value={d.code}>{d.label}</option>
            ))}
          </select>
          <select
            aria-label="세부 기술"
            value={skillCode}
            disabled={!satDomain}
            onChange={(e) => {
              const code = e.target.value;
              setSkillCode(code);
              setMaterialChoice("with");
              const meta = SKILL_BY_CODE.get(code);
              if (meta) {
                const legacy = findProblemSkill(meta.legacySkill);
                if (legacy) setSkillType(legacy.label);
                setFormat(formats.includes(legacy?.defaultFormat ?? "mc") ? legacy?.defaultFormat ?? "mc" : formats[0]);
              }
            }}
            className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[280px] disabled:opacity-50"
          >
            <option value="">{satDomain ? "세부 기술…" : "영역을 먼저 고르세요"}</option>
            {skillsForDomain(satDomain).map((k) => (
              <option key={k.code} value={k.code}>{k.label}</option>
            ))}
          </select>
          <input aria-label="문제 유형" value={skillType} onChange={(e) => setSkillType(e.target.value)} placeholder="유형 (세부 기술을 고르면 자동)" className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[220px]" />
          <input aria-label="주제" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="주제 (선택 · 예: 생태계)" className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[170px]" />
          <select aria-label="난이도" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
            <option value="medium">보통</option>
            <option value="hard">어려움</option>
          </select>
          {formats.length > 1 ? (
            <select aria-label="새 문제 형식" value={format} onChange={(e) => setFormat(e.target.value)} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
              {formats.map((f) => (
                <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] text-grey-500" aria-label="새 문제 형식">답안 형식: {FORMAT_LABEL[formats[0]] ?? formats[0]}</span>
          )}
        </div>
      )}
      {system !== "ap" && skillCode && (
        <div className="text-[12px] mt-2 text-grey-500" data-testid="new-material-need" data-level={need.level} data-choice={withMaterial ? "with" : "text"} data-kind={chosenKind ?? ""}>
          자료 판정: <b className="text-ink">{MATERIAL_LEVEL_LABEL[need.level]}</b>{chosenKind ? ` · ${MATERIAL_KIND_LABEL[chosenKind]}` : ""} — {need.reason}
          {need.level === "required" && " AI 생성은 이 자료를 함께 만들고, 자료 없는 초안은 저장·공개되지 않습니다."}
          {(need.level === "recommended" || (need.level === "required" && need.alternatives.length > 1)) && need.kind && (
            <div className="flex flex-wrap gap-3 mt-1.5 text-ink" role="radiogroup" aria-label="자료 유형 선택">
              {need.alternatives.map((k, i) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="radio" name="material-choice" checked={chosenKind === k} onChange={() => setMaterialChoice(i === 0 ? "with" : k)} />
                  자료 포함 · {MATERIAL_KIND_LABEL[k]}{i === 0 ? <span className="text-grey-500">(기본)</span> : null}
                </label>
              ))}
              {need.level === "recommended" && (
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="material-choice" checked={materialChoice === "text"} onChange={() => setMaterialChoice("text")} />
                  텍스트형 <span className="text-grey-500">(자료 없이 식·조건만으로 성립하는 문항)</span>
                </label>
              )}
              <span className="text-grey-500 basis-full">자료의 세부 형태(표·막대·산점도 / 삼각형·원 등)는 문항 내용에 맞춰 AI 가 정하고 검증합니다. 복수 생성이면 문항마다 다를 수 있습니다.</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center mt-3">
        <button
          disabled={!canCreate}
          onClick={() => void onCreate({ subjectId, format, skillType: skillType.trim() || undefined, skillCode: skillCode || undefined, examSystem: system, apSubject: system === "ap" ? apSubject || undefined : undefined, topic: topic.trim() || undefined, difficulty, keywordIds: keywordIds.length ? keywordIds : undefined })}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          직접 쓰기
        </button>
        {system !== "ap" && (
          <>
            <span className="text-grey-300">|</span>
            <input
              aria-label="생성 개수"
              type="number"
              min={1}
              max={MAX_SAFE_GENERATE_COUNT}
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value) || 1;
                setCount(String(Math.max(1, Math.min(MAX_SAFE_GENERATE_COUNT, n))));
              }}
              className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 w-[64px]"
            />
            <button
              disabled={!canCreate || !skillType.trim()}
              onClick={() => void onGenerate({ subjectId, skillType: skillType.trim(), skillCode: skillCode || undefined, examSystem: system, topic: topic.trim() || undefined, difficulty, format, count: Math.max(1, Math.min(MAX_SAFE_GENERATE_COUNT, Number(count) || 1)), keywordIds: keywordIds.length ? keywordIds : undefined, figurePolicy })}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
            >
              AI로 만들기
            </button>
          </>
        )}
      </div>
      <p className="text-[11.5px] text-grey-500 mt-2">
        어느 쪽으로 만들든 초안으로 들어갑니다. 다음 단계(3 지문/자료 → 4 질문 → 5 답안 → 6 해설 → 7 저장/공개)는 아래 초안 편집에서 이어집니다. 복수 생성도 단건과 같은 계약이며, 질문이 없거나 유형과 맞지 않는 결과는 저장하지 않고 사유를 보여줍니다.
      </p>
      {isCompilerSkill ? (
        <p className="text-[11.5px] text-grey-500 mt-1">
          이 세부 기술은 AI 대신 계산형 컴파일러가 만듭니다(정답·오답·그래프를 코드로 직접 계산) — AI 호출이 없어
          한 번에 10개까지 요청할 수 있습니다. 내부적으로는 요청 수와 무관하게 항상 최소 10문항 단위로 생성·검증합니다.
        </p>
      ) : (
        <p className="text-[11.5px] text-red mt-1">
          한 번에 최대 {MAX_SAFE_GENERATE_COUNT}개까지만 만들 수 있습니다 — 이 환경의 서버 처리 시간 제한(300초) 때문에,
          그보다 많이 요청하면 시간 안에 끝내지 못해 결과도 실패 사유도 없이 조용히 실패합니다.
        </p>
      )}
    </div>
  );
}

function ProblemRow({
  problem,
  keywords,
  activeSubjects,
  open,
  busy,
  onToggle,
  onArchive,
  onRun,
  onNotice,
}: {
  problem: BankProblem;
  keywords: SubjectKeyword[];
  activeSubjects: AdminSubject[];
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onArchive: (archived: boolean) => void;
  onRun: (job: Job, done?: string) => Promise<void>;
  onNotice: (text: string) => void;
}) {
  const content = problem.published ?? problem.draft;
  const title = [content?.passage?.trim(), content?.question?.trim()].filter(Boolean).join(" ") || "(아직 내용이 없는 문제)";
  const readinessNote = READINESS_NOTE[problem.readiness];
  // 2026-09-17(제품 오너 지시) — manual(관리자 직접 작성)만 검수 화면에서 내용
  // 편집이 가능하다. AI/계산형 컴파일러 생성분은 자동 검사를 이미 통과한 완성
  // 후보이므로 읽기 전용으로만 보여주고, 행동은 공개하기/보관하기 둘뿐이다.
  const autoGenerated = problem.createdVia !== "manual";
  // manual 초안은 ProblemDraftEditor 안에 이미 자기 '공개하기' 버튼이 있다 — 여기서는
  // autoGenerated(AI/컴파일러) 문항에만 목록 행 자체에 공개 버튼을 더한다.
  const unpublishedDraftVersionId = autoGenerated && !problem.published ? problem.draft?.versionId ?? null : null;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onToggle} className="text-left min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink truncate" data-testid="bank-row-title">{title}</div>
          <div className="text-[12px] text-grey-500 mt-0.5">
            {problem.subjectName} · {examSystemLabel(problem.examSystem)}{problem.apSubject ? ` › ${AP_SUBJECTS.find((a) => a.code === problem.apSubject)?.label ?? problem.apSubject}` : ""} · {FORMAT_LABEL[problem.format] ?? problem.format} · {WORK_STATE_LABEL[problem.workState]}
            {problem.skillCode ? ` · ${domainShort(problem.satDomain)} › ${skillLabel(problem.skillCode)}` : problem.satDomain ? ` · ${domainShort(problem.satDomain)} › 기술 미지정` : ""}
            {problem.topic ? ` · 주제 ${problem.topic}` : ""}
            {problem.difficulty ? ` · 난이도 ${problem.difficulty}` : ""}
            {problem.keywords.length ? ` · ${problem.keywords.map((k) => k.label).join(", ")}` : " · 키워드 없음"}
          </div>
          {(() => {
            const q = (problem.draft ?? problem.published)?.quality ?? null;
            if (!q && !problem.responseStats) return null;
            return (
              <div className="text-[11.5px] text-grey-500 mt-1" data-testid="quality-line">
                {q && <>추정 난이도 <b className="text-ink">{q.estimatedDifficulty}</b>{q.requestedDifficulty !== q.estimatedDifficulty ? `(요청 ${q.requestedDifficulty})` : ""}{q.calibrated ? " · 보정됨" : " · 추정치"}</>}
                {problem.responseStats && problem.responseStats.responses > 0 && <> · 응답 {problem.responseStats.responses}{problem.responseStats.correctPct !== null ? ` · 정답률 ${problem.responseStats.correctPct}%` : ""}</>}
                {q?.needsReview && <span className="ml-1.5 font-bold text-red" data-testid="needs-review">검토 필요</span>}
              </div>
            );
          })()}
          {!problem.hasQuestion && content && (
            <div className="text-[11.5px] font-bold text-red mt-1" data-testid="question-needed">질문 보완 필요 — 질문이 없어 자동 구성 후보에서 빠집니다.</div>
          )}
          {readinessNote && <div className="text-[11.5px] text-red mt-1">{readinessNote}</div>}
        </button>
        <span className="flex items-center gap-2 shrink-0">
          {unpublishedDraftVersionId && (
            <button
              disabled={busy}
              onClick={() => void onRun(() => publishDraftAction(unpublishedDraftVersionId), "공개했습니다. 회차 구성 후보가 됩니다.")}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              공개하기
            </button>
          )}
          <button disabled={busy} onClick={() => onArchive(!problem.archived)} className="text-[12px] font-bold text-grey-500">
            {problem.archived ? "보관 풀기" : "보관하기"}
          </button>
        </span>
      </div>

      {open && (
        <div className="mt-3 border-t-[1.5px] border-grey-200 pt-3">
          {problem.published && <PublishedView problem={problem} busy={busy} onRun={onRun} onNotice={onNotice} />}
          {autoGenerated ? (
            <>
              {/* 2026-09-17 — 자동 검사 결과 요약·난이도·근거는 이미 위 제목줄(quality-line)과
                  아래 학생용 미리보기에 있다. 여기서는 내용을 읽기 전용으로만 보여준다 —
                  지문·질문·선택지·정답·해설·난이도·시험 체계·영역·세부 기술·주제는 수정할 수 없다. */}
              {!problem.published && problem.draft && (
                <div className="mb-4">
                  <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
                    학생용 미리보기 · 선생님용 정보(정답·해설) — 읽기 전용
                  </div>
                  <PublishedContentView problem={problem} content={problem.draft} />
                </div>
              )}
              <SubjectPicker problem={problem} subjects={activeSubjects} busy={busy} onRun={onRun} />
              <KeywordPicker problem={problem} keywords={keywords} busy={busy} onRun={onRun} />
            </>
          ) : (
            <>
              <MetaEditor problem={problem} busy={busy} onRun={onRun} />
              <SubjectPicker problem={problem} subjects={activeSubjects} busy={busy} onRun={onRun} />
              <KeywordPicker problem={problem} keywords={keywords} busy={busy} onRun={onRun} />
              {(problem.draft || !problem.published) && <ProblemDraftEditor key={`${problem.draft?.versionId ?? "none"}-${problem.examSystem ?? "x"}-${problem.format}`} problem={problem} busy={busy} onRun={onRun} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PublishedView({ problem, busy, onRun, onNotice }: { problem: BankProblem; busy: boolean; onRun: (job: Job, done?: string) => Promise<void>; onNotice: (text: string) => void }) {
  const hasDraft = Boolean(problem.draft);
  return (
    <div className="bg-grey-100 rounded-lg px-4 py-3 mb-4">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">지금 공개된 내용</div>
      <PublishedContentView problem={problem} />
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <button
          disabled={busy}
          onClick={async () => {
            await onRun(async () => {
              const result = await createDraftFromPublishedAction(problem.id);
              if (!result.ok) return result;
              onNotice(result.value.reused ? "이미 작업 중인 수정 초안이 있어 그대로 불러왔습니다. 아래에서 이어서 편집하세요." : "공개본을 복사해 수정 초안을 만들었습니다. 아래에서 고친 뒤 공개하세요.");
              return { ok: true };
            });
          }}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          {hasDraft ? "수정 초안 이어서 편집" : "수정 초안 만들기"}
        </button>
        <span className="text-[11.5px] text-grey-500">공개된 버전은 고치지 않습니다. 문항 체계·답안 형식 변경도 수정 초안에서만 합니다. 이미 시작한 수업은 당시 버전을 그대로 봅니다.</span>
      </div>
    </div>
  );
}

/**
 * 문항 체계 · 시험 분류 · 유형 · 주제 · 답안 형식.
 * 관리 과목·키워드와 독립 — 여기서 바꿔도 과목·키워드는 그대로다.
 * 문항 체계·답안 형식은 초안이 있을 때만 바꿀 수 있고, 바꾸기 전에 유지되는 값·비활성화되는 값을 먼저 보여준다.
 */
function MetaEditor({ problem, busy, onRun }: { problem: BankProblem; busy: boolean; onRun: (job: Job, done?: string) => Promise<void> }) {
  const [examSystem, setExamSystem] = useState<string>(problem.examSystem ?? "");
  const [apSubject, setApSubject] = useState(problem.apSubject ?? "");
  const [satDomain, setSatDomain] = useState(problem.satDomain ?? "");
  const [skillCode, setSkillCode] = useState(problem.skillCode ?? "");
  const [skillType, setSkillType] = useState(problem.skillType ?? "");
  const [topic, setTopic] = useState(problem.topic ?? "");
  const [format, setFormat] = useState(problem.format);
  const [confirming, setConfirming] = useState(false);

  const structuralChange = examSystem !== (problem.examSystem ?? "") || format !== problem.format;
  const dirty = structuralChange || apSubject !== (problem.apSubject ?? "") || satDomain !== (problem.satDomain ?? "") || skillCode !== (problem.skillCode ?? "") || skillType !== (problem.skillType ?? "") || topic !== (problem.topic ?? "");
  // 공개본만 있고 초안이 없으면 체계·형식은 새 수정 초안에서만 바꿀 수 있다.
  const structuralLocked = Boolean(problem.published) && !problem.draft;
  const content = problem.draft ?? problem.published;
  const preview = structuralChange
    ? compatibilityPreview({
        from: { examSystem: problem.examSystem, format: problem.format },
        to: { examSystem: examSystem || null, format },
        content: { hasOptions: Boolean(content?.options?.length), hasAnswers: Boolean(content?.answers?.length), hasStatements: Boolean(content?.statements?.length), figureType: ((content?.figure as { type?: string } | null)?.type ?? null), hasSkill: Boolean(problem.skillCode || problem.satDomain) },
      })
    : null;
  const formats = formatsForExamSystem((examSystem as ExamSystem) || null, apSubject || null);

  function save() {
    void onRun(
      () =>
        updateProblemMetaAction(problem.id, {
          examSystem: examSystem || null,
          apSubject: examSystem === "ap" ? apSubject || null : null,
          skillType,
          topic,
          skillCode: examSystem === "ap" ? null : skillCode || null,
          satDomain: examSystem === "ap" ? null : satDomain || null,
          format: format !== problem.format ? format : undefined,
        }),
      "문항 체계·시험 분류·유형을 저장했습니다. 관리 과목·키워드는 그대로입니다."
    );
    setConfirming(false);
  }

  return (
    <div className="mb-4" data-testid="meta-editor">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">문항 체계 · 시험 분류 · 유형 · 주제</div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="문항 체계"
          value={examSystem}
          disabled={structuralLocked || busy}
          onChange={(e) => {
            const next = e.target.value;
            setExamSystem(next);
            setSatDomain("");
            setSkillCode("");
            setApSubject("");
            const fs = formatsForExamSystem((next as ExamSystem) || null, null);
            if (fs.length && !fs.includes(format)) setFormat(fs[0]);
          }}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 disabled:opacity-50"
        >
          <option value="">문항 체계 미지정</option>
          {EXAM_SYSTEMS.map((s) => (
            <option key={s.code} value={s.code}>{s.label}</option>
          ))}
        </select>
        {examSystem === "ap" ? (
          <select aria-label="AP 과목 수정" value={apSubject} onChange={(e) => setApSubject(e.target.value)} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
            <option value="">AP 과목…</option>
            {AP_SUBJECTS.map((a) => (
              <option key={a.code} value={a.code}>{a.label}{a.supported ? "" : " — 준비 중"}</option>
            ))}
          </select>
        ) : (
          <>
            <select aria-label="SAT 영역 수정" value={satDomain} onChange={(e) => { setSatDomain(e.target.value); setSkillCode(""); }} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
              <option value="">영역 없음</option>
              {(examSystem ? domainsForExamSystem(examSystem as ExamSystem) : domainsForExamSystem("sat_rw").concat(domainsForExamSystem("sat_math"))).map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
            <select aria-label="세부 기술 수정" value={skillCode} disabled={!satDomain} onChange={(e) => { setSkillCode(e.target.value); const meta = SKILL_BY_CODE.get(e.target.value); const legacy = meta ? findProblemSkill(meta.legacySkill) : null; if (legacy) setSkillType(legacy.label); }} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[280px] disabled:opacity-50">
              <option value="">{satDomain ? "세부 기술 미지정" : "영역을 먼저 고르세요"}</option>
              {skillsForDomain(satDomain).map((k) => (
                <option key={k.code} value={k.code}>{k.label}</option>
              ))}
            </select>
          </>
        )}
        <input aria-label="문제 유형 수정" value={skillType} onChange={(e) => setSkillType(e.target.value)} placeholder="유형 (무엇을 묻는가)" className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[200px]" />
        <input aria-label="주제 수정" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="주제 (무엇에 대한 글인가)" className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[180px]" />
        <select aria-label="답안 형식 수정" value={format} disabled={structuralLocked || busy || formats.length <= 1 && formats.includes(format)} onChange={(e) => setFormat(e.target.value)} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 disabled:opacity-50">
          {(formats.includes(format) ? formats : [format, ...formats]).map((f) => (
            <option key={f} value={f}>{FORMAT_LABEL[f] ?? f}</option>
          ))}
        </select>
        {!confirming && (
          <button disabled={!dirty || busy} onClick={() => (preview ? setConfirming(true) : save())} className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
            {preview ? "변경 내용 확인" : "저장"}
          </button>
        )}
      </div>
      {structuralLocked && <p className="text-[11.5px] text-grey-500 mt-1">공개본의 문항 체계·답안 형식은 &apos;수정 초안 만들기&apos; 뒤 초안에서만 바꿀 수 있습니다.</p>}
      {confirming && preview && (
        <div className="mt-2 border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[12px]" data-testid="compat-preview">
          <b>바꾸기 전에 확인하세요.</b> 숨겨지는 값은 지우지 않습니다.
          <div className="mt-1"><span className="font-bold text-ink">유지:</span> {preview.kept.join(", ")}</div>
          <div className="mt-0.5"><span className="font-bold text-red">비활성화:</span> {preview.disabled.length ? preview.disabled.join(", ") : "없음"}</div>
          <div className="flex gap-2 mt-2">
            <button disabled={busy} onClick={save} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">이대로 변경</button>
            <button onClick={() => setConfirming(false)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectPicker({
  problem,
  subjects,
  busy,
  onRun,
}: {
  problem: BankProblem;
  subjects: AdminSubject[];
  busy: boolean;
  onRun: (job: Job, done?: string) => Promise<void>;
}) {
  // 2026-09-17(제품 오너 지시) — 과목 재배정은 문제은행 분류 정리 전용이다. 시험
  // 체계·영역·세부 기술·주제·난이도·답안 형식·문제·정답·해설은 여기서 바뀌지 않는다.
  // 활성 과목만 고를 수 있고, 바꾸면 옛 과목의 키워드 연결은 함께 지워진다.
  return (
    <div className="mb-3">
      <label className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5 block">과목</label>
      <select
        aria-label="문제 과목"
        disabled={busy}
        value={problem.subjectId ?? ""}
        onChange={(e) => {
          const newSubjectId = e.target.value;
          if (!newSubjectId || newSubjectId === problem.subjectId) return;
          void onRun(() => reassignProblemSubjectAction(problem.id, newSubjectId), "과목을 바꿨습니다. 기존 키워드는 함께 제거되어 새로 붙여야 합니다.");
        }}
        className="text-[12.5px] font-bold border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
      >
        {!problem.subjectId && <option value="">(과목 없음)</option>}
        {subjects.map((s) => (
          <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
        ))}
      </select>
    </div>
  );
}

function KeywordPicker({ problem, keywords, busy, onRun }: { problem: BankProblem; keywords: SubjectKeyword[]; busy: boolean; onRun: (job: Job, done?: string) => Promise<void> }) {
  const attached = new Set(problem.keywords.map((k) => k.id));
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">관리 과목 · 키워드 — {problem.subjectName}</div>
      {keywords.length === 0 ? (
        <p className="text-[12.5px] text-grey-500">이 과목에 등록된 키워드가 없습니다. 커리큘럼에서 먼저 키워드를 만드세요.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k) => {
            const on = attached.has(k.id);
            return (
              <button key={k.id} disabled={busy} onClick={() => void onRun(() => setProblemKeywordAction(problem.id, k.id, !on), on ? "키워드를 뗐습니다." : "키워드를 붙였습니다.")} className={"text-[12px] font-bold px-2.5 py-1 rounded-full border-[1.5px] disabled:opacity-50 " + (on ? "bg-ink text-white border-ink" : "bg-white text-grey-500 border-grey-200")}>
                {k.label}
              </button>
            );
          })}
        </div>
      )}
      {problem.keywords.length === 0 && <p className="text-[11.5px] text-grey-500 mt-1.5">키워드 없이도 저장하고 공개할 수 있습니다. 회차 자동 구성은 키워드로 후보를 찾으므로, 키워드가 없으면 구성에 포함되지 않습니다.</p>}
    </div>
  );
}
