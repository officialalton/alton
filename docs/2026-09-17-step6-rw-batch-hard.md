# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 5문항 (2026-09-18 03:44)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 24분.

**요청 30개(유형당 5) → 후보 31개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 7/31 = 23% |
| 자동 보정 뒤 최종 통과율 | 26/30 = 87% |
| 보강 대기 전환율 | 0/30 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 22(20) |
| 필드 부분 수정 시도(해소) | 19(18) |
| 문항 전체 재생성(해소) | 53(23) |
| 빈 응답 이벤트 | 3 |
| 문항당 평균 모델 호출 | 16.03 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 5 | 1 | 0 | 1 | 20% | 0(0) | 1 | 1 | [contract] quant-evidence: 오답 선택지 "Route 12 had 4,800 daily riders befo<br>[contract] quant-evidence: 오답 선택지 "Route 12 had 4,800 daily riders befo<br>[contract] quant-evidence: 오답 선택지 "Route 12 had 4,800 daily riders befo | 253 |
| Text Structure and Purpose (`text_structure_purpose`) | sat_rw · mc | 5 | 6 | 3 | 5 | 100% | 0(0) | 1 | 0 | [contract] text-structure: distractor_error_types 개수(0)가 오답 개수(3)와 다릅니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[contract] text-structure: distractor_error_types 개수(0)가 오답 개수(3)와 다릅니다 | 324 |
| Rhetorical Synthesis (`rhetorical_synthesis`) | sat_rw · mc | 5 | 6 | 0 | 5 | 100% | 0(0) | 0 | 0 | [review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[contract] rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니<br>[contract] rhetorical-synthesis: distractor_error_types 개수(4)가 오답 개수(3) | 169 |
| Transitions (`transitions`) | sat_rw · mc | 5 | 6 | 0 | 5 | 100% | 0(0) | 1 | 0 | [contract] transition-relationship: 오답 선택지 "In addition,"의 relationship<br>[contract] transition-relationship: 오답 선택지 "Likewise,"는 실제로 ADDITION 관계<br>[contract] transition-relationship: 오답 선택지 "Similarly,"의 relationship_t | 278 |
| Boundaries (`boundaries`) | sat_rw · mc | 5 | 5 | 1 | 5 | 100% | 0(0) | 0 | 1 | [review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음<br>[review] 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음<br>[contract] grammar-structure: 오답 중 grammar_rule(SENTENCE_BOUNDARY)과 같은  | 295 |
| Form, Structure, and Sense (`form_structure_sense`) | sat_rw · mc | 5 | 7 | 3 | 5 | 100% | 0(0) | 0 | 0 | — | 111 |

## 70% 미달 유형

- Command of Evidence (Quantitative) (`command_of_evidence_quant`): 1/5 — 이 유형만 오답 설계 예시·오류 분류 보강 후 재검증 필요.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| text_structure_purpose | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| transitions | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 5 | 1 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |
| 3 | 2 | boundaries: 생성 청크가 요청보다 적게 반환 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to co…
- text_structure_purpose: Which choice best describes the function of the underlined s… | Which choice best states the main purpose of the text?… | Which choice best describes the function of the underlined s… | Which choice best states the main purpose of the text?… | Which choice best states the main purpose of the text?…
- rhetorical_synthesis: The student wants to contrast Portland's transportation stra… | The student wants to explain why Mosquito Bay's bioluminesce… | The student wants to explain how Ruysch's early exposure to … | The student wants to explain why widening roads often fails … | The student wants to explain how the corpse flower achieves …
- transitions: Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi…
- boundaries: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…
- form_structure_sense: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 52 | 19 |
| review | 16 | 4 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| quant-evidence: 오답 선택지 “…”의 수치가 정답과 같습니다 — 변별력이 없습니다. | 17 |
| transition-relationship: 오답 선택지 “…”는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는  | 4 |
| rhetorical-synthesis: distractor_error_types 개수(N)가 오답 개수(N)와 다릅니다. | 3 |
| transition-relationship: 오답 선택지 “…”는 실제로 CONCESSION 관계 전환어인데 distractor_relationship_types | 3 |
| grammar-structure: 오답 중 grammar_rule(SENTENCE_BOUNDARY)과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한  | 3 |
| 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다 | 3 |
| grammar-structure: distractor_error_types 개수(N)가 오답 개수(N)와 다릅니다. | 3 |
| quant-evidence: distractor_error_types에 알 수 없는 태그 “…”가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, O | 2 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 2 |
| text-structure: distractor_error_types 개수(N)가 오답 개수(N)와 다릅니다. | 2 |
| transition-relationship: 오답 선택지 “…”의 relationship_type이 정답과 같은 ADDITION입니다 — 오답은 정답과 다른 논리 | 2 |
| 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 2 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 어려움 문제인데 오답 C), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로 | 2 |
| quant-evidence: 오답 선택지 “…”에 수치가 없습니다. | 1 |
| 정답 선택지의 수치(N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| quant-evidence: distractor_error_types 개수(N)가 오답 개수(N)와 다릅니다. | 1 |
| 정답 선택지의 수치(N, N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| 지문에 배치 용어(region 등)가 있습니다. / 정답 선택지의 수치(N, N, N, N, N, N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊 | 1 |
| 어려움 문제인데 오답 B)이 지문·자료와 무관합니다 | 1 |
| 독립 검사 지적: 선택지 D는 생성기 설계에서 '메소포타미아·이집트와의 대조'라고 했으나 실제 선택지 내용은 그와 무관하게 밑줄 문장을 결론으로 규정하는 내용임  | 1 |
| rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, MISUS | 1 |
| rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, COMBI | 1 |
| 어려움 문제인데 오답 C)이 지문·자료와 무관합니다 | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Route 12 had 4,800 daily riders before the light-rail line o"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Route 12 had 4,800 daily riders before the light-rail line o"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Route 12 had 4,800 daily riders before the light-rail line o"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Tanabe Reef experienced a shorter heat event than Kapalua Re"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Bantayan Reef had both the highest temperature anomaly and t"에 수치가 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(8, 2)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Site Papale had a temperature anomaly of 1.4°C, which was hi"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: distractor_error_types 개수(2)가 오답 개수(3)와 다릅니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Site Papale had a temperature anomaly of $1.4^\circ C$, whic"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Between the 1840s and the 1850s, the average weekly wage ros"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "In the 1850s, the average weekly wage was 13.80 shillings an"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "In the 1830s, the average weekly wage was 9.20 shillings and"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Residents who lived near a station and changed jobs saw thei"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: distractor_error_types에 알 수 없는 태그 "MAX_ONLY"가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, OFF_BY_ONE_INDEX, ADJACENT_CELL).
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(34, 22, 33, 31)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "the community garden had the highest average number of flowe"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "the large green space had both the highest average number of"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "the large green space had both the highest average number of"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 해소 — quant-evidence: 오답 선택지 "In 1872, output fell to 365 thousand bolts, which was lower "의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 해소 — 지문에 배치 용어(region 등)가 있습니다. / 정답 선택지의 수치(1874, 1300, 1150, 1872, 1874, 470, 365, 1872)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "For clutches of 6 eggs, hatching success was 74 percent, hig"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: distractor_error_types에 알 수 없는 태그 "COLUMN_SUM"가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, OFF_BY_ONE_INDEX, ADJACENT_CELL).
- command_of_evidence_quant · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "The Estate group used 16,000 gallons before installation, mo"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "The Estate group's water use fell from 16,000 gallons to 11,"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- text_structure_purpose · [contract] 미해소 — text-structure: distractor_error_types 개수(0)가 오답 개수(3)와 다릅니다.
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- text_structure_purpose · [contract] 미해소 — text-structure: distractor_error_types 개수(0)가 오답 개수(3)와 다릅니다.
- text_structure_purpose · [review] 해소 — 독립 검사 지적: 선택지 D는 생성기 설계에서 '메소포타미아·이집트와의 대조'라고 했으나 실제 선택지 내용은 그와 무관하게 밑줄 문장을 결론으로 규정하는 내용임 - 설계와 실제 선택지가 불일치함
- rhetorical_synthesis · [contract] 해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, MISUSES_ONE_NOTE_ONLY, IGNORES_GOAL) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 생깁니다.
- rhetorical_synthesis · [contract] 해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, COMBINES_WRONG_NOTES, COMBINES_WRONG_NOTES) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 
- rhetorical_synthesis · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- rhetorical_synthesis · [contract] 미해소 — rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(MISUSES_ONE_NOTE_ONLY, IGNORES_GOAL, MISUSES_ONE_NOTE_ONLY) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 생깁니다.
- rhetorical_synthesis · [contract] 미해소 — rhetorical-synthesis: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- rhetorical_synthesis · [contract] 해소 — rhetorical-synthesis: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- rhetorical_synthesis · [contract] 해소 — rhetorical-synthesis: 오답 선택지 "Carrion beetles and flesh flies normally lay their eggs on c"는 ADDS_UNSUPPORTED_CLAIM으로 태그됐지만 내용이 notes에서 충분히 따라 나옵니다 — 태그가 실제 오답 
- rhetorical_synthesis · [contract] 해소 — rhetorical-synthesis: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- transitions · [contract] 미해소 — transition-relationship: 오답 선택지 "In addition,"의 relationship_type이 정답과 같은 ADDITION입니다 — 오답은 정답과 다른 논리 관계를 신호해야 논리로만 변별됩니다.
- transitions · [contract] 미해소 — transition-relationship: 오답 선택지 "Likewise,"는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는 EXAMPLE로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 미해소 — transition-relationship: 오답 선택지 "Similarly,"의 relationship_type이 정답과 같은 ADDITION입니다 — 오답은 정답과 다른 논리 관계를 신호해야 논리로만 변별됩니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Nonetheless,"는 실제로 CONCESSION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Nevertheless,"는 실제로 CONCESSION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Similarly,"는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Nevertheless,"는 실제로 CONCESSION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [review] 해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Similarly,"는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Similarly,"는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [review] 해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- boundaries · [contract] 해소 — boundaries는 grammar_rule 태그(COMMA_SPLICE, APOSTROPHE_POSSESSIVE, SUBJECT_VERB_AGREEMENT, SEMICOLON_COLON, SENTENCE_BOUNDARY) 중 하나가 있어야 boundaries/form_structure
- boundaries · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- boundaries · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- boundaries · [contract] 미해소 — grammar-structure: 오답 중 grammar_rule(SENTENCE_BOUNDARY)과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한 오답이 같은 규칙에서 갈려야 변별력이 생깁니다.
- boundaries · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- boundaries · [contract] 해소 — grammar-structure: 오답 중 grammar_rule(SENTENCE_BOUNDARY)과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한 오답이 같은 규칙에서 갈려야 변별력이 생깁니다.
- boundaries · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 C)이 너무 명백합니다
- boundaries · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다
- boundaries · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- boundaries · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다
- boundaries · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- boundaries · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다
- boundaries · [contract] 해소 — grammar-structure: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- boundaries · [contract] 미해소 — grammar-structure: 오답 중 grammar_rule(SENTENCE_BOUNDARY)과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한 오답이 같은 규칙에서 갈려야 변별력이 생깁니다.
- boundaries · [review] 미해소 — 어려움 문제인데 오답 C), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- boundaries · [review] 미해소 — 어려움 문제인데 오답 C), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- form_structure_sense · [contract] 해소 — grammar-structure: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- form_structure_sense · [contract] 해소 — grammar-structure: distractor_error_types 개수(4)가 오답 개수(3)와 다릅니다.
- form_structure_sense · [contract] 해소 — grammar-structure: 오답 중 grammar_rule(SUBORDINATION_COORDINATION)과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한 오답이 같은 규칙에서 갈려야 변별력이 생깁니다.
