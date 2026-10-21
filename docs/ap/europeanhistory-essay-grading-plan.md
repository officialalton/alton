# AP European History 에세이 AI 채점 — 준비·보정 계획 (2026-10-20)

> **2026-10-21 최신 지시·상태(아래 원계획보다 우선):** 교사 채점·섭외·사람 비용은 제외하고 AI만으로 개선한다. 공식 샘플 사용 허락은 자체 샘플 기능 검증의 선행 관문이 아니며 문의는 초안만, 발송 안 함. 아래 §3~8의 공식 샘플 실행·선택지 승인 대기는 이전 계획이다.
>
> [자체 검증 결과](europeanhistory-essay-selfcheck-2026-10-21.md): $3.70, 사전 기준 미달, EURO_ESSAY_GRADING_VALIDATED=false 유지. 기준 점수가 작성 에이전트와 독립적이지 않아 공식/실제 학생 정확도를 입증하지 못한다. 기존 평가 표본은 이제 회귀용이고 수정 후 새 미사용 표본이 필요하다.
>
> 다음: 독립 AI 판정·근거 비교·이견만 추가 재판정, LEQ 요소별 판단 개선, 일괄 +1 보정 금지. 기존 총상한 $12 안에서 **추가 $2 이내 한 차례** 수정 후 검증 지시가 있으며 완료 증거는 이번에 확인되지 않았다. 모든 재요청·수선·진행 중 호출 포함, 미달이면 자동 반복 금지. 교사 승인·공식 샘플 허락을 운영 활성화 필수 조건으로 새로 추가하지 않지만, 자체 검증 미달 상태를 안내 문구만으로 공개하지도 않는다. 활성화는 결과 보고 후 별도 판단, AP1~5와 별개다.
>
> 루브릭을 ALTON 말로 바꾸는 것만으로 권리 문제가 해결됐다고 단정하지 않는다. 공식 자료를 복제·모델 입력하지 않는 자체 검증과 문서 이용 판단을 분리한다. 전반 상태는 [CURRENT](../CURRENT.md).

상태: **코드 준비 완료, 꺼짐.** 유료 호출은 하지 않았다. 켜기 전 보정(§3–5)과 오너 승인(§7)이 필요하다. 오너 확정 정책(2026-10-14): AI 채점은 "참고용 추정치(공식 점수 아님)"로만 제공.

## 1. 공식 루브릭 확인 결과
확인한 것(2025 Scoring Guidelines Set 1 PDF 직접 열람, 2026-10-20):
- SAQ 각 **3점**(A·B·C 1점씩). DBQ **7점**: Row A 0–1(논지) · Row B 0–1(맥락화) · Row C 0–2(문서 활용) + 0–1(문서 밖 증거) · Row D 0–1(출처 분석) + 0–1(복합성). LEQ **6점**: A 0–1 · B 0–1 · C 0–2(증거) · D 0–2(분석·추론).
- 시험 비중(AP Central 시험 페이지): SAQ 20% · DBQ 25% · LEQ 15%.
- 2027년 5월 시험 개편(AP Central "AP History Exam Updates"): SAQ 3개 모두 필수·자료 포함, LEQ 필수 1문항, DBQ 연대 확대. 채점 기준·과목 내용은 불변이라 안내됨.

**확인 못 한 것**: (a) 2027 개편 형식의 공식 Scoring Guidelines는 아직 공개되지 않았다(가장 최근은 2026 SG: `ap26-sg-european-history.pdf` — 이번에 내용을 열어 보지 않았다). 보정 착수 전 2026 SG에서 행·점수가 2025와 같은지 재확인해야 한다. (b) 개편 SAQ가 "3문항 × 3점 = 9점"인지 문항당 3점 외 가중이 있는지 공식 문서로 못 확인(현재 코드는 문항당 3점, 합산 없음). (c) 개편 LEQ 6점 유지 여부(안내는 "채점 기준 불변"이라고만 함).

## 2. 구현(꺼짐)
| 항목 | 위치 |
|---|---|
| 루브릭 `euro-v1`(SAQ a·b·c / DBQ 6행 7점 / LEQ 4행 6점, 과목명·유럽사 규칙, 응시당 상한 기본 5건 = SAQ3+DBQ+LEQ, 환경변수 `AI_ESSAY_PER_ATTEMPT_CAP_EURO`) | `lib/essay-grading/rubric.ts` |
| 과목 게이트 `EURO_ESSAY_GRADING_VALIDATED = false` — `essayGradingSubject("ap_european_history")` 는 false. 켜려면 이 상수 + 기존 플래그 `AI_ESSAY_GRADING_ENABLED` 둘 다 필요 | `lib/essay-grading/subject.ts` |
| 유럽사 FRQ payload(`whap_frq` 형식)를 `euro-v1` 로 채점하도록 매핑 | `lib/essay-grading/actions.ts` |
| 학생 결과 화면: 서술형이 있는 European History 응시에 "AI essay scoring is not available for this subject yet. Your written responses are not scored; use the reference answers and scoring guides below to review them." 상태 표시(`data-testid="essay-scoring-unavailable"`). 수학·과학 FRQ 과목엔 표시하지 않음 | `ApExamResultView.tsx`, `subject.ts` |
| 저장 점수 조회 목록에 `euro-v1` 추가, 묶음 SAQ 자동 시작 판정에 whap·euro 포함(기존엔 US만 포함되어 있었음) | `view.ts`, `ApExamResultView.tsx` |
| 단위 테스트 | `lib/essay-grading/euro.test.ts` |

프롬프트는 기존 History 시스템 프롬프트 골격(학생 글은 데이터, 주입 무시, 보수적 채점, 앵커 샘플 보정)을 그대로 쓰고 과목명과 "1450–현재 유럽사" 규칙 한 줄을 더했다. 루브릭 문구는 ALTON 자체 표현(공식 문구 복제 아님).

## 3. 보정에 쓸 공식 채점 예시 (내부 채점 비교 전용)
출처: AP Central 과거 시험 문항 페이지 `https://apcentral.collegeboard.org/courses/ap-european-history/exam/past-exam-questions` (2026-10-20 확인). 각 문항마다 High/Mid/Low 3개 샘플 + 점수 + 해설이 공개되어 있다.

| 연도·세트 | Scoring Guidelines | Sample Responses (DBQ · LEQ2–4 · SAQ1–4) |
|---|---|---|
| 2025 Set 1 | `ap25-sg-european-history-set-1.pdf` | `ap25-apc-european-history-{dbq,leq2,leq3,leq4,saq1..saq4}-set-1.pdf` |
| 2025 Set 2 | `ap25-sg-european-history-set-2.pdf` | 동일 패턴 `-set-2` |
| 2024 Set 1·2 | `ap24-sg-european-history-set-{1,2}.pdf` | `ap24-apc-…-set-{1,2}.pdf` |
| (예비) 2023 Set 1·2 | `ap23-sg-…` | `ap23-apc-…` |
(모두 `https://apcentral.collegeboard.org/media/pdf/` 아래. 2026 SG·FRQ는 샘플 응답 미공개.)

**저작권 이용 방식**: College Board 저작물이므로 저장소에 PDF·샘플 전문을 커밋하지 않는다. 로컬(비공개 작업 폴더, gitignore)에서 내려받아 보정 실행 중에만 모델 입력으로 사용하고, 결과 파일에는 문항 ID·샘플 번호·공식 점수·AI 점수만 남긴다(샘플 본문·공식 SG 문구 미저장·미인용). 학생 화면·프롬프트 앵커에 공식 샘플을 쓰지 않는다(앵커는 기존대로 ALTON 자체 생성 샘플). 문서·보고서의 직접 인용은 하지 않는다. 사용 목적은 내부 품질 비교뿐이며, 이 이용 방식이 College Board 이용 약관상 허용되는지는 오너/법무 확인 대상(§7).

한계: 2027 개편 형식(자료 포함 SAQ 3개 전부, 신규 LEQ 소개문, 확대 DBQ 연대)의 공식 샘플은 존재하지 않는다. 과거(2023–2025) 샘플의 행·점수는 같은 구조이므로 채점 기준 보정에는 유효하나, 개편 형식 자체의 일치율은 검증하지 못한다 — 개편 형식 샘플은 2027 시험 이후 공개되면 재보정.

## 4. 보정 문항 수·호출 수·비용 상한
현재 호출 단가: `lib/essay-grading/costs.ts` 기본 입력 $3 / 출력 $15 per M 토큰(가정값). 실측: World History 보정 62호출 $1.85 → 호출당 약 $0.030. 채점은 에세이당 2회 호출(낮은 쪽 채택).

계산식: 비용 = Σ(문항수 × 샘플당 호출 2 × 호출당 단가). 호출당 단가 추정: DBQ(문서 7개) $0.06 · LEQ $0.03 · SAQ $0.02.

권장 보정 세트(샘플 72건 = 문항 24 × 3샘플):
| 유형 | 문항(출처) | 샘플 | 호출 | 단가 | 소계 |
|---|---|---|---|---|---|
| DBQ | 4 (2024·2025 Set1·2) | 12 | 24 | $0.06 | $1.44 |
| LEQ | 8 | 24 | 48 | $0.03 | $1.44 |
| SAQ | 12 | 36 | 72 | $0.02 | $1.44 |
| 합계 | 24 | 72 | 144 | | **$4.32** |
+ 주입 방어 점검(mid·low 샘플 각 1문항 × 유형 3) 약 $0.3, 불합격 시 프롬프트 수정 후 재실행 1회(전체의 약 절반~전체) $2–4.5 → 예상 총 **약 $7–9**.

**권장 상한: 하드 $12(중단선), 목표 $9.** 정지 로직은 `scripts/essay-calibration.ts` 의 `CALIB_CAP`(기본 $1.0)를 상한으로 쓴다. 호출 수 상한 약 300. 신규 세트 생성 예산 장부(상한 $650 / 중단선 $640)와 별개로 장부에 기록한다. **이번 작업에서는 실행하지 않았다.**

## 5. 합격 기준 (공식 점수 vs AI 점수, 샘플 단위 total 비교)
- 정확 일치율 ≥ 60%, ±1점 이내 ≥ 90%(DBQ는 ±1 이내 ≥ 85%).
- 평균 부호 오차(AI − 공식) 절대값 ≤ 0.5 (WH 보정 기준: MAE 0.167). 보수 편향은 허용, 과대 채점 편향 불허.
- 각 문항 High > Mid > Low 서열 보존 100%.
- 행 단위(thesis/context/evidence…) 일치율 ≥ 80%, 어느 행도 한 방향 편향 ≥ +0.3 불가.
- 프롬프트 주입 시 점수 부풀림 0건. `invalid_output`/`bad_rationale_context` 재시도 대상 비율 ≤ 5%.
- 기준 미달 시: 프롬프트·행 안내 수정 → 1회 재보정(상한 내). 재미달이면 비활성 유지.

## 6. 켜기 전 체크리스트
1. 2026 SG(및 가능하면 2027 CED 개정본)에서 행·점수 재확인, 확인 불가 항목(§1) 해소 또는 오너 수용.
2. 보정 실행 승인(§7) → §4 실행 → §5 통과 → 결과 `data/ap/essay-calibration-result-euro.json`(점수만) + 본 문서 갱신.
3. 유럽사 stock FRQ 앵커 샘플 3개 확보 확인(앵커 3개 미만 문항은 코드가 자동 스킵).
4. `AI_ESSAY_PER_ATTEMPT_CAP_EURO`(기본 5), 일 한도·월 $25 예산이 유럽사 추가분을 감안하는지 확인.
5. Preview에서 플래그 ON 상태 테스트 계정으로 SAQ·DBQ·LEQ 각 1회 채점·학생/보호자 화면 확인 후 `EURO_ESSAY_GRADING_VALIDATED` 를 true 로 변경(별도 커밋), 안내 문구 `essay-scoring-unavailable` 가 사라지는지 확인.
6. 개인정보 처리방침의 AI 채점 절(2026-10-15 승인)에 European History 포함됨을 확인(과목 한정 문구 없음 가정 — 확인 필요).
7. 프로덕션 반영은 별도 승인.

## 7. 켜기 전 필요한 오너 결정
- 보정 실행 승인과 비용 상한(권장 하드 $12 / 목표 $9).
- 공식 College Board 샘플 응답을 내부 비교용으로 사용하는 것의 이용 약관 허용 여부(저장소 미커밋·전문 미저장 방식으로 제안).
- 2027 개편 형식의 공식 샘플이 없다는 점을 수용하고 과거 샘플로 보정할지(권장: 수용, 개편 후 재보정).

## 8. 약관 검토 결과와 보정 중단 (2026-10-21)
직접 열람(2026-10-21): College Board Privacy Center
- Legal Terms for Students `https://privacy.collegeboard.org/student-legal-terms` — §8 "College Board Intellectual Property": 콘텐츠는 College Board 및 라이선서 소유·저작권 보호, "may not be distributed, downloaded, uploaded, reproduced, reposted"를 포함해 서면 허락 없이 어떤 방식으로도 사용 불가, "scrape or data-mine" 금지. §10 "non-commercial use only": 서비스를 "to make money or as part of any test prep or other business"에 쓸 수 없음.
- Legal Terms for Educators and Institutions `https://privacy.collegeboard.org/educator-legal-terms` — §6 동일한 복제·재사용 금지와 서면 허락 요건, §4 "any commercial purpose" 금지.
- 허락 경로: Copyright and Trademark Permission Request `https://privacy.collegeboard.org/copyright-trademark/request-instructions`. (AP Central 자체 약관 URL은 404였고, 비상업 교실 인쇄 배포 예외만 별도 안내되어 있음.)

판단: Alton은 영리 SAT/AP 사교육 사업이며, 샘플 응답을 내려받아 모델에 입력하는 것은 "downloaded/reused ... without express written permission" 및 "test prep business" 금지 문언에 문면상 해당한다. 공개 PDF가 위 약관의 "Services"에 속하는지, 내부 평가가 공정이용인지는 법률 판단이 필요하지만, 문면상 금지이므로 **보정을 실행하지 않았다(유료 호출 0건, 비용 $0).** 켜기 상수 `EURO_ESSAY_GRADING_VALIDATED`는 false 유지.
다음 선택지(오너): (a) 위 허락 양식으로 College Board에 서면 허락 신청, (b) 법무 확인으로 공정이용·비서비스 자료 판단 확보, (c) 공식 샘플 없이 ALTON 자체 생성 샘플(기존 앵커 방식)로 보정. 어느 쪽이든 승인 후 §4 계획을 그대로 실행 가능.

### 8.1 대안 비교 (오너 정정 반영: 허용 근거 조항 없음 → 공식 샘플 사용 보류, 호출 0건)
허용 근거 조항은 찾지 못했다(공개 열람 가능은 재사용 허용 근거가 아님). 총상한 $12(재요청 포함), 운영 AI 채점 활성화 금지, 켜는 커밋은 준비만.
| 대안 | 비용 | 한계 |
|---|---|---|
| A. College Board 서면 허락 신청 후 §4 그대로 | 호출 약 $4.3–9(+허락 대기, 기간 불확실) | 거절·무응답 가능, 조건(저장·범위)이 붙을 수 있음. 허락 전 호출 금지 |
| B. 자체 작성 합성 샘플(High/Mid/Low) | 생성 약 $1–2 + 채점 약 $4.3 = 약 $6–7 | 정답 점수가 우리가 부여한 것이라 실제 채점관 기준과의 일치를 증명하지 못함(순환 위험). 서열·주입·편향 점검에는 유효. 공식 점수 일치율 합격 기준은 적용 불가 |
| C. 공식 SG의 점수 설명만 사용(샘플 응답 미사용) | 약 $0 | SG 문구도 저작물이라 인용·저장 범위 확인 필요. 루브릭 문구 정합성 점검뿐, 채점 정확도 보정은 아님 |
| D. 위 B+C 병행 + 허락 회신 후 A | $6–7 + 허락 시 추가(합계 $12 이내) | 가장 신중하나 일정 길어짐 |
권장: D(B로 서열·주입·편향 먼저 점검, 정확도 보증은 허락 확보 후).

### 8.2 허락 문의 초안 (College Board Copyright and Trademark Permission Request) — 2026-10-21 보완, **발송 금지(오너 승인 전)**
일반 교육 목적 허락이 아니라 아래 여섯 항목을 모두 명시해 요청한다.
| 항목 | 초안에 명시할 내용 |
|---|---|
| 대상 자료 | AP European History 의 공개 Sample Student Responses 와 해당 공식 점수(2023–2025, 최대 약 72건), 필요 시 공식 Scoring Guidelines 의 점수 설명. 자료별 URL·연도·세트를 표로 첨부. |
| 이용 목적 | 영리 사업체(Alton Education LLC, 유료 SAT/AP 비대면 수업)가 자사 AI 연습 채점 기능의 정확도를 **내부 평가**하는 용도. 시험 대비 상품의 품질 관리 목적임을 숨기지 않는다. |
| 외부 AI 제공자 전송 | **전송한다.** 자료 본문이 평가 호출 때 외부 AI 서비스 제공자(Anthropic API)로 전송된다. 제공자 이름, 전송 시점(평가 실행 중 한정), 제공자의 보관·학습 정책(상용 API 약관 기준 확인 후 기재)을 적는다. 전송을 원치 않으면 허락 범위에서 제외하라는 회신도 요청. |
| 저장·보관 | 저장소(git)·학생 화면·로그에 본문을 남기지 않는다. 평가 중에만 접근 제한된 비공개 작업 폴더에 두고 평가 종료 후 삭제. 영구 보관은 문항 ID·샘플 번호·공식 점수·AI 점수·집계 통계뿐. 삭제 시점과 확인 방식을 적는다. |
| 학생 화면 공개 여부 | 공개하지 않는다. 학생·학부모·교사 화면, 프롬프트 앵커, 마케팅 자료에 표시·인용하지 않는다(채점 결과는 AI 추정치이며 College Board 자료 본문을 포함하지 않는다). |
| 모델 학습 사용 여부 | 모델 학습·미세조정·평가 데이터셋 외부 배포에 사용하지 않는다. 제공자가 이 자료를 학습에 쓰지 않는 계약 조건인지 확인해 기재(확인 전에는 "확인 중"으로 표기하고 오너가 판단). |
추가로 물을 것: (1) 상업적 교육 서비스 대상 별도 라이선스 경로가 있는지, (2) 허락 조건(기간·범위·보고)이 있는지, (3) 학생 약관의 "test prep or other business" 비영리 조항과 이 허락의 관계.
영문 본문 초안:
"Alton Education LLC is a for-profit online SAT/AP tutoring company. We request written permission to use the following publicly posted College Board materials: AP European History sample student responses and their official scores for 2023-2025 (up to about 72 responses; list attached by URL). The use is limited to internal evaluation of our own automated practice-essay scoring feature, which tells students its results are estimates and not official AP scores. To run that evaluation, the response text would be transmitted to a third-party AI service provider (Anthropic, via its commercial API) for the duration of each evaluation run; we will confirm and state the provider's retention and no-training terms before any use. We would not commit the text to any code repository, show it to students, parents, or teachers, use it as an example or anchor in prompts, publish it, or use it to train or fine-tune any model. The text would be kept only in access-restricted storage during the evaluation and deleted afterward; we would retain only response identifiers, official scores, our scores, and aggregate statistics. Please tell us whether this use is permitted, whether a separate commercial license applies, and any conditions."
참고: 이 허락과 무관하게 2026-10-21 자체 샘플 검증(`docs/ap/europeanhistory-essay-selfcheck-2026-10-21.md`)은 공식 자료 없이 수행했고(호출 비용 $3.70), 결과는 사전 등록 기준 미달(과소 채점 중심)이다. 안전 방향 항목은 양호. 켜기 상수는 false 유지.
