"use client";

import { useEffect, useState } from "react";
import { getMockExamApPoolAction, type ApPoolSummary } from "../mock-exam-actions";

// AP 과목별 모의고사 문항 풀(2026-10-08). 과목을 고를 때 RPC 1회(mock_exam_ap_pool)로 단원·토픽·스킬·구조·계산기·용도·단계·배정·칸 부족을 한 번에 받는다.
// 재고 = 현재 적재 배치 + 자동 검증 통과 + 결함 없음. 변환(모의고사용/수업용)은 검수 환경 이상으로 올라간 문항만 센다.

const KIND_LABEL: Record<string, string> = { mc: "객관식", frq_bundle: "FRQ" };
const PURPOSE_LABEL: Record<string, string> = { mock_exam: "모의고사용", lesson: "수업·과제용" };
const STRUCT_LABEL: Record<string, string> = { standalone: "단독 문항", shared_stimulus_set: "공유 자료 세트", frq_multipart: "FRQ 다중 파트" };
const CALC_LABEL: Record<string, string> = { required: "그래핑 계산기 필수", allowed: "계산기 허용", not_allowed: "계산기 불가", na: "해당 없음" };
const DIM_LABEL: Record<string, string> = { unit: "단원", skill: "스킬", keyword: "토픽", calculator: "계산기", representation: "자료 형태", family_floor: "문항군 하한" };

export default function ApPoolView({ subject, subjectName }: { subject: string; subjectName: string }) {
  const [data, setData] = useState<ApPoolSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getMockExamApPoolAction(subject)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setError("AP 문항 풀 현황을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [subject]);

  if (error) return <p className="mt-2 text-xs text-red">{error}</p>;
  if (!data) return <p className="mt-2 text-xs text-grey-500">불러오는 중...</p>;
  const t = data.totals;
  const remaining = t.mockExam - t.assignedPublished - t.assignedDraft;
  const breakdown = (title: string, rows: { key: string; stock: number; mock_exam: number; lesson: number }[], label: (k: string) => string) => (
    <div>
      <h3 className="text-[12px] font-bold text-grey-600">{title}</h3>
      <table className="mt-1 w-full text-xs">
        <thead><tr className="text-left text-grey-500"><th className="py-0.5 pr-2">구분</th><th className="py-0.5 pr-2 text-right">재고</th><th className="py-0.5 pr-2 text-right">모의</th><th className="py-0.5 text-right">수업</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-grey-100"><td className="py-0.5 pr-2">{label(r.key)}</td><td className="py-0.5 pr-2 text-right">{r.stock}</td><td className="py-0.5 pr-2 text-right">{r.mock_exam}</td><td className="py-0.5 text-right">{r.lesson}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div data-testid="ap-pool" className="mt-3">
      <p className="text-xs text-grey-500" data-testid="ap-pool-header">
        {subjectName} · 재고 {t.stock} · 모의고사용 {t.mockExam} · 수업·과제용 {t.lesson} · 배정 {t.assignedPublished + t.assignedDraft} · 남음 {remaining}
      </p>
      {data.topics.length === 0 ? (
        <p className="mt-2 text-sm text-grey-400">이 과목의 재고가 없습니다.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs" data-testid="ap-pool-topics">
            <thead>
              <tr className="text-left text-grey-500">
                <th className="py-1 pr-2">단원</th>
                <th className="py-1 pr-2">토픽</th>
                <th className="py-1 pr-2">형식</th>
                <th className="py-1 pr-2 text-right">재고</th>
                <th className="py-1 pr-2 text-right">미변환 후보</th>
                <th className="py-1 pr-2 text-right">모의고사용</th>
                <th className="py-1 pr-2 text-right">수업·과제용</th>
                <th className="py-1 pr-2 text-right">검수 환경</th>
                <th className="py-1 pr-2 text-right">출시</th>
                <th className="py-1 pr-2 text-right">공개 세트 배정</th>
                <th className="py-1 pr-2 text-right">초안 배정</th>
                <th className="py-1 text-right">남음</th>
              </tr>
            </thead>
            <tbody>
              {data.topics.map((r) => {
                const rest = r.mock_exam - r.assigned_published - r.assigned_draft;
                return (
                  <tr key={`${r.keyword_code}|${r.kind}`} className="border-t border-grey-100">
                    <td className="py-1 pr-2">{r.unit}</td>
                    <td className="py-1 pr-2">{r.keyword_code}{r.topic_label ? ` · ${r.topic_label}` : ""}</td>
                    <td className="py-1 pr-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="py-1 pr-2 text-right">{r.stock}</td>
                    <td className="py-1 pr-2 text-right">{r.candidate}</td>
                    <td className="py-1 pr-2 text-right">{r.mock_exam}</td>
                    <td className="py-1 pr-2 text-right">{r.lesson}</td>
                    <td className="py-1 pr-2 text-right">{r.review_env}</td>
                    <td className="py-1 pr-2 text-right">{r.launch}</td>
                    <td className="py-1 pr-2 text-right">{r.assigned_published}</td>
                    <td className="py-1 pr-2 text-right">{r.assigned_draft}</td>
                    <td className={"py-1 text-right font-medium " + (r.mock_exam > 0 && rest === 0 ? "text-red" : "text-ink")}>{rest}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-3" data-testid="ap-pool-breakdown">
        {breakdown("스킬(범주)", data.bySkill, (k) => `스킬 ${k}`)}
        {breakdown("문항 구조", data.byStructure, (k) => STRUCT_LABEL[k] ?? k)}
        {breakdown("계산기", data.byCalculator, (k) => CALC_LABEL[k] ?? k)}
      </div>
      {data.purposes.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="text-[12px] font-bold text-grey-600">용도별 변환 현황</h3>
          <table className="mt-1 w-full min-w-[520px] text-xs" data-testid="ap-pool-purposes">
            <thead><tr className="text-left text-grey-500"><th className="py-0.5 pr-2">형식</th><th className="py-0.5 pr-2">용도</th><th className="py-0.5 pr-2 text-right">목표</th><th className="py-0.5 pr-2 text-right">변환됨</th><th className="py-0.5 pr-2 text-right">검수 환경</th><th className="py-0.5 pr-2 text-right">출시</th><th className="py-0.5 pr-2 text-right">부족</th><th className="py-0.5 text-right">미배정 준비분</th></tr></thead>
            <tbody>
              {data.purposes.map((p) => (
                <tr key={`${p.kind}|${p.purpose}`} className="border-t border-grey-100">
                  <td className="py-0.5 pr-2">{KIND_LABEL[p.kind] ?? p.kind}</td><td className="py-0.5 pr-2">{PURPOSE_LABEL[p.purpose] ?? p.purpose}</td>
                  <td className="py-0.5 pr-2 text-right">{p.target}</td><td className="py-0.5 pr-2 text-right">{p.converted}</td><td className="py-0.5 pr-2 text-right">{p.inReviewEnv}</td><td className="py-0.5 pr-2 text-right">{p.launched}</td>
                  <td className={"py-0.5 pr-2 text-right " + (p.shortfall > 0 ? "font-bold text-red" : "")}>{p.shortfall}</td><td className="py-0.5 text-right">{p.unallocatedReady}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.shortfalls.length > 0 && (
        <details className="mt-3 text-xs" data-testid="ap-pool-shortfalls">
          <summary className="cursor-pointer font-bold text-grey-600">칸별 재고 부족 {data.shortfalls.length}건</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {data.shortfalls.slice(0, 40).map((f, i) => (
              <li key={i}>
                {DIM_LABEL[f.dimension] ?? f.dimension} · {KIND_LABEL[f.kind] ?? f.kind}
                {f.unitCode ? ` · 단원 ${f.unitCode}` : ""}{f.keywordCode ? ` · 토픽 ${f.keywordCode}` : ""}{f.skillCategory ? ` · 스킬 ${f.skillCategory}` : ""}
                {f.calculatorUse ? ` · ${CALC_LABEL[f.calculatorUse] ?? f.calculatorUse}` : ""}{f.representation ? ` · ${f.representation}` : ""}
                : <span className="font-bold text-red"> {f.achieved}/{f.target} (부족 {f.shortfall})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-2 text-[11.5px] text-grey-500">
        재고는 현재 적재분 중 자동 검증을 통과하고 결함이 없는 후보입니다. 모의고사용·수업용은 변환(검수 환경 이상)된 문항만 세며, 용도는 변환 때 하나로 정해져 바뀌지 않습니다.
        배정은 초안·공개 세트에 들어간 모의고사용 문항 수(보관 세트 제외)이고 남음 = 모의고사용 − 배정입니다.
      </p>
    </div>
  );
}
