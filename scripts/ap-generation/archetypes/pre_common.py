"""AP Precalculus 원형 공통 도구(2026-10-20, 신규 과목 첫 라운드). 정답·표·그림 수치는 코드가 두 경로(sympy 기호 vs numpy/scipy 수치·표본 검사)로 계산한다.
규칙: 선택지는 서로 다른 값(표현식 선택지는 표본점 수치로 서로 동치가 아님을 확인), 오답은 이름 붙은 오개념, 학생이 풀 값은 모두 본문·표·그래프에 둔다.
시험 형식(MC 42 = 파트 A 29 계산기 불가 + 파트 B 13 그래핑 계산기 필수; FRQ 4)은 AP Central 시험 페이지에서 확인(docs/ap/precalculus-groundwork.md).
스킬: 1 Procedural and Symbolic Fluency, 2 Multiple Representations, 3 Communication and Reasoning(MC 는 1·2 위주)."""
import math  # noqa: F401
import random  # noqa: F401
from fractions import Fraction as Fr  # noqa: F401
import numpy as np  # noqa: F401
import sympy as sp  # noqa: F401
from scipy import optimize as _O  # noqa: F401
from common import Opt, pack  # noqa: F401
from bp import mc_blueprint, frq_blueprint  # noqa: F401
from phys_common import pick, forever, retry_sep, agree, gaxis, dense_graph_stim, graph_stim, sentence_options  # noqa: F401

SUBP = "ap_precalculus"
MIN_REL_SEP = 0.06
xs_, ts_ = sp.symbols("x t", real=True)
X = xs_


def tx(e):
    """sympy 식 또는 수 -> $...$"""
    return "$" + (sp.latex(sp.nsimplify(e) if isinstance(e, (int, float)) and float(e).is_integer() else e)).replace("\\log", "\\ln") + "$"


def L(e):
    return sp.latex(e).replace("\\log", "\\ln")


def dec(v, n=3):
    """십진수 -> $1.234$ (끝의 0 유지, -0 방지)"""
    s = f"{v:.{n}f}"
    if float(s) == 0:
        s = f"{0:.{n}f}"
    return "$" + s + "$"


def sg(v, n=3):
    """유효숫자 n 자리 문자열"""
    if v == 0:
        return "0"
    d = n - int(math.floor(math.log10(abs(v)))) - 1
    r = round(v, d)
    return f"{r:.{max(d, 0)}f}"


def num_options(key_val, pairs, f=None, n=3, tol=MIN_REL_SEP):
    """수 선택지: key_val 정답, pairs=[(오개념 설명, 값)]. 서로 tol 이상 떨어진 3개를 고른다."""
    f = f or (lambda v: dec(v, n))
    key = Opt(f(key_val), True, "", key_val)
    chosen = [key_val]
    ds = []
    for why, v in pairs:
        if v is None or not math.isfinite(v):
            continue
        if any(abs(v - c) <= tol * max(abs(c), abs(v), 1e-9) for c in chosen):
            continue
        if f(v) == key.text or f(v) in [d.text for d in ds]:
            continue
        chosen.append(v)
        ds.append(Opt(f(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds


def expr_options(key_expr, pairs, probe=None):
    """식 선택지: 서로 수치적으로 동치가 아닌지 표본점에서 확인한다(동치면 제외)."""
    pts = probe or [0.37, 1.21, 1.9, 2.63, 3.4]
    fk = sp.lambdify(X, key_expr, "math")

    def vec(e):
        f = sp.lambdify(X, e, "math")
        out = []
        for p in pts:
            try:
                out.append(float(f(p)))
            except Exception:
                out.append(float("nan"))
        return out
    seen = [vec(key_expr)]
    key = Opt(tx(key_expr), True, "", None)
    ds = []
    for why, e in pairs:
        v = vec(e)
        if any(all((a == b) or (math.isfinite(a) and math.isfinite(b) and abs(a - b) < 1e-7) or (math.isnan(a) and math.isnan(b)) for a, b in zip(v, s)) for s in seen):
            continue
        if tx(e) == key.text or tx(e) in [d.text for d in ds]:
            continue
        seen.append(v)
        ds.append(Opt(tx(e), False, why, None))
    del fk
    if len(ds) < 3:
        raise ValueError("not_enough_distinct_expressions")
    return key, ds


def text_options(key_text, key_why, wrongs):
    """고정 문장·수식 문자열 선택지: 정답 1 + 이름 붙은 오개념. wrongs: [(문자열, 오개념 설명)]."""
    seen = {key_text}
    ds = []
    for t, w in wrongs:
        if t in seen:
            continue
        seen.add(t)
        ds.append(Opt(t, False, w, None))
    if len(ds) < 3:
        raise ValueError("not_enough_distinct_text_options")
    return Opt(key_text, True, key_why, None), ds


_COND = [("the model assumptions stated in the stem hold", "the stem states the function and its domain explicitly")]


def MQ(arch, topic, skill, calc, stem, key, ds, rng, concept, think, path, why, facts, stim=None, est=90, mat=None, cond=None):
    """원형 한 문항 팩. 설계도의 오개념은 화면에 나온 오답 선택지에서 만든다."""
    if why:  # 정답 해설은 항상 구체적 풀이(수치 포함)로 둔다: 일반적 힌트 문구는 검토기가 '해설 아님'으로 반려한다(2026-10-20 pre-mc 실측)
        key.why = why
    p = pack(arch, topic, skill, calc, stem, key, ds, rng, stimulus=stim, est=est, facts=facts or [])
    shown = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown)]
    p["blueprint"] = mc_blueprint(arch, SUBP, topic, skill, calc, concept, think, cond or _COND, mis, path, material=mat or {"type": "none", "must_include": []},
                                  method="sympy symbolic + independent numeric path", extra={"judgment_demand": ["representation_reading", "symbolic_reasoning"]})
    return p


MAT_NONE = {"type": "none", "must_include": []}
MAT_TABLE = lambda *inc: {"type": "table", "must_include": list(inc)}  # noqa: E731
MAT_GRAPH = lambda *inc: {"type": "graph", "must_include": list(inc)}  # noqa: E731


def table_stim(desc, xlabel, ylabel, rows):
    return {"kind": "table", "description": desc, "data": {"x_label": xlabel, "y_label": ylabel, "rows": [[str(a), str(b)] for a, b in rows]}}


def fn_graph(desc, fn, lo, hi, xax, yax, n=161):
    """연속 함수 그래프 stimulus(점 n 개 꺾은선)."""
    return dense_graph_stim(desc, fn, lo, hi, xax, yax, n=n)


def poly_tex(coefs, var="x"):
    """계수 목록(고차 -> 저차) -> 다항식 tex"""
    n = len(coefs) - 1
    s = ""
    for i, c in enumerate(coefs):
        p = n - i
        if c == 0:
            continue
        a = abs(c)
        body = ("" if (a == 1 and p > 0) else (f"{a:g}")) + (var if p > 0 else "") + (f"^{{{p}}}" if p > 1 else "")
        s += (" - " if c < 0 else (" + " if s else "")) + body
    return s.lstrip() if s else "0"


def expo_fit(xs, ys):
    """독립 수치 경로: ln y 에 대한 최소제곱으로 y=a*b^x 적합."""
    A = np.vstack([xs, np.ones(len(xs))]).T
    m, c = np.linalg.lstsq(A, np.log(ys), rcond=None)[0]
    return float(math.exp(c)), float(math.exp(m))


def solve_all(f, lo, hi, n=4000):
    """구간에서 f=0 의 모든 근(부호 변화 + brentq)."""
    xs = np.linspace(lo, hi, n)
    ys = [f(v) for v in xs]
    out = []
    for i in range(n - 1):
        if ys[i] == 0:
            out.append(float(xs[i]))
        elif ys[i] * ys[i + 1] < 0:
            out.append(float(_O.brentq(f, xs[i], xs[i + 1], xtol=1e-13)))
    return out


def rat(v):
    """수 -> 정확한 유리수 sympy"""
    f = Fr(v).limit_denominator(10000)
    return sp.Rational(f.numerator, f.denominator)


def rat_tex(v):
    return tx(rat(v))
