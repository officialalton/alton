"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listBankProblemsAction,
  loadProblemVersionsAction,
  createBankProblemAction,
  createDraftVersionAction,
  submitVersionForReviewAction,
  publishVersionAction,
  setProblemArchivedAction,
  generateBankProblemsAction,
  type BankProblem,
  type ProblemVersionRow,
  type ProblemBankFilter,
} from "./problem-bank-actions";
import { listSubjectCatalogAction } from "./subject-actions";
import type { AdminSubject } from "./subject-data";

// P2 3차 — 관리자 문제은행. 교재와 독립된 진입점이다.
//
// 공개는 draft → 검수 요청 → 공개 세 단계를 사람이 눌러야 한다. AI가 만든
// 문제도 같은 흐름을 거친다 — 자동으로 공개되는 길은 없다.

const WORK_STATE_LABEL: Record<BankProblem["workState"], string> = {
  draft: "초안",
  in_review: "검수 중",
  published: "공개됨",
  none: "내용 없음",
};

const FORMAT_LABEL: Record<string, string> = { mc: "객관식", essay: "서술형", math: "수식" };

export default function ProblemBankTab({ subjects }: { subjects: AdminSubject[] }) {
  // SSR prop은 탭 조건부로 오기 때문에(app/admin/page.tsx의 need(...)) 목록에서
  // 빠지면 과목이 통째로 비어 버린다 — 실제로 그랬다. 화면이 그 목록에 기대지
  // 않도록 스스로 불러온다. prop이 이미 있으면 그것으로 먼저 그리고 뒤에서 갱신한다.
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

  const [filter, setFilter] = useState<ProblemBankFilter>({});
  const [problems, setProblems] = useState<BankProblem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setProblems(await listBankProblemsAction(filter));
    } catch {
      setProblems(null);
      setError("문제 목록을 불러오지 못했습니다.");
    }
  }, [filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(job: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
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
  }

  const activeSubjects = (catalog ?? []).filter((s) => !s.archivedAt);

  return (
    <div className="max-w-[880px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">문제은행</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        과목별 문제를 모아 보고, 새로 쓰거나 AI로 만들고, 검수를 거쳐 공개합니다.
        공개된 문제만 선생님의 회차 구성 후보가 됩니다.
      </p>

      {/* 보관됨과 현재는 한 목록에 섞지 않는다. 기본 진입은 현재다. */}
      <div className="flex gap-1 mb-4 border-b-[1.5px] border-grey-200">
        {[
          { key: false, label: "현재" },
          { key: true, label: "보관됨" },
        ].map((t) => (
          <button
            key={String(t.key)}
            onClick={() => setFilter((f) => ({ ...f, archived: t.key || undefined }))}
            className={
              "text-[13px] font-bold px-3.5 py-2 -mb-[1.5px] border-b-[2px] " +
              (Boolean(filter.archived) === t.key
                ? "border-ink text-ink"
                : "border-transparent text-grey-500")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

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

      <Filters
        subjects={activeSubjects}
        filter={filter}
        onChange={(next) => setFilter((f) => ({ ...f, ...next }))}
      />

      <NewProblemRow
        subjects={activeSubjects}
        busy={busy}
        onCreate={(p) => run(() => createBankProblemAction(p), "초안 문제를 만들었습니다.")}
        onGenerate={async (p) => {
          setBusy(true);
          setError(null);
          setNotice(null);
          try {
            const result = await generateBankProblemsAction(p);
            if (!result.ok) setError(result.error);
            else setNotice(`${result.value}개를 초안으로 만들었습니다. 검수 후 공개하세요.`);
            await reload();
          } catch {
            // 서버 액션이 던진 경우. 사유는 위의 { ok, error } 경로가 이미 전달한다.
            setError("문제를 생성하지 못했습니다.");
          } finally {
            setBusy(false);
          }
        }}
      />

      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      {notice && <p className="text-[12.5px] text-grey-500 mb-3">{notice}</p>}

      {problems === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중...</p>
      ) : problems.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {filter.archived ? "보관된 문제가 없습니다." : "조건에 맞는 문제가 없습니다."}
        </div>
      ) : (
        problems.map((p) => (
          <ProblemRow
            key={p.id}
            problem={p}
            open={openId === p.id}
            busy={busy}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            onArchive={(archived) =>
              run(
                () => setProblemArchivedAction(p.id, archived),
                archived ? "보관했습니다. 과거 기록은 그대로 남습니다." : "보관을 풀었습니다."
              )
            }
            onRun={run}
          />
        ))
      )}
    </div>
  );
}

function Filters({
  subjects,
  filter,
  onChange,
}: {
  subjects: AdminSubject[];
  filter: ProblemBankFilter;
  onChange: (next: Partial<ProblemBankFilter>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <select
        aria-label="과목"
        value={filter.subjectId ?? ""}
        onChange={(e) => onChange({ subjectId: e.target.value || undefined })}
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
        aria-label="상태"
        value={filter.workState ?? ""}
        onChange={(e) => onChange({ workState: (e.target.value || undefined) as never })}
        className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
      >
        <option value="">모든 상태</option>
        <option value="draft">초안</option>
        <option value="in_review">검수 중</option>
        <option value="published">공개됨</option>
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
        <option value="math">수식</option>
      </select>
      <input
        aria-label="문제 검색"
        value={filter.query ?? ""}
        onChange={(e) => onChange({ query: e.target.value || undefined })}
        placeholder="지문으로 찾기"
        className="flex-1 min-w-[180px] text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
      />
    </div>
  );
}

function NewProblemRow({
  subjects,
  busy,
  onCreate,
  onGenerate,
}: {
  subjects: AdminSubject[];
  busy: boolean;
  onCreate: (p: { subjectId: string; format: string; skillType?: string }) => void;
  onGenerate: (p: {
    subjectId: string;
    skillType: string;
    difficulty: string;
    format: string;
    count: number;
  }) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [format, setFormat] = useState("mc");
  const [skillType, setSkillType] = useState("");
  const [count, setCount] = useState("3");

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl p-3.5 mb-5">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
        새 문제
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="새 문제 과목"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
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
          <option value="math">수식</option>
        </select>
        <input
          aria-label="주제"
          value={skillType}
          onChange={(e) => setSkillType(e.target.value)}
          placeholder="주제 (예: 판별식 응용)"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 w-[200px]"
        />
        <button
          disabled={!subjectId || busy}
          onClick={() => onCreate({ subjectId, format, skillType: skillType.trim() || undefined })}
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
              difficulty: "medium",
              format,
              count: Number(count) || 1,
            })
          }
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          AI로 만들기
        </button>
      </div>
      <p className="text-[11.5px] text-grey-500 mt-2">
        어느 쪽으로 만들든 초안으로 들어갑니다. 검수를 거쳐야 공개됩니다.
      </p>
    </div>
  );
}

function ProblemRow({
  problem,
  open,
  busy,
  onToggle,
  onArchive,
  onRun,
}: {
  problem: BankProblem;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onArchive: (archived: boolean) => void;
  onRun: (
    job: () => Promise<{ ok: true } | { ok: false; error: string }>,
    done?: string
  ) => Promise<void>;
}) {
  const [versions, setVersions] = useState<ProblemVersionRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadProblemVersionsAction(problem.id).then((v) => {
      if (!cancelled) setVersions(v);
    });
    return () => {
      cancelled = true;
    };
  }, [open, problem.id, busy]);

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onToggle} className="text-left min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink truncate">
            {problem.passage ?? "(아직 내용이 없는 문제)"}
          </div>
          <div className="text-[12px] text-grey-500 mt-0.5">
            {problem.subjectName} · {FORMAT_LABEL[problem.format] ?? problem.format} ·{" "}
            {WORK_STATE_LABEL[problem.workState]}
            {problem.skillType ? ` · ${problem.skillType}` : ""}
            {problem.keywords.length
              ? ` · ${problem.keywords.map((k) => k.label).join(", ")}`
              : " · 키워드 없음"}
          </div>
        </button>
        <button
          disabled={busy}
          onClick={() => onArchive(!problem.archived)}
          className="text-[12px] font-bold text-grey-500 shrink-0"
        >
          {problem.archived ? "보관 풀기" : "보관"}
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t-[1.5px] border-grey-200 pt-3">
          <VersionEditor problem={problem} busy={busy} onRun={onRun} />
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-4 mb-1.5">
            버전 기록
          </div>
          {versions === null ? (
            <p className="text-[12.5px] text-grey-500">불러오는 중...</p>
          ) : versions.length === 0 ? (
            <p className="text-[12.5px] text-grey-500">아직 버전이 없습니다. 아래에서 초안을 만드세요.</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-[12.5px] py-1.5">
                <span className="truncate max-w-[520px]">
                  v{v.versionNo} · {VERSION_LABEL[v.status] ?? v.status}
                  {v.passage ? ` · ${v.passage.slice(0, 40)}` : ""}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {v.status === "draft" && (
                    <button
                      disabled={busy}
                      onClick={() => void onRun(() => submitVersionForReviewAction(v.id), "검수를 요청했습니다.")}
                      className="text-[11.5px] font-bold text-ink"
                    >
                      검수 요청
                    </button>
                  )}
                  {v.status === "in_review" && (
                    <button
                      disabled={busy}
                      onClick={() => void onRun(() => publishVersionAction(v.id), "공개했습니다.")}
                      className="text-[11.5px] font-bold text-ink"
                    >
                      공개
                    </button>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const VERSION_LABEL: Record<string, string> = {
  draft: "초안",
  in_review: "검수 중",
  published: "공개됨",
  archived: "지난 공개본",
};

function VersionEditor({
  problem,
  busy,
  onRun,
}: {
  problem: BankProblem;
  busy: boolean;
  onRun: (
    job: () => Promise<{ ok: true } | { ok: false; error: string }>,
    done?: string
  ) => Promise<void>;
}) {
  const [passage, setPassage] = useState("");
  const [options, setOptions] = useState("");
  const [correctIndex, setCorrectIndex] = useState("");
  const [explanation, setExplanation] = useState("");

  return (
    <div>
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
        새 초안 쓰기
      </div>
      <textarea
        aria-label="지문"
        value={passage}
        onChange={(e) => setPassage(e.target.value)}
        rows={3}
        placeholder="문제 지문"
        className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mb-2"
      />
      {problem.format === "mc" && (
        <div className="flex gap-2 mb-2">
          <input
            aria-label="선택지"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="선택지 (줄바꿈 대신 | 로 구분)"
            className="flex-1 text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
          />
          <input
            aria-label="정답 번호"
            value={correctIndex}
            onChange={(e) => setCorrectIndex(e.target.value)}
            placeholder="정답 (1부터)"
            className="w-[120px] text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
          />
        </div>
      )}
      <textarea
        aria-label="해설"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        rows={2}
        placeholder="해설"
        className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mb-2"
      />
      <button
        disabled={!passage.trim() || busy}
        onClick={() =>
          void onRun(
            () =>
              createDraftVersionAction({
                problemId: problem.id,
                passage: passage.trim(),
                options:
                  problem.format === "mc" && options.trim()
                    ? options.split("|").map((o) => o.trim()).filter(Boolean)
                    : null,
                // 화면은 1부터 세고 저장은 0부터 센다 — 사람이 읽는 번호를 그대로
                // 저장하면 정답이 한 칸 밀린다.
                correctIndex:
                  problem.format === "mc" && correctIndex.trim()
                    ? Number(correctIndex) - 1
                    : null,
                explanation: explanation.trim(),
                difficulty: problem.difficulty ?? "medium",
              }),
            "초안을 만들었습니다. 검수 요청 후 공개하세요."
          )
        }
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        초안 저장
      </button>
    </div>
  );
}
