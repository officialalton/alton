"""AP Physics 1 원형 공통 도구(2026-10-13, P0 무료 엔지니어링). 모든 정답·표·그림 수치는 코드가 계산한다. LLM 은 stem 문장만 다듬는다.
규칙(docs/ap/physics1-groundwork.md §10):
- 이중 경로: sympy 기호 풀이 vs numpy/수치(ODE 적분·이분법·선형계 직접 풀이)로 정답을 독립 계산, 불일치 시 ValueError.
- 단위: SI. 값은 $...$ 안에 \\text{ 단위} 로 쓴다. 숫자는 유효숫자 3자리(주어진 자료는 2-3자리), 선택지는 서로 8% 이상 떨어진다(반올림 흐림 방지).
- g = 9.8 m/s^2 (CED 참조 정보 본문은 UNVERIFIED — physics1-facts.md §3 #2; 원형은 G 상수 하나만 쓰므로 한 곳에서 바꾼다).
- 모형 가정: 별도 언급 없으면 공기저항 무시, 줄·도르래·용수철 이상적(질량 없음, 늘어나지 않음)."""
import math
import re
import random  # noqa: F401
from fractions import Fraction as Fr
import numpy as np
import sympy as sp
from common import Opt, pack
from bp import mc_blueprint

SUB = "ap_physics_1"
G = 9.8  # m/s^2 — 과목 규칙 하나(UNVERIFIED vs 공식 참조 정보)
CONSTS = {"g": G, "G": 6.67e-11, "rho_water": 1000.0, "P_atm": 1.01e5}  # 참조 시트 상수(공식 본문 대조 전, 우리 규칙)
MIN_REL_SEP = 0.08


# ---------------- 표기 ----------------
def sig(v, n=3):
    """유효숫자 n 자리 문자열(과학적 표기 회피, 불필요한 0 유지)."""
    if v == 0:
        return "0"
    d = n - int(math.floor(math.log10(abs(v)))) - 1
    r = round(v, d)
    s = f"{r:.{max(d, 0)}f}"
    return s.lstrip("-") if float(s) == 0 else s


def unit_tex(unit):
    """단위 -> TeX. \\text{} 안의 ^ 는 KaTeX 가 거부하므로 지수는 text 밖으로 뺀다: m/s^2 -> \\text{ m/s}^{2}."""
    if not unit:
        return ""
    if "^" in unit:
        base, exp = unit.split("^", 1)
        return f"\\text{{ {base}}}^{{{exp}}}"
    return f"\\text{{ {unit}}}"


def Q(v, unit="", n=3):
    """수치+단위 -> $...$"""
    return "$" + sig(v, n) + unit_tex(unit) + "$"


def TX(s):
    return "$" + s + "$"


def pick(rng, seq):
    return seq[rng.randrange(len(seq))]


def forever(n=4000):
    for _ in range(n):
        yield
    raise ValueError("no_sample")


def agree(a, b, tol=1e-4, name="value"):
    if abs(float(a) - float(b)) > tol * max(1.0, abs(float(b))):
        raise ValueError(f"independent_check_failed:{name}:{a}:{b}")


# ---------------- 독립 수치 경로 ----------------
def rk4(f, y0, t0, t1, n=4000):
    """y' = f(t, y). y0 는 np.array. 상태를 t1 까지 적분해 반환."""
    h = (t1 - t0) / n
    y = np.array(y0, dtype=float)
    t = t0
    for _ in range(n):
        k1 = f(t, y); k2 = f(t + h / 2, y + h / 2 * k1); k3 = f(t + h / 2, y + h / 2 * k2); k4 = f(t + h, y + h * k3)
        y = y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); t += h
    return y


def bisect(f, lo, hi, it=200):
    flo = f(lo)
    for _ in range(it):
        mid = (lo + hi) / 2
        fm = f(mid)
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2


def trapz_exact(xs, ys):
    """구간선형 곡선의 정확한 넓이(Fraction)와 numpy 수치 적분(독립 경로)."""
    ex = sum((Fr(ys[i]) + Fr(ys[i + 1])) / 2 * (Fr(xs[i + 1]) - Fr(xs[i])) for i in range(len(xs) - 1))
    num = float(np.trapezoid(ys, xs))
    agree(float(ex), num, 1e-9, "area")
    return ex


# ---------------- 선택지 ----------------
def num_opts(key_val, pairs, unit="", n=3, fmt=None):
    """key_val 정답값, pairs=[(오개념 설명, 값)]. 서로 MIN_REL_SEP 이상 떨어진 3개를 고른다."""
    f = fmt or (lambda v: Q(v, unit, n))
    key = Opt(f(key_val), True, "", key_val)
    chosen = [key_val]
    ds = []
    for why, v in pairs:
        if v is None or not math.isfinite(v) or (v == 0 and key_val != 0) or (v < 0 < key_val):
            continue
        if any(abs(v - c) <= MIN_REL_SEP * max(abs(c), abs(v)) for c in chosen):
            continue
        if f(v) == key.text or f(v) in [d.text for d in ds]:
            continue
        chosen.append(v)
        ds.append(Opt(f(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds


def signed_opts(key_val, pairs, unit="", n=3, fmt=None):
    """num_opts 와 같지만 음수 값도 허용(부호 판단 문항). 0 은 제외, 서로 MIN_REL_SEP 이상 떨어진 3개."""
    f = fmt or (lambda v: Q(v, unit, n))
    key = Opt(f(key_val), True, "", key_val)
    chosen = [key_val]
    ds = []
    for why, v in pairs:
        if v is None or not math.isfinite(v) or v == 0:
            continue
        if any(abs(v - c) <= MIN_REL_SEP * max(abs(c), abs(v)) for c in chosen):
            continue
        if f(v) == key.text or f(v) in [d.text for d in ds]:
            continue
        chosen.append(v)
        ds.append(Opt(f(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds


def retry_sep(fn):
    """선택지 간격 부족(not_enough_separated_distractors) 이면 같은 rng 로 다시 뽑는다(결정적: 같은 시드 → 같은 결과). 시드 낭비를 줄이는 장식자."""
    import functools

    @functools.wraps(fn)
    def w(rng):
        last = None
        for _ in range(40):
            try:
                return fn(rng)
            except ValueError as e:
                if "not_enough_separated" not in str(e):
                    raise
                last = e
        raise last
    return w


def sentence_options(key_text, key_why, wrongs):
    """고정 문장 선택지: 정답 1 + 이름 붙은 오개념. wrongs: [(문장, 오개념 설명)]."""
    return Opt(key_text, True, key_why, None), [Opt(t, False, w, None) for t, w in wrongs]


# ---------------- 설계도·팩 ----------------
def pbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, method="sympy symbolic + independent numeric path"):
    return mc_blueprint(arch, SUB, topic, skill, "allowed", concept, thinking, cond, mis, path, material=material, method=method, extra={"judgment_demand": judgment})


def ppack(arch, topic, skill, stem, key, ds, rng, bpr, stim=None, est=120, facts=None, option_scenes=None):
    p = pack(arch, topic, skill, "allowed", stem, key, ds, rng, stimulus=stim, est=est, facts=facts or [], extra={"blueprint": bpr})
    if option_scenes:  # 선택지가 그림인 문항: 임시 태그(text) -> 보기 순서대로 scene 재배열 후 "Diagram A~D" 으로 라벨(정답 암시 요소 없음은 phys_figs.choice_checks 가 검증)
        p["option_scenes"] = [option_scenes[o["text"]] for o in p["options"]]
        for i, o in enumerate(p["options"]):
            o["text"] = f"Diagram {chr(65 + i)}"
    return p


def mk(arch, topic, skill, stem, key, ds, rng, *, concept, thinking, cond, path, material, judgment, stim=None, est=120, facts=None, option_scenes=None, kwhy=None):
    """원형 한 문항 팩. 설계도의 오개념 목록은 **실제로 화면에 나온** 오답 선택지의 why 에서 만든다(2026-10-13: 오답 후보가 4개 이상이면 pack 이 3개만 뽑는데,
    예전에는 뽑히지 않은 오개념까지 설계도에 남아 검토기가 '설계도의 m4 가 어떤 선택지에도 없다'며 반려했다)."""
    if kwhy and not key.why:
        key.why = kwhy
    if key.why and key.value is not None and sig(float(key.value)) not in key.why:  # 정답 해설에 계산된 값이 없으면(P1-a: '문제 그대로 반복' 반려) 값을 덧붙인다
        key.why += f" With the values given in the question, this gives {key.text}."
    p = pack(arch, topic, skill, "allowed", stem, key, ds, rng, stimulus=stim, est=est, facts=facts or [])
    shown = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown)]
    p["blueprint"] = pbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment)
    if option_scenes:  # 선택지가 그림인 문항: 임시 태그(text) -> 보기 순서대로 scene 재배열 후 "Diagram A~D" 으로 라벨(정답 암시 요소 없음은 phys_figs.choice_checks 가 검증)
        p["option_scenes"] = [option_scenes[o["text"]] for o in p["options"]]
        for i, o in enumerate(p["options"]):
            o["text"] = f"Diagram {chr(65 + i)}"
    return p


def sci(v, unit="", n=3):
    """과학적 표기: $1.30\\times10^{5}\\text{ Pa}$ (|v| >= 1e4 또는 < 1e-2 일 때)"""
    e = int(math.floor(math.log10(abs(v))))
    m = v / 10 ** e
    return "$" + sig(m, n) + f"\\times10^{{{e}}}" + unit_tex(unit) + "$"


MAT_NONE = {"type": "none", "must_include": []}
MAT_GRAPH = lambda *inc: {"type": "graph", "must_include": list(inc)}  # noqa: E731
MAT_DIAGRAM = lambda *inc: {"type": "diagram", "must_include": list(inc)}  # noqa: E731


# ---------------- 그래프 stimulus (기존 ap_graph 규약: kind graph, vertices/curves) ----------------
def gaxis(label, lo, hi, step=1):
    return {"label": label, "min": lo, "max": hi, "step": step}


def graph_stim(desc, curves, xax, yax, extra=None):
    data = {"x_axis": xax, "y_axis": yax}
    if len(curves) == 1:
        data["vertices"] = [list(p) for p in curves[0][1]]
    else:
        data["curves"] = [{"label": lb, "type": "piecewise linear", "vertices": [list(p) for p in vs]} for lb, vs in curves]
    if extra:
        data.update(extra)
    return {"kind": "graph", "description": desc, "data": data}


def dense_graph_stim(desc, fn, lo, hi, xax, yax, n=121, extra=None):
    pts = [[round(lo + (hi - lo) * i / (n - 1), 4), round(float(fn(lo + (hi - lo) * i / (n - 1))), 5)] for i in range(n)]
    data = {"x_axis": xax, "y_axis": yax, "vertices": pts}
    if extra:
        data.update(extra)
    return {"kind": "graph", "description": desc, "data": data}


def diagram_stim(desc, scene):
    """장면 모델(phys_figs)을 stimulus 로. 본문 숫자와 scene 숫자는 같은 변수에서 나온다."""
    return {"kind": "diagram", "description": desc, "data": {"variant": "phys_scene", "scene": scene}}
