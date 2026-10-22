# 운영 작업 체크포인트 — PS5·CH4·CH5·CS4 적재 (2026-10-22, 주간 사용량 약 82%에서 중단)

## 끝낸 것
- 브랜치 `ap-topup-5sets-sci3`(c6d70b8be)를 통합본에 병합(`a861acb8c`). 원장 합집합: base 580.7027 + 통합본 신규 129건 20.5065 + sci3 신규 72건 15.6766(공유 항목 0) = ledger.spent 616.885833 → **누적 $556.9358**(중단선 690 기준 여유 $133.0642, 진행 중 예약 0). `ledger-total.ts`로 `ledger-summary.json` 갱신.
- Psychology PS5용 `psych-t5-sets3` 배치 등록(`lib/ap-admin/batches.ts`), 렌더 보고서 재생성(기존 해시 변경 0, 새 행 추가), 화면 증거 6항목(3문항 × 2뷰포트, 실패 0, `data/ap/screen-evidence/evidence-psych-t5.json`, 스크린샷 `docs/ap/screen-evidence/psych-t5/`). 격리 스택 `ALTON_apps5`(PORT_OFFSET 7300) 사용 후 정지·config 원복·시드 정리 완료.
- review 주소는 이전에 수동으로 오래된 빌드(3hbihvn4m)에 붙어 있었다 → 최신 review 브랜치 빌드(`alton-hseankuri`)로 다시 연결.
- 관리자 화면(review 호스트)에서 `psych-t5-sets3` ①–④ 실행 완료(적재 3, 렌더 기록 1, 화면 기록 1, 변환 1). 공유 DB에 적재만 했고 공개 세트·응시·답안은 건드리지 않았다.

## PS5: 공개하지 않음 — 구조 규칙 위반(쌍둥이)
- 통과한 새 세트는 `pss_t5c_u5_light_therapy`(키 `psych-t5-sets3:ap_psychology-m03-k0`) 하나.
- 공개 Exam 4의 문항과 구조가 같다: Exam 4 "200 adults with depression … new antidepressant or identical-looking inactive pill … If the inactive-pill group's decrease reflects improvement that occurs without the active drug, about how much of the antidepressant group's mean decrease is attributable to the drug beyond that improvement?" vs 새 세트 q1 "…dim inactive lamp … about how much of the bright-light group's mean decrease is attributable to the treatment beyond that improvement?". 자료(무작위·이중맹검, 평균 감소 + 부작용 인원 표), 조건(대조군 개선 보정), 질문(대조군 감소를 빼서 치료 기여분), 추론 단계(treatment − control)가 같고 맥락(약→램프, 오심→두통)과 숫자만 다르다 → 쌍둥이, 독립 아님.
- 결론: PS5의 공유 세트 1개(3문항)는 여전히 부족. 이 세트의 나머지 2문항은 비교하지 않았다. 적재된 세트는 변환·미배정 재고로 남는다.

## 하지 못한 것(재개 절차)
1. **Chemistry CH4·CH5**: `chem-t5-*` 배치 13개(bank, bank2, frq~frq5, mc~mc3, sets, sets2)가 `lib/ap-admin/batches.ts`에 등록돼 있지 않다 → 등록 → 렌더 보고서 재생성 → 화면 증거(격리 스택, `chem-evidence-keys.ts`로 대상 키 선별) → 관리자 ①–④ → 초안 → 구조 규칙(FRQ·세트는 시나리오 id가 아니라 내용으로 판정) → 공개.
2. **CS A CS4**: `csa-t5-*` 배치도 미등록. CS5는 3칸 부족이라 공개하지 않는다.
3. 관리자 브라우저 탭은 `tab-7`(review 호스트), 헬퍼는 `[data-testid=ap-stock-panel]` 안의 "배치 전체 적재" 체크박스(`aria-label="<배치 제목> 선택"`) → 미리보기 → "미리보기 결과를 확인했습니다" → "선택한 배치 전체 적재 실행".
4. 정리 대상 테스트 응시는 이번 작업에서 새로 만들지 않았다.

## 미반영 비용: 없음(이번 작업 유료 호출 0).

## 추가 기록 — 결함 후보 제외 (2026-10-22, 화면 증거 단계에서 발견)
- 화면 점검에서 `stimulus_no_raw_tex`(`$...\text{ %}$`의 `%`가 LaTeX 주석이 되어 원문 수식이 학생 화면에 보임) 실패 3건: `chem-ch3-mc:ap_chemistry-m63-k2`, `chem-t5-mc:ap_chemistry-m20-k0`, `chem-t5-mc2:ap_chemistry-m18-k2`. 이 후보는 관리자 ③에서 "허용되지 않는 건너뜀"이라 배치 전체 적재를 중단시키므로 `chem-t5-mc`·`chem-t5-mc2`의 pass-keys에서 뺐다(내용 수정은 하지 않았다 — 고치려면 `\%`로 바꾼 새 해시와 증거 재생성이 필요).
- 변환 시 표준 렌더링 검증 실패(지문이 그림을 가리키는데 그림 없음) 3건: `chem-ch3-mc:ap_chemistry-m51-k0`, `chem-t5-bank:ap_chemistry-m33-k1`, `chem-t5-bank2:ap_chemistry-m07-k0`. 증거가 없어 건너뜀으로 처리된다.
- 위 6건과 오너 판단 보류 2건(`chem-s2-f3:f01-k2`, `chem-ch3-mc:m13-k0`), 내용 대조로 확인한 쌍둥이 2건(`chem-t5-bank:m46-k0`는 공개 Exam 3의 에탄올 입자 그림 문항과 같은 문항, `chem-s2-m-b:m22-k0`는 공개 Exam 1·2의 탄산·질산 이온 결합 길이 평가 문항과 같은 틀)은 `data/ap/stock/blocked-chem-defects-20261022.json`로 CH4·CH5 배정에서 제외했다(`chem-structure-block.ts --extra-block`).
