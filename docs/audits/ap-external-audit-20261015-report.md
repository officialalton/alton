# ALTON 최신 AP 전체 검수 결과

검수일: 2026-10-15 · 대상: 현재 학생 계정에 제공되는 최신 AP **14과목·33세트**. 전체 모의시험 30개와 Calculus AB 부분 연습 3개를 포함합니다. 새 Literature·U.S. History·World History 6세트와 Updated 표시 21개를 포함해 현재 버전 전체를 검토했습니다. 목록의 Past 3행은 이전 버전 기록으로 분리했습니다.

## 판정

**현재 상태로 전체 승인하기 어렵습니다. 우선 P1 4곳을 수정하고 재검증해야 합니다.** 실제 문제를 풀고 답안을 입력·제출한 뒤 참고답과 대조했습니다. 확보·풀이·서버 저장 확인·제출 확인을 마친 범위는 **1,736문항(MC 1,596 + FRQ·SAQ 140)**, 서술형 입력 필드 **482개**입니다.

확정 수정 목록은 **59행(P1 4행, P2 55행)**이고, 추가 전문 검토·문구 개선 후보 **36행**을 별도로 뒀습니다. 샘플 여러 개를 묶은 행도 있어 이 행 수를 결함 문항 수로 해석하면 안 됩니다. 이번 요청 범위는 검수와 수정 제안이며 서비스 원본은 변경하지 않았습니다.

## 가장 먼저 고칠 4곳

| 우선 | 위치 | 확인한 문제 | 수정 방향 |
|---|---|---|---|
| P1 | Microeconomics 2 · MC56 | 공공재의 사회적 한계편익만 있고 한계비용이 없어 효율적 수량을 정할 수 없음. 해설에서만 비용 26을 새로 제공 | 의도한 비용을 학생 본문·표에 제시하고 답을 재검증 |
| P1 | Biology 2 · FRQ5 A/B | 가닥의 5′/3′ 방향만 있고 복제분기점의 진행 방향이 없음. 진행 방향에 따라 선도 가닥 주형이 바뀌지만 참고답은 아래 가닥만 인정 | 복제분기점·진행 화살표를 추가하거나 가능한 양쪽 해석을 허용 |
| P1 | Statistics 1 · MC27 | 보기 A와 D의 귀무가설이 수학적으로 동치이며 자유도도 6으로 같음 | 한 보기를 실제로 비동치인 명제로 교체 |
| P1 | Statistics 2 · MC23 | 보기 B와 C가 같은 동치 관계. 표본 설계의 명칭 차이만으로 한 명제를 거짓으로 만들 수 없음 | 본문·보기를 함께 수정하고 대안 보기 배제 설명도 재작성 |

Statistics는 각 학교의 조건부 분포가 같으면 합친 모집단에서 학교와 통학 방식이 독립이라는 관계를 사용했습니다. 검정 이름이 동질성/독립성으로 달라지는 사실과 귀무명제의 동치 여부를 구분했습니다. [수학적 검증](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/finding-statistics2-mc23-proof.md) · [Biology 방향 검증](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/finding-bio2-frq5-independent.md).

## 그다음 수정할 핵심 묶음

- **모범답안·채점 안내의 내부 불일치:** World History 1·2의 DBQ/LEQ 여러 예시, U.S. History 1·2의 LEQ/DBQ, Literature 2 FRQ3에서 표시 점수와 영역별 설명이 충돌합니다. 한 기준으로 샘플을 재검토한 결과에서 총점·항목 점수·주석이 함께 나오도록 고치세요. World 1 DBQ 문서 근거 최소 개수도 안내 안에서 통일해야 합니다.
- **수학 전제와 그래프의 모순:** BC1 MC-B6, BC2 MC-B9, BC3 MC-A19의 ‘모든 차수 도함수 존재’는 정확한 꺾은선 도함수 그래프와 양립하지 않습니다. AB3 MC-A27도 전역 미분 가능 전제와 선분의 모서리가 충돌합니다. 해당 국소 계산의 의도답은 유일하므로 P2로 분류했지만 불필요한 전제를 삭제·한정해야 합니다.
- **CSA 공식 형식·범위:** 두 시험 모두 FRQ가 9·9·9·9점으로 표시되어 현행 7·7·5·6과 다릅니다. CSA1 MC1의 char/long, CSA2 MC3의 char 평가를 범위 안 자료형으로 바꾸세요. CSA1 MC38은 제외된 재귀 코드 작성 과제를 요구합니다. CSA2 FRQ1B는 String 요구가 빠졌고, 두 시험의 책임 있는 컴퓨팅 Practice 5 평가도 보강해야 합니다. 재귀 **추적** 자체는 범위 안입니다.
- **참고답의 사실·논리 정밀성:** Biology1 NaCl 용질 퍼텐셜 부호 설명, U.S. History2 Munn 판결의 직접 대상, World2 명령 제1호와 퇴위의 선후관계, Literature의 수동태·행위 주체 설명을 고치세요. Statistics1 MC21의 n=200과 관측 비율 .459도 양립하지 않습니다.
- **작은 수치·표시 오류:** Physics1 MC26의 반올림 값, Physics1 두 번째 시험 FRQ3의 제곱 좌표 두 곳(1.644·3.144), World2의 EXTRA 표시, World의 표 중복, Biology2의 잘린 실험 소개 등을 수정하세요. 작은 자릿수 문제와 정답을 정할 수 없는 P1은 구분했습니다.

문항별 정확한 근거와 수정 지시는 [확정 수정 목록](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/confirmed-fixes.md) 및 [개발·콘텐츠 담당자용 CSV](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/confirmed-fixes.csv)에 있습니다. [검토 후보 CSV](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/review-candidates.csv)에는 최선의 보기는 유지되지만 조건·표현을 개선할 수 있는 항목을 분리했습니다.

## 문제·주제·유형 다양성과 College Board 수준

현행 May 2027 규격을 기준으로 비교했습니다. 과거 규격인 Calculus 45MC나 History 선택형 SAQ/LEQ를 현재 시험에 적용하지 않았습니다. Calculus의 42MC(29+13)·6FRQ(2+4), Physics 1의 42MC·4FRQ, Statistics의 42MC·4FRQ 등은 현재 형식과 맞습니다. 문항 수와 형식이 맞는 것과 공식 난도·성적 등가성은 별개입니다.

| 과목 | 실제 내용 검토와 권장 개선 |
|---|---|
| Biology | 유전·삼투·생태·에너지·세포주기를 다룸. Biology1 효소 FRQ 편중은 3/6→1/6로 줄었음. 현재 두 시험 간 정확한 MC 복제는 확인하지 못함. 분기점 방향·참고답 조건은 별도 수정 필요 |
| Calculus AB | 극한·도함수·최적화·FTC·면적/체적·미분방정식 등 범위가 넓음. 여러 시험의 선분 그래프·사다리·변수분리 틀 반복이 뚜렷하므로 다른 모델·표현을 늘릴 여지 있음 |
| Calculus BC | 매개·극좌표·급수·Taylor·로지스틱/Euler 포함. 도함수 그래프·냉각 FRQ가 버전 간 유사하므로 독립 시험의 추론 과제를 다양화 권장 |
| Chemistry | 원자/PES·결합·반응량·속도·평형·산염기·열역학·전기화학 포함. 두 전체 시험 사이 MC 3쌍 재사용 확인. 단순 수치 교체를 넘어 실험 설계·오차 판단을 늘리는 편이 좋음 |
| Computer Science A | 실제 Java 답안 컴파일·경계·무작위 실행 검증 통과. 네 FRQ 계열은 있으나 배점·자료형·재귀 작성·Practice5 범위 조정 필요. CSA1 Q1B는 String 사용이 있어 누락으로 분류하지 않음 |
| English Language | 두 시험 모두 실제 5개 자극 세트로 개선됨. Reading/Writing 각각 25/20,23/22. 합성·수사 분석·논증을 제공하며 구 루브릭 오류도 여러 곳 수정됨 |
| English Literature | 시·산문·선택 작품 논증 및 실제 출처를 사용. 한 지문의 같은 결론을 반복 확인하는 MC와 해석을 미리 많이 주는 FRQ는 변별력·다양성 개선 후보 |
| Macroeconomics | GDP·물가·AD/AS·통화·정책·국제 부문 포함. Macro1 고정 물가 승수와 물가 조정 혼용은 수정됨. Macro2 국내 생산 전제·경기침체 맥락은 개선 후보 |
| Microeconomics | 효용·시장·기업 비용·노동·게임·외부효과 포함. 두 시험의 비용·이윤·게임 틀이 반복됨. Micro2 MC56 정보 누락은 우선 수정 |
| Physics 1 | 운동·힘·에너지·운동량·회전·진동·유체 및 네 FRQ 유형 포함. 직접 공식 대입·순위 비교가 많아 지속적인 모델링·실험 해석을 더 늘릴 여지 있음 |
| Psychology | 5개 내용 영역과 연구설계·자료 해석, AAQ/EBQ 포함. 두 시험의 pre/post·GPA 신뢰도·z꼬리·반응시간·방관자·효과/p·위약 평가 틀이 매우 가까움. 새로운 자극과 구별을 추가 권장 |
| Statistics | 설계·확률·표본분포·추론·회귀 및 여러 도표 포함. 잔차 곡률 해석은 현행 범위 안. 정확히 같은 MC 2쌍과 같은 조사질문 판별 기능의 반복은 분산 권장 |
| U.S. History | 1차·2차·비문자 자료, 비교·인과·맥락·DBQ/LEQ 포함. 두 시험의 에세이 주제는 다름. 참고답의 역사 사실·점수 설명을 정비해야 함 |
| World History: Modern | 여러 시대·지역의 사료·그림·통계·비교를 제공. Mughal 및 권리/주권·국제권력 주제 집중을 다른 문화·환경·과학적 자료로 분산할 여지 있음 |

정확한 MC 본문·보기집합·SVG/이미지를 비교하면 **7쌍**이 잡혔습니다. 이 중 **5쌍은 별도 전체 시험 간 재사용**(Chemistry 3쌍, Statistics 2쌍)이며 나머지 2쌍은 Calculus 부분 연습과 전체 시험의 공유여서 자동 결함으로 보지 않았습니다. 이 검사는 의미가 비슷한 모든 변형 문제나 FRQ 중복까지 검출하는 검사가 아닙니다. [중복 위치 기록](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/current-exact-duplicates.json).

범위·유형은 대체로 AP 연습에 적합하지만 **일부 단문·직접 대입 위주 구성과 반복 틀만으로 College Board와 동등한 난도라고 결론낼 수는 없습니다.** 실제 학생 응답·소요 시간·문항 변별도 자료로 별도 보정해야 합니다. 이 보고서는 공식 단원별 비중을 전 문항에 코딩해 인증하거나 AP 등급을 환산한 결과가 아닙니다.

## 수정 확인된 주요 항목

Biology1 효소 편중, Chemistry2 MC29 이상치 제외 기준, CSA2 MC33/42 반복과 FRQ4 음수 행합 sentinel, Macro1 MC28 통화 정의와 FRQ1 모형 혼용, Statistics2 구 MC28 복수답과 FRQ 시간 순서, Physics1 운동 전제 및 첫 시험 제곱 좌표, Language 두 시험의 자극 수·일부 루브릭, 여러 Calculus 초기값, Micro1 MC53 다음 노동자 조건, Psychology2 인원·백분율 정밀도는 현재 버전에서 개선을 확인했습니다.

**Statistics2의 구 MC28은 고쳐졌지만 현재 MC23의 다른 복수답은 남아 있습니다.** 수정된 과거 문제를 현재 결함으로 다시 세지 않았습니다. 이전 검토자의 보기 매핑·그래프 해석 실수도 제품 수정 성과와 구분했습니다. [수정 확인 세부 목록](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/verified-resolved.csv).

## 검증 방식과 범위

1. Chrome 학생 계정에서 최신 세트를 실제로 열고 모든 섹션 원문·보기·그림·입력 필드를 확보했습니다. 각 문항의 해설·정답키를 보기 전에 독립 풀이를 저장했습니다. 일부 변하지 않은 서술형은 현재 원문이 같은지 비교한 뒤 기존 독립 답안을 재검증해 사용했습니다.
2. 실제 학생 화면에서 MC·서술형 응답을 입력하고 Saved 상태를 확인했습니다. 새로고침 후 서버가 돌려준 모든 응답을 독립 답안과 문자 단위로 대조하고, 전 문항 응답 완료 확인창을 거쳐 제출했습니다.
3. 같은 응시의 제출 결과를 다시 불러와 정답키·참고답·가이드와 비교했습니다. 모든 결과 카드의 본문을 일일이 펼친 것은 아니며, 서버가 이미 전달한 결과 자료로 전체 문항을 대조했습니다. 33개 응시는 서로 다른 ID입니다.
4. 그림이 필요한 답안은 좌표·곡선·라벨·음영 지시를 텍스트로 작성한 경우가 많습니다. **앱의 펜/캔버스 기능과 실제 손그림 성능은 전수 검증하지 않았습니다.** 이를 그림 점수 획득이나 공식 FRQ 채점 완료로 보지 않았습니다.

[33개 세트별 응시·결과 표](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/coverage-and-results.md) · [최종 저장·제출 무결성 검증](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/evidence-integrity.json) · [전체 목록 및 응시 링크](/Users/jangjiman/.codex/visualizations/2026/10/08/01a11a6a-2cd1-7bf3-b5dc-c56cea1dd850/alton-audit/all-ap-current-20261015/full-progress.json).

## 기준 자료

비교 대상은 검수일에 확인한 College Board 공식 안내·CED입니다. 세부 범위와 해당 쪽수는 각 문항 검토 자료에 기록했습니다.

- [Calculus AB 현행 시험](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam) · [Fall 2026 변경 설명](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-bc-course-and-exam-description-clarifications.pdf)
- [CSA 현행 시험](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam) · [CSA CED](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf)
- [History 시험 변경](https://apcentral.collegeboard.org/courses/ap-history-exam-updates)
- [Statistics Fall 2026 CED](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description-effective-fall-2026.pdf)
- [Chemistry 시험](https://apcentral.collegeboard.org/courses/ap-chemistry/exam) · [Physics 1 시험](https://apcentral.collegeboard.org/courses/ap-physics-1/exam)
- [Literature 공식 채점 루브릭](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-frqs-1-2-3-scoring-rubrics.pdf)

## 수정 후 확인할 사항

P1 네 문항은 새 문항 본문만 보고 복수의 검토자가 같은 유일답에 도달하는지 확인하세요. 참고답·점수·주석은 같은 루브릭 데이터에서 생성하고, 수치 예시는 학생에게 표시한 값으로 다시 계산하세요. CSA의 범위·배점을 먼저 맞춘 뒤, 별도 전체 시험의 재사용 문항과 과도하게 비슷한 평가 틀을 교체하는 순서가 적절합니다.
