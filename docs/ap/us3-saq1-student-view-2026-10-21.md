# US3 SAQ1 학생 화면·원문 대조·근거 보완 (2026-10-21)

대상: `ush-real-f:ap_us_history-real_f_saq1-k0` (Dunning 1907 `txt-dunning-1907` vs Du Bois 1910 `txt-dubois-1910`, 시대 5 / 5.10 / 3.C). **공개 보류 유지**(이번 수정·적재 준비를 공개 승인으로 해석하지 않는다). 사실 점검·채점은 LLM(Opus·Sonnet·Fable)이며 역사 교사 검수가 아니다. 문서의 전문(학생 화면 문안·루브릭)은 아래 부록 A·B에 payload에서 코드로 그대로 옮겼다.

## 1. 학생에게 보이는 자료와 출처 링크

학생 화면 렌더: 격리 스택(`ALTON_apsaq1`, PORT_OFFSET=2900) 학생 응시 화면 스크린샷 `docs/ap/screen-evidence/ush-real-fg/ush-real-f_ap_us_history-real_f_saq1-k0-{390x844,1280x800}.jpg`, 렌더된 텍스트 전문은 부록 A(코드가 만든 `set_intro`와 동일, 화면 게이트가 둘의 일치를 검사).

| 자료 | 원문 위치 | 직접 링크(쪽 이미지) |
|---|---|---|
| Source A: Dunning, *Reconstruction, Political and Economic, 1865-1877* (Harper & Brothers, 1907, American Nation vol. 22) | 첫 구간 **p. 32**("The bureau assumed, in short ... good judgment."), 둘째 구간 **p. 34**("Hence the working of the bureau ... former slaves."). 쪽번호는 스캔 이미지로 직접 확인(p. 33 사이 쪽에 지방 요원 논의가 있다) | 항목 https://archive.org/details/reconstructionpo0022dunn · p. 32 https://archive.org/details/reconstructionpo0022dunn/page/n59 · p. 34 https://archive.org/details/reconstructionpo0022dunn/page/n61 (페이지 이미지 직접 URL: `https://archive.org/download/reconstructionpo0022dunn/page/n59_w1000.jpg`) |
| Source B: Du Bois, "Reconstruction and Its Benefits," *American Historical Review* 15 (July 1910), pp. 781-799 | **p. 782**("It must not be forgotten ... Ware and Cravath."), **p. 783**("The Freedmen's Bureau was an attempt ... but it was repudiated."). 쪽 이미지로 p. 782 확인 | 항목 https://archive.org/details/jstor-1836959 · p. 782 https://archive.org/details/jstor-1836959/page/n2 · p. 783 https://archive.org/details/jstor-1836959/page/n3 · 이미지 `https://archive.org/download/jstor-1836959/page/n2_w700.jpg` |

**발견·수정한 오류(이전 적재본)**: Du Bois 발췌의 두 구간이 원문 순서와 **반대**로 이어 붙여져 있었다(Bureau 정의 구간이 p. 783, 교사 구간이 p. 782). `[...]`이 원문 순서를 암시하므로 순서를 원문 순서(p. 782 → p. 783)로 고쳤고, 레지스트리 `excerpt_segments`·`sha256`·`excerpt_words`·SOURCE.md·excerpt.txt를 갱신했다. 크레딧 줄에 쪽(Dunning pp. 32, 34 / Du Bois pp. 782, 783)을 넣었다.

## 2. 원문 글자 단위 대조

방법: archive.org 원문 OCR(`reconstructionpo0022dunn_djvu.txt`, `jstor-1836959`의 `1836959_djvu.txt`)을 새 폴더에 내려받아 공백 정규화한 뒤, 발췌에서 **기록된 OCR 교정만 되돌려** 원문 문자열에 그대로 포함되는지 검사(`scratchpad/verify_verbatim.py`), 그리고 쪽 스캔 이미지(Dunning p. 33·34, Du Bois p. 782)를 눈으로 대조. 결과: 네 구간 모두 **교정 외 글자 불일치 0**(Dunning 64+89단어, Du Bois 28+65단어).

OCR 교정 목록(전부 공개): Dunning — `r6le`→`rôle`(스캔 이미지로 'rôle' 확인), 줄바꿈 하이픈 `judg¬ ment`→`judgment`, `oppres¬ sive`→`oppressive`. Du Bois — 줄바꿈 하이픈 `educa- tional`, `gov- ernment`, `physi- cally`, `social- istic` 재결합. 그 밖은 바꾸지 않음(원문 어형 `negroes`, `school-teachers` 유지).

## 3. 맥락 정확성(발췌가 저자 주장을 왜곡하는가)

- **Dunning**: 첫 구간은 Bureau가 '해방 인종의 전반적 후견(guardianship)'을 맡았고 Howard 총국장의 지침은 "moderation and good judgment"로 특징지어진다고 쓴 대목이고, 둘째 구간은 그 사이 생략된 내용(p. 33: 일부 지방 원로 간부의 설교조, **지방 요원이 북부 출신이라 백인에게 받아들여질 수 없었다는 논지**, 북부 여론은 본부의 '정당하고 실용적인 정책'에 더 영향받았다는 서술)을 'Hence'로 이어받는다. 발췌 중간 `[...]` 표시는 있으나 둘째 구간의 'Hence'가 가리키는 앞 논거가 빠져 있다. 저자의 주장(Bureau의 사회 개입→백인의 적대, 일부 요원의 문제)은 **왜곡되지 않았고**, 오히려 Dunning이 본부 정책을 비교적 호의적으로 쓴 부분(첫 구간)이 포함돼 균형이 있다. 학생이 'Hence'를 못 알아볼 수 있다는 한계를 기록한다(수정 불요: `[...]` 표시가 있고 시험 문항은 해석 비교).
- **Du Bois**: 원문 p. 782 문단 말미 문장과 p. 783 정의 문장으로, 각각 해당 문단의 요지(Bureau 요원 중 교사·교육지도자, Bureau를 '정부 후견·경제적·시민적 권리 보장 시도'로 보고 '큰 임무를 이뤘으나 repudiated')다. 생략은 p. 783 정의 문장 뒤의 Carl Schurz 인용(Bureau 칭찬)과 'temporary, makeshift, soon abandoned' 문장이다. 주장 왜곡 없음. 단 Du Bois가 "Ware and Cravath"를 Bureau 요원으로 묶은 서술은 Cravath가 AMA 소속으로 Fisk 설립에 관여한 인물이라는 사실과 완전히 같지는 않다(Du Bois 자신의 서술이므로 발췌는 원문대로 유지, 루브릭에서 Fisk 설립 서술은 정확한 역할만 인정).

## 4. 질문 답과 소개문·자료 설명의 중복(정답 노출) 점검

- 소개문 문안은 전부 부록 A. 맥락 줄은 **사실만**: Dunning "1907, Columbia 역사학자, 당시 인종적 편견을 반영하고 이후 역사학자들에게 널리 비판받음"; Du Bois "흑인 역사학자·사회학자(Harvard 박사), 1909년 12월 미국역사학회 발표, 1910 게재, Dunning과 그의 제자들이 가르친 당시 지배적 견해에 대한 초기 도전". 지문 장면: "각 발췌는 저자 자신의 해석".
- 질문 A의 정답(적대·사회 개입 vs 경제적·시민적 권리 보호, 지방 요원 vs 교사 요원, 백인 남부의 관점 vs 'great task'/repudiated)을 맥락 줄이 알려주는지: 맥락 줄에는 `hostil|protect|guardian|rights|intrusion|oppress|great task|repudiat`가 없다(단위 테스트 가드 `ush-real-f-build.test.ts`). Du Bois의 "초기 도전"은 두 자료가 같은 쟁점에서 대립한다는 정도의 정보이며 **구체적 차이는 말하지 않는다**(지문 자체가 두 해석 비교를 묻는 문항이고 오너 지시 반영). 지문 장면과 질문 B·C에도 정답 단서 없음.
- Bureau 설명 중복: 이전에는 지문 장면과 Dunning 맥락 줄이 Bureau 정의를 두 번 말했다 → 장면에서 한 번만 말하도록 정리.

## 5. 해석 표지와 근거

| 근거 | 확인한 내용 | URL/서지 |
|---|---|---|
| Eric Foner, "Black Reconstruction: An Introduction," *South Atlantic Quarterly* 112:3 (2013) | Dunning school은 Reconstruction을 부패한 실정으로, 흑인 유권자를 민주주의 부적격으로 그렸고 Jim Crow의 이념적 기둥이 됨; Du Bois는 흑인 무능 전제를 거부(1935 *Black Reconstruction in America*); 주류 역사학자는 1960년대에야 Dunning 해석을 버림; "Reconstruction and Its Benefits"는 Dunning school에 맞서려 했으나 흑인 대학 밖에서는 영향이 작았음 | https://www.ericfoner.com/articles/2013SAQ.html (본문 fetch로 확인; PDF https://dup.silverchair.com/south-atlantic-quarterly/article-pdf/112/3/409/470903/SAQ1123_01Foner_Fpp.pdf) |
| Du Bois, *Black Reconstruction in America* (1935) | Dunning 해석에 대한 체계적 반박(위 Foner 글이 설명) | Foner 위 글 |
| Foner, *Reconstruction: America's Unfinished Revolution, 1863-1877* (1988) 서문·서론의 Dunning school 비판 | **본문을 직접 열람하지 못함**. 위 2013 글에서 같은 비판을 확인했으므로 1988 서문은 근거로 쓰지 않았다 | 확인 못 함 |
| AHA | 별도 AHA 성명은 찾지 못함. 검색 결과 AHA 2022 프로그램 초록(https://aha.confex.com/aha/2022/webprogram/Paper33294.html)이 Dunning school이 1910-1940 AHA 역사학을 지배했다고 서술(초록, 본문 미열람) | 보조 근거만 |
| Du Bois 1909 발표와 Dunning 반응 | 1909년 12월 AHA(New York)에서 발표, Dunning이 참석해 칭찬했다는 서술은 **Du Bois 본인의 회고에 근거**(2차 요약, 직접 확인 못 함) → 소개문에 쓰지 않음, 레지스트리 노트에만 'Du Bois 본인 보고'로 표시 | https://en.wikipedia.org/wiki/Black_Reconstruction_in_America (보조) |

표지 문구는 위 Foner 2013의 확인된 서술(Dunning school의 인종적 전제와 후대의 폐기, Du Bois 글이 Dunning school에 맞선 시도였음)만 쓰고, 한 문장씩 사실만 담았다. '1988 서문' 인용은 쓰지 않았다.

## 6. B·C 허용 사건과 해석의 연결 검증

판정 기준: (a) 구체적 사실(날짜·행위자·내용)이 1차·2차 근거로 확인되는가, (b) 그 사실이 해당 해석을 뒷받침하는 **연결 논리**가 서는가. '있었다'와 '뒷받침한다'를 분리.

| 예시 | (a) 확인한 사실과 근거 | (b) 연결 논리와 한계 | 조치 |
|---|---|---|---|
| **B1 Johnson 거부권 1866-02-19** | 거부 메시지: 평시에 민간인에게 군사 관할 확대, 요원이 배심 없이 재판, 11개 주가 의회 대표 없음, 비용·헌법 문제. https://teachingamericanhistory.org/document/veto-of-the-freedmens-bureau-bill/ (거부권 메시지 본문 요약 확인). 상원 재의결 실패, 7월 2차 법안은 재의결 — 기존 사실 목록 | Dunning의 '사회 생활 개입' 주장과 연결되나 거부 이유는 **반대자의 헌법 논거**지 백인 남부의 감정이 아님 → '개입' 주장만 뒷받침 | **조건**: 사실(군사 관할·배심 없는 재판·대표 없음)과 '개입/반대' 연결을 쓴 경우만 인정. 한계를 루브릭에 명시 |
| **B2 해방노예국 요원의 흑인 유권자 등록·정치 참여** | 1867 군사 재건법 이후 Bureau Circular No. 9(1867-05-01): 등록 자격 있는 해방민에게 알리고 협박을 무시하라 — https://www.visitthecapitol.gov/artifact/bureau-refugees-freedmen-and-abandoned-lands-circular-no-9-regarding-freedmens-right-vote (발췌 확인). 학술: Haggag·Stuart 연구, Bureau 사무소가 흑인 등록률을 약 13-14%p 높였다(워킹페이퍼 https://bryan-stuart.com/files/ChynHaggagStuart_Freedmen_20250628.pdf, 초록 수준 확인). **등록 자체는 군 사령관이 관리** | Dunning의 '국가 통제 수단' 인식과 연결 가능하나, 이전 정답 문구('요원이 등록하고 공화당과 협력')는 **과장**이었다 | **조건 부여·문구 수정**: 'Bureau가 등록을 했다'는 답은 불인정, 군 사령관 등록 한계 명시, 정치 통제 인식과 연결 필수 |
| **B3 Steedman-Fullerton 1866** | Johnson이 4월 7일 지시, 5월 8일 첫 보고(VA·NC). LOC 소책자 *The Freedmen's Bureau: Reports of Generals Steedman and Fullerton* 전문 읽음(https://www.loc.gov/resource/rbaapc.31600/): 요원의 "arbitrary, unnecessary, and offensive interference"가 백인과 해방민 사이 '적대'를 낳음, 요원이 농장·제재소 운영으로 농장주와 경쟁, 군대로 업무 이관 권고. 동시에 "judicious" 요원의 과거 공헌을 인정하고 요원이 간섭하지 않는 곳은 화목하다고 서술. 학술: Richardson, *Florida Historical Quarterly* 41 — 조사가 Bureau를 폄하하려는 의도(https://stars.library.ucf.edu/fhq/vol41/iss3/4/, 초록 수준) | Dunning의 '압제적 요원·백인 적대'와 직접 연결되나 조사는 **Bureau 반대자 Johnson이 임명**, 같은 보고서가 호의적 평가도 포함 | **조건**: 보고서가 Bureau 전체를 규탄했다거나 Dunning의 'diabolical device'를 입증했다는 주장 불인정. 한계 명시(질문에서 요구한 '연결의 한계') |
| **C1 Black Codes 1865-66** | Mississippi(1865-11)·South Carolina(1865-12): 서면 연간 노동계약, 실업자 부랑자 처벌·고용, 토지 임대 제한. https://teachingamericanhistory.org/document/black-codes-of-mississippi/ , https://www.nps.gov/articles/reconstruction.htm (NPS 요약), American YAWP 15장 https://www.americanyawp.com/text/15-reconstruction/ | 해방민의 경제적·시민적 권리가 위협받았다는 사실 → Bureau의 후견 필요성. '필요'를 보이지 Bureau의 성공을 보이지는 않음 | **조건**: 사실과 '보호 필요' 연결 필수. 이름만 쓰면 0 |
| **C2 Johnson의 토지 반환** | Sherman Field Order 15(1865-01) 토지, 1865-66 Johnson 사면 후 대부분 반환(Edisto Island). https://ldhi.library.cofc.edu/exhibits/show/after_slavery_educator/unit_three_documents/document_six , NARA Prologue https://www.archives.gov/publications/prologue/1997/summer/slave-emancipation , American YAWP(1866 반환 서술). **Howard가 1865-10 Edisto에서 반환을 명령했다는 서술은 2차 요약만 확인(Freedom 원전 미확인) → 루브릭에서 제외** | 국가가 해방민의 경제적 자립 지원에서 후퇴 → Du Bois의 'repudiated'와 연결. 단 반환을 집행한 것은 Bureau 자신 | **조건**: Bureau가 반대했다고 쓰면 불인정, 국가 지원 철회 연결 필수 |
| **C3 Fisk·Howard에 대한 Bureau의 역할(과장 금지)** | Fisk: 1866-01-09 개교, 설립자는 AMA의 Edward P. Smith·Erastus M. Cravath와 Bureau 교육 감독관 John Ogden, Clinton B. Fisk 장군이 옛 북군 병원 막사를 확보 — https://www.fisk.edu/?p=1294 , https://tennesseeencyclopedia.net/?p=800 (fetch 확인: Fisk가 Bureau 소속이라고 항목이 말하지는 않음). Howard: 1867-03-02 의회 인가, O. O. Howard 총국장이 설립자 중 한 명이고 대학명의 유래, Bureau가 초기 캠퍼스 지원·1869 의료관·병원 건설 — https://americanhistory.si.edu/brown/history/3-organized/howard-university.html , https://www.nps.gov/places/general-oliver-otis-howard-house.htm , https://medicine.howard.edu/about/history (검색 결과 요약만, 페이지 직접 fetch는 403·본문 부족) | **Bureau가 대학을 세웠다는 서술은 부정확**(Fisk는 AMA 주도, Howard는 의회 인가 연합). Du Bois 발췌가 이미 'Bureau 요원 교사·교육 지도자(Cravath)'를 언급 | **조건**: 정확한 역할(지원)만 인정, '설립했다'는 불인정, Cravath 재언급·일반 학교는 0. 근거가 직접 열람 부족한 Howard 재정 규모는 금액 없이 서술 |
| **C4 Bureau의 종료 1872** | NARA: 1865-03-03 설립, 1872 폐지, 업무 대부분은 1865-06~1868-12 — https://www.archives.gov/research/african-americans/freedmens-bureau | 'repudiated'와 연결 가능하나 종료 자체가 성과 증거는 아님 | **조건**: 연결 설명 필수. 이전 사실 목록의 '교육 업무 1870 종료'는 직접 확인하지 못해 **제거** |
| 이전 예시 **1866 Memphis·New Orleans 폭동** | 사건은 사실이나 이번에 근거를 직접 확인하지 않았고 연결(요원의 보호 실패 vs 필요)이 모호 | 불명확 | **루브릭에서 제거**(목록 밖 타당 답안으로는 인정) |
| 이전 B 예시 '요원이 공화당과 협력' | 근거 약함 | 과장 | 제거, B2로 대체(Circular 9) |

Du Bois '사실'에서 확인 못 한 것: Foner 1988 서문 직접 인용, Howard 재정 규모, Edisto에서 Howard의 구체적 발언. 해당 서술은 루브릭에 쓰지 않았다.

## 7. 루브릭 변경 요약

- B·C 공통: 0점 설명에 (i) 발췌에 이미 나온 사건·주장을 **반복**하면 0, (ii) 발췌에 없는 **구체적 외부 사실**(무슨 일, 누가, 대략 언제)을 더해 해석과의 연결을 설명하면 1 가능, 이름만 쓰고 연결하지 않으면 0을 명시. 예시 목록 밖의 타당한 사건·발전도 구체적·검증 가능·발췌 밖·자기 설명으로 연결되면 인정하고 판단 지침(사실을 말할 수 있는가, 발췌 밖인가, 해석과 연결했는가)을 노트에 명시.
- 예시마다 (a) 사실 (b) 연결 논리 (c) 한계·조건을 기록(부록 B 전문). Memphis·New Orleans 폭동·'공화당과 협력'·Howard의 Edisto 명령·교육 1870 종료 제거. Circular 9·Steedman-Fullerton 한계·Bureau 역할 정정 추가.
- 샘플: high — 거부권 메시지 내용과 연결 논리를 명시한 답안, Black Codes 구체 사실+연결. mid — B는 발췌 반복(0), C는 Black Codes 연결(1), A 1점=총 2. low — B 일반론(0), C는 'Black Codes were passed'만(0), A 1점=총 1.
- 독립 채점기 2개(Opus 5.5·Sonnet 5.5) 재검증: high 3/3, mid 2/2, low 1/1(의도와 일치). Fable 사실 점검: A·B·C·Notes·Samples 전부 sound, flag 0(회차 r3; 회차 r2도 동일 결과, 소개문 변경 후 r3로 재실행).

## 8. 갱신한 해시·증거

- itemContentHash: 이전 `c20c6c2a…a94` → 중간 `912ffed2…` → **최종 `9582f84b…`**(`data/ap/render-check/report.json` 해당 행 1개만 변경, 다른 8594행 그대로; `generatedAt`만 갱신). 화면 증거 `data/ap/screen-evidence/evidence-ush-r19.json`의 SAQ1 두 항목(390×844, 1280×800)을 새 해시로 교체(140항목 유지, 점검 7종 pass/na, 스크린샷 같은 경로 덮어쓰기).
- `data/ap/stock/ush-real-f-items.json`(SAQ1만 변경), `real-f-draft.json`, `real-f-verification.json`(r2·r3 기록 추가), `ush-real-f-{pass-keys,summary}.json`(키 변동 없음), 레지스트리·SOURCE.md·excerpt.txt, 빌드 스크립트·소스 추출 스크립트(Du Bois 순서·쪽).
- frozen config 해시 규칙(`data/ap/sample-2027/_frozen_check`)은 이번 변경과 무관(다른 과목 구성 검사).

## 9. US3 다른 FRQ·MC에 같은 표지가 필요한지 (보고만, 수정 없음)

- SAQ2(Penn 1701 헌장): 1차 자료, 해석 서술·인종 편견 서술 없음. 표지 불요(헌장은 기독교 신앙 고백자 대상 자유를 규정 — 자료 소개에 사실로 충분).
- SAQ3(Lange 'Migrant Mother' 사진): 1차 사진. 표지 불요.
- DBQ(냉전 국내 대응 7문서): 전부 1차 정부 문서·통계·사진. 당대 시각을 담은 선전·정책(EO 9835 충성 심사, FCDA 민방위 소책자)이 있으나 '역사가의 해석'이 아니므로 해석 표지는 불요. 다만 EO 9835 충성 심사가 후대에 시민적 자유 침해로 비판받은 점을 맥락 줄에 한 문장 두는 것은 선택 사항(오너 판단).
- LEQ: 자료 없음.
- **MC(`ush-real-g`)**: 제목만 점검(본문 재검증 안 함). Turner 1893(프런티어 해석, 원주민 서술), Hayes 취임사 1877, Beard 1913(해석 저작), Bryan 1922(진화론 반대 연설)는 저자의 해석·당대 편견을 담을 수 있으므로 SAQ1과 같은 한 줄 표지 여부를 별도 점검할 것을 권한다(수정은 SAQ1만).

## 10. 지출·절차

- 장부 시작 $510.1808 → 종료 $510.9399, **이번 작업 지출 $0.7591**(r2 $0.3674 + r3 $0.3917; 상한 잔여 약 $6.8 이내). 모두 `ush-real-f-verify.ts`(SAQ1만 `--only real_f_saq1`).
- 원격 DB 접근 없음. 격리 스택 `ALTON_apsaq1`(PORT_OFFSET=2900) 사용 후 `supabase stop --no-backup`, `config.toml` 원복, 임시 `.env.local`·`tmp` 삭제, 시드 `cleanup` 완료. 개발 서버는 node_modules 부재로 `next dev --webpack`을 사용했다(작업 중 디스크 부족 발생 → `.next` 삭제).

## 11. 총괄이 할 일 (재적재)

1. `ush-real-f` 배치 update 적재(`import-candidates.ts --items data/ap/stock/ush-real-f-items.json --batch ush-real-f-2026-10-21`, dry-run → `--execute`; SAQ1 한 건 payload 갱신, 해시 `9582f84b…`).
2. ② `mark-verified.ts --render` 드라이런→실행(렌더 해시 `9582f84b…` 대조), ③ `mark-verified.ts --screen --evidence data/ap/screen-evidence/evidence-ush-r19.json`(SAQ1 두 항목), ④ US3 새 버전 조립 전 `ush-remote-snapshot.ts` 재스냅샷과 `ush-us3-assign.ts` 위반 0 재확인. 적재된 이전 해시(`c20c6c2a…`) 검증 기록은 내용 해시 불일치로 무효가 되므로 재기록이 필요하다. 공개는 오너 확인 후.

## 부록 A. 학생 화면 문안 전문 (payload.set_intro, 코드가 레지스트리에서 생성)

````text
Historical source (real document)
These sources are real historical sources (excerpts are cut verbatim from the repository text, with any OCR corrections listed in the credit line; [...] marks an omission).

Source A (secondary source)
Reconstruction, Political and Economic, 1865-1877 (excerpt on the Freedmen's Bureau)
William Archibald Dunning (Professor of History and Political Philosophy, Columbia University), 1907 (The American Nation: A History, vol. 22; Harper & Brothers; excerpts from pp. 32 and 34). Internet Archive (scan of the 1907 first edition, Trent University Library copy; item reconstructionpo0022dunn). Reuse: public domain in the United States (published before 1929). excerpted (two passages, p. 32 and p. 34, joined by [...]); whitespace normalized; OCR corrections only: 'r6le' to 'rôle', and line-break hyphenations 'judg¬ ment' and 'oppres¬ sive' rejoined; no other wording changed.
Context: From a volume on Reconstruction published in 1907 by a Columbia University historian. Dunning's account reflects the racial prejudices of its time and has since been widely criticized by historians.

"The bureau assumed, in short, a general guardianship of the emancipated race, and, backed by the paramount military force of the United States, undertook to play a determining rôle in the process of reorganizing southern society. The orders and instructions issued by General Howard, the head of the bureau, for carrying out this comprehensive programme, were characterized almost uniformly by moderation and good judgment. [...] Hence the working of the bureau, with its intrusion into the fundamental relationships of social life, engendered violent hostility from the outset on the part of the whites. The feeling was enhanced by the conduct of the ignorant, unscrupulous, and deliberately oppressive agents who were not rare. As soon, therefore, as it became established, the bureau took the form, to the southern mind, of a diabolical device for the perpetuation of the national government’s control over the South, and for the humiliation of the whites before their former slaves."

———

Source B (secondary source)
Reconstruction and Its Benefits (excerpt on the Freedmen's Bureau)
W. E. Burghardt Du Bois (Atlanta University); paper read at the American Historical Association, December 1909, 1910 (American Historical Review, vol. 15, July 1910, pp. 781-799; excerpts from p. 782 and p. 783). Internet Archive (JSTOR Early Journal Content, item jstor-1836959). Reuse: public domain in the United States (published before 1929). excerpted (two passages in their original order, p. 782 then p. 783, joined by [...]); whitespace normalized; line-break hyphenations 'educa- tional', 'gov- ernment', 'physi- cally' and 'social- istic' rejoined; no other wording changed.
Context: From an article by a Black historian and sociologist with a Harvard doctorate, presented to the American Historical Association in December 1909 and published in 1910. It was an early challenge to the then-dominant view of Reconstruction taught by Dunning and his students.

"It must not be forgotten that among the agents of the Freedmen's Bureau were not only soldiers and politicians but school-teachers and educational leaders like Ware and Cravath. [...] The Freedmen's Bureau was an attempt to establish a government guardianship over the negroes and insure their economic and civil rights. Its establishment was a herculean task both physically and socially, and it not only met the solid opposition of the white South, but even the North looked at the new thing as socialistic and over-paternal. It accomplished a great task but it was repudiated."
````

### 지문 장면(prompt.scenario)과 요구사항

````text
Use the two excerpts below to answer parts A, B, and C. Each excerpt is its author's interpretation of the Freedmen's Bureau, the federal agency created by Congress in March 1865 to assist formerly enslaved people in the South.
Using the excerpts, answer parts A, B, and C.
- Answer all three parts.
- Each part is worth one point.
- Use specific historical evidence for parts B and C.
````

### 질문 A·B·C (학생에게 보이는 문장)

- **(A)** [1 point] Briefly describe ONE major difference between Dunning's and Du Bois's interpretations of the Freedmen's Bureau.
- **(B)** [1 point] Briefly explain how ONE specific historical event or development from 1865 to 1877 that is not mentioned in the excerpts supports Dunning's interpretation.
- **(C)** [1 point] Briefly explain how ONE specific historical event or development from 1865 to 1877 that is not mentioned in the excerpts supports Du Bois's interpretation.

## 부록 B. 수정 루브릭 전문 (payload.ush_frq.rubric)

### 행 A - Part A (max 1)

- 0점: The response only restates one excerpt, describes a similarity, or misstates what an excerpt says.
- 1점: The response accurately describes a difference between the two authors' interpretations of the Bureau.

**과제별 기준(task_specific)**

Describe one accurate difference between the two excerpts. Acceptable differences include: Dunning stresses the Bureau's intrusion into Southern social life and the hostility it aroused among white Southerners, while Du Bois stresses the Bureau's task of protecting freed people's economic and civil rights; Dunning faults the Bureau's local agents, while Du Bois credits Bureau agents who were teachers and educators; Dunning describes the Bureau as it appeared to the white South, while Du Bois judges that it accomplished a great task but was repudiated.

### 행 B - Part B (max 1)

- 0점: The response gives no event, an inaccurate or out-of-period event, only repeats an event or claim already in the Dunning excerpt, names an event without explaining how it supports Dunning, or adds an outside fact that does not bear on his interpretation.
- 1점: The response adds a specific, accurate event or development from 1865 to 1877 that is not in the excerpts and explains how it supports Dunning's interpretation.

**과제별 기준(task_specific)**

Credit requires BOTH (a) one specific, accurate event or development from 1865 to 1877 that the excerpts do not mention (what happened, who acted, roughly when) AND (b) an explicit explanation of how that fact supports Dunning's interpretation: the Bureau's intrusion into Southern life, the white hostility it provoked, its agents' conduct, or its role as an instrument of national control. A response that only repeats an event or claim already in the Dunning excerpt (for example that white Southerners resented the Bureau, that some local agents were oppressive, or that the Bureau intruded into social life) earns 0, even if it is true. A response that adds a specific outside fact and explains its connection may earn 1. Examples with the connection each needs (not an exhaustive list): (1) President Andrew Johnson's veto of the Freedmen's Bureau Bill on February 19, 1866: his veto message objected that the bill would extend military jurisdiction over civilians in peacetime, with Bureau agents acting as judges without juries, in eleven states that had no representation in Congress; the response must tie this objection to Dunning's claim that the Bureau intruded into Southern life and met opposition (the veto was one opponent's largely constitutional argument, so it supports the 'intrusion' claim, not Dunning's description of white feeling). (2) The Steedman-Fullerton inspection of 1866: Johnson sent Generals James Steedman and Joseph Fullerton to inspect the Bureau in the South (instructions of April 7, first report May 8, 1866); they reported that many agents interfered 'arbitrarily' in planter-laborer relations and sat in freedmen's courts deciding land and family disputes, that some officers competed with planters by running plantations and sawmills, and that this produced bitterness between whites and freedpeople, and they recommended transferring Bureau duties to the army; the response must tie these reported agent practices and resentment to Dunning's claims about oppressive agents and white hostility (limits: Johnson, an opponent of the Bureau, appointed the commissioners and later historians describe the inquiry as meant to discredit the Bureau; the same report praised 'judicious' officers and found good order where agents did not interfere; do not credit a response that says the report condemned the whole Bureau or proved Dunning's 'diabolical device' description). (3) The Bureau's role in Black voting in 1867: after the Military Reconstruction Acts of March 1867 required Southern states to elect constitutional conventions with Black men voting, Bureau Circular No. 9 (May 1, 1867) said measures would be taken to inform freedmen entitled to register and urged them to disregard threats; the response must tie the Bureau's involvement in Black registration and voting to Dunning's claim that white Southerners saw the Bureau as an instrument of national control (limit: army commanders, not the Bureau, ran registration; do not credit a response that says Bureau agents registered the voters or ran the elections). Other accurate events or developments from 1865 to 1877 are accepted when they are specific, verifiable, not in the excerpt, and linked to Dunning's claim by the response's own explanation. Naming an event without connecting it to the interpretation earns 0.

### 행 C - Part C (max 1)

- 0점: The response gives no event, an inaccurate or out-of-period event, only repeats an event or claim already in the Du Bois excerpt, names an event without explaining how it supports Du Bois, or adds an outside fact that does not bear on his interpretation.
- 1점: The response adds a specific, accurate event or development from 1865 to 1877 that is not in the excerpts and explains how it supports Du Bois's interpretation.

**과제별 기준(task_specific)**

Credit requires BOTH (a) one specific, accurate event or development from 1865 to 1877 that the excerpts do not mention (what happened, who acted, roughly when) AND (b) an explicit explanation of how that fact supports Du Bois's interpretation: the Bureau as an attempt to protect freed people's economic and civil rights, a great task accomplished, and a task repudiated. A response that only repeats what the Du Bois excerpt already says (that the Bureau met white opposition, that it was repudiated, or that its agents included teachers) earns 0; naming an event without explaining the link earns 0; adding a specific outside fact and explaining the link may earn 1. Examples with the connection each needs (not an exhaustive list): (1) The Black Codes of 1865-1866: in late 1865 legislatures such as Mississippi's and South Carolina's passed laws requiring freed workers to hold written yearly labor contracts, treating those without lawful employment as vagrants who could be fined and hired out, and restricting their rights in other ways; the response must tie the codes to the economic and civil rights Du Bois says the Bureau was meant to protect (limit: the codes show the need for protection, not that the Bureau succeeded). (2) Johnson's reversal of land policy, 1865-1866: Sherman's Special Field Order No. 15 (January 1865) had set aside coastal land in South Carolina and Georgia for freed families; after Johnson's amnesty and pardons, most of it, including land on Edisto Island, South Carolina, was returned to former owners in 1865-1866; the response must tie this to the national government's withdrawal of support for freed people's economic independence and so to Du Bois's judgment that the Bureau's work was repudiated (limit: Bureau officers themselves carried out the restoration; do not credit a response that says the Bureau opposed it). (3) Bureau support for Black colleges, credited only with an accurate role: the Fisk Free Colored School opened in Nashville in January 1866, founded by American Missionary Association representatives together with Bureau education superintendent John Ogden, and General Clinton B. Fisk helped secure former Union army hospital barracks for it; Howard University was chartered by Congress on March 2, 1867, was named for Bureau Commissioner O. O. Howard, who was one of its founders, and the Bureau helped fund its early campus (including a medical building and hospital in 1869); the response must tie the support to Du Bois's claim that the Bureau accomplished a great task (limits: do not credit a response that says the Bureau founded either college alone; the Du Bois excerpt already names Bureau teachers and educational leaders, so a general reference to Bureau schools, or to Cravath, earns 0). (4) The end of the Bureau: most of its work ended by 1868-1869 and Congress discontinued its remaining functions in 1872, while the rights of freed people were still contested; the response must tie this to Du Bois's judgment that the Bureau was repudiated (the end of the Bureau alone is not evidence that its work was a success). Other accurate events or developments from 1865 to 1877 are accepted when they are specific, verifiable, not in the excerpts, and linked to Du Bois's claim by the response's own explanation.

### 채점 노트(scoring_notes)

- Each part is worth one point. Parts are scored separately.
- In part A, the difference must be about the two interpretations of the Bureau. Describing only one author, or a similarity, does not earn the point.
- In parts B and C, the scoring turns on two questions. (i) Does the response add a specific outside fact (what happened, who, roughly when) that is not in the excerpts? Repeating an event or claim the excerpt already makes earns 0; adding a specific fact the excerpt does not contain may earn 1. (ii) Does the response explain how that fact supports THIS author's interpretation? A bare event name, or an event that merely happened in the Reconstruction period, earns 0. The events listed in the criteria are examples, not a complete list: accept any other accurate, specific, verifiable event or development from 1865 to 1877 that is not in the excerpts when the response explains how it fits the author's claim, and apply the conditions and limits stated for the listed examples.
- Do not accept events that the excerpts already mention (for example Bureau agents who taught school in part C). Credit the Bureau's support for specific colleges only for the accurate role described in part C.
- Dunning's account is one historian's 1907 interpretation; it reflects the racial prejudices of its time and has been widely criticized by later historians. Du Bois's article is also one historian's interpretation and was an early challenge to the Dunning view. Answers should describe the authors' interpretations without endorsing either.
- ALTON practice rubric, not official College Board scoring: model scores are an ALTON estimate and no AP score is implied.

### 허용 답안 예시(expected_features.saq_answers)

**A**

- Dunning emphasizes that the Bureau's intrusion into Southern social life aroused violent hostility among white Southerners, while Du Bois emphasizes that it was an attempt to protect freed people's economic and civil rights.
- Dunning points to ignorant or oppressive local agents, while Du Bois points to Bureau agents who were teachers and educational leaders.
- Dunning describes how the Bureau looked to the white South (a device for humiliating whites), while Du Bois judges that the Bureau accomplished a great task and was repudiated.

**B**

- Andrew Johnson vetoed the Freedmen's Bureau Bill on February 19, 1866, objecting that it would extend military jurisdiction over civilians in peacetime, with agents acting as judges without juries, in states that had no representation in Congress; this shows a contemporary view that the Bureau intruded into Southern life, which fits Dunning's claim.
- In 1866 Generals Steedman and Fullerton, sent by President Johnson, reported that many Bureau agents interfered arbitrarily in relations between planters and laborers and that this bred bitterness between whites and freedpeople; this documents the agent conduct and hostility Dunning describes (though the inquiry was appointed by an opponent of the Bureau).
- After Congress required Black men to vote in the constitutional conventions of 1867, the Bureau (Circular No. 9, May 1867) told freedmen how to register and to disregard threats; white Southerners who saw the Bureau backing Black voters could read it as an instrument of national political control, as Dunning says.

**C**

- In late 1865 Southern legislatures such as Mississippi's and South Carolina's passed Black Codes that required freed workers to hold yearly written labor contracts and punished those without lawful employment as vagrants, which shows the need for the protection of economic and civil rights that Du Bois says the Bureau attempted.
- In 1865 and 1866 President Johnson's amnesty and pardons led to the return of most of the land that Sherman's Field Order No. 15 had set aside for freed families, including land on Edisto Island, South Carolina; the national government's withdrawal of support for freed families' economic independence supports Du Bois's point that the Bureau's task was repudiated.
- Howard University was chartered by Congress in 1867 and named for Bureau Commissioner O. O. Howard, and the Bureau helped fund its early campus; Bureau support for such institutions supports Du Bois's statement that the Bureau accomplished a great task.
- Most of the Bureau's work had ended by 1868-1869 and Congress discontinued its remaining functions in 1872, while freed people's rights were still contested, which supports Du Bois's statement that the Bureau was repudiated.

### 흔한 오답 / 사실 목록

- (오답) Describing a similarity between the two excerpts instead of a difference.
- (오답) Repeating something the excerpt already says (white hostility in part B; teachers who were Bureau agents or white opposition in part C) instead of adding a new fact.
- (오답) Naming an event (for example the Black Codes) without saying how it supports the author.
- (오답) Saying that Bureau agents registered Black voters, or that the Bureau alone founded Fisk or Howard University.
- (오답) Assigning the Du Bois view to Dunning or the reverse.
- (사실) Congress created the Freedmen's Bureau on March 3, 1865, within the War Department; Oliver Otis Howard was appointed Commissioner in May 1865, and the Bureau was not abolished until 1872, though most of its work took place between June 1865 and December 1868.
- (사실) President Andrew Johnson vetoed the Freedmen's Bureau Bill on February 19, 1866, objecting that it would extend military jurisdiction over civilians in peacetime, with agents acting as judges without juries, in eleven states without representation in Congress; the Senate failed to override that veto, and Congress overrode his veto of a second bill in July 1866.
- (사실) Generals James Steedman and Joseph Fullerton, appointed by Johnson, inspected the Bureau in 1866 (instructions of April 7; first report May 8, 1866), criticized agents who interfered 'arbitrarily' in planter-laborer relations and officers who ran plantations and sawmills, praised 'judicious' officers, and recommended turning Bureau duties over to the army.
- (사실) After the Military Reconstruction Acts of March 1867, Bureau Circular No. 9 (May 1, 1867) said measures would be taken to inform freedmen entitled to be registered and urged them to disregard threats; army commanders supervised registration.
- (사실) In late 1865 the legislatures of Mississippi and South Carolina, among others, passed Black Codes that required written yearly labor contracts, treated the unemployed as vagrants, and limited freed people's rights.
- (사실) General William T. Sherman's Special Field Order No. 15 (January 1865) set aside coastal land in South Carolina and Georgia for freed families; after Johnson's amnesty and pardons most of that land was returned to former owners in 1865-1866.
- (사실) The Fisk Free Colored School opened in Nashville in January 1866, founded by American Missionary Association representatives (Edward P. Smith, Erastus M. Cravath) with Bureau education superintendent John Ogden; General Clinton B. Fisk helped secure former Union army hospital barracks for it.
- (사실) Howard University was chartered by Congress on March 2, 1867, and named for Commissioner O. O. Howard, a founder; the Bureau helped fund its early campus and built a medical building and hospital there in 1869.
- (사실) Historians of the Dunning school, named for William A. Dunning, portrayed Reconstruction as misgovernment; Du Bois challenged that view in Black Reconstruction in America (1935), and most historians abandoned the Dunning interpretation by the 1960s (Eric Foner).

### 3단계 샘플 답안과 독립 채점기 점수

**high** (모델 채점 중앙값 3, 채점기 2개 [3, 3])

````text
(A) Dunning and Du Bois describe the Bureau from opposite points of view. Dunning stresses how the Bureau's reach into Southern social life made white Southerners hostile and treats many local agents as unfit, while Du Bois treats the Bureau as a great task meant to protect freed people's economic and civil rights that the country abandoned too soon.

(B) One development that supports Dunning is President Andrew Johnson's veto of the Freedmen's Bureau Bill on February 19, 1866. In his veto message Johnson objected that the bill would extend military jurisdiction over civilians in peacetime, with Bureau agents acting as judges without juries, in states that had no representatives in Congress. That objection shows a contemporary view that the Bureau reached deep into Southern civil life, which fits Dunning's claim that its working intruded into Southern society and aroused opposition.

(C) One development that supports Du Bois is the passage of the Black Codes in late 1865. Legislatures such as Mississippi's and South Carolina's required freed workers to hold written yearly labor contracts and treated those without lawful employment as vagrants who could be fined and hired out. These laws threatened the economic and civil rights that Du Bois says the Bureau was meant to guarantee, so they show why the protection he describes was needed.
````

**mid** (모델 채점 중앙값 2, 채점기 2개 [2, 2])

````text
(A) Dunning thinks the Freedmen's Bureau caused hostility among white Southerners, but Du Bois thinks it was a good attempt to protect the rights of freed people.

(B) Many white Southerners did not like the Bureau and resisted its agents. This supports Dunning because he says the Bureau caused violent hostility among the whites.

(C) The Black Codes passed by Southern states in late 1865 limited what freed people could do. Many codes required freed people to have a job and treated those who did not as vagrants, so freed people needed the Bureau to protect their rights, which is what Du Bois says.
````

**low** (모델 채점 중앙값 1, 채점기 2개 [1, 1])

````text
(A) Dunning and Du Bois both write about the Freedmen's Bureau, but Dunning says that white Southerners hated it and Du Bois says it did a great task.

(B) Reconstruction was a hard time in the South and many people disagreed about what to do after the Civil War, which supports what Dunning says.

(C) The Black Codes were passed in the South, and Du Bois also writes about the Bureau.
````

### 모범 답안(parts[].model_answer)

- (A) Dunning emphasizes that the Bureau's intrusion into Southern social life aroused violent hostility among white Southerners, while Du Bois emphasizes that it was an attempt to protect freed people's economic and civil rights.
- (B) Andrew Johnson vetoed the Freedmen's Bureau Bill on February 19, 1866, objecting that it would extend military jurisdiction over civilians in peacetime, with agents acting as judges without juries, in states that had no representation in Congress; this shows a contemporary view that the Bureau intruded into Southern life, which fits Dunning's claim.
- (C) In late 1865 Southern legislatures such as Mississippi's and South Carolina's passed Black Codes that required freed workers to hold yearly written labor contracts and punished those without lawful employment as vagrants, which shows the need for the protection of economic and civil rights that Du Bois says the Bureau attempted.

