// B 담당(일차 계열 5 skill) 원형의 Preview 육안 확인용 샘플(원형당 2건)을 import.ts 호환 passed.json + samples.tsv 로 만든다. DB·API 없음.
// 실행: npx tsx scripts/mock-exam-generation/archetype-b-samples.ts [--out data/mock-exam-generation/math-archetype-B] [--per 2]
// 로컬 Preview 확인: npx tsx scripts/mock-exam-generation/import.ts --file <out>/passed.json --tag math-archetype-B   (총괄이 대상 DB 를 지정)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ARCHETYPES, EM_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { produceFromArchetypes } from "../../lib/problem-generation/math-archetypes/bulk";
import { generateOne } from "../../lib/problem-generation/math-archetypes/sweep";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const out = path.resolve(arg("--out") ?? "data/mock-exam-generation/math-archetype-B"); const per = Number(arg("--per") ?? 2);
const B = ["linear_equations_one_var", "linear_functions", "linear_equations_two_var", "systems_linear", "linear_inequalities"];
mkdirSync(out, { recursive: true });
/** 세부 패턴별 '문장과 변수의 의미 일치' 육안 점검 포인트(대응표가 있으면 함께 적는다). */
const HINT: Record<string, string> = {
  solve: "부등호/등호 방향어와 식의 방향 일치, 변수 문자가 질문과 같은 문자인지",
  word_problem_translate: "문장의 수량-명사가 식의 항과 일치(몇 배·몇 더 큰/작은의 방향)",
  literal_rearrange: "공식에 쓰인 문자와 질문이 묻는 문자의 일치, 단위",
  evaluate: "함수 이름·입력값이 질문의 f(·) 와 일치, 합성 순서(안쪽/바깥쪽)",
  find_x_for_value: "구하는 대상이 입력(x)인지 출력값인지, 목표값이 문장 조건과 일치",
  slope_from_two_points: "두 점의 (x, y) 순서·부호와 기울기 방향, 직선 이름(ℓ, m 등) 일치",
  interpret_slope: "증가/감소 동사가 기울기 부호와 일치, 단위(시간·양) 환산 방향, 맥락 명사와 수치 대응",
  interpret_intercept: "'시작값(t=0)'이 질문의 시점과 일치, 단위 환산, 증가/감소 방향 역산",
  solve_one_var: "부등호 방향어(at least/at most 등)와 식 일치, 정수 조건·포함 여부 문구",
  point_in_solution: "점의 좌표 순서(x, y)와 포함 여부(<, ≤), '해가 아님/해임' 문구",
  table_verification: "나열된 순서쌍과 문장 부등식의 일치(m배보다 b 큼/작음), 경계 포함 여부",
  intersection_x: "묻는 것이 x 좌표인지 y 좌표인지, 직선 이름·식의 y 절편 부호",
  intersection_y: "묻는 것이 y 좌표인지, 셋째 직선에 넣는 값이 교점의 x 인지",
  intersection_sum: "묻는 값이 x + y(합)인지, 미지 상수가 어느 식에 있는지",
  slope: "기울기/절편 구분, 표준형 계수 부호와 기울기 −a/b 부호",
  intercept: "x 절편/y 절편 구분, 단위·물건 이름(가격-명사)과 수치 대응",
  num_solutions: "'해 없음/무수히 많음/오직 하나' 문구와 조건 일치, 미지 상수 문자가 수식에 있는지",
  substitution_solve: "대입 대상 변수와 질문 변수 일치, 문장 관계(몇 배보다 몇 큼)의 방향",
  elimination_value: "묻는 값(x/y/식의 값/k 합)과 정답 대응, 소거할 변수",
  param_no_solution: "'해 없음' 문구와 평행 조건, 양수/정수 제약 문구",
  word_system: "물건 이름과 가격 수치의 대응(대응표), 총 개수/총 금액 구분, 묻는 종류",
};
const rows: string[] = ["archetype\tdifficulty\tseed\tgid\tsubpattern\t지문\t질문\t정답\t의미 일치 점검 포인트"]; const records: unknown[] = [];
for (const a of [...ARCHETYPES, ...EM_ARCHETYPES].filter((x) => B.includes(x.skill) && !(x.id.startsWith("le.") && !x.difficulty))) {
  const { records: rs } = produceFromArchetypes([a], { runId: "math-archetype-B", count: per, seedStart: 0 });
  for (const r of rs) {
    records.push(r); const p = r.problem as { stimulus: string; question: string; options: string[]; correctIndex: number }; const seed = (r.quality as { mockExamGeneration: { seed: number } }).mockExamGeneration.seed;
    const g = generateOne(a, seed); const bind = g.ok && g.inst.phraseBindings?.length ? `대응표: ${g.inst.phraseBindings.map((b) => `${b.phrase}=${b.value}`).join("; ")} / ` : "";
    const one = (t: string) => t.replace(/\s*\n+\s*/g, " ⏎ ").replace(/\t/g, " ");
    rows.push([a.id, a.difficulty ?? "hard", seed, r.gid, r.subpattern, one(p.stimulus), one(p.question), p.options[p.correctIndex], bind + (HINT[a.kind] ?? "")].join("\t"));
  }
}
writeFileSync(path.join(out, "passed.json"), JSON.stringify(records, null, 1)); writeFileSync(path.join(out, "samples.tsv"), rows.join("\n") + "\n");
console.log(`records ${records.length} -> ${out}`);
