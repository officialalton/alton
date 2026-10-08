// R&W 지문 소재 분류 공용 모듈(2026-10-08). 순수 함수만 — DB·LLM 접근 없음.
// 조립기(assemble-unique.ts)·보수 계획(rw-topic-repair.ts)·리포트(rw-topics.ts)가 같은 분류표·상한 규칙을 쓴다.
import { createHash } from "node:crypto";

export const SUBJECTS = [
  "literature_fiction", "humanities", "social_science", "history_civics", "economics_business",
  "science_life", "science_earth_space", "science_physical", "technology",
] as const;
export type Subject = (typeof SUBJECTS)[number];

/** 목표 구성(%) — College Board digital SAT R&W 지문 분포(문학·역사/사회·인문·과학 각 약 25%)를 세부 과목으로 쪼갠 제안값. 합 100. */
export const TARGET_MIX: Record<Subject, number> = {
  literature_fiction: 22, humanities: 14, social_science: 13, history_civics: 12, economics_business: 8,
  science_life: 11, science_earth_space: 7, science_physical: 8, technology: 5,
};

export type TopicTag = { subject: Subject; cluster: string; family: string; passageHash: string };
export type TopicMap = Map<string, { subject: string; cluster: string; family?: string }>;

export const normalizePassage = (t: string) => t.toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9가-힣]+/g, " ").trim();
export const passageHash = (t: string) => createHash("sha1").update(normalizePassage(t)).digest("hex").slice(0, 16);
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** 상한 규칙(family 상한은 문학 지문에는 적용하지 않는다 — 문학 family 는 "가족·성장" 같은 넓은 주제라 구분력이 없다).
 * perModule: 한 모듈 안 같은 cluster 최대 수, perExam: 학생 한 응시(M1 + 라우팅된 M2)에서 같은 cluster 최대 수, familyPerExam: 같은 family(넓은 소재) 최대 수. */
export type TopicCaps = { perModule: number; perExam: number; familyPerExam: number };
export const DEFAULT_TOPIC_CAPS: TopicCaps = { perModule: 1, perExam: 2, familyPerExam: 4 };

/** 응시 경로: M1 + lower M2 / M1 + higher M2. 저장된 81문항에서 학생이 실제로 보는 54문항 두 경로. */
export const rwPaths = <T extends { moduleKey: string; route: string | null }>(items: T[]): T[][] => [
  items.filter((i) => i.moduleKey === "rw_m1" || (i.moduleKey === "rw_m2" && i.route === "lower")),
  items.filter((i) => i.moduleKey === "rw_m1" || (i.moduleKey === "rw_m2" && i.route === "higher")),
];

export const countBy = <T>(xs: T[], f: (x: T) => string | null | undefined) => {
  const m = new Map<string, number>(); for (const x of xs) { const k = f(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); } return m;
};

export type CapViolation = { kind: "module" | "exam" | "family"; key: string; count: number; limit: number; where: string };
/** 세트 하나(R&W 문항, moduleKey/route/problemId 포함)의 상한 위반. 한 문항은 한 번만 센다(같은 지문 재사용은 별도 보고). */
export function capViolations(items: { problemId: string; moduleKey: string; route: string | null }[], topics: TopicMap, caps: TopicCaps = DEFAULT_TOPIC_CAPS): CapViolation[] {
  const out: CapViolation[] = [];
  const mods = new Map<string, typeof items>();
  for (const i of items) { const k = `${i.moduleKey}/${i.route ?? "-"}`; (mods.get(k) ?? mods.set(k, []).get(k)!).push(i); }
  for (const [k, arr] of mods) for (const [c, n] of countBy(arr, (i) => topics.get(i.problemId)?.cluster)) if (n > caps.perModule) out.push({ kind: "module", key: c, count: n, limit: caps.perModule, where: k });
  rwPaths(items).forEach((p, idx) => {
    const where = idx === 0 ? "path:lower" : "path:higher";
    for (const [c, n] of countBy(p, (i) => topics.get(i.problemId)?.cluster)) if (n > caps.perExam) out.push({ kind: "exam", key: c, count: n, limit: caps.perExam, where });
    for (const [f, n] of countBy(p, (i) => { const t = topics.get(i.problemId); return t?.subject === "literature_fiction" ? null : t?.family; })) if (n > caps.familyPerExam) out.push({ kind: "family", key: f, count: n, limit: caps.familyPerExam, where });
  });
  return out;
}

/** 현재 선택에 problemId 의 cluster/family 를 더해도 상한을 넘지 않는지(조립 중 점검용). counters 는 호출자가 유지한다. */
export class TopicLedger {
  private mod = new Map<string, number>(); private exam = new Map<string, number>(); private fam = new Map<string, number>();
  constructor(private topics: TopicMap, private caps: TopicCaps = DEFAULT_TOPIC_CAPS) {}
  private paths(moduleKey: string, route: string | null): string[] {
    if (moduleKey === "rw_m1") return ["lower", "higher"];
    return route === "lower" ? ["lower"] : route === "higher" ? ["higher"] : ["lower", "higher"];
  }
  private keys(set: number, moduleKey: string, route: string | null, cluster: string, family: string | undefined, fiction = false) {
    const ps = this.paths(moduleKey, route);
    return { m: `${set}|${moduleKey}|${route ?? "-"}|${cluster}`, e: ps.map((p) => `${set}|${p}|${cluster}`), f: family && !fiction ? ps.map((p) => `${set}|${p}|${family}`) : [] };
  }
  ok(set: number, moduleKey: string, route: string | null, problemId: string): boolean {
    const t = this.topics.get(problemId); if (!t) return true;
    const k = this.keys(set, moduleKey, route, t.cluster, t.family, t.subject === "literature_fiction");
    return (this.mod.get(k.m) ?? 0) < this.caps.perModule && k.e.every((x) => (this.exam.get(x) ?? 0) < this.caps.perExam) && k.f.every((x) => (this.fam.get(x) ?? 0) < this.caps.familyPerExam);
  }
  /** 이미 쓴 정도(작을수록 새 소재) — 정렬 키용. */
  load(set: number, moduleKey: string, route: string | null, problemId: string): number {
    const t = this.topics.get(problemId); if (!t) return 0;
    const k = this.keys(set, moduleKey, route, t.cluster, t.family, t.subject === "literature_fiction");
    return Math.max(0, ...k.e.map((x) => this.exam.get(x) ?? 0));
  }
  add(set: number, moduleKey: string, route: string | null, problemId: string, d: 1 | -1 = 1) {
    const t = this.topics.get(problemId); if (!t) return;
    const k = this.keys(set, moduleKey, route, t.cluster, t.family, t.subject === "literature_fiction");
    this.mod.set(k.m, (this.mod.get(k.m) ?? 0) + d); for (const x of k.e) this.exam.set(x, (this.exam.get(x) ?? 0) + d); for (const x of k.f) this.fam.set(x, (this.fam.get(x) ?? 0) + d);
  }
}

/** 소프트 구성: 현재 세트 과목 비율이 목표보다 얼마나 앞서 있는지(양수면 과다). 정렬 키로 쓴다. */
export function subjectExcess(counts: Map<string, number>, total: number, subject: string, mix: Record<string, number> = TARGET_MIX): number {
  const target = (mix[subject] ?? 5) / 100; return ((counts.get(subject) ?? 0) + 1) / Math.max(1, total + 1) - target;
}

/** 은행 전체 포화 목록: 은행 문항 수가 상한(share 또는 절대 수)을 넘는 cluster/family. 생성 프롬프트의 피해야 할 소재 목록. */
export function saturationList<T extends { cluster: string; family: string }>(tags: T[], opts: { clusterCap: number; familyCap: number; familyExclude?: (t: T) => boolean }) {
  const c = countBy(tags, (t) => t.cluster), f = countBy(tags, (t) => (opts.familyExclude?.(t) ? null : t.family));
  return {
    clusters: [...c].filter(([, n]) => n > opts.clusterCap).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ cluster: k, count: n })),
    families: [...f].filter(([, n]) => n > opts.familyCap).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ family: k, count: n })),
  };
}
