"""AP Biology 원형 공통 도구(2026-10-13, P0 무료 엔지니어링). 수치·표·그림 자료는 전부 코드가 계산하고, LLM 은 stem 문장만 다듬는다(AP_FIXED_WORDING).
규칙(docs/ap/biology-groundwork.md):
- 계산형 원형: 정답을 두 경로(정의가 다른 두 공식 / sympy 정확 분수 vs numpy·시뮬레이션·전수 열거)로 독립 계산하고 불일치 시 ValueError.
- 개념형 원형: 고정 문장 선택지(정답 1 + 이름 붙은 오개념 3). 시나리오 은행(bank)에서 시드로 하나를 고른다. 은행 항목은 CED 학습 목표에 맞춘 사실이며 오답 문장은 서로 다른 오개념이다(개념 정확성은 코드로 증명되지 않음 → Opus 독립 풀이·검토가 확인).
- 공식 식 시트(CED Appendix V.1 p.230–231)에 있는 식만 쓴다: 평균·표준편차·SE, 카이제곱(+임계값 표), 확률 법칙, 하디–바인베르크, 속도·개체군 증가(지수·로지스틱)·수분 퍼텐셜(Ψ=Ψ_P+Ψ_S, Ψ_S=-iCRT, R=0.0831)·심프슨 다양도·표면적·부피.
- 계산기는 4칙·공학용·그래핑 허용(CED p.197)."""
import re
import sys
from phys_common import *  # noqa: F401,F403  (sig, Q, TX, pick, forever, agree, rk4, bisect, num_opts, signed_opts, retry_sep, sentence_options, gaxis, graph_stim, ...)
from common import pack, Opt  # noqa: F401
from bp import mc_blueprint
from stats_common import stat_stim  # noqa: F401

SUB = "ap_biology"
R_BAR = 0.0831  # liter bars / (mole K) — 공식 식 시트
CHI_CRIT = {0.05: {1: 3.84, 2: 5.99, 3: 7.81, 4: 9.49, 5: 11.07, 6: 12.59, 7: 14.07, 8: 15.51}, 0.01: {1: 6.63, 2: 9.21, 3: 11.34, 4: 13.28, 5: 15.09, 6: 16.81, 7: 18.48, 8: 20.09}}

MAT_NONE = {"type": "none", "must_include": []}
MAT_TABLE = lambda *inc: {"type": "table", "must_include": list(inc) or ["the table values"]}  # noqa: E731
MAT_GRAPH = lambda *inc: {"type": "graph", "must_include": list(inc) or ["the plotted values"]}  # noqa: E731
MAT_DIAGRAM = lambda *inc: {"type": "diagram", "must_include": list(inc) or ["the labeled structure"]}  # noqa: E731


def pbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, method="independent computation / fixed fact bank"):
    return mc_blueprint(arch, SUB, topic, skill, "allowed", concept, thinking, cond, mis, path, material=material, method=method, extra={"judgment_demand": judgment, "code_first": True})


def tbl(desc, columns, rows, notes=None):
    d = {"columns": columns, "rows": [[str(c) for c in r] for r in rows]}
    if notes:
        d["notes"] = notes
    return {"kind": "table", "description": desc, "data": d}


def bar_stim(desc, title, cats, series, xt, yt):
    """series: [(이름, [값…])] — ap 통계 차트(bar)."""
    return stat_stim(desc, "bar", title=title, categories=cats, series=[{"name": n, "values": v} for n, v in series], xTitle=xt, yTitle=yt)


def strand_stim(desc, top, bottom, legend=None):
    """top/bottom: (라벨, 왼쪽 끝, 오른쪽 끝, [염기…])"""
    mk_ = lambda s: {"label": s[0], "left_end": s[1], "right_end": s[2], "bases": list(s[3])}  # noqa: E731
    d = {"variant": "strand_pair", "top_strand": mk_(top), "bottom_strand": mk_(bottom)}
    if legend:
        d["legend"] = legend
    return {"kind": "diagram", "description": desc, "data": d}


def mk(arch, topic, skill, stem, key, ds, rng, *, concept, path, thinking=None, cond=None, material=None, judgment="choose the governing biological relationship, then apply or interpret it", stim=None, est=75, facts=None, kwhy=None):
    """원형 한 문항 팩. 설계도의 오개념은 실제로 화면에 나온 오답의 why 에서 만든다(오답마다 서로 다른 25자 이상 설명)."""
    if kwhy and not key.why:
        key.why = kwhy
    if not key.why:
        key.why = f"Applying the relationship to the values given in the question and the stimulus gives {re.sub(r'[$]', '', key.text)}; each other option comes from a specific, named error."
    p = pack(arch, topic, skill, "allowed", stem, key, ds, rng, stimulus=stim, est=max(45, min(130, est)), facts=facts or [])
    shown = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    seen = set()
    for o in shown:
        w = (o["why"] or "").strip()
        if len(w) < 25:
            raise ValueError("short_why")
        if w in seen:
            raise ValueError("duplicate_why")
        seen.add(w)
    if not (p["options"][p["key_index"]]["why"] or "").strip():
        raise ValueError("empty_key_why")
    lens = [len(re.sub(r"[\\${}^]", "", re.sub(r"\\(mathrm|text)", " ", o["text"])).strip()) for o in p["options"]]
    mean = sum(lens) / len(lens)
    if lens[p["key_index"]] == max(lens) and lens[p["key_index"]] > mean * 1.5 and lens[p["key_index"]] > 18:
        raise ValueError("key_much_longer")
    if min(lens) > 0 and max(lens) / min(lens) > 5 and max(lens) > 30:
        raise ValueError("options_not_parallel")
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown)]
    mat = material or (MAT_GRAPH() if stim and stim["kind"] == "graph" else MAT_TABLE() if stim and stim["kind"] == "table" else MAT_DIAGRAM() if stim and stim["kind"] in ("diagram", "stat_chart") else MAT_NONE)
    p["blueprint"] = pbp(arch, topic, skill, concept, thinking or [f"Identify the biological principle or relationship that governs the situation: {concept}", "Apply it to the information given and compare the result with the four options"],
                         [(c, e if len(e) >= 10 else f"stated in the {e}") for c, e in (cond or [("every quantity or fact needed is given in the stem or the stimulus", "stem and stimulus")])], mis, path, mat, judgment)
    return p


def bank_item(arch, topic, skill, bank, rng, *, concept, path, est=75, judgment=None, thinking=None):
    """개념형 원형: bank 의 시나리오 하나를 고른다. 항목: dict(stem, key=(문장, 이유), wrongs=[(문장, 오개념)…], stim=선택, facts=선택)."""
    sc = pick(rng, bank)
    key, ds = sentence_options(sc["key"][0], sc["key"][1], list(sc["wrongs"]))
    return mk(arch, topic, skill, sc["stem"], key, ds, rng, concept=concept, path=path, stim=sc.get("stim"), est=sc.get("est", est), facts=sc.get("facts") or [sc["stem"][:60]], judgment=judgment or "apply a biological concept to a specific case and reject plausible misconceptions", thinking=thinking)


def make_bank_archetype(arch, topic, skill, bank, concept, path, est=75, judgment=None, thinking=None):
    """모듈 전역 함수 arch(rng) 를 만든다(registry 가 모듈 전역에서 bi_* 를 찾는다)."""
    def f(rng):
        return bank_item(arch, topic, skill, bank, rng, concept=concept, path=path, est=est, judgment=judgment, thinking=thinking)
    f.__name__ = arch
    f.__doc__ = concept
    f.__module__ = sys._getframe(1).f_globals["__name__"]  # registry 는 호출한 모듈 소유의 함수만 등록한다
    return f


def B(stem, key, wrongs, stim=None, est=None, facts=None):
    d = {"stem": stem, "key": key, "wrongs": wrongs}
    if stim is not None:
        d["stim"] = stim
    if est:
        d["est"] = est
    if facts:
        d["facts"] = facts
    return d


def mean_se(vals):
    n = len(vals)
    m = sum(vals) / n
    sd = math.sqrt(sum((v - m) ** 2 for v in vals) / (n - 1))
    return m, sd, sd / math.sqrt(n)


def chi2(obs, exp):
    return sum((o - e) ** 2 / e for o, e in zip(obs, exp))


def crit(df, p=0.05):
    return CHI_CRIT[p][df]


def fnum(v, n=3):
    """표·문장용 숫자(과학적 표기 회피)."""
    return sig(v, n)


DNA_COMP = {"A": "T", "T": "A", "G": "C", "C": "G"}
RNA_COMP = {"A": "U", "T": "A", "G": "C", "C": "G"}


def comp_dna(s):
    return "".join(DNA_COMP[c] for c in s)


def revcomp(s):
    return comp_dna(s)[::-1]


CODON = {}
_B = "TCAG"
_AA = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
for _i, _a in enumerate(_B):
    for _j, _b in enumerate(_B):
        for _k, _c in enumerate(_B):
            CODON[(_a + _b + _c).replace("T", "U")] = _AA[16 * _i + 4 * _j + _k]
AA_NAME = {"F": "Phe", "L": "Leu", "S": "Ser", "Y": "Tyr", "*": "Stop", "C": "Cys", "W": "Trp", "P": "Pro", "H": "His", "Q": "Gln", "R": "Arg", "I": "Ile", "M": "Met", "T": "Thr", "N": "Asn", "K": "Lys", "V": "Val", "A": "Ala", "D": "Asp", "E": "Glu", "G": "Gly"}


def translate(mrna):
    """5'->3' mRNA 문자열(AUG 부터) -> 아미노산 3글자 목록(정지에서 멈춤)."""
    i = mrna.find("AUG")
    out = []
    while i >= 0 and i + 3 <= len(mrna):
        aa = CODON[mrna[i:i + 3]]
        if aa == "*":
            break
        out.append(AA_NAME[aa])
        i += 3
    return out


def int_opts(key_val, pairs, fmt=None):
    """정수 선택지(정확 값): 서로 다르기만 하면 된다. pairs=[(오개념 설명, 정수)]."""
    f = fmt or (lambda v: str(int(v)))
    key = Opt(f(key_val), True, "", key_val)
    chosen, ds = [key_val], []
    for why, v in pairs:
        if v is None or v in chosen or v <= 0 or f(v) == key.text:
            continue
        chosen.append(v)
        ds.append(Opt(f(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds


def val_opts(key_val, pairs, f, gap=0.0, rel=0.08):
    """값 선택지(문자열 포맷 f): 값이 서로 gap(절대) 또는 rel(상대) 이상 떨어진 3개."""
    key = Opt(f(key_val), True, "", key_val)
    chosen, ds = [key_val], []
    for why, v in pairs:
        if v is None or not math.isfinite(v):
            continue
        if any(abs(v - c) <= max(gap, rel * max(abs(c), abs(v))) for c in chosen) or f(v) == key.text or f(v) in [d.text for d in ds]:
            continue
        chosen.append(v)
        ds.append(Opt(f(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds


def ffmt(fr):
    fr = Fr(fr)
    return "0" if fr == 0 else (str(fr.numerator) if fr.denominator == 1 else f"{fr.numerator}/{fr.denominator}")


def frac_opts(key_val, pairs):
    """확률 선택지(정확 분수): 서로 다른 값 3개. pairs=[(오개념 설명, Fraction)]."""
    key = Opt(ffmt(key_val), True, "", float(key_val))
    chosen, ds = [Fr(key_val)], []
    for why, v in pairs:
        v = Fr(v)
        if v in chosen or v < 0 or v > 1:
            continue
        chosen.append(v)
        ds.append(Opt(ffmt(v), False, why, float(v)))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds
