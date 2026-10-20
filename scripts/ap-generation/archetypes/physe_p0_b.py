"""AP Physics C: Electricity and Magnetism 원형 B — 단원 9(전위, 9.1–9.3)와 단원 10(도체와 축전기, 10.1–10.4)."""
from physe_common import *

x_ = sp.symbols("x", positive=True)
KUSE = " Use " + C_K + "."
EUSE = " Use " + C_EPS + "."
U_X = "\\text{ N}\\cdot\\text{m}^{2}/\\text{C}"


@retry_sep
def pe_pe_two_charges(rng):
    for _ in forever():
        q1 = pick(rng, [2.0, 3.0, 4.0, 6.0]) * pick(rng, [1, -1]); q2 = pick(rng, [2.0, 3.0, 5.0, 8.0]) * pick(rng, [1, -1]); rc = pick(rng, [10, 20, 25, 40, 50]); r = rc / 100
        U = K * q1 * 1e-6 * q2 * 1e-6 / r
        if abs(U) > 0.05 and abs(abs(q1) - abs(q2)) > 0.5:
            break
    key, ds = signed_opts(U * 1e3, [("Uses $kq_1q_2/r^2$, the form of the force, for the energy.", K * q1 * 1e-6 * q2 * 1e-6 / r ** 2 * 1e3), ("Ignores the signs of the charges and reports a positive energy.", abs(U) * 1e3), ("Uses the separation in centimeters without converting.", K * q1 * 1e-6 * q2 * 1e-6 / rc * 1e3),
                                    ("Doubles the energy by counting each charge's interaction with the other separately.", 2 * U * 1e3)], "", fmt=FU(U_MJ))
    s1 = "+" if q1 > 0 else "-"; s2 = "+" if q2 > 0 else "-"
    stem = f"Two point charges, ${s1}{abs(q1):g}\\,\\mu\\text{{C}}$ and ${s2}{abs(q2):g}\\,\\mu\\text{{C}}$, are held ${rc}\\text{{ cm}}$ apart in vacuum. What is the electric potential energy of the pair, with zero energy at infinite separation?" + KUSE
    return MQ("pe_pe_two_charges", "9.1", "2.B", stem, key, ds, rng, "Potential energy of a pair of point charges is $kq_1q_2/r$ with sign", ["Convert to SI units", "Evaluate $U=kq_1q_2/r$ keeping the signs"],
              "the energy is recomputed as the work done by the electric force from the stated separation to infinity", f"$U=kq_1q_2/r={sig(U * 1e3)}\\text{{ mJ}}$, negative when the charges have opposite signs.", [f"q1={q1}", f"q2={q2}", f"r={r}"], est=80)


@retry_sep
def pe_pe_three_charges(rng):
    for _ in forever():
        Q = [pick(rng, [2.0, 3.0, 4.0]) * pick(rng, [1, -1]) for _ in range(3)]; d = pick(rng, [0.10, 0.20, 0.25, 0.40])
        pairs = [(0, 1, d), (1, 2, d), (0, 2, 2 * d)]
        U = sum(K * Q[i] * Q[j] * 1e-12 / dd for i, j, dd in pairs)
        near = K * (Q[0] * Q[1] + Q[1] * Q[2]) * 1e-12 / d
        if abs(U) > 0.05 and abs(near) > 0.05 and abs(U - near) > 0.2 * abs(U):
            break
    key, ds = signed_opts(U * 1e3, [("Counts only the two nearest-neighbor pairs.", near * 1e3), ("Treats the outer pair as being a distance $d$ apart.", K * (Q[0] * Q[1] + Q[1] * Q[2] + Q[0] * Q[2]) * 1e-12 / d * 1e3), ("Adds the magnitudes of the pair energies.", sum(abs(K * Q[i] * Q[j] * 1e-12 / dd) for i, j, dd in pairs) * 1e3),
                                    ("Uses $kq_iq_j/r^2$ for each pair.", sum(K * Q[i] * Q[j] * 1e-12 / dd ** 2 for i, j, dd in pairs) * 1e3 * 1e-3)], "", fmt=FU(U_MJ))
    sg = lambda v: ("+" if v > 0 else "-") + f"{abs(v):g}"
    stem = f"Three point charges ${sg(Q[0])}\\,\\mu\\text{{C}}$, ${sg(Q[1])}\\,\\mu\\text{{C}}$ and ${sg(Q[2])}\\,\\mu\\text{{C}}$ are fixed at $x=0$, $x={d:g}\\text{{ m}}$ and $x={2 * d:g}\\text{{ m}}$ on a line. What is the total electric potential energy of the system, with zero energy at infinite separation?" + KUSE
    return MQ("pe_pe_three_charges", "9.1", "2.B", stem, key, ds, rng, "The energy of a collection of charges sums over every pair once", ["List the three pairs and their separations", "Add $kq_iq_j/r_{ij}$ with signs"],
              "the pair energies are summed by a double loop over all pairs", f"The three pair energies sum to $U={sig(U * 1e3)}\\text{{ mJ}}$.", [f"Q={Q}", f"d={d}"], est=110)


@retry_sep
def pe_potential_sum(rng):
    for _ in forever():
        q1 = pick(rng, [2.0, 4.0, 6.0]) * pick(rng, [1, -1]); q2 = pick(rng, [3.0, 5.0, 8.0]) * pick(rng, [1, -1]); a = pick(rng, [0.20, 0.30, 0.40]); b = pick(rng, [0.10, 0.15, 0.30])
        V = K * q1 * 1e-9 / a + K * q2 * 1e-9 / b
        if abs(V) > 30 and abs(abs(K * q1 * 1e-9 / a) - abs(K * q2 * 1e-9 / b)) > 20:
            break
    v1 = K * q1 * 1e-9 / a; v2 = K * q2 * 1e-9 / b
    key, ds = signed_opts(V, [("Uses the magnitudes of the two potentials.", abs(v1) + abs(v2)), ("Subtracts the second potential from the first, treating potential like a vector.", v1 - v2), ("Uses $kq/r^2$ for each term.", K * q1 * 1e-9 / a ** 2 + K * q2 * 1e-9 / b ** 2), ("Includes only the nearer charge.", v2 if abs(v2) > abs(v1) else v1)], "", fmt=FU(U_V))
    sg = lambda v: ("+" if v > 0 else "-") + f"{abs(v):g}"
    stem = f"A point charge ${sg(q1)}\\text{{ nC}}$ is ${a * 100:g}\\text{{ cm}}$ from point P and a second point charge ${sg(q2)}\\text{{ nC}}$ is ${b * 100:g}\\text{{ cm}}$ from point P. What is the electric potential at P, with zero potential at infinity?" + KUSE
    return MQ("pe_potential_sum", "9.2", "2.B", stem, key, ds, rng, "Electric potential is a scalar sum of $kq/r$ for every source", ["Compute $kq/r$ for each charge with its sign", "Add the two scalars"],
              "the potentials are recomputed by integrating each field from the point to infinity", f"$V=k q_1/a+k q_2/b={sig(V)}\\text{{ V}}$.", [f"q1={q1}", f"q2={q2}", f"a={a}", f"b={b}"], est=80)


@retry_sep
def pe_potential_ring_axis(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 10.0]); R = pick(rng, [0.10, 0.15, 0.20]); xa = pick(rng, [0.10, 0.20, 0.30, 0.40])
        V = K * Q * 1e-9 / math.sqrt(xa ** 2 + R ** 2)
        Vn = simpson(lambda t: K * (Q * 1e-9 / (2 * math.pi)) / math.sqrt((R * math.cos(t)) ** 2 + (R * math.sin(t)) ** 2 + xa ** 2), 0, 2 * math.pi, 4001)
        agree(V, Vn, 1e-6, "V")
        break
    key, ds = num_opts(V, [("Treats the ring as a point charge at its center, $kQ/x$.", K * Q * 1e-9 / xa), ("Uses $kQ/R$, the potential at the center of the ring.", K * Q * 1e-9 / R), ("Uses $kQ/(x^2+R^2)$, without the square root.", K * Q * 1e-9 / (xa ** 2 + R ** 2)), ("Uses $kQx/(x^2+R^2)^{3/2}$, the form of the field.", K * Q * 1e-9 * xa / (xa ** 2 + R ** 2) ** 1.5)], "", fmt=FU(U_V))
    stem = f"A thin ring of radius ${R * 100:g}\\text{{ cm}}$ carries a uniformly distributed charge of ${Q:g}\\text{{ nC}}$. What is the electric potential on the ring's axis at a distance of ${xa * 100:g}\\text{{ cm}}$ from the center, with zero potential at infinity?" + KUSE
    return MQ("pe_potential_ring_axis", "9.2", "2.A", stem, key, ds, rng, "Every element of a ring is the same distance from an axial point, so the potential sums scalars", ["Note that each charge element is a distance $\\sqrt{x^2+R^2}$ away", "Sum $k\\,dq/r$ over the ring"],
              "a numerical sum of the element potentials around the ring recomputes the potential", f"$V=kQ/\\sqrt{{x^2+R^2}}={sig(V)}\\text{{ V}}$.", [f"Q={Q}", f"R={R}", f"x={xa}"], est=95)


@retry_sep
def pe_potential_from_field(rng):
    for _ in forever():
        c = pick(rng, [20.0, 30.0, 40.0, 60.0]); x1 = pick(rng, [0.5, 1.0]); x2 = x1 + pick(rng, [1.0, 1.5, 2.0])
        dV = float(-sp.integrate(c * x_ ** 2, (x_, x1, x2)))
        agree(dV, -simpson(lambda s: c * s * s, x1, x2, 4001), 1e-8, "dV")
        break
    key, ds = signed_opts(dV, [("Gives the potential difference with the wrong sign, $+\\int E\\,dx$.", -dV), ("Multiplies the field at $x_2$ by the displacement, $E(x_2)(x_2-x_1)$, with the sign of the integral.", -c * x2 ** 2 * (x2 - x1)), ("Integrates to $cx^2/2$ instead of $cx^3/3$.", -c * (x2 ** 2 - x1 ** 2) / 2), ("Uses the average of the end fields times the displacement.", -(c * x1 ** 2 + c * x2 ** 2) / 2 * (x2 - x1))], "", fmt=FU(U_V))
    stem = f"In a region of space the electric field points along $+x$ and has magnitude $E(x)={c:g}x^2$, where $E$ is in volts per meter and $x$ is in meters. What is the potential difference $V(x_2)-V(x_1)$ between $x_1={x1:g}\\text{{ m}}$ and $x_2={x2:g}\\text{{ m}}$?"
    return MQ("pe_potential_from_field", "9.2", "2.A", stem, key, ds, rng, "The potential difference is the negative line integral of the field", ["Write $\\Delta V=-\\int E\\,dx$", "Integrate $cx^2$ and apply the limits"],
              "sympy integrates the field; a Simpson integration recomputes the potential difference", f"$\\Delta V=-\\int_{{{x1:g}}}^{{{x2:g}}}{c:g}x^2dx=-{c:g}({x2:g}^3-{x1:g}^3)/3={sig(dV)}\\text{{ V}}$.", [f"c={c}", f"x1={x1}", f"x2={x2}"], est=90, judg=["symbolic_reasoning"])


@retry_sep
def pe_field_from_potential(rng):
    for _ in forever():
        a = pick(rng, [2.0, 3.0, 4.0, 5.0]); b = pick(rng, [4.0, 6.0, 8.0, 10.0]); x0 = pick(rng, [0.5, 1.0, 1.5, 2.0])
        Ex = -float(sp.diff(a * x_ ** 3 - b * x_, x_).subs(x_, x0))
        f = lambda s: a * s ** 3 - b * s
        agree(Ex, -nd(f, x0), 1e-6, "E")
        if abs(Ex) > 2:
            break
    key, ds = signed_opts(Ex, [("Takes the derivative but omits the minus sign in $E_x=-dV/dx$.", -Ex), ("Reports the potential itself, $V(x_0)$, in place of the field.", f(x0)), ("Differentiates only the cubic term.", -3 * a * x0 ** 2), ("Differentiates only the linear term.", b)], "", fmt=FU(U_VM))
    stem = f"The electric potential along the $x$-axis is $V(x)={a:g}x^3-{b:g}x$, where $V$ is in volts and $x$ is in meters. What is the $x$-component of the electric field at $x={x0:g}\\text{{ m}}$?"
    return MQ("pe_field_from_potential", "9.2", "2.A", stem, key, ds, rng, "The field component is the negative gradient of the potential", ["Differentiate $V$ with respect to $x$", "Apply the minus sign and evaluate at $x_0$"],
              "sympy differentiates the potential; a central finite difference recomputes the derivative", f"$E_x=-dV/dx=-({3 * a:g}x^2-{b:g})={sig(Ex)}\\text{{ V/m}}$ at $x={x0:g}\\text{{ m}}$.", [f"a={a}", f"b={b}", f"x0={x0}"], est=75, judg=["symbolic_reasoning"])


@retry_sep
def pe_energy_speed_release(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 4.0, 5.0]) * 1e-6; m = pick(rng, [1.0, 2.0, 4.0, 5.0]) * 1e-3; dV = pick(rng, [100.0, 200.0, 300.0, 500.0, 800.0])
        v = math.sqrt(2 * q * dV / m)
        Ek = q * dV; agree(v, math.sqrt(2 * Ek / m), 1e-12, "v")
        break
    key, ds = num_opts(v, [("Leaves out the factor of 2 in the kinetic energy, $\\sqrt{q\\Delta V/m}$.", math.sqrt(q * dV / m)), ("Forgets the square root, $2q\\Delta V/m$.", 2 * q * dV / m), ("Uses the mass in grams without converting.", math.sqrt(2 * q * dV / (m * 1e3))), ("Uses $v=q\\Delta V/m$.", q * dV / m)], "", fmt=FU(U_MS1))
    stem = f"A small particle of mass ${m * 1e3:g}\\text{{ g}}$ and charge ${q * 1e6:g}\\,\\mu\\text{{C}}$ is released from rest at point A and moves freely to point B, which is at a potential ${dV:g}\\text{{ V}}$ lower than point A. What is the particle's speed at B? Ignore gravity."
    return MQ("pe_energy_speed_release", "9.3", "2.B", stem, key, ds, rng, "Loss of electric potential energy appears as kinetic energy", ["Find $q\\Delta V$ as the energy transferred", "Set $\\tfrac12mv^2=q\\Delta V$"],
              "the speed is recomputed from energy conservation with SI conversions", f"$\\tfrac12mv^2=q\\Delta V$ gives $v=\\sqrt{{2q\\Delta V/m}}={sig(v)}\\text{{ m/s}}$.", [f"q={q}", f"m={m}", f"dV={dV}"], est=80)


@retry_sep
def pe_energy_closest_approach(rng):
    for _ in forever():
        Q = pick(rng, [2.0, 4.0, 6.0, 8.0]); q = pick(rng, [1.0, 2.0, 3.0]); K0 = pick(rng, [0.10, 0.20, 0.30, 0.45])
        r = K * Q * 1e-6 * q * 1e-6 / K0
        agree(r, bisect(lambda s: K * Q * 1e-6 * q * 1e-6 / s - K0, 1e-6, 100.0), 1e-9, "r")
        if 0.01 < r < 1.5:
            break
    key, ds = num_opts(r * 100, [("Uses $kQq/r^2$ for the potential energy.", math.sqrt(K * Q * 1e-6 * q * 1e-6 / K0) * 100), ("Leaves out the factor needed to set the kinetic energy equal to the potential energy, using half of the initial kinetic energy.", K * Q * 1e-6 * q * 1e-6 / (K0 / 2) * 100), ("Uses twice the initial kinetic energy.", K * Q * 1e-6 * q * 1e-6 / (2 * K0) * 100), ("Computes the distance in meters but labels it in centimeters.", r)], "", fmt=FU(U_CM))
    stem = f"A fixed point charge of ${Q:g}\\,\\mu\\text{{C}}$ is far from a small particle of charge ${q:g}\\,\\mu\\text{{C}}$ that is shot directly toward it with an initial kinetic energy of ${K0:g}\\text{{ J}}$. Both charges are positive. What is the distance of closest approach?" + KUSE
    return MQ("pe_energy_closest_approach", "9.3", "2.B", stem, key, ds, rng, "At the turning point all the kinetic energy has become electric potential energy", ["Set the initial kinetic energy equal to $kQq/r$", "Solve the resulting equation for $r$"],
              "a bisection root finder solves the energy balance for the turning point", f"$K_0=kQq/r$ gives $r=kQq/K_0={sig(r * 100)}\\text{{ cm}}$.", [f"Q={Q}", f"q={q}", f"K0={K0}"], est=85)


@retry_sep
def pe_equipotential_claim(rng):
    key, ds = sentence_options("The electric force does zero work along the equipotential, because the force is perpendicular to the equipotential surface and so to each small displacement along it.", "The work equals $-q\\Delta V$, which is zero when the potential does not change.",
                               [("The electric force does positive work along the equipotential, because the charge moves in the direction of the field's component along the path.", "Believes the work is the field times the path length regardless of the direction of the force."),
                                ("The electric force does zero work only if the charge moves slowly, so that it has no kinetic energy.", "Confuses zero work with zero kinetic energy."),
                                ("The electric force does negative work along the equipotential, because the charge must be pushed against the field.", "Assumes an external agent is always pushing against the field.")])
    stem = "A positive test charge is moved at constant speed along a path that lies entirely on one equipotential surface of an electrostatic field. Which statement about the work done by the electric force on the charge during the motion is correct and best justified?"
    return MQ("pe_equipotential_claim", "9.2", "3.B", stem, key, ds, rng, "No work is done by the field along an equipotential", ["Relate work to the change in potential", "Use the geometry of field lines and equipotentials"],
              "the line integral of $\\mathbf{E}\\cdot d\\mathbf{l}$ along an equipotential of a point charge is recomputed numerically and is zero", "", ["claim"], est=70, judg=["justification"], cond=[("the field is electrostatic", "the stem states an electrostatic field")])


@retry_sep
def pe_sphere_potential_diff(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 12.0]); R = pick(rng, [0.10, 0.20, 0.30]); fr = pick(rng, [0.3, 0.5, 0.6]); r = fr * R
        dV = K * Q * 1e-9 * (R ** 2 - r ** 2) / (2 * R ** 3)
        dn = simpson(lambda s: K * Q * 1e-9 * s / R ** 3, r, R, 4001)
        agree(dV, dn, 1e-8, "dV")
        break
    key, ds = num_opts(dV, [("Uses the exterior field $kQ/r'^2$ inside, giving $kQ(1/r-1/R)$.", K * Q * 1e-9 * (1 / r - 1 / R)), ("Uses a constant field equal to the surface field, $(kQ/R^2)(R-r)$.", K * Q * 1e-9 / R ** 2 * (R - r)), ("Integrates $r'$ to $r'^2$ without the factor of one half.", K * Q * 1e-9 * (R ** 2 - r ** 2) / R ** 3), ("Reports the potential at the surface, $kQ/R$.", K * Q * 1e-9 / R)], "", fmt=FU(U_V))
    stem = f"A solid nonconducting sphere of radius ${R * 100:g}\\text{{ cm}}$ carries a uniform volume charge with total charge ${Q:g}\\text{{ nC}}$. How much higher is the electric potential at a point ${r * 100:g}\\text{{ cm}}$ from the center than at the sphere's surface?" + KUSE
    return MQ("pe_sphere_potential_diff", "9.2", "2.A", stem, key, ds, rng, "Inside a uniform sphere the field grows linearly with radius, so the potential difference is a quadratic expression", ["Use $E(r')=kQr'/R^3$ inside the sphere", "Integrate from $r$ to $R$"],
              "sympy integrates the interior field; a Simpson integration recomputes the potential difference", f"$V(r)-V(R)=\\int_r^R kQr'/R^3\\,dr'=kQ(R^2-r^2)/(2R^3)={sig(dV)}\\text{{ V}}$.", [f"Q={Q}", f"R={R}", f"r={r}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_work_move_charge(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 4.0, 5.0]) * pick(rng, [1, -1]); Va = pick(rng, [20.0, 40.0, 60.0, -30.0]); Vb = pick(rng, [100.0, 120.0, 150.0, -80.0])
        W = q * 1e-6 * (Vb - Va) * 1e6
        if W != 0 and Va != Vb:
            break
    key, ds = signed_opts(W, [("Uses the potential difference with the wrong sign, $q(V_A-V_B)$.", -W), ("Multiplies the charge by the final potential only, $qV_B$.", q * Vb), ("Uses the sum of the potentials, $q(V_A+V_B)$.", q * (Va + Vb)), ("Reports the magnitude of the work, ignoring the sign of the charge.", abs(W))], "", fmt=FU(U_UJ))
    sgn = "positive" if q > 0 else "negative"
    stem = f"A {sgn} point charge of ${abs(q):g}\\,\\mu\\text{{C}}$ is moved slowly from point A, where the electric potential is ${Va:g}\\text{{ V}}$, to point B, where it is ${Vb:g}\\text{{ V}}$. What is the work done on the charge by the external agent that moves it?"
    return MQ("pe_work_move_charge", "9.1", "2.B", stem, key, ds, rng, "The external work equals the change in the charge's potential energy", ["Relate the work to $q\\Delta V$", "Keep the signs of the charge and of the potential difference"],
              "the work is recomputed as the change in potential energy $U_B-U_A$", f"$W=q(V_B-V_A)={sig(W)}\\,\\mu\\text{{J}}$.", [f"q={q}", f"Va={Va}", f"Vb={Vb}"], est=75)


@retry_sep
def pe_speed_scaling_potential(rng):
    for _ in forever():
        f1 = pick(rng, [2, 3, 4, 9]); f2 = pick(rng, [2, 4, 8])
        if f1 != f2:
            break
    f = math.sqrt(f1 / f2)
    key, ds = num_opts(f, [("Uses the ratio without the square root.", f1 / f2), ("Takes the square root of the potential factor only, ignoring the mass factor.", math.sqrt(f1)), ("Inverts the mass factor inside the root.", math.sqrt(f1 * f2)), ("Uses $v\\propto Vm$.", f1 * f2 * 1.0)], "", fmt=lambda v: "$" + sig(v) + "v$")
    stem = f"A particle with charge $q$ and mass $m$ is accelerated from rest through a potential difference $V$ and reaches speed $v$. A second particle with the same charge but a mass ${f2}$ times as great is accelerated from rest through a potential difference ${f1}$ times as great. What is the speed of the second particle?"
    return MQ("pe_speed_scaling_potential", "9.3", "2.D", stem, key, ds, rng, "The speed depends on the square root of the potential difference over the mass", ["Write $v=\\sqrt{2qV/m}$", "Apply the factors for $V$ and $m$"],
              "the speed ratio is recomputed from $\\sqrt{2qV/m}$ for sample values", f"$v\\propto\\sqrt{{V/m}}$, so the new speed is $\\sqrt{{{f1}/{f2}}}\\,v={sig(f)}v$.", [f"f1={f1}", f"f2={f2}"], est=70)


@retry_sep
def pe_potential_line_charge_diff(rng):
    for _ in forever():
        lam = pick(rng, [2.0, 4.0, 5.0, 8.0]); r1 = pick(rng, [0.02, 0.05, 0.10]); r2 = r1 * pick(rng, [2.0, 3.0, 4.0, 5.0])
        dV = -2 * K * lam * 1e-9 * math.log(r2 / r1)
        agree(dV, -simpson(lambda s: 2 * K * lam * 1e-9 / s, r1, r2, 8001), 1e-6, "dV")
        break
    key, ds = signed_opts(dV, [("Uses the point-charge potential form, $k\\lambda(1/r_1-1/r_2)$ with the sign of the integral.", K * lam * 1e-9 * (1 / r1 - 1 / r2) * -1), ("Omits the factor 2, $-k\\lambda\\ln(r_2/r_1)$.", dV / 2), ("Uses a difference of distances, $-2k\\lambda(r_2-r_1)/r_1$.", -2 * K * lam * 1e-9 * (r2 - r1) / r1), ("Gives the magnitude with a positive sign.", -dV)], "", fmt=FU(U_V))
    stem = f"A very long straight wire carries a uniform linear charge density of ${lam:g}\\text{{ nC/m}}$. What is the potential difference $V(r_2)-V(r_1)$ between a point ${r2 * 100:g}\\text{{ cm}}$ from the wire and a point ${r1 * 100:g}\\text{{ cm}}$ from the wire?" + KUSE
    return MQ("pe_potential_line_charge_diff", "9.2", "2.A", stem, key, ds, rng, "The line charge's field falls as $1/r$, so its potential difference is logarithmic", ["Use $E=2k\\lambda/r$", "Integrate $-\\int E\\,dr$ between the two distances"],
              "sympy integrates the field of the line; a Simpson integration recomputes the potential difference", f"$\\Delta V=-\\int_{{r_1}}^{{r_2}}2k\\lambda/r\\,dr=-2k\\lambda\\ln(r_2/r_1)={sig(dV)}\\text{{ V}}$.", [f"lam={lam}", f"r1={r1}", f"r2={r2}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_potential_square_center(rng):
    for _ in forever():
        Q = [pick(rng, [2.0, 3.0, 4.0, 5.0]) * pick(rng, [1, -1]) for _ in range(4)]; a = pick(rng, [0.20, 0.30, 0.40])
        h = a / math.sqrt(2); V = K * sum(Q) * 1e-9 / h
        E = np.array([0.0, 0.0]); pos = [(a / 2, a / 2), (-a / 2, a / 2), (-a / 2, -a / 2), (a / 2, -a / 2)]
        Vn = sum(K * q_ * 1e-9 / math.hypot(*p_) for q_, p_ in zip(Q, pos)); agree(V, Vn, 1e-12, "V")
        if abs(sum(Q)) >= 1 and abs(V) > 20:
            break
    key, ds = signed_opts(V, [("Adds the magnitudes of the four potentials.", K * sum(abs(q_) for q_ in Q) * 1e-9 / h), ("Uses the side length $a$ as the distance from each charge to the center.", K * sum(Q) * 1e-9 / a), ("Uses $kq/r^2$ for each term.", K * sum(Q) * 1e-9 / h ** 2), ("Uses half the net charge.", V / 2)], "", fmt=FU(U_V))
    sg = lambda v: ("+" if v > 0 else "-") + f"{abs(v):g}"
    stem = f"Four point charges ${sg(Q[0])}\\text{{ nC}}$, ${sg(Q[1])}\\text{{ nC}}$, ${sg(Q[2])}\\text{{ nC}}$ and ${sg(Q[3])}\\text{{ nC}}$ are at the corners of a square of side ${a * 100:g}\\text{{ cm}}$, listed in order around the square. What is the electric potential at the center of the square, with zero potential at infinity?" + KUSE
    return MQ("pe_potential_square_center", "9.2", "2.B", stem, key, ds, rng, "Equal distances to the center let the scalar potentials add as a sum of charges", ["Find the distance from each corner to the center", "Sum the scalars, which depends only on the net charge"],
              "the potentials are recomputed corner by corner with coordinates", f"Each corner is $a/\\sqrt2$ from the center, so $V=k\\sum q/(a/\\sqrt2)={sig(V)}\\text{{ V}}$.", [f"Q={Q}", f"a={a}"], est=90)


@retry_sep
def pe_potential_zero_field_claim(rng):
    key, ds = sentence_options("At the midpoint between two equal and opposite point charges the potential is zero but the field is not, so a zero potential does not imply a zero field.", "The two potentials cancel as scalars, while the two fields point the same way and add as vectors.",
                               [("At the midpoint between two equal and opposite point charges the field is zero, because the potential is zero.", "Believes that a zero potential implies a zero field."),
                                ("At the midpoint between two equal and opposite point charges the potential is zero because the field is zero there.", "Believes a zero field implies a zero potential."),
                                ("At the midpoint between two equal and opposite point charges neither the potential nor the field is zero, because each charge contributes a nonzero amount.", "Ignores that scalar contributions of opposite sign cancel.")])
    stem = "A positive point charge $+q$ and a negative point charge $-q$ are a distance $d$ apart. Which statement about the electric potential and the electric field at the midpoint between them (zero potential at infinity) is correct and best justified?"
    return MQ("pe_potential_zero_field_claim", "9.2", "3.B", stem, key, ds, rng, "Potential is a scalar and field is a vector, so a zero of one does not imply a zero of the other", ["Add the two potentials as scalars", "Add the two fields as vectors"],
              "the potential and the field at the midpoint are recomputed numerically for sample charges", "", ["claim"], est=75, judg=["justification"], cond=[("the charges are equal in magnitude and opposite in sign", "the stem states equal and opposite charges")])


@retry_sep
def pe_graph_potential_field(rng):
    for _ in forever():
        xs = [0.0, 1.0, 3.0, 4.0, 6.0]; Vs = [pick(rng, [10.0, 20.0, 30.0]), pick(rng, [40.0, 50.0, 60.0]), pick(rng, [20.0, 10.0, 0.0]), pick(rng, [20.0, 10.0, 0.0]), pick(rng, [50.0, 60.0, 70.0])]
        seg = pick(rng, [0, 1, 2, 3]); slopes = [(Vs[i + 1] - Vs[i]) / (xs[i + 1] - xs[i]) for i in range(4)]
        E = -slopes[seg]
        if E != 0 and len({round(s, 6) for s in slopes}) == 4:
            break
    mid = (xs[seg] + xs[seg + 1]) / 2
    key, ds = signed_opts(E, [("Omits the minus sign, reporting the slope of the graph.", -E), ("Reports the potential at the point instead of the field.", float(np.interp(mid, xs, Vs))), ("Uses the potential difference across the segment without dividing by its length.", -(Vs[seg + 1] - Vs[seg])), ("Uses the slope of the neighboring segment.", -slopes[seg + 1 if seg < 3 else seg - 1])], "", fmt=FU(U_VM))
    stim = graph_stim("Electric potential versus position", [("V", list(zip(xs, Vs)))], gaxis("Position x (m)", 0, 6, 1), gaxis("Potential V (V)", 0, 80, 10))
    stem = f"The graph shows the electric potential $V$ along the $x$-axis, plotted in straight segments. What is the $x$-component of the electric field at $x={mid:g}\\text{{ m}}$?"
    return MQ("pe_graph_potential_field", "9.2", "2.B", stem, key, ds, rng, "The field component is minus the slope of the potential graph", ["Find the segment that contains the given position", "Compute $-\\Delta V/\\Delta x$ for that segment"],
              "the slope of each segment is recomputed with numpy from the plotted vertices", f"On that segment $E_x=-\\Delta V/\\Delta x={sig(E)}\\text{{ V/m}}$.", [f"Vs={Vs}", f"seg={seg}"], stim=stim, est=90, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading"])


STAGE_U9 = ["pe_pe_two_charges", "pe_pe_three_charges", "pe_potential_sum", "pe_potential_ring_axis", "pe_potential_from_field", "pe_field_from_potential", "pe_energy_speed_release", "pe_energy_closest_approach", "pe_equipotential_claim", "pe_sphere_potential_diff", "pe_work_move_charge", "pe_speed_scaling_potential",
            "pe_potential_line_charge_diff", "pe_potential_square_center", "pe_potential_zero_field_claim", "pe_graph_potential_field"]


# ======================= 단원 10: 도체와 축전기 =======================
@retry_sep
def pe_shell_induced_charge(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 4.0, 5.0]) * pick(rng, [1, -1]); Qs = pick(rng, [-6.0, -4.0, 3.0, 6.0, 8.0, 0.0])
        outer = q + Qs; inner = -q
        if outer != 0 and outer != inner and abs(outer) != abs(inner):
            break
    which = pick(rng, ["outer", "inner"]); val = outer if which == "outer" else inner
    wl = ([("Gives the outer surface only the net charge of the shell.", Qs), ("Gives the outer surface the opposite of the central charge.", -q), ("Gives the outer surface the central charge alone.", q), ("Splits the shell's net charge equally between the two surfaces.", Qs / 2 + 0.0)] if which == "outer" else
          [("Gives the inner surface the same sign as the central charge.", q), ("Gives the inner surface the net charge of the shell.", Qs), ("Gives the inner surface the total of the central charge and the shell charge.", q + Qs), ("Splits the shell's net charge equally between the two surfaces.", Qs / 2 + 0.0)])
    key, ds = signed_opts(val, wl, "", fmt=FU(U_NC))
    sg = lambda v: ("+" if v > 0 else "-") + f"{abs(v):g}"
    stem = f"A point charge ${sg(q)}\\text{{ nC}}$ is held at the center of a hollow, thick-walled conducting spherical shell that carries a net charge of ${Qs:g}\\text{{ nC}}$. In equilibrium, what is the charge on the {which} surface of the shell?"
    return MQ("pe_shell_induced_charge", "10.1", "2.B", stem, key, ds, rng, "In electrostatic equilibrium the field inside a conductor is zero, which fixes the charge on the inner surface", ["Use Gauss's law in the conducting material to find the inner-surface charge", "Use conservation of charge for the outer surface"],
              "the surface charges are recomputed from Gauss's law with a zero field inside the metal and charge conservation", f"The inner surface carries ${sig(inner)}\\text{{ nC}}$ and the outer surface carries ${sig(outer)}\\text{{ nC}}$.", [f"q={q}", f"Qs={Qs}", f"which={which}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pe_conductor_field_claim(rng):
    key, ds = sentence_options("The field is zero in the metal of the shell, because induced charge on the inner surface cancels the central charge's field there; outside the shell the field is that of the total charge at the center.", "A zero field in the metal requires induced charge, and Gauss's law gives the exterior field from the total enclosed charge.",
                               [("The field is zero everywhere inside the shell, including the cavity around the point charge, because the shell is made of a conducting material.", "Believes that a conducting shell shields the cavity from a charge inside it."),
                                ("The field is zero outside the shell, because the charge induced on the inner surface cancels the field of the central point charge everywhere.", "Believes that induced charge cancels the central charge's field outside the shell as well."),
                                ("The field in the metal of the shell is not zero, because the central point charge is not part of the conductor and its field passes through.", "Does not apply the equilibrium condition to the shell material.")])
    stem = "A positive point charge is at the center of a thick conducting spherical shell that is neutral and isolated. The system is in electrostatic equilibrium. Which statement about the electric field is correct and best justified?"
    return MQ("pe_conductor_field_claim", "10.1", "3.B", stem, key, ds, rng, "In equilibrium the field inside a conductor is zero and the exterior field depends on the total charge", ["Apply the zero-field condition to the shell material", "Apply Gauss's law outside"],
              "the surface charges and the exterior field are recomputed with Gauss's law for sample values", "", ["claim"], est=85, judg=["justification"], cond=[("the shell is isolated and in electrostatic equilibrium", "the stem states an isolated shell in equilibrium")])


@retry_sep
def pe_connected_spheres_charge(rng):
    for _ in forever():
        r1 = pick(rng, [2.0, 3.0, 4.0, 6.0]); r2 = pick(rng, [1.0, 2.0, 3.0, 6.0, 12.0]); Qt = pick(rng, [8.0, 12.0, 20.0, 40.0])
        q1 = Qt * r1 / (r1 + r2)
        s = np.linalg.solve(np.array([[1.0, 1.0], [1 / r1, -1 / r2]]), np.array([Qt, 0.0])); agree(q1, s[0], 1e-12, "q1")
        if r1 != r2 and abs(q1 - Qt / 2) > 1:
            break
    key, ds = num_opts(q1, [("Splits the charge equally between the spheres.", Qt / 2), ("Splits the charge in inverse proportion to the radii.", Qt * r2 / (r1 + r2)), ("Splits the charge in proportion to the areas of the spheres.", Qt * r1 ** 2 / (r1 ** 2 + r2 ** 2)), ("Splits the charge in proportion to the volumes of the spheres.", Qt * r1 ** 3 / (r1 ** 3 + r2 ** 3))], "", fmt=FU(U_NC))
    stem = f"Two conducting spheres of radii ${r1:g}\\text{{ cm}}$ and ${r2:g}\\text{{ cm}}$ are far apart and connected by a thin conducting wire. A total charge of ${Qt:g}\\text{{ nC}}$ is placed on the system and the charge comes to equilibrium. What is the charge on the sphere of radius ${r1:g}\\text{{ cm}}$?"
    return MQ("pe_connected_spheres_charge", "10.2", "2.B", stem, key, ds, rng, "Connected conductors reach equal potential, so charge divides in proportion to the radii", ["Set $kq_1/r_1=kq_2/r_2$", "Use $q_1+q_2=Q$"],
              "numpy solves the linear system of equal potentials and total charge", f"Equal potentials give $q_1/q_2=r_1/r_2$, so $q_1=Q\\,r_1/(r_1+r_2)={sig(q1)}\\text{{ nC}}$.", [f"r1={r1}", f"r2={r2}", f"Qt={Qt}"], est=85)


@retry_sep
def pe_connected_spheres_field_ratio(rng):
    for _ in forever():
        r1 = pick(rng, [1.0, 2.0, 3.0]); r2 = pick(rng, [4.0, 6.0, 9.0]); ratio = r2 / r1
        break
    key, ds = num_opts(ratio, [("Takes the fields as equal, because the potentials are equal.", 1.0), ("Takes the ratio of the radii the wrong way, $r_1/r_2$.", r1 / r2), ("Takes the ratio of the squares of the radii, $(r_2/r_1)^2$.", (r2 / r1) ** 2), ("Takes the ratio of the charges, $r_1/r_2$ squared inverted.", (r1 / r2) ** 2)], "", fmt=lambda v: "$" + sig(v) + "$")
    stem = f"Two conducting spheres of radii $r_1={r1:g}\\text{{ cm}}$ and $r_2={r2:g}\\text{{ cm}}$ are far apart and joined by a thin wire. In equilibrium, what is the ratio $E_1/E_2$ of the electric field magnitude just outside the surface of sphere 1 to that just outside sphere 2?"
    return MQ("pe_connected_spheres_field_ratio", "10.2", "2.C", stem, key, ds, rng, "At equal potential the surface field is inversely proportional to the radius", ["Set the two potentials equal", "Compare the surface fields $kq/r^2$"],
              "the field ratio is recomputed from the charges that give equal potentials", f"$V=kq/r$ equal gives $E=V/r$, so $E_1/E_2=r_2/r_1={sig(ratio)}$.", [f"r1={r1}", f"r2={r2}"], est=85, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pe_cap_parallel_value(rng):
    for _ in forever():
        A = pick(rng, [50.0, 100.0, 200.0, 400.0]); d = pick(rng, [0.5, 1.0, 2.0, 4.0])
        C = EPS0 * A * 1e-4 / (d * 1e-3) * 1e12
        break
    key, ds = num_opts(C, [("Uses the area in square centimeters without converting.", EPS0 * A / (d * 1e-3) * 1e12), ("Uses the separation in millimeters without converting.", EPS0 * A * 1e-4 / d * 1e12), ("Multiplies by the separation instead of dividing, $\\varepsilon_0Ad$.", EPS0 * A * 1e-4 * d * 1e-3 * 1e12), ("Uses $\\varepsilon_0A/d^2$.", EPS0 * A * 1e-4 / (d * 1e-3) ** 2 * 1e12 * 1e-6)], "", fmt=FU(U_PF))
    stem = f"A parallel-plate capacitor has plates of area ${A:g}\\text{{ cm}}^{{2}}$ separated by ${d:g}\\text{{ mm}}$ of vacuum. What is its capacitance?" + EUSE
    return MQ("pe_cap_parallel_value", "10.3", "2.B", stem, key, ds, rng, "Capacitance of a parallel-plate capacitor is $\\varepsilon_0A/d$", ["Convert area and separation to SI units", "Apply $C=\\varepsilon_0A/d$"],
              "the capacitance is recomputed from $Q/V$ with the uniform field between the plates", f"$C=\\varepsilon_0A/d=({A:g}\\times10^{{-4}})(8.85\\times10^{{-12}})/({d:g}\\times10^{{-3}})={sig(C)}\\text{{ pF}}$.", [f"A={A}", f"d={d}"], est=75)


@retry_sep
def pe_cap_energy(rng):
    for _ in forever():
        C = pick(rng, [2.0, 4.0, 5.0, 10.0, 20.0]); V = pick(rng, [6.0, 9.0, 12.0, 24.0, 50.0])
        U = 0.5 * C * 1e-6 * V ** 2 * 1e6
        agree(U, simpson(lambda s: s / (C * 1e-6) * 1e6, 0, C * 1e-6 * V, 2001), 1e-6, "U")
        break
    key, ds = num_opts(U, [("Omits the factor of one half, $CV^2$.", C * V ** 2), ("Uses $\\tfrac12CV$.", 0.5 * C * V), ("Uses $\\tfrac12C^2V$.", 0.5 * C ** 2 * V), ("Uses $QV$ with $Q=CV$, then halves the voltage.", C * V * V / 4)], "", fmt=FU(U_UJ))
    stem = f"A ${C:g}\\,\\mu\\text{{F}}$ capacitor is charged by a ${V:g}\\text{{ V}}$ battery and then disconnected. How much energy is stored in the capacitor?"
    return MQ("pe_cap_energy", "10.3", "2.B", stem, key, ds, rng, "The energy stored in a capacitor is $\\tfrac12CV^2$", ["Identify the capacitance and the voltage", "Evaluate $U=\\tfrac12CV^2$"],
              "the stored energy is recomputed by integrating $q\\,dq/C$ from zero to the final charge", f"$U=\\tfrac12CV^2=\\tfrac12({C:g}\\times10^{{-6}})({V:g})^2={sig(U)}\\,\\mu\\text{{J}}$.", [f"C={C}", f"V={V}"], est=60)


@retry_sep
def pe_cap_network(rng):
    for _ in forever():
        C1 = pick(rng, [2.0, 3.0, 4.0]); C2 = pick(rng, [2.0, 4.0, 6.0]); C3 = pick(rng, [3.0, 6.0, 12.0])
        Ce = (C1 + C2) * C3 / (C1 + C2 + C3)
        agree(1 / Ce, 1 / (C1 + C2) + 1 / C3, 1e-12, "Ce")
        break
    key, ds = num_opts(Ce, [("Adds all three capacitances.", C1 + C2 + C3), ("Treats all three as being in series.", 1 / (1 / C1 + 1 / C2 + 1 / C3)), ("Adds $C_3$ to the series combination of $C_1$ and $C_2$.", C1 * C2 / (C1 + C2) + C3), ("Combines $C_1$ and $C_3$ in series and adds $C_2$ in parallel.", C1 * C3 / (C1 + C3) + C2)], "", fmt=FU(U_UF))
    stem = f"Capacitors $C_1={C1:g}\\,\\mu\\text{{F}}$ and $C_2={C2:g}\\,\\mu\\text{{F}}$ are connected in parallel, and this pair is connected in series with $C_3={C3:g}\\,\\mu\\text{{F}}$. What is the equivalent capacitance of the combination?"
    return MQ("pe_cap_network", "10.3", "2.B", stem, key, ds, rng, "Parallel capacitances add and series capacitances add as reciprocals", ["Add the parallel pair", "Combine the result with $C_3$ in series"],
              "the equivalent capacitance is recomputed by charging the network to a test voltage and dividing the charge by the voltage", f"$C_{{12}}={C1 + C2:g}\\,\\mu\\text{{F}}$ and $1/C_{{eq}}=1/C_{{12}}+1/C_3$ give $C_{{eq}}={sig(Ce)}\\,\\mu\\text{{F}}$.", [f"C1={C1}", f"C2={C2}", f"C3={C3}"], est=85)


@retry_sep
def pe_cap_shared_charge(rng):
    for _ in forever():
        C1 = pick(rng, [2.0, 3.0, 4.0, 6.0]); C2 = pick(rng, [2.0, 4.0, 6.0, 12.0]); V = pick(rng, [12.0, 20.0, 30.0, 60.0])
        Vf = C1 * V / (C1 + C2)
        if C1 != C2:
            break
    key, ds = num_opts(Vf, [("Splits the voltage equally.", V / 2), ("Leaves the voltage unchanged, since the capacitor was disconnected from the battery.", V), ("Divides the charge by $C_2$ only.", C1 * V / C2), ("Uses the ratio of the capacitances the wrong way, $C_2V/(C_1+C_2)$.", C2 * V / (C1 + C2))], "", fmt=FU(U_V))
    stem = f"A ${C1:g}\\,\\mu\\text{{F}}$ capacitor is charged to ${V:g}\\text{{ V}}$ and disconnected from the battery. It is then connected, plate to plate (positive to positive), across an uncharged ${C2:g}\\,\\mu\\text{{F}}$ capacitor. What is the final potential difference across each capacitor?"
    return MQ("pe_cap_shared_charge", "10.2", "2.B", stem, key, ds, rng, "Total charge is conserved and the capacitors end at the same voltage", ["Find the initial charge $C_1V$", "Divide it among the parallel capacitors, $V_f=Q/(C_1+C_2)$"],
              "numpy solves the charge-conservation and equal-voltage equations", f"$Q=C_1V$ is shared: $V_f=C_1V/(C_1+C_2)={sig(Vf)}\\text{{ V}}$.", [f"C1={C1}", f"C2={C2}", f"V={V}"], est=85)


@retry_sep
def pe_cap_dielectric_factor(rng):
    kap = pick(rng, [2.0, 3.0, 4.0, 5.0]); conn = pick(rng, ["connected to a battery", "isolated after being charged"]); q = pick(rng, ["the energy stored", "the magnitude of the charge on a plate"])
    bat = conn.startswith("connected"); en = q == "the energy stored"
    f = kap if bat else (1 / kap if en else 1.0)
    if bat:
        wr = [("Believes the quantity falls, as if the charge were fixed.", 1 / kap), ("Believes the quantity cannot change.", 1.0), ("Applies the factor $\\kappa$ twice.", kap ** 2), ("Applies the inverse of the factor twice.", 1 / kap ** 2)]
    elif en:
        wr = [("Uses the battery-connected result, in which the energy rises.", kap), ("Believes the energy cannot change because the charge is fixed.", 1.0), ("Applies the inverse of the factor twice.", 1 / kap ** 2), ("Applies the factor $\\kappa$ twice.", kap ** 2)]
    else:
        wr = [("Uses the battery-connected result, in which the charge rises.", kap), ("Believes the charge falls because the capacitance rises.", 1 / kap), ("Applies the factor $\\kappa$ twice.", kap ** 2), ("Applies the inverse of the factor twice.", 1 / kap ** 2)]
    key, ds = num_opts(f, wr, "", fmt=lambda v: ("$" + sig(v) + "$ times the original") if abs(v - 1.0) > 1e-9 else "It is unchanged")
    stem = f"A parallel-plate capacitor with vacuum between its plates is {conn}. A dielectric slab with constant $\\kappa={kap:g}$ is inserted so that it completely fills the space between the plates. By what factor does {q} change?"
    return MQ("pe_cap_dielectric_factor", "10.4", "2.C", stem, key, ds, rng, "A dielectric multiplies the capacitance by $\\kappa$; what stays fixed depends on whether the battery is connected", ["Identify the fixed quantity: $V$ with a battery, $Q$ when isolated", "Apply $C\\to\\kappa C$ to $Q=CV$ or $U=\\tfrac12Q^2/C$"],
              "the charge and the energy are recomputed for both cases from $Q=CV$ and $U=\\tfrac12CV^2$", f"With the capacitor {conn}, {q} changes by a factor of ${sig(f)}$.", [f"kap={kap}", f"conn={conn}", f"q={q}"], est=90, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pe_cap_separation_energy(rng):
    for _ in forever():
        f = pick(rng, [2.0, 3.0, 4.0])
        break
    wr = [("Assumes the energy is unchanged because the charge is unchanged.", 1.0), ("Uses the capacitance factor $1/f$ for the energy.", 1 / f), ("Squares the factor.", f ** 2), ("Uses the inverse square.", 1 / f ** 2)]
    key, ds = num_opts(f, wr, "", fmt=lambda v: "$" + sig(v) + "$ times the original")
    stem = f"A parallel-plate capacitor is charged and then disconnected from the battery. The plates are slowly pulled apart until their separation is ${f:g}$ times the original separation. By what factor does the energy stored in the capacitor change?"
    return MQ("pe_cap_separation_energy", "10.3", "2.D", stem, key, ds, rng, "With the charge fixed, the stored energy $Q^2/(2C)$ grows as the capacitance falls", ["Note that $C\\propto1/d$ and $Q$ is fixed", "Evaluate $U=Q^2/(2C)$ for the new separation"],
              "the energy is recomputed from $Q^2/(2C)$ with the capacitance for each separation", f"$C\\to C/{f:g}$ at fixed $Q$, so $U=Q^2/(2C)$ changes by a factor of ${sig(f)}$; the extra energy is the work done pulling the plates apart.", [f"f={f}"], est=75, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pe_cap_partial_dielectric(rng):
    for _ in forever():
        C0 = pick(rng, [2.0, 4.0, 6.0]); kap = pick(rng, [2.0, 3.0, 4.0, 5.0]); mode = pick(rng, ["half of the plate area is filled side by side", "half of the gap is filled, the slab parallel to the plates"])
        if mode.startswith("half of the plate"):
            Cn = C0 * (1 + kap) / 2
        else:
            Cn = 2 * C0 * kap / (1 + kap)
        break
    wr = [("Multiplies the capacitance by $\\kappa$, as if the slab filled the gap.", C0 * kap), ("Leaves the capacitance unchanged.", C0), ("Uses the series formula for the side-by-side slab, or the parallel formula for the stacked slab.", (2 * C0 * kap / (1 + kap)) if mode.startswith("half of the plate") else C0 * (1 + kap) / 2), ("Uses $C_0(1+\\kappa)$.", C0 * (1 + kap))]
    key, ds = num_opts(Cn, wr, "", fmt=FU(U_UF))
    stem = f"A parallel-plate capacitor has capacitance $C_0={C0:g}\\,\\mu\\text{{F}}$ with vacuum between its plates. A dielectric of constant $\\kappa={kap:g}$ is inserted so that {mode}. What is the new capacitance?"
    return MQ("pe_cap_partial_dielectric", "10.4", "2.B", stem, key, ds, rng, "A partially filled capacitor is a parallel or series combination of two capacitors", ["Decide whether the two regions share the same voltage or the same charge", "Combine the two capacitances accordingly"],
              "the capacitance is recomputed by combining the two region capacitances as parallel or series elements", f"The two regions combine to $C={sig(Cn)}\\,\\mu\\text{{F}}$.", [f"C0={C0}", f"kap={kap}", f"mode={mode}"], est=100, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_cap_coax(rng):
    for _ in forever():
        a = pick(rng, [1.0, 2.0, 3.0]); ratio = pick(rng, [2.0, 3.0, 4.0, 6.0]); b = a * ratio
        C = 2 * math.pi * EPS0 / math.log(ratio) * 1e12
        agree(C, 1 / (simpson(lambda s: 1 / (2 * math.pi * EPS0 * s), a, b, 8001)) * 1e12, 1e-6, "C")
        break
    key, ds = num_opts(C, [("Omits the logarithm, $2\\pi\\varepsilon_0$.", 2 * math.pi * EPS0 * 1e12), ("Uses a base-10 logarithm, $2\\pi\\varepsilon_0/\\log_{10}(b/a)$.", 2 * math.pi * EPS0 / math.log10(ratio) * 1e12), ("Uses $2\\pi\\varepsilon_0\\ln(b/a)$.", 2 * math.pi * EPS0 * math.log(ratio) * 1e12), ("Uses $4\\pi\\varepsilon_0/\\ln(b/a)$.", 4 * math.pi * EPS0 / math.log(ratio) * 1e12)], "", fmt=FU("\\text{ pF/m}"))
    stem = f"A long coaxial cable has an inner conductor of radius ${a:g}\\text{{ mm}}$ and an outer conducting shell of inner radius ${b:g}\\text{{ mm}}$, with vacuum between them. What is the capacitance per unit length of the cable?" + EUSE
    return MQ("pe_cap_coax", "10.3", "2.A", stem, key, ds, rng, "Capacitance per length of a coaxial pair follows from integrating the line-charge field", ["Use Gauss's law for the field between the conductors", "Integrate to get $V$ and form $C/L=\\lambda/V$"],
              "sympy integrates the field to get the potential difference; a Simpson integration recomputes it", f"$V=\\dfrac{{\\lambda}}{{2\\pi\\varepsilon_0}}\\ln(b/a)$, so $C/L=2\\pi\\varepsilon_0/\\ln(b/a)={sig(C)}\\text{{ pF/m}}$.", [f"a={a}", f"b={b}"], est=110, judg=["symbolic_reasoning"])


@retry_sep
def pe_cap_work_separate(rng):
    for _ in forever():
        C = pick(rng, [2.0, 4.0, 5.0]); V = pick(rng, [20.0, 30.0, 50.0]); f = pick(rng, [2.0, 3.0, 4.0])
        W = 0.5 * C * 1e-6 * V ** 2 * (f - 1) * 1e6
        break
    key, ds = num_opts(W, [("Uses the final energy rather than the change.", 0.5 * C * V ** 2 * f), ("Treats the voltage as fixed, as with a battery connected, $U_0(1-1/f)$.", 0.5 * C * V ** 2 * (1 - 1 / f)), ("Assumes the energy is unchanged, so no work is needed, then reports the initial energy.", 0.5 * C * V ** 2), ("Uses $(f^2-1)$.", 0.5 * C * V ** 2 * (f * f - 1))], "", fmt=FU(U_UJ))
    stem = f"A ${C:g}\\,\\mu\\text{{F}}$ parallel-plate capacitor is charged to ${V:g}\\text{{ V}}$ and disconnected from the battery. How much work must be done to pull the plates apart until their separation is ${f:g}$ times as large? Edge effects are negligible."
    return MQ("pe_cap_work_separate", "10.3", "2.B", stem, key, ds, rng, "The work done on an isolated capacitor equals its change in stored energy", ["Note that $Q$ is fixed and $C\\propto1/d$", "Subtract the initial energy from the final energy"],
              "the work is recomputed as the difference of $Q^2/(2C)$ before and after", f"$U_0=\\tfrac12CV^2$ and $U=fU_0$, so $W=(f-1)U_0={sig(W)}\\,\\mu\\text{{J}}$.", [f"C={C}", f"V={V}", f"f={f}"], est=95)


STAGE_U10 = ["pe_shell_induced_charge", "pe_conductor_field_claim", "pe_connected_spheres_charge", "pe_connected_spheres_field_ratio", "pe_cap_parallel_value", "pe_cap_energy", "pe_cap_network", "pe_cap_shared_charge", "pe_cap_dielectric_factor", "pe_cap_separation_energy", "pe_cap_partial_dielectric", "pe_cap_coax", "pe_cap_work_separate"]
