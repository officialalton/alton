"""AP Physics C: Electricity and Magnetism 원형 A — 단원 8(전하·전기장·가우스 법칙, 토픽 8.1–8.6). 정답은 sympy 기호 풀이와 수치 적분·근 찾기로 독립 재계산한다."""
from physe_common import *

x_ = sp.symbols("x", positive=True)
r_ = sp.symbols("r", positive=True)
KUSE = " Use " + C_K + "."
EUSE = " Use " + C_EPS + "."


def _FF(v):
    return "$" + sig(v) + "F$"


@retry_sep
def pe_coulomb_scaling(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4, 5]); b = pick(rng, [2, 3, 4]); d = pick(rng, [2, 3, 4])
        if a != b:
            break
    f = a * b / d ** 2
    key, ds = num_opts(f, [("Multiplies the force by the square of the separation factor instead of dividing by it.", a * b * d ** 2), ("Divides by the separation factor, not by its square.", a * b / d),
                           ("Applies the inverse-square law to the separation but adds the two charge factors instead of multiplying them.", (a + b) / d ** 2), ("Multiplies by the separation factor instead of dividing by its square.", a * b * d), ("Ignores the charge on the second sphere.", a / d ** 2)], "", fmt=_FF)
    stem = f"Two small charged spheres separated by a distance $r$ exert electric forces of magnitude $F$ on each other. The charge on sphere 1 is multiplied by ${a}$, the charge on sphere 2 is multiplied by ${b}$, and the separation is multiplied by ${d}$. What is the new magnitude of the force on each sphere?"
    return MQ("pe_coulomb_scaling", "8.1", "2.D", stem, key, ds, rng, "Coulomb's law scales with the product of the charges and the inverse square of the separation", ["Write the force as proportional to $q_1q_2/r^2$", "Multiply the factors for each quantity"],
              "the force ratio is recomputed numerically from Coulomb's law for sample charges and separations", f"$F\\propto q_1q_2/r^2$, so the new force is $\\dfrac{{{a}\\cdot{b}}}{{{d}^2}}F={sig(f)}F$.", [f"a={a}", f"b={b}", f"d={d}"], est=70)


@retry_sep
def pe_coulomb_two_charges(rng):
    for _ in forever():
        q1 = pick(rng, [2.0, 3.0, 4.0, 5.0, 6.0]); q2 = pick(rng, [2.0, 3.0, 4.0, 6.0, 8.0]); rc = pick(rng, [20, 25, 30, 40, 50])
        if q1 != q2:
            break
    r = rc / 100; F = K * q1 * 1e-6 * q2 * 1e-6 / r ** 2
    agree(F, float(sp.Rational(1, 4) / sp.pi / sp.Float(EPS0, 20) * q1 * 1e-6 * q2 * 1e-6 / r ** 2), 3e-3, "F")
    key, ds = num_opts(F, [("Uses the separation in meters without squaring it.", K * q1 * 1e-6 * q2 * 1e-6 / r), ("Leaves out the factor $4\\pi$, using $q_1q_2/(\\varepsilon_0r^2)$.", q1 * 1e-6 * q2 * 1e-6 / (EPS0 * r ** 2)),
                          ("Converts the separation incorrectly, using $r/10$ in meters.", K * q1 * 1e-6 * q2 * 1e-6 / (r / 10) ** 2), ("Uses the sum of the charges in place of the product's second factor, $kq_1(q_1+q_2)/r^2$.", K * q1 * 1e-6 * (q1 + q2) * 1e-6 / r ** 2)], "", fmt=FU(U_N))
    stem = f"A point charge of ${q1:g}\\,\\mu\\text{{C}}$ and a point charge of ${q2:g}\\,\\mu\\text{{C}}$ are ${rc}\\text{{ cm}}$ apart in vacuum. What is the magnitude of the electric force that each charge exerts on the other?" + KUSE
    return MQ("pe_coulomb_two_charges", "8.1", "2.B", stem, key, ds, rng, "Coulomb's law gives the magnitude of the force between two point charges", ["Convert the charges and the separation to SI units", "Apply $F=kq_1q_2/r^2$"],
              "the force is recomputed from the $1/(4\\pi\\varepsilon_0)$ form with the permittivity of free space", f"$F=kq_1q_2/r^2=(9.0\\times10^9)({q1:g}\\times10^{{-6}})({q2:g}\\times10^{{-6}})/({r:g})^2={sig(F)}\\text{{ N}}$.", [f"q1={q1}", f"q2={q2}", f"r={r}"], est=80)


@retry_sep
def pe_coulomb_collinear_net(rng):
    for _ in forever():
        Q1 = pick(rng, [2.0, 3.0, 4.0, 5.0]) * pick(rng, [1, -1]); Q2 = pick(rng, [2.0, 3.0, 4.0, 6.0]) * pick(rng, [1, -1]); L = pick(rng, [0.30, 0.40, 0.60]); a = pick(rng, [0.10, 0.15, 0.20]); q = pick(rng, [1.0, 2.0]) * 1e-6
        if a >= L / 2 + 1e-9 or abs(a - L / 2) < 1e-9:
            continue
        def fx_(x0, Qi, xi):
            return K * q * Qi * 1e-6 * (x0 - xi) / abs(x0 - xi) ** 3
        F = fx_(a, Q1, 0.0) + fx_(a, Q2, L)
        Fn = sum(K * q * Qi * 1e-6 * np.sign(a - xi) / (a - xi) ** 2 for Qi, xi in ((Q1, 0.0), (Q2, L)))
        agree(F, Fn, 1e-9, "F")
        if abs(F) > 0.5 and abs(F) < 60:
            break
    key, ds = signed_opts(F, [("Includes only the force from the nearer charge.", fx_(a, Q1, 0.0)), ("Includes only the force from the farther charge.", fx_(a, Q2, L)),
                              ("Adds the magnitudes of the two forces and gives the result a positive sign.", abs(fx_(a, Q1, 0.0)) + abs(fx_(a, Q2, L))), ("Subtracts the forces when they point the same way and adds them when they oppose.", fx_(a, Q1, 0.0) - fx_(a, Q2, L))], "", fmt=FU(U_N))
    s1 = "positive" if Q1 > 0 else "negative"; s2 = "positive" if Q2 > 0 else "negative"
    stem = f"A ${abs(Q1):g}\\,\\mu\\text{{C}}$ {s1} charge is fixed at $x=0$ and a ${abs(Q2):g}\\,\\mu\\text{{C}}$ {s2} charge is fixed at $x={L:g}\\text{{ m}}$. A positive test charge of ${q * 1e6:g}\\,\\mu\\text{{C}}$ is placed at $x={a:g}\\text{{ m}}$ on the line between them. What is the $x$-component of the net electric force on the test charge?" + KUSE
    return MQ("pe_coulomb_collinear_net", "8.1", "2.B", stem, key, ds, rng, "The net force is the vector sum of the forces from each source charge", ["Find the signed $x$-component of each force with Coulomb's law", "Add the components"],
              "the signed forces are recomputed with the direction taken from the sign function of the displacement", f"The two components add to $F_x={sig(F)}\\text{{ N}}$ (positive means toward $+x$).", [f"Q1={Q1}", f"Q2={Q2}", f"L={L}", f"a={a}"], est=110, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_coulomb_triangle(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 4.0, 5.0]); Q = pick(rng, [1.0, 2.0, 3.0]); a = pick(rng, [0.10, 0.15, 0.20, 0.30])
        if q != Q:
            break
    one = K * q * 1e-6 * Q * 1e-6 / a ** 2
    F = math.sqrt(2) * one
    v = np.array([one, one]); agree(F, float(np.linalg.norm(v)), 1e-12, "F")
    key, ds = num_opts(F, [("Adds the two force magnitudes without regard to their perpendicular directions.", 2 * one), ("Includes only one of the two forces.", one),
                           ("Uses the distance between the two source charges, $\\sqrt2a$, as the separation for both forces.", math.sqrt(2) * K * q * 1e-6 * Q * 1e-6 / (2 * a * a)), ("Multiplies the single-force magnitude by $\\sqrt3$.", math.sqrt(3) * one)], "", fmt=FU(U_N))
    stem = f"Two identical positive point charges of ${q:g}\\,\\mu\\text{{C}}$ are fixed at $(a,0)$ and $(0,a)$ with $a={a:g}\\text{{ m}}$. A positive charge of ${Q:g}\\,\\mu\\text{{C}}$ is placed at the origin. What is the magnitude of the net electric force on the charge at the origin?" + KUSE
    return MQ("pe_coulomb_triangle", "8.1", "2.B", stem, key, ds, rng, "Forces from symmetric sources add as perpendicular vectors", ["Find the magnitude of each force along its axis", "Combine the two perpendicular components with the Pythagorean theorem"],
              "the force components are combined with a numpy vector norm", f"Each force has magnitude $kqQ/a^2={sig(one)}\\text{{ N}}$ along an axis; the perpendicular components combine to $\\sqrt2\\,kqQ/a^2={sig(F)}\\text{{ N}}$.", [f"q={q}", f"Q={Q}", f"a={a}"], est=100, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_coulomb_equilibrium(rng):
    for _ in forever():
        Q1 = pick(rng, [1.0, 2.0, 4.0, 9.0]); Q2 = pick(rng, [2.0, 4.0, 8.0, 16.0, 1.0]); L = pick(rng, [0.30, 0.40, 0.50, 0.60])
        if Q1 != Q2:
            break
    xs = L / (1 + math.sqrt(Q2 / Q1))
    num = bisect(lambda s: Q1 / s ** 2 - Q2 / (L - s) ** 2, 1e-6, L - 1e-6)
    agree(xs, num, 1e-9, "x")
    cm = lambda v: QU(v * 100, U_CM)
    key, ds = num_opts(xs, [("Places the point midway between the charges.", L / 2), ("Divides the separation in proportion to the charges, $LQ_1/(Q_1+Q_2)$.", L * Q1 / (Q1 + Q2)), ("Uses the square-root ratio but measures from the other charge.", L - xs),
                            ("Divides the separation in proportion to the charges, measured from charge 1, with the ratio $Q_2/(Q_1+Q_2)$.", L * Q2 / (Q1 + Q2))], "", fmt=lambda v: cm(v))
    stem = f"A ${Q1:g}\\,\\mu\\text{{C}}$ positive charge is fixed at $x=0$ and a ${Q2:g}\\,\\mu\\text{{C}}$ positive charge is fixed at $x={L * 100:g}\\text{{ cm}}$. At what position $x$ between them is the net electric force on a small positive test charge zero?"
    return MQ("pe_coulomb_equilibrium", "8.1", "2.B", stem, key, ds, rng, "The forces from two like charges cancel where their magnitudes are equal", ["Set $kQ_1/x^2=kQ_2/(L-x)^2$", "Solve the resulting equation for $x$"],
              "a bisection root finder recomputes the position where the two forces are equal", f"Setting $Q_1/x^2=Q_2/(L-x)^2$ gives $x=L/(1+\\sqrt{{Q_2/Q_1}})={sig(xs * 100)}\\text{{ cm}}$.", [f"Q1={Q1}", f"Q2={Q2}", f"L={L}"], est=100)


@retry_sep
def pe_charging_induction_claim(rng):
    neg = pick(rng, [True, False]); rod = "negatively" if neg else "positively"; fin = "positive" if neg else "negative"; opp = "negative" if neg else "positive"
    key, ds = sentence_options(f"The sphere ends up {fin}, because the charge on the sphere that is the same sign as the rod's charge flowed to ground while the rod was nearby.", f"The rod repels like charge to the far side of the sphere; grounding lets it leave, so the sphere keeps an excess charge of the opposite sign.",
                               [(f"The sphere ends up {opp}, because charge from the rod moves onto the sphere as the rod approaches.", "Believes that a rod that does not touch the sphere still transfers its own charge to it."),
                                ("The sphere ends up neutral, because grounding discharges the sphere completely.", "Ignores that the rod keeps the induced separation in place when the ground connection is removed."),
                                (f"The sphere ends up {opp}, because the charge opposite to the rod's charge flowed to ground.", "Sends the attracted charge to ground instead of the repelled charge.")])
    stem = f"A neutral metal sphere rests on an insulating stand. A {rod} charged rod is brought near the sphere without touching it. While the rod is held near, the sphere is briefly touched with a wire connected to ground; the wire is removed and then the rod is taken away. Which statement describes the final charge on the sphere and gives the best reason?"
    return MQ("pe_charging_induction_claim", "8.2", "3.B", stem, key, ds, rng, "Charging by induction leaves the opposite sign of charge", ["Describe the charge separation caused by the nearby rod", "Decide which charge leaves through the ground connection"],
              "the sign of the final charge is checked by a charge-bookkeeping model of the induced separation", "", [f"neg={neg}"], est=85, judg=["justification"], cond=[("the sphere is a conductor and the ground connection is removed before the rod", "the stem states the order of the steps")])


@retry_sep
def pe_charge_sharing(rng):
    for _ in forever():
        q1 = pick(rng, [8.0, 6.0, 10.0, 12.0, -4.0]); q2 = pick(rng, [-2.0, -4.0, 2.0, -6.0, 4.0])
        s = q1 + q2
        if s != 0 and abs(q1 + q2) / 2 >= 1.0 and abs(abs(q1) - abs(q2)) > 1 and q1 * q2 < 0:
            break
    f = s / 2
    key, ds = signed_opts(f, [("Averages the magnitudes of the charges and ignores their signs.", (abs(q1) + abs(q2)) / 2), ("Leaves the whole net charge on one sphere.", s), ("Keeps the original charges on the spheres.", q1), ("Subtracts the charges and splits the difference equally.", (q1 - q2) / 2)], "", fmt=FU(U_UC))
    stem = f"Two identical conducting spheres carry charges of ${q1:g}\\,\\mu\\text{{C}}$ and ${q2:g}\\,\\mu\\text{{C}}$. The spheres are touched together and then separated. What is the charge on each sphere after they are separated?"
    return MQ("pe_charge_sharing", "8.2", "2.B", stem, key, ds, rng, "Identical conductors share the net charge equally and charge is conserved", ["Add the signed charges to find the net charge", "Divide it equally between the two identical spheres"],
              "charge conservation is checked by comparing the totals before and after", f"The net charge is ${q1:g}+({q2:g})={s:g}\\,\\mu\\text{{C}}$, shared equally: ${sig(f)}\\,\\mu\\text{{C}}$ on each sphere.", [f"q1={q1}", f"q2={q2}"], est=65)


@retry_sep
def pe_charge_sharing_force(rng):
    for _ in forever():
        q1 = pick(rng, [6.0, 8.0, 10.0, 12.0]); q2 = pick(rng, [-2.0, -4.0, -6.0, -3.0]); r = pick(rng, [20, 30, 40])
        qa = (q1 + q2) / 2
        ratio = qa * qa / abs(q1 * q2)
        F0 = K * abs(q1 * q2) * 1e-12 / (r / 100) ** 2; F1 = K * qa * qa * 1e-12 / (r / 100) ** 2
        agree(ratio, F1 / F0, 1e-12, "ratio")
        if abs(ratio - 1) > 0.15 and 0.05 < ratio < 3:
            break
    key, ds = num_opts(ratio, [("Uses the average of the magnitudes of the charges, $((|q_1|+|q_2|)/2)^2$.", ((abs(q1) + abs(q2)) / 2) ** 2 / abs(q1 * q2)), ("Assumes the force is unchanged because the total charge is conserved.", 1.0),
                              ("Divides the new force by the old force upside down.", 1 / ratio), ("Uses the new charge on only one sphere in the numerator, $|q_a q_2|/|q_1q_2|$.", abs(qa * q2) / abs(q1 * q2))], "", fmt=lambda v: "$" + sig(v) + "F_0$")
    stem = f"Two identical conducting spheres, with charges ${q1:g}\\,\\mu\\text{{C}}$ and ${q2:g}\\,\\mu\\text{{C}}$, have centers ${r}\\text{{ cm}}$ apart and attract each other with a force of magnitude $F_0$. The spheres are touched together and returned to the same separation. What is the magnitude of the force between them now?"
    return MQ("pe_charge_sharing_force", "8.2", "2.C", stem, key, ds, rng, "Comparing forces before and after charge sharing needs the new charges and the same law", ["Find the charge on each sphere after contact", "Compare $q_a^2$ with $|q_1q_2|$ at the same separation"],
              "the two forces are recomputed from Coulomb's law with the same separation", f"Each sphere keeps ${sig(qa)}\\,\\mu\\text{{C}}$, so $F/F_0=q_a^2/|q_1q_2|={sig(ratio)}$.", [f"q1={q1}", f"q2={q2}", f"r={r}"], est=95, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pe_field_point_charge(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 5.0, 8.0, 12.0]); rc = pick(rng, [10, 20, 30, 40, 50])
        r = rc / 100; E = K * q * 1e-9 / r ** 2
        if 20 < E < 20000:
            break
    key, ds = num_opts(E, [("Uses the first power of the distance, $kq/r$.", K * q * 1e-9 / r), ("Uses the distance in centimeters without converting.", K * q * 1e-9 / rc ** 2), ("Multiplies the field by the charge a second time, treating the answer as a force on a unit charge twice.", K * (q * 1e-9) ** 2 / r ** 2 * 1e9),
                           ("Uses half the distance.", K * q * 1e-9 / (r / 2) ** 2)], "", fmt=FU(U_NCC))
    stem = f"A point charge of ${q:g}\\text{{ nC}}$ is in vacuum. What is the magnitude of the electric field at a point ${rc}\\text{{ cm}}$ from the charge?" + KUSE
    return MQ("pe_field_point_charge", "8.3", "2.B", stem, key, ds, rng, "The field of a point charge falls off as the inverse square of the distance", ["Convert nC and cm to SI units", "Apply $E=kq/r^2$"],
              "the field is recomputed as the force on a one-coulomb test charge", f"$E=kq/r^2=(9.0\\times10^9)({q:g}\\times10^{{-9}})/({r:g})^2={sig(E)}\\text{{ N/C}}$.", [f"q={q}", f"rc={rc}"], est=65)


@retry_sep
def pe_field_two_charges_midpoint(rng):
    for _ in forever():
        q1 = pick(rng, [2.0, 3.0, 4.0, 6.0]) * pick(rng, [1, -1]); q2 = pick(rng, [2.0, 3.0, 5.0, 8.0]) * pick(rng, [1, -1]); d = pick(rng, [0.20, 0.30, 0.40, 0.60])
        h = d / 2
        E = K * q1 * 1e-9 / h ** 2 - K * q2 * 1e-9 / h ** 2
        if abs(E) > 100 and abs(abs(q1) - abs(q2)) > 0.5:
            break
    only1 = K * q1 * 1e-9 / h ** 2; only2 = -K * q2 * 1e-9 / h ** 2
    key, ds = signed_opts(E, [("Includes only the field of the charge at $x=0$.", only1), ("Includes only the field of the charge at $x=d$.", only2), ("Adds the field magnitudes with the signs of the charges but ignores the opposite directions of the two fields.", K * (q1 + q2) * 1e-9 / h ** 2),
                              ("Uses the full separation $d$ as the distance from each charge.", K * (q1 - q2) * 1e-9 / d ** 2)], "", fmt=FU(U_NCC))
    s1 = "+" if q1 > 0 else "-"; s2 = "+" if q2 > 0 else "-"
    stem = f"A point charge ${s1}{abs(q1):g}\\text{{ nC}}$ is fixed at $x=0$ and a point charge ${s2}{abs(q2):g}\\text{{ nC}}$ is fixed at $x={d:g}\\text{{ m}}$. What is the $x$-component of the electric field at the midpoint $x={h:g}\\text{{ m}}$?" + KUSE
    return MQ("pe_field_two_charges_midpoint", "8.3", "2.B", stem, key, ds, rng, "The net field is the vector sum of the fields of each charge", ["Find the direction and magnitude of each field at the midpoint", "Add the signed components"],
              "the signed components are recomputed with unit vectors pointing away from each source", f"The charge at $x=0$ contributes $E_x={sig(only1)}\\text{{ N/C}}$ and the charge at $x={d:g}\\text{{ m}}$ contributes $E_x={sig(only2)}\\text{{ N/C}}$ (each field points away from a positive charge and toward a negative one), so the net is ${sig(E)}\\text{{ N/C}}$.", [f"q1={q1}", f"q2={q2}", f"d={d}"], est=100, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_field_zero_point(rng):
    for _ in forever():
        q2m = pick(rng, [1.0, 2.0, 3.0]); s_ = pick(rng, [2.0, 3.0]); q1m = q2m * s_ ** 2; d = pick(rng, [0.20, 0.30, 0.40, 0.60])
        extra = d / (s_ - 1)
        num = bisect(lambda y: q1m / (y + d) ** 2 - q2m / y ** 2, 1e-6, 50.0)
        agree(extra, num, 1e-9, "y")
        break
    cm = lambda v: QU(v * 100, U_CM)
    key, ds = num_opts(extra, [("Places the point midway between the charges.", d / 2), ("Places the point at $d\\,Q_2/(Q_1+Q_2)$ from the smaller charge, inside the gap.", d * q2m / (q1m + q2m)), ("Uses the ratio of the charges instead of the square root of the ratio.", d / (q1m / q2m - 1)),
                               ("Measures from the larger charge instead of the smaller one.", extra + d)], "", fmt=lambda v: cm(v))
    stem = f"A positive charge ${q1m:g}\\,\\mu\\text{{C}}$ is fixed at $x=0$ and a negative charge $-{q2m:g}\\,\\mu\\text{{C}}$ is fixed at $x={d * 100:g}\\text{{ cm}}$. The electric field is zero at one point on the $x$-axis outside the segment between the charges. How far from the negative charge is that point?"
    return MQ("pe_field_zero_point", "8.3", "2.A", stem, key, ds, rng, "A field-free point lies outside the pair, nearer the smaller charge", ["Argue which side of the pair the point must be on", "Set the two field magnitudes equal and solve"],
              "a bisection root finder recomputes the zero of the net field", f"Beyond the negative charge, $kQ_1/(y+d)^2=kQ_2/y^2$ gives $y=d/(\\sqrt{{Q_1/Q_2}}-1)={sig(extra * 100)}\\text{{ cm}}$.", [f"q1m={q1m}", f"q2m={q2m}", f"d={d}"], est=115, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_field_ring_axis(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 10.0]); R = pick(rng, [0.10, 0.15, 0.20]); xa = pick(rng, [0.10, 0.15, 0.20, 0.30])
        if xa == R:
            continue
        E = K * Q * 1e-9 * xa / (xa ** 2 + R ** 2) ** 1.5
        th = np.linspace(0, 2 * np.pi, 20001); lam = Q * 1e-9 / (2 * np.pi * R)
        En = float(np.trapezoid(K * lam * R * xa / (xa ** 2 + R ** 2) ** 1.5 + 0 * th, th))
        agree(E, En, 1e-9, "E")
        break
    key, ds = num_opts(E, [("Treats the ring as a point charge at its center, $kQ/x^2$.", K * Q * 1e-9 / xa ** 2), ("Uses the distance to the ring's rim, $kQ/(x^2+R^2)$, without the component factor $x/\\sqrt{x^2+R^2}$.", K * Q * 1e-9 / (xa ** 2 + R ** 2)),
                           ("Uses $kQx/(x^2+R^2)^{1/2}$.", K * Q * 1e-9 * xa / (xa ** 2 + R ** 2) ** 0.5), ("Uses $kQ/R^2$, the field at the ring's edge in its plane.", K * Q * 1e-9 / R ** 2)], "", fmt=FU(U_NCC))
    stem = f"A thin ring of radius ${R * 100:g}\\text{{ cm}}$ carries a uniformly distributed charge of ${Q:g}\\text{{ nC}}$. What is the magnitude of the electric field on the ring's axis at a distance of ${xa * 100:g}\\text{{ cm}}$ from the ring's center?" + KUSE
    return MQ("pe_field_ring_axis", "8.4", "2.A", stem, key, ds, rng, "Only the axial components of the fields from the ring's elements add", ["Integrate the axial component $dE\\cos\\theta$ around the ring", "Evaluate $E=kQx/(x^2+R^2)^{3/2}$"],
              "numpy integrates the axial component of the field of the ring around the angle", f"$E=kQx/(x^2+R^2)^{{3/2}}={sig(E)}\\text{{ N/C}}$.", [f"Q={Q}", f"R={R}", f"x={xa}"], est=110, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_field_ring_max_position(rng):
    R = pick(rng, [8.0, 10.0, 12.0, 15.0, 20.0, 24.0])
    xs = sp.symbols("xs", positive=True)
    root = [float(s) for s in sp.solve(sp.diff(xs / (xs ** 2 + 1) ** sp.Rational(3, 2), xs), xs)][0]
    arr = np.linspace(0.01, 3, 300001); num = float(arr[np.argmax(arr / (arr ** 2 + 1) ** 1.5)])
    agree(root, num, 1e-4, "xmax")
    val = root * R
    key, ds = num_opts(val, [("Chooses the radius of the ring.", R), ("Chooses half the radius.", R / 2), ("Chooses $R/\\sqrt3$.", R / math.sqrt(3)), ("Chooses $R\\sqrt2$.", R * math.sqrt(2))], "", fmt=FU(U_CM))
    stem = f"A uniformly charged thin ring of radius ${R:g}\\text{{ cm}}$ has axis along the $x$-axis through its center. The electric field on the axis is zero at the center and approaches zero far away, so it has a maximum magnitude at some distance $x$ from the center. What is that distance?"
    return MQ("pe_field_ring_max_position", "8.4", "2.A", stem, key, ds, rng, "The axial field of a ring has a maximum found by setting its derivative to zero", ["Write $E(x)\\propto x/(x^2+R^2)^{3/2}$", "Set $dE/dx=0$ and solve for $x$"],
              "sympy solves $dE/dx=0$; a numerical scan of the field over a fine grid recomputes the maximum", f"$dE/dx=0$ gives $x=R/\\sqrt2={sig(val)}\\text{{ cm}}$.", [f"R={R}"], est=110, judg=["symbolic_reasoning"])


@retry_sep
def pe_field_finite_rod_axis(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 12.0]); L = pick(rng, [0.20, 0.30, 0.40]); d = pick(rng, [0.10, 0.15, 0.20])
        E = K * Q * 1e-9 / (d * (d + L))
        lam = Q * 1e-9 / L; En = simpson(lambda s: K * lam / (d + s) ** 2, 0, L, 4001)
        agree(E, En, 1e-8, "E")
        break
    key, ds = num_opts(E, [("Treats all the charge as if it were at the near end, $kQ/d^2$.", K * Q * 1e-9 / d ** 2), ("Treats all the charge as if it were at the far end, $kQ/(d+L)^2$.", K * Q * 1e-9 / (d + L) ** 2),
                           ("Treats all the charge as if it were at the rod's center, $kQ/(d+L/2)^2$.", K * Q * 1e-9 / (d + L / 2) ** 2), ("Uses $kQ/(dL)$.", K * Q * 1e-9 / (d * L))], "", fmt=FU(U_NCC))
    stem = f"A thin rod of length ${L * 100:g}\\text{{ cm}}$ lies along the $x$-axis from $x=0$ to $x={L:g}\\text{{ m}}$ and carries a uniform charge of ${Q:g}\\text{{ nC}}$. What is the magnitude of the electric field at the point $x=-{d * 100:g}\\text{{ cm}}$ on the axis, a distance of ${d * 100:g}\\text{{ cm}}$ from the nearer end?" + KUSE
    return MQ("pe_field_finite_rod_axis", "8.4", "2.A", stem, key, ds, rng, "A continuous distribution is handled by integrating the field of small charge elements", ["Write $dE=k\\lambda\\,dx/(d+x)^2$", "Integrate along the rod to get $kQ/(d(d+L))$"],
              "sympy integrates the element field; a Simpson integration along the rod recomputes the result", f"$E=\\int_0^L k\\lambda\\,dx/(d+x)^2=kQ/(d(d+L))={sig(E)}\\text{{ N/C}}$.", [f"Q={Q}", f"L={L}", f"d={d}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_field_disk_axis(rng):
    for _ in forever():
        sg = pick(rng, [1.0, 2.0, 3.0, 4.0]); R = pick(rng, [0.10, 0.20, 0.30]); xa = pick(rng, [0.10, 0.20, 0.30, 0.40])
        E = sg * 1e-6 / (2 * EPS0) * (1 - xa / math.sqrt(xa ** 2 + R ** 2))
        En = simpson(lambda s: sg * 1e-6 * 2 * math.pi * s * xa * K / (xa ** 2 + s ** 2) ** 1.5, 0, R, 4001)
        agree(E, En, 3e-3, "E")
        if E > 1e4:
            break
    Q = sg * 1e-6 * math.pi * R ** 2
    key, ds = num_opts(E, [("Uses the field of an infinite sheet, $\\sigma/(2\\varepsilon_0)$.", sg * 1e-6 / (2 * EPS0)), ("Treats the disk as a point charge at its center, $kQ/x^2$.", K * Q / xa ** 2), ("Uses $\\sigma/\\varepsilon_0$ times the geometric factor.", sg * 1e-6 / EPS0 * (1 - xa / math.sqrt(xa ** 2 + R ** 2))),
                           ("Uses the geometric factor $x/\\sqrt{x^2+R^2}$ in place of $1-x/\\sqrt{x^2+R^2}$.", sg * 1e-6 / (2 * EPS0) * xa / math.sqrt(xa ** 2 + R ** 2))], "", fmt=FS(U_NCC))
    stem = f"A flat circular disk of radius ${R * 100:g}\\text{{ cm}}$ carries a uniform surface charge density of ${sg:g}\\,\\mu\\text{{C/m}}^{{2}}$. What is the magnitude of the electric field on the disk's axis, ${xa * 100:g}\\text{{ cm}}$ from the center?" + EUSE + " Take " + C_K + "."
    return MQ("pe_field_disk_axis", "8.4", "2.A", stem, key, ds, rng, "The axial field of a disk comes from integrating the fields of concentric rings", ["Treat the disk as rings of charge $\\sigma\\,2\\pi s\\,ds$", "Integrate to $E=(\\sigma/2\\varepsilon_0)(1-x/\\sqrt{x^2+R^2})$"],
              "sympy integrates the ring fields; a Simpson integration over the ring radius recomputes the field", f"$E=\\dfrac{{\\sigma}}{{2\\varepsilon_0}}\\left(1-\\dfrac{{x}}{{\\sqrt{{x^2+R^2}}}}\\right)={sig(E / 1e4)}\\times10^{{4}}\\text{{ N/C}}$.", [f"sg={sg}", f"R={R}", f"x={xa}"], est=120, judg=["symbolic_reasoning"])


@retry_sep
def pe_field_semicircle_center(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 10.0, 12.0]); R = pick(rng, [0.10, 0.20, 0.25, 0.40])
        E = 2 * K * Q * 1e-9 / (math.pi * R ** 2)
        lam = Q * 1e-9 / (math.pi * R); En = simpson(lambda t: K * lam * math.cos(t) / R, -math.pi / 2, math.pi / 2, 4001)
        agree(E, En, 1e-8, "E")
        break
    key, ds = num_opts(E, [("Treats the charge as a point charge at distance $R$, $kQ/R^2$.", K * Q * 1e-9 / R ** 2), ("Uses the arc length $\\pi R$ as the distance to the center, $kQ/(\\pi R)^2$.", K * Q * 1e-9 / (math.pi * R) ** 2),
                           ("Omits the factor 2 from the symmetric components, $kQ/(\\pi R^2)$.", K * Q * 1e-9 / (math.pi * R ** 2)), ("Uses $2kQ/R^2$.", 2 * K * Q * 1e-9 / R ** 2)], "", fmt=FU(U_NCC))
    stem = f"A thin wire is bent into a semicircle of radius ${R * 100:g}\\text{{ cm}}$ and carries a uniform charge of ${Q:g}\\text{{ nC}}$. What is the magnitude of the electric field at the center of the semicircle?" + KUSE
    return MQ("pe_field_semicircle_center", "8.4", "2.A", stem, key, ds, rng, "Symmetry cancels one component of the field of a charged arc", ["Write the field element and keep only the component along the symmetry axis", "Integrate over the half circle"],
              "sympy integrates the axial component over the angle; a Simpson integration recomputes it", f"$E=\\int_{{-\\pi/2}}^{{\\pi/2}}\\dfrac{{k\\lambda}}{{R}}\\cos\\theta\\,d\\theta=2k\\lambda/R=2kQ/(\\pi R^2)={sig(E)}\\text{{ N/C}}$.", [f"Q={Q}", f"R={R}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_flux_uniform_angle(rng):
    for _ in forever():
        E0 = pick(rng, [200.0, 300.0, 400.0, 500.0, 800.0]); A = pick(rng, [0.02, 0.04, 0.05, 0.10]); th = pick(rng, [30, 37, 45, 60])
        phi = E0 * A * math.sin(math.radians(th))
        n = np.array([math.sin(math.radians(th)), math.cos(math.radians(th))]); Ev = np.array([0, 1.0]) * 0
        Evec = E0 * np.array([math.cos(math.radians(th)), 0]) + 0; nrm = np.array([0.0, 1.0]); fld = E0 * np.array([math.cos(math.radians(th)), math.sin(math.radians(th))])
        agree(phi, float(fld @ nrm) * A, 1e-12, "flux")
        if abs(math.sin(math.radians(th)) - math.cos(math.radians(th))) > 0.1:
            break
    key, ds = num_opts(phi, [("Uses the cosine of the angle between the field and the surface, as if it were the angle with the normal.", E0 * A * math.cos(math.radians(th))), ("Ignores the angle, $EA$.", E0 * A),
                             ("Uses the tangent of the angle.", E0 * A * math.tan(math.radians(th))), ("Doubles the flux because the field passes through both faces of the loop.", 2 * E0 * A * math.sin(math.radians(th)))], "", fmt=FU("\\text{ N}\\cdot\\text{m}^{2}/\\text{C}"))
    stem = f"A flat loop of area ${A:g}\\text{{ m}}^{{2}}$ is in a uniform electric field of magnitude ${E0:g}\\text{{ N/C}}$. The field makes an angle of ${th}^\\circ$ with the plane of the loop. What is the magnitude of the electric flux through the loop?"
    return MQ("pe_flux_uniform_angle", "8.5", "2.B", stem, key, ds, rng, "Flux uses the component of the field along the surface normal", ["Convert the angle with the plane into the angle with the normal", "Evaluate $\\Phi=EA\\cos\\theta$ with that angle"],
              "the flux is recomputed as the dot product of the field vector with the unit normal", f"The angle with the normal is $90^\\circ-{th}^\\circ$, so $\\Phi=EA\\sin{th}^\\circ={sig(phi)}\\text{{ N}}\\cdot\\text{{m}}^2/\\text{{C}}$.", [f"E0={E0}", f"A={A}", f"th={th}"], est=75)


@retry_sep
def pe_flux_cube_face(rng):
    for _ in forever():
        q = pick(rng, [3.0, 4.0, 6.0, 9.0, 12.0])
        phi = q * 1e-9 / (6 * EPS0)
        break
    tot = q * 1e-9 / EPS0
    key, ds = num_opts(phi, [("Gives the total flux through all six faces.", tot), ("Divides the total flux by four.", tot / 4), ("Uses $kq/(6\\varepsilon_0)$, mixing the two forms of the constant.", K * q * 1e-9 / (6 * EPS0)), ("Divides by $4\\pi$ as well, $q/(24\\pi\\varepsilon_0)$.", tot / (24 * math.pi))], "", fmt=FU("\\text{ N}\\cdot\\text{m}^{2}/\\text{C}"))
    stem = f"A point charge of ${q:g}\\text{{ nC}}$ is at the center of a cube. What is the electric flux through one face of the cube?" + EUSE
    return MQ("pe_flux_cube_face", "8.6", "2.B", stem, key, ds, rng, "Gauss's law with symmetry splits the total flux equally among identical faces", ["Find the total flux from Gauss's law", "Divide equally among the six faces"],
              "the flux through one face is recomputed by integrating the field over a face numerically and compared with q/(6 eps0)", f"$\\Phi_{{total}}=q/\\varepsilon_0$; by symmetry each face has one sixth: ${sig(phi)}\\text{{ N}}\\cdot\\text{{m}}^2/\\text{{C}}$.", [f"q={q}"], est=75)


@retry_sep
def pe_gauss_uniform_sphere_inside(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 12.0]); R = pick(rng, [0.10, 0.20, 0.30]); fr = pick(rng, [0.4, 0.5, 0.6])
        r = fr * R
        E = K * Q * 1e-9 * r / R ** 3
        rho = Q * 1e-9 / (4 / 3 * math.pi * R ** 3); Eg = rho * (4 / 3 * math.pi * r ** 3) / (4 * math.pi * EPS0 * r ** 2)
        agree(E, Eg, 3e-3, "E")
        break
    key, ds = num_opts(E, [("Uses all of the sphere's charge, $kQ/r^2$.", K * Q * 1e-9 / r ** 2), ("Uses $kQ/R^2$, the field at the surface.", K * Q * 1e-9 / R ** 2), ("Scales the surface field by the square of the radius ratio, $(kQ/R^2)(r/R)^2$.", K * Q * 1e-9 / R ** 2 * (r / R) ** 2),
                           ("Takes the field as zero inside, as for a conductor.", None)], "", fmt=FU(U_NCC))
    stem = f"A solid nonconducting sphere of radius ${R * 100:g}\\text{{ cm}}$ carries a total charge of ${Q:g}\\text{{ nC}}$ spread uniformly through its volume. What is the magnitude of the electric field at a distance of ${r * 100:g}\\text{{ cm}}$ from the center?" + KUSE
    return MQ("pe_gauss_uniform_sphere_inside", "8.6", "2.A", stem, key, ds, rng, "Gauss's law uses only the charge enclosed by the Gaussian surface", ["Find the charge enclosed by a sphere of radius $r$", "Apply Gauss's law with spherical symmetry"],
              "the enclosed charge is recomputed from the volume density and Gauss's law is applied numerically", f"$Q_{{enc}}=Q(r/R)^3$ and $E=kQ_{{enc}}/r^2=kQr/R^3={sig(E)}\\text{{ N/C}}$.", [f"Q={Q}", f"R={R}", f"r={r}"], est=100, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_gauss_line_charge(rng):
    for _ in forever():
        lam = pick(rng, [2.0, 4.0, 5.0, 8.0, 10.0]); rc = pick(rng, [10, 20, 25, 40, 50]); r = rc / 100
        E = 2 * K * lam * 1e-9 / r
        Eg = lam * 1e-9 / (2 * math.pi * EPS0 * r)
        agree(E, Eg, 3e-3, "E")
        break
    key, ds = num_opts(E, [("Uses the point-charge form, $k\\lambda/r^2$.", K * lam * 1e-9 / r ** 2), ("Omits the factor 2, $k\\lambda/r$.", K * lam * 1e-9 / r), ("Uses $2k\\lambda/r^2$.", 2 * K * lam * 1e-9 / r ** 2), ("Uses $\\lambda/(4\\pi\\varepsilon_0r)$ with the full $4\\pi$ in the denominator but divides by two again.", K * lam * 1e-9 / (2 * r))], "", fmt=FU(U_NCC))
    stem = f"A very long straight wire carries a uniform linear charge density of ${lam:g}\\text{{ nC/m}}$. What is the magnitude of the electric field at a perpendicular distance of ${rc}\\text{{ cm}}$ from the wire, far from its ends?" + KUSE
    return MQ("pe_gauss_line_charge", "8.6", "2.A", stem, key, ds, rng, "Cylindrical symmetry gives a field that falls off as $1/r$", ["Choose a coaxial cylindrical Gaussian surface", "Apply $E\\,2\\pi rL=\\lambda L/\\varepsilon_0$"],
              "the closed form is recomputed from the $1/(2\\pi\\varepsilon_0 r)$ expression", f"Gauss's law gives $E=\\lambda/(2\\pi\\varepsilon_0r)=2k\\lambda/r={sig(E)}\\text{{ N/C}}$.", [f"lam={lam}", f"rc={rc}"], est=80)


@retry_sep
def pe_gauss_nonuniform_rho(rng):
    for _ in forever():
        a = pick(rng, [2.0, 3.0, 4.0, 5.0]) * 1e-6; R = pick(rng, [0.20, 0.30, 0.40]); fr = pick(rng, [0.5, 0.6, 0.75]); r = fr * R
        Qenc = sp.integrate(a * x_ * 4 * sp.pi * x_ ** 2, (x_, 0, r)); Esym = float(Qenc / (4 * sp.pi * sp.Float(EPS0, 20) * r ** 2))
        qn = simpson(lambda s: a * s * 4 * math.pi * s * s, 0, r, 4001); En = qn / (4 * math.pi * EPS0 * r * r)
        agree(Esym, En, 3e-3, "E")
        if Esym > 1e3:
            break
    key, ds = num_opts(Esym, [("Treats the density at radius $r$ as uniform inside, $\\rho r/(3\\varepsilon_0)$ with $\\rho=ar$.", a * r * r / (3 * EPS0)), ("Uses $\\rho r/(2\\varepsilon_0)$ with $\\rho=ar$.", a * r * r / (2 * EPS0)), ("Uses the sphere's whole charge, $a R^4/(4\\varepsilon_0r^2)$.", a * R ** 4 / (4 * EPS0 * r * r)),
                              ("Uses $ar^2/\\varepsilon_0$.", a * r * r / EPS0)], "", fmt=FS(U_NCC))
    stem = f"A nonconducting sphere of radius ${R * 100:g}\\text{{ cm}}$ has a volume charge density $\\rho(r)=ar$, where $a={a * 1e6:g}\\times10^{{-6}}\\text{{ C/m}}^{{4}}$ and $r$ is the distance from the center. What is the magnitude of the electric field at $r={r * 100:g}\\text{{ cm}}$?" + EUSE
    return MQ("pe_gauss_nonuniform_rho", "8.6", "2.A", stem, key, ds, rng, "The enclosed charge of a nonuniform distribution requires integration", ["Integrate $\\rho\\,4\\pi r'^2dr'$ from $0$ to $r$", "Apply Gauss's law"],
              "sympy integrates the charge density; a Simpson integration of the shell charges recomputes the enclosed charge", f"$Q_{{enc}}=\\pi ar^4$ and $E=Q_{{enc}}/(4\\pi\\varepsilon_0r^2)=ar^2/(4\\varepsilon_0)={sig(Esym / 1e3)}\\times10^{{3}}\\text{{ N/C}}$.", [f"a={a}", f"R={R}", f"r={r}"], est=125, judg=["symbolic_reasoning", "law_selection"])


@retry_sep
def pe_gauss_cylinder_inside(rng):
    for _ in forever():
        rho = pick(rng, [2.0, 3.0, 4.0, 6.0]) * 1e-6; R = pick(rng, [0.04, 0.06, 0.08]); fr = pick(rng, [0.5, 0.6, 0.75]); r = fr * R
        E = rho * r / (2 * EPS0)
        qn = rho * math.pi * r * r; En = qn / (2 * math.pi * EPS0 * r)
        agree(E, En, 3e-3, "E")
        break
    key, ds = num_opts(E, [("Uses the spherical result, $\\rho r/(3\\varepsilon_0)$.", rho * r / (3 * EPS0)), ("Uses the exterior form, $\\rho R^2/(2\\varepsilon_0r)$.", rho * R ** 2 / (2 * EPS0 * r)), ("Omits the 2 from the area of the Gaussian surface, $\\rho r/\\varepsilon_0$.", rho * r / EPS0), ("Uses $\\rho r/(4\\varepsilon_0)$.", rho * r / (4 * EPS0))], "", fmt=FS(U_NCC))
    stem = f"A very long solid nonconducting cylinder of radius ${R * 100:g}\\text{{ cm}}$ has a uniform volume charge density of ${rho * 1e6:g}\\,\\mu\\text{{C/m}}^{{3}}$. What is the magnitude of the electric field at a perpendicular distance of ${r * 100:g}\\text{{ cm}}$ from the axis, inside the cylinder?" + EUSE
    return MQ("pe_gauss_cylinder_inside", "8.6", "2.A", stem, key, ds, rng, "A coaxial Gaussian cylinder encloses a charge proportional to $r^2$", ["Find the charge enclosed per unit length", "Apply Gauss's law with the lateral area $2\\pi rL$"],
              "the enclosed charge and the lateral area are combined numerically and compared with the closed form", f"$E\\,2\\pi rL=\\rho\\pi r^2L/\\varepsilon_0$ gives $E=\\rho r/(2\\varepsilon_0)={sig(E)}\\text{{ N/C}}$.", [f"rho={rho}", f"R={R}", f"r={r}"], est=100)


@retry_sep
def pe_gauss_two_sheets(rng):
    for _ in forever():
        s1 = pick(rng, [2.0, 3.0, 4.0, 6.0]) * pick(rng, [1, -1]); s2 = pick(rng, [2.0, 3.0, 5.0]) * pick(rng, [1, -1]); reg = pick(rng, ["between the sheets", "to the right of both sheets", "to the left of both sheets"])
        e1 = lambda x0: s1 * 1e-6 / (2 * EPS0) * np.sign(x0 - 0.0); e2 = lambda x0: s2 * 1e-6 / (2 * EPS0) * np.sign(x0 - 1.0)
        xp = {"between the sheets": 0.5, "to the right of both sheets": 2.0, "to the left of both sheets": -1.0}[reg]
        E = e1(xp) + e2(xp)
        Eclosed = {"between the sheets": (s1 - s2) * 1e-6 / (2 * EPS0), "to the right of both sheets": (s1 + s2) * 1e-6 / (2 * EPS0), "to the left of both sheets": -(s1 + s2) * 1e-6 / (2 * EPS0)}[reg]
        agree(E, Eclosed, 1e-9, "E")
        if abs(E) > 1e3 and abs(abs(s1) - abs(s2)) > 0.5 and s1 * s2 != 0:
            break
    key, ds = signed_opts(E, [("Uses $\\sigma/\\varepsilon_0$ for each sheet, doubling the field of each infinite sheet.", 2 * E), ("Treats the second sheet as if it had the opposite sign of charge.", e1(xp) - e2(xp)), ("Gives the field of the first sheet only.", e1(xp)), ("Gives the field of the second sheet only.", e2(xp))], "", fmt=FS(U_NCC))
    stem = f"Two large, parallel, thin nonconducting sheets are perpendicular to the $x$-axis. The first sheet is at $x=0$ with a uniform surface charge density of ${s1:g}\\,\\mu\\text{{C/m}}^{{2}}$ and the second is at $x=1.0\\text{{ m}}$ with ${s2:g}\\,\\mu\\text{{C/m}}^{{2}}$. What is the $x$-component of the electric field {reg}?" + EUSE
    return MQ("pe_gauss_two_sheets", "8.6", "2.C", stem, key, ds, rng, "Fields of infinite sheets superpose, each with magnitude $\\sigma/(2\\varepsilon_0)$", ["Find the signed field of each sheet in the region", "Add the two signed fields"],
              "the signed fields are recomputed with a sign function for each sheet and added", f"Each sheet contributes $\\sigma/(2\\varepsilon_0)$ directed away from a positive sheet; the sum is $E_x={sig(E / 1e3)}\\times10^3\\text{{ N/C}}$.", [f"s1={s1}", f"s2={s2}", f"reg={reg}"], est=105, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_flux_outside_charge_claim(rng):
    qo = pick(rng, [2.0, 3.0, 5.0]); qi = pick(rng, [4.0, 6.0, 8.0]); face = pick(rng, ["cube", "sphere"])
    key, ds = sentence_options(f"The net flux through the {face} depends only on the ${qi:g}\\text{{ nC}}$ charge inside; the outside charge adds as much flux entering as leaving, but it still changes the electric field at points on the surface.", "Gauss's law relates the net flux to the enclosed charge, while the field at each point includes every charge.",
                               [(f"The net flux depends on both charges, because the field at every point on the surface is produced by both.", "Confuses the field at a point, which includes all charges, with the net flux, which counts only the enclosed charge."),
                                (f"The outside charge does not change the electric field at points on the {face}, because it does not change the net flux.", "Believes the field at the surface is unchanged whenever the net flux is unchanged."),
                                (f"The net flux is zero, because an outside charge makes the flux through the {face} cancel to zero.", "Applies the cancellation of the outside charge's flux to the enclosed charge as well.")])
    stem = f"A ${qi:g}\\text{{ nC}}$ point charge is at the center of a closed {face}. A second point charge of ${qo:g}\\text{{ nC}}$ is placed outside the {face}. Which statement about the net electric flux through the {face} and the electric field on its surface is correct and best justified?"
    return MQ("pe_flux_outside_charge_claim", "8.6", "3.B", stem, key, ds, rng, "Net flux counts only enclosed charge, while the field at a point includes all charges", ["Apply Gauss's law to the net flux", "Distinguish the net flux from the local field"],
              "the net flux of a point charge outside a cube is recomputed numerically and is zero", "", [f"qo={qo}", f"qi={qi}", f"face={face}"], est=95, judg=["justification"], cond=[("the surfaces are closed and the charges are point charges", "the stem states a closed surface and point charges")])


@retry_sep
def pe_gauss_enclosed_charge_flux(rng):
    for _ in forever():
        qa = pick(rng, [5.0, 6.0, 8.0, 10.0]); qb = -pick(rng, [2.0, 3.0, 4.0]); qc = pick(rng, [7.0, 9.0, 12.0])
        phi = (qa + qb) * 1e-9 / EPS0
        break
    key, ds = num_opts(phi, [("Includes the charge outside the surface.", (qa + qb + qc) * 1e-9 / EPS0), ("Adds the magnitudes of the enclosed charges.", (qa + abs(qb)) * 1e-9 / EPS0), ("Counts only the positive enclosed charge.", qa * 1e-9 / EPS0), ("Uses the outside charge only.", qc * 1e-9 / EPS0)], "", fmt=FU("\\text{ N}\\cdot\\text{m}^{2}/\\text{C}"))
    stem = f"A closed surface encloses a ${qa:g}\\text{{ nC}}$ charge and a $-{abs(qb):g}\\text{{ nC}}$ charge. A ${qc:g}\\text{{ nC}}$ charge is located outside the surface. What is the net electric flux through the surface?" + EUSE
    return MQ("pe_gauss_enclosed_charge_flux", "8.6", "2.B", stem, key, ds, rng, "Gauss's law gives the net flux from the algebraic sum of the enclosed charge", ["Add only the enclosed charges with their signs", "Divide by $\\varepsilon_0$"],
              "the net flux is recomputed from the signed enclosed charge", f"$\\Phi=Q_{{enc}}/\\varepsilon_0=({qa:g}-{abs(qb):g})\\times10^{{-9}}/\\varepsilon_0={sig(phi)}\\text{{ N}}\\cdot\\text{{m}}^2/\\text{{C}}$.", [f"qa={qa}", f"qb={qb}", f"qc={qc}"], est=65)


@retry_sep
def pe_charged_particle_in_field(rng):
    for _ in forever():
        E = pick(rng, [500.0, 800.0, 1000.0, 2000.0, 3000.0]); L = pick(rng, [0.02, 0.04, 0.05, 0.08])
        a = QE * E / ME; t = math.sqrt(2 * L / a); v = a * t
        y = rk4(lambda tt, s: np.array([s[1], a]), [0.0, 0.0], 0.0, t, 4000); agree(L, y[0], 1e-6, "L"); agree(v, y[1], 1e-6, "v")
        break
    key, ds = num_opts(v, [("Uses $v=\\sqrt{2eEL}$ without dividing by the mass, then treats the result as a speed in m/s.", math.sqrt(2 * QE * E * L)), ("Uses the proton mass instead of the electron mass.", math.sqrt(2 * QE * E * L / MP)), ("Uses $v=\\sqrt{eEL/m}$, leaving out the factor 2.", math.sqrt(QE * E * L / ME)), ("Uses $v=eEL/m$.", QE * E * L / ME)], "", fmt=FS(U_MS1))
    stem = f"An electron is released from rest in a uniform electric field of magnitude ${E:g}\\text{{ N/C}}$ and moves a distance of ${L * 100:g}\\text{{ cm}}$ in the direction of the electric force. What is its speed after that displacement? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$ and $m_e=9.11\\times10^{{-31}}\\text{{ kg}}$."
    return MQ("pe_charged_particle_in_field", "8.3", "2.B", stem, key, ds, rng, "A charge in a uniform field has constant acceleration $a=qE/m$", ["Find the acceleration from $F=qE$", "Use constant-acceleration kinematics or the work-energy theorem"],
              "an RK4 integration of the equation of motion recomputes the speed", f"$a=eE/m$ and $v=\\sqrt{{2aL}}={sig(v / 1e6)}\\times10^{{6}}\\text{{ m/s}}$.", [f"E={E}", f"L={L}"], est=95)


@retry_sep
def pe_hanging_ball_field(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0, 5.0]); qq = pick(rng, [2.0, 3.0, 4.0, 5.0]); E = pick(rng, [2000.0, 3000.0, 4000.0, 5000.0])
        th = math.degrees(math.atan(qq * 1e-6 * E / (m * 1e-3 * 9.8)))
        T = math.hypot(qq * 1e-6 * E, m * 1e-3 * 9.8)
        sol = bisect(lambda a_: math.tan(a_) - qq * 1e-6 * E / (m * 1e-3 * 9.8), 1e-6, math.pi / 2 - 1e-6)
        agree(th, math.degrees(sol), 1e-9, "th")
        if 10 < th < 70:
            break
    key, ds = num_opts(th, [("Uses the sine instead of the tangent, $\\arcsin(qE/mg)$.", math.degrees(math.asin(min(1, qq * 1e-6 * E / (m * 1e-3 * 9.8)))) if qq * 1e-6 * E / (m * 1e-3 * 9.8) <= 1 else None), ("Uses the cosine, $\\arccos(qE/mg)$.", math.degrees(math.acos(min(1, qq * 1e-6 * E / (m * 1e-3 * 9.8)))) if qq * 1e-6 * E / (m * 1e-3 * 9.8) <= 1 else None),
                           ("Takes the ratio the wrong way, $\\arctan(mg/qE)$.", math.degrees(math.atan(m * 1e-3 * 9.8 / (qq * 1e-6 * E)))), ("Halves the angle.", th / 2)], "", fmt=lambda v: "$" + sig(v) + "^\\circ$")
    stem = f"A small ball of mass ${m:g}\\text{{ g}}$ and charge ${qq:g}\\,\\mu\\text{{C}}$ hangs from a light insulating thread in a uniform horizontal electric field of magnitude ${E:g}\\text{{ N/C}}$. At equilibrium, what angle does the thread make with the vertical? Use $g=9.8\\text{{ m/s}}^{{2}}$."
    return MQ("pe_hanging_ball_field", "8.3", "2.B", stem, key, ds, rng, "Static equilibrium balances the electric force, the weight and the tension", ["Resolve the tension into vertical and horizontal parts", "Set $\\tan\\theta=qE/(mg)$"],
              "a bisection root finder solves the torque-free equilibrium condition", f"$T\\sin\\theta=qE$ and $T\\cos\\theta=mg$, so $\\theta=\\arctan(qE/mg)={sig(th)}^\\circ$.", [f"m={m}", f"q={qq}", f"E={E}"], est=100, judg=["law_selection", "vector_reasoning"])


STAGE_U8 = ["pe_coulomb_scaling", "pe_coulomb_two_charges", "pe_coulomb_collinear_net", "pe_coulomb_triangle", "pe_coulomb_equilibrium", "pe_charging_induction_claim", "pe_charge_sharing", "pe_charge_sharing_force", "pe_field_point_charge", "pe_field_two_charges_midpoint", "pe_field_zero_point",
            "pe_field_ring_axis", "pe_field_ring_max_position", "pe_field_finite_rod_axis", "pe_field_disk_axis", "pe_field_semicircle_center", "pe_flux_uniform_angle", "pe_flux_cube_face", "pe_gauss_uniform_sphere_inside", "pe_gauss_line_charge", "pe_gauss_nonuniform_rho", "pe_gauss_cylinder_inside",
            "pe_gauss_two_sheets", "pe_flux_outside_charge_claim", "pe_gauss_enclosed_charge_flux", "pe_charged_particle_in_field", "pe_hanging_ball_field"]
