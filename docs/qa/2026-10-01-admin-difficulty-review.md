# 관리자 hard 난이도 점검 — 착수 1장 정리 (2026-10-01, `feat/admin-difficulty-review`)

배경(오너 확정): hard 는 AI 판정(College Board 공식 난이도와 교정 불가, Fable 검수 통과 문항을 hard 로 인정)이라 **잠정**이다.
관리자가 hard 문항을 점검·변경할 수 있어야 하고, 출시 후 실제 정답률로 재보정한다.

## 1. 사용자 흐름
- 관리자 › 모의고사 › **난이도 점검** 서브탭(문항 풀 옆). 요약 카드(잠정 N · 확인됨 N · 변경됨 N) → 필터(상태·영역·세부 기술·검색) → 서버 페이지 목록.
- 행 펼침 = 상세: AI 판정 근거(hard 검수 기록·레시피 준수·추가 요구 사고 메모·참고 의견), 실제 응답 수·정답률, 변경 이력, 영향받는 세트.
- 행동: `난이도 확인(hard 유지)` / `medium으로 변경` / `easy로 변경`(사유 메모), 체크박스 일괄 적용.
- 실패·재시도: 부분 실패 없음(한 RPC = 한 트랜잭션), 같은 요청 재전송은 멱등(이미 확인된 것은 건너뜀). 오류 문구 한국어.

## 2. 데이터와 권한
- `problems.difficulty_status`('provisional'|'confirmed', 기본 confirmed) + `difficulty_confirmed_at/by`. 기존 비AI 문항은 기본값(confirmed, confirmed_at null = "기존 확정, 점검 대상 아님") 그대로 — 건드리지 않는다.
  잠정 설정: (a) 백필 — `created_via='ai_generated' and difficulty='hard'`(+ 공개 버전 hard) 를 provisional, (b) 트리거 — created_via 가 ai_generated 로 바뀔 때(생성 임포트 경로) difficulty=hard 이면 provisional.
- **난이도 원본**: 조립·오류 통계·풀이 쓰는 값은 공개 버전 `problem_versions.difficulty`, 키워드 자동 구성은 `problems.difficulty`. RPC 가 **둘을 같은 트랜잭션에서** 맞춘다(공개·초안·검토중 버전; 보관 버전은 이력이므로 건드리지 않음).
- 이력 `problem_difficulty_changes`(append-only: 누가·언제·이전→이후·상태·사유·배치, 수정·삭제 트리거 차단, service_role select/insert 만).
- 쓰기 RPC `review_problem_difficulty(ids, to, actor, reason)` — 정의자, service_role 만 execute(anon/authenticated REST·RPC 거절), 내부에서 actor 가 admin 인지 재검사. 읽기 RPC `problem_difficulty_review_list`(요약+페이지 1회), `_detail`.
  `problems.difficulty` 직접 UPDATE(관리자 RLS 경유)는 트리거로 막아 이력 우회를 차단(RPC 가 세션 설정으로만 통과). 기존 경로 중 problems.difficulty 를 UPDATE 하는 곳은 없음(확인함).
- **불변성 설계**: 난이도는 학생에게 보이는 내용이 아니라 분류 메타데이터다. 본문·정답·해설·버전 번호·published_at 은 그대로. `mock_exam_set_items.difficulty`(조립 시점 스냅샷)·응시·수업 매니페스트는 **건드리지 않는다**. 변경은 이후 조립 후보·풀 집계·키워드 자동 구성·오류 통계 분모에만 반영된다(모두 live 조회).
- **세트 영향**: MST(module_key 있는 세트, 보관 제외 draft/published) 에서 live 난이도가 그 칸(M1 easy/medium, M2 higher medium/hard, M2 lower easy/medium) 규칙에 어긋나면 `세트 교체 필요`로 **표시만**(파생 값, 저장·자동 변경 없음). 응시 시작 수(진행 중 포함)를 함께 보여준다. 기존 `대체 문항 필요` 큐(오류 확정 교체)와는 별개이며 건드리지 않는다.

## 3. UAT 데이터
- 자동 테스트: 실행 ID(`DIFFREV-<ts>`)가 붙은 전용 문항·세트만 만들고 afterAll 에서 그 ID 행만 정리(이력은 replica 설정으로 테스트 전용 정리). 재실행 안전.
- Preview UAT 계획(배포 금지 지시 — 총괄 실행): 시험 문항 3건(AI hard 잠정)을 `mockgen-test:DIFFREV-<id>` 표식으로 임포트 → 확인/변경/일괄/이력/세트 교체 표시 확인 → 표식 단위 정리·공식 계정 미접촉 확인.

## 4. UI 기준
- 표시: 문항 요약(기술·형식·잠정/확인됨 배지·공개일·정답률·응답 수), 상세에 판정 근거. 행동: 버튼 3종 + 사유(변경 시 필수), 일괄 바.
- 상태: 로딩 스켈레톤·빈 상태(조건별 문구)·오류(재시도)·저장 중 비활성. 모바일 카드형 줄바꿈, 키보드(체크박스·버튼·Enter), aria-label, 색 외 텍스트 배지. 한국어, 기존 관리자 스타일(grey/ink/red, UnderlineSubTabs 계열 탭).
- 폴리싱은 마일스톤 종료 라운드.

## 5. 검증과 성능
- 통합(DB): 권한 매트릭스, 이력 불변, 스냅샷·진행 중 응시 불변, 일괄·멱등, 풀 집계 일관, 백필(비AI 제외), 세트 영향 파생.
- 성능: 목록 = RPC 1회(요약 집계+페이지 조인+응답 통계 lateral 없이 페이지 버전 id 로 1쿼리), 상세는 펼칠 때 1회. 부분 인덱스 `problems(difficulty_status) where provisional`. N+1 없음.
- 컴포넌트 테스트 + tsc + 변경 영역 테스트 + 가능하면 npm test.

## 6. 구현 결과(2026-10-01)
- 마이그레이션 `20261985000000_admin_difficulty_review.sql`(격리 스택 적용 통과, 원격·공유 로컬 미적용). 화면: 모의고사 › `난이도 점검` 서브탭.
- 검증: 격리 스택에서 `lib/problem-difficulty-review.integration.test.ts` 12건 연속 2회 통과, 관련 통합(pool-usage·mst-flow·usage-scope) 통과, unit 프로젝트 3004 통과, 컴포넌트 7·액션 3건.
- 근거 표시: quality JSON 의 `hardJudge`/`advisory`(없으면 `mockExamGeneration.recipeCheck.hardFit` 폴백, 모두 없으면 '근거 기록 없음').

## 7. 본문 개정 공개 구멍 차단(`20261986000000_difficulty_sync_on_publish.sql`)
- 방식 (a) 채택: 트리거가 새 버전 published 전환 시 난이도가 문항과 다르면 문항 난이도를 새 값으로 맞추고 provisional 로 되돌리며 이력('본문 개정 공개에 의한 변경', 행위자=공개한 관리자)을 남긴다. 거절(b)은 수정 초안 → 공개 흐름을 막고 난이도만 고치려면 별도 경로를 강제해 기존 흐름을 더 해치므로 택하지 않음. 점검 RPC 내부·같은 난이도 공개는 영향 없음.
