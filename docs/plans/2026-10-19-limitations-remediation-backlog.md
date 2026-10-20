# 한계 보완 백로그 (오너 지시 2026-10-19: "한계라고 얘기한 것들은 다 보완되어야 해")

세션 중 보고한 한계·미완료 항목을 전부 모았다. 우선순위는 학생 노출 품질 → 검증 신뢰도 → 개발 위생 순. 예산은 상한 $650(누적은 `npx tsx scripts/ap-generation/ledger-total.ts`) 안에서 진행하고, 부족하면 현황을 숫자로 보고한다.

## A. 콘텐츠 품질 (공개 세트)
- A1 Macroeconomics 3: 그림·표가 9/63(14%) — 기존 MA1·MA2(36%) 수준(≈22/63)으로. AD-AS·화폐시장·루프·필립스 곡선 등 그래프형 새 원형 저작 후 새 버전 교체.
- A2 난이도(`exam_prep`) 저하: Biology 3·4(13/60, 11/60), Micro 3, 필요 시 Physics 3·4 — 기존 세트 수준(≥26/60)으로 올리는 새 원형·문항 교체(새 버전).
- A3 Psychology PS3: `exam_prep` 1/75, 부조화 세트 난도 낮음, 단원 5 세트 실패 — 보강 후 공개(아직 미적재). 
- A4 SAT 27~30·14~26: `command_of_evidence_quant`(표·그래프) 문항 없음 → 컴파일러로 생성해 반영, 지문 160단어 초과 10건 단축, 브라우저 화면 확인 부재, SAT Test 2 m2#38 경계 사례.
- A5 Math 신규 SAT는 기존 은행 재사용 → 같은 풀이 틀 중복 점검 보강.
- A6 '틀이 다르다' 판정이 원형 id·유사도 임계값 기반 → 사람이 읽는 샘플 검토(대표 문항 발췌 목록 작성).
## B. 검증·채점·원형 결함
- B1 CSA FRQ 배점 9→7/7/5/6 원형 쪽 수정(프로필·게이트·테스트), `cs_char_arith` 원형 퇴역, JDK 환경 준비(현재 Java 없음; `brew install openjdk@21` 등 로컬 개발 도구 설치 필요 시 진행), Responsible Computing 2문항 전문가 검토 표시 → 근거 정리.
- B2 에세이 참고답 점수·설명 충돌 자동 점검 게이트(영역 점수 합 = 총점 = 설명 일관성 규칙 검사기).
- B3 식만 남긴 SAT Math 패치 7건의 `figure_checked=false` 확인·정정.
- B4 exam_prep 라벨이 선언된 구조 신호 기반인 과목(Stats·Psych) → 실제 난이도 대리 지표(독립 풀이 정답률·단계 수) 보강.
## C. 개발 위생
- C1 실패 테스트 정리: psych-archetypes 순서, screen-evidence-file(3개 증거 파일 캡처 누락), ush-real-render 2건, gates.test(Python 환경), audit-1019-type-fixes(report-fix1019.json 누락), HiGHS 솔버 테스트, `tsc` Sanity 타입.
- C2 학생 UAT 시도·테스트 계정 정리(정확한 id), 로컬 격리 스택 잔여물.
## D. 오너/운영(코드 밖): Stripe 웹훅 200 확인, DocuSign, Vercel 환경, 서치 콘솔, Sanity 프로젝트, 학생 응시 데이터 기반 난도 보정(오픈 후).
