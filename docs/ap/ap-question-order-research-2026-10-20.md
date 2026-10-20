# AP 문항 순서 규칙 조사 (2026-10-20)

범위: 14과목 공개 세트(원격 SELECT 읽기 전용, 공개·미보관 세트 38개)의 문항 순서를 College Board 공개 자료와 대조. SAT는 제외. 근거는 AP Central 과목 `exam` 페이지와 과목별 CED(Course and Exam Description) PDF의 Exam Overview·Sample Exam 문구다. 근거가 없으면 "공식 규칙 확인 불가"로 두고 규칙을 만들지 않았다.

## 결론

1. **MC 문항의 단원·주제·난이도 순서는 어느 과목에서도 공식 규칙으로 공표되지 않았다.** CED Exam Overview는 문항 수·시간·단원 비중 범위와 "단독 문항 + 자료 세트(stimulus set)" 구성만 적는다. 공개 샘플 시험에서도 Biology·Physics 1 샘플 MC의 단원은 뒤섞여 있고(Physics 1: 2,2,3,1,1,5,7,8,4,…), Chemistry·US History 샘플은 대체로 단원 오름차순이지만 CED가 규칙으로 선언하지는 않는다. 샘플은 예시이므로 우리 세트에 순서 규칙을 만들지 않았다(임의 추측 금지).
2. **공식 규칙이 있는 것은 FRQ 번호별 유형, 계산기 파트 순서, SAQ 번호, Language MC의 읽기→쓰기 묶음 순서**다. 아래 표.
3. 공개 세트는 이 공식 규칙을 **전부 이미 만족**한다(FRQ 번호 순서 25/25 세트, 이력 과목 SAQ→DBQ→LEQ 4/4, Language 읽기→쓰기 2/2). 따라서 공개 세트의 position 재배치는 필요 없다(재배치 SQL 0건).
4. 다만 조립기(`lib/ap-admin/assemble-*-draft.ts`)는 FRQ를 **입력 순서 그대로** 위치에 넣고 "유형이 각각 1개"만 검사해 왔다. 배정 보고서 순서가 틀리면 그대로 저장될 수 있는 구멍이라, 규칙이 확인된 9개 과목 조립기가 FRQ를 공식 번호 순으로 정렬하도록 고쳤다(`lib/ap-exam/official-order.ts`).

## 과목별 규칙·출처·일치율

일치율 = 공개 세트 중 공식 규칙을 만족하는 세트 수(전 → 후; 조립기 수정은 새 세트 생성 경로에만 영향, 기존 공개 세트는 이미 만족하므로 전·후 동일). "MC 단원 오름차순"은 공식 규칙이 아닌 참고 지표(인접 문항 쌍에서 단원이 줄지 않는 비율의 세트 평균)다.

| 과목 | 확인된 공식 규칙 | 출처 | 규칙 일치(전→후) | 조립기 반영 | MC 단원 오름차순(참고) |
|---|---|---|---|---|---|
| Biology | FRQ Q1 Results(9) · Q2 Graphing(9) · Q3 Investigation · Q4 Conceptual · Q5 Model · Q6 Data(각 4). MC 순서 규칙 없음(단독+세트) | CED Exam Information p.197 | FRQ 4/4 → 4/4 | 정렬 추가 | 0.839 |
| Calculus AB | Section I Part A(무계산기 29) → Part B(그래프 계산기 13), Section II Part A(계산기 2) → Part B(무계산기 4). 파트 안 순서 규칙 없음 | AP Central exam 페이지 | 파트 순서는 섹션 레이아웃이 고정 (6/6) | 변경 없음(레이아웃이 이미 보장) | 0.665 |
| Calculus BC | AB와 동일 | AP Central exam 페이지(AB와 동일 형식) | 3/3 | 변경 없음 | 0.726 |
| Chemistry | 긴 문항 3(10점) + 짧은 문항 4(4점)만 명시. **번호별 유형·긴/짧은 순서는 확인 불가** | CED Exam Overview p.205 | 규칙 없음(우리 세트는 모두 긴→짧) | 건드리지 않음 | 1.000 |
| Computer Science A | FRQ Q1 Methods/Control · Q2 Class · Q3 Data Analysis(ArrayList) · Q4 2D Array | CED Exam Overview(`docs/ap/csa-facts.md` 인용) | 3/3 → 3/3 | 정렬 추가 | 1.000 |
| English Language | FRQ Q1 Synthesis · Q2 Rhetorical Analysis · Q3 Argument. MC는 "첫 묶음 = 읽기, 두 번째 묶음 = 쓰기" | CED Exam Information p.107, Sample Exam Section I 안내 | FRQ 2/2, 읽기→쓰기 2/2 | FRQ 정렬 추가(읽기→쓰기는 기존 검증기가 이미 차단) | 0.966 |
| English Literature | FRQ Q1 Poetry · Q2 Prose Fiction · Q3 Literary Argument. MC 5묶음(8~13문항) 순서 규칙은 확인 불가 | CED Exam Overview, AP Central exam 페이지 | 2/2 → 2/2 | 정렬 추가 | 0.990 |
| Macroeconomics | FRQ Q1 Long(10) · Q2 Short(5) · Q3 Short(5). MC 순서 규칙 없음 | CED Exam Overview | 3/3 → 3/3 | Long 먼저 정렬(Short 둘은 순서 자유) | 1.000 |
| Microeconomics | 동일 | CED Exam Overview | 3/3 → 3/3 | 동일 | 1.000 |
| Physics 1 | FRQ Q1 Mathematical Routines · Q2 Translation Between Representations · Q3 Experimental Design · Q4 Qualitative/Quantitative Translation. MC 순서 규칙 없음(샘플 MC는 단원 혼합) | CED Exam Information p.170 | 4/4 → 4/4 | 정렬 추가 | 1.000 |
| Psychology | FRQ Q1 Article Analysis · Q2 Evidence-Based. MC 75 순서 규칙 없음 | CED Exam Overview | 2/2 → 2/2 | 정렬 추가 | 0.925 |
| Statistics | FRQ Q1 Multi-Focus(관행 1·2) · Q2 Multi-Focus(3·4) · Q3 Inference · Q4 Multi-Focus(2·3·4). MC 3문항 세트 순서 규칙 없음 | CED Exam Overview p.156/158 | 2/2 → 2/2 | 정렬 추가 | 0.976 |
| U.S. History | Section I Part A MC 55 → Part B SAQ(Q1 보조사료, Q2 1차사료, Q3 1차/2차 비텍스트) → Section II DBQ(Q1) → LEQ(Q2). MC 세트의 시대 순서는 규칙으로 공표되지 않음(샘플은 대체로 시대순) | CED Exam Overview p.497 | 2/2 → 2/2 | 기존 조립기가 SAQ→DBQ→LEQ 순서를 이미 오류로 검사 | 0.990 |
| World History | USH와 같은 구조(SAQ Q1 보조사료·Q2 1차사료·Q3 비텍스트 → DBQ → LEQ) | CED Exam Information(Exam Overview) | 2/2 → 2/2 | 기존 검사 유지 | 1.000 |

출처 URL(조회 2026-10-20):
- https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam
- https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam
- https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam
- https://apcentral.collegeboard.org/courses/ap-biology/exam/the-biology-exam-content
- https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf
- https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf
- CSA는 `docs/ap/csa-facts.md`가 인용한 CED 문구를 재사용(CED PDF는 이번 조사에서 별도로 열지 않음).

한계: 공식 기출 MC 전문 PDF(순서 전체)는 일부 과목만 공개되며 이번 조사에서는 CED Sample Exam의 정답표(문항 번호별 단원)까지만 확인했다. "MC 순서 규칙 없음"은 "CED·exam 페이지에 규칙 문구가 없다"는 뜻이지 "실제 시험이 무작위"라는 주장이 아니다.

## 반영 내용

- `lib/ap-exam/official-order.ts`: 과목별 공식 FRQ 번호 순서표, `sortFrqByOfficialOrder`(안정 정렬; 규칙 없는 과목·유형 불명 키가 있으면 입력 순서 유지), `frqOrderComplies`.
- `lib/ap-admin/assemble-{bio,csa,elang,englit,macro,micro,phys,psych,stats}-draft.ts`: 위치 배정 직전에 FRQ 키를 공식 순서로 정렬. USH/WH는 기존 순서 검사, Chemistry와 미적분은 규칙 없음/레이아웃 보장으로 변경 없음.
- 테스트 `lib/ap-exam/official-order.test.ts` + 기존 `assemble-*` 테스트 74건 통과.
- `scripts/ap-generation/order-audit.ts`(읽기 전용 감사), 결과 `data/ap/stock/ap-order-audit-20261020.json`.
- 새 세트 버전 교체안: 공개 세트가 이미 전부 공식 규칙을 만족하므로 position 재배치 SQL은 없다(`data/prod-open/ap-order-sql/README.md`에 근거 기록). MC 단원 순서를 맞추는 재배치는 규칙 근거가 없어 만들지 않았다.
