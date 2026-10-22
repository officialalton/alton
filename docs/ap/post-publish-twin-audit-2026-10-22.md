# 공개 뒤 구조 쌍둥이 재점검 (2026-10-22, 운영 에이전트)

배경: 오늘 CH4·CS4·PS3·PS4를 공개할 때 구조 규칙 점검에 숫자·기호를 가린 토큰 겹침(Jaccard)을 주로 썼다. 이 방법은 단위·표기가 다른 숫자만 바꾼 변형을 놓친다. CH5·CS5·PS5를 다시 점검하면서 문장 순서 유사도(difflib, 숫자·LaTeX 가림)를 추가해 이미 공개한 세트를 다시 비교했다. 아래는 **내용을 읽고 같은 구조로 본 쌍**이다(오너 규칙: 자료·조건·질문·필요 추론 단계 중 하나라도 실질적으로 다르면 독립 — 숫자·이름·표현만 다르면 쌍둥이). 공개 세트 변경은 하지 않았다.

## AP Chemistry — Practice Exam 4(`856cfaad-6c1a-468e-9b16-c6c097a680a0`)가 앞선 공개 세트와 같은 구조인 것으로 읽은 항목
| CH4 후보 | 앞선 공개 세트 | 근거 |
|---|---|---|
| `chem-t5-mc2:m12-k2` ΔG°=ΔH−TΔS, 600 K | Exam 3 ΔG°, 300 °C | 같은 계산·같은 단계(단위 변환 유무와 숫자만 다름) |
| `chem-t5-mc2:m08-k0` 광자 에너지(1064 nm) | Exam 2 광자 에너지(1500 nm) | 숫자만 다름 |
| `chem-t5-mc:m29-k1` 원액 희석 부피 | Exam 3 희석 | 같은 M1V1=M2V2, 숫자만 다름 |
| `chem-t5-bank:m04-k2` 펜테인·네오펜테인 끓는점 설명 | Exam 3 같은 화합물 쌍 | 같은 자료·같은 질문 |
| `chem-t5-mc2:m19-k0` 갈바니 전지 기전력(Q) | Exam 1 갈바니 전지(Nernst) | 같은 식·같은 단계, 숫자만 다름 |
| `chem-t5-mc2:m10-k1` 완충용액+NaOH | Exam 3 완충용액+강산 | 같은 HH 계산·산/염기 방향만 반대(경계) |
경계로 독립 처리: `chem-s2-m-c:m03-k0`(부피 반감) ↔ Exam 2(B 제거) — 교란 조건이 다름.

## AP Psychology 3·4 (`64b267bd-…`, `3dcf297e-…`)
| 후보 | 비교 대상 | 근거 |
|---|---|---|
| PS3 `psych-t5-mc:m29-k0` | PS4 `psych-p1-a:m23-k1` | 같은 시나리오(치료자가 판단 없이 경청·감정 반영·수용 → 인간중심 치료), 문장만 다름. **PS3와 PS4가 서로 쌍둥이를 포함** |
| PS4 `psych-t5-mc:m08-k0` 일상 스트레스↔감기(상관) | Exam 1 생활 사건↔질병(상관 결론) | 같은 상관 해석 구조(경계) |

## AP Computer Science A — Practice Exam 4(`b25f8cae-…`)와 Practice Exam 5(`7c42225c-50ee-43d0-9657-18dafbd9c48d`)
**정정**: 앞서 쓴 코드 점검은 단계 오류가 있었다(코드를 JSON 문자열로 넣어 `\n` 이스케이프가 토큰을 오염시켜 코드 유사도가 실제보다 크게 낮게 나왔다). 코드 원문(`stimulus.description`)으로 다시 비교한 결과:
- **CS5가 CS4와 같은 구조**(숫자·상수만 다른 "What is printed…" 코드 문항, 코드 토큰 유사도 1.0): `csa-s2-mc-a:m03-k1`(char 산술), `csa-s2-mc-a:m14-k1`(String ==/equals), `csa-x-a:m01-k0`(음수 %·/), `csa-x-a:m02-k2`(복합 대입 축소 캐스팅), `csa-x-a:m13-k1`(i%3 합), `csa-s2-mc-c:m05-k1`(ArrayList 출력), `csa-x-a:m24-k0`(향상된 for 복사 함정) — **7개 이상**.
- **CS4가 Exam 3과 같은 구조**(0.78–0.93): `csa-x-a:m13-k0`(i%3 합), `m31-k2`(삽입 정렬 추적), `m24-k1`(향상된 for 복사 함정), `m01-k2`(음수 %·/), `m15-k1`(자릿수 뒤집기), `m38-k0`(Probe.mystery 문자열, Exam 2와 0.85), `csa-t5-mc6:m01-k1`, `m02-k1`(복합 대입) — **6개 이상**.
- 원인: `csa-x-a`/`csa-s2-*` 변형 계열(k0/k1/k2)이 CS3(Exam 3)·CS4·CS5에 나뉘어 쓰였다. 배정기의 군집(fam) 판정과 복구 목록이 이 숫자 변형을 같은 구조로 보지 못했다.
- CS5는 공개 25분 뒤 이 점검으로 발견했다. 공개 세트의 실제 학생 응시는 CH4·CS4·CS5·PS3·PS4·PS5 모두 0건이다(테스트 계정 응시만).

## 권고(오너 결정 대기)
1. CH4: 위 6개를 독립 문항으로 교체한 새 버전 초안을 만든 뒤 공개(교체 후보 재고가 필요) 또는 교체 전까지 보관.
2. PS3·PS4: 쌍둥이 쌍 중 한쪽을 교체(심리 독립 재고로).
3. 앞으로 구조 점검에는 숫자·LaTeX를 가린 문장 순서 유사도를 기본으로 쓰고, 상위 쌍은 반드시 읽는다.

## 조치 현황과 교체 대상 정확한 목록 (코디네이터 결정, 2026-10-22 08:12Z)
- **CS A Practice Exam 5(`7c42225c-50ee-43d0-9657-18dafbd9c48d`)는 보관 처리**(status archived, archived_at 2026-10-22 08:12:39Z; 문항·이력은 남아 있고 되돌릴 수 있다). 실제 학생 응시 0건.
- CS4·CH4·PS3·PS4·PS5는 공개 유지. 아래 쌍둥이 문항은 대체 재고가 생기면 "새 버전 초안 만들기"(`createMockExamNewVersionAction`)로 교체한다.

### CS4(`b25f8cae-c334-496d-a1e9-7971d1c369e3`) 교체 대상 — 비교 대상 공개 세트
- `csa-x-a:ap_computer_science_a-m13-k0` ↔ Exam 3 (i%3 조건 합)
- `csa-x-a:ap_computer_science_a-m31-k2` ↔ Exam 3 (삽입 정렬 추적)
- `csa-x-a:ap_computer_science_a-m24-k1` ↔ Exam 3 (향상된 for 복사 함정)
- `csa-x-a:ap_computer_science_a-m01-k2` ↔ Exam 3 (음수 %·/)
- `csa-x-a:ap_computer_science_a-m15-k1` ↔ Exam 3 (자릿수 뒤집기)
- `csa-x-a:ap_computer_science_a-m02-k1` ↔ Exam 3 (복합 대입 축소 캐스팅)
- `csa-t5-mc6:ap_computer_science_a-m01-k1` ↔ Exam 3 (이중 반복문 쌍 개수, 0.79)
- `csa-x-a:ap_computer_science_a-m38-k0`(문항 2개 세트) ↔ Exam 2 (Probe.mystery 문자열)
- 경계(독립 처리, 확인 필요): `csa-s2-mc-c:ap_computer_science_a-m05-k0` ↔ Exam 2 (ArrayList 출력, 0.77), `csa-t5-mc:ap_computer_science_a-m13-k0` shiftRight ↔ Exam 1 swapEnds(다른 메서드)
### CH4(`856cfaad-6c1a-468e-9b16-c6c097a680a0`) 교체 대상
- `chem-t5-mc2:ap_chemistry-m12-k2` ↔ Exam 3 (ΔG° 온도 계산)
- `chem-t5-mc2:ap_chemistry-m08-k0` ↔ Exam 2 (광자 에너지)
- `chem-t5-mc:ap_chemistry-m29-k1` ↔ Exam 3 (희석)
- `chem-t5-bank:ap_chemistry-m04-k2` ↔ Exam 3 (펜테인·네오펜테인)
- `chem-t5-mc2:ap_chemistry-m19-k0` ↔ Exam 1 (갈바니 전지 Nernst)
- 경계: `chem-t5-mc2:ap_chemistry-m10-k1` ↔ Exam 3 (완충용액 산/염기 방향 반대), `chem-s2-m-c:ap_chemistry-m03-k0` ↔ Exam 2 (교란 조건 다름, 독립 처리)
### PS3(`64b267bd-e854-4b2b-ab63-6cf7b28af2b8`) / PS4(`3dcf297e-24de-4f8f-8a9a-d16c37e1610b`) 교체 대상
- 쌍둥이 쌍(둘 중 하나 교체): PS3 `psych-t5-mc:ap_psychology-m29-k0` ↔ PS4 `psych-p1-a:ap_psychology-m23-k1` (인간중심 치료 시나리오). PS4 쪽을 교체하는 것을 권고.
- 경계: PS4 `psych-t5-mc:ap_psychology-m08-k0` ↔ Exam 1 (상관 해석).
### PS5(`a2e38fff-c4c3-4bf7-95e6-0f655c5579a3`)
- 공개 전 문장 순서 유사도 점검(공개 세트 Exam 1–4 전부 대상)에서 최고 0.55, 읽고 쌍둥이 없음으로 판정. 교체 대상 없음.
