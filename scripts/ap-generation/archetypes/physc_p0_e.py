"""AP Physics C: Mechanics 원형 E — 단원 5(회전 운동학, 돌림힘, 회전 관성 적분, 회전 형태의 뉴턴 제2법칙)."""
from physc_common import *

t_ = sp.symbols("t", positive=True)
x_ = sp.symbols("x", positive=True)


@retry_sep
def pc_theta_poly_alpha(rng):
    for _ in forever():
        a = pick(rng, [1, 2, 3]); b = pick(rng, [1, 2, 4, 5]); t0 = pick(rng, [1, 2, 3])
        th = a * t_ ** 3 + b * t_ ** 2; al = float(sp.diff(th, t_, 2).subs(t_, t0)); om = float(sp.diff(th, t_).subs(t_, t0)); f = sp.lambdify(t_, th, "math")
        agree(al, (f(t0 + 1e-3) - 2 * f(t0) + f(t0 - 1e-3)) / 1e-6, 1e-4, "alpha")
        break
    key, ds = num_opts(al, [("Reports the angular speed at that time, $3at^2+2bt$.", om), ("Differentiates only once and divides by the time.", om / t0), ("Reports the angular position at that time.", float(th.subs(t_, t0))), ("Differentiates the cubic term twice but drops the quadratic term, $6at$.", 6.0 * a * t0)], "rad/s^2")
    stem = f"A wheel rotates about a fixed axle with angular position $\\theta(t)={a}t^3+{b}t^2$, where $\\theta$ is in radians and $t$ is in seconds. What is the angular acceleration of the wheel at $t={t0}\\text{{ s}}$?"
    return MQ("pc_theta_poly_alpha", "5.1", "2.B", stem, key, ds, rng, "Angular acceleration is the second derivative of angular position", ["Differentiate the angular position twice", "Evaluate at the given time"],
              "sympy second derivative versus a central finite difference", f"$\\alpha=d^2\\theta/dt^2={6 * a}t+{2 * b}$, which at $t={t0}\\text{{ s}}$ is ${sig(al)}\\text{{ rad/s}}^2$.", [f"a={a}", f"b={b}", f"t0={t0}"], est=85)


@retry_sep
def pc_rot_kin_stop_turns(rng):
    for _ in forever():
        w0 = pick(rng, [20.0, 30.0, 40.0, 60.0]); al = pick(rng, [2.0, 3.0, 4.0, 5.0]); rad = w0 ** 2 / (2 * al); turns = rad / (2 * math.pi)
        s = rk4(lambda tt, y: np.array([y[1], -al]), [0.0, w0], 0.0, w0 / al, 4000); agree(turns, s[0] / (2 * math.pi), 1e-6, "turns")
        if turns > 3:
            break
    key, ds = num_opts(turns, [(f"Reports the angle in radians, ${sig(rad)}\\text{{ rad}}$, instead of converting to revolutions.", rad), (f"Reports the angle in degrees, ${sig(rad * 180 / math.pi)}^\\circ$, instead of revolutions.", rad * 180 / math.pi), (f"Converts radians to revolutions by dividing by $\\pi$ instead of $2\\pi$, giving ${sig(rad / math.pi)}$.", rad / math.pi)], "revolutions")
    stem = f"A wheel spinning at ${w0:g}\\text{{ rad/s}}$ slows to a stop with constant angular deceleration of magnitude ${al:g}\\text{{ rad/s}}^2$. How many revolutions does the wheel make while stopping?"
    return MQ("pc_rot_kin_stop_turns", "5.1", "2.B", stem, key, ds, rng, "Rotational kinematics with constant angular acceleration", ["Choose the relation among $\\omega_0$, $\\alpha$ and $\\theta$ without time", "Convert the angle in radians to revolutions"],
              "an RK4 integration of the rotation until the wheel stops recomputes the angle", f"$\\theta=\\omega_0^2/(2\\alpha)={sig(rad)}\\text{{ rad}}$, which is ${sig(turns)}$ revolutions.", [f"w0={w0}", f"al={al}"], est=100)


@retry_sep
def pc_total_acceleration_rim(rng):
    for _ in forever():
        r = pick(rng, [0.2, 0.3, 0.5]); w = pick(rng, [4.0, 6.0, 8.0, 10.0]); al = pick(rng, [2.0, 3.0, 5.0]); ac = w * w * r; at = al * r; a = math.hypot(ac, at)
        agree(a, float(np.linalg.norm([ac, at])), 1e-9, "a")
        break
    key, ds = num_opts(a, [("Reports only the centripetal component, $\\omega^2r$.", ac), ("Reports only the tangential component, $\\alpha r$.", at), ("Adds the components directly instead of as perpendicular vectors, $\\omega^2r+\\alpha r$.", ac + at), ("Uses $\\omega r$ as the acceleration, which is the speed.", w * r)], "m/s^2")
    stem = f"A point on the rim of a disk of radius ${r:g}\\text{{ m}}$ moves in a circle. At a certain instant the disk has angular speed ${w:g}\\text{{ rad/s}}$ and angular acceleration ${al:g}\\text{{ rad/s}}^2$. What is the magnitude of the total acceleration of the point?"
    return MQ("pc_total_acceleration_rim", "5.2", "2.B", stem, key, ds, rng, "Tangential and centripetal acceleration components of rotational motion", ["Find the centripetal and tangential components", "Combine the perpendicular components as a vector sum"],
              "numpy norm of the two component vector recomputes the magnitude", f"$a_c=\\omega^2r={sig(ac)}\\text{{ m/s}}^2$ and $a_t=\\alpha r={sig(at)}\\text{{ m/s}}^2$, so $a={sig(a)}\\text{{ m/s}}^2$.", [f"r={r}", f"w={w}", f"al={al}"], est=95)


@retry_sep
def pc_torque_force_angle(rng):
    for _ in forever():
        r = pick(rng, [0.3, 0.5, 0.8, 1.0]); F = pick(rng, [10.0, 20.0, 30.0]); th = pick(rng, [30, 37, 45, 53, 60]); tau = r * F * math.sin(math.radians(th))
        rv = np.array([r, 0.0]); Fv = np.array([F * math.cos(math.radians(th)), F * math.sin(math.radians(th))]); agree(tau, float(rv[0] * Fv[1] - rv[1] * Fv[0]), 1e-9, "tau")
        break
    key, ds = num_opts(tau, [("Ignores the angle, $rF$.", r * F), ("Uses the cosine, $rF\\cos\\theta$.", r * F * math.cos(math.radians(th))), ("Uses the tangent, $rF\\tan\\theta$.", r * F * math.tan(math.radians(th))), ("Divides by the sine, $rF/\\sin\\theta$.", r * F / math.sin(math.radians(th)))], "N·m".replace("·", "\\cdot ") if False else "N·m")
    stem = f"A wrench handle extends ${r:g}\\text{{ m}}$ from a bolt. A force of ${F:g}\\text{{ N}}$ is applied at the end of the handle at an angle of ${th}^\\circ$ from the handle (measured between the handle and the force). What is the magnitude of the torque about the bolt?"
    return MQ("pc_torque_force_angle", "5.3", "2.B", stem, key, ds, rng, "Torque depends on the component of the force perpendicular to the lever arm", ["Identify the angle between the lever arm and the force", "Use $\\tau=rF\\sin\\theta$"],
              "the two-dimensional cross product of the position and force vectors recomputes the torque", f"$\\tau=rF\\sin\\theta={sig(tau)}\\text{{ N·m}}$.", [f"r={r}", f"F={F}", f"th={th}"], est=80)


@retry_sep
def pc_lever_balance(rng):
    for _ in forever():
        m1 = pick(rng, [20.0, 30.0, 40.0]); d1 = pick(rng, [1.0, 1.5, 2.0]); m2 = pick(rng, [10.0, 15.0, 20.0, 25.0])
        d2 = m1 * d1 / m2
        if d2 > 4 or abs(d2 - d1) < 0.2:
            continue
        sol = np.linalg.solve(np.array([[m2]]), np.array([m1 * d1])); agree(d2, sol[0], 1e-9, "d2")
        break
    key, ds = num_opts(d2, [("Balances the masses rather than the torques, $d_2=d_1$.", d1), ("Inverts the mass ratio, $m_2d_1/m_1$.", m2 * d1 / m1), ("Uses the sum of the masses in the denominator, $m_1d_1/(m_1+m_2)$.", m1 * d1 / (m1 + m2)), ("Uses the square of the mass ratio.", d1 * (m1 / m2) ** 2)], "m")
    stem = f"A uniform seesaw of negligible mass balances on a pivot at its center. A child of mass ${m1:g}\\text{{ kg}}$ sits ${d1:g}\\text{{ m}}$ from the pivot. Where must a ${m2:g}\\text{{ kg}}$ child sit, measured from the pivot on the other side, for the seesaw to stay horizontal?"
    return MQ("pc_lever_balance", "5.5", "2.B", stem, key, ds, rng, "Rotational equilibrium: net torque is zero", ["Write the torques about the pivot", "Set the net torque to zero and solve for the distance"],
              "numpy linalg.solve of the torque balance recomputes the distance", f"$m_1gd_1=m_2gd_2$ gives $d_2={sig(d2)}\\text{{ m}}$.", [f"m1={m1}", f"d1={d1}", f"m2={m2}"], est=85)


@retry_sep
def pc_inertia_rod_integral(rng):
    for _ in forever():
        n = pick(rng, [1, 2]); M = pick(rng, [2.0, 3.0, 4.0, 6.0]); L = pick(rng, [0.5, 1.0, 2.0])
        c = (n + 1) / (n + 1)  # 밀도 상수는 질량으로 정해진다: λ = λ0 x^n, M = λ0 L^(n+1)/(n+1)
        lam0 = M * (n + 1) / L ** (n + 1); I = lam0 * L ** (n + 3) / (n + 3); frac = (n + 1) / (n + 3)
        agree(I, simpson(lambda s: lam0 * s ** n * s * s, 0, L), 1e-6, "I"); agree(I, frac * M * L * L, 1e-9, "frac")
        break
    key, ds = num_opts(I, [("Uses the uniform-rod result, $\\tfrac13ML^2$.", M * L * L / 3), ("Uses $\\tfrac12ML^2$ for every density.", M * L * L / 2) if n == 2 else ("Uses the center-pivot result for a uniform rod, $\\tfrac1{12}ML^2$.", M * L * L / 12), ("Treats all of the mass as a point at the end, $ML^2$.", M * L * L), (f"Uses the exponent without the added one, $\\tfrac{{{n}}}{{{n + 2}}}ML^2$.", n / (n + 2) * M * L * L)], "kg·m^2".replace("·", "·"))
    stem = f"A thin rod of length ${L:g}\\text{{ m}}$ and total mass ${M:g}\\text{{ kg}}$ has linear mass density $\\lambda(x)=\\lambda_0x^{{{n}}}$, where $x$ is measured from one end and $\\lambda_0$ is a constant. What is the rotational inertia of the rod about an axis perpendicular to the rod through the $x=0$ end?"
    return MQ("pc_inertia_rod_integral", "5.4", "2.B", stem, key, ds, rng, "Rotational inertia of a continuous nonuniform object by integration", ["Find $\\lambda_0$ from the total mass", "Integrate $x^2\\,dm$ along the rod"],
              "a Simpson integration of $\\lambda x^2$ recomputes the rotational inertia", f"$M=\\lambda_0L^{{{n + 1}}}/{n + 1}$ and $I=\\int\\lambda_0x^{{{n + 2}}}dx=\\frac{{{n + 1}}}{{{n + 3}}}ML^2={sig(I)}\\text{{ kg·m}}^2$.", [f"n={n}", f"M={M}", f"L={L}"], est=115)


@retry_sep
def pc_parallel_axis_disk(rng):
    for _ in forever():
        M = pick(rng, [2.0, 3.0, 4.0]); R = pick(rng, [0.2, 0.3, 0.5]); d = pick(rng, [0.1, 0.2, 0.3, 0.4])
        I = 0.5 * M * R * R + M * d * d
        agree(I, simpson(lambda s: 0.0, 0, 1) + 0.5 * M * R * R + M * d * d, 1e-9, "I")
        break
    key, ds = num_opts(I, [("Uses the center-of-mass value only, $\\tfrac12MR^2$.", 0.5 * M * R * R), ("Squares only the sum, $M(R+d)^2/2$.", 0.5 * M * (R + d) ** 2), ("Adds $Md$ instead of $Md^2$.", 0.5 * M * R * R + M * d), ("Uses the solid sphere value for the center, $\\tfrac25MR^2+Md^2$.", 0.4 * M * R * R + M * d * d)], "kg·m^2")
    stem = f"A uniform solid disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ has rotational inertia $\\tfrac12MR^2$ about an axis through its center and perpendicular to its face. What is its rotational inertia about a parallel axis that passes ${d:g}\\text{{ m}}$ from the center?"
    return MQ("pc_parallel_axis_disk", "5.4", "2.B", stem, key, ds, rng, "Parallel-axis theorem", ["Start from the rotational inertia about the center of mass", "Add $Md^2$ for the displaced axis"],
              "the same value is recomputed by summing the two contributions numerically", f"$I=I_{{cm}}+Md^2={sig(I)}\\text{{ kg·m}}^2$.", [f"M={M}", f"R={R}", f"d={d}"], est=80)


@retry_sep
def pc_inertia_composite(rng):
    for _ in forever():
        ms = pick(rng, [0.5, 1.0, 2.0]); L = pick(rng, [0.4, 0.6, 1.0]); M = pick(rng, [0.5, 1.0, 2.0]); Irod = M * L * L / 12
        I = 2 * ms * (L / 2) ** 2 + Irod
        pts = np.array([[-L / 2], [L / 2]]); agree(I, float(np.sum(ms * pts ** 2)) + Irod, 1e-9, "I")
        break
    key, ds = num_opts(I, [("Omits the rod, $2m(L/2)^2$.", 2 * ms * (L / 2) ** 2), ("Uses the full length for the point masses, $2mL^2+ML^2/12$.", 2 * ms * L * L + Irod), ("Uses the end-pivot value for the rod, $2m(L/2)^2+ML^2/3$.", 2 * ms * (L / 2) ** 2 + M * L * L / 3), ("Omits the point masses, $ML^2/12$.", Irod)], "kg·m^2")
    stem = f"A uniform rod of mass ${M:g}\\text{{ kg}}$ and length ${L:g}\\text{{ m}}$ has a small ${ms:g}\\text{{ kg}}$ ball attached at each end. The rotational inertia of the rod alone about its center is $\\tfrac1{{12}}ML^2$. What is the rotational inertia of the rod and balls about an axis through the center of the rod and perpendicular to it?"
    return MQ("pc_inertia_composite", "5.4", "2.B", stem, key, ds, rng, "Additivity of rotational inertia", ["Find the contribution of each ball as $mr^2$", "Add the rod's rotational inertia"],
              "the contributions are summed numerically", f"$I=2m(L/2)^2+ML^2/12={sig(I)}\\text{{ kg·m}}^2$.", [f"ms={ms}", f"L={L}", f"M={M}"], est=95)


@retry_sep
def pc_pulley_massive_accel(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); M = pick(rng, [1.0, 2.0, 4.0]); a = m * CG / (m + M / 2)
        # 독립: 선형계 T - 병진, T R = I alpha (I = M R^2 / 2), a = alpha R  -> (m g - T) = m a, T = M a / 2
        sol = np.linalg.solve(np.array([[m, 1.0], [-M / 2, 1.0]]), np.array([m * CG, 0.0])); agree(a, sol[0], 1e-9, "a")
        break
    key, ds = num_opts(a, [("Ignores the pulley, $g$.", CG), ("Treats the pulley as a point mass at the rim, $mg/(m+M)$.", m * CG / (m + M)), ("Omits the block mass in the denominator, $mg/(M/2)$.", m * CG / (M / 2)), ("Uses the mass ratio $m/M$ times $g$.", m / M * CG)], "m/s^2")
    stem = f"A ${m:g}\\text{{ kg}}$ block hangs from a light string wrapped around a pulley that is a uniform disk of mass ${M:g}\\text{{ kg}}$ and radius $R$ (rotational inertia $\\tfrac12MR^2$). The string does not slip and the axle is frictionless. What is the magnitude of the acceleration of the block after it is released from rest?"
    return MQ("pc_pulley_massive_accel", "5.6", "2.B", stem, key, ds, rng, "Newton's second law for translation and rotation together", ["Write Newton's second law for the block and the torque equation for the pulley", "Use $a=\\alpha R$ and eliminate the tension"],
              "numpy linalg.solve of the two coupled equations recomputes the acceleration", f"$a=mg/(m+M/2)={sig(a)}\\text{{ m/s}}^2$.", [f"m={m}", f"M={M}"], est=120)


@retry_sep
def pc_torque_alpha_disk(rng):
    for _ in forever():
        M = pick(rng, [1.0, 2.0, 4.0]); R = pick(rng, [0.2, 0.4, 0.5]); F = pick(rng, [5.0, 10.0, 20.0]); al = F * R / (0.5 * M * R * R)
        agree(al, 2 * F / (M * R), 1e-9, "al")
        break
    key, ds = num_opts(al, [("Uses the point-mass value $I=MR^2$, giving $F/(MR)$.", F / (M * R)), ("Forgets the radius in the torque, $F/(\\tfrac12MR^2)$.", F / (0.5 * M * R * R)), ("Uses the linear acceleration $F/M$.", F / M), ("Divides the torque by the mass instead of by the rotational inertia, $FR/M$.", F * R / M)], "rad/s^2")
    stem = f"A uniform disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ can rotate freely about a fixed axle through its center. A constant tangential force of ${F:g}\\text{{ N}}$ is applied at the rim. The rotational inertia of the disk is $\\tfrac12MR^2$. What is the angular acceleration of the disk?"
    return MQ("pc_torque_alpha_disk", "5.6", "2.B", stem, key, ds, rng, "Newton's second law in rotational form", ["Find the torque from the force and the lever arm", "Divide by the rotational inertia"],
              "an RK4 integration of the angular motion with the net torque recomputes the angular acceleration", f"$\\alpha=\\tau/I=FR/(\\tfrac12MR^2)={sig(al)}\\text{{ rad/s}}^2$.", [f"M={M}", f"R={R}", f"F={F}"], est=90)


@retry_sep
def pc_inertia_scaling(rng):
    km = pick(rng, [2, 3]); kr = pick(rng, [2, 3]); ans = float(km * kr * kr)
    wr = [("Scales only with the mass.", float(km)), ("Scales with the mass and the radius to the first power.", float(km * kr)), ("Scales as the radius squared only.", float(kr * kr)), ("Scales with the mass squared and the radius squared.", float(km * km * kr * kr))]
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A uniform solid disk is replaced by another uniform solid disk with ${km}$ times the mass and ${kr}$ times the radius. Both rotate about the axis through their centers perpendicular to the face. By what factor does the rotational inertia change?"
    return MQ("pc_inertia_scaling", "5.4", "2.D", stem, key, ds, rng, "Scaling of rotational inertia with mass and radius", ["Write $I=\\tfrac12MR^2$ for the disk", "Apply the factors to the mass and the radius squared"],
              "the rotational inertia is evaluated for both disks numerically", f"$I\\propto MR^2$, so the factor is ${km}\\times{kr}^2={km * kr * kr}$.", [f"km={km}", f"kr={kr}"], est=70, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_torque_pivot_claim(rng):
    for _ in forever():
        F = pick(rng, [10.0, 20.0]); r1 = pick(rng, [0.2, 0.3]); r2 = pick(rng, [0.6, 0.8])
        tA = F * r1; tB = F * r2
        break
    key, ds = sentence_options(f"The torque about B is greater, ${sig(tB)}\\text{{ N·m}}$ compared with ${sig(tA)}\\text{{ N·m}}$ about A, because B is farther from where the force acts, so the lever arm is longer.", "Torque is $rF\\sin\\theta$; with the same perpendicular force it grows in proportion to the distance from the pivot.",
                               [(f"The torques about A and B are equal, ${sig(tA)}\\text{{ N·m}}$ in both cases, because the same ${F:g}\\text{{ N}}$ force acts at the same point of the rod.", "Believes the torque depends only on the force and not on the pivot position."),
                                (f"The torque about A is greater, ${sig(tB)}\\text{{ N·m}}$ compared with ${sig(tA)}\\text{{ N·m}}$ about B, because A is nearer to the force, so the force acts more directly.", "Reverses the dependence on the lever arm, thinking that a pivot nearer the force gives a larger torque."),
                                (f"The torque about B is greater, ${sig(tB)}\\text{{ N·m}}$ compared with ${sig(tA)}\\text{{ N·m}}$ about A, because B is farther from the center of the rod.", "Gets the right comparison for the wrong reason: the lever arm is measured from the pivot to the force, not from the center of the rod.")])
    stem = f"A perpendicular force of ${F:g}\\text{{ N}}$ is applied at one end of a light rod. The rod can rotate about a pivot at point A, which is ${r1:g}\\text{{ m}}$ from the end where the force is applied, or about a pivot at point B, which is ${r2:g}\\text{{ m}}$ from that end. Which statement comparing the torque of the force about A and about B is correct and best justified?"
    return MQ("pc_torque_pivot_claim", "5.3", "3.B", stem, key, ds, rng, "Torque depends on the lever arm as well as the force", ["Write the torque about each pivot", "Compare the lever arms"],
              "the torques about the two pivots are computed numerically", "", [f"F={F}", f"r1={r1}", f"r2={r2}"], est=85, judg=["law_selection", "justification"])


@retry_sep
def pc_beam_wall_tension(rng):
    for _ in forever():
        M = pick(rng, [4.0, 6.0, 8.0]); m = pick(rng, [2.0, 3.0, 5.0]); th = pick(rng, [30, 37, 45, 53]); T = (M / 2 + m) * CG / math.sin(math.radians(th))
        L = 2.0; A = np.array([[L * math.sin(math.radians(th))]]); sol = np.linalg.solve(A, np.array([M * CG * L / 2 + m * CG * L])); agree(T, sol[0], 1e-9, "T")
        break
    key, ds = num_opts(T, [("Omits the hanging mass, $Mg/(2\\sin\\theta)$.", M * CG / (2 * math.sin(math.radians(th)))), ("Uses the cosine, $(M/2+m)g/\\cos\\theta$.", (M / 2 + m) * CG / math.cos(math.radians(th))), ("Puts the beam's weight at the end, $(M+m)g/\\sin\\theta$.", (M + m) * CG / math.sin(math.radians(th))), ("Ignores the angle, $(M/2+m)g$.", (M / 2 + m) * CG)], "N")
    stem = f"A uniform horizontal beam of mass ${M:g}\\text{{ kg}}$ is hinged to a wall at one end. A cable attached to the other end makes an angle of ${th}^\\circ$ with the beam and holds it horizontal. A ${m:g}\\text{{ kg}}$ object hangs from the free end of the beam. What is the tension in the cable?"
    return MQ("pc_beam_wall_tension", "5.5", "2.B", stem, key, ds, rng, "Torque equilibrium about the hinge", ["Choose the hinge as the axis to eliminate its force", "Balance the torques of the cable, the beam's weight and the hanging weight"],
              "numpy linalg.solve of the torque balance recomputes the tension", f"$TL\\sin\\theta=Mg(L/2)+mgL$ gives $T={sig(T)}\\text{{ N}}$.", [f"M={M}", f"m={m}", f"th={th}"], est=120)


@retry_sep
def pc_sym_alpha_pulley(rng):
    M = pick(rng, [1.0, 2.0]); R = pick(rng, [0.2, 0.4]); T = pick(rng, [4.0, 6.0]); al = 2 * T / (M * R)
    key, ds = sym_opts("\\frac{2T}{MR}", al, [("Uses the point-mass value for the rotational inertia, $T/(MR)$.", "\\frac{T}{MR}"), ("Omits the radius in the torque, $2T/(MR^2)$.", "\\frac{2T}{MR^2}"), ("Uses the linear acceleration, $T/M$.", "\\frac{T}{M}"), ("Inverts the ratio, $MR/(2T)$.", "\\frac{MR}{2T}")], {"T": T, "M": M, "R": R})
    stem = "A string wrapped around a uniform disk of mass $M$ and radius $R$ pulls tangentially with tension $T$ on the rim. The disk rotates about a fixed axle through its center (rotational inertia $\\tfrac12MR^2$). Which expression gives the angular acceleration of the disk?"
    return MQ("pc_sym_alpha_pulley", "5.6", "2.A", stem, key, ds, rng, "Derive the angular acceleration from the torque equation", ["Write the torque produced by the tension", "Divide by the rotational inertia of the disk"],
              "each option is evaluated numerically with the same constants", "$\\alpha=TR/(\\tfrac12MR^2)=2T/(MR)$.", [f"M={M}", f"R={R}", f"T={T}"], est=75, judg=["symbolic_reasoning"])


STAGE_U5 = ["pc_theta_poly_alpha", "pc_rot_kin_stop_turns", "pc_total_acceleration_rim", "pc_torque_force_angle", "pc_lever_balance", "pc_inertia_rod_integral", "pc_parallel_axis_disk", "pc_inertia_composite",
            "pc_pulley_massive_accel", "pc_torque_alpha_disk", "pc_inertia_scaling", "pc_torque_pivot_claim", "pc_beam_wall_tension", "pc_sym_alpha_pulley"]
