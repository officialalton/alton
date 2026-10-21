# US History US3 실제 자료 전환 1단계(2026-10-21): FRQ(SAQ1·SAQ2·DBQ) 자료를 저장소 원문에서 코드로 잘라 레지스트리에 추가한다(앵커 문구 → 연속 구간, 손으로 옮기지 않음).
#   python3 -I scripts/ap-generation/ush-real-f-sources.py --src <내려받은 원본 폴더> [--check]
# 입력(<src>/ 아래, 커밋하지 않음): pa07.html(Avalon pa07), dunning.txt(archive.org reconstructionpo0022dunn djvu txt), dubois.txt(archive.org jstor-1836959 djvu txt),
#   eo.html(Truman Library EO 9835), smith.pdf(senate.gov), sua.txt(archive.org survivalunderatomicattack.1950 djvu txt), ndea.pdf(govinfo STATUTE-72-Pg1580), ike.html(Avalon eisenhower001),
#   t4-1.xlsx(govinfo BUDGET-2025-TAB-4-1 = OMB Historical Table 3.1), cuba.gif(Commons 파일의 원본 GIF).
# OCR 원문은 줄바꿈 하이픈·OCR 오탈자를 fixes 로 고치고, 고친 내용은 modified 필드에 전부 적는다(그 밖의 글자는 바꾸지 않음).
# --check: 쓰지 않고 발췌 단어 수·앵커 존재만 점검.
import hashlib, html, json, os, re, shutil, subprocess, sys, zipfile

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
def read_pdf(p): return ws(subprocess.run(["pdftotext", os.path.join(SRC, p), "-"], capture_output=True, text=True, check=True).stdout)
def read_html(p):
    t = open(os.path.join(SRC, p), encoding="utf-8", errors="replace").read()
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    return ws(html.unescape(re.sub(r"<[^>]+>", " ", t)))
def cut(text, start, end):
    i = text.index(start); j = text.index(end, i) + len(end)
    return text[i:j]

TODAY = "2026-10-21"
USGOV_RIGHTS = "Official publication of the U.S. government (17 U.S.C. 105)."

TEXTS = [
 dict(id="txt-penn-privileges-1701", file="pa07.html", kind="html", type="primary_text", title="Charter of Privileges Granted by William Penn to the Inhabitants of Pennsylvania and Territories (excerpt, Article I)",
      author="William Penn, Proprietary and Governor of Pennsylvania", year="1701 (October 28)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/18th_century/pa07.asp",
      rights="Colonial charter issued in 1701 (published far more than a century before 1929; Avalon states its documents are transcriptions of public-domain texts).", reuse="public domain (published before 1929)",
      segs=[("FIRST BECAUSE no People can be truly happy", "contrary to their religious Persuasion.")], fixes=[("do or super any other", "do or suffer any other")],
      modified="excerpted (one contiguous passage, Article I up to its first sentence-ending clause); whitespace normalized; the transcription's apparent typo 'super' corrected to 'suffer' (the word the sentence requires); no other wording changed",
      notes="Issued by Penn at Philadelphia in 1701 at the request of the Assembly; it replaced the 1683 Frame of Government."),
 dict(id="txt-dunning-1907", file="dunning.txt", kind="txt", type="secondary_text", title="Reconstruction, Political and Economic, 1865-1877 (excerpt on the Freedmen's Bureau)",
      author="William Archibald Dunning (Professor of History and Political Philosophy, Columbia University)", year="1907 (The American Nation: A History, vol. 22; Harper & Brothers)", repository="Internet Archive (scan of the 1907 first edition, Trent University Library copy; item reconstructionpo0022dunn)", url="https://archive.org/details/reconstructionpo0022dunn",
      rights="Book first published in the United States in 1907, before 1929; the author died in 1922. Public domain in the United States.", reuse="public domain in the United States (published before 1929)",
      segs=[("The bureau assumed, in short, a general guardianship", "characterized almost uniformly by moderation and good judg¬ ment."), ("Hence the working of the bureau", "before their former slaves.")],
      fixes=[("r6le", "rôle"), ("judg¬ ment", "judgment"), ("oppres¬ sive", "oppressive")],
      modified="excerpted (two segments joined by [...]); whitespace normalized; OCR corrections only: 'r6le' to 'rôle', and line-break hyphenations 'judg¬ ment' and 'oppres¬ sive' rejoined; no other wording changed",
      notes="Dunning's interpretation (the 'Dunning School') was the dominant scholarly account of Reconstruction in 1907 and treats the Bureau largely from the white Southern point of view."),
 dict(id="txt-dubois-1910", file="dubois.txt", kind="txt", type="secondary_text", title="Reconstruction and Its Benefits (excerpt on the Freedmen's Bureau)",
      author="W. E. Burghardt Du Bois (Atlanta University); paper read at the American Historical Association, December 1909", year="1910 (American Historical Review, vol. 15, July 1910, pp. 781-799)", repository="Internet Archive (JSTOR Early Journal Content, item jstor-1836959)", url="https://archive.org/details/jstor-1836959",
      rights="Journal article first published in the United States in 1910, before 1929; JSTOR releases it free of restrictions as Early Journal Content. Public domain in the United States.", reuse="public domain in the United States (published before 1929)",
      segs=[("The Freedmen's Bureau was an attempt to establish a gov- ernment guardianship", "but it was repudiated."), ("It must not be forgotten that among the agents of the Freedmen's Bureau", "Ware and Cravath.")],
      fixes=[("gov- ernment", "government"), ("physi- cally", "physically"), ("social- istic", "socialistic"), ("educa- tional", "educational")],
      modified="excerpted (two segments joined by [...]); whitespace normalized; line-break hyphenations 'gov- ernment', 'physi- cally', 'social- istic' and 'educa- tional' rejoined; no other wording changed",
      notes="Du Bois delivered the paper to the American Historical Association; he argued against the Dunning interpretation, which he knew from Dunning's own audience."),
 dict(id="txt-eo9835-1947", file="eo.html", kind="html", type="primary_text", title="Executive Order 9835, Prescribing Procedures for the Administration of an Employees Loyalty Program in the Executive Branch of the Government (excerpts)",
      author="Harry S. Truman, President of the United States", year="1947 (March 21)", repository="Harry S. Truman Library and Museum (National Archives and Records Administration)", url="https://www.trumanlibrary.gov/library/executive-orders/9835/executive-order-9835",
      rights=USGOV_RIGHTS + " Executive orders are official acts of the President.", reuse="public domain (U.S. government work)",
      segs=[("WHEREAS, although the loyalty of by far the overwhelming majority", "afforded the loyal employees of the Government:"), ("There shall be a loyalty investigation of every person entering", "executive branch of the Federal Government."), ("Membership in, affiliation with or sympathetic association", "by unconstitutional means.")],
      modified="excerpted (three segments joined by [...]: part of the preamble, the first provision of the order on applicants, and the clause on membership in organizations from the section on standards); whitespace normalized; no wording changed",
      notes="Issued March 21, 1947, nine days after the Truman Doctrine speech; created loyalty review boards in every executive agency; the Attorney General's list of 'subversive' organizations was published beginning in December 1947."),
 dict(id="txt-smith-1950", file="smith.pdf", kind="pdf", type="primary_text", title="Declaration of Conscience (excerpts)",
      author="Margaret Chase Smith, U.S. Senator from Maine (Republican)", year="1950 (June 1)", repository="U.S. Senate, Office of Art & History (from the Congressional Record, 81st Congress, 2nd Session)", url="https://www.senate.gov/artandhistory/history/resources/pdf/SmithDeclaration.pdf",
      rights="Speech delivered on the floor of the U.S. Senate and printed in the Congressional Record (official publication of the U.S. government; 17 U.S.C. 105).", reuse="public domain (U.S. government work)",
      segs=[("It is a national feeling of fear and frustration", "of our government."), ("I think that it is high time that we remembered that the Constitution", "life of a person has been ruined."), ("The American people are sick and tired of being afraid", "not exercised by others.")],
      modified="excerpted (three segments joined by [...]); text extracted from the Senate's PDF by code and whitespace normalized; no wording changed",
      notes="Delivered in the Senate on June 1, 1950, four months after Senator Joseph McCarthy's Wheeling, West Virginia, speech; six other Republican senators signed it."),
 dict(id="txt-survival-1950", file="sua.txt", kind="txt", type="primary_text", title="Survival Under Atomic Attack (excerpt), NSRB Document 130",
      author="Executive Office of the President, National Security Resources Board, Civil Defense Office", year="1950 (U.S. Government Printing Office; sold at 10 cents)", repository="Internet Archive (scan of the 1950 U.S. Government Printing Office booklet; item survivalunderatomicattack.1950)", url="https://archive.org/details/survivalunderatomicattack.1950",
      rights="Publication of the Executive Office of the President printed by the U.S. Government Printing Office in 1950 (U.S. government work, 17 U.S.C. 105).", reuse="public domain (U.S. government work)",
      segs=[("The secrets of survival are:", "ESCAPE THEM."), ("To begin with, you must realize that atom¬ splitting", "much better than you may have thought.")],
      fixes=[("atom¬ splitting", "atom-splitting"), ("explo¬ sion", "explosion")],
      modified="excerpted (two segments joined by [...]); text taken from the Internet Archive OCR and whitespace normalized; line-break hyphenations restored ('atom¬ splitting' as 'atom-splitting', 'explo¬ sion' as 'explosion'); no other wording changed",
      notes="A 32-page civil defense booklet issued under the National Security Resources Board in 1950; the Federal Civil Defense Administration was created in January 1951."),
 dict(id="txt-ndea-1958", file="ndea.pdf", kind="pdf", type="primary_text", title="National Defense Education Act of 1958, Section 101: Findings and Declaration of Policy (excerpts)",
      author="Congress of the United States (Eighty-Fifth Congress), Public Law 85-864", year="1958 (September 2)", repository="U.S. Government Publishing Office (GovInfo), United States Statutes at Large, vol. 72, p. 1580", url="https://www.govinfo.gov/content/pkg/STATUTE-72/pdf/STATUTE-72-Pg1580.pdf",
      rights=USGOV_RIGHTS + " Public laws are not subject to copyright.", reuse="public domain (U.S. government work)",
      segs=[("The Congress hereby finds and declares that the security of the Nation", "complex scientific principles."), ("We must increase our efforts to identify and educate more of the talent of our Nation.", "trained in technology."), ("The Congress reaffirms the principle", "important to our defense.")],
      fixes=[("ujjon", "upon")],
      modified="excerpted (three segments joined by [...]); text extracted from the GovInfo statute PDF by code and whitespace normalized; one OCR error corrected ('ujjon' to 'upon'); no other wording changed",
      notes="Passed eleven months after the Soviet Union launched Sputnik (October 1957)."),
 dict(id="txt-eisenhower-1961", file="ike.html", kind="html", type="primary_text", title="Farewell Address to the Nation (excerpt)",
      author="Dwight D. Eisenhower, President of the United States", year="1961 (January 17)", repository="Avalon Project, Yale Law School (transcription)", url="https://avalon.law.yale.edu/20th_century/eisenhower001.asp",
      rights="Presidential address delivered in an official capacity (U.S. government work, 17 U.S.C. 105).", reuse="public domain (U.S. government work)",
      segs=[("This conjunction of an immense military establishment", "prosper together.")], fixes=[("militaryindustrial", "military-industrial")],
      modified="excerpted (one contiguous passage); whitespace normalized; the transcription's 'militaryindustrial' (lost hyphen) restored as 'military-industrial'; no other wording changed",
      notes="Delivered by television and radio three days before the end of Eisenhower's second term."),
]

def build_text(d):
    text = read_html(d["file"]) if d["kind"] == "html" else read_pdf(d["file"]) if d["kind"] == "pdf" else read_txt(d["file"])
    segs = []
    for a, b in d["segs"]:
        s = cut(text, a, b)
        for x, y in d.get("fixes", []): s = s.replace(x, y)
        if "¬" in s or "_" in s: raise SystemExit(f"{d['id']}: unresolved OCR marker in excerpt: {s[:120]}")
        segs.append(s)
    joined = " [...] ".join(segs); words = len(joined.replace(" [...] ", " ").split())
    return dict(id=d["id"], type=d["type"], title=d["title"], author=d["author"], year=d["year"], repository=d["repository"], url=d["url"], call_number=d.get("call_number", ""),
             rights_statement=d["rights"], reuse_basis=d["reuse"], modified=d["modified"], retrieved=TODAY, origin="real_historical_source", excerpt_segments=segs, excerpt_words=words,
             sha256=sha(joined.encode("utf-8")), hash_of="excerpt segments joined with ' [...] ' (UTF-8)", notes=d.get("notes", ""))

# ── 표: OMB Historical Table 3.1 (Outlays by Superfunction and Function), 선택 연도 ──
def build_table():
    z = zipfile.ZipFile(os.path.join(SRC, "t4-1.xlsx")); ss = []
    s = z.read("xl/sharedStrings.xml").decode()
    for si in re.findall(r"<si>(.*?)</si>", s, flags=re.S): ss.append(html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, flags=re.S))))
    sh = z.read("xl/worksheets/sheet1.xml").decode(); rows = {}
    for r, body in re.findall(r'<row [^>]*r="(\d+)"[^>]*>(.*?)</row>', sh, flags=re.S):
        cells = {}
        for a, b in re.findall(r"<c ([^>]*?)(?:/>|>(.*?)</c>)", body, flags=re.S):
            v = re.search(r"<v>(.*?)</v>", b or "")
            if not v: continue
            v = v.group(1); v = ss[int(v)] if 't="s"' in a else v
            cells[re.search(r'r="([A-Z]+)', a).group(1)] = v
        rows[int(r)] = cells
    assert rows[1]["A"].startswith("Table 3.1 - OUTLAYS BY SUPERFUNCTION"), rows[1]
    hdr = rows[2]; col = {hdr[c]: c for c in hdr if re.fullmatch(r"\d{4}", hdr[c])}
    # 행 확인(이름으로 찾는다: 금액 표의 첫 'National Defense', 'Total, Federal outlays', 백분율 표의 'National defense')
    amt_def = next(r for r in sorted(rows) if rows[r].get("A") == "National Defense")
    amt_tot = next(r for r in sorted(rows) if rows[r].get("A") == "Total, Federal outlays")
    pct_def = next(r for r in sorted(rows) if rows[r].get("A") == "National defense" and r > amt_tot)
    out = []
    for y in ("1946", "1948", "1950", "1952", "1954", "1956", "1958", "1960", "1962"):
        d = int(float(rows[amt_def][col[y]])); t = int(float(rows[amt_tot][col[y]])); p = float(rows[pct_def][col[y]])
        assert abs(100 * d / t - p) < 0.06, (y, d, t, p)  # 표의 백분율이 금액에서 다시 계산한 값과 같은지
        out.append([y, f"{d:,}", f"{t:,}", f"{p:.1f}"])
    return {"columns": ["Fiscal year", "National defense outlays (millions of dollars)", "Total federal outlays (millions of dollars)", "National defense as a percent of total outlays"], "rows": out}

def table_entry(tab, x_sha):
    return dict(id="stat-defense-outlays-1946-1962", type="statistic_table", title="Federal outlays for national defense and in total, selected fiscal years 1946-1962", author="Office of Management and Budget, Historical Tables (Table 3.1, Outlays by Superfunction and Function)",
        year="1946-1962 fiscal-year figures (tables compiled for the Budget of the U.S. Government, Fiscal Year 2025)", repository="U.S. Government Publishing Office (GovInfo), Budget of the United States Government, Fiscal Year 2025, Historical Tables", url="https://www.govinfo.gov/content/pkg/BUDGET-2025-TAB/xls/BUDGET-2025-TAB-4-1.xlsx", call_number="Table 3.1 (file BUDGET-2025-TAB-4-1.xlsx)",
        rights_statement="Publication of the Executive Office of the President (U.S. government work, 17 U.S.C. 105); GovInfo distributes it without copyright restriction.", reuse_basis="public domain (U.S. government work)",
        modified="nine fiscal years (1946, 1948, 1950, 1952, 1954, 1956, 1958, 1960, 1962) chosen from the table; the 'National Defense' and 'Total, Federal outlays' rows (millions of dollars) and the 'National defense' percent-of-outlays row copied by code; each percent was recomputed from the two dollar rows and agreed to within rounding",
        retrieved=TODAY, origin="real_historical_source", table=tab, sha256=table_hash(tab), hash_of="canonical JSON of table (sorted keys, compact separators, UTF-8)",
        notes=f"Source workbook sha256 {x_sha}. The budget year runs through 1976 from July 1 to June 30 (fiscal years); figures are current (not inflation-adjusted) dollars, and they were published in a later budget than the period they describe.")

def build_image():
    g = open(os.path.join(SRC, "cuba.gif"), "rb").read(); png_path = os.path.join(SRC, "cuba.png")
    subprocess.run(["sips", "-s", "format", "png", os.path.join(SRC, "cuba.gif"), "--out", png_path], check=True, capture_output=True)
    b = open(png_path, "rb").read(); w, h = int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")
    assert b[:8] == b"\x89PNG\r\n\x1a\n" and w <= 1600 and h <= 1600 and len(b) < 1_500_000, (w, h, len(b))
    e = dict(id="img-mrbm-san-cristobal-1962", type="photograph", title="Photograph of MRBM Field Launch Site No. 2 in San Cristobal, Cuba, 14 October 1962", author="Department of Defense (high-altitude aerial reconnaissance photograph)", year="1962 (October 14)",
             repository="National Archives and Records Administration (John F. Kennedy Library collection), via Wikimedia Commons file page (contributed through the Digital Public Library of America)", url="https://commons.wikimedia.org/wiki/File:Photograph_of_MRBM_Field_Launch_Site_No._2_in_San_Cristobal,_Cuba,_14_October_1962_-_DPLA_-_46c5a1f6a35d08aaa73208f96901a46f.gif", call_number="DPLA ID 46c5a1f6a35d08aaa73208f96901a46f",
             rights_statement="Commons file page: 'Copyright determination made by National Archives and Records Administration using RightsStatements.org No Copyright - United States'; license tag Public domain (PD US); creator Department of Defense (U.S. government work).", reuse_basis="public domain (U.S. government work; National Archives 'No Copyright - United States')",
             modified="converted by code from the repository's 600 x 505 GIF to PNG (no other change; labels on the photograph are the original annotations)", retrieved=TODAY, origin="real_historical_source",
             file="files/img-mrbm-san-cristobal-1962/image.png", public_path="ap-sources/img-mrbm-san-cristobal-1962/image.png", sha256=sha(b), bytes=len(b), width=w, height=h,
             alt="A black-and-white aerial reconnaissance photograph of wooded and open countryside with a white label at the upper left reading MRBM Field Launch Site, San Cristobal No 2, 14 October 1962; small white captions mark tents, equipment, a convoy, and six missile trailers along a road.",
             credit="Photograph of MRBM Field Launch Site No. 2 in San Cristobal, Cuba, 14 October 1962. Department of Defense; National Archives and Records Administration (John F. Kennedy Library). No Copyright - United States.",
             notes=f"Original GIF sha256 {sha(g)}. The annotations on the print (captions for tents, equipment, convoy and missile trailers) were added by the U.S. government analysts, not by ALTON.")
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
    tab = build_table(); xs = sha(open(os.path.join(SRC, "t4-1.xlsx"), "rb").read())
    te = table_entry(tab, xs); new.append(te); extra[te["id"]] = ("table.json", json.dumps(tab, indent=1).encode("utf-8")); print(json.dumps(tab["rows"]))
    ie, ib = build_image(); new.append(ie); print(f"{ie['id']}: {ie['width']}x{ie['height']} {ie['bytes']} bytes")
    if CHECK: return
    byid = {s["id"]: s for s in reg["sources"]}
    for e in new: byid[e["id"]] = e
    order = [s["id"] for s in reg["sources"]] + [e["id"] for e in new if e["id"] not in {s["id"] for s in reg["sources"]}]
    reg["sources"] = [byid[i] for i in order]; reg["generated"] = TODAY
    json.dump(reg, open(reg_path, "w"), indent=1, ensure_ascii=False); open(reg_path, "a").write("\n")
    for e in new:
        d = f"data/ap/ush-sources/files/{e['id']}"; os.makedirs(d, exist_ok=True)
        if e["id"] in extra: open(f"{d}/{extra[e['id']][0]}", "wb").write(extra[e["id"]][1])
        if e["id"] == ie["id"]:
            open(f"{d}/image.png", "wb").write(ib); pd = f"public/ap-sources/{e['id']}"; os.makedirs(pd, exist_ok=True); shutil.copyfile(f"{d}/image.png", f"{pd}/image.png")
        open(f"{d}/SOURCE.md", "w").write(source_md(e))
    print(f"registry: {len(reg['sources'])} sources")
main()
