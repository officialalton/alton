"""BC4·BC5 확대 라운드(2026-10-19) BC 전용 FRQ 새 원형 7종. 공개 BC 세트의 FRQ(매개 운동 속도·접선·거리, 극곡선 넓이·r'·기울기·최고점, Maclaurin·수렴구간, 테일러-미분방정식, 오일러-로지스틱, 이상적분-부분적분)와
풀이 틀이 다르다: 속도 벡터에서 위치(계산기), 급수 추정(계산기), 급수 판정 4문제, 사이클로이드, 테일러 표-라그랑주, 장미 곡선, 이상적분-아크탄젠트(계산기).
모든 값은 코드가 계산하고 독립 경로(수치 적분·부분합·유한차분)로 확인한다. 설정은 모두 학생에게 보이는 파트 (a) 문장에 둔다."""
from calc_r3_x4_lib import *
from bp import frq_blueprint
from calc_ab_frq import row, part
from scipy import optimize as _O

SUBF = "ap_calculus_bc"
TT = sp.Symbol("t", real=True)
f3 = lambda v: "%.3f" % v


def _pack(arch, template, topic, extra, calc, title, stim, parts, topic_codes, facts, concept, thinking, cond, material, path, rep_skill="1.E"):
    for p_, tc in zip(parts, topic_codes):
        p_["topic_codes"] = tc
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": rep_skill, "representative_skill": rep_skill, "calculator": calc, "title": title,
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": facts}
    pk["blueprint"] = frq_blueprint(arch, SUBF, pk, concept, thinking, cond, material, path)
    return pk


# F1 (계산기 필수, Part A): 속도 벡터 + 처음 위치 → 가속도·속력 변화·위치·수평 운동 시각·이동 거리
def frq_x4_velocity_vector_calc(rng):
    p, r = rng.choice([3, 4, 5]), rng.choice([2, 3])
    x0, y0 = rng.randint(1, 4), rng.randint(1, 4)
    xp = lambda u: u * u - p * u
    yp = lambda u: math.exp(u / 2) - r
    # (a) t=1: 가속도와 속력 변화
    ax, ay = 2 * 1 - p, 0.5 * math.exp(0.5)
    vx1, vy1 = xp(1), yp(1)
    dot = vx1 * ax + vy1 * ay
    if abs(dot) < 0.2:
        raise ValueError("dot_too_small")
    inc = dot > 0
    spf = lambda u: math.hypot(xp(u), yp(u))
    if ((spf(1 + 1e-6) - spf(1 - 1e-6)) > 0) != inc:
        raise ValueError("independent_check_failed")
    # (b) t=3 위치
    X3 = x0 + QI.quad(xp, 0, 3)[0]; Y3 = y0 + QI.quad(yp, 0, 3)[0]
    ex = x0 + 9 - 4.5 * p; ey = y0 + 2 * (math.exp(1.5) - 1) - 3 * r
    if abs(X3 - ex) > 1e-9 or abs(Y3 - ey) > 1e-9:
        raise ValueError("independent_check_failed")
    # (c) 수평 운동: y'(t) = 0
    th = 2 * math.log(r)
    if abs(yp(th)) > 1e-9 or not (0 < th < 3):
        raise ValueError("bad_horizontal")
    th_b = _O.brentq(yp, 0.01, 2.999)
    if abs(th_b - th) > 1e-9:
        raise ValueError("independent_check_failed")
    # (d) 이동 거리
    dist = QI.quad(spf, 0, 3, points=[1, 3 if p == 3 else 1])[0]
    n = 30001; hh = 3 / (n - 1)
    simp = hh / 3 * (spf(0) + spf(3) + sum((4 if i % 2 else 2) * spf(i * hh) for i in range(1, n - 1)))
    if abs(simp - dist) > 1e-5:
        raise ValueError("independent_check_failed")
    xpt = f"t^2-{p}t"
    stim = {"kind": "text", "description": "Velocity vector of a moving object", "data": {"v(t)": f"<{xpt}, e^(t/2)-{r}>", "position at t=0": f"({x0}, {y0})"}}
    pre = f"An object moves in the $xy$-plane so that its velocity vector at time $t\\ge 0$, in meters per second, is $\\vec v(t)=\\left\\langle t^2-{p}t,\\ e^{{t/2}}-{r}\\right\\rangle$. At time $t=0$ the object is at the point $({x0},{y0})$."
    acc = f"<{2 - p}, {f3(ay)}>"
    parts = [
        part("a", pre + " Find the acceleration vector of the object at $t=1$. Is the speed of the object increasing or decreasing at $t=1$? Give a reason for your answer.", 2, "explain", ["1.E", "3.E"],
             f"$\\vec a(t)=\\langle 2t-{p},\\ \\tfrac12e^{{t/2}}\\rangle$, so $\\vec a(1)={acc}$. $\\vec v(1)\\cdot\\vec a(1)={f3(dot)}$ is {'positive' if inc else 'negative'}, so the speed is {'increasing' if inc else 'decreasing'}.", [
            row("a1", 1, "Acceleration vector at t = 1 (value)", [acc], nums=True, tol="±0.001"),
            row("a2", 1, f"Conclusion: speed is {'increasing' if inc else 'decreasing'}, with the reason that v(1) . a(1) is {'positive' if inc else 'negative'}", [f"v . a is {'positive' if inc else 'negative'}", "increasing" if inc else "decreasing"], both=True, requires="a1")]),
        part("b", f"Find the position $\\bigl(x(3),y(3)\\bigr)$ of the object at time $t=3$. Write the integrals that lead to your answer.", 3, "calculate", ["1.D", "1.E"],
             f"$x(3)={x0}+\\int_0^3(t^2-{p}t)\\,dt={f3(X3)}$ and $y(3)={y0}+\\int_0^3(e^{{t/2}}-{r})\\,dt={f3(Y3)}$.", [
            row("b1", 1, "Position equals initial position plus the integral of each velocity component from 0 to 3 (setup)", [f"{x0} + ∫_0^3 x'(t) dt", f"{y0} + ∫_0^3 y'(t) dt"], both=True),
            row("b2", 1, "x-coordinate (value)", [f3(X3)], requires="b1", nums=True, tol="±0.001"), row("b3", 1, "y-coordinate (value)", [f3(Y3)], requires="b1", nums=True, tol="±0.001")]),
        part("c", "For $0<t<3$, find the time at which the object is moving horizontally (the tangent line to its path is horizontal).", 2, "calculate", ["1.E", "2.B"],
             f"The object moves horizontally when $y'(t)=0$: $e^{{t/2}}={r}$, so $t=2\\ln {r}={f3(th)}$.", [
            row("c1", 1, "Sets the vertical component y'(t) equal to zero (setup)", [f"e^(t/2) - {r} = 0"]), row("c2", 1, "Time (value)", [f3(th)], requires="c1", nums=True, tol="±0.001")]),
        part("d", "Find the total distance traveled by the object from $t=0$ to $t=3$.", 2, "calculate", ["1.D", "1.E"], f"{f3(dist)}", [
            row("d1", 1, "Integral of the speed from 0 to 3 (setup)", ["∫_0^3 sqrt((x')^2 + (y')^2) dt"]), row("d2", 1, "Answer (value)", [f3(dist)], requires="d1", nums=True, tol="±0.001")])]
    return _pack("frq_x4_velocity_vector_calc", "velocity_vector_position_calc", "9.5", ["9.4", "9.6"], "required", "An object with a given velocity vector: acceleration, speed, position, horizontal motion, distance",
                 stim, parts, [["9.4"], ["9.5"], ["9.6"], ["9.6"]], [f"p={p},r={r}", f"x0={x0},y0={y0}", f"pos3=({X3:.5f},{Y3:.5f})", f"dist={dist:.5f}", f"th={th:.5f}"],
                 "Work with a moving object whose velocity vector is given: acceleration, direction of speed change, position by integrating, horizontal-motion time, and total distance",
                 ["Differentiate the velocity to get acceleration and use v . a for the change of speed", "Integrate each component from the initial position", "Set y' = 0 for a horizontal tangent", "Integrate the speed for the distance"],
                 [("the position equals the initial position plus the integral of the velocity components", "x' and y' are continuous on [0, 3]")], {"type": "text", "must_include": ["velocity vector", "initial position"]},
                 "central difference of the speed at t = 1, scipy quad of each component, Brent root of y'(t), and a 30001-point Simpson rule for the distance (independent of the closed forms and of the integral setups)")


# F2 (계산기 필수, Part A): 급수 추정 — 비교판정, 교대급수 오차, 적분판정 나머지 한계, 극한비교
def frq_x4_series_estimate_calc(rng):
    c = rng.choice([2, 3, 4])
    an = lambda n: 1 / (n * n + c)
    S8 = sum((-1) ** (n + 1) * an(n) for n in range(1, 9))
    Sbig = sum((-1) ** (n + 1) * an(n) for n in range(1, 400000))
    b9 = an(9)
    if abs(Sbig - S8) > b9 + 1e-12 or abs(Sbig - S8) < 0.2 * b9:
        raise ValueError("independent_check_failed")
    sc = math.sqrt(c)
    tail = lambda N: (1 / sc) * (math.pi / 2 - math.atan(N / sc))
    N = 1
    while tail(N) >= 0.01:
        N += 1
    # 독립 경로: 실제 나머지 합(큰 항수)이 적분 한계보다 작고, N-1 에서는 한계가 0.01 이상
    real_rem = sum(an(n) for n in range(N + 1, 600000)) + tail(600000)
    if real_rem > tail(N) + 1e-9 or tail(N - 1) < 0.01:
        raise ValueError("independent_check_failed")
    lim = 1.0
    ratio = ((1e6 + 1) / (1e6 ** 3 + c)) / (1 / 1e6 ** 2)
    if abs(ratio - lim) > 1e-4:
        raise ValueError("independent_check_failed")
    stim = {"kind": "text", "description": "Three related series", "data": {"series": f"sum 1/(n^2+{c}); sum (-1)^(n+1)/(n^2+{c}); sum (n+1)/(n^3+{c})"}}
    pre = f"Consider the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{1}}{{n^2+{c}}}$."
    parts = [
        part("a", pre + " Determine whether this series converges or diverges. Give a reason for your answer.", 2, "explain", ["3.B", "3.D"],
             f"For $n\\ge1$, $0<\\dfrac{{1}}{{n^2+{c}}}<\\dfrac{{1}}{{n^2}}$ and $\\sum\\dfrac{{1}}{{n^2}}$ is a $p$-series with $p=2>1$, so the series converges by the Direct Comparison Test.", [
            row("a1", 1, "Compares the terms with those of the p-series sum 1/n^2: positive terms bounded above by 1/n^2", ["1/(n^2+c) < 1/n^2", "p-series with p = 2"], both=True),
            row("a2", 1, "Gives the conclusion that the series converges, supported by the comparison", ["converges"], requires="a1")]),
        part("b", f"The alternating series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{(-1)^{{n+1}}}}{{n^2+{c}}}$ converges to a sum $S$. Let $S_8$ be the sum of its first eight terms. Find $S_8$, and use the Alternating Series Error Bound to find a bound on $|S-S_8|$.", 2, "calculate", ["1.E", "1.F"],
             f"$S_8={S8:.3f}$ and $|S-S_8|\\le a_9=\\dfrac{{1}}{{81+{c}}}={b9:.4f}$.", [
            row("b1", 1, "Partial sum S_8 (value)", [f"{S8:.3f}"], nums=True, tol="±0.001"), row("b2", 1, "Error bound is the first omitted term a_9 (value)", [f"{b9:.4f}", f"1/{81 + c}"], nums=True, tol="±0.0001")]),
        part("c", f"Let $R_N=\\displaystyle\\sum_{{n=N+1}}^{{\\infty}}\\dfrac{{1}}{{n^2+{c}}}$ be the remainder after the first $N$ terms of the series in part (a). Use an improper integral to show that $R_N\\le\\displaystyle\\int_N^{{\\infty}}\\dfrac{{dx}}{{x^2+{c}}}$, and find the least integer $N$ for which this integral is less than $0.01$.", 3, "calculate", ["3.D", "1.E"],
             f"Because $\\dfrac{{1}}{{x^2+{c}}}$ is positive and decreasing, $R_N\\le\\int_N^{{\\infty}}\\dfrac{{dx}}{{x^2+{c}}}=\\dfrac{{1}}{{\\sqrt{{{c}}}}}\\left(\\dfrac{{\\pi}}{{2}}-\\arctan\\dfrac{{N}}{{\\sqrt{{{c}}}}}\\right)$, which is less than $0.01$ first for $N={N}$.", [
            row("c1", 1, "Uses that the function is positive and decreasing so the tail is bounded by the improper integral from N", ["positive and decreasing", "R_N <= ∫_N^∞"], both=True),
            row("c2", 1, "Evaluates the improper integral with an arctangent antiderivative", [f"(1/sqrt({c}))(π/2 - arctan(N/sqrt({c})))"], requires="c1"),
            row("c3", 1, "Least integer N (value)", [str(N)], requires="c2", nums=True)]),
        part("d", f"Determine whether the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{n+1}}{{n^3+{c}}}$ converges or diverges. Give a reason for your answer.", 2, "explain", ["3.B", "3.D"],
             f"$\\displaystyle\\lim_{{n\\to\\infty}}\\dfrac{{(n+1)/(n^3+{c})}}{{1/n^2}}=1$, which is positive and finite, and $\\sum\\dfrac{{1}}{{n^2}}$ converges, so the series converges by the Limit Comparison Test.", [
            row("d1", 1, "Limit of the ratio with 1/n^2 equals 1", ["limit = 1"], nums=True), row("d2", 1, "Gives the reason for the conclusion: converges, by limit comparison with the convergent p-series", ["converges", "limit comparison"], both=True, requires="d1")])]
    return _pack("frq_x4_series_estimate_calc", "series_estimate_calc", "10.6", ["10.4", "10.7", "10.10"], "required", "Comparison test, alternating error bound, integral-test remainder, and limit comparison",
                 stim, parts, [["10.6"], ["10.10"], ["10.4"], ["10.6"]], [f"c={c}", f"S8={S8:.6f}", f"N={N}"],
                 "Decide convergence by comparison, estimate an alternating sum with its error bound, bound a remainder with the integral test, and use limit comparison",
                 ["Compare with the p-series", "Compute S_8 and use the first omitted term as the error bound", "Bound the remainder by the improper integral and solve for N", "Use the limit of the ratio of terms"],
                 [("the terms are positive and decreasing", "so the comparison tests and the integral test apply")], {"type": "text", "must_include": ["general term", "series"]},
                 "400000-term partial sums for the alternating series, a 600000-term remainder sum compared with the integral bound, and the term ratio at n = 10^6 (independent of the test arguments)", "3.D")


# F3 (계산기 불가): 서로 다른 네 급수의 수렴 판정
def frq_x4_series_classify(rng):
    k = rng.choice([1, 2, 3]); m = rng.choice([2, 3, 4]); pexp = rng.choice([Fr(1, 2), Fr(1, 3)]); bb = rng.choice([2, 3, 4])
    # (b) 망원급수 1/(n(n+m)) 의 합 = H_m / m
    Hm = sum(Fr(1, i) for i in range(1, m + 1)); sumb = Hm / m
    part_n = lambda M: sum(1 / (n * (n + m)) for n in range(1, M))
    if abs(part_n(200000) - float(sumb)) > 1e-4:
        raise ValueError("independent_check_failed")
    # (a) 항이 0 으로 가지 않는다
    if abs((1e8 + k) / (2 * 1e8 + 1) - 0.5) > 1e-6:
        raise ValueError("independent_check_failed")
    # (d) 비율의 극한
    if abs(((bb ** 121 / math.factorial(121)) / (bb ** 120 / math.factorial(120)))) > 0.05:
        raise ValueError("independent_check_failed")
    pp = "1/2" if pexp == Fr(1, 2) else "1/3"
    # (c) 교대급수의 거동: 부분합이 수렴하고 절댓값 부분합은 계속 커진다
    sa = [sum(abs(((-1) ** n) / n ** float(pexp)) for n in range(1, M)) for M in (10 ** 3, 10 ** 5)]
    if sa[1] < 1.4 * sa[0]:
        raise ValueError("independent_check_failed")
    stim = {"kind": "text", "description": "Four infinite series", "data": {"a": f"sum (n+{k})/(2n+1)", "b": f"sum 1/(n(n+{m}))", "c": f"sum (-1)^n/n^{pexp}", "d": f"sum {bb}^n/n!"}}
    sbt = sp.latex(sp.Rational(sumb.numerator, sumb.denominator))
    parts = [
        part("a", f"Determine whether the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{n+{k}}}{{2n+1}}$ converges or diverges. Give a reason for your answer.", 2, "explain", ["3.B", "3.D"],
             f"$\\lim_{{n\\to\\infty}}\\dfrac{{n+{k}}}{{2n+1}}=\\dfrac12\\ne0$, so the series diverges by the $n$th-term test.", [
            row("a1", 1, "Limit of the general term equals 1/2, which is not 0", ["limit = 1/2"], nums=True), row("a2", 1, "Gives the reason for the conclusion: diverges by the nth-term test", ["diverges", "nth-term test"], both=True, requires="a1")]),
        part("b", f"Show that the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{1}}{{n(n+{m})}}$ converges and find its sum. (Write the general term as a difference of two simple fractions.)", 2, "calculate", ["1.E", "3.D"],
             f"$\\dfrac{{1}}{{n(n+{m})}}=\\dfrac{{1}}{{{m}}}\\left(\\dfrac{{1}}{{n}}-\\dfrac{{1}}{{n+{m}}}\\right)$; the partial sums telescope and the sum is ${sbt}$.", [
            row("b1", 1, "Partial fractions decomposition", [f"(1/{m})(1/n - 1/(n+{m}))"]), row("b2", 1, "Telescoping gives the sum (value)", [sbt, str(sumb)], requires="b1", nums=True)]),
        part("c", f"Does the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{(-1)^n}}{{n^{{{pp}}}}}$ converge absolutely, converge conditionally, or diverge? Justify your answer.", 3, "explain", ["3.B", "3.D", "3.E"],
             f"The terms alternate, $\\dfrac{{1}}{{n^{{{pp}}}}}$ decreases and approaches $0$, so the series converges by the Alternating Series Test. The series of absolute values $\\sum\\dfrac{{1}}{{n^{{{pp}}}}}$ is a $p$-series with $p={pp}\\le1$, so it diverges. The series converges conditionally.", [
            row("c1", 1, "Checks the Alternating Series Test conditions: terms decrease and approach 0", ["decreasing", "limit 0"], both=True), row("c2", 1, "Series converges by the Alternating Series Test", ["converges", "Alternating Series Test"], both=True, requires="c1"),
            row("c3", 1, "Absolute series is a divergent p-series, so the convergence is conditional", ["p-series", "diverges", "conditionally"], both=True, requires="c2")]),
        part("d", f"Determine whether the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{{bb}^n}}{{n!}}$ converges or diverges. Justify your answer.", 2, "explain", ["3.B", "3.D"],
             f"$\\displaystyle\\lim_{{n\\to\\infty}}\\dfrac{{{bb}^{{n+1}}/(n+1)!}}{{{bb}^n/n!}}=\\lim\\dfrac{{{bb}}}{{n+1}}=0<1$, so the series converges by the Ratio Test.", [
            row("d1", 1, "Limit of the ratio of consecutive terms equals 0", ["limit = 0"], nums=True), row("d2", 1, "Gives the reason for the conclusion: converges by the Ratio Test since the limit is less than 1", ["converges", "Ratio Test"], both=True, requires="d1")])]
    return _pack("frq_x4_series_classify", "series_four_tests", "10.3", ["10.2", "10.7", "10.8", "10.9"], "not_allowed", "Four series: nth-term test, telescoping sum, absolute versus conditional convergence, ratio test",
                 stim, parts, [["10.3"], ["10.2"], ["10.9"], ["10.8"]], [f"k={k},m={m}", f"p={pexp}", f"b={bb}", f"sum={sumb}"],
                 "Choose and justify the right convergence test for four unrelated series and find the sum of a telescoping series",
                 ["Test the limit of the terms", "Use partial fractions to telescope", "Check alternating-series conditions and the absolute series", "Use the ratio of consecutive terms"],
                 [("each test is applied only when its hypotheses hold", "terms are positive for (a), (b), (d) and alternate and decrease for (c)")], {"type": "text", "must_include": ["four series"]},
                 "partial sums of 200000 terms for the telescoping series, the size of the general term at n = 10^8, the term ratio at n = 120, and absolute partial sums at 10^3 and 10^5 terms (independent of the symbolic limits)", "3.D")


# F4 (계산기 불가): 사이클로이드 x = a(t - sin t), y = a(1 - cos t)
def frq_x4_cycloid_exact(rng):
    a = rng.choice([1, 2, 3])
    pi = sp.pi
    X = a * (TT - sp.sin(TT)); Y = a * (1 - sp.cos(TT))
    xp, yp = sp.diff(X, TT), sp.diff(Y, TT)
    slope = sp.simplify((yp / xp).subs(TT, pi / 2))
    x0, y0 = sp.simplify(X.subs(TT, pi / 2)), sp.simplify(Y.subs(TT, pi / 2))
    d2 = sp.simplify((sp.diff(yp / xp, TT) / xp).subs(TT, pi / 2))
    hx, hy = sp.simplify(X.subs(TT, pi)), sp.simplify(Y.subs(TT, pi))
    L = sp.integrate(2 * a * sp.sin(TT / 2), (TT, 0, pi))
    # 독립 경로: 수치 접선 기울기·이계도함수·호의 길이
    xf, yf = sp.lambdify(TT, X, "math"), sp.lambdify(TT, Y, "math")
    t0, hh = math.pi / 2, 1e-4
    g = lambda u: (yf(u + 1e-6) - yf(u - 1e-6)) / (xf(u + 1e-6) - xf(u - 1e-6))
    num_slope = g(t0); num_d2 = (g(t0 + hh) - g(t0 - hh)) / (xf(t0 + hh) - xf(t0 - hh))
    num_L = QI.quad(lambda u: math.hypot(a * (1 - math.cos(u)), a * math.sin(u)), 0, math.pi)[0]
    if abs(num_slope - float(slope)) > 1e-5 or abs(num_d2 - float(d2)) > 1e-3 or abs(num_L - float(L)) > 1e-9 or abs(float(yp.subs(TT, pi))) > 1e-12:
        raise ValueError("independent_check_failed")
    ltx = sp.latex
    xs = ltx(sp.simplify(x0))
    stim = {"kind": "text", "description": "A cycloid", "data": {"x(t)": f"{a}(t - sin t)", "y(t)": f"{a}(1 - cos t)"}}
    ax = "" if a == 1 else str(a)
    pre = f"A curve is defined by the parametric equations $x(t)={ax}(t-\\sin t)$ and $y(t)={ax}(1-\\cos t)$ for $0\\le t\\le 2\\pi$."
    parts = [
        part("a", pre + " Find $\\dfrac{dy}{dx}$ at $t=\\dfrac{\\pi}{2}$ and write an equation for the line tangent to the curve at $t=\\dfrac{\\pi}{2}$.", 2, "calculate", ["1.E"],
             f"$\\dfrac{{dy}}{{dx}}=\\dfrac{{\\sin t}}{{1-\\cos t}}=1$ at $t=\\frac{{\\pi}}{{2}}$; the point is $\\left({xs},{a}\\right)$, so $y-{a}=x-({xs})$.", [
            row("a1", 1, "dy/dx = (dy/dt)/(dx/dt) at t = π/2 (value 1)", ["dy/dx = 1"], nums=True), row("a2", 1, "Tangent line through the point (x(π/2), y(π/2))", [f"y - {a} = x - ({xs})"], requires="a1")]),
        part("b", "For $0<t<2\\pi$, find the value of $t$ at which the curve has a horizontal tangent line, and find the coordinates of that point.", 2, "calculate", ["1.E", "2.D"],
             f"$\\dfrac{{dy}}{{dt}}={ax}\\sin t=0$ at $t=\\pi$, where $\\dfrac{{dx}}{{dt}}={ax}(1-\\cos\\pi)={2 * a}\\ne0$. The point is $({ltx(hx)},{hy})$.", [
            row("b1", 1, "Solves dy/dt = 0 on the interval and checks dx/dt is not 0", ["t = π", "dx/dt ≠ 0"], both=True), row("b2", 1, "Coordinates of the point", [f"({ltx(hx)}, {hy})"], requires="b1", nums=True)]),
        part("c", "Find the value of $\\dfrac{d^2y}{dx^2}$ at $t=\\dfrac{\\pi}{2}$. Is the curve concave up or concave down at this point? Give a reason.", 2, "explain", ["1.E", "3.E"],
             f"$\\dfrac{{d^2y}}{{dx^2}}=\\dfrac{{\\frac{{d}}{{dt}}\\left(dy/dx\\right)}}{{dx/dt}}=-\\dfrac{{1}}{{{ax}(1-\\cos t)^2}}$, which equals ${ltx(d2)}$ at $t=\\frac{{\\pi}}{{2}}$. It is negative, so the curve is concave down.", [
            row("c1", 1, "Value of d2y/dx2 at t = π/2", [ltx(d2), str(d2)], nums=True), row("c2", 1, "Gives the reason: concave down because the second derivative is negative", ["concave down", "negative"], both=True, requires="c1")]),
        part("d", f"Find the length of the portion of the curve from $t=0$ to $t=\\pi$. (Use $1-\\cos t=2\\sin^2\\!\\dfrac{{t}}{{2}}$.)", 3, "calculate", ["1.D", "1.E"],
             f"$\\sqrt{{(x')^2+(y')^2}}={ax}\\sqrt{{2-2\\cos t}}={2 * a}\\sin\\dfrac{{t}}{{2}}$ on $[0,\\pi]$, so the length is $\\int_0^{{\\pi}}{2 * a}\\sin\\dfrac{{t}}{{2}}\\,dt={ltx(L)}$.", [
            row("d1", 1, "Integral of sqrt((x')^2 + (y')^2) from 0 to π (setup)", ["∫_0^π sqrt((x')^2 + (y')^2) dt"]), row("d2", 1, "Simplifies the integrand to 2a sin(t/2) using the half-angle identity", [f"{2 * a} sin(t/2)"], requires="d1"),
            row("d3", 1, "Value of the length", [ltx(L), str(L)], requires="d2", nums=True)])]
    return _pack("frq_x4_cycloid_exact", "cycloid_exact", "9.1", ["9.2", "9.3"], "not_allowed", "A cycloid: tangent line, horizontal tangent, concavity, and arc length by a half-angle identity",
                 stim, parts, [["9.1"], ["9.1"], ["9.2"], ["9.3"]], [f"a={a}", f"slope={slope}", f"d2={d2}", f"L={L}"],
                 "Analyze a cycloid with exact calculus: dy/dx, a horizontal tangent, the sign of d2y/dx2, and arc length using a trigonometric identity",
                 ["Compute dy/dx from the parametric derivatives", "Solve dy/dt = 0", "Differentiate dy/dx with respect to t and divide by dx/dt", "Simplify the arc length integrand with the half-angle identity"],
                 [("dx/dt is nonzero at the points used", "x'(t) = a(1 - cos t) is positive except at t = 0 and 2 pi")], {"type": "text", "must_include": ["parametric equations", "interval of t"]},
                 "finite-difference slope and second derivative of the sampled curve and scipy quad of the speed over [0, pi] (independent of the symbolic derivative and the half-angle simplification)")


# F5 (계산기 불가): 테일러 다항식 표와 라그랑주 오차한계
def frq_x4_taylor_table_lagrange(rng):
    a = rng.choice([1, 2]); c0 = rng.randint(2, 7); c2 = rng.choice([-6, -4, 4, 6, 8, -8]); c3 = rng.choice([-6, -3, 3, 6, 9, 12]); M = rng.choice([24, 48])
    h = Fr(1, 2)
    P3 = lambda u: Fr(c0) + Fr(c2, 2) * u ** 2 + Fr(c3, 6) * u ** 3
    approx = P3(h); bound = Fr(M, 24) * h ** 4
    # 독립 경로: 다항식 P3 자체를 직접 전개해 같은 값을 얻는다
    Xs = sp.Symbol("x")
    poly = sp.expand(c0 + sp.Rational(c2, 2) * (Xs - a) ** 2 + sp.Rational(c3, 6) * (Xs - a) ** 3)
    if sp.nsimplify(poly.subs(Xs, a + sp.Rational(1, 2))) != sp.Rational(approx.numerator, approx.denominator):
        raise ValueError("independent_check_failed")
    for k_, v_ in ((2, c2), (3, c3)):
        if sp.diff(poly, Xs, k_).subs(Xs, a) != v_:
            raise ValueError("independent_check_failed")
    kind = "relative maximum" if c2 < 0 else "relative minimum"
    rt = lambda v: sp.latex(sp.Rational(v.numerator, v.denominator))
    stim = {"kind": "table", "description": "Values of f and its derivatives at the center", "data": {"x_label": "k", "y_label": f"f^(k)({a})", "rows": [["0", str(c0)], ["1", "0"], ["2", str(c2)], ["3", str(c3)]]}}
    parts = [
        part("a", f"A function $f$ has derivatives of all orders. The table gives the values of $f^{{(k)}}({a})$ for $k=0,1,2,3$, and $\\left|f^{{(4)}}(x)\\right|\\le{M}$ for all $x$ in the interval $[{a},{a + 1}]$. Write the third-degree Taylor polynomial $P_3(x)$ for $f$ about $x={a}$.", 2, "calculate", ["1.E", "2.C"],
             f"$P_3(x)={c0}+0\\,(x-{a})+\\dfrac{{{c2}}}{{2!}}(x-{a})^2+\\dfrac{{{c3}}}{{3!}}(x-{a})^3={c0}{'+' if c2 >= 0 else '-'}{abs(c2) // 2}(x-{a})^2{'+' if c3 >= 0 else '-'}{rt(Fr(abs(c3), 6))}(x-{a})^3$.", [
            row("a1", 1, "Uses f(a), f'(a), f''(a)/2!, f'''(a)/3! as the coefficients (setup)", ["f''(a)/2!", "f'''(a)/3!"], both=True), row("a2", 1, "Polynomial with correct coefficients", [f"{c0}", f"{c2 // 2}", rt(Fr(c3, 6))], requires="a1", nums=True)]),
        part("b", f"Use $P_3$ to approximate $f\\left({a}+\\dfrac{{1}}{{2}}\\right)$.", 2, "calculate", ["1.E"], f"$P_3\\left({a}+\\frac12\\right)={rt(approx)}$.", [
            row("b1", 1, "Substitutes x = a + 1/2 into P3 (setup)", [f"(1/2)^2", f"(1/2)^3"], both=True), row("b2", 1, "Value of the approximation", [rt(approx), str(approx)], requires="b1", nums=True)]),
        part("c", f"Use the Lagrange error bound to find an upper bound for $\\left|f\\left({a}+\\dfrac{{1}}{{2}}\\right)-P_3\\left({a}+\\dfrac{{1}}{{2}}\\right)\\right|$.", 3, "calculate", ["1.F", "3.D"],
             f"$|R_3(x)|\\le\\dfrac{{{M}}}{{4!}}\\left|x-{a}\\right|^4$, so at $x={a}+\\frac12$ the error is at most $\\dfrac{{{M}}}{{24}}\\cdot\\dfrac{{1}}{{16}}={rt(bound)}$.", [
            row("c1", 1, "Lagrange error bound formula with M, the factorial 4! and the fourth power of |x - a|", ["M/4!", "|x - a|^4"], both=True), row("c2", 1, "Substitution of M and the distance 1/2", [f"{M}/24", "(1/2)^4"], both=True, requires="c1"),
            row("c3", 1, "Value of the bound", [rt(bound), str(bound)], requires="c2", nums=True)]),
        part("d", f"Does $f$ have a relative maximum, a relative minimum, or neither at $x={a}$? Give a reason for your answer.", 2, "explain", ["3.B", "3.D"],
             f"$f'({a})=0$ and $f''({a})={c2}{'<0' if c2 < 0 else '>0'}$, so by the Second Derivative Test $f$ has a {kind} at $x={a}$.", [
            row("d1", 1, f"Identifies x = {a} as a critical point and uses the sign of f''({a})", [f"f'({a}) = 0", f"f''({a}) {'< 0' if c2 < 0 else '> 0'}"], both=True), row("d2", 1, f"Gives the conclusion with its reason: {kind}", [kind], requires="d1")])]
    return _pack("frq_x4_taylor_table_lagrange", "taylor_table_lagrange", "10.11", ["10.12", "5.7"], "not_allowed", "Taylor polynomial from a table of derivatives, an approximation, a Lagrange error bound, and the Second Derivative Test",
                 stim, parts, [["10.11"], ["10.11"], ["10.12"], ["5.7"]], [f"a={a}", f"c0={c0},c2={c2},c3={c3}", f"M={M}", f"approx={approx}", f"bound={bound}"],
                 "Build a Taylor polynomial from tabulated derivatives, use it to approximate, bound the error with the Lagrange form, and classify a critical point from the second derivative",
                 ["Divide each derivative by its factorial", "Substitute the point into the polynomial", "Apply the Lagrange error bound with the given maximum of the fourth derivative", "Use the Second Derivative Test"],
                 [("the fourth derivative bound holds on the interval between the center and the approximation point", "stated in the problem")], {"type": "table", "must_include": ["f^(k)(a) for k = 0..3"]},
                 "the polynomial is expanded with sympy and its derivatives at the center are compared with the table (independent of the factorial formula)", "1.E")


# F6 (계산기 불가): 장미 곡선 r = a sin 2θ
def frq_x4_rose_exact(rng):
    a = rng.choice([2, 4, 6])
    th = sp.Symbol("theta", real=True)
    r = a * sp.sin(2 * th)
    area = sp.integrate(sp.Rational(1, 2) * r ** 2, (th, 0, sp.pi / 2))
    rp = sp.diff(r, th).subs(th, sp.pi / 6)
    c = sp.Rational(a, 2)
    outside = sp.simplify(sp.integrate(sp.Rational(1, 2) * (r ** 2 - c ** 2), (th, sp.pi / 12, 5 * sp.pi / 12)))
    # 독립 경로: 수치 적분과 격자 넓이
    rf = lambda u: a * math.sin(2 * u)
    if abs(QI.quad(lambda u: 0.5 * rf(u) ** 2, 0, math.pi / 2)[0] - float(area)) > 1e-9 or abs((rf(math.pi / 6 + 1e-6) - rf(math.pi / 6 - 1e-6)) / 2e-6 - float(rp)) > 1e-5 \
            or abs(QI.quad(lambda u: 0.5 * (rf(u) ** 2 - float(c) ** 2), math.pi / 12, 5 * math.pi / 12)[0] - float(outside)) > 1e-9:
        raise ValueError("independent_check_failed")
    N = 500; cnt = 0
    for i in range(N):
        for j in range(N):
            px, py = a * (i + 0.5) / N, a * (j + 0.5) / N
            rr, tt = math.hypot(px, py), math.atan2(py, px)
            if float(c) < rr < rf(tt):
                cnt += 1
    if abs(cnt * (a / N) ** 2 - float(outside)) > 0.02 * float(outside):
        raise ValueError("independent_check_failed")
    ltx = sp.latex
    stim = {"kind": "text", "description": "A rose curve", "data": {"curve": f"r = {a} sin(2 theta), 0 <= theta <= pi/2"}}
    pre = f"The polar curve $r={a}\\sin(2\\theta)$ for $0\\le\\theta\\le\\dfrac{{\\pi}}{{2}}$ forms one petal of a rose curve."
    parts = [
        part("a", pre + " Write an integral expression for the area enclosed by the petal and find its value.", 3, "calculate", ["1.D", "1.E"],
             f"Area $=\\dfrac12\\int_0^{{\\pi/2}}\\left({a}\\sin2\\theta\\right)^2d\\theta={ltx(area)}$.", [
            row("a1", 1, "Area integrand (1/2) r^2 (setup)", [f"(1/2)({a} sin 2θ)^2"]), row("a2", 1, "Limits of integration 0 and π/2 (setup)", ["0 to π/2"], requires="a1"), row("a3", 1, "Exact value of the area", [ltx(area), str(area)], requires="a2", nums=True)]),
        part("b", "Find $\\dfrac{dr}{d\\theta}$ at $\\theta=\\dfrac{\\pi}{6}$. Is the distance from the origin to the point on the curve increasing or decreasing as $\\theta$ increases at $\\theta=\\dfrac{\\pi}{6}$? Give a reason.", 2, "explain", ["1.E", "3.F"],
             f"$\\dfrac{{dr}}{{d\\theta}}={2 * a}\\cos2\\theta$, which is ${ltx(rp)}$ at $\\theta=\\frac{{\\pi}}{{6}}$. It is positive, so the distance from the origin is increasing.", [
            row("b1", 1, "Value of dr/dθ at π/6", [ltx(rp), str(rp)], nums=True), row("b2", 1, "Gives the reason: increasing, because dr/dθ is positive", ["increasing", "positive"], both=True, requires="b1")]),
        part("c", "Find the value of $\\theta$ in $\\left(0,\\dfrac{\\pi}{2}\\right)$ at which the point on the curve is farthest from the origin, and find that greatest distance.", 2, "calculate", ["1.E", "3.D"],
             f"$\\dfrac{{dr}}{{d\\theta}}={2 * a}\\cos2\\theta=0$ at $\\theta=\\dfrac{{\\pi}}{{4}}$, where $r={a}$.", [
            row("c1", 1, "Sets dr/dθ = 0 and solves", ["θ = π/4"]), row("c2", 1, "Greatest distance", [str(a)], requires="c1", nums=True)]),
        part("d", f"Let $R$ be the region inside the petal and outside the circle $r={ltx(c)}$. The curves intersect at $\\theta=\\dfrac{{\\pi}}{{12}}$ and $\\theta=\\dfrac{{5\\pi}}{{12}}$. Write an integral expression for the area of $R$ and find its value.", 2, "calculate", ["1.D", "1.E"],
             f"Area of $R=\\dfrac12\\int_{{\\pi/12}}^{{5\\pi/12}}\\left[({a}\\sin2\\theta)^2-\\left({ltx(c)}\\right)^2\\right]d\\theta={ltx(outside)}$.", [
            row("d1", 1, "Integral with outer curve squared minus inner curve squared and limits π/12 and 5π/12 (setup)", [f"(1/2)∫_(π/12)^(5π/12) [({a} sin 2θ)^2 - ({c})^2] dθ"]), row("d2", 1, "Exact value of the area", [ltx(outside), str(outside)], requires="d1", nums=True)])]
    return _pack("frq_x4_rose_exact", "rose_exact", "9.8", ["9.7", "9.9"], "not_allowed", "One petal of a rose curve: area, rate of change of the radius, farthest point, and the area outside a circle",
                 stim, parts, [["9.8"], ["9.7"], ["9.7"], ["9.9"]], [f"a={a}", f"area={area}", f"rp={rp}", f"outside={outside}"],
                 "Use polar area for a rose petal, interpret dr/dtheta, find the greatest distance, and set up the area between a petal and a circle",
                 ["Set up (1/2) r^2 over one petal and integrate with a double-angle identity", "Differentiate r and read its sign", "Solve dr/dtheta = 0", "Subtract the circle's squared radius from the petal's squared radius between the intersection angles"],
                 [("r is nonnegative on the interval, so the petal is traced once", "sin 2θ ≥ 0 for 0 ≤ θ ≤ π/2")], {"type": "text", "must_include": ["polar equation", "interval of theta"]},
                 "scipy quad of each polar area integral, a central difference of r, and a 500 x 500 grid count of the region outside the circle (independent of the symbolic integration)")


# F7 (계산기 필수, Part A): 이상적분 — 아크탄젠트
def frq_x4_improper_arctan_calc(rng):
    m, c, T = rng.choice([20, 30, 40]), rng.choice([2, 3, 4]), rng.choice([2, 3, 5])
    r = lambda u: m / (u * u + c * c)
    total = m * math.pi / (2 * c)
    if abs(QI.quad(r, 0, math.inf)[0] - total) > 1e-8:
        raise ValueError("independent_check_failed")
    rest = (m / c) * (math.pi / 2 - math.atan(T / c))
    if abs(QI.quad(r, T, math.inf)[0] - rest) > 1e-8:
        raise ValueError("independent_check_failed")
    frac = rest / total
    # (c) ∫ t r(t) dt 는 발산: 상한을 키우면 (m/2) ln(b^2+c^2) 만큼 계속 커진다
    g = lambda B: QI.quad(lambda u: u * r(u), 0, B)[0]
    if not (g(1e4) > 20 and g(1e8) > g(1e4) + 5 and abs(g(1e4) - (m / 2) * math.log((1e8 + c * c) / (c * c))) < 1e-3):
        raise ValueError("independent_check_failed")
    second = m / c
    if abs(QI.quad(lambda u: m / (u + c) ** 2, 0, math.inf)[0] - second) > 1e-8:
        raise ValueError("independent_check_failed")
    stim = {"kind": "text", "description": "Two pollutant release rates", "data": {"first release": f"{m}/(t^2+{c * c}) kg per hour", "second release": f"{m}/(t+{c})^2 kg per hour"}}
    pre = f"A pollutant is released into a lake at the rate $r(t)=\\dfrac{{{m}}}{{t^2+{c * c}}}$ kilograms per hour, where $t\\ge 0$ is measured in hours."
    parts = [
        part("a", pre + " Find the total amount of pollutant released over all time, $\\displaystyle\\int_0^{\\infty}r(t)\\,dt$, or show that the integral diverges.", 3, "calculate", ["1.E", "3.D"],
             f"$\\displaystyle\\int_0^{{\\infty}}\\dfrac{{{m}}}{{t^2+{c * c}}}\\,dt=\\lim_{{b\\to\\infty}}\\dfrac{{{m}}}{{{c}}}\\arctan\\dfrac{{b}}{{{c}}}=\\dfrac{{{m}}}{{{c}}}\\cdot\\dfrac{{\\pi}}{{2}}={f3(total)}$ kilograms.", [
            row("a1", 1, "Writes the improper integral as a limit", ["lim_{b→∞} ∫_0^b r(t) dt"]), row("a2", 1, "Antiderivative (m/c) arctan(t/c)", [f"({m}/{c}) arctan(t/{c})"], requires="a1"), row("a3", 1, "Value (converges)", [f3(total)], requires="a2", nums=True, tol="±0.001")]),
        part("b", f"Find the amount of pollutant released after the first ${T}$ hours, $\\displaystyle\\int_{{{T}}}^{{\\infty}}r(t)\\,dt$. What percent of the total amount found in part (a) is this?", 2, "calculate", ["1.E", "3.F"],
             f"$\\displaystyle\\int_{{{T}}}^{{\\infty}}r(t)\\,dt=\\dfrac{{{m}}}{{{c}}}\\left(\\dfrac{{\\pi}}{{2}}-\\arctan\\dfrac{{{T}}}{{{c}}}\\right)={f3(rest)}$ kilograms, which is {frac * 100:.1f}% of the total.", [
            row("b1", 1, "Amount released after the first hours (value)", [f3(rest)], nums=True, tol="±0.001"), row("b2", 1, "Percent of the total (value)", [f"{frac * 100:.1f}"], requires="b1", nums=True, tol="±0.1")]),
        part("c", "Determine whether $\\displaystyle\\int_0^{\\infty}t\\,r(t)\\,dt$ converges or diverges. Give a reason for your answer.", 2, "explain", ["3.D", "3.E"],
             f"$\\displaystyle\\int_0^{{b}}\\dfrac{{{m}t}}{{t^2+{c * c}}}\\,dt=\\dfrac{{{m}}}{{2}}\\ln\\left(b^2+{c * c}\\right)-\\dfrac{{{m}}}{{2}}\\ln {c * c}$, which grows without bound as $b\\to\\infty$, so the integral diverges.", [
            row("c1", 1, "Antiderivative (m/2) ln(t^2 + c^2) and the limit as b approaches infinity (setup)", [f"({m}/2) ln(t^2+{c * c})"]), row("c2", 1, "Gives the reason for divergence: the logarithm grows without bound", ["diverges", "without bound"], both=True, requires="c1")]),
        part("d", f"A second release has the rate $s(t)=\\dfrac{{{m}}}{{(t+{c})^2}}$ kilograms per hour for $t\\ge 0$. Find the total amount of pollutant released over all time by the second release, and tell which release (the first or the second) puts more pollutant into the lake over all time.", 2, "calculate", ["1.E", "3.E"],
             f"$\\displaystyle\\int_0^{{\\infty}}\\dfrac{{{m}}}{{(t+{c})^2}}\\,dt=\\dfrac{{{m}}}{{{c}}}={f3(second)}$ kilograms. The first release gives {f3(total)} kilograms, which is larger, so the first release puts more pollutant into the lake.", [
            row("d1", 1, "Total of the second release (value)", [f3(second)], nums=True, tol="±0.001"), row("d2", 1, "Gives the reason for the comparison: the first release total is larger", ["first release", "larger"], both=True, requires="d1")])]
    return _pack("frq_x4_improper_arctan_calc", "improper_arctan_calc", "6.13", [], "required", "Improper integrals of release rates: total amount, remaining amount, a divergent integral, and a comparison of two releases",
                 stim, parts, [["6.13"], ["6.13"], ["6.13"], ["6.13"]], [f"m={m},c={c},T={T}", f"total={total:.5f}", f"rest={rest:.5f}", f"second={second:.5f}"],
                 "Evaluate convergent improper integrals with arctangent and rational antiderivatives, decide divergence for a logarithmic integral, and compare totals",
                 ["Write each improper integral as a limit and find an antiderivative", "Evaluate with a calculator", "Show that the logarithmic antiderivative grows without bound", "Compare the two totals"],
                 [("the improper integrals of m/(t^2 + c^2) and m/(t + c)^2 over [0, infinity) converge", "arctan(b/c) approaches pi/2 and -1/(b+c) approaches 0")], {"type": "text", "must_include": ["rate function", "improper integral"]},
                 "scipy quad to infinity for the totals and the remainder, and quadrature of t r(t) to two cutoffs compared with the logarithmic growth (independent of the antiderivatives)", "1.E")


STAGE_LISTS = {"supp_x4f_bc": ["frq_x4_velocity_vector_calc", "frq_x4_series_estimate_calc", "frq_x4_series_classify", "frq_x4_cycloid_exact", "frq_x4_taylor_table_lagrange", "frq_x4_rose_exact", "frq_x4_improper_arctan_calc"]}
