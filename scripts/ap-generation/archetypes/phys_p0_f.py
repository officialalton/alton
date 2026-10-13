"""AP Physics 1 원형 F — 스킬 범위 보강(2026-10-13, phys-s3): 공식 MC 스킬 범위(2.A 7–8, 2.B 9–10, 2.C 5–6, 2.D 5–6, 3.B 9–10, 3.C 3–4)를 채우기 위한
2.A(기호식 선택지) 8개 + 2.C(순위·비교 판단) 8개. 규칙은 phys_p0_d/e 와 같다: 정답은 코드가 이중 경로(sympy·정확 분수 vs numpy·수치 적분·선형계)로 계산하고,
오답은 이름 붙은 오개념의 식·순위 규칙으로 만들며, 수치 선택지는 8% 이상 떨어지고, 정답 해설에는 풀이 과정을 담는다. 그림은 쓰지 않는다(본문에 모든 정보)."""
import json
from phys_common import *
from phys_sym import tex_eval, sym_opts, rank_opts


def _a2(arch, topic, stem, key, ds, rng, *, kwhy, concept, thinking, cond, path, facts, est=70, judgment=("law_selection", "symbolic_reasoning")):
    return mk(arch, topic, "2.A", stem, key, ds, rng, concept=concept, thinking=thinking, cond=cond, path=path, material=MAT_NONE, judgment=list(judgment), est=est, facts=facts, kwhy=kwhy)


def _c2(arch, topic, stem, key, ds, rng, *, kwhy, concept, thinking, cond, path, facts, est=75):
    return mk(arch, topic, "2.C", stem, key, ds, rng, concept=concept, thinking=thinking, cond=cond, path=path, material=MAT_NONE, judgment=["quantitative_comparison", "law_selection"], est=est, facts=facts, kwhy=kwhy)


# ======================= 2.A 기호식 =======================
@retry_sep
def ph_sym_incline_accel(rng):
    variant = rng.randrange(2)  # 0: 미끄러져 내려옴, 1: 올라가는 중(감속의 크기)
    th_d = pick(rng, [20, 25, 30, 35, 40, 45]); mu = pick(rng, [0.15, 0.2, 0.25, 0.3, 0.35])
    thr = math.radians(th_d); env = {"g": G, "theta": thr, "mu": mu}
    g_, th, m_, N_, a_, mu_ = sp.symbols("g theta m N a mu", positive=True)
    s = 1 if variant == 1 else -1  # 마찰이 경사 아래 방향(+)이면 올라가는 중
    sol = sp.solve([sp.Eq(m_ * a_, m_ * g_ * sp.sin(th) + s * mu_ * N_), sp.Eq(N_, m_ * g_ * sp.cos(th))], [a_, N_], dict=True)[0]
    sym_v = float(sol[a_].subs({g_: G, th: thr, mu_: mu}))
    a_n, _ = np.linalg.solve(np.array([[1.0, -s * mu], [0.0, 1.0]]), np.array([G * math.sin(thr), G * math.cos(thr)]))  # m=1 선형계
    agree(sym_v, a_n, 1e-9, "a")
    sg = "-" if variant == 0 else "+"; other = "+" if variant == 0 else "-"
    key_tex = r"g(\sin\theta" + sg + r"\mu\cos\theta)"
    wrongs = [(r"Uses the weight $mg$ instead of the normal force $mg\cos\theta$ in the friction force, so the factor $\cos\theta$ is missing.", r"g\sin\theta" + sg + r"\mu g"),
              ("Points the kinetic friction force in the wrong direction along the incline, so the friction term has the opposite sign.", r"g(\sin\theta" + other + r"\mu\cos\theta)"),
              (r"Swaps sine and cosine, using the component of gravity perpendicular to the incline as the driving force.", r"g(\cos\theta" + sg + r"\mu\sin\theta)"),
              ("Ignores friction and keeps only the component of gravity along the incline.", r"g\sin\theta"),
              (r"Gives only the friction force divided by the mass, leaving out the component of gravity along the incline.", r"\mu g\cos\theta")]
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    if variant == 0:
        stem = r"A block of mass $m$ slides down a rough incline that makes an angle $\theta$ with the horizontal. The coefficient of kinetic friction between the block and the incline is $\mu$. Which of the following is the magnitude of the acceleration of the block?"
        why = r"Along the incline $ma=mg\sin\theta-\mu N$ and perpendicular to it $N=mg\cos\theta$; combining them gives $a=g(\sin\theta-\mu\cos\theta)$."
    else:
        stem = r"A block of mass $m$ is pushed so that it slides up a rough incline that makes an angle $\theta$ with the horizontal. The coefficient of kinetic friction is $\mu$. After leaving the hand, which of the following is the magnitude of the acceleration of the block while it continues sliding up the incline?"
        why = r"Both gravity's component $mg\sin\theta$ and kinetic friction $\mu N$ point down the incline, with $N=mg\cos\theta$, so $a=g(\sin\theta+\mu\cos\theta)$."
    return _a2("ph_sym_incline_accel", "2.7", stem, key, ds, rng, kwhy=why, concept="Symbolic acceleration on a rough incline from Newton's second law along and perpendicular to the surface",
               thinking=["Write Newton's second law along the incline with the friction force direction set by the motion", "Use the perpendicular equation for the normal force and combine"],
               cond=[("friction is kinetic", "the stem gives a coefficient of kinetic friction while the block slides")], path="sympy solves the two force equations for the acceleration; numpy solves the same linear system at the chosen angle and friction coefficient, and the printed option is evaluated by a TeX evaluator",
               facts=[f"theta_deg={th_d}", f"mu={mu}", f"variant={variant}"])


@retry_sep
def ph_sym_table_hanging(rng):
    ask_T = rng.randrange(2)
    m1 = pick(rng, [1.5, 2.0, 3.0, 4.0]); m2 = pick(rng, [1.0, 2.0, 5.0, 6.0])
    env = {"g": G, "m1": m1, "m2": m2}
    g_, a_, T_, M1, M2 = sp.symbols("g a T m_1 m_2", positive=True)
    sol = sp.solve([sp.Eq(T_, M1 * a_), sp.Eq(M2 * g_ - T_, M2 * a_)], [a_, T_], dict=True)[0]
    num = {g_: G, M1: m1, M2: m2}
    sym_v = float((sol[T_] if ask_T else sol[a_]).subs(num))
    a_n, T_n = np.linalg.solve(np.array([[m1, -1.0], [m2, 1.0]]), np.array([0.0, m2 * G]))  # [a, T]: m1 a - T = 0, m2 a + T = m2 g
    agree(sym_v, T_n if ask_T else a_n, 1e-9, "val")
    if ask_T:
        key_tex = r"\frac{m_1m_2}{m_1+m_2}g"
        wrongs = [("Takes the tension to equal the weight of the hanging block, which holds only when the hanging block is in equilibrium.", r"m_2g"), ("Takes the tension to equal the weight of the block on the table, which the string does not support.", r"m_1g"),
                  ("Uses the tension formula for two hanging blocks over a pulley, which has an extra factor of 2.", r"\frac{2m_1m_2}{m_1+m_2}g"), ("Adds the two weights instead of finding the force that accelerates the block on the table.", r"(m_1+m_2)g")]
        what = "the tension in the string"
        why = r"For the table block $T=m_1a$ and for the hanging block $m_2g-T=m_2a$; solving gives $a=\dfrac{m_2g}{m_1+m_2}$ and $T=\dfrac{m_1m_2}{m_1+m_2}g$."
    else:
        key_tex = r"\frac{m_2}{m_1+m_2}g"
        wrongs = [("Leaves the mass of the hanging block out of the system mass, so the net force $m_2g$ accelerates only the block on the table.", r"\frac{m_2}{m_1}g"), ("Treats the hanging block as being in free fall, ignoring the tension from the table block.", r"g"),
                  ("Uses the acceleration formula for two hanging blocks, with the difference of the masses in the numerator.", r"\frac{m_2-m_1}{m_1+m_2}g"), ("Puts the mass of the table block in the numerator, as if the table block were pulling the hanging one.", r"\frac{m_1}{m_1+m_2}g")]
        what = "the acceleration of the blocks"
        why = r"The net force on the system is the weight $m_2g$ of the hanging block and the total mass is $m_1+m_2$, so $a=\dfrac{m_2g}{m_1+m_2}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    stem = f"A block of mass $m_1$ rests on a frictionless horizontal table. A light string attached to it passes over a light, frictionless pulley at the edge of the table and supports a hanging block of mass $m_2$. The blocks are released from rest. Which of the following is the magnitude of {what}?"
    return _a2("ph_sym_table_hanging", "2.5", stem, key, ds, rng, kwhy=why, concept="Symbolic acceleration and tension for a table block pulled by a hanging block", thinking=["Write Newton's second law for each block separately with the shared tension", "Eliminate the tension or the acceleration"],
               cond=[("the string and pulley are ideal", "the stem states a light string and a light frictionless pulley")], path="sympy solves the two equations of motion; numpy solves the 2x2 linear system at the chosen masses, and the printed option is evaluated by a TeX evaluator",
               facts=[f"m1={m1}", f"m2={m2}", f"ask_T={ask_T}"], est=75)


@retry_sep
def ph_sym_track_patch(rng):
    variant = rng.randrange(2)
    h = pick(rng, [1.5, 2.0, 3.0, 4.0]); d = pick(rng, [1.0, 2.0, 3.0]); mu = pick(rng, [0.1, 0.15, 0.2, 0.25]); v0 = pick(rng, [1.0, 2.0, 3.0])
    if h - mu * d < 0.4 * h:
        raise ValueError("not_enough_separated_distractors")
    env = {"g": G, "h": h, "d": d, "mu": mu, "v0": v0}
    g_, h_, d_, mu_, v0_ = sp.symbols("g h d mu v_0", positive=True)
    e0 = v0_ ** 2 if variant else 0
    sym_v = float(sp.sqrt(e0 + 2 * g_ * (h_ - mu_ * d_)).subs({g_: G, h_: h, d_: d, mu_: mu, v0_: v0}))
    vb = math.sqrt((v0 ** 2 if variant else 0.0) + 2 * G * h); x = 0.0; v = vb; dt = 1e-5  # 거친 구간을 작은 시간 간격으로 통과
    while x < d:
        v -= mu * G * dt; x += v * dt
    agree(sym_v, v, 2e-4, "v")
    if variant == 0:
        key_tex = r"\sqrt{2g(h-\mu d)}"
        wrongs = [("Subtracts the friction term from the speed itself instead of from the energy per unit mass.", r"\sqrt{2gh}-\mu d"), ("Adds the friction work to the starting height, treating friction as if it added energy.", r"\sqrt{2g(h+\mu d)}"),
                  ("Reports $v^2$ rather than $v$, leaving out the square root.", r"2g(h-\mu d)"), (r"Drops the factor 2 from the kinetic energy $\tfrac12mv^2$, so the energy balance gives $gh$ rather than $2gh$.", r"\sqrt{g(h-\mu d)}"),
                  ("Applies the friction coefficient as a fraction of the speed instead of subtracting the friction work.", r"\sqrt{2gh}(1-\mu)")]
        start = "released from rest"
    else:
        key_tex = r"\sqrt{v_0^2+2g(h-\mu d)}"
        wrongs = [("Subtracts the friction term from the speed instead of from the energy per unit mass.", r"\sqrt{v_0^2+2gh}-\mu d"), ("Adds the initial speed to the speed gained instead of combining the energies.", r"v_0+\sqrt{2g(h-\mu d)}"),
                  ("Adds the friction work to the energy, treating friction as if it added energy.", r"\sqrt{v_0^2+2g(h+\mu d)}"), ("Applies the friction coefficient as a fraction of the speed instead of subtracting the friction work.", r"\sqrt{v_0^2+2gh}(1-\mu)")]
        start = r"launched from the top with an initial speed $v_0$"
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    stem = f"A small block of mass $m$ is {start} at a height $h$ above a horizontal floor on a frictionless curved track. The track ends in a rough horizontal section of length $d$ with coefficient of kinetic friction $\\mu$. Which of the following is the speed of the block when it leaves the rough section?"
    why = r"The energy lost to friction is $\mu mgd$: " + (r"$\tfrac12mv^2=mgh-\mu mgd$" if variant == 0 else r"$\tfrac12mv^2=\tfrac12mv_0^2+mgh-\mu mgd$") + ", so the speed is " + (r"$v=\sqrt{2g(h-\mu d)}$." if variant == 0 else r"$v=\sqrt{v_0^2+2g(h-\mu d)}$.")
    return _a2("ph_sym_track_patch", "3.4", stem, key, ds, rng, kwhy=why, concept="Symbolic speed after a rough patch from energy conservation with friction work", thinking=["Write the energy balance from the start to the end of the rough section, subtracting the friction work $\\mu mgd$", "Solve for the speed and check the mass cancels"],
               cond=[("the curved part of the track is frictionless", "the stem states a frictionless curved track and friction only in the horizontal section")], path="sympy solves the energy equation; a small-time-step simulation of the braking over the rough section reproduces the speed, and the printed option is evaluated by a TeX evaluator",
               facts=[f"h={h}", f"d={d}", f"mu={mu}", f"v0={v0}", f"variant={variant}"], est=85)


@retry_sep
def ph_sym_collision(rng):
    variant = rng.randrange(3)
    m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [4.0, 5.0, 6.0]); v1 = pick(rng, [2.0, 3.0, 4.0]); v2 = pick(rng, [1.0, 2.0])
    env = {"m1": m1, "m2": m2, "v": v1, "v1": v1, "v2": v2, "m": m1, "M": m2}
    M1, M2, V1, V2, Vf = sp.symbols("m_1 m_2 v_1 v_2 v_f", positive=True)
    if variant == 0:
        sol = sp.solve(sp.Eq(M1 * V1, (M1 + M2) * Vf), Vf)[0]; sym_v = float(sol.subs({M1: m1, M2: m2, V1: v1}))
        vcm = (m1 * v1) / (m1 + m2); agree(sym_v, vcm, 1e-9, "vf")
        key_tex = r"\frac{m_1v_1}{m_1+m_2}"
        wrongs = [("Divides by the mass of the target cart only, forgetting that the cart that was moving is part of the combined object.", r"\frac{m_1v_1}{m_2}"), ("Multiplies by the total mass and divides by the moving cart's mass, inverting the momentum balance.", r"\frac{(m_1+m_2)v_1}{m_1}"),
                  ("Uses the difference of the masses in the denominator, as for a collision in which the carts move opposite ways.", r"\frac{m_1v_1}{m_1-m_2}"), ("Puts the target cart's mass in the numerator, giving its momentum rather than the initial momentum of the moving cart.", r"\frac{m_2v_1}{m_1+m_2}")]
        stem = "A cart of mass $m_1$ moving at speed $v_1$ on a frictionless track collides with a stationary cart of mass $m_2$. The carts stick together. Which of the following is the speed of the combined carts after the collision?"
        why = r"Momentum is conserved: $m_1v_1=(m_1+m_2)v_f$, so $v_f=\dfrac{m_1v_1}{m_1+m_2}$."
    elif variant == 1:
        sol = sp.solve(sp.Eq(M1 * V1 - M2 * V2, (M1 + M2) * Vf), Vf)[0]; sym_v = float(sol.subs({M1: m1, M2: m2, V1: v1, V2: v2}))
        vcm = (m1 * v1 - m2 * v2) / (m1 + m2); agree(sym_v, vcm, 1e-9, "vf")
        if abs(sym_v) < 0.3:
            raise ValueError("not_enough_separated_distractors")
        key_tex = r"\frac{m_1v_1-m_2v_2}{m_1+m_2}"
        wrongs = [("Adds the two momenta, treating both carts as moving in the same direction.", r"\frac{m_1v_1+m_2v_2}{m_1+m_2}"), ("Subtracts the speeds instead of the momenta before dividing by the total mass.", r"\frac{m_1(v_1-v_2)}{m_1+m_2}"),
                  ("Reverses which cart's momentum is larger, so the sign of the result is flipped.", r"\frac{m_2v_2-m_1v_1}{m_1+m_2}"), ("Divides the momentum difference by the difference of the masses instead of the total mass.", r"\frac{m_1v_1-m_2v_2}{m_2-m_1}")]
        stem = "A cart of mass $m_1$ moving to the right at speed $v_1$ collides head-on with a cart of mass $m_2$ moving to the left at speed $v_2$ on a frictionless track. The carts stick together. Taking right as positive, which of the following is the velocity of the combined carts after the collision?"
        why = r"Momentum is conserved with right positive: $m_1v_1-m_2v_2=(m_1+m_2)v_f$, so $v_f=\dfrac{m_1v_1-m_2v_2}{m_1+m_2}$."
    else:
        sol = sp.solve(sp.Eq(0, M1 * V1 - M2 * Vf), Vf)[0]; sym_v = float(sol.subs({M1: m1, M2: m2, V1: v1}))
        agree(sym_v, m1 * v1 / m2, 1e-9, "vf")
        key_tex = r"\frac{m_1v_1}{m_2}"
        wrongs = [("Uses the total mass in the denominator, as if the ball stayed on the cannon.", r"\frac{m_1v_1}{m_1+m_2}"), ("Inverts the mass ratio, so the heavier object moves faster.", r"\frac{m_2v_1}{m_1}"), ("Takes the recoil speed to equal the ball's speed because the forces are equal and opposite.", r"v_1"),
                  ("Assumes the ball and the cannon end with equal kinetic energies instead of equal and opposite momenta.", r"v_1\sqrt{\frac{m_1}{m_2}}")]
        stem = "A cannon of mass $m_2$, not including the ball, rests on a frictionless horizontal surface. It fires a ball of mass $m_1$ horizontally with speed $v_1$ relative to the ground. Which of the following is the recoil speed of the cannon immediately after the ball leaves it?"
        why = r"The total momentum is zero before and after: $0=m_1v_1-m_2v_f$, so $v_f=\dfrac{m_1v_1}{m_2}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_collision", "4.3", stem, key, ds, rng, kwhy=why, concept="Symbolic final velocity from conservation of linear momentum (perfectly inelastic collision or recoil)", thinking=["Write the total momentum before and after with signs for direction", "Solve the momentum equation for the final velocity"],
               cond=[("no net external horizontal force", "the stem states a frictionless surface")], path="sympy solves the momentum equation; the center-of-mass velocity computed with numpy gives the same value, and the printed option is evaluated by a TeX evaluator",
               facts=[f"m1={m1}", f"m2={m2}", f"v1={v1}", f"v2={v2}", f"variant={variant}"], est=75)


@retry_sep
def ph_sym_beam_cable(rng):
    variant = rng.randrange(2)
    th_d = pick(rng, [30, 37, 45, 53, 60]); M = pick(rng, [4.0, 6.0, 8.0]); m = pick(rng, [2.0, 3.0, 5.0])
    thr = math.radians(th_d); env = {"M": M, "m": m, "theta": thr, "g": G}
    M_, m_, L_, th, T_, g_ = sp.symbols("M m L theta T g", positive=True)
    load = m_ if variant else 0
    sol = sp.solve(sp.Eq(T_ * sp.sin(th) * L_, M_ * g_ * L_ / 2 + load * g_ * L_), T_)[0]
    sym_v = float(sol.subs({M_: M, m_: m, th: thr, g_: G, L_: 1.0}))
    # 수치 경로: 힘·토크 평형을 연립해 (T, Hx, Hy) 를 푼다(L=1, 힌지가 원점; 케이블은 보 끝 (1,0)에서 방향 (-cosθ, sinθ))
    ml = m if variant else 0.0
    A = np.array([[-math.cos(thr), 1.0, 0.0], [math.sin(thr), 0.0, 1.0], [math.sin(thr), 0.0, 0.0]])  # Fx ; Fy ; 힌지 토크
    rhs = np.array([0.0, (M + ml) * G, M * G / 2 + ml * G])
    Tn = np.linalg.solve(A, rhs)[0]
    agree(sym_v, Tn, 1e-9, "T")
    if variant == 0:
        key_tex = r"\frac{Mg}{2\sin\theta}"
        wrongs = [(r"Uses the cosine of the angle, taking the component of the tension along the beam instead of perpendicular to it.", r"\frac{Mg}{2\cos\theta}"), ("Multiplies by the sine instead of dividing, so the tension shrinks as the cable gets steeper.", r"\frac{Mg\sin\theta}{2}"),
                  ("Places the weight of the beam at its end instead of at its center, leaving out the factor of one half.", r"\frac{Mg}{\sin\theta}"), ("Takes the tension to be half the weight, ignoring the angle of the cable.", r"\frac{Mg}{2}")]
        stem = r"A uniform horizontal beam of mass $M$ and length $L$ is attached to a wall by a hinge. A light cable runs from the free end of the beam to a point on the wall above the hinge, making an angle $\theta$ with the beam. Which of the following is the tension in the cable?"
        why = r"Torques about the hinge balance: $T\sin\theta\,L=Mg\,\tfrac L2$, so $T=\dfrac{Mg}{2\sin\theta}$."
    else:
        key_tex = r"\frac{(M+2m)g}{2\sin\theta}"
        wrongs = [("Places the weight of the beam at its end instead of at its center.", r"\frac{(M+m)g}{\sin\theta}"), (r"Uses the cosine of the angle, taking the component of the tension along the beam instead of perpendicular to it.", r"\frac{(M+2m)g}{2\cos\theta}"),
                  ("Treats the hanging mass as acting at the center of the beam, so only half its weight enters the torque.", r"\frac{(M+m)g}{2\sin\theta}"), ("Multiplies by the sine instead of dividing, so the tension shrinks as the cable gets steeper.", r"\frac{(M+2m)g\sin\theta}{2}")]
        stem = r"A uniform horizontal beam of mass $M$ and length $L$ is attached to a wall by a hinge. A block of mass $m$ hangs from the free end. A light cable runs from the free end of the beam to a point on the wall above the hinge, making an angle $\theta$ with the beam. Which of the following is the tension in the cable?"
        why = r"Torques about the hinge balance: $T\sin\theta\,L=Mg\,\tfrac L2+mgL$, so $T=\dfrac{(M+2m)g}{2\sin\theta}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_beam_cable", "5.5", stem, key, ds, rng, kwhy=why, concept="Symbolic cable tension from rotational equilibrium of a hinged beam", thinking=["Choose the hinge as the axis so the hinge force has no torque", "Set the clockwise and counterclockwise torques equal, using the perpendicular component of the tension"],
               cond=[("the beam is in static equilibrium", "the stem describes a horizontal beam held by a hinge and a cable")], path="sympy solves the torque balance about the hinge; numpy solves the linear system for the cable tension, and the printed option is evaluated by a TeX evaluator",
               facts=[f"theta_deg={th_d}", f"M={M}", f"m={m}", f"variant={variant}"], est=85)


@retry_sep
def ph_sym_spring_speed(rng):
    variant = rng.randrange(2)
    m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [20.0, 50.0, 80.0, 120.0]); A = pick(rng, [0.1, 0.2, 0.3]); x = A * pick(rng, [0.3, 0.5, 0.6])
    env = {"m": m, "k": k, "A": A, "x": x}
    m_, k_, A_, x_ = sp.symbols("m k A x", positive=True)
    sym_e = A_ * sp.sqrt(k_ / m_) if variant == 0 else sp.sqrt(k_ * (A_ ** 2 - x_ ** 2) / m_)
    sym_v = float(sym_e.subs({m_: m, k_: k, A_: A, x_: x}))
    w = math.sqrt(k / m)  # 수치 경로: 운동방정식 x'' = -(k/m) x 를 RK4 로 적분
    T = 2 * math.pi / w; n = 4000; y = np.array([A, 0.0]); best = 0.0; got = None
    f = lambda t, s: np.array([s[1], -(k / m) * s[0]])  # noqa: E731
    h = T / n; t = 0.0
    for _ in range(n // 2):
        k1 = f(t, y); k2 = f(t, y + h / 2 * k1); k3 = f(t, y + h / 2 * k2); k4 = f(t, y + h * k3); y2 = y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        best = max(best, abs(y2[1]))
        if got is None and y2[0] <= x < y[0]:
            fr = (y[0] - x) / (y[0] - y2[0]); got = abs(y[1] + fr * (y2[1] - y[1]))
        y = y2; t += h
    agree(sym_v, best if variant == 0 else got, 2e-4, "v")
    if variant == 0:
        key_tex = r"A\sqrt{\frac{k}{m}}"
        wrongs = [("Inverts the ratio under the root, so a stiffer spring gives a slower oscillator.", r"A\sqrt{\frac{m}{k}}"), ("Gives the maximum acceleration $kA/m$ instead of the maximum speed.", r"\frac{kA}{m}"),
                  (r"Takes the root of the amplitude as well, as if $kA^2$ were $kA$.", r"\sqrt{\frac{kA}{m}}"), ("Leaves out the square root, so the angular frequency is $k/m$ instead of $\\sqrt{k/m}$.", r"A\frac{k}{m}")]
        stem = "A block of mass $m$ on a frictionless horizontal surface is attached to a spring of spring constant $k$. The block is pulled a distance $A$ from equilibrium and released from rest. Which of the following is the maximum speed of the block?"
        why = r"At the equilibrium position all the energy is kinetic: $\tfrac12mv_{max}^2=\tfrac12kA^2$, so $v_{max}=A\sqrt{k/m}$."
    else:
        key_tex = r"\sqrt{\frac{k(A^2-x^2)}{m}}"
        wrongs = [(r"Squares the difference $(A-x)$ instead of taking the difference of the squares in the energy balance.", r"\sqrt{\frac{k(A-x)^2}{m}}"), ("Adds the elastic energy at the position to the total instead of subtracting it.", r"\sqrt{\frac{k(A^2+x^2)}{m}}"),
                  (r"Uses the angular frequency times $(A-x)$, treating the speed as linear in the distance to the turning point.", r"\sqrt{\frac{k}{m}}(A-x)"), (r"Reports $v^2$ rather than $v$, leaving out the square root.", r"\frac{k(A^2-x^2)}{m}")]
        stem = "A block of mass $m$ on a frictionless horizontal surface is attached to a spring of spring constant $k$ and oscillates with amplitude $A$. Which of the following is the speed of the block when it is a distance $x$ from the equilibrium position, where $x<A$?"
        why = r"Energy conservation gives $\tfrac12kA^2=\tfrac12mv^2+\tfrac12kx^2$, so $v=\sqrt{k(A^2-x^2)/m}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_spring_speed", "7.4", stem, key, ds, rng, kwhy=why, concept="Symbolic speed of a spring oscillator from conservation of energy", thinking=["Write the total mechanical energy at the turning point", "Equate it to kinetic plus elastic energy at the position of interest and solve for the speed"],
               cond=[("the surface is frictionless and the spring is ideal", "the stem states a frictionless surface and a spring constant")], path="sympy solves the energy balance; an RK4 integration of the equation of motion over half a period reproduces the maximum speed or the speed at the position, and the printed option is evaluated by a TeX evaluator",
               facts=[f"m={m}", f"k={k}", f"A={A}", f"x={x}", f"variant={variant}"], est=80)


@retry_sep
def ph_sym_float_force(rng):
    variant = rng.randrange(2)
    rb = pick(rng, [400.0, 600.0, 700.0, 800.0]); rf = pick(rng, [1000.0, 1200.0, 1030.0]); ro = pick(rng, [2700.0, 7800.0, 8900.0]); V = pick(rng, [1.0e-3, 2.0e-3, 5.0e-4])
    env = {"rhob": rb, "rhof": rf, "rhoo": ro, "V": V, "g": G}
    rb_, rf_, ro_, V_, g_, T_ = sp.symbols("rho_b rho_f rho_o V g T", positive=True)
    if variant == 0:
        sym_v = float((rb_ / rf_).subs({rb_: rb, rf_: rf}))
        # 수치 경로: 몸체 부피 V 에서 잠긴 부피 Vs 를 이분법으로(부력 = 무게)
        Vs = bisect(lambda s: rf * G * s - rb * G * V, 0.0, 2 * V); agree(sym_v, Vs / V, 1e-9, "frac")
        key_tex = r"\frac{\rho_b}{\rho_f}"
        wrongs = [("Inverts the ratio of the densities, so the denser block would float higher.", r"\frac{\rho_f}{\rho_b}"), ("Reports the fraction that sticks out of the fluid instead of the fraction submerged.", r"1-\frac{\rho_b}{\rho_f}"),
                  ("Compares the block's density to the sum of the densities instead of to the fluid density alone.", r"\frac{\rho_b}{\rho_b+\rho_f}"), ("Keeps a factor of $g$ that cancels between the weight and the buoyant force, which gives a quantity with the wrong units for a fraction.", r"\frac{g\rho_b}{\rho_f}")]
        stem = r"A uniform solid block of density $\rho_b$ floats at rest in a fluid of density $\rho_f$, with $\rho_b<\rho_f$. Which of the following is the fraction of the block's volume that is below the surface of the fluid?"
        why = r"Floating means the buoyant force equals the weight: $\rho_f V_{sub}g=\rho_bVg$, so $V_{sub}/V=\rho_b/\rho_f$."
    else:
        sym_v = float(((ro_ - rf_) * V_ * g_).subs({ro_: ro, rf_: rf, V_: V, g_: G}))
        s = V ** (1 / 3); z = 0.7  # 수치 경로: 한 변 s 인 정육면체 윗면 깊이 z — 압력 차 x 면적으로 부력을 구하고(깊이와 무관) 줄 장력 = 무게 - 부력
        Fb = (rf * G * (z + s) - rf * G * z) * s * s; agree(sym_v, ro * V * G - Fb, 1e-9, "T")
        key_tex = r"(\rho_o-\rho_f)Vg"
        wrongs = [("Uses only the weight of the object, leaving out the buoyant force that the fluid exerts.", r"\rho_oVg"), ("Uses only the buoyant force, as if the string supported the displaced fluid instead of the object.", r"\rho_fVg"),
                  ("Adds the buoyant force to the weight instead of subtracting it.", r"(\rho_o+\rho_f)Vg"), ("Uses the density ratio times the weight, which is not a force balance.", r"\frac{\rho_o-\rho_f}{\rho_o}Vg")]
        stem =r"A solid object of volume $V$ and density $\rho_o$ hangs at rest from a light string, completely submerged in a fluid of density $\rho_f$, with $\rho_o>\rho_f$. Which of the following is the tension in the string?"
        why = r"The object is in equilibrium: $T+\rho_fVg=\rho_oVg$, so $T=(\rho_o-\rho_f)Vg$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    topic = "8.3"
    return _a2("ph_sym_float_force", topic, stem, key, ds, rng, kwhy=why, concept="Symbolic submerged fraction or string tension from the buoyant force balance", thinking=["Write the buoyant force as the weight of the displaced fluid", "Set the net force on the object to zero and solve"],
               cond=[("the object is at rest", "the stem states the object floats at rest or hangs at rest")], path="sympy solves the force balance; a bisection search on the submerged volume or the numeric force difference reproduces the value, and the printed option is evaluated by a TeX evaluator",
               facts=[f"rhob={rb}", f"rhof={rf}", f"rhoo={ro}", f"V={V}", f"variant={variant}"], est=75)


@retry_sep
def ph_sym_vertical_throw(rng):
    variant = rng.randrange(3)
    v0 = pick(rng, [8.0, 10.0, 12.0, 15.0]); h = pick(rng, [5.0, 10.0, 20.0])
    env = {"v0": v0, "g": G, "h": h}
    v0_, g_, h_, t_ = sp.symbols("v_0 g h t", positive=True)
    if variant == 0:
        sym_v = float((v0_ ** 2 / (2 * g_)).subs({v0_: v0, g_: G}))
        ts = np.linspace(0, v0 / G * 2, 200001); ys = v0 * ts - 0.5 * G * ts ** 2; agree(sym_v, float(ys.max()), 1e-6, "H")
        key_tex = r"\frac{v_0^2}{2g}"
        wrongs = [("Drops the factor of 2 from the kinematics equation $v^2=v_0^2-2gH$.", r"\frac{v_0^2}{g}"), ("Gives the time to reach the top, $v_0/g$, instead of a height.", r"\frac{v_0}{g}"),
                  ("Puts the gravitational acceleration in the numerator, so the height grows with $g$.", r"\frac{gv_0^2}{2}"), (r"Divides the speed (not its square) by $2g$, which does not have the units of a length.", r"\frac{v_0}{2g}")]
        stem = "A ball is thrown straight up from level ground with initial speed $v_0$. Air resistance is negligible. Which of the following is the maximum height of the ball above the ground?"
        why = r"At the top the speed is zero: $0=v_0^2-2gH$, so $H=\dfrac{v_0^2}{2g}$."
        topic = "1.2"
    elif variant == 1:
        sym_v = float((2 * v0_ / g_).subs({v0_: v0, g_: G}))
        ts = np.linspace(0, 2 * v0 / G * 1.5, 300001); ys = v0 * ts - 0.5 * G * ts ** 2; tr = float(ts[np.where(ys[1:] <= 0)[0][0] + 1]); agree(sym_v, tr, 1e-4, "t")
        key_tex = r"\frac{2v_0}{g}"
        wrongs = [("Gives only the time to reach the top and forgets the way down.", r"\frac{v_0}{g}"), ("Gives a quantity with the units of a height times a time, using the square of the speed.", r"\frac{2v_0^2}{g}"),
                  (r"Takes the time to be $v_0/(2g)$, putting the factor 2 under the acceleration instead of the numerator.", r"\frac{v_0}{2g}"), (r"Takes a square root of the time formula, mixing the time with the distance relation.", r"\sqrt{\frac{2v_0}{g}}")]
        stem = "A ball is thrown straight up from level ground with initial speed $v_0$. Air resistance is negligible. Which of the following is the total time from release until the ball returns to the ground?"
        why = r"The vertical position is $y=v_0t-\tfrac12gt^2$, which returns to zero at $t=\dfrac{2v_0}{g}$."
        topic = "1.2"
    else:
        sym_v = float(sp.sqrt(v0_ ** 2 + 2 * g_ * h_).subs({v0_: v0, g_: G, h_: h}))
        dt = 1e-4; y = h; v = v0
        while y > 0:
            v -= G * dt; y += v * dt
        agree(sym_v, abs(v), 1e-3, "v")
        key_tex = r"\sqrt{v_0^2+2gh}"
        wrongs = [("Adds the initial speed to the speed gained in falling instead of adding the squares.", r"v_0+\sqrt{2gh}"), ("Subtracts the energy term, as if the ball lost speed in falling from the cliff.", r"\sqrt{v_0^2-2gh}"),
                  (r"Ignores the initial upward speed, which is the same on the way back down at the launch level.", r"\sqrt{2gh}"), (r"Reports the square of the speed, leaving out the square root.", r"v_0^2+2gh")]
        stem = "A ball is thrown straight up with initial speed $v_0$ from the edge of a cliff of height $h$ above level ground. Air resistance is negligible. Which of the following is the speed of the ball just before it hits the ground at the foot of the cliff?"
        why = r"Energy per unit mass: $\tfrac12v^2=\tfrac12v_0^2+gh$, so $v=\sqrt{v_0^2+2gh}$."
        topic = "1.2"
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_vertical_throw", topic, stem, key, ds, rng, kwhy=why, concept="Symbolic kinematics of a ball thrown straight up: height, time of flight or impact speed", thinking=["Choose the kinematics relation that links the unknown to the given symbols", "Solve symbolically before substituting anything"],
               cond=[("air resistance is negligible", "the stem states that air resistance is negligible")], path="sympy solves the constant-acceleration equation; a dense numeric sampling or a small-time-step simulation of the motion reproduces the value, and the printed option is evaluated by a TeX evaluator",
               facts=[f"v0={v0}", f"h={h}", f"variant={variant}"], est=70)


# ======================= 2.C 비교·순위 =======================
LBL = ["A", "B", "C", "D"]


def _rank_loop(rng, make, tie_tol=MIN_REL_SEP):
    """make(rng) -> (data, vals, wrong_rules). 동순위가 없고 서로 다른 오답 순위가 3개 이상 나올 때까지 같은 rng 로 다시 뽑는다(결정적)."""
    for _ in range(600):
        out = make(rng)
        data, vals, rules = out[0], out[1], out[2]
        try:
            key, ds, order = rank_opts(vals, LBL, rules, tie_tol)
        except ValueError:
            continue
        return data, vals, key, ds, order, out[3:] if len(out) > 3 else ()
    raise ValueError("no_rank_sample")


def ph_rank_accel(rng):
    def make(r):
        Fs = r.sample([4, 6, 8, 10, 12, 15, 18, 20, 24], 4); ms = r.sample([1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0], 4)
        vals = {L: Fs[i] / ms[i] for i, L in enumerate(LBL)}
        rules = [("Ranks by the net force alone, ignoring the mass.", {L: Fs[i] for i, L in enumerate(LBL)}), ("Ranks by the mass, as if a more massive object accelerates more.", {L: ms[i] for i, L in enumerate(LBL)}),
                 ("Ranks by the product of force and mass instead of their ratio.", {L: Fs[i] * ms[i] for i, L in enumerate(LBL)}), ("Ranks from least to greatest instead of from greatest to least.", {L: -vals[L] for L in LBL})]
        return (Fs, ms), vals, rules
    (Fs, ms), vals, key, ds, order, _ = _rank_loop(rng, make)
    # 독립 경로: 정확 분수 정렬
    ex = sorted(LBL, key=lambda L: -Fr(str(Fs[LBL.index(L)])) / Fr(str(ms[LBL.index(L)]))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"object {L} has a net force of ${Fs[i]:g}\\text{{ N}}$ and a mass of ${ms[i]:g}\\text{{ kg}}$" for i, L in enumerate(LBL))
    stem = f"Four objects each move along a straight line on a frictionless surface under a single horizontal net force: {rows}. Rank the magnitudes of the accelerations of the objects from greatest to least."
    st = ", ".join(f"{L}: {Fs[i] / ms[i]:.2f}" for i, L in enumerate(LBL))
    key.why = f"Newton's second law gives $a=F/m$, so the accelerations in $\\text{{m/s}}^2$ are {st}, which ranks as {key.text}."
    return _c2("ph_rank_accel", "2.5", stem, key, ds, rng, kwhy=None, concept="Ranking accelerations from net force and mass", thinking=["Divide each net force by its mass", "Order the four quotients from greatest to least"], cond=[("each object has a single net force", "the stem gives the net force on each object")],
               path="exact fractions of force over mass are sorted and compared with the floating-point ordering", facts=[f"F={json.dumps(Fs)}", f"m={json.dumps(ms)}", f"order={json.dumps(order)}"], est=70)


def ph_rank_rolling(rng):
    TYPES = [("a hoop", 1.0), ("a solid cylinder", 0.5), ("a solid sphere", 0.4), ("a thin spherical shell", 2 / 3)]

    def make(r):
        qty = r.randrange(3)  # 0 속력, 1 병진 운동에너지, 2 바닥까지 걸리는 시간(짧은 순)
        ms = r.sample([1.0, 2.0, 3.0, 4.0, 5.0], 4); rs = r.sample([0.10, 0.15, 0.20, 0.25, 0.30], 4); ks = r.sample(range(4), 4)
        v2 = {L: 1.0 / (1 + TYPES[ks[i]][1]) for i, L in enumerate(LBL)}  # v^2 / (2 g h)
        if qty == 0:
            vals = dict(v2)
        elif qty == 1:
            vals = {L: ms[i] * v2[L] for i, L in enumerate(LBL)}
        else:
            vals = {L: -math.sqrt(1 + TYPES[ks[i]][1]) for i, L in enumerate(LBL)}  # 시간 ∝ √(1+k): 짧은 순서가 큰 값이 되도록 부호 반전
        wr = [("Ranks by the mass of the objects, as if a heavier object rolls faster.", {L: ms[i] for i, L in enumerate(LBL)}), ("Ranks by the radius of the objects, as if a larger object rolls faster.", {L: rs[i] for i, L in enumerate(LBL)}),
              ("Ranks the objects in the reverse of the correct order.", {L: -vals[L] for L in LBL}), ("Ranks by the mass times the radius, which is not what decides the motion.", {L: ms[i] * rs[i] for i, L in enumerate(LBL)})]
        if qty == 1:
            wr.append(("Ranks by the speed at the bottom alone, forgetting that the translational kinetic energy also depends on the mass.", dict(v2)))
        return (qty, ms, rs, ks), vals, wr
    (qty, ms, rs, ks), vals, key, ds, order, _ = _rank_loop(rng, make, tie_tol=0.03)
    # 독립 경로: 병진·회전 운동방정식을 선형계로 풀어 경사 가속도 a 를 구한다(질량 m, I=k m R^2, 마찰력 f). 같은 거리를 갈 때 v^2 ∝ a, KE ∝ m a, 시간 ∝ 1/√a.
    th = 0.4; acc = {}
    for i, L in enumerate(LBL):
        k = TYPES[ks[i]][1]
        acc[L] = float(np.linalg.solve(np.array([[ms[i], 1.0], [ms[i] * k, -1.0]]), np.array([ms[i] * G * math.sin(th), 0.0]))[0])
    chk = {L: (acc[L] * ms[LBL.index(L)] if qty == 1 else acc[L]) for L in LBL}
    assert sorted(LBL, key=lambda L: -chk[L]) == order, "rank_path_mismatch"
    desc = "; ".join(f"{L}: {TYPES[ks[i]][0]} of mass ${ms[i]:g}\\text{{ kg}}$ and radius ${rs[i]:g}\\text{{ m}}$" for i, L in enumerate(LBL))
    ask = ["the speeds of the objects at the bottom, from greatest to least", "the translational kinetic energies of the objects at the bottom, from greatest to least", "the times the objects take to reach the bottom, from shortest to longest"][qty]
    stem = f"Four uniform objects are released from rest at the top of the same incline and roll down it without slipping. {desc}. Rank {ask}."
    why = ["For rolling without slipping $mgh=\\tfrac12mv^2(1+k)$ where $k=I/(mR^2)$, so $v^2=2gh/(1+k)$ and the object with the smallest $k$ is fastest",
           "Each object has $v^2=2gh/(1+k)$ with $k=I/(mR^2)$, so the translational kinetic energy $\\tfrac12mv^2=mgh/(1+k)$ depends on both the mass and $k$",
           "The acceleration down the incline is $a=g\\sin\\theta/(1+k)$ with $k=I/(mR^2)$, so the object with the smallest $k$ has the largest acceleration and the shortest time"][qty]
    key.why = f"{why}; the ranking is {key.text}."
    return _c2("ph_rank_rolling", "6.5", stem, key, ds, rng, kwhy=None, concept="Ranking rolling objects by rotational inertia factor, mass and the quantity asked", thinking=["Write the energy or force balance for rolling without slipping with $I=kmR^2$", "Find the order of the factor $1/(1+k)$ and bring in the mass if the quantity depends on it"],
               cond=[("rolling without slipping", "the stem states the objects roll without slipping from rest")], path="the incline acceleration of each object is found by solving the linear system of translational and rotational equations, and the ordering agrees with the energy-based ordering",
               facts=[f"qty={qty}", f"m={json.dumps(ms)}", f"r={json.dumps(rs)}", f"k={json.dumps([TYPES[j][1] for j in ks])}", f"order={json.dumps(order)}"], est=90)


def ph_rank_impulse(rng):
    MODES = [("sticks and stops", 0.0), ("rebounds with half the incoming speed", 0.5), ("rebounds with the incoming speed", 1.0)]

    def make(r):
        ms = r.sample([0.1, 0.2, 0.3, 0.4, 0.5], 4); vi = r.sample([2.0, 3.0, 4.0, 5.0, 6.0], 4); mode = [r.choice(MODES) for _ in range(4)]
        vals = {L: ms[i] * vi[i] * (1 + mode[i][1]) for i, L in enumerate(LBL)}
        rules = [("Ranks by the incoming momentum alone, ignoring the change of direction.", {L: ms[i] * vi[i] for i, L in enumerate(LBL)}), ("Ranks by the final momentum, as if the impulse were the momentum after the collision.", {L: ms[i] * vi[i] * mode[i][1] for i, L in enumerate(LBL)}),
                 ("Ranks by the mass of the balls only.", {L: ms[i] for i, L in enumerate(LBL)}), ("Treats a rebound as a smaller change in momentum than sticking, because the ball keeps moving.", {L: ms[i] * vi[i] * (1 - mode[i][1]) for i, L in enumerate(LBL)})]
        return (ms, vi, mode), vals, rules
    (ms, vi, mode), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(ms[LBL.index(L)])) * Fr(str(vi[LBL.index(L)])) * (1 + Fr(str(mode[LBL.index(L)][1]))))); assert ex == order, "rank_path_mismatch"
    desc = "; ".join(f"ball {L} has mass ${ms[i]:g}\\text{{ kg}}$, hits at ${vi[i]:g}\\text{{ m/s}}$ and {mode[i][0]}" for i, L in enumerate(LBL))
    stem = f"Four balls each strike a rigid wall head-on: {desc}. Rank the magnitudes of the impulses that the wall exerts on the balls from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.2f}" for L in LBL)
    key.why = f"The impulse equals the change in momentum, $m(v_{{in}}+v_{{out}})$ when a ball reverses direction; in $\\text{{kg·m/s}}$ these are {st}, which ranks as {key.text}."
    return _c2("ph_rank_impulse", "4.2", stem, key, ds, rng, kwhy=None, concept="Ranking impulses from the change in momentum including reversal of direction", thinking=["Find each ball's change in momentum with the sign of the velocity before and after", "Order the magnitudes"], cond=[("the wall is rigid and each ball moves along one line", "the stem describes head-on collisions with a wall")],
               path="exact fractions of m(v_in + v_out) are sorted and compared with the floating-point ordering", facts=[f"m={json.dumps(ms)}", f"vi={json.dumps(vi)}", f"mode={json.dumps([x[1] for x in mode])}", f"order={json.dumps(order)}"], est=85)


def ph_rank_torque(rng):
    def make(r):
        Fv = r.sample([10, 15, 20, 25, 30, 40], 4); rr = r.sample([0.10, 0.15, 0.20, 0.25, 0.30, 0.40], 4); th = [r.choice([30, 45, 60, 90]) for _ in range(4)]
        vals = {L: Fv[i] * rr[i] * math.sin(math.radians(th[i])) for i, L in enumerate(LBL)}
        rules = [("Ranks by the magnitude of the force alone.", {L: Fv[i] for i, L in enumerate(LBL)}), ("Ranks by the distance from the pivot alone.", {L: rr[i] for i, L in enumerate(LBL)}),
                 ("Ranks by force times distance, ignoring the angle between the force and the wrench.", {L: Fv[i] * rr[i] for i, L in enumerate(LBL)}), ("Ranks by the force times the sine of the angle, ignoring the distance from the pivot.", {L: Fv[i] * math.sin(math.radians(th[i])) for i, L in enumerate(LBL)})]
        return (Fv, rr, th), vals, rules
    (Fv, rr, th), vals, key, ds, order, _ = _rank_loop(rng, make)
    tt = {L: rr[i] * (Fv[i] * math.sin(math.radians(th[i]))) - 0.0 * (Fv[i] * math.cos(math.radians(th[i]))) for i, L in enumerate(LBL)}  # 독립 경로: 위치 (r,0) 와 힘 성분의 2차원 외적(z 성분) x*Fy - y*Fx
    assert sorted(LBL, key=lambda L: -abs(tt[L])) == order, "rank_path_mismatch"
    desc = "; ".join(f"{L}: ${Fv[i]:g}\\text{{ N}}$ at ${rr[i]:g}\\text{{ m}}$ from the pivot, ${th[i]}^\\circ$ from the wrench" for i, L in enumerate(LBL))
    stem = f"Four forces act on a wrench that turns a bolt about a fixed pivot. {desc}. Each angle is between the force and the line from the pivot to the point where the force acts. Rank the magnitudes of the torques about the pivot from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.2f}" for L in LBL)
    key.why = f"The torque magnitude is $\\tau=rF\\sin\\theta$; in $\\text{{N·m}}$ the four values are {st}, which ranks as {key.text}."
    return _c2("ph_rank_torque", "5.3", stem, key, ds, rng, kwhy=None, concept="Ranking torques from force, lever arm and angle", thinking=["Compute $rF\\sin\\theta$ for each situation", "Order the four torques"], cond=[("the angle is between the force and the lever arm", "the stem defines the angle between the force and the line from the pivot")],
               path="the z component of the two-dimensional cross product of the position and force vectors is sorted and compared with the sine formula ordering", facts=[f"F={json.dumps(Fv)}", f"r={json.dumps(rr)}", f"theta={json.dumps(th)}", f"order={json.dumps(order)}"], est=90)


def _first_zero_time(w2):
    """x'' = -w2 x, x(0)=1, v(0)=0 을 RK4 로 적분해 처음 x=0 이 되는 시각(주기의 1/4)을 선형 보간으로 측정."""
    w = math.sqrt(w2); hh = (math.pi / 2 / w) / 400; y = np.array([1.0, 0.0]); t = 0.0; f = lambda s: np.array([s[1], -w2 * s[0]])  # noqa: E731
    for _ in range(1000):
        k1 = f(y); k2 = f(y + hh / 2 * k1); k3 = f(y + hh / 2 * k2); k4 = f(y + hh * k3); y2 = y + hh / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        if y2[0] <= 0:
            return t + hh * y[0] / (y[0] - y2[0])
        y = y2; t += hh
    raise ValueError("no_zero_crossing")


def ph_rank_period(rng):
    def make(r):
        var = r.randrange(2)
        if var == 0:  # 질량-용수철
            p1 = r.sample([0.25, 0.5, 1.0, 2.0, 4.0], 4); p2 = r.sample([20.0, 40.0, 80.0, 160.0, 25.0], 4)
            vals = {L: 2 * math.pi * math.sqrt(p1[i] / p2[i]) for i, L in enumerate(LBL)}
            rules = [("Ranks by the mass alone, ignoring the spring constant.", {L: p1[i] for i, L in enumerate(LBL)}), ("Ranks by the spring constant, as if a stiffer spring gave a longer period.", {L: p2[i] for i, L in enumerate(LBL)}),
                     ("Ranks by the product of the mass and the spring constant instead of their ratio.", {L: p1[i] * p2[i] for i, L in enumerate(LBL)}), ("Ranks from shortest to longest period instead of longest to shortest.", {L: -vals[L] for L in LBL})]
        else:  # 단진자
            p1 = r.sample([0.25, 0.5, 1.0, 1.5, 2.0, 3.0], 4); p2 = r.sample([1.6, 3.7, 9.8, 24.8, 8.9], 4)
            vals = {L: 2 * math.pi * math.sqrt(p1[i] / p2[i]) for i, L in enumerate(LBL)}
            rules = [("Ranks by the length of the pendulum alone, ignoring the gravitational field strength.", {L: p1[i] for i, L in enumerate(LBL)}), ("Ranks by the gravitational field strength, as if a stronger field gave a longer period.", {L: p2[i] for i, L in enumerate(LBL)}),
                     ("Ranks by the product of the length and the field strength instead of their ratio.", {L: p1[i] * p2[i] for i, L in enumerate(LBL)}), ("Ranks from shortest to longest period instead of longest to shortest.", {L: -vals[L] for L in LBL})]
        return (var, p1, p2), vals, rules
    (var, p1, p2), vals, key, ds, order, _ = _rank_loop(rng, make)
    per = {L: 4 * _first_zero_time(p2[i] / p1[i]) for i, L in enumerate(LBL)}  # 두 경우 모두 w^2 = p2/p1 (k/m 또는 g/L)
    assert sorted(LBL, key=lambda L: -per[L]) == order, "rank_path_mismatch"
    if var == 0:
        desc = "; ".join(f"system {L} has a block of mass ${p1[i]:g}\\text{{ kg}}$ on a spring of constant ${p2[i]:g}\\text{{ N/m}}$" for i, L in enumerate(LBL))
        stem = f"Four mass-spring systems oscillate on frictionless horizontal surfaces with small amplitudes: {desc}. Rank the periods of the oscillations from longest to shortest."
        why = "For a mass-spring system $T=2\\pi\\sqrt{m/k}$"
    else:
        desc = "; ".join(f"pendulum {L} has a length of ${p1[i]:g}\\text{{ m}}$ where the gravitational field strength is ${p2[i]:g}\\text{{ N/kg}}$" for i, L in enumerate(LBL))
        stem = f"Four simple pendulums swing with small amplitudes: {desc}. Rank the periods of the oscillations from longest to shortest."
        why = "For a simple pendulum $T=2\\pi\\sqrt{L/g}$"
    st = ", ".join(f"{L}: {vals[L]:.2f}" for L in LBL)
    key.why = f"{why}; the periods in seconds are {st}, which ranks as {key.text}."
    return _c2("ph_rank_period", "7.2", stem, key, ds, rng, kwhy=None, concept="Ranking periods of oscillators from the period formula", thinking=["Write the period formula for the system type", "Compute or compare the ratio under the square root for each system"], cond=[("the oscillations have small amplitude", "the stem states small amplitudes")],
               path="an RK4 integration of each equation of motion measures the time of the first zero crossing (a quarter period), and the measured periods have the same ordering as the formula", facts=[f"var={var}", f"p1={json.dumps(p1)}", f"p2={json.dumps(p2)}", f"order={json.dumps(order)}"], est=90)


def ph_rank_pressure(rng):
    FL = [("water", 1000.0), ("oil", 800.0), ("salt water", 1030.0), ("glycerin", 1260.0), ("gasoline", 740.0)]

    def make(r):
        fs = r.sample(range(len(FL)), 4); hs = r.sample([0.5, 1.0, 1.5, 2.0, 3.0, 4.0], 4)
        vals = {L: FL[fs[i]][1] * G * hs[i] for i, L in enumerate(LBL)}
        rules = [("Ranks by the depth alone, ignoring the density of the liquid.", {L: hs[i] for i, L in enumerate(LBL)}), ("Ranks by the density of the liquid alone, ignoring the depth.", {L: FL[fs[i]][1] for i, L in enumerate(LBL)}),
                 ("Ranks by the density divided by the depth, as if pressure fell with depth.", {L: FL[fs[i]][1] / hs[i] for i, L in enumerate(LBL)}), ("Ranks from least to greatest instead of from greatest to least.", {L: -vals[L] for L in LBL})]
        return (fs, hs), vals, rules
    (fs, hs), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(FL[fs[LBL.index(L)]][1])) * Fr(str(hs[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    desc = "; ".join(f"container {L} holds {FL[fs[i]][0]} (density ${FL[fs[i]][1]:g}\\text{{ kg/m}}^3$) and the point is ${hs[i]:g}\\text{{ m}}$ below the surface" for i, L in enumerate(LBL))
    stem = f"Four open containers hold different liquids at rest: {desc}. Rank the gauge pressures at the four points from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.0f}" for L in LBL)
    key.why = f"The gauge pressure at depth $h$ is $\\rho gh$; in pascals the four values are {st}, which ranks as {key.text}."
    return _c2("ph_rank_pressure", "8.2", stem, key, ds, rng, kwhy=None, concept="Ranking gauge pressures from density and depth", thinking=["Compute $\\rho gh$ for each point", "Order the four pressures"], cond=[("the liquids are at rest in open containers", "the stem states open containers with liquids at rest")],
               path="exact fractions of density times depth are sorted and compared with the floating-point ordering", facts=[f"rho={json.dumps([FL[j][1] for j in fs])}", f"h={json.dumps(hs)}", f"order={json.dumps(order)}"], est=80)


def ph_rank_stop_distance(rng):
    def make(r):
        v0 = r.sample([10.0, 15.0, 20.0, 25.0, 30.0], 4); ab = r.sample([4.0, 5.0, 6.0, 8.0, 10.0], 4)
        vals = {L: v0[i] ** 2 / (2 * ab[i]) for i, L in enumerate(LBL)}
        rules = [("Ranks by the initial speed alone, ignoring the braking acceleration.", {L: v0[i] for i, L in enumerate(LBL)}), ("Ranks by the stopping time $v_0/a$, which is not the same ordering as the distance.", {L: v0[i] / ab[i] for i, L in enumerate(LBL)}),
                 ("Ranks by the reciprocal of the braking acceleration alone.", {L: 1 / ab[i] for i, L in enumerate(LBL)}), ("Ranks from least to greatest instead of from greatest to least.", {L: -vals[L] for L in LBL})]
        return (v0, ab), vals, rules
    (v0, ab), vals, key, ds, order, _ = _rank_loop(rng, make)
    sim = {}
    for i, L in enumerate(LBL):  # 독립 경로: 정지 시각까지 x(t)=v0 t - a t^2/2 를 촘촘히 표집해 마지막 값
        ts = np.linspace(0.0, v0[i] / ab[i], 100001); sim[L] = float((v0[i] * ts - 0.5 * ab[i] * ts ** 2)[-1])
    assert sorted(LBL, key=lambda L: -sim[L]) == order, "rank_path_mismatch"
    desc = "; ".join(f"car {L} travels at ${v0[i]:g}\\text{{ m/s}}$ and brakes at a constant ${ab[i]:g}\\text{{ m/s}}^2$" for i, L in enumerate(LBL))
    stem = f"Four cars brake uniformly to a stop on straight, level roads: {desc}. Rank the stopping distances from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.1f}" for L in LBL)
    key.why = f"With constant deceleration $d=v_0^2/(2a)$; in meters the four distances are {st}, which ranks as {key.text}."
    return _c2("ph_rank_stop_distance", "1.2", stem, key, ds, rng, kwhy=None, concept="Ranking stopping distances from initial speed and braking acceleration", thinking=["Use $v^2=v_0^2-2ad$ with a final speed of zero", "Compute $v_0^2/(2a)$ for each car and order them"], cond=[("each car brakes uniformly", "the stem states constant braking accelerations")],
               path="a dense numeric sampling of the position during each braking run gives the stopping distances, whose ordering matches $v_0^2/(2a)$", facts=[f"v0={json.dumps(v0)}", f"a={json.dumps(ab)}", f"order={json.dumps(order)}"], est=75)


def ph_rank_ramp_bottom(rng):
    def make(r):
        qty = r.randrange(2)  # 0 속력, 1 운동에너지
        hs = r.sample([0.5, 1.0, 1.5, 2.0, 2.5, 3.0], 4); ms = r.sample([1.0, 2.0, 3.0, 4.0, 5.0], 4)
        vals = {L: (math.sqrt(2 * G * hs[i]) if qty == 0 else ms[i] * G * hs[i]) for i, L in enumerate(LBL)}
        if qty == 0:
            rules = [("Ranks by the mass of the blocks, as if a heavier block reaches a higher speed.", {L: ms[i] for i, L in enumerate(LBL)}), ("Ranks by the product of the mass and the height, which is the energy and not the speed.", {L: ms[i] * hs[i] for i, L in enumerate(LBL)}),
                     ("Ranks by the height divided by the mass.", {L: hs[i] / ms[i] for i, L in enumerate(LBL)}), ("Ranks from least to greatest instead of from greatest to least.", {L: -vals[L] for L in LBL})]
        else:
            rules = [("Ranks by the release height alone, as if the kinetic energy did not depend on the mass.", {L: hs[i] for i, L in enumerate(LBL)}), ("Ranks by the mass alone, ignoring the height lost.", {L: ms[i] for i, L in enumerate(LBL)}),
                     ("Ranks by the height divided by the mass.", {L: hs[i] / ms[i] for i, L in enumerate(LBL)}), ("Ranks from least to greatest instead of from greatest to least.", {L: -vals[L] for L in LBL})]
        return (qty, hs, ms), vals, rules
    (qty, hs, ms), vals, key, ds, order, _ = _rank_loop(rng, make)
    sim = {}
    for i, L in enumerate(LBL):  # 독립 경로: 30° 경사에서 높이 h 만큼 내려오는 거리(길이 h/sin30°)를 작은 시간 간격으로 적분(무마찰이라 경사각과 무관해야 한다)
        a = G * math.sin(math.radians(30)); length = hs[i] / math.sin(math.radians(30)); v = 0.0; s = 0.0; dt = 1e-3
        while s < length:
            v += a * dt; s += v * dt
        sim[L] = v if qty == 0 else 0.5 * ms[i] * v * v
    assert sorted(LBL, key=lambda L: -sim[L]) == order, "rank_path_mismatch"
    desc = "; ".join(f"block {L} has mass ${ms[i]:g}\\text{{ kg}}$ and starts ${hs[i]:g}\\text{{ m}}$ above the floor" for i, L in enumerate(LBL))
    what = "the speeds of the blocks" if qty == 0 else "the kinetic energies of the blocks"
    stem = f"Four blocks slide from rest down four different frictionless ramps that all end at floor level: {desc}. Rank {what} at the bottom from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.1f}" for L in LBL)
    key.why = (f"Only gravity does work, so $v=\\sqrt{{2gh}}$; in m/s the four speeds are {st}" if qty == 0 else f"Only gravity does work, so $K=mgh$; in joules the four energies are {st}") + f", which ranks as {key.text}."
    return _c2("ph_rank_ramp_bottom", "3.4", stem, key, ds, rng, kwhy=None, concept="Ranking speeds or kinetic energies at the bottom of frictionless ramps", thinking=["Use energy conservation to relate the height lost to the speed or the kinetic energy", "Order the quantities, bringing in the mass only where it matters"], cond=[("the ramps are frictionless", "the stem states frictionless ramps and release from rest")],
               path="a time-stepped simulation of the motion down an equivalent 30 degree incline gives the same ordering as the energy formula", facts=[f"qty={qty}", f"h={json.dumps(hs)}", f"m={json.dumps(ms)}", f"order={json.dumps(order)}"], est=80)


STAGE_U1 = ["ph_sym_vertical_throw", "ph_rank_stop_distance"]
STAGE_U2 = ["ph_sym_incline_accel", "ph_sym_table_hanging", "ph_rank_accel"]
STAGE_U3 = ["ph_sym_track_patch", "ph_rank_ramp_bottom"]
STAGE_U4 = ["ph_sym_collision", "ph_rank_impulse"]
STAGE_U5 = ["ph_sym_beam_cable", "ph_rank_torque"]
STAGE_U6 = ["ph_rank_rolling"]
STAGE_U7 = ["ph_sym_spring_speed", "ph_rank_period"]
STAGE_U8 = ["ph_sym_float_force", "ph_rank_pressure"]
STAGE_S3 = STAGE_U1 + STAGE_U2 + STAGE_U3 + STAGE_U4 + STAGE_U5 + STAGE_U6 + STAGE_U7 + STAGE_U8
