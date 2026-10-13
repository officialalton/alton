"""AP Physics 1 — FRQ 두 번째 시나리오 8종(2026-10-13, 오너 결정: 두 게시 모의고사가 같은 FRQ 를 재사용하지 않도록 유형마다 새 상황 2개).
유형·배점·행 구조는 phys_p0_frq.py 와 같다(MR 10 / TBR 12 / LAB 10 / QQT 8, 모든 행 1점). 모든 정답·표·기대값은 코드가 두 경로(sympy·정확 식 vs numpy·RK4·이분법·최소제곱)로 계산한다.
새 시나리오: MR 경사면 미끄러짐(그림)·마찰 구간 에너지 / TBR 3구간 수레 v–t·수직 투사 에너지 / LAB 진자 g·미끄럼 마찰 계수 / QQT 평평한 커브·떠 있는 나무 블록."""
from phys_common import *
from phys_figs import make_incline, check_scene
from phys_p0_frq import R, _pack, _ev, part


# ======================= MR (10): 거친 경사면에서 미끄러지는 블록 =======================
def phf_mr_incline_slide(rng):
    for _ in forever():
        th = pick(rng, [30, 35, 37, 40]); mu = pick(rng, [0.10, 0.15, 0.20, 0.25]); m = pick(rng, [2.0, 3.0, 4.0, 5.0]); d = pick(rng, [2.0, 3.0, 4.0, 5.0])
        thr = math.radians(th)
        a_s, N_, S_, C_, MU_, M_, GG_ = sp.symbols("a N S C MU M GG", positive=True)  # 기호 풀이는 sin, cos 를 기호로 두고(각도의 정확 삼각값은 느리다) 마지막에 수치 대입한다
        sol = sp.solve([sp.Eq(N_, M_ * GG_ * C_), sp.Eq(M_ * GG_ * S_ - MU_ * N_, M_ * a_s)], [N_, a_s])
        a = float(sol[a_s].subs({S_: math.sin(thr), C_: math.cos(thr), MU_: mu, M_: m, GG_: G})); v = math.sqrt(2 * a * d)
        # 독립 경로: 가속도 a 로 거리 d 에 도달할 때까지 RK4 로 적분해 속력을 구한다
        acc = G * math.sin(thr) - mu * G * math.cos(thr)
        y = np.array([0.0, 0.0]); t = 0.0; dt = 1e-3
        while y[0] < d:
            y = rk4(lambda tt, s: np.array([s[1], acc]), y, t, t + dt, 1); t += dt
        agree(a, acc, 1e-9, "a"); agree(v, y[1], 5e-3, "v")
        if a > 0.8:
            break
    sc = make_incline(th, m, mu); assert not check_scene(sc)
    stim = {"kind": "diagram", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ is released from rest on a rough incline that makes an angle $\\theta={th}^\\circ$ with the horizontal. The coefficient of kinetic friction between the block and the incline is $\\mu={mu:g}$. The block slides a distance $d={d:g}\\text{{ m}}$ down the incline.", "data": {"variant": "phys_scene", "scene": sc}}
    parts = [
        part("A", "On the dot below, which represents the block, draw and label the forces (not components) that act on the block while it slides down the incline. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A", "1.C"],
             "Three arrows from the dot: weight straight down, normal force perpendicular to the incline surface and pointing away from it, and kinetic friction pointing up the incline. The weight arrow is the longest and the friction arrow is shorter than the normal-force arrow.",
             [R("A1", "diagram", "Draws and labels the three forces: weight, normal force, and kinetic friction (no extra force such as a force down the incline)", ["weight", "normal force", "friction"], err=["adds a force of motion down the incline"]),
              R("A2", "diagram", "Arrow directions are correct: weight straight down, normal force perpendicular to the incline, friction up the incline", ["directions"], err=["draws the normal force vertical", "draws friction down the incline"]),
              R("A3", "diagram", "Relative lengths are consistent: the weight arrow is the longest and the friction arrow is shorter than the normal-force arrow", ["weight longest", "friction shorter than normal"], err=["draws the normal force as long as the weight"])]),
        part("B", "Derive an expression for the magnitude of the acceleration of the block down the incline in terms of $\\theta$, $\\mu$, and fundamental constants.", 3, "derive", ["2.A"],
             "Perpendicular to the incline $N=mg\\cos\\theta$; along the incline $mg\\sin\\theta-\\mu N=ma$, so $a=g(\\sin\\theta-\\mu\\cos\\theta)$.",
             [R("B1", "expression", "Applies Newton's second law perpendicular to the incline: $N=mg\\cos\\theta$", ["N = m g cos theta"], err=["uses N = m g"]),
              R("B2", "expression", "Applies Newton's second law along the incline: $mg\\sin\\theta-\\mu N=ma$", ["m g sin theta - mu N = m a"], err=["uses the cosine for the component along the incline", "adds the friction term"]),
              R("B3", "expression", "Combines the equations to the correct expression $a=g(\\sin\\theta-\\mu\\cos\\theta)$", ["g (sin theta - mu cos theta)"], requires="B2", err=["leaves the mass in the final expression"])]),
        part("C", f"Calculate the speed of the block after it has slid the distance $d={d:g}\\text{{ m}}$ down the incline.", 2, "calculate", ["2.B"],
             f"$a={a:.2f}\\text{{ m/s}}^2$ and $v=\\sqrt{{2ad}}=\\sqrt{{2({a:.2f})({d:g})}}\\approx {v:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", f"Calculates the acceleration (about {a:.2f}) from the expression in part B", [f"{a:.2f}"], requires="B3", nums=True, err=["uses the sine for both terms"]),
              R("C2", "numeric", f"Uses $v^2=2ad$ (or an energy equation) to find a speed of about {v:.2f} with units of meters per second", [f"{v:.2f}", "m/s"], requires="C1", nums=True, units=True, err=["forgets the square root"])]),
        part("D", f"The experiment is repeated on the same incline with a block of mass ${2 * m:g}\\text{{ kg}}$. Does the time for the block to slide the distance $d$ increase, decrease, or stay the same? Justify your answer.", 2, "explain", ["3.B", "3.C"],
             "The time stays the same. The mass cancels in $a=g(\\sin\\theta-\\mu\\cos\\theta)$, so the acceleration is unchanged and the time $t=\\sqrt{2d/a}$ is the same.",
             [R("D1", "claim", "States that the time stays the same", ["stays the same"], err=["states the heavier block takes less time"]),
              R("D2", "justification", "Justifies that the mass cancels, so the acceleration (and the time) does not depend on the mass", ["mass cancels", "same acceleration"], requires="D1", err=["argues only that heavier objects fall at the same rate without using the equation"])]),
    ]
    return _pack("phf_mr_incline_slide", "mr", "2.7", ["2.5", "2.2", "1.2"], "2.B", "Block sliding down a rough incline", stim, parts, 10, 22, [f"th={th}", f"mu={mu}", f"m={m}", f"d={d}", f"a={a:.4f}", f"v={v:.3f}"],
                 [_ev("C", "acceleration", a, max(0.06, 0.012 * a), "m/s^2"), _ev("C", "speed", v, max(0.06, 0.012 * v), "m/s")],
                 ("Newton's second law along an incline with kinetic friction, a free-body diagram, and a justified prediction about the effect of mass", ["Draw the free-body diagram of the block on the incline", "Resolve the weight and write Newton's second law along and perpendicular to the incline", "Predict whether the mass changes the time using the derived relationship"],
                  [("the block slides down so kinetic friction acts up the incline", "the stimulus states the block is released from rest, slides down, and gives the kinetic friction coefficient")], {"type": "diagram", "must_include": ["incline angle", "mass", "friction coefficient"]},
                  "sympy solves the two Newton equations; an RK4 integration of the motion along the incline recomputes the speed after the distance d"),
                 ["representation_reading", "law_selection", "justification"])


# ======================= MR (10): 마찰 구간에서 멈추는 블록(에너지) =======================
def phf_mr_energy_patch(rng):
    for _ in forever():
        h = pick(rng, [0.8, 1.0, 1.5, 2.0, 2.5]); mu = pick(rng, [0.20, 0.25, 0.40, 0.50]); m = pick(rng, [0.5, 1.0, 2.0])
        H_, MU_, GG, d_ = sp.Rational(str(h)), sp.Rational(str(mu)), sp.Rational(str(G)), sp.symbols("d", positive=True)
        sol = sp.solve(sp.Eq(MU_ * GG * d_, GG * H_), d_)[0]   # 질량이 약분된 일–에너지식 μ g d = g h
        d = float(sol)
        # 독립 경로: 트랙 바닥 속력으로 시작해 마찰 감속(μ g)을 RK4 로 적분, 멈출 때까지의 거리
        vb = math.sqrt(2 * G * h)
        y = np.array([0.0, vb]); t = 0.0; dt = 1e-4
        while y[1] > 0:
            y = rk4(lambda tt, s: np.array([s[1], -mu * G]), y, t, t + dt, 1); t += dt
        agree(d, y[0], 5e-3, "d")
        if 2.0 <= d <= 10.0:
            break
    E = m * G * h
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ is released from rest at a height $h={h:g}\\text{{ m}}$ above a horizontal floor on a smooth, frictionless curved track. At the bottom of the track the block slides onto a rough horizontal section whose coefficient of kinetic friction is $\\mu={mu:g}$. The rough section is long enough that the block comes to rest on it. Blank energy bar chart templates (one per state, with a common scale) are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "In the energy bar charts below, for each of three states (the block at the release point, the block at the bottom of the track just before the rough section, and the block at rest on the rough section), draw bars for the kinetic energy $K$, the gravitational potential energy $U_g$ (zero at the floor), and the energy dissipated by friction as thermal energy $E_{th}$. Use the same scale in each chart.", 3, "diagram", ["1.A", "1.C"],
             f"At the release point: $U_g=mgh={E:.2f}\\text{{ J}}$, $K=0$, $E_{{th}}=0$. At the bottom: $K={E:.2f}\\text{{ J}}$, $U_g=0$. At rest on the rough section: $K=0$, $U_g=0$, and $E_{{th}}={E:.2f}\\text{{ J}}$.",
             [R("A1", "diagram", "Shows only $U_g$ (no $K$ and no $E_{th}$) at the release point", ["Ug only", "K = 0"], err=["shows kinetic energy at the release point"]),
              R("A2", "diagram", "Shows $K$ equal in height to the initial $U_g$ with $U_g=0$ and $E_{th}=0$ at the bottom of the track", ["K = initial Ug", "Ug = 0", "Eth = 0"], err=["shows thermal energy on the frictionless track"]),
              R("A3", "diagram", "Shows $K=0$, $U_g=0$, and $E_{th}$ equal in height to the initial $U_g$ when the block is at rest", ["Eth = initial Ug", "K = 0"], err=["shows the thermal energy smaller than the initial potential energy"])]),
        part("B", "Derive an expression for the distance $d$ the block slides on the rough section before it stops in terms of $h$, $\\mu$, and fundamental constants.", 3, "derive", ["2.A"],
             "Energy conservation on the track gives $mgh=\\tfrac12mv^2$; the work of friction on the rough section removes it all, $\\mu mgd=\\tfrac12mv^2$. Together $\\mu mgd=mgh$ so $d=h/\\mu$.",
             [R("B1", "expression", "Uses conservation of energy on the track: $mgh=\\tfrac12mv^2$ (or $v=\\sqrt{2gh}$) at the bottom", ["m g h = 1/2 m v^2"], err=["uses mgh = mv"]),
              R("B2", "expression", "Equates the work done by friction to the kinetic energy lost on the rough section: $\\mu mgd=\\tfrac12mv^2$", ["mu m g d = 1/2 m v^2"], err=["omits the normal force in the friction work", "uses a net force without the displacement"]),
              R("B3", "expression", "Combines the equations to the correct expression $d=h/\\mu$", ["h / mu"], requires="B2", err=["leaves the mass in the final expression"])]),
        part("C", f"Calculate the numerical value of $d$ for $h={h:g}\\text{{ m}}$ and $\\mu={mu:g}$.", 2, "calculate", ["2.B"],
             f"$d=h/\\mu={h:g}/{mu:g}={d:.2f}\\text{{ m}}$.",
             [R("C1", "numeric", f"Calculates the distance (about {d:.2f})", [f"{d:.2f}"], requires="B3", nums=True, err=["uses a wrong energy"]),
              R("C2", "numeric", "Reports the value with correct units of meters", ["m"], units=True, requires="C1")]),
        part("D", "The block is released from twice the height $2h$ on the same track and the same rough section. By what factor does the distance the block slides on the rough section change? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             "The distance doubles. From $d=h/\\mu$ the distance is proportional to $h$ (the mass cancels), or equivalently the block starts with twice the energy and the same friction force removes it.",
             [R("D1", "claim", "States that the distance increases by a factor of 2", ["factor of 2", "doubles"], nums=True, err=["states the distance increases by a factor of 4 because the speed squared doubles"]),
              R("D2", "justification", "Justifies with $d\\propto h$ from the derived expression, or with twice the initial energy removed by the same friction force", ["d proportional to h", "twice the energy same friction force"], requires="D1", err=["argues only that the block moves faster"])]),
    ]
    return _pack("phf_mr_energy_patch", "mr", "3.4", ["3.2", "3.3", "2.7"], "2.B", "Block released from a height that stops on a rough section", stim, parts, 10, 22, [f"h={h}", f"mu={mu}", f"m={m}", f"d={d:.4f}", f"E={E:.4f}"],
                 [_ev("C", "stopping distance", d, max(0.04, 0.012 * d), "m")],
                 ("Conservation of energy and the work-energy theorem with friction, energy bar charts, and a justified proportional prediction", ["Represent the energy of the block in three states", "Combine energy conservation on the track with the work done by friction", "Predict the effect of doubling the release height using the derived relationship"],
                  [("the track is frictionless and the rough section is horizontal so friction is the only dissipative force", "the stimulus states a smooth frictionless track and a horizontal rough section")], {"type": "text", "must_include": ["mass", "height", "friction coefficient"]},
                  "sympy solves the work-energy equation; an RK4 integration of the deceleration on the rough section recomputes the stopping distance from the speed at the bottom"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 세 구간 수레 운동 v–t =======================
def phf_tbr_cart_vt(rng):
    for _ in forever():
        a1 = pick(rng, [1.0, 1.5, 2.0]); t1 = pick(rng, [3.0, 4.0, 5.0]); t2 = pick(rng, [4.0, 5.0, 6.0]); t3 = pick(rng, [2.0, 3.0, 4.0]); dT = pick(rng, [2.0, 3.0, 4.0])
        vm = a1 * t1; a3 = vm / t3
        x_exact = float(Fr(str(vm)) * (Fr(str(t1)) / 2 + Fr(str(t2)) + Fr(str(t3)) / 2))
        # 독립: 조각선형 속도를 촘촘히 표본화해 사다리꼴 적분
        ts = np.linspace(0, t1 + t2 + t3, 12001)
        vs = np.interp(ts, [0, t1, t1 + t2, t1 + t2 + t3], [0, vm, vm, 0])
        x_num = float(np.sum((vs[1:] + vs[:-1]) / 2 * np.diff(ts)))
        agree(x_exact, x_num, 1e-5, "x")
        break
    inc = vm * dT; T = t1 + t2 + t3
    stim = {"kind": "text", "description": f"A cart moves along a straight horizontal track. Starting from rest, it speeds up uniformly with acceleration $a_1={a1:g}\\text{{ m/s}}^2$ for $t_1={t1:g}\\text{{ s}}$, then moves at constant velocity for $t_2={t2:g}\\text{{ s}}$, and then slows down uniformly to a stop in $t_3={t3:g}\\text{{ s}}$. The cart moves in the positive direction the whole time. Blank axes for the graphs are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the velocity $v$ of the cart as a function of time $t$ for the whole trip. Label the axes with quantities and units and label the key values of velocity and time.", 4, "graph", ["1.A", "1.C"],
             f"A straight line from the origin up to $v={vm:.2f}\\text{{ m/s}}$ at $t={t1:g}\\text{{ s}}$, a horizontal line at that velocity until $t={t1 + t2:g}\\text{{ s}}$, and a straight line down to zero at $t={T:g}\\text{{ s}}$.",
             [R("A1", "graph", "Both axes are labeled with quantities and units and a scale is shown", ["axis labels", "units"], err=["omits units"]),
              R("A2", "graph", f"Draws a straight line from the origin rising to about ${vm:.2f}\\text{{ m/s}}$ at $t={t1:g}\\text{{ s}}$", [f"{vm:.2f}", f"{t1:g}"], nums=True, err=["draws a curve instead of a straight line for uniform acceleration"]),
              R("A3", "graph", f"Draws a horizontal segment at the same velocity from $t={t1:g}\\text{{ s}}$ to $t={t1 + t2:g}\\text{{ s}}$", [f"{t1 + t2:g}"], nums=True, err=["draws the constant-velocity segment with a slope"]),
              R("A4", "graph", f"Draws a straight line down to zero velocity at $t={T:g}\\text{{ s}}$", [f"{T:g}"], nums=True, err=["ends the graph below zero velocity"])]),
        part("B", "Determine the total displacement of the cart during the whole trip. Show how you use your graph from part A.", 3, "calculate", ["2.A", "2.B"],
             f"The displacement is the area under the $v$–$t$ graph: $x=\\tfrac12({vm:.2f})({t1:g})+({vm:.2f})({t2:g})+\\tfrac12({vm:.2f})({t3:g})\\approx {x_exact:.1f}\\text{{ m}}$.",
             [R("B1", "expression", "Identifies the displacement as the area under the velocity-time graph", ["displacement is the area under the v-t graph"], err=["uses the slope of the graph"]),
              R("B2", "expression", "Adds the areas of the triangle, the rectangle, and the second triangle: $\\tfrac12vt_1+vt_2+\\tfrac12vt_3$", ["1/2 v t1 + v t2 + 1/2 v t3"], requires="B1", err=["omits one of the three areas", "treats the triangles as rectangles"]),
              R("B3", "numeric", f"Calculates a total displacement of about {x_exact:.1f} with units of meters", [f"{x_exact:.1f}", "m"], requires="B2", nums=True, units=True, err=["uses the average velocity of only the first segment"])]),
        part("C", "On the axes provided, sketch the acceleration $a$ of the cart as a function of time $t$ for the whole trip. Label the axes with quantities and units and label the key values of acceleration.", 3, "graph", ["1.A", "1.C"],
             f"A horizontal segment at $+{a1:g}\\text{{ m/s}}^2$ from $0$ to ${t1:g}\\text{{ s}}$, zero from ${t1:g}\\text{{ s}}$ to ${t1 + t2:g}\\text{{ s}}$, and a horizontal segment at $-{a3:.2f}\\text{{ m/s}}^2$ from ${t1 + t2:g}\\text{{ s}}$ to ${T:g}\\text{{ s}}$.",
             [R("C1", "graph", "Both axes are labeled with quantities and units and the segments are horizontal (constant acceleration in each interval)", ["axis labels", "units", "horizontal segments"], err=["draws sloped segments"]),
              R("C2", "graph", f"Shows a positive acceleration of ${a1:g}\\text{{ m/s}}^2$ for the first interval and zero acceleration for the second interval", [f"{a1:g}", "zero"], nums=True, err=["shows nonzero acceleration while the velocity is constant"]),
              R("C3", "graph", f"Shows a negative acceleration of about ${a3:.2f}\\text{{ m/s}}^2$ for the third interval", [f"{a3:.2f}", "negative"], nums=True, err=["shows the braking acceleration as positive"])]),
        part("D", f"The constant-velocity segment is made ${dT:g}\\text{{ s}}$ longer while everything else about the trip is unchanged. By how much does the total displacement change? Justify your answer using your velocity-time graph from part A.", 2, "explain", ["2.D", "3.B"],
             f"The displacement increases by $v\\Delta t={vm:.2f}\\times{dT:g}={inc:.1f}\\text{{ m}}$, because the added area under the graph is a rectangle of height $v={vm:.2f}\\text{{ m/s}}$ and width ${dT:g}\\text{{ s}}$ and the other two areas do not change.",
             [R("D1", "numeric", f"States that the displacement increases by about {inc:.1f} with units of meters", [f"{inc:.1f}", "increases"], nums=True, err=["states the displacement does not change because the velocity is constant"]),
              R("D2", "justification", "Justifies that the extra area under the graph is a rectangle of height equal to the constant velocity, with the other areas unchanged", ["added rectangle of height v and width delta t"], requires="D1", err=["argues only that the cart travels farther"])]),
    ]
    return _pack("phf_tbr_cart_vt", "tbr", "1.3", ["1.2"], "1.A", "Cart motion in three stages: v-t and a-t graphs", stim, parts, 12, 27, [f"a1={a1}", f"t1={t1}", f"t2={t2}", f"t3={t3}", f"dT={dT}", f"vm={vm:.4f}", f"x={x_exact:.4f}", f"a3={a3:.4f}"],
                 [_ev("B", "total displacement", x_exact, max(0.1, 0.01 * x_exact), "m"), _ev("D", "added displacement", inc, max(0.05, 0.01 * inc), "m")],
                 ("Translating a verbal description of three stages of motion into velocity-time and acceleration-time graphs and using the area to find the displacement", ["Represent the motion as a velocity-time graph", "Use the area under the graph to find the displacement", "Represent the same motion as an acceleration-time graph and predict a change in the displacement"],
                  [("the acceleration is constant in each stage and the cart moves in one direction", "the stimulus states uniform speeding up and slowing down and positive direction throughout")], {"type": "text", "must_include": ["acceleration", "durations of the three stages"]},
                  "the displacement is computed from exact fractions of the three areas and recomputed by trapezoid integration of a densely sampled piecewise linear velocity"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 수직으로 던진 공의 에너지 =======================
def phf_tbr_vertical_toss(rng):
    for _ in forever():
        m = pick(rng, [0.20, 0.50, 1.0]); v0 = pick(rng, [6.0, 8.0, 10.0, 12.0])
        E = 0.5 * m * v0 ** 2; hmax = v0 ** 2 / (2 * G)
        # 독립: RK4 로 꼭대기(속도 0)까지 적분해 높이와 에너지 보존을 확인
        y = np.array([0.0, v0]); t = 0.0; dt = 1e-4
        while y[1] > 0:
            y = rk4(lambda tt, s: np.array([s[1], -G]), y, t, t + dt, 1); t += dt
        agree(hmax, y[0], 5e-3, "hmax"); agree(E, m * G * y[0], 5e-3, "E")
        break
    stim = {"kind": "text", "description": f"A ball of mass $m={m:g}\\text{{ kg}}$ is thrown straight up from the ground with an initial speed $v_0={v0:g}\\text{{ m/s}}$. Air resistance is negligible. Take the gravitational potential energy $U_g$ to be zero at the ground. Blank energy bar chart templates (one per state, with a common scale) and blank axes for the graph are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "In the energy bar charts below, for each of three states (the ball at the instant it is thrown, the ball halfway to its maximum height, and the ball at its maximum height), draw bars for the kinetic energy $K$ and the gravitational potential energy $U_g$. Use the same scale in each chart so that the total energy has the same height in each state.", 3, "diagram", ["1.A", "1.C"],
             f"When thrown: $K=E$, $U_g=0$. Halfway up: $K=U_g=E/2$. At the top: $K=0$, $U_g=E$. The total $E=\\tfrac12mv_0^2={E:.2f}\\text{{ J}}$ in every state.",
             [R("A1", "diagram", "Shows all of the energy as $K$ and $U_g=0$ when the ball is thrown", ["K = total", "Ug = 0"], err=["shows potential energy at the ground"]),
              R("A2", "diagram", "Shows $K=0$ and all of the energy as $U_g$ at the maximum height", ["K = 0", "Ug = total"], err=["shows kinetic energy at the top"]),
              R("A3", "diagram", "Shows $K$ and $U_g$ equal to each other, each half of the total, halfway to the top, with the same total bar height", ["K = Ug = E/2"], err=["splits the energy unevenly at half height"])]),
        part("B", "Derive an expression for the kinetic energy $K$ of the ball as a function of its height $h$ above the ground in terms of $m$, $v_0$, $g$, and $h$.", 2, "derive", ["2.A"],
             "Energy is conserved, so $K+mgh=\\tfrac12mv_0^2$ and $K=\\tfrac12mv_0^2-mgh$.",
             [R("B1", "expression", "Applies conservation of energy: $K+U_g=\\tfrac12mv_0^2$ with $U_g=mgh$", ["K + m g h = 1/2 m v0^2"], err=["omits the potential energy term"]),
              R("B2", "expression", "Solves for $K=\\tfrac12mv_0^2-mgh$", ["1/2 m v0^2 - m g h"], requires="B1", err=["adds the potential energy"])]),
        part("C", f"On the axes provided, sketch $K$ and $U_g$ as functions of the height $h$ from the ground up to the maximum height, for $m={m:g}\\text{{ kg}}$ and $v_0={v0:g}\\text{{ m/s}}$. Label both axes with quantities and units, and label the intercepts and the maximum height.", 4, "graph", ["1.A", "1.C"],
             f"$K$ is a straight line falling from ${E:.2f}\\text{{ J}}$ at $h=0$ to zero at $h_{{max}}={hmax:.2f}\\text{{ m}}$; $U_g$ is a straight line rising from zero to ${E:.2f}\\text{{ J}}$ over the same range; the lines cross at $h={hmax / 2:.2f}\\text{{ m}}$.",
             [R("C1", "graph", "Both axes are labeled with quantities and units and the scale is shown", ["axis labels", "units"], err=["omits units"]),
              R("C2", "graph", f"Draws $K$ as a straight line decreasing from about ${E:.2f}\\text{{ J}}$ at $h=0$ to zero at the maximum height", [f"{E:.2f}", "straight decreasing line"], nums=True, err=["draws $K$ as a curve that starts at zero"]),
              R("C3", "graph", f"Marks the maximum height as about ${hmax:.2f}\\text{{ m}}$, where $K=0$", [f"{hmax:.2f}"], nums=True, err=["marks the maximum height at the wrong value"]),
              R("C4", "graph", f"Draws $U_g$ as a straight line increasing from zero at $h=0$ to about ${E:.2f}\\text{{ J}}$ at the maximum height, crossing the $K$ line halfway up", ["Ug increasing line", "crosses K at half height"], nums=True, err=["draws $U_g$ decreasing"])]),
        part("D", "The ball is instead thrown with twice the initial speed $2v_0$. Predict how the maximum height and the initial kinetic energy change, and justify your prediction.", 3, "explain", ["2.D", "3.B", "3.C"],
             "The initial kinetic energy increases by a factor of four and so does the maximum height, because $\\tfrac12m(2v_0)^2=4\\left(\\tfrac12mv_0^2\\right)$ and all of this energy becomes $mgh_{max}$, so $h_{max}=v_0^2/2g$ is proportional to $v_0^2$.",
             [R("D1", "claim", "States that the initial kinetic energy increases by a factor of 4", ["factor of 4", "kinetic energy"], nums=True, err=["states the energy only doubles"]),
              R("D2", "claim", "States that the maximum height increases by a factor of 4", ["factor of 4", "maximum height"], nums=True, err=["states the maximum height doubles"]),
              R("D3", "justification", "Justifies with energy conservation: all of the initial kinetic energy becomes $mgh_{max}$, so $h_{max}\\propto v_0^2$", ["Ug at top equals initial K", "h proportional to v0 squared"], requires="D1", err=["argues only that a faster ball goes higher"])]),
    ]
    return _pack("phf_tbr_vertical_toss", "tbr", "3.4", ["3.3", "3.1", "1.2"], "1.A", "Ball thrown straight up: energy bars and graph", stim, parts, 12, 27, [f"m={m}", f"v0={v0}", f"E={E:.4f}", f"hmax={hmax:.4f}"],
                 [_ev("C", "initial kinetic energy", E, max(0.03, 0.01 * E), "J"), _ev("C", "maximum height", hmax, max(0.03, 0.01 * hmax), "m")],
                 ("Representing energy transformations of a ball in vertical flight with bar charts and linear graphs, deriving the kinetic energy as a function of height, and predicting a change", ["Represent the energy of the ball in three states", "Derive the kinetic energy as a function of height and sketch both energies against height", "Predict how the maximum height changes for a faster throw with justification"],
                  [("air resistance is negligible so mechanical energy is conserved", "the stimulus states that air resistance is negligible")], {"type": "text", "must_include": ["mass", "initial speed"]},
                  "an RK4 simulation of the vertical flight recomputes the maximum height and the conserved energy; the bar and graph values are recomputed from the closed forms"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 진자로 중력 가속도 =======================
def phf_lab_pendulum_g(rng):
    Ls = [0.20, 0.40, 0.60, 0.80, 1.00]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); gtrue = pick(rng, [9.8, 9.8, 9.7, 9.9])
        Ts = [round(2 * math.pi * math.sqrt(L / gtrue) * (1 + r2.uniform(-0.015, 0.015)), 3) for L in Ls]
        T2 = [round(t * t, 4) for t in Ts]
        slope, icpt = np.polyfit(Ls, T2, 1); g_est = 4 * math.pi ** 2 / slope
        X = np.array([[L, 1.0] for L in Ls]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(T2))
        agree(slope, beta[0], 1e-9, "slope")
        if abs(g_est - 9.8) / 9.8 < 0.04:
            break
    stim = {"kind": "table", "description": "A student measures the period $T$ of a small, dense bob hanging from a light string of length $L$ (measured from the pivot to the center of the bob), swinging through a small angle. The student wants to determine the gravitational field strength $g$ at the lab location.", "data": {"x_label": "Length L (m)", "y_label": "Period T (s)", "rows": [[L, t] for L, t in zip(Ls, Ts)]}}
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the period as a function of length. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured period.", 3, "design", ["3.A", "2.B"],
             "Use a meterstick to measure the length from the pivot to the center of the bob for each trial and a stopwatch to time 10 swings, released from the same small angle each time; change only the string length, and divide the time by 10; repeat the timing and average.",
             [R("A1", "design", "Identifies the measured quantities and equipment: a meterstick or ruler for the length and a timing device for the period (both are needed)", ["a way to measure the length and a way to time the motion"], err=["omits how the period is measured"]),
              R("A2", "design", "Changes only the length of the string while keeping the same bob and the same small release angle (both conditions are needed)", ["change only the length and keep the same small release angle"]),
              R("A3", "design", "Reduces timing uncertainty by timing many swings and dividing, or by repeating the trials and averaging (either earns the point)", ["time many swings or repeat trials (either earns the point)"])]),
        part("B", "Using the relationship between the period of a pendulum, its length, and the gravitational field strength from the reference information, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $g$.", 1, "explain", ["2.B", "3.A"],
             "Plot $T^2$ on the vertical axis against $L$ on the horizontal axis; the slope is $4\\pi^2/g$.",
             [R("B1", "expression", "Identifies $T^2$ (vertical) versus $L$ (horizontal)", ["T squared versus L"], err=["plots T versus L"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(L,T^2)$: {', '.join(f'({L:g}, {t:.3f})' for L, t in zip(Ls, T2))} with a best-fit line of slope about ${slope:.2f}\\text{{ s}}^2/\\text{{m}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(L, T^2)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the gravitational field strength $g$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"Slope $\\approx {slope:.2f}\\text{{ s}}^2/\\text{{m}}$, so $g=4\\pi^2/\\text{{slope}}\\approx {g_est:.1f}\\text{{ N/kg}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} s^2/m; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to the gravitational field strength: slope $=4\\pi^2/g$", ["slope = 4 pi^2 / g"], err=["uses slope = g"]),
              R("D3", "numeric", f"Calculates $g$ (about {g_est:.1f}; accept any value within 8 percent) with units of newtons per kilogram or meters per second squared", [f"{g_est:.1f}", "N/kg or m/s^2"], alt=["a value of g consistent with the student's own slope from D1, $g=4\\pi^2/\\text{slope}$"], nums=True, units=True)]),
    ]
    return _pack("phf_lab_pendulum_g", "lab", "7.2", ["7.1"], "3.A", "Experiment: gravitational field strength from a pendulum", stim, parts, 10, 27, [f"gtrue={gtrue}", f"slope={slope:.4f}", f"g_est={g_est:.2f}", f"Ts={Ts}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "s^2/m"), _ev("D", "gravitational field strength", g_est, 0.08 * g_est, "N/kg")],
                 ("Designing an experiment and analyzing linearized data to extract the gravitational field strength", ["Describe the measurements and how uncertainty is reduced", "Linearize the pendulum relationship and plot the data", "Use the slope to determine g"],
                  [("the generated periods follow $T=2\\pi\\sqrt{L/g}$ with a small random error so the best-fit slope is within a few percent of $4\\pi^2/g$", "the code rejects a seed whose fitted g differs from 9.8 by more than four percent")], {"type": "table", "must_include": ["length", "period"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted g is compared with the reference value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= LAB (10): 미끄럼 정지 거리로 마찰 계수 =======================
def phf_lab_sliding_friction(rng):
    v0s = [1.0, 1.5, 2.0, 2.5, 3.0]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); mu = pick(rng, [0.20, 0.25, 0.30, 0.40])
        ds = [round(v * v / (2 * mu * G) * (1 + r2.uniform(-0.015, 0.015)), 3) for v in v0s]
        v2 = [v * v for v in v0s]
        slope, icpt = np.polyfit(v2, ds, 1); mu_est = 1 / (2 * G * slope)
        X = np.array([[x, 1.0] for x in v2]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(ds))
        agree(slope, beta[0], 1e-9, "slope")
        if abs(mu_est - mu) / mu < 0.04:
            break
    stim = {"kind": "table", "description": "A student gives a block a range of initial speeds $v_0$ along a level, rough table, measures the initial speed with a photogate, and measures the distance $d$ the block slides before it stops. The block and the table surface are the same in every trial.", "data": {"x_label": "Initial speed v0 (m/s)", "y_label": "Stopping distance d (m)", "rows": [[v, d] for v, d in zip(v0s, ds)]}}
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the stopping distance as a function of the initial speed. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured distance.", 3, "design", ["3.A", "2.B"],
             "Use a photogate (or motion sensor) to measure the initial speed and a meterstick to measure the sliding distance from the starting point to where the block stops; give the same block different initial speeds on the same table surface, and repeat each trial and average the distances.",
             [R("A1", "design", "Identifies a way to measure the initial speed (photogate or motion sensor, or distance and time over a short interval) and a way to measure the stopping distance (meterstick or tape)", ["a way to measure the initial speed and a way to measure the stopping distance"], err=["omits how the speed is measured"]),
              R("A2", "design", "Changes only the initial speed while using the same block and the same table surface (both conditions are needed)", ["change only the initial speed with the same block and surface"]),
              R("A3", "design", "Reduces the uncertainty in the distance by repeating each trial and averaging, or by marking the stopping point with a method that reduces the reading error (either earns the point)", ["repeat and average or reduce the reading error (either earns the point)"])]),
        part("B", "Using the work-energy relationship for a block sliding to rest on a level surface with constant kinetic friction, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find the coefficient of kinetic friction $\\mu$.", 1, "explain", ["2.B", "3.A"],
             "From $\\mu mgd=\\tfrac12mv_0^2$ we get $d=\\dfrac{1}{2\\mu g}v_0^2$: plot $d$ on the vertical axis against $v_0^2$ on the horizontal axis; the slope is $1/(2\\mu g)$.",
             [R("B1", "expression", "Identifies $d$ (vertical) versus $v_0^2$ (horizontal)", ["d versus v0 squared"], err=["plots d versus v0"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(v_0^2,d)$: {', '.join(f'({x:g}, {d:.3f})' for x, d in zip(v2, ds))} with a best-fit line of slope about ${slope:.3f}\\text{{ s}}^2/\\text{{m}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(v_0^2, d)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the coefficient of kinetic friction $\\mu$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"Slope $\\approx {slope:.3f}\\text{{ s}}^2/\\text{{m}}$, so $\\mu=\\dfrac{{1}}{{2g\\,\\text{{slope}}}}\\approx {mu_est:.2f}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.3f} s^2/m; accept any value within 5 percent)", [f"{slope:.3f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to the friction coefficient: slope $=1/(2\\mu g)$", ["slope = 1 / (2 mu g)"], err=["uses slope = mu"]),
              R("D3", "numeric", f"Calculates $\\mu$ (about {mu_est:.2f}; accept any value within 8 percent); the coefficient has no units", [f"{mu_est:.2f}"], alt=["a value of mu consistent with the student's own slope from D1, $\\mu=1/(2g\\,\\text{slope})$"], nums=True)]),
    ]
    return _pack("phf_lab_sliding_friction", "lab", "3.2", ["2.7", "3.1"], "3.A", "Experiment: kinetic friction coefficient from stopping distances", stim, parts, 10, 27, [f"mu={mu}", f"slope={slope:.5f}", f"mu_est={mu_est:.3f}", f"ds={ds}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "s^2/m"), _ev("D", "coefficient of kinetic friction", mu_est, 0.08 * mu_est, "")],
                 ("Designing an experiment and analyzing linearized data to extract a coefficient of kinetic friction from the work-energy theorem", ["Describe the measurements and how uncertainty is reduced", "Linearize the work-energy relationship and plot the data", "Use the slope to determine the friction coefficient"],
                  [("the generated stopping distances follow $d=v_0^2/(2\\mu g)$ with a small random error so the best-fit slope is within a few percent of $1/(2\\mu g)$", "the code rejects a seed whose fitted coefficient differs from the generating coefficient by more than four percent")], {"type": "table", "must_include": ["initial speed", "stopping distance"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted coefficient is compared with the generating coefficient"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 평평한 커브를 도는 자동차 =======================
def phf_qqt_flat_curve(rng):
    for _ in forever():
        m = pick(rng, [1000.0, 1200.0, 1500.0]); r = pick(rng, [40.0, 50.0, 60.0, 80.0]); mu = pick(rng, [0.5, 0.6, 0.7, 0.8])
        vs_ = sp.symbols("v", positive=True)
        vmax = float(sp.solve(sp.Eq(sp.Rational(str(m)) * vs_ ** 2 / sp.Rational(str(r)), sp.Rational(str(mu)) * sp.Rational(str(m)) * sp.Rational(str(G))), vs_)[0])
        vb = bisect(lambda v: m * v * v / r - mu * m * G, 0.0, 100.0)  # 독립: 필요한 구심력이 최대 정지 마찰과 같아지는 속력
        agree(vmax, vb, 1e-6, "vmax")
        break
    stim = {"kind": "text", "description": f"A car of mass $m={m:g}\\text{{ kg}}$ drives at a constant speed around a flat, unbanked circular curve of radius $r={r:g}\\text{{ m}}$. The coefficient of static friction between the tires and the road is $\\mu_s={mu:g}$. A student claims that if the car's speed is doubled, the friction force needed to keep the car on the curve is also doubled.", "data": {}}
    parts = [
        part("A", "Do you agree or disagree with the student's claim? Justify your answer qualitatively without calculating numbers.", 3, "explain", ["3.B", "3.C"],
             "Disagree. The friction force from the road is the net force toward the center of the circle and must equal $mv^2/r$, which depends on the square of the speed, so doubling the speed requires more than double the friction force.",
             [R("A1", "claim", "Disagrees with the claim (the required friction force more than doubles)", ["disagree"], err=["agrees because force is proportional to speed"]),
              R("A2", "justification", "Justifies by identifying the friction force as the net force toward the center that provides the centripetal acceleration", ["friction provides the centripetal force"], requires="A1", err=["says an outward force balances friction"]),
              R("A3", "justification", "Justifies by relating the required force to the square of the speed, $mv^2/r$, so the force changes faster than the speed", ["force depends on speed squared"], requires="A1", err=["says the force depends on speed to the first power"])]),
        part("B", f"Derive an expression for the maximum speed $v_{{max}}$ at which the car can go around the curve without sliding in terms of $\\mu_s$, $r$, and fundamental constants, and calculate its value for $\\mu_s={mu:g}$ and $r={r:g}\\text{{ m}}$.", 3, "derive", ["2.A", "3.B"],
             f"At the limit the maximum static friction supplies the centripetal force: $\\mu_smg=mv_{{max}}^2/r$, so $v_{{max}}=\\sqrt{{\\mu_sgr}}=\\sqrt{{({mu:g})(9.8)({r:g})}}\\approx {vmax:.1f}\\text{{ m/s}}$.",
             [R("B1", "expression", "Writes the centripetal requirement for the friction force: $f=mv^2/r$", ["f = m v^2 / r"], err=["uses f = mv/r"]),
              R("B2", "expression", "Uses the maximum static friction $\\mu_sN$ with $N=mg$ on a flat road and sets $\\mu_smg=mv_{max}^2/r$", ["mu m g = m v^2 / r"], requires="B1", err=["uses the weight with no friction coefficient"]),
              R("B3", "numeric", f"Solves for $v_{{max}}=\\sqrt{{\\mu_sgr}}$ and calculates about {vmax:.1f} with units of meters per second", [f"{vmax:.1f}", "m/s"], requires="B2", nums=True, units=True, err=["leaves the mass in the final expression"])]),
        part("C", "The car is now loaded with cargo so that its mass doubles, and the road and the tires are unchanged. Predict whether the maximum speed at which the car can safely go around the curve increases, decreases, or stays the same, and justify your prediction.", 2, "explain", ["2.D", "3.C"],
             "The maximum speed stays the same. The mass cancels in $\\mu_smg=mv_{max}^2/r$, because the largest available friction force and the force required both increase in proportion to the mass.",
             [R("C1", "claim", "States that the maximum speed stays the same", ["stays the same"], err=["states a heavier car needs a lower speed"]),
              R("C2", "justification", "Justifies that the mass cancels in the expression for the maximum speed (the friction capacity and the required force both scale with the mass)", ["mass cancels"], requires="C1", err=["argues only that heavier cars are harder to stop"])]),
    ]
    return _pack("phf_qqt_flat_curve", "qqt", "2.9", ["2.7", "2.5"], "3.B", "Claim about the friction force needed on a flat curve", stim, parts, 8, 17, [f"m={m}", f"r={r}", f"mu={mu}", f"vmax={vmax:.4f}"],
                 [_ev("B", "maximum speed", vmax, max(0.06, 0.01 * vmax), "m/s")],
                 ("Evaluating a claim about the friction force in circular motion on a flat road with a derivation of the maximum speed and a prediction about mass", ["Decide what provides the centripetal force and how it depends on speed", "Derive the maximum speed from the maximum static friction", "Predict the effect of doubling the mass using the derived relationship"],
                  [("the car moves at constant speed on a flat road so static friction alone provides the centripetal force", "the stimulus states a flat unbanked curve and static friction between the tires and the road")], {"type": "text", "must_include": ["mass", "radius", "friction coefficient"]},
                  "sympy solves the centripetal-force condition; a bisection root finder on the difference between the required force and the maximum static friction recomputes the maximum speed"),
                 ["justification", "symbolic_reasoning"])


# ======================= QQT (8): 물에 뜨는 나무 블록 =======================
def phf_qqt_floating_block(rng):
    for _ in forever():
        rb = pick(rng, [600.0, 700.0, 800.0, 900.0]); rs = pick(rng, [1200.0, 1250.0, 1300.0]); rw = 1000.0
        f1 = rb / rw; f2 = rb / rs
        Vs = sp.symbols("Vs", positive=True)
        f2_sym = float(sp.solve(sp.Eq(sp.Rational(str(rs)) * Vs * sp.Rational(str(G)), sp.Rational(str(rb)) * sp.Rational(str(G))), Vs)[0])
        f2_num = bisect(lambda x: rs * x * G - rb * 1.0 * G, 0.0, 1.0)  # 독립: 잠긴 부피 분율에 대한 힘의 균형 잔차의 근
        agree(f2, f2_sym, 1e-9, "f2"); agree(f2, f2_num, 1e-6, "f2num")
        break
    stim = {"kind": "text", "description": f"A uniform wooden block of density $\\rho_b={rb:g}\\text{{ kg/m}}^3$ floats at rest in fresh water of density $\\rho_w={rw:g}\\text{{ kg/m}}^3$ with part of its volume under the surface. The block is then moved to a tank of salt solution of density $\\rho_s={rs:g}\\text{{ kg/m}}^3$ and floats at rest there. A student claims that the block floats lower in the salt solution, with a larger fraction of its volume submerged, because the denser liquid is heavier.", "data": {}}
    parts = [
        part("A", "Do you agree or disagree with the student's claim? Justify your answer qualitatively without calculating numbers.", 3, "explain", ["3.B", "3.C"],
             "Disagree. In both liquids the block floats at rest, so the buoyant force equals its weight, which does not change. The buoyant force is $\\rho_{fluid}V_{sub}g$, so a denser liquid needs a smaller submerged volume to supply the same force.",
             [R("A1", "claim", "Disagrees with the claim (less of the block is submerged in the denser liquid)", ["disagree"], err=["agrees because the denser liquid pushes harder"]),
              R("A2", "justification", "Justifies by stating that the block floats at rest in both liquids, so the buoyant force equals the block's weight in both (the same force)", ["buoyant force equals the weight in both"], requires="A1", err=["says the buoyant force is larger in the denser liquid"]),
              R("A3", "justification", "Justifies by relating the buoyant force to the fluid density and the submerged volume, $\\rho_{fluid}V_{sub}g$, so a larger density means a smaller submerged volume", ["denser liquid smaller submerged volume"], requires="A1", err=["says the submerged volume does not depend on the liquid"])]),
        part("B", f"Derive an expression for the fraction of the block's volume that is submerged in a liquid of density $\\rho$ in terms of $\\rho_b$ and $\\rho$, and calculate the fraction submerged in the salt solution of density $\\rho_s={rs:g}\\text{{ kg/m}}^3$.", 3, "derive", ["2.A", "3.B"],
             f"At rest the weight equals the buoyant force, $\\rho_bVg=\\rho V_{{sub}}g$, so $V_{{sub}}/V=\\rho_b/\\rho$. In the salt solution this is ${rb:g}/{rs:g}\\approx {f2:.3f}$.",
             [R("B1", "expression", "Sets the weight equal to the buoyant force for the floating block: $\\rho_bVg=\\rho V_{sub}g$", ["rho_b V g = rho V_sub g"], err=["sets the buoyant force equal to the mass without g"]),
              R("B2", "expression", "Solves for the submerged fraction $V_{sub}/V=\\rho_b/\\rho$", ["rho_b / rho"], requires="B1", err=["inverts the density ratio"]),
              R("B3", "numeric", f"Calculates the fraction in the salt solution (about {f2:.3f}; a fraction between 0 and 1 has no units)", [f"{f2:.3f}"], requires="B2", nums=True, err=["uses the density of fresh water"])]),
        part("C", "A small coin is now placed on top of the block in the salt solution and the block still floats at rest. Predict whether the fraction of the block's volume that is submerged increases, decreases, or stays the same, and justify your prediction.", 2, "explain", ["2.D", "3.C"],
             "The submerged fraction increases. The total weight of the block and coin is larger, so a larger buoyant force is needed for the block to stay at rest, which requires a larger submerged volume.",
             [R("C1", "claim", "States that the submerged fraction increases", ["increases"], err=["states the fraction stays the same because the liquid is unchanged"]),
              R("C2", "justification", "Justifies that the larger total weight requires a larger buoyant force, which comes from a larger submerged volume", ["more weight needs more buoyant force and more submerged volume"], requires="C1", err=["argues only that the block is pushed down"])]),
    ]
    return _pack("phf_qqt_floating_block", "qqt", "8.3", ["8.1", "2.4"], "3.B", "Claim about a floating block in liquids of different density", stim, parts, 8, 17, [f"rb={rb}", f"rs={rs}", f"f1={f1:.4f}", f"f2={f2:.4f}"],
                 [_ev("B", "submerged fraction", f2, 0.005, "")],
                 ("Evaluating a claim about buoyancy and floating with a force-balance derivation of the submerged fraction and a prediction about an added load", ["Decide what determines the buoyant force on a floating block", "Derive the submerged fraction from the force balance", "Predict the effect of an added load using the derived relationship"],
                  [("the block floats at rest so the buoyant force equals its weight", "the stimulus states the block floats at rest in each liquid")], {"type": "text", "must_include": ["densities"]},
                  "sympy solves the force-balance equation for the submerged fraction; a bisection root finder on the net force as a function of the submerged fraction recomputes it"),
                 ["justification", "symbolic_reasoning"])


# 동결 단계 목록(phys-s4): 새 8 시나리오. registry 가 STAGE_S4_A 를 phys_s4_a 로 등록한다. 유형 내 시나리오 2개씩이 서로 다른 칸이다.
NEW_FRQ_TYPES = {"phf_mr_incline_slide": ("MR", 10), "phf_mr_energy_patch": ("MR", 10), "phf_tbr_cart_vt": ("TBR", 12), "phf_tbr_vertical_toss": ("TBR", 12),
                 "phf_lab_pendulum_g": ("LAB", 10), "phf_lab_sliding_friction": ("LAB", 10), "phf_qqt_flat_curve": ("QQT", 8), "phf_qqt_floating_block": ("QQT", 8)}
STAGE_FRQ2 = list(NEW_FRQ_TYPES)
STAGE_S4_A = STAGE_FRQ2
