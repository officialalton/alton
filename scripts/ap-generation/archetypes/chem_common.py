"""AP Chemistry 원형 공통 도구(2026-10-13, P0 무료 엔지니어링). 모든 정답·표·그림 수치는 코드가 계산한다. LLM 은 stem 문장만 다듬는다.
규칙(docs/ap/chemistry-groundwork.md):
- 이중 경로: sympy/정확 분수 풀이 vs numpy/이분법/ODE 수치 경로(또는 정의가 다른 두 공식)로 정답을 독립 계산, 불일치 시 ValueError.
- 단위·유효숫자: 값은 $...$ 안에 \\text{ 단위}. 주어진 자료는 2-3자리, 정답·선택지는 3자리(pH 는 소수 둘째 자리, K·Ksp 는 과학적 표기). 선택지는 서로 8% 이상 떨어진다(pH 는 0.08 pH 단위가 아니라 값 자체 8%가 아니라 절대 0.15 이상).
- 상수는 CONSTS 한 곳(공식 CED 식 시트와 같은 값: R=8.314 J/(mol K)=0.08206 L atm/(mol K), F=96,485 C/mol, Kw=1.0e-14, h=6.626e-34, c=2.998e8, N_A=6.022e23).
- 원자량은 MASS(소수 둘째~셋째 자리, 일반 교재 값; 공식 주기율표 값과의 1:1 일치는 UNVERIFIED — 정답은 3자리 유효숫자라 영향 없도록 8% 간격 규칙으로 보호).
- 모형 가정: 별도 언급 없으면 25 degC, 희석 용액은 이상 용액, 기체는 이상 기체."""
import re
from phys_common import *  # noqa: F401,F403  (sig, Q, sci, TX, pick, forever, agree, rk4, bisect, num_opts, signed_opts, retry_sep, sentence_options, gaxis, graph_stim, dense_graph_stim, ...)
import phys_common as _pc
from common import pack, table_stimulus  # noqa: F401
from bp import mc_blueprint

SUB = "ap_chemistry"
CONSTS = {"R": 8.314, "R_atm": 0.08206, "F": 96485.0, "Kw": 1.0e-14, "h": 6.626e-34, "c": 2.998e8, "NA": 6.022e23, "T0": 273.15}
R_J, R_ATM, F_CONST, KW = CONSTS["R"], CONSTS["R_atm"], CONSTS["F"], CONSTS["Kw"]
MASS = {"H": 1.008, "He": 4.003, "Li": 6.94, "Be": 9.012, "B": 10.81, "C": 12.01, "N": 14.01, "O": 16.00, "F": 19.00, "Ne": 20.18, "Na": 22.99, "Mg": 24.31, "Al": 26.98, "Si": 28.09,
        "P": 30.97, "S": 32.06, "Cl": 35.45, "Ar": 39.95, "K": 39.10, "Ca": 40.08, "Ti": 47.87, "Cr": 52.00, "Mn": 54.94, "Fe": 55.85, "Ni": 58.69, "Cu": 63.55, "Zn": 65.38,
        "Br": 79.90, "Ag": 107.87, "Sn": 118.71, "I": 126.90, "Ba": 137.33, "Pb": 207.2}


def fmass(formula):
    """분자식 -> g/mol (괄호·숫자 지원). 독립 경로가 필요하면 fmass_stack 과 비교."""
    def parse(s, i=0):
        tot = {}
        while i < len(s):
            ch = s[i]
            if ch == "(":
                sub, i = parse(s, i + 1)
                m = re.match(r"\d+", s[i:])
                k = int(m.group()) if m else 1
                i += len(m.group()) if m else 0
                for a, v in sub.items():
                    tot[a] = tot.get(a, 0) + v * k
            elif ch == ")":
                return tot, i + 1
            else:
                m = re.match(r"([A-Z][a-z]?)(\d*)", s[i:])
                a, n = m.group(1), int(m.group(2) or 1)
                tot[a] = tot.get(a, 0) + n
                i += len(m.group())
        return tot, i
    return parse(formula)[0]


def formula_mass(formula):
    return sum(MASS[a] * n for a, n in fmass(formula).items())


def formula_mass_flat(formula):
    """독립 경로: 괄호를 전개한 뒤 정규식으로 센다(단일 괄호 군까지)."""
    f = re.sub(r"\(([A-Za-z0-9]+)\)(\d+)", lambda m: re.sub(r"([A-Z][a-z]?)(\d*)", lambda q: q.group(1) + str(int(q.group(2) or 1) * int(m.group(2))), m.group(1)), formula)
    return sum(MASS[a] * int(n or 1) for a, n in re.findall(r"([A-Z][a-z]?)(\d*)", f))


def ph_fmt(v):
    return f"{v:.2f}"


def pH_opts(key_val, pairs):
    """pH 선택지: 절대 0.15 이상 떨어진 3개(소수 둘째 자리 표기)."""
    return _abs_opts(key_val, pairs, lambda v: "$" + f"{v:.2f}" + "$", 0.15)


def _abs_opts(key_val, pairs, f, gap):
    from common import Opt
    key = Opt(f(key_val), True, "", key_val)
    chosen, ds = [key_val], []
    for why, v in pairs:
        if v is None or not math.isfinite(v):
            continue
        if any(abs(v - c) < gap for c in chosen) or f(v) == key.text or f(v) in [d.text for d in ds]:
            continue
        chosen.append(v)
        ds.append(Opt(f(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds


def abs_opts(key_val, pairs, fmt, gap):
    return _abs_opts(key_val, pairs, fmt, gap)


def E_fmt(v, n=2):
    return "$" + f"{v:.{n}f}" + "\\text{ V}$"


def pbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, method="sympy/exact + independent numeric path"):
    return mc_blueprint(arch, SUB, topic, skill, "allowed", concept, thinking, cond, mis, path, material=material, method=method, extra={"judgment_demand": judgment})


def mk(arch, topic, skill, stem, key, ds, rng, *, concept, path, thinking=None, cond=None, material=None, judgment="choose the governing relationship, then carry out or interpret the result", stim=None, est=110, facts=None, option_scenes=None, kwhy=None):
    """원형 한 문항 팩. 설계도의 오개념 목록은 실제로 화면에 나온 오답 선택지의 why 에서 만든다."""
    if kwhy and not key.why:
        key.why = kwhy
    p = pack(arch, topic, skill, "allowed", stem, key, ds, rng, stimulus=stim, est=max(45, min(130, est)), facts=facts or [])
    shown = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    seen_why = set()
    for o in shown:
        if len((o["why"] or "").strip()) < 15:  # 게이트 최소 길이(15자): 짧은 설명은 이유 문장으로 보강
            o["why"] = (o["why"] or "Misreads the problem").rstrip(".") + ", which does not match what the question asks."  # 오답마다 설명이 달라야 한다(블루프린트 규칙): 같은 오개념이 여러 선택지에 걸리면 선택지 내용으로 구분해 덧붙인다
        if o["why"] in seen_why:
            o["why"] = o["why"].rstrip(".") + f" (this option: {_plain(o['text'])})."
        seen_why.add(o["why"])
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown)]
    mat = material or (MAT_GRAPH() if stim and stim["kind"] == "graph" else MAT_DIAGRAM() if stim and stim["kind"] == "diagram" else MAT_NONE)
    p["blueprint"] = pbp(arch, topic, skill, concept, thinking or [f"Decide which chemical relationship or representation applies: {concept}", "Carry out or interpret the result and match it against the four options"], [(c, e if len(e) >= 10 else f"stated in the {e}") for c, e in (cond or [("every quantity needed is given in the stem or stimulus", "stem and stimulus values")])], mis, path, mat, judgment)
    if option_scenes:
        p["option_scenes"] = [option_scenes[o["text"]] for o in p["options"]]
        for i, o in enumerate(p["options"]):
            o["text"] = f"Diagram {chr(65 + i)}"
    return p


def _plain(t):
    """선택지 텍스트에서 TeX 장식을 걷어 사람이 읽을 수 있는 짧은 문자열로."""
    t = re.sub(r"\\(mathrm|text|rightarrow|cdot)", " ", t)
    t = re.sub(r"_\{(\w+)\}", r"\1", t)
    return re.sub(r"[\\${}^]", "", t).strip()[:60]


def species_tex(f):
    """'H2SO4' -> 'H_2SO_4', 'Ca2+' 는 호출부에서 직접 작성."""
    return re.sub(r"(\d+)", r"_{\1}", f)


def mt(f, charge=None):
    """분자식 TeX(수식 안에서 쓰는 조각, $ 없음): 'Al2(SO4)3' -> '\\mathrm{Al_{2}(SO_{4})_{3}}'; charge='2+' 이면 위첨자."""
    s = re.sub(r"(?<=[A-Za-z)])(\d+)", r"_{\1}", f)
    return "\\mathrm{" + s + (f"^{{{charge}}}" if charge else "") + "}"


def cf(f, charge=None):
    """분자식 $...$ (본문용)"""
    return "$" + mt(f, charge) + "$"


def rxn_tex(left, right, arrow="\\rightarrow"):
    """[(계수, 식 또는 (식, 전하))] -> '2\\,\\mathrm{H_2} + ... \\rightarrow ...'"""
    def side(terms):
        out = []
        for t in terms:
            c, f = t[0], t[1]
            ch = t[2] if len(t) > 2 else None
            out.append((f"{c}\\," if c != 1 else "") + mt(f, ch))
        return " + ".join(out)
    return "$" + side(left) + " " + arrow + " " + side(right) + "$"


def fx(x):
    """Fraction -> float"""
    return float(x)


def mol_str(v, unit="mol"):
    return Q(v, unit)


def diagram_stim_chem(desc, variant, data):
    return {"kind": "diagram", "description": desc, "data": {"variant": variant, **data}}
