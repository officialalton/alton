"""BC 그래프 필수 MC 신규 원형 E군(2026-10-09, 단계 S2): 단원 7(오일러)·9(매개변수·벡터)·10(테일러·라그랑주). 구간선형 그래프 + 정확한 유리수, 별도 수치 경로로 재확인."""
from gcommon import *
from scipy import optimize as _O, integrate as _I

BC = "ap_calculus_bc"
XS5 = [0, 2, 4, 6, 8]


def _ax(vals_list, xlab="t", xr=(0, 8), ylab="y"):
    allv = [v for vs in vals_list for v in vs]
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, min(0, min(allv)) - 1, max(0, max(allv)) + 1, 1)


def _bpc(*a, **k):
    return bp(*a, subject=BC, **k)


# 1) 10.12 라그랑주 오차 한계(소수 x, 계산기): f^(4) 그래프에서 M
def g_lagrange_decimal_calc(rng):
    xs = [0, 1, 2, 3]
    for _ in forever():
        v = rand_vals(rng, 4, -6, 6)
        a = rng.choice([1.3, 1.4, 1.6, 1.7])
        f = PL(xs, v)
        vals = [abs(v[0]), abs(v[1]), abs(float(f.at(Fr(str(a)))))]
        M = max(vals)
        Mall = max(abs(z) for z in v)
        mx = max(v[0], v[1], float(f.at(Fr(str(a)))))
        if M > 0 and M != Mall and M != mx and abs(float(f.at(Fr(str(a))))) < M and len({M, Mall, mx}) == 3:
            break
    key = M * a ** 4 / 24
    grid = [i * a / 2000 for i in range(2001)] + [1.0]
    Mn = max(abs(f.num(u)) for u in grid)           # 독립 경로: 촘촘한 격자에서 |f^(4)| 의 최댓값
    if abs(Mn - M) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses the largest signed value of the graph on [0, %s] instead of the largest absolute value." % a, mx * a ** 4 / 24), ("Takes the maximum over the whole graph, not only over [0, %s]." % a, Mall * a ** 4 / 24),
          ("Divides by 3! instead of 4!.", M * a ** 4 / 6), ("Uses the power 3 instead of 4 for the x-term.", M * a ** 3 / 24)]
    pool = dopts_local(ds, key)
    stem = f"The third-degree Maclaurin polynomial $P_3$ of a function $f$ with derivatives of all orders is used to estimate $f({a})$. The fourth derivative of $f$ is graphed on $0\\le x\\le 3$ and consists of line segments, as shown. Use the Lagrange error bound to find the least upper bound for the error $|f({a})-P_3({a})|$ that the graph supports."
    k = Opt(dec(key), True, "M x^4/4! with M = the maximum of |f^(4)| on [0, a] read from the graph, evaluated with a calculator.", key)
    bpr = _bpc("g_lagrange_decimal_calc", "10.12", "1.E", "required", "Apply the Lagrange error bound with a bound read from a graph at a non-integer point",
               ["Read the largest absolute value of f^(4) on [0, a] from the graph", "Apply M |x|^(n+1)/(n+1)! with n = 3", "Evaluate with a calculator"],
               [("|f^(4)| <= M on [0, a] for the maximum absolute value read from the graph", "the graph is piecewise linear so the maximum occurs at a vertex or at the endpoint a")],
               [("signed_max", "uses the signed maximum"), ("wrong_interval", "uses a maximum from outside [0, a]"), ("wrong_factorial", "uses 3! instead of 4!"), ("wrong_power", "uses x cubed")],
               "maximum absolute value from a 2000-point grid on [0, a] (independent of vertex reading)", {"type": "graph", "must_include": ["vertices of f^(4) at x = 0, 1, 2, 3"]})
    return gpack("g_lagrange_decimal_calc", "10.12", "1.E", "required", stem, k, pool, rng, gstim("Graph of f^(4)(x), consisting of line segments connecting the plotted vertices.", [("f4", f.vert())], axis("x", 0, 3, 1), axis("y", min(-1, min(v)) - 1, max(v) + 1, 1)), bpr, 100, [f"v={v}", f"a={a}", f"key={key:.6f}"])


def dopts_local(pairs, key_val):
    out, used = [], {round(float(key_val), 3)}
    for why, v in pairs:
        k = round(float(v), 3)
        if k in used or abs(float(v)) < 1e-9:
            continue
        used.add(k)
        out.append(Opt(dec(float(v)), False, why, float(v)))
    if len(out) < 3:
        raise ValueError("not_enough_distractors")
    return out


# 2) 10.11 이차 매클로린 다항식: f(0) 와 f' 그래프
def g_taylor_deriv_graph(rng):
    xs = [0, 2, 4]
    for _ in forever():
        v = rand_vals(rng, 3, -4, 5)
        k0 = rng.randint(-3, 6)
        c = rng.choice([1, 2, 3])
        fp = PL(xs, v)
        f1 = Fr(v[0])
        f2 = fp.slope_seg(0)
        key = k0 + f1 * c + f2 * c * c / 2
        if f2 != 0 and f1 != 0 and len({key, k0 + f1 * c + f2 * c * c, k0 + fp.at(c) * c + f2 * c * c / 2, k0 + f1 * c, k0 + f1 * c + f2 * c / 2}) == 5:
            break
    num = k0 + float(f1) * c + float(f2) * c * c / 2
    if abs(num - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the factorial: f''(0) x^2 instead of f''(0) x^2/2!.", k0 + f1 * c + f2 * c * c), ("Uses f'(%d) from the graph instead of f'(0) for the linear term." % c, k0 + fp.at(c) * c + f2 * c * c / 2),
          ("Stops at the linear term and leaves out the quadratic term.", k0 + f1 * c), ("Uses f''(0) x/2 instead of f''(0) x^2/2.", k0 + f1 * c + f2 * c / 2)]
    pool = opts(ds, key, fx)
    stem = f"The function $f$ has derivatives of all orders and $f(0)={k0}$. The graph of $f'$, consisting of line segments, is shown for $0\\le x\\le 4$. Let $P_2$ be the second-degree Maclaurin polynomial for $f$. What is $P_2({c})$?"
    k = Opt(fx(key), True, "P2(x) = f(0) + f'(0) x + f''(0) x^2/2!; f'(0) is the height of the graph at 0 and f''(0) is the slope of the first segment.", key)
    bpr = _bpc("g_taylor_deriv_graph", "10.11", "2.B", "not_allowed", "Build a Maclaurin polynomial using f'(0) and f''(0) read from the graph of f'",
               ["Read f'(0) from the graph and f''(0) as the slope of the graph of f' at 0", "Form P2(x) = f(0) + f'(0)x + f''(0)x^2/2", "Evaluate at the given x"],
               [("f''(0) is the slope of f' on the first segment because f' is linear near 0", "the graph consists of line segments")],
               [("no_factorial", "omits the factorial"), ("wrong_value_of_fprime", "reads f' at the wrong point"), ("missing_quadratic", "drops the quadratic term"), ("wrong_power", "uses x instead of x squared")],
               "polynomial evaluated numerically from numerically interpolated heights and finite-difference slope of f' (independent of the exact vertices)", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4"]})
    return gpack("g_taylor_deriv_graph", "10.11", "2.B", "not_allowed", stem, k, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([v], "x", (0, 4), "f'(x)")), bpr, 90, [f"v={v}", f"k0={k0}", f"c={c}", f"key={key}"])


# 3) 9.6 속력: x'(t), y'(t) 그래프 두 개
def g_param_speed_graphs(rng):
    for _ in forever():
        tri = rng.choice([(3, 4, 5), (6, 8, 10), (5, 12, 13)])
        sx, sy = rng.choice([1, -1]), rng.choice([1, -1])
        a = rng.choice([2, 4, 6])
        i = a // 2
        vx = [rng.randint(-6, 6) for _ in range(5)]
        vy = [rng.randint(-6, 6) for _ in range(5)]
        vx[i], vy[i] = sx * tri[0], sy * tri[1]
        if max(abs(z) for z in vx + vy) <= 13:
            break
    key = tri[2]
    a_, b_ = sx * tri[0], sy * tri[1]
    ds = [("Adds the absolute values of the components instead of using the Pythagorean combination.", abs(a_) + abs(b_)), ("Reports the slope dy/dx = y'/x' instead of the speed.", Fr(b_, a_)),
          ("Reports x'(t) alone.", Fr(a_)), ("Does not take the square root: (x')^2 + (y')^2.", a_ * a_ + b_ * b_)]
    pool = opts(ds, key, fx)
    stem = f"A particle moves in the $xy$-plane. The graphs of $x'(t)$ and $y'(t)$ for $0\\le t\\le 8$ are shown and each consists of line segments. What is the speed of the particle at $t={a}$?"
    k = Opt(fx(key), True, "Speed = sqrt((x')^2 + (y')^2) with x'(%d) and y'(%d) read from the graphs." % (a, a), key)
    xf, yf = PL(XS5, vx), PL(XS5, vy)
    if abs(math.hypot(xf.num(a), yf.num(a)) - key) > 1e-9:
        raise ValueError("independent_check_failed")
    bpr = _bpc("g_param_speed_graphs", "9.6", "2.B", "not_allowed", "Find speed from the graphs of the two velocity components",
               ["Read x'(a) from the first graph and y'(a) from the second", "Combine them as sqrt((x')^2 + (y')^2)"],
               [("speed equals the magnitude of the velocity vector", "definition of speed for planar motion")],
               [("component_sum", "adds components"), ("slope", "reports dy/dx"), ("single_component", "reports one component"), ("no_root", "omits the square root")],
               "math.hypot of the numerically interpolated components at t = a (independent of the Pythagorean triple used to build the graphs)", {"type": "graph", "must_include": ["vertices of x'", "vertices of y'"]})
    return gpack("g_param_speed_graphs", "9.6", "2.B", "not_allowed", stem, k, pool, rng, gstim("Graphs of x'(t) and y'(t), each consisting of line segments connecting the plotted vertices.", [("x'", xf.vert()), ("y'", yf.vert())], *_ax([vx, vy], "t", (0, 8), "velocity")), bpr, 80, [f"vx={vx}", f"vy={vy}", f"a={a}"])


# 4) 9.1 dy/dx: x(t), y(t) 위치 그래프의 기울기
def g_param_dydx_graphs(rng):
    for _ in forever():
        vx = rand_vals(rng, 5, 0, 8)
        vy = rand_vals(rng, 5, 0, 8)
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        xf, yf = PL(XS5, vx), PL(XS5, vy)
        sx, sy = xf.slope_seg(i), yf.slope_seg(i)
        if sx != 0 and sy != 0 and sx != sy:
            key = sy / sx
            if len({key, sx / sy, sx * sy, sy - sx, yf.at(a) / xf.at(a) if xf.at(a) else Fr(99)}) == 5:
                break
    hh = 1e-6
    if abs((yf.num(a + hh) - yf.num(a - hh)) / (xf.num(a + hh) - xf.num(a - hh)) - float(key)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Inverts the ratio and reports dx/dy.", sx / sy), ("Multiplies the two derivatives, x' y', instead of dividing.", sx * sy), ("Subtracts the derivatives, y' - x'.", sy - sx),
          ("Divides the positions y(t)/x(t) instead of the rates of change.", yf.at(a) / xf.at(a) if xf.at(a) else Fr(99))]
    pool = opts(ds, key, fx)
    stem = f"A curve in the $xy$-plane is given by $x=x(t)$ and $y=y(t)$ for $0\\le t\\le 8$. The graphs of $x$ and $y$ as functions of $t$ are shown and each consists of line segments. What is the value of $\\dfrac{{dy}}{{dx}}$ at $t={a}$?"
    k = Opt(fx(key), True, "dy/dx = (dy/dt)/(dx/dt); the slopes of the two graphs at t = %d are y' = %s and x' = %s." % (a, sy, sx), key)
    bpr = _bpc("g_param_dydx_graphs", "9.1", "1.E", "not_allowed", "Compute dy/dx for parametric equations from the graphs of x(t) and y(t)",
               ["Read the slope of the graph of x and of the graph of y at the given t", "Apply dy/dx = (dy/dt)/(dx/dt)"],
               [("dx/dt is not zero at the given time, so dy/dx exists", "the slope of the graph of x is nonzero on the segment containing t")],
               [("inverted_ratio", "reports dx/dy"), ("product", "multiplies"), ("difference", "subtracts the derivatives"), ("ratio_of_positions", "divides the positions")],
               "difference quotient of y over difference quotient of x with step 1e-6 on the interpolated graphs (independent of reading slopes)", {"type": "graph", "must_include": ["vertices of x(t)", "vertices of y(t)"]})
    return gpack("g_param_dydx_graphs", "9.1", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graphs of x(t) and y(t), each consisting of line segments connecting the plotted vertices.", [("x", xf.vert()), ("y", yf.vert())], *_ax([vx, vy], "t", (0, 8), "position")), bpr, 85, [f"vx={vx}", f"vy={vy}", f"a={a}", f"key={key}"])


# 5) 7.5 오일러 방법: dy/dx = g(x) - y, g 는 그래프
def g_euler_graph(rng):
    xs = [0, 2, 4, 6, 8]
    for _ in forever():
        v = rand_vals(rng, 5, -2, 8)
        g = PL(xs, v)
        y0 = rng.randint(0, 6)
        h = 2
        y1 = y0 + h * (g.at(0) - y0)
        y2 = y1 + h * (g.at(2) - y1)
        r1 = y0 + h * (g.at(2) - y0)
        r2 = r1 + h * (g.at(4) - r1)
        no_y = y0 + h * g.at(0) + h * g.at(2)
        half = y0 + 1 * (g.at(0) - y0)
        half = half + 1 * (g.at(1) - half)
        if len({y2, r2, no_y, half}) == 4:
            break
    num0 = y0
    for xx in (0, 2):
        num0 = num0 + h * (g.num(xx) - num0)
    if abs(num0 - float(y2)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses the slope at the right endpoint of each step, g(x + h) - y, instead of the left endpoint.", r2), ("Leaves out the -y term and adds only the values of g.", no_y),
          ("Uses step size 1 for two steps and ends at x = 2 instead of x = 4.", half)]
    ds = [d for d in ds]
    pool = opts(ds, y2, fx)
    if len(pool) < 3:
        raise ValueError("not_enough_distractors")
    stem = f"Let $y=f(x)$ be the solution of $\\dfrac{{dy}}{{dx}}=g(x)-y$ with $f(0)={y0}$, where the graph of $g$, consisting of line segments, is shown. Euler's method with two steps of equal size $h=2$ starting at $x=0$ is used to approximate $f(4)$. What is the approximation?"
    k = Opt(fx(y2), True, "Step 1: y1 = y0 + 2(g(0) - y0). Step 2: y2 = y1 + 2(g(2) - y1), with g read from the graph.", y2)
    bpr = _bpc("g_euler_graph", "7.5", "1.E", "not_allowed", "Apply Euler's method when the slope depends on x through a graph and on y through the equation",
               ["Read g(0) and g(2) from the graph", "Compute the first Euler step using the slope g(0) - y0", "Use the new y value in the second step with the slope g(2) - y1"],
               [("Euler's method uses the slope at the left endpoint of each step", "definition of Euler's method with step size h")],
               [("right_endpoint_slope", "uses right-endpoint slopes"), ("missing_y_term", "ignores the -y term"), ("wrong_step", "uses the wrong step size")],
               "two Euler steps recomputed with floating-point arithmetic on the interpolated graph (independent of the exact rationals)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_euler_graph", "7.5", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([v], "x", (0, 8), "g(x)")), bpr, 100, [f"v={v}", f"y0={y0}", f"y2={y2}"])


# 6) 9.5 위치 벡터: x'(t), y'(t) 그래프와 초기 위치
def g_vector_displacement_graph(rng):
    for _ in forever():
        vx = rand_vals(rng, 5, -3, 5)
        vy = rand_vals(rng, 5, -3, 5)
        xf, yf = PL(XS5, vx), PL(XS5, vy)
        b = rng.choice([4, 6, 8])
        x0, y0 = rng.randint(0, 5), rng.randint(0, 5)
        dx, dy = xf.area(0, b), yf.area(0, b)
        key = (x0 + dx, y0 + dy)
        alts = [(y0 + dy, x0 + dx), (dx, dy), (x0 + xf.at(b), y0 + yf.at(b))]
        if len({key, *alts}) == 4 and dx != dy and dx != 0 and dy != 0:
            break
    nx = x0 + xf.quad(0, b)
    ny = y0 + yf.quad(0, b)
    if abs(nx - float(key[0])) > 1e-9 or abs(ny - float(key[1])) > 1e-9:
        raise ValueError("independent_check_failed")
    t = lambda p: "$(%s,%s)$" % (ftx(p[0]), ftx(p[1]))
    ds = [Opt(t(alts[0]), False, "Swaps the coordinates: the x-coordinate and the y-coordinate are reversed.", None), Opt(t(alts[1]), False, "Reports the displacement only and forgets the initial position.", None),
          Opt(t(alts[2]), False, "Adds the velocity components at t = %d to the initial position instead of integrating." % b, None)]
    k = Opt(t(key), True, "Position = initial position + the integral of velocity: x(b) = x(0) + area under x', y(b) = y(0) + area under y'.", None)
    stem = f"A particle moves in the $xy$-plane. Its position at $t=0$ is $({x0},{y0})$. The graphs of the velocity components $x'(t)$ and $y'(t)$ are shown for $0\\le t\\le 8$, each consisting of line segments. What is the position of the particle at $t={b}$?"
    bpr = _bpc("g_vector_displacement_graph", "9.5", "1.D", "not_allowed", "Find a position vector from initial position and the graphs of both velocity components",
               ["Recognize that each coordinate equals its initial value plus the signed area under its velocity graph", "Compute the signed area under each graph from 0 to the given time", "Combine the coordinates as an ordered pair"],
               [("position equals initial position plus the integral of velocity for each component", "Fundamental Theorem of Calculus applied to each coordinate")],
               [("swapped_coordinates", "reverses the coordinates"), ("displacement_only", "forgets the initial position"), ("velocity_not_integrated", "adds velocity values")],
               "numerical quadrature of each interpolated velocity component plus the initial position (independent of trapezoid areas)", {"type": "graph", "must_include": ["vertices of x'", "vertices of y'"]})
    return gpack("g_vector_displacement_graph", "9.5", "1.D", "not_allowed", stem, k, ds, rng, gstim("Graphs of x'(t) and y'(t), each consisting of line segments connecting the plotted vertices.", [("x'", xf.vert()), ("y'", yf.vert())], *_ax([vx, vy], "t", (0, 8), "velocity")), bpr, 110, [f"vx={vx}", f"vy={vy}", f"b={b}", f"key={key}"])


def ftx(v):
    return fx(v).strip("$")
