# US History Stages C·D 실제 자료 등록(2026-10-15): 저장소 원문에서 발췌를 코드로 자르고(앵커 문구 → 연속 구간, 손으로 옮기지 않음), 이미지·표와 함께 레지스트리에 추가한다.
#   python3 -I scripts/ap-generation/ush-real-cd-sources.py --src <내려받은 원본 폴더> [--check]
# 입력(내려받은 공식 원본, 커밋하지 않음; <src>/ 아래): monroe/t.html·fugitive/t.html (Avalon), rebel/t.txt (Gutenberg #31087), img/sb/i.jpg (LoC cdn 1024px), img/res/i.jpg (LoC tile IIIF 12.5%)
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
 dict(id="txt-monroe-1823", file="monroe/t.html", kind="html", type="primary_text", title="Monroe's Seventh Annual Message to Congress (excerpts on European colonization and intervention)",
      author="James Monroe, President of the United States", year="1823 (December 2)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/19th_century/monroe.asp",
      rights="Presidential message to Congress (U.S. government work, 17 U.S.C. 105; delivered 1823).", reuse="public domain (U.S. government work; published before 1929)",
      segs=[("the occasion has been judged proper for asserting", "by any European powers."), ("In the wars of the European powers in matters relating to themselves", "nor does it comport with our policy to do so."), ("We owe it, therefore, to candor", "unfriendly disposition toward the United States.")],
      modified="excerpted (three segments joined by [...]); whitespace normalized; no wording changed",
      notes="Segment 1 follows the message's report on the Russian proposal about the northwest coast; the Avalon transcript marks omissions with ellipses, which are not part of the excerpt."),
 dict(id="txt-fugitive-slave-act-1850", file="fugitive/t.html", kind="html", type="primary_text", title="Fugitive Slave Act of 1850 (excerpts from Sections 5, 6, 7 and 8)",
      author="Congress of the United States (Thirty-First Congress, First Session)", year="1850 (September 18)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/19th_century/fugitive.asp",
      rights="Act of the U.S. Congress (U.S. government work, 17 U.S.C. 105; enacted 1850).", reuse="public domain (U.S. government work; published before 1929)",
      segs=[("and all good citizens are hereby commanded to aid and assist", "for that purpose;"), ("In no trial or hearing under this act shall the testimony of such alleged fugitive be admitted in evidence;", "be admitted in evidence;"), ("any person who shall knowingly and willingly obstruct, hinder, or prevent such claimant", "and imprisonment not exceeding six months"), ("he shall be entitled to a fee of ten dollars in full for his services in each case", "warrant such certificate and delivery")],
      modified="excerpted (four segments joined by [...]); whitespace normalized; no wording changed",
      notes="Sections 5-8 of the Act of September 18, 1850, part of the Compromise of 1850; the Avalon transcription is modernized in spelling but follows the enacted text."),
 dict(id="txt-jones-diary-1863", file="rebel/t.txt", kind="txt", type="primary_text", title="A Rebel War Clerk's Diary at the Confederate States Capital (entries of March 31 and April 2, 1863)",
      author="J. B. Jones (clerk in the Confederate War Department, Richmond)", year="1866 (published; entries dated March 31 and April 2, 1863)", repository="Project Gutenberg eBook #31087", url="https://www.gutenberg.org/ebooks/31087",
      rights=gut_rights("in 1866"), reuse="public domain in the United States (published before 1929; author died 1866)",
      segs=[("Another stride of the grim specter", "leave the city."), ("This morning early a few hundred women and boys met as by", "with exemptions in their pockets."), ("Not knowing the meaning of such a procession", "in the hands of the extortioners."), ("Here they were incited to pillage valuables", "in contravention of Judge Meredith's decision.")],
      modified="excerpted (four segments joined by [...]); whitespace normalized; line breaks removed; no wording changed",
      notes="A diary kept by a Confederate government clerk and published in 1866; Jones's wording ('mob', 'extortioners') is his own point of view. The April 2, 1863 entry describes the Richmond bread riot."),
]
IMAGES = [
 dict(id="img-school-begins-1899", type="political_cartoon", src="img/sb/i.jpg", title="School begins", author="Louis Dalrymple (artist); Puck (Keppler & Schwarzmann)", year="1899 (Puck, January 25, 1899, centerfold)",
      repository="Library of Congress, Prints and Photographs Division", url="https://www.loc.gov/pictures/item/2012647459/", call_number="Illus. in AP101.P7 1899 (Case X) [P&P]; reproduction no. LC-DIG-ppmsca-28668",
      rights="LoC item record rights information: \"No known restrictions on publication.\"", reuse="public domain (U.S. publication before 1929; LoC reports no known restrictions)",
      modified="unmodified except LoC's 1024px reference JPEG (two facing magazine pages with the gutter visible)",
      alt="A color cartoon from Puck: Uncle Sam, as a stern teacher with a pointer, stands over four seated children labeled Philippines, Hawaii, Porto Rico and Cuba, who look unhappy; behind them a row of better-dressed pupils reads books labeled with western states and territories, a Native American boy sits apart reading an upside-down book, a Black boy washes a window, and a Chinese boy stands outside the door. A blackboard at the right carries a printed lesson about governing new territories with or without the consent of the governed.",
      credit="School begins, Louis Dalrymple, Puck, Jan. 25, 1899. Library of Congress, Prints and Photographs Division (LC-DIG-ppmsca-28668). Public domain; no known restrictions.",
      notes="Caption under the picture: 'Uncle Sam (to his new class in Civilization)'. Blackboard text is legible at 1024px. The cartoon uses racial caricature typical of 1899 and is an expression of an imperialist viewpoint, shown as a historical source."),
 dict(id="map-indian-reservations-1892", type="map", src="img/res/i.jpg", title="Map showing Indian reservations within the limits of the United States", author="United States, Office of Indian Affairs (compiled under Commissioner T. J. Morgan)", year="1892",
      repository="Library of Congress, Geography and Map Division", url="https://www.loc.gov/item/2009579467/", call_number="G3701.G6 1892 .U5",
      rights="LoC GMD statement on the item record: The content of the Library of Congress Geography and Map Division digitized collections is free to use and reuse unless a Rights Advisory statement is present that indicates otherwise. (No Rights Advisory is present on the item record.)",
      reuse="public domain (U.S. government publication of 1892; LoC GMD free to use and reuse)",
      modified="unmodified except LoC's IIIF 12.5% rendering (1311x839 px)",
      alt="An 1892 color map of the United States prepared for the Commissioner of Indian Affairs: Indian reservations are shaded orange and red, with state names and a legend at the lower left; the largest orange areas are the Indian Territory (present-day Oklahoma), the Dakotas, Montana, Arizona and New Mexico, and smaller reservations appear in the Pacific Northwest, the upper Midwest, New York and elsewhere. Insets show Alaska, California mission reservations and the Indian Territory.",
      credit="Map showing Indian reservations within the limits of the United States, Office of Indian Affairs, 1892. Library of Congress, Geography and Map Division (G3701.G6 1892 .U5). Public domain.",
      notes="Reservations are the orange and red areas; the legend at lower left is small and not reliably legible at this size, so items rely on the colored areas and state names only."),
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
        for sg in e["excerpt_segments"]: print("   >", sg[:140], "...", sg[-60:])
    imgs = {}
    for d in IMAGES:
        e, b = build_image(d); new.append(e); imgs[e["id"]] = b; print(f"{e['id']}: {e['width']}x{e['height']} {e['bytes']} bytes sha {e['sha256'][:12]}")
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
