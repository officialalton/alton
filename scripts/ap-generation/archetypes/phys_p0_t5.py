"""AP Physics 1 — PH5 구조 독립 보충(2026-10-22, 브랜치 ap-topup-p1-lt-wh): 공개 PH1~PH4 와 구조가 겹치지 않는 4개 FRQ 시나리오·2개 세트·4개 단독 문항.
오너 규칙: 같은 개념을 다시 평가하는 것은 허용하되 자료·조건·질문·필수 추론 단계가 실질적으로 달라야 한다. 정답·수치는 코드가 이중 경로로 계산한다.
새 FRQ: MR 줄에 끌려가는 상자(밧줄 각도) / TBR 공이 벽에 부딪힐 때 힘–시간 그래프 / LAB 부분 잠긴 물체의 겉보기 무게로 액체 밀도 / QQT 낙하와 수평 발사의 도달 시간.
새 세트: x–t 그래프(속도·평균 속력) / v–t 그래프로 미끄러져 멈추는 블록(가속도·마찰 계수). 새 단독: 절벽 위로 던진 공의 낙하 속력 / 벽에 눌린 블록 / 두 줄에 매달린 간판 / U자관 두 액체."""
from phys_common import *
from phys_p0_frq import R, _pack, _ev, part
from phys_p0_e import _set_pack


# ======================= MR (10): 밧줄에 끌려가는 상자 =======================
def phf_mr_rope_crate(rng):
    for _ in forever():
        m = pick(rng, [8.0, 10.0, 12.0]); T = pick(rng, [40.0, 50.0, 60.0]); th = pick(rng, [20, 25, 30, 35]); mu = pick(rng, [0.20, 0.25, 0.30]); dth = pick(rng, [10, 15])
        thr = math.radians(th)
        N = m * G - T * math.sin(thr); f = mu * N; a = (T * math.cos(thr) - f) / m
        # 독립: 미지수 [N, f, a] 에 대한 선형계로 푼다
        A = np.array([[1.0, 0.0, 0.0], [mu, -1.0, 0.0], [0.0, 1.0, m]]); b = np.array([m * G - T * math.sin(thr), 0.0, T * math.cos(thr)])
        Nn, fn, an = np.linalg.solve(A, b); agree(N, Nn, 1e-9, "N"); agree(f, fn, 1e-9, "f"); agree(a, an, 1e-9, "a")
        thr2 = math.radians(th + dth); N2 = m * G - T * math.sin(thr2); f2 = mu * N2
        if N > 0 and N2 > 0 and a > 0.4 and f2 < f - 0.5:
            break
    stim = {"kind": "text", "description": f"A crate of mass $m={m:g}\\text{{ kg}}$ is pulled across a rough horizontal floor by a rope that exerts a force of magnitude $T={T:g}\\text{{ N}}$ at an angle $\\theta={th}^\\circ$ above the horizontal. The coefficient of kinetic friction between the crate and the floor is $\\mu={mu:g}$. The crate speeds up as it slides.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents the crate, draw and label the forces (not components) that act on the crate while it slides. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A", "1.C"],
             "Four arrows from the dot: weight straight down, the normal force straight up, the rope force up and to the right at the angle $\\theta$, and kinetic friction to the left. The normal force is shorter than the weight because the rope pulls partly upward.",
             [R("A1", "diagram", "Draws and labels all four forces: weight (down), normal force (up), rope tension (up and to the right) and kinetic friction (left), with no extra force", ["weight", "normal", "tension", "friction"], err=["adds a force of motion", "omits the normal force"]),
              R("A2", "diagram", "Directions are correct: the rope force at the angle above the horizontal toward the direction of motion and friction opposite to the motion", ["directions"], err=["draws friction in the direction of motion"]),
              R("A3", "diagram", "The normal force arrow is shorter than the weight arrow because the rope has an upward component", ["normal shorter than weight"], err=["draws the normal force equal to the weight"])]),
        part("B", "Derive an expression for the magnitude of the acceleration of the crate in terms of $m$, $T$, $\\theta$, $\\mu$, and fundamental constants.", 3, "derive", ["2.A"],
             "Vertical: $N+T\\sin\\theta=mg$ so $N=mg-T\\sin\\theta$. Horizontal: $T\\cos\\theta-\\mu N=ma$, so $a=\\dfrac{T\\cos\\theta-\\mu(mg-T\\sin\\theta)}{m}$.",
             [R("B1", "expression", "Applies the vertical equilibrium condition to find the normal force: $N=mg-T\\sin\\theta$", ["N = m g - T sin theta"], err=["uses N = m g"]),
              R("B2", "expression", "Writes Newton's second law along the floor: $T\\cos\\theta-\\mu N=ma$", ["T cos theta - mu N = m a"], err=["uses the full tension in the horizontal equation"]),
              R("B3", "expression", "Combines the equations to the correct expression for $a$", ["(T cos theta - mu (m g - T sin theta))/m"], requires="B2", err=["omits the upward component of the rope force from the normal force"])]),
        part("C", f"Calculate the magnitude of the acceleration of the crate for $m={m:g}\\text{{ kg}}$, $T={T:g}\\text{{ N}}$, $\\theta={th}^\\circ$ and $\\mu={mu:g}$.", 2, "calculate", ["2.B"],
             f"$N={N:.1f}\\text{{ N}}$, $f={f:.1f}\\text{{ N}}$ and $a=({T * math.cos(thr):.1f}-{f:.1f})/{m:g}\\approx {a:.2f}\\text{{ m/s}}^2$.",
             [R("C1", "numeric", f"Calculates the normal force (about {N:.0f} newtons) from the expression in part B", [f"{N:.0f}"], requires="B1", nums=True, err=["uses mg as the normal force"]),
              R("C2", "numeric", f"Calculates an acceleration of about {a:.2f} with units of meters per second squared", [f"{a:.2f}", "m/s^2"], requires="B3", nums=True, units=True, err=["uses the weight as the normal force"])]),
        part("D", f"The rope is raised so that the angle increases by ${dth}^\\circ$, while the tension stays the same and the crate keeps sliding. Does the magnitude of the kinetic friction force increase, decrease, or stay the same? Justify your answer.", 2, "explain", ["3.B", "3.C"],
             "The friction force decreases. A larger angle gives the rope a larger upward component $T\\sin\\theta$, which lowers the normal force $N=mg-T\\sin\\theta$, and $f=\\mu N$ decreases.",
             [R("D1", "claim", "States that the kinetic friction force decreases", ["decreases"], err=["states that friction stays the same because the crate weighs the same"]),
              R("D2", "justification", "Justifies that the larger upward component of the rope force reduces the normal force, and friction is proportional to the normal force", ["smaller normal force"], requires="D1", err=["argues only that the horizontal component of the tension decreases"])]),
    ]
    return _pack("phf_mr_rope_crate", "mr", "2.7", ["2.2", "2.5"], "2.B", "Crate pulled by a rope at an angle across a rough floor", stim, parts, 10, 22, [f"m={m}", f"T={T}", f"theta={th}", f"mu={mu}", f"N={N:.3f}", f"f={f:.3f}", f"a={a:.4f}"],
                 [_ev("C", "normal force", N, max(0.6, 0.012 * N), "N"), _ev("C", "acceleration", a, max(0.06, 0.015 * a), "m/s^2")],
                 ("Newton's second law with an angled applied force and kinetic friction, and how the normal force and friction change with the angle", ["Draw all four forces on the crate", "Use the vertical equation to find the normal force and the horizontal equation for the acceleration", "Predict how raising the rope angle changes friction"],
                  [("the rope force has constant magnitude and the crate stays on the floor", "the stimulus gives a constant tension and states that the crate slides along the floor")], {"type": "text", "must_include": ["the mass", "the rope force and angle", "the coefficient of friction"]},
                  "the three unknowns N, f and a are solved as a linear system with numpy and compared with the closed-form expressions"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 공이 벽에 부딪힐 때 힘–시간 그래프 =======================
def phf_tbr_ball_wall_impulse(rng):
    for _ in forever():
        m = pick(rng, [0.15, 0.20, 0.25]); v1 = pick(rng, [8.0, 10.0, 12.0, 15.0]); Fm = pick(rng, [float(x) for x in range(400, 1600, 50)]); t1 = pick(rng, [0.004, 0.005]); t2 = pick(rng, [0.006, 0.007, 0.008])
        Tc = t1 + t2; J = 0.5 * Fm * Tc; v2 = J / m - v1; Fav = J / Tc
        if not (0.4 * v1 <= v2 <= 0.9 * v1):
            continue  # 벽은 에너지를 더하지 못한다: 되돌아가는 속력은 들어오는 속력보다 작아야 한다(검토기가 지적한 물리적 불일치 방지)
        tt = np.linspace(0, Tc, 20001); FF = np.interp(tt, [0, t1, Tc], [0, Fm, 0]); agree(J, float(np.trapezoid(FF, tt)), 1e-6, "J")
        # 독립: 운동량 변화로 되돌아가는 속력 m(v2+v1)=J 를 다시 푼다
        v2n = float(np.linalg.solve(np.array([[m]]), np.array([J - m * v1]))[0]); agree(v2, v2n, 1e-9, "v2")
        if J > 1.5:
            break
    Jstick = m * v1
    stim = {"kind": "table", "description": f"A ball of mass $m={m:g}\\text{{ kg}}$ moving horizontally at speed $v_1={v1:g}\\text{{ m/s}}$ hits a vertical wall and bounces straight back. A force sensor in the wall records the force that the wall exerts on the ball during the contact.", "data": {"x_label": "Time t (ms)", "y_label": "Force F (N)", "rows": [[0.0, 0.0], [t1 * 1000, Fm], [Tc * 1000, 0.0]]}}
    parts = [
        part("A", "On the axes provided, sketch the force that the wall exerts on the ball as a function of time during the contact, using the three data points. Label the axes with quantities and units and label the key values.", 4, "graph", ["1.A", "1.C"],
             f"A straight line from the origin up to ${Fm:g}\\text{{ N}}$ at ${t1 * 1000:g}\\text{{ ms}}$ and a straight line back down to zero at ${Tc * 1000:g}\\text{{ ms}}$ (a triangle).",
             [R("A1", "graph", "Both axes are labeled with quantities and units and a scale is shown", ["axis labels", "units"], err=["omits units"]),
              R("A2", "graph", f"Plots the three points $(0,0)$, $({t1 * 1000:g}\\text{{ ms}}, {Fm:g}\\text{{ N}})$ and $({Tc * 1000:g}\\text{{ ms}}, 0)$ accurately", [f"{t1 * 1000:g}", f"{Fm:g}"], nums=True),
              R("A3", "graph", "Draws a straight line segment from the origin to the peak", ["rising segment"], err=["draws a curve through the peak"]),
              R("A4", "graph", "Draws a straight line segment from the peak back down to zero force at the end of the contact", ["falling segment"], err=["ends the graph with a nonzero force"])]),
        part("B", "Determine the magnitude of the impulse that the wall exerts on the ball. Show how you use your graph from part A.", 3, "calculate", ["2.A", "2.B"],
             f"The impulse is the area under the force-time graph: $J=\\tfrac12({Fm:g})({Tc:.4f})\\approx {J:.2f}\\text{{ N s}}$.",
             [R("B1", "expression", "Identifies the impulse as the area under the force-time graph", ["impulse is the area under the force-time graph"], err=["uses the slope of the graph"]),
              R("B2", "expression", "Uses the triangle area $\\tfrac12F_{\\max}\\Delta t$ with the total contact time", ["1/2 F max delta t"], requires="B1", err=["uses only the rising part of the graph"]),
              R("B3", "numeric", f"Calculates an impulse of about {J:.2f} with units of newton seconds (or kilogram meters per second)", [f"{J:.2f}", "N s"], requires="B2", nums=True, units=True, err=["forgets to convert milliseconds to seconds"])]),
        part("C", "Calculate the speed of the ball just after it leaves the wall. Show your work.", 3, "calculate", ["2.B", "3.B"],
             f"The ball reverses direction, so $J=m(v_2-(-v_1))=m(v_2+v_1)$ and $v_2=J/m-v_1={J / m:.1f}-{v1:g}\\approx {v2:.1f}\\text{{ m/s}}$.",
             [R("C1", "expression", "Applies the impulse-momentum theorem with the velocity reversing sign: $J=m(v_2+v_1)$", ["J = m (v2 + v1)"], err=["uses J = m(v2 - v1) without the sign change"]),
              R("C2", "expression", "Solves for $v_2=J/m-v_1$", ["v2 = J/m - v1"], requires="C1", err=["adds the initial speed to J/m"]),
              R("C3", "numeric", f"Calculates a rebound speed of about {v2:.1f} with units of meters per second", [f"{v2:.1f}", "m/s"], requires="C2", nums=True, units=True, err=["uses the impulse as the final speed"])]),
        part("D", "Suppose the ball were instead made of clay and stuck to the wall without bouncing. Would the magnitude of the impulse that the wall exerts on the ball be greater than, less than, or equal to the impulse in this experiment? Justify your answer.", 2, "explain", ["3.B", "3.C"],
             f"The impulse would be less. The impulse equals the change in momentum; a ball that stops changes its momentum by $mv_1={Jstick:.2f}\\text{{ N s}}$, while the bouncing ball changes its momentum from $-mv_1$ to $+mv_2$, a larger change.",
             [R("D1", "claim", "States that the impulse would be less", ["less"], err=["states the impulse would be the same because the speed before contact is the same"]),
              R("D2", "justification", "Justifies that the change in momentum is smaller when the ball only stops than when it reverses direction", ["smaller change in momentum"], requires="D1", err=["argues only that clay is softer"])]),
    ]
    return _pack("phf_tbr_ball_wall_impulse", "tbr", "4.2", ["4.1", "4.3"], "1.A", "Ball bouncing off a wall: force-time graph and impulse", stim, parts, 12, 27, [f"m={m}", f"v1={v1}", f"Fm={Fm}", f"t1={t1}", f"t2={t2}", f"J={J:.4f}", f"v2={v2:.3f}"],
                 [_ev("B", "impulse", J, max(0.02, 0.01 * J), "N s"), _ev("C", "rebound speed", v2, max(0.2, 0.015 * v2), "m/s")],
                 ("Translating force-sensor data into a force-time graph, using the area as the impulse, and using the impulse-momentum theorem with a reversal of direction", ["Represent the contact force as a force-time graph", "Use the area under the graph as the impulse", "Apply the impulse-momentum theorem with the velocity changing sign"],
                  [("the wall force is the net force on the ball along the line of motion and changes linearly with time", "the stimulus gives the force at three times and says the ball bounces straight back")], {"type": "table", "must_include": ["time", "force"]},
                  "the impulse is recomputed by numerical integration of the piecewise-linear force and the rebound speed by a linear solve of the impulse-momentum equation"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 부분 잠긴 물체의 겉보기 무게로 액체 밀도 =======================
def phf_lab_apparent_weight(rng):
    for _ in forever():
        rho = pick(rng, [800.0, 1000.0, 1200.0]); W = pick(rng, [4.0, 5.0, 6.0]); Vs = [20, 40, 60, 80, 100]
        r2 = random.Random(rng.randrange(10 ** 9))
        Wa = [round(W - rho * G * v * 1e-6 + r2.uniform(-0.012, 0.012), 3) for v in Vs]
        slope, icpt = np.polyfit(Vs, Wa, 1)
        X = np.array([[v, 1.0] for v in Vs]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(Wa)); agree(slope, beta[0], 1e-9, "slope")
        rho_est = -slope * 1e6 / G
        if abs(rho_est - rho) / rho < 0.04 and min(Wa) > 0.2:
            break
    stim = {"kind": "table", "description": "A student hangs a metal cylinder from a force sensor and lowers it into a tank of an unknown liquid. For each trial the student records the submerged volume $V$ of the cylinder and the force-sensor reading $W_{app}$ (the apparent weight), with the cylinder at rest.", "data": {"x_label": "Submerged volume V (cm^3)", "y_label": "Apparent weight W_app (N)", "rows": [[v, w] for v, w in zip(Vs, Wa)]}}
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the apparent weight as a function of the submerged volume. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in a reading.", 3, "design", ["3.A", "2.B"],
             "Hang a cylinder with marked volume divisions from a force sensor, lower it into the liquid until each successive marked division is at the surface, wait until it is at rest, and read the sensor; repeat each reading several times and average.",
             [R("A1", "design", "Identifies the measured quantities and equipment: a force sensor (or scale) for the apparent weight and a way to know the submerged volume (marks on the cylinder or the liquid level)", ["force sensor and a way to know the submerged volume"], err=["omits how the submerged volume is known"]),
              R("A2", "design", "Changes only the submerged volume while keeping the same cylinder and liquid, and reads the sensor with the cylinder at rest (both conditions are needed)", ["change only the submerged volume with the object at rest"]),
              R("A3", "design", "Reduces uncertainty by repeating each reading and averaging, or by waiting for the reading to settle (either earns the point)", ["repeat and average or wait to settle (either earns the point)"])]),
        part("B", "Using the relationship between the apparent weight, the weight in air, the density of the liquid and the submerged volume, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find the density of the liquid.", 1, "explain", ["2.B", "3.A"],
             "Plot $W_{app}$ on the vertical axis against $V$ on the horizontal axis; $W_{app}=W-\\rho gV$, so the slope is $-\\rho g$.",
             [R("B1", "expression", "Identifies $W_{app}$ (vertical) versus $V$ (horizontal)", ["W_app versus V"], err=["plots V versus W_app and uses the wrong slope relation"])]),
        part("C", "On a blank grid whose scale you choose, plot the data and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(V, W_{{app}})$: {', '.join(f'({v}, {w:.3f})' for v, w in zip(Vs, Wa))} with a best-fit line of slope about ${slope:.4f}\\text{{ N/cm}}^3$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the density of the liquid. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is about ${slope:.4f}\\text{{ N/cm}}^3$, which is ${abs(slope) * 1e6:.0f}\\text{{ N/m}}^3$ in magnitude, so $\\rho=|\\text{{slope}}|/g\\approx {rho_est:.0f}\\text{{ kg/m}}^3$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.4f} N/cm^3; accept any value within 5 percent) and converts to N/m^3", [f"{slope:.4f}"], requires="C3", nums=True, err=["uses data points rather than points on the line", "forgets to convert cubic centimeters to cubic meters"]),
              R("D2", "expression", "Relates the magnitude of the slope to the density: $|\\text{slope}|=\\rho g$", ["|slope| = rho g"], err=["uses slope = rho"]),
              R("D3", "numeric", f"Calculates the density (about {rho_est:.0f}; accept any value within 8 percent) with units of kilograms per cubic meter", [f"{rho_est:.0f}", "kg/m^3"], alt=["a density consistent with the student's own slope from D1, $\\rho=|\\text{slope}|/g$"], nums=True, units=True)]),
    ]
    return _pack("phf_lab_apparent_weight", "lab", "8.3", ["8.2"], "3.A", "Experiment: density of a liquid from the apparent weight of a partly submerged cylinder", stim, parts, 10, 27, [f"rho={rho}", f"W={W}", f"slope={slope:.6f}", f"rho_est={rho_est:.2f}", f"Wa={Wa}"],
                 [_ev("D", "slope", slope, 0.05 * abs(slope), "N/cm^3"), _ev("D", "density", rho_est, 0.08 * rho_est, "kg/m^3")],
                 ("Designing an experiment and analyzing linearized buoyancy data to extract the density of a liquid", ["Describe the measurements and how uncertainty is reduced", "Linearize the relationship and plot the data", "Use the slope to determine the density"],
                  [("the apparent weight decreases linearly with the submerged volume because the buoyant force is $\\rho gV$", "the code generates readings from $W-\\rho gV$ with a small random error so the slope is within a few percent of the generating value")], {"type": "table", "must_include": ["submerged volume", "apparent weight"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted density is compared with the generating density"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 낙하와 수평 발사 =======================
def phf_qqt_drop_vs_launch(rng):
    for _ in forever():
        h = pick(rng, [1.0, 1.2, 1.5, 1.8, 2.0]); v0 = pick(rng, [2.0, 3.0, 4.0])
        t = math.sqrt(2 * h / G); x = v0 * t
        ts = sp.symbols("tau", positive=True); ssol = float(sp.solve(sp.Eq(sp.Rational(str(G)) / 2 * ts ** 2, sp.Rational(str(h))), ts)[0]); agree(t, ssol, 1e-9, "t")
        # 독립: 연직 방향 운동을 RK4 로 적분해 바닥까지의 시간을 잰다
        y = np.array([h, 0.0]); tm = 0.0; dt = 1e-4
        while y[0] > 0:
            prv = y.copy(); y = rk4(lambda tt, s: np.array([s[1], -G]), y, tm, tm + dt, 1); tm += dt
        fr = prv[0] / (prv[0] - y[0]); tn = tm - dt + dt * fr; agree(t, tn, 2e-3, "t_rk4")
        break
    stim = {"kind": "text", "description": f"Two identical small balls are at the edge of a horizontal platform of height $h={h:g}\\text{{ m}}$. At the same instant one ball is dropped from rest and the other is launched horizontally with speed $v_0={v0:g}\\text{{ m/s}}$. Air resistance is negligible. A student claims that the ball that is launched horizontally takes longer to reach the floor because it travels farther.", "data": {}}
    parts = [
        part("A", "Do you agree or disagree with the student's claim? Justify your answer qualitatively without calculating numbers.", 3, "explain", ["3.B", "3.C"],
             "Disagree. The horizontal and vertical motions are independent. Both balls start with zero vertical velocity and have the same vertical acceleration $g$ over the same height, so they reach the floor at the same time.",
             [R("A1", "claim", "Disagrees with the claim (the two balls land at the same time)", ["disagree"], err=["agrees because the launched ball travels a longer path"]),
              R("A2", "justification", "Justifies that the vertical motion does not depend on the horizontal motion", ["vertical and horizontal motions are independent"], requires="A1", err=["argues only that gravity acts on both balls"]),
              R("A3", "justification", "Notes that both balls have the same initial vertical velocity (zero), the same acceleration and the same height", ["same initial vertical velocity, acceleration and height"], requires="A1", err=["states the launched ball has a larger vertical acceleration"])]),
        part("B", f"Derive an expression for the time that the balls take to reach the floor in terms of $h$ and fundamental constants, and calculate the horizontal distance from the platform edge at which the launched ball lands.", 3, "derive", ["2.A", "2.B"],
             f"$h=\\tfrac12gt^2$ so $t=\\sqrt{{2h/g}}={t:.3f}\\text{{ s}}$; the horizontal distance is $x=v_0t={x:.2f}\\text{{ m}}$.",
             [R("B1", "expression", "Applies the vertical kinematic equation $h=\\tfrac12gt^2$ with zero initial vertical velocity", ["h = 1/2 g t^2"], err=["uses $h=v_0t$"]),
              R("B2", "expression", "Solves for the time $t=\\sqrt{2h/g}$", ["sqrt(2h/g)"], requires="B1", err=["omits the square root"]),
              R("B3", "numeric", f"Calculates a landing distance of about {x:.2f} with units of meters using $x=v_0t$", [f"{x:.2f}", "m"], requires="B2", nums=True, units=True, err=["uses the total speed in the horizontal distance"])]),
        part("C", f"The launch speed of the horizontal ball is doubled to ${2 * v0:g}\\text{{ m/s}}$ while the platform height stays the same. Predict how the time to reach the floor and the landing distance change, and justify your prediction.", 2, "explain", ["2.D", "3.C"],
             "The time stays the same because it depends only on the height, and the landing distance doubles because $x=v_0t$ with the same time.",
             [R("C1", "claim", "States that the time stays the same and the landing distance doubles", ["time same", "distance doubles"], err=["states that the time halves"]),
              R("C2", "justification", "Justifies with $t=\\sqrt{2h/g}$ independent of $v_0$ and $x=v_0t$ proportional to $v_0$", ["t independent of v0 and x proportional to v0"], requires="C1", err=["argues that a faster ball spends less time in the air"])]),
    ]
    return _pack("phf_qqt_drop_vs_launch", "qqt", "1.5", ["1.2", "1.4"], "3.B", "Claim about a dropped ball and a horizontally launched ball", stim, parts, 8, 17, [f"h={h}", f"v0={v0}", f"t={t:.4f}", f"x={x:.4f}"],
                 [_ev("B", "time to fall", t, 0.01, "s"), _ev("B", "landing distance", x, 0.02, "m")],
                 ("Evaluating a claim about independent horizontal and vertical motion with a derivation and a prediction", ["Decide whether the horizontal launch speed affects the time to fall and justify", "Derive the fall time and the landing distance", "Predict the effect of doubling the launch speed"],
                  [("air resistance is negligible so the vertical motion has the acceleration of gravity", "the stimulus states air resistance is negligible")], {"type": "text", "must_include": ["platform height", "launch speed"]},
                  "sympy solves the fall time; an RK4 integration of the vertical motion recomputes it"),
                 ["justification", "symbolic_reasoning"])


# ======================= 세트 1 (단원 1): 위치–시간 그래프 → (구간 속도, 평균 속력) =======================
def phs_xt_set(rng):
    for _ in forever():
        n = pick(rng, [3, 4]); ts = [0]
        for _ in range(n):
            ts.append(ts[-1] + pick(rng, [2, 3, 4]))
        ps = [0]
        for _ in range(n):
            ps.append(ps[-1] + rng.choice([-1, 1]) * rng.choice([4, 6, 8, 10, 12]))
        seg = rng.randrange(n); vseg = (ps[seg + 1] - ps[seg]) / (ts[seg + 1] - ts[seg])
        dist = float(sum(abs(Fr(ps[i + 1] - ps[i])) for i in range(n))); T = ts[-1]; avg_speed = dist / T; avg_vel = (ps[-1] - ps[0]) / T
        tt = np.linspace(0, T, 40001); pp = np.interp(tt, ts, ps); agree(dist, float(np.sum(np.abs(np.diff(pp)))), 1e-4, "dist")
        if vseg != 0 and any(ps[i + 1] < ps[i] for i in range(n)) and any(ps[i + 1] > ps[i] for i in range(n)) and avg_speed != abs(avg_vel) and abs(avg_vel) > 0.2:
            break
    t0, t1_ = ts[seg], ts[seg + 1]
    k1, d1 = num_opts(vseg, [("Reports the position at the end of the interval instead of the slope.", float(ps[seg + 1])), ("Divides the position change by the total time of the trip instead of the length of the interval.", (ps[seg + 1] - ps[seg]) / T),
                             ("Reports the position change without dividing by the elapsed time.", float(ps[seg + 1] - ps[seg])), ("Divides the end position by the end time, which is the average velocity from the origin.", ps[seg + 1] / t1_), ("Reports the speed of the longest segment of the trip instead of the segment asked about.", float(max((abs(ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]) for i in range(n)))))], "m/s")
    k2, d2 = num_opts(avg_speed, [("Reports the average velocity (net displacement divided by time), which cancels the motion in opposite directions.", abs(avg_vel)), ("Divides the final position by the total time and adds nothing for the reversals.", abs(ps[-1]) / T if ps[-1] != 0 else None),
                                  ("Averages the speeds of the segments without weighting by their durations.", float(np.mean([abs(ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]) for i in range(n)]))), ("Divides the total distance by the duration of the longest segment.", dist / max(ts[i + 1] - ts[i] for i in range(n))),
                                  ("Reports the speed of the fastest segment instead of the average over the whole trip.", max(abs(ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]) for i in range(n))), ("Adds the speeds of all the segments.", float(sum(abs(ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]) for i in range(n))))], "m/s")
    stim = graph_stim("Position of a cart versus time", [("x", list(zip(ts, ps)))], gaxis("Time (s)", 0, T, 1), gaxis("Position (m)", min(ps + [0]) - 2, max(ps + [0]) + 2, 2))
    q = []
    for st, key, ds, top, nm, kw in [(f"What is the velocity of the cart between $t={t0}\\text{{ s}}$ and $t={t1_}\\text{{ s}}$? Positive is to the right.", k1, d1, "1.3", "q1", f"The velocity is the slope of the graph: $({ps[seg + 1]}-({ps[seg]}))/({t1_}-{t0})={sig(vseg)}\\text{{ m/s}}$."),
                                     (f"What is the average speed of the cart for the whole trip from $t=0$ to $t={T}\\text{{ s}}$?", k2, d2, "1.2", "q2", f"The total distance adds the magnitude of each position change, ${sig(dist)}\\text{{ m}}$, and dividing by ${T}\\text{{ s}}$ gives ${sig(avg_speed)}\\text{{ m/s}}$.")]:
        q.append(mk(f"phs_xt_set_{nm}", top, "2.B", st, key, ds, rng, concept="Two questions about a single position-time graph", thinking=["Read the slope of the graph segment for the velocity", "Add the magnitudes of the position changes between the plotted points for the distance and divide by the elapsed time for the average speed"],
                    cond=[("the position changes linearly between the plotted points", "the graph is built from integer vertices joined by straight segments")], path="exact fractions for the slope and the distance versus numpy on a dense resampling of the same graph", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "quantitative_comparison"], est=95, facts=[f"ts={ts}", f"ps={ps}"], kwhy=kw))
    intro = "The graph shows the position of a cart on a straight track as a function of time. Positive positions are to the right of the origin."
    return _set_pack("phs_xt_set", "1.3", intro, stim, q, q[0]["facts"])


# ======================= 세트 2 (단원 2): v–t 그래프로 미끄러져 멈추는 블록 → (가속도, 마찰 계수) =======================
def phs_slide_stop_set(rng):
    for _ in forever():
        v0 = pick(rng, [4.0, 5.0, 6.0, 8.0]); T = pick(rng, [2.0, 2.5, 4.0, 5.0]); m = pick(rng, [1.5, 2.0, 3.0, 4.0]); a = v0 / T; mu = a / G; Fnet = m * a
        dist = v0 * T / 2
        # 독립: 정지거리 v0^2/(2 mu g) 가 그래프 아래 넓이와 같고 마찰력 mu m g 가 알짜힘과 같음을 확인
        agree(v0 ** 2 / (2 * mu * G), dist, 1e-9, "dist"); agree(mu * m * G, Fnet, 1e-9, "Fnet")
        if 0.05 < mu < 0.9:
            break
    k1, d1 = num_opts(Fnet, [("Multiplies the mass by the initial speed, which is a momentum, not a force.", m * v0), ("Divides the mass by the acceleration, inverting Newton's second law.", m / a),
                             ("Uses half of the slope as if it were an average acceleration.", m * a / 2), ("Multiplies the mass by the stopping time.", m * T)], "N")
    k2, d2 = num_opts(mu, [("Reports the magnitude of the acceleration, forgetting to divide by $g$.", a), ("Divides $g$ by the acceleration, inverting the ratio.", G / a), ("Divides the acceleration by $2g$.", a / (2 * G)), ("Divides the net force by the mass without dividing by $g$.", Fnet / m)], "", n=2)
    stim = graph_stim("Velocity of the block versus time", [("v", [(0, v0), (T, 0)])], gaxis("Time (s)", 0, T, T / 5), gaxis("Velocity (m/s)", 0, v0 + 1, 1))
    q = []
    for st, key, ds, top, nm, kw in [("What is the magnitude of the net force on the block while it slides?", k1, d1, "2.5", "q1", f"The acceleration is the slope of the graph, ${v0:g}/{T:g}={sig(a)}\\text{{ m/s}}^2$ in magnitude, so $F_{{net}}=ma=({m:g})({sig(a)})={sig(Fnet)}\\text{{ N}}$."),
                                     ("What is the coefficient of kinetic friction between the block and the floor?", k2, d2, "2.7", "q2", f"Friction is the only horizontal force, so $\\mu mg=ma$ and $\\mu=a/g={sig(a)}/{G:g}={sig(mu, 2)}$.")]:
        q.append(mk(f"phs_slide_stop_set_{nm}", top, "2.B", st, key, ds, rng, concept="Two questions about a block that slides to a stop on a rough floor", thinking=["Read the acceleration from the slope of the velocity-time graph", "Apply Newton's second law with the kinetic friction force as the net force"],
                    cond=[("kinetic friction is the only horizontal force on the block", "the shared stimulus states the block slides on a rough horizontal floor with no other horizontal force")], path="the slope from the graph endpoints; the net force from Newton's second law and the coefficient cross-checked with the stopping distance v0 squared over 2 mu g equal to the area under the graph", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"v0={v0}", f"T={T}", f"m={m}"], kwhy=kw))
    intro = f"A ${m:g}\\text{{ kg}}$ block slides across a rough horizontal floor and comes to rest. No other horizontal force acts on the block. The graph shows the velocity of the block as a function of time."
    return _set_pack("phs_slide_stop_set", "2.7", intro, stim, q, q[0]["facts"])


# ======================= 단독 4 =======================
def ph_cliff_throw_speed(rng):
    for _ in forever():
        v0 = pick(rng, [8.0, 10.0, 12.0, 15.0]); h = pick(rng, [10.0, 15.0, 20.0, 25.0])
        vs = sp.symbols("vf", positive=True)
        vf = float(sp.solve(sp.Eq(vs ** 2, v0 ** 2 + 2 * sp.Rational(str(G)) * sp.Rational(str(h))), vs)[0])
        # 독립: 위로 던진 공이 절벽 아래 지면에 닿는 시간을 이분법으로 풀고(v0 t - g t^2/2 = -h) 속력 |v0 - g t| 를 구한다
        tt = bisect(lambda x: v0 * x - G / 2 * x * x + h, 0, 100); agree(vf, abs(v0 - G * tt), 1e-6, "vf")
        break
    pairs = [("Ignores the initial speed, using only the speed gained in falling the cliff height.", math.sqrt(2 * G * h)), ("Adds the initial speed to the speed gained in the fall.", v0 + math.sqrt(2 * G * h)),
             ("Subtracts the squares: $\\sqrt{2gh-v_0^2}$.", math.sqrt(2 * G * h - v0 ** 2) if 2 * G * h > v0 ** 2 else None), ("Uses the initial speed only, assuming the ball returns to the launch speed at the ground.", v0)]
    key, ds = num_opts(vf, pairs, "m/s")
    stem = f"A ball is thrown straight up with a speed of ${v0:g}\\text{{ m/s}}$ from the edge of a cliff that is ${h:g}\\text{{ m}}$ above the ground. The ball misses the cliff on the way down and lands on the ground below. Air resistance is negligible. What is the speed of the ball just before it lands?"
    return mk("ph_cliff_throw_speed", "1.2", "2.B", stem, key, ds, rng, concept="Constant-acceleration kinematics for a ball thrown upward from a height", thinking=["Recognize that the ball passes the launch height going down with the launch speed", "Use $v^2=v_0^2+2gh$ over the cliff height"],
              cond=[("the only acceleration is $g$ downward", "the problem states air resistance is negligible")], path="sympy solves $v^2=v_0^2+2gh$; a bisection root finder on the displacement equation recomputes the flight time and the final speed", material=MAT_NONE,
              judgment=["law_selection"], est=105, facts=[f"v0={v0}", f"h={h}"], kwhy=f"On the way down the ball passes the launch point with speed ${v0:g}\\text{{ m/s}}$ downward, so $v^2=v_0^2+2gh={v0 ** 2:g}+2({G:g})({h:g})$ and $v={sig(vf)}\\text{{ m/s}}$.")


def ph_wall_press_friction(rng):
    m = pick(rng, [0.5, 1.0, 2.0, 3.0]); mu = pick(rng, [0.25, 0.40, 0.50, 0.60])
    F = m * G / mu
    agree(F, float(sp.solve(sp.Eq(sp.Rational(str(mu)) * sp.symbols("F"), sp.Rational(str(m)) * sp.Rational(str(G))), sp.symbols("F"))[0]), 1e-9, "F")
    pairs = [("Multiplies the weight by the coefficient of friction, $\\mu mg$, instead of dividing.", mu * m * G), ("Sets the force equal to the weight, ignoring the coefficient of friction.", m * G),
             ("Divides the weight by $\\mu+1$, a mistaken combination.", m * G / (mu + 1)), ("Divides the mass by the coefficient of friction without multiplying by $g$.", m / mu)]
    key, ds = num_opts(F, pairs, "N")
    stem = f"A ${m:g}\\text{{ kg}}$ block is held at rest against a rough vertical wall by a horizontal force $F$ that presses the block against the wall. The coefficient of static friction between the block and the wall is ${mu:g}$. What is the minimum magnitude of $F$ that keeps the block from sliding down?"
    return mk("ph_wall_press_friction", "2.7", "2.B", stem, key, ds, rng, concept="Static friction balances the weight when the normal force is supplied by a horizontal push", thinking=["Identify that the normal force equals the horizontal push", "Set the maximum static friction equal to the weight"],
              cond=[("the block is on the verge of sliding", "the question asks for the minimum force that keeps the block from sliding")], path="sympy solves $\\mu F=mg$ for $F$ and the value is recomputed with plain arithmetic", material=MAT_NONE,
              judgment=["law_selection", "quantitative_comparison"], est=100, facts=[f"m={m}", f"mu={mu}"], kwhy=f"The wall supplies a normal force $N=F$, so the largest static friction is $\\mu F$. Holding the block requires $\\mu F=mg$, so $F=mg/\\mu={sig(F)}\\text{{ N}}$.")


def ph_two_ropes_sign(rng):
    m = pick(rng, [8.0, 10.0, 12.0, 20.0]); th = pick(rng, [20, 25, 30, 35, 40]); thr = math.radians(th)
    T = m * G / (2 * math.sin(thr))
    A = np.array([[math.cos(thr), -math.cos(thr)], [math.sin(thr), math.sin(thr)]]); b = np.array([0.0, m * G]); T1, T2 = np.linalg.solve(A, b); agree(T, T1, 1e-9, "T1"); agree(T, T2, 1e-9, "T2")
    pairs = [("Divides the weight equally between the ropes, forgetting the angle: $mg/2$.", m * G / 2), ("Uses the cosine of the angle with the horizontal instead of the sine: $mg/(2\\cos\\theta)$.", m * G / (2 * math.cos(thr))),
             ("Uses the full weight divided by the sine, treating one rope as carrying the whole load.", m * G / math.sin(thr)), ("Reports the horizontal component of the tension instead of the tension.", T * math.cos(thr))]
    key, ds = num_opts(T, pairs, "N")
    stem = f"A sign of mass ${m:g}\\text{{ kg}}$ hangs at rest from two light ropes. The two ropes are attached to the same ceiling and each makes an angle of ${th}^\\circ$ with the horizontal, on opposite sides of the sign. What is the magnitude of the tension in each rope?"
    return mk("ph_two_ropes_sign", "2.4", "2.B", stem, key, ds, rng, concept="Vertical force balance for an object supported by two symmetric ropes at an angle", thinking=["Resolve each tension into vertical and horizontal components", "Set the sum of the vertical components equal to the weight"],
              cond=[("the sign is at rest and the ropes are symmetric", "the stem states the sign is at rest and the ropes make equal angles")], path="a linear solve of the horizontal and vertical force-balance equations for the two tensions gives equal tensions equal to $mg/(2\\sin\\theta)$", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=110, facts=[f"m={m}", f"theta={th}"], kwhy=f"The vertical components of the two tensions support the weight: $2T\\sin\\theta=mg$, so $T=mg/(2\\sin\\theta)={sig(T)}\\text{{ N}}$.")


def ph_u_tube_oil(rng):
    rho_o = pick(rng, [700.0, 800.0, 900.0]); h_o = pick(rng, [10.0, 12.0, 15.0, 20.0]); rho_w = 1000.0
    h_w = rho_o * h_o / rho_w
    agree(h_w, float(sp.solve(sp.Eq(sp.Rational(str(rho_w)) * sp.symbols("hw"), sp.Rational(str(rho_o)) * sp.Rational(str(h_o))), sp.symbols("hw"))[0]), 1e-9, "hw")
    pairs = [("Inverts the density ratio: $h_o\\rho_w/\\rho_o$.", h_o * rho_w / rho_o), ("Assumes the two columns have the same height.", h_o), ("Uses the difference of the densities, $h_o(\\rho_w-\\rho_o)/\\rho_w$.", h_o * (rho_w - rho_o) / rho_w),
             ("Adds the two column heights.", h_o + h_w)]
    key, ds = num_opts(h_w, pairs, "cm")
    stem = f"A U-shaped tube open at both ends contains water (density $1000\\text{{ kg/m}}^3$). Oil of density ${rho_o:g}\\text{{ kg/m}}^3$ is poured into one arm until the oil column is ${h_o:g}\\text{{ cm}}$ tall. The oil does not mix with the water. The liquids are at rest. How high is the water column above the oil-water interface in the other arm?"
    return mk("ph_u_tube_oil", "8.2", "2.B", stem, key, ds, rng, concept="Equal pressure at the same level in a connected fluid at rest", thinking=["Recognize that the pressure at the oil-water interface level is the same in both arms", "Equate $\\rho_o g h_o$ and $\\rho_w g h_w$"],
              cond=[("the liquids are at rest and both arms are open to the atmosphere", "the stem states the tube is open at both ends and the liquids are at rest")], path="sympy solves $\\rho_wh_w=\\rho_oh_o$ and the height is recomputed with plain arithmetic", material=MAT_NONE,
              judgment=["law_selection", "quantitative_comparison"], est=105, facts=[f"rho_o={rho_o}", f"h_o={h_o}"], kwhy=f"At the level of the interface the pressure is the same in both arms: $\\rho_og h_o=\\rho_wg h_w$, so $h_w=({rho_o:g})({h_o:g})/1000={sig(h_w)}\\text{{ cm}}$.")


STAGE_T5_FRQ = ["phf_mr_rope_crate", "phf_tbr_ball_wall_impulse", "phf_lab_apparent_weight", "phf_qqt_drop_vs_launch"]
STAGE_T5_MC = ["ph_cliff_throw_speed", "ph_wall_press_friction", "ph_two_ropes_sign", "ph_u_tube_oil"]
STAGE_T5_SETS = ["phs_xt_set", "phs_slide_stop_set"]

# 단원별·세트 목록(guide-physics 와 test_phys_p0 가 읽는다; 여러 모듈의 같은 이름 목록은 registry 가 이어 붙인다).
STAGE_U1 = ["ph_cliff_throw_speed"]
STAGE_U2 = ["ph_wall_press_friction", "ph_two_ropes_sign"]
STAGE_U8 = ["ph_u_tube_oil"]
STAGE_SETS = ["phs_xt_set", "phs_slide_stop_set"]
STAGE_T5_FRQ2 = ["phf_tbr_ball_wall_impulse", "phf_lab_apparent_weight", "phf_qqt_drop_vs_launch"]  # 2차 실행: TBR(물리적 일관성 수정)·LAB(수식 감싸기)·QQT('table' 낱말 제거) 재생성. MR 은 1차 실행에서 2개 통과.

# 3차 실행(2026-10-22): 교육과정 주제 코드(CED 2027 Physics 1)를 바로잡은 뒤 단독 24개·세트·MR 을 다시 생성한다(이전 실행의 주제 라벨 오기 때문).
STAGE_T5_FRQ3 = ["phf_mr_rope_crate"]
