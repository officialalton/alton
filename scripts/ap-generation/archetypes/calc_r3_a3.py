"""예비 3차(R3-A, 2026-10-12): 계산기 필수 MC 원형 3군 — 단원 5(절대 최댓값, 임계점, 극값 정당화, 평균값 정리). 반려됐던 원형의 거짓 오답 해설을 고쳤다."""
from gcommon import *
from scommon import textopts
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts, _ax
from calc_r3_a1 import _nbp, _gbp, _bis
import math

XS4 = [0, 2, 4, 6]


def _roots(fn, lo, hi, n=4000):
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    return [_O.brentq(fn, xs[i], xs[i + 1], xtol=1e-13) for i in range(n) if fn(xs[i]) * fn(xs[i + 1]) < 0]


# 5.5 닫힌 구간에서 절대 최댓값(후보 비교)
def c_abs_max_candidates_calc(rng):
    a, b = rng.choice([2, 3, 4]), rng.choice([0.5, 0.8, 1.0])
    f = lambda u: -(u - a) * math.exp(-b * u) + u / 3
    fp = lambda u: -math.exp(-b * u) + b * (u - a) * math.exp(-b * u) + 1 / 3
    crit = _roots(fp, 0.0, 6.0)
    cands = {0.0: f(0.0), 6.0: f(6.0)}
    for c_ in crit:
        cands[c_] = f(c_)
    bx = max(cands, key=cands.get)
    key = cands[bx]
    grid = [6 * i / 6000 for i in range(6001)]
    if abs(max(f(u) for u in grid) - key) > 1e-5:  # 독립 경로: 격자 최댓값
        raise ValueError("independent_check_failed")
    others = [(c_, v_) for c_, v_ in cands.items() if c_ != bx]
    if len(others) < 2 or abs(key - max(v_ for _, v_ in others)) < 0.05:
        raise ValueError("close_candidates")

    def desc(c_):
        return "the left endpoint $x=0$" if c_ == 0.0 else ("the right endpoint $x=6$" if c_ == 6.0 else f"the critical point $x={c_:.3f}$")
    ds = [(f"Reports $f$ at {desc(c_)}, ${v_:.3f}$, which is smaller than the largest candidate value.", v_) for c_, v_ in others]
    ds.append((f"Reports the $x$-coordinate ${bx:.3f}$ where the maximum occurs instead of the maximum value.", bx))
    ds.append((f"Evaluates $f$ at $x={a}$, where the first factor is $0$, instead of at the candidates: $f({a})={f(a):.3f}$.", f(a)))
    pool = dopts(ds, key)
    lst = ", ".join(f"$f({c_:.3f})={v_:.3f}$" for c_, v_ in sorted(cands.items()))
    stem = f"Let $f(x)=-(x-{a})e^{{-{b:g}x}}+\\dfrac{{x}}{{3}}$. What is the absolute maximum value of $f$ on the closed interval $[0,6]$?"
    kk = Opt(dec(key), True, f"Candidates test: solve $f'(x)=0$ on $(0,6)$ with a calculator and compare $f$ at the critical points and the endpoints: {lst}. The largest value is ${key:.3f}$.", key)
    bpr = _nbp("c_abs_max_candidates_calc", "5.5", "1.E", "Find an absolute maximum on a closed interval with the candidates test using a calculator",
               ["Differentiate and solve f' = 0 numerically on the interval", "Evaluate f at each critical point and both endpoints", "Select the largest value"],
               [("f is continuous on [0, 6], so the Extreme Value Theorem guarantees an absolute maximum", "f is a sum of continuous functions")],
               [("smaller_candidate", "reports a smaller candidate value"), ("location_not_value", "reports the x-coordinate"), ("zero_of_first_factor", "evaluates f at x = a")],
               "maximum of f over a 6001-point grid on [0, 6] compared with the candidate values (independent of the candidates test)")
    return pack("c_abs_max_candidates_calc", "5.5", "1.E", "required", stem, kk, pool, rng, est=105, facts=[f"a={a}", f"b={b}", f"key={key:.6f}"], extra={"blueprint": bpr})


_GCRIT = [(2 * sp.sin(x / 2), "2\\sin\\left(\\dfrac{x}{2}\\right)"), (3 * x * sp.exp(-x / 3), "3xe^{-x/3}"), (2 * sp.log(x + 1), "2\\ln(x+1)")]


# 5.2 h = f - g 의 임계점: f' 는 그래프, g 는 식
def g_critical_point_graph_formula_calc(rng):
    for _ in forever():
        gexpr, gtex = rng.choice(_GCRIT)
        vf = rand_vals(rng, 4, -2, 5)
        fp = PL(XS4, vf)
        gd = sp.lambdify(x, sp.diff(gexpr, x), "math")
        gv = sp.lambdify(x, gexpr, "math")
        D = lambda u: fp.num(u) - gd(u)
        rts = _roots(D, 1e-6, 6.0, 2400)
        if len(rts) != 1 or not (0.2 < rts[0] < 5.8) or min(abs(rts[0] - t_) for t_ in XS4) < 0.15 or abs(D(0.0)) < 0.05 or abs(D(6.0)) < 0.05:
            continue
        key = rts[0]
        zf = _roots(lambda u: fp.num(u), 1e-6, 6.0, 2400)
        r2 = _roots(lambda u: fp.num(u) - gv(u), 1e-6, 6.0, 2400)
        r3 = _roots(lambda u: fp.num(u) + gd(u), 1e-6, 6.0, 2400)
        if zf and r2 and r3 and 0.05 < zf[0] < 5.95 and 0.05 < r2[0] < 5.95 and 0.05 < r3[0] < 5.95:
            break
    kb = _bis(D, 0.0, 6.0)  # 독립 경로: 별도 이분법
    if abs(kb - key) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Finds where $f'(x)=0$ on the graph and ignores the term from $g$: $f'(x)=0$ at $x=%.3f$." % zf[0], zf[0]), ("Solves $f'(x)=g(x)$, using $g$ instead of $g'$: the solution is $x=%.3f$." % r2[0], r2[0]),
          ("Solves $f'(x)+g'(x)=0$, adding the derivatives instead of subtracting: the solution is $x=%.3f$." % r3[0], r3[0])]
    pool = dopts(ds, key)
    stem = f"The graph of $f'$, the derivative of the function $f$, is shown for $0\\le x\\le 6$ and consists of line segments. Let $g(x)={gtex}$ and $h(x)=f(x)-g(x)$. At what value of $x$ in the interval $(0,6)$ is $h'(x)=0$?"
    kk = Opt(dec(key), True, f"$h'(x)=f'(x)-g'(x)$. Read $f'$ from the graph (linear on each segment), take $g'$ from the formula, and solve $f'(x)-g'(x)=0$ with a calculator: $x={key:.3f}$.", key)
    bpr = _gbp("g_critical_point_graph_formula_calc", "5.2", "1.E", "Find a critical point of the difference of a function known by its derivative graph and a formula",
               ["Write h' = f' - g' and set it equal to zero", "Use the graph of f' (linear on each segment) and the derivative of g from the formula", "Solve the equation numerically with a calculator"],
               [("h is differentiable on (0, 6) and has exactly one critical point", "f' - g' has exactly one zero for the plotted graph")],
               [("only_fprime_zero", "uses the zero of f'"), ("g_instead_of_gprime", "uses g in place of g'"), ("sign_error", "adds the derivatives")],
               "bisection with 100 halvings on f'(x) - g'(x) with f' interpolated (independent of Brent's method)", ["vertices of f' at x = 0, 2, 4, 6"])
    return gpack("g_critical_point_graph_formula_calc", "5.2", "1.E", "required", stem, kk, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([vf], "x", (0, 6), "f'(x)")), bpr, 110, [f"g={gexpr}", f"vf={vf}", f"key={key:.6f}"])


# 5.4 상대 최대: h = f - g, h' = f' - g' 의 부호 변화(+ -> -)를 정당화
def g_relative_max_graph_formula_calc(rng):
    for _ in forever():
        gexpr, gtex = rng.choice(_GCRIT)
        vf = rand_vals(rng, 4, -2, 5)
        fp = PL(XS4, vf)
        gd = sp.lambdify(x, sp.diff(gexpr, x), "math")
        D = lambda u: fp.num(u) - gd(u)
        rts = _roots(D, 1e-6, 6.0, 2400)
        if len(rts) != 2 or any(not (0.2 < r_ < 5.8) or min(abs(r_ - t_) for t_ in XS4) < 0.15 for r_ in rts) or abs(D(0.0)) < 0.05 or abs(D(6.0)) < 0.05:
            continue
        up_first = D(0.0) > 0  # D 가 처음엔 양수면 첫 근이 +→-(상대 최대)
        kmax, kmin = (rts[0], rts[1]) if up_first else (rts[1], rts[0])
        zf = [z for z in _roots(lambda u: fp.num(u), 1e-6, 6.0, 2400) if fp.num(z - 0.05) > fp.num(z + 0.05)]
        grid = [6 * i / 2400 for i in range(2401)]
        gm = max(grid, key=D)
        if not zf or min(abs(zf[0] - r_) for r_ in rts) < 0.1 or min(abs(gm - r_) for r_ in rts) < 0.1 or abs(gm - zf[0]) < 0.1 or gm in (0.0, 6.0):
            continue
        break
    kb = _bis(D, rts[0] - 0.05, rts[0] + 0.05)  # 독립 경로: 첫 근 이분법과 격자 부호 변화 개수
    if abs(kb - rts[0]) > 1e-6 or sum(1 for i in range(2400) if D(grid[i]) * D(grid[i + 1]) < 0) != 2:
        raise ValueError("independent_check_failed")
    ds = [(f"This is where $h'$ changes from negative to positive, which gives a relative minimum of $h$, not a relative maximum.", kmin),
          (f"Finds where $f'(x)=0$ and changes from positive to negative on the graph, $x={zf[0]:.3f}$, ignoring $g$; there $h'({zf[0]:.3f})=-g'({zf[0]:.3f})={-gd(zf[0]):.3f}\\ne 0$.", zf[0]),
          (f"Takes the place where $h'$ is greatest, $x={gm:.3f}$, but a relative extremum of $h$ needs $h'=0$ with a sign change.", gm)]
    pool = dopts(ds, kmax)
    stem = f"The graph of $f'$, the derivative of the function $f$, is shown for $0\\le x\\le 6$ and consists of line segments. Let $g(x)={gtex}$ and $h(x)=f(x)-g(x)$. At what value of $x$ in the interval $(0,6)$ does $h$ have a relative maximum?"
    kk = Opt(dec(kmax), True, f"$h'(x)=f'(x)-g'(x)$ is zero at $x={rts[0]:.3f}$ and $x={rts[1]:.3f}$ (calculator). $h'$ changes from positive to negative at $x={kmax:.3f}$, so $h$ has a relative maximum there; at $x={kmin:.3f}$ the sign change is from negative to positive.", kmax)
    bpr = _gbp("g_relative_max_graph_formula_calc", "5.4", "3.E", "Locate and justify a relative maximum of a difference of a function known by its derivative graph and a formula using the sign change of h'",
               ["Write h' = f' - g' and find its zeros with a calculator", "Check the sign of h' on both sides of each zero", "Choose the zero where h' changes from positive to negative"],
               [("h' changes sign at each of its two zeros, so each is a relative extremum", "f' - g' has exactly two simple zeros in (0, 6)")],
               [("relative_minimum", "chooses the zero where h' goes negative to positive"), ("ignores_g", "uses the zero of f' only"), ("extremum_of_derivative", "uses where h' is greatest")],
               "bisection on the first zero of f' - g' and a count of sign changes on a 2401-point grid (independent of Brent's method)", ["vertices of f' at x = 0, 2, 4, 6"])
    return gpack("g_relative_max_graph_formula_calc", "5.4", "3.E", "required", stem, kk, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([vf], "x", (0, 6), "f'(x)")), bpr, 115, [f"g={gexpr}", f"vf={vf}", f"kmax={kmax:.6f}"])


_PMVT = [(2 * sp.log(x + 1), "2\\ln(x+1)"), (x ** 2 / 6, "\\dfrac{x^{2}}{6}"), (3 * sp.sqrt(x), "3\\sqrt{x}"), (sp.exp(x / 3), "e^{x/3}")]


# 5.1 평균값 정리: h = f + p, f' 는 그래프, p 는 식. h'(c) = (h(6) - h(0))/6 인 c
def g_mvt_sum_graph_formula_calc(rng):
    for _ in forever():
        pexpr, ptex = rng.choice(_PMVT)
        vf = rand_vals(rng, 4, -1, 5)
        fp = PL(XS4, vf)
        pf = sp.lambdify(x, pexpr, "math")
        pd_ = sp.lambdify(x, sp.diff(pexpr, x), "math")
        area = float(fp.area(0, 6))
        pdiff = pf(6.0) - pf(0.0)
        avg = (area + pdiff) / 6
        rk = _roots(lambda u: fp.num(u) + pd_(u) - avg, 1e-6, 6.0, 2400)
        if len(rk) != 1 or not (0.2 < rk[0] < 5.8) or min(abs(rk[0] - t_) for t_ in XS4) < 0.15:
            continue
        r1 = _roots(lambda u: fp.num(u) + pd_(u) - area / 6, 1e-6, 6.0, 2400)
        r2 = _roots(lambda u: fp.num(u) - avg, 1e-6, 6.0, 2400)
        r4 = _roots(lambda u: fp.num(u) + pd_(u) - pdiff / 6, 1e-6, 6.0, 2400)
        r3 = _roots(lambda u: fp.num(u) + pd_(u) - (area + pdiff), 1e-6, 6.0, 2400)
        cand = [("Averages only the change in $f$ over $[0,6]$, solving $f'(c)+p'(c)=\\dfrac{f(6)-f(0)}{6}$ and leaving out the change in $p$", r1), ("Solves $f'(c)=\\dfrac{h(6)-h(0)}{6}$, leaving out $p'(c)$", r2),
                ("Averages only the change in $p$, solving $f'(c)+p'(c)=\\dfrac{p(6)-p(0)}{6}$", r4), ("Solves $h'(c)=h(6)-h(0)$, forgetting to divide by $6$", r3)]
        good = [(w + f": the solution is $c={z[0]:.3f}$.", z[0]) for w, z in cand if len(z) >= 1 and 0.05 < z[0] < 5.95]
        if len(good) >= 3:
            break
    key = rk[0]
    kb = _bis(lambda u: fp.num(u) + pd_(u) - avg, 0.0, 6.0)
    num_area = fp.quad(0, 6)  # 독립 경로: 수치 적분과 이분법
    if abs(kb - key) > 1e-6 or abs(num_area - area) > 1e-8:
        raise ValueError("independent_check_failed")
    pool = dopts(good, key)
    stem = f"The graph of $f'$, the derivative of the function $f$, is shown for $0\\le x\\le 6$ and consists of line segments. Let $p(x)={ptex}$ and $h(x)=f(x)+p(x)$. Since $h$ is differentiable on $(0,6)$, the Mean Value Theorem guarantees a number $c$ with $0<c<6$ such that $h'(c)=\\dfrac{{h(6)-h(0)}}{{6}}$. What is the value of $c$?"
    kk = Opt(dec(key), True, f"$h(6)-h(0)=\\int_0^6 f'(x)\\,dx+p(6)-p(0)={area:g}+{pdiff:.3f}$, the first part being the signed area under the graph, so the average rate is ${avg:.3f}$. Solve $f'(c)+p'(c)={avg:.3f}$ with a calculator on $(0,6)$ to get $c={key:.3f}$.", key)
    bpr = _gbp("g_mvt_sum_graph_formula_calc", "5.1", "3.D", "Apply the Mean Value Theorem to the sum of a function known by its derivative graph and a formula",
               ["Confirm that h is differentiable so the Mean Value Theorem applies", "Find the average rate of change using the signed area under the graph of f' and the formula values of p", "Solve h'(c) = average rate numerically with a calculator"],
               [("h is differentiable on (0, 6) and continuous on [0, 6], so a number c with h'(c) equal to the average rate exists", "f' is continuous (a connected graph) and p is differentiable on (0, 6)")],
               [("forgets_p_in_average", "averages only f"), ("forgets_pprime", "drops the derivative of p"), ("only_p_average", "averages only p"), ("no_division", "does not divide by 6")],
               "bisection on f'(c) + p'(c) minus the average, with the signed area recomputed by numerical quadrature (independent of Brent's method and exact areas)", ["vertices of f' at x = 0, 2, 4, 6"])
    return gpack("g_mvt_sum_graph_formula_calc", "5.1", "3.D", "required", stem, kk, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([vf], "x", (0, 6), "f'(x)")), bpr, 120, [f"p={pexpr}", f"vf={vf}", f"c={key:.6f}"])


# 5.4 일차 도함수 판정법: 상대 최솟값의 정당화(문장 선택)
def c_relative_min_justify_calc(rng):
    k = rng.choice([4, 5, 6])
    fp = lambda u: 2 * u - k * math.cos(u)
    r = _roots(fp, 0.01, 4.0)
    if len(r) != 1:
        raise ValueError("unexpected_roots")
    r = r[0]
    f2 = 2 + k * math.sin(r)
    if not (fp(r - 1e-3) < 0 < fp(r + 1e-3)) or f2 <= 0:  # 독립 경로: 양쪽 부호와 f'' 부호
        raise ValueError("independent_check_failed")
    rs = f"{r:.3f}"
    key = Opt(f"$f'$ changes from negative to positive at $x={rs}$.", True, f"$f'(x)=2x-{k}\\cos x$ is negative just left of $x={rs}$ and positive just right of it (calculator), so by the First Derivative Test $f$ has a relative minimum at $x={rs}$.", None)
    ds = [Opt(f"$f'({rs})=0$.", False, f"$f'({rs})=0$ is true, but a critical point alone does not show a relative minimum; $f'$ is also $0$ at relative maxima and at points with no extremum.", None),
          Opt(f"$f''({rs})<0$.", False, f"$f''(x)=2+{k}\\sin x$, so $f''({rs})={f2:.3f}>0$; the claim $f''<0$ is false and would indicate a relative maximum.", None),
          Opt(f"$f'$ changes from positive to negative at $x={rs}$.", False, f"$f'$ is negative to the left and positive to the right of $x={rs}$, so the sign change is from negative to positive, not positive to negative.", None)]
    stem = f"Let $f(x)=x^{{2}}-{k}\\sin x$ for $x>0$. The derivative $f'(x)=2x-{k}\\cos x$ equals $0$ at $x={rs}$. Which of the following statements, by itself, justifies that $f$ has a relative minimum at $x={rs}$?"
    bpr = _nbp("c_relative_min_justify_calc", "5.4", "3.E", "Choose the statement that justifies a relative minimum with the First Derivative Test",
               ["Locate the critical point with a calculator", "Recall that the First Derivative Test needs a sign change of f'", "Choose the statement that describes a change from negative to positive"],
               [("f' is continuous and changes sign from negative to positive at the critical point", "f' is negative at 0 and increasing near the root")],
               [("critical_point_only", "f' = 0 alone"), ("wrong_second_derivative_sign", "f'' < 0 for a minimum"), ("reversed_sign_change", "positive to negative")],
               "signs of f' just left and right of the root and the sign of f'' evaluated numerically (independent of the argument)")
    return pack("c_relative_min_justify_calc", "5.4", "3.E", "required", stem, key, ds, rng, est=90, facts=[f"k={k}", f"r={r:.6f}"], extra={"blueprint": bpr})


# 5.7 이차 도함수 판정법 적용(문장 선택)
def c_second_deriv_test_justify_calc(rng):
    k = rng.choice([2, 3, 4])
    fp = lambda u: (u + 1) * math.exp(u) - k
    r = _roots(fp, 0.0, 3.0)
    if len(r) != 1:
        raise ValueError("unexpected_roots")
    r = r[0]
    f2 = (r + 2) * math.exp(r)
    if f2 <= 0 or abs((fp(r + 1e-6) - fp(r - 1e-6)) / 2e-6 - f2) > 1e-4:  # 독립 경로: f' 의 중심차분 = f''
        raise ValueError("independent_check_failed")
    rs = f"{r:.3f}"
    key = Opt(f"$f'({rs})=0$ and $f''({rs})>0$, so $f$ has a relative minimum at $x={rs}$.", True, f"$f'(x)=(x+1)e^{{x}}-{k}$ is $0$ at $x={rs}$ (calculator), and $f''(x)=(x+2)e^{{x}}$ gives $f''({rs})={f2:.3f}>0$, so the graph is concave up and by the Second Derivative Test $f$ has a relative minimum.", None)
    ds = [Opt(f"$f'({rs})=0$ and $f''({rs})>0$, so $f$ has a relative maximum at $x={rs}$.", False, f"$f''({rs})={f2:.3f}>0$ is correct, but a positive second derivative means concave up, which gives a relative minimum, not a maximum.", None),
          Opt(f"$f'({rs})=0$ and $f''({rs})<0$, so $f$ has a relative minimum at $x={rs}$.", False, f"$f''({rs})={f2:.3f}$ is positive, not negative, and a negative second derivative would indicate a relative maximum.", None),
          Opt(f"$f''({rs})=0$, so $f$ has a relative minimum at $x={rs}$.", False, f"$f''({rs})={f2:.3f}\\ne 0$; the Second Derivative Test uses $f'=0$ together with the sign of $f''$, and $f''=0$ would be inconclusive.", None)]
    stem = f"Let $f(x)=xe^{{x}}-{k}x$ for $x>0$. The derivative $f'(x)=(x+1)e^{{x}}-{k}$ equals $0$ at $x={rs}$. Which of the following correctly applies the Second Derivative Test at $x={rs}$?"
    bpr = _nbp("c_second_deriv_test_justify_calc", "5.7", "3.D", "Apply the Second Derivative Test correctly at a critical point found with a calculator",
               ["Locate the critical point with a calculator", "Evaluate the sign of f'' at the critical point", "Match f' = 0 with f'' > 0 to a relative minimum"],
               [("f' = 0 at the point and f'' is continuous with f'' > 0 there", "f''(x) = (x + 2)e^x > 0 for x > 0")],
               [("max_for_positive", "reads a positive f'' as a maximum"), ("negative_second_derivative", "claims f'' is negative"), ("zero_second_derivative", "claims f'' is zero")],
               "central difference of f' at the critical point compared with the closed form of f'' (independent of the algebraic second derivative)")
    return pack("c_second_deriv_test_justify_calc", "5.7", "3.D", "required", stem, key, ds, rng, est=95, facts=[f"k={k}", f"r={r:.6f}"], extra={"blueprint": bpr})
