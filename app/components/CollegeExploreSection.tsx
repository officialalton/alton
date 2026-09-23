"use client";

// 2026-09-19(제품 오너 지시) — 200개교 데이터를 모으기 전에 그 데이터를 보여줄 학생·학부모용
// "대학 탐색" 화면을 먼저 만든다. 로드맵 탭의 세 번째 서브탭으로 들어간다(2026-09-18 결정:
// 대학 관련 학생 진입점은 로드맵 탭 안에 둔다). 읽기 전용 — 합격 확률/가능성 예측은 정책상 없다.

import { useEffect, useState, useTransition } from "react";
import {
  listUniversities,
  getUniversityDetailForStudent,
  loadAdmissionMetrics,
  loadUniversityEssayPrompts,
  type UniversitySummary,
  type UniversityDetail,
  type AdmissionCycle,
  type AdmissionMetric,
  type AdmissionMetricCohort,
  type UniversityMajor,
  type UniversityUpdateEntry,
  type UniversityEssayPrompt,
  type EssayPrompt as LegacyEssayPrompt,
  type UniversitySourceUrl,
} from "@/lib/universities/actions";
import { listMySubmittedSourceUrls, proposeUniversitySourceUrl, reportUniversityDataIssue } from "@/lib/universities/user-actions";
import { requestUniversityRefresh } from "@/lib/universities/refresh-actions";

const SOURCE_TYPE_LABEL: Record<string, string> = {
  admissions_homepage: "입학처 홈페이지",
  common_data_set: "Common Data Set",
  catalog_programs: "카탈로그/전공",
  deadlines: "지원 마감일",
  essay_prompts: "에세이 문항",
  admitted_profile: "합격자 프로필",
  financial_aid: "재정지원",
  other: "기타",
};

const cardClass = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4";
const cardTitleClass = "text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2";
const SETTING_LABEL: Record<string, string> = { urban: "도시", suburban: "교외", rural: "시골", town: "소도시" };
const CALENDAR_LABEL: Record<string, string> = { semester: "학기제(Semester)", quarter: "쿼터제(Quarter)", trimester: "트라이메스터", "4-1-4": "4-1-4제", other: "기타" };

export default function CollegeExploreSection({ canProposeSourceUrl = false }: { canProposeSourceUrl?: boolean }) {
  const [search, setSearch] = useState("");
  const [list, setList] = useState<UniversitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const rows = await listUniversities({ search: search.trim() || undefined });
        setList(rows);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "대학 목록을 불러오지 못했습니다.");
      }
    });

  }, [search]);

  if (selectedId) {
    return <CollegeDetail universityId={selectedId} onBack={() => setSelectedId(null)} canProposeSourceUrl={canProposeSourceUrl} />;
  }

  return (
    <div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="대학 이름으로 검색 (예: Stanford)"
        className="w-full mb-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        aria-label="대학 검색"
      />
      {error && <div className="mb-3 text-[12px] text-red bg-red/10 rounded-lg px-3 py-2">{error}</div>}
      {list === null && !error && <p className="text-[12.5px] text-grey-500">불러오는 중…</p>}
      {list !== null && list.length === 0 && <p className="text-[12.5px] text-grey-500">일치하는 대학이 없습니다.</p>}
      <div className={pending ? "opacity-60" : ""}>
        {list?.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSelectedId(u.id)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2 hover:bg-grey-100"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13.5px] text-ink">
                {u.rankFinal ? `#${u.rankFinal} ` : ""}
                {u.name}
              </span>
              {u.publicPrivate && <span className="text-[10.5px] font-bold text-grey-500">{u.publicPrivate}</span>}
            </div>
            <div className="text-[11.5px] text-grey-500 mt-0.5">
              {[u.city, u.state].filter(Boolean).join(", ") || u.country}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CollegeDetail({
  universityId,
  onBack,
  canProposeSourceUrl = false,
}: {
  universityId: string;
  onBack: () => void;
  canProposeSourceUrl?: boolean;
}) {
  const [detail, setDetail] = useState<{ university: UniversityDetail; cycles: AdmissionCycle[]; updates: UniversityUpdateEntry[]; majors: UniversityMajor[]; essayPrompts: LegacyEssayPrompt[]; sourceUrls: UniversitySourceUrl[] } | null>(null);
  const [metrics, setMetrics] = useState<AdmissionMetric[] | null>(null);
  const [essayCycleYear, setEssayCycleYear] = useState<number | null>(null);
  const [essays, setEssays] = useState<UniversityEssayPrompt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUniversityDetailForStudent(universityId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "대학 정보를 불러오지 못했습니다.");
      });
    loadAdmissionMetrics(universityId)
      .then((m) => {
        if (!cancelled) setMetrics(m);
      })
      .catch(() => {
        if (!cancelled) setMetrics([]);
      });
    loadUniversityEssayPrompts(universityId)
      .then((rows) => {
        if (cancelled) return;
        setEssays(rows);
        const years = Array.from(new Set(rows.map((r) => r.cycleYear))).sort((a, b) => b - a);
        setEssayCycleYear((prev) => prev ?? years[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setEssays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [universityId]);

  return (
    <div>
      <button type="button" onClick={onBack} className="text-[12px] font-bold text-grey-500 mb-3">
        ← 목록으로
      </button>
      {error && <div className="mb-3 text-[12px] text-red bg-red/10 rounded-lg px-3 py-2">{error}</div>}
      {!detail && !error && <p className="text-[12.5px] text-grey-500">불러오는 중…</p>}
      {detail && (
        <>
          <div className={cardClass}>
            <div className="text-[15px] font-bold text-ink mb-0.5">
              {detail.university.rankFinal ? `#${detail.university.rankFinal} ` : ""}
              {detail.university.name}
            </div>
            <div className="text-[12px] text-grey-500 mb-2">
              {[detail.university.city, detail.university.state].filter(Boolean).join(", ") || detail.university.country} · {detail.university.publicPrivate ?? "-"}
              {detail.university.setting ? ` · ${SETTING_LABEL[detail.university.setting] ?? detail.university.setting}` : ""}
              {detail.university.applicationPlatform ? ` · ${detail.university.applicationPlatform}` : ""}
            </div>
            {detail.university.overviewText && (
              <p className="text-[13px] text-ink leading-[1.6] mb-2">{detail.university.overviewText}</p>
            )}
            {detail.university.strengthsPrograms.length > 0 && (
              <div className="text-[12px] text-ink mb-1">강점 분야: {detail.university.strengthsPrograms.join(", ")}</div>
            )}
            <div className="text-[12px] text-grey-500">
              {[
                detail.university.calendarSystem ? `학사력 ${CALENDAR_LABEL[detail.university.calendarSystem] ?? detail.university.calendarSystem}` : null,
                detail.university.ncaaDivision ? `NCAA ${detail.university.ncaaDivision}` : null,
                detail.university.religiousAffiliation ? `종교 ${detail.university.religiousAffiliation}` : null,
                detail.university.honorsCollege ? "Honors College 있음" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className="flex gap-3 mt-2 text-[11.5px]">
              {detail.university.admissionsHomepageUrl && (
                <a href={detail.university.admissionsHomepageUrl} target="_blank" rel="noreferrer" className="text-ink underline">
                  입시요강 홈페이지
                </a>
              )}
              {detail.university.commonDataSetUrl && (
                <a href={detail.university.commonDataSetUrl} target="_blank" rel="noreferrer" className="text-ink underline">
                  Common Data Set
                </a>
              )}
            </div>
          </div>

          {detail.cycles[0] && <AdmissionCycleCard cycle={detail.cycles[0]} />}

          {metrics && metrics.length > 0 && <AdmittedStudentProfileCard metrics={metrics} />}

          {essays && essays.length > 0 && (
            <EssaysSection essays={essays} cycleYear={essayCycleYear} onChangeCycleYear={setEssayCycleYear} />
          )}

          {detail.majors.length > 0 && (
            <div className={cardClass}>
              <div className={cardTitleClass}>전공 ({detail.majors.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {detail.majors.map((m) => (
                  <span key={m.id} className="text-[11.5px] px-2.5 py-1 bg-grey-100 rounded-full text-ink">
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {detail.updates.length > 0 && (
            <div className={cardClass}>
              <div className={cardTitleClass}>최근 업데이트</div>
              {detail.updates.map((u) => (
                <div key={u.id} className="mb-2 text-[12.5px]">
                  <div className="font-bold text-ink">{u.title}</div>
                  <div className="text-[11px] text-grey-500">{u.updateDate}</div>
                  {u.summary && <div className="text-grey-500 mt-0.5">{u.summary}</div>}
                </div>
              ))}
            </div>
          )}

          {detail.sourceUrls.length > 0 && (
            <div className={cardClass}>
              <div className={cardTitleClass}>출처</div>
              <ul className="space-y-1.5">
                {detail.sourceUrls.map((s) => (
                  <li key={s.id} className="text-[12px]">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-ink underline break-all">
                      {s.url}
                    </a>
                    <span className="ml-1.5 text-[11px] text-grey-500">
                      ({SOURCE_TYPE_LABEL[s.sourceType] ?? s.sourceType}
                      {s.isOfficial ? " · 공식" : " · 참고"}
                      {s.cycleYear ? ` · ${s.cycleYear}` : ""})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canProposeSourceUrl && <ProposeSourceUrlSection universityId={universityId} />}

          <RefreshRequestButton universityId={universityId} />

          <ReportIssueForm universityId={universityId} />
        </>
      )}
    </div>
  );
}

const ESSAY_TYPE_LABEL: Record<string, string> = {
  common_app: "공통 지원서(Common App 등)",
  school_specific: "대학 자체 추가 에세이",
  short_answer: "짧은 답변 / 활동 설명",
  program_conditional: "단과대·전공별 조건부 문항",
};

const APPLICATION_PATH_LABEL: Record<string, string> = {
  ED: "조기전형(ED)",
  ED2: "조기전형2(ED2)",
  EA: "얼리액션(EA)",
  RD: "정시(RD)",
  transfer: "편입",
  international: "국제학생",
};

/** "Essays & Writing" 섹션 — 지원연도 선택, 유형별 분리 표시, 선택규칙("N개 중 M개") 그대로,
 * 조건부 문항 적용범위 명시, 확인상태 배지(올해 확인완료/확인중, 지난연도 참고용 구분). */
function EssaysSection({
  essays,
  cycleYear,
  onChangeCycleYear,
}: {
  essays: UniversityEssayPrompt[];
  cycleYear: number | null;
  onChangeCycleYear: (y: number) => void;
}) {
  const years = Array.from(new Set(essays.map((e) => e.cycleYear))).sort((a, b) => b - a);
  const shown = cycleYear != null ? essays.filter((e) => e.cycleYear === cycleYear) : essays;

  const byType: Record<string, UniversityEssayPrompt[]> = {};
  for (const e of shown) {
    (byType[e.promptType] ??= []).push(e);
  }

  const requiredCount = shown.filter((e) => e.isRequired && e.selectionGroupId == null).length;
  const groups = new Map<string, UniversityEssayPrompt[]>();
  for (const e of shown) {
    if (e.selectionGroupId) {
      const arr = groups.get(e.selectionGroupId) ?? [];
      arr.push(e);
      groups.set(e.selectionGroupId, arr);
    }
  }

  function statusBadge(e: UniversityEssayPrompt) {
    if (e.promptStatus === "confirmed_current_year") {
      return <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700">올해 문항 확인완료</span>;
    }
    if (e.promptStatus === "prior_year_reference") {
      return <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] bg-grey-200 text-grey-600">작년 문항 — 참고용, 올해 문항 아님</span>;
    }
    return <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-700">확인 중</span>;
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-2">
        <div className={cardTitleClass}>Essays & Writing</div>
        {years.length > 1 && (
          <select
            value={cycleYear ?? years[0]}
            onChange={(e) => onChangeCycleYear(Number(e.target.value))}
            className="text-[11.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y} 사이클
              </option>
            ))}
          </select>
        )}
      </div>

      {(requiredCount > 0 || groups.size > 0) && (
        <div className="mb-3 text-[12px] text-ink bg-grey-100 rounded-lg px-3 py-2">
          이번 지원에 작성해야 할 것: 필수 문항 {requiredCount}개
          {Array.from(groups.entries()).map(([gid, rows]) => (
            <span key={gid}>
              {", "}
              {rows[0]?.groupSize ?? rows.length}개 중 {rows[0]?.selectCount ?? "?"}개 선택
            </span>
          ))}
        </div>
      )}

      {Object.entries(byType).map(([type, rows]) => (
        <div key={type} className="mb-3">
          <div className="text-[11px] font-bold text-grey-400 uppercase tracking-wide mb-1">{ESSAY_TYPE_LABEL[type] ?? type}</div>
          {rows.map((e) => (
            <div key={e.id} className="mb-2 text-[12.5px]">
              <div className="text-ink">
                {e.title && <span className="font-bold">{e.title}: </span>}
                {e.promptText ?? e.topicSummary ?? "(주제 미확보)"}
                {statusBadge(e)}
              </div>
              <div className="text-[11px] text-grey-500">
                {e.selectionGroupId
                  ? `${e.groupSize ?? "?"}개 중 ${e.selectCount ?? "?"}개 선택`
                  : e.isRequired
                    ? "필수"
                    : "선택"}
                {e.wordLimitMax ? ` · ${e.wordLimitMin ? `${e.wordLimitMin}~` : ""}${e.wordLimitMax}단어 이내` : ""}
                {e.charLimit ? ` · ${e.charLimit}자 이내` : ""}
                {e.appliesToSchool ? ` · 적용: ${e.appliesToSchool}` : ""}
                {e.appliesToMajors && e.appliesToMajors.length > 0 ? ` · 전공: ${e.appliesToMajors.join(", ")}` : ""}
                {e.applicationPaths && e.applicationPaths.length > 0
                  ? ` · 지원경로: ${e.applicationPaths.map((p) => APPLICATION_PATH_LABEL[p] ?? p).join(", ")}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 컨설턴트 전용 — 출처 URL 제안 폼 + 내가 제안한 URL의 검토 상태. */
function ProposeSourceUrlSection({ universityId }: { universityId: string }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listMySubmittedSourceUrls>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState("admissions_homepage");
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      try {
        setItems(await listMySubmittedSourceUrls(universityId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "출처 목록을 불러오지 못했습니다.");
      }
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  function submit() {
    if (!url.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await proposeUniversitySourceUrl({
          universityId,
          url: url.trim(),
          sourceType: sourceType as never,
          isOfficial: false,
        });
        setUrl("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "제안 등록 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>출처 URL 제안 (컨설턴트)</div>
      {error && <p className="text-[11.5px] text-red mb-2">{error}</p>}
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://... (승인 대기 상태로 등록됩니다)"
        className="w-full mb-2 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
      />
      <div className="flex gap-2 mb-2">
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        >
          {Object.entries(SOURCE_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !url.trim()}
          onClick={submit}
          className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
        >
          제안
        </button>
      </div>
      <div className="text-[11px] text-grey-500 mb-1">내가 제안한 URL 상태</div>
      {items === null && <p className="text-[11.5px] text-grey-400">불러오는 중…</p>}
      {items?.length === 0 && <p className="text-[11.5px] text-grey-400">제안한 출처가 없습니다.</p>}
      <ul className="space-y-1">
        {items?.map((s) => (
          <li key={s.id} className="text-[11.5px] text-grey-600">
            <span className="truncate">{s.url}</span>{" "}
            <span
              className={
                s.status === "approved" ? "text-green-700" : s.status === "rejected" ? "text-red" : "text-yellow-700"
              }
            >
              {s.status === "approved" ? "승인됨" : s.status === "rejected" ? "반려됨" : "검토 대기"}
            </span>
            {s.reviewNote && <span className="text-grey-400"> · {s.reviewNote}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 공개 대학 상세 화면 하단 — 정보 오류 신고(일반/필드 단위 모두 가능). */
/** "최신 정보 확인 요청" 버튼 — 학생/보호자/컨설턴트/관리자 전원 노출. 진행중/최근완료
 * 작업이 있으면 같은 상태를 그대로 보여준다(requestUniversityRefresh가 중복 큐잉하지 않음). */
function RefreshRequestButton({ universityId }: { universityId: string }) {
  const [job, setJob] = useState<{ status: "queued" | "running" | "succeeded" | "failed" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  function request() {
    setLoading(true);
    startTransition(async () => {
      try {
        const result = await requestUniversityRefresh(universityId);
        setJob(result);
      } catch {
        // 화면에는 조용히 실패 표시만(신고 폼과 달리 백그라운드 작업이라 재시도 유도로 충분)
        setJob(null);
      } finally {
        setLoading(false);
      }
    });
  }

  const statusLabel: Record<string, string> = {
    queued: "대기중",
    running: "확인중",
    succeeded: "확인 완료",
    failed: "확인 실패(다시 시도해 주세요)",
  };

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        disabled={loading || job?.status === "queued" || job?.status === "running"}
        onClick={request}
        className="text-[12px] font-bold text-grey-600 border-[1.5px] border-grey-200 rounded-xl px-4 py-2 hover:bg-grey-100 disabled:opacity-50"
      >
        최신 정보 확인 요청
      </button>
      {job && <span className="text-[11px] text-grey-500">{statusLabel[job.status]}</span>}
    </div>
  );
}

function ReportIssueForm({ universityId }: { universityId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldPath, setFieldPath] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function submit() {
    if (!message.trim()) return;
    setStatus("sending");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await reportUniversityDataIssue({
          universityId,
          fieldPath: fieldPath.trim() || null,
          message: message.trim(),
        });
        setStatus("sent");
        setMessage("");
        setFieldPath("");
      } catch (e) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "신고 접수 중 오류가 발생했습니다.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-[12px] font-bold text-grey-500 border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-4 hover:bg-grey-100"
      >
        정보 오류 신고
      </button>
    );
  }

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>정보 오류 신고</div>
      {status === "sent" ? (
        <p className="text-[12.5px] text-ink">신고가 접수되었습니다. 검토 후 반영됩니다.</p>
      ) : (
        <>
          <input
            type="text"
            value={fieldPath}
            onChange={(e) => setFieldPath(e.target.value)}
            placeholder="어떤 항목인가요? (예: SAT 범위, 마감일 — 선택)"
            className="w-full mb-2 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="어떤 정보가 잘못됐는지 알려주세요."
            className="w-full mb-2 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            rows={3}
          />
          {errorMsg && <p className="text-[11.5px] text-red mb-2">{errorMsg}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={status === "sending" || !message.trim()}
              onClick={submit}
              className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
            >
              신고 제출
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border-[1.5px] border-grey-200 px-3 py-1.5 text-[12.5px] text-grey-600"
            >
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function stat(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">{label}</div>
      <div className="font-bold text-ink text-[12.5px]">{value}</div>
    </div>
  );
}

const ADMISSION_METRIC_LABEL: Record<string, string> = {
  sat_total_25: "SAT 총점 25th",
  sat_total_75: "SAT 총점 75th",
  sat_ebrw_25: "SAT EBRW 25th",
  sat_ebrw_75: "SAT EBRW 75th",
  sat_math_25: "SAT Math 25th",
  sat_math_75: "SAT Math 75th",
  act_composite_25: "ACT Composite 25th",
  act_composite_75: "ACT Composite 75th",
  gpa_average: "GPA 평균",
  top10pct_pct: "고교 상위 10% 비율",
  ap_ib_indicator: "AP/IB 지표",
  applicants_count: "지원자 수",
  admitted_count: "합격자 수",
  enrolled_count: "등록자 수",
  admit_rate: "합격률",
  yield_rate: "등록률(수율)",
};

// 화면에 항상 이 순서·이 대상집단으로 노출한다(연도가 섞이지 않도록 강제) — 지시서 요구사항:
// "각 지표는 동일 순서·단위로 표시... 빈칸에 다른 연도값 끼워넣기 금지".
const ADMISSION_METRIC_DISPLAY_ORDER: { metricKey: string; cohort: AdmissionMetricCohort }[] = [
  { metricKey: "sat_total_25", cohort: "admitted" },
  { metricKey: "sat_total_75", cohort: "admitted" },
  { metricKey: "sat_ebrw_25", cohort: "admitted" },
  { metricKey: "sat_ebrw_75", cohort: "admitted" },
  { metricKey: "sat_math_25", cohort: "admitted" },
  { metricKey: "sat_math_75", cohort: "admitted" },
  { metricKey: "act_composite_25", cohort: "admitted" },
  { metricKey: "act_composite_75", cohort: "admitted" },
  { metricKey: "gpa_average", cohort: "admitted" },
  { metricKey: "top10pct_pct", cohort: "admitted" },
  { metricKey: "ap_ib_indicator", cohort: "admitted" },
  { metricKey: "applicants_count", cohort: "applicant" },
  { metricKey: "admitted_count", cohort: "admitted" },
  { metricKey: "enrolled_count", cohort: "enrolled" },
  { metricKey: "admit_rate", cohort: "admitted" },
  { metricKey: "yield_rate", cohort: "enrolled" },
];

const ADMISSION_METRIC_VERIFICATION_LABEL: Record<string, string> = {
  official: "공식",
  secondary: "참고",
  unverified: "미검증",
};

const ADMISSION_METRIC_COHORT_LABEL: Record<AdmissionMetricCohort, string> = {
  applicant: "지원자",
  admitted: "합격자",
  enrolled: "등록자",
};

/**
 * 합격·등록 학생 학업 지표(Admitted Student Profile, P7 2026-09-23). 가장 최신 연도 하나만
 * 골라 고정된 순서·대상집단으로 표시한다 — 다른 연도 값을 섞어 빈칸을 채우지 않는다(정책상 금지).
 * 데이터가 없는 지표는 "미공개"로, 미검증 값은 배지로 명시(숨기지 않음).
 */
function AdmittedStudentProfileCard({ metrics }: { metrics: AdmissionMetric[] }) {
  const latestYear = metrics.reduce((max, m) => Math.max(max, m.cycleYear), 0);
  const latestMetrics = metrics.filter((m) => m.cycleYear === latestYear);

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>Admitted Student Profile ({latestYear} 사이클)</div>
      <div className="grid grid-cols-2 gap-3">
        {ADMISSION_METRIC_DISPLAY_ORDER.map(({ metricKey, cohort }) => {
          const found = latestMetrics.find((m) => m.metricKey === metricKey && m.cohort === cohort);
          const label = ADMISSION_METRIC_LABEL[metricKey] ?? metricKey;
          if (!found) {
            return (
              <div key={metricKey}>
                <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">{label}</div>
                <div className="text-grey-400 text-[12.5px]">미공개</div>
              </div>
            );
          }
          const displayValue = found.value != null ? `${found.value}${found.unit ? ` ${found.unit}` : ""}` : (found.valueText ?? "확인 필요");
          return (
            <div key={metricKey}>
              <div className="text-grey-300 text-[10.5px] font-bold mb-0.5">{label}</div>
              <div className="font-bold text-ink text-[12.5px]">
                {displayValue}
                {found.submittersOnly ? " (제출자만)" : ""}
              </div>
              <div className="text-[10px] text-grey-400 mt-0.5">
                {ADMISSION_METRIC_COHORT_LABEL[found.cohort]} · {found.cycleYear}
                <span
                  className={`ml-1 rounded px-1 py-0.5 ${
                    found.verificationStatus === "official"
                      ? "bg-green-100 text-green-700"
                      : found.verificationStatus === "secondary"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red"
                  }`}
                >
                  {ADMISSION_METRIC_VERIFICATION_LABEL[found.verificationStatus]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdmissionCycleCard({ cycle }: { cycle: AdmissionCycle }) {
  const satRange =
    cycle.satEbrw25 != null && cycle.satEbrw75 != null && cycle.satMath25 != null && cycle.satMath75 != null
      ? `${cycle.satEbrw25 + cycle.satMath25}–${cycle.satEbrw75 + cycle.satMath75}`
      : null;
  const actRange = cycle.actComposite25 != null && cycle.actComposite75 != null ? `${cycle.actComposite25}–${cycle.actComposite75}` : null;
  const gpaRange = cycle.gpa25 != null && cycle.gpa75 != null ? `${cycle.gpa25}–${cycle.gpa75}` : cycle.gpaAverage != null ? `평균 ${cycle.gpaAverage}` : null;

  return (
    <div className={cardClass}>
      <div className={cardTitleClass}>{cycle.cycleYear} 입시 사이클</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {stat("시험 정책", cycle.testPolicy)}
        {stat("SAT 범위(합산)", satRange)}
        {stat("ACT 범위", actRange)}
        {stat("GPA 범위", gpaRange)}
        {stat("합격률", cycle.acceptanceRate != null ? `${cycle.acceptanceRate}%` : null)}
        {stat("지원자 수", cycle.totalApplicants)}
        {stat("등록률(yield)", cycle.yieldRate != null ? `${cycle.yieldRate}%` : null)}
        {stat("학생 대 교수 비율", cycle.studentFacultyRatio)}
        {stat("4년 졸업률", cycle.gradRate4yr != null ? `${cycle.gradRate4yr}%` : null)}
        {stat("6년 졸업률", cycle.gradRate6yr != null ? `${cycle.gradRate6yr}%` : null)}
        {stat("재적 유지율", cycle.retentionRate != null ? `${cycle.retentionRate}%` : null)}
        {stat("국제학생 비율", cycle.internationalPct != null ? `${cycle.internationalPct}%` : null)}
        {stat("Pell Grant 수혜율", cycle.pellGrantPct != null ? `${cycle.pellGrantPct}%` : null)}
        {stat(
          "지원 마감(ED/EA/RD)",
          [
            cycle.edDeadline ? `ED ${cycle.edDeadline}` : null,
            cycle.ed2Deadline ? `ED2 ${cycle.ed2Deadline}` : null,
            cycle.eaDeadline ? `${cycle.eaRestrictive ? "REA" : "EA"} ${cycle.eaDeadline}` : null,
            cycle.rdDeadline ? `RD ${cycle.rdDeadline}` : null,
          ]
            .filter(Boolean)
            .join(" / ") || null
        )}
        {stat("에세이 수", cycle.essayCount)}
        {stat("추천서 수", cycle.recommendationLetterCount)}
        {stat("포트폴리오 필요", cycle.portfolioRequired ? "필요" : null)}
        {stat("인터뷰", cycle.interviewRequired === true ? "필요/권장" : cycle.interviewRequired === false ? "없음" : null)}
      </div>

      {(cycle.tuitionInState != null || cycle.tuitionOutState != null || cycle.roomBoardCost != null || cycle.avgNetPrice != null || cycle.pctReceivingAid != null || cycle.avgAidAward != null) && (
        <>
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2 mt-1">비용 · 재정지원</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {stat("등록금(주내)", cycle.tuitionInState != null ? `$${cycle.tuitionInState.toLocaleString()}` : null)}
            {stat("등록금(주외/유학생)", cycle.tuitionOutState != null ? `$${cycle.tuitionOutState.toLocaleString()}` : null)}
            {stat("기숙사·식비", cycle.roomBoardCost != null ? `$${cycle.roomBoardCost.toLocaleString()}` : null)}
            {stat("평균 순부담액(net price)", cycle.avgNetPrice != null ? `$${cycle.avgNetPrice.toLocaleString()}` : null)}
            {stat("재정지원 수혜율", cycle.pctReceivingAid != null ? `${cycle.pctReceivingAid}%` : null)}
            {stat("평균 지원액", cycle.avgAidAward != null ? `$${cycle.avgAidAward.toLocaleString()}` : null)}
          </div>
        </>
      )}

      {(cycle.classSizeUnder20Pct != null || cycle.classSizeOver50Pct != null || cycle.studyAbroadPct != null) && (
        <>
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2 mt-1">학사</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {stat("강의 20명 이하 비율", cycle.classSizeUnder20Pct != null ? `${cycle.classSizeUnder20Pct}%` : null)}
            {stat("강의 50명 이상 비율", cycle.classSizeOver50Pct != null ? `${cycle.classSizeOver50Pct}%` : null)}
            {stat("교환학생 참여율", cycle.studyAbroadPct != null ? `${cycle.studyAbroadPct}%` : null)}
          </div>
        </>
      )}

      {(cycle.admittedAvgApExams != null || cycle.admittedWeightedGpaAvg != null || cycle.admittedTop10pctClassRankPct != null) && (
        <>
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2 mt-1">합격자 학업 프로필(과거 실적)</div>
          <div className="grid grid-cols-2 gap-3">
            {stat("평균 AP 시험 응시 수", cycle.admittedAvgApExams)}
            {stat("평균 가중 GPA", cycle.admittedWeightedGpaAvg)}
            {stat("고교 상위 10% 비율", cycle.admittedTop10pctClassRankPct != null ? `${cycle.admittedTop10pctClassRankPct}%` : null)}
          </div>
        </>
      )}
    </div>
  );
}
