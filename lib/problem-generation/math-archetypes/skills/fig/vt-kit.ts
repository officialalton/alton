// 벤·수형도(VT) 계열 자료 원형 공용 장면 키트 — 확률 조합(simple·conditional·sequential_without_replacement)의 VT.P 조합 파일이 함께 쓴다.
// 규칙: 영역의 개수·가지의 확률은 그림 라벨에만 있고 지문은 "the Venn diagram / tree diagram shown" 으로 가리킨다. 모르는 값은 문자 x 로 가려 두고 전체 개수(Total)나 형제 가지의 합 1 로 복원하게 한다.
// verification_js 는 FIGURE.regions[].label / FIGURE.branches[].label 만 읽어 다시 계산한다(라벨이 바뀌면 합이 안 맞거나 답이 달라져 변조가 검출된다).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { gcd } from "../../rng";
import { frac } from "../../text";

export type Rat = [number, number];
export const rat = (n: number, d: number): Rat => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
export const rt = (r: Rat) => frac(r[0], r[1]);
export const addR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const subR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
export const mulR = (a: Rat, b: Rat): Rat => rat(a[0] * b[0], a[1] * b[1]);
export const invR = (a: Rat): Rat => rat(a[1], a[0]);

// ───────────────────────── 벤 다이어그램 ─────────────────────────
export type VTopic = { ent: string; ents: string; a: string; b: string; aName: string; bName: string; aPh: string; bPh: string; where: string };
export const VENN_TOPICS: VTopic[] = [
  { ent: "student", ents: "students", a: "chess club", b: "band", aName: "Chess", bName: "Band", aPh: "is in the chess club", bPh: "is in the band", where: "at a high school" },
  { ent: "student", ents: "students", a: "soccer team", b: "choir", aName: "Soccer", bName: "Choir", aPh: "plays soccer", bPh: "sings in the choir", where: "at a middle school" },
  { ent: "member", ents: "members", a: "pool", b: "gym", aName: "Pool", bName: "Gym", aPh: "uses the pool", bPh: "uses the gym", where: "of a community center" },
  { ent: "resident", ents: "residents", a: "recycling", b: "composting", aName: "Recycle", bName: "Compost", aPh: "recycles", bPh: "composts", where: "in a neighborhood survey" },
  { ent: "customer", ents: "customers", a: "coffee", b: "tea", aName: "Coffee", bName: "Tea", aPh: "bought coffee", bPh: "bought tea", where: "at a cafe on one morning" },
  { ent: "employee", ents: "employees", a: "bus", b: "bike", aName: "Bus", bName: "Bike", aPh: "commutes by bus", bPh: "commutes by bike", where: "at a software company" },
  { ent: "participant", ents: "participants", a: "art class", b: "music class", aName: "Art", bName: "Music", aPh: "took the art class", bPh: "took the music class", where: "in a summer program" },
  { ent: "voter", ents: "voters", a: "Measure A", b: "Measure B", aName: "Meas. A", bName: "Meas. B", aPh: "supports Measure A", bPh: "supports Measure B", where: "in a county poll" },
  { ent: "visitor", ents: "visitors", a: "museum", b: "zoo", aName: "Museum", bName: "Zoo", aPh: "visited the museum", bPh: "visited the zoo", where: "to a city during one weekend" },
  { ent: "reader", ents: "readers", a: "mystery", b: "history", aName: "Mystery", bName: "History", aPh: "read a mystery novel", bPh: "read a history book", where: "in a library survey" },
  { ent: "family", ents: "families", a: "dog", b: "cat", aName: "Dog", bName: "Cat", aPh: "owns a dog", bPh: "owns a cat", where: "on a street" },
  { ent: "athlete", ents: "athletes", a: "running", b: "swimming", aName: "Run", bName: "Swim", aPh: "runs", bPh: "swims", where: "at a training camp" },
];
export type VennScene = { t: VTopic; a: number; ab: number; b: number; out: number; N: number };
export function makeVenn(rng: Rng, o: { topic?: VTopic; lo?: number; hi?: number; abLo?: number } = {}): VennScene {
  const t = o.topic ?? rng.pick(VENN_TOPICS); const lo = o.lo ?? 4, hi = o.hi ?? 30;
  for (let i = 0; i < 60; i++) {
    const a = rng.int(lo, hi), b = rng.int(lo, hi), ab = rng.int(o.abLo ?? 3, 16), out = rng.int(lo, hi); const N = a + ab + b + out;
    if (N > 99 || a === b) continue;
    return { t, a, ab, b, out, N };
  }
  throw new GenFail("벤 장면 표집 실패");
}
export type VennFig = { type: "venn_tree"; kind: "venn"; sets: [string, string]; regions: { id: "a" | "ab" | "b" | "out"; label: string }[]; total?: { label: string } };
export function vennFig(s: VennScene, o: { hide?: "a" | "ab" | "b" | "out"; hideLabel?: string; total?: boolean; swap?: boolean } = {}): VennFig {
  const lab = (id: "a" | "ab" | "b" | "out") => (o.hide === id ? (o.hideLabel ?? "x") : String(s[id]));
  const sets: [string, string] = o.swap ? [s.t.bName, s.t.aName] : [s.t.aName, s.t.bName];
  const reg = (id: "a" | "ab" | "b" | "out") => ({ id, label: lab(o.swap ? (id === "a" ? "b" : id === "b" ? "a" : id) : id) });
  return { type: "venn_tree", kind: "venn", sets, regions: [reg("a"), reg("ab"), reg("b"), reg("out")], ...(o.total || o.hide ? { total: { label: String(s.N) } } : {}) };
}
/** FIGURE(venn)에서 영역 값 a·ab·b·out 과 total 을 읽어 모르는 하나(문자)를 total 로 복원하는 JS. 변수: a, ab, b, out, N. */
export const VENN_JS = `if (!FIGURE||FIGURE.type!=='venn_tree'||FIGURE.kind!=='venn') throw new Error('벤 다이어그램 자료 필요');
const RG={}; for (const r of FIGURE.regions) RG[r.id]=/^\\d+$/.test(String(r.label))?Number(r.label):NaN; const TOT=FIGURE.total&&/^\\d+$/.test(String(FIGURE.total.label))?Number(FIGURE.total.label):NaN;
const unk=['a','ab','b','out'].filter(k=>Number.isNaN(RG[k])); if (unk.length>1) throw new Error('모르는 영역 둘 이상'); if (unk.length===1) { if (Number.isNaN(TOT)) throw new Error('전체 개수 필요'); RG[unk[0]]=TOT-['a','ab','b','out'].filter(k=>k!==unk[0]).reduce((s,k)=>s+RG[k],0); if (RG[unk[0]]<0) throw new Error('모르는 영역이 음수'); }
let a=RG.a, ab=RG.ab, b=RG.b, out=RG.out; const N=a+ab+b+out; if (!(N>0)) throw new Error('전체 0'); if (!Number.isNaN(TOT)&&TOT!==N) throw new Error('전체 개수가 영역의 합과 다름');
`;

// ───────────────────────── 수형도(비복원 추출) ─────────────────────────
export type BagTopic = { bag: string; item: string; items: string; c1: string; c2: string; drawn: string };
export const BAG_TOPICS: BagTopic[] = [
  { bag: "bag", item: "marble", items: "marbles", c1: "Red", c2: "Blue", drawn: "drawn" },
  { bag: "box", item: "card", items: "cards", c1: "Green", c2: "Yellow", drawn: "picked" },
  { bag: "jar", item: "button", items: "buttons", c1: "Black", c2: "White", drawn: "taken" },
  { bag: "drawer", item: "sock", items: "socks", c1: "Gray", c2: "Brown", drawn: "pulled" },
  { bag: "basket", item: "ball", items: "balls", c1: "Orange", c2: "Purple", drawn: "chosen" },
  { bag: "bowl", item: "token", items: "tokens", c1: "Silver", c2: "Gold", drawn: "selected" },
  { bag: "pouch", item: "bead", items: "beads", c1: "Pink", c2: "Teal", drawn: "removed" },
  { bag: "hat", item: "ticket", items: "tickets", c1: "Blue", c2: "Green", drawn: "drawn" },
];
export type BagScene = { t: BagTopic; r: number; b: number; N: number };
export function makeBag(rng: Rng, o: { topic?: BagTopic; nLo?: number; nHi?: number } = {}): BagScene {
  const t = o.topic ?? rng.pick(BAG_TOPICS);
  for (let i = 0; i < 60; i++) { const N = rng.int(o.nLo ?? 6, o.nHi ?? 12); const r = rng.int(2, N - 2); if (r * 2 === N) continue; return { t, r, b: N - r, N }; }
  throw new GenFail("주머니 장면 표집 실패");
}
export type TreeFig = { type: "venn_tree"; kind: "tree"; branches: { name: string; label: string; next: { name: string; label: string }[] }[] };
const fr = (n: number, d: number) => `${n}/${d}`;
/** 두 번 비복원 추출: 1단계 R(r/N)·B(b/N), 2단계는 남은 개수/(N−1). hide: 모르는 가지를 문자로 가린다. */
export function bagTree(s: BagScene, hide?: { l1?: 0 | 1; l2?: [0 | 1, 0 | 1] }): TreeFig {
  const { r, b, N } = s; const n = N - 1; const c = [s.t.c1, s.t.c2]; const cnt = [r, b];
  const branches = [0, 1].map((i) => ({
    name: c[i], label: hide?.l1 === i ? "x" : fr(cnt[i], N),
    next: [0, 1].map((j) => ({ name: c[j], label: hide?.l2 && hide.l2[0] === i && hide.l2[1] === j ? "x" : fr(cnt[j] - (i === j ? 1 : 0), n) })),
  }));
  return { type: "venn_tree", kind: "tree", branches };
}
/** FIGURE(tree)에서 분수 라벨을 읽어 두 단계 확률 P1[i], P2[i][j] 를 만들고, 문자(x) 하나는 형제 가지의 합 1 로 복원한다. 합이 1 이 아니면 던진다. */
export const TREE_JS = `if (!FIGURE||FIGURE.type!=='venn_tree'||FIGURE.kind!=='tree') throw new Error('수형도 자료 필요');
const pf=(t)=>{ const m=String(t).replace(/\\s+/g,'').match(/^(\\d+)\\/(\\d+)$/); return m?[Number(m[1]),Number(m[2])]:null; };
const BR=FIGURE.branches; if (BR.length!==2||BR.some(b=>b.next.length!==2)) throw new Error('2×2 수형도 필요');
const fix=(arr)=>{ const v=arr.map(l=>{ const q=pf(l); return q?q[0]/q[1]:NaN; }); const u=v.map((x,i)=>Number.isNaN(x)?i:-1).filter(i=>i>=0); if (u.length>1) throw new Error('같은 단계에서 모르는 가지 둘 이상'); if (u.length===1) v[u[0]]=1-v.reduce((s,x,i)=>i===u[0]?s:s+x,0); if (Math.abs(v.reduce((s,x)=>s+x,0)-1)>1e-9) throw new Error('형제 가지의 합이 1 이 아님'); return v; };
const P1=fix(BR.map(b=>b.label)); const P2=BR.map(b=>fix(b.next.map(n=>n.label)));
`;

// ───────────────────────── 지문 틀 ─────────────────────────
import type { DistractorKind } from "../../../review";
export const FWr = (r: Rat, kind: DistractorKind, reason: string) => ({ text: rt(r), kind, reason });
const VLEAD = ["", "", "A school counselor summarizes a survey. ", "A club coordinator tallies responses. ", "A researcher organizes survey data. ", "A teacher prepares a probability exercise. ", "A town office reviews a questionnaire. ", "A planner records who attends each activity. ", "An analyst sorts the results of a poll. "];
export const vennIntro = (rng: Rng, s: VennScene, extra = "") => rng.pick(VLEAD) + rng.pick([
  `The Venn diagram shown classifies ${s.t.ents} ${s.t.where} by whether each ${s.t.ent} ${s.t.aPh} and whether each ${s.t.bPh}.${extra}`,
  `In the Venn diagram shown, the two circles represent the ${s.t.ents} ${s.t.where} who ${s.t.aPh.replace(/^is /, "are ").replace(/s\b(?= |$)/, "")} and who ${s.t.bPh.replace(/^is /, "are ")}, with the overlap showing those in both.${extra}`,
  `A survey of ${s.t.ents} ${s.t.where} asked two yes-or-no questions. The Venn diagram shown gives the counts for each region.${extra}`,
  `Each region of the Venn diagram shown gives the number of ${s.t.ents} ${s.t.where} in that category (${s.t.a}, ${s.t.b}, both, or neither).${extra}`,
  `The Venn diagram below shows how many ${s.t.ents} ${s.t.where} are in the ${s.t.a} group, the ${s.t.b} group, both, or neither.${extra}`,
]);
export const bagIntro = (rng: Rng, s: BagScene, extra = "") => rng.pick(VLEAD.map((x) => (x ? x.replace(/survey|poll|questionnaire/g, "game") : x))) + rng.pick([
  `A ${s.t.bag} contains ${s.t.items} of two colors, ${s.t.c1.toLowerCase()} and ${s.t.c2.toLowerCase()}. Two ${s.t.items} are ${s.t.drawn} at random without replacement. The tree diagram shown gives the probabilities.${extra}`,
  `The tree diagram shown models picking two ${s.t.items} one after the other, without replacement, from a ${s.t.bag} of ${s.t.c1.toLowerCase()} and ${s.t.c2.toLowerCase()} ${s.t.items}.${extra}`,
  `From a ${s.t.bag} holding ${s.t.c1.toLowerCase()} and ${s.t.c2.toLowerCase()} ${s.t.items}, one ${s.t.item} is ${s.t.drawn} and set aside, and then a second ${s.t.item} is ${s.t.drawn}. The tree diagram shows the branch probabilities.${extra}`,
  `In the tree diagram shown, each branch is labeled with a probability for two ${s.t.items} ${s.t.drawn} without replacement from a ${s.t.bag}.${extra}`,
]);
/** 교집합이 x 이고 전체·첫 집합의 확률(P.pn/P.pd)이 주어질 때 x 복원(변수 x, TOT, g). */
export const INV_JS = `if(!FIGURE||FIGURE.type!=='venn_tree'||FIGURE.kind!=='venn') throw new Error('벤 다이어그램 자료 필요');
const g=(id)=>{ const r=FIGURE.regions.find(q=>q.id===id); return /^\\d+$/.test(String(r.label))?Number(r.label):NaN; };
const TOT=Number(FIGURE.total&&FIGURE.total.label); if(!(TOT>0)) throw new Error('전체 개수 필요'); if(!Number.isNaN(g('ab'))) throw new Error('교집합이 x 여야 함');
const x=P.pn*TOT/P.pd-g('a'); if(!Number.isInteger(x)||x<0) throw new Error('x 해석 불가'); if (g('a')+x+g('b')+g('out')!==TOT) throw new Error('영역 합이 전체와 다름');
`;
