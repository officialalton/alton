# World History real-source registrar (2026-10-15): cuts excerpts from repository files by anchor phrases (code, not hand-copied), records hashes/provenance in data/ap/wh-sources/registry.json,
# copies reviewed images to public/ap-sources/<id>/image.<ext> and data/ap/wh-sources/files/<id>/. Original downloads stay outside the repo (scratchpad) and are never executed.
#   python3 -I scripts/ap-generation/wh-sources.py --src <download dir> --manifest scripts/ap-generation/wh-sources-manifest.json [--check]
# Manifest entry kinds: text (kind txt|html, file, segs [[start,end]...], fixes), image (src file, alt, credit), table (columns, rows).
import hashlib, html, json, os, re, shutil, sys
from struct import unpack

def arg(n, d=None): return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
SRC = arg("--src"); MAN = arg("--manifest"); CHECK = "--check" in sys.argv
TODAY = "2026-10-15"; ROOT = "data/ap/wh-sources"
sha = lambda b: hashlib.sha256(b).hexdigest()
def sortkeys(o):
    if isinstance(o, list): return [sortkeys(x) for x in o]
    if isinstance(o, dict): return {k: sortkeys(o[k]) for k in sorted(o)}
    return o
def table_hash(t): return sha(json.dumps(sortkeys(t), separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
ws = lambda s: re.sub(r"\s+", " ", s).strip()
def read_text(p, kind):
    t = open(os.path.join(SRC, p), encoding="utf-8", errors="replace").read()
    if kind == "html":
        t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S); t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return ws(t)
def cut(text, start, end):
    i = text.index(start); j = text.index(end, i + len(start)) + len(end)
    return text[i:j]
def jpeg_size(b):
    i = 2
    while i < len(b):
        if b[i] != 0xFF: i += 1; continue
        m = b[i + 1]
        if 0xC0 <= m <= 0xC3: h, w = unpack(">HH", b[i + 5:i + 9]); return w, h
        i += 2 + unpack(">H", b[i + 2:i + 4])[0]
    raise SystemExit("no jpeg size")
def png_size(b): return unpack(">II", b[16:24])

man = json.load(open(MAN))
reg_path = os.path.join(ROOT, "registry.json")
reg = json.load(open(reg_path)) if os.path.exists(reg_path) else {"schema": "wh-sources-1", "generated": TODAY, "policy": "Every source is a real historical document, image or dataset fixed BEFORE any question, skill, key or distractor is designed from it. Excerpts are cut by code from the repository file between anchor phrases; hashes pin the exact text. Original downloads are not committed.", "sources": []}
byid = {s["id"]: s for s in reg["sources"]}
text_cache = {}
for d in man["sources"]:
    base = dict(id=d["id"], type=d["type"], title=d["title"], author=d["author"], year=d["year"], repository=d["repository"], url=d["url"], call_number=d.get("call_number", ""), rights_statement=d["rights"], reuse_basis=d["reuse"], modified=d["modified"], retrieved=d.get("retrieved", TODAY), origin="real_historical_source", region=d.get("region", ""), unit=d.get("unit", ""), notes=d.get("notes", ""))
    k = d["kind"]
    if k in ("txt", "html"):
        key = (d["file"], k)
        text = text_cache.get(key) or text_cache.setdefault(key, read_text(d["file"], k)); segs = []
        for a, b in d["segs"]:
            try: s = cut(text, a, b)
            except ValueError: raise SystemExit(f"{d['id']}: anchor not found: {a[:50]} .. {b[:50]}")
            for x, y in d.get("fixes", []): s = s.replace(x, y)
            for x, y in d.get("rfixes", []): s = re.sub(x, y, s)
            if d.get("strip_underscore"): s = s.replace("_", "")
            segs.append(s.strip())
        joined = " [...] ".join(segs); words = len(joined.replace(" [...] ", " ").split())
        if CHECK: print(f"{d['id']}: {words} words, {len(segs)} segs")
        if CHECK and "--show" in sys.argv and d["id"] in sys.argv: print("   " + joined)
        e = dict(base, excerpt_segments=segs, excerpt_words=words, sha256=sha(joined.encode("utf-8")), hash_of="excerpt segments joined with ' [...] ' (UTF-8)")
        if CHECK and any("_" in s for s in segs): print("  WARNING underscore markup in", d["id"])
    elif k == "table":
        t = {"columns": d["columns"], "rows": [[str(c) for c in r] for r in d["rows"]]}
        e = dict(base, table=t, sha256=table_hash(t), hash_of="canonical JSON of table (sorted keys, compact separators, UTF-8)")
    elif k == "image":
        p = os.path.join(SRC, d["src"]); b = open(p, "rb").read(); ext = os.path.splitext(d["src"])[1].lower().replace(".jpeg", ".jpg")
        w, h = jpeg_size(b) if b[:2] == b"\xff\xd8" else png_size(b)
        assert (b[:2] == b"\xff\xd8" or b[:4] == b"\x89PNG") and max(w, h) <= 1600 and len(b) < 1_500_000, (d["id"], w, h, len(b))
        e = dict(base, file=f"files/{d['id']}/image{ext}", public_path=f"ap-sources/{d['id']}/image{ext}", sha256=sha(b), bytes=len(b), width=w, height=h, alt=d["alt"], credit=d["credit"])
        if not CHECK:
            os.makedirs(os.path.join(ROOT, "files", d["id"]), exist_ok=True); open(os.path.join(ROOT, e["file"]), "wb").write(b)
            os.makedirs(os.path.join("public/ap-sources", d["id"]), exist_ok=True); open(os.path.join("public", e["public_path"]), "wb").write(b)
    else: raise SystemExit(f"unknown kind {k}")
    byid[d["id"]] = e
    if not CHECK:
        os.makedirs(os.path.join(ROOT, "files", d["id"]), exist_ok=True)
        src_md = f"# {e['title']}\n\n- id: {e['id']}\n- author: {e['author']}\n- year: {e['year']}\n- repository: {e['repository']}\n- url: {e['url']}\n- call number: {e.get('call_number','')}\n- rights statement: {e['rights_statement']}\n- reuse basis: {e['reuse_basis']}\n- modified: {e['modified']}\n- retrieved: {e['retrieved']}\n- sha256: {e['sha256']} ({e.get('hash_of','image file bytes')})\n"
        open(os.path.join(ROOT, "files", d["id"], "SOURCE.md"), "w").write(src_md)
        if "excerpt_segments" in e: open(os.path.join(ROOT, "files", d["id"], "excerpt.txt"), "w").write("\n[...]\n".join(e["excerpt_segments"]) + "\n")
reg["sources"] = sorted(byid.values(), key=lambda s: s["id"]); reg["generated"] = TODAY
if not CHECK: json.dump(reg, open(reg_path, "w"), indent=1, ensure_ascii=False); print(f"registry: {len(reg['sources'])} sources")
