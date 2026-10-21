# Macro/Micro 5세트 — 오너 규칙 대조 구조 점검과 MA4 적재 상태 (2026-10-21, 기준 약 23:55 UTC)

## 원장 통합(중복 합산 없음)
- 두 브랜치의 `data/ap/sample-2027/ledger.json` 신규 항목은 겹치지 않는다(econ-ab 25건 $2.693, macmic 46건 $11.9026). 통합 원장 합계 586.7250 → 누적 **$526.775**(= 586.725 − 61.21 + 1.26), 중단선 $690 까지 $163.225 (`ledger-summary.json` 갱신, 이 점검 이후 유료 호출 없음, 진행 중 예약 $0).

## macmic 브랜치(442de1eed) 오너 규칙 대조 — 무료, 구조 판정만
판정 기준: `lib/ap-exam/look-alike.ts` 의 구조 판정(같은 주제·자료 형태에서 숫자 마스킹 후 문항이 같으면 template, 같은 원형+같은 사고 단계+문장 토큰 겹침 ≥0.7이면 archetype). 문항군 ID(원형+토픽 묶음)만 같은 경우는 증거로 세지 않았다.
| 세트 | MC | 공개 세트와 구조 동일(template) | 공개 세트와 구조 유사(archetype) | 문항군 ID만 같음(증거 아님) |
|---|---|---|---|---|
| MA4 | 60 | 6 | 9 | 4 |
| MA5 | 60 | 8 | 4 | 4 |
| MI4 | 60 | 19 | 11 | 8 |
| MI5 | 60 | 22 | 18 | 2 |
- 새 세트 사이: MA4×MA5 14문항, MI4×MI5 14문항이 구조 동일·유사.
- 대표(구조 동일 판정): PPC 직선 `60 단위 vs 120 단위`(숫자만 다름), `Maya` 기회비용(숫자만 다름).
- 판단: **macmic 의 4세트는 오너 규칙으로는 준비 완료가 아니다**(공개 세트와 구조 중복 다수). 적재·공개 안 함.
- 문항군 기준(`fam`, 유형명·토픽 묶음 포함) 으로 다시 풀면(문자열 유사도 미사용) macmic 풀만으로 MA4 MC 56/60, MA5 41/60, MI4 35/60, MI5 24/60(FRQ 는 전부 채움). econ-ab 재고와 합친 풀로 다시 풀어야 한다(미실행).
- macmic FRQ 가 econ-ab 의 FRQ 부족분을 채울 후보: `mif_short_mc`(micro-t2-f f07-k2), `mif_long_pc_firm`(f03-k2), macro `maf_short_fx_trade`(macro-t2-f f05-k2)·`maf_short_lf_crowding`(macro-t-f f01-k1). **공개 FRQ 와의 자료·조건 대조는 아직 안 했다**.

## econ-ab MA4(3a848c2c7) 오너 규칙 대조 — 공개 전 점검에서 발견
- 위 구조 판정을 econ-ab MA4 의 MC 60개에 적용하면 공개 Macro 세트와 template 11 + archetype 8 = 19개가 걸린다. 내용 대조 결과(요약):
  - 구조 동일로 판단: GDP 포함 거래(newly built house vs 다른 신규 거래), 경기 침체 갭 질문(같은 문장·같은 정답 계열), 그래프 trough "Point B"(같은 문항·보기 순서만 다름), 화폐시장 그래프 질문, Phillips 곡선 이동 이유(질문·정답 동일), 장기 성장 정책(질문 동일), 승수·지급준비금·실질이자율·필립스 곡선 표(숫자만 다름) 등 약 14개.
  - 조건 또는 방향이 달라 독립으로 볼 여지: 수요↑공급↓ vs 수요↑공급↑, 채권 매입 vs 매각, SRAS 좌 vs 우 이동 등 약 3개.
- 결론: **econ-ab MA4 도 오너 규칙 기준 준비 완료가 아니다.** 편성 해시·겹침(문항 단위 0)·화면 증거·변환은 통과했지만 구조 동일 문항이 공개 세트와 겹친다.

## 실제로 한 쓰기와 상태
- ① 화면 증거 29키(MA4 용 macro-x-a 14 · x-b 2 · y-a 7 · fg-a 6)를 격리 스택 `ALTON_apma4`(오프셋 3600)에서 생성(실패 0, 스택 정지·config 원복·시드 정리 완료): `evidence-macro-x.json`(+32 항목), `evidence-macro-y.json`(14), `evidence-macro-fg.json`(12), 스크린샷 `docs/ap/screen-evidence/macro-ma4/`.
- ② 공유 DB(관리자 화면, review 호스트): macro-y 적재 24행(변환 7, 증거 없는 8 대기), macro-fga 적재 48행(변환 6, 38 대기), macro-xa ③④ 14건 기록·변환, macro-xb ③④ 2건 기록·변환. 모두 추가(additive) 적재이며 공개 세트·응시·답안은 건드리지 않았다.
- ③ **MA4 초안 세트 `626bfd8b-22ca-427c-9f93-41bdfcbbfbfa`(draft, 63문항, 문항 겹침 0)를 저장했다. 공개하지 않았다.** 위 구조 점검 결과 때문에 공개 보류, 구조 동일 문항 교체 후에 공개 여부를 판단한다.
- 사용 호스트: `alton-git-review-alton7.vercel.app`(review 브랜치 빌드 `alton-p1ozu0s5j`에 별칭 연결).
