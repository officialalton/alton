# AP FRQ 손글씨 (2026-10-13, 오너 요청) — 1장 정리 + 구현 기준선

## 1. 사용자 흐름
- 대상: 학생(AP 응시 화면 `ApExamTakeClient`, 결과 화면 `ApExamResultView`).
- 종이 FRQ 과목(`lib/ap-exam/frq-delivery.ts`: AB·BC·Physics 1·Biology·Chemistry·Micro·Macro)의 FRQ 문항: 파트마다 타이핑 상자 아래 **Handwrite** 버튼 → 패드가 열린다(펜·지우개·색 3개·되돌리기·전체 지우기·보드 크기). 타이핑/손글씨 중 하나 또는 둘 다 가능. 상단 안내: "On the real AP exam, free-response answers are handwritten in a paper booklet. Here you can handwrite or type your answer for practice."
- 디지털 과목(Statistics·CS A·English Language): 손글씨 UI·안내 없음(타이핑이 실제 형식). 서버도 저장을 거부한다.
- 자동 저장(획이 끝날 때 1.2초 디바운스 + 문항 이동·제출 전 flush). 헤더의 저장 표시("Saving…/Saved/Save failed") 공유. 실패는 오류 문구, 다음 flush 에서 재시도. 서버 시계 만료 오류면 섹션 잠금(타이핑과 동일).
- 제출 확인·번호판: 타이핑 **또는** 손글씨가 있으면 "answered".
- 결과: 내 손글씨 이미지(미리보기 SVG, `<img>`) + 참고 답안·채점 노트(자기 점검, 공식 채점 아님). 지난 응시·재응시도 attemptId 별로 동일.
- **하지 않는 것**: 종이 답안 사진 업로드(오너 결정 — 손글씨가 대체, 후속 과제로도 두지 않음), 손글씨 자동 채점·OCR, 교사/보호자용 AP 결과 화면(공유 컴포넌트가 없어 이번 범위 밖 — 읽기 RPC 는 교사·관리자·보호자 권한을 이미 허용).

## 2. 데이터와 권한
- 테이블 `mock_exam_frq_handwriting` PK(attempt_id, set_item_id, part_label): `strokes jsonb`, `preview_svg text`, `stroke_count`, `board_height`(300..1600, 기본 500), `student_id`. `mock_exam_annotations`(문항당 한 행: 하이라이트·소거)는 파트 단위가 아니라 재사용하지 않고 추가 테이블.
- 좌표계: 논리 폭 800 × `board_height`. **보드를 키워도 획 좌표는 변하지 않는다**(영역만 추가). 줄이는 것은 그린 곳(maxY+10) 아래까지만.
- 획 형식 `{c: 0..2, p:[x0,y0,x1,y1,…]}` 정수 좌표, 저장 전 RDP 단순화(허용오차 0.8). 지우개는 획 단위.
- **상한(RPC 강제, TS 상수와 같음)**: 획 300 · 획당 점 1000 · 파트당 점 20,000 · strokes JSON 256KB · 미리보기 SVG 200KB · 보드 높이 300..1600. 초과 시 "This drawing is too large to save. Erase or clear some strokes."(클라이언트도 같은 검사로 미리 막음).
- 미리보기 SVG: 허용 목록 정규식(`<svg viewBox="0 0 800 H">` + `<path d="M숫자 L" stroke="#hex6" …>`)만 저장, H 는 보드 높이와 일치해야 함. 표시는 `<img src="data:image/svg+xml…">` 로만(스크립트 실행 불가). 보드 크기가 SVG viewBox 에 있어 결과 화면이 저장된 크기를 따른다.
- RLS: 테이블은 RLS 켜짐 + 정책 없음(직접 접근 불가, 본인 포함), **SECURITY DEFINER RPC 로만**.
  - `save_mock_exam_frq_handwriting(attempt, item, part, strokes, svg, board_height)`: 본인 응시 · AP 세트 · 종이 과목(`_ap_frq_paper_subject`) · FRQ(essay) 문항 · 존재하는 파트 라벨 · 제출/채점 후 거부 · 섹션 서버 시계(미시작 비첫 섹션·만료 거부; 첫 섹션 암묵 진입은 `mock_exam_save_answer` 와 동일). 빈 배열 = 지우기(기본 높이면 행 삭제, 키운 높이면 획 0 행만 남겨 크기 보존).
  - `load_mock_exam_frq_handwriting(attempt, with_strokes)`: 본인·담당 교사·관리자·보호자. 응시당 1회 호출(결과는 미리보기만, 응시 화면은 획 포함).
- 종이/디지털 목록의 단일 출처는 `lib/ap-exam/frq-delivery.ts`(`docs/ap/2027-exam-spec-table.md` 전달 방식 열). DB 함수는 미러이고 통합 테스트가 모든 과목에서 일치를 검사한다 — 목록을 바꾸면 새 번호 마이그레이션으로 함수를 `create or replace`.

## 3. UAT 데이터
- 자동 테스트: 실행 ID `frqink<ts>` 접두 학생·세트·문항만 만들고 afterAll 에서 지운다(격리 스택 `ALTON_frqink` 전용).
- Preview UAT(별도, 이번 작업 범위 밖): 전용 학생 계정으로 Calculus AB FRQ 세트에서 Handwrite → 새로고침 복원 → 제출 → 결과 확인, Statistics 세트에서 UI 부재 확인. 종료 후 실행 ID 단위 정리.

## 4. UI 기준
- 패드: 툴바(펜/지우개/색/되돌리기/지우기 + 크기 − S M L XL +), 캔버스, 하단 드래그 핸들(`role=slider`, 화살표 ±50, PageUp/Down ±200, aria-valuenow). 포인터 이벤트로 마우스·터치·스타일러스, 스타일러스 사용 중 손바닥 터치 무시.
- 모바일: 캔버스는 `touch-action: none`(손가락/펜으로 그리기), **오른쪽 28px 띠는 `touch-action: pan-y`(페이지 스크롤용)**, 그 밖 영역은 평소처럼 스크롤. 큰 보드는 페이지 안에서 스크롤. 버튼 높이 36~40px.
- 상태: 로딩("Loading your handwriting…"), 불러오기 실패(쓰기는 계속 가능), 저장 중/완료/실패, 크기 초과 문구. 손글씨가 있는 파트는 자동으로 열린다. 결과 화면에 손글씨가 없으면 이미지 없음.
- 기존 스크래치 화이트보드(`MockExamWhiteboard`, `problem_note_strokes` 선분 저장)는 컴포넌트·저장소를 공유하지 않으며 이번 변경 대상이 아니다.

## 5. 검증과 성능
- 쿼리: 응시 화면 마운트 +1 RPC(종이 과목만), 획 저장 파트당 디바운스 1회, 결과 +1 RPC(종이 과목만). 디지털 과목은 추가 호출 0.
- 테스트: 단위 `lib/ap-exam/frq-ink.test.ts`(단순화·SVG·크기·지우개·과목표), 컴포넌트 `FrqHandwritingPad.test.tsx`(그리기·되돌리기·터치·크기·키보드·드래그·모바일 touch-action)와 `ApExamHandwriting.test.tsx`(종이/디지털 분기·안내·자동 저장·크기 복원·answered 집계·오류·결과 이미지), 통합 `lib/ap-exam/frq-handwriting.integration.test.ts`(격리 DB 12건: 표 일치·미시작/만료/제출 후 거부·상한·검증·RLS·크기 보존·읽기 권한).

## 배경 프리셋 (2026-10-14, 마이그레이션 610 — 작성만, 미적용)
- 패드 툴바 "Background": Blank/Grid/Axes/Axes + grid/Two-panel axes/Number line. 저장값은 프리셋 id 하나(`mock_exam_frq_handwriting.background`), 픽셀 없음. 기하는 `lib/ap-exam/frq-background.ts` 한 곳(캔버스·결과 SVG 공유), 획 아래 고정 레이어라 지우개·되돌리기·전체 지우기 영향 없음.
- 기본값: 지문에 "axes" 또는 sketch+graph 가 있으면 Axes, 아니면 Blank. 기본이 Axes 면 첫 획 저장 때 같이 저장해 결과 화면도 같은 축을 그린다.
- 결과 화면은 저장된 미리보기 SVG 앞에 배경 선을 끼워 `<img>` 로 표시(미리보기 검증 정규식·저장 형식 불변). 610 적용 전에는 blank 일 때 기존 6인자 RPC 만 호출해 그대로 동작.
