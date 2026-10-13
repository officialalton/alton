# AP Chemistry 공식 사실 검증 (2026-10-13, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료만 사용했고 문구는 짧은 요약만 쓴다(시험 문항·채점 문구 복제 없음).

**출처**
- [CED] AP Chemistry Course and Exam Description (©2024, 9단원): https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf — 로컬 텍스트 추출(pdftotext) 후 대조. 쪽 번호는 CED 인쇄 쪽("Exam Information V.1 | n", "Appendixes V.1 | n").
- [AP-exam] https://apcentral.collegeboard.org/courses/ap-chemistry/exam (2026-10-13 조회)
- [data] `data/ap/curriculum-2027/ap_chemistry.json`(repo 전사본: 단원·토픽·스킬 코드·가중) — CED 와 아래 §1 항목을 대조해 일치 확인.

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **3시간 15분**(MC 90분 + FRQ 105분), MC 60문항 + FRQ 7문항 | CED p.205, [AP-exam] |
| 시험일 | 2027-05-06(목) Session 2 | [AP-exam] |
| MC | **60문항·90분·50%**. 문항은 단독이거나 "공유 자료(stimulus/data)를 둘러싼 세트". **세트의 개수·크기는 공식 미공표** → UNVERIFIED. 선택지 수(4지)는 CED 샘플 형식에서 4지로 보이며 `layouts.ts`도 4 — 이 조사에서는 샘플 MC 전수 대조까지 하지 않음 | CED p.205, [AP-exam] |
| FRQ | **7문항·105분·50%**: **긴 문항 3개(각 10점)** + **짧은 문항 4개(각 4점)** = **46점**. 문항별 권장 시간은 공식 미공표(우리 내부 추정: 긴 문항 약 23분, 짧은 문항 약 9분 — 점수 비례) | CED p.205, [AP-exam] |
| 긴/짧은 문항 순서·유형 | CED 는 "샘플 FRQ 는 예시이며 실제 시험은 긴 3 + 짧은 4"라고만 적는다. 문항별 고정 주제(Physics 처럼 번호별 유형 고정)는 **공식 미공표** → 우리 7유형은 샘플·스킬 비중에 맞춘 자체 구성 | CED p.214 |
| 샘플 FRQ 형태 | 짧은 문항 예: 광전자 스펙트럼 읽기(원소 식별·전자 배치·쿨롱 법칙 정당화·이웃 원소 봉우리 그리기). 긴 문항 예: 하나의 물질군(S 화합물)에 대한 연쇄 파트 — 균형 반응식·기체 부피·산화수 정당화·루이스 구조 그리기·결합각·ΔS 부호·ΔH 크기 비교·온도에 따른 열역학적 유리함 정당화(파트가 8개까지 가능) | CED p.214–215 |
| 채점 구조 | 분석적, 1점 행. 구조식·그래프 그리기 행이 존재. 공식 채점 문구는 복제하지 않았다 | CED p.216 이하 |
| **단원 MC 가중** | U1 7–9, U2 7–9, **U3 18–22**, U4 7–9, U5 7–9, U6 7–9, U7 7–9, **U8 11–15**, U9 7–9 (%) | CED p.206, [data] 일치 |
| **스킬(Practice) MC 가중** | P1 모델·표현 8–12, P2 질문·방법 8–12, P4 모델 분석 23–30, P5 수학 루틴 35–42, P6 논증 8–12. **Practice 3(데이터·현상 표현)은 MC 에서 평가하지 않는다** | CED p.207, [data] 일치 |
| **스킬(Practice) FRQ 가중** | P1 2–4, P2 10–16, P3 8–16, P4 5–9, P5 43–53, P6 15–24 (%) | CED p.207, [data] 일치 |
| 스킬 코드 | 6 Practice·28 코드: 1.A–1.B, 2.A–2.F, 3.A–3.C, 4.A–4.D, 5.A–5.F, 6.A–6.G (이름은 `ap_chemistry.json`) | CED(스킬 표), [data] |
| FRQ task verb | Calculate·Describe·Determine·Estimate·Explain·Identify/Indicate/Circle·Justify·Make a claim·Predict·Represent/Draw/Write an Equation/Complete a Diagram — 파트 지시문의 동사로 사용 | CED p.208 |
| **계산기** | "A **scientific or graphing calculator** is **recommended** for use on **both sections**". 4칙 계산기 허용 여부는 CED 본문에 명시 없음 → **UNVERIFIED**(AP 계산기 정책 문서 URL 은 이번에 404 였다). Bluebook 내장 계산기·Desmos 제공 여부도 **UNVERIFIED** | CED p.205, [AP-exam]("Calculators are permitted") |
| **참조 자료** | **주기율표**와 **수식·상수 시트("Equations and Constants", effective 2025)** 가 제공된다(인쇄 + Bluebook). 시트 내용: 단위 기호·환산(1 atm = 760 mmHg = 760 torr, K = °C + 273.15, 전압·전류 정의), 접두어, 원자 구조(플랑크 상수·광속·아보가드로 수 등 상수 제공), 기체·액체·용액(PV = nRT, 부분 압력, M = n/L, 비어–람베르트), 속도론(0·1·2차 적분식, t½ = 0.693/k), 평형(Kc, Kp, Kw, pH, Ka, Kb, 헨더슨–하셀바흐), 열역학·전기화학(ΔG° = −RT ln K, −nFE°, I = q/t, 네른스트). 상수: R = 8.314 J/(mol·K) = 0.08206 L·atm/(mol·K), F = 96,485 C, h = 6.626 × 10⁻³⁴ J·s, c = 2.998 × 10⁸ m/s, N_A = 6.022 × 10²³, Kw = 1.0 × 10⁻¹⁴(25 °C), STP = 273.15 K·1.0 atm, 22.4 L/mol. **아레니우스 식·ΔG = ΔG° + RT ln Q 의 별도 항목은 시트에 없다**(네른스트만) | CED 부록 p.226–229, [AP-exam] |
| 전달 방식 | **하이브리드**: MC 는 Bluebook, FRQ 문제는 Bluebook 에서 보지만 **답은 종이 책자에 손으로 작성**. `lib/ap-exam/frq-delivery.ts` `ap_chemistry: "paper"` 와 일치 | [AP-exam] |
| 시험 구조 변화(2027) | 구조 변화 없음(`docs/ap/2027-exam-spec-table.md` 와 일치) | spec-table |
| 내용 범위 | 9단원 · 토픽 ≈ 91개(`ap_chemistry.json`). 유기화학·아레니우스 계산·분자 오비탈은 범위 밖으로 둔다(생성 가이드 `OUT_OF_SCOPE`) — 범위 밖 판정은 CED 토픽 목록에 해당 학습 목표가 없다는 근거 | CED 단원 표, [data] |

## 2. repo 와의 대조 — 불일치·정정 목록

| # | 위치 | 내용 | 조치 |
|---|---|---|---|
| 1 | `lib/ap-exam/layouts.ts` `ap_chemistry` | 60문항·90분·4지선다·FRQ 7·105분·`allowed` — **공식과 일치**. 긴/짧은 문항 배점은 레이아웃 필드가 없음 | 변경 없음. 10/4점은 과목 가이드·FRQ 게이트(`CHEMISTRY_FRQ_PROFILE`)에 반영 |
| 2 | `docs/ap/2027-exam-spec-table.md` Chemistry 행 | 값 일치("긴 3×10점, 짧은 4×4점", "하이브리드") | 변경 없음 |
| 3 | `data/ap/curriculum-2027/ap_chemistry.json` | 단원·스킬 가중 전부 CED 와 일치(§1) | 변경 없음 |
| 4 | `lib/exam-tools/subject-tools.ts` | `ap_chemistry` 항목이 없었다(기본 Desmos). 계산기는 "공학용 또는 그래핑 권장"이며 4칙 전용은 명시되지 않음 | 공학용 계산기 + Reference 패널(`reference: "chemistry"`)로 구성 |
| 5 | `lib/ap-generation/gates.ts` 등 | `ap_chemistry` 항목 없음(Physics 와 같은 공백) | `NOT_ASSESSED_MC`(3.A–3.C)·`OPTION_COUNT`·`CHEMISTRY_FRQ_PROFILE`·`setSizeOf`·`pipeline2.ts` 과목 안내 추가(P0) |

## 3. 남은 UNVERIFIED
1. MC 공유 자료 세트의 개수·크기(우리는 2문항 세트 3종을 둔다; 공식 구성이라고 주장하지 않는다).
2. 4칙 계산기 허용 여부, Bluebook 내장 계산기 형태(Desmos 제공 여부).
3. 공식 수식 시트와 우리 Reference 패널의 1:1 일치(패널은 ALTON 자체 문구로, "ALTON study reference — not the official College Board sheet" 고지).
4. 긴/짧은 FRQ 의 문항별 시간·주제 고정 여부(우리 7유형은 자체 구성; 스킬 비중은 범위 안으로 맞춤).
5. 주기율표 원자량의 소수 자리(우리 패널은 원소 1–86 만, 3–4자리 유효숫자; 문항 정답은 일반 교재 값으로 계산하고 선택지 8% 간격 규칙으로 보호).
6. FRQ 답안을 **앱에서 어떻게 받을지**는 제품 결정(실제 시험은 종이 손글씨; 현재 구현은 타이핑·Handwrite 둘 다 허용).
