"""AP Physics C: Mechanics 원형 G — 단원 7(진동: 단진동 미분 방정식, 에너지, 단진자와 물리 진자)."""
from physc_common import *


def _shm_rk4_period(k, m, A):
    """독립 경로: RK4 로 1/4 주기(평형 통과)를 구해 4배."""
    st = np.array([A, 0.0]); t = 0.0; dt = 1e-4
    while st[0] > 0:
        prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
    fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr), abs(prv[1] + (st[1] - prv[1]) * fr)


@retry_sep
def pc_shm_max_accel(rng):
    for _ in forever():
        A = pick(rng, [0.05, 0.10, 0.20]); w = pick(rng, [2.0, 4.0, 5.0, 10.0]); am = A * w * w
        tt = np.linspace(0, 2 * math.pi / w, 20001); x = A * np.cos(w * tt); a = np.gradient(np.gradient(x, tt), tt); agree(am, float(np.max(np.abs(a[5:-5]))), 5e-3, "am")
        break
    key, ds = num_opts(am, [("Reports the maximum speed, $A\\omega$.", A * w), ("Uses $A\\omega$ squared with the wrong amplitude factor, $A^2\\omega$.", A * A * w), ("Uses $A\\omega^3$.", A * w ** 3), ("Reports the amplitude as the maximum acceleration.", A)], "m/s^2")
    stem = f"A block on a spring oscillates with position $x(t)={A:g}\\cos({w:g}t)$, where $x$ is in meters and $t$ is in seconds. What is the magnitude of the maximum acceleration of the block?"
    return MQ("pc_shm_max_accel", "7.1", "2.B", stem, key, ds, rng, "Maximum acceleration of simple harmonic motion from the position function", ["Differentiate the position twice", "Identify the amplitude of the acceleration"],
              "a numerical second derivative over one period recomputes the maximum", f"$a=-A\\omega^2\\cos\\omega t$, so $|a|_{{max}}=A\\omega^2={sig(am)}\\text{{ m/s}}^2$.", [f"A={A}", f"w={w}"], est=85)


@retry_sep
def pc_shm_period_mass_spring(rng):
    for _ in forever():
        m = pick(rng, [0.2, 0.5, 1.0, 2.0]); k = pick(rng, [20.0, 50.0, 80.0, 200.0]); T = 2 * math.pi * math.sqrt(m / k)
        T2, _ = _shm_rk4_period(k, m, 0.05); agree(T, T2, 1e-3, "T")
        if 0.2 < T < 3:
            break
    key, ds = num_opts(T, [("Inverts the ratio under the root, $2\\pi\\sqrt{k/m}$.", 2 * math.pi * math.sqrt(k / m)), ("Omits the $2\\pi$, $\\sqrt{m/k}$.", math.sqrt(m / k)), ("Omits the square root, $2\\pi m/k$.", 2 * math.pi * m / k), ("Reports the frequency instead of the period, $\\tfrac1{2\\pi}\\sqrt{k/m}$.", math.sqrt(k / m) / (2 * math.pi))], "s")
    stem = f"A ${m:g}\\text{{ kg}}$ block attached to an ideal spring of spring constant ${k:g}\\text{{ N/m}}$ oscillates on a frictionless horizontal surface. What is the period of the oscillation?"
    return MQ("pc_shm_period_mass_spring", "7.2", "2.B", stem, key, ds, rng, "Period of a mass-spring oscillator", ["Recall $T=2\\pi\\sqrt{m/k}$", "Substitute the values"],
              "an RK4 integration of the motion recomputes the period from the quarter period", f"$T=2\\pi\\sqrt{{m/k}}={sig(T)}\\text{{ s}}$.", [f"m={m}", f"k={k}"], est=70)


@retry_sep
def pc_shm_g_independence_claim(rng):
    m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [40.0, 80.0, 100.0]); gm = pick(rng, [1.6, 3.7])
    T = 2 * math.pi * math.sqrt(m / k); Tm = 2 * math.pi * math.sqrt(m / k) * math.sqrt(CG / gm)
    key, ds = sentence_options(f"The period is ${sig(T)}\\text{{ s}}$ both on Earth and on the Moon, because it depends only on the mass and the spring constant.", "With the restoring force $-ky$ measured from the equilibrium position, $T=2\\pi\\sqrt{m/k}$ does not contain $g$; gravity only shifts the equilibrium position.",
                               [(f"The period is longer on the Moon, about ${sig(Tm)}\\text{{ s}}$ compared with ${sig(T)}\\text{{ s}}$ on Earth, because the weaker gravity gives a weaker restoring force.", "Believes that gravity supplies the restoring force of a spring oscillator."),
                                (f"The period is shorter on the Moon than the ${sig(T)}\\text{{ s}}$ on Earth, because the spring stretches less at equilibrium.", "Thinks that a smaller equilibrium stretch gives a shorter period."),
                                (f"The period on the Moon is ${sig(Tm)}\\text{{ s}}$ compared with ${sig(T)}\\text{{ s}}$ on Earth, because the period is proportional to $\\sqrt{{1/g}}$ as for a pendulum.", "Applies the pendulum period to a spring oscillator.")])
    stem = f"A ${m:g}\\text{{ kg}}$ block hangs from a vertical ideal spring ($k={k:g}\\text{{ N/m}}$) and oscillates with small amplitude, first on Earth and then on the Moon, where $g={gm:g}\\text{{ m/s}}^2$. Which statement about the period of the oscillation is correct and best justified?"
    return MQ("pc_shm_g_independence_claim", "7.2", "3.B", stem, key, ds, rng, "The period of a vertical mass-spring oscillator does not depend on g", ["Write the net force relative to the equilibrium position", "Identify what the period depends on"],
              "an RK4 integration of the vertical oscillation with gravity included shows the same period for both values of $g$", "", [f"m={m}", f"k={k}", f"gm={gm}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pc_shm_speed_at_x(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [50.0, 100.0, 200.0]); A = pick(rng, [0.10, 0.20, 0.30]); x = A * pick(rng, [0.4, 0.5, 0.6, 0.8])
        v = math.sqrt(k / m * (A * A - x * x))
        agree(v, math.sqrt((0.5 * k * A * A - 0.5 * k * x * x) * 2 / m), 1e-9, "v")
        break
    key, ds = num_opts(v, [("Uses the maximum speed, $A\\sqrt{k/m}$.", A * math.sqrt(k / m)), ("Subtracts the amplitude and position instead of their squares, $\\sqrt{k(A-x)/m}$.", math.sqrt(k / m * (A - x))), ("Uses the position as the amplitude, $x\\sqrt{k/m}$.", x * math.sqrt(k / m)), ("Omits the factor from the mass, $\\sqrt{k(A^2-x^2)}$.", math.sqrt(k * (A * A - x * x)))], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ block on an ideal spring ($k={k:g}\\text{{ N/m}}$) oscillates on a frictionless surface with amplitude ${A:g}\\text{{ m}}$. What is the speed of the block when it is ${x:.3g}\\text{{ m}}$ from the equilibrium position?"
    return MQ("pc_shm_speed_at_x", "7.4", "2.B", stem, key, ds, rng, "Energy conservation in simple harmonic motion", ["Write the total energy as $\\tfrac12kA^2$", "Subtract the elastic energy at the given position and solve for the speed"],
              "the speed is recomputed from the energy balance in a separate arrangement", f"$\\tfrac12mv^2=\\tfrac12k(A^2-x^2)$ gives $v={sig(v)}\\text{{ m/s}}$.", [f"m={m}", f"k={k}", f"A={A}", f"x={x}"], est=100)


@retry_sep
def pc_shm_ke_fraction(rng):
    r = pick(rng, [(1, 2), (1, 3), (2, 3), (3, 4)]); fr = 1 - (r[0] / r[1]) ** 2
    agree(fr, 1 - (r[0] / r[1]) ** 2, 1e-12, "fr")
    key, ds = num_opts(fr, [("Uses the position fraction itself, $1-x/A$.", 1 - r[0] / r[1]), ("Uses $x/A$ for the kinetic energy fraction.", r[0] / r[1]), ("Uses $(x/A)^2$, the potential energy fraction.", (r[0] / r[1]) ** 2), ("Assumes half of the energy is kinetic at every position away from equilibrium.", 0.5)], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A block oscillates on an ideal spring with amplitude $A$. What fraction of the total mechanical energy is kinetic when the block is at $x={r[0]}A/{r[1]}$ from the equilibrium position?"
    return MQ("pc_shm_ke_fraction", "7.4", "2.B", stem, key, ds, rng, "Split of the energy in simple harmonic motion", ["The elastic energy fraction is $(x/A)^2$", "The rest of the total energy is kinetic"],
              "the energy fractions are computed numerically from $x/A$", f"$U/E=(x/A)^2=({r[0]}/{r[1]})^2$ so $K/E=1-(x/A)^2={sig(fr)}$.", [f"r={r}"], est=80)


@retry_sep
def pc_shm_ode_period(rng):
    for _ in forever():
        c = pick(rng, [4.0, 9.0, 16.0, 25.0, 36.0, 100.0]); T = 2 * math.pi / math.sqrt(c)
        T2, _ = _shm_rk4_period(c, 1.0, 0.05); agree(T, T2, 1e-3, "T")
        break
    key, ds = num_opts(T, [(f"Omits the square root, $2\\pi/{c:g}={sig(2 * math.pi / c)}\\text{{ s}}$.", 2 * math.pi / c), (f"Omits the $2\\pi$, $1/\\sqrt{{{c:g}}}={sig(1 / math.sqrt(c))}\\text{{ s}}$.", 1 / math.sqrt(c)), (f"Multiplies by the root instead of dividing, $2\\pi\\sqrt{{{c:g}}}={sig(2 * math.pi * math.sqrt(c))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(c)), (f"Reports the angular frequency $\\sqrt{{{c:g}}}={sig(math.sqrt(c))}\\text{{ rad/s}}$ as the period.", math.sqrt(c))], "s")
    stem = f"The position of a particle obeys $\\dfrac{{d^2x}}{{dt^2}}=-{c:g}\\,x$, where $x$ is in meters and $t$ is in seconds. What is the period of the motion?"
    return MQ("pc_shm_ode_period", "7.1", "2.B", stem, key, ds, rng, "Angular frequency from the differential equation of simple harmonic motion", ["Compare the equation with $d^2x/dt^2=-\\omega^2x$", "Use $T=2\\pi/\\omega$"],
              "an RK4 integration of the equation recomputes the period from the quarter period", f"$\\omega=\\sqrt{{{c:g}}}={sig(math.sqrt(c))}\\text{{ rad/s}}$ and $T=2\\pi/\\omega={sig(T)}\\text{{ s}}$.", [f"c={c}"], est=75)


@retry_sep
def pc_pendulum_moon_ratio(rng):
    gm = pick(rng, [1.6, 2.4, 3.7, 4.9]); ans = math.sqrt(CG / gm)
    key, ds = num_opts(ans, [("Uses the ratio of the field strengths without the root, $g_E/g_M$.", CG / gm), ("Inverts the ratio, $\\sqrt{g_M/g_E}$.", math.sqrt(gm / CG)), ("Uses the inverse ratio without the root, $g_M/g_E$.", gm / CG), ("Reports that the period does not depend on $g$.", 1.0)], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A simple pendulum with a small amplitude is moved from Earth ($g=9.8\\text{{ m/s}}^2$) to a moon where $g={gm:g}\\text{{ m/s}}^2$. The string length is unchanged. What is the ratio of the period on the moon to the period on Earth?"
    return MQ("pc_pendulum_moon_ratio", "7.5", "2.D", stem, key, ds, rng, "Period of a simple pendulum depends on the field strength", ["Use $T=2\\pi\\sqrt{L/g}$", "Take the ratio at fixed length"],
              "the periods are evaluated numerically for both values of g", f"$T\\propto g^{{-1/2}}$ so $T_M/T_E=\\sqrt{{g_E/g_M}}={sig(ans)}$.", [f"gm={gm}"], est=80, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_physical_pendulum_period(rng):
    for _ in forever():
        L = pick(rng, [0.6, 0.9, 1.2, 1.5, 2.0]); M = 1.0; I = M * L * L / 3; d = L / 2; T = 2 * math.pi * math.sqrt(I / (M * CG * d)); T0 = 2 * math.pi * math.sqrt(2 * L / (3 * CG)); agree(T, T0, 1e-9, "T")
        break
    key, ds = num_opts(T, [("Treats the rod as a simple pendulum of length $L$, $2\\pi\\sqrt{L/g}$.", 2 * math.pi * math.sqrt(L / CG)), ("Uses the center-of-mass inertia $ML^2/12$ at the pivot, $2\\pi\\sqrt{L/(6g)}$.", 2 * math.pi * math.sqrt(L / (6 * CG))), ("Treats the rod as a simple pendulum of length $L/2$.", 2 * math.pi * math.sqrt(L / (2 * CG))), ("Uses $\\sqrt{3L/(2g)}$, inverting the ratio of the inertia.", 2 * math.pi * math.sqrt(3 * L / (2 * CG)))], "s")
    stem = f"A uniform rod of length ${L:g}\\text{{ m}}$ swings with a small amplitude about a frictionless horizontal pivot through one end. The rotational inertia about the pivot is $\\tfrac13ML^2$. What is the period of the oscillation?"
    return MQ("pc_physical_pendulum_period", "7.5", "2.B", stem, key, ds, rng, "Period of a physical pendulum", ["Write the restoring torque $-Mg(L/2)\\theta$ for small angles", "Use $T=2\\pi\\sqrt{I/(Mgd)}$"],
              "the period is recomputed from the small-angle equation of motion with the same constants", f"$T=2\\pi\\sqrt{{\\tfrac13ML^2/(Mg\\,L/2)}}=2\\pi\\sqrt{{2L/(3g)}}={sig(T)}\\text{{ s}}$.", [f"L={L}"], est=105)


@retry_sep
def pc_spring_parallel_period(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); k1 = pick(rng, [20.0, 40.0, 60.0]); k2 = pick(rng, [30.0, 50.0, 80.0]); T = 2 * math.pi * math.sqrt(m / (k1 + k2))
        T2, _ = _shm_rk4_period(k1 + k2, m, 0.05); agree(T, T2, 1e-3, "T")
        break
    ks = k1 * k2 / (k1 + k2)
    key, ds = num_opts(T, [("Treats the springs as if they were in series, $k=k_1k_2/(k_1+k_2)$.", 2 * math.pi * math.sqrt(m / ks)), (f"Uses only the first spring, $k_1={k1:g}\\text{{ N/m}}$.", 2 * math.pi * math.sqrt(m / k1)), (f"Averages the spring constants, $k=(k_1+k_2)/2$.", 2 * math.pi * math.sqrt(m / ((k1 + k2) / 2))), ("Adds the periods that each spring would give alone.", 2 * math.pi * (math.sqrt(m / k1) + math.sqrt(m / k2)))], "s")
    stem = f"A ${m:g}\\text{{ kg}}$ block lies on a frictionless horizontal surface between two walls. It is attached to the left wall by an ideal spring with $k_1={k1:g}\\text{{ N/m}}$ and to the right wall by an ideal spring with $k_2={k2:g}\\text{{ N/m}}$. Both springs are at their natural length when the block is at its equilibrium position, so when the block moves one spring stretches while the other compresses. What is the period of small oscillations of the block?"
    return MQ("pc_spring_parallel_period", "7.2", "2.B", stem, key, ds, rng, "Effective spring constant of springs acting in parallel", ["Add the restoring forces of the two springs", "Use the effective spring constant in the period"],
              "an RK4 integration with the summed spring constant recomputes the period", f"$k_{{eff}}=k_1+k_2$ and $T=2\\pi\\sqrt{{m/(k_1+k_2)}}={sig(T)}\\text{{ s}}$.", [f"m={m}", f"k1={k1}", f"k2={k2}"], est=95)


@retry_sep
def pc_shm_time_fraction(rng):
    case = rng.randrange(3); T = pick(rng, [1.2, 2.4, 3.6, 6.0])
    frac = [1 / 4, 1 / 6, 1 / 8][case]; tgt = ["the equilibrium position ($x=0$)", "the position $x=A/2$", "the position $x=A/\\sqrt{2}$"][case]
    xt = [0.0, 0.5, math.sqrt(2) / 2][case]; tn = math.acos(xt) / (2 * math.pi / T); agree(tn, frac * T, 1e-9, "t")
    ans = frac * T
    if case == 0:
        wr = [(f"Uses half of the period, ${sig(T / 2)}\\text{{ s}}$, which is the time to reach the opposite turning point $x=-A$.", T / 2), (f"Uses one eighth of the period, ${sig(T / 8)}\\text{{ s}}$, by halving the quarter period.", T / 8), (f"Uses one third of the period, ${sig(T / 3)}\\text{{ s}}$, by dividing the period by the three positions $+A$, $0$ and $-A$.", T / 3)]
    elif case == 1:
        wr = [(f"Uses one eighth of the period, ${sig(T / 8)}\\text{{ s}}$, assuming the position changes linearly in time so half of the amplitude takes half of a quarter period.", T / 8), (f"Uses one quarter of the period, ${sig(T / 4)}\\text{{ s}}$, which is the time to reach the equilibrium position.", T / 4), (f"Uses one third of the period, ${sig(T / 3)}\\text{{ s}}$, which is the time to first reach $x=-A/2$.", T / 3)]
    else:
        wr = [(f"Uses one quarter of the period, ${sig(T / 4)}\\text{{ s}}$, which is the time to reach the equilibrium position.", T / 4), (f"Uses one sixth of the period, ${sig(T / 6)}\\text{{ s}}$, which is the time to reach $x=A/2$.", T / 6), (f"Uses one sixteenth of the period, ${sig(T / 16)}\\text{{ s}}$, by halving the correct time.", T / 16)]
    key, ds = num_opts(ans, wr, "s")
    stem = f"A block oscillates on an ideal spring with period ${T:g}\\text{{ s}}$ and amplitude $A$. It is released from rest at $x=A$. How long does the block take to first reach {tgt}?"
    return MQ("pc_shm_time_fraction", "7.3", "2.B", stem, key, ds, rng, "Time between two positions in simple harmonic motion", ["Write $x=A\\cos(2\\pi t/T)$", "Solve for the time at which $x$ equals the target position"],
              "the inverse cosine of the position fraction is evaluated numerically", f"$\\cos(2\\pi t/T)={xt:.3g}$ gives $t={sig(ans)}\\text{{ s}}$.", [f"T={T}", f"case={case}"], est=100)


@retry_sep
def pc_shm_xt_graph_claim(rng):
    T = pick(rng, [2.0, 4.0]); A = pick(rng, [0.10, 0.20]); q = rng.randrange(4); tm = [T / 8, 3 * T / 8, 5 * T / 8, 7 * T / 8][q]
    f = lambda s: A * math.cos(2 * math.pi * s / T)  # noqa: E731
    v = nd(f, tm); a = (f(tm + 1e-3) - 2 * f(tm) + f(tm - 1e-3)) / 1e-6; x = f(tm)
    sg = lambda z: "positive" if z > 0 else "negative"  # noqa: E731

    def sent(sx, sv, sa):
        return (f"The position is {sx}, because the graph is {'above' if sx == 'positive' else 'below'} the axis; the velocity is {sv}, because the graph is {'rising' if sv == 'positive' else 'falling'}; and the acceleration is {sa}.")
    tx, tv, ta = sg(x), sg(v), sg(a)
    flip = lambda z: "negative" if z == "positive" else "positive"  # noqa: E731
    key, ds = sentence_options(sent(tx, tv, ta), "The graph's height gives the sign of $x$, its slope gives the sign of $v$, and $a=-\\omega^2x$ always has the sign opposite to $x$.",
                               [(sent(tx, flip(tv), ta), "Reads the slope sign backward, taking a falling graph as a positive velocity or a rising graph as a negative one."), (sent(tx, tv, flip(ta)), "Gives the acceleration the same sign as the position, instead of the opposite sign required by $a=-\\omega^2x$."),
                                (sent(flip(tx), tv, flip(ta)), "Reads the sign of the position backward, taking a point above the axis as negative or a point below the axis as positive.")])
    stim = dense_graph_stim("Position of the oscillating block versus time", f, 0, T, gaxis("Time (s)", 0, T, T / 8), sym_axis("Position (m)", A), n=161)
    stem = f"The graph shows the position of an oscillating block as a function of time. Which statement about the signs of the position, the velocity and the acceleration at $t={tm:g}\\text{{ s}}$ is correct?"
    return MQ("pc_shm_xt_graph_claim", "7.3", "3.C", stem, key, ds, rng, "Signs of x, v and a read from a position-time graph of SHM", ["Read the position and the slope of the graph at the marked time", "Use $a=-\\omega^2x$ for the acceleration"],
              "the signs are computed by finite differences of the plotted function", "", [f"T={T}", f"A={A}", f"q={q}"], stim=stim, est=110, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "justification"])


@retry_sep
def pc_shm_scaling(rng):
    k = pick(rng, [2, 3, 4]); which = rng.randrange(3)
    if which == 0:
        ans = 1.0; stem = f"A block oscillates on an ideal spring. The amplitude of the oscillation is multiplied by ${k}$ with the same block and spring. By what factor does the period change?"; why = "The period $2\\pi\\sqrt{m/k}$ does not depend on the amplitude."
        wr = [(f"Multiplies the period by ${k}$, thinking that a larger amplitude takes proportionally longer.", float(k)), (f"Multiplies the period by $\\sqrt{{{k}}}$, thinking that the amplitude enters like the mass.", math.sqrt(k)), (f"Multiplies the period by $1/{k}$, thinking that the block moves faster over a larger amplitude and so finishes sooner.", 1.0 / k), (f"Multiplies the period by ${k * k}$, thinking that the period grows like the energy.", float(k * k))]
    elif which == 1:
        ans = math.sqrt(k); stem = f"A block oscillates on an ideal spring. The mass of the block is multiplied by ${k}$ with the same spring. By what factor does the period change?"; why = f"$T\\propto\\sqrt{{m}}$, so the period is multiplied by $\\sqrt{{{k}}}$."
        wr = [(f"Multiplies the period by ${k}$, treating the period as directly proportional to the mass.", float(k)), (f"Multiplies the period by $1/\\sqrt{{{k}}}$, inverting the dependence on the mass.", 1 / math.sqrt(k)), (f"Multiplies the period by ${k * k}$, squaring the factor.", float(k * k)), ("Leaves the period unchanged, because the spring is the same.", 1.0)]
    else:
        ans = 1 / math.sqrt(k); stem = f"A block oscillates on an ideal spring. The spring is replaced by one with a spring constant ${k}$ times larger. By what factor does the period change?"; why = f"$T\\propto1/\\sqrt{{k}}$, so the period is multiplied by $1/\\sqrt{{{k}}}$."
        wr = [(f"Multiplies the period by $1/{k}$, treating the period as inversely proportional to the spring constant.", 1.0 / k), (f"Multiplies the period by $\\sqrt{{{k}}}$, inverting the dependence on the spring constant.", math.sqrt(k)), (f"Multiplies the period by ${k}$, as if a stiffer spring made the oscillation slower.", float(k)), ("Leaves the period unchanged, because the mass is the same.", 1.0)]
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    return MQ("pc_shm_scaling", "7.2", "2.D", stem, key, ds, rng, "Scaling of the period of a mass-spring oscillator", ["Write $T=2\\pi\\sqrt{m/k}$", "Apply the stated factor"],
              "the period is evaluated numerically for both settings", why, [f"k={k}", f"which={which}"], est=70, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_vertical_spring_period(rng):
    for _ in forever():
        dx = pick(rng, [0.05, 0.10, 0.20, 0.40]); T = 2 * math.pi * math.sqrt(dx / CG); m = 1.0; k = m * CG / dx
        T2, _ = _shm_rk4_period(k, m, 0.01); agree(T, T2, 1e-3, "T")
        break
    key, ds = num_opts(T, [("Uses $2\\pi\\sqrt{g/\\Delta x}$, inverting the ratio.", 2 * math.pi * math.sqrt(CG / dx)), ("Uses the pendulum form with the stretch as a length and no $2\\pi$, $\\sqrt{\\Delta x/g}$.", math.sqrt(dx / CG)), ("Omits the square root, $2\\pi\\Delta x/g$.", 2 * math.pi * dx / CG), ("Uses $2\\pi\\sqrt{2\\Delta x/g}$, adding a factor of two.", 2 * math.pi * math.sqrt(2 * dx / CG))], "s")
    stem = f"An object hangs at rest from a vertical ideal spring and stretches it by ${dx * 100:g}\\text{{ cm}}$ at equilibrium. The object is then pulled down a small distance and released. What is the period of the oscillation? (The mass and the spring constant are not given.)"
    return MQ("pc_vertical_spring_period", "7.2", "2.B", stem, key, ds, rng, "Period from the equilibrium stretch of a hanging spring", ["Use $k\\Delta x=mg$ to eliminate $k/m$", "Substitute into $T=2\\pi\\sqrt{m/k}$"],
              "an RK4 integration with $k/m=g/\\Delta x$ recomputes the period", f"$k/m=g/\\Delta x$, so $T=2\\pi\\sqrt{{\\Delta x/g}}={sig(T)}\\text{{ s}}$.", [f"dx={dx}"], est=95)


@retry_sep
def pc_shm_energy_scaling(rng):
    k = pick(rng, [2, 3]); which = rng.randrange(2)
    if which == 0:
        ans = float(k * k); stem = f"A block oscillates on an ideal spring. The amplitude is multiplied by ${k}$. By what factor does the total mechanical energy change?"
        wr = [(f"Multiplies the energy by ${k}$, treating the energy as directly proportional to the amplitude.", float(k)), ("Leaves the energy unchanged, because the spring constant and the mass are unchanged.", 1.0), (f"Multiplies the energy by ${k ** 3}$, cubing the amplitude factor.", float(k ** 3)), (f"Multiplies the energy by $\\sqrt{{{k}}}$, as if the energy depended on the square root of the amplitude.", math.sqrt(k))]
        why = f"$E=\\tfrac12kA^2$ is proportional to $A^2$, so the energy is multiplied by ${k * k}$."
    else:
        ans = float(k); stem = f"A block oscillates on an ideal spring. The amplitude is multiplied by ${k}$. By what factor does the maximum speed change?"
        wr = [(f"Multiplies the maximum speed by ${k * k}$, squaring the amplitude factor as for the energy.", float(k * k)), ("Leaves the maximum speed unchanged, because the period does not depend on the amplitude.", 1.0), (f"Multiplies the maximum speed by $\\sqrt{{{k}}}$, taking the square root of the amplitude factor.", math.sqrt(k)), (f"Multiplies the maximum speed by $1/{k}$, thinking a larger amplitude slows the block.", 1.0 / k)]
        why = f"$v_{{max}}=A\\omega$ is proportional to $A$ at a fixed $\\omega=\\sqrt{{k/m}}$, so the maximum speed is multiplied by ${k}$."
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    return MQ("pc_shm_energy_scaling", "7.4", "2.D", stem, key, ds, rng, "Scaling of energy and maximum speed with amplitude", ["Write $E=\\tfrac12kA^2$ and $v_{max}=A\\sqrt{k/m}$", "Apply the amplitude factor"],
              "the energy and the maximum speed are evaluated numerically for both amplitudes", why, [f"k={k}", f"which={which}"], est=70, judg=["law_selection", "proportional_reasoning"])


STAGE_U7 = ["pc_shm_max_accel", "pc_shm_period_mass_spring", "pc_shm_g_independence_claim", "pc_shm_speed_at_x", "pc_shm_ke_fraction", "pc_shm_ode_period", "pc_pendulum_moon_ratio", "pc_physical_pendulum_period",
            "pc_spring_parallel_period", "pc_shm_time_fraction", "pc_shm_xt_graph_claim", "pc_shm_scaling", "pc_vertical_spring_period", "pc_shm_energy_scaling"]
