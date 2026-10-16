// 담당 A 원형(원형당 2건)의 Preview 육안 확인용 샘플 — import.ts 호환 passed.json + 점검 포인트가 붙은 samples.tsv. DB·API 없음.
// 실행: npx tsx scripts/mock-exam-generation/archetype-a-samples.ts [--out data/mock-exam-generation/math-archetype-A] [--per 2]
// 로컬 Preview 확인: npx tsx scripts/mock-exam-generation/import.ts --file <out>/passed.json --tag math-archetype-A   (총괄이 대상 DB 를 지정)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { A_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/skills/a-registry";
import { produceFromArchetypes } from "../../lib/problem-generation/math-archetypes/bulk";
import { generateOne } from "../../lib/problem-generation/math-archetypes/sweep";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const out = path.resolve(arg("--out") ?? "data/mock-exam-generation/math-archetype-A"); const per = Number(arg("--per") ?? 2);
mkdirSync(out, { recursive: true });
const OPS: Record<string, string> = {
  param_condition: "조건(해의 개수·합·곱 등)을 식으로 옮긴 것이 문장과 일치하는가",
  inverse: "주어진 결과에서 거꾸로 구한 값이 지문 수치와 맞는가(정방향 재계산 일치)",
  compose_kind: "합성한 두 개념의 순서·연결(앞 결과가 뒤 입력)이 문장과 맞는가",
  chain2: "앞 단계 결과가 둘째 식에 올바르게 대입돼 읽히는가(문자 k 의 의미)",
  unit_ratio: "단위 환산 방향(1일=24시간 등)과 배율 방향이 문장과 맞는가",
  repr_shift: "문장→식 모델링에서 변수 정의와 식이 일치하는가",
  constraint_select: "제약(양수·외래근·사분면) 적용 후 고른 값이 조건에 맞는가",
  compare_scenarios: "두 경우 비교의 방향(누가 더 큰가·언제 역전)이 문장과 맞는가",
  frame: "문장 틀이 해당 세부 패턴을 묻는지, 난이도(easy/medium)에 맞는 길이·단계인지",
};
const records = []; const rows: string[] = [];
for (const a of A_ARCHETYPES) {
  const { records: rs } = produceFromArchetypes([a], { runId: "math-archetype-A", count: per, seedStart: 0 });
  for (const r of rs) {
    records.push(r); const mg = (r.quality as { mockExamGeneration: { seed: number } }).mockExamGeneration; const g = generateOne(a, mg.seed);
    const sem = g.ok && g.inst.semantics?.length ? ` / 명사-수식: ${g.inst.semantics.map((d) => d.noun).join("·")} 문장↔세운 식 일치(둘레/넓이 혼동 여부)` : "";
    const p = r.problem as { passage: string; options: string[]; correctIndex: number };
    const flat = `${p.passage.replace(/\s+/g, " ")} ⟶ 정답 ${p.options[p.correctIndex]}`.slice(0, 230);
    rows.push([a.id, a.difficulty ?? "hard", `seed ${mg.seed}`, r.gid, r.subpattern, `질문이 묻는 양=정답 선지 / 지문 문자·수치↔식 일치 / ${OPS[a.operator]}${sem}`, flat].join("\t"));
  }
}
writeFileSync(path.join(out, "passed.json"), JSON.stringify(records, null, 1));
writeFileSync(path.join(out, "samples.tsv"), ["archetype\tdifficulty\tseed\tgid\tsubpattern\t점검 포인트\t문항 요약", ...rows].join("\n") + "\n");
console.log(`records ${records.length} -> ${out}`);
