#!/usr/bin/env python3
"""Project Gutenberg 작품 선별 초안(**작성만 — 실행은 승인 후**). 공식 오프라인 카탈로그만 사용, 사이트 스크래핑 없음.
입력: ~/Developer/ALTON-data/rw-corpus/catalog/{pg_catalog.csv, rdf-files.tar.bz2} (공식 카탈로그 다운로드본)
기준: 영어 원서(번역 제외 — RDF 에 translator 역할 marcrel:trl 없음), 단일 작가의 사후 연도가 1929 이하(= 미국 1930년 이전 출판 PD 의 근사 + 한국 사후 70년 교차),
      RDF 의 미국 PD 고지, 발췌용 장르 배분(문학 75·과학 20·역사 20·철학 15·사회 15·지리 10·기타 10 = 약 165편, 작가당 최대 2편).
출력: catalog/gutenberg_selected.json (작품 메타 — 본문 아님).
다운로드 단계(별도): 공식 rsync 미러 `rsync.ibiblio.org::gutenberg/<1/2/3/4/ID>/` 에서 `*.txt` 만, 작품 사이 2초 이상 간격."""
import csv, json, re, random, tarfile, sys, os

root = os.path.expanduser("~/Developer/ALTON-data/rw-corpus/catalog")
rows = []
with open(f"{root}/pg_catalog.csv", newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r["Type"] != "Text" or r["Language"] != "en":
            continue
        a = r["Authors"]
        if not a or ";" in a or "Anonymous" in a or "Various" in a:
            continue
        m = re.match(r"^([^,]+), ([^,]+), (\d{4})-(\d{4})$", a.strip())
        if not m:
            continue
        birth, death = int(m.group(3)), int(m.group(4))
        if death > 1929 or birth < 1650:
            continue
        s = r["Subjects"]
        if re.search(r"Translat|Bible|Dictionar|Encyclop|Periodical|Catalog|Cookery|Hymn|Sermon", s + " " + r["Title"], re.I):
            continue
        locc = (r["LoCC"] or "").split(";")[0].strip()
        if not locc:
            continue
        rows.append(dict(id=int(r["Text#"]), title=r["Title"].replace("\n", " ").strip(), author=f"{m.group(1)}, {m.group(2)}", birth=birth, death=death, locc=locc, issued=r["Issued"]))
print("후보(카탈로그 필터 후)", len(rows), file=sys.stderr)

ids = {r["id"] for r in rows if r["id"] >= 100}
ok = {}
with tarfile.open(f"{root}/rdf-files.tar.bz2", "r:bz2") as tf:
    for m in tf:
        mm = re.search(r"cache/epub/(\d+)/pg\1\.rdf$", m.name)
        if not mm or int(mm.group(1)) not in ids:
            continue
        t = tf.extractfile(m).read().decode("utf-8", "ignore")
        ok[int(mm.group(1))] = ("marcrel:trl" not in t) and ("Public domain in the USA" in t)
print("RDF 통과", sum(ok.values()), "/", len(ok), file=sys.stderr)

cand = [r for r in rows if ok.get(r["id"])]


def group(l):
    if l.startswith("PR"): return "lit_british"
    if l.startswith("PS"): return "lit_american"
    if l.startswith("PZ") or l.startswith("PN"): return "lit_other"
    if l.startswith("Q"): return "science"
    if l[0] in "DE" or l.startswith("F"): return "history"
    if l[0] == "B": return "philosophy"
    if l[0] == "H": return "social"
    if l[0] == "G": return "geography"
    if l[0] in "NMLT": return "arts_edu_tech"
    return "other"


quota = {"lit_british": 35, "lit_american": 30, "lit_other": 10, "science": 20, "history": 20, "philosophy": 15, "social": 15, "geography": 10, "arts_edu_tech": 10}
random.seed(42)
by = {}
for r in cand:
    by.setdefault(group(r["locc"]), []).append(r)
sel, per_author = [], {}
for g, q in quota.items():
    pool = by.get(g, [])
    random.shuffle(pool)
    n = 0
    for r in pool:
        if n >= q:
            break
        if per_author.get(r["author"], 0) >= 2:
            continue
        per_author[r["author"]] = per_author.get(r["author"], 0) + 1
        sel.append({**r, "group": g})
        n += 1
json.dump(sel, open(f"{root}/gutenberg_selected.json", "w"), ensure_ascii=False, indent=1)
print("선별", len(sel), {g: sum(1 for s in sel if s["group"] == g) for g in quota}, file=sys.stderr)
