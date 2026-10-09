# R9 — WhiteboardCanvas ↔ session_annotation_events 연결 (1장 정리)

범위: `WhiteboardCanvas.tsx`를 R8 Task D(`b4fd788`)에서 만든
`session_annotation_events` 이벤트 로그에 연결한다. R9 킥오프 패키지
(`docs/2026-09-08-r9-kickoff-package.md`)의 다른 항목은 범위 밖.

## 1. 사용자 흐름
- v3 세션: 학생/선생님이 화이트보드 탭 진입 → 서버에서 이벤트 replay →
  현재 상태 렌더 → 그리기/지우기는 즉시 이벤트로 append → 같은 세션을 보는
  다른 뷰어는 realtime으로 반영, 연결이 끊겼다 재연결되면 다시 replay해서
  동기화(클라이언트 상태를 신뢰하지 않음).
- 실패: append 실패(RLS 등) 시 로컬 드로잉은 유지하되 오류 배지 표시.
  clear-all은 선생님/관리자가 아니면 버튼 자체를 노출하지 않음(방어적으로
  호출돼도 서버가 거부하며 에러 메시지 표시).
- 레거시 세션: 기존 그대로 `legacy_sessions.whiteboard_strokes` 읽기 전용
  렌더(신규 쓰기 없음) — 이미 있던 broadcast-only 실시간 협업은 유지.

## 2. 데이터와 권한
- v3: source of truth = `session_annotation_events`(R8에서 이미 마이그레이션/
  RLS/트리거 완료). 프론트는 새 쓰기 경로가 없음 — `appendStrokeEvent`/
  `appendClearAllEvent`/`replayAnnotationEvents`/`reconstructVisibleStrokes`만
  사용. clear_all 권한은 DB(is_session_teacher_v3)가 최종 강제, UI는 보조.
- 레거시: 기존 `legacy_sessions.whiteboard_strokes` 그대로, 새 쓰기 금지
  (정책상 결정 사항 — 백필도 하지 않음).
- 좌표계: 이벤트 payload는 정규화 좌표(0~1)로 저장(캔버스 크기 독립).
  레거시는 기존처럼 픽셀 좌표 그대로 유지(변경 시 과거 데이터 해석이 깨짐).

## 3. UAT 데이터
- 이 작업은 자동 테스트(vitest, `supabase db reset --local` 기반 통합 테스트)로만
  검증한다. 실제 Preview UAT 계정을 새로 만들지 않음 — v3 sessions/reservations
  더미 데이터는 기존 통합 테스트 fixture(R8 Task D 패턴)를 재사용.

## 4. UI 기준
- 그리기 모드/펜·지우개/색상 컨트롤 UI는 기존 그대로 유지.
- "전체 지우기" 버튼: 선생님/관리자에게만 노출(기존 Docs 패널의
  `isTeacher &&` 패턴과 동일 기준 재사용).
- 저장 상태 배지: 기존 "✓ 저장됨" 대신 이벤트 append 성공/실패를 반영.
- 레거시 세션은 기존 UI 그대로(변경 없음).

## 5. 검증과 성능
- v3: append 후 reload/replay가 같은 화면 상태를 재구성하는지 통합
  테스트로 검증. clear-all 권한(교사 성공/비교사 거부)도 통합 테스트.
  레거시 경로는 이벤트 테이블에 아무 것도 쓰지 않음을 단위 테스트로 확인.
- 쿼리 수: 탭 진입 시 v3는 replay 1회(서버 컴포넌트에서 SSR로 미리 로드),
  이후 액션마다 insert 1건. 레거시는 기존과 동일(추가 요청 없음).
