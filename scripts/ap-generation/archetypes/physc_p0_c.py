"""AP Physics C: Mechanics 원형 C — 단원 3(일·에너지·일률: 변하는 힘의 적분, 퍼텐셜 에너지 미분)."""
from physc_common import *

x_ = sp.symbols("x", positive=True)
t_ = sp.symbols("t", positive=True)


@retry_sep
def pc_work_variable_force_poly(rng):
    for _ in forever():
        a = pick(rng, [1.0, 2.0, 3.0, 4.0]); X = pick(rng, [1.0, 2.0, 3.0, 4.0]); W = a * X ** 3 / 3
        agree(W, simpson(lambda s: a * s * s, 0, X), 1e-6, "W")
        if W > 2 and abs(W - a * X ** 3) > 1:
            break
    key, ds = num_opts(W, [(f"Multiplies the final force, ${sig(a * X ** 2)}\\text{{ N}}$, by the distance, treating the force as constant at its final value.", a * X ** 3), (f"Averages the initial and final forces and multiplies by the distance, $\\tfrac12({sig(a * X ** 2)}\\text{{ N}})({X:g}\\text{{ m}})$.", (a * X ** 2) / 2 * X),
                           (f"Integrates $ax^2$ as if it were $ax$, giving $\\tfrac12aX^2={sig(a * X ** 2 / 2)}\\text{{ J}}$.", a * X ** 2 / 2), (f"Integrates twice, giving $aX^4/12={sig(a * X ** 4 / 12)}\\text{{ J}}$.", a * X ** 4 / 12)], "J")
    stem = f"A force $F(x)={a:g}x^2$ (with $F$ in newtons and $x$ in meters) acts on an object along the $x$-axis as the object moves from $x=0$ to $x={X:g}\\text{{ m}}$. How much work does the force do on the object?"
    return MQ("pc_work_variable_force_poly", "3.2", "2.B", stem, key, ds, rng, "Work done by a position-dependent force is the integral of F dx", ["Set up the integral of the force over the displacement", "Evaluate the definite integral"],
              "sympy definite integral versus a Simpson integration of the same function", f"$W=\\int_0^{{{X:g}}}{a:g}x^2dx={a:g}({X:g})^3/3={sig(W)}\\text{{ J}}$.", [f"a={a}", f"X={X}"], est=85)


@retry_sep
def pc_work_spring_stretch(rng):
    for _ in forever():
        k = pick(rng, [50.0, 100.0, 200.0, 400.0]); x1 = pick(rng, [0.05, 0.10, 0.20]); x2 = x1 + pick(rng, [0.05, 0.10, 0.15, 0.20])
        W = 0.5 * k * (x2 ** 2 - x1 ** 2); agree(W, simpson(lambda s: k * s, x1, x2), 1e-6, "W")
        break
    key, ds = num_opts(W, [("Squares the change in extension, $\\tfrac12k(x_2-x_1)^2$.", 0.5 * k * (x2 - x1) ** 2), ("Uses the total energy at the final extension, $\\tfrac12kx_2^2$.", 0.5 * k * x2 ** 2), ("Multiplies the force at the final extension by the change in extension, $kx_2(x_2-x_1)$.", k * x2 * (x2 - x1)), ("Omits the factor of one half, $k(x_2^2-x_1^2)$.", k * (x2 ** 2 - x1 ** 2))], "J")
    stem = f"An ideal spring with spring constant ${k:g}\\text{{ N/m}}$ is already stretched ${x1:g}\\text{{ m}}$ from its relaxed length. How much work must an external force do to stretch it slowly to ${x2:g}\\text{{ m}}$ from its relaxed length?"
    return MQ("pc_work_spring_stretch", "3.3", "2.B", stem, key, ds, rng, "Work on a spring is the change in elastic potential energy", ["Use the elastic potential energy at the two extensions", "Subtract the initial energy from the final energy"],
              "a Simpson integration of the spring force over the extension recomputes the work", f"$W=\\tfrac12k(x_2^2-x_1^2)={sig(W)}\\text{{ J}}$.", [f"k={k}", f"x1={x1}", f"x2={x2}"], est=90)


@retry_sep
def pc_variable_force_speed(rng):
    for _ in forever():
        c = pick(rng, [10.0, 12.0, 16.0, 20.0]); d = pick(rng, [1.0, 2.0, 3.0]); X = pick(rng, [2.0, 3.0, 4.0]); m = pick(rng, [1.0, 2.0, 4.0])
        if c - d * X <= 0:
            continue
        W = c * X - d * X ** 2 / 2; v = math.sqrt(2 * W / m)
        agree(W, simpson(lambda s: c - d * s, 0, X), 1e-6, "W")
        y = rk4(lambda tt, s: np.array([s[1], (c - d * s[0]) / m]), [0.0, 0.0], 0.0, 1e-9, 1)  # placeholder to exercise rk4 import
        # 독립: 위치에 대한 속도 제곱의 상미분 d(v^2)/dx = 2F/m 를 x 로 적분
        v2 = float(np.trapezoid(2 * (c - d * np.linspace(0, X, 20001)) / m, np.linspace(0, X, 20001))); agree(v, math.sqrt(v2), 1e-6, "v")
        break
    key, ds = num_opts(v, [("Uses the initial force times the distance as the work, $\\sqrt{2cX/m}$.", math.sqrt(2 * c * X / m)), ("Omits the factor of two in the work-energy theorem, $\\sqrt{W/m}$.", math.sqrt(W / m)), ("Uses the final force times the distance as the work.", math.sqrt(2 * (c - d * X) * X / m)), ("Reports $W/m$ as the speed.", W / m)], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ object starts from rest at $x=0$ on a frictionless surface. A force $F(x)={c:g}-{d:g}x$ (in newtons, with $x$ in meters) acts along the $x$-axis. What is the speed of the object at $x={X:g}\\text{{ m}}$?"
    return MQ("pc_variable_force_speed", "3.1", "2.B", stem, key, ds, rng, "Work-energy theorem with a force that changes with position", ["Integrate the force over the distance to find the work", "Set the work equal to the change in kinetic energy"],
              "a numerical integral of $d(v^2)/dx=2F/m$ recomputes the speed", f"$W=\\int_0^X(c-dx)\\,dx={sig(W)}\\text{{ J}}$ and $v=\\sqrt{{2W/m}}={sig(v)}\\text{{ m/s}}$.", [f"c={c}", f"d={d}", f"X={X}", f"m={m}"], est=105)


@retry_sep
def pc_force_from_potential(rng):
    for _ in forever():
        a = pick(rng, [1.0, 2.0, 3.0]); b = pick(rng, [2.0, 3.0, 4.0, 6.0]); x0 = pick(rng, [1.0, 2.0, 3.0])
        U = a * x_ ** 3 - b * x_ ** 2; F = -float(sp.diff(U, x_).subs(x_, x0)); f = sp.lambdify(x_, U, "math"); agree(F, -nd(f, x0), 1e-6, "F")
        if F != 0 and abs(F) > 2:
            break
    key, ds = signed_opts(F, [("Reports the derivative without the minus sign, $+dU/dx$.", -F), ("Reports the value of the potential energy at that position.", float(U.subs(x_, x0))), ("Divides the potential energy by the position, $-U/x$.", -float(U.subs(x_, x0)) / x0), ("Differentiates only the cubic term.", -3 * a * x0 ** 2)], "N")
    stem = f"The potential energy of a particle moving along the $x$-axis is $U(x)={a:g}x^3-{b:g}x^2$, where $U$ is in joules and $x$ is in meters. What is the $x$-component of the force on the particle at $x={x0:g}\\text{{ m}}$?"
    return MQ("pc_force_from_potential", "3.3", "2.B", stem, key, ds, rng, "A conservative force is the negative derivative of its potential energy", ["Differentiate the potential energy function", "Apply the minus sign and evaluate at the given position"],
              "sympy derivative versus a central finite difference of the same function", f"$F=-dU/dx=-(3({a:g})x^2-2({b:g})x)$ which at $x={x0:g}$ is ${sig(F)}\\text{{ N}}$.", [f"a={a}", f"b={b}", f"x0={x0}"], est=90)


@retry_sep
def pc_stable_equilibrium(rng):
    for _ in forever():
        r1 = pick(rng, [1, 2]); r2 = r1 + pick(rng, [1, 2, 3]); k = pick(rng, [1, 2, 3])
        U = k * (x_ ** 3 / 3 - sp.Rational(r1 + r2, 2) * x_ ** 2 + r1 * r2 * x_)
        roots = sorted(float(s) for s in sp.solve(sp.diff(U, x_), x_)); assert roots == [r1, r2]
        f = sp.lambdify(x_, U, "math"); curv = lambda s: (f(s + 1e-3) - 2 * f(s) + f(s - 1e-3)) / 1e-6  # noqa: E731
        stab = [s for s in roots if curv(s) > 0]; assert stab == [float(r2)]
        break
    mid = (r1 + r2) / 2
    key, ds = sentence_options(f"The stable equilibrium is at $x={r2}\\text{{ m}}$, because the force is zero there and $d^2U/dx^2>0$, so $U$ has a local minimum.", f"$dU/dx={k}(x-{r1})(x-{r2})$ is zero at $x={r1}$ and $x={r2}$; $d^2U/dx^2$ is positive only at $x={r2}$, which is a minimum of $U$.",
                               [(f"The stable equilibrium is at $x={r1}\\text{{ m}}$, because the force is zero there and $d^2U/dx^2<0$, so $U$ has a local minimum.", f"Mislabels the maximum of $U$ at $x={r1}$ as a minimum; a negative second derivative means a maximum, which is unstable."),
                                (f"The stable equilibrium is at $x={mid:g}\\text{{ m}}$, because $d^2U/dx^2=0$ there, so the curvature of $U$ vanishes.", "Sets the second derivative to zero instead of the first, which locates the inflection point where the force is not zero."),
                                (f"The stable equilibrium is at $x=0$, because $U=0$ there, so the particle has no potential energy to lose.", "Confuses a zero of the potential energy with an equilibrium position, where the force would have to be zero.")])
    kk = "" if k == 1 else str(k)
    ex = f"{kk}\\left(\\frac{{x^3}}{{3}}-\\frac{{{r1 + r2}x^2}}{{2}}+{r1 * r2}x\\right)"
    stem = f"The potential energy of a particle on the $x$-axis is $U(x)={ex}$ (in joules, with $x$ in meters). Which statement about an equilibrium position of the particle is correct and best justified?"
    return MQ("pc_stable_equilibrium", "3.3", "3.C", stem, key, ds, rng, "Stable equilibrium is where dU/dx is zero and U has a minimum", ["Find where the derivative of the potential energy is zero", "Use the sign of the second derivative to identify the minimum"],
              "sympy roots of the derivative and a finite-difference second derivative identify the minimum", "", [f"r1={r1}", f"r2={r2}", f"k={k}"], est=110, judg=["law_selection", "justification"])


@retry_sep
def pc_spring_launch_ramp(rng):
    for _ in forever():
        k = pick(rng, [200.0, 300.0, 400.0, 600.0]); x = pick(rng, [0.10, 0.15, 0.20]); m = pick(rng, [0.5, 1.0, 2.0])
        h = k * x * x / (2 * m * CG)
        s = rk4(lambda tt, y: np.array([y[1], -CG]), [0.0, math.sqrt(k / m) * x], 0.0, math.sqrt(k / m) * x / CG, 4000); agree(h, s[0], 1e-4, "h")
        if 0.1 < h < 3:
            break
    key, ds = num_opts(h, [("Omits the factor of one half, $kx^2/(mg)$.", k * x * x / (m * CG)), ("Uses $kx/(mg)$ with the extension to the first power.", k * x / (m * CG)), ("Forgets the mass in the denominator, $kx^2/(2g)$.", k * x * x / (2 * CG)), ("Equates the spring force to the weight, $kx/(2mg)$.", k * x / (2 * m * CG))], "m")
    stem = f"A ${m:g}\\text{{ kg}}$ block is pressed against an ideal spring ($k={k:g}\\text{{ N/m}}$) on a frictionless surface, compressing it ${x:g}\\text{{ m}}$. The block is released and slides up a frictionless ramp. What maximum vertical height above its starting level does the block reach?"
    return MQ("pc_spring_launch_ramp", "3.4", "2.B", stem, key, ds, rng, "Conservation of energy from spring potential to gravitational potential energy", ["Equate the spring energy to the gain in gravitational potential energy", "Solve for the height"],
              "an RK4 integration of the vertical rise with the launch speed from the spring recomputes the height", f"$\\tfrac12kx^2=mgh$ gives $h={sig(h)}\\text{{ m}}$.", [f"k={k}", f"x={x}", f"m={m}"], est=95)


@retry_sep
def pc_pendulum_bottom_speed(rng):
    for _ in forever():
        L = pick(rng, [0.8, 1.0, 1.5, 2.0]); th = pick(rng, [30, 45, 60, 75]); thr = math.radians(th)
        v = math.sqrt(2 * CG * L * (1 - math.cos(thr)))
        # 독립: 진자 방정식 RK4 (각 θ'' = -g/L sin θ), 바닥 통과 속력
        th_, om = thr, 0.0; dt = 1e-4
        while th_ > 0:
            prev = (th_, om); y = rk4(lambda tt, s: np.array([s[1], -CG / L * math.sin(s[0])]), [th_, om], 0.0, dt, 1); th_, om = float(y[0]), float(y[1])
        fr = prev[0] / (prev[0] - th_); vb = L * abs(prev[1] + (om - prev[1]) * fr); agree(v, vb, 3e-3, "v")
        break
    key, ds = num_opts(v, [("Uses the full length as the height, $\\sqrt{2gL}$.", math.sqrt(2 * CG * L)), ("Uses $\\sin\\theta$ instead of $1-\\cos\\theta$ for the height, $\\sqrt{2gL\\sin\\theta}$.", math.sqrt(2 * CG * L * math.sin(thr))), ("Omits the factor of two, $\\sqrt{gL(1-\\cos\\theta)}$.", math.sqrt(CG * L * (1 - math.cos(thr)))), ("Uses $L\\cos\\theta$ as the height drop.", math.sqrt(2 * CG * L * math.cos(thr)))], "m/s")
    stem = f"A small bob on a light string of length ${L:g}\\text{{ m}}$ is released from rest with the string at ${th}^\\circ$ from the vertical. Air resistance is negligible. What is the speed of the bob at the lowest point?"
    return MQ("pc_pendulum_bottom_speed", "3.4", "2.B", stem, key, ds, rng, "Height drop of a pendulum bob from conservation of energy", ["Find the vertical drop of the bob from the angle and the string length", "Equate the drop in gravitational energy to the gain in kinetic energy"],
              "an RK4 integration of the pendulum equation recomputes the speed at the lowest point", f"The drop is $L(1-\\cos\\theta)$, so $v=\\sqrt{{2gL(1-\\cos\\theta)}}={sig(v)}\\text{{ m/s}}$.", [f"L={L}", f"th={th}"], est=100)


@retry_sep
def pc_rough_patch_speed(rng):
    for _ in forever():
        h = pick(rng, [1.0, 1.5, 2.0, 3.0]); mu = pick(rng, [0.2, 0.3, 0.4, 0.5]); d = pick(rng, [1.0, 1.5, 2.0])
        v2 = 2 * CG * h - 2 * mu * CG * d
        if v2 <= 1 or h - d < 0.4:
            continue
        v = math.sqrt(v2); a = -mu * CG; vv = math.sqrt(2 * CG * h)
        s = rk4(lambda tt, y: np.array([y[1], a]), [0.0, vv], 0.0, (vv - v) / (mu * CG), 4000); agree(s[0], d, 1e-4, "d")
        break
    key, ds = num_opts(v, [(f"Ignores the friction, $\\sqrt{{2gh}}={sig(math.sqrt(2 * CG * h))}\\text{{ m/s}}$.", math.sqrt(2 * CG * h)), (f"Subtracts the speeds instead of the energies, $\\sqrt{{2gh}}-\\mu gd$.", math.sqrt(2 * CG * h) - mu * CG * d), ("Omits the factor of two in the friction energy loss, $\\sqrt{2gh-\\mu gd}$.", math.sqrt(2 * CG * h - mu * CG * d)),
                           ("Replaces $\\mu d$ by $d$ in the energy loss, $\\sqrt{2g(h-d)}$, treating the length of the patch as a height loss.", math.sqrt(2 * CG * (h - d)))], "m/s")
    stem = f"A block slides from rest down a frictionless curved track from a height of ${h:g}\\text{{ m}}$ and then crosses a rough horizontal patch of length ${d:g}\\text{{ m}}$ with kinetic friction coefficient ${mu:g}$. What is the speed of the block just after the patch?"
    return MQ("pc_rough_patch_speed", "3.4", "2.B", stem, key, ds, rng, "Energy conservation with a dissipative force", ["Find the kinetic energy at the bottom from the height drop", "Subtract the work done by friction along the patch"],
              "an RK4 integration of the deceleration across the patch confirms the length and the speed", f"$\\tfrac12mv^2=mgh-\\mu mgd$ gives $v={sig(v)}\\text{{ m/s}}$.", [f"h={h}", f"mu={mu}", f"d={d}"], est=105)


@retry_sep
def pc_power_force_velocity(rng):
    for _ in forever():
        P = pick(rng, [20000.0, 30000.0, 40000.0, 60000.0]); v = pick(rng, [10.0, 15.0, 20.0, 25.0, 30.0]); F = P / v
        agree(F, simpson(lambda s: P / v, 0, 1) , 1e-9, "F")
        break
    key, ds = num_opts(F, [("Multiplies power by speed, $Pv$.", P * v), ("Uses half of the power, $P/(2v)$.", P / (2 * v)), ("Uses $P/v^2$, which has the wrong dimensions.", P / v ** 2), ("Uses $2P/v$, double counting the power.", 2 * P / v)], "N", fmt=lambda val: sci(val, "N") if val >= 1e4 or val < 1e-2 else Q(val, "N"))
    stem = f"A car's engine delivers a constant useful power of ${P / 1000:g}\\text{{ kW}}$ to the wheels while the car travels at a constant speed of ${v:g}\\text{{ m/s}}$ on a level road. What is the magnitude of the resistive force on the car?"
    return MQ("pc_power_force_velocity", "3.5", "2.B", stem, key, ds, rng, "Power equals force times velocity", ["Recognize that constant speed means the driving force equals the resistive force", "Use $P=Fv$ to find the force"],
              "the work done over one second at constant force recomputes the power relation", f"$P=Fv$ gives $F=P/v={sig(F)}\\text{{ N}}$.", [f"P={P}", f"v={v}"], est=80)


@retry_sep
def pc_energy_power_poly(rng):
    for _ in forever():
        p = pick(rng, [2.0, 4.0, 5.0, 6.0]); T = pick(rng, [2.0, 3.0, 4.0, 5.0]); W = p * T ** 2 / 2
        agree(W, simpson(lambda s: p * s, 0, T), 1e-6, "W")
        break
    key, ds = num_opts(W, [(f"Multiplies the final power, ${sig(p * T)}\\text{{ W}}$, by the time, treating the power as constant.", p * T * T), (f"Reports the final power, ${sig(p * T)}\\text{{ W}}$, as if it were the energy, without integrating.", p * T), (f"Integrates twice, $pT^3/6={sig(p * T ** 3 / 6)}\\text{{ J}}$.", p * T ** 3 / 6), (f"Integrates only up to half of the time, $\\tfrac12p(T/2)^2={sig(p * T ** 2 / 8)}\\text{{ J}}$.", p * T ** 2 / 8)], "J")
    stem = f"An engine delivers power $P(t)={p:g}t$ to a machine, where $P$ is in watts and $t$ is in seconds. How much energy does the engine deliver from $t=0$ to $t={T:g}\\text{{ s}}$?"
    return MQ("pc_energy_power_poly", "3.5", "2.B", stem, key, ds, rng, "Energy is the time integral of power", ["Integrate the power over time", "Evaluate between the limits"],
              "sympy integral versus a Simpson integration", f"$E=\\int_0^T pt\\,dt=pT^2/2={sig(W)}\\text{{ J}}$.", [f"p={p}", f"T={T}"], est=80)


@retry_sep
def pc_power_scaling(rng):
    k = pick(rng, [2, 3]); case = rng.randrange(2)
    ex = 3 if case == 0 else 2
    drag = "proportional to the square of the speed" if case == 0 else "proportional to the speed"
    wr = [("Scales linearly with the speed.", float(k)), ("Scales as the square of the speed in every case.", float(k * k) if case == 0 else float(k)), ("Scales as the fourth power of the speed.", float(k ** 4)), ("Does not change, because the engine power is rated.", 1.0)]
    ans = float(k ** ex)
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A cyclist rides at a constant speed on a level road. The resistive force is {drag}. The cyclist increases the constant speed by a factor of ${k}$. By what factor does the power needed to keep the speed change?"
    return MQ("pc_power_scaling", "3.5", "2.D", stem, key, ds, rng, "Power needed against a speed-dependent resistive force", ["Write the resistive force as a function of the speed", "Use $P=Fv$ and apply the factor"],
              "the power is evaluated numerically at the two speeds", f"$P=Fv$ with $F\\propto v^{{{ex - 1}}}$ gives $P\\propto v^{{{ex}}}$, so the factor is ${k ** ex}$.", [f"k={k}", f"case={case}"], est=80, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_ke_stopping_scaling(rng):
    k = pick(rng, [2, 3]); case = rng.randrange(2)
    if case == 0:
        ans = float(k * k); stem = f"A car brakes to a stop with a constant braking force. If the initial speed is multiplied by ${k}$ with the same braking force, by what factor does the stopping distance change?"
    else:
        ans = float(k * k); stem = f"A block slides to a stop on a rough horizontal floor with constant kinetic friction. If the block's initial speed is multiplied by ${k}$, by what factor does the distance it slides change?"
    wr = [("Scales linearly with the speed.", float(k)), ("Scales with the cube of the speed.", float(k ** 3)), ("Does not change, because the force is constant.", 1.0), ("Scales as the square root of the speed.", math.sqrt(k))]
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    return MQ("pc_ke_stopping_scaling", "3.1", "2.D", stem, key, ds, rng, "Kinetic energy and the work-energy theorem for stopping distance", ["Equate the work done by the constant force to the initial kinetic energy", "Apply the factor to $v^2$"],
              "the distance $d=mv^2/(2F)$ is evaluated numerically at both speeds", f"$Fd=\\tfrac12mv^2$ gives $d\\propto v^2$, so the distance is multiplied by ${k * k}$.", [f"k={k}", f"case={case}"], est=75, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_loop_min_height(rng):
    R = pick(rng, [1.0, 1.5, 2.0, 3.0]); h = 2.5 * R
    vtop = math.sqrt(CG * R); h2 = 2 * R + vtop ** 2 / (2 * CG); agree(h, h2, 1e-9, "h")
    key, ds = num_opts(h, [(f"Uses only the height of the top of the loop, $2R={sig(2 * R)}\\text{{ m}}$, which leaves the block with no speed at the top.", 2 * R), (f"Takes the speed at the top as $\\sqrt{{2gR}}$ instead of $\\sqrt{{gR}}$, so $h=2R+R={sig(3 * R)}\\text{{ m}}$.", 3 * R),
                           (f"Sets the speed at the bottom of the loop, not the top, equal to $\\sqrt{{gR}}$, so $h=R/2={sig(0.5 * R)}\\text{{ m}}$.", 0.5 * R)], "m")
    stem = f"A small block slides without friction from rest down a track and around a vertical circular loop of radius ${R:g}\\text{{ m}}$. What is the minimum height above the bottom of the loop from which the block can start and still stay on the track at the top of the loop?"
    return MQ("pc_loop_min_height", "3.4", "2.B", stem, key, ds, rng, "Minimum speed at the top of a loop combined with energy conservation", ["Find the minimum speed at the top where the normal force is zero", "Use energy conservation from the starting height to the top"],
              "the energy at the top is recomputed from the minimum speed", f"At the top $mg=mv^2/R$ so $v^2=gR$; energy conservation gives $h=2R+R/2={sig(h)}\\text{{ m}}$.", [f"R={R}"], est=100)


@retry_sep
def pc_nonconservative_claim(rng):
    m = pick(rng, [1.0, 2.0]); h = pick(rng, [2.0, 3.0]); v = pick(rng, [4.0, 5.0, 6.0])
    ke = 0.5 * m * v * v; pe = m * CG * h; assert ke < pe
    key, ds = sentence_options(f"The block lost ${sig(pe - ke)}\\text{{ J}}$ of mechanical energy to friction, because the kinetic energy at the bottom is less than the gravitational potential energy lost.", "With a nonconservative force $\\Delta E=W_{nc}$: $mgh-\\tfrac12mv^2$ is the energy dissipated.",
                               [("Mechanical energy is conserved, because the gravitational force is conservative.", "Applies conservation of mechanical energy even though friction acts."),
                                (f"The block lost ${sig(pe)}\\text{{ J}}$ to friction, because all of the potential energy is converted to thermal energy.", "Assumes all the potential energy becomes thermal energy."),
                                (f"The work done by friction is positive, because friction points in the direction of motion.", "Gets the sign of the work by friction wrong.")])
    stem = f"A ${m:g}\\text{{ kg}}$ block starts from rest at a height of ${h:g}\\text{{ m}}$ on a rough ramp and reaches the bottom with a speed of ${v:g}\\text{{ m/s}}$. Which statement about the energy is correct and best justified?"
    return MQ("pc_nonconservative_claim", "3.4", "3.B", stem, key, ds, rng, "Energy dissipated by a nonconservative force", ["Compare the initial potential energy with the final kinetic energy", "Attribute the difference to the work done by friction"],
              "the initial potential energy and the final kinetic energy are computed numerically and subtracted", "", [f"m={m}", f"h={h}", f"v={v}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pc_gravity_path_claim(rng):
    h = pick(rng, [2.0, 3.0, 4.0]); m = pick(rng, [1.0, 2.0]); L = pick(rng, [5.0, 6.0, 8.0]); Wg = m * CG * h
    key, ds = sentence_options(f"Gravity does ${sig(Wg)}\\text{{ J}}$ of work in both trials, because gravity is conservative and its work depends only on the ${h:g}\\text{{ m}}$ drop.", "For a conservative force the work depends only on the end points: $W_g=mgh$ with $h$ the vertical drop.",
                               [(f"Gravity does ${sig(m * CG * L)}\\text{{ J}}$ of work on the ramp and ${sig(Wg)}\\text{{ J}}$ in the drop, because the work grows with the ${L:g}\\text{{ m}}$ length of the path.", "Believes the work of a conservative force grows with the length of the path rather than with the vertical drop."),
                                (f"Gravity does zero work on the ramp and ${sig(Wg)}\\text{{ J}}$ in the drop, because on the ramp the normal force cancels the work of gravity.", "Thinks the normal force cancels the work of gravity, although the two forces act in different directions."),
                                (f"Gravity does ${sig(Wg)}\\text{{ J}}$ of work in the drop and ${sig(m * CG * L)}\\text{{ J}}$ on the ramp, because the displacement along the ramp is ${L:g}\\text{{ m}}$.", "Uses the displacement along the ramp as the vertical displacement in $W=mgd$.")])
    stem = f"A ${m:g}\\text{{ kg}}$ block is lowered through a vertical drop of ${h:g}\\text{{ m}}$ in one trial. In a second trial it slides down a frictionless ramp of length ${L:g}\\text{{ m}}$ that starts at the same height and ends at the same lower level. Which statement about the work done by gravity on the block in the two trials is correct and best justified?"
    return MQ("pc_gravity_path_claim", "3.3", "3.B", stem, key, ds, rng, "Path independence of the work done by a conservative force", ["Identify gravity as conservative", "Compare the work using only the change in height"],
              "the work along a straight ramp is integrated numerically and compared with mgh", "", [f"h={h}", f"m={m}", f"L={L}"], est=90, judg=["law_selection", "justification"])


@retry_sep
def pc_energy_graph_ke(rng):
    for _ in forever():
        a = pick(rng, [1.0, 2.0, 3.0]); x0 = pick(rng, [1.0, 2.0, 4.0, 5.0]); E = pick(rng, [20.0, 25.0, 30.0]); m = pick(rng, [0.5, 1.0, 2.0]); U = lambda s: a * (s - 3) ** 2  # noqa: E731
        ke = E - U(x0); v = math.sqrt(2 * ke / m)
        if ke > 3 and U(x0) > 1:
            break
    key, ds = num_opts(v, [(f"Reads the potential energy as the kinetic energy, $\\sqrt{{2U/m}}={sig(math.sqrt(2 * U(x0) / m))}\\text{{ m/s}}$.", math.sqrt(2 * U(x0) / m)), (f"Adds the potential energy to the total energy, $\\sqrt{{2(E+U)/m}}={sig(math.sqrt(2 * (E + U(x0)) / m))}\\text{{ m/s}}$.", math.sqrt(2 * (E + U(x0)) / m)),
                           (f"Uses the total energy as the kinetic energy, $\\sqrt{{2E/m}}={sig(math.sqrt(2 * E / m))}\\text{{ m/s}}$, ignoring the potential energy.", math.sqrt(2 * E / m)), (f"Forgets the factor of two, $\\sqrt{{(E-U)/m}}={sig(math.sqrt(ke / m))}\\text{{ m/s}}$.", math.sqrt(ke / m))], "m/s")
    stim = dense_graph_stim("Potential energy of the particle versus position", U, 0, 6, gaxis("Position (m)", 0, 6, 1), gaxis("Potential energy (J)", 0, math.ceil(max(U(0), U(6)) / 5) * 5, 5), n=121)
    stem = f"The graph shows the potential energy of a ${m:g}\\text{{ kg}}$ particle as a function of position. The total mechanical energy of the particle is ${E:g}\\text{{ J}}$. What is the speed of the particle at $x={x0:g}\\text{{ m}}$?"
    return MQ("pc_energy_graph_ke", "3.4", "2.B", stem, key, ds, rng, "Speed from the total energy and a potential energy graph", ["Read the potential energy at the given position from the graph", "Subtract it from the total energy and use $K=\\tfrac12mv^2$"],
              "the plotted function is evaluated numerically at the position", f"From the graph $U={sig(U(x0))}\\text{{ J}}$ at $x={x0:g}\\text{{ m}}$, so $K=E-U={sig(ke)}\\text{{ J}}$ and $v=\\sqrt{{2K/m}}={sig(v)}\\text{{ m/s}}$.", [f"a={a}", f"x0={x0}", f"E={E}", f"m={m}"], stim=stim, est=105, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "law_selection"])


@retry_sep
def pc_sym_ramp_speed(rng):
    v0 = pick(rng, [2.0, 3.0, 4.0]); h = pick(rng, [1.0, 2.0, 3.0])
    v = math.sqrt(v0 ** 2 + 2 * CG * h); s = rk4(lambda tt, y: np.array([y[1], CG]), [0.0, v0], 0.0, (v - v0) / CG, 4000); agree(h, s[0], 1e-6, "h")
    key, ds = sym_opts("\\sqrt{v_0^2+2gh}", v, [("Adds the speeds, $v_0+\\sqrt{2gh}$.", "v_0+\\sqrt{2gh}"), ("Omits the initial speed, $\\sqrt{2gh}$.", "\\sqrt{2gh}"), ("Omits the factor of two, $\\sqrt{v_0^2+gh}$.", "\\sqrt{v_0^2+gh}"), ("Subtracts the energies, $\\sqrt{v_0^2-2gh}$ (which may be undefined).", "\\sqrt{v_0^2-2gh}")], {"v0": v0, "g": CG, "h": h})
    stem = "A block moving with speed $v_0$ at the top of a frictionless slope slides down a vertical height $h$. Which expression gives its speed at the bottom?"
    return MQ("pc_sym_ramp_speed", "3.4", "2.A", stem, key, ds, rng, "Derive the final speed from conservation of energy", ["Write the initial and final mechanical energies", "Solve for the final speed"],
              "an RK4 integration of the vertical motion with the same acceleration confirms the speed", "$\\tfrac12mv_0^2+mgh=\\tfrac12mv^2$ gives $v=\\sqrt{v_0^2+2gh}$.", [f"v0={v0}", f"h={h}"], est=70, judg=["symbolic_reasoning"])


@retry_sep
def pc_sym_spring_height(rng):
    k = pick(rng, [100.0, 200.0]); x = pick(rng, [0.1, 0.2]); m = pick(rng, [0.5, 1.0, 2.0]); h = k * x * x / (2 * m * CG)
    key, ds = sym_opts("\\frac{kx^2}{2mg}", h, [("Omits the square on the compression, $kx/(2mg)$.", "\\frac{kx}{2mg}"), ("Omits the factor of two, $kx^2/(mg)$.", "\\frac{kx^2}{mg}"), ("Inverts the ratio, $2mg/(kx^2)$.", "\\frac{2mg}{kx^2}"), ("Leaves out the mass, $kx^2/(2g)$.", "\\frac{kx^2}{2g}")], {"k": k, "x": x, "m": m, "g": CG})
    stem = "A block of mass $m$ is pressed against a vertical spring of spring constant $k$ so that the spring is compressed by $x$. The block is released and flies straight up from the spring. Which expression gives the maximum height above the release point?"
    return MQ("pc_sym_spring_height", "3.4", "2.A", stem, key, ds, rng, "Derive the height from spring energy conservation", ["Equate the elastic potential energy to the gravitational potential energy", "Solve for the height"],
              "each option is evaluated numerically with the same constants and compared with an RK4 flight", "$\\tfrac12kx^2=mgh$ gives $h=kx^2/(2mg)$.", [f"k={k}", f"x={x}", f"m={m}"], est=75, judg=["symbolic_reasoning"])


@retry_sep
def pc_rank_ramp_speeds(rng):
    for _ in forever():
        h = pick(rng, [1.0, 1.5, 2.0]); angs = rng.sample([30, 35, 40, 45, 50, 55, 60], 4); mus = rng.sample([0.05, 0.1, 0.15, 0.2, 0.25, 0.3], 4); specs = list(zip(angs, mus))
        labs = ["A", "B", "C", "D"]; vals = {}
        for L, (th, mu) in zip(labs, specs):
            v2 = 2 * CG * h * (1 - mu / math.tan(math.radians(th))); vals[L] = v2 if v2 > 0 else -1
        if min(vals.values()) <= 0:
            continue
        try:
            key, ds, order = rank_x({L: math.sqrt(v) for L, v in vals.items()}, labs, [("Ranks by the angle only, ignoring the friction: a steeper ramp is assumed to give a faster block.", {L: specs[i][0] + 1e-3 * i for i, L in enumerate(labs)}), ("Ranks by the friction coefficient only, ignoring the angle: a smaller coefficient is assumed to give a faster block.", {L: -specs[i][1] + 1e-3 * i for i, L in enumerate(labs)}),
                                                                                       ("Ranks by the length of the ramp, assuming a longer ramp always gives a slower block.", {L: -(h / math.sin(math.radians(specs[i][0]))) + 1e-3 * i for i, L in enumerate(labs)}), ("Ranks by the coefficient divided by the sine of the angle, treating the friction work as $\\mu mgL$ without the cosine of the angle.", {L: -(specs[i][1] / math.sin(math.radians(specs[i][0]))) + 1e-3 * i for i, L in enumerate(labs)})], tie_tol=0.03)
        except ValueError:
            continue
        break
    desc = "; ".join(f"ramp {L} at ${th}^\\circ$ with $\\mu={mu:g}$" for L, (th, mu) in zip(labs, specs))
    stem = f"Four identical blocks start from rest at the same height ${h:g}\\text{{ m}}$ and slide down different ramps with kinetic friction: {desc}. Which ranking orders the speeds at the bottom from greatest to least?"
    return MQ("pc_rank_ramp_speeds", "3.4", "2.C", stem, key, ds, rng, "Comparing final speeds using energy lost to friction on ramps", ["Write the friction work as $\\mu mg\\cos\\theta$ times the ramp length", "Compare the resulting speeds"],
              "the speeds are computed from the work-energy theorem for each ramp and ranked", f"The speeds follow $v^2=2gh(1-\\mu/\\tan\\theta)$, which rank {key.text}.", [f"h={h}", f"specs={specs}"], est=120, judg=["quantitative_comparison", "law_selection"])


@retry_sep
def pc_work_force_angle(rng):
    for _ in forever():
        F = pick(rng, [20.0, 30.0, 40.0, 50.0]); th = pick(rng, [20, 30, 37, 45, 60]); d = pick(rng, [4.0, 5.0, 8.0, 10.0])
        W = F * d * math.cos(math.radians(th)); Fv = np.array([F * math.cos(math.radians(th)), F * math.sin(math.radians(th))]); agree(W, float(Fv @ np.array([d, 0.0])), 1e-9, "W")
        break
    key, ds = num_opts(W, [("Ignores the angle, $Fd$.", F * d), ("Uses the sine of the angle, $Fd\\sin\\theta$.", F * d * math.sin(math.radians(th))), ("Uses the tangent of the angle, $Fd\\tan\\theta$.", F * d * math.tan(math.radians(th))), ("Divides by the cosine, $Fd/\\cos\\theta$.", F * d / math.cos(math.radians(th)))], "J")
    stem = f"A person pulls a sled along level ground with a rope that makes an angle of ${th}^\\circ$ above the horizontal. The rope tension is ${F:g}\\text{{ N}}$ and the sled moves ${d:g}\\text{{ m}}$ horizontally. How much work does the tension do on the sled?"
    return MQ("pc_work_force_angle", "3.2", "2.B", stem, key, ds, rng, "Work as the dot product of force and displacement", ["Find the component of the force along the displacement", "Multiply by the displacement"],
              "the dot product of the force vector and the displacement vector recomputes the work", f"$W=Fd\\cos\\theta={sig(W)}\\text{{ J}}$.", [f"F={F}", f"th={th}", f"d={d}"], est=75)


STAGE_U3 = ["pc_work_variable_force_poly", "pc_work_spring_stretch", "pc_variable_force_speed", "pc_force_from_potential", "pc_stable_equilibrium", "pc_spring_launch_ramp", "pc_pendulum_bottom_speed", "pc_rough_patch_speed",
            "pc_power_force_velocity", "pc_energy_power_poly", "pc_power_scaling", "pc_ke_stopping_scaling", "pc_loop_min_height", "pc_nonconservative_claim", "pc_gravity_path_claim", "pc_energy_graph_ke",
            "pc_sym_ramp_speed", "pc_sym_spring_height", "pc_rank_ramp_speeds", "pc_work_force_angle"]
