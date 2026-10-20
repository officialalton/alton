// R&W 소재 분류표(topics.json)를 **API 호출 없이** 만든다(rw-topics.ts 의 LLM 분류 단계 대체).
// 이미 만든 분류(rw-topics-20261015/classified.json — 지문 해시 → 과목·소재, canon.json — 라벨 병합)를 은행의 현재 지문에 해시로 붙인다.
// 새 지문이 분류표에 없으면 목록으로 알리고(미분류는 조립에서 소재 제약만 빠진다) 그 문항은 topics 에 넣지 않는다.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/prod-open/build-topics-offline.ts --dump DIR/dump.json --out DIR/topics.json
// DB 는 읽기 전용(problem_versions.passage). 키는 출력하지 않는다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { RW_DOMAINS } from "../mock-exam-generation/assemble-unique";
import { passageHash } from "../mock-exam-generation/rw-topics-lib";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const CLASS_DIR = arg("--classified-dir") ?? "data/mock-exam-generation/rw-topics-20261015";
type Cls = { subject: string; cluster: string; family: string };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 필요");
  const dump = JSON.parse(readFileSync(path.resolve(arg("--dump")!), "utf-8"));
  const classified = JSON.parse(readFileSync(path.join(CLASS_DIR, "classified.json"), "utf-8")) as Record<string, Cls>;
  const canon = JSON.parse(readFileSync(path.join(CLASS_DIR, "canon.json"), "utf-8")) as { cluster: Record<string, string>; family: Record<string, string> };
  const resolve = (m: Record<string, string>, k: string) => { let x = k; for (let i = 0; i < 4 && m[x] && m[x] !== x; i++) x = m[x]; return x; };

  const rwIds = new Set<string>(dump.problems.filter((p: any) => RW_DOMAINS.includes(p.sat_domain) && p.status === "confirmed" && !p.archived_at).map((p: any) => p.id));
  for (const it of dump.items) if (RW_DOMAINS.includes(it.sat_domain)) rwIds.add(it.problem_id);

  const db = createClient(url, key, { auth: { persistSession: false } });
  const passages = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("problem_versions").select("problem_id,passage").eq("status", "published").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const v of data ?? []) if (rwIds.has(v.problem_id) && v.passage) passages.set(v.problem_id, v.passage);
    if ((data ?? []).length < 1000) break;
  }
  for (const it of dump.items) if (rwIds.has(it.problem_id) && !passages.has(it.problem_id) && it.content_snapshot?.passage) passages.set(it.problem_id, it.content_snapshot.passage);

  const topics: Record<string, { subject: string; cluster: string; family: string; passageHash: string }> = {};
  const missing = new Set<string>();
  for (const [problemId, passage] of passages) {
    if (!rwIds.has(problemId)) continue;
    const h = passageHash(passage); const c = classified[h];
    if (!c) { missing.add(problemId); continue; }
    topics[problemId] = { subject: c.subject, cluster: resolve(canon.cluster, c.cluster), family: resolve(canon.family, c.family), passageHash: h };
  }
  writeFileSync(path.resolve(arg("--out")!), JSON.stringify(topics));
  console.log(JSON.stringify({ rwProblemsWithPassage: passages.size, classified: Object.keys(topics).length, unclassified: missing.size, existsClassDir: existsSync(CLASS_DIR) }));
  if (missing.size) console.log(`미분류 R&W 문항 ${missing.size}건(소재 제약 없이 취급): ${[...missing].slice(0, 5).join(", ")}${missing.size > 5 ? " ..." : ""}`);
}
main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
