"""AP Physics 1 P0 — FRQ 원형 4유형(MR 10점 / TBR 12점 / LAB 10점 / QQT 8점, 합 40). 공식 FRQ 는 종이 손글씨이므로 이 원형은 문제·키·채점 행·자기 채점 참고 답안을 만든다.
행 종류(kind): expression(기호 식) · numeric(값·단위) · diagram(표현 체크리스트) · graph(축·점·추세선) · claim · justification · design. 정답·수치는 코드(sympy/numpy)가 계산한다.
모범 답안은 'ALTON reference answer for self-review — not official AP scoring' 이다(공식 채점 문구·허용 목록·Example Response 복제 없음)."""
from phys_common import *
from calc_ab_frq import row, part
from bp import frq_blueprint

REF_NOTE = "ALTON reference answer for self-review — not official AP scoring"


def R(rid, kind, crit, req, alt=None, err=None, requires=None, nums=False, units=False):
    r = row(rid, 1, crit, req, None, alt, err, requires, False, nums, None, units)
    r["kind"] = kind
    return r


def _pack(arch, template, topic, extra, skill, title, stim, parts, total, minutes, facts, expected, bpr_args, judgment):
    assert sum(p["points"] for p in parts) == total and all(r["points"] == 1 for p in parts for r in p["rubric_rows"]), (arch, total)
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "allowed", "title": title, "stimulus": stim,
          "parts": parts, "total_points": total, "est_minutes": minutes, "facts": facts, "expected_values": expected, "reference_note": REF_NOTE}
    concept, thinking, conds, material, path_ = bpr_args
    pk["blueprint"] = frq_blueprint(arch, SUB, pk, concept, thinking, conds, material, path_, extra={"judgment_demand": judgment})
    return pk


def _ev(part_, q, v, tol, unit=""):
    return {"part": part_, "quantity": q, "value": float(v), "unit": unit, "tolerance": tol}


# ======================= MR (10): 탁상 블록 + 매달린 질량 =======================
def phf_mr_table_block(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [2.0, 3.0, 4.0]); mu = pick(rng, [0.15, 0.2, 0.25, 0.3])
        a_, T_ = sp.symbols("a T", positive=True)
        M1, M2, MU, GG = [sp.Rational(str(v)) for v in (m1, m2, mu, G)]
        sol = sp.solve([sp.Eq(T_ - MU * M1 * GG, M1 * a_), sp.Eq(M2 * GG - T_, M2 * a_)], [T_, a_])
        a = float(sol[a_]); T = float(sol[T_])
        A = np.array([[1, -m1], [1, m2]]); Bv = np.array([mu * m1 * G, m2 * G]); Tn, an = np.linalg.solve(A, Bv)
        agree(a, an, 1e-9, "a"); agree(T, Tn, 1e-9, "T")
        # 변화 예측: μ 를 두 배로 하면 장력은 감소(마찰이 클수록 가속이 줄어 매달린 질량 쪽 장력이 커진다 → 증가). 기호 미분 부호로 판정
        mus = sp.symbols("mus", positive=True)
        Tsym = M1 * M2 * GG * (1 + mus) / (M1 + M2)
        up = bool(sp.diff(Tsym, mus) > 0)
        agree(T, float(Tsym.subs(mus, MU)), 1e-9, "Tsym")
        if a > 0.5:
            break
    forces = ["weight $F_g$ (down)", "normal force $N$ (up)", "tension $T$ (toward the pulley)", "kinetic friction $f$ (away from the pulley)"]
    stim = {"kind": "text", "description": f"A block of mass $m_1={m1:g}\\text{{ kg}}$ rests on a horizontal table. A light string attached to the block passes over a light, frictionless pulley at the edge of the table and supports a hanging block of mass $m_2={m2:g}\\text{{ kg}}$. The coefficient of kinetic friction between the block and the table is $\\mu={mu:g}$. The system is released from rest and the blocks accelerate.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents the block of mass $m_1$, draw and label the forces (not components) that act on it while it slides. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A", "1.C"],
             "Four arrows from the dot: weight down, normal up (equal length to the weight), tension toward the pulley (longer than friction), and kinetic friction opposite to the motion.",
             [R("A1", "diagram", "Draws and labels the four forces: weight, normal force, tension, and kinetic friction (no extra force such as a force of motion)", ["weight", "normal force", "tension", "friction"], err=["adds a forward force of motion"]),
              R("A2", "diagram", "Arrow directions are correct: weight down, normal up, tension toward the pulley, friction opposite to the motion", ["directions"], err=["friction drawn in the direction of motion"]),
              R("A3", "diagram", "Relative lengths are consistent with the motion: the vertical arrows are equal and the tension arrow is longer than the friction arrow", ["equal vertical arrows", "tension longer than friction"], err=["unequal vertical arrows"])]),
        part("B", "Derive an expression for the magnitude of the acceleration of the blocks in terms of $m_1$, $m_2$, $\\mu$, and fundamental constants.", 3, "derive", ["2.A"],
             "$m_2g-T=m_2a$ and $T-\\mu m_1g=m_1a$, so $a=\\dfrac{(m_2-\\mu m_1)g}{m_1+m_2}$.",
             [R("B1", "expression", "Applies Newton's second law to the hanging block: $m_2g-T=m_2a$", ["m2 g - T = m2 a"], err=["uses T = m2 g"]),
              R("B2", "expression", "Applies Newton's second law to the table block with friction $\\mu m_1 g$: $T-\\mu m_1g=m_1a$", ["T - mu m1 g = m1 a"], err=["omits friction", "uses mu m2 g"]),
              R("B3", "expression", "Combines the equations to the correct expression $a=(m_2-\\mu m_1)g/(m_1+m_2)$", ["(m2 - mu m1) g/(m1+m2)"], requires="B2", err=["algebra error in eliminating T"])]),
        part("C", f"Calculate the numerical value of the acceleration for $m_1={m1:g}\\text{{ kg}}$, $m_2={m2:g}\\text{{ kg}}$, $\\mu={mu:g}$.", 2, "calculate", ["2.B"],
             f"$a\\approx {a:.2f}\\text{{ m/s}}^2$.",
             [R("C1", "numeric", f"Calculates the acceleration (about {a:.2f})", [f"{a:.2f}"], requires="B3", nums=True, err=["uses a wrong mass"]),
              R("C2", "numeric", "Reports the value with correct units of meters per second squared", ["m/s^2"], units=True, requires="C1")]),
        part("D", "The tabletop is replaced by a surface with a larger coefficient of kinetic friction. Does the tension in the string increase, decrease, or stay the same? Justify your answer.", 2, "explain", ["3.B", "3.C"],
             "The tension increases. A larger friction force reduces the acceleration, so the hanging block needs a smaller net downward force and the string must support more of its weight: $T=m_2(g-a)$ with a smaller $a$.",
             [R("D1", "claim", "States that the tension increases", ["increases"], err=["states the tension decreases because friction opposes motion"]),
              R("D2", "justification", "Justifies with Newton's second law for the hanging block: a smaller acceleration means a larger tension $T=m_2(g-a)$", ["smaller acceleration", "T = m2 (g - a)"], requires="D1", err=["argues only that friction is larger"])]),
    ]
    assert up
    return _pack("phf_mr_table_block", "mr", "2.5", ["2.2", "2.7"], "2.B", "Block on a table connected to a hanging block", stim, parts, 10, 22, [f"m1={m1}", f"m2={m2}", f"mu={mu}", f"a={a:.4f}", f"T={T:.3f}"],
                 [_ev("C", "acceleration", a, max(0.06, 0.012 * a), "m/s^2")],  # 2026-10-13: 장력은 어느 파트도 묻지 않으므로 기대값에서 제외(풀이기가 파트 B 식 답에서 14.7 을 찾다 수치 불일치로 반려됨)
                 ("Newton's second law for two connected objects with friction, a free-body diagram, and a justified prediction", ["Draw the free-body diagram of the table block", "Write Newton's second law for each block and combine", "Predict the effect of a change in friction using the derived relationships"],
                  [("the pulley and string are ideal and the blocks move together with one acceleration", "the stimulus states a light string and a light frictionless pulley")], {"type": "text", "must_include": ["masses", "friction coefficient"]},
                  "sympy solves the two Newton equations; numpy linalg.solve on the same system recomputes the acceleration and tension; the sign of the derivative of the tension with respect to the friction coefficient decides the prediction"),
                 ["representation_reading", "law_selection", "justification"])


# ======================= TBR (12): 블록-용수철 단진동 =======================
def phf_tbr_spring_shm(rng):
    for _ in forever():
        k = pick(rng, [40.0, 50.0, 80.0, 100.0]); m = pick(rng, [0.4, 0.5, 1.0, 2.0]); A = pick(rng, [0.10, 0.15, 0.20])
        P = 2 * math.pi * math.sqrt(m / k); vmax = A * math.sqrt(k / m)
        # 독립: RK4 로 최대 속력과 주기 확인
        s = np.array([A, 0.0]); t = 0.0; dt = 1e-3; vm = 0.0; cross = []
        while len(cross) < 2:
            prev = s.copy(); s = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), s, t, t + dt, 1); t += dt; vm = max(vm, abs(s[1]))
            if prev[0] * s[0] < 0:
                cross.append(t)
        agree(P, 2 * (cross[1] - cross[0]), 5e-3, "P"); agree(vmax, vm, 5e-3, "vmax")
        break
    n = pick(rng, [4, 9]); P2 = P * math.sqrt(n); v2 = vmax / math.sqrt(n)
    E = 0.5 * k * A * A
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ is attached to a horizontal spring of spring constant $k={k:g}\\text{{ N/m}}$ on a frictionless surface. The block is pulled to a position $x=+A$ with $A={A:g}\\text{{ m}}$ and released from rest at $t=0$. Blank energy bar chart templates (one per state, with a common scale) and blank axes for the graph are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "In the energy bar charts below, for each of three states (block at $x=+A$, block at $x=0$, block at $x=-A/2$), draw bars for kinetic energy $K$ and spring potential energy $U_s$ with a consistent scale. Show the total energy as the same height in each state.", 3, "diagram", ["1.A", "1.C"],
             f"At $+A$: $U_s=E$, $K=0$. At $0$: $K=E$, $U_s=0$. At $-A/2$: $U_s=E/4$, $K=3E/4$. Total $E=\\tfrac12kA^2={E:.4f}\\text{{ J}}$ in every state.",
             [R("A1", "diagram", "Shows $K=0$ and $U_s$ at its maximum at $x=+A$", ["K = 0", "Us maximum"], err=["shows kinetic energy at the turning point"]),
              R("A2", "diagram", "Shows $U_s=0$ and $K$ at its maximum at $x=0$ with the same total bar height", ["Us = 0", "K = total"], err=["total energy changes between states"]),
              R("A3", "diagram", "Shows $U_s$ equal to one quarter and $K$ three quarters of the total at $x=-A/2$", ["Us = E/4", "K = 3E/4"], err=["splits the energy equally"])]),
        part("B", "Derive an expression for the speed of the block as it passes $x=0$ in terms of $m$, $k$, and $A$.", 2, "derive", ["2.A"], "$\\tfrac12kA^2=\\tfrac12mv^2$ so $v=A\\sqrt{k/m}$.",
             [R("B1", "expression", "Sets the initial spring energy equal to the kinetic energy at the equilibrium position: $\\tfrac12kA^2=\\tfrac12mv^2$", ["1/2 k A^2 = 1/2 m v^2"], err=["uses kA = mv"]),
              R("B2", "expression", "Solves for $v=A\\sqrt{k/m}$", ["A sqrt(k/m)"], requires="B1", err=["omits the square root"])]),
        part("C", f"On the axes provided, sketch the position $x$ as a function of time $t$ for two full oscillations. Label the amplitude and the period (use the values for $k={k:g}\\text{{ N/m}}$, $m={m:g}\\text{{ kg}}$, $A={A:g}\\text{{ m}}$).", 4, "graph", ["1.A", "1.C"],
             f"A cosine curve starting at $+A={A:g}\\text{{ m}}$ with period $P=2\\pi\\sqrt{{m/k}}\\approx {P:.2f}\\text{{ s}}$, repeated twice.",
             [R("C1", "graph", "The curve is sinusoidal and starts at its maximum $x=+A$ at $t=0$ (cosine shape)", ["cosine", "starts at +A"], err=["starts at zero like a sine"]),
              R("C2", "graph", f"The amplitude is labeled or scaled as ${A:g}\\text{{ m}}$ (symmetric about $x=0$)", [f"{A:g}"], nums=True),
              R("C3", "graph", f"The period is marked as about ${P:.2f}\\text{{ s}}$ and two full cycles are shown", [f"{P:.2f}"], nums=True, err=["marks half the period"]),
              R("C4", "graph", "Both axes are labeled with quantities and units", ["axis labels", "units"])]),
        part("D", f"The block is replaced by one with {n} times the mass and released from the same position $x=+A$. Predict how the period and the maximum speed change, and justify your prediction.", 3, "explain", ["2.D", "3.B", "3.C"],
             f"The period increases by a factor of $\\sqrt{{{n}}}={math.sqrt(n):g}$ and the maximum speed decreases by the same factor, because $P=2\\pi\\sqrt{{m/k}}$ and $v_{{max}}=A\\sqrt{{k/m}}$ with the same energy $\\tfrac12kA^2$ shared with a larger mass.",
             [R("D1", "claim", f"States that the period increases by a factor of ${math.sqrt(n):g}$", [f"{math.sqrt(n):g}", "increases"], nums=True, err=["states the period is unchanged"]),
              R("D2", "claim", f"States that the maximum speed decreases by a factor of ${math.sqrt(n):g}$", [f"{math.sqrt(n):g}", "decreases"], nums=True, err=["states the maximum speed is unchanged"]),
              R("D3", "justification", "Justifies with the energy or the equations of motion: the same stored energy $\\tfrac12kA^2$ with a larger mass, or $P\\propto\\sqrt{m}$", ["same energy larger mass", "P proportional to sqrt m"], requires="D1", err=["argues only that heavier things are slower"])]),
    ]
    return _pack("phf_tbr_spring_shm", "tbr", "7.3", ["7.2", "7.4", "3.4"], "2.D", "Block-spring oscillator: energy, graph and prediction", stim, parts, 12, 27, [f"k={k}", f"m={m}", f"A={A}", f"P={P:.4f}", f"vmax={vmax:.4f}", f"n={n}"],
                 [_ev("C", "period", P, 0.01, "s"), _ev("B", "max speed", vmax, 0.01, "m/s"), _ev("D", "new period", P2, 0.02, "s"), _ev("D", "new max speed", v2, 0.01, "m/s")],
                 ("Representing a simple harmonic oscillator with energy bars and a position-time graph, deriving the maximum speed and predicting a change", ["Represent the energy of the oscillator in three states", "Derive the speed at equilibrium and sketch the position-time graph", "Predict how the period and speed change for a larger mass with justification"],
                  [("the surface is frictionless and the spring is ideal so energy is conserved", "the stimulus states a frictionless surface")], {"type": "text", "must_include": ["spring constant", "mass", "amplitude"]},
                  "an RK4 simulation of the equation of motion recomputes the period and the maximum speed; the energy bar values are recomputed from the closed forms"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 용수철 상수, T² – m 선형화 =======================
def phf_lab_spring_k(rng):
    for _ in forever():
        k = pick(rng, [20.0, 25.0, 40.0, 50.0]); ms = [0.10, 0.20, 0.30, 0.40, 0.50]
        r2 = random.Random(rng.randrange(10 ** 9))
        Ts = [round(2 * math.pi * math.sqrt(m / k) * (1 + r2.uniform(-0.015, 0.015)), 3) for m in ms]
        T2 = [round(t * t, 4) for t in Ts]
        slope, icpt = np.polyfit(ms, T2, 1)
        k_est = 4 * math.pi ** 2 / slope
        # 독립: 정규방정식으로 기울기
        X = np.array([[m, 1.0] for m in ms]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(T2))
        agree(slope, beta[0], 1e-9, "slope")
        if abs(k_est - k) / k < 0.04:
            break
    stim = {"kind": "table", "description": "A student measures the period $T$ of a block of mass $m$ hanging on a vertical spring of unknown spring constant $k$.", "data": {"x_label": "Mass m (kg)", "y_label": "Period T (s)", "rows": [[m, t] for m, t in zip(ms, Ts)]}}
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the period as a function of mass. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured period.", 3, "design", ["3.A", "2.B"],
             "Measure each hanging mass with a balance (or use slotted masses of known mass) and use a stopwatch to time 10 oscillations for each of several hanging masses added one at a time to the same spring, starting each trial from the same small displacement, then divide by 10; repeat each timing.",
             [R("A1", "design", "Identifies the measured quantities and equipment: a balance or known masses and a timing device (both a way to know the mass and a way to time the motion are needed)", ["a way to know the mass and a way to time the motion"], err=["omits how the period is measured"]),
              R("A2", "design", "Changes only the hanging mass while keeping the spring and the starting amplitude the same (both conditions are needed)", ["change only the mass and keep the same starting amplitude"]),
              R("A3", "design", "Reduces timing uncertainty by timing many oscillations and dividing, or by repeating the trials and averaging (either earns the point)", ["time many oscillations or repeat trials (either earns the point)"])]),
        part("B", "Using the relationship between the period of a mass on a spring, the mass and the spring constant from the reference information, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $k$.", 1, "explain", ["2.B", "3.A"],
             "Plot $T^2$ on the vertical axis against $m$ on the horizontal axis; the slope is $4\\pi^2/k$.",
             [R("B1", "expression", "Identifies $T^2$ (vertical) versus $m$ (horizontal)", ["T squared versus m"], err=["plots T versus m"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(m,T^2)$: {', '.join(f'({m:g}, {t:.3f})' for m, t in zip(ms, T2))} with a best-fit line of slope about ${slope:.2f}\\text{{ s}}^2/\\text{{kg}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(m, T^2)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the spring constant $k$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"Slope $\\approx {slope:.2f}\\text{{ s}}^2/\\text{{kg}}$, so $k=4\\pi^2/\\text{{slope}}\\approx {k_est:.1f}\\text{{ N/m}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} s^2/kg; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to the spring constant: slope $=4\\pi^2/k$", ["slope = 4 pi^2 / k"], err=["uses slope = k"]),
              R("D3", "numeric", f"Calculates $k$ (about {k_est:.0f}; accept any value within 8 percent) with units of newtons per meter", [f"{k_est:.0f}", "N/m"], alt=["a value of k consistent with the student's own slope from D1, $k=4\\pi^2/\\text{slope}$"], nums=True, units=True)]),
    ]
    return _pack("phf_lab_spring_k", "lab", "7.2", ["7.3"], "3.A", "Experiment: spring constant from the period of an oscillator", stim, parts, 10, 27, [f"k={k}", f"slope={slope:.4f}", f"k_est={k_est:.2f}", f"Ts={Ts}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "s^2/kg"), _ev("D", "spring constant", k_est, 0.08 * k_est, "N/m")],
                 ("Designing an experiment and analyzing linearized data to extract a physical constant", ["Describe the measurements and how uncertainty is reduced", "Linearize the relationship and plot the data", "Use the slope to determine the spring constant"],
                  [("the generated periods follow $T=2\\pi\\sqrt{m/k}$ with a small random error so the best-fit slope is within a few percent of $4\\pi^2/k$", "the code rejects a seed whose fitted constant differs from the generating constant by more than four percent")], {"type": "table", "must_include": ["mass", "period"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted spring constant is compared with the generating constant"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 충돌 주장 =======================
def phf_qqt_collision(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0]); n = pick(rng, [2, 3, 4]); m2 = m1 * n; v0 = pick(rng, [2.0, 3.0, 4.0])
        vf = m1 * v0 / (m1 + m2)
        K0 = 0.5 * m1 * v0 ** 2; K1 = 0.5 * (m1 + m2) * vf ** 2
        agree(K1 / K0, m1 / (m1 + m2), 1e-9, "ratio")
        vs = sp.symbols("vs")
        sol = sp.solve(sp.Eq(sp.Rational(str(m1)) * sp.Rational(str(v0)), (sp.Rational(str(m1)) + sp.Rational(str(m2))) * vs), vs)[0]
        agree(vf, float(sol), 1e-9, "vf")
        break
    stim = {"kind": "text", "description": f"A cart of mass $m$ moving at speed $v_0={v0:g}\\text{{ m/s}}$ on a frictionless track collides with a stationary cart of mass ${n}m$. The carts stick together. A student claims that the kinetic energy of the two-cart system is the same before and after the collision.", "data": {}}
    parts = [
        part("A", "Do you agree or disagree with the student's claim? Justify your answer qualitatively without calculating numbers.", 3, "explain", ["3.B", "3.C"],
             "Disagree. Momentum is conserved because there is no net external horizontal force, but the carts stick together (a perfectly inelastic collision) so some kinetic energy is transformed into internal energy.",
             [R("A1", "claim", "Disagrees with the claim (kinetic energy is not conserved)", ["disagree"], err=["agrees because momentum is conserved"]),
              R("A2", "justification", "Justifies the claim by distinguishing that momentum is conserved from kinetic energy, which is not (mentioning that no net external force acts is welcome but not required)", ["momentum is conserved while kinetic energy is not"], requires="A1", err=["says both are conserved in every collision"]),
              R("A3", "justification", "Explains that sticking together transforms kinetic energy into internal energy (or notes the carts do not separate)", ["kinetic energy becomes internal energy because the carts stick together"], requires="A1", err=["attributes the loss to friction with the track"])]),
        part("B", f"Derive an expression for the speed $v_f$ of the combined carts in terms of $v_0$ and numerical constants, and find the fraction of the initial kinetic energy that remains.", 3, "derive", ["2.A", "3.B"],
             f"$mv_0=(m+{n}m)v_f$ so $v_f=v_0/{n + 1}={vf:.3f}\\text{{ m/s}}$; the remaining kinetic energy fraction is $\\dfrac{{(m+{n}m)v_f^2}}{{mv_0^2}}=\\dfrac{{1}}{{{n + 1}}}$.",
             [R("B1", "expression", f"Applies conservation of momentum: $mv_0=(m+{n}m)v_f$", [f"m v0 = (m + {n}m) vf"], err=["adds the speeds"]),
              R("B2", "expression", f"Solves for $v_f=v_0/{n + 1}$", [f"v0/{n + 1}"], requires="B1", err=["divides by n rather than n+1"]),
              R("B3", "expression", f"Finds the kinetic energy fraction $1/{n + 1}$", [f"1/{n + 1}"], requires="B2", err=["uses the speed fraction as the energy fraction"])]),
        part("C", f"The stationary cart is replaced by one with a mass of ${2 * n}m$ and the carts again stick together. Predict whether the fraction of the initial kinetic energy that is lost increases, decreases, or stays the same, and justify your prediction.", 2, "explain", ["2.D", "3.C"],
             f"The fraction lost increases. The remaining fraction is $m/(m+M)$, which gets smaller as $M$ grows, so the lost fraction $M/(m+M)$ grows.",
             [R("C1", "claim", "States that the fraction of kinetic energy lost increases", ["increases"], err=["states the lost fraction decreases for a heavier target"]),
              R("C2", "justification", "Justifies with the remaining fraction $m/(m+M)$ decreasing as $M$ increases", ["remaining fraction m/(m+M) decreases as M increases"], alt=["compares the numerical remaining fractions for the two target masses"], requires="C1", err=["argues only that more mass means more energy"])]),
    ]
    return _pack("phf_qqt_collision", "qqt", "4.4", ["4.3", "3.1"], "3.B", "Claim about kinetic energy in a perfectly inelastic collision", stim, parts, 8, 17, [f"m1={m1}", f"n={n}", f"v0={v0}", f"vf={vf:.4f}"],
                 [_ev("B", "final speed", vf, 0.01, "m/s"), _ev("B", "energy fraction", K1 / K0, 0.005, "")],
                 ("Evaluating a claim about conservation laws in a perfectly inelastic collision with a derivation and a prediction", ["Decide which quantity is conserved in the collision and justify", "Derive the final speed and the kinetic energy fraction", "Predict the effect of a heavier target"],
                  [("no net external horizontal force acts on the two-cart system", "the stimulus states a frictionless track")], {"type": "text", "must_include": ["masses", "initial speed"]},
                  "sympy solves the momentum equation; the kinetic energy fraction is recomputed numerically from the two kinetic energies"),
                 ["justification", "symbolic_reasoning"])


FRQ_TYPES = {"phf_mr_table_block": ("MR", 10), "phf_tbr_spring_shm": ("TBR", 12), "phf_lab_spring_k": ("LAB", 10), "phf_qqt_collision": ("QQT", 8)}
STAGE_FRQ = list(FRQ_TYPES)
