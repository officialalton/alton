"use client";

import ApExamResultView from "@/app/student/mock-exam/[attemptId]/ApExamResultView";
import type { AdminApAttemptView } from "../free-accounts-actions";

// 관리자 읽기 전용 AP 결과: 학생·학부모와 같은 ApExamResultView(= lib/ap-exam/result-score 계산)를 readOnly 로 쓰고,
// 관리자에게만 테스트 계정 여부와 적용된 채점 구성을 덧붙인다. 오류 신고·채점 시작 같은 쓰기 동작은 없다.
export default function AdminApResultView({ view }: { view: AdminApAttemptView }) {
  const { detail, versions, isTestAccount } = view;
  const unscored = view.unscored ?? [];
  return (
    <div data-testid="admin-ap-result">
      <div className="mb-3 rounded-lg border border-grey-200 bg-grey-50 p-3 text-[12.5px]" data-testid="admin-ap-meta">
        <p><span className="font-bold">Account:</span> {isTestAccount === null ? "test flag unknown" : isTestAccount ? "Test account (excluded from analytics)" : "Real account"}</p>
        <p className="mt-1 font-bold">Scoring versions applied</p>
        {versions.length === 0 && unscored.length === 0 ? (
          <p className="text-grey-600" data-testid="admin-ap-no-version">No scoring version recorded. (This attempt has no AI scoring rows.)</p>
        ) : (
          <ul className="text-grey-600" data-testid="admin-ap-versions">{versions.map((v) => <li key={`${v.rubricVersion}|${v.model}`}>Rubric {v.rubricVersion} · model {v.model ?? "not recorded"} · {v.rows} scored part{v.rows === 1 ? "" : "s"}</li>)}{unscored.map((u) => <li key={u.label} data-testid="admin-ap-unscored">{u.rows} part{u.rows === 1 ? "" : "s"}: {u.label}</li>)}</ul>
        )}
        <p className="mt-1 text-grey-500">Exam set version and conversion scale are not recorded for results yet (no grade scale exists).</p>
      </div>
      <ApExamResultView attempt={detail} essayScores={view.essayScores} essayScoringSupported={view.essayAi} readOnly />
    </div>
  );
}
