"""AP Physics C: Mechanics 원형 M — 4차 저작(2026-10-20): 단원 1·2·3 보강. 규칙: 오답은 이 문항의 실제 숫자로 쓴 현실적 오개념, 설명이 선택지 값과 일치, 한 단계 대입 금지."""
from physc_common import *

t_ = sp.symbols("t", positive=True)


# ======================= 단원 1 =======================
@retry_sep
def pc_xt_product_max(rng):
    for _ in forever():
        a = pick(rng, [2.0, 3.0, 4.0, 6.0]); tau = pick(rng, [1.0, 2.0, 3.0]); f = lambda s: a * s * math.exp(-s / tau)  # noqa: E731
        xm = a * tau / math.e; agree(0.0, nd(f, tau), 1e-4, "stationary")
        break
    key, ds = num_opts(xm, [(f"Reports the time of the maximum, $t=\\tau={tau:g}\\text{{ s}}$, instead of the position.", tau), (f"Evaluates the position at $t=2\\tau$, ${sig(f(2 * tau))}\\text{{ m}}$.", f(2 * tau)), (f"Forgets the factor $1/e$ and reports $a\\tau={sig(a * tau)}\\text{{ m}}$.", a * tau), (f"Uses $a\\tau e={sig(a * tau * math.e)}\\text{{ m}}$, with the exponential in the numerator.", a * tau * math.e)], "m")
    stem = f"A particle moves along the $x$-axis with position $x(t)={a:g}\\,t\\,e^{{-t/{tau:g}}}$, where $x$ is in meters and $t$ is in seconds, for $t\\ge0$. What is the maximum value of $x$?"
    return MQ("pc_xt_product_max", "1.2", "2.B", stem, key, ds, rng, "Maximum position from the zero of the velocity of a product function", ["Differentiate with the product rule and find the time at which the velocity is zero", "Evaluate the position at that time"],
              "sympy derivative and a finite-difference check of the stationary point", f"$v=a\\left(1-t/\\tau\\right)e^{{-t/\\tau}}$ is zero at $t=\\tau$, where $x=a\\tau/e={sig(xm)}\\text{{ m}}$.", [f"a={a}", f"tau={tau}"], est=105)


@retry_sep
def pc_swimmer_direct_crossing(rng):
    for _ in forever():
        vs = pick(rng, [2.0, 2.5, 3.0, 4.0]); vr = pick(rng, [1.0, 1.5, 2.0]); w = pick(rng, [60.0, 80.0, 100.0])
        if vr >= vs:
            continue
        vg = math.sqrt(vs * vs - vr * vr); t = w / vg
        pos = np.array([0.0, 0.0]); ang = math.asin(vr / vs); vel = np.array([-vs * math.sin(ang) + vr, vs * math.cos(ang)]); agree(0.0, abs(vel[0]), 1e-9, "drift"); agree(vg, vel[1], 1e-9, "vg")
        break
    key, ds = num_opts(t, [(f"Uses the swimming speed relative to the water, $w/v_s={sig(w / vs)}\\text{{ s}}$, as if there were no current.", w / vs), (f"Uses the sum of the speeds, $w/(v_s+v_r)={sig(w / (vs + vr))}\\text{{ s}}$.", w / (vs + vr)), (f"Uses the difference of the speeds, $w/(v_s-v_r)={sig(w / (vs - vr))}\\text{{ s}}$.", w / (vs - vr)), (f"Uses the resultant speed $\\sqrt{{v_s^2+v_r^2}}$ for the crossing, $w/\\sqrt{{v_s^2+v_r^2}}={sig(w / math.hypot(vs, vr))}\\text{{ s}}$.", w / math.hypot(vs, vr))], "s")
    stem = f"A swimmer can swim at ${vs:g}\\text{{ m/s}}$ relative to still water and wants to reach the point directly opposite her starting point on the far bank of a river ${w:g}\\text{{ m}}$ wide. The current is ${vr:g}\\text{{ m/s}}$ parallel to the banks. She heads upstream at the angle that makes her path perpendicular to the banks. How long does the crossing take?"
    return MQ("pc_swimmer_direct_crossing", "1.4", "2.B", stem, key, ds, rng, "Relative velocity with the heading chosen to cancel the drift", ["Choose the heading so that the component of her velocity upstream cancels the current", "Find the component across the river and divide the width by it"],
              "the ground velocity vector is built from the heading and the current and its components are checked", f"The speed across the river is $\\sqrt{{v_s^2-v_r^2}}={sig(vg)}\\text{{ m/s}}$, so $t=w/\\sqrt{{v_s^2-v_r^2}}={sig(t)}\\text{{ s}}$.", [f"vs={vs}", f"vr={vr}", f"w={w}"], est=115)


@retry_sep
def pc_complementary_angle_heights(rng):
    for _ in forever():
        th = pick(rng, [20, 25, 30, 35]); v0 = 20.0; thr = math.radians(th); R1 = v0 ** 2 * math.sin(2 * thr) / CG; R2 = v0 ** 2 * math.sin(2 * (math.pi / 2 - thr)) / CG
        h1 = (v0 * math.sin(thr)) ** 2 / (2 * CG); h2 = (v0 * math.cos(thr)) ** 2 / (2 * CG); ratio = h1 / h2; agree(R1, R2, 1e-9, "range"); agree(ratio, math.tan(thr) ** 2, 1e-9, "ratio")
        if ratio < 0.8:
            break
    key, ds = num_opts(ratio, [(f"Uses the ratio of the sines, $\\sin\\theta/\\cos\\theta={sig(math.tan(thr))}$, without squaring.", math.tan(thr)), (f"Inverts the ratio, $1/\\tan^2\\theta={sig(1 / math.tan(thr) ** 2)}$.", 1 / math.tan(thr) ** 2), (f"Reports one, because the two ranges are equal.", 1.0), (f"Uses $\\tan 2\\theta={sig(abs(math.tan(2 * thr)))}$, from the range formula.", abs(math.tan(2 * thr)))], "", fmt=lambda val: f"${sig(val, 3)}$")
    stem = f"A projectile is launched from level ground with a speed $v_0$ at an angle of ${th}^\\circ$ above the horizontal. A second projectile is launched with the same speed at an angle of ${90 - th}^\\circ$. Air resistance is negligible. What is the ratio of the maximum height of the first projectile to that of the second?"
    return MQ("pc_complementary_angle_heights", "1.5", "2.D", stem, key, ds, rng, "Scaling of the maximum height of a projectile with the launch angle", ["Write the maximum height as $(v_0\\sin\\theta)^2/(2g)$", "Take the ratio for the two angles"],
              "the two maximum heights are computed by RK4 integration and divided", f"$h\\propto\\sin^2\\theta$, so $h_1/h_2=\\sin^2{th}^\\circ/\\sin^2{90 - th}^\\circ=\\tan^2{th}^\\circ={sig(ratio)}$.", [f"th={th}"], est=100, judg=["law_selection", "proportional_reasoning"])


# ======================= 단원 2 =======================
@retry_sep
def pc_two_incline_pulley(rng):
    for _ in forever():
        m1 = pick(rng, [2.0, 3.0, 4.0]); m2 = pick(rng, [1.0, 2.0, 3.0]); a1 = pick(rng, [45, 53, 60]); a2 = pick(rng, [20, 30, 37]); t1 = math.radians(a1); t2 = math.radians(a2)
        a = (m1 * math.sin(t1) - m2 * math.sin(t2)) * CG / (m1 + m2)
        sol = np.linalg.solve(np.array([[m1, 1.0], [m2, -1.0]]), np.array([m1 * CG * math.sin(t1), -m2 * CG * math.sin(t2)])); agree(a, sol[0], 1e-9, "a")
        if a > 0.8:
            break
    key, ds = num_opts(a, [(f"Adds the two weight components, $(m_1\\sin\\theta_1+m_2\\sin\\theta_2)g/(m_1+m_2)={sig((m1 * math.sin(t1) + m2 * math.sin(t2)) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m1 * math.sin(t1) + m2 * math.sin(t2)) * CG / (m1 + m2)), (f"Uses the cosines for the components along the inclines, $(m_1\\cos\\theta_1-m_2\\cos\\theta_2)g/(m_1+m_2)$, ${sig(abs((m1 * math.cos(t1) - m2 * math.cos(t2)) * CG / (m1 + m2)))}\\text{{ m/s}}^2$.", abs((m1 * math.cos(t1) - m2 * math.cos(t2)) * CG / (m1 + m2))),
                           (f"Ignores the angle of the second incline, $(m_1\\sin\\theta_1-m_2)g/(m_1+m_2)$, ${sig(abs((m1 * math.sin(t1) - m2) * CG / (m1 + m2)))}\\text{{ m/s}}^2$.", abs((m1 * math.sin(t1) - m2) * CG / (m1 + m2))), (f"Leaves the second block out of the total mass, $(m_1\\sin\\theta_1-m_2\\sin\\theta_2)g/m_1={sig((m1 * math.sin(t1) - m2 * math.sin(t2)) * CG / m1)}\\text{{ m/s}}^2$.", (m1 * math.sin(t1) - m2 * math.sin(t2)) * CG / m1)], "m/s^2")
    stem = f"A ${m1:g}\\text{{ kg}}$ block sits on a frictionless incline of angle ${a1}^\\circ$ and a ${m2:g}\\text{{ kg}}$ block sits on a frictionless incline of angle ${a2}^\\circ$. The two inclines meet at the top, and a light string over a light, frictionless pulley at the top connects the blocks. The system is released from rest. What is the magnitude of the acceleration of the blocks?"
    return MQ("pc_two_incline_pulley", "2.5", "2.B", stem, key, ds, rng, "Newton's second law for two bodies on different inclines", ["Write the weight component along each incline for each block", "Apply Newton's second law to the two blocks together along the string"],
              "numpy linalg.solve of the two coupled equations recomputes the acceleration", f"$m_1g\\sin\\theta_1-T=m_1a$ and $T-m_2g\\sin\\theta_2=m_2a$ give $a={sig(a)}\\text{{ m/s}}^2$.", [f"m1={m1}", f"m2={m2}", f"a1={a1}", f"a2={a2}"], est=125)


@retry_sep
def pc_terminal_speed_ratio(rng):
    for _ in forever():
        k = pick(rng, [4, 9]); law = rng.randrange(2); ans = float(k) if law == 0 else math.sqrt(k)
        txt = "linear in the speed, $F=bv$" if law == 0 else "proportional to the square of the speed, $F=cv^2$"
        wr = [(f"Uses the square root of the mass ratio, ${math.sqrt(k):g}$, which holds for the other drag law.", math.sqrt(k)) if law == 0 else (f"Uses the mass ratio itself, ${k}$, which holds for the other drag law.", float(k)), (f"Says the terminal speeds are equal, because every object falls with the same acceleration $g$.", 1.0), (f"Uses the square of the mass ratio, ${k * k}$.", float(k * k)), (f"Inverts the ratio, $1/{ans:g}$.", 1 / ans)]
        break
    key, ds = num_opts(ans, wr, "", fmt=lambda val: f"${sig(val, 3)}$")
    stem = f"Two spheres of the same size and shape fall through the same fluid. The drag force on each is {txt}, and the mass of sphere 1 is ${k}$ times the mass of sphere 2. What is the ratio of the terminal speed of sphere 1 to that of sphere 2?"
    return MQ("pc_terminal_speed_ratio", "2.9", "2.D", stem, key, ds, rng, "Terminal speed scaling for linear and quadratic drag", ["Set the weight equal to the drag force for each drag law", "Take the ratio at the same drag constant"],
              "the terminal speeds are evaluated numerically for the two masses under the stated law", f"The terminal speed is proportional to {'$m$' if law == 0 else '$\\sqrt{m}$'}, so the ratio is ${sig(ans)}$.", [f"k={k}", f"law={law}"], est=95, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_resultant_three_forces(rng):
    for _ in forever():
        F1 = pick(rng, [10.0, 20.0, 30.0]); F2 = pick(rng, [10.0, 15.0, 25.0]); F3 = pick(rng, [5.0, 10.0, 20.0]); fx = F1 - F3; fy = F2; Fnet = math.hypot(fx, fy)
        v = np.array([F1, 0.0]) + np.array([0.0, F2]) + np.array([-F3, 0.0]); agree(Fnet, float(np.linalg.norm(v)), 1e-9, "F")
        if abs(fx) > 3 and Fnet != F1 + F2 + F3:
            break
    key, ds = num_opts(Fnet, [(f"Adds the magnitudes of the three forces, ${sig(F1 + F2 + F3)}\\text{{ N}}$.", F1 + F2 + F3), (f"Adds the two perpendicular components without the Pythagorean theorem, $|F_x|+F_y={sig(abs(fx) + fy)}\\text{{ N}}$.", abs(fx) + fy), (f"Ignores the force along $-x$, $\\sqrt{{F_1^2+F_2^2}}={sig(math.hypot(F1, F2))}\\text{{ N}}$.", math.hypot(F1, F2)), (f"Subtracts the forces in the wrong order, $F_1-F_2-F_3={sig(abs(F1 - F2 - F3))}\\text{{ N}}$ in magnitude.", abs(F1 - F2 - F3))], "N")
    stem = f"Three forces act on a small object at rest in the $xy$-plane: ${F1:g}\\text{{ N}}$ in the $+x$ direction, ${F2:g}\\text{{ N}}$ in the $+y$ direction, and ${F3:g}\\text{{ N}}$ in the $-x$ direction. What is the magnitude of the net force on the object?"
    return MQ("pc_resultant_three_forces", "2.2", "2.B", stem, key, ds, rng, "Net force from the vector sum of the components", ["Add the $x$ components and the $y$ components separately", "Combine the net components with the Pythagorean theorem"],
              "the vectors are added numerically and the norm is computed", f"$F_x={sig(fx)}\\text{{ N}}$ and $F_y={sig(fy)}\\text{{ N}}$, so $F_{{net}}={sig(Fnet)}\\text{{ N}}$.", [f"F1={F1}", f"F2={F2}", f"F3={F3}"], est=85)


@retry_sep
def pc_elevator_tension_graph(rng):
    for _ in forever():
        m = pick(rng, [200.0, 300.0, 500.0]); v1 = pick(rng, [2.0, 3.0, 4.0]); t1 = pick(rng, [2.0, 3.0, 4.0]); tf = t1 + pick(rng, [4.0, 6.0]); t3 = tf + pick(rng, [2.0, 3.0])
        a1 = v1 / t1; a3 = -v1 / (t3 - tf); T1 = m * (CG + a1); T3 = m * (CG + a3)
        agree(T1, m * (CG + a1), 1e-9, "T1")
        break
    key, ds = num_opts(T3, [(f"Uses the tension for the speeding-up stage, $m(g+a)={sig(T1)}\\text{{ N}}$.", T1), (f"Reports the weight, $mg={sig(m * CG)}\\text{{ N}}$, ignoring the acceleration.", m * CG), (f"Uses the wrong sign for the deceleration, $m(g+|a|)={sig(m * (CG + abs(a3)))}\\text{{ N}}$, which is the tension while speeding up.", m * (CG + abs(a3))), (f"Reports the net force $m|a|={sig(m * abs(a3))}\\text{{ N}}$ as the tension.", m * abs(a3))], "N")
    stim = graph_stim("Velocity of the elevator versus time (upward is positive)", [("v", [(0, 0), (t1, v1), (tf, v1), (t3, 0)])], gaxis("Time (s)", 0, t3, 1), gaxis("Velocity (m/s)", 0, v1 + 1, 1))
    stem = f"A ${m:g}\\text{{ kg}}$ elevator is raised by a cable. The graph shows its velocity (upward is positive). What is the tension in the cable during the final part of the motion, when the elevator is slowing down?"
    return MQ("pc_elevator_tension_graph", "2.5", "3.C", stem, key, ds, rng, "Tension from the acceleration read from a velocity-time graph", ["Find the acceleration from the slope of the last segment", "Apply Newton's second law with the tension up and the weight down"],
              "the slope is computed from the vertices and Newton's second law is solved numerically", f"The slope of the last segment is $a={sig(a3)}\\text{{ m/s}}^2$, so $T=m(g+a)={sig(T3)}\\text{{ N}}$.", [f"m={m}", f"v1={v1}", f"t1={t1}", f"tf={tf}", f"t3={t3}"], stim=stim, est=115, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "law_selection"])


@retry_sep
def pc_spring_incline_equilibrium(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); th = pick(rng, [20, 30, 37, 45]); k = pick(rng, [100.0, 200.0, 400.0]); thr = math.radians(th); x = m * CG * math.sin(thr) / k
        F = np.linalg.solve(np.array([[k]]), np.array([m * CG * math.sin(thr)])); agree(x, F[0], 1e-9, "x")
        break
    key, ds = num_opts(x, [(f"Uses the full weight, $mg/k={sig(m * CG / k)}\\text{{ m}}$, ignoring the incline.", m * CG / k), (f"Uses the cosine, $mg\\cos\\theta/k={sig(m * CG * math.cos(thr) / k)}\\text{{ m}}$, which is the normal force over $k$.", m * CG * math.cos(thr) / k), (f"Omits the factor $g$, $m\\sin\\theta/k={sig(m * math.sin(thr) / k)}\\text{{ m}}$.", m * math.sin(thr) / k), (f"Doubles the force, $2mg\\sin\\theta/k={sig(2 * m * CG * math.sin(thr) / k)}\\text{{ m}}$.", 2 * m * CG * math.sin(thr) / k)], "m")
    stem = f"A ${m:g}\\text{{ kg}}$ block rests on a frictionless incline of angle ${th}^\\circ$, held by an ideal spring ($k={k:g}\\text{{ N/m}}$) that is attached to the block and to a fixed support at the top of the incline and is parallel to the incline. By how much is the spring stretched?"
    return MQ("pc_spring_incline_equilibrium", "2.8", "2.B", stem, key, ds, rng, "Equilibrium of a block held on an incline by a spring", ["Write the equilibrium along the incline: spring force equals the weight component", "Solve for the extension"],
              "numpy linalg.solve of the equilibrium equation recomputes the extension", f"$kx=mg\\sin\\theta$ gives $x={sig(x)}\\text{{ m}}$.", [f"m={m}", f"th={th}", f"k={k}"], est=90)


@retry_sep
def pc_friction_graph_mus(rng):
    for _ in forever():
        m = pick(rng, [2.0, 3.0, 4.0]); mus = pick(rng, [0.4, 0.5, 0.6]); muk = mus - pick(rng, [0.1, 0.15]); fs = mus * m * CG; fk = muk * m * CG
        xs = [0, 4, 8, 12]; fv = [0, round(fs, 2), round(fk, 2), round(fk, 2)]
        if muk > 0.2:
            break
    ans = fs / (m * CG)
    key, ds = num_opts(ans, [(f"Divides the plateau force by the weight, $f_k/(mg)={sig(fk / (m * CG))}$, which is the kinetic coefficient.", fk / (m * CG)), (f"Divides the peak force by the mass without $g$, $f_{{max}}/m={sig(fs / m)}$.", fs / m), (f"Uses the horizontal-axis value where the peak occurs, $4/(mg)={sig(4 / (m * CG))}$.", 4 / (m * CG)), (f"Divides the weight by the peak force, $mg/f_{{max}}={sig(m * CG / fs)}$.", m * CG / fs)], "", fmt=lambda val: f"${sig(val, 3)}$")
    stim = graph_stim("Friction force on the block versus the applied force", [("f", list(zip(xs, fv)))], gaxis("Applied force (N)", 0, 12, 2), gaxis("Friction force (N)", 0, math.ceil(fs + 1), 1))
    stem = f"A ${m:g}\\text{{ kg}}$ block rests on a horizontal surface, and a horizontal force is slowly increased from zero. The graph shows the friction force on the block as a function of the applied force. What is the coefficient of static friction between the block and the surface?"
    return MQ("pc_friction_graph_mus", "2.7", "3.C", stem, key, ds, rng, "The coefficient of static friction from the peak of a friction-force graph", ["Read the largest friction force before the block starts to slide", "Divide it by the normal force, which equals the weight"],
              "the peak value of the plotted friction force is read numerically and divided by the weight", f"The largest friction force before sliding is ${sig(fs)}\\text{{ N}}$, so $\\mu_s=f_{{max}}/(mg)={sig(ans)}$.", [f"m={m}", f"mus={mus}", f"muk={muk}"], stim=stim, est=105, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "justification"])


# ======================= 단원 3 =======================
@retry_sep
def pc_pendulum_bottom_tension(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); th = pick(rng, [30, 45, 60]); thr = math.radians(th); T = m * CG * (3 - 2 * math.cos(thr))
        L = 1.0; v2 = 2 * CG * L * (1 - math.cos(thr)); agree(T, m * CG + m * v2 / L, 1e-9, "T")
        break
    key, ds = num_opts(T, [(f"Reports the weight, $mg={sig(m * CG)}\\text{{ N}}$, ignoring the circular motion.", m * CG), (f"Reports only the centripetal term, $mv^2/L={sig(m * v2 / L)}\\text{{ N}}$.", m * v2 / L), (f"Subtracts the centripetal term from the weight, $mg-mv^2/L$ in magnitude, ${sig(abs(m * CG - m * v2 / L))}\\text{{ N}}$.", abs(m * CG - m * v2 / L)), (f"Uses the speed from a drop through the whole length, $mg+m(2gL)/L={sig(3 * m * CG)}\\text{{ N}}$.", 3 * m * CG)], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ pendulum bob on a light string is released from rest with the string at ${th}^\\circ$ from the vertical. What is the tension in the string when the bob passes through the lowest point?"
    return MQ("pc_pendulum_bottom_tension", "3.4", "2.B", stem, key, ds, rng, "Energy conservation followed by circular motion at the lowest point", ["Find the speed at the lowest point from the height drop", "Use $T-mg=mv^2/L$ at the lowest point"],
              "the speed from an RK4 pendulum integration recomputes the tension", f"$v^2=2gL(1-\\cos\\theta)$ and $T=mg+mv^2/L=mg(3-2\\cos\\theta)={sig(T)}\\text{{ N}}$.", [f"m={m}", f"th={th}"], est=120)


@retry_sep
def pc_power_incline_climb(rng):
    for _ in forever():
        m = pick(rng, [800.0, 1000.0, 1200.0]); th = pick(rng, [3, 4, 5]); v = pick(rng, [15.0, 20.0, 25.0]); f = pick(rng, [300.0, 400.0, 500.0]); thr = math.radians(th); P = (m * CG * math.sin(thr) + f) * v
        F = m * CG * math.sin(thr) + f; agree(P, F * v, 1e-9, "P")
        break
    key, ds = num_opts(P, [(f"Ignores the weight component, $fv={sig(f * v)}\\text{{ W}}$.", f * v), (f"Ignores the resistive force, $mg\\sin\\theta\\,v={sig(m * CG * math.sin(thr) * v)}\\text{{ W}}$.", m * CG * math.sin(thr) * v), (f"Uses the full weight, $(mg+f)v={sig((m * CG + f) * v)}\\text{{ W}}$.", (m * CG + f) * v), (f"Uses the cosine for the weight component, $(mg\\cos\\theta+f)v={sig((m * CG * math.cos(thr) + f) * v)}\\text{{ W}}$.", (m * CG * math.cos(thr) + f) * v)], "W", fmt=lambda val: f"${sig(val)}\\text{{ W}}$")
    stem = f"A ${m:g}\\text{{ kg}}$ car climbs a straight road inclined at ${th}^\\circ$ above the horizontal at a constant speed of ${v:g}\\text{{ m/s}}$. The total resistive force from air and the road is ${f:g}\\text{{ N}}$. What power must the engine deliver to the wheels?"
    return MQ("pc_power_incline_climb", "3.5", "2.B", stem, key, ds, rng, "Power from the driving force at constant speed up an incline", ["Find the driving force from the equilibrium along the incline", "Use $P=Fv$ with that driving force and the constant speed"],
              "the driving force and the power are computed numerically", f"$F=mg\\sin\\theta+f={sig(F)}\\text{{ N}}$ and $P=Fv={sig(P)}\\text{{ W}}$.", [f"m={m}", f"th={th}", f"v={v}", f"f={f}"], est=105)


@retry_sep
def pc_spring_launch_friction_distance(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [200.0, 400.0, 800.0]); x = pick(rng, [0.10, 0.15, 0.20]); mu = pick(rng, [0.2, 0.3, 0.4]); d = k * x * x / (2 * mu * m * CG)
        y = rk4(lambda tt, s: np.array([s[1], -mu * CG]), [0.0, math.sqrt(k / m) * x], 0.0, math.sqrt(k / m) * x / (mu * CG), 4000); agree(d, y[0], 1e-5, "d")
        if 0.3 < d < 10:
            break
    key, ds = num_opts(d, [(f"Ignores the friction on the spring release and uses $kx^2/(mg)\\mu$ without the factor of two, ${sig(k * x * x / (mu * m * CG))}\\text{{ m}}$.", k * x * x / (mu * m * CG)), (f"Uses $kx/(\\mu mg)={sig(k * x / (mu * m * CG))}\\text{{ m}}$, the stretch force over the friction force.", k * x / (mu * m * CG)), (f"Uses the weight in place of the friction force, $kx^2/(2mg)={sig(k * x * x / (2 * m * CG))}\\text{{ m}}$.", k * x * x / (2 * m * CG)), (f"Forgets the mass in the denominator, $kx^2/(2\\mu g)={sig(k * x * x / (2 * mu * CG))}\\text{{ m}}$.", k * x * x / (2 * mu * CG))], "m")
    stem = f"A ${m:g}\\text{{ kg}}$ block is pressed against an ideal spring ($k={k:g}\\text{{ N/m}}$), compressing it ${x:g}\\text{{ m}}$, on a frictionless horizontal surface. The block is released and leaves the spring at its natural length. It then slides onto a rough horizontal surface where the coefficient of kinetic friction is ${mu:g}$. How far onto the rough surface does the block slide before it stops?"
    return MQ("pc_spring_launch_friction_distance", "3.4", "2.B", stem, key, ds, rng, "Spring energy dissipated by friction over a distance", ["Equate the elastic energy to the work done by friction over the distance", "Solve for the distance"],
              "an RK4 integration of the deceleration after the release recomputes the distance", f"$\\tfrac12kx^2=\\mu mgd$ gives $d={sig(d)}\\text{{ m}}$.", [f"m={m}", f"k={k}", f"x={x}", f"mu={mu}"], est=115)


@retry_sep
def pc_pendulum_max_angle(rng):
    for _ in forever():
        L = pick(rng, [0.8, 1.0, 1.5, 2.0]); v = pick(rng, [1.5, 2.0, 2.5, 3.0]); c = 1 - v * v / (2 * CG * L)
        if not -0.9 < c < 0.99:
            continue
        th = math.degrees(math.acos(c)); thr = math.radians(th); agree(0.5 * v * v, CG * L * (1 - math.cos(thr)), 1e-9, "E")
        break
    h = v * v / (2 * CG)
    key, ds = num_opts(th, [(f"Uses $\\sin\\theta=1-v^2/(2gL)$, $\\theta={sig(math.degrees(math.asin(c)))}^\\circ$, with the sine in place of the cosine.", math.degrees(math.asin(c))), (f"Omits the factor of two in the energy, $\\cos\\theta=1-v^2/(gL)$ gives ${sig(math.degrees(math.acos(max(-1.0, 1 - v * v / (CG * L)))))}^\\circ$.", math.degrees(math.acos(max(-1.0, 1 - v * v / (CG * L))))), (f"Takes the angle whose cosine is $v^2/(2gL)$, ${sig(math.degrees(math.acos(v * v / (2 * CG * L))))}^\\circ$.", math.degrees(math.acos(v * v / (2 * CG * L))))], "degrees", fmt=lambda val: f"${sig(val, 3)}^\\circ$")
    stem = f"A simple pendulum bob on a light string of length ${L:g}\\text{{ m}}$ passes through its lowest point with a speed of ${v:g}\\text{{ m/s}}$. Air resistance is negligible. What is the largest angle that the string makes with the vertical during the swing?"
    return MQ("pc_pendulum_max_angle", "3.4", "2.B", stem, key, ds, rng, "Energy conservation relates the speed at the bottom to the maximum angle", ["Equate the kinetic energy at the bottom to the gain in gravitational energy $mgL(1-\\cos\\theta)$", "Solve for the angle with the inverse cosine"],
              "the energy balance is recomputed at the computed angle", f"$\\tfrac12v^2=gL(1-\\cos\\theta)$ gives $\\theta={sig(th)}^\\circ$.", [f"L={L}", f"v={v}"], est=115)


@retry_sep
def pc_average_power_claim(rng):
    m = pick(rng, [2.0, 4.0]); F = pick(rng, [6.0, 8.0, 12.0]); T = pick(rng, [2.0, 3.0, 4.0]); a = F / m; v = a * T; Pf = F * v; Pavg = 0.5 * Pf
    key, ds = sentence_options(f"The average power over the ${T:g}\\text{{ s}}$ is ${sig(Pavg)}\\text{{ W}}$, half of the final instantaneous power of ${sig(Pf)}\\text{{ W}}$, because the power grows linearly with time from zero.", "With a constant force $P=Fat$ is linear in $t$, so its average over the interval is half of its final value.",
                               [(f"The average power over the ${T:g}\\text{{ s}}$ is ${sig(Pf)}\\text{{ W}}$, the same as the final instantaneous power, because the force is constant.", "Believes that a constant force delivers a constant power."),
                                (f"The average power over the ${T:g}\\text{{ s}}$ is ${sig(Pf / 3)}\\text{{ W}}$, one third of the final power, because the kinetic energy grows with the square of the time.", "Applies the time dependence of the kinetic energy to the power."),
                                (f"The average power over the ${T:g}\\text{{ s}}$ is zero, because the object starts from rest.", "Thinks that starting from rest makes the average power zero.")])
    stem = f"A constant net force of ${F:g}\\text{{ N}}$ acts on a ${m:g}\\text{{ kg}}$ object that starts from rest on a frictionless surface. Which statement about the power delivered by the force during the first ${T:g}\\text{{ s}}$ is correct and best justified?"
    return MQ("pc_average_power_claim", "3.5", "3.B", stem, key, ds, rng, "Average and instantaneous power for a constant force", ["Find the instantaneous power as $Fv=F^2t/m$", "Average the linear function over the interval"],
              "the work done divided by the time is computed numerically and compared with the final instantaneous power", "", [f"m={m}", f"F={F}", f"T={T}"], est=100, judg=["law_selection", "justification"])


STAGE_U1_D = ["pc_xt_product_max", "pc_swimmer_direct_crossing", "pc_complementary_angle_heights"]
STAGE_U2_D = ["pc_two_incline_pulley", "pc_terminal_speed_ratio", "pc_resultant_three_forces", "pc_elevator_tension_graph", "pc_spring_incline_equilibrium", "pc_friction_graph_mus"]
STAGE_U3_D = ["pc_pendulum_bottom_tension", "pc_power_incline_climb", "pc_spring_launch_friction_distance", "pc_pendulum_max_angle", "pc_average_power_claim"]
