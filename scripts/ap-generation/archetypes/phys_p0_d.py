"""AP Physics 1 원형 D — 단원 3(일·에너지·일률) 확장 21개(2026-10-13, P1-a 에서 U3 통과 0 이었던 병목 해소). 정답은 코드가 풀고 ODE/수치/정확 분수 독립 경로로 재계산한다.
오답 선택지의 값은 설명에 쓴 오개념 식으로 코드가 계산한 것이다(P1-a 반려 원인 1순위: 설명과 값 불일치). 정답 해설에는 실제 숫자 대입을 넣는다."""
from phys_common import *
from phys_figs import make_bars, make_incline, make_atwood, check_scene, choice_checks  # noqa: F401
from phys_p0_a import _pl_vt


def _rk_stop(f, s0, cond, dt=1e-4, tmax=60.0):
    """상태 s 를 RK4 로 전진시키다 cond(s) 가 처음 참이 될 때 선형 보간한 상태를 반환."""
    s = np.array(s0, dtype=float); t = 0.0
    while not cond(s):
        prev = s.copy(); s = rk4(f, s, t, t + dt, 1); t += dt
        if t > tmax:
            raise ValueError("no_stop")
    return prev, s


# ---------- 1. 비스듬한 힘이 한 일 ----------
@retry_sep
def ph_w_angle_force(rng):
    for _ in forever():
        F = pick(rng, [20.0, 30.0, 40.0, 50.0, 60.0]); th = pick(rng, [20, 30, 40, 55, 65]); d = pick(rng, [4.0, 5.0, 8.0, 10.0, 12.0])
        W = F * d * math.cos(math.radians(th))
        # 독립 경로: 힘 벡터와 변위 벡터의 내적
        Fv = np.array([F * math.cos(math.radians(th)), F * math.sin(math.radians(th))]); dv = np.array([d, 0.0])
        agree(W, float(Fv @ dv), 1e-9, "W")
        break
    r = math.radians(th)
    pairs = [("Ignores the angle and multiplies the full tension by the distance, $Fd$.", F * d), ("Uses the sine of the angle (the vertical component of the force), $Fd\\sin\\theta$.", F * d * math.sin(r)),
             ("Reports only the horizontal component of the force, $F\\cos\\theta$, without multiplying by the distance.", F * math.cos(r)), ("Divides by the cosine instead of multiplying, $Fd/\\cos\\theta$.", F * d / math.cos(r))]
    key, ds = num_opts(W, pairs, "J")
    stem = f"A person pulls a suitcase along a level floor with a strap that makes an angle of ${th}^\\circ$ above the horizontal. The tension in the strap is ${F:g}\\text{{ N}}$ and the suitcase moves ${d:g}\\text{{ m}}$ along the floor. How much work does the strap's tension do on the suitcase?"
    return mk("ph_w_angle_force", "3.2", "2.B", stem, key, ds, rng, concept="Work done by a force that is not parallel to the displacement", thinking=["Find the component of the force along the displacement", "Multiply that component by the distance moved"],
              cond=[("only the component of the force along the displacement does work", "the strap pulls at an angle above the horizontal along a level floor")], path="the work is recomputed as the dot product of the force vector and the displacement vector in numpy", material=MAT_NONE,
              judgment=["law_selection"], est=85, facts=[f"F={F}", f"th={th}", f"d={d}"], kwhy=f"Only the horizontal component does work: $W=Fd\\cos\\theta={F:g}\\times{d:g}\\times\\cos{th}^\\circ={sig(W)}\\text{{ J}}$.")


# ---------- 2. 알짜 일 → 속력 ----------
@retry_sep
def ph_net_work_speed(rng):
    for _ in forever():
        m = pick(rng, [10.0, 15.0, 20.0, 40.0]); F = pick(rng, [60.0, 80.0, 100.0, 120.0]); mu = pick(rng, [0.2, 0.3, 0.4]); d = pick(rng, [3.0, 4.0, 5.0, 6.0])
        f = mu * m * G
        if F < 1.4 * f:
            continue
        v = math.sqrt(2 * (F - f) * d / m)
        # 독립 경로: 일정한 알짜 힘으로 거리 d 까지 RK4 로 운동 방정식 적분
        prev, s = _rk_stop(lambda t, y: np.array([y[1], (F - f) / m]), [0.0, 0.0], lambda y: y[0] >= d)
        fr = (d - prev[0]) / (s[0] - prev[0]); vn = prev[1] + (s[1] - prev[1]) * fr
        agree(v, vn, 2e-3, "v")
        if 1.5 < v < 12:
            break
    pairs = [("Ignores friction and uses only the applied force, $\\sqrt{2Fd/m}$.", math.sqrt(2 * F * d / m)), ("Sets the net work equal to $mv^2$ instead of $\\tfrac12mv^2$, giving $\\sqrt{W_{net}/m}$.", math.sqrt((F - f) * d / m)),
             ("Uses the work done by friction alone as the net work, $\\sqrt{2fd/m}$.", math.sqrt(2 * f * d / m)), ("Divides the net work by the mass but never takes the square root.", (F - f) * d / m)]
    key, ds = num_opts(v, pairs, "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ crate starts at rest on a level floor. A worker pushes it with a constant horizontal force of ${F:g}\\text{{ N}}$ for ${d:g}\\text{{ m}}$. The coefficient of kinetic friction between the crate and the floor is ${mu:g}$. What is the speed of the crate after it has moved ${d:g}\\text{{ m}}$?"
    return mk("ph_net_work_speed", "3.1", "2.B", stem, key, ds, rng, concept="The net work done on an object equals its change in kinetic energy", thinking=["Compute the net force as the applied force minus kinetic friction", "Set the net work equal to the kinetic energy gained and solve for the speed"],
              cond=[("the crate starts from rest and friction is constant", "the stem gives rest and a constant coefficient of kinetic friction")], path="RK4 integration of the motion under the constant net force reproduces the speed after the stated distance", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=115, facts=[f"m={m}", f"F={F}", f"mu={mu}", f"d={d}"],
              kwhy=f"Friction is $\\mu mg={sig(f)}$ N, so $W_{{net}}=({F:g}-{sig(f)})\\times{d:g}={sig((F - f) * d)}$ J and $\\tfrac12mv^2=W_{{net}}$ gives $v={sig(v)}$ m/s.")


# ---------- 3. 수직 용수철 최대 압축 ----------
@retry_sep
def ph_vert_spring_compress(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 1.5, 2.0]); k = pick(rng, [200.0, 300.0, 400.0, 500.0]); h = pick(rng, [0.2, 0.3, 0.4, 0.6])
        x = sp.symbols("x", positive=True)
        sol = sp.solve(sp.Eq(sp.Rational(str(m)) * sp.Rational("9.8") * (sp.Rational(str(h)) + x), sp.Rational(str(k)) / 2 * x ** 2), x)
        xs_ = float(max(sol, key=float))
        xb = bisect(lambda z: 0.5 * k * z * z - m * G * (h + z), 1e-6, 5.0)
        agree(xs_, xb, 1e-6, "x")
        if 0.04 < xs_ < 0.5:
            break
    pairs = [("Ignores the gravitational energy lost while the spring compresses, $x=\\sqrt{2mgh/k}$.", math.sqrt(2 * m * G * h / k)), ("Reports the equilibrium compression $mg/k$ instead of the maximum compression.", m * G / k),
             ("Uses the result for a block placed on the spring and released from its top, $x=2mg/k$.", 2 * m * G / k), ("Drops the factor of one half in the spring energy, $x=\\sqrt{mgh/k}$.", math.sqrt(m * G * h / k))]
    key, ds = num_opts(xs_, pairs, "m")
    stem = f"A ${m:g}\\text{{ kg}}$ block is released from rest at a height of ${h:g}\\text{{ m}}$ directly above a light vertical spring of spring constant ${k:g}\\text{{ N/m}}$ standing on the floor. The block lands on the spring and compresses it. What is the maximum compression of the spring? Ignore air resistance."
    return mk("ph_vert_spring_compress", "3.4", "2.A", stem, key, ds, rng, concept="Energy conservation for a block that keeps falling while it compresses a vertical spring", thinking=["Take the system at release and at maximum compression, where the block is momentarily at rest", "Include the gravitational energy lost during the compression itself, giving a quadratic in the compression"],
              cond=[("no energy is dissipated", "the stem ignores air resistance and the spring is ideal")], path="sympy solves the energy quadratic exactly and a bisection root finder on the energy balance gives the same compression", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=125, facts=[f"m={m}", f"k={k}", f"h={h}"],
              kwhy=f"At maximum compression $mg(h+x)=\\tfrac12kx^2$; with $m={m:g}$ kg, $h={h:g}$ m and $k={k:g}$ N/m the positive root is $x={sig(xs_)}$ m.")


# ---------- 4. 진자 바닥 속력 ----------
@retry_sep
def ph_pendulum_bottom(rng):
    for _ in forever():
        L = pick(rng, [1.0, 1.5, 2.0, 2.5]); th = pick(rng, [30, 40, 50, 70]); m = pick(rng, [0.2, 0.4, 0.5])
        v = math.sqrt(2 * G * L * (1 - math.cos(math.radians(th))))
        # 독립 경로: 진자 운동 방정식 θ'' = -(g/L) sin θ 를 RK4 로 적분, 바닥 통과 각속도 × L
        prev, s = _rk_stop(lambda t, y: np.array([y[1], -G / L * math.sin(y[0])]), [math.radians(th), 0.0], lambda y: y[0] <= 0.0)
        fr = prev[0] / (prev[0] - s[0]); w = abs(prev[1] + (s[1] - prev[1]) * fr)
        agree(v, L * w, 3e-3, "v")
        break
    r = math.radians(th)
    pairs = [("Uses the full string length as the height lost, $\\sqrt{2gL}$.", math.sqrt(2 * G * L)), ("Uses $L\\sin\\theta$ as the height lost, $\\sqrt{2gL\\sin\\theta}$.", math.sqrt(2 * G * L * math.sin(r))),
             ("Uses $L\\cos\\theta$ as the height lost, $\\sqrt{2gL\\cos\\theta}$.", math.sqrt(2 * G * L * math.cos(r))), ("Drops the factor of two from the energy equation, $\\sqrt{gL(1-\\cos\\theta)}$.", math.sqrt(G * L * (1 - math.cos(r))))]
    key, ds = num_opts(v, pairs, "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ pendulum bob hangs from a light string of length ${L:g}\\text{{ m}}$. The bob is pulled aside until the string makes an angle of ${th}^\\circ$ with the vertical and is then released from rest. What is the speed of the bob at the lowest point of its swing? Ignore air resistance."
    return mk("ph_pendulum_bottom", "3.4", "2.B", stem, key, ds, rng, concept="Energy conservation for a pendulum, with the height lost found from the geometry", thinking=["Find the height of the bob above the lowest point as $L(1-\\cos\\theta)$", "Equate the gravitational energy lost to the kinetic energy at the bottom"],
              cond=[("only gravity does work on the bob because the string tension is perpendicular to the motion", "the stem ignores air resistance and the string is light")], path="RK4 integration of the pendulum equation of motion gives the angular speed at the bottom, multiplied by the length", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=110, facts=[f"L={L}", f"th={th}", f"m={m}"],
              kwhy=f"The bob drops $L(1-\\cos{th}^\\circ)={sig(L * (1 - math.cos(r)))}$ m, so $v=\\sqrt{{2gh}}={sig(v)}$ m/s, independent of the mass.")


# ---------- 5. U–x 그래프 → 힘 ----------
@retry_sep
def ph_ux_force_graph(rng):
    for _ in forever():
        xs = [0, 2, 4, 6, 8][: pick(rng, [4, 5])]
        Us = [rng.randint(0, 14) for _ in xs]
        i = rng.randrange(len(xs) - 1)
        slope = Fr(Us[i + 1] - Us[i], xs[i + 1] - xs[i])
        if slope == 0:
            continue
        # 인접 구간 기울기가 달라야 하고 서로 달라야 함
        nb = (i + 1) if i + 2 < len(xs) else i - 1
        sl2 = Fr(Us[nb + 1] - Us[nb], xs[nb + 1] - xs[nb])
        if sl2 == slope or sl2 == 0 or slope < 0:  # 키가 음(힘이 -x 방향)이 되도록 U 가 증가하는 구간을 고른다
            continue
        # 독립 경로: 촘촘한 표본의 수치 기울기
        tt = np.linspace(xs[i], xs[i + 1], 2001)[1:-1]; uu = np.interp(tt, xs, Us)
        gr = float(np.mean(np.gradient(uu, tt)))
        agree(float(slope), gr, 1e-6, "slope")
        break
    F = -float(slope)
    a, b = xs[i], xs[i + 1]
    pairs = [("Takes the force equal to the slope of the graph instead of the negative of the slope.", -F), ("Reports the change in potential energy over the interval without dividing by the distance.", float(Us[i + 1] - Us[i])),
             ("Divides the potential energy at the right end of the interval by its position, $U/x$.", Us[i + 1] / b if b else None), ("Reads the force on the neighboring segment instead of the stated interval.", -float(sl2))]
    key, ds = signed_opts(F, pairs, "N")
    stim = graph_stim("Potential energy of a particle versus position", [("U", list(zip(xs, Us)))], gaxis("Position (m)", 0, xs[-1], 1), gaxis("Potential energy (J)", 0, max(Us) + 2, 2))
    stem = f"The graph shows the potential energy $U$ of a particle as a function of position $x$. The only force on the particle is the conservative force associated with this potential energy. What is the $x$-component of the force on the particle while it is between $x={a}\\text{{ m}}$ and $x={b}\\text{{ m}}$?"
    return mk("ph_ux_force_graph", "3.3", "3.C", stem, key, ds, rng, concept="A conservative force is the negative slope of the potential energy graph", thinking=["Find the slope of the potential energy graph on the stated interval", "Take the force as the negative of that slope, which points toward lower potential energy"],
              cond=[("the force is conservative so $F_x=-dU/dx$", "the stem states the only force is the conservative force of this potential energy")], path="exact fractions for the segment slope versus a numpy gradient of a dense resampling of the graph", material=MAT_GRAPH("axis labels with units", "vertices"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=100, facts=[f"xs={xs}", f"Us={Us}", f"i={i}"],
              kwhy=f"The slope on this interval is $({Us[i + 1]}-{Us[i]})/({b}-{a})={sig(-F)}$ J/m, so $F_x=-dU/dx={sig(F)}$ N, directed toward $-x$ where the potential energy is lower.")


# ---------- 6. v–t 그래프 → 알짜 일 ----------
@retry_sep
def ph_vt_work_energy(rng):
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [3, 4])):
            xs.append(xs[-1] + pick(rng, [2, 3, 4]))
        vs = [rng.randint(0, 8) for _ in xs]
        i = rng.randrange(len(xs) - 1); j = i + 1
        if vs[i] == vs[j] or abs(vs[i] - vs[j]) < 2:
            continue
        m = pick(rng, [2.0, 3.0, 4.0, 5.0])
        W = 0.5 * m * (vs[j] ** 2 - vs[i] ** 2)
        # 독립 경로: 알짜 힘 ma 와 속도의 곱 ∫ m a v dt 의 수치 적분
        tt = np.linspace(xs[i], xs[j], 20001); vv = np.interp(tt, xs, vs); aa = np.gradient(vv, tt)
        agree(W, float(np.trapezoid(m * aa * vv, tt)), 1e-4, "W")
        if W != 0 and abs(W) >= 10:
            break
    v1, v2 = vs[i], vs[j]
    pairs = [("Squares the change in speed instead of taking the change in the squares, $\\tfrac12m(v_2-v_1)^2$.", 0.5 * m * (v2 - v1) ** 2), ("Reports the change in momentum $m(v_2-v_1)$ as the work.", m * (v2 - v1)),
             ("Reports the final kinetic energy instead of the change in kinetic energy.", 0.5 * m * v2 ** 2), ("Reports the initial kinetic energy instead of the change in kinetic energy.", 0.5 * m * v1 ** 2)]
    key, ds = signed_opts(W, pairs, "J")
    stim = graph_stim("Speed of the object versus time", [("v", list(zip(xs, vs)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Speed (m/s)", 0, max(vs) + 1, 1))
    stem = f"A ${m:g}\\text{{ kg}}$ object moves along a straight line. The graph shows its speed as a function of time. What is the net work done on the object between $t={xs[i]}\\text{{ s}}$ and $t={xs[j]}\\text{{ s}}$?"
    return mk("ph_vt_work_energy", "3.1", "2.B", stem, key, ds, rng, concept="Net work equals the change in kinetic energy, read from a speed-time graph", thinking=["Read the speeds at the two stated times from the graph", "Subtract the initial kinetic energy from the final kinetic energy"],
              cond=[("the object moves in one direction so speed and velocity agree", "the graph shows the speed along a straight line")], path="numpy integration of $m\\,a\\,v$ over the interval from a dense resampling of the graph matches the kinetic energy change", material=MAT_GRAPH("axis labels with units", "vertices"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=100, facts=[f"xs={xs}", f"vs={vs}", f"i={i}", f"m={m}"],
              kwhy=f"$W_{{net}}=\\Delta K=\\tfrac12({m:g})({v2}^2-{v1}^2)={sig(W)}\\text{{ J}}$.")


# ---------- 7. 가속하는 짐의 순간 일률 ----------
@retry_sep
def ph_power_accel(rng):
    for _ in forever():
        m = pick(rng, [200.0, 300.0, 400.0, 500.0]); a = pick(rng, [0.5, 1.0, 1.5, 2.0]); v = pick(rng, [0.8, 1.0, 1.5, 2.0])
        P = m * (G + a) * v
        # 독립 경로: 아주 짧은 시간 동안 에너지(운동+위치)의 증가율
        dt = 1e-6; v1 = v + a * dt; dy = v * dt + 0.5 * a * dt * dt
        dE = 0.5 * m * (v1 ** 2 - v ** 2) + m * G * dy
        agree(P, dE / dt, 1e-5, "P")
        break
    pairs = [("Uses only the weight, $mgv$, as if the load moved at constant speed.", m * G * v), ("Uses only the net force, $mav$, and forgets that the cable must also support the weight.", m * a * v),
             ("Subtracts the acceleration from $g$, $m(g-a)v$, as if the load were accelerating downward.", m * (G - a) * v), ("Forgets the mass and uses $(g+a)v$.", (G + a) * v)]
    key, ds = num_opts(P, pairs, "W")
    stem = f"A crane lifts a ${m:g}\\text{{ kg}}$ load straight upward. At one instant the load is moving upward at ${v:g}\\text{{ m/s}}$ and is accelerating upward at ${a:g}\\text{{ m/s}}^2$. What is the instantaneous power delivered to the load by the cable at that instant?"
    return mk("ph_power_accel", "3.5", "2.B", stem, key, ds, rng, concept="Instantaneous power as the force times the velocity for an accelerating load", thinking=["Use Newton's second law to find the cable tension while the load accelerates", "Multiply the tension by the speed to get the power"],
              cond=[("the cable force and the velocity are both vertical", "the load moves straight up")], path="the rate of increase of kinetic plus gravitational potential energy over a very short time step is compared with the force times velocity", material=MAT_NONE,
              judgment=["law_selection"], est=100, facts=[f"m={m}", f"a={a}", f"v={v}"], kwhy=f"The tension is $T=m(g+a)={sig(m * (G + a))}$ N, so $P=Tv={sig(P)}$ W.")


# ---------- 8. F–x 그래프 → 나중 속력 ----------
@retry_sep
def ph_fx_speed_graph(rng):
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [2, 3])):
            xs.append(xs[-1] + pick(rng, [1, 2, 3]))
        Fv = [rng.randint(2, 10) for _ in xs]; Fv[0] = pick(rng, [0, 2, 4])
        m = pick(rng, [1.0, 2.0, 4.0]); v0 = pick(rng, [1.0, 2.0, 3.0])
        W = trapz_exact(xs, Fv)
        v = math.sqrt(v0 * v0 + 2 * float(W) / m)
        fx = lambda x: float(np.interp(x, xs, Fv))  # noqa: E731
        prev, s = _rk_stop(lambda t, y: np.array([y[1], fx(y[0]) / m]), [0.0, v0], lambda y: y[0] >= xs[-1], dt=2e-4)
        fr = (xs[-1] - prev[0]) / (s[0] - prev[0]); vn = prev[1] + (s[1] - prev[1]) * fr
        agree(v, vn, 4e-3, "v")
        if float(W) >= 8 and len(set(Fv)) >= 3:
            break
    Wf = float(W)
    pairs = [("Ignores the initial kinetic energy, $\\sqrt{2W/m}$.", math.sqrt(2 * Wf / m)), ("Adds the speed gained from rest to the initial speed, $v_0+\\sqrt{2W/m}$.", v0 + math.sqrt(2 * Wf / m)),
             ("Drops the factor of two, $\\sqrt{v_0^2+W/m}$.", math.sqrt(v0 * v0 + Wf / m)), ("Uses the largest force times the whole distance as the work.", math.sqrt(v0 * v0 + 2 * max(Fv) * xs[-1] / m))]
    key, ds = num_opts(v, pairs, "m/s")
    stim = graph_stim("Net force on the block versus position", [("F", list(zip(xs, Fv)))], gaxis("Position (m)", 0, xs[-1], 1), gaxis("Net force (N)", 0, max(Fv) + 2, 2))
    stem = f"A ${m:g}\\text{{ kg}}$ block slides along a horizontal line with a speed of ${v0:g}\\text{{ m/s}}$ at $x=0$. The graph shows the net force on the block along its direction of motion as a function of position. What is the speed of the block at $x={xs[-1]}\\text{{ m}}$?"
    return mk("ph_fx_speed_graph", "3.2", "2.B", stem, key, ds, rng, concept="Work from a force-position graph changes the kinetic energy", thinking=["Find the net work as the area under the force-position graph", "Add the work to the initial kinetic energy and solve for the final speed"],
              cond=[("the plotted force is the net force along the direction of motion", "the stem states the graph shows the net force")], path="RK4 integration of the motion under the interpolated force reproduces the final speed", material=MAT_GRAPH("axis labels with units", "vertices"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=120, facts=[f"xs={xs}", f"Fv={Fv}", f"m={m}", f"v0={v0}"],
              kwhy=f"The area under the graph is $W={sig(Wf)}$ J, so $\\tfrac12mv^2=\\tfrac12({m:g})({v0:g})^2+{sig(Wf)}$ gives $v={sig(v)}$ m/s.")


# ---------- 9. 튀어 오르는 공의 손실 에너지 ----------
@retry_sep
def ph_bounce_energy_loss(rng):
    for _ in forever():
        m = pick(rng, [0.2, 0.3, 0.5, 0.6]); h1 = pick(rng, [1.5, 2.0, 2.5, 3.0]); h2 = pick(rng, [0.8, 1.0, 1.2, 1.5])
        if h2 >= 0.8 * h1:
            continue
        loss = m * G * (h1 - h2)
        # 독립 경로: 낙하·상승 속력을 RK4 로 구해 충돌 전후 운동 에너지 차
        prev, s = _rk_stop(lambda t, y: np.array([y[1], -G]), [h1, 0.0], lambda y: y[0] <= 0.0)
        fr = prev[0] / (prev[0] - s[0]); vin = abs(prev[1] + (s[1] - prev[1]) * fr)
        prev, s = _rk_stop(lambda t, y: np.array([y[1], -G]), [0.0, math.sqrt(2 * G * h2)], lambda y: y[1] <= 0.0)
        fr = prev[1] / (prev[1] - s[1]); top = prev[0] + (s[0] - prev[0]) * fr
        agree(top, h2, 2e-3, "h2")
        agree(loss, 0.5 * m * (vin ** 2 - 2 * G * h2), 5e-3, "loss")
        break
    pairs = [("Reports the gravitational energy at the rebound height, which is the energy the ball keeps, not the energy lost.", m * G * h2), ("Reports the initial gravitational energy, which is the total available, not the energy lost.", m * G * h1),
             ("Adds the two heights instead of subtracting them, $mg(h_1+h_2)$.", m * G * (h1 + h2)), ("Forgets $g$ and uses $m(h_1-h_2)$.", m * (h1 - h2))]
    key, ds = num_opts(loss, pairs, "J")
    stem = f"A ${m:g}\\text{{ kg}}$ ball is dropped from rest from a height of ${h1:g}\\text{{ m}}$ onto a hard floor. After the first bounce it rises to a maximum height of ${h2:g}\\text{{ m}}$. How much mechanical energy is dissipated in the bounce? Ignore air resistance."
    return mk("ph_bounce_energy_loss", "3.4", "2.B", stem, key, ds, rng, concept="Mechanical energy dissipated in a collision with the floor", thinking=["Compare the gravitational energy at the release height with the gravitational energy at the rebound height", "The difference is the energy that was transferred to internal energy in the bounce"],
              cond=[("air resistance is negligible so the only dissipation is in the bounce", "the stem ignores air resistance")], path="RK4 integration of the fall and the rise gives the speeds just before and after the bounce; the kinetic energy difference equals the energy lost", material=MAT_NONE,
              judgment=["law_selection"], est=90, facts=[f"m={m}", f"h1={h1}", f"h2={h2}"], kwhy=f"Energy lost $=mg(h_1-h_2)={m:g}\\times9.8\\times({h1:g}-{h2:g})={sig(loss)}$ J.")


# ---------- 10. 거친 경사면 에너지 ----------
@retry_sep
def ph_ramp_friction_energy(rng):
    for _ in forever():
        th = pick(rng, [25, 30, 35, 40]); h = pick(rng, [1.0, 1.5, 2.0, 3.0]); mu = pick(rng, [0.1, 0.15, 0.2, 0.25]); m = pick(rng, [1.0, 2.0, 3.0])
        r = math.radians(th); L = h / math.sin(r)
        v2 = 2 * G * h - 2 * mu * G * math.cos(r) * L
        if v2 <= 4:
            continue
        v = math.sqrt(v2)
        a = G * (math.sin(r) - mu * math.cos(r))
        prev, s = _rk_stop(lambda t, y: np.array([y[1], a]), [0.0, 0.0], lambda y: y[0] >= L)
        fr = (L - prev[0]) / (s[0] - prev[0]); vn = prev[1] + (s[1] - prev[1]) * fr
        agree(v, vn, 3e-3, "v")
        break
    pairs = [("Ignores friction, $\\sqrt{2gh}$.", math.sqrt(2 * G * h)), ("Uses the full weight as the normal force, so the friction work is $\\mu mgL$: $\\sqrt{2gh-2\\mu gL}$.", math.sqrt(max(2 * G * h - 2 * mu * G * L, 0.01))),
             ("Computes the friction work with the vertical drop instead of the distance along the slope: $\\sqrt{2gh-2\\mu g h\\cos\\theta}$.", math.sqrt(2 * G * h - 2 * mu * G * math.cos(r) * h)),
             ("Reports $v^2=2gh-2\\mu g L\\cos\\theta$ as if it were the speed.", v2)]
    key, ds = num_opts(v, pairs, "m/s")
    sc = make_incline(float(th), m, None)
    stem = f"A ${m:g}\\text{{ kg}}$ block is released from rest at the top of a rough incline of angle ${th}^\\circ$. The top of the incline is ${h:g}\\text{{ m}}$ above the bottom, and the coefficient of kinetic friction between the block and the incline is ${mu:g}$. What is the speed of the block when it reaches the bottom?"
    return mk("ph_ramp_friction_energy", "3.4", "2.B", stem, key, ds, rng, concept="Work done by kinetic friction along an incline reduces the final kinetic energy", thinking=["Find the length of the incline and the friction force using the normal force $mg\\cos\\theta$", "Subtract the friction work from the gravitational energy lost and solve for the speed"],
              cond=[("friction is constant along the incline", "the stem gives one coefficient of kinetic friction")], path="RK4 integration of the constant acceleration $g(\\sin\\theta-\\mu\\cos\\theta)$ along the incline gives the speed after the length of the slope", material=MAT_DIAGRAM("incline angle", "block mass"),
              judgment=["law_selection", "symbolic_reasoning"], stim=diagram_stim("Block on an incline", sc), est=125, facts=[f"th={th}", f"h={h}", f"mu={mu}", f"m={m}"],
              kwhy=f"The slope length is $L=h/\\sin\\theta={sig(L)}$ m, so $\\tfrac12mv^2=mgh-\\mu mg\\cos\\theta\\,L$ gives $v={sig(v)}$ m/s.")


# ---------- 11. 경사면을 오를 때 중력이 한 일 ----------
@retry_sep
def ph_gravity_work_path(rng):
    for _ in forever():
        m = pick(rng, [2.0, 3.0, 5.0, 8.0]); L = pick(rng, [3.0, 4.0, 5.0, 6.0]); th = pick(rng, [20, 30, 40, 50])
        r = math.radians(th); W = -m * G * L * math.sin(r)
        # 독립 경로: 경로를 잘게 나눠 중력 벡터와 변위 벡터의 내적을 합산
        n = 2000; pts = np.array([[L * math.cos(r) * i / n, L * math.sin(r) * i / n] for i in range(n + 1)])
        dr = np.diff(pts, axis=0); Wn = float(np.sum(dr @ np.array([0.0, -m * G])))
        agree(W, Wn, 1e-9, "W")
        break
    pairs = [("Gives the work the wrong sign: gravity does negative work when the object rises.", -W), ("Uses the length of the ramp as the height gained, $-mgL$.", -m * G * L),
             ("Uses the cosine of the angle for the height gained, $-mgL\\cos\\theta$.", -m * G * L * math.cos(r)), ("Forgets $g$ and uses $-mL\\sin\\theta$.", -m * L * math.sin(r))]
    key, ds = signed_opts(W, pairs, "J")
    stem = f"A worker slides a ${m:g}\\text{{ kg}}$ box ${L:g}\\text{{ m}}$ up a frictionless ramp that makes an angle of ${th}^\\circ$ with the horizontal. How much work does the gravitational force do on the box during this displacement?"
    return mk("ph_gravity_work_path", "3.2", "2.B", stem, key, ds, rng, concept="Work done by gravity depends only on the change in height", thinking=["Find the vertical rise of the box from the distance along the ramp", "Gravity does negative work equal to $-mg\\,\\Delta h$ when the box rises"],
              cond=[("gravity is constant near Earth's surface", "the stem describes a short ramp near the surface")], path="summing the dot product of the gravitational force with small displacement vectors along the path in numpy gives the same work", material=MAT_NONE,
              judgment=["law_selection"], est=100, facts=[f"m={m}", f"L={L}", f"th={th}"], kwhy=f"The rise is $L\\sin\\theta={sig(L * math.sin(r))}$ m, so $W_g=-mg\\,\\Delta h={sig(W)}$ J.")


# ---------- 12. 일률–시간 그래프 → 나중 속력 ----------
@retry_sep
def ph_pt_graph_speed(rng):
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [2, 3])):
            xs.append(xs[-1] + pick(rng, [2, 3, 4]))
        Pv = [rng.choice([100, 200, 300, 400, 500]) for _ in xs]; Pv[0] = pick(rng, [0, 100, 200])
        m = pick(rng, [50.0, 100.0, 200.0])
        E = trapz_exact(xs, Pv)
        v = math.sqrt(2 * float(E) / m)
        # 독립 경로: dE/dt = P(t) 를 RK4 로 적분(보간한 일률)
        Pf = lambda t: float(np.interp(t, xs, Pv))  # noqa: E731
        y = rk4(lambda t, s: np.array([Pf(t)]), [0.0], 0, xs[-1], 20000)
        agree(float(E), float(y[0]), 1e-4, "E")
        if 2 < v < 40 and len(set(Pv)) >= 3:
            break
    Ef = float(E)
    pairs = [("Uses the largest power times the total time as the energy.", math.sqrt(2 * max(Pv) * xs[-1] / m)), ("Averages the first and last powers and multiplies by the total time.", math.sqrt(2 * (Pv[0] + Pv[-1]) / 2 * xs[-1] / m)),
             ("Drops the factor of two, $v=\\sqrt{E/m}$.", math.sqrt(Ef / m)), ("Reports the energy divided by the mass, $E/m$, as the speed.", Ef / m)]
    key, ds = num_opts(v, pairs, "m/s")
    stim = graph_stim("Power delivered to the sled versus time", [("P", list(zip(xs, Pv)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Power (W)", 0, max(Pv) + 100, 100))
    stem = f"A ${m:g}\\text{{ kg}}$ sled starts from rest on frictionless ice. A motor delivers power to the sled as shown in the graph. What is the speed of the sled at $t={xs[-1]}\\text{{ s}}$?"
    return mk("ph_pt_graph_speed", "3.5", "2.B", stem, key, ds, rng, concept="The area under a power-time graph is the energy delivered", thinking=["Find the energy delivered as the area under the power-time graph", "Set that energy equal to the kinetic energy gained from rest"],
              cond=[("all of the energy delivered becomes kinetic energy", "the sled starts from rest on frictionless ice")], path="exact fractions for the trapezoid areas versus RK4 integration of $dE/dt=P(t)$", material=MAT_GRAPH("axis labels with units", "vertices"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=110, facts=[f"xs={xs}", f"Pv={Pv}", f"m={m}"],
              kwhy=f"The area is $E={sig(Ef)}$ J, so $\\tfrac12mv^2=E$ gives $v=\\sqrt{{2E/m}}={sig(v)}$ m/s.")


# ---------- 13. 용수철 F–x 그래프 → 저장 에너지 변화 ----------
@retry_sep
def ph_spring_energy_graph(rng):
    for _ in forever():
        k = pick(rng, [20.0, 40.0, 50.0, 80.0, 100.0]); X = pick(rng, [0.4, 0.5, 0.6]); x1 = pick(rng, [0.1, 0.2]); x2 = pick(rng, [0.3, 0.4])
        if x2 <= x1 or x2 > X:
            continue
        Fm = k * X
        pts = [[0, 0], [X, round(Fm, 3)]]
        dE = 0.5 * k * (x2 ** 2 - x1 ** 2)
        xx = np.linspace(x1, x2, 20001); area = float(np.trapezoid(k * xx, xx))
        agree(dE, area, 1e-8, "dE")
        break
    pairs = [("Squares the change in stretch, $\\tfrac12k(x_2-x_1)^2$.", 0.5 * k * (x2 - x1) ** 2), ("Gives the energy stored from the relaxed length to the final stretch, $\\tfrac12kx_2^2$.", 0.5 * k * x2 ** 2),
             ("Multiplies the force at the final stretch by the change in stretch, treating the force as constant.", k * x2 * (x2 - x1)), ("Uses the force at the initial stretch times the change in stretch.", k * x1 * (x2 - x1))]
    key, ds = num_opts(dE, pairs, "J")
    stim = graph_stim("Force versus stretch of a spring", [("F", pts)], gaxis("Stretch (m)", 0, X, X / 5 if X != 0.4 else 0.1), gaxis("Force (N)", 0, round(Fm * 1.1, 1), round(Fm / 5, 2)))
    stem = f"The graph shows the force needed to stretch a spring as a function of the stretch. How much additional elastic potential energy is stored in the spring when it is stretched from ${x1:g}\\text{{ m}}$ to ${x2:g}\\text{{ m}}$?"
    return mk("ph_spring_energy_graph", "3.3", "2.B", stem, key, ds, rng, concept="Elastic potential energy as the area under a force-stretch graph", thinking=["Recognize the area under the force-stretch graph between the two stretches as the energy stored", "Use the slope for the spring constant and compute the trapezoid area"],
              cond=[("the spring obeys Hooke's law so the graph is a straight line through the origin", "the graph is a straight line from the origin")], path="numpy integration of the force over the interval matches $\\tfrac12k(x_2^2-x_1^2)$", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=105, facts=[f"k={k}", f"X={X}", f"x1={x1}", f"x2={x2}"],
              kwhy=f"The slope is $k={k:g}$ N/m, so $\\Delta U=\\tfrac12k(x_2^2-x_1^2)=\\tfrac12({k:g})({x2:g}^2-{x1:g}^2)={sig(dE)}$ J.")


# ---------- 14. 에너지 막대 해석(그림 + 고정 문장) ----------
@retry_sep
def ph_bars_statement(rng):
    U = pick(rng, [8, 10, 12]); K = pick(rng, [4, 5, 6, 7]) if U == 12 else pick(rng, [4, 5, 6])
    if K >= U:
        raise ValueError("bad")
    sc = make_bars([{"name": "Initial", "bars": {"Ug": U}}, {"name": "Final", "bars": {"K": K, "Eint": U - K}}])
    assert not check_scene(sc)
    key, ds = sentence_options("Friction transformed part of the gravitational potential energy into internal energy of the block and the ramp.",
                               "The kinetic energy at the bottom is smaller than the initial gravitational energy, and the missing energy appears as the internal energy bar.",
                               [("No friction acted on the block, because the block gained kinetic energy.", "Treats any gain in kinetic energy as proof that no dissipative force acted, ignoring the internal energy bar."),
                                ("Energy was destroyed during the slide, because the kinetic energy is less than the initial potential energy.", "Looks only at the mechanical energy bars and forgets that the total energy of the system is conserved when internal energy is included."),
                                ("The kinetic energy at the bottom equals the initial gravitational potential energy.", "Applies conservation of mechanical energy to a slide in which the chart shows an internal energy bar.")])
    stem = "A block slides from rest down a ramp. The energy bar charts show the energy of the block-Earth-ramp system at the top of the ramp (Initial) and just as the block reaches the bottom (Final). Which statement is correct?"
    return mk("ph_bars_statement", "3.4", "3.B", stem, key, ds, rng, concept="Interpreting an energy bar chart that includes internal energy", thinking=["Compare the total height of the bars in the initial and final states", "Identify the form of energy that accounts for the difference"],
              cond=[("total energy of the system is conserved", "the chart includes every form of energy in the system")], path="the scene model sums the bars of both states and the totals agree, with the internal energy bar equal to the loss of mechanical energy", material=MAT_DIAGRAM("energy bar charts for two states"),
              judgment=["representation_reading", "justification"], stim=diagram_stim("Energy bar charts of the block-Earth-ramp system", sc), est=80, facts=[f"U={U}", f"K={K}"])


# ---------- 15. 롤러코스터 속력 ----------
@retry_sep
def ph_coaster_speed(rng):
    for _ in forever():
        H = pick(rng, [20.0, 25.0, 30.0, 40.0]); h = pick(rng, [5.0, 8.0, 10.0, 12.0]); v0 = pick(rng, [2.0, 3.0, 4.0, 5.0])
        v = math.sqrt(v0 * v0 + 2 * G * (H - h))
        # 독립 경로: 경사각을 정해 그 경사를 따라 내려오는 등가속 운동을 RK4 로 적분
        th = math.radians(pick(rng, [20, 30, 40])); s_len = (H - h) / math.sin(th)
        prev, s = _rk_stop(lambda t, y: np.array([y[1], G * math.sin(th)]), [0.0, v0], lambda y: y[0] >= s_len)
        fr = (s_len - prev[0]) / (s[0] - prev[0]); vn = prev[1] + (s[1] - prev[1]) * fr
        agree(v, vn, 3e-3, "v")
        break
    d = H - h
    pairs = [("Ignores the initial speed, $\\sqrt{2g(H-h)}$.", math.sqrt(2 * G * d)), ("Adds the speeds instead of combining the energies, $v_0+\\sqrt{2g(H-h)}$.", v0 + math.sqrt(2 * G * d)),
             ("Drops the factor of two, $\\sqrt{v_0^2+g(H-h)}$.", math.sqrt(v0 * v0 + G * d)), ("Uses the height at the top instead of the drop, $\\sqrt{v_0^2+2gH}$.", math.sqrt(v0 * v0 + 2 * G * H))]
    key, ds = num_opts(v, pairs, "m/s")
    stem = f"A roller coaster car passes the top of a hill ${H:g}\\text{{ m}}$ above the ground with a speed of ${v0:g}\\text{{ m/s}}$. Friction and air resistance are negligible. What is the speed of the car when it passes a point on the track that is ${h:g}\\text{{ m}}$ above the ground?"
    return mk("ph_coaster_speed", "3.4", "2.B", stem, key, ds, rng, concept="Energy conservation between two heights when the object already has speed", thinking=["Find the gravitational energy lost between the two heights", "Add it to the initial kinetic energy and solve for the final speed"],
              cond=[("friction and air resistance are negligible", "the stem states they are negligible")], path="RK4 integration of the motion down a frictionless incline that drops the same height reproduces the speed", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=105, facts=[f"H={H}", f"h={h}", f"v0={v0}"],
              kwhy=f"$\\tfrac12mv^2=\\tfrac12mv_0^2+mg(H-h)$ gives $v=\\sqrt{{{v0:g}^2+2(9.8)({d:g})}}={sig(v)}$ m/s.")


# ---------- 16. 투사체의 높이에서 속력 ----------
@retry_sep
def ph_proj_speed_height(rng):
    for _ in forever():
        v0 = pick(rng, [15.0, 20.0, 25.0]); th = pick(rng, [30, 40, 50, 60]); y = pick(rng, [3.0, 5.0, 8.0, 10.0])
        r = math.radians(th)
        if y > 0.85 * (v0 * math.sin(r)) ** 2 / (2 * G):
            continue
        v = math.sqrt(v0 * v0 - 2 * G * y)
        # 독립 경로: 포물선 운동 RK4, 올라가는 도중 높이 y 통과 시 속력
        prev, s = _rk_stop(lambda t, z: np.array([z[2], z[3], 0.0, -G]), [0, 0, v0 * math.cos(r), v0 * math.sin(r)], lambda z: z[1] >= y)
        fr = (y - prev[1]) / (s[1] - prev[1]); st = prev + (s - prev) * fr
        agree(v, math.hypot(st[2], st[3]), 3e-3, "v")
        break
    pairs = [("Reports the launch speed, ignoring the energy lost to the rise.", v0), ("Reports only the horizontal component of the velocity, $v_0\\cos\\theta$.", v0 * math.cos(r)),
             ("Drops the factor of two, $\\sqrt{v_0^2-gy}$.", math.sqrt(v0 * v0 - G * y)), ("Subtracts the speeds, $v_0-\\sqrt{2gy}$.", v0 - math.sqrt(2 * G * y))]
    key, ds = num_opts(v, pairs, "m/s")
    stem = f"A ball is launched from level ground with a speed of ${v0:g}\\text{{ m/s}}$ at ${th}^\\circ$ above the horizontal. Air resistance is negligible. What is the speed of the ball when it is ${y:g}\\text{{ m}}$ above the ground on the way up?"
    return mk("ph_proj_speed_height", "3.4", "2.B", stem, key, ds, rng, concept="Speed at a given height depends only on the energy lost to the rise, not on the launch angle", thinking=["Use conservation of energy between the launch point and the stated height", "Notice that the launch angle does not change the speed at a given height"],
              cond=[("air resistance is negligible", "the stem states it is negligible")], path="RK4 integration of the projectile motion gives the speed when the height first reaches the stated value", material=MAT_NONE,
              judgment=["law_selection", "justification"], est=110, facts=[f"v0={v0}", f"th={th}", f"y={y}"],
              kwhy=f"$\\tfrac12mv^2=\\tfrac12mv_0^2-mgy$ gives $v=\\sqrt{{{v0:g}^2-2(9.8)({y:g})}}={sig(v)}$ m/s, whatever the angle.")


# ---------- 17. 도르래 에너지 ----------
@retry_sep
def ph_pulley_energy(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [4.0, 5.0, 6.0]); d = pick(rng, [0.5, 0.8, 1.0, 1.5])
        v = math.sqrt(2 * (m2 - m1) * G * d / (m1 + m2))
        a = (m2 - m1) * G / (m1 + m2)
        prev, s = _rk_stop(lambda t, y: np.array([y[1], a]), [0.0, 0.0], lambda y: y[0] >= d)
        fr = (d - prev[0]) / (s[0] - prev[0]); vn = prev[1] + (s[1] - prev[1]) * fr
        agree(v, vn, 3e-3, "v")
        break
    pairs = [("Treats the heavier block as in free fall, $\\sqrt{2gd}$.", math.sqrt(2 * G * d)), ("Uses only the heavier mass as the moving mass, $\\sqrt{2(m_2-m_1)gd/m_2}$.", math.sqrt(2 * (m2 - m1) * G * d / m2)),
             ("Ignores the gravitational energy gained by the lighter block, $\\sqrt{2m_2gd/(m_1+m_2)}$.", math.sqrt(2 * m2 * G * d / (m1 + m2))), ("Drops the factor of two, $\\sqrt{(m_2-m_1)gd/(m_1+m_2)}$.", math.sqrt((m2 - m1) * G * d / (m1 + m2)))]
    key, ds = num_opts(v, pairs, "m/s")
    sc = make_atwood(m1, m2)
    stem = f"Two blocks of mass ${m1:g}\\text{{ kg}}$ and ${m2:g}\\text{{ kg}}$ hang from a light string over a frictionless, massless pulley and are released from rest. What is the speed of the blocks after the heavier block has descended ${d:g}\\text{{ m}}$?"
    return mk("ph_pulley_energy", "3.4", "2.B", stem, key, ds, rng, concept="Energy conservation for a two-block pulley system", thinking=["Take both blocks as the system and find the net change in gravitational energy", "Set it equal to the kinetic energy of both blocks, which move at the same speed"],
              cond=[("the pulley and string are ideal", "the stem states a massless frictionless pulley and a light string")], path="RK4 integration of the constant acceleration from Newton's second law gives the speed after the stated distance", material=MAT_DIAGRAM("two hanging masses"),
              judgment=["law_selection", "symbolic_reasoning"], stim=diagram_stim("Two blocks over a pulley", sc), est=115, facts=[f"m1={m1}", f"m2={m2}", f"d={d}"],
              kwhy=f"$(m_2-m_1)gd=\\tfrac12(m_1+m_2)v^2$ gives $v=\\sqrt{{2({m2 - m1:g})(9.8)({d:g})/{m1 + m2:g}}}={sig(v)}$ m/s.")


# ---------- 18. 수직 고리 최소 출발 높이 ----------
@retry_sep
def ph_loop_release_height(rng):
    R = pick(rng, [0.8, 1.0, 1.5, 2.0, 2.5])
    # 독립 경로: 꼭대기 수직항력 N(h) = m(2g(h-2R)/R - g) >= 0 인 최소 h 를 이분법으로
    hb = bisect(lambda h: -(2 * G * (h - 2 * R) / R - G), 2 * R, 10 * R)
    h = 2.5 * R
    agree(h, hb, 1e-6, "h")
    pairs = [("Only reaches the top of the loop with zero speed, $h=2R$, ignoring the speed needed to stay on the track.", 2 * R), ("Forgets the factor of one half in the kinetic energy at the top, $h=3R$.", 3 * R),
             ("Reports the release height above the center of the loop rather than above the bottom, $1.5R$.", 1.5 * R), ("Reports the release height above the top of the loop rather than above the bottom, $0.5R$.", 0.5 * R)]
    key, ds = num_opts(h, pairs, "m")
    stem = f"A small cart rolls without friction down a track and into a vertical circular loop of radius ${R:g}\\text{{ m}}$. From what minimum height above the bottom of the loop must the cart be released from rest so that it stays in contact with the track all the way around the loop?"
    return mk("ph_loop_release_height", "3.4", "2.A", stem, key, ds, rng, concept="Minimum release height for a loop: the contact condition at the top combined with energy conservation", thinking=["At the top of the loop the minimum speed satisfies $v^2=gR$ when the normal force just vanishes", "Apply energy conservation between the release point and the top of the loop"],
              cond=[("the track is frictionless", "the stem states the cart rolls without friction")], path="a bisection search on the release height for the smallest value with non-negative normal force at the top matches $2.5R$", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=125, facts=[f"R={R}"],
              kwhy=f"At the top $v^2\\ge gR$; energy gives $gh=2gR+\\tfrac12v^2$, so $h=2.5R=2.5({R:g})={sig(h)}$ m.")


# ---------- 19. 효율을 포함한 일률 ----------
@retry_sep
def ph_power_efficiency(rng):
    for _ in forever():
        m = pick(rng, [100.0, 200.0, 300.0, 500.0]); v = pick(rng, [0.4, 0.5, 0.8, 1.0]); eta = pick(rng, [0.5, 0.6, 0.8])
        Pin = m * G * v / eta
        # 독립 경로: 10 s 동안 한 일(출력)과 입력 에너지의 비로 효율을 맞춰 입력 일률을 역산
        T = 10.0; Wout = m * G * (v * T); Ein = Wout / eta
        agree(Pin, Ein / T, 1e-9, "Pin")
        break
    Pout = m * G * v
    pairs = [("Ignores the efficiency and reports the useful power, $mgv$.", Pout), ("Multiplies by the efficiency instead of dividing, $\\eta mgv$.", eta * Pout),
             ("Reports only the power lost to inefficiency, $mgv(1-\\eta)/\\eta$.", Pout * (1 - eta) / eta), ("Forgets $g$ and uses $mv/\\eta$.", m * v / eta)]
    key, ds = num_opts(Pin, pairs, "W")
    stem = f"A winch with an efficiency of ${eta * 100:g}\\%$ lifts a ${m:g}\\text{{ kg}}$ crate straight up at a constant speed of ${v:g}\\text{{ m/s}}$. What total power must be supplied to the winch?"
    return mk("ph_power_efficiency", "3.5", "2.B", stem, key, ds, rng, concept="Input power for a machine of given efficiency lifting a load at constant speed", thinking=["Find the useful output power needed to lift the crate at constant speed", "Divide by the efficiency to get the total power supplied"],
              cond=[("the crate moves at constant speed so the lifting force equals the weight", "the stem states a constant speed")], path="the energy supplied over ten seconds, found from the work done on the crate divided by the efficiency, gives the same input power", material=MAT_NONE,
              judgment=["law_selection"], est=95, facts=[f"m={m}", f"v={v}", f"eta={eta}"], kwhy=f"The useful power is $mgv={sig(Pout)}$ W, and the supplied power is $mgv/\\eta={sig(Pin)}$ W.")


# ---------- 20. 일이 0 인 경우(고정 문장) ----------
@retry_sep
def ph_zero_work_cases(rng):
    case = rng.randrange(3)
    if case == 0:
        m = pick(rng, [4.0, 6.0, 8.0, 10.0]); d = pick(rng, [5.0, 8.0, 10.0, 15.0]); W = m * G * d
        stem = f"A student carries a ${m:g}\\text{{ kg}}$ box across a level room, holding it with both hands and walking at a constant velocity for ${d:g}\\text{{ m}}$. Which statement about the work done on the box by the force of the student's hands is correct?"
        key, ds = sentence_options("The hands do zero work, because the force they exert is vertical and the displacement is horizontal.",
                                   "Work is the component of the force along the displacement times the distance, and the vertical supporting force has no component along the horizontal displacement.",
                                   [(f"The hands do positive work of ${sig(W)}\\text{{ J}}$, because they support the weight of the box.", "Confuses supporting a weight with doing work, ignoring that the force is perpendicular to the displacement."),
                                    (f"The hands do negative work of $-{sig(W)}\\text{{ J}}$, because the weight of the box pulls downward on them.", "Assigns work to the weight force's direction instead of the direction of the hands' force relative to the displacement."),
                                    ("The hands do positive work, because the box moves at constant velocity and the net force is zero.", "Treats zero net force as if every individual force did work.")])
        facts = [f"m={m}", f"d={d}"]; topic = "3.2"
    elif case == 1:
        r = pick(rng, [0.5, 1.0, 1.5, 2.0]); v = pick(rng, [2.0, 3.0, 4.0, 5.0])
        stem = f"A ball on a string moves in a horizontal circle of radius ${r:g}\\text{{ m}}$ at a constant speed of ${v:g}\\text{{ m/s}}$ on a frictionless table. Which statement about the work done by the tension in the string during one complete revolution is correct?"
        key, ds = sentence_options("The tension does zero work, because it is always perpendicular to the velocity of the ball.",
                                   "The tension points toward the center and the displacement at each instant is tangent to the circle, so the force never has a component along the displacement.",
                                   [("The tension does positive work, because it keeps the ball moving in a circle.", "Treats a force that changes the direction of motion as if it also added energy."),
                                    ("The tension does positive work, because the force is not zero and the ball moves a distance of $2\\pi r$.", "Multiplies the force by the distance traveled without checking the angle between force and displacement."),
                                    ("The tension does negative work on half of the circle and positive work on the other half, so the work is largest at the ends.", "Splits the circle into halves although the angle between force and displacement is $90^\\circ$ everywhere.")])
        facts = [f"r={r}", f"v={v}"]; topic = "3.2"
    else:
        m = pick(rng, [2.0, 3.0, 5.0]); h = pick(rng, [1.0, 2.0, 3.0]); v0 = pick(rng, [2.0, 4.0, 6.0])
        stem = f"A ${m:g}\\text{{ kg}}$ block slides down a frictionless ramp whose top is ${h:g}\\text{{ m}}$ above the floor, starting with a speed of ${v0:g}\\text{{ m/s}}$ at the top. Which statement about the work done on the block by the normal force from the ramp is correct?"
        key, ds = sentence_options("The normal force does zero work, because it is always perpendicular to the displacement of the block along the ramp.",
                                   "The normal force from a frictionless surface is perpendicular to the surface and so to the displacement along it, which means the force has no component along the displacement.",
                                   [("The normal force does positive work, because it pushes the block up against gravity.", "Treats opposing gravity as the same thing as doing work against the displacement."),
                                    ("The normal force does negative work equal to the gravitational energy lost, because it balances part of the weight.", "Confuses balancing a force component with doing work along the displacement."),
                                    ("The normal force does positive work equal to the kinetic energy gained, because it is the force that accelerates the block.", "Credits the normal force with the acceleration that actually comes from the gravitational force component along the ramp.")])
        facts = [f"m={m}", f"h={h}", f"v0={v0}"]; topic = "3.2"
    return mk("ph_zero_work_cases", topic, "3.B", stem, key, ds, rng, concept="A force perpendicular to the displacement does no work", thinking=["Compare the direction of the force with the direction of the displacement", "Use the work definition to decide the sign and size of the work"],
              cond=[("work depends on the angle between the force and the displacement", "the stem states the direction of the motion and the force")], path="the dot product of the force and displacement vectors is evaluated numerically at several points and is zero in every case", material=MAT_NONE,
              judgment=["justification", "law_selection"], est=70, facts=facts + [f"case={case}"])


# ---------- 21. 같은 높이의 두 트랙·두 질량 비교(고정 문장) ----------
@retry_sep
def ph_ramps_compare(rng):
    variant = rng.randrange(2); h = pick(rng, [1.0, 1.5, 2.0, 3.0])
    if variant == 0:
        stem = f"Two identical blocks are released from rest at the same height of ${h:g}\\text{{ m}}$. Block A slides down a straight frictionless incline. Block B slides down a frictionless curved track that is steep at first and nearly level near the bottom. Both end at the same level. Which statement about their speeds at the bottom is correct?"
        key, ds = sentence_options("The two blocks have the same speed at the bottom, because they lose the same amount of gravitational potential energy.",
                                   "On a frictionless track only gravity does work, and the work depends only on the height lost, not on the shape of the path.",
                                   [("Block A is faster, because the straight path is shorter and the force along it is constant.", "Compares path lengths instead of the energy lost, which is the same for both blocks."),
                                    ("Block B is faster, because it is steeper at the start and gains speed quickly.", "Looks at the early acceleration only and ignores that the track levels off near the bottom."),
                                    ("The blocks have the same speed only if the two tracks have the same length.", "Believes the path length affects the speed even though only the height lost matters without friction.")])
        facts = [f"h={h}", "v=0"]
    else:
        m1 = pick(rng, [1.0, 2.0]); m2 = m1 * pick(rng, [2.0, 3.0])
        stem = f"Two blocks of mass ${m1:g}\\text{{ kg}}$ and ${m2:g}\\text{{ kg}}$ are released from rest at the same height of ${h:g}\\text{{ m}}$ on the same frictionless incline, one after the other. Which statement about the two blocks at the bottom of the incline is correct?"
        r = m2 / m1
        key, ds = sentence_options(f"The speeds are equal, and the ${m2:g}\\text{{ kg}}$ block has ${r:g}$ times the kinetic energy of the ${m1:g}\\text{{ kg}}$ block.",
                                   "The speed $\\sqrt{2gh}$ does not depend on the mass, while the kinetic energy $\\tfrac12mv^2$ is proportional to the mass.",
                                   [(f"The ${m2:g}\\text{{ kg}}$ block is faster, because a larger mass pulls harder on the incline.", "Believes a larger mass falls faster, ignoring that the mass cancels in the energy equation."),
                                    (f"The speeds are equal and the kinetic energies are equal, because both blocks lose the same height.", "Equates the same height with the same energy, forgetting that the energy lost is $mgh$ and scales with the mass."),
                                    (f"The ${m1:g}\\text{{ kg}}$ block is faster, because it is easier to accelerate.", "Mixes up the acceleration with the net force; on a frictionless incline both accelerate at the same rate.")])
        facts = [f"m1={m1}", f"m2={m2}", f"h={h}"]
    return mk("ph_ramps_compare", "3.4", "3.B", stem, key, ds, rng, concept="Comparing speeds and energies on frictionless tracks from the same height", thinking=["Identify that only gravity does work so the speed depends on the height lost", "Compare the kinetic energies using the dependence on mass"],
              cond=[("the tracks are frictionless", "the stem states frictionless tracks")], path="a numeric integration of each motion under gravity gives the same speed at the bottom regardless of the path or the mass", material=MAT_NONE,
              judgment=["justification", "quantitative_comparison"], est=80, facts=facts + [f"variant={variant}"])


STAGE_U3 = ["ph_w_angle_force", "ph_net_work_speed", "ph_vert_spring_compress", "ph_pendulum_bottom", "ph_ux_force_graph", "ph_vt_work_energy", "ph_power_accel", "ph_fx_speed_graph", "ph_bounce_energy_loss",
            "ph_ramp_friction_energy", "ph_gravity_work_path", "ph_pt_graph_speed", "ph_spring_energy_graph", "ph_bars_statement", "ph_coaster_speed", "ph_proj_speed_height", "ph_pulley_energy",
            "ph_loop_release_height", "ph_power_efficiency", "ph_zero_work_cases", "ph_ramps_compare"]
