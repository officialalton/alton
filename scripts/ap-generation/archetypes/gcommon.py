"""AP 그래프 필수 MC 원형 공통 도구(2026-10-09, S1~S3). 구간선형(PL) 그래프는 정수 꼭짓점으로 만들고 모든 값은 정확한 유리수로 계산한 뒤 수치 적분/표본으로 독립 확인한다."""
from fractions import Fraction as Fr
import math
from common import *
from bp import mc_blueprint
from scipy import integrate as _I, optimize as _O

SUB = "ap_calculus_ab"


def R(v):
    v = Fr(v)
    return sp.Rational(v.numerator, v.denominator)


def fx(v):
    """정확한 값 → $...$"""
    return fmt(R(v))


def anyfmt(z):
    """Fraction 은 정확한 유리수 표기, 그 밖의 값(sympy 등)은 fmt."""
    if isinstance(z, (Fr, int)):
        return fx(z)
    return fmt(z)


def dec(v):
    return "$%.3f$" % v


class PL:
    """정수 꼭짓점 구간선형 함수. 모든 계산은 Fraction(정확), num/quad 는 독립 수치 경로."""

    def __init__(s, xs, vs):
        s.xs = [Fr(a) for a in xs]
        s.vs = [Fr(a) for a in vs]
        s.n = len(xs) - 1

    def vert(s):
        return [[int(a), int(b)] for a, b in zip(s.xs, s.vs)]

    def seg_index(s, u, side=1):
        u = Fr(u)
        for i in range(s.n):
            if s.xs[i] < u < s.xs[i + 1]:
                return i
            if u == s.xs[i]:
                return i if (side > 0 or i == 0) and i < s.n else i - 1
            if u == s.xs[i + 1] and i == s.n - 1:
                return i
        raise ValueError("outside domain")

    def slope_seg(s, i):
        return (s.vs[i + 1] - s.vs[i]) / (s.xs[i + 1] - s.xs[i])

    def slope(s, u, side=1):
        i = s.seg_index(u, side)
        return s.slope_seg(i)

    def at(s, u):
        u = Fr(u)
        i = s.seg_index(u)
        return s.vs[i] + s.slope_seg(i) * (u - s.xs[i])

    def area(s, a, b):
        a, b = Fr(a), Fr(b)
        t = Fr(0)
        for i in range(s.n):
            lo, hi = max(a, s.xs[i]), min(b, s.xs[i + 1])
            if hi > lo:
                f0 = s.vs[i] + s.slope_seg(i) * (lo - s.xs[i])
                f1 = s.vs[i] + s.slope_seg(i) * (hi - s.xs[i])
                t += (f0 + f1) / 2 * (hi - lo)
        return t

    def sq_area(s, a, b):
        """∫ f^2 (정확)"""
        a, b = Fr(a), Fr(b)
        t = Fr(0)
        for i in range(s.n):
            lo, hi = max(a, s.xs[i]), min(b, s.xs[i + 1])
            if hi > lo:
                f0 = s.vs[i] + s.slope_seg(i) * (lo - s.xs[i])
                f1 = s.vs[i] + s.slope_seg(i) * (hi - s.xs[i])
                t += (f0 * f0 + f0 * f1 + f1 * f1) / 3 * (hi - lo)
        return t

    # ---- 독립 수치 경로(정확 계산과 코드 경로가 다르다)
    def num(s, u):
        u = float(u)
        xs = [float(a) for a in s.xs]
        vs = [float(a) for a in s.vs]
        for i in range(s.n):
            if xs[i] <= u <= xs[i + 1]:
                return vs[i] + (vs[i + 1] - vs[i]) * (u - xs[i]) / (xs[i + 1] - xs[i])
        raise ValueError("outside")

    def quad(s, a, b, fn=None):
        fn = fn or s.num
        pts = [float(x) for x in s.xs if float(a) < float(x) < float(b)]
        return _I.quad(fn, float(a), float(b), points=pts or None, limit=200)[0]

    def sign_pattern(s):
        return [(-1 if v < 0 else (1 if v > 0 else 0)) for v in s.vs]


def sub(f, g):
    """f-g 의 PL (공통 꼭짓점 xs 가 같다고 가정)"""
    assert f.xs == g.xs
    return PL(f.xs, [a - b for a, b in zip(f.vs, g.vs)])


def abs_area(d):
    """∫|d| 정확 (d 는 PL)"""
    t = Fr(0)
    for i in range(d.n):
        d0, d1, w = d.vs[i], d.vs[i + 1], d.xs[i + 1] - d.xs[i]
        if d0 * d1 >= 0:
            t += (abs(d0) + abs(d1)) / 2 * w
        else:
            t += (d0 * d0 + d1 * d1) / (2 * (abs(d0) + abs(d1))) * w
    return t


def axis(label, lo, hi, step=1):
    return {"label": label, "min": lo, "max": hi, "step": step}


def gstim(desc, curves, xax, yax, extra=None):
    """curves: [(label, [[x,y],...])]. 한 곡선이면 label 은 데이터에 넣지 않는다(축/설명이 이름을 말한다)."""
    data = {"x_axis": xax, "y_axis": yax}
    if len(curves) == 1:
        data["vertices"] = [list(p) for p in curves[0][1]]
    else:
        data["curves"] = [{"label": lb, "type": "piecewise linear", "vertices": [list(p) for p in vs]} for lb, vs in curves]
    if extra:
        data.update(extra)
    return {"kind": "graph", "description": desc, "data": data}


def opts(pairs, key_val, textfn):
    """pairs: [(why, value)] → 서로 다르고 키와 다른 값만 Opt 로. 3개 미만이면 오류."""
    out, used = [], {round(float(key_val), 9)}
    for why, v in pairs:
        k = round(float(v), 9)
        if k in used:
            continue
        used.add(k)
        out.append(Opt(textfn(v), False, why, v))
    if len(out) < 3:
        raise ValueError("not_enough_distractors")
    return out


def bp(arch, topic, skill, calc, concept, thinking, cond, mis, path, material, method="exact rational arithmetic + numeric cross-check"):
    return mc_blueprint(arch, SUB, topic, skill, calc, concept, thinking, cond, mis, path, material=material, method=method)


def gpack(arch, topic, skill, calc, stem, key, ds, rng, stim, blueprint, est=85, facts=None):
    return pack(arch, topic, skill, calc, stem, key, ds, rng, stimulus=stim, est=est, facts=facts or [], extra={"blueprint": blueprint})


def forever(n=4000):
    """무한 루프 방지: 조건을 만족하는 표본을 n 번 안에 못 찾으면 ValueError(파이프라인은 시드를 건너뛴다)."""
    for _ in range(n):
        yield
    raise ValueError("no_sample")


def rand_vals(rng, n, lo, hi):
    return [rng.randint(lo, hi) for _ in range(n)]
