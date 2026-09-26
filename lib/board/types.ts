// Student Success Planner — Board(할 일 관리) MVP.
//
// 자동 카드(과제·모의고사·단어시험)는 별도 테이블에 복제하지 않고, 이미 있는
// homework_batches/mock_exam_attempts/vocab_quizzes 데이터를 그대로 읽어 이
// 모양으로 변환한다(집계 트리거가 원본과 어긋날 여지를 만들지 않기 위해).
// 수동 할 일(board_manual_tasks)만 별도 테이블에 실제로 저장한다.

export type BoardCardStatus = "backlog" | "in_progress" | "done";

export type BoardCard = {
  /** 자동 카드는 `${sourceType}:${sourceId}`, 수동 할 일은 board_manual_tasks.id. */
  id: string;
  sourceType: "homework" | "mock_exam" | "vocab_quiz" | "manual";
  sourceId: string | null;
  title: string;
  subtitle: string | null;
  status: BoardCardStatus;
  dueAt: string | null;
  /** 2026-09-22(사용자 지시) — 기간 입력 지원(시간 없이 날짜만). 있으면
   * dueStartAt~dueAt 기간으로, 없으면 dueAt 하나만 마감일로 보여준다.
   * 자동 카드(과제·모의고사·단어시험)는 항상 null(단일 마감일만 있음). */
  dueStartAt: string | null;
  /** 세션뷰·모의고사 응시 화면 등으로 이동할 링크. 수동 할 일은 null. */
  href: string | null;
  /** 2026-09-22(사용자 지시) — "담당 선생님"/"담당 컨설턴트"/"학생 본인"/"관리자". */
  createdByLabel: string;
};

export type BoardColumn = "overdue" | "backlog" | "in_progress" | "done";

/** "기한 경과"는 별도 상태가 아니라 status!=done && dueAt이 지난 카드를 백로그/
 * 진행중 칼럼 대신 앞에 따로 보여주는 파생 분류다. */
export function boardColumnOf(card: BoardCard, nowIso: string): BoardColumn {
  if (card.status !== "done" && card.dueAt && card.dueAt < nowIso) return "overdue";
  return card.status;
}
