# US History Stage E (2026-10-19; copy of the C-D registrar) 실제 자료 등록(2026-10-15): 저장소 원문에서 발췌를 코드로 자르고(앵커 문구 → 연속 구간, 손으로 옮기지 않음), 이미지·표와 함께 레지스트리에 추가한다.
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
 dict(id="txt-harriot-1588", file="g4247.txt", kind="txt", type="primary_text", title="A Briefe and True Report of the New Found Land of Virginia (excerpt on Vppowoc, tobacco)",
      author="Thomas Harriot, member of the English expedition to Roanoke Island (1585-1586)", year="1588 (London; first printing, Quarto)", repository="Project Gutenberg eBook #4247", url="https://www.gutenberg.org/ebooks/4247",
      rights=gut_rights("in 1588"), reuse="public domain in the United States (published before 1929; author died 1621)",
      segs=[("There is an herbe which is sowed a part by it selfe", "they cast some into the aire likewise:"), ("We ourselues during the time we were there vsed to suck it after their maner", "a volume by it selfe:")],
      modified="excerpted (two segments joined by [...]); whitespace normalized; original spelling kept; no wording changed",
      notes="Original English spelling is preserved (u/v and i/j forms, 'vse', 'maruelously'). The report was published to promote English colonization of Virginia."),
 dict(id="txt-tordesillas-1494", file="av-mod001.html", kind="html", type="primary_text", title="Treaty between Spain and Portugal concluded at Tordesillas, June 7, 1494 (excerpt on the boundary line)",
      author="Representatives of Ferdinand and Isabella of Castile and Aragon and of John II of Portugal", year="1494 (June 7)", repository="Avalon Project, Yale Law School (transcription of an English translation)", url="https://avalon.law.yale.edu/15th_century/mod001.asp",
      rights="Treaty of 1494; no copyright subsists in a 15th-century document; the translation was published before 1929.", reuse="public domain (15th-century document; translation published before 1929)",
      segs=[("That, whereas a certain controversy exists between the said lords", "and to their successors.")],
      modified="excerpted (one contiguous passage); whitespace normalized; clause numeral and editorial brackets omitted; no wording changed",
      notes="Clause 1 of the treaty; the Avalon page prints an English translation (the treaty was written in Spanish and Portuguese)."),
]
IMAGES = []

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
