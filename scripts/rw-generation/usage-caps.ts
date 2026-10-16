// 소재 사용 횟수 상한(2026-10-01): 한 배치·한 세트·전체 풀에서 이름·첫 단어·장소·배경·갈등·관계 사용 횟수를 코드로 강제한다.
// 모델에 '반복하지 말라'고 지시해도 Tobias 가 60개 중 18개에 나왔기 때문에, 생성 전(배정)과 생성 후(검사) 양쪽에서 이 장부로 막는다.
export type Counted = "name" | "locale" | "setting" | "conflict" | "relationship";
export type ScopeCap = { batch: number; set: number; global: number };
export type FirstWordCap = { batchFrac: number; batchMin: number; set: number; globalFrac: number; globalMin: number };
export type Caps = { counted: Record<Counted, ScopeCap>; firstWord: FirstWordCap; secondPersonFrac: number };

/** 기본 상한: 30세트 기준 문학 약 2,000건 풀에서 이름 풀(약 430개)·장소·갈등·관계 목록이 소진되지 않는 수준으로 잡았다. */
export const DEFAULT_CAPS: Caps = {
  counted: {
    name: { batch: 2, set: 1, global: 10 },
    locale: { batch: 3, set: 1, global: 40 },
    setting: { batch: 4, set: 1, global: 45 },
    conflict: { batch: 2, set: 1, global: 32 },
    relationship: { batch: 3, set: 1, global: 40 },
  },
  firstWord: { batchFrac: 0.12, batchMin: 2, set: 2, globalFrac: 0.1, globalMin: 3 },
  secondPersonFrac: 0.2,
};

export type Usage = {
  names: string[];
  firstWord: string;
  locale?: string;
  setting?: string;
  conflict?: string;
  relationship?: string;
  pov?: string;
};
export type Scopes = { batchId: string; setId?: string };
export type Violation = { kind: Counted | "firstWord" | "secondPerson"; value: string; scope: "batch" | "set" | "global"; count: number; cap: number };

const key = (scope: string, scopeId: string, kind: string, value: string) => `${scope}|${scopeId}|${kind}|${value.toLowerCase()}`;

export class UsageLedger {
  private n = new Map<string, number>();
  private povSecond = new Map<string, number>();
  private batchTotals = new Map<string, number>();
  private globalTotal = 0;
  constructor(
    public caps: Caps = DEFAULT_CAPS,
    /** 비율 상한 계산용 예상 규모: 배치마다 예상 건수, 전체 예상 건수. */
    private sizes: { batchSize: number; globalSize: number } = { batchSize: 100, globalSize: 2000 },
  ) {}
  count(scope: "batch" | "set" | "global", scopeId: string, kind: string, value: string) {
    return this.n.get(key(scope, scopeId, kind, value)) ?? 0;
  }
  /** 전체 사용 횟수 — 배정기가 '덜 쓴 것 우선'을 고를 때 쓴다. */
  globalCount(kind: string, value: string) {
    return this.count("global", "*", kind, value);
  }
  private values(u: Usage): { kind: Counted | "firstWord"; value: string }[] {
    const out: { kind: Counted | "firstWord"; value: string }[] = [];
    for (const nm of new Set(u.names)) out.push({ kind: "name", value: nm });
    if (u.locale) out.push({ kind: "locale", value: u.locale });
    if (u.setting) out.push({ kind: "setting", value: u.setting });
    if (u.conflict) out.push({ kind: "conflict", value: u.conflict });
    if (u.relationship) out.push({ kind: "relationship", value: u.relationship });
    if (u.firstWord) out.push({ kind: "firstWord", value: u.firstWord });
    return out;
  }
  private capFor(kind: Counted | "firstWord", scope: "batch" | "set" | "global"): number {
    if (kind === "firstWord") {
      const f = this.caps.firstWord;
      if (scope === "set") return f.set;
      if (scope === "batch") return Math.max(f.batchMin, Math.ceil(f.batchFrac * this.sizes.batchSize));
      return Math.max(f.globalMin, Math.ceil(f.globalFrac * this.sizes.globalSize));
    }
    return this.caps.counted[kind][scope];
  }
  /** 사용을 추가했을 때 상한을 넘는 항목들(비어 있으면 통과). 장부는 바꾸지 않는다. */
  check(u: Usage, s: Scopes): Violation[] {
    const bad: Violation[] = [];
    for (const { kind, value } of this.values(u)) {
      const scopes: ["batch" | "set" | "global", string | undefined][] = [["batch", s.batchId], ["set", s.setId], ["global", "*"]];
      for (const [scope, id] of scopes) {
        if (!id) continue;
        const cap = this.capFor(kind, scope);
        const count = this.count(scope, id, kind, value) + 1;
        if (count > cap) bad.push({ kind, value, scope, count, cap });
      }
    }
    if (u.pov === "second") {
      const cap = Math.max(1, Math.ceil(this.caps.secondPersonFrac * this.sizes.batchSize));
      const count = (this.povSecond.get(s.batchId) ?? 0) + 1;
      if (count > cap) bad.push({ kind: "secondPerson", value: "second", scope: "batch", count, cap });
    }
    return bad;
  }
  commit(u: Usage, s: Scopes) {
    for (const { kind, value } of this.values(u)) {
      for (const [scope, id] of [["batch", s.batchId], ["set", s.setId], ["global", "*"]] as const) {
        if (!id) continue;
        const k = key(scope, id, kind, value);
        this.n.set(k, (this.n.get(k) ?? 0) + 1);
      }
    }
    if (u.pov === "second") this.povSecond.set(s.batchId, (this.povSecond.get(s.batchId) ?? 0) + 1);
    this.batchTotals.set(s.batchId, (this.batchTotals.get(s.batchId) ?? 0) + 1);
    this.globalTotal++;
  }
  /** 통과하면 기록하고 [] 를, 위반이면 기록하지 않고 위반 목록을 돌려준다. */
  tryCommit(u: Usage, s: Scopes): Violation[] {
    const v = this.check(u, s);
    if (v.length === 0) this.commit(u, s);
    return v;
  }
  /** 세션 모드처럼 프로세스가 나뉘는 흐름에서 장부를 파일로 이어 쓰기 위한 직렬화(결정론: 키 정렬). */
  serialize(): { n: [string, number][]; povSecond: [string, number][]; batchTotals: [string, number][]; globalTotal: number } {
    const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { n: sorted(this.n), povSecond: sorted(this.povSecond), batchTotals: sorted(this.batchTotals), globalTotal: this.globalTotal };
  }
  restore(s: ReturnType<UsageLedger["serialize"]>) {
    this.n = new Map(s.n);
    this.povSecond = new Map(s.povSecond);
    this.batchTotals = new Map(s.batchTotals);
    this.globalTotal = s.globalTotal;
    return this;
  }
  /** 현재까지 낸 전체 풀 상위 사용 항목(보고용). */
  top(kind: Counted | "firstWord", n = 5): { value: string; count: number }[] {
    const pre = `global|*|${kind}|`;
    return [...this.n.entries()].filter(([k]) => k.startsWith(pre)).map(([k, c]) => ({ value: k.slice(pre.length), count: c })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, n);
  }
}

/** 지문 본문에서 첫 단어와 이름 풀에 있는 이름을 뽑는다(세트 조립·생성 후 검사용). */
export function extractUsage(text: string, knownNames: string[]): Pick<Usage, "names" | "firstWord"> {
  const first = (text.trim().match(/[A-Za-z']+/) ?? [""])[0].toLowerCase();
  const names: string[] = [];
  for (const nm of knownNames) if (new RegExp(`(?<![A-Za-z])${nm}(?![A-Za-z])`).test(text)) names.push(nm);
  return { names, firstWord: first };
}
