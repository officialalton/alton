# 실시간 공동 필기 문서 (Google Docs 링크 기능 대체) — 설계

## 배경

세션뷰의 "연습장"(`app/session/[id]/ScratchpadTab.tsx`) 탭은 원래 "Docs" 서브탭에서 선생님/학생이 자기 구글 계정으로 만든 문서 링크를 붙여넣으면 새 탭에서 열리는 방식이었다(`session_doc_links` 테이블, `DocLink` 타입). 사용자 요청: 이걸 우리 앱 안에서 직접 실시간으로 같이 타이핑할 수 있는 문서로 완전히 교체한다. 구글 계정 연동은 필요 없음(서식도 필요 없음, 순수 텍스트).

## 목표

- 선생님과 학생이 같은 세션 화면에서 동시에 텍스트를 쓰고 고칠 수 있다.
- 수업이 끝난 뒤에도 그 세션뷰에 다시 들어가면 마지막까지 쓴 내용이 그대로 보인다.
- 기존 "Docs 링크 추가" 기능(외부 URL 붙여넣기)은 완전히 제거한다.

## 아키텍처 — 기존 화이트보드 패턴 재사용

세션뷰에는 이미 거의 동일한 문제(실시간 공동 작업 + 사후 열람)를 푼 화이트보드(`WhiteboardCanvas.tsx`)가 있다. 그 패턴을 그대로 따른다:

1. **실시간 동기화**: Supabase Realtime의 `broadcast` 채널(`session-scratchpad:{sessionId}`)로 텍스트가 바뀔 때마다 전체 텍스트를 상대방에게 전파한다.
2. **영속 저장**: `sessions` 테이블에 `scratchpad_text text` 컬럼을 신설(화이트보드의 `whiteboard_strokes jsonb`와 같은 자리)하고, 타이핑이 멈추면 600ms 디바운스 후 저장한다.
3. **재접속/사후 열람**: 세션 페이지 최초 로드 시 `sessions.scratchpad_text`를 읽어와 초기값으로 채운다 — 실시간 채널 없이도 이 값만으로 항상 최신 내용을 볼 수 있다.

## 동기화 방식의 한계 (의도적으로 받아들이는 트레이드오프)

글자 단위로 정교하게 병합하는 OT/CRDT는 쓰지 않는다. 전체 텍스트를 통째로 주고받는 단순한 "마지막에 반영된 게 이긴다" 방식이다. 두 사람이 정확히 같은 순간에 같은 부분을 고치면 한쪽이 씹힐 수 있지만, 서식도 필요 없다고 한 만큼 이 정도 단순함이면 충분하다고 판단했다. 로컬에서 타이핑하는 동안에는 남에게서 받은 업데이트를 그 자리에서 바로 덮어쓰지 않아(아래 참고), 최소한 "내가 지금 치고 있는데 커서가 튀는" 문제는 없게 한다.

- 타이핑 중(마지막 입력 후 1.2초 이내)에는 원격에서 온 업데이트를 로컬 상태에 즉시 반영하지 않고 보류했다가, 입력이 멈추면 그때 최신값으로 동기화한다.

## 컴포넌트

| 파일 | 변경 |
|---|---|
| `supabase/migrations/xxx_sessions_scratchpad_text.sql` | `sessions.scratchpad_text text` 컬럼 추가 |
| `app/session/[id]/scratchpad-data.ts` | `DocLink` 타입/`loadDocLinks` 삭제 |
| `app/session/[id]/scratchpad-actions.ts` | `addDocLink`/`removeDocLink` 삭제, `saveScratchpadText(sessionId, text)` 추가 |
| `app/session/[id]/RealtimeScratchpad.tsx` (신규) | `WhiteboardCanvas.tsx`와 같은 패턴의 클라이언트 컴포넌트 — `<textarea>` + Realtime 채널 |
| `app/session/[id]/ScratchpadTab.tsx` | "Docs" 서브탭 내용을 `RealtimeScratchpad`로 교체 |
| `app/session/[id]/page.tsx` | `session_doc_links` 로딩 제거, `sessions.scratchpad_text` 로딩 추가 |

## 권한

기존 "Docs" 탭과 동일한 권한 체계를 그대로 쓴다 — 학생/선생님은 쓰기 가능, 학부모/관리자는 읽기 전용(세션뷰의 기존 `readOnly`/`viewerRole` prop 그대로 재사용).

## 에러 처리

- 저장(`saveScratchpadText`) 실패 시에도 브로드캐스트는 이미 나갔으므로 상대방 화면엔 반영된 상태 — 다음 입력이 있을 때 다시 저장을 시도한다(화이트보드와 동일).
- Realtime 채널 연결이 끊겨도 로컬 편집 자체는 계속 가능하고, 재연결 시 그 시점의 최신 텍스트로 다시 맞춘다.

## 테스트

- `scratchpad-actions.test.ts`: `saveScratchpadText`가 `sessions.scratchpad_text`를 올바르게 업데이트하는지(화이트보드의 `saveWhiteboardStrokes` 테스트와 동일 패턴).
- `RealtimeScratchpad.test.tsx`: Supabase 클라이언트/채널을 모킹해 (1) 초기값 렌더링 (2) 로컬 타이핑 시 디바운스 후 저장 호출 (3) 브로드캐스트 수신 시 반영(단, 타이핑 중이 아닐 때만) 을 검증.
- 실제 동시 편집(두 브라우저 세션)은 유닛 테스트로 검증하기 어려운 영역이라 브라우저로 직접 확인.

## 스코프 밖

- `session_doc_links` 테이블 자체는 DB에서 드롭하지 않는다(더 이상 코드에서 쓰지 않게만 하고, 실제 컬럼 정리는 필요해지면 별도 티켓).
