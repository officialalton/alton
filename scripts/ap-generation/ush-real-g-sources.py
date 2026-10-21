# US History US3 실제 자료 전환 3단계(2026-10-21): MC 14세트용 실제 사료를 저장소 원문에서 코드로 잘라 레지스트리에 추가한다(앵커 문구 → 연속 구간, 손으로 옮기지 않음).
#   python3 -I scripts/ap-generation/ush-real-g-sources.py --src <내려받은 원본 폴더> [--check]
# 입력(<src>/ 아래, 커밋하지 않음): franklin.txt(Gutenberg #148), nworder.html(Avalon nworder), beard.txt(#70677), northup.txt(#45631), scnull.html·jackson.html(Avalon),
#   a14.html(archives.gov 14th-amendment), hayes.html(Avalon), turner.txt(#22994), tab08.txt·tab10.txt·tab12.txt(census.gov WP27 표 1850·1870·1890), bryan.txt(#12744),
#   eo8802.html·m_civil-rights-act.html(archives.gov milestone), bush.html(govinfo PPP-1991-book1 pg42-3).
# fixes 는 원문 오탈자·줄바꿈 하이픈만 고치고 modified 필드에 적는다(그 밖의 글자는 바꾸지 않음). --check: 쓰지 않고 발췌 단어 수·앵커 존재만 점검.
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

TODAY = "2026-10-21"
def gut(n, pub, died=None):
    return (f"Project Gutenberg states the text is free of restrictions in the United States; the work was published {pub}.", f"public domain in the United States (published before 1929{'; author died ' + died if died else ''})")
USGOV = "Official document of the U.S. government (17 U.S.C. 105)."
G = "Project Gutenberg eBook #%s"

TEXTS = [
 dict(id="txt-franklin-whitefield-1771", file="franklin.txt", kind="txt", type="primary_text", title="The Autobiography of Benjamin Franklin (excerpt on George Whitefield's preaching in Philadelphia)",
      author="Benjamin Franklin (writing his memoir between 1771 and 1790)", year="1771-1790 (written); first English editions 1793 and later", repository=G % "148", url="https://www.gutenberg.org/ebooks/148",
      rights="Project Gutenberg states the text is free of restrictions in the United States; the work was written 1771-1790 and published in English editions before 1929.", reuse="public domain in the United States (published before 1929; author died 1790)",
      segs=[("In 1739 arrived among us from Ireland", "without hearing psalms sung in different families of every street.")], modified="excerpted (one contiguous passage); whitespace normalized; original spelling kept; no wording changed",
      notes="Franklin recalls Whitefield's first visit to Philadelphia in 1739 from memory decades later; Whitefield actually sailed from England, not Ireland."),
 dict(id="txt-nworder-1787", file="nworder.html", kind="html", type="primary_text", title="The Northwest Ordinance, Articles 3 and 6 (excerpts)",
      author="Congress of the Confederation (Continental Congress)", year="1787 (July 13)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/18th_century/nworder.asp",
      rights="Ordinance of the Congress of the Confederation (U.S. government work; enacted 1787, published far more than a century before 1929).", reuse="public domain (U.S. government work; published before 1929)",
      segs=[("Art. 3. Religion, morality, and knowledge", "preserving peace and friendship with them."), ("Art. 6. There shall be neither slavery nor involuntary servitude", "labor or service as aforesaid.")],
      modified="excerpted (two segments joined by [...]); whitespace normalized; the article labels 'Art. 3.' and 'Art. 6.' kept; no wording changed",
      notes="Passed by the Confederation Congress on July 13, 1787, while the Constitutional Convention met in Philadelphia; it governed the territory north of the Ohio River."),
 dict(id="txt-beard-1913", file="beard.txt", kind="txt", type="secondary_text", title="An Economic Interpretation of the Constitution of the United States (excerpts from the conclusion)",
      author="Charles A. Beard (Professor of Politics, Columbia University)", year="1913 (Macmillan; Gutenberg text from the 1914 printing)", repository=G % "70677", url="https://www.gutenberg.org/ebooks/70677",
      rights="Project Gutenberg states the text is public domain in the United States; the book was first published in 1913 and the Gutenberg text derives from the 1914 Macmillan printing.", reuse="public domain in the United States (published before 1929; author died 1948)",
      segs=[("The members of the Philadelphia Convention which drafted the Constitution were", "beyond the reach of popular majorities."), ("In the ratification of the Constitution, about three-fourths of the adult males failed to vote", "disfranchisement by property qualifications."), ("The Constitution was not created by", "truly national in their scope.")],
      modified="excerpted (three segments joined by [...]); whitespace normalized; curly quotation marks kept; no wording changed",
      notes="Beard's 1913 book challenged the older view that the Constitution was an expression of the will of the whole people; later historians disputed its evidence and conclusions."),
 dict(id="txt-northup-1853", file="northup.txt", kind="txt", type="primary_text", title="Twelve Years a Slave (excerpt on the cotton-picking day)",
      author="Solomon Northup (born free in New York; kidnapped in 1841 and enslaved in Louisiana until 1853)", year="1853", repository=G % "45631", url="https://www.gutenberg.org/ebooks/45631",
      rights="Project Gutenberg states the text is free of restrictions in the United States; the work was published in 1853.", reuse="public domain in the United States (published before 1929)",
      segs=[("The hands are required to be in the cotton field", "he knows that he must suffer.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="A narrative published in 1853 after Northup regained his freedom; it was dictated to and edited by David Wilson, a white lawyer and writer."),
 dict(id="txt-sc-ordinance-1832", file="scnull.html", kind="html", type="primary_text", title="South Carolina Ordinance of Nullification (excerpts)",
      author="The people of the State of South Carolina, in convention assembled", year="1832 (November 24)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/19th_century/ordnull.asp",
      rights="State convention ordinance of 1832 (public document published far more than a century before 1929).", reuse="public domain (published before 1929)",
      segs=[("We, therefore, the people of the State of South Carolina, in convention assembled", "within the United States,"), ("are unauthorized by the constitution of the United States", "its officers or citizens;")],
      modified="excerpted (two segments joined by [...]; the titles of the two tariff acts between them are omitted); whitespace normalized; no wording changed",
      notes="Adopted in response to the tariffs of 1828 and 1832; it declared them void within South Carolina."),
 dict(id="txt-jackson-proclamation-1832", file="jackson.html", kind="html", type="primary_text", title="Andrew Jackson, Proclamation on Nullification (excerpt)",
      author="Andrew Jackson, President of the United States", year="1832 (December 10)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/19th_century/jack01.asp",
      rights="Presidential proclamation (U.S. government work, 17 U.S.C. 105; issued 1832).", reuse="public domain (U.S. government work; published before 1929)",
      segs=[("I consider, then, the power to annul a law of the United States", "for which it was formed.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="Issued sixteen days after South Carolina's convention adopted its ordinance; Congress passed the Force Bill and a compromise tariff in early 1833."),
 dict(id="txt-14th-amendment-1868", file="a14.html", kind="html", type="primary_text", title="Fourteenth Amendment to the Constitution, Sections 1 and 2 (excerpts)",
      author="Congress of the United States (Thirty-Ninth Congress; proposed June 1866, ratified July 1868)", year="1868", repository="U.S. National Archives (Milestone Documents transcript)", url="https://www.archives.gov/milestone-documents/14th-amendment",
      rights=USGOV, reuse="public domain (U.S. government work; published before 1929)",
      segs=[("Section 1. All persons born or naturalized", "equal protection of the laws."), ("Section 2. Representatives shall be apportioned", "male citizens twenty-one years of age in such State.")],
      modified="excerpted (two segments joined by [...]); whitespace normalized; no wording changed",
      notes="National Archives call number: General Records of the United States Government, RG 11; proclaimed ratified July 28, 1868."),
 dict(id="txt-hayes-inaugural-1877", file="hayes.html", kind="html", type="primary_text", title="Inaugural Address of Rutherford B. Hayes (excerpts)",
      author="Rutherford B. Hayes, President of the United States", year="1877 (March 5)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/19th_century/hayes.asp",
      rights="Presidential address delivered in an official capacity (U.S. government work, 17 U.S.C. 105; delivered 1877).", reuse="public domain (U.S. government work; published before 1929)",
      segs=[("The permanent pacification of the country upon such principles", "of supreme importance."), ("The people of those States are still impoverished", "those States."), ("With respect to the two distinct races", "carefully and equally.")],
      modified="excerpted (three segments joined by [...]); whitespace normalized; no wording changed",
      notes="Delivered after the disputed election of 1876 was settled by an electoral commission; Hayes withdrew the last federal troops from the South in April 1877."),
 dict(id="txt-turner-1893", file="turner.txt", kind="txt", type="secondary_text", title="The Significance of the Frontier in American History (excerpts)",
      author="Frederick Jackson Turner (Professor of History, University of Wisconsin)", year="1893 (read at the American Historical Association, July 12, 1893; reprinted in The Frontier in American History, 1920)", repository=G % "22994", url="https://www.gutenberg.org/ebooks/22994",
      rights="Project Gutenberg states the text is public domain in the United States; the essay was published in 1893-1894 and reprinted in a 1920 book.", reuse="public domain in the United States (published before 1929; author died 1932)",
      segs=[("The existence of an area of free land", "into the complexity of city life."), ("In short, at the frontier the environment is at first too strong for the man.", "a new product that is American.")],
      modified="excerpted (two segments joined by [...]); whitespace normalized; footnote markers removed where the Gutenberg text carries them inline; no wording changed",
      notes="Turner's 'frontier thesis' dominated American historical writing for decades; later historians criticized it for neglecting Native Americans, women, and the role of the federal government."),
 dict(id="txt-bryan-1922", file="bryan.txt", kind="txt", type="primary_text", title="In His Image (excerpt on evolution and morality)",
      author="William Jennings Bryan (former Secretary of State; lecturer)", year="1922 (Fleming H. Revell, New York)", repository=G % "12744", url="https://www.gutenberg.org/ebooks/12744",
      rights="Project Gutenberg states the text is free of restrictions in the United States; the work was published in 1922.", reuse="public domain in the United States (published before 1929; author died 1925)",
      segs=[("I believe there is such a menace to fundamental morality", "demoralizing influence exerted by this doctrine.")], modified="excerpted (one contiguous passage); whitespace normalized; no wording changed",
      notes="From a book of lectures given in 1921 in the James Sprunt series at Union Theological Seminary in Virginia; Bryan later assisted the prosecution at the Scopes trial (1925)."),
 dict(id="txt-eo8802-1941", file="eo8802.html", kind="html", type="primary_text", title="Executive Order 8802, Prohibition of Discrimination in the Defense Industry (excerpts)",
      author="Franklin D. Roosevelt, President of the United States", year="1941 (June 25)", repository="U.S. National Archives (Milestone Documents transcript)", url="https://www.archives.gov/milestone-documents/executive-order-8802",
      rights=USGOV + " Executive orders are official acts of the President.", reuse="public domain (U.S. government work)",
      segs=[("WHEREAS there is evidence that available and needed workers have been barred", "national unity:"), ("I do hereby reaffirm the policy of the United States that there shall be no discrimination", "color, or national origin;"), ("There is established in the Office of Production Management a Committee on Fair Employment Practice", "to be appointed by the President.")],
      modified="excerpted (three segments joined by [...]); whitespace normalized; no wording changed",
      notes="Signed after labor leader A. Philip Randolph and others planned a march on Washington to protest discrimination in defense jobs."),
 dict(id="txt-cra-1964", file="m_civil-rights-act.html", kind="html", type="primary_text", title="Civil Rights Act of 1964, Title II Section 201(a) and Title VII Section 703(a) (excerpts)",
      author="Congress of the United States (Eighty-Eighth Congress), Public Law 88-352", year="1964 (July 2)", repository="U.S. National Archives (Milestone Documents transcript)", url="https://www.archives.gov/milestone-documents/civil-rights-act",
      rights=USGOV + " Public laws are not subject to copyright.", reuse="public domain (U.S. government work)",
      segs=[("SEC. 201. (a) All persons shall be entitled", "race, color, religion, or national origin."), ("SEC. 703. (a) It shall be an unlawful employment practice for an employer", "religion, sex, or national origin.")],
      modified="excerpted (two segments joined by [...]); the first segment ends at the first sentence of section 201(a); the second begins at section 703(a); whitespace normalized; no wording changed",
      notes="Signed July 2, 1964 after a Senate filibuster of 54 days ended; Title VII created the Equal Employment Opportunity Commission."),
 dict(id="txt-bush-gulf-1991", file="bush.html", kind="html", type="primary_text", title="Address to the Nation Announcing Allied Military Action in the Persian Gulf (excerpts)",
      author="George H. W. Bush, President of the United States", year="1991 (January 16)", repository="U.S. Government Publishing Office (GovInfo), Public Papers of the Presidents of the United States: George H. W. Bush, 1991, Book I, pp. 42-45", url="https://www.govinfo.gov/content/pkg/PPP-1991-book1/html/PPP-1991-book1-doc-pg42-3.htm",
      rights=USGOV + " Presidential remarks are official public papers.", reuse="public domain (U.S. government work)",
      segs=[("Just 2 hours ago, allied air forces began an attack", "Ground forces are not engaged."), ("This military action, taken in accord with United Nations resolutions", "many, many other countries."), ("Now the 28 countries with forces in the Gulf area have exhausted", "We will not fail.")],
      modified="excerpted (three segments joined by [...]); text taken from the GovInfo HTML and whitespace normalized; no wording changed",
      notes="Delivered from the Oval Office as air attacks on Iraq began; Congress had authorized the use of force on January 12, 1991."),
]

def build_text(d):
    text = read_html(d["file"]) if d["kind"] == "html" else read_txt(d["file"])
    segs = []
    for a, b in d["segs"]:
        s = cut(text, a, b)
        for x, y in d.get("fixes", []): s = s.replace(x, y)
        s = re.sub(r"\[\d+(?::\d+)?\]", "", s)  # Gutenberg 각주 표지 [2:1]
        s = ws(s)
        if "¬" in s or "[[" in s: raise SystemExit(f"{d['id']}: unresolved marker in excerpt: {s[:160]}")
        segs.append(s)
    joined = " [...] ".join(segs); words = len(joined.replace(" [...] ", " ").split())
    return dict(id=d["id"], type=d["type"], title=d["title"], author=d["author"], year=d["year"], repository=d["repository"], url=d["url"], call_number=d.get("call_number", ""),
                rights_statement=d["rights"], reuse_basis=d["reuse"], modified=d["modified"], retrieved=TODAY, origin="real_historical_source", excerpt_segments=segs, excerpt_words=words,
                sha256=sha(joined.encode("utf-8")), hash_of="excerpt segments joined with ' [...] ' (UTF-8)", notes=d.get("notes", ""))

# ── 표: Census Bureau Working Paper 27, 선택한 도시의 1850·1870·1890 인구 ──
CITIES = ["New York city, NY", "Philadelphia city, PA", "Chicago city, IL", "St. Louis city, MO", "Cleveland city, OH", "Detroit city, MI"]
LABEL = {"New York city, NY": "New York", "Philadelphia city, PA": "Philadelphia", "Chicago city, IL": "Chicago", "St. Louis city, MO": "St. Louis", "Cleveland city, OH": "Cleveland", "Detroit city, MI": "Detroit"}
def build_table():
    tabs = {"1850": "tab08.txt", "1870": "tab10.txt", "1890": "tab12.txt"}; vals = {}; shas = {}
    for y, f in tabs.items():
        raw = open(os.path.join(SRC, f), encoding="utf-8", errors="replace").read(); shas[y] = sha(raw.encode("utf-8"))
        assert f"Population of" in raw.split("\n")[0] and raw.split("\n")[0].rstrip().endswith(y), (y, raw.split("\n")[0])
        for c in CITIES:
            m = re.search(re.escape(c) + r"[ *.]*\s+([0-9,]+)", raw)
            assert m, (y, c); vals[(c, y)] = int(m.group(1).replace(",", ""))
    rows = [[LABEL[c]] + [f"{vals[(c, y)]:,}" for y in tabs] for c in CITIES]
    return {"columns": ["City", "1850", "1870", "1890"], "rows": rows}, shas

def table_entry(tab, shas):
    return dict(id="stat-city-population-1850-1890", type="statistic_table", title="Population of six large American cities, 1850, 1870 and 1890", author="U.S. Census Bureau (Campbell Gibson, compiler of Working Paper No. 27)",
        year="1998 compilation of decennial census counts for 1850-1890", repository="U.S. Census Bureau", url="https://www.census.gov/library/working-papers/1998/demo/POP-twps0027.html", call_number="Working Paper No. 27, Tables 8, 10 and 12 (www2.census.gov/library/working-papers/1998/demographics/pop-twps0027/)",
        rights_statement="Publication of a U.S. federal agency (U.S. government work, 17 U.S.C. 105); no copyright claimed.", reuse_basis="public domain (U.S. government work)",
        modified="six cities and three census years chosen from the compiled tables 'Population of the 100 Largest Urban Places'; the populations were copied by code from the tables' own lines for each city and year; place names shortened (for example 'New York city, NY' to 'New York')",
        retrieved=TODAY, origin="real_historical_source", table=tab, sha256=table_hash(tab), hash_of="canonical JSON of table (sorted keys, compact separators, UTF-8)",
        notes=f"Source tables sha256: 1850 {shas['1850']}, 1870 {shas['1870']}, 1890 {shas['1890']}. Each figure is the population of the city as bounded at that census; New York means the city before the 1898 consolidation (Brooklyn, a separate city until 1898, is not included).")

def source_md(e):
    L = [f"# {e['title']}", ""]
    for k in ("id", "type", "title", "author", "year", "repository", "url", "call_number", "rights_statement", "reuse_basis", "modified", "retrieved", "origin", "sha256", "excerpt_words", "notes"):
        if k in e and e[k] not in ("", None): L.append(f"- **{k}**: {e[k]}")
    return "\n".join(L) + "\n"

def main():
    reg_path = "data/ap/ush-sources/registry.json"; reg = json.load(open(reg_path))
    new = []; extra = {}
    for d in TEXTS:
        e = build_text(d); new.append(e); extra[e["id"]] = ("excerpt.txt", " [...] ".join(e["excerpt_segments"]).encode("utf-8")); print(f"{e['id']}: {e['excerpt_words']} words")
    tab, shas = build_table(); te = table_entry(tab, shas); new.append(te); extra[te["id"]] = ("table.json", json.dumps(tab, indent=1).encode("utf-8")); print(json.dumps(tab["rows"]))
    if CHECK: return
    byid = {s["id"]: s for s in reg["sources"]}
    for e in new: byid[e["id"]] = e
    order = [s["id"] for s in reg["sources"]] + [e["id"] for e in new if e["id"] not in {s["id"] for s in reg["sources"]}]
    reg["sources"] = [byid[i] for i in order]; reg["generated"] = TODAY
    json.dump(reg, open(reg_path, "w"), indent=1, ensure_ascii=False); open(reg_path, "a").write("\n")
    for e in new:
        d = f"data/ap/ush-sources/files/{e['id']}"; os.makedirs(d, exist_ok=True)
        if e["id"] in extra: open(f"{d}/{extra[e['id']][0]}", "wb").write(extra[e["id"]][1])
        open(f"{d}/SOURCE.md", "w").write(source_md(e))
    print(f"registry: {len(reg['sources'])} sources")
main()
