# AP Computer Science A 공식 사실 검증 (2026-10-13, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료만 사용했고 문구는 요약만 쓴다(시험 문항·채점 문구 복제 없음).

**출처**
- [AP-exam] https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam (2026-10-13 조회)
- [SG-2025] 2025 채점 지침: https://apcentral.collegeboard.org/media/pdf/ap25-sg-computer-science-a.pdf 및 문항별 PDF(`ap25-apc-computer-science-a-q1..q4.pdf`) — 문항당 9점 루브릭 구조 확인(검색 요약 기준; Q3 파트 a 1–4점·b 5–9점, Q4 파트 a 4점·b 5점은 직접 확인, Q1·Q2 9점 총점은 점수 번호가 9까지 있는 것으로만 확인).
- [data] `data/ap/curriculum-2027/ap_computer_science_a.json`(CED ©2025 전사: 4단원·토픽 1.1–4.17, 단원·Practice MC 가중, 스킬 코드)

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 전달 방식 | **완전 디지털**(Bluebook, 자동 제출). 종이 FRQ 없음 → `frq-delivery.ts` `ap_computer_science_a: "digital"` 과 일치 | [AP-exam] |
| MC | **42문항·90분·55%**. 대부분 단독 문항, 가끔 **2문항 세트** | [AP-exam] |
| FRQ | **4문항·90분·45%**, 전부 Practice 2(Develop Code) | [AP-exam], [data] |
| FRQ 유형 | Q1 Methods and Control Structures(메서드 2개 또는 생성자 1+메서드 1; 반복·조건·String 메서드), Q2 Class Design(클래스 머리·인스턴스 변수·생성자·메서드, 시나리오와 예시 표), Q3 Data Analysis with ArrayList(메서드 1), Q4 2D Array(메서드 1) | [AP-exam] |
| FRQ 배점 | **문항당 9점**(총 36점). 파트 a/b 점수 분할은 문항마다 다름(예: Q3 a 4·b 5, Q4 a 4·b 5) | [SG-2025] |
| Java Quick Reference | Bluebook 에 포함(시험에 나올 수 있는 접근 가능 Java 라이브러리 메서드 목록), 학교가 인쇄해 줄 수도 있음 | [AP-exam] |
| 단원 MC 가중 | U1 15–25, U2 25–35, U3 10–18, U4 30–40 (%) | [data] |
| Practice MC 가중 | P1 2–10, P2 22–38, P3 37–53, P4 10–15, P5 2–10 (%) | [data] |
| 스킬 코드 | 1.A–1.B, 2.A–2.C, 3.A–3.D, 4.A–4.B, 5.A | [data] |
| 2027 변경 | 페이지에 기재된 변경 없음. 시험일 2027-05-12(수) Session 2 | [AP-exam] |

## 2. UNVERIFIED (공개 자료로 확인하지 못함)
1. **FRQ 코드 입력 방식**: 페이지는 "완전 디지털, 답이 자동 제출"까지만 말하고 코드를 타이핑하는지·편집기 기능(들여쓰기·자동 완성)은 적지 않았다. 본 구현은 타이핑을 가정한다(Statistics 와 같은 digital 경로).
2. **계산기**: 페이지에 언급 없음. 이 과목은 계산 문제가 없어 앱은 계산기를 켜지 않는다(공식 정책 문장은 미확인).
3. MC 2문항 세트의 개수·정확한 분포(공식 미공표).
4. FRQ 문항별 권장 시간(공식 미공표 — 내부 추정 약 22분씩, 90분/4).
5. 공식 Java Quick Reference 의 정확한 항목 목록 — ALTON 참조 패널은 자체 문구이며 1:1 일치는 UNVERIFIED("ALTON study reference — not the official College Board sheet").
6. Practice 5(컴퓨팅의 사회적 영향)·1.B(데이터에서 지식 추출) 문항은 코드 실행으로 정답을 검증할 수 없다. 최솟값이 0문항으로 내려가므로 파일럿 MC 에는 두지 않는다(오너 결정 사항으로 남김).

## 3. 범위 메모 — 상속·다형성
`data/ap/curriculum-2027/ap_computer_science_a.json`(CED ©2025 전사)의 단원 3 "Class Creation" 토픽은 3.1–3.9(추상화·클래스 구조·생성자·메서드·참조 전달·static·범위·this)이고 **상속·다형성·인터페이스 토픽이 없다**. 그래서 이 repo 의 CS A 원형은 그 주제를 다루지 않고(범위 밖 목록에 명시), 생성기 금지어(`extends`·`super(`·polymorphism·abstract class)로도 막는다. 오너가 상속·다형성을 시험 범위로 확인하면 CED 토픽을 다시 대조한 뒤 원형을 추가한다.
