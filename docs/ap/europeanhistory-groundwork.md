# AP European History 저작 기반 (2026-10-20)

신규 과목 계획(`docs/ap/new-subjects-plan-2026-10-20.md`)의 European History 저작. World History 와 같은 실제 자료 우선 파이프라인(`docs/ap/worldhistory-groundwork.md`)을 복제해 유럽사용으로 조정했다. 원격 DB 쓰기·시드 적용·공개는 하지 않았다(총괄 몫).

## 시험 형식 재확인 (AP Central, 2026-10-20 직접 조회)
- 시험 페이지(`apcentral.collegeboard.org/courses/ap-european-history/exam`): MC 55문항·55분·40% / SAQ 3문항·40분·20%(3문항 전부 필수; q1 2차 텍스트, q2 1차 텍스트, q3 1차 또는 2차 비텍스트; 서로 다른 시대; 범위 1450–2001) / Section II 100분: DBQ(권장 60분, 읽기 15분 포함, 문서 7개, 25%) + LEQ(권장 40분, 15%). 계획서 값과 일치한다.
- "AP History Exam Updates"(`/courses/ap-history-exam-updates`, 2027년 5월 시험부터): SAQ 전부 자료 포함(q1 2차 텍스트 1개 이상), LEQ 는 필수 1문항(선택 없음)·짧은 소개문 포함, DBQ 는 더 넓은 연대. MC·채점 기준·과목 내용은 불변. 계획서가 "확인 못 함"으로 둔 개편 내용은 이것이다. 이 구성은 `lib/ap-generation/euro-plan.ts`에 반영돼 있다. 정확한 공식 문항 문안·배점은 개정 CED PDF(7.45MB)를 다시 읽지 않았다.
- 시대 구간(내부 구성, 공식 구분 아님): 1 = 1450–1648(U1–2), 2 = 1648–1815(U3–5), 3 = 1815–1914(U6–7), 4 = 1914–현재(U8–9). SAQ 3문항은 서로 다른 구간.

## 만든 것
| 항목 | 위치 |
|---|---|
| 실제 자료 레지스트리 60건(Gutenberg·Avalon·Wikisource·LoC Country Studies·Commons 이미지·EB1911 표, 해시·출처·재사용 근거 기록) | `data/ap/euro-sources/registry.json`, 등록기 `scripts/ap-generation/euro-sources.py`, 매니페스트 `euro-sources-manifest.json` |
| 고정 계획: EU1·EU2 각 MC 18세트(55문항, 단원마다 2세트)·FRQ 5(SAQ 3·DBQ·LEQ) | `lib/ap-generation/euro-plan.ts` |
| 구성 규칙(단원 5–9문항, 세트 3–4문항, 시대 구간) | `lib/ap-exam/euro-rules.ts` |
| 프롬프트·게이트·후보 조립·풀·정확 배정·초안 계획기 | `euro-prompts/euro-frq/euro-real-gates`, `scripts/ap-generation/euro-*`, `lib/ap-admin/assemble-euro-draft.ts`(세트 접두 `EU`) |
| 배치 등록 | `lib/ap-admin/batches.ts` (`euro-p1`, `euro-m1`, `euro-f1`, `euro-f2`, 증거 `evidence-euro-s1.json`) |

FRQ payload 는 채점기가 읽는 `whap_frq`(루브릭 `whap-v1`)를 그대로 쓴다. **AI 에세이 채점은 켜지 않았다**: `ESSAY_GRADING_SUBJECTS`에 `ap_european_history`를 넣지 않았고, `whap-v1` 루브릭의 과목 라벨이 "AP World History: Modern"이라 유럽사용 라벨·보정(별도 유료 단계)이 필요하다.

## 자료 정책 준수
모든 자료는 레지스트리에 고정된 실제 사료·이미지·통계이고 발췌는 코드가 저장소 파일에서 앵커 문구로 잘라낸다(해시 고정). 1929년 이전 출판물 또는 미국 정부 저작물만 사용했다. 2차 자료 중 일부는 19세기 역사가의 해석이라 문항은 그 주장을 묻는 형태로 설계된다.

## 결과 (2026-10-20)
- 풀 모의고사 **2세트(EU1·EU2) 완성**: 각 MC 55(자료 세트 18개, 단원별 2세트=6문항, U9만 7) + SAQ 3(서로 다른 시대: EU1 3/1/4, EU2 4/2/1) + DBQ + LEQ. 정확 배정 `data/ap/stock/exact-assign-europeanhistory-eu1-eu2.json`(독립 검증기 위반 0, 화면 증거 포함 재고 기준).
- 재고 배치(`lib/ap-admin/batches.ts`): `euro-p1`(MC 4), `euro-m1`(MC 30), `euro-m2`(e213), `euro-m3`(e205), `euro-f1`(EU1 SAQ3·LEQ), `euro-f2`(EU2 SAQ1), `euro-f3`(EU1 SAQ1·DBQ, EU2 SAQ2·DBQ·LEQ), `euro-f4`(EU1 SAQ2, EU2 SAQ3). 증거 `evidence-euro-s1.json`(격리 스택 `ALTON_euro`, PORT_OFFSET=800, 후보 46개 × 390×844·1280×800 = 240항목, 실패 0; 스크린샷 `docs/ap/screen-evidence/euro-s1/`). 종료 후 시드 정리·dev 서버 종료·`isolated-stack.sh stop`·`config.toml` 원복·컨테이너 0 확인.
- 비용: 시작 누적 $414.9164 → 종료 $425.1973, 이 과목 실지출 **$10.28**(상한 $44).
- 파이프라인에서 걸러진 실제 오류: Westphalia 조약 출처 표기(Münster/Osnabrück), Entente 맥락 문장 모순, Orpen 그림 비문 "Latin"(프랑스어), 체크포인트 사진 날짜(6/15 → 1961만 사용), 폴란드 분할·콘스탄티노플 함락 등 논쟁적·부정확 모범 답안(재생성).
- `lib/ap-generation/verify-guard.ts`: `euro` 원형을 지문 묶음 해시 대상에 추가(없으면 유럽사 세트 전부가 같은 해시가 되어 증거가 한 세트로 합쳐진다). **World History 는 같은 결함을 그대로 갖고 있다**(wh_/whfrq_ 가 정규식에 없음; 기존 WH 증거 해시가 바뀌므로 건드리지 않음 — 인문·언어 에이전트/총괄 확인 필요).

## 미해결
- 신규 과목 공개 전 `AP_PENDING_PUBLIC_SUBJECTS`에서 제거, 시드 SQL·마이그레이션 `…620` 적용은 총괄.
- 5세트 목표 중 2세트만 완성했다. 세트당 실제 사료 약 30건(MC 20 + FRQ 10)을 사람이 앵커로 고정해야 해서 병목은 비용이 아니라 자료 확보다. EU3 이후는 같은 매니페스트 방식으로 이어서 할 수 있다(`scripts/ap-generation/euro-sources-manifest.json`).
