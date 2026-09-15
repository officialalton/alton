"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBankProblemsAction,
  createBankProblemAction,
  createDraftVersionAction,
  createDraftFromPublishedAction,
  publishDraftAction,
  markFigureCheckedAction,
  uploadProblemImageAction,
  generateFigureForProblemAction,
  setProblemArchivedAction,
  setProblemKeywordAction,
  updateProblemMetaAction,
  generateBankProblemsAction,
  type BankProblem,
  type ProblemBankFilter,
} from "./problem-bank-actions";
import { listSubjectCatalogAction } from "./subject-actions";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import LearningText from "@/app/session/[id]/LearningText";
import { PROBLEM_SKILLS, findProblemSkill } from "@/lib/problem-skills";
import { SAT_DOMAINS, SKILL_BY_CODE, SKILL_CODES, domainShort, skillLabel, skillsForDomain } from "@/lib/problem-taxonomy";
import { LEGACY_FIGURE_TYPES, validateFigureSpec } from "@/lib/problem-figures/spec";
import { lintParallelTransversalAgainstText, renderParallelTransversal } from "@/lib/problem-figures/templates/parallel-transversal";
import { lintTriangleAgainstText, renderTriangle } from "@/lib/problem-figures/templates/triangle";
import { lintPlaneAgainstText, renderPlane } from "@/lib/problem-figures/templates/coordinate-plane";
import { lintDataAgainstText, renderData } from "@/lib/problem-figures/templates/data";
import { lintCircleAgainstText, renderCircle } from "@/lib/problem-figures/templates/circle";
import { lintPolygonAgainstText, renderPolygon } from "@/lib/problem-figures/templates/polygon";
import { lintSolidAgainstText, renderSolid } from "@/lib/problem-figures/templates/solid";
import { checkFigureClient as figureCheckClient } from "@/lib/problem-figures/check-client";
import { checkContent } from "@/lib/problem-content-check";
import type { AdminSubject, SubjectKeyword } from "./subject-data";

// P2 3차·8차 — 관리자 문제은행. 교재와 독립된 진입점이다.
//
// 2026-09-13 제품 오너 지시로 흐름을 정리했다:
//   초안 저장 → 미리보기·내용 확인 → 공개
// 관리자가 자기 자신에게 "검수 요청"을 누르는 단계는 없앴다. 내용을 눈으로 보지
// 않고 공개되는 길은 여전히 없다 — AI가 만든 것도 같다.

/** 목록을 나누는 세 자리. 보관됨은 서버에서 갈라 오고, 앞의 둘은 상태로 나눈다. */
type Bucket = "working" | "published" | "archived";

const BUCKETS: { key: Bucket; label: string; hint: string }[] = [
  { key: "working", label: "생성", hint: "초안과 확인 중인 문제입니다. 아직 수업에 쓰이지 않습니다." },
  { key: "published", label: "공개", hint: "지금 공개된 내용입니다. 회차 구성 후보가 됩니다." },
  { key: "archived", label: "보관", hint: "보관된 문제입니다. 과거 기록은 그대로 남습니다." },
];

const WORK_STATE_LABEL: Record<BankProblem["workState"], string> = {
  draft: "초안",
  in_review: "확인 중",
  published: "공개됨",
  none: "내용 없음",
};

const FORMAT_LABEL: Record<string, string> = { mc: "객관식", spr: "숫자 입력(SPR)", essay: "서술형", math: "풀이형" };

/** 왜 자동 구성 후보가 못 되는지. "공개했는데 왜 안 나오지?"를 설명 없이 남기지 않는다. */
const READINESS_NOTE: Record<BankProblem["readiness"], string | null> = {
  ok: null,
  not_confirmed: "아직 공개되지 않아 자동 구성에 포함되지 않습니다.",
  archived: "보관된 문제라 자동 구성에 포함되지 않습니다.",
  no_published_version: "공개된 버전이 없어 자동 구성에 포함되지 않습니다.",
  no_keyword: "키워드가 없어 자동 구성에 포함되지 않습니다. 키워드는 아래에서 붙일 수 있습니다.",
};

type Job = () => Promise<{ ok: true } | { ok: false; error: string }>;

// 2026-09-14 UAT: 지문·해설 칸이 작아 잘렸다 — 내용 길이에 맞춰 칸이 자란다.
function growToContent(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}
function autoGrow(el: HTMLTextAreaElement | null) {
  growToContent(el);
}

export default function ProblemBankTab({ subjects }: { subjects: AdminSubject[] }) {
  // SSR prop은 탭 조건부로 오기 때문에(app/admin/page.tsx의 need(...)) 목록에서
  // 빠지면 과목이 통째로 비어 버린다 — 실제로 그랬다. 화면이 그 목록에 기대지
  // 않도록 스스로 불러온다.
  const [catalog, setCatalog] = useState<AdminSubject[] | null>(
    subjects.length ? subjects : null
  );
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const archived = bucket === "archived";

  const reload = useCallback(async () => {
    setError(null);
    try {
      setProblems(await listBankProblemsAction({ ...filter, archived: archived || undefined }));
    } catch {
      setProblems(null);
      setError("문제 목록을 불러오지 못했습니다.");
    }
  }, [filter, archived]);

  useEffect(() => {
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

  const activeSubjects = useMemo(
    () => (catalog ?? []).filter((s) => !s.archivedAt),
    [catalog]
  );

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
    if (
      typeof window !== "undefined" &&
      !window.confirm(`지금 보이는 초안 ${publishableDrafts.length}개를 모두 공개할까요? 공개된 문제는 회차 구성 후보가 됩니다.`)
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const failed: string[] = [];
    let done = 0;
    for (const p of publishableDrafts) {
      const versionId = p.draft?.versionId;
      if (!versionId) continue;
      const result = await publishDraftAction(versionId);
      if (result.ok) done += 1;
      else failed.push(`${(p.draft?.passage ?? "").slice(0, 30) || "(내용 없음)"} — ${result.error}`);
    }
    await reload();
    setBusy(false);
    setNotice(`${done}개를 공개했습니다.${failed.length ? ` ${failed.length}개는 공개하지 못해 초안으로 남았습니다.` : ""}`);
    if (failed.length) setError(failed.join(" / "));
  }

  return (
    <div className="max-w-[880px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">문제은행</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        과목별 문제를 모아 보고, 새로 쓰거나 AI로 만들고, 내용을 확인한 뒤 공개합니다.
        공개된 문제만 회차 구성 후보가 됩니다.
      </p>

      <div className="flex gap-1 mb-2 border-b-[1.5px] border-grey-200">
        {BUCKETS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setBucket(t.key);
              setOpenId(null);
              // 탭을 옮길 때마다 다시 읽는다. 방금 공개한 문제가 공개 탭에 바로
              // 보여야 한다 — 나갔다 들어오게 만들지 않는다.
              void reload();
            }}
            className={
              "text-[13px] font-bold px-3.5 py-2 -mb-[1.5px] border-b-[2px] " +
              (bucket === t.key ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-grey-500 mb-4">{bucketHint}</p>

      {catalog === null && !catalogError && (
        <p className="text-[12.5px] text-grey-500 mb-3">과목을 불러오는 중...</p>
      )}
      {catalogError && (
        <p className="text-[12.5px] text-red mb-3">
          과목을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.
        </p>
      )}
      {catalog !== null && activeSubjects.length === 0 && (
        <p className="text-[12.5px] text-grey-500 mb-3">
          먼저 커리큘럼에서 과목을 만들어야 문제를 추가할 수 있습니다.
        </p>
      )}

      {/* 검색은 지금 보고 있는 탭 안에서만 찾는다 — 생성 탭에서 찾으면 초안만,
          공개 탭에서 찾으면 공개된 것만 나온다. 자리표시자로 그것을 밝힌다. */}
      <Filters
        subjects={activeSubjects}
        keywords={filter.subjectId ? keywordsBySubject.get(filter.subjectId) ?? [] : []}
        filter={filter}
        searchLabel={
          bucket === "working"
            ? "작성 중인 문제에서 찾기"
            : bucket === "published"
              ? "공개된 문제에서 찾기"
              : "보관된 문제에서 찾기"
        }
        onChange={(next) => setFilter((f) => ({ ...f, ...next }))}
      />

      {/* 새 문제는 '생성'에서만 만든다. 공개·보관 목록에 만들기 상자가 있을 이유가 없다. */}
      {bucket === "working" && (
        <NewProblemRow
          subjects={activeSubjects}
          keywordsBySubject={keywordsBySubject}
          busy={busy}
          onCreate={(p) => void run(() => createBankProblemAction(p), "초안 문제를 만들었습니다.")}
          onGenerate={async (p) => {
            setBusy(true);
            setError(null);
            setNotice(null);
            try {
              const result = await generateBankProblemsAction(p);
              if (!result.ok) setError(result.error);
              else
                setNotice(
                  `${result.value}개를 초안으로 만들었습니다. 내용을 확인한 뒤 공개하세요.`
                );
              await reload();
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
        // 2026-09-14 제품 오너: 문제를 많이 만들 것이라 하나씩 공개하기가 번거롭다. 지금 보이는(필터 적용) 초안을 한 번에 공개한다.
        // 각 문제는 같은 공개 검사를 거치고, 실패한 것은 그대로 초안으로 남아 사유가 보인다.
        <div className="flex flex-wrap items-center gap-3 mb-3 border-[1.5px] border-grey-200 rounded-xl px-4 py-2.5">
          <span className="text-[12.5px] text-ink">
            지금 보이는 초안 <b>{publishableDrafts.length}</b>개
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void publishAllVisible()}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {busy ? "공개 중…" : `전체 공개 (${publishableDrafts.length})`}
          </button>
          <span className="text-[11.5px] text-grey-500">내용을 확인한 초안만 공개하세요 — 공개된 문제는 회차 구성 후보가 됩니다.</span>
        </div>
      )}

      {problems === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중...</p>
      ) : visible.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {bucket === "archived"
            ? "보관된 문제가 없습니다."
            : bucket === "published"
              ? "공개된 문제가 없습니다."
              : "작성 중인 문제가 없습니다."}
        </div>
      ) : (
        visible.map((p) => (
          <ProblemRow
            key={p.id}
            problem={p}
            keywords={p.subjectId ? keywordsBySubject.get(p.subjectId) ?? [] : []}
            open={openId === p.id}
            busy={busy}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            onArchive={(next) =>
              void run(
                () => setProblemArchivedAction(p.id, next),
                next ? "보관했습니다. 과거 기록은 그대로 남습니다." : "보관을 풀었습니다."
              )
            }
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
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <select
        aria-label="과목"
        value={filter.subjectId ?? ""}
        onChange={(e) =>
          onChange({ subjectId: e.target.value || undefined, keywordId: undefined })
        }
        className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
      >
        <option value="">모든 과목</option>
        {subjects.map((s) => (
          <option key={s.subjectId} value={s.subjectId}>
            {s.subjectName}
          </option>
        ))}
      </select>
      <select
        aria-label="형식"
        value={filter.format ?? ""}
        onChange={(e) => onChange({ format: e.target.value || undefined })}
        className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
      >
        <option value="">모든 형식</option>
        <option value="mc">객관식</option>
        <option value="essay">서술형</option>
        <option value="spr">숫자 입력(SPR)</option>
        <option value="math">풀이형</option>
      </select>
      {/* 분류(2026-09-14): SAT 영역 → 세부 기술. 문제은행·자동 구성·성취 기록이 같은 기준을 쓴다. */}
      <select
        aria-label="SAT 영역"
        value={filter.satDomain ?? ""}
        onChange={(e) => onChange({ satDomain: e.target.value || undefined, skillCode: undefined })}
        className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
      >
        <option value="">모든 영역</option>
        {SAT_DOMAINS.map((d) => (
          <option key={d.code} value={d.code}>{d.label}</option>
        ))}
      </select>
      <select
        aria-label="세부 기술"
        value={filter.skillCode ?? ""}
        onChange={(e) => onChange({ skillCode: e.target.value || undefined })}
        className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[260px]"
      >
        <option value="">{filter.satDomain ? "모든 기술" : "모든 기술(영역 먼저 고르면 좁혀짐)"}</option>
        {(filter.satDomain ? skillsForDomain(filter.satDomain) : SKILL_CODES).map((k) => (
          <option key={k.code} value={k.code}>{k.label}</option>
        ))}
      </select>
      {/* 키워드는 과목에 속한다 — 과목을 고르기 전에는 고를 목록 자체가 없다. */}
      <select
        aria-label="키워드"
        disabled={!filter.subjectId}
        value={filter.keywordId ?? ""}
        onChange={(e) => onChange({ keywordId: e.target.value || undefined })}
        className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 disabled:opacity-50"
      >
        <option value="">{filter.subjectId ? "모든 키워드" : "과목을 먼저 고르세요"}</option>
        {keywords.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
      <input
        aria-label="문제 검색"
        value={filter.query ?? ""}
        onChange={(e) => onChange({ query: e.target.value || undefined })}
        placeholder={searchLabel}
        className="flex-1 min-w-[180px] text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
      />
    </div>
  );
}

function NewProblemRow({
  subjects,
  keywordsBySubject,
  busy,
  onCreate,
  onGenerate,
}: {
  subjects: AdminSubject[];
  keywordsBySubject: Map<string, SubjectKeyword[]>;
  busy: boolean;
  onCreate: (p: {
    subjectId: string;
    format: string;
    skillType?: string;
    skillCode?: string;
    topic?: string;
    difficulty?: string;
    keywordIds?: string[];
  }) => void;
  onGenerate: (p: {
    subjectId: string;
    skillType: string;
    skillCode?: string;
    topic?: string;
    difficulty: string;
    format: string;
    count: number;
    keywordIds?: string[];
    figurePolicy?: string;
  }) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [format, setFormat] = useState("mc");
  const [skillType, setSkillType] = useState("");
  // 2026-09-14 분류 — SAT 영역 → 세부 기술. 기술을 고르면 유형(생성 규칙)·형식·그림 요구 기본값이 따라온다.
  const [satDomain, setSatDomain] = useState("");
  const [skillCode, setSkillCode] = useState("");
  const [topic, setTopic] = useState("");
  // 2026-09-14 제품 오너: 만들 때 난이도를 고른다 — 직접 쓰기·AI 둘 다 같은 값.
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  // 2026-09-14: 그림은 모델 재량에 맡기면 거의 안 나온다 — 명시적으로 요구한다. 유형을 고르면 기본값이 따라온다.
  const [figurePolicy, setFigurePolicy] = useState<"none" | "optional" | "require_plane" | "require_geometry" | "require_data" | "require_figure_choice">("optional");
  const [count, setCount] = useState("3");
  const [keywordIds, setKeywordIds] = useState<string[]>([]);

  const keywords = subjectId ? keywordsBySubject.get(subjectId) ?? [] : [];

  function pickSubject(next: string) {
    setSubjectId(next);
    // 키워드는 과목에 속한다. 과목을 바꾸면 고른 키워드는 더 이상 그 과목 것이 아니다.
    setKeywordIds([]);
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl p-3.5 mb-5">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
        새 문제
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="새 문제 과목"
          value={subjectId}
          onChange={(e) => pickSubject(e.target.value)}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
        >
          <option value="">과목 고르기…</option>
          {subjects.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.subjectName}
            </option>
          ))}
        </select>
        <select
          aria-label="새 문제 형식"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
        >
          <option value="mc">객관식</option>
          <option value="essay">서술형</option>
          <option value="spr">숫자 입력(SPR)</option>
        <option value="math">풀이형</option>
        </select>
        <select
          aria-label="SAT 영역"
          value={satDomain}
          onChange={(e) => {
            setSatDomain(e.target.value);
            setSkillCode("");
          }}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
        >
          <option value="">SAT 영역…</option>
          {SAT_DOMAINS.map((d) => (
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
            const meta = SKILL_BY_CODE.get(code);
            if (meta) {
              const legacy = findProblemSkill(meta.legacySkill);
              if (legacy) {
                setSkillType(legacy.label);
                setFormat(legacy.defaultFormat);
              }
              setFigurePolicy(meta.figurePolicy);
            }
          }}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[280px] disabled:opacity-50"
        >
          <option value="">{satDomain ? "세부 기술…" : "영역을 먼저 고르세요"}</option>
          {skillsForDomain(satDomain).map((k) => (
            <option key={k.code} value={k.code}>{k.label}</option>
          ))}
        </select>
        {/* 유형과 주제는 다른 축이다 — 유형은 무엇을 묻는가(생성 규칙), 주제는 무엇에 대한 글인가. 기술을 고르면 유형은 자동. */}
        <input
          aria-label="문제 유형"
          value={skillType}
          onChange={(e) => {
            setSkillType(e.target.value);
            const skill = findProblemSkill(e.target.value);
            if (skill) {
              setFormat(skill.defaultFormat);
              setFigurePolicy(
                skill.code === "math.geometry_trig" ? "require_geometry" : skill.code === "math.problem_solving_data" ? "require_data" : skill.family === "SAT Math" ? "optional" : "none"
              );
            }
          }}
          placeholder="유형 (선택 · 목록에서 고르거나 직접)"
          list="problem-skill-list"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[220px]"
        />
        <datalist id="problem-skill-list">
          {PROBLEM_SKILLS.map((k) => (
            <option key={k.code} value={k.label}>{`${k.family} · ${k.label}`}</option>
          ))}
        </datalist>
        <input
          aria-label="주제"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="주제 (선택 · 예: 생태계)"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[180px]"
        />
        <select
          aria-label="난이도"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
        >
          <option value="easy">쉬움</option>
          <option value="medium">보통</option>
          <option value="hard">어려움</option>
        </select>
        <select
          aria-label="그림"
          value={figurePolicy}
          onChange={(e) => setFigurePolicy(e.target.value as typeof figurePolicy)}
          title="AI 생성 때 그림(그래프·도형 데이터)을 요구할지"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
        >
          <option value="none">그림 없음</option>
          <option value="optional">그림 필요하면</option>
          <option value="require_plane">그림 필수 · 좌표평면</option>
          <option value="require_geometry">그림 필수 · 도형</option>
          <option value="require_data">자료 필수 · 표/그래프</option>
          <option value="require_figure_choice">그래프 선택지 문항(4개 그림)</option>
        </select>
      </div>

      {/* 만들면서 바로 키워드를 붙인다. 선택 항목이고, 만든 뒤에도 고칠 수 있다. */}
      {subjectId && (
        <div className="mt-2.5">
          <div className="text-[11.5px] text-grey-500 mb-1.5">
            키워드 (선택) — 붙여 두면 회차 자동 구성 후보가 됩니다.
          </div>
          {keywords.length === 0 ? (
            <p className="text-[12px] text-grey-500">
              이 과목에 등록된 키워드가 없습니다. 커리큘럼에서 먼저 만드세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => {
                const on = keywordIds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setKeywordIds((prev) =>
                        on ? prev.filter((id) => id !== k.id) : [...prev, k.id]
                      )
                    }
                    className={
                      "text-[12px] font-bold px-2.5 py-1 rounded-full border-[1.5px] " +
                      (on
                        ? "bg-ink text-white border-ink"
                        : "bg-white text-grey-500 border-grey-200")
                    }
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center mt-3">
        <button
          disabled={!subjectId || busy}
          onClick={() =>
            onCreate({
              subjectId,
              format,
              skillType: skillType.trim() || undefined,
              skillCode: skillCode || undefined,
              topic: topic.trim() || undefined,
              difficulty,
              keywordIds: keywordIds.length ? keywordIds : undefined,
            })
          }
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          직접 쓰기
        </button>
        <span className="text-grey-300">|</span>
        <input
          aria-label="생성 개수"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 w-[64px]"
        />
        <button
          disabled={!subjectId || !skillType.trim() || busy}
          onClick={() =>
            onGenerate({
              subjectId,
              skillType: skillType.trim(),
              skillCode: skillCode || undefined,
              topic: topic.trim() || undefined,
              difficulty,
              format,
              count: Number(count) || 1,
              keywordIds: keywordIds.length ? keywordIds : undefined,
              figurePolicy,
            })
          }
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          AI로 만들기
        </button>
      </div>
      <p className="text-[11.5px] text-grey-500 mt-2">
        어느 쪽으로 만들든 초안으로 들어갑니다. 내용을 확인하고 공개를 눌러야 수업에 쓰입니다.
      </p>
    </div>
  );
}

function ProblemRow({
  problem,
  keywords,
  open,
  busy,
  onToggle,
  onArchive,
  onRun,
  onNotice,
}: {
  problem: BankProblem;
  keywords: SubjectKeyword[];
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onArchive: (archived: boolean) => void;
  onRun: (job: Job, done?: string) => Promise<void>;
  onNotice: (text: string) => void;
}) {
  const title =
    problem.published?.passage?.trim() ||
    problem.draft?.passage?.trim() ||
    "(아직 내용이 없는 문제)";

  const readinessNote = READINESS_NOTE[problem.readiness];

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onToggle} className="text-left min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink truncate" data-testid="bank-row-title">{title}</div>
          <div className="text-[12px] text-grey-500 mt-0.5">
            {problem.subjectName} · {FORMAT_LABEL[problem.format] ?? problem.format} ·{" "}
            {WORK_STATE_LABEL[problem.workState]}
            {problem.skillCode ? ` · ${domainShort(problem.satDomain)} › ${skillLabel(problem.skillCode)}` : problem.satDomain ? ` · ${domainShort(problem.satDomain)} › 기술 미지정` : " · 분류 없음"}
            {problem.skillType ? ` · 유형 ${problem.skillType}` : ""}
            {problem.topic ? ` · 주제 ${problem.topic}` : ""}
            {problem.keywords.length
              ? ` · ${problem.keywords.map((k) => k.label).join(", ")}`
              : " · 키워드 없음"}
          </div>
          {readinessNote && (
            <div className="text-[11.5px] text-red mt-1">{readinessNote}</div>
          )}
        </button>
        <button
          disabled={busy}
          onClick={() => onArchive(!problem.archived)}
          className="text-[12px] font-bold text-grey-500 shrink-0"
        >
          {problem.archived ? "보관 풀기" : "보관하기"}
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t-[1.5px] border-grey-200 pt-3">
          {problem.published && (
            <PublishedView
              problem={problem}
              busy={busy}
              onRun={onRun}
              onNotice={onNotice}
            />
          )}
          <MetaEditor problem={problem} busy={busy} onRun={onRun} />
          <KeywordPicker
            problem={problem}
            keywords={keywords}
            busy={busy}
            onRun={onRun}
          />
          {/* 공개된 문제에 빈 초안 상자를 열어 두지 않는다 — 고치는 길은 위의
              '수정 초안 만들기'이고, 빈 상자가 같이 있으면 어느 쪽으로 고쳐야 하는지
              알 수 없다. 초안이 있거나 아직 공개된 적이 없을 때만 편집기를 연다.
              key 를 두는 이유: 초안이 새로 생기거나 공개돼 사라지면 편집기를 다시
              띄워 서버의 현재 내용에서 시작하게 한다. */}
          {(problem.draft || !problem.published) && (
            <DraftEditor
              key={problem.draft?.versionId ?? "none"}
              problem={problem}
              busy={busy}
              onRun={onRun}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** 지금 공개돼 있는 내용. 관리자만 이 화면에 들어온다. */
function PublishedView({
  problem,
  busy,
  onRun,
  onNotice,
}: {
  problem: BankProblem;
  busy: boolean;
  onRun: (job: Job, done?: string) => Promise<void>;
  onNotice: (text: string) => void;
}) {
  const published = problem.published!;
  const hasDraft = Boolean(problem.draft);

  return (
    <div className="bg-grey-100 rounded-lg px-4 py-3 mb-4">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
        지금 공개된 내용
      </div>
      <ContentPreview
        format={problem.format}
        passage={published.passage}
        options={published.options}
        correctIndex={published.correctIndex}
        explanation={published.explanation}
      />
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <button
          disabled={busy}
          onClick={async () => {
            // 이미 초안이 있으면 새로 만들지 않고 그것을 이어서 고친다 —
            // 반복 클릭으로 초안이 늘어나지 않게 한다.
            await onRun(async () => {
              const result = await createDraftFromPublishedAction(problem.id);
              if (!result.ok) return result;
              onNotice(
                result.value.reused
                  ? "이미 작업 중인 수정 초안이 있어 그대로 불러왔습니다. 아래에서 이어서 편집하세요."
                  : "공개본을 복사해 수정 초안을 만들었습니다. 아래에서 고친 뒤 공개하세요."
              );
              return { ok: true };
            });
          }}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          {hasDraft ? "수정 초안 이어서 편집" : "수정 초안 만들기"}
        </button>
        <span className="text-[11.5px] text-grey-500">
          공개된 버전은 고치지 않습니다. 고친 내용을 다시 공개하면 새 버전이 되고,
          이미 시작한 수업은 당시 버전을 그대로 봅니다.
        </span>
      </div>
    </div>
  );
}

/** 유형·주제는 버전 내용과 다른 축이라 공개된 문제에서도 바로 고칠 수 있다. */
function MetaEditor({
  problem,
  busy,
  onRun,
}: {
  problem: BankProblem;
  busy: boolean;
  onRun: (job: Job, done?: string) => Promise<void>;
}) {
  const [skillType, setSkillType] = useState(problem.skillType ?? "");
  const [topic, setTopic] = useState(problem.topic ?? "");
  const [satDomain, setSatDomain] = useState(problem.satDomain ?? "");
  const [skillCode, setSkillCode] = useState(problem.skillCode ?? "");

  const dirty =
    skillType !== (problem.skillType ?? "") || topic !== (problem.topic ?? "") ||
    satDomain !== (problem.satDomain ?? "") || skillCode !== (problem.skillCode ?? "");

  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
        분류 · 유형 · 주제
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="SAT 영역 수정"
          value={satDomain}
          onChange={(e) => {
            setSatDomain(e.target.value);
            setSkillCode("");
          }}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
        >
          <option value="">SAT 영역 없음</option>
          {SAT_DOMAINS.map((d) => (
            <option key={d.code} value={d.code}>{d.label}</option>
          ))}
        </select>
        <select
          aria-label="세부 기술 수정"
          value={skillCode}
          disabled={!satDomain}
          onChange={(e) => setSkillCode(e.target.value)}
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[280px] disabled:opacity-50"
        >
          <option value="">{satDomain ? "세부 기술 미지정" : "영역을 먼저 고르세요"}</option>
          {skillsForDomain(satDomain).map((k) => (
            <option key={k.code} value={k.code}>{k.label}</option>
          ))}
        </select>
        <input
          aria-label="문제 유형 수정"
          value={skillType}
          onChange={(e) => setSkillType(e.target.value)}
          placeholder="유형 (선택 · 무엇을 묻는가)"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[220px]"
        />
        <input
          aria-label="주제 수정"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="주제 (선택 · 무엇에 대한 글인가)"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[220px]"
        />
        <button
          disabled={!dirty || busy}
          onClick={() =>
            void onRun(
              () => updateProblemMetaAction(problem.id, { skillType, topic, skillCode: skillCode || null, satDomain: satDomain || null }),
              "분류·유형·주제를 저장했습니다."
            )
          }
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          저장
        </button>
      </div>
    </div>
  );
}

/** 과목에 속한 키워드를 눌러 붙이고 뗀다. 공개 목록에서도 그대로 쓸 수 있다. */
function KeywordPicker({
  problem,
  keywords,
  busy,
  onRun,
}: {
  problem: BankProblem;
  keywords: SubjectKeyword[];
  busy: boolean;
  onRun: (job: Job, done?: string) => Promise<void>;
}) {
  const attached = new Set(problem.keywords.map((k) => k.id));

  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
        키워드
      </div>
      {keywords.length === 0 ? (
        <p className="text-[12.5px] text-grey-500">
          이 과목에 등록된 키워드가 없습니다. 커리큘럼에서 먼저 키워드를 만드세요.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k) => {
            const on = attached.has(k.id);
            return (
              <button
                key={k.id}
                disabled={busy}
                onClick={() =>
                  void onRun(
                    () => setProblemKeywordAction(problem.id, k.id, !on),
                    on ? "키워드를 뗐습니다." : "키워드를 붙였습니다."
                  )
                }
                className={
                  "text-[12px] font-bold px-2.5 py-1 rounded-full border-[1.5px] disabled:opacity-50 " +
                  (on
                    ? "bg-ink text-white border-ink"
                    : "bg-white text-grey-500 border-grey-200")
                }
              >
                {k.label}
              </button>
            );
          })}
        </div>
      )}
      {problem.keywords.length === 0 && (
        <p className="text-[11.5px] text-grey-500 mt-1.5">
          키워드 없이도 저장하고 공개할 수 있습니다. 다만 회차 자동 구성은 키워드로
          후보를 찾으므로, 키워드가 없으면 구성에 포함되지 않습니다.
        </p>
      )}
    </div>
  );
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/**
 * 초안을 쓰고, 미리 본 뒤 공개한다.
 *
 * 객관식은 항상 4지선다다 — 칸 네 개와 정답 라디오 하나. 기존에 4개가 아닌 문제가
 * 있으면 그 개수만큼 칸을 열어 둔다. 화면이 값을 잘라내지 않는다.
 */
function DraftEditor({
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
  const [answersText, setAnswersText] = useState((source?.answers ?? []).join(", "));
  // 로마숫자 진술(I, II, III) — 한 줄에 하나. 선택지는 'I only' 같은 조합이어야 한다(검증).
  const [statementsText, setStatementsText] = useState((source?.statements ?? []).join("\n"));
  const statementsPayload = statementsText.split("\n").map((x) => x.replace(/^\s*(?:I{1,3}|IV|V)[.)]\s*/, "").trim()).filter(Boolean);
  const answersPayload = isSpr
    ? answersText.split(/[,\n]/).map((a) => a.trim()).filter(Boolean)
    : null;
  // 2026-09-14 ③ — 도형·그래프 데이터(JSON). 미리보기로 확인하고 '그림 확인함'을 켜야 공개된다.
  const [figureText, setFigureText] = useState(source?.figure ? JSON.stringify(source.figure, null, 2) : "");
  const [figureChecked, setFigureChecked] = useState(Boolean(source?.figureChecked));
  const figureParsed: { spec: unknown | null; error: string | null } = (() => {
    if (!figureText.trim()) return { spec: null, error: null };
    try {
      const parsed = JSON.parse(figureText) as unknown;
      const v = validateFigureSpec(parsed);
      return v.ok ? { spec: parsed, error: null } : { spec: null, error: v.error };
    } catch {
      return { spec: null, error: "JSON 을 읽을 수 없습니다." };
    }
  })();
  // jsonb 는 키 순서를 바꿔 돌려주므로 정렬해 비교한다 — 같은 그림을 '바뀐 것'으로 보면 확인 체크가 잠긴 채 남는다.
  const figureDirty = canonical(figureParsed.spec ?? null) !== canonical(source?.figure ?? null);
  const [passage, setPassage] = useState(source?.passage ?? "");
  const initialOptions = useMemo(() => {
    const existing = source?.options ?? [];
    return existing.length > 4 ? [...existing] : [0, 1, 2, 3].map((i) => existing[i] ?? "");
  }, [source]);
  const [options, setOptions] = useState<string[]>(initialOptions);
  // 표준 렌더링 검증(클라이언트에서도 같은 규칙으로 즉시) — 저장하면 서버가 같은 검사를 해 render_check 에 남긴다.
  const figureIsLegacy = figureParsed.spec != null && LEGACY_FIGURE_TYPES.includes((figureParsed.spec as { type?: string }).type ?? "");
  const figureIsImage = figureParsed.spec != null && (figureParsed.spec as { type?: string }).type === "image";
  const [imageAlt, setImageAlt] = useState<string>(figureIsImage ? String((figureParsed.spec as { alt?: string }).alt ?? "") : "");
  const figureForSave: unknown | null = figureIsImage && figureParsed.spec ? { ...(figureParsed.spec as object), alt: imageAlt.trim() } : figureParsed.spec;
  const figureIssues: { code: string; message: string }[] = (() => {
    const spec = figureForSave as { type?: string } | null;
    if (!spec) return [];
    if (spec.type === "parallel_transversal") {
      const r = renderParallelTransversal(spec as never);
      return [...r.issues, ...lintParallelTransversalAgainstText(spec as never, passage)];
    }
    if (spec.type === "triangle") {
      const r = renderTriangle(spec as never);
      return [...r.issues, ...lintTriangleAgainstText(spec as never, passage)];
    }
    if (spec.type === "plane") {
      const r = renderPlane(spec as never);
      return [...r.issues, ...lintPlaneAgainstText(spec as never, passage, isMc ? options : null)];
    }
    if (spec.type === "data") {
      const r = renderData(spec as never);
      return [...r.issues, ...lintDataAgainstText(spec as never, passage)];
    }
    if (spec.type === "circle") {
      const r = renderCircle(spec as never);
      return [...r.issues, ...lintCircleAgainstText(spec as never, passage)];
    }
    if (spec.type === "polygon") {
      const r = renderPolygon(spec as never);
      return [...r.issues, ...lintPolygonAgainstText(spec as never, passage)];
    }
    if (spec.type === "solid") {
      const r = renderSolid(spec as never);
      return [...r.issues, ...lintSolidAgainstText(spec as never, passage)];
    }
    if (spec.type === "image" && !imageAlt.trim()) return [{ code: "alt_required", message: "올린 그림에는 대체 설명이 필요합니다." }];
    if (spec.type === "figure_choice" || spec.type === "figure_set") return figureCheckClient(spec, passage, isMc ? options : null);
    return [];
  })();
  const figureAlt = (() => {
    const t = (figureForSave as { type?: string } | null)?.type;
    if (t === "parallel_transversal") return renderParallelTransversal(figureForSave as never).alt;
    if (t === "triangle") return renderTriangle(figureForSave as never).alt;
    if (t === "plane") return renderPlane(figureForSave as never).alt;
    if (t === "data") return renderData(figureForSave as never).alt;
    if (t === "circle") return renderCircle(figureForSave as never).alt;
    if (t === "polygon") return renderPolygon(figureForSave as never).alt;
    if (t === "solid") return renderSolid(figureForSave as never).alt;
    return figureIsImage ? imageAlt : null;
  })();
  const [figureNotice, setFigureNotice] = useState<string | null>(null);
  const [figureBusy, setFigureBusy] = useState(false);


  const [correctIndex, setCorrectIndex] = useState<number | null>(
    source?.correctIndex ?? null
  );
  const [explanation, setExplanation] = useState(source?.explanation ?? "");
  const contentIssues = checkContent({
    format: problem.format, passage, options: isMc ? options.map((o) => o.trim()).filter(Boolean) : null,
    correctIndex, explanation, answers: answersPayload, statements: statementsPayload.length ? statementsPayload : null,
  });

  const filledOptions = options.map((o) => o.trim());
  const optionsPayload = isMc && filledOptions.some(Boolean) ? filledOptions : null;

  const canSave = passage.trim().length > 0;
  const missingAnswer = isMc && optionsPayload !== null && correctIndex === null;

  /** 지금 화면에 있는 내용을 초안으로 저장하고, 저장된 버전 id 를 돌려준다. */
  async function saveDraft(): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
    return createDraftVersionAction({
      answers: answersPayload,
      statements: statementsPayload.length ? statementsPayload : null,
      figure: figureForSave,
      figureChecked: figureChecked && !figureDirty,
      problemId: problem.id,
      passage: passage.trim(),
      options: optionsPayload,
      correctIndex: optionsPayload ? correctIndex : null,
      explanation: explanation.trim(),
      difficulty: problem.difficulty ?? "medium",
    });
  }

  return (
    <div>
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
        {source ? "작업 중인 초안" : "새 초안 쓰기"}
      </div>

      {options.length > 4 && (
        <p className="text-[11.5px] text-red mb-2">
          선택지가 {options.length}개입니다. 새 문제는 4지선다로 만들지만, 기존 내용을
          임의로 줄이지 않습니다 — 필요하면 직접 정리하세요.
        </p>
      )}

      <textarea
        aria-label="지문"
        value={passage}
        onChange={(e) => setPassage(e.target.value)}
        ref={autoGrow}
        onInput={(e) => growToContent(e.currentTarget)}
        rows={3}
        placeholder="문제 지문"
        className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mb-2 resize-none overflow-hidden"
      />
      {/* 2026-09-14 UAT: 편집 칸엔 마크다운 원문(| 표 |, $수식$)이 그대로 보여 "허접해" 보였다 —
          학생·교사 화면과 같은 렌더를 바로 아래에 보여준다. */}
      {(passage.includes("|") || passage.includes("$") || passage.includes("__") || /^\s*[-•]\s/m.test(passage) || options.some((o) => o.includes("$"))) && (
        <div className="mb-3 border-[1.5px] border-dashed border-grey-200 rounded-lg px-4 py-3" data-testid="passage-preview">
          <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1">학생 화면 미리보기</div>
          <LearningText text={passage} className="learning-body text-[14px] leading-[1.75] text-ink" />
          {isMc && options.some((o) => o.trim()) && (
            <ol className="mt-2">
              {options.map((o, i) =>
                o.trim() ? (
                  <li key={i} className="text-[13.5px] text-ink py-0.5">
                    <span className="text-grey-500 mr-2">{i + 1}</span>
                    <LearningText text={o} className="learning-body inline" />
                  </li>
                ) : null
              )}
            </ol>
          )}
        </div>
      )}

      {isMc && (
        <div className="mb-2">
          <div className="text-[11.5px] text-grey-500 mb-1.5">
            선택지와 정답. 정답은 하나만 고릅니다.
          </div>
          {options.map((value, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <label className="flex items-center gap-1.5 shrink-0">
                <input
                  type="radio"
                  name={`correct-${problem.id}`}
                  aria-label={`${i + 1}번이 정답`}
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                />
                <span className="text-[12px] font-bold text-grey-500 w-[14px]">{i + 1}</span>
              </label>
              <input
                aria-label={`선택지 ${i + 1}`}
                value={value}
                onChange={(e) =>
                  setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                }
                placeholder={`선택지 ${i + 1}`}
                className="flex-1 text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
              />
            </div>
          ))}
        </div>
      )}

      {isSpr && (
        <div className="mb-2">
          <div className="text-[11.5px] text-grey-500 mb-1.5">
            정답(숫자 입력). 동치 답이 여럿이면 쉼표로 — 예: <code>7/2, 3.5</code>. 분수·소수·음수 가능, 기호($, %, 쉼표)는 빼고. 학생 답은 서버가 정규화해 비교합니다.
          </div>
          <input
            aria-label="정답 목록"
            value={answersText}
            onChange={(e) => setAnswersText(e.target.value)}
            placeholder="예: 7/2, 3.5"
            className="w-full text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
          />
        </div>
      )}

      {isMc && (
        <div className="mb-2">
          <textarea
            aria-label="진술 목록"
            value={statementsText}
            onChange={(e) => setStatementsText(e.target.value)}
            rows={2}
            placeholder={"로마숫자 진술 문항일 때만 — 한 줄에 하나 (I, II, III). 예:\n$a > 0$\n$b < 0$"}
            className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mb-1"
          />
          {contentIssues.length > 0 && (
            <ul className="text-[12px] text-red list-disc pl-5" data-testid="content-issues">
              {contentIssues.map((i) => <li key={i.code + i.message}>{i.message}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="mb-2" data-testid="figure-section">
        <div className="text-[11.5px] text-grey-500 mb-1.5">
          그림(선택) — 표준 렌더러가 그립니다. AI 는 관계(평행선·횡단선·각의 자리)만 내고 좌표·라벨 자리는 ALTON 이 정합니다.
          렌더된 미리보기를 보고 <b>미리보기로 확인함</b>을 켜야 공개됩니다. 검증에 걸린 그림은 공개되지 않습니다.
        </div>

        {figureParsed.spec != null && (
          <div className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-2 bg-white" data-testid="figure-preview">
            <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-2">학생 화면 미리보기 (표준 렌더러)</div>
            <div className="max-w-[520px]">
              <ProblemFigure spec={figureParsed.spec} />
            </div>
            {figureAlt && <p className="text-[11.5px] text-grey-500 mt-2">대체 설명: {figureAlt}</p>}
          </div>
        )}
        {figureIsLegacy && (
          <p className="text-[12px] font-bold text-red mb-1.5" data-testid="figure-legacy">
            재생성 필요 — 옛 형식 그림(좌표 자유 입력)은 지원이 끝나 공개할 수 없습니다. 아래 &apos;AI로 … 데이터 만들기&apos;로 표준 템플릿으로 다시 만들거나 그림 파일을 올리세요.
          </p>
        )}
        {figureIssues.length > 0 && !figureIsLegacy && (
          <ul className="text-[12px] text-red mb-1.5 list-disc pl-5" data-testid="figure-issues">
            {figureIssues.map((i) => (
              <li key={i.code + i.message}>{i.message}</li>
            ))}
          </ul>
        )}
        {figureParsed.spec != null && figureIssues.length === 0 && !figureIsLegacy && (
          <p className="text-[11.5px] text-green mb-1.5">표준 렌더링 검증 통과 — 지문 참조·라벨 중복·겹침·잘림 없음.</p>
        )}
        {figureIsImage && (
          <label className="flex flex-wrap items-center gap-2 text-[12px] text-ink mb-1.5">
            <span className="font-bold">대체 설명(필수)</span>
            <input
              aria-label="그림 대체 설명"
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
              placeholder="예: 삼각형 ABC, 변 AB = 6, 각 B 는 직각"
              className="flex-1 min-w-[240px] text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
            />
          </label>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {(["parallel_transversal", "triangle", "circle", "polygon", "solid", "plane", "data", "figure_choice"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={busy || figureBusy || !passage.trim()}
              onClick={async () => {
                setFigureBusy(true);
                setFigureNotice(null);
                const r = await generateFigureForProblemAction({ passage, options: isMc ? options : null, explanation, kind });
                setFigureBusy(false);
                if (!r.ok) {
                  setFigureNotice(`그림을 만들지 못했습니다 — ${r.error}`);
                  return;
                }
                setFigureText(JSON.stringify(r.value, null, 2));
                setFigureNotice("AI 가 도형 데이터를 만들었습니다. 미리보기와 검증 결과를 보고 초안을 저장한 뒤 '미리보기로 확인함'을 켜세요.");
              }}
              className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
            >
              {figureBusy ? "만드는 중…" : kind === "plane" ? "AI로 좌표평면 데이터 만들기" : kind === "data" ? "AI로 표·그래프 데이터 만들기" : kind === "figure_choice" ? "AI로 그래프 선택지 4개 만들기" : kind === "triangle" ? "AI로 도형 데이터 만들기(삼각형)" : kind === "circle" ? "AI로 도형 데이터 만들기(원)" : kind === "polygon" ? "AI로 도형 데이터 만들기(사각형·다각형)" : kind === "solid" ? "AI로 도형 데이터 만들기(입체)" : "AI로 도형 데이터 만들기(평행선·횡단선)"}
            </button>
          ))}
          <label className="inline-flex items-center gap-2 text-[12px] text-ink">
            <span className="font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 cursor-pointer">그림 파일 올리기</span>
            <input
              type="file"
              aria-label="그림 파일"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
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
            />
            <span className="text-grey-500">지원 밖 도형(삼각형·원 등)은 직접 만든 PNG·SVG 로 — 5MB 이하</span>
          </label>
        </div>
        {figureNotice && <p className="text-[11.5px] text-ink mb-1.5">{figureNotice}</p>}
        {figureParsed.error && <p className="text-[11.5px] text-red mb-1.5">그림 데이터 오류 — {figureParsed.error}</p>}

        {figureParsed.spec != null && source?.versionId && (
          <label className="flex items-center gap-2 text-[12.5px] text-ink mb-1.5">
            <input
              type="checkbox"
              aria-label="그림 확인함"
              checked={figureChecked && !figureDirty}
              disabled={figureDirty || busy || figureIssues.length > 0 || figureIsLegacy}
              onChange={(e) => {
                const next = e.target.checked;
                setFigureChecked(next);
                void onRun(() => markFigureCheckedAction(source.versionId, next), next ? "미리보기로 확인했다고 표시했습니다." : "확인을 해제했습니다.");
              }}
            />
            미리보기로 확인함
            {figureDirty ? " — 먼저 초안을 저장하세요(그림이 바뀌었습니다)" : figureIssues.length > 0 ? " — 검증 문제를 먼저 해결하세요" : ""}
          </label>
        )}

        <details className="text-[12px]">
          <summary className="cursor-pointer text-grey-500">도형 데이터 편집(고급)</summary>
          <textarea
            aria-label="그림 데이터"
            value={figureText}
            onChange={(e) => setFigureText(e.target.value)}
            ref={autoGrow}
            onInput={(e) => growToContent(e.currentTarget)}
            rows={2}
            placeholder='예: {"type":"parallel_transversal","parallel":["m","n"],"transversals":[{"id":"k"}],"angles":[{"at":["m","k"],"region":"NW","label":"x°"}]}'
            className="w-full text-[12px] font-mono border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mt-1.5 mb-1.5 resize-none overflow-hidden"
          />
        </details>
      </div>

      <textarea
        aria-label="해설"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        ref={autoGrow}
        onInput={(e) => growToContent(e.currentTarget)}
        rows={2}
        placeholder="해설"
        className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mb-2 resize-none overflow-hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={!canSave || busy}
          onClick={() =>
            void onRun(saveDraft, "초안을 저장했습니다. 아직 수업에 쓰이지 않습니다.")
          }
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          초안 저장
        </button>
        <button
          disabled={!canSave || busy || missingAnswer}
          onClick={() =>
            // 화면에 있는 내용을 그대로 공개한다. 저장하지 않은 수정이 남은 채 옛
            // 내용이 공개되지 않도록 저장부터 하고, **저장이 돌려준 버전**을 공개한다
            // — 화면이 들고 있던 옛 버전 id 를 쓰면 엉뚱한 것을 공개하게 된다.
            void onRun(async () => {
              const saved = await saveDraft();
              if (!saved.ok) return saved;
              return publishDraftAction(saved.value);
            }, "공개했습니다. 공개 탭에서 볼 수 있습니다.")
          }
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          공개하기
        </button>
        {problem.keywords.length === 0 && (
          <span className="text-[11.5px] text-grey-500">
            키워드가 없어 자동 구성에는 포함되지 않습니다. 공개는 됩니다.
          </span>
        )}
      </div>

      {missingAnswer && (
        <p className="text-[11.5px] text-red mt-2">정답을 하나 골라주세요.</p>
      )}
    </div>
  );
}

function ContentPreview({
  format,
  passage,
  options,
  correctIndex,
  explanation,
}: {
  format: string;
  passage: string | null;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string | null;
}) {
  return (
    <div className="text-[13px] text-ink">
      <p className="whitespace-pre-wrap leading-[1.6]">
        {passage || <span className="text-grey-500">(지문이 비어 있습니다)</span>}
      </p>
      {format === "mc" && options && options.length > 0 && (
        <ol className="mt-2 space-y-0.5">
          {options.map((o, i) => (
            <li
              key={i}
              className={
                "text-[12.5px] " + (correctIndex === i ? "font-bold text-ink" : "text-grey-500")
              }
            >
              {i + 1}. {o || "(비어 있음)"}
              {correctIndex === i ? " · 정답" : ""}
            </li>
          ))}
        </ol>
      )}
      {explanation && (
        <p className="text-[12.5px] text-grey-500 mt-2 whitespace-pre-wrap leading-[1.6]">
          해설 · {explanation}
        </p>
      )}
    </div>
  );
}
