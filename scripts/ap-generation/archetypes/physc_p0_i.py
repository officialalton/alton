"""AP Physics C: Mechanics 원형 I — 2차 저작(2026-10-20): 단원 1·2·3 보강. 1차 검토에서 배운 규칙: 오답은 현실적인 오개념, 설명에는 이 문항의 실제 숫자, 한 단계 대입 문항 금지."""
from physc_common import *

t_ = sp.symbols("t", positive=True)


# ======================= 단원 1 =======================
@retry_sep
def pc_vt_sine_displacement(rng):
    for _ in forever():
        A = pick(rng, [2.0, 3.0, 4.0, 6.0]); w = pick(rng, [2.0, 3.0, 4.0]); T2 = math.pi / w; d = 2 * A / w
        agree(d, simpson(lambda s: A * math.sin(w * s), 0, T2), 1e-6, "d")
        break
    key, ds = num_opts(d, [(f"Multiplies the peak speed by the half period, $A\\pi/\\omega={sig(A * T2)}\\text{{ m}}$, as if the speed stayed at its peak value.", A * T2), (f"Evaluates the antiderivative at the upper limit only, $A/\\omega={sig(A / w)}\\text{{ m}}$, and forgets the lower limit.", A / w), (f"Integrates $\\sin\\omega t$ without the factor $1/\\omega$ from the chain rule, giving $2A={sig(2 * A)}\\text{{ m}}$.", 2 * A), (f"Takes the average of the peak speed and zero over the half period, $\\tfrac12A\\pi/\\omega={sig(A * T2 / 2)}\\text{{ m}}$.", A * T2 / 2)], "m")
    stem = f"A cart moves along a straight track with velocity $v(t)={A:g}\\sin({w:g}t)$, where $v$ is in meters per second and $t$ is in seconds. What is the displacement of the cart from $t=0$ until the velocity first returns to zero?"
    return MQ("pc_vt_sine_displacement", "1.2", "2.B", stem, key, ds, rng, "Displacement as the integral of a sinusoidal velocity", ["Find the time when the velocity first returns to zero and set up the definite integral", "Integrate with the factor $1/\\omega$ from the chain rule and evaluate both limits"],
              "sympy definite integral versus a Simpson integration", f"The velocity first returns to zero at $t=\\pi/\\omega$, and $\\Delta x=\\int_0^{{\\pi/\\omega}}A\\sin\\omega t\\,dt=2A/\\omega={sig(d)}\\text{{ m}}$.", [f"A={A}", f"w={w}"], est=95)


@retry_sep
def pc_cliff_launch_time(rng):
    for _ in forever():
        v0 = pick(rng, [10.0, 15.0, 20.0]); th = pick(rng, [30, 40, 50]); h = pick(rng, [20.0, 30.0, 40.0, 50.0]); vy = v0 * math.sin(math.radians(th))
        t = (vy + math.sqrt(vy * vy + 2 * CG * h)) / CG
        y = rk4(lambda tt, s: np.array([s[1], -CG]), [h, vy], 0.0, t, 4000); agree(0.0, abs(y[0]), 1e-3, "ground")
        break
    key, ds = num_opts(t, [(f"Uses the flight time for level ground, $2v_0\\sin\\theta/g={sig(2 * vy / CG)}\\text{{ s}}$, and ignores the height of the cliff.", 2 * vy / CG), (f"Ignores the initial vertical velocity, $\\sqrt{{2h/g}}={sig(math.sqrt(2 * h / CG))}\\text{{ s}}$.", math.sqrt(2 * h / CG)),
                           (f"Takes the negative root of the quadratic, $(v_y-\\sqrt{{v_y^2+2gh}})/g$ in magnitude, ${sig((math.sqrt(vy * vy + 2 * CG * h) - vy) / CG)}\\text{{ s}}$, which is the time before the launch.", (math.sqrt(vy * vy + 2 * CG * h) - vy) / CG), (f"Drops the factor of two in the quadratic, $(v_y+\\sqrt{{v_y^2+gh}})/g={sig((vy + math.sqrt(vy * vy + CG * h)) / CG)}\\text{{ s}}$.", (vy + math.sqrt(vy * vy + CG * h)) / CG)], "s")
    stem = f"A ball is thrown from the edge of a cliff that is ${h:g}\\text{{ m}}$ above level ground. The ball leaves the hand with speed ${v0:g}\\text{{ m/s}}$ at ${th}^\\circ$ above the horizontal. Air resistance is negligible. How long after the throw does the ball hit the ground?"
    return MQ("pc_cliff_launch_time", "1.5", "2.B", stem, key, ds, rng, "Projectile that lands below its launch height", ["Write the vertical position $y(t)=h+v_0\\sin\\theta\\,t-\\tfrac12gt^2$", "Solve the quadratic and keep the positive root"],
              "an RK4 integration of the vertical motion confirms that the ball reaches the ground at the computed time", f"$0=h+v_y t-\\tfrac12gt^2$ gives $t=\\left(v_y+\\sqrt{{v_y^2+2gh}}\\right)/g={sig(t)}\\text{{ s}}$.", [f"v0={v0}", f"th={th}", f"h={h}"], est=120)


@retry_sep
def pc_rain_on_car(rng):
    for _ in forever():
        u = pick(rng, [6.0, 8.0, 10.0, 12.0]); v = pick(rng, [15.0, 20.0, 25.0]); s = math.hypot(u, v)
        rel = np.array([-v, -u]); agree(s, float(np.linalg.norm(rel)), 1e-9, "s")
        break
    key, ds = num_opts(s, [(f"Adds the two speeds, $u+v={sig(u + v)}\\text{{ m/s}}$, as if the rain and the car moved along the same line.", u + v), (f"Subtracts the speeds, $v-u={sig(v - u)}\\text{{ m/s}}$, as if the rain moved parallel to the car.", v - u), (f"Uses only the speed of the car, ${v:g}\\text{{ m/s}}$.", v), (f"Uses only the speed of the rain, ${u:g}\\text{{ m/s}}$.", u)], "m/s")
    stem = f"Rain falls vertically at ${u:g}\\text{{ m/s}}$ relative to the ground. A car travels horizontally at ${v:g}\\text{{ m/s}}$ relative to the ground. What is the speed of the raindrops relative to the car?"
    return MQ("pc_rain_on_car", "1.4", "2.B", stem, key, ds, rng, "Relative velocity with perpendicular components", ["Write the velocity of the rain relative to the car as the difference of the two velocities", "Combine the perpendicular components with the Pythagorean theorem"],
              "the relative velocity vector is built numerically and its norm is computed", f"The rain has components ${v:g}\\text{{ m/s}}$ horizontally and ${u:g}\\text{{ m/s}}$ vertically relative to the car, so the speed is $\\sqrt{{{v:g}^2+{u:g}^2}}={sig(s)}\\text{{ m/s}}$.", [f"u={u}", f"v={v}"], est=85)


@retry_sep
def pc_free_fall_two_balls(rng):
    for _ in forever():
        h = pick(rng, [20.0, 30.0, 45.0, 80.0]); v0 = pick(rng, [5.0, 10.0, 15.0]); tA = math.sqrt(2 * h / CG); tB = (-v0 + math.sqrt(v0 * v0 + 2 * CG * h)) / CG; dt = tA - tB
        yB = rk4(lambda tt, s: np.array([s[1], -CG]), [h, -v0], 0.0, tB, 4000); agree(0.0, abs(yB[0]), 1e-3, "B")
        if dt > 0.3:
            break
    key, ds = num_opts(dt, [(f"Reports the fall time of the dropped ball, ${sig(tA)}\\text{{ s}}$, instead of the difference.", tA), (f"Assumes the thrown ball keeps the speed ${v0:g}\\text{{ m/s}}$ for the whole fall, $h/v_0={sig(h / v0)}\\text{{ s}}$, and subtracts, ${sig(abs(tA - h / v0))}\\text{{ s}}$.", abs(tA - h / v0)), (f"Reports the fall time of the thrown ball, ${sig(tB)}\\text{{ s}}$, instead of the difference.", tB), (f"Uses $v_0/g={sig(v0 / CG)}\\text{{ s}}$, the time for gravity to change the speed by $v_0$.", v0 / CG)], "s")
    stem = f"Ball A is dropped from rest from a height of ${h:g}\\text{{ m}}$. At the same instant ball B is thrown straight downward from the same height with an initial speed of ${v0:g}\\text{{ m/s}}$. Air resistance is negligible. How much earlier than ball A does ball B reach the ground?"
    return MQ("pc_free_fall_two_balls", "1.2", "2.B", stem, key, ds, rng, "Comparing two constant-acceleration falls", ["Find the fall time of each ball from its own equation of motion", "Subtract the two times"],
              "an RK4 integration of each fall recomputes the two times", f"$t_A=\\sqrt{{2h/g}}={sig(tA)}\\text{{ s}}$ and $t_B=\\left(-v_0+\\sqrt{{v_0^2+2gh}}\\right)/g={sig(tB)}\\text{{ s}}$, so the difference is ${sig(dt)}\\text{{ s}}$.", [f"h={h}", f"v0={v0}"], est=115)


@retry_sep
def pc_projectile_speed_at_time(rng):
    for _ in forever():
        v0 = pick(rng, [20.0, 25.0, 30.0]); th = pick(rng, [30, 40, 50, 60]); tt = pick(rng, [0.5, 1.0, 1.5, 2.0, 3.0]); vx = v0 * math.cos(math.radians(th)); vy0 = v0 * math.sin(math.radians(th)); vy = vy0 - CG * tt
        s = math.hypot(vx, vy); y = rk4(lambda t, st: np.array([st[1], -CG]), [0.0, vy0], 0.0, tt, 4000); agree(vy, y[1], 1e-6, "vy")
        if tt < 2 * vy0 / CG and abs(s - v0) > 0.8 and abs(vy) > 1:
            break
    key, ds = num_opts(s, [(f"Reports the launch speed, ${v0:g}\\text{{ m/s}}$, as if the speed were constant.", v0), (f"Uses only the vertical component, $|v_y|={sig(abs(vy))}\\text{{ m/s}}$.", abs(vy)), (f"Adds the components instead of combining them as perpendicular vectors, $v_x+v_y={sig(vx + vy)}\\text{{ m/s}}$.", vx + vy), (f"Adds the gravitational change to the vertical component instead of subtracting it, ${sig(math.hypot(vx, vy0 + CG * tt))}\\text{{ m/s}}$.", math.hypot(vx, vy0 + CG * tt))], "m/s")
    stem = f"A projectile is launched from level ground with speed ${v0:g}\\text{{ m/s}}$ at ${th}^\\circ$ above the horizontal. Air resistance is negligible. What is its speed ${tt:g}\\text{{ s}}$ after the launch, before it lands?"
    return MQ("pc_projectile_speed_at_time", "1.5", "2.B", stem, key, ds, rng, "Speed from the velocity components of a projectile at a given time", ["Find the horizontal component, which is constant, and the vertical component at the given time", "Combine the components with the Pythagorean theorem"],
              "an RK4 integration of the vertical motion recomputes the vertical component", f"$v_x={sig(vx)}\\text{{ m/s}}$ and $v_y=v_0\\sin\\theta-gt={sig(vy)}\\text{{ m/s}}$, so $v={sig(s)}\\text{{ m/s}}$.", [f"v0={v0}", f"th={th}", f"t={tt}"], est=105)


# ======================= 단원 2 =======================
@retry_sep
def pc_atwood_incline_accel(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [2.0, 3.0, 4.0, 5.0]); th = pick(rng, [30, 37, 45, 53]); thr = math.radians(th)
        a = (m2 - m1 * math.sin(thr)) * CG / (m1 + m2)
        sol = np.linalg.solve(np.array([[m1, -1.0], [m2, 1.0]]), np.array([-m1 * CG * math.sin(thr), m2 * CG])); agree(a, sol[0], 1e-9, "a")
        if a > 0.8:
            break
    key, ds = num_opts(a, [(f"Ignores the incline angle, $(m_2-m_1)g/(m_1+m_2)={sig((m2 - m1) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m2 - m1) * CG / (m1 + m2) if m2 > m1 else 0.5), (f"Uses the cosine for the weight component along the incline, $(m_2-m_1\\cos\\theta)g/(m_1+m_2)={sig((m2 - m1 * math.cos(thr)) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m2 - m1 * math.cos(thr)) * CG / (m1 + m2)),
                           (f"Leaves the mass on the incline out of the total mass, $(m_2-m_1\\sin\\theta)g/m_2={sig((m2 - m1 * math.sin(thr)) * CG / m2)}\\text{{ m/s}}^2$.", (m2 - m1 * math.sin(thr)) * CG / m2), (f"Adds the weight component along the incline instead of subtracting it, $(m_2+m_1\\sin\\theta)g/(m_1+m_2)={sig((m2 + m1 * math.sin(thr)) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m2 + m1 * math.sin(thr)) * CG / (m1 + m2))], "m/s^2")
    stem = f"A ${m1:g}\\text{{ kg}}$ block rests on a frictionless incline of angle ${th}^\\circ$. A light string over a light, frictionless pulley at the top of the incline connects it to a ${m2:g}\\text{{ kg}}$ block that hangs vertically. The system is released from rest. What is the magnitude of the acceleration of the blocks?"
    return MQ("pc_atwood_incline_accel", "2.5", "2.B", stem, key, ds, rng, "Newton's second law for two connected bodies on an incline", ["Write Newton's second law along the incline for the first block and vertically for the second", "Eliminate the tension to find the common acceleration"],
              "numpy linalg.solve of the two coupled equations recomputes the acceleration", f"$m_2g-T=m_2a$ and $T-m_1g\\sin\\theta=m_1a$ give $a={sig(a)}\\text{{ m/s}}^2$.", [f"m1={m1}", f"m2={m2}", f"th={th}"], est=120)


@retry_sep
def pc_banked_curve_speed(rng):
    for _ in forever():
        r = pick(rng, [40.0, 60.0, 80.0, 100.0]); th = pick(rng, [10, 15, 20, 25]); thr = math.radians(th); v = math.sqrt(CG * r * math.tan(thr))
        A = np.array([[math.sin(thr), -1.0], [math.cos(thr), 0.0]]); N, ac = np.linalg.solve(np.array([[math.sin(thr), -1.0], [math.cos(thr), 0.0]]), np.array([0.0, CG]))[0], 0
        Nn = CG / math.cos(thr); agree(math.sqrt(Nn * math.sin(thr) * r), v, 1e-9, "v")
        break
    key, ds = num_opts(v, [(f"Ignores the banking, $\\sqrt{{gr}}={sig(math.sqrt(CG * r))}\\text{{ m/s}}$.", math.sqrt(CG * r)), (f"Inverts the tangent, $\\sqrt{{gr/\\tan\\theta}}={sig(math.sqrt(CG * r / math.tan(thr)))}\\text{{ m/s}}$.", math.sqrt(CG * r / math.tan(thr))), (f"Omits the square root, $gr\\tan\\theta={sig(CG * r * math.tan(thr))}\\text{{ m/s}}$.", CG * r * math.tan(thr)), (f"Adds a factor of two inside the root, $\\sqrt{{2gr\\tan\\theta}}={sig(math.sqrt(2 * CG * r * math.tan(thr)))}\\text{{ m/s}}$.", math.sqrt(2 * CG * r * math.tan(thr)))], "m/s")
    stem = f"A car rounds a frictionless banked curve of radius ${r:g}\\text{{ m}}$ that is banked at ${th}^\\circ$ to the horizontal. At what speed can the car travel so that it needs no friction to stay on the road?"
    return MQ("pc_banked_curve_speed", "2.10", "2.B", stem, key, ds, rng, "Components of the normal force provide the centripetal force", ["Resolve the normal force into vertical and horizontal components", "Set the vertical component equal to the weight and the horizontal component equal to the centripetal force"],
              "the normal force from the vertical balance gives the centripetal acceleration, from which the speed is recomputed", f"$N\\cos\\theta=mg$ and $N\\sin\\theta=mv^2/r$ give $v=\\sqrt{{gr\\tan\\theta}}={sig(v)}\\text{{ m/s}}$.", [f"r={r}", f"th={th}"], est=110)


@retry_sep
def pc_conical_pendulum_period(rng):
    for _ in forever():
        L = pick(rng, [0.8, 1.0, 1.5, 2.0]); th = pick(rng, [20, 30, 40, 50]); thr = math.radians(th)
        T = 2 * math.pi * math.sqrt(L * math.cos(thr) / CG)
        omega = math.sqrt(CG * math.tan(thr) / (L * math.sin(thr))); agree(T, 2 * math.pi / omega, 1e-9, "T")
        break
    key, ds = num_opts(T, [(f"Uses the simple-pendulum period, $2\\pi\\sqrt{{L/g}}={sig(2 * math.pi * math.sqrt(L / CG))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(L / CG)), (f"Uses $\\sin\\theta$ instead of $\\cos\\theta$, $2\\pi\\sqrt{{L\\sin\\theta/g}}={sig(2 * math.pi * math.sqrt(L * math.sin(thr) / CG))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(L * math.sin(thr) / CG)), (f"Puts the cosine in the denominator, $2\\pi\\sqrt{{L/(g\\cos\\theta)}}={sig(2 * math.pi * math.sqrt(L / (CG * math.cos(thr))))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(L / (CG * math.cos(thr))))], "s")
    stem = f"A small bob on a light string of length ${L:g}\\text{{ m}}$ moves in a horizontal circle at a constant speed, with the string making an angle of ${th}^\\circ$ with the vertical (a conical pendulum). What is the time for the bob to complete one revolution?"
    return MQ("pc_conical_pendulum_period", "2.10", "2.B", stem, key, ds, rng, "Tension components in circular motion", ["Resolve the tension into vertical and horizontal components", "Use the horizontal component as the centripetal force with the radius $L\\sin\\theta$"],
              "the angular speed is recomputed from $\\omega^2=g\\tan\\theta/(L\\sin\\theta)$", f"$T\\cos\\theta=mg$ and $T\\sin\\theta=m\\omega^2L\\sin\\theta$ give $\\omega^2=g/(L\\cos\\theta)$, so the period is $2\\pi\\sqrt{{L\\cos\\theta/g}}={sig(T)}\\text{{ s}}$.", [f"L={L}", f"th={th}"], est=125)


@retry_sep
def pc_block_on_block_slip(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0]); M = pick(rng, [3.0, 4.0, 5.0]); mu = pick(rng, [0.2, 0.3, 0.4, 0.5]); F = (M + m) * mu * CG
        a_top = mu * CG; sol = np.linalg.solve(np.array([[M + m]]), np.array([F])); agree(a_top, sol[0], 1e-9, "a")
        break
    key, ds = num_opts(F, [(f"Uses only the maximum friction force on the top block, $\\mu mg={sig(mu * m * CG)}\\text{{ N}}$.", mu * m * CG), (f"Uses the weight of the bottom block, $\\mu Mg={sig(mu * M * CG)}\\text{{ N}}$, instead of the total mass.", mu * M * CG), (f"Subtracts the masses, $\\mu(M-m)g={sig(mu * (M - m) * CG)}\\text{{ N}}$.", mu * (M - m) * CG), (f"Uses the total weight without the coefficient, $(M+m)g={sig((M + m) * CG)}\\text{{ N}}$.", (M + m) * CG)], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ block rests on top of a ${M:g}\\text{{ kg}}$ block, which lies on a frictionless horizontal table. The coefficient of static friction between the two blocks is ${mu:g}$. A horizontal force $F$ is applied to the bottom block. What is the largest value of $F$ for which the top block does not slip on the bottom block?"
    return MQ("pc_block_on_block_slip", "2.7", "2.B", stem, key, ds, rng, "Static friction limits the acceleration of the top block", ["Find the largest acceleration that static friction can give the top block", "Apply Newton's second law to the two blocks together"],
              "numpy linalg.solve of the system equation recomputes the force", f"$a_{{max}}=\\mu_sg$ and $F=(M+m)a_{{max}}={sig(F)}\\text{{ N}}$.", [f"m={m}", f"M={M}", f"mu={mu}"], est=110)


@retry_sep
def pc_quadratic_drag_terminal_numeric(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0, 4.0]); c = pick(rng, [0.05, 0.1, 0.2, 0.5]); vt = math.sqrt(m * CG / c)
        y = rk4(lambda tt, s: np.array([CG - c * s[0] ** 2 / m]), [0.0], 0.0, 60.0, 30000); agree(vt, y[0], 1e-4, "vt")
        break
    key, ds = num_opts(vt, [(f"Omits the square root, $mg/c={sig(m * CG / c)}\\text{{ m/s}}$.", m * CG / c), (f"Multiplies by the drag constant instead of dividing, $\\sqrt{{mgc}}={sig(math.sqrt(m * CG * c))}\\text{{ m/s}}$.", math.sqrt(m * CG * c)), (f"Leaves out the mass, $\\sqrt{{g/c}}={sig(math.sqrt(CG / c))}\\text{{ m/s}}$.", math.sqrt(CG / c)), (f"Uses the linear-drag formula with the constant $c$, $mg/\\sqrt{{c}}={sig(m * CG / math.sqrt(c))}\\text{{ m/s}}$.", m * CG / math.sqrt(c))], "m/s")
    stem = f"An object of mass ${m:g}\\text{{ kg}}$ falls through air that exerts a drag force of magnitude $cv^2$ with $c={c:g}\\text{{ kg/m}}$. What is the terminal speed of the object?"
    return MQ("pc_quadratic_drag_terminal_numeric", "2.9", "2.B", stem, key, ds, rng, "Terminal speed under quadratic drag", ["Set the weight equal to the drag force", "Solve for the speed"],
              "an RK4 integration of the equation of motion over a long time converges to the same speed", f"$mg=cv_t^2$ gives $v_t=\\sqrt{{mg/c}}={sig(vt)}\\text{{ m/s}}$.", [f"m={m}", f"c={c}"], est=80)


@retry_sep
def pc_springs_series_stretch(rng):
    for _ in forever():
        k1 = pick(rng, [100.0, 200.0, 300.0]); k2 = pick(rng, [150.0, 250.0, 400.0]); m = pick(rng, [1.0, 2.0, 3.0]); x = m * CG * (1 / k1 + 1 / k2)
        F = m * CG; agree(x, F / k1 + F / k2, 1e-12, "x")
        if k1 != k2:
            break
    key, ds = num_opts(x, [(f"Treats the springs as acting in parallel, $mg/(k_1+k_2)={sig(m * CG / (k1 + k2))}\\text{{ m}}$.", m * CG / (k1 + k2)), (f"Uses only the first spring, $mg/k_1={sig(m * CG / k1)}\\text{{ m}}$.", m * CG / k1), (f"Uses only the second spring, $mg/k_2={sig(m * CG / k2)}\\text{{ m}}$.", m * CG / k2), (f"Averages the two extensions, ${sig(m * CG * (1 / k1 + 1 / k2) / 2)}\\text{{ m}}$.", m * CG * (1 / k1 + 1 / k2) / 2)], "m")
    stem = f"A ${m:g}\\text{{ kg}}$ block hangs at rest from the lower end of a spring with spring constant $k_1={k1:g}\\text{{ N/m}}$. The upper end of that spring hangs from a second spring with spring constant $k_2={k2:g}\\text{{ N/m}}$, which is attached to the ceiling (the springs are in series and have negligible mass). What is the total extension of the two springs beyond their natural lengths?"
    return MQ("pc_springs_series_stretch", "2.8", "2.B", stem, key, ds, rng, "Springs in series carry the same force and their extensions add", ["Recognize that each spring supports the whole weight", "Add the two extensions $mg/k_1$ and $mg/k_2$"],
              "the two extensions are computed separately and added", f"Each spring carries $mg={sig(m * CG)}\\text{{ N}}$, so the total extension is $mg/k_1+mg/k_2={sig(x)}\\text{{ m}}$.", [f"k1={k1}", f"k2={k2}", f"m={m}"], est=95)


@retry_sep
def pc_hilltop_normal_force(rng):
    for _ in forever():
        m = pick(rng, [800.0, 1000.0, 1200.0]); r = pick(rng, [40.0, 50.0, 80.0]); v = pick(rng, [10.0, 12.0, 15.0]); N = m * (CG - v * v / r)
        Nn = float(np.linalg.solve(np.array([[1.0]]), np.array([m * CG - m * v * v / r]))[0]); agree(N, Nn, 1e-9, "N")
        if N > 500:
            break
    key, ds = num_opts(N, [(f"Adds the centripetal term to the weight, $m(g+v^2/r)={sig(m * (CG + v * v / r))}\\text{{ N}}$.", m * (CG + v * v / r)), (f"Reports the weight, $mg={sig(m * CG)}\\text{{ N}}$, ignoring the circular motion.", m * CG), (f"Reports only the centripetal force, $mv^2/r={sig(m * v * v / r)}\\text{{ N}}$.", m * v * v / r), (f"Subtracts the weight from the centripetal term, $mv^2/r-mg$ in magnitude, ${sig(abs(m * v * v / r - m * CG))}\\text{{ N}}$.", abs(m * v * v / r - m * CG))], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ car crosses the top of a circular hill of radius ${r:g}\\text{{ m}}$ at a constant speed of ${v:g}\\text{{ m/s}}$. What is the magnitude of the normal force that the road exerts on the car at the top of the hill?"
    return MQ("pc_hilltop_normal_force", "2.10", "2.B", stem, key, ds, rng, "Net force toward the center at the top of a hill", ["Draw the weight down and the normal force up at the top", "Set the net downward force equal to the centripetal force"],
              "the net inward force is computed from the vector sum and compared with mv^2/r", f"$mg-N=mv^2/r$ gives $N={sig(N)}\\text{{ N}}$.", [f"m={m}", f"r={r}", f"v={v}"], est=95)


# ======================= 단원 3 =======================
@retry_sep
def pc_gravity_work_variable(rng):
    for _ in forever():
        GM = 3.986e14; m = pick(rng, [500.0, 1000.0, 2000.0]); r1 = pick(rng, [7.0e6, 8.0e6, 1.0e7]); r2 = r1 * pick(rng, [2.0, 3.0, 4.0])
        W = GM * m * (1 / r1 - 1 / r2); agree(W, simpson(lambda s: GM * m / s ** 2, r1, r2, 20001), 1e-5, "W")
        break
    fm = lambda val: sci(val, "J")  # noqa: E731
    g0 = GM / 6.371e6 ** 2
    key, ds = num_opts(W, [(f"Treats gravity as constant at the surface value, $mg(r_2-r_1)$ with $g=9.8\\text{{ m/s}}^2$, giving {sci(m * 9.8 * (r2 - r1), 'J')}.", m * 9.8 * (r2 - r1)), (f"Takes the potential energy at the final radius, $GMm/r_2$, as the work, giving {sci(GM * m / r2, 'J')}.", GM * m / r2),
                           (f"Uses the final distance only in both terms, $GMm\\,(r_2-r_1)/r_2^2$, giving {sci(GM * m * (r2 - r1) / r2 ** 2, 'J')}.", GM * m * (r2 - r1) / r2 ** 2), (f"Uses $GMm\\,(r_2-r_1)/r_1^2$, the initial force times the distance, giving {sci(GM * m * (r2 - r1) / r1 ** 2, 'J')}.", GM * m * (r2 - r1) / r1 ** 2)], "J", fmt=fm)
    stem = f"A ${m:g}\\text{{ kg}}$ satellite is slowly raised from a circular orbit of radius {sci(r1, 'm')} to a circular orbit of radius {sci(r2, 'm')}, both measured from the center of Earth. Use $GM_E=3.986\\times10^{{14}}\\text{{ N·m}}^2/\\text{{kg}}$. How much work must be done on the satellite to change its distance from Earth's center (ignore its kinetic energy)?"
    return MQ("pc_gravity_work_variable", "3.3", "2.B", stem, key, ds, rng, "Work against the inverse-square gravitational force by integration", ["Set up $W=\\int F\\,dr$ with $F=GMm/r^2$", "Evaluate the integral between the two radii"],
              "a Simpson integration of the gravitational force recomputes the work", f"$W=\\int_{{r_1}}^{{r_2}}GMm/r^2\\,dr=GMm(1/r_1-1/r_2)={sci(W, 'J').strip('$')}$.", [f"m={m}", f"r1={r1}", f"r2={r2}"], est=120)


@retry_sep
def pc_power_from_position(rng):
    for _ in forever():
        a = pick(rng, [0.5, 1.0, 2.0]); m = pick(rng, [1.0, 2.0, 3.0]); t0 = pick(rng, [1.0, 2.0, 3.0]); P = 18 * m * a * a * t0 ** 3
        x = lambda s: a * s ** 3  # noqa: E731
        v = nd(x, t0); acc = (x(t0 + 1e-3) - 2 * x(t0) + x(t0 - 1e-3)) / 1e-6; agree(P, m * acc * v, 1e-4, "P")
        break
    F = 6 * m * a * t0; v_ = 3 * a * t0 ** 2
    key, ds = num_opts(P, [(f"Multiplies the force, ${sig(F)}\\text{{ N}}$, by the position, ${sig(a * t0 ** 3)}\\text{{ m}}$, instead of by the velocity.", F * a * t0 ** 3), (f"Uses the average power over the first ${t0:g}\\text{{ s}}$, $\\tfrac12mv^2/t={sig(0.5 * m * v_ ** 2 / t0)}\\text{{ W}}$, instead of the instantaneous power.", 0.5 * m * v_ ** 2 / t0),
                           (f"Uses the force ${sig(F / 2)}\\text{{ N}}$ from dropping the factor of two in the second derivative, so the power is half of the correct value.", P / 2), (f"Reports the kinetic energy times two, $mv^2={sig(m * v_ ** 2)}$, in place of the power.", m * v_ ** 2)], "W")
    stem = f"A ${m:g}\\text{{ kg}}$ object moves along the $x$-axis with position $x(t)={a:g}t^3$, where $x$ is in meters and $t$ is in seconds. What is the instantaneous power delivered by the net force to the object at $t={t0:g}\\text{{ s}}$?"
    return MQ("pc_power_from_position", "3.5", "2.B", stem, key, ds, rng, "Instantaneous power as force times velocity with both found by differentiation", ["Differentiate the position once for the velocity and twice for the acceleration", "Use $P=Fv=mav$ at the given time"],
              "finite-difference first and second derivatives recompute the velocity and the acceleration", f"$v=3({a:g})t^2={sig(v_)}\\text{{ m/s}}$, $a=6({a:g})t={sig(6 * a * t0)}\\text{{ m/s}}^2$ and $P=mav={sig(P)}\\text{{ W}}$.", [f"a={a}", f"m={m}", f"t0={t0}"], est=110)


@retry_sep
def pc_block_drop_spring_compression(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [200.0, 400.0, 800.0]); h = pick(rng, [0.2, 0.4, 0.6, 1.0]); w = m * CG
        x = (w + math.sqrt(w * w + 2 * k * w * h)) / k
        f = lambda s: 0.5 * k * s * s - w * s - w * h  # noqa: E731
        agree(x, bisect(f, 0.0, 5.0), 1e-9, "x")
        break
    key, ds = num_opts(x, [(f"Ignores the further drop during the compression, $\\sqrt{{2mgh/k}}={sig(math.sqrt(2 * w * h / k))}\\text{{ m}}$.", math.sqrt(2 * w * h / k)), (f"Gives the equilibrium compression, $mg/k={sig(w / k)}\\text{{ m}}$, which is where the speed is greatest, not the lowest point.", w / k), (f"Divides by $2k$ instead of $k$ in the quadratic formula, ${sig((w + math.sqrt(w * w + 2 * k * w * h)) / (2 * k))}\\text{{ m}}$.", (w + math.sqrt(w * w + 2 * k * w * h)) / (2 * k))], "m")
    stem = f"A ${m:g}\\text{{ kg}}$ block is dropped from rest from a height of ${h:g}\\text{{ m}}$ above the top of a vertical ideal spring ($k={k:g}\\text{{ N/m}}$). What is the maximum compression of the spring?"
    return MQ("pc_block_drop_spring_compression", "3.4", "2.B", stem, key, ds, rng, "Energy conservation including the drop during the compression", ["Write the energy balance from the release to the lowest point, including the extra drop $x$", "Solve the quadratic in the compression and keep the positive root"],
              "a bisection root finder on the energy balance recomputes the compression", f"$mg(h+x)=\\tfrac12kx^2$ gives $x={sig(x)}\\text{{ m}}$.", [f"m={m}", f"k={k}", f"h={h}"], est=130)


@retry_sep
def pc_incline_up_distance(rng):
    for _ in forever():
        v0 = pick(rng, [4.0, 5.0, 6.0, 8.0]); th = pick(rng, [20, 25, 30, 37]); mu = pick(rng, [0.1, 0.2, 0.3]); thr = math.radians(th)
        a = CG * (math.sin(thr) + mu * math.cos(thr)); d = v0 ** 2 / (2 * a)
        y = rk4(lambda tt, s: np.array([s[1], -a]), [0.0, v0], 0.0, v0 / a, 4000); agree(d, y[0], 1e-6, "d")
        break
    key, ds = num_opts(d, [(f"Ignores friction, $v_0^2/(2g\\sin\\theta)={sig(v0 ** 2 / (2 * CG * math.sin(thr)))}\\text{{ m}}$.", v0 ** 2 / (2 * CG * math.sin(thr))), (f"Subtracts the friction term as if it helped the block, $v_0^2/\\left(2g(\\sin\\theta-\\mu\\cos\\theta)\\right)={sig(v0 ** 2 / (2 * CG * (math.sin(thr) - mu * math.cos(thr))))}\\text{{ m}}$.", v0 ** 2 / (2 * CG * (math.sin(thr) - mu * math.cos(thr)))),
                           (f"Uses the cosine for the weight component along the incline, $v_0^2/\\left(2g(\\cos\\theta+\\mu\\sin\\theta)\\right)={sig(v0 ** 2 / (2 * CG * (math.cos(thr) + mu * math.sin(thr))))}\\text{{ m}}$.", v0 ** 2 / (2 * CG * (math.cos(thr) + mu * math.sin(thr)))), (f"Omits the factor of two, $v_0^2/\\left(g(\\sin\\theta+\\mu\\cos\\theta)\\right)={sig(v0 ** 2 / (CG * (math.sin(thr) + mu * math.cos(thr))))}\\text{{ m}}$.", v0 ** 2 / (CG * (math.sin(thr) + mu * math.cos(thr))))], "m")
    stem = f"A block is launched up a rough incline of angle ${th}^\\circ$ with an initial speed of ${v0:g}\\text{{ m/s}}$. The coefficient of kinetic friction is ${mu:g}$. How far along the incline does the block travel before it momentarily stops?"
    return MQ("pc_incline_up_distance", "3.4", "2.B", stem, key, ds, rng, "Work-energy theorem with gravity and friction both opposing the motion", ["Write the work done by the weight component and by friction along the distance $d$", "Set the total work equal to the loss of kinetic energy"],
              "an RK4 integration of the constant deceleration recomputes the distance", f"$\\tfrac12mv_0^2=mg(\\sin\\theta+\\mu\\cos\\theta)d$ gives $d={sig(d)}\\text{{ m}}$.", [f"v0={v0}", f"th={th}", f"mu={mu}"], est=115)


STAGE_U1_B = ["pc_vt_sine_displacement", "pc_cliff_launch_time", "pc_rain_on_car", "pc_free_fall_two_balls", "pc_projectile_speed_at_time"]
STAGE_U2_B = ["pc_atwood_incline_accel", "pc_banked_curve_speed", "pc_conical_pendulum_period", "pc_block_on_block_slip", "pc_quadratic_drag_terminal_numeric", "pc_springs_series_stretch", "pc_hilltop_normal_force"]
STAGE_U3_B = ["pc_gravity_work_variable", "pc_power_from_position", "pc_block_drop_spring_compression", "pc_incline_up_distance"]
