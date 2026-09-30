# 2026-10-01 RW 원문 코퍼스 계획서

## 실행 방법 (오너가 터미널에서 직접 — 에이전트는 이 명령을 실행하지 않는다)
범위: 원천 3개만(매니페스트 `approved=true`: **Project Gutenberg**, **MedlinePlus 공식 XML**, **PLOS**), 전체 상한 **150MB**(Gutenberg 105·MedlinePlus 35·PLOS 15), 저장 위치 `~/Developer/ALTON-data/rw-corpus/`(저장소·iCloud 밖, 원문 본문은 커밋하지 않음). 나머지 원천은 `approved=false` 유지. 모든 요청은 공식 경로만(Gutenberg 공식 rsync 미러·공식 카탈로그, MedlinePlus 공식 XML, PLOS 공식 Search API — allofplos.zip 5GB 덤프는 쓰지 않음), 원천별 요청 간격(Gutenberg 2.5초·PLOS 7초·MedlinePlus 1초), User-Agent 에 연락처 명시, 디스크 여유 20GB 미만이면 중단.
1. **dry-run(받을 목록·예상 용량·거부 사유·디스크 여유만 확인, 원문은 받지 않음)** — 저장소 루트에서:
```
CORPUS_CONTACT="본인이메일@example.com" scripts/rw-corpus/run.sh
```
   (목록 생성 중 MedlinePlus 최신 파일 확인용 HEAD 요청 몇 건만 나가고, Gutenberg 는 이미 받아 둔 카탈로그로 로컬 선별만 합니다. 카탈로그가 없으면 dry-run 은 받지 않고 안내만 합니다.)
2. **실제 수집(승인된 3개 원천, 재개 가능·재실행 안전)**:
```
CORPUS_CONTACT="본인이메일@example.com" scripts/rw-corpus/run.sh --execute
```
   중간에 끊겨도 같은 명령을 다시 실행하면 이미 받은 항목(`.meta.json` 있는 것)은 건너뜁니다.
3. **끝났을 때 확인 방법**:
```
cat ~/Developer/ALTON-data/rw-corpus/summary.json     # 원천별 항목 수·용량·제외 사유·라이선스 분포
du -sh ~/Developer/ALTON-data/rw-corpus/*              # 원천별 디스크 사용(합계 150MB 이하)
ls ~/Developer/ALTON-data/rw-corpus/items/*/ | head    # 항목 파일(.txt + .meta.json)
```
   각 항목의 `.meta.json` 에 라이선스·원문 URL·수집 시각·SHA-256·출처 표시 문구가 기록됩니다. 저장소에는 본문이 없습니다(`git status` 깨끗해야 함).

---
# (이전 내용) RW 원문 코퍼스 계획서 (문서 작성만 — 다운로드·크롤링·대량 API 호출 없음)

**범위와 원칙**: 오너 확정 — RW 지문에 **저작권이 자유로운 원문 발췌**를 도입한다. 이 문서는 원천·기준·검증·메타데이터·승인 목록만 정한다. 원문 문장은 이 문서·저장소에 넣지 않는다(원천과 기준만). 아래 약관 요약은 **공식 페이지를 열람한 결과이며 법률 자문이 아니다.** 원천별로 실제 다운로드 전에 해당 페이지를 재확인하고 필요하면 법률 검토를 받는다.

## 1. 허용 원천과 조건

| 원천 | 저작권 상태·조건 | 사용 여부 | 근거(열람한 페이지) |
|---|---|---|---|
| **미국 퍼블릭 도메인 영어 원작** — 기본적으로 1930년 이전 출판(미국 기준), 원서(영어 원작)만, **번역본 제외**(번역 저작권 별도, 번역자 사망·출판 시점 확인이 작품별로 필요) | 미국에서는 저작권 만료. 저작권 만료 여부는 국가별로 다르다(미국 밖에서는 아직 보호될 수 있음) — 서비스 대상이 미국·한국이므로 **한국 기준(저자 사후 70년)도 함께 확인**하고, 불명확하면 제외한다 | **허용(한국 기준 교차 확인 조건부)** | Project Gutenberg 이용 안내: "Most Project Gutenberg eBooks are in the public domain in the US"; 상업 이용에 로열티 없음, 출처 표기는 선택이나 권장, 미국 밖 이용자는 별도 확인 필요. https://www.gutenberg.org/policy/permission.html |
| **미국 연방정부 저작물**(NASA·NOAA·NIH·USGS·NPS 등 정부 기관이 직접 만든 글) | 17 U.S.C. § 105(a): "Copyright protection under this title is not available for any work of the United States Government." 단 **정부 간행물에 실린 제3자 저작물은 보호가 그대로 남는다**(이미지·인용·기여 글 등) | **허용(정부 직접 작성 글만)** | https://www.law.cornell.edu/uscode/text/17/105 |
| NASA 자료 | 대체로 미국 저작권 보호 대상이 아니고 교육 목적 이용에 별도 허가 불필요, "NASA should be acknowledged as the source"; 상업 이용에서 NASA의 보증을 암시하면 안 됨, 제3자 저작물(저작권 표시 이미지 등)·로고 제한 | **허용(출처 표기, 보증 암시 금지)** | https://www.nasa.gov/nasa-brand-center/images-and-media/ |
| NOAA·NIH 자료 | 정부 직접 작성 글은 위 § 105 에 따르지만, **NIH 저작권 안내 페이지는 403(접근 거부), NOAA 는 해당 주제가 그 페이지에 없어 개별 정책 문구를 확인하지 못했다** | **조건부 — 다운로드 전 각 기관의 공식 이용 정책 재확인 필수** | 확인 실패(위 설명) |
| **CC0 1.0** | 저작권 포기: "You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission." 출처 표기 불필요(저자 보증 암시는 금지), 특허·상표·초상권 등은 별개 | **허용** | https://creativecommons.org/publicdomain/zero/1.0/ |
| **CC BY 4.0 / 3.0** | 상업 이용·각색 허용, **출처 표시 의무**(저작자·링크·라이선스 링크·변경 표시), 추가 제한 금지, **ShareAlike 없음** | **허용(출처 표시 의무를 문항 메타와 학생 화면 출처 란에 구현하는 조건)** | https://creativecommons.org/licenses/by/4.0/ |
| **CC BY-SA(위키백과·위키문헌 등)** | 각색물을 **같은 라이선스(CC BY-SA)로 배포해야** 하는 ShareAlike 조건: "you must distribute your contributions under the same license as the original" | **제외** — 문항·지문이 2차 저작물이 되어 문제은행·세트 전체를 CC BY-SA 로 공개해야 할 위험이 있고, 회사 콘텐츠의 독점 운영과 충돌한다. 위키백과 본문은 "Creative Commons Attribution-ShareAlike 4.0"(및 GFDL) 이중 라이선스다 | https://en.wikipedia.org/wiki/Wikipedia:Copyrights |
| 그 밖(저작권 미확인 웹 글, 교과서, 신문·잡지 현대 기사, AP·SAT 기출) | 저작권 보호 | **제외** | — |

추가 기준: (a) **번역본 제외**(한국어·외국어 원작을 영어로 옮긴 것은 번역 저작권이 별개), (b) 퍼블릭 도메인 작품의 **현대판 편집본·주석·서문**은 별도 저작권이 있을 수 있어 **본문만** 쓰고 편집자 주는 제외, (c) 국가별 저작권 만료 차이로 저자 사망 연도가 1955년 이후인 작가(한국 기준 70년 미만)는 제외 또는 별도 검토, (d) 삽화·표·그래프가 있으면 그림은 별도 라이선스라 본문 텍스트만 쓴다.

## 2. skill별 원문 적합성

| 구분 | skill | 방침 | 이유 |
|---|---|---|---|
| **원문 발췌가 잘 맞음** | `central_ideas_details`, `inferences`, `words_in_context`(문맥 의미·빈칸), `text_structure_purpose`, `cross_text_connections`(두 발췌 또는 원문 + 정부자료 글), `command_of_evidence_text`(논증 글) | 원문 발췌를 기본으로, 문항(질문·선택지·해설)만 AI 가 작성 | 긴 지문의 논리·어조·구조를 실제 글로 다루는 유형. 현대 문체 차이는 §3 완화 방침으로 관리 |
| **AI 짧은 지문 유지** | `transitions`, `boundaries`, `form_structure_sense`, `rhetorical_synthesis`(메모 목록) | 기존 AI 창작 유지 | 문장 단위 조작(쉼표·시제·전환어)이 필요해 원문을 그대로 쓰기 어렵고, 원문을 고치면 '발췌 일치 검증'(§4)이 깨진다. 메모 목록은 원래 창작 구조 |
| **현대 문체가 필요** | 현대 과학·기술·사회과학 글(`command_of_evidence_quant`의 표·그래프 해석, 일부 `inferences`) | AI 창작 유지(또는 정부 자료 NASA·NOAA 글 발췌) | 1930년 이전 글에는 현대 통계·연구 설계 맥락이 없다. **기존 작품 베끼기 방지**를 위해 AI 창작 지문도 원문 코퍼스와 본문 유사도(3-gram Jaccard, 임계값 0.4부터 경고·0.6 차단)를 검사한다 |

## 3. 발췌 기준
- **길이**: SAT RW 지문 길이에 맞춘다 — 단일 지문 문항 약 60~150단어(빈칸형은 25~90단어), Text 1/Text 2 는 각 50~120단어. 원문 문장 경계에서 자르고 문장 중간 절단 금지.
- **자족성**: 발췌 단독으로 질문에 답할 수 있어야 한다(대명사 지시·생략된 앞선 사건이 문제 풀이에 필수이면 제외). 배경이 필요하면 **도입 문구**(예: 화자·장면 설명)를 문항 지시문으로 덧붙이되 원문 텍스트는 바꾸지 않는다.
- **소재 다양성 배분표**(발췌 풀 기준 목표 비율, 같은 작품·저자 재사용 한도):

| 축 | 배분 | 한도 |
|---|---|---|
| 장르 | 문학(소설·시·드라마 대사) 30% · 인문(역사·철학·에세이) 25% · 자연과학(정부 자료·과학 에세이) 25% · 사회과학(경제·심리·교육 에세이) 20% | 장르 안에서 같은 작가 3개 초과 금지 |
| 시대 | 1800년 이전 15% · 1800~1899 45% · 1900~1929 40% | 작품 1개당 발췌 4개 이하, 발췌 간 본문 겹침 없음 |
| 주제 | 자연·과학 · 사회 · 예술 · 역사 · 인물 · 일상 6범주 균등(각 13~20%) | 같은 세부 소재(예: 특정 사건) 재사용 시 세트 간 간격 제한 |
| 지문 구조 | 서술·논증·비교·서사 대화 | 세트 내 같은 구조 40% 초과 금지 |

- **현대 영어와의 차이 완화**: (1) 1900~1929 작품 비중을 높인다, (2) 고어 어휘·긴 종속절이 풀이를 지배하는 발췌 제외, (3) 문항은 현대 SAT 형식으로 작성, (4) 철자 차이(영국식)·구두점은 **원문 그대로 유지**(검증 일치를 위해 수정하지 않음), (5) 문체 난이도는 난이도 라벨에 반영하지 않고(어휘 난도 자체로 hard 를 만들지 않는 기존 원칙) 추론 구조로만 난이도를 정한다.

## 4. 인용 일치 검증(코드)
- **원문 코퍼스 파일**(텍스트 + 출처 메타)에서 발췌 위치(문자 오프셋 또는 문단 번호)만 문항 생성기에 넘기고, 문항의 지문은 **코드가 원문에서 잘라 넣는다**(AI 는 발췌를 쓰지 않고 위치만 고르거나 코드가 후보 구간을 제시). AI 가 지문을 새로 쓰는 경로가 없으므로 인용 조작이 구조적으로 불가능하다.
- 그래도 **사후 검증**: 문항 passage 를 정규화(공백·개행·따옴표 통일만 허용)해 원문 파일에서 `indexOf` 로 **글자 그대로 일치**함을 확인하고, 불일치하면 문항 탈락. `evidence_span`·밑줄·인용 단어도 지문 안에 그대로 있는지 같은 방식으로 확인(기존 `evidence-model-check`와 같은 원칙).
- **생략 표기 규칙**: 발췌 중간 생략은 `[…]`(대괄호 + 줄임표) 하나로만 표시하고, 생략 전후가 각각 원문에서 연속 구간임을 검증한다(구간 2개의 각각 일치). 문장 앞·뒤가 잘리면 `…`를 앞·뒤에 붙이지 않고 문장 경계에서 자른다. 철자·구두점·대소문자는 수정하지 않는다(현대화 금지). 고유명사 각주·서지 표기 제거는 허용하되 그 사실을 메타(`editorial_changes`)에 기록한다.

## 5. 출처 메타데이터 스키마(제안 — 마이그레이션이 필요하면 **제안만**, 이번에 적용하지 않음)
문항 품질 JSON(`problem_versions.quality`)에 다음을 저장하는 방식을 우선 제안한다(기존 `quality.mockExamGeneration` 옆, 스키마 변경 없이 가능):
```
quality.sourceText: {
  corpusId: string,          // 코퍼스 내 고유 ID
  author: string, work: string, publishedYear: number,
  sourceUrl: string,         // 원문 공개 URL(Gutenberg·정부 사이트 등)
  license: "public_domain_us" | "us_gov_work" | "cc0" | "cc_by_4.0" | "cc_by_3.0",
  attribution: string|null,  // CC BY·NASA 등 출처 표시 문구(학생 화면 출처 란에 그대로 사용)
  excerpt: { startChar: number, endChar: number, paragraphRange?: string, elisions?: [ [number, number] ] },
  editorialChanges: string[], // 예: "각주 제거"
  verifiedAt: string, verifiedBy: "code:quote-match-v1",
  koreaCopyrightChecked: boolean
}
```
- 마이그레이션이 필요한 경우(제안): (a) 학생 화면·관리자 화면에 **출처 표기 란**을 구조적으로 제공하려면 `problem_versions` 에 `source_attribution text`(nullable) 컬럼 추가 또는 전용 `problem_sources` 테이블(problem_id, 위 필드) — 조회 성능·필터링(라이선스별 집계)이 필요하면 테이블이 낫다. (b) CC BY 의무를 지키려면 학생 결과·문항 보기 화면의 출처 란 렌더링이 필요하다(UI 변경 동반). **이번 단계에서는 실행하지 않는다.**

## 6. 수작업 시작 전 승인받을 목록
| 원천 | 다운로드 범위(제안) | 예상 용량 | 저장 위치(제안) | 승인 필요 사항 |
|---|---|---|---|---|
| Project Gutenberg(미국 PD, 1930년 이전 영어 원작) | 작가·작품 화이트리스트 80~120편(장르·시대 배분표 기준) 개별 텍스트 파일만(전체 미러·크롤링 금지, 공식 다운로드 링크 수동/스크립트 소량) | 작품당 0.3~1.5MB, 합계 약 50~120MB | 저장소 밖 작업 디렉터리(`~/Developer/ALTON-corpus/`, 예시) + 저장소에는 **발췌 위치·출처 메타만**(원문 텍스트는 커밋하지 않음) | 화이트리스트, 한국 저작권 교차 확인 기준, 편집본 제외 기준 |
| NASA(정부 직접 작성 글) | 교육·과학 해설 기사 100~200건 | 합계 10~30MB | 동일 | 제3자 저작물·이미지 제외 확인, 출처 표기 문구 승인 |
| NOAA·NIH·USGS 등 | 기관별 이용 정책 재확인 후 50~100건 | 합계 10~30MB | 동일 | NIH·NOAA 정책 페이지 확인(이번 열람 실패) |
| CC0·CC BY 원문(학술 오픈액세스 등) | 선택 — 원천 후보 조사 후 별도 승인 | 미정 | 동일 | CC BY 출처 표시 UI 구현 승인 |
- **자동화 조건**: 크롤링·대량 수집은 각 사이트 robots·약관을 재확인하고 **총괄 승인 후** 소량 요청(속도 제한)으로만. 이번 작성 단계에서는 다운로드하지 않았다.
- **예상 비용·소요**: 코퍼스 구축(수작업 큐레이션 + 스크립트) 약 3~5일, 발췌 후보 자동 추출(코드, API 불필요) 0, 문항 생성(질문·선택지·해설만, 지문 생성 없음)은 기존 생성 비용의 약 70%(지문 생성 토큰 절감) 수준으로 추정. 인용 일치 검증은 코드라 API 비용이 없다. 최종 수량(skill별 원문 기반 문항 수)은 30세트 로드맵의 RW 부족분에서 원문 적합 skill 비중(약 50~60%)에 맞춰 정한다.
- **승인 요청 항목 요약**: (1) 허용 원천 표 전체(특히 NOAA·NIH 재확인), (2) 작가·작품 화이트리스트와 한국 저작권 교차 확인 방식, (3) 저장 위치(저장소 밖)와 용량, (4) 출처 메타 저장 방식(품질 JSON 우선, 테이블/컬럼은 제안), (5) CC BY 채택 시 출처 표시 UI, (6) 크롤링 여부.


---
# 추가 지시 반영(2026-10-01): A 확보 매니페스트 · B 수집기 · C 발췌 자동화 · D 파일럿 설계

## A. 원문 확보 매니페스트(`data/mock-exam-generation/rw-corpus/manifest.json`)
저장 위치: 저장소 밖 `~/Developer/ALTON-data/rw-corpus/`(iCloud 아님), **저장소에는 매니페스트·메타만 커밋, 원문 본문은 커밋하지 않는다.** 디스크 예산 5GB 이하, 수집 전후 `df` 로 여유가 20GB 미만이면 중단(현재 여유 약 33GB). 아래 용량·후보 수는 추정이다.
| 원천 | 공식 접근 경로(약관·robots 확인) | 라이선스와 근거 URL | 예상 파일 수 | 예상 용량(MB) | 예상 발췌 후보 | 상태 |
|---|---|---|---|---|---|---|
| Project Gutenberg (미국 퍼블릭 도메인 영어 원작) | 공식 미러(rsync, /help/mirroring.html) 또는 공식 harvest 엔드포인트(https://www.gutenberg.org/robot/harvest, 요청 간 2초 이상) + 공식 카탈로그(/ebooks/offline_catalogs.html, 공개 도메인). ** | public_domain_us — https://www.gutenberg.org/policy/permission.html | 150 | 110 | 4000 | 진행 중단: 공식 오프라인 카탈로그(pg_catalog.csv 21MB)·RDF tarball(127MB)을 ~/Developer/ALTON-data/rw-corpus/catalog/ 에 내려받음(문서상 허용). 작품 선별 스크립트 실행·본문 rsync 는 자동 모드  |
| Standard Ebooks (교정된 미국 퍼블릭 도메인 전자책) | 공식 bulk downloads 페이지·Atom/OPDS 피드·GitHub 저장소(사이트가 대량 접근 경로를 제공한다고 명시) | public_domain_us — https://standardebooks.org/about | 300 | 450 | 6000 | 수집 안 함: 공식 bulk downloads 는 Patrons circle 회원 전용(https://standardebooks.org/bulk-downloads 확인) — 자동 수집 경로 없음 |
| NASA (미국 정부 직접 작성 글) | 공식 사이트 사이트맵 기반 소량 요청(robots.txt 재확인 필수, 공식 bulk 텍스트 API 없음). 이미지·제3자 저작물 제외 | us_gov_work — https://www.nasa.gov/nasa-brand-center/images-and-media/ | 300 | 15 | 900 | 보류: robots.txt `User-agent: * Allow: /` 확인(Crawl-delay 없음). 공식 bulk 텍스트 제공 없음 → 사이트맵 기반 소량 수집기가 필요하나 이번에 미구현·미실행 |
| USGS (미국 지질조사국) | 공식 사이트 소량 요청(robots.txt 재확인). 공식 이용 안내: USGS 작성 정보는 미국 퍼블릭 도메인 | us_gov_work — https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits | 400 | 20 | 1200 | 보류: 공식 이용 안내(미국 PD) 확인, robots.txt 는 확인하지 않음, 수집기 미구현 |
| MedlinePlus(NLM/NIH) 건강 주제 XML | 공식 XML 다운로드(https://medlineplus.gov/xml.html) — 개발자용 공식 제공 | us_gov_work — https://medlineplus.gov/about/using/usingcontent/ | 1 | 60 | 1500 | 보류: 공식 XML 다운로드 제공·속도 제한 없음 확인(https://medlineplus.gov/xml.html, /xml/mplus_topics_YYYY-MM-DD.xml ~29MB, zip ~4.7MB). robots.txt 는 /feeds/topics/ 만 차단 |
| NOAA·NIH 기타 기관 사이트 | 기관별 공식 이용 정책 재확인 후 결정 — 이번 열람에서 NIH 정책 페이지 403, NOAA 는 해당 페이지에 저작권 문구 없음(확인 실패) | us_gov_work — https://www.law.cornell.edu/uscode/text/17/105 | 100 | 10 | 300 | 수집 안 함: 정책 미확인(NIH 403, NOAA 문구 없음) |
| GovInfo(대통령 문서·의회 기록 등 연방 간행물) | 공식 API·bulkdata 저장소(https://www.govinfo.gov/bulkdata). 속도 제한은 API 문서 확인 필요(이번 열람에서 미기재) | us_gov_work — https://www.govinfo.gov/about/policies | 300 | 80 | 1000 | 보류: API 키·속도 제한 문서 미확인(정책 페이지에 없음) |
| PLOS (CC BY 4.0 오픈 액세스 — Author Summary 등 평이한 요약) | 공식 전체 덤프 https://allof.plos.org/allofplos.zip(약 5GB, JATS XML) 또는 공식 API. 공식 TDM 정책: 누구나 마이닝·재사용 가능 | cc_by — https://plos.org/text-and-data-mining/ | 2000 | 5200 | 2500 | 보류: 공식 TDM 정책 확인(https://plos.org/text-and-data-mining/), Search API 한도 분당 10·시간 300·일 7200, 요청당 rows ≤ 100, IP 당 동시 5 이하, 'PLOS 출처 표시' 필요(https://api |
| eLife (CC BY 4.0, eLife digest 평이한 요약) | 공식 GitHub 저장소 elifesciences/elife-article-xml(JATS XML, 공개 배포) 또는 공식 API. 이번 열람에서 정책 페이지는 확인하지 못함(다운로드 전 재확인) | cc_by_4.0 — https://creativecommons.org/licenses/by/4.0/ | 3000 | 800 | 3000 | 수집 안 함: 약관에 CC BY 4.0 는 명시되나 API 자동 접근 정책이 기재되지 않아 '약관 불명확' → 건너뜀(https://elifesciences.org/terms) |
| PMC Open Access 중 CC BY/CC0 (라이선스 필드로 선별) | NCBI 공식 서비스(Cloud Service·OAI-PMH·E-utilities, https://pmc.ncbi.nlm.nih.gov/tools/openftlist/). 문서는 '라이선스는 논문마다 다르다'고 명시 — 논문별 license 필드 검사 필수 | cc_by_4.0 — https://pmc.ncbi.nlm.nih.gov/tools/openftlist/ | 2000 | 300 | 2000 | 보류: 논문별 라이선스 판정 필요, 이번엔 미구현 |
| Smithsonian Open Access (CC0) | 공식 Open Access 데이터(GitHub·AWS 공개 버킷). 텍스트는 주로 카탈로그 설명(짧음) | cc0 — https://creativecommons.org/publicdomain/zero/1.0/ | 100 | 50 | 200 | 보류: 우선순위 낮음(텍스트가 짧음) |
| Wikisource (제외) | 사용 안 함 | public_domain_us — https://en.wikipedia.org/wiki/Wikipedia:Copyrights | 0 | 0 | 0 | 제외: CC BY-SA |

- 합계 추정(전 원천, 제외·보류 포함): 약 7,095MB, 발췌 후보 약 22,600건. 그중 **5GB 예산에 맞춘 1차 수집 계획**은 Gutenberg(약 110MB, 후보 약 4,000)·MedlinePlus XML(약 5~30MB, 후보 약 1,500)·PLOS 초록 API(약 2,000건, 약 10MB, 후보 약 2,000) — 합계 약 150MB, 후보 약 7,500건으로 읽기이해 6 skill 부족분(약 1,186건 중 원문 기반 전환 대상 50~60%)의 10배 이상 수용력. PLOS 전체 덤프(5.2GB)는 예산 초과라 API 초록만.
- **수집하지 않는 원천과 사유(매니페스트에 기록)**: Standard Ebooks(공식 bulk 는 Patrons 회원 전용), eLife(API 자동 접근 정책 미기재 → 약관 불명확), NOAA·NIH 기타(정책 미확인), Wikisource(CC BY-SA), 그 외 보류(NASA·USGS 수집기 미구현, govinfo 키·한도 미확인, PMC 논문별 라이선스 판정 미구현, Smithsonian 우선순위 낮음).
- **현재 수집 상태(중요)**: 공식 오프라인 카탈로그 2개(`pg_catalog.csv` 21MB, `rdf-files.tar.bz2` 127MB)를 `~/Developer/ALTON-data/rw-corpus/catalog/` 에 내려받았다(Gutenberg 정책이 카탈로그 기계 추출을 허용). **그 뒤 작품 선별·본문 수집 단계는 자동 모드 권한 분류기가 차단했고(사유 설명 없음) 우회하지 않았다 — 원문 본문은 하나도 받지 않았다.** 총괄의 지시는 사용자 본인의 승인으로 간주되지 않으므로, 본문 수집은 사용자가 직접 승인(또는 해당 명령에 대한 허용 규칙 추가)해야 진행할 수 있다.

## B. 확보 스크립트 초안(작성만, 실행 안 함)
- `scripts/rw-corpus/collect.ts`: 매니페스트 기반 수집기. `approved=true` 원천만, 공식 경로에서 만든 '다운로드 목록(JSONL)'만 받는다(링크 따라가기 없음). 기본 dry-run, `--execute` 필요, **User-Agent 에 연락처 명시(`CORPUS_CONTACT` 필수)**, 원천별 `delayMs` 간격, 호스트·경로 안전 검사(storageRoot 밖 저장 거부), 번역본 거부, 5xx·429 지수 백오프 재시도 3회, **재개 가능**(`.meta.json` 있는 파일은 건너뜀), 받을 때마다 출처·라이선스·URL·시각·SHA-256 메타(`.meta.json`) 자동 기록. 라이선스 자동 판정이 안 되는 항목은 다운로드 목록에 넣지 않는다(제외 목록).
- `scripts/rw-corpus/gutenberg_select.py`: 공식 카탈로그에서 영어 원서·작가 사후 1929 이하·RDF 번역자 없음·미국 PD 고지·장르 배분(약 165편, 작가당 2편)으로 선별. 다운로드는 공식 rsync 미러(`rsync.ibiblio.org::gutenberg`, 부분 미러 허용, 작품 사이 2초)의 해당 디렉터리 `*.txt` 만.
- 디스크 가드: 수집기 실행 전후 `df`, 받은 총량이 5GB 에 이르거나 여유 20GB 미만이면 중단(수집기에 추가 예정 — 현재 초안은 용량 집계 미포함).

## C. 발췌 자동화 초안(코드 + 단위 테스트, 합성 문장 픽스처)
- `scripts/rw-corpus/excerpt.ts`(순수 함수): 문단·문장 경계로만 자르고 2~8문장·60~150단어 창을 만든다. **자족성 규칙** — 첫 문장이 대명사·접속사(He/She/It/They/This/But/And/However/Then/Yet/So…)로 시작하면 제외, 따옴표 짝 불일치·각주 표시·장 제목·삽화 표기·고어(thou/hath…)·숫자 과다 제외, 종결 부호로 끝나지 않으면 제외. 후보마다 원문 일치 자기 검증 후에만 출력, 출력은 오프셋·해시뿐(본문 미저장).
- `scripts/rw-corpus/quote-verify.ts`(순수 함수): 정규화(공백·따옴표·대시 통일만)한 원문에서 발췌가 **글자 그대로** 있는지 `indexOf` 로 확인, 생략 표기 `[…]` 는 앞뒤 구간이 각각 차례로 연속이어야 하고 줄임표 단독은 거부, 문항의 밑줄·인용 단어가 지문 안에 그대로 있는지도 확인.
- `scripts/rw-corpus/schema.ts`: 코퍼스 메타(`SourceText`: corpusId·저자·작품·출판연도·저자 사망연도·번역 여부·URL·라이선스·근거 URL·출처 표시 문구·한국 저작권 확인·시각·SHA-256·저장 경로)와 발췌 메타(`Excerpt`: 오프셋·생략 구간·단어 수·해시·편집 변경·검증 기록). 문항 품질 JSON 의 `quality.sourceText`(이 문서 §5)와 같은 필드다.
- 테스트: `scripts/rw-corpus/*.test.ts` 7개 통과(합성 문장만 사용 — 실제 작품 문장 없음).

## D. 원문 발췌 파일럿 설계(실행은 합격 검증 이후 총괄 승인)
- **대상 skill**: central_ideas_details·inferences·command_of_evidence_text·text_structure_purpose·words_in_context·cross_text_connections. **원문 발췌 기반 약 100건**(skill 당 16~17건)과 **AI 지문 100건**(같은 skill·같은 수·같은 난이도 배분 easy/medium)을 같은 검수 기준(Sonnet 5.5 블라인드 풀이 + 감사)으로 생성·비교. 원문 경로: 코드가 발췌를 고르고 지문을 그대로 넣고 AI 는 질문·선택지·해설만 작성(인용 일치 검증 100% 필수). AI 경로: 씨앗·목표 정답 위치를 주입한 기존 경로.
- **측정 지표**(arm 별): 채택 수율(후보 전체 분모)과 탈락 원인, 채택 1건당 비용(USD), 본문 다양성(skill 안 본문 3-gram 유사도 분포·상위 토큰 점유·문두 집중), 구조 다양성(정답 위치 분포·지문 구조·소재 분류 엔트로피), 난이도 판정(블라인드 추정 난이도 분포와 라벨 일치), 해설 품질(감사 해설 정합 통과율 + 사람 표본 10건 점검), 지문 품질 표본(현대 영어 적합도: 고어·어려운 어휘 비율), 발췌 경로는 인용 일치율 100% 확인과 출처 메타 완전성.
- **예상 비용(상한 제안)**: 후보 약 125건 x 2 arm, Sonnet 5.5 배치 후보당 약 $0.014(원문 arm 은 지문 생성 토큰이 없어 약 $0.011) → 약 $3.2, **상한 US$5**. 코퍼스 준비(다운로드·카탈로그 선별)는 API 비용이 없다. 소요 약 2일(코퍼스 확보 1일 + 생성·비교 1일). 선행 조건: 위 A 의 Gutenberg·MedlinePlus·PLOS 1차 수집(약 150MB) 승인.
