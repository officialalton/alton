# AP Biology·Physics 1·Chemistry 세트 추가(2026-10-19, 브랜치 `ap-bi-ph-ch`)

범위: 공개 세트 2개씩이던 Biology(BI1·BI2)·Physics 1(PH3·PH4)·Chemistry(CH1·CH2)에 **풀이 틀(원형)이 공개 세트와 겹치지 않는** 새 세트 2개씩을 더한다(브리프 엄격 규칙). 관리자 화면 적재·공개, 원격 DB 쓰기, Production 은 하지 않았다(총괄이 한다). 모델 비용: 원장 $315.36 → $332.65(약 $17.3 / 배정 상한 $75).

## 1. 결과 요약

| 과목 | 새 세트 | 상태 | 새 원형 | 정확 배정 파일 |
|---|---|---|---|---|
| Biology | **BI3·BI4** | 완료(가상 칸 0, 독립 검증기 위반 0, 공개 세트와 원형 겹침 0, BI3·BI4 겹침 0) | MC 단독 30 + 4문항 세트 1 | `data/ap/stock/exact-assign-bio-bi3-bi4.json` |
| Physics 1 | **PH5·PH6** | 완료(가상 칸 0, 독립 검증기 위반 0, 스킬 범위 차단 충족, 공개 세트와 원형 겹침 0, PH5·PH6 겹침 0) | MC 단독 51 + 2문항 세트 4 + FRQ 시나리오 4 | `data/ap/stock/exact-assign-phys-ph5-ph6.json` |
| Chemistry | CH3·CH4 **미착수(측정만)** | 엄격 규칙으로는 새 원형이 약 100개 더 필요 — §5 | 0 | 없음 |

## 2. 엄격 규칙의 정의와 측정 도구

- "풀이 틀이 다르다" = **원형(archetype) 기준**: 새 세트의 모든 문항(MC 단독·세트·FRQ)은 (a) 현재 공개 구성(정확 배정 + 모든 교체안 적용 후)이 쓰는 원형과 다르고 (b) 새 세트끼리도 서로 다르다. 공개 구성 재구성은 `scripts/audit/ap-type-defect-scan.py` 의 `compose_all` 을 썼다.
- 공개 세트가 쓴 원형 목록: Bio 117·Phys 66·Chem 73(세트 원형·`_qN` 포함, 이 문서 작성 시점). 이 목록으로 재고 후보와 라이브러리 가상 칸을 모두 막는다.
- 도구(모두 읽기 전용·무료): `bio-assign.ts --block-archetypes <JSON>`(신규 옵션; 가상 칸에서도 공개 원형 제외, `EXCLUDED_ARCHETYPES` 로 반복 반려 원형 제외, `BIO_DUMMY=1` 은 새로 써야 할 단원×Practice 칸 계산), `phys-strict-plan.ts`(신규: 재고 + 라이브러리 미생성 + 새 원형 칸을 비용 순으로 푸는 정수계획, `--no-virtual` 이면 재고만으로 풀고 독립 검증기를 돌려 보고서를 쓴다), `chem-assign.ts` 의 `CHEM_BLOCK_ARCH`·`CHEM_DUMMY`(신규 분석 환경 변수).
- 초기 측정(저작 전): BI3+BI4 는 라이브러리만으로 BI3 가능·BI4 는 Practice 1 -5, Practice 2 -6, Practice 6 -2 가 부족했다. PH5 는 새 단독 13 + 새 세트 2, PH5+PH6 은 새 단독 41 + 새 세트 4 + 새 FRQ 4 가 부족했다. 이 부족분을 아래처럼 저작해 메웠다.

## 3. Biology BI3·BI4

- **새 원형 단독 30 + 4문항 세트 1**(`scripts/ap-generation/archetypes/bio_p0_n.py` 16개, `bio_p0_o.py` 14개 + `bis_n_cellcycle_set`; 가이드 행은 `lib/ap-generation/subjects/bio-archetypes.json`): P1 개념 설명 고정 문장 은행 11(수송 분류·영양단계 에너지·감수분열 변이·수용체 위치·밀도 의존성·복제 대 전사·효소 억제·인위 선택·명반응-캘빈·물의 성질·진핵 유전자 조절), P6 논증 은행 7(허시-체이스·핵심종 제거·공통 조상 증거·온도 효소 근거·활성 부위 돌연변이 예측·병목 예측·1차 구조 정당화), P2 시각 표현 12(코드가 만든 표: 감자 삼투 0점 보간·호흡 측정기·제한 효소 절단·영양 효율·분자 시계·염색체/DNA 표·작용 스펙트럼·광 보상점·부동 표·연관 표·세포 부피·세포 주기 DNA). 표 문항은 정답을 정의가 다른 두 경로(보간 대 최소제곱, 합 검사 대 열거 등)로 독립 계산하고 불일치 시 건너뛴다. 필요한 값은 모두 학생 화면의 본문·표에 있다.
- 생성: `config/ap-frozen/bio-b34{,b,c,d}-*.v1.json` 동결 구성(Opus 풀이 + Sonnet 평면 검토 + 난이도), 후보 1차 MC 165(통과 64)·2차 48(통과 36)·세트·FRQ 시나리오. **검토기가 반려한 원형은 `bio-assign.ts` `EXCLUDED_ARCHETYPES` 에 기록**(1차 16 + 2차 2): 호흡 측정기 새 원형은 "단순 계산이라 2.B 가 아니다"로 반려됐고, 1차에서 반려된 라이브러리 원형도 새 시드로 다시 시도하지 않았다. 새 세트 `bis_n_cellcycle_set` 은 처음 문항 3 이 "양파 뿌리 세포 주기 표" 고전 문항과 닮았다며 반려되어 문항 3 을 3.D(절차 개선)로 바꿔 통과했다.
- 정확 배정(`bio-assign.ts --sets BI3,BI4 --prefer-exam-prep --frq-spread --block-archetypes …`): MC 60 = 단독 52 + 4문항 세트 2 × 4(실제로는 세트 키 2개), FRQ 6, 단원 BI3 {6,8,9,8,7,7,7,8}·BI4 {6,7,10,8,6,8,7,8}, Practice 둘 다 {15,9,6,7,9,14}(공식 범위 안), **FRQ 영역 분산 규칙(한 영역 ≤35 %·영역 4개 이상) 충족**. BI3 문항 중 새 배치 32·BI4 25.
- **exam_prep MC 는 BI3 16/60(27 %)·BI4 11/60(18 %)** — 이전 공개 세트(26/60 이상)보다 낮다. 엄격 규칙으로 남은 원형이 개념·그래프 읽기형 위주이고, `--min-exam-prep 18` 부터는 해가 없다(정책 문서에 최소 비율 규정은 없음).
- 화면 증거(격리 스택 `ALTON_apbiph`, 포트 +1100, 가드 통과): 후보 105 × 390×844·1280×800 = **228항목 fail 0**(`data/ap/screen-evidence/evidence-bio-b34.json`, 스크린샷 `docs/ap/screen-evidence/bio-b34/`).

## 4. Physics 1 PH5·PH6

- **새 원형**(`archetypes/phys_p0_n.py` 단독 51 + 세트 4, `phys_p0_frq3.py` FRQ 4; 가이드는 `physics1-archetypes.json`·`physics1.ts` `frqTemplates`): 3.B 주장·원리 17(상대 운동·v-t 면적·경사로 속력·일률·정지 거리·에어백·용수철 발사·반동·튕김 충격량·경사면 수직항력·문 돌림힘·위성 속력·연속 방정식·질량-주기·아트우드 장력·마찰 면적 무관·충돌 에너지 손실…), 3.C 자료 근거 4, 2.C 순위 8, 2.A 기호식 14, 2.D 예측 8, 2문항 세트 4(`phs_ft_set` 힘-시간, `phs_torque_set` 돌림힘-시간, `phs_depth_pressure_set` 깊이-압력 표, `phs_wt_claim_set` 각속력-시간 3.B 쌍), FRQ 시나리오 4(MR 아트우드·TBR 엘리베이터 v-t 와 저울·LAB 경사면 g·QQT 원 궤도 위성). 모든 정답은 sympy·정확 분수와 numpy·RK4·이분법·최소제곱 등 독립 경로로 이중 계산한다.
- 1차 생성(MC 144 후보 → 통과 99)에서 **검토기가 잡은 결함을 원형에서 고쳐 2차에 다시 생성**: 선택지 표기 `1.18e+03`(`:.3g` → `sig`), 순위 문항 stem 120단어 초과 4원형(compact 표기), 순위·기호식 오답 설명이 선택지와 어긋난 곳 7곳(`rank_*`, `sym_wheel_pulley`, `sym_pressure_depth`, `sym_projectile_range`, `sym_rolling_accel`, `claim_bounce_impulse`, `pred_planet_weight`), 비원시 문자열의 `\frac`·`\theta`(form-feed/TAB 으로 깨짐: `ph_sym_disk_rim_force`, 투사 범위 오답), FRQ 표 설명의 LaTeX `\theta`(렌더 게이트 `figure_label_latex_leak`). 2차 MC 36 후보 → 통과 35. FRQ 4 시나리오는 1·2·3차 생성에서 전부 통과(LAB 은 렌더 게이트 수정 후 3차).
- 정확 배정(`phys-strict-plan.ts --sets PH5,PH6 --no-virtual --block-archetypes …`): 단원 5/8/8/5/5/3/3/5, 스킬 2.A 8·2.B 10·2.C 5·2.D 6·3.B 10·3.C 3(PH5), 동일 범위(PH6), 세트 2개, FRQ MR·TBR·LAB·QQT 각 1, **원형 44종씩(공개 66종과 겹침 0, PH5·PH6 겹침 0)**, exam_prep **PH5 23/42·PH6 22/42**. 독립 검증기(`verifyPhysAssignment`) 위반 0.
- 화면 증거: `data/ap/screen-evidence/evidence-phys-s5.json`(§7 결과 요약 참조).

## 5. Chemistry — 엄격 규칙으로 미달(수치)

- 공개 세트(CH1·CH2)는 **라이브러리 원형 113 중 73 개**를 이미 썼고, 두 세트가 원형 58 개 중 50 개를 공유한다(공개 구성 자체가 엄격 규칙을 지키지 않는다). 재고에서 공개 원형이 아닌 원형은 1개뿐(FRQ 0).
- CH3 단독: 새 단독 원형 약 46 + 새 2문항 세트 2 + **FRQ 시나리오 7(라이브러리 7유형이 각 1시나리오뿐이고 CH1·CH2 가 이미 썼다)**. CH3+CH4: 라이브러리 미사용 원형 10개를 쓰고도 새 단독 원형 약 102 + 새 세트 3~4 + FRQ 시나리오 14 가 필요하다(`CHEM_BLOCK_ARCH`·`CHEM_DUMMY` 분석, `chem-plan.txt` 와 같은 계산 재현 명령은 §6).
- 따라서 이 라운드에서는 만들지 않았다. 해결 방법은 (a) 새 원형 저작(이 문서의 Bio·Phys 절차와 같은 틀; Chem FRQ 시나리오 7개가 가장 큰 덩어리), 또는 (b) 오너 결정으로 Chem 만 "원형 겹침 허용, 문항·숫자만 다름"(CH1·CH2 와 같은 기준)으로 낮추는 것이다.

## 6. 재현

```
# 분석(무료)
python3 -c "…"                                   # 공개 원형 목록: scripts/audit/ap-type-defect-scan.py compose_all 결과의 원형 집합을 JSON 배열로
npx tsx scripts/ap-generation/bio-assign.ts --sets BI3,BI4 --prefer-exam-prep --frq-spread --block-file <공개 키 보고서> --block-archetypes <공개 원형 JSON> --write-report data/ap/stock/exact-assign-bio-bi3-bi4.json
PH_NO_SCREEN= npx tsx scripts/ap-generation/phys-strict-plan.ts --sets PH5,PH6 --no-virtual --block-archetypes <공개 원형 JSON> --write-report data/ap/stock/exact-assign-phys-ph5-ph6.json
CHEM_BLOCK_ARCH=<JSON> CHEM_DUMMY=1 npx tsx scripts/ap-generation/chem-assign.ts --sets CH3,CH4 --joint --block-file <공개 키 보고서>
# 생성(유료): config/ap-frozen/{bio-b34*,phys-s5n*}.v1.json 을 run-frozen.ts 로(동결 → 해시 확인 → 실행), 결과는 pipeline2.ts report → bio-finalize.ts / phys-finalize.ts
```

적재(관리자 '재고 관리')는 배치 `bio-b34a·b·bf·c·d`, `phys-s5a·s5s·s5f·s5b·s5g·s5h` 를 적재(`lib/ap-admin/batches.ts`) → 초안 저장(`exact-assign-bio-bi3-bi4.json`·`exact-assign-phys-ph5-ph6.json`) → 검토 → 공개 순서(원격 DB 쓰기는 총괄).

## 7. 남은 점·주의

- 원형 겹침 0 은 **원형 단위**다. 같은 원형의 다른 시드(숫자만 다름)는 같은 세트 안에서도 하나만 쓴다(문항군 규칙 그대로). 문항 단위로 공개 세트와 같은 키는 0.
- exam_prep 비율 하락(Bio 27 %/18 %, Phys 55 %/52 %)은 위 규칙의 대가다. Bio 새 개념·표 읽기형이 `basic_learning` 으로 라벨되는 경우가 많다.
- 새 FRQ 3개 시나리오(TBR 엘리베이터·QQT 위성·LAB 경사면 g)의 채점 행은 이전 시나리오와 같은 구조지만 사람 검수는 없다(모델 검증).
- `data/ap/sample-2027/ledger.json` 은 항목 합집합(at·note·usd)으로 병합해야 한다.
