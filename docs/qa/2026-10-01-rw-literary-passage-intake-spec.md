# R&W 문학 지문 수집 규격 (2026-10-01)

기획 세션 등이 AI 로 **문학 스타일의 새 글**을 만들어 저장할 때 따르는 규격이다. 실제 작품 발췌는 이 규격 대상이 아니다(저작권 자유 원문은 `~/Developer/ALTON-data/rw-corpus` 코퍼스에서 따로 관리).

## 절대 규칙
1. **전부 새로 쓴 글만.** 실제 작품의 문장·플롯·고유한 인물 설정을 가져오지 않는다. 실존 작품을 "인용"시키지 않는다(모델은 원문을 틀리게 재현한다).
2. **가짜 출처 표기 금지.** "From … by …" 같은 머리글, 실존 작가·작품 이름을 붙이지 않는다. 유명 문장도 쓰지 않는다.
3. 영어로만 쓴다. 한글·마크업·모델 잔재(`<…>`, `As an AI`, 플레이스홀더)가 없어야 한다.
4. 한 지문 = 한 줄 JSON. 선언 3개(`original`, `noRealWorkQuoted`, `noCopyrightedSource`)는 모두 `true` 여야 하고, 그럴 수 없으면 저장하지 않는다.

## 저장 위치·파일 구조
```
data/rw-passages/<batchId>/passages.jsonl      # 한 줄에 지문 하나
data/rw-passages/<batchId>/README.md           # (선택) 생성 방법·프롬프트 요약·모델명
```
- `batchId` 예: `lit-20261002-a` (소문자·숫자·`-`). 같은 날 여러 배치면 알파벳을 올린다.
- 파일 하나에 100건 안팎. 절대 덮어쓰지 말고 새 배치 폴더를 만든다.
- 저장소에 그대로 커밋해도 된다(우리가 만든 글이라 저작권 문제 없음). 단 실제 작품 텍스트는 절대 넣지 않는다.

## 한 줄(JSON) 스키마
```json
{
  "id": "lit-20261002-a-001",
  "batchId": "lit-20261002-a",
  "origin": "original_ai",
  "producer": { "model": "gpt-…", "session": "planner", "date": "2026-10-02" },
  "genre": "short_story",
  "styleEra": "contemporary",
  "pov": "first",
  "topicSeed": "harbor town; two sisters quarrel over their late father's boat",
  "text": "…영어 60~220 단어. 시는 줄바꿈을 \\n 으로 유지…",
  "features": { "tone": ["wistful", "guarded"], "devices": ["metaphor", "juxtaposition"], "inferenceTargets": ["narrator_attitude", "tone_shift"] },
  "intendedDifficulty": "hard",
  "declaration": { "original": true, "noRealWorkQuoted": true, "noCopyrightedSource": true },
  "notes": ""
}
```

| 필드 | 허용 값 / 규칙 |
|---|---|
| `genre` | short_story, novel_excerpt, poetry, drama, personal_essay, memoir, letter, diary, fable_or_folktale_retelling |
| `styleEra` | contemporary, late_20c, early_20c, 19c (문체 분위기일 뿐, 실제 작가와 무관) |
| `pov` | first, second, third_limited, third_omniscient, mixed_or_none |
| `topicSeed` | 장소·인물 관계·갈등을 한 줄(12자 이상). **같은 배치 안에서 중복 금지**(소재 겹침 방지 키) |
| `text` | 60~220 단어, 영어 |
| `features.inferenceTargets` | 이 글로 출제할 수 있는 문제 유형 1개 이상: character_motivation, tone_or_mood, narrator_attitude, tone_shift, figurative_language, symbolism, relationship_between_characters, word_in_context, text_structure, main_idea_or_purpose, underlined_portion_function |
| `intendedDifficulty` | easy \| medium \| hard |

## 품질 가이드(만들 때)
- **hard 지문**: 화자의 태도가 직접 서술되지 않고 행동·대조·반복으로 드러나게 한다. 근거가 두 곳 이상에 흩어져 있어야 하고, 쉬운 오독(표면적 감정)과 정답 해석이 갈리게 쓴다.
- 문체를 다양하게: 1인칭/3인칭, 시대 분위기, 장르를 섞는다. 같은 장소·갈등·첫 문장 패턴을 반복하지 않는다.
- 한 배치는 장르·시점·소재가 고르게 섞이게 한다(장르 한 가지로 몰지 않는다). 권장 비율: 단편·소설 발췌 50%, 에세이·회고 25%, 시·희곡 15%, 편지·일기·민담 10%.
- 목표 규모: 우선 **400건**(30세트 이상의 문학 문항 + 여분). 시작은 한 배치 100건으로 검증 후 확대.

## 검증(저장 직후 반드시)
```bash
npx tsx scripts/rw-passages/validate.ts data/rw-passages/<batchId>/passages.jsonl
```
- 파일 여러 개를 주면 배치 간 중복·유사도(5-gram 0.3 이상)도 함께 검사한다. 문제가 있는 줄만 고쳐서 다시 만든다. 통과해야 다음 단계(문항 생성 입력)로 쓴다.
- 이 규격과 검증기: `lib/rw-passages/schema.ts`(+ 단위 테스트).

## 다음 단계(총괄)
검증 통과 배치는 R&W 문항 생성의 지문 입력으로 쓰고, 문항은 기존 hard 레시피·이중 검수·서브 에이전트 검수를 거친다. 소재 씨앗(`topicSeed`)은 세트 간 소재 중복 방지에 쓰인다.
