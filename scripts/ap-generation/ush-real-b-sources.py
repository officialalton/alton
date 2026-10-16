# US History Stage B 실제 자료 등록(2026-10-15): 저장소 원문에서 발췌를 코드로 자르고(앵커 문구 → 연속 구간, 손으로 옮기지 않음), 이미지·표와 함께 레지스트리에 추가한다.
#   python3 -I scripts/ap-generation/ush-real-b-sources.py --src <내려받은 원본 폴더> [--check]
# 입력(내려받은 공식 원본, 커밋하지 않음; <src>/ 아래):
#   jackson/t.html (Avalon ajveto01.asp), sumner/t.txt (Gutenberg #18603), tarbell/t.txt (#60692), tocq/t.txt (#816), lsp/t.txt (#72757), walden/t.txt (#205),
#   sherman/t.html·icc/t.html (archives.gov milestone-documents), wp56/w.txt (pdftotext -layout POP-twps0056.pdf), img/next/i.jpg·img/lowell/i.jpg (LoC tile.loc.gov 1024px)
# 출력: data/ap/ush-sources/registry.json 에 항목 추가(이미 있으면 갱신), files/<id>/excerpt.txt|table.json|image.jpg + SOURCE.md, public/ap-sources/<id>/image.jpg.
# --check: 쓰지 않고 발췌 단어 수·앵커 존재만 점검.
import hashlib, html, json, os, re, shutil, sys

def arg(n, d=None):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
SRC = arg("--src"); CHECK = "--check" in sys.argv
sha = lambda b: hashlib.sha256(b).hexdigest()
def sortkeys(o):
    if isinstance(o, list): return [sortkeys(x) for x in o]
    if isinstance(o, dict): return {k: sortkeys(o[k]) for k in sorted(o)}
    return o
def table_hash(t): return sha(json.dumps(sortkeys(t), separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
ws = lambda s: re.sub(r"\s+", " ", s).strip()
def read_txt(p): return ws(open(os.path.join(SRC, p), encoding="utf-8", errors="replace").read())
def read_html(p):
    t = open(os.path.join(SRC, p), encoding="utf-8", errors="replace").read()
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    return ws(html.unescape(re.sub(r"<[^>]+>", " ", t)))
def cut(text, start, end):
    i = text.index(start); j = text.index(end, i) + len(end)
    return text[i:j]

TODAY = "2026-10-15"
GUT = "Project Gutenberg eBook #%s"
def gut_rights(book): return f"Project Gutenberg states the text is free of restrictions in the United States; the work was published {book}."
USGOV = "Official document of the U.S. government (17 U.S.C. 105 / published before 1929)."

TEXTS = [
 dict(id="txt-jackson-veto-1832", file="jackson/t.html", kind="html", type="primary_text", title="Andrew Jackson, Veto Message Regarding the Bank of the United States (excerpt)",
      author="Andrew Jackson, President of the United States", year="1832 (July 10)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/19th_century/ajveto01.asp",
      rights="Presidential message (U.S. government work, 17 U.S.C. 105; delivered 1832).", reuse="public domain (U.S. government work; published before 1929)",
      segs=[("It is to be regretted that the rich and powerful too often", "it would be an unqualified blessing.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="Veto of the bill to recharter the Second Bank of the United States, addressed to the Senate."),
 dict(id="txt-robinson-1898", file="lsp/t.txt", kind="txt", type="primary_text", title="Loom and Spindle, or Life among the Early Mill Girls (excerpt on Lowell)",
      author="Harriet Hanson Robinson (recalling Lowell mill life of the 1830s and 1840s)", year="1898", repository="Project Gutenberg eBook #72757", url="https://www.gutenberg.org/ebooks/72757",
      rights=gut_rights("in 1898"), reuse="public domain in the United States (published before 1929)",
      segs=[("In 1848 over one-half of the depositors", "belonged to them"), ("Cutting down the wages was not their only grievance", "walked in procession through the streets.")],
      modified="excerpted (two segments joined by [...]); whitespace normalized; no wording changed",
      notes="A memoir written decades after the events: Robinson began work in a Lowell mill as a child in 1834 and took part in the 1836 'turn out'."),
 dict(id="txt-tocqueville-1840", file="tocq/t.txt", kind="txt", type="primary_text", title="Democracy in America, vol. 2: Causes of the Restless Spirit of Americans in the Midst of Their Prosperity (excerpt)",
      author="Alexis de Tocqueville (French observer; translated by Henry Reeve)", year="1840 (vol. 2; English translation)", repository="Project Gutenberg eBook #816", url="https://www.gutenberg.org/ebooks/816",
      rights=gut_rights("in 1840 (English translation 19th century)"), reuse="public domain in the United States (published before 1929)",
      segs=[("It is strange to see with what feverish ardor", "to carry his changeable longings elsewhere.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="Tocqueville visited the United States in 1831-32; the passage is a French aristocrat's generalization about American society."),
 dict(id="txt-thoreau-1854", file="walden/t.txt", kind="txt", type="primary_text", title="Walden, 'Economy' (excerpt on the railroad)",
      author="Henry David Thoreau", year="1854", repository="Project Gutenberg eBook #205", url="https://www.gutenberg.org/ebooks/205",
      rights=gut_rights("in 1854"), reuse="public domain in the United States (published before 1929; author died 1862)",
      segs=[("But if we stay at home and mind our business, who will want railroads?", "the cars run smoothly over them.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="Thoreau lived at Walden Pond, Massachusetts, 1845-47; the book was published in Boston in 1854."),
 dict(id="txt-sumner-1883", file="sumner/t.txt", kind="txt", type="primary_text", title="What Social Classes Owe to Each Other (excerpt on the State)",
      author="William Graham Sumner (Yale professor of political and social science)", year="1883", repository="Project Gutenberg eBook #18603", url="https://www.gutenberg.org/ebooks/18603",
      rights=gut_rights("in 1883"), reuse="public domain in the United States (published before 1929; author died 1910)",
      segs=[("I cannot see the sense of spending time to read and write observations", "settled aside from the hypothesis of State regulation.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="An academic essay arguing for laissez-faire; the Gutenberg transcription notes the edition's original capitalization."),
 dict(id="txt-ica-1887", file="icc/t.html", kind="html", type="primary_text", title="Interstate Commerce Act, Section 2 (excerpt)",
      author="Congress of the United States (Forty-Ninth Congress, Second Session)", year="1887 (February 4)", repository="U.S. National Archives (Milestone Documents transcript)", url="https://www.archives.gov/milestone-documents/interstate-commerce-act",
      rights=USGOV, reuse="public domain (U.S. government work; published before 1929)",
      segs=[("Sec. 2. That if any common carrier subject to the provisions of this act shall", "which is hereby prohibited and declared to be unlawful.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="National Archives call number: Enrolled Acts and Resolutions of Congress, 1789-1992; RG 11."),
 dict(id="txt-sherman-1890", file="sherman/t.html", kind="html", type="primary_text", title="Sherman Anti-Trust Act, Sections 1 and 2 (excerpt)",
      author="Congress of the United States (Fifty-First Congress, First Session)", year="1890 (July 2)", repository="U.S. National Archives (Milestone Documents transcript)", url="https://www.archives.gov/milestone-documents/sherman-anti-trust-act",
      rights=USGOV, reuse="public domain (U.S. government work; published before 1929)",
      segs=[("Sec. 1. Every contract, combination in the form of trust or other- wise", "is hereby declared to be illegal."), ("Sec. 2. Every person who shall monopolize", "or by both said punishments, in the discretion of the court.")],
      fixes=[("other- wise", "otherwise")], modified="excerpted (two segments joined by [...]); whitespace normalized; the transcript's line-break hyphenation 'other- wise' rejoined as 'otherwise'; no other wording changed",
      notes="Segment 2 is the full text of Section 2 including its penalty clause."),
 dict(id="txt-tarbell-1904", file="tarbell/t.txt", kind="txt", type="secondary_text", title="The History of the Standard Oil Company (excerpt on the South Improvement Company, 1872)",
      author="Ida M. Tarbell (journalist; the book collects her McClure's Magazine series of 1902-1904)", year="1904", repository="Project Gutenberg eBook #60692", url="https://www.gutenberg.org/ebooks/60692",
      rights=gut_rights("in 1904"), reuse="public domain in the United States (published before 1929; author died 1944 but the 1904 edition is pre-1929)",
      segs=[("The oil men now met the very plausible reasons", "if there were fair play.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="A journalistic history written about events 30 years earlier; secondary in relation to the 1872 episode, and a muckraking work in its own time."),
]

def build_text(d):
    text = read_html(d["file"]) if d["kind"] == "html" else read_txt(d["file"])
    segs = []
    for a, b in d["segs"]:
        s = cut(text, a, b)
        for x, y in d.get("fixes", []): s = s.replace(x, y)
        if "_" in s: raise SystemExit(f"{d['id']}: underscore markup in excerpt")
        segs.append(s)
    joined = " [...] ".join(segs); words = len(joined.replace(" [...] ", " ").split())
    e = dict(id=d["id"], type=d["type"], title=d["title"], author=d["author"], year=d["year"], repository=d["repository"], url=d["url"], call_number=d.get("call_number", ""),
             rights_statement=d["rights"], reuse_basis=d["reuse"], modified=d["modified"], retrieved=TODAY, origin="real_historical_source", excerpt_segments=segs, excerpt_words=words,
             sha256=sha(joined.encode("utf-8")), hash_of="excerpt segments joined with ' [...] ' (UTF-8)", notes=d.get("notes", ""))
    return e

# ── 표: 지역별 인구 1800-1860 (Census Bureau Working Paper 56, Tables 1-5) ──
def build_table():
    L = open(os.path.join(SRC, "wp56/w.txt"), encoding="utf-8").read().replace("\x0c", "").split("\n")
    def start(num, name):
        for i, l in enumerate(L):
            if i > 900 and re.match(rf"Table {num}\. {name}", l): return i
        raise SystemExit(f"table {num}")
    def tot(num, name, year):
        i = start(num, name)
        for l in L[i:i + 90]:
            if l.strip() == "PERCENT": break
            m = re.match(rf"^{year}\s[.\s]+(.*)$", l)
            if m: return int(re.sub(r"\s", "", re.split(r"\s{2,}", m.group(1).strip())[0]))
        raise SystemExit(f"row {num} {year}")
    regs = [(2, "Northeast Region"), (3, "Midwest \\(North Central\\) Region"), (4, "South Region"), (5, "West Region")]
    rows = []
    for yr in (1800, 1820, 1840, 1860):
        us = tot(1, "United States", yr); cells = []
        for n, nm in regs:
            try: cells.append(tot(n, nm, yr))
            except SystemExit: cells.append(None)
        assert sum(c or 0 for c in cells) == us, (yr, cells, us)  # 지역 합 = 전국(West 는 1850 이전 표 없음 = 0)
        rows.append([str(yr)] + [f"{c:,}" if c is not None else "–" for c in cells] + [f"{us:,}"])
    return {"columns": ["Year", "Northeast", "Midwest", "South", "West", "United States"], "rows": rows}

def table_entry(tab, pdf_sha):
    return dict(id="stat-region-pop-1800-1860", type="statistic_table", title="Resident population of the United States by region, 1800-1860 (selected census years)", author="U.S. Census Bureau (Campbell Gibson and Kay Jung, compilers of Working Paper 56)",
        year="2002 compilation of decennial census counts for 1800-1860", repository="U.S. Census Bureau", url="https://www.census.gov/content/dam/Census/library/working-papers/2002/demo/POP-twps0056.pdf", call_number="Working Paper No. 56, Tables 1-5",
        rights_statement="Publication of a U.S. federal agency (U.S. government work, 17 U.S.C. 105); no copyright claimed on the page.", reuse_basis="public domain (U.S. government work)",
        modified="four decennial years chosen from the compiled tables; the Northeast, Midwest (North Central), South and West totals and the U.S. total copied by code; sums of regions checked to equal the U.S. total in every year; the West Region has no entry before 1850 and is shown as a dash",
        retrieved=TODAY, origin="real_historical_source", table=tab, sha256=table_hash(tab), hash_of="canonical JSON of table (sorted keys, compact separators, UTF-8)", notes=f"Source PDF sha256 {pdf_sha}. Census regions use modern definitions applied to each census year; 1860 totals include enslaved people.")

IMAGES = [
 dict(id="img-next-1904", type="political_cartoon", src="img/next/i.jpg", title="Next!", author="Udo J. Keppler (artist); Puck (Keppler & Schwarzmann)", year="1904 (Puck, September 7, 1904, centerfold)",
      repository="Library of Congress, Prints and Photographs Division", url="https://www.loc.gov/item/2001695241/", call_number="Illus. in AP101.P7 1904 (Case Y) [P&P]; reproduction no. LC-DIG-ppmsca-25884",
      rights="LoC item record rights information: \"No known restrictions on publication.\"", reuse="public domain (U.S. publication before 1929; LoC reports no known restrictions)",
      modified="unmodified except LoC's 1024px reference JPEG (two facing magazine pages with the gutter visible)",
      alt="A color cartoon spread from Puck: a giant octopus whose body is a Standard Oil storage tank has its tentacles wrapped around two domed government buildings (the U.S. Capitol and a state house, each with a labeled flag), while the White House at the lower left is not yet in its grasp and one tentacle winds toward it; small figures struggle at the lower right; the caption NEXT! is partly visible at the bottom.",
      credit="Next!, Udo J. Keppler, Puck, Sept. 7, 1904. Library of Congress, Prints and Photographs Division (LC-DIG-ppmsca-25884). Public domain; no known restrictions.",
      notes="Visible lettering is limited (STANDARD OIL on the tank; small flag labels). The caption NEXT! runs across the two pages."),
 dict(id="img-lowell-1840", type="print", src="img/lowell/i.jpg", title="[View of Lowell, Massachusetts at the confluence of the Merrimack and Concord rivers, with a row of textile mills or factories mainly along the Merrimack River]", author="Unattributed (title devised by Library of Congress staff)", year="c. 1840 (LoC date 1840)",
      repository="Library of Congress, Prints and Photographs Division (Popular Graphic Arts)", url="https://www.loc.gov/item/94515606/", call_number="PGA - Unattributed--View of Lowell, Massachusetts ... (B size) [P&P]; reproduction no. LC-DIG-pga-07376",
      rights="LoC item record rights information: \"No known restrictions on publication.\"", reuse="public domain (unattributed print c. 1840; LoC reports no known restrictions)",
      modified="unmodified except LoC's 1024px reference JPEG (hand-colored print on its mount)",
      alt="A hand-colored print of Lowell, Massachusetts seen across a meadow and a river: rows of brick mill buildings and church spires line the far bank under a wide sky, with a tree in the foreground.",
      credit="View of Lowell, Massachusetts, unattributed print, c. 1840. Library of Congress, Prints and Photographs Division (LC-DIG-pga-07376). Public domain; no known restrictions.",
      notes="Title devised by Library staff; the print is of unknown authorship and unknown purpose; it shows the mills small and orderly beside open country."),
]

def build_image(d):
    p = os.path.join(SRC, d["src"]); b = open(p, "rb").read()
    from struct import unpack
    i = 2; w = h = 0
    while i < len(b):
        if b[i] != 0xFF: i += 1; continue
        m = b[i + 1]
        if 0xC0 <= m <= 0xC3: h, w = unpack(">HH", b[i + 5:i + 9]); break
        i += 2 + unpack(">H", b[i + 2:i + 4])[0]
    assert b[:2] == b"\xff\xd8" and w <= 1600 and h <= 1600 and len(b) < 1_500_000, (d["id"], w, h, len(b))
    e = dict(id=d["id"], type=d["type"], title=d["title"], author=d["author"], year=d["year"], repository=d["repository"], url=d["url"], call_number=d["call_number"], rights_statement=d["rights"], reuse_basis=d["reuse"], modified=d["modified"], retrieved=TODAY, origin="real_historical_source",
             file=f"files/{d['id']}/image.jpg", public_path=f"ap-sources/{d['id']}/image.jpg", sha256=sha(b), bytes=len(b), width=w, height=h, alt=d["alt"], credit=d["credit"], notes=d["notes"])
    return e, b

def source_md(e):
    L = [f"# {e['title']}", ""]
    for k in ("id", "type", "title", "author", "year", "repository", "url", "call_number", "rights_statement", "reuse_basis", "modified", "retrieved", "origin", "sha256", "bytes", "width", "height", "excerpt_words", "notes"):
        if k in e and e[k] not in ("", None): L.append(f"- **{k}**: {e[k]}")
    return "\n".join(L) + "\n"

def main():
    reg_path = "data/ap/ush-sources/registry.json"; reg = json.load(open(reg_path))
    new = []; extra = {}
    for d in TEXTS:
        e = build_text(d); new.append(e); extra[e["id"]] = ("excerpt.txt", " [...] ".join(e["excerpt_segments"]).encode("utf-8")); print(f"{e['id']}: {e['excerpt_words']} words")
    tab = build_table(); pdf = open(os.path.join(SRC, "wp56/w.pdf"), "rb").read() if os.path.exists(os.path.join(SRC, "wp56/w.pdf")) else b""
    te = table_entry(tab, sha(pdf) if pdf else "(pdf not kept)"); new.append(te); extra[te["id"]] = ("table.json", json.dumps(tab, indent=1).encode("utf-8")); print(json.dumps(tab["rows"]))
    imgs = {}
    for d in IMAGES:
        e, b = build_image(d); new.append(e); imgs[e["id"]] = b; print(f"{e['id']}: {e['width']}x{e['height']} {e['bytes']} bytes")
    if CHECK: return
    byid = {s["id"]: s for s in reg["sources"]}
    for e in new: byid[e["id"]] = e
    order = [s["id"] for s in reg["sources"]] + [e["id"] for e in new if e["id"] not in {s["id"] for s in reg["sources"]}]
    reg["sources"] = [byid[i] for i in order]; reg["generated"] = TODAY
    json.dump(reg, open(reg_path, "w"), indent=1, ensure_ascii=False); open(reg_path, "a").write("\n")
    for e in new:
        d = f"data/ap/ush-sources/files/{e['id']}"; os.makedirs(d, exist_ok=True)
        if e["id"] in extra: open(f"{d}/{extra[e['id']][0]}", "wb").write(extra[e["id"]][1])
        if e["id"] in imgs:
            open(f"{d}/image.jpg", "wb").write(imgs[e["id"]]); pd = f"public/ap-sources/{e['id']}"; os.makedirs(pd, exist_ok=True); shutil.copyfile(f"{d}/image.jpg", f"{pd}/image.jpg")
        open(f"{d}/SOURCE.md", "w").write(source_md(e))
    print(f"registry: {len(reg['sources'])} sources")
main()
