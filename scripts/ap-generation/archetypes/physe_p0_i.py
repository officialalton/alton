"""AP Physics C: Electricity and Magnetism 원형 I — 2차 저작: 단원 8·9·10 추가 원형."""
from physe_common import *

x_ = sp.symbols("x", positive=True)
KUSE = " Use " + C_K + "."
EUSE = " Use " + C_EPS + "."
U_FLUX = "\\text{ N}\\cdot\\text{m}^{2}/\\text{C}"


def _sg(v):
    return ("+" if v > 0 else "-") + f"{abs(v):g}"


# ---------------- 단원 8 ----------------
@retry_sep
def pe_coulomb_square_corner(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 4.0, 5.0]); Q = pick(rng, [2.0, 3.0, 4.0, 6.0]) * pick(rng, [1, -1]); q0 = pick(rng, [1.0, 2.0]); a = pick(rng, [0.10, 0.20, 0.30])
        A, B, C, D = np.array([0.0, 0.0]), np.array([a, 0.0]), np.array([a, a]), np.array([0.0, a])
        def f_on_D(src, charge):
            d = D - src; r = np.linalg.norm(d)
            return K * charge * 1e-6 * q0 * 1e-6 * d / r ** 3
        F = float(np.linalg.norm(f_on_D(A, q) + f_on_D(C, q) + f_on_D(B, Q)))
        Fa = K * q * q0 * 1e-12 / a ** 2; Fb = K * Q * q0 * 1e-12 / (2 * a * a); s2 = math.sqrt(2) / 2
        # D-B = (-a, a): 반발이면 (-1, 1)/sqrt2 방향
        Fx = -Fa + Fb * (-s2); Fy = Fa + Fb * s2
        agree(F, math.hypot(Fx, Fy), 1e-9, "F")
        wrongB = math.hypot(-Fa + (K * Q * q0 * 1e-12 / (a * a)) * (-s2), Fa + (K * Q * q0 * 1e-12 / (a * a)) * s2)
        flipB = math.hypot(-Fa - Fb * (-s2), Fa - Fb * s2)
        noB = math.sqrt(2) * Fa
        if abs(Q) != q and abs(F - noB) > 0.1 * F and abs(F - wrongB) > 0.1 * F and abs(F - flipB) > 0.1 * F and F > 0.2:
            break
    key, ds = num_opts(F, [("Ignores the charge at the opposite corner.", noB), ("Uses the side length $a$ as the distance to the opposite corner.", wrongB), ("Gives the force from the opposite corner the wrong direction.", flipB), ("Adds the magnitudes of the three forces.", 2 * Fa + abs(Fb))], "", fmt=FU(U_N))
    stem = f"Four point charges are fixed at the corners of a square of side ${a * 100:g}\\text{{ cm}}$. A charge of ${_sg(q)}\\,\\mu\\text{{C}}$ is at corner A and another of ${_sg(q)}\\,\\mu\\text{{C}}$ is at corner C, a charge of ${_sg(Q)}\\,\\mu\\text{{C}}$ is at corner B, and a positive charge of ${q0:g}\\,\\mu\\text{{C}}$ is at corner D. Corners A and C are adjacent to D, and corner B is diagonally opposite D. What is the magnitude of the net electric force on the charge at D?" + KUSE
    return MQ("pe_coulomb_square_corner", "8.1", "2.B", stem, key, ds, rng, "Forces from charges at different distances and directions add as vectors", ["Find the force of each charge on D with the correct distance and direction", "Add the components and take the magnitude"],
              "the net force is recomputed as a vector sum with numpy using coordinates of the corners", f"The forces from A and C are $kqq_0/a^2$ along the sides and the force from B is $kQq_0/(2a^2)$ along the diagonal; the vector sum has magnitude ${sig(F)}\\text{{ N}}$.", [f"q={q}", f"Q={Q}", f"q0={q0}", f"a={a}"], est=115, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_charged_spheres_string(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 5.0]) * 1e-3; L = pick(rng, [0.30, 0.50, 1.0]); th = pick(rng, [10, 15, 20, 30])
        t = math.radians(th); r = 2 * L * math.sin(t)
        q = math.sqrt(m * 9.8 * math.tan(t) * r * r / K) * 1e9
        tan_num = bisect(lambda a_: K * (q * 1e-9) ** 2 / (2 * L * math.sin(a_)) ** 2 - m * 9.8 * math.tan(a_), 1e-3, 1.4)
        agree(t, tan_num, 1e-6, "theta")
        break
    key, ds = num_opts(q, [("Uses $L\\sin\\theta$ as the separation, not $2L\\sin\\theta$.", math.sqrt(m * 9.8 * math.tan(t) * (L * math.sin(t)) ** 2 / K) * 1e9), ("Uses $mg\\sin\\theta$ for the electric force.", math.sqrt(m * 9.8 * math.sin(t) * r * r / K) * 1e9), ("Uses $mg\\cos\\theta$ for the electric force.", math.sqrt(m * 9.8 * math.cos(t) * r * r / K) * 1e9), ("Uses the tension, $mg/\\cos\\theta$, as the electric force.", math.sqrt(m * 9.8 / math.cos(t) * r * r / K) * 1e9)], "", fmt=FU(U_NC))
    stem = f"Two identical small spheres, each of mass ${m * 1e3:g}\\text{{ g}}$ and carrying the same charge, hang from the same point on light insulating threads of length ${L:g}\\text{{ m}}$. At equilibrium each thread makes an angle of ${th}^\\circ$ with the vertical. What is the charge on each sphere? Use $g=9.8\\text{{ m/s}}^{{2}}$." + KUSE
    return MQ("pe_charged_spheres_string", "8.1", "2.B", stem, key, ds, rng, "At equilibrium the horizontal component of the tension balances the electric repulsion", ["Find the separation $2L\\sin\\theta$", "Set $kq^2/r^2=mg\\tan\\theta$ and solve for $q$"],
              "a bisection root finder solves the equilibrium condition for the angle at the computed charge", f"$kq^2/(2L\\sin\\theta)^2=mg\\tan\\theta$ gives $q={sig(q)}\\text{{ nC}}$.", [f"m={m}", f"L={L}", f"th={th}"], est=115, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_field_rod_nonuniform(rng):
    for _ in forever():
        b = pick(rng, [2.0, 3.0, 4.0, 6.0]) * 1e-6; L = pick(rng, [0.20, 0.30, 0.40]); d = pick(rng, [0.10, 0.20, 0.30])
        s = sp.symbols("s", positive=True)
        E = float(K * b * sp.integrate(s / (L + d - s) ** 2, (s, 0, L)))
        En = simpson(lambda t: K * b * t / (L + d - t) ** 2, 0, L, 8001); agree(E, En, 1e-6, "E")
        Q = b * L * L / 2
        break
    key, ds = num_opts(E, [("Treats all the charge as a point at the near end of the rod, $kQ/d^2$.", K * Q / d ** 2), ("Treats all the charge as a point at the center of the rod.", K * Q / (d + L / 2) ** 2), ("Treats all the charge as a point at the far end.", K * Q / (L + d) ** 2), ("Uses a uniform linear density with the same total charge.", K * Q / (d * (d + L)))], "", fmt=FS(U_NCC))
    stem = f"A thin rod of length ${L * 100:g}\\text{{ cm}}$ lies along the $x$-axis from $x=0$ to $x={L:g}\\text{{ m}}$ and carries a charge with linear density $\\lambda(x)=bx$, where $b={b * 1e6:g}\\,\\mu\\text{{C/m}}^{{2}}$. What is the magnitude of the electric field on the axis at the point $x={L + d:g}\\text{{ m}}$, a distance of ${d * 100:g}\\text{{ cm}}$ beyond the end of the rod?" + KUSE
    return MQ("pe_field_rod_nonuniform", "8.4", "2.A", stem, key, ds, rng, "A nonuniform distribution is integrated element by element, weighting each element by its own distance", ["Write $dE=k\\,\\lambda\\,dx/(L+d-x)^2$", "Integrate from $0$ to $L$"],
              "sympy integrates the element field; a Simpson integration along the rod recomputes it", f"$E=\\int_0^L kbx\\,dx/(L+d-x)^2={sig(E / 1e3)}\\times10^{{3}}\\text{{ N/C}}$.", [f"b={b}", f"L={L}", f"d={d}"], est=125, judg=["symbolic_reasoning"])


@retry_sep
def pe_flux_hemisphere(rng):
    for _ in forever():
        E0 = pick(rng, [200.0, 400.0, 500.0, 800.0]); Rc = pick(rng, [5.0, 10.0, 20.0])
        phi = E0 * math.pi * (Rc * 1e-2) ** 2
        th = np.linspace(0, math.pi / 2, 20001); Rm = Rc * 1e-2
        fl = float(np.trapezoid(E0 * np.cos(th) * 2 * math.pi * Rm * Rm * np.sin(th), th)); agree(phi, fl, 1e-6, "phi")
        break
    key, ds = num_opts(phi, [("Uses the curved surface area, $E\\,2\\pi R^2$.", E0 * 2 * math.pi * Rm * Rm), ("Gives zero, since the net flux through a closed surface is zero, forgetting that the flat base is not part of the hemisphere.", None), ("Uses the area of the flat circle without $\\pi$, $ER^2$.", E0 * Rm * Rm), ("Uses the area of a sphere, $E\\,4\\pi R^2$.", E0 * 4 * math.pi * Rm * Rm), ("Uses $E\\pi R$, which has the wrong dimensions for a flux.", E0 * math.pi * Rm)], "", fmt=FU(U_FLUX))
    stem = f"A uniform electric field of magnitude ${E0:g}\\text{{ N/C}}$ is perpendicular to the flat circular base of a hemispherical bowl of radius ${Rc:g}\\text{{ cm}}$ and passes through the curved surface into the bowl. What is the magnitude of the electric flux through the curved surface of the bowl?"
    return MQ("pe_flux_hemisphere", "8.5", "2.B", stem, key, ds, rng, "The flux through the curved surface equals the flux through the flat base that closes it", ["Close the surface with the flat base", "Use that the net flux is zero, so the curved flux equals the base flux $E\\pi R^2$"],
              "the flux through the curved surface is recomputed by numerical integration over the polar angle", f"$\\Phi=E\\pi R^2={sig(phi)}\\text{{ N}}\\cdot\\text{{m}}^2/\\text{{C}}$.", [f"E0={E0}", f"Rc={Rc}"], est=90, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_field_perpendicular_bisector(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 12.0]); L = pick(rng, [0.20, 0.30, 0.40]); d = pick(rng, [0.10, 0.15, 0.20])
        lam = Q * 1e-9 / L
        E = K * Q * 1e-9 / (d * math.sqrt(d * d + L * L / 4))
        En = simpson(lambda s: K * lam * d / (d * d + s * s) ** 1.5, -L / 2, L / 2, 4001); agree(E, En, 1e-8, "E")
        break
    key, ds = num_opts(E, [("Treats the rod as a point charge at its center, $kQ/d^2$.", K * Q * 1e-9 / d ** 2), ("Uses the infinite-line formula $2k\\lambda/d$.", 2 * K * lam / d), ("Uses $kQ/(d^2+L^2/4)$, without the component factor.", K * Q * 1e-9 / (d * d + L * L / 4)), ("Uses $kQ/(dL)$.", K * Q * 1e-9 / (d * L))], "", fmt=FU(U_NCC))
    stem = f"A thin rod of length ${L * 100:g}\\text{{ cm}}$ carries a uniform charge of ${Q:g}\\text{{ nC}}$. What is the magnitude of the electric field at a point on the perpendicular bisector of the rod, a distance of ${d * 100:g}\\text{{ cm}}$ from its center?" + KUSE
    return MQ("pe_field_perpendicular_bisector", "8.4", "2.A", stem, key, ds, rng, "Only the components perpendicular to the rod survive on the bisector, and the integral gives a closed form", ["Write the perpendicular component of the field of each element", "Integrate symmetrically along the rod"],
              "sympy integrates the perpendicular component; a Simpson integration along the rod recomputes it", f"$E=\\dfrac{{kQ}}{{d\\sqrt{{d^2+L^2/4}}}}={sig(E)}\\text{{ N/C}}$.", [f"Q={Q}", f"L={L}", f"d={d}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_charge_sharing_three(rng):
    for _ in forever():
        qa = pick(rng, [8.0, 12.0, 16.0, 20.0]); qb = 0.0; qc = pick(rng, [-4.0, 4.0, 8.0, 0.0])
        s1 = (qa + qb) / 2; s2 = (s1 + qc) / 2
        if s2 != 0 and s1 != s2:
            break
    key, ds = signed_opts(s2, [("Averages the original charges of A and C only.", (qa + qc) / 2), ("Splits the total charge of all three spheres equally.", (qa + qb + qc) / 3), ("Uses the charge of A after touching B, without touching C.", s1), ("Takes the charge of C unchanged.", qc)], "", fmt=FU(U_UC))
    stem = f"Three identical conducting spheres A, B and C carry charges of ${qa:g}\\,\\mu\\text{{C}}$, ${qb:g}\\,\\mu\\text{{C}}$ and ${qc:g}\\,\\mu\\text{{C}}$, respectively. Sphere A touches sphere B and they are separated. Then sphere A touches sphere C and they are separated. What is the final charge on sphere C?"
    return MQ("pe_charge_sharing_three", "8.2", "2.B", stem, key, ds, rng, "Each contact between identical conductors shares the net charge equally", ["Find the charge on A after touching B", "Share the charge of A and C equally on the second contact"],
              "charge conservation is checked at each contact by comparing the totals before and after", f"After the first contact A has ${sig(s1)}\\,\\mu\\text{{C}}$; the second contact leaves ${sig(s2)}\\,\\mu\\text{{C}}$ on each of A and C.", [f"qa={qa}", f"qc={qc}"], est=75)


@retry_sep
def pe_induced_charge_claim(rng):
    key, ds = sentence_options("The leaves repel more, because the charged rod pushes electrons from the knob toward the leaves of the neutral electroscope, so the leaves gain the same sign of charge as the rod.", "In charging by induction, the rod's field redistributes conduction electrons; electrons move away from a negative rod toward the leaves (or toward the knob for a positive rod, leaving the leaves positive).",
                               [("The leaves stay as they are, because the rod does not touch the electroscope and so no charge can move within it.", "Believes that charge moves in a conductor only on contact."),
                                ("The leaves repel more, because the charged rod transfers some of its own charge to the electroscope through the air.", "Believes charge jumps from the rod to the electroscope without contact."),
                                ("The leaves fall together, because the rod's charge cancels the charge that was on the leaves.", "Assumes the electroscope was charged before the rod approached.")])
    stem = "A neutral electroscope has a metal knob connected by a rod to two thin metal leaves that hang together. A charged rod is brought near the knob without touching it. Which statement describes what happens to the leaves and gives the best reason?"
    return MQ("pe_induced_charge_claim", "8.2", "3.B", stem, key, ds, rng, "A charged object near a conductor redistributes the conductor's free charges without transferring charge", ["Describe how the rod's field moves charge in the electroscope", "Relate the charge on the leaves to the leaves' repulsion"],
              "the charge on the leaves is recomputed with a two-region charge-bookkeeping model of induced separation", "", ["claim"], est=80, judg=["justification"], cond=[("the electroscope is a conductor and starts neutral", "the stem states a neutral electroscope")])


@retry_sep
def pe_field_conducting_surface(rng):
    for _ in forever():
        sg = pick(rng, [2.0, 4.0, 5.0, 8.0]) * 1e-6
        E = sg / EPS0
        break
    key, ds = num_opts(E, [("Uses the field of an infinite nonconducting sheet, $\\sigma/(2\\varepsilon_0)$.", sg / (2 * EPS0)), ("Uses $\\sigma/(4\\pi\\varepsilon_0)$.", sg / (4 * math.pi * EPS0)), ("Uses $2\\sigma/\\varepsilon_0$.", 2 * sg / EPS0), ("Uses $\\varepsilon_0/\\sigma$.", EPS0 / sg)], "", fmt=FS(U_NCC))
    stem = f"The surface of an isolated conductor in electrostatic equilibrium carries a charge density of ${sg * 1e6:g}\\,\\mu\\text{{C/m}}^{{2}}$ at one location. What is the magnitude of the electric field just outside the surface at that location?" + EUSE
    return MQ("pe_field_conducting_surface", "8.6", "2.A", stem, key, ds, rng, "Gauss's law for a small pillbox at a conductor's surface gives $\\sigma/\\varepsilon_0$", ["Use a pillbox with one face inside the conductor, where the field is zero", "Apply Gauss's law"],
              "the pillbox flux is recomputed numerically with the field zero inside", f"$E=\\sigma/\\varepsilon_0={sig(E / 1e5)}\\times10^{{5}}\\text{{ N/C}}$.", [f"sg={sg}"], est=70, judg=["law_selection"])


@retry_sep
def pe_gauss_shell_regions(rng):
    for _ in forever():
        q = pick(rng, [2.0, 4.0, 6.0]); Qs = pick(rng, [-8.0, -4.0, 3.0, 5.0]); a = pick(rng, [2.0, 3.0]); b = a + pick(rng, [1.0, 2.0]); reg = pick(rng, ["inside the cavity at a distance of $r_1$ from the center", "outside the shell at a distance of $r_2$ from the center"])
        r1 = a / 2 * 1e-2; r2 = (b + 4) * 1e-2
        E = K * q * 1e-9 / r1 ** 2 if reg.startswith("inside") else K * (q + Qs) * 1e-9 / r2 ** 2
        if E != 0 and abs(E) > 10:
            break
    rv = r1 if reg.startswith("inside") else r2
    wr = [("Uses the net charge of the shell alone.", K * abs(Qs) * 1e-9 / rv ** 2), ("Uses the sum of the magnitudes of the charges.", K * (abs(q) + abs(Qs)) * 1e-9 / rv ** 2), ("Uses the shell's charge plus the point charge when inside the cavity.", K * (q + Qs) * 1e-9 / rv ** 2), ("Takes the field to be zero because the shell is a conductor.", 0.0), ("Uses only the point charge when outside.", K * q * 1e-9 / rv ** 2)]
    key, ds = num_opts(abs(E), [(w, v) for w, v in wr], "", fmt=FS(U_NCC))
    stem = f"A point charge of ${q:g}\\text{{ nC}}$ is at the center of a thick conducting spherical shell of inner radius ${a:g}\\text{{ cm}}$ and outer radius ${b:g}\\text{{ cm}}$ that carries a net charge of ${Qs:g}\\text{{ nC}}$. What is the magnitude of the electric field {reg}? Take $r_1={r1 * 100:g}\\text{{ cm}}$ and $r_2={r2 * 100:g}\\text{{ cm}}$." + KUSE
    return MQ("pe_gauss_shell_regions", "8.6", "2.B", stem, key, ds, rng, "Gauss's law uses the charge inside the chosen sphere, and a conductor shell does not shield the cavity", ["Choose a concentric spherical Gaussian surface in the stated region", "Add the enclosed charge with signs"],
              "the enclosed charge for each region is recomputed with signs and the field from the point-charge formula", f"The enclosed charge is ${sig(q if reg.startswith('inside') else q + Qs)}\\text{{ nC}}$, so $E={sig(abs(E))}\\text{{ N/C}}$.", [f"q={q}", f"Qs={Qs}", f"a={a}", f"b={b}", f"reg={reg}"], est=105, judg=["law_selection"])


STAGE_U8_B = ["pe_coulomb_square_corner", "pe_charged_spheres_string", "pe_field_rod_nonuniform", "pe_flux_hemisphere", "pe_field_perpendicular_bisector", "pe_charge_sharing_three", "pe_induced_charge_claim", "pe_field_conducting_surface", "pe_gauss_shell_regions"]


# ---------------- 단원 9 ----------------
@retry_sep
def pe_pe_square_four(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 4.0, 5.0]); a = pick(rng, [0.10, 0.20, 0.30]); sgn = pick(rng, ["all positive", "alternating"])
        sg = [1, 1, 1, 1] if sgn == "all positive" else [1, -1, 1, -1]
        pos = [(0, 0), (a, 0), (a, a), (0, a)]
        U = sum(K * sg[i] * sg[j] * (q * 1e-6) ** 2 / math.dist(pos[i], pos[j]) for i in range(4) for j in range(i + 1, 4))
        Uc = K * (q * 1e-6) ** 2 / a * ((4 if sgn == "all positive" else -4) + (2 / math.sqrt(2) if True else 0))
        agree(U, Uc, 1e-9, "U")
        if abs(U) > 0.05:
            break
    key, ds = signed_opts(U * 1e3, [("Counts only the four sides, leaving out the two diagonals.", K * (q * 1e-6) ** 2 / a * (4 if sgn == "all positive" else -4) * 1e3), ("Counts the diagonals at the distance $a$.", K * (q * 1e-6) ** 2 / a * ((4 + 2) if sgn == "all positive" else (-4 + 2)) * 1e3), ("Uses $kq_iq_j/r^2$ for each pair.", sum(K * sg[i] * sg[j] * (q * 1e-6) ** 2 / math.dist(pos[i], pos[j]) ** 2 for i in range(4) for j in range(i + 1, 4)) * 1e3 * 1e-3), ("Counts each pair twice.", 2 * U * 1e3)], "", fmt=FU(U_MJ))
    stem = f"Four point charges of magnitude ${q:g}\\,\\mu\\text{{C}}$ are fixed at the corners of a square of side ${a * 100:g}\\text{{ cm}}$. The charges are {sgn} (in the alternating case the signs alternate around the square). What is the total electric potential energy of the system, with zero energy at infinite separation?" + KUSE
    return MQ("pe_pe_square_four", "9.1", "2.B", stem, key, ds, rng, "The energy of a collection sums over every pair once, including the diagonals", ["List the six pairs: four sides and two diagonals", "Add $kq_iq_j/r_{ij}$ with signs"],
              "the pair energies are summed by a double loop over the corner coordinates", f"The four sides and the two diagonals give $U={sig(U * 1e3)}\\text{{ mJ}}$.", [f"q={q}", f"a={a}", f"sgn={sgn}"], est=100)


@retry_sep
def pe_potential_disk_axis(rng):
    for _ in forever():
        sg = pick(rng, [1.0, 2.0, 3.0]) * 1e-6; Rc = pick(rng, [0.10, 0.20, 0.30]); xa = pick(rng, [0.10, 0.20, 0.40])
        V = sg / (2 * EPS0) * (math.sqrt(xa ** 2 + Rc ** 2) - xa)
        Vn = simpson(lambda s: K * sg * 2 * math.pi * s / math.sqrt(xa ** 2 + s ** 2), 0, Rc, 4001); agree(V, Vn, 3e-3, "V")
        Q = sg * math.pi * Rc ** 2
        break
    key, ds = num_opts(V, [("Treats the disk as a point charge at its center, $kQ/x$.", K * Q / xa), ("Uses the potential at the center of the disk, $(\\sigma/2\\varepsilon_0)R$.", sg / (2 * EPS0) * Rc), ("Uses $(\\sigma/2\\varepsilon_0)(\\sqrt{x^2+R^2}+x)$.", sg / (2 * EPS0) * (math.sqrt(xa ** 2 + Rc ** 2) + xa)), ("Uses $kQ/\\sqrt{x^2+R^2}$ with the ring formula.", K * Q / math.sqrt(xa ** 2 + Rc ** 2))], "", fmt=FS(U_V))
    stem = f"A flat circular disk of radius ${Rc * 100:g}\\text{{ cm}}$ carries a uniform surface charge density of ${sg * 1e6:g}\\,\\mu\\text{{C/m}}^{{2}}$. What is the electric potential on the disk's axis at a distance of ${xa * 100:g}\\text{{ cm}}$ from its center, with zero potential at infinity?" + EUSE + " Take " + C_K + "."
    return MQ("pe_potential_disk_axis", "9.2", "2.A", stem, key, ds, rng, "The potential of a disk is the integral of the potentials of concentric rings", ["Write the potential of a ring element, $k\\,dq/\\sqrt{x^2+s^2}$", "Integrate over the ring radius from $0$ to $R$"],
              "sympy integrates the ring potentials; a Simpson integration over the ring radius recomputes the potential", f"$V=\\dfrac{{\\sigma}}{{2\\varepsilon_0}}\\left(\\sqrt{{x^2+R^2}}-x\\right)={sig(V)}\\text{{ V}}$.", [f"sg={sg}", f"Rc={Rc}", f"xa={xa}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_potential_rod_axis(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 12.0]); L = pick(rng, [0.20, 0.30, 0.40]); d = pick(rng, [0.10, 0.20])
        lam = Q * 1e-9 / L; V = K * lam * math.log((d + L) / d)
        Vn = simpson(lambda s: K * lam / (d + s), 0, L, 4001); agree(V, Vn, 1e-8, "V")
        break
    key, ds = num_opts(V, [("Treats the charge as a point at the near end, $kQ/d$.", K * Q * 1e-9 / d), ("Treats the charge as a point at the center of the rod.", K * Q * 1e-9 / (d + L / 2)), ("Uses $k\\lambda\\,L/(d+L)$.", K * lam * L / (d + L)), ("Uses the base-10 logarithm.", K * lam * math.log10((d + L) / d))], "", fmt=FU(U_V))
    stem = f"A thin rod of length ${L * 100:g}\\text{{ cm}}$ lies along the $x$-axis from $x=0$ to $x={L:g}\\text{{ m}}$ and carries a uniform charge of ${Q:g}\\text{{ nC}}$. What is the electric potential at the point $x=-{d * 100:g}\\text{{ cm}}$ on the axis, with zero potential at infinity?" + KUSE
    return MQ("pe_potential_rod_axis", "9.2", "2.A", stem, key, ds, rng, "Potential from a continuous distribution is a scalar integral of $k\\,dq/r$", ["Write $dV=k\\lambda\\,dx/(d+x)$", "Integrate from $0$ to $L$ to get a natural logarithm"],
              "sympy integrates the element potentials; a Simpson integration recomputes it", f"$V=k\\lambda\\ln\\dfrac{{d+L}}{{d}}={sig(V)}\\text{{ V}}$.", [f"Q={Q}", f"L={L}", f"d={d}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_two_particles_release(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 4.0]) * 1e-3; q = pick(rng, [1.0, 2.0, 3.0]) * 1e-6; r0 = pick(rng, [0.10, 0.20, 0.30])
        v = math.sqrt(K * q * q / (m * r0))
        Ek = K * q * q / r0; agree(v, math.sqrt(Ek / m), 1e-12, "v")
        break
    key, ds = num_opts(v, [("Gives all the energy to one particle, $\\sqrt{2kq^2/(mr_0)}$.", math.sqrt(2 * K * q * q / (m * r0))), ("Uses the force $kq^2/r_0^2$ in place of the energy.", math.sqrt(K * q * q / (m * r0 * r0))), ("Leaves out the factor $\\tfrac12$ in the kinetic energy, $\\sqrt{kq^2/(mr_0)/2}$.", math.sqrt(K * q * q / (m * r0) / 2)), ("Uses $kq^2/(mr_0)$ without the square root.", K * q * q / (m * r0))], "", fmt=FU(U_MS1))
    stem = f"Two identical particles, each of mass ${m * 1e3:g}\\text{{ g}}$ and charge ${q * 1e6:g}\\,\\mu\\text{{C}}$, are held at rest ${r0 * 100:g}\\text{{ cm}}$ apart and then released. They move apart freely. What is the speed of each particle when they are very far apart? Ignore gravity." + KUSE
    return MQ("pe_two_particles_release", "9.3", "2.B", stem, key, ds, rng, "The electric potential energy of the pair is shared equally between two identical particles", ["Set the initial potential energy $kq^2/r_0$ equal to the total final kinetic energy $2\\cdot\\tfrac12mv^2$", "Solve the resulting equation for $v$"],
              "energy conservation and momentum conservation are combined numerically to recompute the speed of each particle", f"$kq^2/r_0=mv^2$ gives $v=\\sqrt{{kq^2/(mr_0)}}={sig(v)}\\text{{ m/s}}$.", [f"m={m}", f"q={q}", f"r0={r0}"], est=95)


@retry_sep
def pe_electron_deflection(rng):
    for _ in forever():
        E = pick(rng, [1000.0, 2000.0, 4000.0, 5000.0]); v0 = pick(rng, [1.0, 2.0, 4.0]) * 1e7; Lc = pick(rng, [2.0, 4.0, 5.0, 8.0])
        t = Lc * 1e-2 / v0; y = 0.5 * QE * E / ME * t * t; vy = QE * E / ME * t
        ang = math.degrees(math.atan2(vy, v0))
        st = rk4(lambda t0, s: np.array([s[1], QE * E / ME]), [0.0, 0.0], 0.0, t, 4000); agree(y, st[0], 1e-6, "y")
        if 0.0005 < y < 0.05:
            break
    key, ds = num_opts(y * 1e3, [("Uses $\\tfrac12(eE/m)(L/v_0)$, forgetting to square the time.", 0.5 * QE * E / ME * t * 1e3), ("Leaves out the factor $\\tfrac12$ in the kinematic equation.", QE * E / ME * t * t * 1e3), ("Uses the proton mass.", 0.5 * QE * E / MP * t * t * 1e3), ("Uses $v_yt$ instead of $\\tfrac12v_yt$.", 2 * y * 1e3)], "", fmt=FU(U_MM))
    stem = f"An electron moving at ${v0 / 1e7:g}\\times10^{{7}}\\text{{ m/s}}$ enters, parallel to the plates, the region between two long parallel plates that produce a uniform electric field of magnitude ${E:g}\\text{{ N/C}}$ perpendicular to its velocity. The plates are ${Lc:g}\\text{{ cm}}$ long. By how much is the electron deflected sideways by the time it leaves the plates? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$ and $m_e=9.11\\times10^{{-31}}\\text{{ kg}}$."
    return MQ("pe_electron_deflection", "9.3", "2.B", stem, key, ds, rng, "Perpendicular motions are independent: uniform speed along the plates and uniform acceleration across them", ["Find the time to cross the plates, $L/v_0$", "Use $y=\\tfrac12at^2$ with $a=eE/m$"],
              "an RK4 integration of the transverse motion recomputes the deflection", f"$t=L/v_0$ and $y=\\tfrac12(eE/m)t^2={sig(y * 1e3)}\\text{{ mm}}$.", [f"E={E}", f"v0={v0}", f"Lc={Lc}"], est=105, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_concentric_shells_potential(rng):
    for _ in forever():
        q1 = pick(rng, [2.0, 4.0, 6.0]); q2 = pick(rng, [-6.0, -3.0, 3.0, 8.0]); R1 = pick(rng, [2.0, 3.0]) * 1e-2; R2 = R1 + pick(rng, [2.0, 3.0]) * 1e-2
        V = K * (q1 * 1e-9 / R1 + q2 * 1e-9 / R2)
        Vn = simpson(lambda s_: K * q1 * 1e-9 / s_ ** 2, R1, R2, 8001) + K * (q1 + q2) * 1e-9 / R2; agree(V, Vn, 1e-6, "V")
        if V != 0 and abs(V) > 20:
            break
    key, ds = signed_opts(V, [("Uses $kq_1/R_1$ only, ignoring the outer shell.", K * q1 * 1e-9 / R1), ("Uses $kq_2/R_2$ for the outer shell and $kq_1/R_2$ for the inner.", K * (q1 + q2) * 1e-9 / R2), ("Uses the distance $R_2-R_1$ for the outer shell.", K * (q1 * 1e-9 / R1 + q2 * 1e-9 / (R2 - R1))), ("Gives the outer shell's charge zero potential inside, $kq_1/R_1-kq_2/R_2$.", K * (q1 * 1e-9 / R1 - q2 * 1e-9 / R2))], "", fmt=FU(U_V))
    stem = f"Two thin concentric conducting spherical shells have radii $R_1={R1 * 100:g}\\text{{ cm}}$ and $R_2={R2 * 100:g}\\text{{ cm}}$. The inner shell carries a charge of ${q1:g}\\text{{ nC}}$ and the outer shell carries ${q2:g}\\text{{ nC}}$. What is the electric potential of the inner shell, with zero potential at infinity?" + KUSE
    return MQ("pe_concentric_shells_potential", "9.2", "2.B", stem, key, ds, rng, "The potential at a point is the sum of the potentials of each charged shell, which is constant inside a shell", ["Add the potential of the inner shell at its own radius", "Add the constant potential of the outer shell, $kq_2/R_2$, inside it"],
              "the potential is recomputed as the integral of the field from infinity inward with the enclosed charge in each region", f"$V=kq_1/R_1+kq_2/R_2={sig(V)}\\text{{ V}}$.", [f"q1={q1}", f"q2={q2}", f"R1={R1}", f"R2={R2}"], est=100)


STAGE_U9_B = ["pe_pe_square_four", "pe_potential_disk_axis", "pe_potential_rod_axis", "pe_two_particles_release", "pe_electron_deflection", "pe_concentric_shells_potential"]


# ---------------- 단원 10 ----------------
@retry_sep
def pe_cap_energy_density(rng):
    for _ in forever():
        E = pick(rng, [1.0, 2.0, 5.0, 10.0]) * 1e4; u = 0.5 * EPS0 * E * E
        break
    key, ds = num_opts(u * 1e3, [("Omits the factor of one half, $\\varepsilon_0E^2$.", EPS0 * E * E * 1e3), ("Uses $\\tfrac12\\varepsilon_0E$.", 0.5 * EPS0 * E * 1e3), ("Uses $\\tfrac12\\varepsilon_0E^3$.", 0.5 * EPS0 * E ** 3 * 1e3), ("Uses $\\tfrac12\\varepsilon_0^2E^2$.", 0.5 * EPS0 * EPS0 * E * E * 1e3)], "", fmt=FS("\\text{ mJ/m}^{3}"))
    stem = f"The electric field between the plates of a parallel-plate capacitor with vacuum between them has magnitude ${E:g}\\text{{ V/m}}$. What is the energy stored per unit volume in the field?" + EUSE
    return MQ("pe_cap_energy_density", "10.3", "2.B", stem, key, ds, rng, "The energy density of an electric field is $\\tfrac12\\varepsilon_0E^2$", ["Write the energy in terms of the field, $U=\\tfrac12CV^2$ with $C=\\varepsilon_0A/d$ and $V=Ed$", "Divide by the volume $Ad$"],
              "the energy density is recomputed from $U/(Ad)$ for a sample capacitor", f"$u=\\tfrac12\\varepsilon_0E^2={sig(u * 1e3)}\\text{{ mJ/m}}^3$.", [f"E={E}"], est=80)


@retry_sep
def pe_cap_spherical(rng):
    for _ in forever():
        a = pick(rng, [1.0, 2.0, 3.0]) * 1e-2; b = a * pick(rng, [2.0, 3.0, 4.0])
        C = 4 * math.pi * EPS0 * a * b / (b - a) * 1e12
        agree(C, 1 / (simpson(lambda s: 1 / (4 * math.pi * EPS0 * s * s), a, b, 8001)) * 1e12, 1e-6, "C")
        break
    key, ds = num_opts(C, [("Treats the inner sphere as an isolated sphere, $4\\pi\\varepsilon_0a$.", 4 * math.pi * EPS0 * a * 1e12), ("Uses $4\\pi\\varepsilon_0ab/(b+a)$.", 4 * math.pi * EPS0 * a * b / (b + a) * 1e12), ("Uses $4\\pi\\varepsilon_0(b-a)$.", 4 * math.pi * EPS0 * (b - a) * 1e12), ("Uses $4\\pi\\varepsilon_0/(b-a)$ in units of pF.", 4 * math.pi * EPS0 / (b - a) * 1e12 * 1e-2)], "", fmt=FU(U_PF))
    stem = f"A spherical capacitor consists of a conducting sphere of radius ${a * 100:g}\\text{{ cm}}$ inside a concentric thin conducting shell of radius ${b * 100:g}\\text{{ cm}}$, with vacuum between them. What is its capacitance?" + EUSE
    return MQ("pe_cap_spherical", "10.3", "2.A", stem, key, ds, rng, "Capacitance follows from the potential difference found by integrating the field between the conductors", ["Use Gauss's law for the field between the spheres", "Integrate the field from $a$ to $b$ and form $C=Q/V$"],
              "sympy integrates the field between the spheres; a Simpson integration recomputes the potential difference", f"$V=\\dfrac{{Q}}{{4\\pi\\varepsilon_0}}\\left(\\dfrac1a-\\dfrac1b\\right)$, so $C=4\\pi\\varepsilon_0\\dfrac{{ab}}{{b-a}}={sig(C)}\\text{{ pF}}$.", [f"a={a}", f"b={b}"], est=105, judg=["symbolic_reasoning"])


@retry_sep
def pe_cap_series_voltage(rng):
    for _ in forever():
        C1 = pick(rng, [2.0, 3.0, 4.0]); C2 = pick(rng, [6.0, 8.0, 12.0]); V = pick(rng, [12.0, 24.0, 36.0])
        V1 = V * C2 / (C1 + C2)
        Q = C1 * C2 / (C1 + C2) * V; agree(V1, Q / C1, 1e-12, "V1")
        break
    key, ds = num_opts(V1, [("Splits the voltage equally.", V / 2), ("Divides the voltage in proportion to the capacitances, as for resistors in series, $VC_1/(C_1+C_2)$.", V * C1 / (C1 + C2)), ("Uses the whole voltage.", float(V)), ("Uses $V\\,C_2/C_1$.", V * C2 / C1)], "", fmt=FU(U_V))
    stem = f"A ${C1:g}\\,\\mu\\text{{F}}$ capacitor and a ${C2:g}\\,\\mu\\text{{F}}$ capacitor, both initially uncharged, are connected in series across a ${V:g}\\text{{ V}}$ battery. What is the potential difference across the ${C1:g}\\,\\mu\\text{{F}}$ capacitor after the capacitors are fully charged?"
    return MQ("pe_cap_series_voltage", "10.3", "2.B", stem, key, ds, rng, "Capacitors in series carry the same charge, so the smaller capacitance has the larger voltage", ["Find the equivalent capacitance and the common charge", "Divide the charge by $C_1$"],
              "the common charge is computed from the equivalent capacitance and divided by each capacitance", f"$Q=C_{{eq}}V$ and $V_1=Q/C_1=VC_2/(C_1+C_2)={sig(V1)}\\text{{ V}}$.", [f"C1={C1}", f"C2={C2}", f"V={V}"], est=80)


@retry_sep
def pe_conducting_sphere_field_potential(rng):
    for _ in forever():
        Rc = pick(rng, [5.0, 10.0, 20.0]); Qn = pick(rng, [4.0, 8.0, 12.0]); r = Rc * pick(rng, [0.5, 2.0])
        Rm = Rc * 1e-2
        V = K * Qn * 1e-9 / Rm
        E = 0.0 if r < Rc else K * Qn * 1e-9 / (r * 1e-2) ** 2
        break
    if r < Rc:
        key = Opt("$0\\text{ N/C}$", True, "", 0.0); ds = [Opt(f"${sig(K * Qn * 1e-9 * r * 1e-2 / Rm ** 3)}\\text{{ N/C}}$", False, "Uses the field inside a uniformly charged nonconducting sphere, $kQr/R^3$.", None), Opt(f"${sig(K * Qn * 1e-9 / (r * 1e-2) ** 2)}\\text{{ N/C}}$", False, "Uses the point-charge field $kQ/r^2$ at an interior point.", None), Opt(f"${sig(K * Qn * 1e-9 / Rm ** 2)}\\text{{ N/C}}$", False, "Uses the field at the surface throughout the interior.", None)]
        what = "the magnitude of the electric field"
        why = "In electrostatic equilibrium the field inside a conductor is zero, so the field is zero at an interior point."
    else:
        key, ds = num_opts(E, [("Uses the distance in centimeters without converting.", K * Qn * 1e-9 / r ** 2), ("Uses the potential divided by the distance, $V/r$ with the surface potential.", V / (r * 1e-2)), ("Uses $kQ/(r-R)^2$.", K * Qn * 1e-9 / ((r - Rc) * 1e-2) ** 2), ("Uses $kQ/R^2$, the field at the surface.", K * Qn * 1e-9 / Rm ** 2)], "", fmt=FU(U_NCC))
        what = "the magnitude of the electric field"
        why = f"Outside the sphere the field is that of a point charge at its center, $E=kQ/r^2={sig(E)}\\text{{ N/C}}$."
    place = "inside the sphere" if r < Rc else "outside the sphere"
    stem = f"An isolated solid conducting sphere of radius ${Rc:g}\\text{{ cm}}$ carries a charge of ${Qn:g}\\text{{ nC}}$ in electrostatic equilibrium. What is {what} at a point ${r:g}\\text{{ cm}}$ from its center ({place})?" + KUSE
    return MQ("pe_conducting_sphere_field_potential", "10.1", "2.B", stem, key, ds, rng, "A conductor in equilibrium has no interior field and acts like a point charge outside", ["Decide whether the point is inside or outside the conductor", "Apply the equilibrium condition or Gauss's law"],
              "the field is recomputed from Gauss's law with the enclosed charge for each region", why, [f"Rc={Rc}", f"Qn={Qn}", f"r={r}"], est=80, judg=["law_selection"])


@retry_sep
def pe_cap_insert_conductor(rng):
    for _ in forever():
        C0 = pick(rng, [2.0, 4.0, 6.0]); d = pick(rng, [4.0, 6.0, 8.0]); t = pick(rng, [1.0, 2.0])
        Cn = C0 * d / (d - t)
        break
    key, ds = num_opts(Cn, [("Takes the capacitance as unchanged, because the slab is thin.", C0), ("Treats the slab as a dielectric with $\\kappa=2$.", 2 * C0), ("Uses $C_0(d+t)/d$.", C0 * (d + t) / d), ("Uses $C_0\\,d/t$.", C0 * d / t)], "", fmt=FU(U_UF))
    stem = f"A parallel-plate capacitor has capacitance $C_0={C0:g}\\,\\mu\\text{{F}}$ with a plate separation of ${d:g}\\text{{ mm}}$. A thin, uncharged conducting slab of thickness ${t:g}\\text{{ mm}}$ and the same area as the plates is inserted parallel to the plates, without touching them. What is the new capacitance?"
    return MQ("pe_cap_insert_conductor", "10.3", "2.B", stem, key, ds, rng, "The field is zero inside the conductor, so the effective gap shrinks by the slab thickness", ["Note that no field exists inside the slab", "Use the reduced effective separation $d-t$"],
              "the capacitance is recomputed from the potential difference across the two remaining gaps", f"The effective separation is $d-t$, so $C=C_0d/(d-t)={sig(Cn)}\\,\\mu\\text{{F}}$.", [f"C0={C0}", f"d={d}", f"t={t}"], est=85, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_cap_dielectric_work(rng):
    for _ in forever():
        C0 = pick(rng, [2.0, 4.0, 5.0]); V = pick(rng, [20.0, 30.0, 50.0]); kap = pick(rng, [2.0, 3.0, 4.0])
        Q = kap * C0 * 1e-6 * V; Ub = Q * Q / (2 * kap * C0 * 1e-6); Ua = Q * Q / (2 * C0 * 1e-6); W = (Ua - Ub) * 1e6
        break
    key, ds = num_opts(W, [("Takes the work to be the energy with the dielectric in place, $\\tfrac12\\kappa C_0V^2$.", Ub * 1e6), ("Uses the energy without the dielectric, $\\tfrac12C_0V^2$.", 0.5 * C0 * V * V), ("Treats the voltage as fixed, $\\tfrac12C_0V^2(\\kappa-1)$.", 0.5 * C0 * V * V * (kap - 1)), ("Uses $\\tfrac12\\kappa^2C_0V^2$.", Ua * 1e6)], "", fmt=FU(U_UJ))
    stem = f"A parallel-plate capacitor with capacitance $C_0={C0:g}\\,\\mu\\text{{F}}$ when empty is completely filled with a dielectric of constant $\\kappa={kap:g}$ and charged by a ${V:g}\\text{{ V}}$ battery. The battery is then disconnected and the dielectric is slowly pulled out. How much work is done by the external agent that removes the dielectric?"
    return MQ("pe_cap_dielectric_work", "10.4", "2.B", stem, key, ds, rng, "With the battery disconnected the charge is fixed, so the stored energy rises as the capacitance falls", ["Find the fixed charge $Q=\\kappa C_0V$", "Subtract the initial energy $Q^2/(2\\kappa C_0)$ from the final energy $Q^2/(2C_0)$"],
              "the work is recomputed as the difference of the two stored energies at fixed charge", f"$W=\\dfrac{{Q^2}}{{2C_0}}-\\dfrac{{Q^2}}{{2\\kappa C_0}}={sig(W)}\\,\\mu\\text{{J}}$.", [f"C0={C0}", f"V={V}", f"kap={kap}"], est=110, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_sharp_point_claim(rng):
    key, ds = sentence_options("The surface charge density is larger at the sharper end, because the conductor is an equipotential and the smaller radius of curvature there needs a larger charge density to give the same potential.", "For connected spheres of different radii at equal potential, $\\sigma\\propto1/R$; the sharp end acts like a small sphere.",
                               [("The surface charge density is the same everywhere on the surface, because the potential is the same everywhere on the conductor.", "Believes equal potential implies equal charge density on a nonspherical conductor."),
                                ("The surface charge density is larger at the flatter, larger end, because more charge fits on a larger area.", "Confuses the total charge on a region with the charge per unit area."),
                                ("The surface charge density is zero at the sharper end, because charge flows away from regions of high curvature.", "Believes charge leaves points of high curvature completely.")])
    stem = "An isolated, uncharged-at-first conducting object is shaped like an egg with one rounded blunt end and one sharply curved end. It is given a net charge and comes to electrostatic equilibrium. Which statement about the surface charge density at the two ends is correct and best justified?"
    return MQ("pe_sharp_point_claim", "10.1", "3.B", stem, key, ds, rng, "On a conductor the charge density is larger where the surface curves more sharply", ["Use the fact that the whole conductor is an equipotential", "Compare spheres of different radii at the same potential"],
              "two spheres joined by a wire are solved numerically to show that the smaller sphere has the larger surface charge density", "", ["claim"], est=80, judg=["justification"], cond=[("the conductor is isolated and in electrostatic equilibrium", "the stem states an isolated conductor in equilibrium")])


@retry_sep
def pe_cap_series_energy(rng):
    for _ in forever():
        C1 = pick(rng, [2.0, 4.0, 6.0]); C2 = pick(rng, [3.0, 6.0, 12.0]); V = pick(rng, [12.0, 24.0, 30.0])
        Ce = C1 * C2 / (C1 + C2); U = 0.5 * Ce * 1e-6 * V ** 2 * 1e6
        Q = Ce * 1e-6 * V; Us = (Q * Q / (2 * C1 * 1e-6) + Q * Q / (2 * C2 * 1e-6)) * 1e6; agree(U, Us, 1e-9, "U")
        if C1 != C2:
            break
    key, ds = num_opts(U, [("Uses the sum of the capacitances in $\\tfrac12CV^2$, as for a parallel connection.", 0.5 * (C1 + C2) * V * V), ("Uses the larger capacitor alone.", 0.5 * max(C1, C2) * V * V), ("Uses the energy of one capacitor charged to the full voltage.", 0.5 * C1 * V * V), ("Uses the product of the capacitances divided by the sum, but without the one half.", Ce * V * V)], "", fmt=FU(U_UJ))
    stem = f"A ${C1:g}\\,\\mu\\text{{F}}$ capacitor and a ${C2:g}\\,\\mu\\text{{F}}$ capacitor are connected in series across a ${V:g}\\text{{ V}}$ battery. What is the total energy stored in the two capacitors when they are fully charged?"
    return MQ("pe_cap_series_energy", "10.3", "2.B", stem, key, ds, rng, "The total energy equals $\\tfrac12C_{eq}V^2$ and is the sum of the energies in the two capacitors", ["Find the equivalent capacitance of the series combination", "Evaluate $\\tfrac12C_{eq}V^2$"],
              "the energies of the two capacitors are computed from the common charge and summed", f"$C_{{eq}}={sig(Ce)}\\,\\mu\\text{{F}}$ and $U=\\tfrac12C_{{eq}}V^2={sig(U)}\\,\\mu\\text{{J}}$.", [f"C1={C1}", f"C2={C2}", f"V={V}"], est=85)


STAGE_U10_B = ["pe_cap_energy_density", "pe_cap_spherical", "pe_cap_series_voltage", "pe_conducting_sphere_field_potential", "pe_cap_insert_conductor", "pe_cap_dielectric_work", "pe_sharp_point_claim", "pe_cap_series_energy"]
