// SAT 신규 세트(lit25) 지문 160단어 초과 10건 단축 계획 생성기(백로그 A4, 2026-10-19). 입력: data/mock-exam-generation/sat-lit25-20261019/final/adopted-all.json(원문), 출력: data/audit/sat-trim160-plan-20261019.json
//   npx tsx scripts/prod-open/sat-trim160-plan.ts
// 규칙(2026-10-14 R5-TRIM 과 같음): 지문은 "삭제만"으로 줄인다(새 단어 추가·순서 변경 금지, 빈칸·Text 표지·문단 구분·질문 유지), 목표 ≤160단어(가능하면 ≤150),
//   문장 첫 글자 대소문자가 바뀌지 않게 삭제 구간을 고른다. 정답·보기는 불변, 해설은 삭제 내용을 가리킬 때만 고친다(해당 항목 1건).
// 기계 검사: 원문의 단어 부분수열인가 · 새 단어 0 · 단어 수 · 문단 수 · 삭제 구간이 원문에 정확히 한 번 있는가.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
type Item = { gid: string; spans: string[]; note: string; explanation_en?: [string, string]; explanation?: [string, string] };
export const TRIMS: Item[] = [
  { gid: "sl-central_ideas_details-m-022", spans: [" Performed on movable wagons that rolled from station to station through the streets, the cycles moved from the Creation to the Last Judgment over a single long day."],
    note: "무대 방식(수레·하루 일정) 문장 삭제. 보기·해설은 번역 기능·길드 기록만 쓴다." },
  { gid: "sl-central_ideas_details-m-024", spans: [", such as the 3:2 relationship that defines the perfect fifth"], note: "완전5도 예시 삭제(정수비 서술은 유지)." },
  { gid: "sl-central_ideas_details-m-026", spans: [" so that individual scribal habits are not mistaken for signs of a different era"], note: "재보정 목적절 삭제(재보정 제안 자체는 유지)." },
  { gid: "sl-central_ideas_details-m-103", spans: [" Such provisions hardly fit a model of fully independent states."], note: "해석 문장 삭제(외국 보증권 서술은 유지)." },
  { gid: "sl-central_ideas_details-m-146", spans: ["quietly ", "mainly ", "openly "], note: "수식어 3개 삭제(문장 구조 불변)." },
  { gid: "sl-central_ideas_details-m-151", spans: [" In Vermeulen's view, guild rules slowed the movement of expertise only in peaceful times; they could not hold back skills carried by workers who had already decided to leave.", "quickly "], note: "맺음 문장(평화 시 지연)과 부사 삭제. 보기·해설은 이 문장을 쓰지 않는다." },
  { gid: "sl-central_ideas_details-m-188", spans: [", such as strontium aluminate doped with europium and dysprosium,", " that can last for seconds or even hours", "simply "], note: "예시 물질 병기·지속시간 구절·부사 삭제(디스프로슘·유로퓸은 뒤 문장에서 그대로 쓰임)." },
  { gid: "sl-central_ideas_details-m-190", spans: ["Engineers once treated this decline as a minor nuisance to be corrected for in measurements, but materials scientist ", "To test this idea, ", ", and the rescaled curves overlapped almost perfectly", " bit by bit"],
    note: "옛 공학자 관점 절·시험 도입구·곡선 겹침 절·부사구 삭제. 보기 A 해설이 '옛 공학자 관점'을 가리키므로 해설만 수정.",
    explanation_en: ["A borrows the older engineers' view of relaxation as a nuisance to correct, which the text sets up only to reject, and the warmer tests were never meant to remove an error.", "A calls stress relaxation a measurement error to be removed, but the text presents it as a record of molecular motion, and the warmer tests were never meant to remove an error."],
    explanation: ["A는 이완을 측정 오류로 본 예전 엔지니어들의 관점을 가져왔는데, 지문은 바로 그 관점을 반박하며 고온 시험은 오류를 없애는 방법이 아니었다.", "A는 이완을 없애야 할 측정 오류라고 하지만, 지문은 이를 분자 운동의 기록으로 설명하며 고온 시험도 오류를 없애려는 것이 아니었다."] },
  { gid: "sl-cross_text_connections-h-093", spans: [' ("You worked hard on that")', ' ("You\'re so smart")', " at all"], note: "예시 인용 2개와 강조어 삭제(Text 1·2 구분·추론 구조 불변)." },
  { gid: "sl-inferences-m-194", spans: [" Their structure is hierarchical, with micrometer-scale cells whose walls are themselves riddled with nanometer-scale pores."], note: "계층 구조 설명 문장 삭제(비교 조건의 마이크로미터/나노미터 기공 서술은 유지)." },
];

const words = (s: string) => s.split(/\s+/).map((w) => w.replace(/[.,;:!?"()]+/g, "")).filter(Boolean);
const isSubsequence = (a: string[], b: string[]) => { let j = 0; for (const x of a) { while (j < b.length && b[j] !== x) j++; if (j === b.length) return false; j++; } return true; };

if (process.argv[1]?.endsWith("sat-trim160-plan.ts")) {
  const adopted = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mock-exam-generation/sat-lit25-20261019/final/adopted-all.json"), "utf8")) as { gid: string; problem: { stimulus: string; passage: string; question: string; options: string[]; correctIndex: number; explanationEn?: string } }[];
  const out: Record<string, unknown>[] = []; let fail = 0;
  for (const t of TRIMS) {
    const a = adopted.find((x) => x.gid === t.gid);
    if (!a) { console.error("missing", t.gid); fail++; continue; }
    const old = a.problem.stimulus;
    let next = old; const problems: string[] = [];
    for (const sp of t.spans) {
      const n = next.split(sp).length - 1;
      if (n !== 1) { problems.push(`span count ${n}: ${sp.slice(0, 40)}`); continue; }
      next = next.replace(sp, "");
    }
    next = next.replace(/ {2,}/g, " ").replace(/ ([.,;:])/g, "$1");
    if (!isSubsequence(words(next), words(old))) problems.push("not a word subsequence of the original");
    if ((next.match(/\n\n/g) ?? []).length !== (old.match(/\n\n/g) ?? []).length) problems.push("paragraph count changed");
    if (/^\p{Ll}/u.test(next.trim())) problems.push("starts lowercase");
    for (const sentStart of next.matchAll(/(?:[.?!]["']?\s+)(\p{Ll})/gu)) problems.push(`lowercase after sentence end near ${sentStart.index}`);
    const w0 = words(old).length, w1 = words(next).length;
    if (w1 > 160) problems.push(`still ${w1} words`);
    if (problems.length) fail++;
    out.push({ gid: t.gid, words_before: w0, words_after: w1, deleted: w0 - w1, passage_old: old, passage_new: next, spans: t.spans, note: t.note, explanation_en_edit: t.explanation_en, explanation_edit: t.explanation, problems });
    console.log(`${t.gid}: ${w0} -> ${w1}${problems.length ? "  !! " + problems.join(" | ") : ""}`);
  }
  fs.mkdirSync(path.join(ROOT, "data/audit"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "data/audit/sat-trim160-plan-20261019.json"), JSON.stringify({ generatedAt: "2026-10-19", rule: "deletion-only, target <=160 words (<=150 where possible)", items: out }, null, 1) + "\n");
  if (fail) process.exit(1);
}
