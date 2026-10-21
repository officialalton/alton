# AP 인문·언어 추가 6세트 진행 상태 (2026-10-19~20, r19)

담당: AP U.S. History +1(US3), World History: Modern +1(WH3), English Language +2(EL3·EL4), English Literature +1(LT3), Psychology +1(PS3). 하위 에이전트 없음, 파이프라인 한 번에 하나(배치 대기 중 무료 작업만 병행).

## 완료
- **PS3**: `data/ap/stock/exact-assign-psych-ps3.json`(독립 검증기 위반 0, 가상 칸 0, MC 75 = 단독 66 + 세트 3, 단원 15/15/15/17/13, Practice 49/19/7, AAQ+EBQ). 새 세트 원형 `psych_p0_sets_r19.py`(단원 4 인지 부조화·평가자 맹검; 단원 5 강박 사례는 검토 탈락). 배치 `psych-r19`(증거 파일은 빈 자리표시자 — 화면 증거 미실행). `--ban-archetypes` 로 외부 검수 지적 틀(pre/post·GPA 신뢰도·z 꼬리·반응시간·방관자·효과/p·위약)을 제외. 미달: exam_prep 1/75(난이도 높은 원형 소진). 설계표 `design-table-psych-ps3.json`.

## 진행 중(원장 기준 사용액은 이 문서 갱신 시점 약 $14 + 대기 중 배치)
- **EL3·EL4**: 새 ALTON 원본 지문 묶음 `englang-r19-a`(통과 읽기 2·글쓰기 5), 공식 크기 확장 `englang-r19-ext`(1차)·`-ext2`(미달 4묶음 보강, 배치 대기), FRQ `englang-r19-f`(6개 중 4 통과)·`-f2`(1 통과)·`-f3`(q2 재생성; 이전 실행이 중단돼 재개 필요). 남은 단계: 병합·트림(`new6-el-trim.ts`) → 배치 최종화 → `el-assign.ts --official` 핀 배정 → 설계표·배치 등록.
- **WH3**: 실제 자료 27건(`wh-sources-manifest-r19.json`, 레지스트리 79건, 문화·환경·과학 중심: Okakura·Nitobe 쌍, Polo 구휼·가로수, Taqi al-Din 천문대 세밀화, Bellini 초상, Columbus 서한, Galileo, Waldseemuller 지도, Humboldt, Wallace, Darwin, Livingstone, Ford, Census 표, Earthrise, Indonesia·Korea 국가연구, DBQ 7문서 Marsh·Muir·Arrhenius·Dust Bowl·NOAA CO2·Soviet·Brazil 등). 계획 w301–w316 + FRQ 5(`wh-plan.ts`), 동결 구성 `wh-r19-m`·`wh-r19-f`. MC 생성 배치 대기 중, FRQ 대기열.
- **LT3**: 공개 도메인 7작품 등록(`englit-sources-build-stage3.ts`: Keats·Hardy 시, Joyce·Mansfield 단편, Wilde 희곡, Frost 시 FRQ, Chesnutt 산문 FRQ) + Q3 `englit-r19-q3`. 파이프라인 대기열(체인 2).
- **US3**: 현재 공개 세트와 겹치지 않는 재고만으로는 구성 불가(Period 1 문항 1개뿐, SAQ1·SAQ2 없음, SAQ3·DBQ·LEQ 후보는 이미 실제 자료판으로 교체돼 내려간 것). 실제 1차 자료 MC 2세트 완료·검증(`ush-real-e`: Harriot 1588, Treaty of Tordesillas 1494; 독립 풀이 8/8 일치, 사실 점검 지적 0). FRQ 5건은 `ush-r19-f`(ALTON 작성 자료, 라벨 표기) 파이프라인 대기열(체인 3) — 실제 자료 정책 미달분으로 보고.

## 알려진 미달·위험
- 화면 증거(Playwright)는 신규 후보 전부 미실행 — 관리자 적재 전에 별도 실행 필요(`evidence-psych-r19.json` 은 빈 자리표시자).
- 푸시는 자동 모드 분류기가 거부(오너 확인 후 총괄 처리). 로컬 브랜치 `worktree-agent-afee103d401b7dba9`.
- 병렬 에이전트와 원장 병합은 항목 합집합(`ledgermerge.py` 방식)으로 처리했다.
