// AB 재고 목표 제안·적재·검증(오너 합의값만 적재). 목표 단계: (a) 무료 AB 부분 연습 세트 → (b) 풀 AB 세트 1개에 필요한 칸. 수업 용도 목표는 실제 수요가 확인될 때까지 설정하지 않는다.
//   npx tsx scripts/ap-generation/stock-targets.ts            # 제안 파일 생성 + 파일 기준 부족분 출력(DB 없음)
//   npx tsx scripts/ap-generation/stock-targets.ts --load     # (dry-run) ap_stock_targets 적재 계획; --execute 로 적재(로컬/공유 비프로덕션만, 오너 실행)
//   npx tsx scripts/ap-generation/stock-targets.ts --verify   # 적재 후: 파일 계산 부족분 vs DB ap_stock_shortfall_v 비교(읽기 전용)
import { readFileSync, writeFileSync } from "node:fs";
import { cellCounts, shortfall, topicTargets, type StockItem } from "../../lib/ap-generation/stock";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
import { connect } from "../keywords/db";

const SUBJECT = "ap_calculus_ab";
const items = [...(JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as StockItem[]), ...(JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8")) as StockItem[])];
const defect = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const clean = items.filter((i) => !defect.has(i.stockKey)); // 생성기 결함 문항은 재고로 세지 않는다
const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${SUBJECT}.json`, "utf-8")) as ApCurriculumFile;
const w: Record<string, [number | null, number | null]> = {}; cur.weights.filter((x) => x.axis === "unit" && x.section === "mc").forEach((x) => (w[x.code] = [x.min, x.max]));
// MC: (a) Part A(계산기 불가 29) × 3세트 = 87 + (b) Part B(계산기 필수 13) × 1 = 13 → 100 문항을 공식 단원 비중으로 토픽에 배분. 계산기 파트 분리는 칸 목표가 아니라 조립 구성 규칙이 강제한다.
const MC_TOTAL = 29 * 3 + 13;
const mc = topicTargets(cur.units, w, MC_TOTAL, SUBJECT);
// FRQ: 서로 다른 문항 유형 6개 × 문항군 유효 상한 2 = 12. 기존 4유형(6.2, 8.4, 5.9, 7.7) + 미구현 2유형(4.2 입자 운동, 4.5 관련 변화율) 먼저, 음함수(3.2)는 후속.
const FRQ_TOPICS = ["6.2", "8.4", "5.9", "7.7", "4.2", "4.5"]; const frq: Record<string, number> = Object.fromEntries(FRQ_TOPICS.map((t) => [t, 2]));
const rows = [...Object.entries(mc).filter(([, n]) => n > 0).map(([k, n]) => ({ subject: SUBJECT, keyword_code: k, kind: "mc", target: n })), ...Object.entries(frq).map(([k, n]) => ({ subject: SUBJECT, keyword_code: k, kind: "frq_bundle", target: n }))];
const cells = cellCounts(clean).filter((c) => c.subject === SUBJECT);
const eff = (k: string, kind: string) => cells.filter((c) => c.keyword === k && (kind === "mc") === (c.structure === "standalone")).reduce((a, c) => a + c.effective, 0);
const report = rows.map((r) => ({ ...r, effective: eff(r.keyword_code, r.kind), shortfall: shortfall(r.target, eff(r.keyword_code, r.kind)) }));
writeFileSync("data/ap/stock/stock-targets.proposed.json", JSON.stringify({ basis: "AB: (a) 무료 부분 연습(MC Part A 29×3 + Part B 13×1 = 100, FRQ 서로 다른 유형 6×유효 2) → (b) 풀 세트 1개 칸. 수업 용도 목표 없음.", mcTotal: MC_TOTAL, rows: report }, null, 1));
const tot = (kd: string) => report.filter((r) => r.kind === kd);
console.log(`제안 목표 행 ${rows.length}(MC 토픽 ${tot("mc").length}, FRQ ${tot("frq_bundle").length}); MC 목표 ${tot("mc").reduce((a, r) => a + r.target, 0)}, 유효 재고 ${tot("mc").reduce((a, r) => a + Math.min(r.target, r.effective), 0)}, 부족 ${tot("mc").reduce((a, r) => a + r.shortfall, 0)} / FRQ 목표 ${tot("frq_bundle").reduce((a, r) => a + r.target, 0)}, 부족 ${tot("frq_bundle").reduce((a, r) => a + r.shortfall, 0)}`);
console.log("부족 상위:", report.filter((r) => r.shortfall > 0).sort((a, b) => b.shortfall - a.shortfall).slice(0, 12).map((r) => `${r.kind}:${r.keyword_code} -${r.shortfall}`).join(" "));
(async () => {
  if (!process.argv.includes("--load") && !process.argv.includes("--verify")) return;
  const conn = await connect(); if (!conn) throw new Error("DB 환경변수 필요"); const { db, target } = conn;
  const { data: subs } = await db.from("subjects").select("id").eq("ap_subject_code", SUBJECT).limit(1); const sid = subs?.[0]?.id as string; if (!sid) throw new Error("AB 과목 행 없음");
  if (process.argv.includes("--load")) {
    const exec = process.argv.includes("--execute"); console.log(`대상 ${target} / ${exec ? "EXECUTE" : "dry-run"}: ap_stock_targets upsert ${rows.length}행(AB, edition ced-2027)`);
    if (exec) { if (!/^(local|worpsqwqgnspddnrtnvq\.supabase\.co)$/.test(target)) throw new Error(`허용되지 않은 대상 ${target}`); const { error } = await db.from("ap_stock_targets").upsert(rows.map((r) => ({ subject_id: sid, edition: "ced-2027", keyword_code: r.keyword_code, kind: r.kind, target: r.target })), { onConflict: "subject_id,edition,keyword_code,kind" }); if (error) throw new Error(error.message); await db.rpc("ap_refresh_stock_cells"); console.log("적재 완료 + ap_refresh_stock_cells"); }
  }
  if (process.argv.includes("--verify")) {
    const { data, error } = await db.from("ap_stock_shortfall_v").select("*").eq("subject_id", sid); if (error) throw new Error(error.message);
    let diff = 0; for (const r of report) { const d = (data ?? []).find((x) => x.keyword_code === r.keyword_code && x.kind === r.kind); const dbShort = d ? Number(d.shortfall) : null; if (dbShort !== r.shortfall) { diff++; console.error(`  ✗ ${r.kind}:${r.keyword_code} 파일 부족 ${r.shortfall} ≠ DB ${dbShort}`); } }
    console.log(diff ? `불일치 ${diff}건` : `일치: 파일 부족분 = DB ap_stock_shortfall_v (${report.length}행)`); if (diff) process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
