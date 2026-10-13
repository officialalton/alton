"""AP Physics 1 원형 E — 단원 1·2·4·5·6·7·8 확장 + 2문항 세트 3개(2026-10-13, 얇은 단원 보강). 규칙은 phys_p0_d.py 와 같다:
정답은 코드가 풀고 독립 경로로 재계산하며, 오답 값은 설명한 오개념 식으로 계산하고, 정답 해설에는 숫자 대입을 넣는다."""
from phys_common import *
from phys_figs import make_collision, check_scene, make_vectors  # noqa: F401
from phys_p0_d import _rk_stop


_seg_text = seg_text  # phys_common.seg_text


def _grid_range(vals, pad=0.1):
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    return math.floor((lo - pad * span) * 2) / 2, math.ceil((hi + pad * span) * 2) / 2


# ======================= U1 =======================
def ph_xt_signs(rng):
    for _ in forever():
        t1 = pick(rng, [1.5, 2.0]); t2 = pick(rng, [4.0, 4.5]); tm = (t1 + t2) / 2; k = pick(rng, [0.4, 0.5, 0.6]); x0 = pick(rng, [3.0, 4.0, 5.0])
        xf = lambda t: x0 + k * (t ** 3 / 3 - (t1 + t2) * t * t / 2 + t1 * t2 * t)  # noqa: E731
        vf = lambda t: k * (t - t1) * (t - t2)  # noqa: E731
        af = lambda t: k * (2 * t - t1 - t2)  # noqa: E731
        ts = sorted(rng.sample([0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5], 4))
        if any(abs(vf(t)) < 0.5 or abs(af(t)) < 0.4 for t in ts):
            continue
        # 독립 경로: 촘촘한 위치 표본의 수치 1·2 차 미분의 부호
        tt = np.linspace(0, 6, 60001); xx = np.array([xf(t) for t in tt]); v_n = np.gradient(xx, tt); a_n = np.gradient(v_n, tt)
        sg = []
        for t in ts:
            idx = int(round(t / 6 * 60000)); sg.append((int(np.sign(v_n[idx])), int(np.sign(a_n[idx]))))
            assert sg[-1] == (int(np.sign(vf(t))), int(np.sign(af(t)))), "sign_path_mismatch"
        queries = {(1, -1): "positive while its speed is decreasing", (-1, -1): "negative while its speed is increasing",
                   (-1, 1): "negative while its speed is decreasing", (1, 1): "positive while its speed is increasing"}
        good = [q for q in queries if sg.count(q) == 1]
        if not good:
            continue
        q = rng.choice(good)
        break
    labs = ["A", "B", "C", "D"]; ki = sg.index(q)

    def why(i):
        v_s, a_s = sg[i]
        return f"At point {labs[i]} the curve is {'rising' if v_s > 0 else 'falling'}, so the velocity is {'positive' if v_s > 0 else 'negative'}, and it bends {'upward' if a_s > 0 else 'downward'}, so the acceleration is {'positive' if a_s > 0 else 'negative'}; the speed is {'increasing' if v_s * a_s > 0 else 'decreasing'}."
    key, ds = sentence_options(f"Point {labs[ki]}", why(ki), [(f"Point {labs[i]}", why(i)) for i in range(4) if i != ki])
    ylo, yhi = _grid_range([xf(t) for t in np.linspace(0, 6, 61)])
    stim = dense_graph_stim("Position versus time of an object", xf, 0, 6, gaxis("Time (s)", 0, 6, 1), gaxis("Position (m)", ylo, yhi, 1), n=121, extra={"labeled_points": [{"x": t, "y": round(xf(t), 4), "label": L} for t, L in zip(ts, labs)]})
    stem = f"The graph shows the position of an object moving along a straight line as a function of time. At which labeled point is the velocity of the object {queries[q]}?"
    return mk("ph_xt_signs", "1.3", "3.C", stem, key, ds, rng, concept="Signs of velocity and acceleration from the slope and curvature of a position-time graph", thinking=["Find the sign of the velocity from the slope of the curve at each point", "Find the sign of the acceleration from whether the curve bends upward or downward, then compare the signs to judge the speed"],
              cond=[("the curve is smooth", "the graph is a smooth cubic curve with labeled points away from turning points")], path="numpy first and second differences of a dense sampling of the position function give the signs of velocity and acceleration at each labeled time", material=MAT_GRAPH("axis labels with units", "labeled points A to D"),
              judgment=["representation_reading", "justification"], stim=stim, est=95, facts=[f"ts={ts}", f"t1={t1}", f"t2={t2}", f"k={k}", f"q={list(q)}"])


@retry_sep
def ph_three_stage_motion(rng):
    for _ in forever():
        a1 = pick(rng, [1.0, 2.0, 3.0]); t1 = pick(rng, [4.0, 5.0, 6.0, 8.0]); t2 = pick(rng, [10.0, 15.0, 20.0]); ab = pick(rng, [2.0, 4.0, 5.0])
        v = a1 * t1
        d = 0.5 * a1 * t1 ** 2 + v * t2 + v * v / (2 * ab)
        # 독립 경로: 작은 시간 간격으로 세 단계를 직접 시뮬레이션
        dt = 1e-3; x = 0.0; vel = 0.0; t = 0.0
        while t < t1:
            x += vel * dt + 0.5 * a1 * dt * dt; vel += a1 * dt; t += dt
        x += vel * t2
        while vel > 0:
            x += vel * dt - 0.5 * ab * dt * dt; vel -= ab * dt
        agree(d, x, 3e-3, "d")
        if d < 400:
            break
    pairs = [("Leaves out the braking stage and adds only the first two stages.", 0.5 * a1 * t1 ** 2 + v * t2), ("Leaves out the starting stage and adds only the cruising and braking stages.", v * t2 + v * v / (2 * ab)),
             ("Uses the final speed times the time for the starting stage, $vt_1$, instead of the average speed.", v * t1 + v * t2 + v * v / (2 * ab)), ("Treats the whole trip as cruising at the top speed for the three durations, using $v(t_1+t_2+v/a_b)$.", v * (t1 + t2 + v / ab))]
    key, ds = num_opts(d, pairs, "m")
    stem = f"A car starts from rest and speeds up uniformly at ${a1:g}\\text{{ m/s}}^2$ for ${t1:g}\\text{{ s}}$. It then travels at constant speed for ${t2:g}\\text{{ s}}$ and finally brakes uniformly at ${ab:g}\\text{{ m/s}}^2$ until it stops. What is the total distance traveled by the car?"
    return mk("ph_three_stage_motion", "1.2", "2.B", stem, key, ds, rng, concept="Total displacement for motion made of stages with different accelerations", thinking=["Find the speed at the end of the first stage and the distance covered in each stage separately", "Add the three distances"],
              cond=[("each stage has a constant acceleration", "the stem states uniform acceleration, constant speed and uniform braking")], path="a time-stepped simulation of the three stages reproduces the total distance", material=MAT_NONE,
              judgment=["law_selection"], est=120, facts=[f"a1={a1}", f"t1={t1}", f"t2={t2}", f"ab={ab}"],
              kwhy=f"The top speed is ${sig(v)}\\text{{ m/s}}$; the stage distances are ${sig(0.5 * a1 * t1 ** 2)}$, ${sig(v * t2)}$ and ${sig(v * v / (2 * ab))}$ meters, for a total of ${sig(d)}\\text{{ m}}$.")


# ======================= U2 =======================
@retry_sep
def ph_contact_force_blocks(rng):
    for _ in forever():
        m1 = pick(rng, [2.0, 3.0, 4.0]); m2 = pick(rng, [1.0, 2.0, 5.0, 6.0]); F = pick(rng, [12.0, 18.0, 24.0, 30.0])
        N = F * m2 / (m1 + m2)
        # 독립 경로: 두 블록의 운동 방정식을 연립 일차식으로 직접 풀기 (a, N)
        A = np.array([[m1, 1.0], [m2, -1.0]]); b = np.array([F, 0.0]); a, Nn = np.linalg.solve(A, b)
        agree(N, Nn, 1e-9, "N")
        if m1 != m2:
            break
    pairs = [("Assumes the contact force equals the applied force, $F$.", F), ("Swaps the masses, $Fm_1/(m_1+m_2)$.", F * m1 / (m1 + m2)),
             ("Splits the applied force evenly between the blocks, $F/2$.", F / 2), ("Divides by the mass of the pushing block only, $Fm_2/m_1$.", F * m2 / m1)]
    key, ds = num_opts(N, pairs, "N")
    stem = f"Two blocks sit side by side on a frictionless horizontal table. A horizontal force of ${F:g}\\text{{ N}}$ pushes on block A, of mass ${m1:g}\\text{{ kg}}$, which is in contact with block B, of mass ${m2:g}\\text{{ kg}}$. What is the magnitude of the force that block A exerts on block B?"
    return mk("ph_contact_force_blocks", "2.5", "2.B", stem, key, ds, rng, concept="Contact force between two accelerating blocks pushed together", thinking=["Find the common acceleration of the two-block system", "Apply Newton's second law to block B alone to find the contact force"],
              cond=[("the blocks move together with the same acceleration", "the blocks are in contact and pushed by a single force on a frictionless table")], path="a linear system for the acceleration and the contact force is solved directly with numpy and agrees with the symbolic result", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=105, facts=[f"m1={m1}", f"m2={m2}", f"F={F}"],
              kwhy=f"The acceleration is $a=F/(m_1+m_2)={sig(F / (m1 + m2))}\\text{{ m/s}}^2$, so the force on block B is $m_2a={sig(N)}\\text{{ N}}$.")


@retry_sep
def ph_incline_pulley(rng):
    for _ in forever():
        m1 = pick(rng, [2.0, 3.0, 4.0]); m2 = pick(rng, [3.0, 4.0, 5.0, 6.0]); th = pick(rng, [20, 30, 40])
        r = math.radians(th)
        if m2 <= m1 * math.sin(r) * 1.3:
            continue
        a = (m2 - m1 * math.sin(r)) * G / (m1 + m2)
        A = np.array([[m1, -1.0], [m2, 1.0]]); b = np.array([-m1 * G * math.sin(r), m2 * G]); an, T = np.linalg.solve(A, b)
        agree(a, an, 1e-9, "a")
        break
    pairs = [("Treats the incline as vertical, $(m_2-m_1)g/(m_1+m_2)$.", (m2 - m1) * G / (m1 + m2)), ("Uses the cosine of the angle for the component along the incline, $(m_2-m_1\\cos\\theta)g/(m_1+m_2)$.", (m2 - m1 * math.cos(r)) * G / (m1 + m2)),
             ("Divides by the hanging mass only, $(m_2-m_1\\sin\\theta)g/m_2$.", (m2 - m1 * math.sin(r)) * G / m2), ("Ignores the component of weight along the incline, $m_2g/(m_1+m_2)$.", m2 * G / (m1 + m2))]
    key, ds = num_opts(a, pairs, "m/s^2")
    stem = f"A ${m1:g}\\text{{ kg}}$ block rests on a frictionless incline that makes an angle of ${th}^\\circ$ with the horizontal. A light string runs from the block up the incline, over a frictionless pulley at the top, and down to a hanging ${m2:g}\\text{{ kg}}$ mass. The system is released from rest. What is the magnitude of the acceleration of the blocks?"
    return mk("ph_incline_pulley", "2.5", "2.B", stem, key, ds, rng, concept="Newton's second law for two connected objects, one on an incline", thinking=["Write Newton's second law along the incline for the first block and vertically for the hanging mass", "Add the equations so the tension cancels and solve for the acceleration"],
              cond=[("the string and pulley are ideal and the incline is frictionless", "the stem states a light string, frictionless pulley and frictionless incline")], path="the two equations of motion are solved as a linear system for the acceleration and tension with numpy", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=125, facts=[f"m1={m1}", f"m2={m2}", f"th={th}"],
              kwhy=f"The net force along the string is $m_2g-m_1g\\sin\\theta$, so $a=(m_2-m_1\\sin{th}^\\circ)g/(m_1+m_2)={sig(a)}\\text{{ m/s}}^2$.")


@retry_sep
def ph_push_angle_normal(rng):
    for _ in forever():
        m = pick(rng, [4.0, 5.0, 8.0, 10.0]); F = pick(rng, [20.0, 30.0, 40.0, 50.0]); th = pick(rng, [25, 30, 40, 55])
        r = math.radians(th)
        N = m * G + F * math.sin(r)
        Fv = np.array([F * math.cos(r), -F * math.sin(r)]); N_n = -(np.array([0.0, -m * G]) + Fv)[1]
        agree(N, N_n, 1e-9, "N")
        break
    pairs = [("Gives only the weight, $mg$, ignoring the vertical component of the push.", m * G), ("Subtracts the vertical component, $mg-F\\sin\\theta$, as if the person pulled upward.", m * G - F * math.sin(r)),
             ("Adds the horizontal component instead of the vertical one, $mg+F\\cos\\theta$.", m * G + F * math.cos(r)), ("Adds the whole push to the weight, $mg+F$.", m * G + F)]
    key, ds = num_opts(N, pairs, "N")
    stem = f"A person pushes a ${m:g}\\text{{ kg}}$ box across a level floor with a force of ${F:g}\\text{{ N}}$ directed ${th}^\\circ$ below the horizontal. What is the magnitude of the normal force exerted by the floor on the box?"
    return mk("ph_push_angle_normal", "2.2", "2.B", stem, key, ds, rng, concept="Normal force when an applied force has a vertical component", thinking=["Resolve the push into horizontal and vertical components", "Balance the vertical forces on the box, which does not accelerate vertically"],
              cond=[("the box does not accelerate vertically", "the box slides along a level floor")], path="the vertical force balance is evaluated with explicit force vectors in numpy", material=MAT_NONE,
              judgment=["law_selection"], est=95, facts=[f"m={m}", f"F={F}", f"th={th}"], kwhy=f"The downward component of the push presses the box into the floor, so $N=mg+F\\sin\\theta={sig(m * G)}+{sig(F * math.sin(r))}={sig(N)}\\text{{ N}}$.")


@retry_sep
def ph_crate_stop_distance(rng):
    for _ in forever():
        v0 = pick(rng, [10.0, 15.0, 20.0, 25.0]); mu = pick(rng, [0.3, 0.4, 0.5, 0.6])
        d = v0 * v0 / (2 * mu * G)
        prev, s = _rk_stop(lambda t, y: np.array([y[1], -mu * G]), [0.0, v0], lambda y: y[1] <= 0.0)
        fr = prev[1] / (prev[1] - s[1]); dn = prev[0] + (s[0] - prev[0]) * fr
        agree(d, dn, 3e-3, "d")
        break
    pairs = [("Forgets the factor of two, $v^2/(\\mu_s g)$.", v0 * v0 / (mu * G)), ("Ignores friction and uses $v^2/(2g)$.", v0 * v0 / (2 * G)),
             ("Puts the coefficient in the numerator, $\\mu_s v^2/(2g)$.", mu * v0 * v0 / (2 * G)), ("Forgets $g$ and uses $v^2/(2\\mu_s)$.", v0 * v0 / (2 * mu))]
    key, ds = num_opts(d, pairs, "m")
    stem = f"A flatbed truck carries a crate that is not tied down. The coefficient of static friction between the crate and the truck bed is ${mu:g}$. The truck travels at ${v0:g}\\text{{ m/s}}$ on a level road and brakes uniformly. What is the shortest distance in which the truck can stop without the crate sliding?"
    return mk("ph_crate_stop_distance", "2.7", "2.B", stem, key, ds, rng, concept="Maximum static friction limits the acceleration of an object carried by an accelerating surface", thinking=["The largest deceleration the crate can share with the truck is set by the maximum static friction force", "Use that acceleration in the kinematic stopping distance"],
              cond=[("the crate does not slide so static friction provides its deceleration", "the stem asks for the stop with no sliding")], path="RK4 integration of the motion with the maximum deceleration $\\mu_sg$ gives the same stopping distance", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=110, facts=[f"v0={v0}", f"mu={mu}"],
              kwhy=f"The greatest deceleration is $\\mu_sg={sig(mu * G)}\\text{{ m/s}}^2$, so $d=v^2/(2\\mu_sg)={sig(d)}\\text{{ m}}$.")


# ======================= U4 =======================
@retry_sep
def ph_pt_slope_force(rng):
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [3, 4])):
            xs.append(xs[-1] + pick(rng, [2, 3, 4]))
        ps = [rng.randint(0, 16) for _ in xs]
        i = rng.randrange(len(xs) - 1)
        sl = Fr(ps[i + 1] - ps[i], xs[i + 1] - xs[i])
        nb = i + 1 if i + 2 < len(xs) else i - 1
        sl2 = Fr(ps[nb + 1] - ps[nb], xs[nb + 1] - xs[nb])
        if sl == 0 or sl == sl2 or sl2 == 0:
            continue
        tt = np.linspace(xs[i], xs[i + 1], 2001)[1:-1]; gr = float(np.mean(np.gradient(np.interp(tt, xs, ps), tt)))
        agree(float(sl), gr, 1e-6, "F")
        break
    F = float(sl); a, b = xs[i], xs[i + 1]
    pairs = [("Reports the change in momentum over the interval without dividing by the elapsed time.", float(ps[i + 1] - ps[i])), ("Divides the momentum at the end of the interval by the time at the end, the slope from the origin.", ps[i + 1] / b),
             ("Reports the net force on the neighboring segment instead of the stated interval.", float(sl2)), ("Takes the inverse of the slope, $\\Delta t/\\Delta p$.", float(1 / sl))]
    key, ds = signed_opts(F, pairs, "N")
    stim = graph_stim("Momentum of the cart versus time", [("p", list(zip(xs, ps)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Momentum (kg·m/s)", 0, max(ps) + 2, 2))
    stem = f"The graph shows the momentum of a cart moving along a straight track as a function of time. What is the net force on the cart between $t={a}\\text{{ s}}$ and $t={b}\\text{{ s}}$?"
    return mk("ph_pt_slope_force", "4.2", "2.B", stem, key, ds, rng, concept="Net force is the slope of a momentum-time graph", thinking=["Recognize that the net force is the rate of change of momentum", "Find the slope of the graph on the stated interval"],
              cond=[("the net force is constant on each straight segment", "the graph is piecewise linear")], path="exact fractions for the segment slope versus a numpy gradient of a dense resampling", material=MAT_GRAPH("axis labels with units", "vertices"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=90, facts=[f"xs={xs}", f"ps={ps}", f"i={i}"],
              kwhy=f"The slope is $\\Delta p/\\Delta t=({ps[i + 1]}-{ps[i]})/({b}-{a})={sig(F)}\\text{{ N}}$.")


@retry_sep
def ph_three_body_explosion(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [2.0, 3.0, 4.0]); m3 = pick(rng, [1.0, 2.0, 4.0]); v1 = -pick(rng, [2.0, 3.0, 4.0]); v2 = pick(rng, [1.0, 2.0, 3.0, 5.0])
        if len({m1, m2, m3}) < 3:
            continue
        v3 = -(m1 * v1 + m2 * v2) / m3
        # 독립 경로: 폭발 전후 총 운동량 보존을 선형 방정식으로 풀기
        A = np.array([[m3]]); b = np.array([0.0 - (m1 * v1 + m2 * v2)]); agree(v3, float(np.linalg.solve(A, b)[0]), 1e-9, "v3")
        if abs(v3) > 0.4:
            break
    M = m1 + m2 + m3
    pairs = [("Gives the velocity the wrong sign, $+(m_1v_1+m_2v_2)/m_3$.", (m1 * v1 + m2 * v2) / m3), ("Ignores the second piece, $-m_1v_1/m_3$.", -m1 * v1 / m3),
             ("Adds the magnitudes of the two momenta instead of the signed momenta, $(m_1|v_1|+m_2|v_2|)/m_3$ directed to the left.", -(m1 * abs(v1) + m2 * abs(v2)) / m3),
             ("Divides by the total mass instead of the mass of the third piece, $-(m_1v_1+m_2v_2)/M$.", -(m1 * v1 + m2 * v2) / M)]
    key, ds = signed_opts(v3, pairs, "m/s")
    stem = f"A ${M:g}\\text{{ kg}}$ object at rest on a frictionless surface explodes into three pieces that move along a line. Piece A, of mass ${m1:g}\\text{{ kg}}$, moves at ${abs(v1):g}\\text{{ m/s}}$ to the left. Piece B, of mass ${m2:g}\\text{{ kg}}$, moves at ${v2:g}\\text{{ m/s}}$ to the right. What is the velocity of piece C, of mass ${m3:g}\\text{{ kg}}$? Take right as positive."
    return mk("ph_three_body_explosion", "4.3", "2.B", stem, key, ds, rng, concept="Conservation of momentum in an explosion with three pieces", thinking=["The total momentum before the explosion is zero, so it is zero afterward", "Use signed momenta for the three pieces and solve for the unknown velocity"],
              cond=[("no external horizontal force acts on the system", "the surface is frictionless and the object starts at rest")], path="the conservation equation is solved as a linear system with numpy and agrees with the symbolic result", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=105, facts=[f"m1={m1}", f"m2={m2}", f"m3={m3}", f"v1={v1}", f"v2={v2}"],
              kwhy=f"Total momentum is zero: ${m1:g}({v1:g})+{m2:g}({v2:g})+{m3:g}v_3=0$, so $v_3={sig(v3)}\\text{{ m/s}}$.")


@retry_sep
def ph_wall_bounce_impulse(rng):
    for _ in forever():
        m = pick(rng, [0.1, 0.15, 0.2, 0.5]); v1 = pick(rng, [8.0, 10.0, 12.0, 15.0]); v2 = pick(rng, [4.0, 5.0, 6.0, 8.0]); dt = pick(rng, [0.01, 0.02, 0.05])
        if v2 >= v1:
            continue
        F = m * (v1 + v2) / dt
        # 독립 경로: 접촉 시간 동안 일정한 힘 F 로 속도를 RK4 적분하면 +v1 에서 -v2 가 되는지
        y = rk4(lambda t, s: np.array([-F / m]), [v1], 0, dt, 200)
        agree(float(y[0]), -v2, 1e-6, "v_after")
        break
    pairs = [("Subtracts the speeds, ignoring that the velocity reverses, $m(v_1-v_2)/\\Delta t$.", m * (v1 - v2) / dt), ("Ignores the rebound and uses only the incoming momentum, $mv_1/\\Delta t$.", m * v1 / dt),
             ("Gives the impulse without dividing by the contact time, $m(v_1+v_2)$.", m * (v1 + v2)), ("Forgets the mass and uses $(v_1+v_2)/\\Delta t$.", (v1 + v2) / dt)]
    key, ds = num_opts(F, pairs, "N")
    stem = f"A ${m:g}\\text{{ kg}}$ ball strikes a wall perpendicular to it at ${v1:g}\\text{{ m/s}}$ and rebounds along the same line at ${v2:g}\\text{{ m/s}}$. The ball is in contact with the wall for ${dt:g}\\text{{ s}}$. What is the magnitude of the average force exerted by the wall on the ball?"
    return mk("ph_wall_bounce_impulse", "4.2", "2.B", stem, key, ds, rng, concept="Impulse when the velocity reverses direction", thinking=["Find the change in momentum, remembering that the velocity changes sign", "Divide the magnitude of the impulse by the contact time"],
              cond=[("the force acts along the line of motion only", "the ball strikes perpendicular to the wall and rebounds along the same line")], path="RK4 integration of the velocity under a constant force of that size over the contact time takes the ball from $+v_1$ to $-v_2$", material=MAT_NONE,
              judgment=["law_selection"], est=100, facts=[f"m={m}", f"v1={v1}", f"v2={v2}", f"dt={dt}"],
              kwhy=f"$\\Delta p=m(v_1+v_2)={sig(m * (v1 + v2))}\\text{{ kg·m/s}}$ in magnitude, so $F=\\Delta p/\\Delta t={sig(F)}\\text{{ N}}$.")


# ======================= U5 =======================
@retry_sep
def ph_wt_angle_graph(rng):
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [2, 3])):
            xs.append(xs[-1] + pick(rng, [2, 3, 4]))
        ws = [rng.randint(0, 12) for _ in xs]; ws[0] = pick(rng, [0, 2, 4])
        ang = trapz_exact(xs, ws)
        rev = float(ang) / (2 * math.pi)
        tt = np.linspace(0, xs[-1], 40001); agree(rev, float(np.trapezoid(np.interp(tt, xs, ws), tt)) / (2 * math.pi), 1e-6, "rev")
        if float(ang) >= 20 and len(set(ws)) >= 3:
            break
    pairs = [("Reports the angle in radians as if it were revolutions.", float(ang)), ("Multiplies by $2\\pi$ instead of dividing, converting in the wrong direction.", float(ang) * 2 * math.pi),
             ("Uses the largest angular speed for the whole interval, $\\omega_{max}T/(2\\pi)$.", max(ws) * xs[-1] / (2 * math.pi)), ("Uses only the first segment of the graph.", float((Fr(ws[0]) + Fr(ws[1])) / 2 * xs[1]) / (2 * math.pi))]
    key, ds = num_opts(rev, pairs, "rev")
    stim = graph_stim("Angular speed of a wheel versus time", [("w", list(zip(xs, ws)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Angular speed (rad/s)", 0, max(ws) + 2, 2))
    stem = f"The graph shows the angular speed of a wheel as a function of time. The wheel always turns in the same direction. How many complete revolutions does the wheel make between $t=0$ and $t={xs[-1]}\\text{{ s}}$?"
    return mk("ph_wt_angle_graph", "5.1", "2.B", stem, key, ds, rng, concept="Angular displacement is the area under an angular speed-time graph", thinking=["Find the area under the graph, which is the angle turned in radians", "Convert radians to revolutions by dividing by $2\\pi$"],
              cond=[("the wheel does not reverse direction", "the stem states the wheel always turns the same way")], path="exact fractions for the area versus numpy trapezoid integration of a dense resampling, divided by $2\\pi$", material=MAT_GRAPH("axis labels with units", "vertices"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=105, facts=[f"xs={xs}", f"ws={ws}"],
              kwhy=f"The area is ${sig(float(ang))}\\text{{ rad}}$, which is ${sig(float(ang))}/(2\\pi)={sig(rev)}$ revolutions.")


@retry_sep
def ph_rim_acceleration(rng):
    for _ in forever():
        r = pick(rng, [0.2, 0.3, 0.5, 0.8]); w = pick(rng, [4.0, 5.0, 6.0, 8.0]); al = pick(rng, [3.0, 4.0, 5.0, 8.0])
        ac = w * w * r; at = al * r
        a = math.hypot(ac, at)
        # 독립 경로: θ(t) = ω t + ½ α t² 로 가장자리 점의 위치를 만들고 t=0 에서 가속도를 유한 차분
        h = 1e-3
        pos = lambda t: np.array([r * math.cos(w * t + 0.5 * al * t * t), r * math.sin(w * t + 0.5 * al * t * t)])  # noqa: E731
        an = (pos(h) - 2 * pos(0.0) + pos(-h)) / (h * h)
        # t=0 에서 가속도는 -ω²r x̂ 와 α r ŷ 의 합(위치 = r x̂ 일 때)
        agree(a, float(np.linalg.norm(an)), 1e-3, "a")
        break
    pairs = [("Reports only the centripetal part, $\\omega^2r$.", ac), ("Reports only the tangential part, $\\alpha r$.", at), ("Adds the two magnitudes, $\\omega^2r+\\alpha r$, instead of combining them as perpendicular vectors.", ac + at),
             ("Reports $\\omega r$, the speed, as if it were an acceleration.", w * r)]
    key, ds = num_opts(a, pairs, "m/s^2")
    stem = f"A wheel of radius ${r:g}\\text{{ m}}$ is spinning with an angular speed of ${w:g}\\text{{ rad/s}}$ and is speeding up with an angular acceleration of ${al:g}\\text{{ rad/s}}^2$. What is the magnitude of the total acceleration of a point on the rim of the wheel at this instant?"
    return mk("ph_rim_acceleration", "5.2", "2.B", stem, key, ds, rng, concept="Total acceleration of a point on a speeding-up rotating wheel combines centripetal and tangential parts", thinking=["Find the centripetal and tangential accelerations of the rim point", "Combine them as perpendicular vectors"],
              cond=[("the centripetal and tangential accelerations are perpendicular", "they point toward the axis and along the rim")], path="finite differences of the position of the rim point as it turns reproduce the total acceleration vector", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=105, facts=[f"r={r}", f"w={w}", f"al={al}"],
              kwhy=f"$a_c=\\omega^2r={sig(ac)}\\text{{ m/s}}^2$ and $a_t=\\alpha r={sig(at)}\\text{{ m/s}}^2$, so $a=\\sqrt{{a_c^2+a_t^2}}={sig(a)}\\text{{ m/s}}^2$.")


@retry_sep
def ph_net_torque_alpha(rng):
    for _ in forever():
        M = pick(rng, [2.0, 4.0, 5.0, 8.0]); R = pick(rng, [0.2, 0.3, 0.4, 0.5]); r = pick(rng, [0.1, 0.15, 0.2]); F1 = pick(rng, [10.0, 15.0, 20.0, 30.0]); F2 = pick(rng, [5.0, 8.0, 10.0])
        if r >= R:
            continue
        I = 0.5 * M * R * R
        tau = F1 * R - F2 * r
        if tau <= 0:
            continue
        al = tau / I
        # 독립 경로: 각속도를 RK4 로 2 s 적분해 평균 각가속도를 얻는다
        y = rk4(lambda t, s: np.array([tau / I]), [0.0], 0, 2.0, 400)
        agree(al, float(y[0]) / 2.0, 1e-6, "al")
        break
    pairs = [("Adds the two torques instead of subtracting, $(F_1R+F_2r)/I$.", (F1 * R + F2 * r) / I), ("Uses the moment of inertia of a hoop, $MR^2$, instead of a solid disk.", tau / (M * R * R)),
             ("Uses the net force and the outer radius only, ignoring the inner force's lever arm: $(F_1-F_2)R/I$.", (F1 - F2) * R / I), ("Reports the net torque without dividing by the moment of inertia.", tau)]
    key, ds = num_opts(al, pairs, "rad/s^2")
    stem = f"A uniform solid disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ can rotate freely about a fixed axis through its center. A tangential force of ${F1:g}\\text{{ N}}$ is applied at the rim, turning the disk counterclockwise, and an opposing tangential force of ${F2:g}\\text{{ N}}$ is applied on a groove of radius ${r:g}\\text{{ m}}$, turning it clockwise. What is the magnitude of the angular acceleration of the disk? The rotational inertia of a solid disk is $\\tfrac12MR^2$."
    return mk("ph_net_torque_alpha", "5.6", "2.B", stem, key, ds, rng, concept="Newton's second law for rotation with two opposing torques", thinking=["Compute each torque as force times its own lever arm and subtract the opposing torque", "Divide the net torque by the rotational inertia"],
              cond=[("the forces are tangential so each lever arm equals its radius", "the stem states the forces are tangential")], path="integrating the angular speed under the constant net torque with RK4 gives the same angular acceleration", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=125, facts=[f"M={M}", f"R={R}", f"r={r}", f"F1={F1}", f"F2={F2}"],
              kwhy=f"$\\tau_{{net}}={F1:g}({R:g})-{F2:g}({r:g})={sig(tau)}\\text{{ N·m}}$ and $I=\\tfrac12({M:g})({R:g})^2={sig(I)}\\text{{ kg·m}}^2$, so $\\alpha=\\tau/I={sig(al)}\\text{{ rad/s}}^2$.")


def ph_inertia_scaling(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4]); b = pick(rng, [2, 3])
        fac = a * b * b
        # 독립 경로: 질량 요소 합으로 후프의 관성을 수치 계산해 비를 구한다
        def I(M, R):
            th = np.linspace(0, 2 * math.pi, 2000, endpoint=False); return float(np.sum((M / 2000) * (R * np.ones_like(th)) ** 2))
        agree(I(a * 3.0, b * 0.4) / I(3.0, 0.4), float(fac), 1e-9, "I")
        break
    wrong = [("Treats the rotational inertia as proportional to the mass and the radius, not the radius squared.", a * b), ("Squares both factors, as if the mass also entered squared.", a * a * b * b),
             ("Adds the factors, $a+b^2$, instead of multiplying.", a + b * b), ("Uses the cube of the radius factor, as if the inertia scaled like a volume.", a * b ** 3)]
    fm = lambda f: f"${f}$ times"  # noqa: E731
    key = Opt(fm(fac), True, f"For a hoop $I=MR^2$, so multiplying the mass by ${a}$ and the radius by ${b}$ multiplies $I$ by ${a}\\times{b}^2={fac}$.", fac)
    ds, seen = [], {fm(fac)}
    for why, f in wrong:
        if fm(f) in seen:
            continue
        seen.add(fm(f)); ds.append(Opt(fm(f), False, why, f))
    if len(ds) < 3:
        raise ValueError("few")
    stem = f"A thin hoop has mass $M$ and radius $R$. A second thin hoop has a mass of ${a}M$ and a radius of ${b}R$. By what factor is the rotational inertia of the second hoop about its center greater than that of the first?"
    return mk("ph_inertia_scaling", "5.4", "2.D", stem, key, ds, rng, concept="Scaling of rotational inertia with mass and radius", thinking=["Write the rotational inertia of a hoop as $MR^2$", "Multiply the mass factor by the square of the radius factor"],
              cond=[("both hoops are thin and rotate about their centers", "the stem states thin hoops and rotation about the center")], path="a numerical sum of $dm\\,R^2$ over mass elements gives the ratio of the two inertias", material=MAT_NONE,
              judgment=["scaling_prediction"], est=60, facts=[f"a={a}", f"b={b}"])


@retry_sep
def ph_rot_kin_stop(rng):
    for _ in forever():
        N = pick(rng, [120.0, 180.0, 240.0, 300.0, 600.0]); t = pick(rng, [4.0, 5.0, 6.0, 8.0, 10.0])
        revs = N * t / 120.0
        w0 = 2 * math.pi * N / 60
        # 독립 경로: 일정한 각가속도를 시간 간격으로 적분해 각을 모아 회전수로
        al = w0 / t; th = 0.0; w = w0; dt = 1e-3
        for _ in range(int(round(t / dt))):
            th += w * dt - 0.5 * al * dt * dt; w -= al * dt
        agree(revs, th / (2 * math.pi), 2e-3, "revs")
        break
    pairs = [("Treats the wheel as spinning at its initial rate for the whole time, $Nt/60$.", N * t / 60), ("Uses the rpm value as if it were in rad/s, $Nt/(4\\pi)$.", N * t / (4 * math.pi)),
             ("Reports the angle in radians instead of revolutions, $\\pi Nt/60$.", math.pi * N * t / 60), ("Halves the average twice, $Nt/240$.", N * t / 240)]
    key, ds = num_opts(revs, pairs, "rev")
    stem = f"A potter's wheel is spinning at ${N:g}\\text{{ rev/min}}$. The potter applies a brake, and the wheel slows uniformly to rest in ${t:g}\\text{{ s}}$. How many revolutions does the wheel make while it slows down?"
    return mk("ph_rot_kin_stop", "5.1", "2.B", stem, key, ds, rng, concept="Rotational kinematics with uniform angular deceleration and a unit conversion", thinking=["Convert the rotation rate to revolutions per second", "Use the average angular speed for uniform deceleration times the time"],
              cond=[("the angular acceleration is constant", "the stem states the wheel slows uniformly")], path="a time-stepped integration of the angle under constant angular deceleration reproduces the number of revolutions", material=MAT_NONE,
              judgment=["law_selection"], est=100, facts=[f"N={N}", f"t={t}"],
              kwhy=f"The initial rate is ${sig(N / 60)}\\text{{ rev/s}}$ and the average rate is half of it, so the revolutions are $\\tfrac12({sig(N / 60)})({t:g})={sig(revs)}$.")


# ======================= U6 =======================
@retry_sep
def ph_flywheel_ke(rng):
    for _ in forever():
        M = pick(rng, [5.0, 8.0, 10.0, 20.0]); R = pick(rng, [0.2, 0.3, 0.4, 0.5]); N = pick(rng, [300.0, 600.0, 900.0, 1200.0])
        w = 2 * math.pi * N / 60; I = 0.5 * M * R * R; K = 0.5 * I * w * w
        # 독립 경로: 원판을 고리들로 나눠 관성을 수치 적분(I = ∫ r² dm, dm = (M/πR²) 2πr dr)
        rr = np.linspace(0, R, 20001); Ii = float(np.trapezoid(rr ** 2 * (M / (math.pi * R * R)) * 2 * math.pi * rr, rr))
        agree(I, Ii, 1e-6, "I")
        if 100 < K < 2e5:
            break
    pairs = [("Uses the rpm value as the angular speed in rad/s, $\\tfrac12I N^2$.", 0.5 * I * N * N), ("Uses the rotational inertia of a hoop, $MR^2$, instead of a solid disk.", 0.5 * M * R * R * w * w),
             ("Converts rev/min to rev/s but forgets the factor of $2\\pi$, using $\\omega=N/60$.", 0.5 * I * (N / 60) ** 2), ("Leaves out the square on the angular speed, $\\tfrac12I\\omega$.", 0.5 * I * w)]
    key, ds = num_opts(K, pairs, "J", fmt=lambda v: sci(v, "J") if abs(v) >= 1e4 else Q(v, "J"))
    stem = f"A uniform solid disk flywheel of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ rotates about its center at ${N:g}\\text{{ rev/min}}$. What is the rotational kinetic energy of the flywheel? The rotational inertia of a solid disk is $\\tfrac12MR^2$."
    return mk("ph_flywheel_ke", "6.1", "2.B", stem, key, ds, rng, concept="Rotational kinetic energy with a unit conversion from rev/min", thinking=["Convert the rotation rate from revolutions per minute to radians per second", "Use $K=\\tfrac12I\\omega^2$ with the solid disk's inertia"],
              cond=[("the disk rotates about its symmetry axis", "the stem states rotation about the center")], path="the disk's rotational inertia is recomputed by integrating $r^2\\,dm$ over concentric rings numerically", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=110, facts=[f"M={M}", f"R={R}", f"N={N}"],
              kwhy=f"$\\omega={sig(w)}\\text{{ rad/s}}$ and $I={sig(I)}\\text{{ kg·m}}^2$, so $K=\\tfrac12I\\omega^2={sig(K)}\\text{{ J}}$.")


@retry_sep
def ph_torque_work_power(rng):
    for _ in forever():
        tau = pick(rng, [4.0, 6.0, 8.0, 12.0]); n = pick(rng, [2.0, 3.0, 5.0, 10.0])
        W = tau * 2 * math.pi * n
        th = np.linspace(0, 2 * math.pi * n, 40001); Wn = float(np.trapezoid(np.full_like(th, tau), th))
        agree(W, Wn, 1e-9, "W")
        break
    pairs = [("Multiplies the torque by the number of revolutions, forgetting to convert to radians, $\\tau n$.", tau * n), ("Uses only one revolution, $2\\pi\\tau$.", 2 * math.pi * tau),
             ("Divides by $2\\pi$ instead of multiplying, $\\tau n/(2\\pi)$.", tau * n / (2 * math.pi)), ("Uses the number of revolutions as the angle squared, $\\tau(2\\pi n)^2$.", tau * (2 * math.pi * n) ** 2)]
    key, ds = num_opts(W, pairs, "J")
    stem = f"A motor applies a constant torque of ${tau:g}\\text{{ N·m}}$ to a shaft that makes ${n:g}$ complete revolutions. How much work does the motor do on the shaft?"
    return mk("ph_torque_work_power", "6.2", "2.B", stem, key, ds, rng, concept="Work done by a constant torque is the torque times the angle in radians", thinking=["Convert the number of revolutions to an angle in radians", "Multiply the torque by the angle"],
              cond=[("the torque is constant and parallel to the rotation axis", "the stem gives a constant torque on a shaft")], path="numpy integration of the torque over the angle turned gives the same work", material=MAT_NONE,
              judgment=["law_selection"], est=80, facts=[f"tau={tau}", f"n={n}"], kwhy=f"The angle is $2\\pi({n:g})={sig(2 * math.pi * n)}\\text{{ rad}}$, so $W=\\tau\\theta={sig(W)}\\text{{ J}}$.")


@retry_sep
def ph_skater_ke_change(rng):
    for _ in forever():
        Ii = pick(rng, [3.0, 4.0, 5.0, 6.0]); f = pick(rng, [2.0, 3.0, 4.0]); If = Ii / f; w0 = pick(rng, [2.0, 3.0, 4.0])
        w1 = Ii * w0 / If
        Kr = (0.5 * If * w1 * w1) / (0.5 * Ii * w0 * w0)
        agree(Kr, f, 1e-9, "K")
        break
    pairs = [("Squares the factor, treating the energy as proportional to the angular speed squared with the speed changed by the same factor and the inertia ignored.", f * f), ("Says the kinetic energy stays the same, as if energy were conserved.", 1.0),
             ("Takes the square root of the factor, as if the energy were proportional to the angular speed.", math.sqrt(f)), ("Uses the factor the inertia decreases by, as the factor by which the energy decreases.", 1 / f)]
    fm = lambda v: ("the same" if v == 1.0 else f"${sig(v)}$ times")  # noqa: E731
    key = Opt(fm(f), True, f"Angular momentum is conserved, so $\\omega$ increases by ${f:g}$; then $K=\\tfrac12I\\omega^2$ increases by $({f:g})^2/{f:g}={f:g}$.", f)
    ds, seen = [], {fm(f)}
    for why, v in pairs:
        if fm(v) in seen or abs(v - f) <= MIN_REL_SEP * max(v, f):
            continue
        seen.add(fm(v)); ds.append(Opt(fm(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    stem = f"A skater spins on frictionless ice with her arms extended, having a rotational inertia of ${Ii:g}\\text{{ kg·m}}^2$. She pulls her arms in so that her rotational inertia becomes ${If:g}\\text{{ kg·m}}^2$. By what factor does her rotational kinetic energy change?"
    return mk("ph_skater_ke_change", "6.4", "2.D", stem, key, ds, rng, concept="Conservation of angular momentum with a change in rotational kinetic energy", thinking=["Use conservation of angular momentum to find the factor by which the angular speed changes", "Substitute into $K=\\tfrac12I\\omega^2$ to find the change in the kinetic energy"],
              cond=[("no external torque acts on the skater", "the stem states frictionless ice")], path="numerical evaluation of the angular speed and energy before and after the arms are pulled in gives the energy ratio", material=MAT_NONE,
              judgment=["scaling_prediction", "law_selection"], est=95, facts=[f"Ii={Ii}", f"If={If}", f"f={f}"])


@retry_sep
def ph_orbit_speed_ratio(rng):
    for _ in forever():
        rp = pick(rng, [7.0e6, 8.0e6, 1.0e7]); ra = rp * pick(rng, [2.0, 3.0, 4.0]); vp = pick(rng, [6.0e3, 7.0e3, 8.0e3])
        va = vp * rp / ra
        # 독립 경로: 에너지 보존으로 GM 을 구해 근일점·원일점의 에너지가 같은지 확인(타원 궤도의 비스-비바 식)
        GM = vp * vp * rp * (rp + ra) / (2 * ra)
        e_p = 0.5 * vp ** 2 - GM / rp; e_a = 0.5 * va ** 2 - GM / ra
        agree(e_p, e_a, 1e-9, "E")
        break
    pairs = [("Inverts the ratio, $v_pr_a/r_p$.", vp * ra / rp), ("Assumes the speed does not change, $v_p$.", vp), ("Uses the square root of the radius ratio, $v_p\\sqrt{r_p/r_a}$.", vp * math.sqrt(rp / ra)),
             ("Uses the square of the radius ratio, $v_p(r_p/r_a)^2$.", vp * (rp / ra) ** 2)]
    key, ds = num_opts(va, pairs, "m/s", fmt=lambda v: sci(v, "m/s") if abs(v) >= 1e4 or abs(v) < 1e-2 else Q(v, "m/s", 3))
    stem = f"A satellite orbits Earth in an elliptical orbit. At its closest point to Earth, ${rp / 1e6:g}\\times10^{{6}}\\text{{ m}}$ from Earth's center, its speed is ${vp:g}\\text{{ m/s}}$. What is its speed at its farthest point, ${ra / 1e6:g}\\times10^{{6}}\\text{{ m}}$ from Earth's center?"
    return mk("ph_orbit_speed_ratio", "6.6", "2.B", stem, key, ds, rng, concept="Angular momentum conservation for an orbiting satellite", thinking=["The gravitational force on the satellite exerts no torque about Earth's center, so angular momentum is conserved", "At the closest and farthest points the velocity is perpendicular to the radius, so $mvr$ is the same at both"],
              cond=[("the only force is gravity directed toward Earth's center", "the stem describes an orbit under Earth's gravity")], path="the energy conservation equation with $GM$ fixed by the orbit confirms the speed found from angular momentum conservation", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=100, facts=[f"rp={rp}", f"ra={ra}", f"vp={vp}"],
              kwhy=f"$mv_pr_p=mv_ar_a$ gives $v_a=v_pr_p/r_a={vp:g}({rp / 1e6:g}\\times10^{{6}})/({ra / 1e6:g}\\times10^{{6}})={sig(va)}\\text{{ m/s}}$.")


# ======================= U7 =======================
@retry_sep
def ph_pendulum_moon(rng):
    for _ in forever():
        L = pick(rng, [0.5, 0.8, 1.0, 1.5, 2.0, 2.5]); gm = 1.62
        T = 2 * math.pi * math.sqrt(L / gm)
        # 독립 경로: 작은 진폭 진자의 운동 방정식을 RK4 로 적분해 주기를 측정
        th0 = 0.05
        # 처음 영점 통과 시각 = 1/4 주기(선형 보간)
        st = np.array([th0, 0.0]); t = 0.0
        while st[0] > 0:
            prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -gm / L * math.sin(y[0])]), st, t, t + 1e-3, 1); t += 1e-3
        tq = t - 1e-3 + 1e-3 * prv[0] / (prv[0] - st[0])
        agree(T, 4 * tq, 3e-3, "T")
        break
    pairs = [("Uses Earth's field strength $g_E=9.8\\text{ N/kg}$ instead of the Moon's, $2\\pi\\sqrt{L/g_E}$.", 2 * math.pi * math.sqrt(L / G)), ("Inverts the ratio under the root, $2\\pi\\sqrt{g_ML}$.", 2 * math.pi * math.sqrt(gm * L)),
             ("Leaves out the factor $2\\pi$, $\\sqrt{L/g_M}$.", math.sqrt(L / gm)), ("Puts the length in the wrong place, $2\\pi\\sqrt{g_M/L}$.", 2 * math.pi * math.sqrt(gm / L))]
    key, ds = num_opts(T, pairs, "s")
    stem = f"A simple pendulum consists of a small bob on a light string of length ${L:g}\\text{{ m}}$. On the Moon, where the gravitational field strength is ${gm:g}\\text{{ N/kg}}$, the pendulum swings with a small amplitude. What is its period?"
    return mk("ph_pendulum_moon", "7.2", "2.B", stem, key, ds, rng, concept="Period of a simple pendulum depends on the local gravitational field strength", thinking=["Recall that the period of a small-amplitude pendulum is $2\\pi\\sqrt{L/g}$", "Use the Moon's field strength instead of Earth's"],
              cond=[("the amplitude is small", "the stem states the pendulum swings with a small amplitude")], path="RK4 integration of the pendulum equation with the Moon's field strength measures the quarter period, which matches $2\\pi\\sqrt{L/g_M}/4$", material=MAT_NONE,
              judgment=["law_selection"], est=85, facts=[f"L={L}", f"gm={gm}"], kwhy=f"$T=2\\pi\\sqrt{{L/g_M}}=2\\pi\\sqrt{{{L:g}/{gm:g}}}={sig(T)}\\text{{ s}}$.")


def ph_shm_signs(rng):
    for _ in forever():
        A = pick(rng, [0.1, 0.2, 0.3]); T = pick(rng, [2.0, 4.0]); ph = pick(rng, [0.0, math.pi / 2, math.pi])
        xf = lambda t: A * np.sin(2 * math.pi * t / T + ph)  # noqa: E731
        vf = lambda t: A * (2 * math.pi / T) * math.cos(2 * math.pi * t / T + ph)  # noqa: E731
        af = lambda t: -A * (2 * math.pi / T) ** 2 * math.sin(2 * math.pi * t / T + ph)  # noqa: E731
        grid = [T * i / 12 for i in range(0, 25)]
        ts = sorted(rng.sample(grid, 4))
        vm = A * 2 * math.pi / T; am = A * (2 * math.pi / T) ** 2
        if any(abs(vf(t)) < 0.35 * vm or abs(af(t)) < 0.35 * am for t in ts) or len({round(t, 6) for t in ts}) < 4:
            continue
        # 독립 경로: 위치 표본의 수치 미분 부호
        tt = np.linspace(0, 2 * T, 80001); xx = xf(tt); v_n = np.gradient(xx, tt); a_n = np.gradient(v_n, tt)
        sg = []
        for t in ts:
            idx = int(round(t / (2 * T) * 80000)); sg.append((int(np.sign(v_n[idx])), int(np.sign(a_n[idx]))))
            assert sg[-1] == (int(np.sign(vf(t))), int(np.sign(af(t)))), "sign_path_mismatch"
        good = [q for q in [(1, 1), (1, -1), (-1, 1), (-1, -1)] if sg.count(q) == 1]
        if not good:
            continue
        q = rng.choice(good)
        break
    labs = ["A", "B", "C", "D"]; ki = sg.index(q)
    phr = {(1, 1): "both the velocity and the acceleration of the block are positive", (1, -1): "the velocity of the block is positive and its acceleration is negative", (-1, 1): "the velocity of the block is negative and its acceleration is positive", (-1, -1): "both the velocity and the acceleration of the block are negative"}

    def why(i):
        v_s, a_s = sg[i]; xs_ = xf(ts[i])
        return f"At point {labs[i]} the position is {'positive' if xs_ > 0 else 'negative'}, so the acceleration, which points opposite to the position, is {'negative' if xs_ > 0 else 'positive'}; the slope is {'positive' if v_s > 0 else 'negative'}, so the velocity is {'positive' if v_s > 0 else 'negative'}."
    key, ds = sentence_options(f"Point {labs[ki]}", why(ki), [(f"Point {labs[i]}", why(i)) for i in range(4) if i != ki])
    stim = dense_graph_stim("Position versus time of a block on a spring", xf, 0, 2 * T, gaxis("Time (s)", 0, 2 * T, T / 4), sym_axis("Position (m)", A), n=161, extra={"labeled_points": [{"x": round(t, 6), "y": round(xf(t), 5), "label": L} for t, L in zip(ts, labs)]})
    stem = f"The graph shows the position of a block oscillating on a spring as a function of time, with positive positions to the right. Which labeled point corresponds to a time when {phr[q]}?"
    return mk("ph_shm_signs", "7.3", "3.C", stem, key, ds, rng, concept="Signs of velocity and acceleration in simple harmonic motion from a position-time graph", thinking=["Find the sign of the velocity from the slope of the graph", "Find the sign of the acceleration from the sign of the position, since the restoring force points opposite to it"],
              cond=[("the motion is simple harmonic", "the plotted curve is a sinusoid")], path="numpy first and second differences of the sampled position function give the signs of velocity and acceleration at each labeled time", material=MAT_GRAPH("axis labels with units", "labeled points A to D"),
              judgment=["representation_reading", "justification"], stim=stim, est=95, facts=[f"A={A}", f"T={T}", f"ts={[round(t, 6) for t in ts]}", f"q={list(q)}"])


@retry_sep
def ph_t2_m_graph(rng):
    for _ in forever():
        k = pick(rng, [20.0, 25.0, 40.0, 50.0, 80.0]); mmax = pick(rng, [0.4, 0.5, 0.8, 1.0])
        s = 4 * math.pi ** 2 / k
        pts = [[0, 0], [mmax, round(s * mmax, 4)]]
        kn = 4 * math.pi ** 2 / float(np.polyfit([p[0] for p in pts], [p[1] for p in pts], 1)[0])
        agree(k, kn, 1e-3, "k")
        break
    s = round(s * mmax, 4) / mmax
    pairs = [("Takes the slope of the graph as the spring constant.", s), ("Divides the slope by $4\\pi^2$ instead of dividing $4\\pi^2$ by the slope.", s / (4 * math.pi ** 2)),
             ("Multiplies the slope by $4\\pi^2$.", s * 4 * math.pi ** 2), ("Uses $2\\pi/\\text{slope}$.", 2 * math.pi / s)]
    key, ds = num_opts(k, pairs, "N/m")
    stim = graph_stim("Square of the period versus hanging mass", [("T2", pts)], gaxis("Mass (kg)", 0, mmax, mmax / 5), gaxis("Period squared (s²)", 0, round(pts[1][1] * 1.1, 2), round(pts[1][1] / 5, 3)))
    stem = "A student hangs different masses from a spring, sets each one oscillating vertically, and measures the period $T$. The graph shows $T^2$ as a function of the hanging mass $m$. What is the spring constant of the spring?"
    return mk("ph_t2_m_graph", "7.2", "2.B", stem, key, ds, rng, concept="Spring constant from the slope of a linearized period-mass graph", thinking=["Write $T^2=(4\\pi^2/k)\\,m$ so the slope of the graph is $4\\pi^2/k$", "Read the slope from the graph and solve for $k$"],
              cond=[("the spring is ideal and the mass of the spring is negligible", "the stem describes masses on a spring with a linear graph")], path="numpy polyfit of $T^2$ against mass gives the slope, from which $k=4\\pi^2/\\text{slope}$ is compared with the generating constant", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "symbolic_reasoning"], stim=stim, est=105, facts=[f"k={k}", f"mmax={mmax}"],
              kwhy=f"The slope is ${sig(s)}\\text{{ s}}^2/\\text{{kg}}$ and the slope equals $4\\pi^2/k$, so $k=4\\pi^2/{sig(s)}={sig(k)}\\text{{ N/m}}$.")


@retry_sep
def ph_vertical_spring_period(rng):
    for _ in forever():
        d = pick(rng, [0.04, 0.09, 0.16, 0.25, 0.36]); m = pick(rng, [0.2, 0.5, 1.0, 2.0])
        T = 2 * math.pi * math.sqrt(d / G)
        k = m * G / d; w = math.sqrt(k / m)
        st = np.array([0.01, 0.0]); t = 0.0; dt = 1e-4
        while st[0] > 0:
            prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
        tq = t - dt + dt * prv[0] / (prv[0] - st[0])
        agree(T, 4 * tq, 2e-3, "T")
        break
    pairs = [("Uses $2\\pi\\sqrt{dg}$, multiplying by the gravitational field strength instead of dividing.", 2 * math.pi * math.sqrt(d * G)), ("Leaves out $2\\pi$, $\\sqrt{d/g}$.", math.sqrt(d / G)),
             ("Inverts the ratio under the root, $2\\pi\\sqrt{g/d}$.", 2 * math.pi * math.sqrt(G / d)), ("Uses $2\\pi\\sqrt{2d/g}$, doubling the stretch.", 2 * math.pi * math.sqrt(2 * d / G))]
    key, ds = num_opts(T, pairs, "s")
    stem = f"A ${m:g}\\text{{ kg}}$ block hangs at rest from a light vertical spring and stretches it by ${d * 100:g}\\text{{ cm}}$ from its relaxed length. The block is pulled down a small distance and released, and it oscillates up and down. What is the period of the oscillation?"
    return mk("ph_vertical_spring_period", "7.2", "2.A", stem, key, ds, rng, concept="Period of a vertical spring-mass oscillator found from the equilibrium stretch", thinking=["Use the equilibrium condition $kd=mg$ to write $k/m=g/d$", "Substitute into $T=2\\pi\\sqrt{m/k}$"],
              cond=[("the spring is ideal and the oscillation amplitude is small", "the stem describes a small oscillation of a block on a light spring")], path="RK4 integration of the oscillator with $k=mg/d$ measures the quarter period, which matches $T/4$", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=110, facts=[f"d={d}", f"m={m}"],
              kwhy=f"Since $k/m=g/d={sig(G / d)}\\text{{ s}}^{{-2}}$, $T=2\\pi\\sqrt{{d/g}}={sig(T)}\\text{{ s}}$, independent of the mass.")


@retry_sep
def ph_xt_max_accel(rng):
    for _ in forever():
        A = pick(rng, [0.05, 0.1, 0.2, 0.3]); P = pick(rng, [0.5, 1.0, 2.0, 4.0])
        a = A * (2 * math.pi / P) ** 2
        tt = np.linspace(0, P, 40001); x = A * np.cos(2 * math.pi * tt / P); an = float(np.max(np.abs(np.gradient(np.gradient(x, tt), tt)[5:-5])))
        agree(a, an, 2e-3, "a")
        break
    pairs = [("Reports the maximum speed $2\\pi A/P$ instead of the maximum acceleration.", 2 * math.pi * A / P), ("Forgets to square the angular frequency, $2\\pi A/P$ times $\\pi$.", 4 * math.pi * A / P),
             ("Uses $A/P^2$, leaving out $4\\pi^2$.", A / P ** 2), ("Uses $4\\pi A/P^2$, with a single factor of $2\\pi$.", 4 * math.pi * A / P ** 2)]
    key, ds = num_opts(a, pairs, "m/s^2")
    stim = dense_graph_stim("Position versus time of an oscillating block", lambda t: A * math.cos(2 * math.pi * t / P), 0, 2 * P, gaxis("Time (s)", 0, 2 * P, P / 4), sym_axis("Position (m)", A), n=161)
    stem = "The graph shows the position of a block oscillating on a spring as a function of time. What is the maximum magnitude of the acceleration of the block?"
    return mk("ph_xt_max_accel", "7.3", "2.B", stem, key, ds, rng, concept="Maximum acceleration of a simple harmonic oscillator from a position-time graph", thinking=["Read the amplitude and the period from the graph", "Use $a_{max}=\\omega^2A$ with $\\omega=2\\pi/P$"],
              cond=[("the motion is simple harmonic", "the plotted curve is a cosine")], path="numpy second differences of the sampled position function give the maximum acceleration, compared with $4\\pi^2A/P^2$", material=MAT_GRAPH("axis labels with units", "one full period"),
              judgment=["representation_reading", "symbolic_reasoning"], stim=stim, est=105, facts=[f"A={A}", f"P={P}"], kwhy=f"$a_{{max}}=\\omega^2A=(2\\pi/{P:g})^2({A:g})={sig(a)}\\text{{ m/s}}^2$.")


# ======================= U8 =======================
@retry_sep
def ph_density_weighing(rng):
    for _ in forever():
        rho = pick(rng, [2700.0, 7800.0, 8900.0, 11300.0]); V = pick(rng, [2.0e-4, 3.0e-4, 5.0e-4]); rw = CONSTS["rho_water"]
        Wa = rho * V * G; Ww = (rho - rw) * V * G
        r_est = rw * Wa / (Wa - Ww)
        agree(r_est, rho, 1e-9, "rho")
        break
    pairs = [("Divides by the apparent weight instead of the loss of weight, $\\rho_wW_{air}/W_{water}$.", rw * Wa / Ww), ("Puts the apparent weight in the numerator instead of the weight in air, $\\rho_wW_{water}/(W_{air}-W_{water})$.", rw * Ww / (Wa - Ww)),
             ("Uses the fraction of the weight lost, $\\rho_w(W_{air}-W_{water})/W_{air}$.", rw * (Wa - Ww) / Wa), ("Divides the buoyant force by the apparent weight, $\\rho_w(W_{air}-W_{water})/W_{water}$.", rw * (Wa - Ww) / Ww)]
    key, ds = num_opts(r_est, pairs, "kg/m^3")
    stem = f"A metal object has a weight of ${sig(Wa)}\\text{{ N}}$ when measured in air and an apparent weight of ${sig(Ww)}\\text{{ N}}$ when it is fully submerged in water of density $1000\\text{{ kg/m}}^3$. What is the density of the metal?"
    return mk("ph_density_weighing", "8.3", "2.B", stem, key, ds, rng, concept="Density of an object from its apparent weight when submerged", thinking=["The loss of apparent weight equals the buoyant force, which gives the object's volume", "Divide the object's mass by that volume"],
              cond=[("the object is fully submerged and at rest", "the stem states the object is fully submerged")], path="the volume is computed from the buoyant force and the density from the mass in a separate numeric step", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=115, facts=[f"rho={rho}", f"V={V}"],
              kwhy=f"The buoyant force is ${sig(Wa - Ww)}\\text{{ N}}$, so $V=F_B/(\\rho_wg)$ and $\\rho=\\rho_wW_{{air}}/F_B={sig(rho)}\\text{{ kg/m}}^3$.")


@retry_sep
def ph_hatch_force(rng):
    for _ in forever():
        d = pick(rng, [10.0, 20.0, 30.0, 50.0]); Acm = pick(rng, [200.0, 400.0, 500.0, 800.0]); rw = CONSTS["rho_water"]
        A = Acm * 1e-4
        F = rw * G * d * A
        # 독립 경로: 해치를 수직 띠 20000 조각으로 나눠(중심 깊이 d, 높이 0.1 m) 조각마다 압력×면적을 합산
        zz = d + np.linspace(-0.05, 0.05, 20000); Fn = float(np.sum(rw * G * zz * (A / 20000)))
        agree(F, Fn, 1e-6, "F")
        break
    pairs = [("Uses the absolute pressure instead of the gauge pressure, $(P_{atm}+\\rho gd)A$.", (CONSTS["P_atm"] + rw * G * d) * A), ("Forgets the depth, $\\rho gA$.", rw * G * A),
             ("Forgets to convert the area from cm$^2$ to m$^2$.", rw * G * d * Acm), ("Reports the pressure instead of the force, $\\rho gd$.", rw * G * d)]
    key, ds = num_opts(F, pairs, "N", fmt=lambda v: sci(v, "N") if abs(v) >= 1e4 or abs(v) < 1e-2 else Q(v, "N", 3))
    stem = f"A submarine hatch has an area of ${Acm:g}\\text{{ cm}}^2$ and is at a depth of ${d:g}\\text{{ m}}$ in water of density $1000\\text{{ kg/m}}^3$. The air pressure inside the submarine is atmospheric pressure. What is the magnitude of the net force on the hatch due to the pressure difference between the water and the inside air?"
    return mk("ph_hatch_force", "8.2", "2.B", stem, key, ds, rng, concept="Net force from the gauge pressure of a fluid acting on a surface", thinking=["The inside atmospheric pressure cancels the atmospheric part of the water pressure, leaving the gauge pressure", "Multiply the gauge pressure by the area in square meters"],
              cond=[("the pressure is uniform over the small hatch", "the hatch is small compared with its depth")], path="numerical summation of the pressure over thin horizontal strips of the hatch matches the gauge pressure times area", material=MAT_NONE,
              judgment=["law_selection"], est=105, facts=[f"d={d}", f"Acm={Acm}"],
              kwhy=f"The gauge pressure is $\\rho gd={sig(rw * G * d)}\\text{{ Pa}}$ and $A={sig(A)}\\text{{ m}}^2$, so $F=\\rho gdA={sig(F)}\\text{{ N}}$.")


@retry_sep
def ph_buoyant_tension(rng):
    for _ in forever():
        rho = pick(rng, [2700.0, 7800.0, 8900.0]); V = pick(rng, [1.0e-4, 2.0e-4, 5.0e-4]); rw = CONSTS["rho_water"]
        T = (rho - rw) * V * G
        A = np.array([[1.0]]); b = np.array([rho * V * G - rw * V * G]); agree(T, float(np.linalg.solve(A, b)[0]), 1e-9, "T")
        break
    pairs = [("Reports the weight of the object only, $\\rho Vg$.", rho * V * G), ("Reports the buoyant force only, $\\rho_wVg$.", rw * V * G), ("Adds the buoyant force to the weight, $(\\rho+\\rho_w)Vg$.", (rho + rw) * V * G)]
    key, ds = num_opts(T, pairs, "N", fmt=lambda v: Q(v, "N", 3))
    stem = f"A solid metal block of volume ${V * 1e6:g}\\text{{ cm}}^3$ and density ${rho:g}\\text{{ kg/m}}^3$ is held completely underwater, at rest, by a thin string attached to a fixed support above. The density of water is $1000\\text{{ kg/m}}^3$. What is the tension in the string?"
    return mk("ph_buoyant_tension", "8.3", "2.B", stem, key, ds, rng, concept="Force balance on a submerged object held by a string", thinking=["Identify the weight, the buoyant force and the tension acting on the block", "Balance the forces: the tension plus the buoyant force equals the weight"],
              cond=[("the block is in equilibrium", "the stem states the block is at rest underwater")], path="the vertical force balance is solved numerically for the tension and agrees with the symbolic result", material=MAT_NONE,
              judgment=["law_selection"], est=105, facts=[f"rho={rho}", f"V={V}"],
              kwhy=f"$T=W-F_B=(\\rho-\\rho_w)Vg=({sig(rho)}-1000)({sig(V)})(9.8)={sig(T)}\\text{{ N}}$.")


@retry_sep
def ph_bernoulli_height(rng):
    for _ in forever():
        rho = 1000.0; v1 = pick(rng, [1.0, 1.5, 2.0]); ratio = pick(rng, [2.0, 3.0, 4.0]); dh = pick(rng, [2.0, 3.0, 4.0, 5.0]); p1 = pick(rng, [2.0e5, 2.5e5, 3.0e5])
        v2 = v1 * ratio
        p2 = p1 + 0.5 * rho * (v1 ** 2 - v2 ** 2) - rho * G * dh
        # 독립 경로: 단위 부피당 에너지(압력 + 운동 + 중력) 보존을 sympy 로 풀어 비교
        P2 = sp.symbols("P2"); sol = sp.solve(sp.Eq(P2 + sp.Rational(1, 2) * rho * v2 ** 2 + rho * sp.Rational("9.8") * dh, p1 + sp.Rational(1, 2) * rho * v1 ** 2), P2)[0]
        agree(p2, float(sol), 1e-9, "p2")
        if p2 > 2e4:
            break
    pairs = [("Leaves out the height term, $p_1+\\tfrac12\\rho(v_1^2-v_2^2)$.", p1 + 0.5 * rho * (v1 ** 2 - v2 ** 2)), ("Leaves out the speed term, $p_1-\\rho gh$.", p1 - rho * G * dh),
             ("Gives the height term the wrong sign, $p_1+\\tfrac12\\rho(v_1^2-v_2^2)+\\rho gh$.", p1 + 0.5 * rho * (v1 ** 2 - v2 ** 2) + rho * G * dh), ("Gives the speed term the wrong sign, $p_1+\\tfrac12\\rho(v_2^2-v_1^2)-\\rho gh$.", p1 + 0.5 * rho * (v2 ** 2 - v1 ** 2) - rho * G * dh)]
    key, ds = num_opts(p2, pairs, "Pa", fmt=lambda v: sci(v, "Pa"))
    stem = f"Water of density $1000\\text{{ kg/m}}^3$ flows steadily through a pipe that rises ${dh:g}\\text{{ m}}$ and narrows. At the lower, wider end the water speed is ${v1:g}\\text{{ m/s}}$ and the pressure is ${p1 / 1e5:g}\\times10^{{5}}\\text{{ Pa}}$. At the upper end the pipe is narrower and the water speed is ${v2:g}\\text{{ m/s}}$. What is the pressure at the upper end?"
    return mk("ph_bernoulli_height", "8.4", "2.B", stem, key, ds, rng, concept="Bernoulli's equation with both a change in speed and a change in height", thinking=["Write Bernoulli's equation with the pressure, kinetic and gravitational terms at both ends", "Solve for the pressure at the upper end"],
              cond=[("the flow is steady and the fluid is ideal", "the stem states steady flow of water")], path="sympy solves the Bernoulli equation symbolically and the numeric result is compared with direct arithmetic on the three terms", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=125, facts=[f"v1={v1}", f"v2={v2}", f"dh={dh}", f"p1={p1}"],
              kwhy=f"$p_2=p_1+\\tfrac12\\rho(v_1^2-v_2^2)-\\rho g\\Delta h={sig(p2)}\\text{{ Pa}}$.")


# ======================= 2문항 세트 =======================
def _set_pack(arch, topic, intro, stim, items, facts):
    return {"archetype": arch, "topic": topic, "skill": "2.B", "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": items, "facts": facts, "blueprint": items[0]["blueprint"]}


@retry_sep
def phs_fx_set(rng):
    """세트 3: 힘–위치 그래프 → (일, 나중 속력). 단원 3."""
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [2, 3])):
            xs.append(xs[-1] + pick(rng, [1, 2, 3]))
        Fv = [rng.randint(2, 10) for _ in xs]; Fv[0] = pick(rng, [0, 2, 4])
        m = pick(rng, [1.0, 2.0, 4.0])
        W = trapz_exact(xs, Fv); v = math.sqrt(2 * float(W) / m)
        tt = np.linspace(0, xs[-1], 40001); agree(float(W), float(np.trapezoid(np.interp(tt, xs, Fv), tt)), 1e-7, "W")
        if float(W) >= 8 and len(set(Fv)) >= 3:
            break
    Wf = float(W)
    k1, d1 = num_opts(Wf, [("Multiplies the largest force by the total distance.", max(Fv) * xs[-1]), ("Averages the first and last forces and multiplies by the distance.", (Fv[0] + Fv[-1]) / 2 * xs[-1]),
                           ("Adds the force values at the plotted points without multiplying by the intervals.", float(sum(Fv))), ("Uses only the area of the first segment.", float((Fr(Fv[0]) + Fr(Fv[1])) / 2 * xs[1]))], "J")
    k2, d2 = num_opts(v, [("Treats the work as the speed squared, $\\sqrt{W}$, forgetting the mass and the factor of two.", math.sqrt(Wf)), ("Drops the factor of two, $\\sqrt{W/m}$.", math.sqrt(Wf / m)),
                          ("Reports $W/m$ as the speed.", Wf / m), ("Uses the largest force times the distance as the work.", math.sqrt(2 * max(Fv) * xs[-1] / m))], "m/s")
    stim = graph_stim("Net force on the block versus position", [("F", list(zip(xs, Fv)))], gaxis("Position (m)", 0, xs[-1], 1), gaxis("Net force (N)", 0, max(Fv) + 2, 2))
    q = []
    for st, key, ds, nm, kw in [(f"How much work does the net force do on the block between $x=0$ and $x={xs[-1]}\\text{{ m}}$?", k1, d1, "q1", f"The areas of the trapezoids under the graph are {_seg_text(xs, Fv, 'J')}, which add to ${sig(Wf)}\\text{{ J}}$."),
                                (f"What is the speed of the block at $x={xs[-1]}\\text{{ m}}$?", k2, d2, "q2", f"$\\tfrac12mv^2=W$ with $W={sig(Wf)}\\text{{ J}}$ and $m={m:g}\\text{{ kg}}$ gives $v={sig(v)}\\text{{ m/s}}$.")]:
        q.append(mk(f"phs_fx_set_{nm}", "3.2", "2.B", st, key, ds, rng, concept="Two questions about a single force-position graph", thinking=["Find the net work as the area under the force-position graph", "Use the work-energy theorem for the speed"],
                    cond=[("the plotted force is the net force along the line of motion", "the shared stimulus states the graph shows the net force")], path="exact fractions for the area versus numpy integration of a dense resampling; the speed from the energy equation", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"xs={xs}", f"Fv={Fv}", f"m={m}"], kwhy=kw))
    intro = f"A ${m:g}\\text{{ kg}}$ block starts from rest at $x=0$ on a frictionless horizontal surface. The graph shows the net force on the block along its direction of motion as a function of position."
    return _set_pack("phs_fx_set", "3.2", intro, stim, q, q[0]["facts"])


@retry_sep
def phs_wt_set(rng):
    """세트 4: 각속도–시간 그래프 → (마지막 구간 각가속도, 전체 회전 각). 단원 5."""
    from phys_p0_a import _pl_vt
    for _ in forever():
        xs = [0]
        for _ in range(3):
            xs.append(xs[-1] + pick(rng, [2, 3, 4]))
        ws = [rng.randint(0, 12) for _ in xs]; ws[0] = pick(rng, [0, 2, 4])
        ang = trapz_exact(xs, ws); dt = xs[-1] - xs[-2]; al = (ws[-1] - ws[-2]) / dt
        tt = np.linspace(0, xs[-1], 40001); agree(float(ang), float(np.trapezoid(np.interp(tt, xs, ws), tt)), 1e-7, "ang")
        if al != 0 and float(ang) >= 20 and len(set(ws)) >= 3:
            break
    T = xs[-1]
    k1, d1 = signed_opts(al, [("Reports the change in angular speed over the last segment without dividing by the elapsed time.", float(ws[-1] - ws[-2])), ("Divides the final angular speed by the total time of the graph.", ws[-1] / T),
                              ("Gives the acceleration the opposite sign by subtracting in the wrong order.", -al), ("Averages the angular speeds at the ends of the last segment, which is not a rate of change.", (ws[-1] + ws[-2]) / 2)], "rad/s^2")
    k2, d2 = num_opts(float(ang), [("Uses the final angular speed times the total time.", ws[-1] * T), ("Uses the largest angular speed times the total time.", max(ws) * T),
                                   ("Averages the first and last angular speeds and multiplies by the total time.", (ws[0] + ws[-1]) / 2 * T), ("Uses only the first segment of the graph.", float((Fr(ws[0]) + Fr(ws[1])) / 2 * xs[1]))], "rad")
    stim = graph_stim("Angular speed of the wheel versus time", [("w", list(zip(xs, ws)))], gaxis("Time (s)", 0, T, 1), gaxis("Angular speed (rad/s)", 0, max(ws) + 2, 2))
    q = []
    for st, key, ds, nm, kw in [(f"What is the angular acceleration of the wheel during the last segment, from $t={xs[-2]}\\text{{ s}}$ to $t={T}\\text{{ s}}$?", k1, d1, "q1", f"The slope of the last segment is $({ws[-1]}-{ws[-2]})/{dt}={sig(al)}\\text{{ rad/s}}^2$."),
                                (f"Through what angle does the wheel turn from $t=0$ to $t={T}\\text{{ s}}$?", k2, d2, "q2", f"The areas of the trapezoids under the graph are {_seg_text(xs, ws, 'rad')}, which add to ${sig(float(ang))}\\text{{ rad}}$.")]:
        q.append(mk(f"phs_wt_set_{nm}", "5.1", "2.B", st, key, ds, rng, concept="Two questions about a single angular speed-time graph", thinking=["Read the graph to find the needed slope or area", "Apply the rotational kinematics definitions"],
                    cond=[("the angular speed is piecewise linear", "the shared stimulus is built from integer vertices")], path="exact fractions versus numpy integration or polyfit of the same graph", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"xs={xs}", f"ws={ws}"], kwhy=kw))
    intro = "A wheel rotates about a fixed axle and always turns in the same direction. The graph shows the angular speed of the wheel as a function of time."
    return _set_pack("phs_wt_set", "5.1", intro, stim, q, q[0]["facts"])


@retry_sep
def phs_spring_set(rng):
    """세트 5: 수평 용수철-블록의 위치–시간 그래프 → (용수철 상수, 최대 속력). 단원 7."""
    for _ in forever():
        T = pick(rng, [0.5, 1.0, 2.0]); A = pick(rng, [0.05, 0.10, 0.20]); m = pick(rng, [0.2, 0.5, 1.0, 2.0])
        k = 4 * math.pi ** 2 * m / T ** 2; vmax = 2 * math.pi * A / T
        # 독립 경로: 이 k 로 운동 방정식을 RK4 적분해 주기(1/4 주기 x4)와 평형 통과 속력을 측정
        st = np.array([A, 0.0]); t = 0.0; dt = 1e-4
        while st[0] > 0:
            prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
        fr = prv[0] / (prv[0] - st[0]); tq = t - dt + dt * fr; vq = abs(prv[1] + (st[1] - prv[1]) * fr)
        agree(T, 4 * tq, 2e-3, "T"); agree(vmax, vq, 3e-3, "vmax")
        break
    k1, d1 = num_opts(k, [("Leaves out the square on the angular frequency, $m(2\\pi/T)$.", m * 2 * math.pi / T), ("Uses the frequency instead of the angular frequency, $m/T^2$.", m / T ** 2),
                          ("Inverts the relation, $T^2/(4\\pi^2m)$.", T ** 2 / (4 * math.pi ** 2 * m)), ("Uses $4\\pi^2m/T$ with the period to the first power.", 4 * math.pi ** 2 * m / T)], "N/m")
    k2, d2 = num_opts(vmax, [("Reports $A/T$, leaving out the factor of $2\\pi$.", A / T), ("Reports $\\pi A/T$, with one factor of two missing.", math.pi * A / T),
                             ("Reports the maximum acceleration $4\\pi^2A/T^2$ instead of the maximum speed.", 4 * math.pi ** 2 * A / T ** 2), ("Reports $2\\pi AT$, multiplying by the period instead of dividing.", 2 * math.pi * A * T)], "m/s")
    stim = dense_graph_stim("Position versus time of the block", lambda t: A * math.cos(2 * math.pi * t / T), 0, 2 * T, gaxis("Time (s)", 0, 2 * T, T / 4), sym_axis("Position (m)", A), n=161)
    q = []
    for st_, key, ds, nm, kw in [("What is the spring constant of the spring?", k1, d1, "q1", f"The period is read as $T={T:g}\\text{{ s}}$, so $k=4\\pi^2m/T^2={sig(k)}\\text{{ N/m}}$."),
                                 ("What is the maximum speed of the block?", k2, d2, "q2", f"$v_{{max}}=2\\pi A/T=2\\pi({A:g})/{T:g}={sig(vmax)}\\text{{ m/s}}$.")]:
        q.append(mk(f"phs_spring_set_{nm}", "7.2", "2.B", st_, key, ds, rng, concept="Two questions about one oscillator's position-time graph", thinking=["Read the period and amplitude from the graph", "Use the spring-mass period relation for the constant and $v_{max}=2\\pi A/T$ for the speed"],
                    cond=[("the spring is ideal and the surface is frictionless", "the shared description states an ideal spring and a frictionless surface")], path="RK4 integration with the computed spring constant reproduces the period and the speed at the equilibrium position", material=MAT_GRAPH("axis labels with units", "one full period"),
                    judgment=["representation_reading", "symbolic_reasoning"], est=100, facts=[f"T={T}", f"A={A}", f"m={m}"], kwhy=kw))
    intro = f"A ${m:g}\\text{{ kg}}$ block is attached to an ideal horizontal spring on a frictionless surface. The block is pulled aside and released from rest. The graph shows the position of the block as a function of time."
    return _set_pack("phs_spring_set", "7.2", intro, stim, q, q[0]["facts"])


STAGE_U1 = ["ph_xt_signs", "ph_three_stage_motion"]
STAGE_U2 = ["ph_contact_force_blocks", "ph_incline_pulley", "ph_push_angle_normal", "ph_crate_stop_distance"]
STAGE_U4 = ["ph_pt_slope_force", "ph_three_body_explosion", "ph_wall_bounce_impulse"]
STAGE_U5 = ["ph_wt_angle_graph", "ph_rim_acceleration", "ph_net_torque_alpha", "ph_inertia_scaling", "ph_rot_kin_stop"]
STAGE_U6 = ["ph_flywheel_ke", "ph_torque_work_power", "ph_skater_ke_change", "ph_orbit_speed_ratio"]
STAGE_U7 = ["ph_pendulum_moon", "ph_shm_signs", "ph_t2_m_graph", "ph_vertical_spring_period", "ph_xt_max_accel"]
STAGE_U8 = ["ph_density_weighing", "ph_hatch_force", "ph_buoyant_tension", "ph_bernoulli_height"]
STAGE_SETS = ["phs_fx_set", "phs_wt_set", "phs_spring_set"]
