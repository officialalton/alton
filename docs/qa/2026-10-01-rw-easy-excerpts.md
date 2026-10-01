# 문학 40% easy 발췌 지문 준비 결과 (2026-10-01)

문학 40% 계획의 easy 배치(`lit40-easy-01..05`, 후보 438건)가 `session-cli prepare --excerpts` 로 쓸 발췌 파일을 코퍼스(읽기 전용)에서 만들었다. API·DB·수집·다운로드는 쓰지 않았다. 커밋하지 않았고 새 파일만 만들었다.

## 산출물
| 파일 | 내용 |
|---|---|
| `data/rw-generation/excerpts/lit40-easy.jsonl` | 전체 456줄. 앞 438줄은 배치 순서(01~05)대로 prepare 의 후보 순서와 정렬, 뒤 18줄은 예비 |
| `data/rw-generation/excerpts/lit40-easy-01..05.jsonl` | 배치별 정렬 파일(각 100·100·100·100·38줄). **prepare 에는 이 파일을 쓴다** |
| `data/rw-generation/excerpts/lit40-easy-reserve.jsonl` | 배정되지 않은 예비 18건 |
| `data/rw-generation/excerpts/lit40-easy.index.json` | 줄 번호 → candidateId·문항 유형·슬롯 장르·발췌 장르·대체 여부·적합도 |
| `data/rw-generation/excerpts/lit40-easy.summary.json` | 집계(장르별 수·작품 수·평균 단어·검증·다양성·부족 셀) |
| `scripts/rw-corpus/lit40-easy-build.ts` | 재현용 구축기(`node scripts/rw-corpus/lit40-easy-build.ts`, Node 25 타입 제거 실행) |

> 중요: prepare 는 `excerpts[i]` 를 i번째 후보에 그대로 붙이므로 **배치마다 자기 파일을 써야 한다**(마스터 파일을 5개 배치에 통째로 넘기면 모든 배치가 같은 첫 100개를 받는다).
```bash
C="npx tsx scripts/rw-generation/session-cli.ts"
$C prepare --run lit40-wave1 --batch lit40-easy-01 --excerpts data/rw-generation/excerpts/lit40-easy-01.jsonl   # 02~05 도 같은 방식
```
줄 형식: `{"text": …, "source": {author, work, year, authorDeathYear, sourceUrl, license, licenseEvidenceUrl, corpusId, corpusTextSha256, excerptSha256, sliceSha256, location{startChar,endChar,basis,approxPercent}, genre, workForm}}`. 오프셋은 CRLF 를 LF 로 바꾼 본문 기준이다.

## 결과 요약
- 고유 발췌 456개(중복 0, 같은 작품 안 겹침 0, 5-gram 자카드 최대 0.008), 작품 113편, 작품당 최대 5개. 평균 114.9단어(74~171), 라이선스는 전부 `public_domain_us`.
- 장르별(수요 → 확보): 소설 98 → 120(33편) · 단편 137 → 117(51편, 소설 장면 대체 포함) · 개인 에세이 71 → 87(25편) · 회고록 65 → 80(24편) · 시 35 → 26(8편) · 편지 12 → 13(4편) · 희곡 12 → 3(1편) · 우화/민담 8 → 10(2편).
- 인용 일치(`quote-verify`): 필터를 통과한 후보 7,600건 전부, 최종 456줄은 원본(CRLF)·LF 본문 모두 456/456 일치, 발췌·원문 구간 SHA 재계산 456/456 (통과율 100%). 통과한 것만 기록했다.
- 선택 규칙: 문단·문장 경계, 첫 문장이 대명사·접속사로 시작하지 않고 7단어 이상, 따옴표 열림·닫힘 짝(대사 중간 시작·종료 제외), 대사 비중 30% 이하, 평균 문장 27단어 이하, 고어(thou/hath 등)·사투리·비ASCII·각주 표식·밑줄 서식 제외, 코퍼스 문서빈도 기준 희귀어 비율 4.5% 이하, 고유명사 4개 이하, 책 서문·메타 문구 제외, 불쾌·부적절 표현(비하어·폭력·사망·음주·종교 논쟁 등) 제외, 비소설 장르는 전쟁·병원·사체 묘사 추가 제외. 이름은 같은 이름이 3개 이상 발췌에 나오지 않게 제한(최다 2회), 같은 작품에서 6,000자 이내 발췌 금지.
- 문항 유형 적합: 각 슬롯에 그 유형의 사전적 단서(비유 표지·긍정/부정 어조 전환·화자 평가어·동기 동사·인물 관계어·상징 소재 어휘 등)가 많은 발췌를 배정했다. 단서가 부족한 슬롯 16개는 `index.json` 의 `weakFit=true`(figurative_language 14, word_in_context 1, tone_or_mood 1).

## 부족한 셀과 이유·대안
코퍼스 문학 계열이 작품 약 110편뿐이고 작품당 5개 상한이 있어 전체 확보량(456)은 수요(438)를 넘지만 **여유분은 약 4%**(권장 20%에 못 미침)이고 일부 장르가 모자란다. 모자란 38개 슬롯은 남은 다른 장르 발췌로 채웠고 `index.json` 의 `substituteFor` 에 표시했다.

| 슬롯 셀(장르 / 유형) | 부족 | 채운 발췌 | 이유 |
|---|---:|---|---|
| 희곡 / main_idea 4 · character_motivation 4 · tone_shift 1 | 9 | 소설 장면 | 희곡 형식 작품이 Clyde Fitch 『The Smart Set』 하나뿐이고 편지 섹션·종교·사망 표현 제외 후 3개(아이들 대화극)만 남음 |
| 시 / word_in_context | 9 | 개인 에세이 7, 우화 2 | 시 작품이 시집 3~4권과 산문 속 인용시뿐이고 고어체(thou/thy)·비ASCII 철자·종교어 제외 후 8작품 26편만 통과(Deirdre·Landor·Thompson 은 어휘·철자 때문에 0~소수) |
| 단편 / main_idea 13 · word_in_context 7 | 20 | 소설 장면 13, 회고록 7 | 단편집 약 25종 × 상한 5 와 대사·고유명사 필터로 117개. 소설 작품의 남은 한도에서 자족적 장면(`workForm` 에 `novel(scene used for short_story slot)`)으로 보충 |

대안(총괄 결정):
1. 현재 파일 그대로 진행하고, 대체 슬롯의 후보는 장르 표기만 소설·회고로 바꿔 prepare 한다(또는 시·희곡 슬롯 18개는 이번 웨이브에서 제외하고 `second_solver` 판정에서 장르 부적합을 거른다).
2. 코퍼스 확대: 희곡(Shakespeare 외 PD 근대극·Gutenberg 소극), 시(1920년대 이전 PD 영시 시집), 단편집(Jewett·Wharton·Kipling 등 PD 단편집)을 추가 수집하면 부족분과 20% 여유가 해소된다(수집은 별도 승인).
3. 작품당 상한을 5 → 6 으로 완화하면 부족분의 약 절반이 풀리지만 소재 중복 위험이 늘어 권장하지 않는다.

## 점검 결과와 한계
- 다양성: 최다 반복 이름 2회, 문두 첫 단어는 The 95·I 45·There 20 순(문두가 한 단어로 몰리지 않음). 같은 작품 발췌 간 장면 겹침 0.
- 길이: 80~140단어 구간이 대부분(74~171). 시(평균 99단어)는 연 단위라 74단어까지 허용했다.
- 근대성: 19세기 말~1920년대 작품 위주이나 Gutenberg 문장이라 현대 독자에겐 약간 문어적이다. 어휘 희귀도 필터로 고어성을 줄였을 뿐 사람 검수는 하지 않았다.
- 적합도는 어휘 단서 휴리스틱이라 판정(Fable)에서 '레시피 부적합'이 일부 나올 수 있다. 연도(`year`)는 본문 머리글의 copyright/published 줄에서만 추출했고 없으면 null(코퍼스 메타에 발행연도 없음).
- 생성 에이전트 결과의 `passage` 는 발췌 `text` 와 공백 정규화 후 같아야 한다(세션 모드 규칙). 시·희곡은 줄바꿈이 있으며 공백 접기 비교에서 문제없다. 희곡 발췌에는 무대 지시문 `_…_` 서식이 남아 있다.
