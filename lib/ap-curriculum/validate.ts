import { AP_SUBJECT_CODES, SUB_KEYWORD_KINDS, type ApCurriculumFile } from "./types";

/** 시드 데이터 구조 점검. 오류 문자열 배열(비어 있으면 통과). */
export function validateCurriculum(f: ApCurriculumFile): string[] {
  const err: string[] = [];
  const push = (m: string) => err.push(m);
  if (f.schemaVersion !== 1) push("schemaVersion must be 1");
  if (!AP_SUBJECT_CODES.includes(f.subject.apCode)) push(`unknown apCode ${f.subject.apCode}`);
  if (!f.subject.sourceUrl.startsWith("https://")) push("sourceUrl must be https");
  if (!f.subject.cedVersion) push("cedVersion required");

  const skillCodes = new Set<string>();
  for (const s of f.skills) {
    if (skillCodes.has(s.code)) push(`duplicate skill ${s.code}`);
    skillCodes.add(s.code);
  }
  if (!f.units.length) push("no units");

  const allCodes = new Map<string, number>(); // code -> 정의된 순서(전역 순번)
  let seq = 0;
  const unitCodes = new Set<string>();
  const labels = new Set<string>();
  for (const u of f.units) {
    if (unitCodes.has(u.code)) push(`duplicate unit ${u.code}`);
    unitCodes.add(u.code);
    if (!u.topics.length) push(`unit ${u.code} has no topics`);
    for (const t of u.topics) {
      if (allCodes.has(t.code)) push(`duplicate code ${t.code}`);
      allCodes.set(t.code, seq++);
      const prefix = f.subject.officialTopicCodes ? `${u.code}.` : `U${u.code}.`;
      if (!t.code.startsWith(prefix)) push(`topic ${t.code} not under unit ${u.code}`);
      if (!t.title.trim()) push(`topic ${t.code} empty title`);
      const tkey = t.title.trim().toLowerCase();
      if (labels.has(tkey)) push(`duplicate keyword label in subject (must be unique across topics and sub-keywords): ${t.title}`);
      labels.add(tkey);
      if (!(t.estLessons > 0 && t.estLessons <= 6)) push(`topic ${t.code} estLessons out of range`);
      for (const s of t.skills) if (!skillCodes.has(s)) push(`topic ${t.code} unknown skill ${s}`);
      if (f.subject.apCode !== "ap_calculus_bc" && t.scope !== "both" && f.subject.apCode !== "ap_calculus_ab") push(`topic ${t.code} scope must be both`);
      t.subKeywords.forEach((k, i) => {
        if (allCodes.has(k.code)) push(`duplicate code ${k.code}`);
        allCodes.set(k.code, seq++);
        if (k.code !== `${t.code}#${i + 1}`) push(`sub-keyword code ${k.code} must be ${t.code}#${i + 1}`);
        if (!k.label.trim() || k.label.length > 80) push(`sub-keyword ${k.code} label empty or >80`);
        if (!SUB_KEYWORD_KINDS.includes(k.kind)) push(`sub-keyword ${k.code} bad kind`);
        if (!(k.estLessons > 0 && k.estLessons <= 3)) push(`sub-keyword ${k.code} estLessons out of range`);
        for (const s of k.skills) if (!skillCodes.has(s)) push(`sub-keyword ${k.code} unknown skill ${s}`);
        // subject_keywords 는 (과목, 정규화 라벨) 유일 — 토픽·세부 전체에서 겹치면 안 된다.
        const key = k.label.trim().toLowerCase();
        if (labels.has(key)) push(`duplicate keyword label in subject (must be unique across topics and sub-keywords): ${k.label}`);
        labels.add(key);
      });
    }
  }
  // 선수 관계: 존재하고, 앞서 정의된 코드(순환 방지)
  for (const u of f.units)
    for (const t of u.topics) {
      for (const r of t.requires) check(t.code, r);
      for (const k of t.subKeywords) for (const r of k.requires) check(k.code, r);
    }
  function check(from: string, req: string) {
    const a = allCodes.get(from)!;
    const b = allCodes.get(req);
    if (b === undefined) push(`${from} requires unknown ${req}`);
    else if (b >= a) push(`${from} requires later/self ${req}`);
  }
  // 가중치
  for (const w of f.weights) {
    if (w.min != null && w.max != null && w.min > w.max) push(`weight ${w.axis}:${w.code}:${w.section} min>max`);
    if (w.axis === "unit" && !unitCodes.has(w.code)) push(`weight for unknown unit ${w.code}`);
    if (w.axis === "skill" && !skillCodes.has(w.code) && !f.skills.some((s) => s.category === w.code)) push(`weight for unknown skill/category ${w.code}`);
    if (!w.source.trim()) push(`weight ${w.axis}:${w.code} missing source`);
  }
  const unitMc = f.weights.filter((w) => w.axis === "unit" && w.section === "mc");
  if (unitMc.length) {
    const lo = unitMc.reduce((s, w) => s + (w.min ?? 0), 0);
    const hi = unitMc.reduce((s, w) => s + (w.max ?? w.min ?? 0), 0);
    if (lo > 100 || hi < 100) push(`unit MC weights inconsistent (sum of mins ${lo}, sum of maxes ${hi})`);
  }
  return err;
}

/** 공유 토픽 연결용 콘텐츠 키(과목 군 + 공식 코드). */
export const contentKey = (family: string, code: string) => `${family}:${code}`;
