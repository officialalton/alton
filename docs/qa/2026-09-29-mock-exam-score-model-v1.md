# 모의고사 예상 점수 모델 v1-adaptive (내부 추정)

상태: 2026-09-29. 이 모델은 **추정**이며 College Board 공식 변환표가 아니다. 화면에는 "예상 점수 범위(내부 추정)"와 면책 문구로만 표시한다.

## 근거(공개된 일반 지식만)
- 섹션 200~800, 총점 400~1600. 디지털 SAT는 섹션별 2모듈 적응형이며 M2 난이도는 M1 성과로 정해진다.
- 쉬운 M2(lower) 경로는 섹션 점수 상한이 낮고(대략 600~650 안팎), 어려운 M2(higher) 경로에서만 800에 도달한다. 같은 정답 수여도 경로에 따라 점수가 다르다.
- College Board는 문항별 가중치·변환표를 공개하지 않는다. 아래 앵커는 위 성질을 만족하도록 설계한 값이다.

## 모델
경로별 (섹션 정답률 -> 섹션 점수) 앵커를 구간 선형 보간한다(`lib/mock-exam/score-estimate.ts` `ANCHORS`).
- lower: 0->200, 50%->390, 80%->540, 100%->650(`LOWER_PATH_CAP`, 범위 상한도 650으로 자름)
- higher: 0->200, 30%->380, 50%->480, 70%->620, 85%->720, 100%->800
- 범위 반폭: 기본 30점. lower 경로 정답률 70%->90%, higher 경로 정답률 60%->30%로 갈수록 +20까지 연속 확대(경계·상한 불확실성). 10점 단위 반올림, 200~800 클램프. 총점 범위는 두 섹션 범위의 합.
- 결과에 `modelVersion = "v1-adaptive"`를 싣는다. 경로가 둘 다 확정되지 않았거나 채점 전이면 표시하지 않는다.

## 경로 비노출
- 경로는 `loadMockExamAttemptDetail`(서버)이 RPC의 접근 검사 뒤 서비스 롤로 읽어 계산에만 쓴다. 학생·보호자 응답에는 `routing`이 여전히 없고, `scoreEstimate`(범위·모델 버전만)만 추가된다. 클라이언트 컴포넌트는 경로·난이도를 받지 않는다.
- 한계: 점수가 높을수록 higher 경로였음을 간접 추론할 수 있으나(범위 자체는 공개 성질) 경로·난이도 라벨은 노출되지 않는다.

## 한계·가정
- 앵커는 실측 캘리브레이션 없이 설계한 값이다. 문항별 난이도 가중(IRT)을 쓰지 않아 같은 경로·정답 수면 점수가 같다.
- 섹션 문항 수 차이(RW 54, Math 44)는 정답률로 정규화한다.
- Phase 5(`docs/briefs/2026-09-29-mock-exam-mst-phase5-calibration-brief.md`)에서 실응시 데이터로 `ANCHORS`/너비를 교체하고 `SCORE_MODEL_VERSION`을 올린다.

## 표시 규칙과 검증 상태 (2026-10-09) — display verified, accuracy NOT verified
- **언제 보이나(코드 근거 `lib/mock-exam/attempt-data.ts computeScoreEstimate` + `MockExamResultView`)**: ① MST 응시(고정형·AP 는 범위 없음) ② 채점 완료 결과 화면 ③ R&W·Math **두 섹션 모두에 채점된 문항(correct ≠ null)이 1개 이상** ④ 두 섹션의 Module 2 경로 확정. 넷 중 하나라도 없으면 범위 블록 자체가 없다.
- **"거의 안 푼" 응시와 "정상" 응시의 구분**: 응답한 문항 수 하한은 **없다**. 미응답 문항은 `correct = null`(채점 안 됨)이라, 한 섹션에 응답이 하나도 없으면 그 섹션 점수가 없어 범위가 나오지 않는다(예: R&W 에만 응답 1개 → 범위 없음). 두 섹션에 응답이 하나씩만 있어도(총 2문항) 범위가 표시된다 — 즉 구분 기준은 "섹션별 응답 유무"이지 "충분히 풀었는가"가 아니다. 모듈을 끝내지 못한 응시는 graded 가 안 되어 결과 화면(과 범위)이 없다. (제품 판단 필요: 응답 수 하한이 필요하면 별도 결정 — 아래 "미결정".)
- **검증**: 표시 조건은 `lib/mock-exam/score-display-rule.test.ts`(단위)·`score-display-rule.integration.test.ts`(실제 DB 응답)로 검증했다. 점수 **정확도는 검증하지 않았다**(College Board 변환표와 비교한 적 없음). 모델 샘플(98문항 = R&W 54 + Math 44, lower 경로): R&W 7·Math 7 정답 → 총점 450-570, R&W 5·Math 9 → R&W 210-270 / Math 250-310 — 현업 응시에서 보고된 `210-270 / 240-300 / 450-570` 형태와 모델 출력 모양이 일치한다(저장소에는 1/98·8/98·14/98 응시 기록 자체가 없어 그 기록과의 1:1 대조는 하지 못했다).
- 상태 표기 상수: `SCORE_VALIDATION_STATUS = "display verified, accuracy NOT verified"`(`score-estimate.ts`). 문서·내부 화면에서 이 문구로 표기한다.
- 미결정: "응답이 너무 적은 응시에는 범위를 숨긴다"(예: 전체 응답 비율 하한)는 정책이 없다. 현재 동작은 위와 같다.


## 응답 비율 정책 — 초기 운영 임계값 80% (2026-10-09 오너 결정, 위 "표시 규칙" 보다 우선)
- **규칙**: 각 섹션(R&W·Math)에서 **실제로 출제된 문항(경로 반영)의 80% 이상에 유효 응답**(null·공백 제외, **정답 여부와 무관**, 응답 수를 센다)이 있을 때만 예상 점수 범위를 보인다. 한 섹션이라도 미달이면 범위 자리에 정확히 `Not enough responses to estimate a score range.` 를 보이고, 결과·정오 분석은 그대로 연다. 정수 비교 `answered*100 >= total*80`(R&W 54문항: 43개 79.6% 부족, 44개 81.5% 충분).
- **성격**: 80% 는 **초기 운영 임계값**이다 — 응답이 너무 적은 응시에서 추정이 나가는 것을 막기 위한 값이지 점수 **정확도를 보장하지 않는다**(정확도 미검증은 그대로). 상수 `MIN_RESPONSE_RATIO`, 문구 `INSUFFICIENT_RESPONSES_TEXT`(`lib/mock-exam/score-estimate.ts`), 관리자 안내 `SCORE_THRESHOLD_NOTE_KO`(Free Accounts 점수 통계 카드). 보정(Phase 5) 때 조정한다.
- **적용 범위**: 결과 화면(학생·학부모 읽기 전용 같은 컴포넌트 `MockExamResultView`), 통계 추이(`student_stats_aggregate` → `computeMockStats`), 관리자 점수 원자료(`admin_student_mock_attempt_facts` → `estimateAttempt`/`AttemptHistoryTable`). 고정형·AP·미채점은 영향 없음(기존 사유 그대로: 범위 없음). 섹션별 유효 응답 수는 마이그레이션 `20262100000409`(`_mock_exam_section_answered`)가 준다. 알 수 없는 값(answered 없음)은 충분하다고 보지 않는다.
- **표기**: 결과 화면 소제목 "Internal estimate — accuracy not verified; not an official College Board score". 이전 절의 "응답 총수 하한 없음·섹션당 1개" 서술은 이 정책으로 대체됐다.
- **테스트**: 단위 `lib/mock-exam/score-response-threshold.test.ts`(40/54 vs 44/54, 경계 43/54, 한 섹션만 미달, 정답이 아니라 응답 수, 고정형·AP 불변), 통합 `lib/mock-exam/score-display-rule.integration.test.ts`(실제 DB 응답, 공백 응답 제외, 통계·관리자 RPC answered), 컴포넌트 `MockExamResultView.tabs.test.tsx`(학생·학부모 문구).
