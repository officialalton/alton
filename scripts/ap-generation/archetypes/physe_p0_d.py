"""AP Physics C: Electricity and Magnetism 원형 D — 단원 12(자기장과 전자기, 12.1–12.4). 정답은 sympy·수치 적분·선형계로 독립 재계산한다."""
from physe_common import *

r_ = sp.symbols("r", positive=True)
MUUSE = " Use " + C_MU + "."


@retry_sep
def pe_force_charge_field(rng):
    for _ in forever():
        q = pick(rng, [2.0, 3.0, 4.0, 5.0]); v = pick(rng, [2.0, 4.0, 5.0, 8.0]) * 1e3; B = pick(rng, [20.0, 40.0, 50.0, 80.0]); th = pick(rng, [30, 37, 45, 53, 60])
        F = q * 1e-6 * v * B * 1e-3 * math.sin(math.radians(th))
        vv = np.array([v, 0.0, 0.0]); Bv = B * 1e-3 * np.array([math.cos(math.radians(th)), math.sin(math.radians(th)), 0.0])
        Fn = float(np.linalg.norm(q * 1e-6 * np.cross(vv, Bv))); agree(F, Fn, 1e-9, "F")
        if abs(math.sin(math.radians(th)) - math.cos(math.radians(th))) > 0.1:
            break
    key, ds = num_opts(F * 1e6, [("Uses the cosine of the angle between $\\vec v$ and $\\vec B$.", q * 1e-6 * v * B * 1e-3 * math.cos(math.radians(th)) * 1e6), ("Ignores the angle, $qvB$.", q * 1e-6 * v * B * 1e-3 * 1e6), ("Uses the tangent of the angle.", q * 1e-6 * v * B * 1e-3 * math.tan(math.radians(th)) * 1e6), ("Uses the sine of the angle with the field in the wrong place, $qvB/\\sin\\theta$.", q * 1e-6 * v * B * 1e-3 / math.sin(math.radians(th)) * 1e6)], "", fmt=FU("\\,\\mu\\text{N}"))
    stem = f"A particle with charge ${q:g}\\,\\mu\\text{{C}}$ moves with speed ${v:g}\\text{{ m/s}}$ through a uniform magnetic field of magnitude ${B:g}\\text{{ mT}}$. The velocity makes an angle of ${th}^\\circ$ with the field. What is the magnitude of the magnetic force on the particle?"
    return MQ("pe_force_charge_field", "12.2", "2.B", stem, key, ds, rng, "The magnetic force is $qvB\\sin\\theta$", ["Identify the angle between the velocity and the field", "Evaluate $F=qvB\\sin\\theta$ in SI units"],
              "the force is recomputed as the norm of $q\\vec v\\times\\vec B$ with numpy", f"$F=qvB\\sin\\theta={sig(F * 1e6)}\\,\\mu\\text{{N}}$.", [f"q={q}", f"v={v}", f"B={B}", f"th={th}"], est=75)


@retry_sep
def pe_cyclotron_radius(rng):
    for _ in forever():
        v = pick(rng, [1.0, 2.0, 3.0, 5.0]) * 1e5; B = pick(rng, [0.10, 0.20, 0.50, 1.0]); which = pick(rng, ["proton", "electron"])
        m = MP if which == "proton" else ME
        r = m * v / (QE * B)
        y = rk4(lambda t0, s: np.array([s[2], s[3], QE * B / m * s[3], -QE * B / m * s[2]]), [0.0, 0.0, v, 0.0], 0.0, math.pi * m / (QE * B), 4000); agree(r, abs(y[1]) / 2, 1e-4, "r")
        break
    other = ME if which == "proton" else MP
    key, ds = num_opts(r * 100, [("Squares the speed in the numerator, with the speed taken in units of $10^5$ m/s.", r * v / 1e5 * 100), ("Multiplies by the field instead of dividing, $mvB/q$.", m * v * B / QE * 100), ("Reports twice the correct radius, mistaking the diameter for the radius.", 2 * r * 100), ("Uses the mass of the other particle.", other * v / (QE * B) * 100)], "", fmt=FU(U_CM))
    stem = f"A {which} moves at ${v / 1e5:g}\\times10^{{5}}\\text{{ m/s}}$ in a plane perpendicular to a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. What is the radius of its circular path? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$ and {'$m_p=1.67\\times10^{-27}\\text{ kg}$' if which == 'proton' else '$m_e=9.11\\times10^{-31}\\text{ kg}$'}."
    return MQ("pe_cyclotron_radius", "12.2", "2.B", stem, key, ds, rng, "The magnetic force supplies the centripetal force", ["Set $qvB=mv^2/r$", "Solve for $r=mv/(qB)$"],
              "an RK4 integration of the equation of motion recomputes the diameter of the circular path", f"$r=mv/(qB)={sig(r * 100)}\\text{{ cm}}$.", [f"v={v}", f"B={B}", f"which={which}"], est=85)


@retry_sep
def pe_velocity_selector(rng):
    for _ in forever():
        B = pick(rng, [0.10, 0.20, 0.50]); E = pick(rng, [1.0, 2.0, 4.0, 5.0]) * 1e4
        v = E / B
        break
    key, ds = num_opts(v, [("Multiplies the fields, $EB$.", E * B), ("Divides the magnetic field by the electric field, $B/E$ times $10^{6}$.", B / E * 1e6), ("Uses $v=E/B^2$.", E / B ** 2), ("Uses $\\sqrt{E/B}$.", math.sqrt(E / B))], "", fmt=FS(U_MS1))
    stem = f"In a velocity selector, a uniform electric field of magnitude ${E:g}\\text{{ V/m}}$ and a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ are perpendicular to each other and to the velocity of a charged particle. What speed must the particle have to pass through undeflected?"
    return MQ("pe_velocity_selector", "12.2", "2.B", stem, key, ds, rng, "Undeflected motion requires the electric and magnetic forces to cancel", ["Set the electric force equal to the magnetic force $qE=qvB$", "Solve for $v=E/B$"],
              "the speed is recomputed by requiring zero net force from the two fields", f"$qE=qvB$ gives $v=E/B={sig(v / 1e3)}\\times10^{{3}}\\text{{ m/s}}$.", [f"E={E}", f"B={B}"], est=65)


@retry_sep
def pe_mass_radius_ratio(rng):
    for _ in forever():
        fm = pick(rng, [2, 3, 4]); fq = pick(rng, [1, 2]); fv = pick(rng, [1, 2])
        f = fm * fv / fq
        if f != 1:
            break
    key, ds = num_opts(f, [("Uses the inverse of the correct factor.", 1 / f), ("Ignores the change in charge.", fm * fv), ("Squares the speed factor, as in the centripetal acceleration.", fm * fv ** 2 / fq), ("Uses the mass and charge factors the wrong way round, $q/m$ times the speed factor.", fq * fv / fm)], "", fmt=lambda v: "$" + sig(v) + "R$")
    stem = f"A charged particle moving at speed $v$ perpendicular to a uniform magnetic field follows a circle of radius $R$. A second particle has ${fm}$ times the mass, ${fq}$ times the charge and ${fv}$ times the speed of the first, and moves perpendicular to the same field. What is the radius of its circular path?"
    return MQ("pe_mass_radius_ratio", "12.2", "2.D", stem, key, ds, rng, "The radius scales as $mv/(qB)$", ["Write $R=mv/(qB)$", "Apply the three factors"],
              "the ratio is recomputed from $mv/(qB)$ for sample values", f"$R\\propto mv/q$, so the new radius is ${fm}\\cdot{fv}/{fq}\\,R={sig(f)}R$.", [f"fm={fm}", f"fq={fq}", f"fv={fv}"], est=70)


@retry_sep
def pe_helix_pitch(rng):
    for _ in forever():
        v = pick(rng, [2.0, 4.0, 5.0]) * 1e5; th = pick(rng, [30, 37, 45, 53, 60]); B = pick(rng, [0.10, 0.20, 0.50])
        vp = v * math.cos(math.radians(th)); T = 2 * math.pi * MP / (QE * B); pitch = vp * T
        break
    key, ds = num_opts(pitch * 100, [("Uses the perpendicular speed component for the pitch.", v * math.sin(math.radians(th)) * T * 100), ("Uses the full speed.", v * T * 100), ("Uses half of the period.", vp * T / 2 * 100), ("Uses the radius of the helix as the pitch.", MP * v * math.sin(math.radians(th)) / (QE * B) * 100)], "", fmt=FU(U_CM))
    stem = f"A proton with speed ${v / 1e5:g}\\times10^{{5}}\\text{{ m/s}}$ enters a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ with its velocity at ${th}^\\circ$ to the field direction. It follows a helical path. What is the pitch of the helix, the distance it advances along the field during one full turn? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$ and $m_p=1.67\\times10^{{-27}}\\text{{ kg}}$."
    return MQ("pe_helix_pitch", "12.2", "2.B", stem, key, ds, rng, "The parallel component sets the advance and the perpendicular component sets the turn", ["Split the velocity into parts along and perpendicular to $\\vec B$", "Multiply the parallel speed by the period $2\\pi m/(qB)$"],
              "the pitch is recomputed by integrating the parallel and perpendicular motion over one period", f"$T=2\\pi m/(qB)$ and the pitch is $v\\cos\\theta\\,T={sig(pitch * 100)}\\text{{ cm}}$.", [f"v={v}", f"th={th}", f"B={B}"], est=100, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_force_on_wire(rng):
    for _ in forever():
        I = pick(rng, [2.0, 3.0, 5.0, 8.0]); L = pick(rng, [0.20, 0.30, 0.50]); B = pick(rng, [0.10, 0.20, 0.40]); th = pick(rng, [30, 45, 60, 90])
        F = I * L * B * math.sin(math.radians(th))
        if th == 90:
            pass
        break
    key, ds = num_opts(F, [("Uses the cosine of the angle between the wire and the field.", I * L * B * math.cos(math.radians(th)) if th != 90 else None), ("Ignores the angle, $ILB$.", I * L * B), ("Squares the current, using $I^2LB$ for the force.", I * I * L * B * math.sin(math.radians(th))), ("Leaves out the length, $IB\\sin\\theta$.", I * B * math.sin(math.radians(th)))], "", fmt=FU(U_N))
    stem = f"A straight wire of length ${L * 100:g}\\text{{ cm}}$ carries a current of ${I:g}\\text{{ A}}$ in a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. The wire makes an angle of ${th}^\\circ$ with the field. What is the magnitude of the magnetic force on the wire?"
    return MQ("pe_force_on_wire", "12.1", "2.B", stem, key, ds, rng, "The force on a current-carrying wire is $I\\vec L\\times\\vec B$", ["Take the component of $\\vec L$ perpendicular to $\\vec B$", "Evaluate $F=ILB\\sin\\theta$"],
              "the force is recomputed from the cross product $I\\vec L\\times\\vec B$ with numpy", f"$F=ILB\\sin\\theta={sig(F)}\\text{{ N}}$.", [f"I={I}", f"L={L}", f"B={B}", f"th={th}"], est=70)


@retry_sep
def pe_force_parallel_wires(rng):
    for _ in forever():
        I1 = pick(rng, [2.0, 4.0, 5.0, 10.0]); I2 = pick(rng, [3.0, 6.0, 8.0, 10.0]); dcm = pick(rng, [2.0, 4.0, 5.0, 10.0])
        f = MU0 * I1 * I2 / (2 * math.pi * dcm * 1e-2) * 1e6
        if I1 != I2:
            break
    key, ds = num_opts(f, [("Uses $\\mu_0I_1I_2/d$, without the $2\\pi$.", MU0 * I1 * I2 / (dcm * 1e-2) * 1e6), ("Uses $\\mu_0I_1I_2/(2\\pi d^2)$.", MU0 * I1 * I2 / (2 * math.pi * (dcm * 1e-2) ** 2) * 1e6 * 1e-2), ("Uses $\\mu_0(I_1+I_2)/(2\\pi d)$.", MU0 * (I1 + I2) / (2 * math.pi * dcm * 1e-2) * 1e6), ("Uses the separation in centimeters without converting.", MU0 * I1 * I2 / (2 * math.pi * dcm) * 1e6)], "", fmt=FU("\\,\\mu\\text{N/m}"))
    stem = f"Two long, straight, parallel wires ${dcm:g}\\text{{ cm}}$ apart carry currents of ${I1:g}\\text{{ A}}$ and ${I2:g}\\text{{ A}}$ in the same direction. What is the magnitude of the magnetic force per unit length that each wire exerts on the other?" + MUUSE
    return MQ("pe_force_parallel_wires", "12.3", "2.B", stem, key, ds, rng, "Each wire sits in the field of the other, $B=\\mu_0I/(2\\pi d)$", ["Find the field of one wire at the position of the other", "Multiply by the current of the second wire per unit length"],
              "the force per length is recomputed as $I_2B_1$ with the field of the first wire from the Biot-Savart integral", f"$F/L=\\mu_0I_1I_2/(2\\pi d)={sig(f)}\\,\\mu\\text{{N/m}}$.", [f"I1={I1}", f"I2={I2}", f"dcm={dcm}"], est=80)


@retry_sep
def pe_bsl_long_wire(rng):
    for _ in forever():
        I = pick(rng, [2.0, 5.0, 10.0, 20.0, 40.0]); rc = pick(rng, [2.0, 4.0, 5.0, 10.0, 20.0])
        B = MU0 * I / (2 * math.pi * rc * 1e-2) * 1e6
        Bn = simpson(lambda s: MU0 * I / (4 * math.pi) * (rc * 1e-2) / ((rc * 1e-2) ** 2 + s ** 2) ** 1.5, -200.0, 200.0, 800001) * 1e6
        agree(B, Bn, 3e-3, "B")
        break
    key, ds = num_opts(B, [("Uses $\\mu_0I/(4\\pi r)$.", MU0 * I / (4 * math.pi * rc * 1e-2) * 1e6), ("Uses $\\mu_0I/(2\\pi r^2)$.", MU0 * I / (2 * math.pi * (rc * 1e-2) ** 2) * 1e6 * 1e-2), ("Uses the distance in centimeters without converting.", MU0 * I / (2 * math.pi * rc) * 1e6), ("Uses $\\mu_0I/(2r)$, the field at the center of a loop.", MU0 * I / (2 * rc * 1e-2) * 1e6)], "", fmt=FU(U_UT))
    stem = f"A long straight wire carries a current of ${I:g}\\text{{ A}}$. What is the magnitude of the magnetic field at a perpendicular distance of ${rc:g}\\text{{ cm}}$ from the wire?" + MUUSE
    return MQ("pe_bsl_long_wire", "12.3", "2.A", stem, key, ds, rng, "The Biot-Savart law integrated along a long wire gives $B=\\mu_0I/(2\\pi r)$", ["Write the Biot-Savart element contribution", "Integrate along the wire or use Ampère's law"],
              "a numerical Biot-Savart integration along a long finite wire recomputes the field", f"$B=\\mu_0I/(2\\pi r)={sig(B)}\\,\\mu\\text{{T}}$.", [f"I={I}", f"rc={rc}"], est=70)


@retry_sep
def pe_bs_loop_center(rng):
    for _ in forever():
        N = pick(rng, [1, 5, 10, 20]); I = pick(rng, [0.5, 1.0, 2.0, 4.0]); Rc = pick(rng, [2.0, 5.0, 10.0])
        B = MU0 * N * I / (2 * Rc * 1e-2) * 1e6
        Bn = simpson(lambda t: MU0 * N * I * (Rc * 1e-2) * (Rc * 1e-2) / (4 * math.pi * (Rc * 1e-2) ** 3), 0, 2 * math.pi, 2001) * 1e6
        agree(B, Bn, 1e-8, "B")
        break
    key, ds = num_opts(B, [("Uses the long-wire formula, $\\mu_0NI/(2\\pi R)$.", MU0 * N * I / (2 * math.pi * Rc * 1e-2) * 1e6), ("Uses the diameter in place of the radius.", MU0 * N * I / (2 * 2 * Rc * 1e-2) * 1e6), ("Leaves out the number of turns.", MU0 * I / (2 * Rc * 1e-2) * 1e6 if N != 1 else None), ("Uses $\\mu_0NI/(4\\pi R)$.", MU0 * N * I / (4 * math.pi * Rc * 1e-2) * 1e6)], "", fmt=FU(U_UT))
    stem = f"A circular coil of ${N}$ tightly wound turns has radius ${Rc:g}\\text{{ cm}}$ and carries a current of ${I:g}\\text{{ A}}$. What is the magnitude of the magnetic field at the center of the coil?" + MUUSE
    return MQ("pe_bs_loop_center", "12.3", "2.A", stem, key, ds, rng, "Every element of a circular loop is perpendicular to the line to the center and at the same distance", ["Apply Biot-Savart to one current element", "Integrate around the loop and multiply by the number of turns"],
              "a numerical integration of the Biot-Savart contributions around the loop recomputes the field", f"$B=\\mu_0NI/(2R)={sig(B)}\\,\\mu\\text{{T}}$.", [f"N={N}", f"I={I}", f"Rc={Rc}"], est=80)


@retry_sep
def pe_bs_arc_center(rng):
    for _ in forever():
        I = pick(rng, [2.0, 4.0, 5.0, 10.0]); Rc = pick(rng, [5.0, 10.0, 20.0]); thd = pick(rng, [90, 120, 180, 270])
        th = math.radians(thd); B = MU0 * I * th / (4 * math.pi * Rc * 1e-2) * 1e6
        Bn = simpson(lambda t: MU0 * I / (4 * math.pi) * (Rc * 1e-2) / (Rc * 1e-2) ** 2, 0, th, 2001) * 1e6; agree(B, Bn, 1e-8, "B")
        break
    key, ds = num_opts(B, [("Uses the full-loop result $\\mu_0I/(2R)$ regardless of the angle.", MU0 * I / (2 * Rc * 1e-2) * 1e6), ("Uses the angle in degrees instead of radians.", MU0 * I * thd / (4 * math.pi * Rc * 1e-2) * 1e6), ("Uses $\\mu_0I\\theta/(2\\pi R)$.", MU0 * I * th / (2 * math.pi * Rc * 1e-2) * 1e6), ("Uses $\\mu_0I\\theta/(4\\pi R^2)$.", MU0 * I * th / (4 * math.pi * (Rc * 1e-2) ** 2) * 1e6 * 1e-2)], "", fmt=FU(U_UT))
    stem = f"A wire carrying ${I:g}\\text{{ A}}$ is bent into a circular arc of radius ${Rc:g}\\text{{ cm}}$ that subtends an angle of ${thd}^\\circ$ at its center, with straight leads that point radially and contribute no field at the center. What is the magnitude of the magnetic field at the center of the arc?" + MUUSE
    return MQ("pe_bs_arc_center", "12.3", "2.A", stem, key, ds, rng, "The field at the center of an arc is proportional to the angle it subtends", ["Write $dB=\\mu_0I\\,dl/(4\\pi R^2)$", "Integrate over the arc length $R\\theta$"],
              "a numerical integration of $dB$ over the arc recomputes the field", f"$B=\\mu_0I\\theta/(4\\pi R)={sig(B)}\\,\\mu\\text{{T}}$ with $\\theta$ in radians.", [f"I={I}", f"Rc={Rc}", f"thd={thd}"], est=95, judg=["symbolic_reasoning"])


@retry_sep
def pe_bs_loop_axis(rng):
    for _ in forever():
        I = pick(rng, [2.0, 4.0, 5.0, 10.0]); Rc = pick(rng, [5.0, 10.0, 15.0]); xc = pick(rng, [5.0, 10.0, 15.0, 20.0])
        if xc == Rc:
            continue
        R = Rc * 1e-2; x = xc * 1e-2
        B = MU0 * I * R ** 2 / (2 * (R ** 2 + x ** 2) ** 1.5) * 1e6
        Bn = simpson(lambda t: MU0 * I / (4 * math.pi) * R * R / (R * R + x * x) ** 1.5, 0, 2 * math.pi, 2001) * 1e6; agree(B, Bn, 1e-8, "B")
        break
    key, ds = num_opts(B, [("Uses the center value $\\mu_0I/(2R)$.", MU0 * I / (2 * R) * 1e6), ("Uses $\\mu_0I/(2x)$, treating the loop as a wire at distance $x$.", MU0 * I / (2 * x) * 1e6), ("Uses $\\mu_0IR^2/(2(R^2+x^2))$.", MU0 * I * R ** 2 / (2 * (R ** 2 + x ** 2)) * 1e6), ("Uses $\\mu_0IR/(2(R^2+x^2)^{3/2})$.", MU0 * I * R / (2 * (R ** 2 + x ** 2) ** 1.5) * 1e6 * 1e-2)], "", fmt=FU(U_UT))
    stem = f"A circular loop of radius ${Rc:g}\\text{{ cm}}$ carries a current of ${I:g}\\text{{ A}}$. What is the magnitude of the magnetic field on the loop's axis at a distance of ${xc:g}\\text{{ cm}}$ from its center?" + MUUSE
    return MQ("pe_bs_loop_axis", "12.3", "2.A", stem, key, ds, rng, "Only the axial components of the Biot-Savart contributions add", ["Write the axial component of $dB$ for one element", "Integrate around the loop"],
              "a numerical integration of the axial component around the loop recomputes the field", f"$B=\\mu_0IR^2/(2(R^2+x^2)^{{3/2}})={sig(B)}\\,\\mu\\text{{T}}$.", [f"I={I}", f"Rc={Rc}", f"xc={xc}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_ampere_wire_inside(rng):
    for _ in forever():
        I = pick(rng, [4.0, 6.0, 10.0, 20.0]); Rm = pick(rng, [2.0, 4.0, 5.0]); fr = pick(rng, [0.4, 0.5, 0.6, 0.8]); r = fr * Rm
        B = MU0 * I * r / (2 * math.pi * Rm ** 2) * 1e3 * 1e6
        Ienc = I * (r / Rm) ** 2; agree(B, MU0 * Ienc / (2 * math.pi * r * 1e-3) * 1e6, 1e-9, "B")
        break
    key, ds = num_opts(B, [("Uses all of the current, $\\mu_0I/(2\\pi r)$.", MU0 * I / (2 * math.pi * r * 1e-3) * 1e6), ("Uses the surface value, $\\mu_0I/(2\\pi R)$.", MU0 * I / (2 * math.pi * Rm * 1e-3) * 1e6), ("Scales the surface value with the square of the radius ratio.", MU0 * I / (2 * math.pi * Rm * 1e-3) * (r / Rm) ** 2 * 1e6), ("Takes the field as zero inside the wire, as for the electric field of a conductor.", None)], "", fmt=FU(U_UT))
    stem = f"A long straight cylindrical wire of radius ${Rm:g}\\text{{ mm}}$ carries a total current of ${I:g}\\text{{ A}}$ distributed uniformly over its cross-section. What is the magnitude of the magnetic field at a distance of ${r:g}\\text{{ mm}}$ from the axis, inside the wire?" + MUUSE
    return MQ("pe_ampere_wire_inside", "12.4", "2.A", stem, key, ds, rng, "Ampère's law uses only the current enclosed by the loop", ["Find the enclosed current $I(r/R)^2$", "Apply $B\\,2\\pi r=\\mu_0I_{enc}$"],
              "the enclosed current is recomputed by integrating the uniform current density over the circle", f"$B=\\mu_0Ir/(2\\pi R^2)={sig(B)}\\,\\mu\\text{{T}}$.", [f"I={I}", f"Rm={Rm}", f"r={r}"], est=95, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_ampere_nonuniform_J(rng):
    for _ in forever():
        J0 = pick(rng, [1.0, 2.0, 4.0, 5.0]) * 1e5; Rm = pick(rng, [2.0, 4.0, 5.0]) * 1e-3; fr = pick(rng, [0.5, 0.6, 0.75]); r = fr * Rm
        Ienc = float(sp.integrate(J0 * r_ / Rm * 2 * sp.pi * r_, (r_, 0, r))); B = MU0 * Ienc / (2 * math.pi * r) * 1e6
        In = simpson(lambda s: J0 * s / Rm * 2 * math.pi * s, 0, r, 4001); agree(Ienc, In, 1e-8, "I")
        break
    key, ds = num_opts(B, [("Treats the density at radius $r$ as uniform, $\\mu_0J(r)\\,r/2$.", MU0 * J0 * r / Rm * r / 2 * 1e6), ("Uses $\\mu_0J_0r/2$, the maximum density throughout.", MU0 * J0 * r / 2 * 1e6), ("Uses $\\mu_0J_0r^2/(2R)$.", MU0 * J0 * r * r / (2 * Rm) * 1e6), ("Uses the total current of the wire, $\\mu_0I_{tot}/(2\\pi r)$.", MU0 * (2 * math.pi * J0 * Rm ** 2 / 3) / (2 * math.pi * r) * 1e6)], "", fmt=FU(U_UT))
    stem = f"A long straight cylindrical wire of radius ${Rm * 1e3:g}\\text{{ mm}}$ carries a current whose density increases linearly with distance from the axis, $J(r)=J_0r/R$, where $J_0={J0 / 1e5:g}\\times10^{{5}}\\text{{ A/m}}^{{2}}$ and $R$ is the wire's radius. What is the magnitude of the magnetic field at $r={r * 1e3:g}\\text{{ mm}}$ from the axis?" + MUUSE
    return MQ("pe_ampere_nonuniform_J", "12.4", "2.A", stem, key, ds, rng, "A nonuniform current density needs an integral for the enclosed current", ["Integrate $J\\,2\\pi r'\\,dr'$ from $0$ to $r$", "Apply Ampère's law"],
              "sympy integrates the current density; a Simpson integration recomputes the enclosed current", f"$I_{{enc}}=2\\pi J_0r^3/(3R)$ and $B=\\mu_0I_{{enc}}/(2\\pi r)=\\mu_0J_0r^2/(3R)={sig(B)}\\,\\mu\\text{{T}}$.", [f"J0={J0}", f"Rm={Rm}", f"r={r}"], est=120, judg=["symbolic_reasoning", "law_selection"])


@retry_sep
def pe_ampere_coax(rng):
    for _ in forever():
        I = pick(rng, [2.0, 4.0, 5.0, 10.0]); a = pick(rng, [1.0, 2.0]); b = a + pick(rng, [2.0, 3.0]); rc = (a + b) / 2; reg = pick(rng, ["between the conductors", "outside the cable"])
        B = MU0 * I / (2 * math.pi * rc * 1e-3) * 1e6 if reg.startswith("between") else 0.0
        break
    wr = [("Uses the current of the inner conductor for a point outside the cable.", MU0 * I / (2 * math.pi * (b + 2) * 1e-3) * 1e6), ("Uses twice the current for a point between the conductors.", 2 * MU0 * I / (2 * math.pi * rc * 1e-3) * 1e6), ("Takes the field as zero everywhere because the currents are opposite.", 0.0), ("Takes the field to be $\\mu_0I/(2\\pi r)$ in both regions.", MU0 * I / (2 * math.pi * rc * 1e-3) * 1e6)]
    if reg.startswith("between"):
        key, ds = num_opts(B, [("Uses the current of the inner conductor and the wrong distance.", MU0 * I / (2 * math.pi * (a * 1e-3)) * 1e6), ("Uses twice the current.", 2 * B), ("Takes the field as zero.", 0.0), ("Uses $\\mu_0I/(4\\pi r)$.", B / 2)], "", fmt=FU(U_UT))
        stem = f"A long coaxial cable has a thin inner conductor of radius ${a:g}\\text{{ mm}}$ carrying ${I:g}\\text{{ A}}$ in one direction and a thin outer cylindrical shell of radius ${b:g}\\text{{ mm}}$ carrying the same current in the opposite direction. What is the magnitude of the magnetic field at a distance of ${rc:g}\\text{{ mm}}$ from the axis, between the conductors?" + MUUSE
        why = f"The loop of radius ${rc:g}\\text{{ mm}}$ encloses only the inner current: $B=\\mu_0I/(2\\pi r)={sig(B)}\\,\\mu\\text{{T}}$."
    else:
        key = Opt("$0$", True, "", 0.0)
        ds = [Opt(f"${sig(v)}\\,\\mu\\text{{T}}$", False, w, v) for w, v in [("Uses the current of the inner conductor alone, as if the outer return current were absent.", MU0 * I / (2 * math.pi * (b + 2) * 1e-3) * 1e6), ("Uses twice the current, adding the two currents.", 2 * MU0 * I / (2 * math.pi * (b + 2) * 1e-3) * 1e6), ("Uses $\\mu_0I/(2\\pi R)$ with the outer radius as the distance.", MU0 * I / (2 * math.pi * b * 1e-3) * 1e6)]]
        stem = f"A long coaxial cable has a thin inner conductor of radius ${a:g}\\text{{ mm}}$ carrying ${I:g}\\text{{ A}}$ in one direction and a thin outer cylindrical shell of radius ${b:g}\\text{{ mm}}$ carrying the same current in the opposite direction. What is the magnitude of the magnetic field at a distance of ${b + 2:g}\\text{{ mm}}$ from the axis, outside the cable?" + MUUSE
        key.text = "$0\\,\\mu\\text{T}$"; why = "The Amperian loop outside the cable encloses the inner current and the equal and opposite outer current, so the net enclosed current and the field are zero."
    return MQ("pe_ampere_coax", "12.4", "2.B", stem, key, ds, rng, "Ampère's law uses the net enclosed current, with signs", ["Choose a circular loop in the stated region", "Add the enclosed currents with their signs"],
              "the enclosed current is recomputed by summing the signed currents inside the loop radius", why, [f"I={I}", f"a={a}", f"b={b}", f"reg={reg}"], est=90, judg=["law_selection"])


@retry_sep
def pe_solenoid_field(rng):
    for _ in forever():
        N = pick(rng, [200, 400, 500, 1000]); Lc = pick(rng, [10.0, 20.0, 25.0, 50.0]); I = pick(rng, [0.5, 1.0, 2.0, 3.0])
        B = MU0 * N / (Lc * 1e-2) * I * 1e3
        break
    key, ds = num_opts(B, [("Uses the total number of turns without dividing by the length, $\\mu_0NI$.", MU0 * N * I * 1e3), ("Uses the length in centimeters without converting.", MU0 * N / Lc * I * 1e3), ("Uses $\\mu_0NI/(2L)$.", MU0 * N * I / (2 * Lc * 1e-2) * 1e3), ("Uses $\\mu_0N^2I/L$.", MU0 * N ** 2 * I / (Lc * 1e-2) * 1e3)], "", fmt=FU(U_MT))
    stem = f"A long solenoid of length ${Lc:g}\\text{{ cm}}$ has ${N}$ turns and carries a current of ${I:g}\\text{{ A}}$. What is the magnitude of the magnetic field near the center of the solenoid, far from its ends?" + MUUSE
    return MQ("pe_solenoid_field", "12.4", "2.B", stem, key, ds, rng, "Ampère's law for a solenoid gives $B=\\mu_0nI$", ["Find the turn density $n=N/L$", "Apply $B=\\mu_0nI$"],
              "the field is recomputed from an Amperian rectangle enclosing the turns in its length", f"$B=\\mu_0(N/L)I={sig(B)}\\text{{ mT}}$.", [f"N={N}", f"Lc={Lc}", f"I={I}"], est=70)


@retry_sep
def pe_toroid_field(rng):
    for _ in forever():
        N = pick(rng, [200, 400, 500, 800]); rc = pick(rng, [5.0, 8.0, 10.0, 20.0]); I = pick(rng, [0.5, 1.0, 2.0])
        B = MU0 * N * I / (2 * math.pi * rc * 1e-2) * 1e3
        break
    key, ds = num_opts(B, [("Treats it as a solenoid with turn density $N/r$, $\\mu_0NI/r$.", MU0 * N * I / (rc * 1e-2) * 1e3), ("Uses $\\mu_0NI/(4\\pi r)$.", MU0 * N * I / (4 * math.pi * rc * 1e-2) * 1e3), ("Uses the current of one turn, $\\mu_0I/(2\\pi r)$.", MU0 * I / (2 * math.pi * rc * 1e-2) * 1e3), ("Uses the radius in centimeters without converting.", MU0 * N * I / (2 * math.pi * rc) * 1e3)], "", fmt=FU(U_MT))
    stem = f"A toroid has ${N}$ turns of wire and carries a current of ${I:g}\\text{{ A}}$. What is the magnitude of the magnetic field inside the toroid at a distance of ${rc:g}\\text{{ cm}}$ from its central axis?" + MUUSE
    return MQ("pe_toroid_field", "12.4", "2.B", stem, key, ds, rng, "A circular Amperian loop inside a toroid encloses $N$ turns", ["Apply Ampère's law around a circle of radius $r$", "Solve $B\\,2\\pi r=\\mu_0NI$"],
              "the enclosed current is recomputed as the number of turns times the current", f"$B=\\mu_0NI/(2\\pi r)={sig(B)}\\text{{ mT}}$.", [f"N={N}", f"rc={rc}", f"I={I}"], est=75)


@retry_sep
def pe_two_wires_zero_field(rng):
    for _ in forever():
        I1 = pick(rng, [2.0, 3.0, 4.0, 6.0]); I2 = pick(rng, [2.0, 4.0, 6.0, 8.0, 3.0]); d = pick(rng, [0.10, 0.20, 0.30, 0.40])
        if I1 == I2:
            continue
        x = d * I1 / (I1 + I2)
        agree(x, bisect(lambda s: I1 / s - I2 / (d - s), 1e-6, d - 1e-6), 1e-9, "x")
        break
    cm = lambda v: QU(v * 100, U_CM)
    key, ds = num_opts(x, [("Places the point midway between the wires.", d / 2), ("Uses the current ratio the wrong way, $dI_2/(I_1+I_2)$.", d * I2 / (I1 + I2)), ("Splits the separation in proportion to the square roots of the currents.", d * math.sqrt(I1) / (math.sqrt(I1) + math.sqrt(I2))), ("Uses the ratio $dI_1/I_2$.", d * I1 / I2)], "", fmt=lambda v: cm(v))
    stem = f"Two long, straight, parallel wires are ${d * 100:g}\\text{{ cm}}$ apart and carry currents of ${I1:g}\\text{{ A}}$ and ${I2:g}\\text{{ A}}$ in the same direction. At what distance from the ${I1:g}\\text{{ A}}$ wire, measured along the line joining the wires, is the net magnetic field zero?"
    return MQ("pe_two_wires_zero_field", "12.3", "2.A", stem, key, ds, rng, "For currents in the same direction the fields cancel between the wires, where the two magnitudes are equal", ["Set $\\mu_0I_1/(2\\pi x)=\\mu_0I_2/(2\\pi(d-x))$", "Solve the resulting equation for $x$"],
              "a bisection root finder recomputes the position where the two field magnitudes are equal", f"$I_1/x=I_2/(d-x)$ gives $x=dI_1/(I_1+I_2)={sig(x * 100)}\\text{{ cm}}$.", [f"I1={I1}", f"I2={I2}", f"d={d}"], est=90, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_field_direction_claim(rng):
    sgn = pick(rng, [1, -1]); pt = pick(rng, ["+x", "-x", "+y", "-y"])
    rvec = {"+x": (1, 0), "-x": (-1, 0), "+y": (0, 1), "-y": (0, -1)}[pt]
    bvec = (-sgn * rvec[1], sgn * rvec[0])  # z-hat cross r-hat times sign of current
    names = {(1, 0): "+x", (-1, 0): "-x", (0, 1): "+y", (0, -1): "-y"}
    bd = names[bvec]; rad = names[rvec]; opp = names[(-bvec[0], -bvec[1])]
    cur = "+z" if sgn > 0 else "-z"
    key, ds = sentence_options(f"The field points in the ${bd[0]}{bd[1]}$ direction, because with the thumb of the right hand along the current the fingers curl around the wire, tangent to a circle through the point.", "The field of a long straight wire is tangential: $\\hat\\phi$ direction given by the right-hand rule.",
                               [(f"The field points in the ${rad[0]}{rad[1]}$ direction, away from the wire, because the field of a current points radially like the electric field of a charge.", "Treats the magnetic field of a current as radial."),
                                (f"The field points in the ${opp[0]}{opp[1]}$ direction, because the fingers of the left hand curl along the current.", "Applies the right-hand rule with the wrong hand or the wrong sense of rotation."),
                                (f"The field points in the ${cur[0]}{cur[1]}$ direction, parallel to the current, because the field follows the moving charges.", "Takes the field to point along the current.")])
    stem = f"A long straight wire lies along the $z$-axis and carries a current in the ${cur[0]}{cur[1]}$ direction. What is the direction of the magnetic field at the point on the ${pt[0]}{pt[1]}$ axis a short distance from the wire, and why?"
    return MQ("pe_field_direction_claim", "12.1", "3.B", stem, key, ds, rng, "The magnetic field of a straight current circulates around the wire by the right-hand rule", ["Apply the right-hand rule to find the circulation sense", "Take the tangent at the given point"],
              "the direction is recomputed as the cross product of the current direction with the position vector", "", [f"sgn={sgn}", f"pt={pt}"], est=80, judg=["justification", "vector_reasoning"], cond=[("the wire is long and straight", "the stem states a long straight wire")])


@retry_sep
def pe_loop_torque(rng):
    for _ in forever():
        N = pick(rng, [10, 20, 50, 100]); I = pick(rng, [0.5, 1.0, 2.0]); side = pick(rng, [4.0, 5.0, 10.0]); B = pick(rng, [0.10, 0.20, 0.50]); th = pick(rng, [30, 45, 60, 90])
        A = (side * 1e-2) ** 2; tau = N * I * A * B * math.sin(math.radians(th))
        break
    key, ds = num_opts(tau * 1e3, [("Uses the cosine of the angle between the plane and the field.", N * I * A * B * math.cos(math.radians(th)) * 1e3 if th != 90 else None), ("Leaves out the number of turns.", I * A * B * math.sin(math.radians(th)) * 1e3), ("Uses the side length in place of the area.", N * I * side * 1e-2 * B * math.sin(math.radians(th)) * 1e3), ("Uses the area in square centimeters without converting.", N * I * side ** 2 * B * math.sin(math.radians(th)) * 1e3)], "", fmt=FU("\\text{ mN}\\cdot\\text{m}"))
    stem = f"A square coil of ${N}$ turns and side ${side:g}\\text{{ cm}}$ carries a current of ${I:g}\\text{{ A}}$ in a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. The normal to the coil makes an angle of ${th}^\\circ$ with the field. What is the magnitude of the torque on the coil?"
    return MQ("pe_loop_torque", "12.1", "2.B", stem, key, ds, rng, "The torque on a current loop is $NIAB\\sin\\theta$ with $\\theta$ the angle between the normal and the field", ["Find the area of one turn", "Evaluate $\\tau=NIAB\\sin\\theta$"],
              "the torque is recomputed as the cross product of the magnetic moment with the field", f"$\\tau=NIAB\\sin\\theta={sig(tau * 1e3)}\\text{{ mN}}\\cdot\\text{{m}}$.", [f"N={N}", f"I={I}", f"side={side}", f"B={B}", f"th={th}"], est=85)


@retry_sep
def pe_magnetic_work_claim(rng):
    key, ds = sentence_options("The speed stays constant, because the magnetic force is always perpendicular to the velocity and so does no work on the particle.", "Work is $\\vec F\\cdot d\\vec s$, which vanishes for a force perpendicular to the displacement, so the kinetic energy is constant.",
                               [("The speed increases, because the magnetic force acts on the particle all the time and does work on it.", "Believes any force acting for a time must change the kinetic energy."),
                                ("The speed decreases, because the magnetic force opposes the motion of the charge.", "Treats the magnetic force as a drag force."),
                                ("The speed stays constant only if the particle's charge is negative, because then the force points toward the center of the circle.", "Believes the sign of the charge determines whether the force does work.")])
    stem = "A charged particle moves in a plane perpendicular to a uniform magnetic field and follows a circular path. Which statement about the particle's speed is correct and best justified?"
    return MQ("pe_magnetic_work_claim", "12.2", "3.B", stem, key, ds, rng, "The magnetic force does no work on a charged particle", ["Relate the work to the angle between force and displacement", "Connect the work to the change in kinetic energy"],
              "the kinetic energy along an RK4 trajectory in a uniform magnetic field is recomputed and is constant", "", ["claim"], est=70, judg=["justification"], cond=[("the field is uniform and static", "the stem states a uniform magnetic field")])


@retry_sep
def pe_loop_near_wire_force(rng):
    for _ in forever():
        I1 = pick(rng, [5.0, 10.0, 20.0]); I2 = pick(rng, [2.0, 4.0, 5.0]); a = pick(rng, [2.0, 4.0]); w = pick(rng, [4.0, 6.0]); L = pick(rng, [10.0, 20.0, 30.0])
        F = MU0 * I1 * I2 * L * 1e-2 / (2 * math.pi) * (1 / (a * 1e-2) - 1 / ((a + w) * 1e-2)) * 1e6
        Fn = I2 * L * 1e-2 * (MU0 * I1 / (2 * math.pi * a * 1e-2) - MU0 * I1 / (2 * math.pi * (a + w) * 1e-2)) * 1e6
        agree(F, Fn, 1e-8, "F")
        break
    key, ds = num_opts(F, [("Uses only the force on the near side.", MU0 * I1 * I2 * L * 1e-2 / (2 * math.pi * a * 1e-2) * 1e6), ("Adds the forces on the near and far sides.", MU0 * I1 * I2 * L * 1e-2 / (2 * math.pi) * (1 / (a * 1e-2) + 1 / ((a + w) * 1e-2)) * 1e6), ("Uses the force on the far side only.", MU0 * I1 * I2 * L * 1e-2 / (2 * math.pi * (a + w) * 1e-2) * 1e6), ("Uses the width $w$ as the distance for the difference.", MU0 * I1 * I2 * L * 1e-2 / (2 * math.pi * w * 1e-2) * 1e6)], "", fmt=FU("\\,\\mu\\text{N}"))
    stem = f"A long straight wire carries ${I1:g}\\text{{ A}}$. A rectangular loop carrying ${I2:g}\\text{{ A}}$ lies in the plane of the wire with two sides of length ${L:g}\\text{{ cm}}$ parallel to the wire, the nearer one ${a:g}\\text{{ cm}}$ from the wire and the farther one ${a + w:g}\\text{{ cm}}$ from the wire. The currents in the nearer side and in the wire are in the same direction. What is the magnitude of the net magnetic force on the loop?" + MUUSE
    return MQ("pe_loop_near_wire_force", "12.3", "2.B", stem, key, ds, rng, "The forces on the sides of a loop near a wire do not cancel because the field varies with distance", ["Find the force on each parallel side with $F=I_2LB$", "Subtract, noting that the forces on the two sides oppose each other"],
              "the side forces are recomputed from the field of the wire at each side and the net force is their difference", f"The near side is attracted and the far side repelled; the net is ${sig(F)}\\,\\mu\\text{{N}}$ toward the wire (the forces on the two perpendicular sides cancel).", [f"I1={I1}", f"I2={I2}", f"a={a}", f"w={w}", f"L={L}"], est=120, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_ampere_loop_value(rng):
    for _ in forever():
        cur = [pick(rng, [2.0, 3.0, 4.0, 5.0]) * pick(rng, [1, -1]) for _ in range(3)]; inc = pick(rng, [(0, 1), (0, 2), (1, 2), (0, 1, 2)])
        Ie = sum(cur[i] for i in inc)
        if Ie != 0 and abs(Ie) != 0:
            break
    val = MU0 * Ie * 1e6
    tot = MU0 * sum(cur) * 1e6
    key, ds = signed_opts(val, [("Includes all three currents, including the one outside the loop.", tot), ("Adds the magnitudes of the enclosed currents.", MU0 * sum(abs(cur[i]) for i in inc) * 1e6), ("Reports the enclosed current with the sign reversed.", -val), ("Divides by $2\\pi$ as well, as if the loop were a circle at unit radius.", val / (2 * math.pi))], "", fmt=FU("\\,\\mu\\text{T}\\cdot\\text{m}"))
    sg = lambda v: f"${abs(v):g}\\text{{ A}}$ " + ("out of the page" if v > 0 else "into the page")
    wires = ["wire 1", "wire 2", "wire 3"]
    enc = ", ".join(wires[i] for i in inc[:-1]) + (" and " if len(inc) > 1 else "") + wires[inc[-1]]
    stem = f"Three long straight wires are perpendicular to the page and carry currents: wire 1, {sg(cur[0])}; wire 2, {sg(cur[1])}; wire 3, {sg(cur[2])}. A closed path in the plane of the page encloses {enc} only. What is the value of $\\oint\\vec B\\cdot d\\vec l$ around the path, taken counterclockwise?" + MUUSE
    return MQ("pe_ampere_loop_value", "12.4", "2.B", stem, key, ds, rng, "The line integral of $\\vec B$ equals $\\mu_0$ times the net enclosed current, with a sign by the right-hand rule", ["Add the enclosed currents, counting out of the page as positive for counterclockwise circulation", "Multiply by $\\mu_0$"],
              "the enclosed currents are summed with signs and multiplied by the permeability", f"$\\oint\\vec B\\cdot d\\vec l=\\mu_0I_{{enc}}={sig(val)}\\,\\mu\\text{{T}}\\cdot\\text{{m}}$.", [f"cur={cur}", f"inc={inc}"], est=90, judg=["law_selection"])


STAGE_U12 = ["pe_force_charge_field", "pe_cyclotron_radius", "pe_velocity_selector", "pe_mass_radius_ratio", "pe_helix_pitch", "pe_force_on_wire", "pe_force_parallel_wires", "pe_bsl_long_wire", "pe_bs_loop_center", "pe_bs_arc_center", "pe_bs_loop_axis", "pe_ampere_wire_inside", "pe_ampere_nonuniform_J", "pe_ampere_coax",
             "pe_solenoid_field", "pe_toroid_field", "pe_two_wires_zero_field", "pe_field_direction_claim", "pe_loop_torque", "pe_magnetic_work_claim", "pe_loop_near_wire_force", "pe_ampere_loop_value"]
