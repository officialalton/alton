"""AP Physics C: Electricity and Magnetism 원형 E — 단원 13(전자기 유도, 13.1–13.6). 정답은 sympy 도함수·적분과 RK4·중심 차분으로 독립 재계산한다."""
from physe_common import *

t_ = sp.symbols("t", positive=True)
MUUSE = " Use " + C_MU + "."


@retry_sep
def pe_flux_uniform_coil(rng):
    for _ in forever():
        B = pick(rng, [0.20, 0.40, 0.50, 0.80]); side = pick(rng, [5.0, 10.0, 20.0]); th = pick(rng, [30, 37, 45, 60])
        A = (side * 1e-2) ** 2; phi = B * A * math.cos(math.radians(th))
        nrm = np.array([1.0, 0.0]); Bv = B * np.array([math.cos(math.radians(th)), math.sin(math.radians(th))]); agree(phi, float(Bv @ nrm) * A, 1e-12, "phi")
        break
    key, ds = num_opts(phi * 1e3, [("Uses the sine of the angle between the field and the normal.", B * A * math.sin(math.radians(th)) * 1e3), ("Ignores the angle, $BA$.", B * A * 1e3), ("Uses the side length instead of the area.", B * side * 1e-2 * math.cos(math.radians(th)) * 1e3), ("Uses the area in square centimeters without converting.", B * side ** 2 * math.cos(math.radians(th)) * 1e3)], "", fmt=FU(U_MWB))
    stem = f"A square loop of side ${side:g}\\text{{ cm}}$ is in a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. The normal to the loop makes an angle of ${th}^\\circ$ with the field. What is the magnetic flux through the loop?"
    return MQ("pe_flux_uniform_coil", "13.1", "2.B", stem, key, ds, rng, "Magnetic flux is $\\vec B\\cdot\\vec A=BA\\cos\\theta$ with $\\theta$ measured from the normal", ["Find the area in square meters", "Evaluate $\\Phi=BA\\cos\\theta$"],
              "the flux is recomputed as the dot product of the field vector with the unit normal", f"$\\Phi=BA\\cos\\theta={sig(phi * 1e3)}\\text{{ mWb}}$.", [f"B={B}", f"side={side}", f"th={th}"], est=70)


@retry_sep
def pe_emf_changing_B(rng):
    for _ in forever():
        a = pick(rng, [0.5, 1.0, 2.0, 3.0]); side = pick(rng, [10.0, 20.0, 25.0]); N = pick(rng, [1, 5, 10, 20]); t0 = pick(rng, [1.0, 2.0, 3.0])
        A = (side * 1e-2) ** 2; emf = N * A * float(sp.diff(a * t_ ** 2, t_).subs(t_, t0))
        f = lambda s: N * A * a * s * s
        agree(emf, nd(f, t0), 1e-6, "emf")
        break
    key, ds = num_opts(emf * 1e3, [("Uses the flux at the time instead of its rate of change, $NABt^2$ form.", N * A * a * t0 ** 2 * 1e3), ("Differentiates incorrectly, $NAa\\,t$.", N * A * a * t0 * 1e3), ("Leaves out the number of turns.", A * 2 * a * t0 * 1e3 if N != 1 else None), ("Uses the coefficient of the derivative without the time, $2NAa$.", N * A * 2 * a * 1e3)], "", fmt=FU(U_MV))
    stem = f"A coil of ${N}$ turns and area ${A * 1e4:g}\\text{{ cm}}^{{2}}$ per turn has its plane perpendicular to a uniform magnetic field whose magnitude changes as $B(t)={a:g}t^2$, where $B$ is in teslas and $t$ is in seconds. What is the magnitude of the induced emf in the coil at $t={t0:g}\\text{{ s}}$?"
    return MQ("pe_emf_changing_B", "13.2", "2.A", stem, key, ds, rng, "Faraday's law gives the emf as the rate of change of flux linkage", ["Write $\\Phi=NAB(t)$", "Differentiate and evaluate at the given time"],
              "sympy differentiates the flux linkage; a central finite difference recomputes the derivative", f"$|\\varepsilon|=NA\\,dB/dt=NA(2a t)={sig(emf * 1e3)}\\text{{ mV}}$.", [f"a={a}", f"side={side}", f"N={N}", f"t0={t0}"], est=90, judg=["symbolic_reasoning"])


@retry_sep
def pe_motional_emf_rod(rng):
    for _ in forever():
        B = pick(rng, [0.10, 0.20, 0.50]); L = pick(rng, [0.20, 0.30, 0.50]); v = pick(rng, [2.0, 4.0, 5.0, 10.0])
        emf = B * L * v
        break
    key, ds = num_opts(emf, [("Leaves out the length, $Bv$.", B * v), ("Divides by the speed, $BL/v$.", B * L / v), ("Squares the speed, using $BLv^2$ as the emf.", B * L * v * v), ("Uses $\\tfrac12BLv$.", 0.5 * B * L * v)], "", fmt=FU(U_V))
    stem = f"A straight metal rod of length ${L * 100:g}\\text{{ cm}}$ moves at constant speed ${v:g}\\text{{ m/s}}$ perpendicular to its length and perpendicular to a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. What is the emf induced between the ends of the rod?"
    return MQ("pe_motional_emf_rod", "13.2", "2.B", stem, key, ds, rng, "A conductor moving through a magnetic field has a motional emf $BLv$", ["Find the magnetic force on the charges in the rod", "Equate the force per charge with the electric field and integrate along the length"],
              "the emf is recomputed as the line integral of $\\vec v\\times\\vec B$ along the rod", f"$\\varepsilon=BLv={sig(emf)}\\text{{ V}}$.", [f"B={B}", f"L={L}", f"v={v}"], est=65)


@retry_sep
def pe_motional_force(rng):
    for _ in forever():
        B = pick(rng, [0.20, 0.50, 1.0]); L = pick(rng, [0.20, 0.50, 1.0]); v = pick(rng, [2.0, 4.0, 5.0]); R = pick(rng, [2.0, 4.0, 5.0, 10.0])
        F = B ** 2 * L ** 2 * v / R
        I = B * L * v / R; agree(F, I * L * B, 1e-12, "F")
        break
    key, ds = num_opts(F, [("Uses $BLv/R$, the current, as the force.", B * L * v / R), ("Uses $B^2Lv/R$.", B ** 2 * L * v / R), ("Uses $B^2L^2v^2/R$, the power, as the force.", B ** 2 * L ** 2 * v * v / R), ("Uses $BL^2v/R$.", B * L ** 2 * v / R)], "", fmt=FU(U_N))
    stem = f"A conducting rod of length ${L:g}\\text{{ m}}$ slides at constant speed ${v:g}\\text{{ m/s}}$ along two parallel frictionless rails connected at one end by a ${R:g}\\,\\Omega$ resistor. A uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ is perpendicular to the plane of the rails. The rod and rails have negligible resistance. What external force must be applied to the rod to keep it moving at constant speed?"
    return MQ("pe_motional_force", "13.3", "2.B", stem, key, ds, rng, "The external force balances the magnetic force on the induced current", ["Find the emf and the current", "Find the magnetic force $ILB$ that opposes the motion"],
              "the force is recomputed from the power balance $Fv=\\varepsilon^2/R$", f"$I=BLv/R$ and $F=ILB=B^2L^2v/R={sig(F)}\\text{{ N}}$.", [f"B={B}", f"L={L}", f"v={v}", f"R={R}"], est=90, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_lenz_direction_claim(rng):
    bdir = pick(rng, ["into the page", "out of the page"]); chg = pick(rng, ["increasing", "decreasing"])
    # 유도 자기장이 변화를 방해: 증가하면 반대 방향, 감소하면 같은 방향
    ind_out = (bdir == "into the page") == (chg == "increasing")  # 유도 자기장이 '밖으로'이면 반시계
    ans = "counterclockwise" if ind_out else "clockwise"; wrong = "clockwise" if ind_out else "counterclockwise"
    key, ds = sentence_options(f"The induced current is {ans}, because the induced magnetic field inside the loop must oppose the {chg} flux, which here means pointing {'out of the page' if ind_out else 'into the page'}.", "Lenz's law: the induced current produces a field that opposes the change in flux, and the right-hand rule gives its sense.",
                               [(f"The induced current is {wrong}, because the induced magnetic field must point in the same direction as the original field.", "Believes the induced field always reinforces the original field."),
                                (f"The induced current is {wrong}, because the induced field must oppose the field itself rather than the change in the flux.", "Confuses opposing the field with opposing the change in flux."),
                                ("There is no induced current, because the loop is not moving.", "Believes that induction requires motion of the loop rather than a change in flux.")])
    stem = f"A circular loop lies in the plane of the page in a uniform magnetic field that points {bdir} and is {chg} in magnitude. Which statement about the direction of the induced current, viewed from above the page, is correct and best justified?"
    return MQ("pe_lenz_direction_claim", "13.3", "3.B", stem, key, ds, rng, "Lenz's law: the induced current opposes the change in flux", ["Decide how the flux is changing", "Choose the induced field that opposes the change and apply the right-hand rule"],
              "the induced emf sign is recomputed from the sign of $-d\\Phi/dt$ for the stated change", "", [f"bdir={bdir}", f"chg={chg}"], est=85, judg=["justification", "vector_reasoning"], cond=[("the loop is fixed and the field is uniform over it", "the stem states a fixed loop in a uniform field")])


@retry_sep
def pe_induced_current_loop(rng):
    for _ in forever():
        rate = pick(rng, [0.10, 0.20, 0.50, 1.0]); side = pick(rng, [10.0, 20.0, 30.0]); R = pick(rng, [0.5, 1.0, 2.0, 5.0])
        A = (side * 1e-2) ** 2; I = A * rate / R * 1e3
        break
    key, ds = num_opts(I, [("Uses the side length rather than the area, $\\ell\\,dB/dt/R$.", side * 1e-2 * rate / R * 1e3), ("Multiplies by the resistance instead of dividing, $A\\,(dB/dt)\\,R$.", A * rate * R * 1e3), ("Uses the area in square centimeters without converting.", side ** 2 * rate / R * 1e3), ("Uses the flux itself at an assumed field of $1\\text{ T}$, $A/R$.", A / R * 1e3)], "", fmt=FU(U_MA))
    stem = f"A square loop of side ${side:g}\\text{{ cm}}$ and total resistance ${R:g}\\,\\Omega$ lies with its plane perpendicular to a uniform magnetic field. The field magnitude increases at a steady rate of ${rate:g}\\text{{ T/s}}$. What is the magnitude of the induced current in the loop?"
    return MQ("pe_induced_current_loop", "13.3", "2.B", stem, key, ds, rng, "The induced emf divided by the loop's resistance gives the induced current", ["Find the induced emf $A\\,dB/dt$", "Divide by the resistance"],
              "the current is recomputed from the emf and Ohm's law", f"$\\varepsilon=A\\,dB/dt$ and $I=\\varepsilon/R={sig(I)}\\text{{ mA}}$.", [f"rate={rate}", f"side={side}", f"R={R}"], est=80)


@retry_sep
def pe_rotating_coil_emf(rng):
    for _ in forever():
        N = pick(rng, [50, 100, 200]); B = pick(rng, [0.10, 0.20, 0.50]); side = pick(rng, [10.0, 20.0]); f = pick(rng, [30.0, 50.0, 60.0])
        A = (side * 1e-2) ** 2; w = 2 * math.pi * f; peak = N * B * A * w
        ts = np.linspace(0, 1 / f, 100001); emf = -np.gradient(N * B * A * np.cos(w * ts), ts); agree(peak, float(np.max(np.abs(emf))), 1e-3, "peak")
        break
    key, ds = num_opts(peak, [("Uses the frequency in place of the angular frequency, $NBAf$.", N * B * A * f), ("Leaves out the number of turns.", B * A * w), ("Uses $NBA\\omega^2$.", N * B * A * w * w), ("Uses the average emf over a half cycle.", N * B * A * w * 2 / math.pi)], "", fmt=FU(U_V))
    stem = f"A flat coil of ${N}$ turns, each a square of side ${side:g}\\text{{ cm}}$, rotates at ${f:g}\\text{{ Hz}}$ about an axis in its plane that is perpendicular to a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. What is the maximum emf induced in the coil?"
    return MQ("pe_rotating_coil_emf", "13.2", "2.A", stem, key, ds, rng, "The flux through a rotating coil varies as $\\cos\\omega t$, so the emf varies as $\\sin\\omega t$", ["Write $\\Phi=NBA\\cos\\omega t$", "Differentiate: the peak emf is $NBA\\omega$"],
              "sympy differentiates the flux; a numerical gradient of the flux over one period recomputes the peak emf", f"$\\varepsilon_{{max}}=NBA\\omega=NBA(2\\pi f)={sig(peak)}\\text{{ V}}$.", [f"N={N}", f"B={B}", f"side={side}", f"f={f}"], est=95, judg=["symbolic_reasoning"])


@retry_sep
def pe_solenoid_inductance(rng):
    for _ in forever():
        N = pick(rng, [200, 400, 500, 1000]); Lc = pick(rng, [10.0, 20.0, 25.0, 50.0]); Acm = pick(rng, [2.0, 4.0, 5.0, 10.0])
        L = MU0 * N ** 2 * Acm * 1e-4 / (Lc * 1e-2) * 1e3
        break
    key, ds = num_opts(L, [("Uses $\\mu_0NA/\\ell$, with a single factor of $N$.", MU0 * N * Acm * 1e-4 / (Lc * 1e-2) * 1e3), ("Uses the area in square centimeters without converting.", MU0 * N ** 2 * Acm / (Lc * 1e-2) * 1e3), ("Uses the length in centimeters without converting.", MU0 * N ** 2 * Acm * 1e-4 / Lc * 1e3), ("Uses $\\mu_0N^2\\ell/A$.", MU0 * N ** 2 * (Lc * 1e-2) / (Acm * 1e-4) * 1e3 * 1e-4)], "", fmt=FU(U_MH))
    stem = f"A long air-filled solenoid has ${N}$ turns, a length of ${Lc:g}\\text{{ cm}}$ and a cross-sectional area of ${Acm:g}\\text{{ cm}}^{{2}}$. What is its self-inductance?" + MUUSE
    return MQ("pe_solenoid_inductance", "13.4", "2.A", stem, key, ds, rng, "Self-inductance is the flux linkage per unit current", ["Find the field $\\mu_0nI$ and the flux linkage $N\\,BA$", "Divide the flux linkage by the current $I$"],
              "the inductance is recomputed from the flux linkage $N\\Phi/I$", f"$L=N\\Phi/I=\\mu_0N^2A/\\ell={sig(L)}\\text{{ mH}}$.", [f"N={N}", f"Lc={Lc}", f"Acm={Acm}"], est=85, judg=["symbolic_reasoning"])


@retry_sep
def pe_inductor_emf_ramp(rng):
    for _ in forever():
        L = pick(rng, [20.0, 50.0, 100.0, 200.0]) * 1e-3; a = pick(rng, [0.5, 1.0, 2.0, 3.0]); t0 = pick(rng, [1.0, 2.0, 3.0])
        emf = L * float(sp.diff(a * t_ ** 2, t_).subs(t_, t0))
        agree(emf, L * nd(lambda s: a * s * s, t0), 1e-6, "emf")
        break
    key, ds = num_opts(emf, [("Uses the current instead of its rate of change, $LI$.", L * a * t0 ** 2), ("Uses a constant rate, $La$.", L * a), ("Uses $L\\,I/t$, the average rate.", L * a * t0), ("Uses $\\tfrac12LI^2$, the stored energy, in volts.", 0.5 * L * (a * t0 ** 2) ** 2)], "", fmt=FU(U_V))
    stem = f"The current in an inductor of inductance ${L * 1e3:g}\\text{{ mH}}$ is $I(t)={a:g}t^2$, where $I$ is in amperes and $t$ is in seconds. What is the magnitude of the emf across the inductor at $t={t0:g}\\text{{ s}}$?"
    return MQ("pe_inductor_emf_ramp", "13.4", "2.A", stem, key, ds, rng, "The emf across an inductor is $L\\,dI/dt$", ["Differentiate the current", "Multiply by the inductance and evaluate"],
              "sympy differentiates the current; a central finite difference recomputes the derivative", f"$|\\varepsilon|=L\\,dI/dt=L(2at)={sig(emf)}\\text{{ V}}$.", [f"L={L}", f"a={a}", f"t0={t0}"], est=75, judg=["symbolic_reasoning"])


@retry_sep
def pe_rl_current_growth(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); R = pick(rng, [10.0, 20.0, 50.0]); L = pick(rng, [0.1, 0.2, 0.5, 1.0]); n = pick(rng, [0.5, 1.0, 2.0])
        tau = L / R; tt = n * tau
        I = e / R * (1 - math.exp(-n)) * 1e3
        y = rk4(lambda t0, s: np.array([(e - R * s[0]) / L]), [0.0], 0.0, tt, 4000); agree(I, y[0] * 1e3, 1e-6, "I")
        break
    key, ds = num_opts(I, [("Uses the final current, $\\varepsilon/R$.", e / R * 1e3), ("Uses the decay form $(\\varepsilon/R)e^{-t/\\tau}$.", e / R * math.exp(-n) * 1e3), ("Uses $\\tau=RL$ in the exponent.", e / R * (1 - math.exp(-tt * R * L)) * 1e3 if tt * R * L > 1e-3 else None), ("Uses the current at one time constant regardless of the time.", e / R * (1 - math.exp(-1)) * 1e3)], "", fmt=FU(U_MA))
    stem = f"A ${e:g}\\text{{ V}}$ battery of negligible internal resistance, a ${R:g}\\,\\Omega$ resistor and a ${L:g}\\text{{ H}}$ inductor are connected in series by a switch. The switch is closed at $t=0$ when there is no current. What is the current at $t={tt * 1e3:g}\\text{{ ms}}$?"
    return MQ("pe_rl_current_growth", "13.5", "2.A", stem, key, ds, rng, "The current in an RL circuit grows exponentially with time constant $L/R$", ["Find $\\tau=L/R$", "Evaluate $I=(\\varepsilon/R)(1-e^{-t/\\tau})$"],
              "an RK4 integration of the loop equation recomputes the current", f"$\\tau=L/R={sig(tau * 1e3)}\\text{{ ms}}$ and $I=(\\varepsilon/R)(1-e^{{-t/\\tau}})={sig(I)}\\text{{ mA}}$.", [f"e={e}", f"R={R}", f"L={L}", f"n={n}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_rl_initial_final(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); R1 = pick(rng, [4.0, 6.0, 8.0]); R2 = pick(rng, [4.0, 12.0, 6.0]); when = pick(rng, ["just after the switch is closed", "a very long time after the switch is closed"])
        I = e / (R1 + R2) if when.startswith("just") else e / R1
        break
    wr = [("Takes the inductor as a short circuit at the start, so the current is $\\varepsilon/R_1$." if when.startswith("just") else "Takes the inductor as an open circuit in steady state, so the current is $\\varepsilon/(R_1+R_2)$.", e / R1 if when.startswith("just") else e / (R1 + R2)), ("Uses only $R_2$.", e / R2), ("Uses the parallel combination of the resistors.", e / (R1 * R2 / (R1 + R2))), ("Says the current is zero.", 0.0)]
    key, ds = num_opts(I, wr, "", fmt=FU(U_A))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected through a switch to a resistor $R_1={R1:g}\\,\\Omega$ in series with a parallel combination of an ideal inductor and a resistor $R_2={R2:g}\\,\\Omega$. There is no current before the switch is closed. What is the current supplied by the battery {when}?"
    return MQ("pe_rl_initial_final", "13.5", "2.C", stem, key, ds, rng, "An inductor opposes a sudden change in current, acting like an open circuit at first and like a wire in steady state", ["Decide how the inductor behaves at the stated time", "Apply Ohm's law to the resulting circuit"],
              "the time-dependent current is recomputed by integrating the circuit equations to short and long times", f"The battery current {when} is ${sig(I)}\\text{{ A}}$.", [f"e={e}", f"R1={R1}", f"R2={R2}", f"when={when}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pe_inductor_energy(rng):
    for _ in forever():
        L = pick(rng, [20.0, 50.0, 100.0, 250.0]) * 1e-3; I = pick(rng, [0.5, 1.0, 2.0, 4.0])
        U = 0.5 * L * I * I * 1e3
        agree(U, simpson(lambda s: L * s, 0, I, 2001) * 1e3, 1e-8, "U")
        break
    key, ds = num_opts(U, [("Omits the factor of one half, $LI^2$.", L * I * I * 1e3), ("Uses $\\tfrac12LI$.", 0.5 * L * I * 1e3), ("Uses $\\tfrac12L^2I$.", 0.5 * L * L * I * 1e3), ("Uses $\\tfrac12 I^2/L$.", 0.5 * I * I / L * 1e-3)], "", fmt=FU(U_MJ))
    stem = f"A ${L * 1e3:g}\\text{{ mH}}$ inductor carries a steady current of ${I:g}\\text{{ A}}$. How much energy is stored in its magnetic field?"
    return MQ("pe_inductor_energy", "13.4", "2.B", stem, key, ds, rng, "The energy stored in an inductor is $\\tfrac12LI^2$", ["Identify the inductance and the current", "Evaluate $U=\\tfrac12LI^2$"],
              "the energy is recomputed by integrating $L\\,i\\,di$ from zero to the final current", f"$U=\\tfrac12LI^2={sig(U)}\\text{{ mJ}}$.", [f"L={L}", f"I={I}"], est=60)


@retry_sep
def pe_lc_frequency(rng):
    for _ in forever():
        L = pick(rng, [10.0, 25.0, 100.0, 250.0]) * 1e-3; C = pick(rng, [1.0, 4.0, 10.0, 25.0]) * 1e-6
        w = 1 / math.sqrt(L * C); f = w / (2 * math.pi)
        y = rk4(lambda t0, s: np.array([s[1], -s[0] / (L * C)]), [1.0, 0.0], 0.0, 2 * math.pi / w, 4000); agree(1.0, y[0], 1e-4, "period")
        break
    key, ds = num_opts(f, [("Reports the angular frequency $1/\\sqrt{LC}$ in hertz.", w), ("Uses $2\\pi/\\sqrt{LC}$.", 2 * math.pi * w), ("Uses $1/(2\\pi LC)$.", 1 / (2 * math.pi * L * C)), ("Uses $1/(2\\pi)\\sqrt{L/C}$.", math.sqrt(L / C) / (2 * math.pi) * 1e-3)], "", fmt=FU(U_HZ))
    stem = f"An ideal inductor of ${L * 1e3:g}\\text{{ mH}}$ and an ideal capacitor of ${C * 1e6:g}\\,\\mu\\text{{F}}$ form an LC circuit. What is the frequency of the oscillations of the charge on the capacitor?"
    return MQ("pe_lc_frequency", "13.6", "2.B", stem, key, ds, rng, "An LC circuit oscillates at $\\omega=1/\\sqrt{LC}$", ["Write the loop equation $L\\ddot q+q/C=0$", "Convert the angular frequency to frequency"],
              "an RK4 integration of the oscillator equation confirms that the charge returns to its start after one period", f"$f=1/(2\\pi\\sqrt{{LC}})={sig(f)}\\text{{ Hz}}$.", [f"L={L}", f"C={C}"], est=75)


@retry_sep
def pe_lc_max_current(rng):
    for _ in forever():
        L = pick(rng, [10.0, 25.0, 50.0, 100.0]) * 1e-3; C = pick(rng, [2.0, 5.0, 10.0, 20.0]) * 1e-6; V0 = pick(rng, [6.0, 12.0, 24.0, 50.0])
        I = V0 * math.sqrt(C / L)
        w = 1 / math.sqrt(L * C); ts = np.linspace(0, 2 * math.pi / w, 20001); q = C * V0 * np.cos(w * ts); Ipk = float(np.max(np.abs(np.gradient(q, ts)))); agree(I, Ipk, 1e-3, "I")
        break
    key, ds = num_opts(I * 1e3, [("Uses $V_0\\sqrt{L/C}$.", V0 * math.sqrt(L / C) * 1e3 * 1e-3), ("Uses $V_0/(\\sqrt{LC})$.", V0 / math.sqrt(L * C) * 1e3 * 1e-3), ("Uses $V_0C/L$, which has the wrong units for a current.", V0 * C / L * 1e3), ("Uses $\\tfrac12V_0\\sqrt{C/L}$.", V0 * math.sqrt(C / L) * 1e3 / 2)], "", fmt=FU(U_MA))
    stem = f"A ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor is charged to ${V0:g}\\text{{ V}}$ and then connected across an ideal ${L * 1e3:g}\\text{{ mH}}$ inductor. What is the maximum current in the inductor?"
    return MQ("pe_lc_max_current", "13.6", "2.A", stem, key, ds, rng, "The capacitor's energy is converted entirely into the inductor's energy at the instant of maximum current", ["Set $\\tfrac12CV_0^2=\\tfrac12LI_{max}^2$", "Solve for $I_{max}$"],
              "a numerical gradient of the oscillating charge recomputes the peak current", f"$I_{{max}}=V_0\\sqrt{{C/L}}={sig(I * 1e3)}\\text{{ mA}}$.", [f"L={L}", f"C={C}", f"V0={V0}"], est=90, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_induced_E_solenoid(rng):
    for _ in forever():
        rate = pick(rng, [0.10, 0.20, 0.50, 1.0]); Rcm = pick(rng, [4.0, 5.0, 10.0]); fr = pick(rng, [0.4, 0.5, 0.6]); r = fr * Rcm
        E = r * 1e-2 / 2 * rate * 1e3
        phi_rate = math.pi * (r * 1e-2) ** 2 * rate; agree(E, phi_rate / (2 * math.pi * r * 1e-2) * 1e3, 1e-9, "E")
        break
    key, ds = num_opts(E, [("Uses the whole solenoid's area, $R^2\\,dB/dt/(2r)$.", (Rcm * 1e-2) ** 2 / (2 * r * 1e-2) * rate * 1e3), ("Omits the factor of one half, $r\\,dB/dt$.", r * 1e-2 * rate * 1e3), ("Uses $r^2\\,dB/dt/2$.", (r * 1e-2) ** 2 / 2 * rate * 1e3), ("Takes the field as zero inside because it is outside the changing flux.", None)], "", fmt=FU("\\text{ mV/m}"))
    stem = f"A long solenoid of radius ${Rcm:g}\\text{{ cm}}$ carries a magnetic field along its axis that is uniform over its cross-section and increases at a steady rate of ${rate:g}\\text{{ T/s}}$. What is the magnitude of the induced electric field at a distance of ${r:g}\\text{{ cm}}$ from the axis, inside the solenoid?"
    return MQ("pe_induced_E_solenoid", "13.3", "2.A", stem, key, ds, rng, "A changing magnetic flux induces a circulating electric field, $\\oint\\vec E\\cdot d\\vec l=-d\\Phi/dt$", ["Apply Faraday's law to a circle of radius $r$", "Use only the flux enclosed by that circle"],
              "the induced field is recomputed from the rate of change of the enclosed flux divided by the circumference", f"$E\\,2\\pi r=\\pi r^2\\,dB/dt$ gives $E=(r/2)\\,dB/dt={sig(E)}\\text{{ mV/m}}$.", [f"rate={rate}", f"Rcm={Rcm}", f"r={r}"], est=100, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_loop_near_wire_emf(rng):
    for _ in forever():
        a = pick(rng, [2.0, 4.0]); w = pick(rng, [4.0, 6.0, 8.0]); L = pick(rng, [10.0, 20.0, 30.0]); rate = pick(rng, [2.0, 5.0, 10.0, 20.0])
        emf = MU0 * L * 1e-2 / (2 * math.pi) * math.log((a + w) / a) * rate * 1e6
        phi = simpson(lambda s: MU0 * L * 1e-2 / (2 * math.pi * s), a * 1e-2, (a + w) * 1e-2, 8001); agree(emf, phi * rate * 1e6, 1e-6, "emf")
        break
    key, ds = num_opts(emf, [("Uses the field at the near side times the whole area.", MU0 * 1.0 * rate / (2 * math.pi * a * 1e-2) * (L * 1e-2 * w * 1e-2) * 1e6), ("Uses the field at the middle of the loop times the area.", MU0 * rate / (2 * math.pi * (a + w / 2) * 1e-2) * (L * 1e-2 * w * 1e-2) * 1e6), ("Uses the field at the far side times the whole area.", MU0 * rate / (2 * math.pi * (a + w) * 1e-2) * (L * 1e-2 * w * 1e-2) * 1e6), ("Omits the factor $1/(2\\pi)$.", MU0 * L * 1e-2 * math.log((a + w) / a) * rate * 1e6)], "", fmt=FU("\\,\\mu\\text{V}"))
    stem = f"A long straight wire carries a current that increases at a steady rate of ${rate:g}\\text{{ A/s}}$. A rectangular loop lies in the plane of the wire with two sides of length ${L:g}\\text{{ cm}}$ parallel to the wire, the nearer ${a:g}\\text{{ cm}}$ from the wire and the farther ${a + w:g}\\text{{ cm}}$ from it. What is the magnitude of the emf induced in the loop?" + MUUSE
    return MQ("pe_loop_near_wire_emf", "13.1", "2.A", stem, key, ds, rng, "Flux through a loop near a wire needs an integral because the field varies across the loop", ["Integrate $B\\,L\\,dr$ from the near side to the far side", "Differentiate with respect to time"],
              "sympy integrates the field across the loop; a Simpson integration recomputes the flux", f"$\\Phi=\\dfrac{{\\mu_0IL}}{{2\\pi}}\\ln\\dfrac{{a+w}}{{a}}$, so $\\varepsilon=\\dfrac{{\\mu_0L}}{{2\\pi}}\\ln\\dfrac{{a+w}}{{a}}\\dfrac{{dI}}{{dt}}={sig(emf)}\\,\\mu\\text{{V}}$.", [f"a={a}", f"w={w}", f"L={L}", f"rate={rate}"], est=125, judg=["symbolic_reasoning"])


@retry_sep
def pe_rl_time_constant_scaling(rng):
    for _ in forever():
        fl = pick(rng, [2, 3, 4]); fr = pick(rng, [2, 3, 4])
        f = fl / fr
        if f != 1:
            break
    key, ds = num_opts(f, [("Uses the product of the factors.", fl * fr), ("Uses the inverse of the correct ratio.", fr / fl), ("Uses the sum of the factors.", fl + fr), ("Uses the square of the correct ratio.", f * f)], "", fmt=lambda v: "$" + sig(v) + "$ times the original")
    stem = f"In a series RL circuit, the inductance is multiplied by ${fl}$ and the resistance is multiplied by ${fr}$. By what factor does the time needed for the current to reach a given fraction of its final value change?"
    return MQ("pe_rl_time_constant_scaling", "13.5", "2.D", stem, key, ds, rng, "Every time in an RL circuit scales with the time constant $L/R$", ["Recognize that the time scales with $L/R$", "Apply the factors"],
              "the time to reach a given fraction is recomputed for the old and new constants", f"$\\tau=L/R$ changes by $({fl}/{fr})={sig(f)}$.", [f"fl={fl}", f"fr={fr}"], est=65, judg=["proportional_reasoning"])


@retry_sep
def pe_rl_switch_open_claim(rng):
    key, ds = sentence_options("Immediately after the switch is opened, the current in the inductor is unchanged in size and direction, because the inductor's emf opposes the decrease in current and keeps it flowing through the resistor.", "An inductor opposes a sudden change in its current; the energy stored in its field drives the current through the resistor.",
                               [("Immediately after the switch is opened, the current in the inductor drops to zero, because the battery no longer supplies the circuit.", "Believes the current in an inductor can change instantly when the source is removed."),
                                ("Immediately after the switch is opened, the current in the inductor reverses direction, because the inductor's emf opposes the original current.", "Thinks an inductor's emf reverses the current rather than opposing its decrease."),
                                ("Immediately after the switch is opened, the current in the inductor doubles, because the inductor's emf adds to the battery's emf.", "Believes the inductor adds to the battery emf when the circuit is opened.")])
    stem = "A battery, a switch, a resistor and an ideal inductor form a series circuit. The switch has been closed for a long time. A second resistor is connected in parallel with the inductor, and then the switch is opened. Which statement about the current in the inductor just after the switch is opened is correct and best justified?"
    return MQ("pe_rl_switch_open_claim", "13.5", "3.B", stem, key, ds, rng, "The current in an inductor cannot change instantaneously", ["Identify the steady-state current before the switch opens", "Apply the continuity of inductor current just after"],
              "the decay of the inductor current after the switch opens is recomputed with an RK4 integration", "", ["claim"], est=85, judg=["justification"], cond=[("the inductor is ideal and the current was steady", "the stem states a long-closed switch and an ideal inductor")])


@retry_sep
def pe_motional_loop_exit(rng):
    for _ in forever():
        B = pick(rng, [0.20, 0.50, 1.0]); w = pick(rng, [10.0, 20.0, 30.0]); v = pick(rng, [1.0, 2.0, 5.0]); R = pick(rng, [0.5, 1.0, 2.0])
        emf = B * w * 1e-2 * v; I = emf / R
        break
    key, ds = num_opts(I * 1e3, [("Uses the emf as the current.", emf * 1e3), ("Uses $B\\,w^2v/R$.", B * (w * 1e-2) ** 2 * v / R * 1e3), ("Uses $Bwv$ with the width in centimeters.", B * w * v / R * 1e3), ("Takes the current as zero because the flux through the loop is not zero.", None)], "", fmt=FU(U_MA))
    stem = f"A square loop of side ${w:g}\\text{{ cm}}$ and resistance ${R:g}\\,\\Omega$ is pulled at constant speed ${v:g}\\text{{ m/s}}$ out of a region of uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ directed perpendicular to the loop. While the loop is partly in the field, what is the magnitude of the induced current?"
    return MQ("pe_motional_loop_exit", "13.2", "2.B", stem, key, ds, rng, "Only the side that cuts through the field line boundary changes the flux", ["Find the rate of change of the flux through the loop", "Divide the emf by the resistance"],
              "the flux through the loop is recomputed as a function of position and differentiated numerically", f"$|\\varepsilon|=Bwv$ and $I=\\varepsilon/R={sig(I * 1e3)}\\text{{ mA}}$.", [f"B={B}", f"w={w}", f"v={v}", f"R={R}"], est=85, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_graph_flux_emf(rng):
    for _ in forever():
        ts = [0.0, 2.0, 4.0, 6.0, 8.0]; ph = [pick(rng, [0.0, 2.0, 4.0]), pick(rng, [6.0, 8.0, 10.0]), pick(rng, [6.0, 8.0, 10.0]), pick(rng, [2.0, 0.0, 4.0]), pick(rng, [2.0, 6.0, 8.0])]
        seg = pick(rng, [0, 1, 2, 3]); slopes = [(ph[i + 1] - ph[i]) / (ts[i + 1] - ts[i]) for i in range(4)]
        emf = -slopes[seg]
        if emf != 0 and len({round(s, 6) for s in slopes}) >= 3:
            break
    mid = (ts[seg] + ts[seg + 1]) / 2
    key, ds = signed_opts(emf, [("Omits the minus sign from Faraday's law.", -emf), ("Reports the flux at that time instead of the emf.", float(np.interp(mid, ts, ph))), ("Uses the flux change over the segment without dividing by its duration.", -(ph[seg + 1] - ph[seg])), ("Uses the average rate over the whole graph.", -(ph[-1] - ph[0]) / (ts[-1] - ts[0]))], "", fmt=FU(U_MV))
    stim = graph_stim("Magnetic flux through a single loop versus time", [("Phi", list(zip(ts, ph)))], gaxis("Time (s)", 0, 8, 1), gaxis("Flux (mWb)", 0, 12, 2))
    stem = f"The graph shows the magnetic flux through a single loop as a function of time, in straight segments. What is the emf induced in the loop at $t={mid:g}\\text{{ s}}$? Use the sign convention $\\varepsilon=-d\\Phi/dt$."
    return MQ("pe_graph_flux_emf", "13.2", "2.B", stem, key, ds, rng, "The induced emf is minus the slope of the flux graph", ["Find the segment containing the time", "Compute $-\\Delta\\Phi/\\Delta t$ for that segment"],
              "the slope of each segment is recomputed with numpy from the plotted vertices", f"On that segment $\\varepsilon=-\\Delta\\Phi/\\Delta t={sig(emf)}\\text{{ mV}}$.", [f"ph={ph}", f"seg={seg}"], stim=stim, est=85, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading"])


STAGE_U13 = ["pe_flux_uniform_coil", "pe_emf_changing_B", "pe_motional_emf_rod", "pe_motional_force", "pe_lenz_direction_claim", "pe_induced_current_loop", "pe_rotating_coil_emf", "pe_solenoid_inductance", "pe_inductor_emf_ramp", "pe_rl_current_growth", "pe_rl_initial_final", "pe_inductor_energy",
             "pe_lc_frequency", "pe_lc_max_current", "pe_induced_E_solenoid", "pe_loop_near_wire_emf", "pe_rl_time_constant_scaling", "pe_rl_switch_open_claim", "pe_motional_loop_exit", "pe_graph_flux_emf"]
