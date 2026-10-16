"""AB 보강 원형(2026-10-09, 설계도 포함): 그래프 자료 MC 2종 + 미구현 FRQ 3유형(입자 운동, 관련 변화율, 음함수 미분)."""
from common import *
from calc_ab_frq import row, part
from bp import mc_blueprint, frq_blueprint
from scipy import integrate as _I

SUB = "ap_calculus_ab"

def _graph(desc, ylabel, verts, dom):
    return {"kind": "graph", "description": desc, "data": {"x_axis": "x", "y_axis": ylabel, "vertices": [list(v) for v in verts], "domain": list(dom)}}

# ---- 그래프 MC 1: f' 그래프에서 상대 극값(5.4) — 영점이지만 부호가 안 바뀌는 꼭짓점이 함정
def graph_fprime_extremum(rng):
    xs = [0, 2, 4, 6, 8]
    while True:
        v = [rng.choice([-4, -2, 0, 2, 4]) for _ in xs]
        if v[0] == 0 or v[4] == 0: continue
        zeros = [i for i in (1, 2, 3) if v[i] == 0]
        chg = [i for i in zeros if v[i - 1] * v[i + 1] < 0]; touch = [i for i in zeros if v[i - 1] * v[i + 1] > 0]
        if len(chg) == 1 and len(touch) >= 1 and (v[chg[0] - 1] < 0 < v[chg[0] + 1]): break    # 유일한 상대 최솟값(− → +)과 접촉 영점
    kmin = xs[chg[0]]; kt = xs[touch[0]]
    kpeak = xs[max(range(1, 4), key=lambda i: v[i])]; kvalley = xs[min(range(1, 4), key=lambda i: v[i])]
    whys = {kt: "Treats a zero of f' where the sign does not change as an extremum.", kpeak: "Confuses the maximum of the graph of f' with a relative extremum of f.", kvalley: "Confuses the minimum of the graph of f' with a relative extremum of f."}
    pool = []; used = {kmin}
    for k in [kt, kpeak, kvalley] + [0, 2, 4, 6, 8]:
        if k not in used and len(pool) < 3: used.add(k); pool.append(Opt("$x=%d$" % k, False, whys.get(k, "Reads a vertex of the graph of f' without checking whether f' changes sign there."), k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    # 독립 경로: 조각 선형 f' 를 촘촘히 표본해 부호 변화 위치를 수치로 찾는다
    def fp(u):
        for i in range(4):
            if xs[i] <= u <= xs[i + 1]: return v[i] + (v[i + 1] - v[i]) * (u - xs[i]) / 2
    grid = [i / 100 for i in range(1, 800)]; changes = [round(grid[i], 1) for i in range(1, len(grid)) if fp(grid[i - 1]) < -1e-9 and fp(grid[i + 1] if i + 1 < len(grid) else grid[i]) > 1e-9 and abs(fp(grid[i])) < 0.05]
    if not changes or abs(changes[0] - kmin) > 0.2: raise ValueError("independent_check_failed")
    stem = "The function $f$ is continuous on $[0,8]$ and has a continuous derivative $f'$. The graph of $f'$, consisting of line segments, is shown. At which value of $x$ does $f$ have a relative minimum?"
    key = Opt("$x=%d$" % kmin, True, "f' changes from negative to positive at this zero, so f has a relative minimum there (first derivative test).", kmin)
    bp = mc_blueprint("graph_fprime_extremum", SUB, "5.4", "2.D", "not_allowed", "Relate the graph of f' to relative extrema of f using sign changes",
        ["Read the zeros of f' from the graph", "Decide which zeros are sign changes of f' (negative to positive means a relative minimum)", "Reject zeros where f' touches zero without changing sign"],
        [("f is differentiable (f' continuous) so relative extrema occur only at zeros of f' with a sign change", "stated in the stem")], [("touch_zero", "treats any zero of f' as an extremum"), ("max_of_fprime", "confuses the maximum of f' with an extremum of f"), ("min_of_fprime", "confuses the minimum of f' with an extremum of f")],
        "sign change located by dense numerical sampling of the piecewise-linear f' (independent of the vertex-based generation)",
        material={"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6, 8", "axis labels"]})
    return pack("graph_fprime_extremum", "5.4", "2.D", "not_allowed", stem, key, pool, rng, stimulus=_graph("Graph of f', consisting of line segments connecting the plotted vertices.", "f'(x)", list(zip(xs, v)), [0, 8]), est=75, facts=[f"vertices={v}", f"min_at={kmin}"], extra={"blueprint": bp})

# ---- 그래프 MC 2: 누적 함수 값 g(b)=g(0)+∫f (6.4) — 부호 있는 넓이
def graph_accum_value(rng):
    xs = [0, 2, 4, 6, 8]
    while True:
        v = [rng.choice([-4, -2, 0, 2, 4, 6]) for _ in xs]
        if any(a * b < 0 for a, b in zip(v, v[1:])): continue      # 영점 사이의 부호 변화는 꼭짓점에서만
        if v.count(0) > 1 or all(a >= 0 for a in v): continue
        break
    g0 = rnd(rng, 1, 6); b = rng.choice([4, 6, 8]); n = b // 2
    seg = [v[i] + v[i + 1] for i in range(4)]                      # 폭 2 사다리꼴 넓이
    val = g0 + sum(seg[:n])
    fn = lambda u: next(v[i] + (v[i + 1] - v[i]) * (u - xs[i]) / 2 for i in range(4) if xs[i] <= u <= xs[i + 1])
    if abs(g0 + _I.quad(fn, 0, b, points=[2, 4, 6][: max(0, n - 1)])[0] - val) > 1e-6: raise ValueError("independent_check_failed")
    posonly = g0 + sum(max(0, s) for s in seg[:n]); noinit = sum(seg[:n]); halfw = g0 + sum(seg[:n]) / 2; wrongb = g0 + sum(seg[: n - 1]) if n > 1 else g0 + seg[0] + 2
    ds = [("g(0) forgotten", noinit), ("Counts only the positive areas and ignores the negative signed area.", posonly), ("Uses width 1 instead of width 2 for each trapezoid.", halfw), ("Stops one subinterval short of the upper limit.", wrongb)]
    pool = []; used = {val}
    for w_, k in ds:
        if k not in used: used.add(k); pool.append(Opt(fmt(k), False, w_ if "forgotten" not in w_ else "Forgets the initial value g(0) and reports the integral only.", k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    stem = f"The graph of the function $f$, consisting of line segments, is shown. Let $g(x)={g0}+\\int_0^x f(t)\\,dt$. What is the value of $g({b})$?"
    key = Opt(fmt(val), True, "Add g(0) to the signed area under f from 0 to the upper limit (trapezoid areas, negative where f is below the axis).", val)
    bp = mc_blueprint("graph_accum_value", SUB, "6.4", "2.B", "not_allowed", "Evaluate an accumulation function from the graph of its integrand (signed area)",
        ["Read the vertices of f from the graph", "Compute the signed area of each trapezoid from 0 to the upper limit", "Add the initial value g(0)"],
        [("f is continuous and piecewise linear so the area under each segment is a trapezoid", "stated by the graph description (line segments)")], [("forgets_initial_value", "reports the integral without the initial value"), ("ignores_negative_area", "counts only positive area"), ("wrong_width", "uses the wrong subinterval width")],
        "signed area computed by adaptive numerical integration of the piecewise-linear f (independent of the trapezoid formula)", material={"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return pack("graph_accum_value", "6.4", "2.B", "not_allowed", stem, key, pool, rng, stimulus=_graph("Graph of f, consisting of line segments connecting the plotted vertices.", "f(x)", list(zip(xs, v)), [0, 8]), est=80, facts=[f"vertices={v}", f"g({b})={val}"], extra={"blueprint": bp})

# ---- FRQ: 입자 운동(4.2, 계산기 필수)
def frq_particle_motion(rng):
    a_ = rng.choice([2, 3]); b_ = rng.choice([1.0, 1.5, 2.0]); T = rng.choice([4, 5]); x0 = rnd(rng, 1, 6)
    v = lambda tt: math.sin(tt * a_ / 2) * 3 + 0.5 * tt - b_
    vs, ts = sp.sin(t * sp.Rational(a_, 2)) * 3 + sp.Rational(1, 2) * t - sp.nsimplify(b_), sp.symbols("t")
    acc = sp.diff(vs, t); t0 = rng.choice([1, 2]); a0 = float(acc.subs(t, t0)); v0 = float(vs.subs(t, t0))
    # 속력 증가 판정: v 와 a 의 부호가 같으면 증가
    speeding = (v0 * a0) > 0; sgn = lambda z: "positive" if z > 0 else "negative"
    dist = _I.quad(lambda u: abs(v(u)), 0, T, limit=200)[0]; disp = _I.quad(v, 0, T)[0]
    if abs(dist - numeric_integral(lambda u: abs(v(u)), 0, T, 40001)) > 1e-3: raise ValueError("independent_check_failed")
    if abs(v0) < 0.2 or abs(a0) < 0.2 or abs(disp) < 0.3: raise ValueError("degenerate")
    xT = x0 + disp
    arg = "t" if a_ == 2 else "(3/2)t"   # sin 인수 표기: 계수 1 은 생략
    stim = {"kind": "text", "description": f"A particle moves along the x-axis. Its velocity is v(t) = 3 sin({arg}) + 0.5 t - {b_:g} for 0 ≤ t ≤ {T}, where t is in seconds and v is in meters per second. The particle is at position x = {x0} at time t = 0.", "data": {}}
    parts = [
        part("a", f"Find the acceleration of the particle at time $t={t0}$. Include units.", 1, "calculate", ["1.E", "4.B"], f"a({t0}) = v'({t0}) = {a0:.3f} meters per second squared.", [row("a1", 1, "Answer with units (differentiates v and evaluates; value correct)", [f"{a0:.3f}"], nums=True, tol="0.001", units=True)]),
        part("b", f"Is the speed of the particle increasing or decreasing at time $t={t0}$? Give a reason for your answer.", 2, "explain", ["3.E"], f"v({t0}) = {v0:.3f} is {sgn(v0)} and a({t0}) = {a0:.3f} is {sgn(a0)}; the signs are {'the same' if speeding else 'opposite'}, so the speed is {'increasing' if speeding else 'decreasing'}.", [
            row("b1", 1, "Determines the signs of velocity and acceleration at the given time", [f"{v0:.3f}", f"{a0:.3f}"], nums=True, both=True), row("b2", 1, "Concludes using the rule: same signs means speed increasing, opposite signs means decreasing (reason)", [("increasing" if speeding else "decreasing"), "signs"], both=True, requires="b1")]),
        part("c", f"Find the total distance traveled by the particle from time $t=0$ to $t={T}$.", 3, "calculate", ["1.E"], f"Total distance = ∫₀^{T} |v(t)| dt = {dist:.3f} meters.", [
            row("c1", 1, "Sets up the integral of the absolute value of velocity (|v|)", ["integral of |v(t)| from 0 to %d" % T]), row("c2", 1, "Evaluates with a calculator (value within tolerance)", [f"{dist:.3f}"], nums=True, tol="0.001", requires="c1"), row("c3", 1, "Answer with units", [f"{dist:.3f}"], nums=True, tol="0.001", units=True, requires="c2")]),
        part("d", f"Find the position of the particle at time $t={T}$.", 3, "calculate", ["1.E"], f"x({T}) = {x0} + ∫₀^{T} v(t) dt = {xT:.3f}.", [
            row("d1", 1, "Uses the initial position plus the integral of velocity (net change)", ["x(0) + integral of v(t)"]), row("d2", 1, "Evaluates the integral with a calculator (net displacement)", [f"{disp:.3f}"], nums=True, tol="0.001", requires="d1"), row("d3", 1, "Answer: the position", [f"{xT:.3f}"], nums=True, tol="0.001", requires="d2")]),
    ]
    for p_ in parts: p_["topic_codes"] = ["4.2" if p_["label"] in "ab" else "8.2"]
    pk = {"archetype": "frq_particle_motion", "template": "particle_motion_calc", "topic": "4.2", "extra_topics": ["8.2"], "skill": "3.E", "representative_skill": "3.E", "calculator": "required", "title": "Particle motion along a line", "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15,
          "facts": [f"a({t0})={a0:.4f}", f"v({t0})={v0:.4f}", f"dist={dist:.4f}", f"disp={disp:.4f}", f"xT={xT:.4f}"]}
    pk["blueprint"] = frq_blueprint("frq_particle_motion", SUB, pk, "Straight-line motion: acceleration, speed change, total distance, and position from a velocity function",
        ["Differentiate velocity to get acceleration", "Compare the signs of v and a to decide whether speed increases", "Integrate |v| for distance and v for net change"],
        [("v is continuous so |v| and v are integrable on the interval", "v(t) is a sum of sine and linear terms")], {"type": "text", "must_include": ["velocity function", "initial position", "time interval"]},
        "derivative and integrals by sympy/scipy cross-checked by a separate Simpson integration of |v| on a fine grid")
    return pk

# ---- FRQ: 관련 변화율(4.5, 계산기 불가) — 미끄러지는 사다리
def frq_related_rates(rng):
    L = rng.choice([10, 13, 25]); trip = {10: (6, 8), 13: (5, 12), 25: (7, 24)}[L]; x0, y0 = trip if rng.random() < 0.5 else (trip[1], trip[0])
    dxdt = rng.choice([2, 3, 4, S(3) / 2]); x_, y_ = sp.symbols("x y")
    dydt = -sp.Rational(x0) / y0 * sp.nsimplify(dxdt); area = x_ * y_ / 2
    darea = sp.nsimplify(dxdt) * y0 / 2 + x0 * dydt / 2     # d(xy/2)/dt = (x' y + x y')/2
    # 독립 경로: 시간 단계를 작게 잡아 x,y 를 갱신하며 면적 변화를 수치 근사
    hh = 1e-6; xn = x0 + float(dxdt) * hh; yn = math.sqrt(L * L - xn * xn); num = (xn * yn / 2 - x0 * y0 / 2) / hh
    if abs(num - float(darea)) > 1e-3: raise ValueError("independent_check_failed")
    stim = {"kind": "text", "description": f"A {L}-foot ladder leans against a vertical wall. The bottom of the ladder slides away from the wall at a constant rate of {sp.latex(sp.nsimplify(dxdt))} feet per second. Let x be the distance from the wall to the bottom of the ladder and y the height of the top of the ladder above the ground, in feet. At the instant when x = {x0}, y = {y0}.", "data": {}}
    parts = [
        part("a", "Write an equation that relates $x$, $y$ and the length of the ladder, and differentiate both sides with respect to time $t$.", 2, "explain", ["1.D", "3.B"], f"x^2 + y^2 = {L*L}; 2x dx/dt + 2y dy/dt = 0.", [row("a1", 1, "Writes the relationship x^2 + y^2 = L^2 (Pythagorean)", [f"x^2 + y^2 = {L*L}"]), row("a2", 1, "Differentiates implicitly with respect to t: 2x dx/dt + 2y dy/dt = 0", ["2x dx/dt + 2y dy/dt = 0"], requires="a1")]),
        part("b", f"Find the rate at which the height $y$ of the top of the ladder is changing when $x={x0}$. Indicate units of measure.", 3, "calculate", ["1.E", "4.B"], f"dy/dt = -(x/y) dx/dt = {sp.latex(dydt)} feet per second.", [
            row("b1", 1, "Substitutes the instant values and the given rate into the differentiated equation", [f"x = {x0}", f"y = {y0}"], nums=True, both=True), row("b2", 1, "Solves for dy/dt (answer)", [f"{dydt}"], nums=True, requires="b1"), row("b3", 1, "Units: feet per second", ["feet per second"], units=True, requires="b2")]),
        part("c", "Is the top of the ladder moving up or down at that instant? Explain using your answer to part (b).", 1, "explain", ["3.F"], f"Down, because dy/dt = {dydt} is negative.", [row("c1", 1, "Interprets the sign of dy/dt (negative means the height is decreasing)", ["negative", "down"], both=True)]),
        part("d", f"The triangle formed by the ladder, the wall and the ground has area $A=\\frac{{1}}{{2}}xy$. Find the rate of change of $A$ at the instant when $x={x0}$.", 3, "calculate", ["1.E", "3.B"], f"dA/dt = (1/2)(dx/dt · y + x · dy/dt) = {sp.latex(darea)} square feet per second.", [
            row("d1", 1, "Applies the product rule: dA/dt = (1/2)(x' y + x y')", ["product rule"]), row("d2", 1, "Substitutes the instant values and the rates from the previous parts", [f"{dydt}"], nums=True, requires="d1"), row("d3", 1, "Answer", [f"{darea}"], nums=True, requires="d2")]),
    ]
    for p_ in parts: p_["topic_codes"] = ["4.4" if p_["label"] in "ac" else "4.5"]
    pk = {"archetype": "frq_related_rates", "template": "related_rates_setup", "topic": "4.5", "extra_topics": ["4.4", "3.2"], "skill": "1.E", "representative_skill": "1.E", "calculator": "not_allowed", "title": "Related rates: a sliding ladder", "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15,
          "facts": [f"L={L}", f"x0={x0}", f"y0={y0}", f"dxdt={dxdt}", f"dydt={dydt}", f"dAdt={darea}"]}
    pk["blueprint"] = frq_blueprint("frq_related_rates", SUB, pk, "Related rates from a geometric constraint (sliding ladder), interpretation, and a derived quantity",
        ["Set up the geometric relationship among the changing quantities", "Differentiate implicitly with respect to time and substitute the instant", "Interpret the sign and apply the product rule for the area"],
        [("The ladder stays in contact with the wall and ground so x^2 + y^2 = L^2 at every time", "stated in the stimulus")], {"type": "text", "must_include": ["ladder length", "rate of x", "instant values of x and y"]},
        "dy/dt and dA/dt by sympy cross-checked by a finite-difference time step on the constraint (independent of the implicit differentiation)")
    return pk

# ---- FRQ: 음함수 미분(3.2, 계산기 불가)
def frq_implicit_diff(rng):
    A, B = rng.choice([(2, 2), (1, 1)]); xh = rng.choice([1, 2, 3]); cval = xh * xh * ((B - 1) if A == 2 else 3)   # y=-2x/A 를 곡선에 넣으면 x^2*(4B/A^2-1)=c → 수평 접선 점이 유리수
    xx, yy = sp.symbols("x y"); F = xx ** 2 + A * xx * yy + B * yy ** 2
    pts = [(p, q) for p in range(-4, 5) for q in range(-4, 5) if int(F.subs({xx: p, yy: q})) == cval and (A * p + 2 * B * q) != 0 and (p, q) != (0, 0)]
    if not pts: raise ValueError("no_integer_point")
    pts = [(p_, q_) for p_, q_ in pts if (2 * p_ + A * q_) != 0]
    if not pts: raise ValueError("no_nonzero_slope_point")
    p, q = rng.choice(pts)
    dydx = -(2 * xx + A * yy) / (A * xx + 2 * B * yy); sl = dydx.subs({xx: p, yy: q}); y2 = sp.diff(dydx, xx) + sp.diff(dydx, yy) * dydx; s2 = sp.simplify(y2.subs({xx: p, yy: q}))
    eps = 1e-6; g = lambda xv, yv: float(F.subs({xx: xv, yy: yv}))
    # 독립 경로: 점 근처에서 곡선 위의 점을 수치로 풀어(뉴턴) 중심 차분으로 기울기 계산
    def yroot(xv, y_start):
        yv = y_start
        for _ in range(60):
            d = float(sp.diff(F, yy).subs({xx: xv, yy: yv})); yv -= (g(xv, yv) - cval) / d
        return yv
    num = (yroot(p + eps, q) - yroot(p - eps, q)) / (2 * eps)
    if abs(num - float(sl)) > 1e-4: raise ValueError("independent_check_failed")
    hor = sp.solve(sp.Eq(2 * xx + A * yy, 0), yy)[0]       # 수평 접선: y = -2x/A
    cx = sp.solve(sp.Eq(F.subs(yy, hor), cval), xx); cx = sorted([c for c in cx if c.is_real], key=lambda z: float(z))
    if not cx or any(not c.is_rational for c in cx): raise ValueError("irrational_horizontal_points")
    htext = ", ".join(f"({sp.latex(c)}, {sp.latex(sp.simplify(hor.subs(xx, c)))})" for c in cx)
    stim = {"kind": "text", "description": f"Consider the curve given by the equation x^2 + {A}xy + {B}y^2 = {cval}.", "data": {}}
    parts = [
        part("a", "Show that $\\dfrac{dy}{dx}=-\\dfrac{2x+%dy}{%dx+%dy}$." % (A, A, 2 * B), 3, "explain", ["1.D", "3.B"], f"Differentiating implicitly: 2x + {A}(y + x dy/dx) + {2*B}y dy/dx = 0, so dy/dx = -(2x + {A}y)/({A}x + {2*B}y).", [
            row("a1", 1, "Differentiates x^2 and the product xy correctly (product rule)", ["2x", f"{A}(y + x dy/dx)"], both=True), row("a2", 1, "Differentiates the y^2 term with the chain rule", [f"{2*B}y dy/dx"]), row("a3", 1, "Isolates dy/dx to reach the stated expression", ["dy/dx"], requires="a2")]),
        part("b", f"Write an equation for the line tangent to the curve at the point $({p},{q})$.", 2, "calculate", ["1.E", "4.C"], f"Slope {sp.latex(sl)}; y - {q} = {sp.latex(sl)}(x - {p}).", [row("b1", 1, "Slope at the point (answer)", [f"{sl}"], nums=True), row("b2", 1, "Tangent line equation in point-slope form", [f"y - {q}"], requires="b1")]),
        part("c", "Find the coordinates of every point on the curve at which the tangent line is horizontal.", 2, "calculate", ["1.E"], f"Horizontal tangent when 2x + {A}y = 0, i.e. y = -2x/{A}; the points are {htext}.", [row("c1", 1, "Sets the numerator of dy/dx equal to zero (2x + %dy = 0)" % A, [f"2x + {A}y = 0"]), row("c2", 1, "Substitutes into the curve equation and finds the points (answer)", [htext], nums=True, requires="c1")]),
        part("d", f"Write an equation for the line normal to the curve at the point $({p},{q})$ (the line perpendicular to the tangent line there).", 2, "calculate", ["1.E", "4.C"], f"Normal slope = {sp.latex(-1 / sl)}; y - {q} = {sp.latex(-1 / sl)}(x - {p}).", [
            row("d1", 1, "Normal slope is the negative reciprocal of the tangent slope (answer)", [f"{-1 / sl}"], nums=True), row("d2", 1, "Equation of the normal line in point-slope form", [f"y - {q}"], requires="d1")]),
    ]
    for p_ in parts: p_["topic_codes"] = ["3.2"]
    pk = {"archetype": "frq_implicit_diff", "template": "implicit_differentiation", "topic": "3.2", "extra_topics": [], "skill": "1.E", "representative_skill": "1.E", "calculator": "not_allowed", "title": "Implicit differentiation on a curve", "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15,
          "facts": [f"curve={A},{B},{cval}", f"point={p},{q}", f"slope={sl}", f"horizontal={htext}"]}
    pk["blueprint"] = frq_blueprint("frq_implicit_diff", SUB, pk, "Implicit differentiation: derivative formula, tangent line, horizontal tangents, and normal line",
        ["Differentiate both sides implicitly with the product and chain rules", "Evaluate the derivative at a point for a tangent line and find where the numerator is zero", "Use the negative reciprocal slope for the normal line"],
        [("The curve is differentiable where the denominator A x + 2B y is nonzero", "the chosen point satisfies this")], {"type": "text", "must_include": ["curve equation", "a point on the curve"]},
        "slope computed by sympy implicit differentiation cross-checked by a Newton-solved curve point and central finite difference (independent of the formula)")
    return pk
