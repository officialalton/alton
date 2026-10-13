# 시험 스크래치 화이트보드 크기 조절 (2026-10-13, 오너 요청)

대상: `MockExamWhiteboard`(MST·AP 응시 화면의 문항별 도구 줄 화이트보드 아이콘). 고정형 시험(`MockExamTakeClient`)의 인라인 `ProblemNoteCanvas`는 별개 레거시 경로로 이번 범위 밖.

## 동작
- 프리셋 Small 480 / Medium 720 / Large 1000 / Extra large 1400, −/+ 버튼(±100), 하단 드래그 핸들(`role=slider`, 화살표 ±50, PageUp/Down ±200). UI는 FRQ 손글씨 패드와 공유하는 `BoardSizeControls.tsx`.
- 논리 좌표: 폭 640 고정 × 높이 480..1600. 선분(`{x0,y0,x1,y1,color,w:640}`)은 크기를 바꿔도 변하지 않는다. 줄일 때는 그린 곳(maxY+10) 아래까지만(`lib/mock-exam/whiteboard-size.ts`).
- Large 이상이면 패널 폭도 넓어지고(540 → 720px), 패널 높이는 화면에 맞춰 보드 영역만 세로 스크롤한다.
- 모바일: 캔버스 `touch-action:none`(그리기), 오른쪽 28px 띠 `touch-pan-y`(스크롤). 스타일러스 사용 중 손바닥 touch 무시.
- 잠금(제출·모듈 잠금)이면 크기 컨트롤 없이 저장된 높이로 읽기만 한다.

## 저장(결정: 서버, 마이그레이션 590)
- 높이는 기기 간에 따라가야 하므로 localStorage 는 쓰지 않는다. 기존 `problem_note_strokes`(응시×문항×작성자 한 행)에 `board_height integer not null default 480 check 480..1600` 컬럼 하나만 추가(additive, 기존 행은 기본값).
- `save_problem_note_strokes(…, p_board_height)` 5인자 오버로드: 높이·크기 상한(선분 20,000 · JSON 2MB, 초과 시 "This drawing is too large to save…")을 검사한 뒤 기존 4인자 함수(본인·제출/모듈 잠금 가드)를 호출하고 높이를 적는다. 기존 4인자 경로(홈워크 등)는 불변.
- `load_problem_note_board(…)`: `{strokes, boardHeight}` 한 번에(기존 load 와 요청 수 동일, 권한 동일: 본인·담당 교사·관리자·보호자).
- 결과 화면 `ProblemNoteSnapshot`은 그린 곳 기준으로 높이를 자동 확장하므로 변경 없음.

## 테스트
`lib/mock-exam/whiteboard-size.test.ts`(clamp·상한), `MockExamWhiteboard.test.tsx`(복원·프리셋·키보드·드래그·좌표 환산·touch-action·잠금·palm rejection), `FrqHandwritingPad.test.tsx`(공유 컴포넌트 회귀), 격리 DB `lib/mock-exam/problem-note-board.integration.test.ts`(기본값·저장/복원·4인자 보존·범위/상한·권한·제출 후 잠금).
