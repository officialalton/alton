"""AP Physics C: Mechanics — FRQ 원형 4유형 × 2시나리오(MR 10점 / TBR 12점 / LAB 10점 / QQT 8점, 합 40). 배점은 같은 계열 CED(Physics C: E&M·Physics 2)의 값으로, C: Mechanics 자체 배점은 공식 확인 전이다(docs/ap/physics-c-mechanics-groundwork.md).
공식 FRQ 는 종이 손글씨이므로 이 원형은 문제·키·채점 행·자기 채점 참고 답안을 만든다. 모든 정답·수치는 코드(sympy·numpy·RK4)가 두 경로로 계산한다. 모범 답안은 'ALTON reference answer for self-review — not official AP scoring' 이다."""
from physc_common import *
from phys_p0_frq import R, _ev, part, REF_NOTE
from bp import frq_blueprint

t_ = sp.symbols("t", positive=True)


def _pack(arch, template, topic, extra, skill, title, stim, parts, total, minutes, facts, expected, bpr_args, judgment):
    assert sum(p["points"] for p in parts) == total and all(r["points"] == 1 for p in parts for r in p["rubric_rows"]), (arch, total)
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "allowed", "title": title, "stimulus": stim,
          "parts": parts, "total_points": total, "est_minutes": minutes, "facts": facts, "expected_values": expected, "reference_note": REF_NOTE}
    concept, thinking, conds, material, path_ = bpr_args
    pk["blueprint"] = frq_blueprint(arch, SUBC, pk, concept, thinking, conds, material, path_, extra={"judgment_demand": judgment})
    return pk


# ======================= MR (10): 시간에 따라 변하는 힘을 받는 블록 =======================
def pcf_mr_variable_force_block(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); c = pick(rng, [2.0, 3.0, 4.0, 6.0]); T = pick(rng, [2.0, 3.0, 4.0])
        v = c * T ** 2 / (2 * m); x = c * T ** 3 / (6 * m)
        y = rk4(lambda tt, s: np.array([s[1], c * tt / m]), [0.0, 0.0], 0.0, T, 4000); agree(v, y[1], 1e-6, "v"); agree(x, y[0], 1e-6, "x")
        if v > 3:
            break
    ts = sp.symbols("t"); vsym = sp.integrate(sp.Symbol("c") * ts / sp.Symbol("m"), (ts, 0, sp.Symbol("T"))); agree(float(vsym.subs({sp.Symbol("c"): c, sp.Symbol("m"): m, sp.Symbol("T"): T})), v, 1e-9, "vsym")
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ rests on a horizontal, frictionless surface. Starting at $t=0$, a horizontal force of magnitude $F(t)=ct$ pushes the block, where $c={c:g}\\text{{ N/s}}$.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents the block, draw and label the forces (not components) that act on the block while the force is applied. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A"],
             "Three arrows from the dot: weight straight down, normal force straight up with the same length, and the applied force horizontal in the direction of motion.",
             [R("A1", "diagram", "Draws and labels the weight (down), the normal force (up) and the applied force (horizontal), with no friction force and no force of motion", ["weight", "normal force", "applied force"], err=["adds a force of motion", "draws a friction force on a frictionless surface"]),
              R("A2", "diagram", "The applied force arrow is horizontal and points in the direction in which the block accelerates", ["horizontal arrow in the direction of motion"], err=["draws the applied force at an angle"]),
              R("A3", "diagram", "The weight and the normal force arrows have the same length because the block has no vertical acceleration", ["equal lengths of weight and normal force"], err=["draws the normal force longer than the weight"])]),
        part("B", "Derive an expression for the speed $v(t)$ of the block as a function of time in terms of $m$, $c$ and $t$.", 3, "derive", ["2.A"],
             "$a=F/m=ct/m$ and $v=\\int_0^t a\\,dt'=ct^2/(2m)$.",
             [R("B1", "expression", "Applies Newton's second law to find the acceleration $a=ct/m$", ["a = c t / m"], err=["treats the acceleration as constant, $a=c/m$"]),
              R("B2", "expression", "Integrates the acceleration with respect to time", ["v = integral of a dt"], requires="B1", err=["multiplies the acceleration by the time instead of integrating"]),
              R("B3", "expression", "Obtains $v(t)=ct^2/(2m)$ using the initial condition $v(0)=0$", ["c t^2 / (2 m)"], requires="B2", err=["omits the factor of one half"])]),
        part("C", f"Calculate the speed of the block at $t={T:g}\\text{{ s}}$ for $m={m:g}\\text{{ kg}}$ and $c={c:g}\\text{{ N/s}}$.", 2, "calculate", ["2.B"],
             f"$v=cT^2/(2m)=({c:g})({T:g})^2/(2\\cdot{m:g})\\approx {v:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", "Substitutes the values into the expression from part B", ["substitution"], requires="B3", nums=True, err=["uses the force at $t=T$ divided by the mass as the speed"]),
              R("C2", "numeric", f"Obtains about {v:.2f} with units of meters per second", [f"{v:.2f}", "m/s"], requires="C1", nums=True, units=True)]),
        part("D", f"The experiment is repeated with a block of twice the mass. By what factor does the distance that the block travels during the first ${T:g}\\text{{ s}}$ change, and what is that distance for the heavier block? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The distance is $x=\\int v\\,dt=ct^3/(6m)$, which is inversely proportional to the mass, so doubling the mass halves the distance ($x\\approx{x:.2f}\\text{{ m}}$ becomes ${x / 2:.2f}\\text{{ m}}$).",
             [R("D1", "numeric", f"States that the distance is halved and gives about {x / 2:.2f} with units of meters for the heavier block", ["halved", f"{x / 2:.2f}", "m"], nums=True, units=True, err=["states the distance is unchanged", "states the distance is divided by four"]),
              R("D2", "justification", "Justifies with $x=ct^3/(6m)$ or by noting that the acceleration at every time is halved when the mass is doubled", ["x proportional to 1/m", "acceleration halved"], requires="D1", err=["argues only that heavier objects move less"])]),
    ]
    return _pack("pcf_mr_variable_force_block", "mr", "2.5", ["1.2", "2.2"], "2.B", "Block pushed by a force that grows with time", stim, parts, 10, 22, [f"m={m}", f"c={c}", f"T={T}", f"v={v:.4f}", f"x={x:.4f}"],
                 [_ev("C", "speed", v, max(0.05, 0.012 * v), "m/s"), _ev("D", "distance with the doubled mass", x / 2, max(0.05, 0.012 * x / 2), "m")],
                 ("Newton's second law with a time-dependent force, derived by integration, and a justified prediction about doubling the mass", ["Draw the free-body diagram of the block", "Integrate the acceleration to get the speed as a function of time", "Predict the effect of doubling the mass using the distance expression"],
                  [("the surface is frictionless and the force is horizontal", "the stimulus states a frictionless horizontal surface and a horizontal force")], {"type": "text", "must_include": ["the mass", "the force law F(t)=ct"]},
                  "sympy integrates the acceleration symbolically; an RK4 integration of the equation of motion recomputes the speed and the distance"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= MR (10): 선형 저항을 받는 낙하 =======================
def pcf_mr_drag_fall(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); b = pick(rng, [0.5, 1.0, 2.0, 4.0]); vt = m * CG / b; tau = m / b
        y = rk4(lambda tt, s: np.array([CG - b * s[0] / m]), [0.0], 0.0, 25 * tau, 25000); agree(vt, y[0], 1e-5, "vt")
        if 2 < vt < 40:
            break
    stim = {"kind": "text", "description": f"A small sphere of mass $m={m:g}\\text{{ kg}}$ is released from rest and falls through a viscous fluid. The fluid exerts a drag force of magnitude $bv$ on the sphere, opposite to its velocity, where $v$ is the speed and $b={b:g}\\text{{ kg/s}}$. Buoyancy is negligible and $g=9.8\\text{{ m/s}}^2$.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents the sphere, draw and label the forces (not components) that act on the sphere just after it is released, when its speed is still small. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A"],
             "Two arrows from the dot: weight straight down and the drag force straight up; the weight arrow is longer than the drag arrow while the sphere is still speeding up.",
             [R("A1", "diagram", "Draws and labels the weight (down) and the drag force (up), with no extra force such as a force of motion", ["weight", "drag force"], err=["adds a force of motion downward"]),
              R("A2", "diagram", "The directions are correct: weight straight down and drag straight up (opposite to the velocity)", ["directions"], err=["draws the drag force downward"]),
              R("A3", "diagram", "The weight arrow is longer than the drag arrow for a sphere that is still speeding up", ["weight longer than drag"], err=["draws equal lengths for a sphere that is speeding up"])]),
        part("B", "Write Newton's second law for the sphere and derive an expression for the terminal speed $v_t$ in terms of $m$, $g$ and $b$.", 3, "derive", ["2.A"],
             "$mg-bv=m\\,dv/dt$. At terminal speed $dv/dt=0$, so $mg=bv_t$ and $v_t=mg/b$.",
             [R("B1", "expression", "Writes Newton's second law with the correct signs: $mg-bv=m\\,dv/dt$", ["m g - b v = m dv/dt"], err=["adds the drag force to the weight"]),
              R("B2", "expression", "Sets the acceleration to zero at terminal speed", ["dv/dt = 0"], requires="B1", err=["sets the speed to zero"]),
              R("B3", "expression", "Obtains $v_t=mg/b$", ["m g / b"], requires="B2", err=["obtains $v_t=b/(mg)$"])]),
        part("C", f"Calculate the terminal speed for $m={m:g}\\text{{ kg}}$ and $b={b:g}\\text{{ kg/s}}$.", 2, "calculate", ["2.B"],
             f"$v_t=mg/b=({m:g})(9.8)/{b:g}\\approx {vt:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", "Substitutes the values into the expression from part B", ["substitution"], requires="B3", nums=True, err=["uses $g=10$ with the wrong number of significant figures only"]),
              R("C2", "numeric", f"Obtains about {vt:.2f} with units of meters per second", [f"{vt:.2f}", "m/s"], requires="C1", nums=True, units=True)]),
        part("D", "The sphere is replaced by a sphere with the same mass in a fluid that has twice the value of $b$. Does the terminal speed increase, decrease, or stay the same? By what factor? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             "The terminal speed decreases by a factor of 2, because $v_t=mg/b$ is inversely proportional to $b$.",
             [R("D1", "claim", "States that the terminal speed decreases by a factor of 2", ["decreases", "factor of 2"], err=["states the terminal speed is unchanged because the weight is unchanged"]),
              R("D2", "justification", "Justifies with $v_t=mg/b$ (or with the force balance $mg=bv_t$ at a larger $b$)", ["v_t proportional to 1/b"], requires="D1", err=["argues only that the drag is larger without relating it to the balance"])]),
    ]
    return _pack("pcf_mr_drag_fall", "mr", "2.9", ["2.5", "2.2", "1.2"], "2.B", "Sphere falling through a viscous fluid", stim, parts, 10, 22, [f"m={m}", f"b={b}", f"vt={vt:.4f}"],
                 [_ev("C", "terminal speed", vt, max(0.05, 0.012 * vt), "m/s")],
                 ("Newton's second law with a speed-dependent resistive force and a justified prediction about the terminal speed", ["Draw the free-body diagram of the sphere", "Set the acceleration to zero to derive the terminal speed", "Predict the effect of doubling the drag coefficient"],
                  [("the drag force is $bv$ and buoyancy is negligible", "the stimulus states the drag law and negligible buoyancy")], {"type": "text", "must_include": ["the mass", "the drag law bv"]},
                  "an RK4 integration of m dv/dt = mg - bv over many time constants recomputes the terminal speed"),
                 ["representation_reading", "law_selection", "justification"])


# ======================= TBR (12): 블록-용수철 진동 =======================
def pcf_tbr_shm_blocks(rng):
    for _ in forever():
        k = pick(rng, [40.0, 50.0, 80.0, 100.0]); m = pick(rng, [0.4, 0.5, 1.0, 2.0]); A = pick(rng, [0.10, 0.15, 0.20])
        T = 2 * math.pi * math.sqrt(m / k); vmax = A * math.sqrt(k / m); amax = k * A / m
        T2, vq = _shm_rk4(k, m, A); agree(T, T2, 1e-3, "T"); agree(vmax, vq, 3e-3, "vmax")
        break
    n = pick(rng, [4, 9]); T3 = T * math.sqrt(n)
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ is attached to a horizontal ideal spring of spring constant $k={k:g}\\text{{ N/m}}$ on a frictionless surface. The block is pulled to $x=+A$, with $A={A:g}\\text{{ m}}$, and released from rest at $t=0$. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", f"On the axes provided, sketch the position $x$ of the block as a function of time $t$ for two full oscillations. Label the amplitude and the period for the given values.", 4, "graph", ["1.A", "1.C"],
             f"A cosine curve starting at $x=+{A:g}\\text{{ m}}$ with period $T=2\\pi\\sqrt{{m/k}}\\approx {T:.2f}\\text{{ s}}$, repeated twice.",
             [R("A1", "graph", "The curve is a cosine: it starts at the maximum $x=+A$ at $t=0$", ["cosine shape starting at +A"], err=["starts at zero like a sine"]),
              R("A2", "graph", f"The amplitude is labeled or scaled as ${A:g}\\text{{ m}}$ and the curve is symmetric about $x=0$", [f"{A:g}"], nums=True),
              R("A3", "graph", f"The period is marked as about ${T:.2f}\\text{{ s}}$ and two full cycles are shown", [f"{T:.2f}"], nums=True, err=["marks half of the period"]),
              R("A4", "graph", "Both axes are labeled with quantities and units", ["axis labels", "units"])]),
        part("B", "Derive an expression for the maximum speed of the block in terms of $m$, $k$, and $A$ using conservation of energy.", 3, "derive", ["2.A"],
             "$\\tfrac12kA^2=\\tfrac12mv_{max}^2$ so $v_{max}=A\\sqrt{k/m}$.",
             [R("B1", "expression", "Identifies the energy at $x=A$ as only elastic: $E=\\tfrac12kA^2$", ["E = 1/2 k A^2"], err=["includes a kinetic energy term at the turning point"]),
              R("B2", "expression", "Sets the energy equal to the kinetic energy at $x=0$: $\\tfrac12kA^2=\\tfrac12mv_{max}^2$", ["1/2 k A^2 = 1/2 m v^2"], requires="B1", err=["uses $kA=mv$"]),
              R("B3", "expression", "Solves for $v_{max}=A\\sqrt{k/m}$", ["A sqrt(k/m)"], requires="B2", err=["omits the square root"])]),
        part("C", f"Calculate the maximum speed and the magnitude of the maximum acceleration of the block.", 3, "calculate", ["2.B", "2.A"],
             f"$v_{{max}}=A\\sqrt{{k/m}}\\approx {vmax:.2f}\\text{{ m/s}}$ and $a_{{max}}=kA/m\\approx {amax:.2f}\\text{{ m/s}}^2$.",
             [R("C1", "numeric", f"Calculates the maximum speed of about {vmax:.2f} with units of meters per second", [f"{vmax:.2f}", "m/s"], requires="B3", nums=True, units=True, err=["leaves out the square root"]),
              R("C2", "expression", "Uses Newton's second law at the turning point: $a_{max}=kA/m$", ["k A / m"], err=["uses $a_{max}=A\\sqrt{k/m}$"]),
              R("C3", "numeric", f"Calculates the maximum acceleration of about {amax:.2f} with units of meters per second squared", [f"{amax:.2f}", "m/s^2"], requires="C2", nums=True, units=True)]),
        part("D", f"The block is replaced by one with ${n}$ times the mass, released from the same position. Predict by what factor the period changes, and justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The period increases by a factor of $\\sqrt{{{n}}}={math.sqrt(n):g}$ ($T\\approx{T3:.2f}\\text{{ s}}$), because $T=2\\pi\\sqrt{{m/k}}$.",
             [R("D1", "numeric", f"States that the period increases by a factor of ${math.sqrt(n):g}$", [f"{math.sqrt(n):g}", "increases"], nums=True, err=["states the period is unchanged", f"states a factor of {n}"]),
              R("D2", "justification", "Justifies with $T=2\\pi\\sqrt{m/k}$ (the period is proportional to the square root of the mass)", ["T proportional to sqrt(m)"], requires="D1", err=["argues only that heavier blocks move more slowly"])]),
    ]
    return _pack("pcf_tbr_shm_blocks", "tbr", "7.3", ["7.2", "7.4", "3.4"], "2.D", "Block-spring oscillator: graph, derivation and prediction", stim, parts, 12, 27, [f"k={k}", f"m={m}", f"A={A}", f"T={T:.4f}", f"vmax={vmax:.4f}", f"amax={amax:.4f}", f"n={n}"],
                 [_ev("A", "period", T, 0.01, "s"), _ev("C", "max speed", vmax, 0.01 * vmax + 0.005, "m/s"), _ev("C", "max acceleration", amax, 0.012 * amax + 0.02, "m/s^2"), _ev("D", "new period", T3, 0.02, "s")],
                 ("Sketching the position-time graph of a mass-spring oscillator, deriving the maximum speed from energy, calculating extremes, and predicting the effect of a larger mass", ["Represent the motion as a position-time graph", "Derive the maximum speed and acceleration", "Predict the effect of a change of mass on the period"],
                  [("the surface is frictionless and the spring is ideal so energy is conserved", "the stimulus states a frictionless surface and an ideal spring")], {"type": "text", "must_include": ["spring constant", "mass", "amplitude"]},
                  "an RK4 simulation of the equation of motion recomputes the period and the maximum speed; the maximum acceleration follows from Hooke's law"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


def _shm_rk4(k, m, A):
    st = np.array([A, 0.0]); t = 0.0; dt = 1e-4
    while st[0] > 0:
        prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
    fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr), abs(prv[1] + (st[1] - prv[1]) * fr)


# ======================= TBR (12): 위치에 따라 변하는 힘, 운동 에너지 그래프 =======================
def pcf_tbr_work_energy_graph(rng):
    for _ in forever():
        c = pick(rng, [1.0, 2.0, 3.0]); X = pick(rng, [2.0, 3.0, 4.0]); m = pick(rng, [1.0, 2.0, 4.0]); Kx = lambda s: c * (X * s * s / 2 - s ** 3 / 3)  # noqa: E731
        W = Kx(X); v = math.sqrt(2 * W / m)
        agree(W, simpson(lambda s: c * s * (X - s), 0, X), 1e-6, "W"); Fmax = c * X * X / 4; xm = X / 2
        if W > 2:
            break
    k2 = 2
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ starts from rest at $x=0$ on a frictionless horizontal surface. A net force along the $x$-axis of magnitude $F(x)=c\\,x\\,(X-x)$ acts on the block for $0\\le x\\le X$, where $c={c:g}\\text{{ N/m}}^2$ and $X={X:g}\\text{{ m}}$ (with $F$ in newtons and $x$ in meters). Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", f"On the axes provided, sketch the force $F$ as a function of position $x$ from $x=0$ to $x={X:g}\\text{{ m}}$. Label the position where the force is greatest and the value of that force.", 4, "graph", ["1.C", "1.B"],
             f"A downward-opening parabola that is zero at $x=0$ and at $x={X:g}\\text{{ m}}$ with its maximum ${Fmax:.2f}\\text{{ N}}$ at $x={xm:g}\\text{{ m}}$.",
             [R("A1", "graph", "Axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", f"The curve is zero at $x=0$ and at $x={X:g}\\text{{ m}}$", ["zeros"], nums=True, err=["curve does not return to zero"]),
              R("A3", "graph", "The curve is a smooth parabola that opens downward", ["downward parabola"], err=["draws a straight line"]),
              R("A4", "graph", f"The maximum is labeled at $x={xm:g}\\text{{ m}}$ with a force of about ${Fmax:.2f}\\text{{ N}}$", [f"{xm:g}", f"{Fmax:.2f}"], nums=True)]),
        part("B", "Derive an expression for the kinetic energy $K(x)$ of the block as a function of position for $0\\le x\\le X$.", 3, "derive", ["2.A"],
             f"$K(x)=\\int_0^x F\\,dx'={c:g}\\left(\\dfrac{{Xx^2}}{{2}}-\\dfrac{{x^3}}{{3}}\\right)$.",
             [R("B1", "expression", "Applies the work-energy theorem: $K(x)=\\int_0^xF(x')\\,dx'$", ["K = integral of F dx"], err=["multiplies the force by the position"]),
              R("B2", "expression", "Integrates $c x'(X-x')$ term by term", ["integrates both terms"], requires="B1", err=["differentiates instead of integrating"]),
              R("B3", "expression", "Obtains $K(x)=c\\left(Xx^2/2-x^3/3\\right)$", ["c (X x^2/2 - x^3/3)"], requires="B2", err=["omits the factor of one half or one third"])]),
        part("C", f"Calculate the speed of the block at $x={X:g}\\text{{ m}}$.", 3, "calculate", ["2.B"],
             f"$K(X)=cX^3/6={W:.3f}\\text{{ J}}$ and $v=\\sqrt{{2K/m}}\\approx {v:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", f"Evaluates the kinetic energy at $x={X:g}\\text{{ m}}$ (about {W:.2f} J)", [f"{W:.2f}", "J"], requires="B3", nums=True, units=True, err=["evaluates the force instead of the energy"]),
              R("C2", "expression", "Relates the kinetic energy to the speed: $K=\\tfrac12mv^2$", ["K = 1/2 m v^2"], err=["omits the one half"]),
              R("C3", "numeric", f"Obtains a speed of about {v:.2f} with units of meters per second", [f"{v:.2f}", "m/s"], requires="C2", nums=True, units=True)]),
        part("D", f"The mass of the block is doubled. Does the speed at $x={X:g}\\text{{ m}}$ increase, decrease or stay the same, and by what factor? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The speed decreases by a factor of $\\sqrt{{2}}\\approx1.41$ because the kinetic energy at $x=X$ equals the same work $W$ and $v=\\sqrt{{2W/m}}$.",
             [R("D1", "numeric", "States that the speed decreases by a factor of about 1.41 ($\\sqrt2$)", ["1.41", "decreases"], nums=True, err=["states a factor of 2", "states the speed is unchanged"]),
              R("D2", "justification", "Justifies that the work done by the force is the same, so $K$ is unchanged and $v\\propto1/\\sqrt{m}$", ["same work", "v proportional to 1/sqrt m"], requires="D1", err=["argues only that a heavier block moves slower"])]),
    ]
    return _pack("pcf_tbr_work_energy_graph", "tbr", "3.2", ["3.1", "1.2"], "1.C", "Work by a force that varies with position", stim, parts, 12, 27, [f"c={c}", f"X={X}", f"m={m}", f"W={W:.4f}", f"v={v:.4f}"],
                 [_ev("A", "peak force", Fmax, 0.02 * Fmax + 0.02, "N"), _ev("C", "kinetic energy at X", W, 0.012 * W + 0.02, "J"), _ev("C", "speed", v, 0.012 * v + 0.03, "m/s")],
                 ("Representing a position-dependent force graphically, deriving the kinetic energy by integration, and predicting the effect of doubling the mass", ["Sketch the force-position graph", "Integrate the force for the kinetic energy as a function of position", "Predict how the final speed depends on the mass"],
                  [("the surface is frictionless and the force is the net force along the line of motion", "the stimulus states a frictionless surface and the net force")], {"type": "text", "must_include": ["the force function", "the mass"]},
                  "sympy integrates the force symbolically; a Simpson integration recomputes the work; the speed follows from the energy"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 경사면을 구르는 원통의 회전 관성 계수 =======================
def pcf_lab_rolling_incline(rng):
    angs = [10, 15, 20, 25, 30]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); cc = pick(rng, [0.5, 0.4, 1.0]); d = 1.2
        sins = [math.sin(math.radians(a)) for a in angs]
        accs = [round(CG * s / (1 + cc) * (1 + r2.uniform(-0.015, 0.015)), 3) for s in sins]
        slope, icpt = np.polyfit(sins, accs, 1); Xn = np.array([[s, 1.0] for s in sins]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(accs)); agree(slope, beta[0], 1e-9, "slope")
        c_est = CG / slope - 1
        if abs(c_est - cc) / cc < 0.12:
            break
    times = [round(math.sqrt(2 * d / a), 3) for a in accs]
    stim = {"kind": "table", "description": f"A student rolls a uniform object without slipping from rest down a ramp of length d = {d:g} m and measures the acceleration a of its center of mass (from timing) at several ramp angles θ. The rotational inertia of the object is I = c M R², where M is the mass, R is the radius and c is an unknown constant.", "data": {"x_label": "Angle of the ramp θ (degrees)", "y_label": "Acceleration of the center of mass a (m/s^2)", "rows": [[a, x] for a, x in zip(angs, accs)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the acceleration as a function of the ramp angle. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the acceleration.", 3, "design", ["3.A", "2.B"],
             "Set each angle from the ramp height and length with a meterstick, time the descent over the marked distance $d$ with a stopwatch or photogate and compute $a=2d/t^2$; change only the angle with the same object and ramp; reduce the uncertainty by repeating each run and averaging the times.",
             [R("A1", "design", "Identifies how the angle is set and measured and how the acceleration is found (timing the descent over a known distance)", ["a way to measure the angle and a way to find the acceleration"], err=["omits how the acceleration is found"]),
              R("A2", "design", "Changes only the angle while using the same object and the same ramp (both conditions are needed)", ["change only the angle with the same object and ramp"]),
              R("A3", "design", "Reduces the uncertainty in the acceleration by repeating the runs and averaging the times, or by using a longer ramp, or by using a photogate (any one earns the point)", ["repeat and average or longer ramp or photogate (any one earns the point)"])]),
        part("B", "For rolling without slipping, the acceleration is $a=\\dfrac{g\\sin\\theta}{1+c}$. Identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $c$.", 1, "explain", ["2.B", "3.A"],
             "Plot $a$ on the vertical axis against $\\sin\\theta$ on the horizontal axis; the slope is $g/(1+c)$.",
             [R("B1", "expression", "Identifies $a$ (vertical) versus $\\sin\\theta$ (horizontal)", ["a versus sin theta"], err=["plots a versus theta"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(\\sin\\theta,a)$: {', '.join(f'({s:.3f}, {a_:.3f})' for s, a_ in zip(sins, accs))} with a best-fit line of slope about ${slope:.2f}\\text{{ m/s}}^2$.",
             [R("C1", "graph", "Axes are labeled with quantities and units (sin theta has no units) and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(\\sin\\theta, a)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the rotational inertia coefficient $c$ of the object. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $g/(1+c)\\approx {slope:.2f}\\text{{ m/s}}^2$, so $c=g/\\text{{slope}}-1\\approx {c_est:.2f}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} m/s^2; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to $c$: slope $=g/(1+c)$ so $c=g/\\text{slope}-1$", ["c = g / slope - 1"], err=["uses $c=\\text{slope}/g$"]),
              R("D3", "numeric", f"Obtains $c$ of about {c_est:.2f} (accept any value consistent with the student's own slope from D1)", [f"{c_est:.2f}"], alt=["a value of c consistent with the student's own slope from D1"], nums=True)]),
    ]
    return _pack("pcf_lab_rolling_incline", "lab", "6.5", ["5.4", "3.4"], "3.A", "Experiment: rotational inertia coefficient of a rolling object", stim, parts, 10, 27, [f"cc={cc}", f"slope={slope:.5f}", f"c_est={c_est:.4f}", f"accs={accs}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "m/s^2"), _ev("D", "rotational inertia coefficient", c_est, 0.12 * max(c_est, 0.3), "")],
                 ("Designing an experiment and analyzing linearized data to extract the rotational inertia coefficient from the acceleration of a rolling object", ["Describe the measurements and how uncertainty in the acceleration is reduced", "Linearize $a=g\\sin\\theta/(1+c)$ and plot the data", "Use the slope to determine $c$"],
                  [("the generated accelerations follow $a=g\\sin\\theta/(1+c)$ with a small random error so the fitted coefficient is within twelve percent of the generating value", "the code rejects a seed whose fitted coefficient differs from the generating value by more than twelve percent")], {"type": "table", "must_include": ["angle", "acceleration"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the coefficient is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= LAB (10): 낙하 물체의 종단 속력과 질량 =======================
def pcf_lab_terminal_speed(rng):
    ms = [0.02, 0.04, 0.06, 0.08, 0.10]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); b = pick(rng, [0.05, 0.08, 0.10, 0.20])
        vts = [round(m * CG / b * (1 + r2.uniform(-0.02, 0.02)), 3) for m in ms]
        slope, icpt = np.polyfit(ms, vts, 1); Xn = np.array([[m, 1.0] for m in ms]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(vts)); agree(slope, beta[0], 1e-9, "slope")
        b_est = CG / slope
        if abs(b_est - b) / b < 0.05:
            break
    stim = {"kind": "table", "description": "A student drops small objects of different mass $m$ and the same shape through a tall column of viscous liquid and measures the constant (terminal) speed $v_t$ that each reaches. The liquid exerts a drag force of magnitude $bv$, where $b$ is an unknown constant.", "data": {"x_label": "Mass of the object m (kg)", "y_label": "Terminal speed v_t (m/s)", "rows": [[m, v_] for m, v_ in zip(ms, vts)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the terminal speed as a function of mass. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured terminal speed.", 3, "design", ["3.A", "2.B"],
             "Measure each mass with a balance; time the fall of each object between two marks that are far below the surface (after the speed is constant) with a stopwatch or video and divide the distance by the time; use objects of the same shape and the same liquid; reduce the uncertainty by using a longer timed distance or by repeating each drop and averaging.",
             [R("A1", "design", "Identifies how the mass is measured and how the terminal speed is found (distance between marks divided by the time after the speed is constant)", ["a way to measure the mass and a way to find the terminal speed"], err=["times the fall from the surface including the speeding-up stage"]),
              R("A2", "design", "Changes only the mass while keeping the shape, the liquid and the temperature the same (both the shape and the liquid must be controlled)", ["change only the mass and keep the shape and liquid"]),
              R("A3", "design", "Reduces the uncertainty by repeating each drop and averaging, or by using a longer timed distance (either earns the point)", ["repeat and average or longer timed distance (either earns the point)"])]),
        part("B", "Using Newton's second law at terminal speed, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $b$.", 1, "explain", ["2.B", "3.A"],
             "At terminal speed $mg=bv_t$, so $v_t=(g/b)m$: plot $v_t$ on the vertical axis against $m$ on the horizontal axis; the slope is $g/b$.",
             [R("B1", "expression", "Identifies $v_t$ (vertical) versus $m$ (horizontal), or equivalently $mg$ versus $v_t$ with slope $b$ (either linear plot earns the point)", ["v_t versus m or mg versus v_t (either earns the point)"], alt=["mg versus v_t, with slope b"], err=["plots v_t versus m squared"])]),
        part("C", "On a blank grid whose scale you choose, plot the data and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(m,v_t)$: {', '.join(f'({m:g}, {v_:.3f})' for m, v_ in zip(ms, vts))} with a best-fit line of slope about ${slope:.1f}\\text{{ m/(s·kg)}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(m, v_t)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the drag coefficient $b$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $g/b\\approx {slope:.1f}\\text{{ m/(s·kg)}}$, so $b=g/\\text{{slope}}\\approx {b_est:.3f}\\text{{ kg/s}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.1f}; accept any value within 5 percent)", [f"{slope:.1f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to the drag coefficient: slope $=g/b$ so $b=g/\\text{slope}$", ["b = g / slope"], err=["uses $b=\\text{slope}/g$"]),
              R("D3", "numeric", f"Obtains $b$ of about {b_est:.3f} with units of kilograms per second (accept any value consistent with the student's own slope from D1)", [f"{b_est:.3f}", "kg/s"], alt=["a value of b consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pcf_lab_terminal_speed", "lab", "2.9", ["2.5", "1.2"], "3.A", "Experiment: drag coefficient from terminal speeds", stim, parts, 10, 27, [f"b={b}", f"slope={slope:.5f}", f"b_est={b_est:.5f}", f"vts={vts}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "m/(s·kg)"), _ev("D", "drag coefficient", b_est, 0.05 * b_est + 0.002, "kg/s")],
                 ("Designing an experiment and analyzing terminal-speed data to extract the drag coefficient of a viscous liquid", ["Describe the measurements and how the terminal speed is identified", "Linearize $v_t=(g/b)m$ and plot the data", "Use the slope to determine the drag coefficient"],
                  [("the generated terminal speeds follow $v_t=mg/b$ with a small random error so the fitted coefficient is within five percent of the generating value", "the code rejects a seed whose fitted coefficient differs from the generating value by more than five percent")], {"type": "table", "must_include": ["mass", "terminal speed"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted coefficient is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 구르는 물체와 미끄러지는 물체의 경주 =======================
def pcf_qqt_rolling_race(rng):
    for _ in forever():
        h = pick(rng, [0.5, 1.0, 1.5, 2.0]); cc = pick(rng, [0.4, 0.5, 2 / 3]); vs = math.sqrt(2 * CG * h); vr = math.sqrt(2 * CG * h / (1 + cc)); ratio = vr / vs
        agree(0.5 * vr * vr * (1 + cc), CG * h, 1e-9, "E")
        break
    nm = {0.4: "solid sphere", 0.5: "solid cylinder"}.get(cc, "thin spherical shell")
    stim = {"kind": "text", "description": f"A block slides without friction, and a {nm} of the same mass rolls without slipping, from rest down the same ramp. Both start at the same height $h={h:g}\\text{{ m}}$ above the bottom. The rotational inertia of the {nm} about its center is $I=c\\,MR^2$ with $c={cc:.3g}$.", "data": {}}
    parts = [
        part("A", f"A student claims that the {nm} reaches the bottom with a smaller speed than the block. Do you agree or disagree with the claim? Justify your answer using conservation of energy.", 3, "explain", ["3.B", "3.C"],
             "Agree. Both objects lose the same gravitational potential energy. The block converts it all into translational kinetic energy, while the rolling object also has rotational kinetic energy, so less is left for translation.",
             [R("A1", "claim", f"Agrees that the {nm} has a smaller speed", ["agree", "smaller speed"], err=["disagrees because the rolling object has more total energy"]),
              R("A2", "justification", "Justifies by stating that both objects lose the same potential energy $mgh$", ["same potential energy lost"], err=["says the rolling object loses more energy"]),
              R("A3", "justification", "Explains that part of the energy of the rolling object goes into rotational kinetic energy, leaving less translational kinetic energy", ["rotational kinetic energy takes some of the energy"], requires="A1", err=["says friction removes the energy"])]),
        part("B", "Derive an expression for the speed of the center of mass of the rolling object at the bottom in terms of $g$, $h$ and $c$, and calculate the ratio of its speed to the speed of the block.", 3, "derive", ["2.A", "2.B"],
             f"$mgh=\\tfrac12mv^2+\\tfrac12(cmR^2)(v/R)^2$ so $v=\\sqrt{{2gh/(1+c)}}$ and $v_r/v_s=1/\\sqrt{{1+c}}\\approx{ratio:.3f}$.",
             [R("B1", "expression", "Writes the energy balance with both translational and rotational terms and $\\omega=v/R$", ["m g h = 1/2 m v^2 + 1/2 I omega^2"], err=["omits the rotational term"]),
              R("B2", "expression", "Obtains $v=\\sqrt{2gh/(1+c)}$", ["sqrt(2 g h / (1 + c))"], requires="B1", err=["obtains $\\sqrt{2gh(1+c)}$"]),
              R("B3", "numeric", f"Calculates the speed ratio $1/\\sqrt{{1+c}}$ of about {ratio:.3f}", [f"{ratio:.3f}"], requires="B2", nums=True, err=["gives the ratio of the kinetic energies instead"])]),
        part("C", "The rolling object is replaced by a thin hoop of the same mass and radius ($c=1$) released from the same height. Predict whether the speed at the bottom is greater than, less than, or equal to that of the original rolling object, and justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The speed is less, because $v=\\sqrt{{2gh/(1+c)}}$ decreases as $c$ increases and the hoop has the largest possible $c=1$ ($v=\\sqrt{{gh}}$).",
             [R("C1", "claim", "States that the hoop reaches the bottom with a smaller speed", ["less", "smaller"], err=["states that the speeds are equal because the mass and the height are the same"]),
              R("C2", "justification", "Justifies with $v=\\sqrt{2gh/(1+c)}$ or by saying that a larger fraction of the energy is rotational for the hoop", ["v decreases as c increases"], requires="C1", err=["argues only that the hoop is heavier"])]),
    ]
    return _pack("pcf_qqt_rolling_race", "qqt", "6.5", ["6.1", "3.4"], "3.B", "Rolling versus sliding down a ramp", stim, parts, 8, 16, [f"h={h}", f"c={cc}", f"vs={vs:.4f}", f"vr={vr:.4f}", f"ratio={ratio:.4f}"],
                 [_ev("B", "speed ratio", ratio, 0.01, "")],
                 ("Using energy conservation with rotational kinetic energy to justify a claim about the speed of a rolling object and to predict the effect of a different shape", ["Compare the energy bookkeeping of the sliding and rolling objects", "Derive the speed for a general coefficient c", "Predict how the speed depends on c"],
                  [("the block is frictionless and the object rolls without slipping so mechanical energy is conserved", "the stimulus states frictionless sliding and rolling without slipping")], {"type": "text", "must_include": ["the height", "the coefficient c"]},
                  "the energy balance is recomputed numerically for the stated coefficient and for c = 1"),
                 ["law_selection", "justification", "symbolic_reasoning"])


# ======================= QQT (8): 막대에 박히는 총알의 각운동량 =======================
def pcf_qqt_bullet_rod(rng):
    for _ in forever():
        M = pick(rng, [1.0, 2.0, 3.0]); L = pick(rng, [0.8, 1.0, 1.5]); m = pick(rng, [0.02, 0.05, 0.10]); v = pick(rng, [100.0, 200.0, 300.0])
        I = M * L * L / 3 + m * L * L; w = m * v * L / I; Ki = 0.5 * m * v * v; Kf = 0.5 * I * w * w; frac = Kf / Ki
        sol = np.linalg.solve(np.array([[I]]), np.array([m * v * L])); agree(w, sol[0], 1e-9, "w"); agree(frac, m * L * L / I, 1e-9, "frac")
        break
    stim = {"kind": "text", "description": f"A uniform rod of mass $M={M:g}\\text{{ kg}}$ and length $L={L:g}\\text{{ m}}$ hangs from a frictionless pivot at its upper end. A bullet of mass $m={m * 1000:g}\\text{{ g}}$ moving horizontally at $v={v:g}\\text{{ m/s}}$ strikes the lower end of the rod and embeds in it. The rotational inertia of the rod about the pivot is $\\tfrac13ML^2$.", "data": {}}
    parts = [
        part("A", "A student claims that the total mechanical energy of the bullet and rod is conserved in the collision. Do you agree or disagree with the claim? Justify your answer by identifying a quantity that is conserved about the pivot.", 3, "explain", ["3.B", "3.C"],
             "Disagree. The collision is perfectly inelastic, so mechanical energy is not conserved, but the angular momentum about the pivot is conserved because the force at the pivot has no torque about it.",
             [R("A1", "claim", "Disagrees that the mechanical energy is conserved", ["disagree"], err=["agrees that the energy is conserved"]),
              R("A2", "justification", "Justifies by identifying the angular momentum about the pivot as the conserved quantity", ["angular momentum about the pivot is conserved"], err=["says the linear momentum is conserved"]),
              R("A3", "justification", "Explains that the pivot force exerts no torque about the pivot (or that external torques are zero during the collision)", ["pivot force has zero torque about the pivot"], requires="A2", err=["argues only that there are no external forces"])]),
        part("B", "Derive an expression for the angular speed $\\omega$ of the rod and bullet just after the collision in terms of $m$, $v$, $M$ and $L$, and calculate its value.", 3, "derive", ["2.A", "2.B"],
             f"$mvL=(\\tfrac13ML^2+mL^2)\\omega$ so $\\omega=mvL/(\\tfrac13ML^2+mL^2)\\approx{w:.2f}\\text{{ rad/s}}$.",
             [R("B1", "expression", "Writes the initial angular momentum of the bullet about the pivot, $mvL$", ["m v L"], err=["uses $mv$ without the lever arm"]),
              R("B2", "expression", "Writes the final angular momentum $(\\tfrac13ML^2+mL^2)\\omega$ and solves for $\\omega$", ["(1/3 M L^2 + m L^2) omega", "omega = m v L / I"], requires="B1", err=["omits the bullet from the final rotational inertia"]),
              R("B3", "numeric", f"Calculates $\\omega$ of about {w:.2f} with units of radians per second", [f"{w:.2f}", "rad/s"], requires="B2", nums=True, units=True)]),
        part("C", f"Calculate the fraction of the bullet's initial kinetic energy that remains as kinetic energy of the rod and bullet just after the collision.", 2, "calculate", ["2.B", "3.B"],
             f"The fraction is $\\tfrac12I\\omega^2/(\\tfrac12mv^2)=mL^2/I\\approx{frac:.4f}$ (almost all of the energy is dissipated).",
             [R("C1", "expression", "Uses $K=\\tfrac12I\\omega^2$ for the final kinetic energy and $\\tfrac12mv^2$ for the initial", ["1/2 I omega^2", "1/2 m v^2"], err=["uses $K=\\tfrac12m\\omega^2$"]),
              R("C2", "numeric", f"Obtains a fraction of about {frac:.3f} (accept any value within 5 percent)", [f"{frac:.3f}"], requires="C1", nums=True, err=["uses the fraction of the angular momentum"])]),
    ]
    return _pack("pcf_qqt_bullet_rod", "qqt", "6.4", ["6.3", "5.4", "3.4"], "3.B", "Bullet embedding in a pivoted rod", stim, parts, 8, 16, [f"M={M}", f"L={L}", f"m={m}", f"v={v}", f"w={w:.4f}", f"frac={frac:.5f}"],
                 [_ev("B", "angular speed", w, 0.012 * w + 0.03, "rad/s"), _ev("C", "kinetic energy fraction", frac, 0.05 * frac + 0.001, "")],
                 ("Using conservation of angular momentum about a pivot in a perfectly inelastic collision and comparing the kinetic energy before and after", ["Decide which quantities are conserved in the collision", "Derive the angular speed from angular momentum conservation", "Compute the kinetic energy fraction"],
                  [("the pivot is frictionless and the bullet embeds so angular momentum about the pivot is conserved", "the stimulus states a frictionless pivot and an embedded bullet")], {"type": "text", "must_include": ["the masses", "the rod length", "the bullet speed"]},
                  "numpy linalg.solve of the angular momentum balance recomputes omega; the kinetic energies are compared numerically"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_FRQ = ["pcf_mr_variable_force_block", "pcf_tbr_shm_blocks", "pcf_lab_rolling_incline", "pcf_qqt_rolling_race", "pcf_mr_drag_fall", "pcf_tbr_work_energy_graph", "pcf_lab_terminal_speed", "pcf_qqt_bullet_rod"]
