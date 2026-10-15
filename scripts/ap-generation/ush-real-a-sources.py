# US History Stage A 실제 자료 등록(2026-10-15): Census Bureau 공식 표에서 숫자를 코드로 추출해 레지스트리에 추가한다(기억 의존 없음).
#   python3 scripts/ap-generation/ush-real-a-sources.py --pdf <POP-twps0056.pdf> --owner <owner-tab.txt>
# 입력(내려받은 공식 파일, 커밋하지 않음):
#   1) https://www.census.gov/content/dam/Census/library/working-papers/2002/demo/POP-twps0056.pdf  (Working Paper 56, Tables 1-65)
#   2) https://www2.census.gov/programs-surveys/decennial/tables/time-series/coh-owner/owner-tab.txt  (Historical Census of Housing: Homeownership Rates)
# 출력: data/ap/ush-sources/registry.json 에 3건 추가(이미 있으면 갱신), files/<id>/table.json + SOURCE.md. 합계 검증(지역 합 = 전국)을 통과해야 쓴다.
import hashlib, json, re, subprocess, sys, os

def arg(n):
    i = sys.argv.index(n); return sys.argv[i + 1]
PDF, OWNER = arg("--pdf"), arg("--owner")
sha = lambda b: hashlib.sha256(b).hexdigest()
def sortkeys(o):
    if isinstance(o, list): return [sortkeys(x) for x in o]
    if isinstance(o, dict): return {k: sortkeys(o[k]) for k in sorted(o)}
    return o
def table_hash(t): return sha(json.dumps(sortkeys(t), separators=(",", ":"), ensure_ascii=False).encode("utf-8"))

txt = subprocess.run(["pdftotext", "-layout", PDF, "-"], capture_output=True, text=True, check=True).stdout
L = [l.replace("\x0c", "") for l in txt.split("\n")]
def table_start(num, name):
    for i, l in enumerate(L):
        if i > 900 and re.match(rf"Table {num}\. {name}", l): return i
    raise SystemExit(f"table {num} not found")
def row(num, name, year, which=0):
    """Table <num> NUMBER block row for <year>; which = n-th row of that year (footnote variants). Returns the list of cell strings."""
    i = table_start(num, name); sec = None; hits = []
    for l in L[i:i + 90]:
        if l.strip() == "PERCENT": break
        m = re.match(rf"^{year}(?: \d)? [.\s]+(.*)$", l)
        if m: hits.append([p for p in re.split(r"\s{2,}", m.group(1).strip()) if p])
    return hits[which]
num = lambda s: int(s.replace(" ", ""))
fmt = lambda n: f"{n:,}"

# ── 1) Black population by region, 1900-1940 (Tables 1-5; Black = 3rd column: Total, White, Black) ──
regions = [("Northeast", 2, "Northeast Region"), ("Midwest", 3, "Midwest \\(North Central\\) Region"), ("South", 4, "South Region"), ("West", 5, "West Region")]
black_rows = []
for yr in (1900, 1910, 1920, 1930, 1940):
    cells = [num(row(n, nm, yr)[2]) for _, n, nm in regions]
    us = num(row(1, "United States", yr)[2])
    assert sum(cells) == us, (yr, cells, us)  # 지역 합 = 전국
    black_rows.append([str(yr)] + [fmt(c) for c in cells] + [fmt(us)])
black_tab = {"columns": ["Year", "Northeast", "Midwest", "South", "West", "United States"], "rows": black_rows}

# ── 2) Plains states total population 1870-1900 (Tables 31, 42, 49, 56). 1890 = the 'Excludes Indian reservations' row (2nd 1890 row) ──
states = [("Kansas", 31, "Kansas"), ("Nebraska", 42, "Nebraska"), ("North Dakota", 49, "North Dakota"), ("South Dakota", 56, "South Dakota")]
plains_rows = []
for yr in (1870, 1880, 1890, 1900):
    vals = []
    for s, n, nm in states:
        w = 1 if yr == 1890 else 0
        vals.append(num(row(n, nm, yr, w)[0]))
    plains_rows.append([str(yr)] + [fmt(v) for v in vals])
plains_tab = {"columns": ["Year"] + [s for s, _, _ in states], "rows": plains_rows}

# ── 3) Homeownership rates (owner-tab.txt) ──
own = open(OWNER, encoding="utf-8", errors="replace").read().split("\n")
yrs = [y for y in re.findall(r"\d{4}", own[2])]
def own_row(label):
    for l in own:
        if l.strip().startswith(label): return dict(zip(yrs, re.findall(r"(\d+\.\d)%", l)))
    raise SystemExit(label)
us, ny, ms = own_row("United States"), own_row("New York"), own_row("Mississippi")
own_rows = [[y, us[y], ny[y], ms[y]] for y in ("1900", "1910", "1920", "1930", "1940", "1950", "1960", "1970", "1980")]
own_tab = {"columns": ["Year", "United States", "New York", "Mississippi"], "rows": own_rows}

wp_pdf = open(PDF, "rb").read(); wp_sha = sha(wp_pdf); own_sha = sha(open(OWNER, "rb").read())
common = dict(origin="real_historical_source", retrieved="2026-10-15", repository="U.S. Census Bureau", hash_of="canonical JSON of table (sorted keys, compact separators, UTF-8)",
              rights_statement="Publication of a U.S. federal agency (U.S. government work, 17 U.S.C. 105); no copyright claimed on the page.", reuse_basis="public domain (U.S. government work)",
              modified="excerpted (selected rows/columns; values unchanged)")
WP = dict(author="Campbell Gibson and Kay Jung, U.S. Census Bureau, Population Division", year="2002 (Working Paper No. 56, Sept. 2002; figures from decennial censuses)", url="https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html",
          call_number="Working Paper No. 56; PDF https://www.census.gov/content/dam/Census/library/working-papers/2002/demo/POP-twps0056.pdf", pdf_sha256=wp_sha, pdf_retrieved_bytes=len(wp_pdf))
sources = [
 dict(id="stat-black-pop-region-1900-1940", type="statistic_table", title="Black population of the United States by region, census counts 1900-1940", table=black_tab, sha256=table_hash(black_tab), **WP, **common,
      notes="Working Paper 56, Tables 1-5 (United States, Northeast, Midwest, South, West; NUMBER block, 'Black' column; the 1900-1950 censuses used the term Negro). Regions are the four current Census regions (the Midwest was called North Central before 1984). Cell values were extracted by code; the four regional counts sum to the United States count in every row. Counts are residents at each census."),
 dict(id="stat-plains-state-pop-1870-1900", type="statistic_table", title="Total population of Kansas, Nebraska, North Dakota and South Dakota, census counts 1870-1900", table=plains_tab, sha256=table_hash(plains_tab), **WP, **common,
      notes="Working Paper 56, Tables 31 (Kansas), 42 (Nebraska), 49 (North Dakota), 56 (South Dakota); 'Total population' column. The 1890 row uses the figures that exclude Indian reservations (the second 1890 line in each table; the first line includes them). For North and South Dakota the 1870 and 1880 figures are for the area of the present state; the source states that the division of Dakota Territory's population into North and South Dakota is partially estimated (Working Paper 56, Appendix A-17/A-18 note). Counts are residents at each census."),
 dict(id="stat-homeownership-1900-1980", type="statistic_table", title="Homeownership rates (percent) for the United States, New York and Mississippi, 1900-1980", table=own_tab, sha256=table_hash(own_tab),
      author="U.S. Census Bureau (Historical Census of Housing Tables)", year="Historical Census of Housing Tables: Homeownership (table compiled from decennial censuses 1900-2000; page last revised October 8, 2021)", url="https://www.census.gov/data/tables/time-series/dec/coh-owner.html",
      call_number="Table file https://www2.census.gov/programs-surveys/decennial/tables/time-series/coh-owner/owner-tab.txt", file_sha256=own_sha, **common,
      notes="Rows 1900-1980 and the United States, New York and Mississippi columns of the Census Bureau's Homeownership Rates table (all states, 1900-2000). Percent values copied unchanged from the table file. The Census page text says the national rate fell to 44 percent in 1940 and topped 60 percent within two decades after World War II, and names the Middle Atlantic states and many southern states as examples of the postwar boom."),
]
# retrieved 날짜를 표 파일에 맞춰 둔다. repository 필드는 공통.
root = "data/ap/ush-sources"
reg = json.load(open(f"{root}/registry.json"))
ids = {s["id"] for s in sources}
reg["sources"] = [s for s in reg["sources"] if s["id"] not in ids] + sources
json.dump(reg, open(f"{root}/registry.json", "w"), ensure_ascii=False, indent=1)
for s in sources:
    d = f"{root}/files/{s['id']}"; os.makedirs(d, exist_ok=True)
    json.dump(s["table"], open(f"{d}/table.json", "w"), ensure_ascii=False, indent=1)
    md = [f"# {s['title']}", ""] + [f"- **{k}**: {v}" for k, v in s.items() if k != "table" and k != "title"] + ["", "| " + " | ".join(s["table"]["columns"]) + " |", "|" + "---|" * len(s["table"]["columns"])] + ["| " + " | ".join(r) + " |" for r in s["table"]["rows"]]
    open(f"{d}/SOURCE.md", "w").write("\n".join(md) + "\n")
    print(s["id"], s["sha256"])
    for r in s["table"]["rows"]: print("  ", r)
