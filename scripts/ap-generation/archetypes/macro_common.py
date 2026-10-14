"""AP Macroeconomics 원형 공통 도구(2026-10-14, 무료 엔지니어링; micro_common.py 와 같은 규약). 모든 정답·표·그래프 수치는 코드가 계산한다. LLM 은 (고정 문장 모드에서는) 아무것도 쓰지 않는다.
규칙(docs/ap/macroeconomics-groundwork.md):
- 이중 경로: 정확 분수(Fraction)·규칙표 경로 vs sympy 기호·수치 시뮬레이션 경로로 정답을 독립 계산, 불일치 시 ValueError(시드 건너뜀).
- 5지선다(A–E). 값 선택지는 서로 8% 이상 떨어진다. 문장 선택지는 이름 붙은 오개념(why ≥25자, 서로 다름)을 가진다.
- 달러 기호는 통화다(수식 구분자 아님): 본문·선택지에 \\$ 없이 '$12' 로 쓴다. 단위는 평문.
- 그래프는 기존 ap_graph(econ_curves) 규약: curves(kind graph, 꺾은선 vertices) + labeled_points(Q·P·label). 곡선 라벨은 본문에서 언급된다.
- 모형 가정: 별도 언급 없으면 선형 곡선. 거시 그래프(AD-AS·화폐시장·대부자금시장·외환시장·필립스 곡선·PPC)는 econ_curves(꺾은선 vertices) 규약을 쓴다. 화폐공급 변화는 '지급준비금이 제한적인 경제'를 명시한다(CED POL-1.D)."""
import math
import random  # noqa: F401
from fractions import Fraction as Fr
import sympy as sp
import numpy as np
from common import Opt, pack, table_stimulus  # noqa: F401
from bp import mc_blueprint, frq_blueprint, meaning  # noqa: F401
from phys_common import agree, pick, forever, graph_stim, gaxis  # noqa: F401

SUB = "ap_macroeconomics"
MIN_REL_SEP = 0.08
MAT_NONE = {"type": "none", "must_include": []}
MAT_GRAPH = lambda *inc: {"type": "graph", "must_include": list(inc)}  # noqa: E731
MAT_TABLE = lambda *inc: {"type": "table", "must_include": list(inc)}  # noqa: E731
MAT_MATRIX = {"type": "payoff_matrix", "must_include": ["row and column strategies", "payoffs for both players"]}


# ---------------- 표기 ----------------
def usd(v):
    v = float(v)
    if v < 0:
        return "-" + usd(-v)
    if abs(v - round(v)) < 1e-9:
        return f"${int(round(v)):,}"
    return f"${v:,.2f}"


def nm(v, d=2):
    """숫자 평문(불필요한 0 제거)."""
    v = float(v)
    if abs(v - round(v)) < 1e-9:
        return f"{int(round(v)):,}"
    s = f"{v:.{d}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def pct(v, d=1):
    return f"{nm(v, d)}%"


# ---------------- 선택지 ----------------
def val_opts(key_val, pairs, fmt, need=4):
    """key_val 정답값, pairs=[(오개념 설명, 값)]. 서로 MIN_REL_SEP 이상 떨어진 need 개를 고른다(0 허용)."""
    key = Opt(fmt(key_val), True, "", key_val)
    chosen, ds = [key_val], []
    for why, v in pairs:
        if v is None or not math.isfinite(float(v)):
            continue
        v = float(v)
        if any(abs(v - c) <= MIN_REL_SEP * max(abs(c), abs(v)) for c in chosen) or fmt(v) == key.text or fmt(v) in [d.text for d in ds]:
            continue
        chosen.append(v)
        ds.append(Opt(fmt(v), False, why, v))
    if len(ds) < need:
        raise ValueError("not_enough_separated_distractors")
    return key, ds


def sent_opts(key_text, key_why, wrongs):
    """고정 문장 선택지: 정답 1 + 이름 붙은 오개념(문장, 설명)."""
    return Opt(key_text, True, key_why, None), [Opt(t, False, w, None) for t, w in wrongs]


def retry_sep(fn):
    """선택지 간격 부족이면 같은 rng 로 다시 뽑는다(결정적)."""
    import functools

    @functools.wraps(fn)
    def w(rng):
        last = None
        for _ in range(40):
            try:
                return fn(rng)
            except ValueError as e:
                if "not_enough_separated" not in str(e) and "short_why" not in str(e) and "duplicate_why" not in str(e):
                    raise
                last = e
        raise last
    return w


# ---------------- 선형 시장 ----------------
class Mkt:
    """역함수 형태: 수요 P = A - B*Q, 공급 P = C + D*Q (정수 모수, 균형이 정수가 되게 만든다)."""

    def __init__(self, Q0, P0, B, D):
        self.Q0, self.P0, self.B, self.D = Q0, P0, B, D
        self.A = P0 + B * Q0
        self.C = P0 - D * Q0

    def pd(self, Q):
        return self.A - self.B * Q

    def ps(self, Q):
        return self.C + self.D * Q

    def qd(self, P):
        return Fr(self.A - P, 1) / self.B

    def qs(self, P):
        return Fr(P - self.C, 1) / self.D

    def eq_exact(self, tax=0, dA=0, dC=0):
        """수요 절편 +dA, 공급 절편 +dC + 단위당 세금(공급자에게)이 있을 때 균형(Fraction)."""
        A, C = self.A + dA, self.C + dC + tax
        Q = Fr(A - C, 1) / (self.B + self.D)
        return Q, A - self.B * Q


def eq_sympy(m, tax=0, dA=0, dC=0):
    """독립 경로: sympy 연립방정식."""
    Q, P = sp.symbols("Q P")
    sol = sp.solve([sp.Eq(P, (m.A + dA) - m.B * Q), sp.Eq(P, (m.C + dC + tax) + m.D * Q)], [Q, P], dict=True)[0]
    return sol[Q], sol[P]


def mkt_check(m, **kw):
    q1, p1 = m.eq_exact(**kw)
    q2, p2 = eq_sympy(m, **kw)
    agree(float(q1), float(q2), 1e-9, "eq_Q")
    agree(float(p1), float(p2), 1e-9, "eq_P")
    return q1, p1


def new_mkt(rng, qmin=20, qmax=60, pmin=20, pmax=80):
    """균형 (Q0,P0)가 정수이고 모든 절편이 양수인 시장."""
    for _ in forever():
        Q0 = rng.choice(range(qmin, qmax + 1, 5)); P0 = rng.choice(range(pmin, pmax + 1, 5))
        B = rng.choice([Fr(1, 2), Fr(1), Fr(3, 2), Fr(2)]); D = rng.choice([Fr(1, 2), Fr(1), Fr(3, 2), Fr(2)])
        if B == D:
            continue
        m = Mkt(Q0, P0, B, D)
        if m.C <= 0 or m.A <= 0 or m.C != int(m.C) or m.A != int(m.A):
            continue
        if m.B * Q0 != int(m.B * Q0) or m.D * Q0 != int(m.D * Q0):
            continue
        m.A, m.C, m.B, m.D = int(m.A), int(m.C), Fr(m.B), Fr(m.D)
        return m


# 이동 규칙: 수요/공급 이동(+1 오른쪽, -1 왼쪽)의 균형 가격·수량 변화. None = 불확정.
def _sg(v):
    return 1 if v > 0 else -1 if v < 0 else 0


def eq_effect_rule(ds, ss):
    """가격은 수요 증가·공급 감소가 올리고, 수량은 수요·공급 증가가 늘린다. 두 이동이 같은 방향이면 가격이, 반대 방향이면 수량이 불확정이다."""
    P = None if ds * ss > 0 else _sg(ds - ss)
    Q = None if ds * ss < 0 else _sg(ds + ss)
    return P, Q


def eq_effect_sim(ds, ss, rng_seed=0):
    """독립 경로: 선형 시장에서 두 가지 크기 영역으로 수치 시뮬레이션해 부호가 일정하면 확정, 영역마다 다르면 불확정."""
    m = Mkt(40, 40, Fr(1), Fr(1))
    res = []
    for (kd, ks) in [(3, 1), (1, 3), (2, 2)]:
        dA = ds * 4 * kd if ds else 0
        dC = -ss * 4 * ks if ss else 0  # 공급 증가(오른쪽) = 공급 곡선 절편 하락
        q0, p0 = m.eq_exact()
        q1, p1 = m.eq_exact(dA=dA, dC=dC)
        sg = lambda v: 1 if v > 0 else -1 if v < 0 else 0  # noqa: E731
        res.append((sg(p1 - p0), sg(q1 - q0)))
    P = {r[0] for r in res}; Q = {r[1] for r in res}
    return (P.pop() if len(P) == 1 else None), (Q.pop() if len(Q) == 1 else None)


def dir_word(v):
    return {1: "increases", -1: "decreases", 0: "does not change", None: "is indeterminate"}[v]


def combo_text(P, Q, pw="Equilibrium price", qw="equilibrium quantity"):
    return f"{pw} {dir_word(P)}, and {qw} {dir_word(Q)}."


# ---------------- 그래프 ----------------
PRICE_AX = lambda hi, step=10: gaxis("Price (dollars)", 0, hi, step)  # noqa: E731
QTY_AX = lambda hi, step=10: gaxis("Quantity", 0, hi, step)  # noqa: E731


def econ_graph(desc, curves, xhi, yhi, xstep=10, ystep=10, points=None, dashed_y=None, xlabel="Quantity", ylabel="Price (dollars)"):
    """curves = [(label, [(Q,P),...])]. points = [(label, Q, P)]. 모든 곡선 라벨은 본문에서 언급해야 한다."""
    extra = {}
    if points:
        extra["labeled_points"] = [{"Q": q, "P": p, "label": lb} for lb, q, p in points]
    if dashed_y:
        extra["dashed_lines"] = [{"y": y} for y in dashed_y]
    return graph_stim(desc, [(lb, _clip(vs, xhi, yhi)) for lb, vs in curves], gaxis(xlabel, 0, xhi, xstep), gaxis(ylabel, 0, yhi, ystep), extra or None)


def _clip(vs, xhi, yhi):
    """직선(두 점)은 축 범위와 만나는 점까지 잘라 그리고, 촘촘한 곡선은 범위 밖 점을 버린다(곡선이 그림 밖으로 나가 렌더가 잘리지 않게)."""
    pts = [(float(q), float(p)) for q, p in vs]
    if len(pts) == 2:
        (x0, y0), (x1, y1) = pts
        ts = [0.0, 1.0]
        for lo, hi, a, b in ((0.0, xhi, x0, x1), (0.0, yhi, y0, y1)):
            if b != a:
                for bound in (lo, hi):
                    t = (bound - a) / (b - a)
                    if 0.0 < t < 1.0:
                        ts.append(t)
        inside = [t for t in sorted(ts) if -1e-9 <= x0 + t * (x1 - x0) <= xhi + 1e-9 and -1e-9 <= y0 + t * (y1 - y0) <= yhi + 1e-9]
        if len(inside) >= 2:
            lo_t, hi_t = inside[0], inside[-1]
            return [(round(x0 + lo_t * (x1 - x0), 4), round(y0 + lo_t * (y1 - y0), 4)), (round(x0 + hi_t * (x1 - x0), 4), round(y0 + hi_t * (y1 - y0), 4))]
    return [(round(q, 4), round(p, 4)) for q, p in pts if -1e-9 <= q <= xhi + 1e-9 and -1e-9 <= p <= yhi + 1e-9]


def line_pts(a, b, q0, q1):
    """P = a + b Q 의 두 끝점."""
    return [(q0, a + b * q0), (q1, a + b * q1)]


def dense_pts(fn, q0, q1, n=41):
    return [(q0 + (q1 - q0) * i / (n - 1), float(fn(q0 + (q1 - q0) * i / (n - 1)))) for i in range(n)]


# ---------------- 설계도·팩 ----------------
def mbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, model=None, method="exact fractions + independent symbolic/numeric path"):
    mdl = model or {"initial_state": f"economy, market, or policy situation described in the stem: {concept}", "changed_conditions": ["the event or comparison named in the stem"], "held_constant": ["all other conditions (ceteris paribus)"],
                    "checks": ["key recomputed by an independent path"], "key_assumptions_id": arch, "explanation_assumptions_id": arch}
    return mc_blueprint(arch, SUB, topic, skill, "allowed", concept, thinking, cond, mis, path, material=material, method=method, extra={"judgment_demand": [judgment] if isinstance(judgment, str) else judgment, "model": mdl})


def mk(arch, topic, skill, stem, key, ds, rng, *, concept, path, thinking=None, cond=None, material=None, judgment="apply the economic model to the situation and compare the outcome with the five options",
       stim=None, est=75, facts=None, kwhy=None, model=None):
    """원형 한 문항 팩(5지선다). 설계도의 오개념 목록은 실제로 화면에 나온 오답의 why 에서 만든다. 오답 why 는 서로 다르고 25자 이상이어야 한다(아니면 시드 건너뜀)."""
    if kwhy and not key.why:
        key.why = kwhy
    stem = _name_curves(stem, stim)
    p = pack(arch, topic, skill, "allowed", stem, key, ds, rng, stimulus=stim, est=max(45, min(130, est)), facts=facts or [], n_total=5)
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
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown)]
    mat = material or (MAT_GRAPH() if stim and stim["kind"] == "graph" else MAT_TABLE() if stim and stim["kind"] == "table" else MAT_MATRIX if stim and stim["kind"] == "payoff_matrix" else MAT_NONE)
    p["blueprint"] = mbp(arch, topic, skill, concept, thinking or [f"Identify the economic model that applies: {concept}", "Work out the outcome (or read the figure) and match it against the five options"],
                         [(c, e if len(e) >= 10 else f"stated in the {e}") for c, e in (cond or [("every quantity or condition needed is given in the stem or stimulus", "stem and stimulus values")])], mis, path, mat, judgment, model=model)
    return p



def _name_curves(stem, stim):
    """그림 게이트는 본문에 나오지 않는 곡선 라벨을 지운다. 본문이 모든 곡선 라벨을 언급하게 첫 문장 뒤에 한 문장을 넣는다."""
    import re as _re
    if not stim or stim.get("kind") != "graph":
        return stem
    labels = [c["label"] for c in stim["data"].get("curves", []) if c.get("label")]
    if not labels or all(_re.search(r"(?<![A-Za-z0-9])" + _re.escape(lb) + r"(?![A-Za-z0-9])", stem) for lb in labels):
        return stem
    names = labels[0] if len(labels) == 1 else (" and ".join(labels) if len(labels) == 2 else ", ".join(labels[:-1]) + ", and " + labels[-1])
    sent = f"The curves are labeled {names}."
    i = stem.find(". ")
    return stem + " " + sent if i < 0 else stem[:i + 1] + " " + sent + stem[i + 1:]


def tbl(desc, cols, rows, notes=None):
    return {"kind": "table", "description": desc, "data": {"columns": cols, "rows": [[str(c) for c in r] for r in rows], **({"notes": notes} if notes else {})}}


GOODS = ["coffee", "bicycles", "sneakers", "pizza", "backpacks", "tea", "headphones", "notebooks", "orange juice", "umbrellas"]


# ======================= 거시 공통(2026-10-14) =======================
UP, DOWN, SAME = 1, -1, 0
DIRW = {1: "increase", -1: "decrease", 0: "not change", None: "be indeterminate"}


def dword(v, noun=True):
    """방향 정수를 동사구로: 1 -> 'increase'."""
    return DIRW[v]


def cap1(s):
    return s[0].upper() + s[1:]


def nlist(xs):
    xs = list(xs)
    return xs[0] if len(xs) == 1 else (" and ".join(xs) if len(xs) == 2 else ", ".join(xs[:-1]) + ", and " + xs[-1])


def nonzero_sep(vals, rel=MIN_REL_SEP):
    """값 목록의 서로 간격이 충분한지."""
    v = [float(x) for x in vals]
    return all(abs(a - b) > rel * max(abs(a), abs(b), 1e-9) for i, a in enumerate(v) for b in v[i + 1:])


def mc_adas_axes():
    return dict(xlabel="Real GDP (billions of dollars)", ylabel="Price level (index)")
