import { describe, expect, it } from "vitest";
import { NAME_POOL, BANNED_NAMES, nameCultures, uniqueNames } from "./name-pool";
import { SETTINGS, LOCALES, CONFLICTS, RELATIONSHIPS } from "./seed-bank";
import { UsageLedger, DEFAULT_CAPS, extractUsage } from "./usage-caps";
import { composeSeeds, allocateGenres, AVOID_FIRST_WORDS } from "./seed-compose";

describe("이름·소재 풀", () => {
  it("이름은 수백 개, 문화 20곳 이상, 성별·시대가 고르게 분산", () => {
    expect(uniqueNames().length).toBeGreaterThanOrEqual(400);
    expect(nameCultures().length).toBeGreaterThanOrEqual(20);
    for (const g of ["f", "m"] as const) expect(NAME_POOL.filter((n) => n.gender === g).length).toBeGreaterThan(150);
    for (const e of ["classic", "modern"] as const) expect(NAME_POOL.filter((n) => n.era === e).length).toBeGreaterThan(150);
    const perCulture = nameCultures().map((c) => NAME_POOL.filter((n) => n.culture === c).length);
    expect(Math.max(...perCulture) / Math.min(...perCulture)).toBeLessThan(2.6);
  });
  it("과다 반복이 확인된 이름은 풀에 없다", () => {
    for (const b of BANNED_NAMES) expect(NAME_POOL.some((n) => n.name.toLowerCase() === b)).toBe(false);
    expect(BANNED_NAMES).toEqual(expect.arrayContaining(["tobias", "odalys", "wren"]));
  });
  it("장소·배경·갈등·관계 목록이 대폭 확대(중복 없음)", () => {
    expect(SETTINGS.length * LOCALES.length).toBeGreaterThan(3000);
    expect(LOCALES.length).toBeGreaterThanOrEqual(60);
    expect(CONFLICTS.length).toBeGreaterThanOrEqual(70);
    expect(RELATIONSHIPS.length).toBeGreaterThanOrEqual(55);
    for (const l of [SETTINGS, CONFLICTS, RELATIONSHIPS]) expect(new Set(l).size).toBe(l.length);
    expect(new Set(LOCALES.map((l) => l.place)).size).toBe(LOCALES.length);
  });
});

describe("사용 상한 장부", () => {
  it("이름: 배치 2회까지, 3번째는 위반(batch 범위)", () => {
    const led = new UsageLedger();
    const s = { batchId: "b1" };
    expect(led.tryCommit({ names: ["Nora"], firstWord: "" }, s)).toEqual([]);
    expect(led.tryCommit({ names: ["Nora"], firstWord: "" }, s)).toEqual([]);
    const v = led.tryCommit({ names: ["Nora"], firstWord: "" }, s);
    expect(v[0]).toMatchObject({ kind: "name", scope: "batch", count: 3, cap: 2 });
    expect(led.count("batch", "b1", "name", "Nora")).toBe(2); // 위반은 기록하지 않는다
  });
  it("세트 안에서는 같은 이름 1회, 전체 풀 상한은 10회", () => {
    const led = new UsageLedger();
    led.commit({ names: ["Kofi"], firstWord: "" }, { batchId: "b1", setId: "s1" });
    expect(led.check({ names: ["Kofi"], firstWord: "" }, { batchId: "b2", setId: "s1" })[0]).toMatchObject({ scope: "set", cap: 1 });
    for (let i = 0; i < 10; i++) led.commit({ names: ["Ama"], firstWord: "" }, { batchId: `g${i}` });
    expect(led.check({ names: ["Ama"], firstWord: "" }, { batchId: "gx" })[0]).toMatchObject({ scope: "global", count: 11, cap: 10 });
  });
  it("첫 단어: 100건 배치에서 상한 12 건, 13번째 'the' 는 위반. 소량 배치는 최소 2건", () => {
    const led = new UsageLedger(DEFAULT_CAPS, { batchSize: 100, globalSize: 2000 });
    for (let i = 0; i < 12; i++) expect(led.tryCommit({ names: [], firstWord: "the" }, { batchId: "big" })).toEqual([]);
    expect(led.tryCommit({ names: [], firstWord: "the" }, { batchId: "big" })[0]).toMatchObject({ kind: "firstWord", scope: "batch", cap: 12 });
    const small = new UsageLedger(DEFAULT_CAPS, { batchSize: 10, globalSize: 2000 });
    small.commit({ names: [], firstWord: "you" }, { batchId: "s" });
    small.commit({ names: [], firstWord: "you" }, { batchId: "s" });
    expect(small.check({ names: [], firstWord: "you" }, { batchId: "s" })[0]).toMatchObject({ cap: 2 });
  });
  it("2인칭은 배치의 20% 이하", () => {
    const led = new UsageLedger(DEFAULT_CAPS, { batchSize: 10, globalSize: 100 });
    led.commit({ names: [], firstWord: "", pov: "second" }, { batchId: "p" });
    led.commit({ names: [], firstWord: "", pov: "second" }, { batchId: "p" });
    expect(led.check({ names: [], firstWord: "", pov: "second" }, { batchId: "p" })[0]).toMatchObject({ kind: "secondPerson", cap: 2 });
  });
  it("본문에서 첫 단어·이름을 추출한다(단어 경계 보존)", () => {
    const u = extractUsage("\"Look,\" said Nora. Norah looked away; Kofi did not.", ["Nora", "Kofi", "Ama"]);
    expect(u.firstWord).toBe("look");
    expect(u.names).toEqual(["Nora", "Kofi"]);
  });
});

describe("씨앗 조립", () => {
  it("결정론: 같은 배치 ID·장부 상태면 같은 결과", () => {
    const a = composeSeeds({ n: 30, batchId: "det", ledger: new UsageLedger() });
    const b = composeSeeds({ n: 30, batchId: "det", ledger: new UsageLedger() });
    expect(a).toEqual(b);
  });
  it("100건 배치: 상한을 지키고 소재가 겹치지 않으며 금지 이름이 없다", () => {
    const led = new UsageLedger();
    const seeds = composeSeeds({ n: 100, batchId: "lit-test-a", ledger: led });
    expect(new Set(seeds.map((s) => s.topicSeed)).size).toBe(100);
    const cnt = (f: (s: (typeof seeds)[number]) => string[]) => { const m = new Map<string, number>(); for (const s of seeds) for (const x of new Set(f(s))) m.set(x, (m.get(x) ?? 0) + 1); return Math.max(...m.values()); };
    expect(cnt((s) => s.names)).toBeLessThanOrEqual(2);
    expect(cnt((s) => [s.locale])).toBeLessThanOrEqual(3);
    expect(cnt((s) => [s.setting])).toBeLessThanOrEqual(4);
    expect(cnt((s) => [s.conflict])).toBeLessThanOrEqual(2);
    expect(seeds.filter((s) => s.pov === "second").length).toBeLessThanOrEqual(20);
    expect(seeds.flatMap((s) => s.names).some((n) => BANNED_NAMES.includes(n.toLowerCase()))).toBe(false);
    expect(new Set(seeds.map((s) => s.locale)).size).toBeGreaterThan(30);
    expect(new Set(seeds.map((s) => s.nameCultures[0])).size).toBeGreaterThan(12);
  });
  it("전체 풀 2,000건(20배치): 상한 위반 없이 배정되고 이름 최대 사용은 10회 이하", () => {
    const led = new UsageLedger(DEFAULT_CAPS, { batchSize: 100, globalSize: 2000 });
    for (let b = 0; b < 20; b++) composeSeeds({ n: 100, batchId: `lit-all-${b}`, ledger: led });
    expect(led.top("name", 1)[0].count).toBeLessThanOrEqual(10);
    expect(led.top("locale", 1)[0].count).toBeLessThanOrEqual(40);
    expect(led.top("conflict", 1)[0].count).toBeLessThanOrEqual(32);
  });
  it("장르 배분은 규격 권장 비율에 누적 편차 1건 이내로 수렴", () => {
    const g = allocateGenres(100);
    const c = (k: string) => g.filter((x) => x === k).length;
    expect(Math.abs(c("short_story") - 30)).toBeLessThanOrEqual(1);
    expect(c("short_story") + c("novel_excerpt")).toBe(50);
    expect(c("personal_essay") + c("memoir")).toBe(25);
    expect(c("poetry") + c("drama")).toBe(15);
  });
  it("도입 방식은 'The' 로 시작하지 말라는 금지 첫 단어를 포함해 안내한다", () => {
    expect(AVOID_FIRST_WORDS).toEqual(expect.arrayContaining(["the", "you"]));
  });
});
