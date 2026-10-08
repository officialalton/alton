// R&W 지문 소재 분류·리포트(2026-10-08). 은행(확정·미보관) R&W 문항의 지문을 과목(subject)·세부 소재(cluster)·넓은 소재(family)로 분류한다.
// DB 는 읽기 전용(problem_versions.passage). LLM 은 저가 모델(claude-haiku-4-5)로 지문 여러 개를 한 번에 분류하고, 비용은 장부(ledger.json)에 남긴다.
//
// 실행(원격 비프로덕션은 읽기 전용 — 서비스 키는 환경변수로만 전달):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/mock-exam-generation/rw-topics.ts --dump DIR/dump.json [--out data/mock-exam-generation/rw-topics-20261008] [--budget 5] [--report docs/qa/rw-topic-diversity-2026-10-08.md] [--reclassify]
//   분류 결과는 <out>/classified.json(지문 해시 단위)에 캐시되어 재실행하면 새 지문만 분류한다. 산출: <out>/topics.json (problemId -> {subject, cluster, family, passageHash}), <out>/topic-saturation.json
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { RW_DOMAINS } from "./assemble-unique";
import { DEFAULT_TOPIC_CAPS, SUBJECTS, TARGET_MIX, capViolations, countBy, passageHash, rwPaths, saturationList, slug, type TopicMap } from "./rw-topics-lib";

const MODEL = "claude-haiku-4-5";
const PRICES: Record<string, { in: number; out: number }> = { "claude-haiku-4-5": { in: 1, out: 5 }, "claude-sonnet-5-5": { in: 2, out: 10 } }; // USD/MTok, 표준(비배치) 단가(배치 단가의 2배)
const CANON_MODEL = "claude-sonnet-5-5"; // 라벨 병합은 한 번뿐이라 더 정확한 모델을 쓴다
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

function loadKeyFromEnvLocal() { // ANTHROPIC_API_KEY 만 .env.local 에서 가져온다(.env.local 의 Supabase URL 은 로컬 DB 이므로 쓰지 않는다).
  const p = path.resolve(process.cwd(), ".env.local");
  if (process.env.ANTHROPIC_API_KEY || !existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split("\n")) { const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/); if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, ""); }
}

export const SYSTEM = `You classify SAT Reading & Writing passages by TOPIC for a diversity audit. For each numbered passage return one JSON object.
subject (exactly one of): ${SUBJECTS.join(", ")}.
  literature_fiction = fiction/poetry/drama excerpts; humanities = art, music, architecture, philosophy, language, literary criticism; social_science = psychology, sociology, anthropology, education, linguistics, political science studies; history_civics = historical events/people, law, government; economics_business = markets, firms, labor, trade; science_life = biology/ecology/medicine/animals/plants; science_earth_space = geology, climate, oceans (as physical system), astronomy; science_physical = physics, chemistry, materials, math; technology = engineering, computing, inventions.
cluster: the SPECIFIC subject matter as a short lowercase kebab-case noun phrase (1-3 words) naming the organism/phenomenon/place/person/art form/event the passage is about, e.g. "cephalopods", "bees", "coral-reefs", "deep-sea-vents", "mars-exploration", "jazz", "hohokam-canals". Use the most general common name that still identifies the subject (octopus, squid, cuttlefish, nautilus -> "cephalopods"). For fiction use "fiction-" plus the central situation, e.g. "fiction-immigrant-family", "fiction-grief-and-memory".
family: a broader theme, 1-2 words kebab-case, e.g. "marine-life", "pollinators", "space-exploration", "music", "labor-history", "urban-planning".
Judge by what the passage is mainly ABOUT, not by incidental details. Output ONLY a JSON array: [{"i":1,"subject":"...","cluster":"...","family":"..."}, ...] with one entry per passage, no prose.`;

type Row = { problemId: string; hash: string; passage: string };
const ledgerPath = (out: string) => path.join(out, "ledger.json");
const readJson = <T,>(p: string, d: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : d);

async function ask(client: Anthropic, ledger: { usd: number; calls: number; inTok: number; outTok: number }, system: string, user: string, maxTokens: number, model = MODEL) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await client.messages.stream({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }], ...(model === MODEL ? { temperature: 0 } : {}) }).finalMessage();
      ledger.calls++; ledger.inTok += r.usage.input_tokens; ledger.outTok += r.usage.output_tokens; ledger.usd += (r.usage.input_tokens * PRICES[model].in + r.usage.output_tokens * PRICES[model].out) / 1e6;
      const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const m = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/); if (!m) throw new Error("no json");
      return JSON.parse(m[0]);
    } catch (e) { if (attempt >= 2) throw e; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
}

async function main() {
  loadKeyFromEnvLocal();
  const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8"));
  const out = arg("--out") ?? "data/mock-exam-generation/rw-topics-20261008"; mkdirSync(out, { recursive: true });
  const budget = Number(arg("--budget") ?? 5);
  const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
  const rwIds = new Set<string>(dump.problems.filter((p: any) => RW_DOMAINS.includes(p.sat_domain) && p.status === "confirmed" && !p.archived_at).map((p: any) => p.id));
  // 세트(모든 상태)에 쓰인 R&W 문항은 보관·실패 세트 것도 포함해 분류한다(유지 세트 보수 계획·중복 보고용).
  for (const it of dump.items) if (RW_DOMAINS.includes(it.sat_domain)) rwIds.add(it.problem_id);

  // 1) 지문 수집: 공개 버전 passage, 없으면 세트 스냅샷 passage
  const passages = new Map<string, string>();
  const cache = path.join(out, "passages.json");
  if (existsSync(cache) && !process.argv.includes("--refetch")) for (const [k, v] of Object.entries(readJson<Record<string, string>>(cache, {}))) passages.set(k, v);
  else {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 필요(읽기 전용 사용)");
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("problem_versions").select("problem_id,passage").eq("status", "published").order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const v of data ?? []) if (rwIds.has(v.problem_id) && v.passage) passages.set(v.problem_id, v.passage);
      if ((data ?? []).length < 1000) break;
    }
    writeFileSync(cache, JSON.stringify(Object.fromEntries(passages)));
  }
  for (const it of dump.items) if (rwIds.has(it.problem_id) && !passages.has(it.problem_id) && it.content_snapshot?.passage) passages.set(it.problem_id, it.content_snapshot.passage);
  const rows: Row[] = [...passages].filter(([id]) => rwIds.has(id)).map(([problemId, passage]) => ({ problemId, passage, hash: passageHash(passage) }));
  const byHash = new Map<string, Row[]>(); for (const r of rows) (byHash.get(r.hash) ?? byHash.set(r.hash, []).get(r.hash)!).push(r);
  console.error(`R&W problems with passage ${rows.length}, distinct passages ${byHash.size}`);

  // 2) 분류(캐시된 해시는 건너뜀)
  const classPath = path.join(out, "classified.json");
  const classified = readJson<Record<string, { subject: string; cluster: string; family: string }>>(classPath, {});
  const ledger = readJson(ledgerPath(out), { usd: 0, calls: 0, inTok: 0, outTok: 0, model: MODEL });
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const todo = [...byHash].filter(([h]) => process.argv.includes("--reclassify") || !classified[h]);
  const BATCH = 25; const batches: [string, Row[]][][] = []; for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      if (ledger.usd > budget) throw new Error(`예산 초과 $${ledger.usd.toFixed(2)} > $${budget}`);
      const b = batches[next++];
      const user = b.map(([, rs], i) => `[${i + 1}] ${rs[0].passage.replace(/\s+/g, " ").slice(0, 900)}`).join("\n\n");
      const res = (await ask(client, ledger, SYSTEM, user, 4000)) as { i: number; subject: string; cluster: string; family: string }[];
      for (const r of res) { const h = b[r.i - 1]?.[0]; if (!h) continue; classified[h] = { subject: (SUBJECTS as readonly string[]).includes(r.subject) ? r.subject : "humanities", cluster: slug(r.cluster || "unknown"), family: slug(r.family || "unknown") }; }
      writeFileSync(classPath, JSON.stringify(classified)); writeFileSync(ledgerPath(out), JSON.stringify(ledger, null, 1));
      console.error(`batch ${next}/${batches.length} usd=${ledger.usd.toFixed(3)}`);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  // 3) cluster/family 라벨 정규화(동의어 병합) — 라벨 목록 전체를 한 번에 보내 매핑을 받는다.
  const canonPath = path.join(out, "canon.json");
  if (!existsSync(canonPath) || process.argv.includes("--recanon")) {
    const canon: { cluster: Record<string, string>; family: Record<string, string> } = { cluster: {}, family: {} };
    for (const kind of ["cluster", "family"] as const) {
      const counts = countBy(Object.values(classified), (c) => c[kind]);
      const list = [...counts].sort().map(([k, n]) => `${k} (${n})`).join("\n");
      const res = (await ask(client, ledger, `You merge near-duplicate topic labels for a test-bank diversity audit. The goal is that two passages a student could perceive as "the same topic again" end up with the SAME label. Given a list of kebab-case ${kind} labels with counts, return a JSON object mapping ONLY labels that should be merged into another label, to the canonical label (prefer the most common, most general name that still identifies the subject; e.g. octopus-intelligence, octopus-social-behavior, octopuses, cuttlefish-camouflage -> cephalopods; coral-bleaching, coral-reef-restoration -> coral-reefs; never merge genuinely different subjects, e.g. bees and wasps stay separate). For family labels, collapse synonyms and sub-themes into about 80-120 broad themes (e.g. relationships, family-relationships, human-connection -> family-relationships; marine-life, marine-ecosystems, ocean-life -> marine-life). Every label that is not already canonical must appear as a key. Fiction labels (fiction-*) should stay distinct unless the situation is the same. Output ONLY the JSON object.`, list, 32000, CANON_MODEL)) as Record<string, string>;
      canon[kind] = res;
    }
    writeFileSync(canonPath, JSON.stringify(canon, null, 1)); writeFileSync(ledgerPath(out), JSON.stringify(ledger, null, 1));
  }
  const canon = readJson<{ cluster: Record<string, string>; family: Record<string, string> }>(canonPath, { cluster: {}, family: {} });
  const resolve = (m: Record<string, string>, k: string) => { let x = k; for (let i = 0; i < 4 && m[x] && m[x] !== x; i++) x = m[x]; return x; };

  // 4) topics.json
  const topics: Record<string, { subject: string; cluster: string; family: string; passageHash: string }> = {};
  for (const r of rows) { const c = classified[r.hash]; if (c) topics[r.problemId] = { subject: c.subject, cluster: resolve(canon.cluster, c.cluster), family: resolve(canon.family, c.family), passageHash: r.hash }; }
  writeFileSync(path.join(out, "topics.json"), JSON.stringify(topics));
  console.error(`topics.json: ${Object.keys(topics).length} problems, ledger $${ledger.usd.toFixed(3)}`);

  // 5) 포화 목록 + 리포트
  const bankIds = [...rwIds].filter((id) => { const p = P.get(id); return p && p.status === "confirmed" && !p.archived_at && topics[id]; });
  // 은행 규모는 "고유 지문" 기준으로 센다(같은 지문의 여러 문항은 1회).
  const seenH = new Set<string>(); const distinct = bankIds.filter((id) => !seenH.has(topics[id].passageHash) && seenH.add(topics[id].passageHash));
  const clusterCap = Number(arg("--cluster-cap") ?? Math.max(8, Math.ceil(distinct.length * 0.008)));
  const familyCap = Number(arg("--family-cap") ?? Math.max(25, Math.ceil(distinct.length * 0.03)));
  const sat = saturationList(distinct.map((id) => topics[id]), { clusterCap, familyCap, familyExclude: (t) => t.subject === "literature_fiction" });
  writeFileSync(path.join(out, "topic-saturation.json"), JSON.stringify({ generatedAt: "2026-10-08", basis: `distinct passages ${distinct.length}`, clusterCap, familyCap, ...sat }, null, 1));
  { // 생성 프롬프트용 회피 목록(lib/problem-generation/rw-topic-saturation.ts) — 은행이 이미 포화한 소재. 기본으로 갱신한다.
    const toLabel = (k: string) => k.replace(/-/g, " ");
    const body = `// 자동 생성: scripts/mock-exam-generation/rw-topics.ts (${new Date().toISOString().slice(0, 10)}, 고유 지문 ${distinct.length}개 기준, cluster>${clusterCap}, family>${familyCap}). 손으로 고치지 말고 다시 생성한다.\n// R&W 생성 프롬프트(pipeline.ts -> core.ts avoidTopics)가 "피해야 할 소재"로 쓴다.\nexport const RW_SATURATED_TOPICS = ${JSON.stringify([...sat.clusters.map((x) => toLabel(x.cluster)), ...sat.families.map((x) => `${toLabel(x.family)} (broad theme — pick a different field)`)], null, 2)} as const;\n`;
    writeFileSync(path.resolve("lib/problem-generation/rw-topic-saturation.ts"), body);
  }
  if (arg("--report") !== "none") writeReport(arg("--report") ?? "docs/qa/rw-topic-diversity-2026-10-08.md", { dump, topics, rows, byHash, distinct, sat, ledger, clusterCap, familyCap, P });
}

type Ctx = { dump: any; topics: Record<string, any>; rows: Row[]; byHash: Map<string, Row[]>; distinct: string[]; sat: ReturnType<typeof saturationList>; ledger: any; clusterCap: number; familyCap: number; P: Map<string, any> };
function writeReport(file: string, c: Ctx) {
  const { dump, topics, distinct, sat, ledger } = c;
  const tm: TopicMap = new Map(Object.entries(topics));
  const L: string[] = []; const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(0)}%`;
  L.push("# R&W 지문 소재 다양성 점검 (2026-10-08)", "", `생성: \`scripts/mock-exam-generation/rw-topics.ts\` (모델 ${ledger.model ?? MODEL}, LLM 지출 $${ledger.usd.toFixed(2)}, 호출 ${ledger.calls}회). 원본 분류: \`data/mock-exam-generation/rw-topics-20261008/topics.json\`.`, "",
    `대상: 확정·미보관 R&W 문항의 고유 지문 ${distinct.length}개(문항 ${c.rows.length}건). 상한 기준: 모듈당 같은 소재 ${DEFAULT_TOPIC_CAPS.perModule}, 응시 경로(M1+M2)당 ${DEFAULT_TOPIC_CAPS.perExam}, 넓은 소재(family)당 ${DEFAULT_TOPIC_CAPS.familyPerExam}.`, "");
  const subj = countBy(distinct, (id) => topics[id].subject);
  L.push("## 1. 과목 분포 (은행 고유 지문)", "", "| 과목 | 지문 수 | 비율 | 목표 |", "|---|---|---|---|");
  for (const s of SUBJECTS) L.push(`| ${s} | ${subj.get(s) ?? 0} | ${pct(subj.get(s) ?? 0, distinct.length)} | ${TARGET_MIX[s]}% |`);
  const cl = [...countBy(distinct, (id) => topics[id].cluster)].sort((a, b) => b[1] - a[1]);
  const fam = [...countBy(distinct, (id) => topics[id].family)].sort((a, b) => b[1] - a[1]);
  L.push("", `## 2. 소재(cluster) 빈도 — 은행 전체 (고유 cluster ${cl.length}개, 상위 40)`, "", "| cluster | 지문 수 |", "|---|---|", ...cl.slice(0, 40).map(([k, n]) => `| ${k} | ${n} |`));
  L.push("", `## 3. 넓은 소재(family) 빈도 (고유 ${fam.length}개, 상위 25)`, "", "| family | 지문 수 |", "|---|---|", ...fam.slice(0, 25).map(([k, n]) => `| ${k} | ${n} |`));
  L.push("", `## 4. 과다 대표 소재 (cluster > ${c.clusterCap}, family > ${c.familyCap})`, "", "cluster: " + (sat.clusters.map((x) => `${x.cluster}(${x.count})`).join(", ") || "-"), "", "family: " + (sat.families.map((x) => `${x.family}(${x.count})`).join(", ") || "-"));

  // 게시 세트별
  const pub = dump.sets.filter((s: any) => s.status === "published" && !s.archived_at && /^SAT Practice Test \d+$/.test(s.name)).sort((a: any, b: any) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
  L.push("", "## 5. 게시 세트별 소재", "");
  const keyCl = ["cephalopods", ...sat.clusters.slice(0, 5).map((x) => x.cluster).filter((x) => x !== "cephalopods")];
  L.push(`| 세트 | R&W 문항 | 고유 cluster | 경로당 최대 반복(cluster) | 상한 위반 수 | ${keyCl.join(" | ")} |`, `|---|---|---|---|---|${keyCl.map(() => "---").join("|")}|`);
  const perSet: any[] = [];
  for (const s of pub) {
    const items = dump.items.filter((i: any) => i.exam_set_id === s.id && i.section === "rw").map((i: any) => ({ problemId: i.problem_id, moduleKey: i.module_key, route: i.route, domain: i.sat_domain }));
    const viol = capViolations(items, tm);
    const paths = rwPaths<{ problemId: string; moduleKey: string; route: string | null }>(items); const maxRep = Math.max(...paths.map((p) => Math.max(0, ...countBy(p, (i) => topics[i.problemId]?.cluster).values())));
    const ucl = new Set(items.map((i: any) => topics[i.problemId]?.cluster).filter(Boolean)).size;
    const kc = keyCl.map((k) => items.filter((i: any) => topics[i.problemId]?.cluster === k).length);
    L.push(`| ${s.name} | ${items.length} | ${ucl} | ${maxRep} | ${viol.length} | ${kc.join(" | ")} |`);
    perSet.push({ s, items, viol });
  }
  L.push("", "### 과목 구성 (경로 54문항 기준 = 저장 81문항 비율; 목표 대비 편차 pp)", "", `| 세트 | ${SUBJECTS.join(" | ")} |`, `|---|${SUBJECTS.map(() => "---").join("|")}|`);
  for (const { s, items } of perSet) { const sc = countBy(items, (i: any) => topics[i.problemId]?.subject); L.push(`| ${s.name} | ${SUBJECTS.map((x) => { const d = ((sc.get(x) ?? 0) / Math.max(1, items.length)) * 100 - TARGET_MIX[x]; return `${sc.get(x) ?? 0} (${d >= 0 ? "+" : ""}${d.toFixed(0)})`; }).join(" | ")} |`); }
  L.push("", "### 상한 위반 상세 (cluster)", "");
  for (const { s, viol } of perSet) { const v = viol.filter((x: any) => x.kind !== "family"); if (v.length) L.push(`- **${s.name}**: ` + v.map((x: any) => `${x.key} ×${x.count} (${x.where})`).join(", ")); }

  // 같은 지문을 여러 문항이 쓰는 경우
  const dupHashes = [...c.byHash].filter(([, rs]) => rs.length > 1);
  L.push("", "## 6. 같은 지문 텍스트를 쓰는 문항 (근접 중복)", "", `고유 지문 중 2개 이상 문항이 같은 텍스트를 가진 것: ${dupHashes.length}건 (문항 ${dupHashes.reduce((a, [, rs]) => a + rs.length, 0)}건).`, "");
  const inSets = (id: string) => [...new Set(dump.items.filter((i: any) => i.problem_id === id && pub.some((s: any) => s.id === i.exam_set_id)).map((i: any) => pub.find((s: any) => s.id === i.exam_set_id).name.replace("SAT Practice Test ", "T")))];
  const crossSet = dupHashes.map(([h, rs]) => ({ h, cluster: topics[rs[0].problemId]?.cluster, ids: rs.map((r) => r.problemId), sets: rs.flatMap((r) => inSets(r.problemId)) })).filter((x) => new Set(x.sets).size > 1 || x.sets.length > 1);
  L.push(`게시 세트에서 같은 지문이 두 번 이상 노출되는 경우: ${crossSet.length}건.`, "", "| 지문 해시 | cluster | 문항 수 | 게시 세트 |", "|---|---|---|---|", ...crossSet.slice(0, 40).map((x) => `| ${x.h} | ${x.cluster} | ${x.ids.length} | ${x.sets.join(", ")} |`));
  // 거의 같은 지문(같은 family 안에서 단어 4-gram 자카드 >= 0.35) — 텍스트가 달라도 사실상 같은 글인 쌍
  const sh = (t: string) => { const w = t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean); const o = new Set<string>(); for (let i = 0; i + 3 < w.length; i++) o.add(w.slice(i, i + 4).join(" ")); return o; };
  const rep = [...c.byHash.values()].map((rs) => rs[0]).filter((r) => topics[r.problemId]); const byFam = new Map<string, Row[]>();
  for (const r of rep) (byFam.get(topics[r.problemId].family) ?? byFam.set(topics[r.problemId].family, []).get(topics[r.problemId].family)!).push(r);
  const near: { a: string; b: string; j: number; cluster: string }[] = [];
  for (const rs of byFam.values()) { const S = rs.map((r) => sh(r.passage)); for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { let k = 0; for (const x of S[i]) if (S[j].has(x)) k++; const jac = k / Math.max(1, S[i].size + S[j].size - k); if (jac >= 0.35) near.push({ a: rs[i].problemId, b: rs[j].problemId, j: jac, cluster: topics[rs[i].problemId].cluster }); } }
  L.push("", `단어 4-gram 자카드 0.35 이상인 근접 중복 쌍(같은 family 안): ${near.length}건.`, "", ...near.sort((x, y) => y.j - x.j).slice(0, 30).map((x) => `- ${x.a.slice(0, 8)} / ${x.b.slice(0, 8)} (${x.cluster}) J=${x.j.toFixed(2)}, 게시 세트: ${[...new Set([...inSets(x.a), ...inSets(x.b)])].join(", ") || "-"}`));
  mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, L.join("\n") + "\n");
  console.error(`report -> ${file}`);
}
if (process.argv[1]?.endsWith("rw-topics.ts")) main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
