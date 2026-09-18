"use client";

// 2026-09-19(제품 오너 지시) — 200개교 데이터를 모으기 전에 그 데이터를 보여줄 학생·학부모용
// "대학 탐색" 화면을 먼저 만든다. 로드맵 탭의 세 번째 서브탭으로 들어간다(2026-09-18 결정:
// 대학 관련 학생 진입점은 로드맵 탭 안에 둔다). 읽기 전용 — 합격 확률/가능성 예측은 정책상 없다.

import { useEffect, useState, useTransition } from "react";
import { listUniversities, getUniversityDetailForStudent, type UniversitySummary, type UniversityDetail, type AdmissionCycle, type UniversityMajor, type UniversityUpdateEntry } from "@/lib/universities/actions";

const cardClass = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4";
const cardTitleClass = "text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2";

export default function CollegeExploreSection() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (selectedId) {
    return <CollegeDetail universityId={selectedId} onBack={() => setSelectedId(null)} />;
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

function CollegeDetail({ universityId, onBack }: { universityId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<{ university: UniversityDetail; cycles: AdmissionCycle[]; updates: UniversityUpdateEntry[]; majors: UniversityMajor[] } | null>(null);
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
              {detail.university.applicationPlatform ? ` · ${detail.university.applicationPlatform}` : ""}
            </div>
            {detail.university.strengthsPrograms.length > 0 && (
              <div className="text-[12px] text-ink">강점 분야: {detail.university.strengthsPrograms.join(", ")}</div>
            )}
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
        {stat("지원 마감(ED/EA/RD)", [cycle.edDeadline, cycle.eaDeadline, cycle.rdDeadline].filter(Boolean).join(" / ") || null)}
        {stat("에세이 수", cycle.essayCount)}
        {stat("추천서 수", cycle.recommendationLetterCount)}
      </div>
    </div>
  );
}
