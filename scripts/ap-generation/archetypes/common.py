"""AP 코드 우선 생성 공통 도구(2026-10-08). 모든 정답·자료 수치는 이 코드가 계산한다. LLM 은 문장만 쓴다."""
import json, math, random, re, sys
import sympy as sp

x, t, y, h = sp.symbols("x t y h")

def S(v):
    return sp.nsimplify(v, rational=True)

def fmt(v, nd=4):
    """숫자 표기(수식 모드 LaTeX 없이 $...$ 로 감싸 반환)."""
    v = sp.sympify(v)
    if v.is_Rational or v.free_symbols or (not v.is_Float and v.has(sp.pi, sp.E, sp.exp, sp.log, sp.sqrt)):
        s = sp.latex(v)
    else:
        f = float(v)
        s = ("%.*f" % (nd, f)).rstrip("0").rstrip(".") if abs(f) < 1e6 else sp.latex(v)
        if s in ("-0", ""): s = "0"
    return "$" + s + "$"

def ftxt(v, nd=4):
    return fmt(v, nd).strip("$")

def num(v):
    return float(sp.N(sp.sympify(v)))

class Opt:
    def __init__(self, text, key, why, value=None):
        self.text, self.key, self.why, self.value = text, key, why, value

def pick_options(rng, key, distractors, n_total=4):
    """key: Opt, distractors: [Opt] (순서=우선순위 아님, 무작위). 값이 같은 것·같은 텍스트 제거."""
    seen = {key.text}
    vals = [num(key.value)] if key.value is not None else []
    out = []
    pool = list(distractors)
    rng.shuffle(pool)
    for d in pool:
        if d.text in seen: continue
        if d.value is not None:
            dv = num(d.value)
            if any(abs(dv - v) < 1e-9 for v in vals): continue
            vals.append(dv)
        seen.add(d.text); out.append(d)
        if len(out) == n_total - 1: break
    if len(out) < n_total - 1:
        raise ValueError("not_enough_distinct_distractors")
    opts = [key] + out
    rng.shuffle(opts)
    return opts

def pack(archetype, topic, skill, calc, stem, key, distractors, rng, stimulus=None, est=90, facts=None, n_total=4, extra=None):
    opts = pick_options(rng, key, distractors, n_total)
    ki = [i for i, o in enumerate(opts) if o.key][0]
    p = {
        "archetype": archetype, "topic": topic, "skill": skill, "calculator": calc,
        "stem": stem, "stimulus": stimulus or {"kind": "none", "description": "", "data": {}},
        "options": [{"text": o.text, "why": o.why, "value": (None if o.value is None else str(sp.N(sp.sympify(o.value), 8)))} for o in opts],
        "key_index": ki, "est_seconds": est, "facts": facts or [],
    }
    if extra: p.update(extra)
    return p

def table_stimulus(title, xlabel, rows, ylabel, kind="table"):
    return {"kind": "table", "description": title, "data": {"x_label": xlabel, "y_label": ylabel, "rows": rows}}

def rnd(rng, lo, hi, nonzero=True):
    while True:
        v = rng.randint(lo, hi)
        if v or not nonzero: return v

def lam(e, var=x):
    return sp.lambdify(var, e, "math")

def numeric_integral(f, a, b, n=20001):
    # Simpson, 독립 수치 경로
    if n % 2 == 0: n += 1
    hh = (b - a) / (n - 1)
    s = f(a) + f(b)
    for i in range(1, n - 1):
        s += (4 if i % 2 else 2) * f(a + i * hh)
    return s * hh / 3

def close(a, b, tol=1e-6):
    return abs(float(a) - float(b)) <= tol * max(1.0, abs(float(b)))
