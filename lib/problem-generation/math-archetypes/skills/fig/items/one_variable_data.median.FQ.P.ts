// one_variable_data.median.FQ.P — 도수표에서 누적 도수로 중앙값의 위치를 찾고, 자료 추가·제거·평균 비교로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { expand, FQ_JS, fqIntro, fqRead, makeFq, medianOfList, type FqScene } from "../table-kit";

const MD_JS = "const md = (l) => { const s = [...l].sort((p, q) => p - q); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };\n";
const posStep = (s: FqScene): [string, string] => [s.N % 2 ? `전체 ${s.N} 개이므로 중앙값은 ${(s.N + 1) / 2} 번째 값이다.` : `전체 ${s.N} 개이므로 중앙값은 ${s.N / 2} 번째와 ${s.N / 2 + 1} 번째 값의 평균이다.`, "Locate the middle position."];
const cumStep = (s: FqScene): [string, string] => { let c = 0; return [`누적 도수: ${s.vals.map((v, i) => `${v}→${(c += s.freqs[i])}`).join(", ")} 이다.`, "Accumulate the frequencies."]; };
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
function intMeanFq(rng: Rng): FqScene {
  for (let t = 0; t < 400; t++) { const s = makeFq(rng); if (s.sum % s.N === 0) return s; }
  throw new GenFail("정수 평균 도수표 표집 실패");
}

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.median.FQ.P",
  hard: [
    {
      op: "compose_kind", structure: "도수표에서 평균(가중 합 ÷ 개수)과 중앙값(누적 도수)을 각각 구해 차를 구함", extra: "평균과 중앙값이라는 서로 다른 대푯값을 모두 계산해 비교 — medium 은 중앙값 하나",
      concepts: ["도수표", "평균", "중앙값"],
      gen(rng) {
        const s = intMeanFq(rng); const m = s.sum / s.N; const md = medianOfList(expand(s)); if (m === md) throw new GenFail("eq"); const correct = Math.abs(m - md);
        const plainMd = medianOfList(s.vals);
        return figInst(rng, {
          stimulus: fqIntro(rng, s),
          question: rng.pick([`What is the positive difference between the mean and the median of the data, in ${s.t.unit}?`, `By how many ${s.t.unit} does the mean of the data differ from the median of the data?`]), correct,
          wrongs: pos([W(m, "step_missing", "평균만 답했다."), W(md, "step_missing", "중앙값만 답했다."), W(Math.abs(m - plainMd), "axis_misread", "도수를 무시하고 값 열의 가운데를 중앙값으로 썼다."), W(m + md, "sign_error", "합을 구했다."), W(correct + 1, "other", "1 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${FQ_JS}return Math.abs(S / N - med);`),
          trace: [fqRead(s), [`합 = ${s.sum}, 평균 = ${s.sum} ÷ ${s.N} = ${m} 이다.`, "Compute the mean."], posStep(s), cumStep(s), [`중앙값 = ${fmtNum(md)} 이다.`, "Read the median from the cumulative counts."], [`차 = |${m} - ${fmtNum(md)}| = ${fmtNum(correct)} 이다.`, "Take the positive difference."]], variant: "mean_vs_median_fq",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "가장 작은 값을 가진 개체 k 개를 빼고 남은 자료의 중앙값을 누적 도수로 다시 구함", extra: "자료 수정(첫 행 도수 감소) → 새 전체 개수 → 새 중앙값 위치의 연쇄 — medium 은 원래 중앙값",
      concepts: ["도수표", "중앙값", "자료 변경"],
      gen(rng) {
        for (let t = 0; t < 60; t++) {
          const s = makeFq(rng, { fmax: 9 }); if (s.freqs[0] < 3) continue; const k = rng.int(2, s.freqs[0] - 1);
          const fr2 = [s.freqs[0] - k, ...s.freqs.slice(1)]; const md0 = medianOfList(expand(s)); const md = medianOfList(expand({ vals: s.vals, freqs: fr2 })); if (md === md0) continue;
          const s2 = { ...s, freqs: fr2, N: s.N - k };
          return figInst(rng, {
            stimulus: `${fqIntro(rng, s)} ${rng.pick(["Later,", "After the survey,", "Afterward,"])} ${k} of the ${s.t.ent} with the least value are removed from the data.`,
            question: rng.pick([`What is the median of the remaining data, in ${s.t.unit}?`, `After the removal, what is the median, in ${s.t.unit}, of the data?`]), correct: md,
            wrongs: pos([W(md0, "step_missing", "제거 전 중앙값을 답했다."), W(medianOfList(expand({ vals: s.vals, freqs: [...s.freqs.slice(0, -1), s.freqs[s.freqs.length - 1] - k] })), "opposite", "가장 큰 값 쪽에서 뺐다."), W(medianOfList(s.vals.slice(1)), "axis_misread", "도수를 무시하고 값 열만 보았다."), W(md + s.t.step, "other", "한 칸 위 값을 골랐다."), W(md - s.t.step, "other", "한 칸 아래 값을 골랐다.")]).filter((w) => w.v !== md),
            verificationJs: figJs({ k }, s.fig, `${FQ_JS}${MD_JS}const l = list.slice(P.k); if (fr[0] < P.k) throw new Error('도수 부족'); return md(l);`),
            trace: [fqRead(s), [`가장 작은 값 ${s.vals[0]} 의 도수가 ${s.freqs[0]} 에서 ${s.freqs[0] - k} 로 줄어든다.`, "Reduce the first frequency."], [`남은 개수 = ${s.N} - ${k} = ${s.N - k} 이다.`, "New total count."], posStep(s2), cumStep(s2), [`새 중앙값 = ${fmtNum(md)} 이다.`, "Read the new median."]], variant: "median_after_removing_smallest",
          }, s.fig);
        }
        throw new GenFail("chain");
      },
    },
    {
      op: "param_condition", structure: "표의 모든 값보다 큰 값 X 를 가진 개체를 더할 때 중앙값이 M 이상이 되는 최소 개수를 구함", extra: "추가 개수에 따라 중앙값 위치가 움직이는 조건을 누적 도수로 따져 최소값을 찾음 — medium 은 중앙값 하나",
      concepts: ["도수표", "중앙값", "조건을 만족하는 최소 개수"],
      gen(rng) {
        for (let t = 0; t < 60; t++) {
          const s = makeFq(rng); const md0 = medianOfList(expand(s)); const higher = s.vals.filter((v) => v > md0); if (!higher.length) continue;
          const M = rng.pick(higher); const X = s.vals[s.vals.length - 1] + s.t.step * rng.int(1, 3);
          let k = 0; const l = expand(s); for (k = 1; k <= 300; k++) { l.push(X); if (medianOfList(l) >= M) break; } if (k > 300 || k < 2) continue;
          return figInst(rng, {
            stimulus: `${fqIntro(rng, s)} ${rng.pick(["Some new", "Additional", "More"])} ${s.t.ent} are added to the data, and each of them has a value of ${X} ${s.t.unit}.`,
            question: rng.pick([`What is the least number of ${s.t.ent} that must be added so that the median of the data is at least ${M} ${s.t.unit}?`, `At least how many new ${s.t.ent} must be added for the median of the data to be ${M} ${s.t.unit} or more?`]), correct: k,
            wrongs: pos([W(k - 1, "condition_ignored", "경계(같은 경우)를 놓쳤다."), W(k + 1, "other", "하나 더 더했다."), W(2 * k, "formula_misuse", "가운데를 두 배로 옮겨야 한다고 보았다."), W(s.N, "axis_misread", "전체 개수를 답했다."), W(Math.max(0, s.N - 2 * s.vals.filter((v) => v >= M).length), "formula_misuse", "도수를 잘못 맞췄다.")]).filter((w) => w.v !== k),
            verificationJs: figJs({ X, M }, s.fig, `${FQ_JS}${MD_JS}if (P.X <= Math.max(...vals)) throw new Error('X 가 최댓값 이하'); const l = [...list]; for (let k = 1; k <= 300; k++) { l.push(P.X); if (md(l) >= P.M) return k; } throw new Error('없음');`),
            trace: [fqRead(s), posStep(s), cumStep(s), [`현재 중앙값은 ${fmtNum(md0)} 이고, ${X} 를 더할 때마다 중앙값 위치가 반 칸씩 큰 쪽으로 옮겨진다.`, "Each added large value shifts the middle up by half a position."], [`${M} 이상의 값이 전체의 절반 이상을 차지해야 한다.`, "Values at least M must reach the middle."], [`하나씩 더해 보면 ${k} 개를 더했을 때 처음으로 중앙값이 ${M} 이상이 된다.`, "Find the least count that works."]], variant: "least_added_for_median",
          }, s.fig);
        }
        throw new GenFail("param");
      },
    },
    {
      op: "constraint_select", structure: "도수표의 중앙값을 구한 뒤, 그 중앙값보다 큰 값을 가진 개체 수를 셈", extra: "중앙값(누적 도수) → 그 기준 이상의 도수 합(등호 제외)의 연쇄 조건 선택 — medium 은 중앙값까지",
      concepts: ["도수표", "중앙값", "조건에 맞는 도수 합"],
      gen(rng) {
        const s = makeFq(rng); const md = medianOfList(expand(s)); const above = s.vals.reduce((a, v, i) => a + (v > md ? s.freqs[i] : 0), 0); const ge = s.vals.reduce((a, v, i) => a + (v >= md ? s.freqs[i] : 0), 0);
        if (above === 0) throw new GenFail("above");
        return figInst(rng, {
          stimulus: fqIntro(rng, s),
          question: rng.pick([`How many of the ${s.t.ent} have a value greater than the median of the data?`, `For how many ${s.t.ent} is the value strictly greater than the median of the data?`]), correct: above,
          wrongs: pos([W(ge === above ? above + 1 : ge, "condition_ignored", "중앙값과 같은 값까지 셌다."), W(s.N - above, "opposite", "중앙값 이하를 셌다."), W(Math.floor(s.N / 2), "formula_misuse", "항상 절반이라고 보았다."), W(s.vals.filter((v) => v > md).length, "axis_misread", "값의 종류 수를 셌다."), W(above - 1, "other", "하나를 빠뜨렸다.")]).filter((w) => w.v !== above),
          verificationJs: figJs({}, s.fig, `${FQ_JS}return vals.reduce((a, v, i) => a + (v > med ? fr[i] : 0), 0);`),
          trace: [fqRead(s), posStep(s), cumStep(s), [`중앙값 = ${fmtNum(md)} 이다.`, "Find the median."], [`${fmtNum(md)} 보다 큰 값의 도수를 더하면 ${above} 이다.`, "Add the frequencies above the median."]], variant: "count_above_median",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "mode", structure: "도수표에서 도수가 가장 큰 값(최빈값)을 읽음", extra: "easy: 가장 큰 도수의 값 읽기", concepts: ["도수표", "최빈값"],
      gen(rng) {
        const s = makeFq(rng); const mx = Math.max(...s.freqs); if (s.freqs.filter((f) => f === mx).length > 1) throw new GenFail("tie"); const i = s.freqs.indexOf(mx); const v = s.vals[i];
        return figInst(rng, { stimulus: fqIntro(rng, s), question: rng.pick([`What is the mode of the data, in ${s.t.unit}?`, `Which value, in ${s.t.unit}, occurs most often in the data?`]), correct: v, wrongs: pos([W(mx, "axis_misread", "도수를 답했다."), W(s.vals[(i + 1) % s.vals.length], "axis_misread", "옆 행의 값을 읽었다."), W(s.vals[(i + s.vals.length - 1) % s.vals.length], "axis_misread", "옆 행의 값을 읽었다."), W(s.vals[s.freqs.indexOf(Math.min(...s.freqs))], "opposite", "가장 적은 도수의 값을 골랐다.")]).filter((w) => w.v !== v), verificationJs: figJs({}, s.fig, `${FQ_JS}const mx = Math.max(...fr); if (fr.filter(f => f === mx).length > 1) throw new Error('최빈값 둘 이상'); return vals[fr.indexOf(mx)];`), trace: [fqRead(s), [`가장 큰 도수는 ${mx} 이고 그 값은 ${v} 이다.`, "Pick the value with the largest frequency."]], variant: "mode_fq" }, s.fig);
      },
    },
    {
      lv: "medium", name: "median", structure: "도수표에서 누적 도수로 중앙값을 찾음", extra: "medium: 중앙값 위치 → 누적 도수", concepts: ["도수표", "중앙값"],
      gen(rng) {
        const s = makeFq(rng); const md = medianOfList(expand(s));
        return figInst(rng, { stimulus: fqIntro(rng, s), question: rng.pick([`What is the median of the data, in ${s.t.unit}?`, `What is the median value, in ${s.t.unit}, for these ${s.t.ent}?`]), correct: md, wrongs: pos([W(medianOfList(s.vals), "axis_misread", "도수를 무시하고 값 열의 가운데를 골랐다."), W(medianOfList(s.freqs), "axis_misread", "도수 열의 중앙값을 구했다."), W(md + s.t.step, "other", "한 칸 위 값을 골랐다."), W(md - s.t.step, "other", "한 칸 아래 값을 골랐다."), W(Math.round(s.sum / s.N), "formula_misuse", "평균을 구했다.")]).filter((w) => w.v !== md), verificationJs: figJs({}, s.fig, `${FQ_JS}return med;`), trace: [fqRead(s), posStep(s), cumStep(s), [`중앙값 = ${fmtNum(md)} 이다.`, "Read the median."]], variant: "median_fq" }, s.fig);
      },
    },
  ],
});
