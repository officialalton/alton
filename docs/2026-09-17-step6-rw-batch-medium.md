# 유형별 표본 생성·품질 계약 검증 — 난이도 medium, 유형당 5문항 (2026-09-18 03:20)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 14분.

**요청 30개(유형당 5) → 후보 28개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 11/28 = 39% |
| 자동 보정 뒤 최종 통과율 | 28/30 = 93% |
| 보강 대기 전환율 | 0/30 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 9(9) |
| 필드 부분 수정 시도(해소) | 9(9) |
| 문항 전체 재생성(해소) | 17(9) |
| 빈 응답 이벤트 | 4 |
| 문항당 평균 모델 호출 | 4.51 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 5 | 3 | 2 | 3 | 60% | 0(0) | 2 | 1 | [contract] 정답 선택지의 수치(1913, 1914, 310)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.<br>[contract] 정답 선택지의 수치(1913, 1914, 335)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.<br>[contract] 정답 선택지의 수치(8.5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 206 |
| Text Structure and Purpose (`text_structure_purpose`) | sat_rw · mc | 5 | 5 | 2 | 5 | 100% | 0(0) | 0 | 0 | [contract] text-structure: distractor_error_types에 중복된 역할이 있습니다(CLAIM, <br>[contract] text-structure: distractor_error_types에 중복된 역할이 있습니다(CONCLUS | 178 |
| Rhetorical Synthesis (`rhetorical_synthesis`) | sat_rw · mc | 5 | 5 | 0 | 5 | 100% | 0(0) | 0 | 0 | [contract] rhetorical-synthesis: 오답 선택지 "Vermeer's use of a camera obsc<br>[contract] rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니<br>[contract] rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니 | 132 |
| Transitions (`transitions`) | sat_rw · mc | 5 | 5 | 4 | 5 | 100% | 0(0) | 0 | 0 | — | 74 |
| Boundaries (`boundaries`) | sat_rw · mc | 5 | 5 | 0 | 5 | 100% | 0(0) | 0 | 0 | — | 93 |
| Form, Structure, and Sense (`form_structure_sense`) | sat_rw · mc | 5 | 5 | 3 | 5 | 100% | 0(0) | 2 | 0 | — | 160 |

## 70% 미달 유형

- Command of Evidence (Quantitative) (`command_of_evidence_quant`): 3/5 — 이 유형만 오답 설계 예시·오류 분류 보강 후 재검증 필요.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| command_of_evidence_quant | 생성 청크(2개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| form_structure_sense | 생성 청크(5개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| form_structure_sense | 생성 청크(5개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 5 | 3 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co…
- text_structure_purpose: Which choice best describes the function of the underlined s… | Which choice best states the main purpose of the text?… | Which choice best states the main purpose of the text?… | Which choice best describes the function of the underlined s… | Which choice best describes the function of the underlined s…
- rhetorical_synthesis: The student wants to describe both a technological cause and… | The student wants to explain how lanternfish use bioluminesc… | The student wants to identify the explanation that most astr… | The student wants to explain why engineers have taken an int… | The student wants to explain why economic historians conside…
- transitions: Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi…
- boundaries: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…
- form_structure_sense: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 23 | 7 |
| review | 2 | 2 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| grammar-structure: distractor_error_types 개수(N)가 오답 개수(N)와 다릅니다. | 3 |
| 정답 선택지의 수치(N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 2 |
| 정답 선택지의 수치(N.N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 2 |
| 정답 선택지의 수치(N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 2 |
| quant-evidence: 오답 선택지 “…”의 수치가 정답과 같습니다 — 변별력이 없습니다. | 2 |
| 정답 선택지의 수치(N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 2 |
| rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, MISUS | 2 |
| 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다 | 1 |
| text-structure: distractor_error_types에 중복된 역할이 있습니다(CLAIM, EVIDENCE, EVIDENCE) — 오답끼리 서로  | 1 |
| text-structure: distractor_error_types에 중복된 역할이 있습니다(CONCLUSION, EVIDENCE, EVIDENCE) — 오답끼 | 1 |
| text-structure: distractor_error_types에 중복된 역할이 있습니다(COUNTERARGUMENT, EVIDENCE, EVIDENCE)  | 1 |
| 오답 B), C)이 지문·자료와 무관합니다 | 1 |
| rhetorical-synthesis: 오답 선택지 “…”는 ADDS_UNSUPPORTED_CLAIM으로 태그됐지만 내용이 notes에서 충분히 따라 나옵니다 — | 1 |
| rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, COMBI | 1 |
| rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, IGNOR | 1 |
| rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(IGNORES_GOAL, MISUSES_ONE_NO | 1 |
| grammar-structure: 오답 중 grammar_rule(PRONOUN_AGREEMENT)과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한  | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1913, 1914, 310)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1913, 1914, 335)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(8.5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(8.5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1880, 7)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1900, 10)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [review] 해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "between 45 and 60 minutes, when moisture content fell from 2"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "between 45 and 60 minutes, when moisture content fell from 2"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(180)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(180)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- text_structure_purpose · [contract] 미해소 — text-structure: distractor_error_types에 중복된 역할이 있습니다(CLAIM, EVIDENCE, EVIDENCE) — 오답끼리 서로 다른 역할을 잘못 주장해야 합니다.
- text_structure_purpose · [contract] 미해소 — text-structure: distractor_error_types에 중복된 역할이 있습니다(CONCLUSION, EVIDENCE, EVIDENCE) — 오답끼리 서로 다른 역할을 잘못 주장해야 합니다.
- text_structure_purpose · [contract] 해소 — text-structure: distractor_error_types에 중복된 역할이 있습니다(COUNTERARGUMENT, EVIDENCE, EVIDENCE) — 오답끼리 서로 다른 역할을 잘못 주장해야 합니다.
- text_structure_purpose · [review] 해소 — 오답 B), C)이 지문·자료와 무관합니다
- rhetorical_synthesis · [contract] 미해소 — rhetorical-synthesis: 오답 선택지 "Vermeer's use of a camera obscura suggests why his paintings"는 ADDS_UNSUPPORTED_CLAIM으로 태그됐지만 내용이 notes에서 충분히 따라 나옵니다 — 태그가 실제 오답 
- rhetorical_synthesis · [contract] 미해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, MISUSES_ONE_NOTE_ONLY, IGNORES_GOAL) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 생깁니다.
- rhetorical_synthesis · [contract] 미해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, COMBINES_WRONG_NOTES, COMBINES_WRONG_NOTES) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 
- rhetorical_synthesis · [contract] 미해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, MISUSES_ONE_NOTE_ONLY, IGNORES_GOAL) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 생깁니다.
- rhetorical_synthesis · [contract] 해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, IGNORES_GOAL, MISUSES_ONE_NOTE_ONLY) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 생깁니다.
- rhetorical_synthesis · [contract] 해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(IGNORES_GOAL, MISUSES_ONE_NOTE_ONLY, MISUSES_ONE_NOTE_ONLY) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 생깁니다.
- boundaries · [contract] 해소 — grammar-structure: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- boundaries · [contract] 해소 — grammar-structure: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- boundaries · [contract] 해소 — grammar-structure: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- form_structure_sense · [contract] 해소 — grammar-structure: 오답 중 grammar_rule(PRONOUN_AGREEMENT)과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한 오답이 같은 규칙에서 갈려야 변별력이 생깁니다.
