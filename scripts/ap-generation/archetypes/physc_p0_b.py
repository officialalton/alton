"""AP Physics C: Mechanics 원형 B — 단원 2(힘과 병진 동역학: 변하는 힘, 저항력, 원운동, 질량 중심 적분)."""
from physc_common import *

t_ = sp.symbols("t", positive=True)
xx = sp.symbols("x", positive=True)


@retry_sep
def pc_atwood_tension(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = m1 + pick(rng, [1.0, 2.0, 3.0])
        T = 2 * m1 * m2 * CG / (m1 + m2)
        sol = np.linalg.solve(np.array([[1.0, -m1], [1.0, m2]]), np.array([m1 * CG, m2 * CG])); agree(T, sol[0], 1e-9, "T")
        break
    key, ds = num_opts(T, [("Uses the weight of the lighter block, $m_1g$, as the tension.", m1 * CG), ("Uses the weight of the heavier block, $m_2g$, as the tension.", m2 * CG), ("Averages the two weights, $(m_1+m_2)g/2$.", (m1 + m2) * CG / 2), ("Divides the net force by the sum of the masses, giving the acceleration instead of the tension.", (m2 - m1) * CG / (m1 + m2))], "N")
    stem = f"Two blocks of masses ${m1:g}\\text{{ kg}}$ and ${m2:g}\\text{{ kg}}$ hang from the ends of a light string over a light, frictionless pulley and are released from rest. What is the tension in the string while the blocks move?"
    return MQ("pc_atwood_tension", "2.5", "2.B", stem, key, ds, rng, "Newton's second law applied to each body of a connected system", ["Write Newton's second law for each block with the same tension and acceleration magnitude", "Eliminate the acceleration to find the tension"],
              "sympy solves the two equations; numpy linalg.solve recomputes the tension", f"$a=(m_2-m_1)g/(m_1+m_2)$ and $T=2m_1m_2g/(m_1+m_2)={sig(T)}\\text{{ N}}$.", [f"m1={m1}", f"m2={m2}"], est=100)


@retry_sep
def pc_incline_friction_accel(rng):
    for _ in forever():
        th = pick(rng, [30, 37, 40, 45, 53]); mu = pick(rng, [0.10, 0.20, 0.25, 0.30])
        thr = math.radians(th); a = CG * (math.sin(thr) - mu * math.cos(thr))
        gv = np.array([0.0, -CG]); u = np.array([math.cos(thr), -math.sin(thr)]); n = np.array([math.sin(thr), math.cos(thr)])
        a2 = float(gv @ u) - mu * float(-gv @ n); agree(a, a2, 1e-9, "a")
        if a > 0.8:
            break
    key, ds = num_opts(a, [("Ignores friction, $g\\sin\\theta$.", CG * math.sin(thr)), ("Uses the cosine for the weight component along the incline, $g(\\cos\\theta-\\mu\\sin\\theta)$.", CG * (math.cos(thr) - mu * math.sin(thr))),
                           ("Adds friction to the weight component, $g(\\sin\\theta+\\mu\\cos\\theta)$.", CG * (math.sin(thr) + mu * math.cos(thr))), ("Uses $\\mu g$ without the angle for the friction term, $g\\sin\\theta-\\mu g$.", CG * (math.sin(thr) - mu))], "m/s^2")
    stem = f"A block slides down an incline of angle ${th}^\\circ$ above the horizontal. The coefficient of kinetic friction between the block and the incline is ${mu:.2f}$. What is the magnitude of the acceleration of the block?"
    return MQ("pc_incline_friction_accel", "2.7", "2.B", stem, key, ds, rng, "Components of the weight and kinetic friction on an incline", ["Resolve the weight along and perpendicular to the incline", "Use the normal force to find kinetic friction, then Newton's second law along the incline"],
              "components of the force vectors are rotated and summed numerically", f"$N=mg\\cos\\theta$ and $a=g(\\sin\\theta-\\mu\\cos\\theta)={sig(a)}\\text{{ m/s}}^2$.", [f"th={th}", f"mu={mu}"], est=110)


@retry_sep
def pc_contact_force_blocks(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [2.0, 4.0, 6.0]); F = pick(rng, [12.0, 18.0, 24.0, 30.0])
        N = F * m2 / (m1 + m2)
        sol = np.linalg.solve(np.array([[m1, 1.0], [m2, -1.0]]), np.array([F, 0.0])); agree(N, sol[1], 1e-9, "N")
        if abs(m1 - m2) > 0.5:
            break
    key, ds = num_opts(N, [("Assumes the contact force equals the applied force, $F$.", F), ("Uses the fraction of the first block, $Fm_1/(m_1+m_2)$.", F * m1 / (m1 + m2)), ("Divides the force evenly between the blocks, $F/2$.", F / 2), ("Computes the acceleration of the pair instead of the contact force.", F / (m1 + m2))], "N")
    stem = f"A horizontal force of ${F:g}\\text{{ N}}$ pushes a ${m1:g}\\text{{ kg}}$ block that touches a ${m2:g}\\text{{ kg}}$ block, so that both blocks move together on a frictionless surface. The force is applied to the ${m1:g}\\text{{ kg}}$ block. What is the magnitude of the force that the ${m1:g}\\text{{ kg}}$ block exerts on the ${m2:g}\\text{{ kg}}$ block?"
    return MQ("pc_contact_force_blocks", "2.5", "2.B", stem, key, ds, rng, "Contact force between accelerating bodies", ["Find the common acceleration of the system", "Apply Newton's second law to the second block alone"],
              "numpy linalg.solve of the two Newton equations recomputes the contact force", f"$a=F/(m_1+m_2)$ and $N=m_2a={sig(N)}\\text{{ N}}$.", [f"m1={m1}", f"m2={m2}", f"F={F}"], est=90)


@retry_sep
def pc_force_time_poly_velocity(rng):
    for _ in forever():
        c = pick(rng, [2.0, 3.0, 4.0, 6.0]); m = pick(rng, [1.0, 2.0, 3.0]); T = pick(rng, [2.0, 3.0, 4.0])
        v = c * T ** 2 / (2 * m)
        y = rk4(lambda tt, s: np.array([c * tt / m]), [0.0], 0.0, T, 4000); agree(v, y[0], 1e-6, "v")
        if v > 2:
            break
    key, ds = num_opts(v, [("Treats the final force as constant, $v=cT\\cdot T/m$.", c * T * T / m), ("Integrates the force but forgets to divide by the mass.", c * T ** 2 / 2), ("Divides the time by two but not the force, $v=cT/(2m)$.", c * T / (2 * m)), ("Integrates twice, giving the displacement-type term $cT^3/(6m)$.", c * T ** 3 / (6 * m))], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ object starts from rest on a frictionless horizontal surface. A net force in the direction of motion has magnitude $F(t)={c:g}t$, where $F$ is in newtons and $t$ is in seconds. What is the speed of the object at $t={T:g}\\text{{ s}}$?"
    return MQ("pc_force_time_poly_velocity", "2.5", "2.B", stem, key, ds, rng, "Newton's second law with a time-dependent force", ["Write the acceleration as the force divided by the mass", "Integrate the acceleration over time from rest"],
              "an RK4 integration of the acceleration recomputes the speed", f"$v=\\int_0^T (ct/m)\\,dt=cT^2/(2m)={sig(v)}\\text{{ m/s}}$.", [f"c={c}", f"m={m}", f"T={T}"], est=95)


@retry_sep
def pc_drag_linear_terminal(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0, 4.0]); b = pick(rng, [0.5, 1.0, 2.0, 4.0]); vt = m * CG / b
        y = rk4(lambda tt, s: np.array([CG - b * s[0] / m]), [0.0], 0.0, 20 * m / b, 20000); agree(vt, y[0], 1e-5, "vt")
        if 3 < vt < 60:
            break
    key, ds = num_opts(vt, [("Divides the drag coefficient by the weight, $b/(mg)$.", b / (m * CG)), ("Uses the weight alone, $mg$, as a speed.", m * CG), ("Takes the square root as for quadratic drag, $\\sqrt{mg/b}$.", math.sqrt(m * CG / b)), ("Multiplies the mass by the drag coefficient, $mb$.", m * b)], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ object falls from rest in a fluid that exerts a drag force of magnitude $bv$ opposing the motion, with $b={b:g}\\text{{ kg/s}}$. What is the terminal speed of the object?"
    return MQ("pc_drag_linear_terminal", "2.9", "2.B", stem, key, ds, rng, "Terminal speed when the net force is zero under linear drag", ["Set the net force to zero when the drag equals the weight", "Solve for the speed"],
              "an RK4 integration of $m\\,dv/dt=mg-bv$ over many time constants reaches the same speed", f"$mg=bv_t$ gives $v_t=mg/b={sig(vt)}\\text{{ m/s}}$.", [f"m={m}", f"b={b}"], est=80)


@retry_sep
def pc_drag_linear_scaling(rng):
    k = pick(rng, [2, 3, 4]); which = rng.randrange(2)
    if which == 0:
        ans = float(k); stem = f"An object falls through a fluid that exerts a drag force $bv$. The mass of the object is multiplied by ${k}$ while $b$ stays the same. By what factor does the terminal speed change?"; why = f"$v_t=mg/b$ is proportional to $m$, so the terminal speed is multiplied by ${k}$."
    else:
        ans = 1.0 / k; stem = f"An object falls through a fluid that exerts a drag force $bv$. The drag coefficient $b$ is multiplied by ${k}$ while the mass stays the same. By what factor does the terminal speed change?"; why = f"$v_t=mg/b$ is inversely proportional to $b$, so the terminal speed is multiplied by $1/{k}$."
    vt0 = lambda m, b: m * CG / b  # noqa: E731
    agree(vt0(k, 1) / vt0(1, 1) if which == 0 else vt0(1, k) / vt0(1, 1), ans, 1e-9, "factor")
    wr = [("Squares the factor, treating the terminal speed as proportional to the square of the quantity.", float(k * k) if which == 0 else 1.0 / (k * k)), ("Reports no change, because every object falls at the same acceleration.", 1.0), ("Uses the inverse factor, reversing the dependence.", 1.0 / k if which == 0 else float(k)),
          ("Uses the square root of the factor, as for quadratic drag.", math.sqrt(k) if which == 0 else 1 / math.sqrt(k))]
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    return MQ("pc_drag_linear_scaling", "2.9", "2.D", stem, key, ds, rng, "Scaling of terminal speed with mass and the drag coefficient", ["Write the terminal speed as a function of the mass and $b$", "Apply the stated factor to the dependence"],
              "the terminal speed formula is evaluated numerically at the original and changed values", why, [f"k={k}", f"which={which}"], est=70, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_sym_quadratic_terminal(rng):
    m = pick(rng, [1.0, 2.0, 3.0]); c = pick(rng, [0.2, 0.5, 0.8])
    vt = math.sqrt(m * CG / c)
    y = rk4(lambda tt, s: np.array([CG - c * s[0] ** 2 / m]), [0.0], 0.0, 40.0, 20000); agree(vt, y[0], 1e-4, "vt")
    key, ds = sym_opts("\\sqrt{\\frac{mg}{c}}", vt, [("Omits the square root, $mg/c$.", "\\frac{mg}{c}"), ("Inverts the ratio, $\\sqrt{c/(mg)}$.", "\\sqrt{\\frac{c}{mg}}"), ("Forgets the gravitational acceleration, $\\sqrt{m/c}$.", "\\sqrt{\\frac{m}{c}}"), ("Uses $\\sqrt{2mg/c}$, which comes from an incorrect factor of two.", "\\sqrt{\\frac{2mg}{c}}")], {"m": m, "g": CG, "c": c})
    stem = "An object of mass $m$ falls through air that exerts a drag force of magnitude $cv^2$ opposing the motion, where $c$ is a constant. Which expression gives the terminal speed of the object?"
    return MQ("pc_sym_quadratic_terminal", "2.9", "2.A", stem, key, ds, rng, "Terminal speed under quadratic drag", ["Set the weight equal to the drag force", "Solve for the speed"],
              "an RK4 integration of the equation of motion converges to the value of each option evaluated with the same constants", "$mg=cv_t^2$ gives $v_t=\\sqrt{mg/c}$.", [f"m={m}", f"c={c}"], est=70, judg=["symbolic_reasoning"])


@retry_sep
def pc_drag_exp_speed(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); b = pick(rng, [0.5, 1.0, 2.0]); n = pick(rng, [1, 2]); vt = m * CG / b; tau = m / b
        v = vt * (1 - math.exp(-n)); y = rk4(lambda tt, s: np.array([CG - b * s[0] / m]), [0.0], 0.0, n * tau, 20000); agree(v, y[0], 1e-6, "v")
        break
    key, ds = num_opts(v, [(f"Uses the terminal speed itself, ${sig(vt)}\\text{{ m/s}}$, as if it were reached after {n} time constant{'s' if n > 1 else ''}.", vt), (f"Uses the factor $1-e^{{-{n}/2}}$, as if the time constant were twice as long.", vt * (1 - math.exp(-n / 2))),
                           (f"Uses $v_te^{{-{n}}}$, the fraction that remains instead of the fraction gained.", vt * math.exp(-n)), (f"Applies the constant acceleration $g$ for the stated time, $g({n}\\tau)$ with $\\tau={tau:g}\\text{{ s}}$, ignoring the drag.", CG * n * tau)], "m/s")
    stem = f"An object of mass ${m:g}\\text{{ kg}}$ is released from rest in a fluid with drag force $bv$, $b={b:g}\\text{{ kg/s}}$. Its speed is $v(t)=v_t\\left(1-e^{{-t/\\tau}}\\right)$ with $v_t=mg/b$ and $\\tau=m/b$. What is the speed at $t={n}\\tau$?"
    return MQ("pc_drag_exp_speed", "2.9", "2.B", stem, key, ds, rng, "Evaluating the exponential approach to terminal speed", ["Compute the terminal speed from the mass and the drag coefficient", "Evaluate the exponential factor at the stated multiple of the time constant"],
              "an RK4 integration of $m\\,dv/dt=mg-bv$ recomputes the speed at that time", f"$v_t={sig(vt)}\\text{{ m/s}}$ and $v=v_t(1-e^{{-{n}}})={sig(v)}\\text{{ m/s}}$.", [f"m={m}", f"b={b}", f"n={n}"], est=100)


@retry_sep
def pc_flat_curve_mu(rng):
    for _ in forever():
        v = pick(rng, [8.0, 10.0, 12.0, 15.0, 20.0]); r = pick(rng, [20.0, 30.0, 40.0, 50.0, 80.0]); mu = v * v / (CG * r)
        sol = bisect(lambda m_: m_ * CG - v * v / r, 0.0, 5.0); agree(mu, sol, 1e-9, "mu")
        if 0.1 < mu < 1.0:
            break
    key, ds = num_opts(mu, [("Omits the square of the speed, $v/(gr)$.", v / (CG * r)), ("Uses $v^2/r$ without dividing by $g$.", v * v / r), ("Divides by the speed squared instead of multiplying, $gr/v^2$.", CG * r / (v * v)), ("Uses the diameter instead of the radius in the denominator, $v^2/(2gr)$.", v * v / (2 * CG * r))], "", fmt=lambda x: f"${sig(x, 3)}$")
    stem = f"A car rounds a flat, circular curve of radius ${r:g}\\text{{ m}}$ at a constant speed of ${v:g}\\text{{ m/s}}$. What is the minimum coefficient of static friction between the tires and the road that allows the car to stay on the curve?"
    return MQ("pc_flat_curve_mu", "2.10", "2.B", stem, key, ds, rng, "Static friction supplies the centripetal force on a flat curve", ["Identify static friction as the only horizontal force", "Set the maximum friction equal to the centripetal force"],
              "a bisection root finder on the force balance recomputes the coefficient", f"$\\mu mg=mv^2/r$ gives $\\mu=v^2/(gr)={sig(mu)}$.", [f"v={v}", f"r={r}"], est=85)


@retry_sep
def pc_vertical_circle_top_tension(rng):
    for _ in forever():
        m = pick(rng, [0.2, 0.5, 1.0]); r = pick(rng, [0.5, 1.0, 1.5]); v = pick(rng, [4.0, 5.0, 6.0, 7.0])
        T = m * v * v / r - m * CG
        s = np.array([[1.0]]); Tn = float(np.linalg.solve(s, np.array([m * v * v / r - m * CG]))[0]); agree(T, Tn, 1e-9, "T")
        if T > 1.0:
            break
    key, ds = num_opts(T, [("Adds the weight to the centripetal term at the top, $mv^2/r+mg$.", m * v * v / r + m * CG), ("Ignores the weight, $mv^2/r$.", m * v * v / r), ("Reports only the weight, $mg$.", m * CG), ("Uses $v^2/r-g$ without the mass.", v * v / r - CG)], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ ball on a light string moves in a vertical circle of radius ${r:g}\\text{{ m}}$. At the top of the circle its speed is ${v:g}\\text{{ m/s}}$. What is the tension in the string at the top?"
    return MQ("pc_vertical_circle_top_tension", "2.10", "2.B", stem, key, ds, rng, "Tension and weight together provide the centripetal force", ["Draw both forces pointing toward the center at the top", "Set their sum equal to the centripetal force and solve for the tension"],
              "the net inward force is computed from the force vectors and compared with mv^2/r", f"$T+mg=mv^2/r$ gives $T={sig(T)}\\text{{ N}}$.", [f"m={m}", f"r={r}", f"v={v}"], est=95)


@retry_sep
def pc_circular_scaling(rng):
    k = pick(rng, [2, 3]); which = rng.randrange(2)
    if which == 0:
        ans = float(k * k); stem = f"A car rounds a flat curve of fixed radius. The speed of the car is multiplied by ${k}$. By what factor does the required centripetal force change?"; why = f"$F=mv^2/r$ is proportional to $v^2$, so the force is multiplied by ${k * k}$."
        wr = [(f"Multiplies the force by ${k}$, treating the centripetal force as directly proportional to the speed.", float(k)), ("Leaves the force unchanged, because the mass and the radius of the curve are unchanged.", 1.0), (f"Multiplies the force by ${k ** 3}$, cubing the speed factor.", float(k ** 3)), (f"Multiplies the force by $1/{k}$, as if a faster car needed less force to turn.", 1.0 / k)]
    else:
        ans = 1.0 / k; stem = f"A car rounds a flat curve at a fixed speed. The radius of the curve is multiplied by ${k}$. By what factor does the required centripetal force change?"; why = f"$F=mv^2/r$ is inversely proportional to $r$, so the force is multiplied by $1/{k}$."
        wr = [(f"Multiplies the force by ${k}$, treating the force as directly proportional to the radius.", float(k)), ("Leaves the force unchanged, because the speed and the mass are unchanged.", 1.0), (f"Multiplies the force by $1/{k * k}$, squaring the radius dependence as if $F=mv^2/r^2$.", 1.0 / (k * k)), (f"Multiplies the force by ${k * k}$, using the square of the radius in the numerator.", float(k * k))]
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    return MQ("pc_circular_scaling", "2.10", "2.D", stem, key, ds, rng, "Scaling of the centripetal force with speed and radius", ["Write the centripetal force as a function of speed and radius", "Apply the factor using the power in that relation"],
              "the force is evaluated numerically for the original and the changed values", why, [f"k={k}", f"which={which}"], est=70, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_spring_added_mass(rng):
    for _ in forever():
        k = pick(rng, [50.0, 100.0, 200.0, 400.0]); m1 = pick(rng, [0.5, 1.0, 2.0]); m2 = pick(rng, [0.5, 1.0, 1.5])
        x1 = m1 * CG / k; x2 = (m1 + m2) * CG / k; dx = x2 - x1
        agree(dx, m2 * CG / k, 1e-9, "dx")
        if dx > 0.005:
            break
    key, ds = num_opts(dx, [("Uses the total mass for the extra stretch, $(m_1+m_2)g/k$.", x2), ("Uses only the original mass, $m_1g/k$.", x1), ("Divides by $g$ instead of multiplying, $m_2/(kg)$.", m2 / (k * CG)), ("Multiplies by the spring constant instead of dividing, $m_2gk$.", m2 * CG * k)], "m")
    stem = f"A ${m1:g}\\text{{ kg}}$ block hangs at rest from a vertical ideal spring with spring constant ${k:g}\\text{{ N/m}}$. An additional ${m2:g}\\text{{ kg}}$ is attached to the block and the system comes to rest again. By how much does the spring stretch further?"
    return MQ("pc_spring_added_mass", "2.8", "2.B", stem, key, ds, rng, "Equilibrium of a hanging mass on a Hooke's-law spring", ["Write the equilibrium condition before and after the added mass", "Subtract the two extensions"],
              "the two equilibrium extensions are computed separately and subtracted", f"The extra extension is $m_2g/k={sig(dx)}\\text{{ m}}$.", [f"k={k}", f"m1={m1}", f"m2={m2}"], est=90)


@retry_sep
def pc_elevator_scale(rng):
    for _ in forever():
        m = pick(rng, [40.0, 50.0, 60.0, 75.0]); a = pick(rng, [1.0, 1.5, 2.0, 2.5]); up = rng.randrange(2)
        N = m * (CG + a) if up else m * (CG - a)
        Nn = float(np.linalg.solve(np.array([[1.0]]), np.array([m * ((a if up else -a)) + m * CG]))[0]); agree(N, Nn, 1e-9, "N")
        break
    d = "upward" if up else "downward"
    key, ds = num_opts(N, [(f"Uses the weight $mg={sig(m * CG)}\\text{{ N}}$ and ignores the acceleration.", m * CG), (f"Gets the sign of the acceleration term wrong, $m(g{'-' if up else '+'}a)$ instead of $m(g{'+' if up else '-'}a)$.", m * (CG - a) if up else m * (CG + a)), (f"Reports the net force $ma={sig(m * a)}\\text{{ N}}$ as the reading.", m * a), (f"Counts the acceleration twice, $m(g{'+' if up else '-'}2a)$.", m * (CG + 2 * a) if up else m * (CG - 2 * a))], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ person stands on a scale in an elevator that is {'speeding up while moving up' if up else 'speeding up while moving down'} with acceleration ${a:g}\\text{{ m/s}}^2$. What is the reading of the scale?"
    return MQ("pc_elevator_scale", "2.5", "2.B", stem, key, ds, rng, "Apparent weight from Newton's second law", ["Draw the normal force and the weight on the person", "Write the net force with the acceleration direction and solve for the normal force"],
              "a linear solve of Newton's second law recomputes the normal force", f"The acceleration points {d}, so $N={'m(g+a)' if up else 'm(g-a)'}={sig(N)}\\text{{ N}}$.", [f"m={m}", f"a={a}", f"up={up}"], est=90)


@retry_sep
def pc_static_friction_claim(rng):
    for _ in forever():
        th = pick(rng, [20, 25, 30]); m = pick(rng, [1.0, 2.0, 3.0]); mus = pick(rng, [0.5, 0.6, 0.7])
        f = m * CG * math.sin(math.radians(th)); fmax = mus * m * CG * math.cos(math.radians(th))
        if f < fmax * 0.92:
            break
    key, ds = sentence_options(f"The friction force is ${sig(f)}\\text{{ N}}$ up the incline, because at rest it equals the weight component along the incline.", "At rest the net force is zero, so $f_s=mg\\sin\\theta$; the maximum $\\mu_sN$ is only an upper limit.",
                               [(f"The friction force is ${sig(fmax)}\\text{{ N}}$ up the incline, because static friction always equals its maximum value $\\mu_s N$ whenever a block touches the surface.", "Uses the maximum static friction as the actual friction force."),
                                (f"The friction force is zero, because the block is not moving relative to the incline at all.", "Believes a block at rest experiences no friction."),
                                (f"The friction force is ${sig(f)}\\text{{ N}}$ directed down the incline, because friction always points along the direction in which the block would otherwise move.", "Gets the direction of static friction backward.")])
    stem = f"A ${m:g}\\text{{ kg}}$ block rests on a rough incline at ${th}^\\circ$ above the horizontal. The coefficient of static friction is ${mus:g}$, and the block does not slide. Which statement about the friction force on the block is correct and best justified?"
    return MQ("pc_static_friction_claim", "2.7", "3.B", stem, key, ds, rng, "Static friction matches the applied tendency up to a maximum", ["Write the equilibrium condition along the incline", "Compare the needed friction with the maximum static friction"],
              "the equilibrium friction and the maximum static friction are computed and compared numerically", "", [f"th={th}", f"m={m}", f"mus={mus}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pc_newton3_claim(rng):
    m1 = pick(rng, [1500, 2000, 3000]); m2 = pick(rng, [800, 1000, 1200])
    key, ds = sentence_options("The two cars exert forces of equal magnitude on each other, because they form a third-law pair, and the lighter car accelerates more.", "Third-law pairs are equal in magnitude and opposite in direction; $a=F/m$ then makes the lighter car's acceleration larger.",
                               [("The heavier car exerts a larger force on the lighter car, because it has more mass, and so the lighter car accelerates more.", "Believes the more massive object exerts the larger force in a collision."),
                                ("The faster car exerts a larger force on the slower car, because it has more momentum, and so both cars accelerate equally.", "Believes the force depends on which object has more momentum, and that unequal forces give equal accelerations."),
                                ("The two cars exert forces of equal magnitude, because they form a third-law pair, and both cars accelerate equally.", "Equal forces do not imply equal accelerations when the masses differ.")])
    stem = f"A ${m1}\\text{{ kg}}$ car and a ${m2}\\text{{ kg}}$ car have a head-on collision. Which statement about the forces and the accelerations during the collision is correct and best justified?"
    return MQ("pc_newton3_claim", "2.3", "3.B", stem, key, ds, rng, "Newton's third law pairs and the accelerations they produce", ["Identify the interaction pair and compare the magnitudes", "Use $a=F/m$ to compare the accelerations"],
              "the accelerations from equal forces are computed numerically to confirm that the lighter car accelerates more", "", [f"m1={m1}", f"m2={m2}"], est=85, judg=["law_selection", "justification"])


@retry_sep
def pc_two_strings_tension(rng):
    for _ in forever():
        m = pick(rng, [2.0, 3.0, 4.0, 5.0]); th = pick(rng, [20, 25, 30, 35, 40])
        T = m * CG / (2 * math.sin(math.radians(th)))
        A = np.array([[-math.cos(math.radians(th)), math.cos(math.radians(th))], [math.sin(math.radians(th)), math.sin(math.radians(th))]]); sol = np.linalg.solve(A, np.array([0.0, m * CG])); agree(T, sol[0], 1e-9, "T")
        break
    thr = math.radians(th)
    key, ds = num_opts(T, [("Uses the cosine, $mg/(2\\cos\\theta)$, for the vertical component.", m * CG / (2 * math.cos(thr))), ("Ignores the angle, $mg/2$.", m * CG / 2), ("Omits the factor of two, $mg/\\sin\\theta$.", m * CG / math.sin(thr)), ("Uses $mg\\sin\\theta/2$ with the sine multiplying instead of dividing.", m * CG * math.sin(thr) / 2)], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ lamp hangs at rest from two identical light strings. Each string makes an angle of ${th}^\\circ$ with the horizontal ceiling. What is the tension in each string?"
    return MQ("pc_two_strings_tension", "2.4", "2.B", stem, key, ds, rng, "Translational equilibrium with force components", ["Resolve each tension into vertical and horizontal components", "Set the vertical components equal to the weight"],
              "numpy linalg.solve of the two equilibrium equations recomputes the tensions", f"$2T\\sin\\theta=mg$ gives $T={sig(T)}\\text{{ N}}$.", [f"m={m}", f"th={th}"], est=100)


@retry_sep
def pc_com_discrete(rng):
    for _ in forever():
        ms = [pick(rng, [1.0, 2.0, 3.0, 4.0]) for _ in range(3)]; xs = sorted(rng.sample([0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 3))
        xc = sum(m * x for m, x in zip(ms, xs)) / sum(ms)
        agree(xc, float(np.average(xs, weights=ms)), 1e-9, "xc")
        if ms.count(max(ms)) == 1 and abs(xc - sum(xs) / 3) > 0.3:
            break
    key, ds = num_opts(xc, [("Takes the simple average of the positions, ignoring the masses.", sum(xs) / 3), ("Divides the sum of $mx$ by 3, the number of masses, instead of by the total mass.", sum(m * x for m, x in zip(ms, xs)) / 3), (f"Uses the position of the most massive object, $x={xs[ms.index(max(ms))]:g}\\text{{ m}}$.", xs[ms.index(max(ms))]), ("Uses the midpoint of the two outermost objects.", (xs[0] + xs[2]) / 2)], "m")
    stem = f"Three small objects lie on the $x$-axis. Object 1 has mass ${ms[0]:g}\\text{{ kg}}$ at $x={xs[0]:g}\\text{{ m}}$, object 2 has mass ${ms[1]:g}\\text{{ kg}}$ at $x={xs[1]:g}\\text{{ m}}$, and object 3 has mass ${ms[2]:g}\\text{{ kg}}$ at $x={xs[2]:g}\\text{{ m}}$. What is the $x$-coordinate of the center of mass?"
    return MQ("pc_com_discrete", "2.1", "2.B", stem, key, ds, rng, "Center of mass as a mass-weighted average", ["Multiply each mass by its position and add", "Divide by the total mass"],
              "numpy weighted average recomputes the center of mass", f"$x_{{cm}}=\\sum m_ix_i/\\sum m_i={sig(xc)}\\text{{ m}}$.", [f"ms={ms}", f"xs={xs}"], est=80)


@retry_sep
def pc_com_rod_nonuniform(rng):
    for _ in forever():
        n = pick(rng, [1, 2, 3]); L = pick(rng, [1.0, 2.0, 3.0, 4.0])
        xcm = (n + 1) / (n + 2) * L
        agree(xcm, simpson(lambda s: s ** (n + 1), 0, L) / simpson(lambda s: s ** n, 0, L), 1e-6, "xcm")
        break
    key, ds = num_opts(xcm, [("Uses the geometric center of the rod, $L/2$.", L / 2), ("Uses $(n+2)/(n+3)$ times $L$, the result for a density with an exponent one larger.", (n + 2) / (n + 3) * L), ("Uses the end of the rod, $L$.", L), (f"Uses the exponent of the density instead of the exponent plus one, $n/(n+1)\\,L$.", n / (n + 1) * L)], "m")
    stem = f"A thin rod of length ${L:g}\\text{{ m}}$ lies along the $x$-axis from $x=0$ to $x=L$. Its linear mass density is $\\lambda(x)=\\lambda_0 x^{{{n}}}$, where $\\lambda_0$ is a constant. What is the $x$-coordinate of the center of mass of the rod?"
    return MQ("pc_com_rod_nonuniform", "2.1", "2.B", stem, key, ds, rng, "Center of mass of a continuous object by integration", ["Write $dm=\\lambda\\,dx$", "Compute $x_{cm}=\\int x\\,dm/\\int dm$"],
              "sympy integrals versus a Simpson integration of the same two integrals", f"$x_{{cm}}=\\int_0^L x^{{{n + 1}}}dx\\Big/\\int_0^L x^{{{n}}}dx=\\frac{{{n + 1}}}{{{n + 2}}}L={sig(xcm)}\\text{{ m}}$.", [f"n={n}", f"L={L}"], est=100)


@retry_sep
def pc_gravity_altitude(rng):
    k = pick(rng, [1, 2, 3]); ans = 1.0 / (1 + k) ** 2
    g1 = lambda r: 1.0 / r ** 2  # noqa: E731
    agree(g1(1 + k) / g1(1), ans, 1e-9, "ratio")
    key, ds = num_opts(ans, [("Uses the inverse of the distance from the surface, $1/(1+k)$.", 1.0 / (1 + k)), ("Uses the inverse square of the height above the surface only, $1/k^2$.", 1.0 / k ** 2 if k > 1 else 0.5), ("Reports no change, because gravity is nearly constant.", 1.0), ("Uses the inverse cube of the distance.", 1.0 / (1 + k) ** 3)], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A spacecraft is at a height above Earth's surface equal to ${k}$ times the radius of Earth. What is the ratio of the gravitational field strength at the spacecraft to that at Earth's surface?"
    return MQ("pc_gravity_altitude", "2.6", "2.D", stem, key, ds, rng, "Inverse-square dependence of gravity on the distance from the center", ["Find the distance from the center of Earth in units of its radius", "Apply the inverse-square law"],
              "the field strength is evaluated numerically at the two distances", f"The distance from Earth's center is ${1 + k}R$, so the ratio is $1/{(1 + k) ** 2}$.", [f"k={k}"], est=70, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_sym_incline_accel(rng):
    th = pick(rng, [30, 37, 45, 53]); mu = pick(rng, [0.1, 0.2, 0.3]); thr = math.radians(th)
    a = CG * (math.sin(thr) - mu * math.cos(thr))
    gv = np.array([0.0, -CG]); u = np.array([math.cos(thr), -math.sin(thr)]); n = np.array([math.sin(thr), math.cos(thr)]); agree(a, float(gv @ u) - mu * float(-gv @ n), 1e-9, "a")
    env = {"g": CG, "theta": thr, "mu": mu}
    key, ds = sym_opts("g(\\sin\\theta-\\mu\\cos\\theta)", a, [("Ignores friction, $g\\sin\\theta$.", "g\\sin\\theta"), ("Adds the friction term, $g(\\sin\\theta+\\mu\\cos\\theta)$.", "g(\\sin\\theta+\\mu\\cos\\theta)"), ("Exchanges sine and cosine in the weight component, $g(\\cos\\theta-\\mu\\sin\\theta)$.", "g(\\cos\\theta-\\mu\\sin\\theta)"), ("Uses $\\mu g$ for the friction term, $g\\sin\\theta-\\mu g$.", "g\\sin\\theta-\\mu g")], env)
    stem = "A block slides down a rough incline that makes an angle $\\theta$ with the horizontal. The coefficient of kinetic friction is $\\mu$. Which expression gives the magnitude of the block's acceleration?"
    return MQ("pc_sym_incline_accel", "2.7", "2.A", stem, key, ds, rng, "Derive the acceleration on a rough incline symbolically", ["Resolve the weight along and perpendicular to the incline", "Combine Newton's second law along the incline with the kinetic friction relation"],
              "force vectors are rotated and summed numerically with the same angle and coefficient used to evaluate each option", "$ma=mg\\sin\\theta-\\mu mg\\cos\\theta$.", [f"th={th}", f"mu={mu}"], est=75, judg=["symbolic_reasoning"])


@retry_sep
def pc_incline_up_friction_claim(rng):
    th = pick(rng, [25, 30, 35]); v0 = pick(rng, [4.0, 5.0, 6.0]); mu = pick(rng, [0.2, 0.3])
    key, ds = sentence_options("Both the component of the weight along the incline and the kinetic friction force point down the incline, so the block slows down at a rate greater than $g\\sin\\theta$.", "Moving up, friction opposes the motion (down the slope) and so does the weight component.",
                               [("The kinetic friction points up the incline because the block is moving up, so the block slows down at a rate less than $g\\sin\\theta$.", "Takes friction to point along the direction of motion."),
                                ("The only force along the incline is the weight component, because kinetic friction acts only on blocks that slide down.", "Believes friction acts only for downward sliding."),
                                ("The net force along the incline is zero while the block moves up at constant speed, because friction balances the weight component.", "Applies equilibrium to a block that is slowing down.")])
    stem = f"A block is launched up a rough incline of angle ${th}^\\circ$ with an initial speed of ${v0:g}\\text{{ m/s}}$ and slides up with kinetic friction coefficient ${mu:g}$. Which statement about the forces along the incline while the block moves up is correct and best justified?"
    return MQ("pc_incline_up_friction_claim", "2.2", "3.B", stem, key, ds, rng, "Directions of the forces on a block sliding up an incline", ["Draw the free-body diagram for upward sliding", "State the directions of the friction force and the weight component"],
              "the deceleration with and without friction is computed numerically to confirm the claim", "", [f"th={th}", f"v0={v0}", f"mu={mu}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pc_friction_plateau_mu(rng):
    for _ in forever():
        m = pick(rng, [2.0, 3.0, 4.0, 5.0]); muk = pick(rng, [0.20, 0.25, 0.30, 0.40]); mus = muk + pick(rng, [0.10, 0.15])
        fk = muk * m * CG; fs = mus * m * CG
        Fs = [round(fs * f, 1) for f in (0.25, 0.5, 0.75, 1.0)]; rows = [[a, a] for a in Fs] + [[round(fs * 1.25, 1), round(fk, 1)], [round(fs * 1.5, 1), round(fk, 1)], [round(fs * 1.75, 1), round(fk, 1)]]
        muk_est = rows[-1][1] / (m * CG); agree(muk_est, muk, 0.02, "muk")
        break
    key, ds = num_opts(muk_est, [("Uses the largest friction force in the table, which is the maximum static friction, giving the static coefficient.", max(r[1] for r in rows) / (m * CG)), ("Divides the plateau force by the mass without $g$.", rows[-1][1] / m), ("Uses the last applied force instead of the friction force.", rows[-1][0] / (m * CG)), ("Divides by $g$ only, $f_k/g$.", rows[-1][1] / CG)], "", fmt=lambda v: f"${sig(v, 3)}$")
    stim = table_stimulus("Friction force on the block for increasing applied forces", "Applied force (N)", rows, "Friction force (N)")
    stem = f"A ${m:g}\\text{{ kg}}$ block rests on a horizontal surface. A horizontal force is slowly increased and the friction force is recorded (table). The block starts to slide after the force of the fourth row. What is the coefficient of kinetic friction?"
    return MQ("pc_friction_plateau_mu", "2.7", "3.C", stem, key, ds, rng, "Kinetic friction read from the plateau of measured friction forces", ["Find where the friction force stops following the applied force", "Divide the constant friction force by the normal force"],
              "the fit of the plateau rows is recomputed numerically and the coefficient is compared with the generating value", f"After sliding begins the friction is the constant ${sig(rows[-1][1])}\\text{{ N}}$, so $\\mu_k=f_k/(mg)={sig(muk_est)}$.", [f"m={m}", f"muk={muk}", f"mus={mus}"], stim=stim, est=110, mat={"type": "table", "must_include": ["applied force", "friction force"]}, judg=["representation_reading", "justification"])


STAGE_U2 = ["pc_atwood_tension", "pc_incline_friction_accel", "pc_contact_force_blocks", "pc_force_time_poly_velocity", "pc_drag_linear_terminal", "pc_drag_linear_scaling", "pc_sym_quadratic_terminal", "pc_drag_exp_speed",
            "pc_flat_curve_mu", "pc_vertical_circle_top_tension", "pc_circular_scaling", "pc_spring_added_mass", "pc_elevator_scale", "pc_static_friction_claim", "pc_newton3_claim", "pc_two_strings_tension",
            "pc_com_discrete", "pc_com_rod_nonuniform", "pc_gravity_altitude", "pc_sym_incline_accel", "pc_incline_up_friction_claim", "pc_friction_plateau_mu"]
