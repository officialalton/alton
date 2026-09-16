// 2026-09-15 — ALTON SAT 공용 단어장(200단어×10권) 실 데이터 채우기.
//   권마다: AI가 배치 생성 → 결정적 검증(중복/예문-표제어 불일치/반의어 오류 등) →
//   실패분은 버리고 재요청 → 200개 확보되면 DB 삽입. "관리자에게 넘겨 고치게 하지 않는다"는
//   문제은행 정책과 같은 원칙 — 검증 실패 항목은 절대 저장하지 않고 다시 만든다.
// 실행: npx tsx scripts/vocab-library-seed.ts --book=1 [--book=2 ...] [--dry-run]
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const WORDS_PER_BOOK = 200;
const BATCH_SIZE = 20;

type VolumePlan = { volumeNo: number; title: string; theme: string; difficultyMin: number; difficultyMax: number };

// 학습 순서·난이도·주제 기준 10권 구성. College Board 표기는 쓰지 않는다(내부 선정 기준만 기록).
const VOLUME_PLAN: VolumePlan[] = [
  { volumeNo: 1, title: "1권 — 일상·기초 학술 어휘", theme: "일상 대화와 기초 학술 지문에 자주 나오는 필수 고빈도 어휘", difficultyMin: 1, difficultyMax: 2 },
  { volumeNo: 2, title: "2권 — 서술·묘사 어휘", theme: "인물·상황을 서술하고 묘사할 때 쓰는 형용사·부사 중심 어휘", difficultyMin: 1, difficultyMax: 2 },
  { volumeNo: 3, title: "3권 — 논증·주장 어휘", theme: "에세이·사설의 주장과 논증에 쓰이는 동사·명사(강조, 반박, 지지 등)", difficultyMin: 2, difficultyMax: 3 },
  { volumeNo: 4, title: "4권 — 과학·자연 지문 어휘", theme: "생물·지구과학·물리 지문에 자주 나오는 학술 어휘", difficultyMin: 2, difficultyMax: 3 },
  { volumeNo: 5, title: "5권 — 사회·경제 지문 어휘", theme: "역사·경제·사회 지문에 자주 나오는 학술 어휘", difficultyMin: 2, difficultyMax: 3 },
  { volumeNo: 6, title: "6권 — 인물 성격·태도 어휘", theme: "인물의 성격·태도·감정 상태를 정교하게 구분하는 어휘", difficultyMin: 3, difficultyMax: 4 },
  { volumeNo: 7, title: "7권 — 문학·수사 어휘", theme: "문학 지문·수사학적 분석에 쓰이는 어휘", difficultyMin: 3, difficultyMax: 4 },
  { volumeNo: 8, title: "8권 — 추상·개념 어휘", theme: "추상적 개념과 관계를 표현하는 고급 어휘", difficultyMin: 3, difficultyMax: 4 },
  { volumeNo: 9, title: "9권 — 저빈도 정밀 어휘", theme: "정확한 뉘앙스 구분이 필요한 저빈도 고급 어휘", difficultyMin: 4, difficultyMax: 5 },
  { volumeNo: 10, title: "10권 — 최상급 어휘", theme: "SAT 최상위권 지문에서만 드물게 나오는 최상급 난이도 어휘", difficultyMin: 4, difficultyMax: 5 },
];

type RawWord = {
  word: string; definition_ko: string; example1: string; example2: string;
  synonym_words: string[]; antonym_words: string[]; difficulty: number; source_note: string;
};

type ValidWord = RawWord & { position: number };

function normalize(w: string) {
  return w.trim().toLowerCase();
}

/** 예문이 표제어(또는 그 단순 활용형)를 실제로 포함하는지 느슨하게 확인 — 어간 4자 이상 일치. */
function exampleUsesWord(example: string, word: string): boolean {
  const stem = normalize(word).replace(/[^a-z]/g, "").slice(0, Math.max(4, normalize(word).replace(/[^a-z]/g, "").length - 3));
  if (stem.length < 3) return normalize(example).includes(normalize(word));
  return normalize(example).includes(stem);
}

function validateWord(w: unknown, seenGlobal: Set<string>, seenThisBook: Set<string>, plan: VolumePlan): { ok: true; value: ValidWord } | { ok: false; reason: string } {
  const r = w as Partial<RawWord>;
  if (!r || typeof r.word !== "string" || !/^[a-zA-Z][a-zA-Z '-]{1,29}$/.test(r.word.trim())) return { ok: false, reason: "word_invalid" };
  const word = r.word.trim();
  const key = normalize(word);
  if (seenGlobal.has(key) || seenThisBook.has(key)) return { ok: false, reason: "duplicate" };
  if (!r.definition_ko || typeof r.definition_ko !== "string" || r.definition_ko.trim().length < 2) return { ok: false, reason: "definition_missing" };
  if (!r.example1 || typeof r.example1 !== "string" || !exampleUsesWord(r.example1, word)) return { ok: false, reason: "example1_missing_or_mismatch" };
  if (!r.example2 || typeof r.example2 !== "string" || !exampleUsesWord(r.example2, word)) return { ok: false, reason: "example2_missing_or_mismatch" };
  if (normalize(r.example1) === normalize(r.example2)) return { ok: false, reason: "examples_identical" };
  if (!Array.isArray(r.synonym_words) || r.synonym_words.length < 2 || r.synonym_words.some((s) => typeof s !== "string" || !s.trim() || normalize(s) === key)) return { ok: false, reason: "synonyms_invalid" };
  if (!Array.isArray(r.antonym_words) || r.antonym_words.length < 2 || r.antonym_words.some((s) => typeof s !== "string" || !s.trim() || normalize(s) === key)) return { ok: false, reason: "antonyms_invalid" };
  const synSet = new Set(r.synonym_words.map(normalize));
  if (r.antonym_words.some((a) => synSet.has(normalize(a)))) return { ok: false, reason: "antonym_overlaps_synonym" };
  const difficulty = Number(r.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < plan.difficultyMin || difficulty > plan.difficultyMax) return { ok: false, reason: "difficulty_out_of_range" };
  if (!r.source_note || typeof r.source_note !== "string" || r.source_note.trim().length < 2) return { ok: false, reason: "source_note_missing" };
  return {
    ok: true,
    value: {
      word, definition_ko: r.definition_ko.trim(), example1: r.example1.trim(), example2: r.example2.trim(),
      synonym_words: r.synonym_words.map((s) => s.trim()), antonym_words: r.antonym_words.map((s) => s.trim()),
      difficulty, source_note: r.source_note.trim(), position: 0,
    },
  };
}

async function generateBatch(plan: VolumePlan, exclude: string[], need: number) {
  const { getAnthropic } = await import("../lib/problem-generation/core");
  // 권이 쌓일수록(전체 2,000단어) 이미 나온 단어와 겹칠 확률이 올라간다 — 프롬프트에 최근 1,200개까지
  // 보여줘 모델이 스스로 피하게 하고, 그래도 겹치면 검증 단계에서 확정적으로 거른다.
  const excludeList = exclude.slice(-1200).join(", ");
  // 네트워크 호출이 응답 없이 걸리면(2026-09-16 실측: 45분 이상 CPU 0%로 멈춤) 배치 전체가
  // 무한정 멈춘다 — 명시적 타임아웃으로 그 자리에서 실패시키고 재시도 루프가 다음 배치로 넘어가게 한다.
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    tools: [
      {
        name: "generate_vocab_words",
        description: "SAT 공용 단어장 한 권에 들어갈 단어 항목을 생성한다.",
        input_schema: {
          type: "object",
          properties: {
            words: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  word: { type: "string", description: "영단어(원형). 구(phrase)는 피한다." },
                  definition_ko: { type: "string", description: "SAT 지문 문맥에서 실제로 쓰이는 뜻 하나(한글, 간결하게)." },
                  example1: { type: "string", description: "이 단어를 이 뜻으로 쓰는 영어 예문(SAT 지문 톤). 반드시 이 단어(또는 그 활용형)를 포함." },
                  example2: { type: "string", description: "example1과 다른 상황의 두 번째 영어 예문. 역시 이 단어를 포함하고 example1과 문장이 달라야 한다." },
                  synonym_words: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, description: "같은 뜻의 유사어 2개(표제어 자신 제외)." },
                  antonym_words: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, description: "반의어 2개(유사어와 겹치면 안 됨)." },
                  difficulty: { type: "number", description: `이 권의 난이도 범위(${plan.difficultyMin}~${plan.difficultyMax}) 안의 정수.` },
                  source_note: { type: "string", description: "이 단어를 이 권·이 난이도에 넣은 선정 기준(예: 'SAT Reading 사설 지문 고빈도', '수사학적 분석 지문 필수어'). College Board 등 특정 공식 자료명은 쓰지 않는다." },
                },
                required: ["word", "definition_ko", "example1", "example2", "synonym_words", "antonym_words", "difficulty", "source_note"],
              },
            },
          },
          required: ["words"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "generate_vocab_words" },
    messages: [
      {
        role: "user",
        content:
          `ALTON SAT 공용 단어장 ${plan.title}. 주제: ${plan.theme}. 난이도(1=쉬움~5=어려움) 범위: ${plan.difficultyMin}~${plan.difficultyMax}.\n` +
          `서로 다른 영단어 ${need}개를 생성해라(중복 금지, 이미 나온 아래 단어들과도 겹치지 않게):\n${excludeList || "(없음)"}\n` +
          `College Board 같은 특정 공식 단어장 이름을 표기하지 마라(선정 기준은 지문 유형·빈도로만 서술).`,
      },
    ],
  }, { timeout: 60_000 });
  const toolUse = message.content.find((b) => b.type === "tool_use");
  const words = (toolUse as { input?: { words?: unknown[] } } | undefined)?.input?.words;
  return Array.isArray(words) ? words : [];
}

async function fillBook(admin: import("@supabase/supabase-js").SupabaseClient, plan: VolumePlan, globalSeen: Set<string>, logPath: string, dryRun: boolean) {
  const seenThisBook = new Set<string>();
  const accepted: ValidWord[] = [];
  const rejectCounts: Record<string, number> = {};
  let attempts = 0;
  const maxAttempts = 45;

  while (accepted.length < WORDS_PER_BOOK && attempts < maxAttempts) {
    attempts++;
    const need = Math.min(BATCH_SIZE, WORDS_PER_BOOK - accepted.length + 5);
    let raw: unknown[];
    try {
      raw = await generateBatch(plan, [...globalSeen, ...seenThisBook], need);
    } catch (e) {
      // 타임아웃·네트워크 오류 한 번으로 전체 실행(다음 권들)까지 멈추지 않는다 — 이 배치만 건너뛴다.
      rejectCounts["batch_error"] = (rejectCounts["batch_error"] ?? 0) + 1;
      console.error(`  (배치 ${attempts} 오류, 건너뜀: ${e instanceof Error ? e.message : e})`);
      continue;
    }
    for (const w of raw) {
      const result = validateWord(w, globalSeen, seenThisBook, plan);
      if (!result.ok) {
        rejectCounts[result.reason] = (rejectCounts[result.reason] ?? 0) + 1;
        continue;
      }
      if (accepted.length >= WORDS_PER_BOOK) break;
      result.value.position = accepted.length;
      accepted.push(result.value);
      seenThisBook.add(normalize(result.value.word));
      globalSeen.add(normalize(result.value.word));
    }
  }

  const summary =
    `## ${plan.title}\n- 목표 200개 / 확보 ${accepted.length}개 (시도 ${attempts}회 배치)\n` +
    `- 제외(검증 실패) 사유별 건수: ${Object.entries(rejectCounts).map(([k, v]) => `${k}=${v}`).join(", ") || "없음"}\n`;
  console.log(summary);
  appendFileSync(logPath, summary + "\n");

  if (accepted.length < WORDS_PER_BOOK) {
    const msg = `⚠️ ${plan.title}: ${WORDS_PER_BOOK - accepted.length}개 부족 — 저장하지 않고 다음 실행에서 이어서 채워야 함.\n`;
    console.warn(msg);
    appendFileSync(logPath, msg + "\n");
    return { volumeNo: plan.volumeNo, inserted: 0, ok: false };
  }

  if (dryRun) return { volumeNo: plan.volumeNo, inserted: 0, ok: true };

  const { data: book, error: bookErr } = await admin
    .from("vocab_library_books")
    .upsert({ volume_no: plan.volumeNo, title: plan.title }, { onConflict: "volume_no" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`권 upsert 실패(${plan.volumeNo}): ${bookErr?.message}`);

  const rows = accepted.map((w) => ({
    book_id: book.id, word: w.word, definition_ko: w.definition_ko, synonym_words: w.synonym_words,
    antonym_words: w.antonym_words, example1: w.example1, example2: w.example2, position: w.position,
    difficulty: w.difficulty, source_note: w.source_note,
  }));
  const { error: insErr } = await admin.from("vocab_library_words").upsert(rows, { onConflict: "book_id,word" });
  if (insErr) throw new Error(`단어 삽입 실패(${plan.volumeNo}): ${insErr.message}`);

  return { volumeNo: plan.volumeNo, inserted: accepted.length, ok: true };
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const bookArgs = args.filter((a) => a.startsWith("--book=")).map((a) => Number(a.split("=")[1]));
  const books = bookArgs.length ? VOLUME_PLAN.filter((p) => bookArgs.includes(p.volumeNo)) : VOLUME_PLAN;

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: existing } = await admin.from("vocab_library_words").select("word");
  const globalSeen = new Set<string>((existing ?? []).map((w) => normalize(w.word as string)));

  const logPath = `docs/2026-09-15-vocab-content-batch-${Date.now()}.md`;
  appendFileSync(logPath, `# ALTON SAT 공용 단어장 채우기 실행 로그\n\n기존 전역 단어 수: ${globalSeen.size}\n\n`);

  const results = [];
  for (const plan of books) {
    console.log(`\n=== ${plan.title} 시작 ===`);
    const r = await fillBook(admin, plan, globalSeen, logPath, dryRun);
    results.push(r);
  }
  console.log("\n=== 전체 결과 ===", JSON.stringify(results, null, 2));
  console.log("로그:", logPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
