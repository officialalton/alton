"""AP Physics C: Mechanics 원형 D — 단원 4(선운동량: 적분 충격량, 충돌, 질량 중심 속도)."""
from physc_common import *


@retry_sep
def pc_impulse_force_poly(rng):
    for _ in forever():
        c = pick(rng, [2.0, 3.0, 4.0, 6.0]); T = pick(rng, [2.0, 3.0, 4.0]); J = c * T ** 2 / 2
        agree(J, simpson(lambda s: c * s, 0, T), 1e-6, "J")
        break
    key, ds = num_opts(J, [(f"Multiplies the final force, ${sig(c * T)}\\text{{ N}}$, by the time, treating the force as constant.", c * T * T), (f"Reports the final force, ${sig(c * T)}\\text{{ N}}$, as the impulse without multiplying by any time.", c * T), (f"Integrates twice, $cT^3/6={sig(c * T ** 3 / 6)}\\text{{ N·s}}$.", c * T ** 3 / 6), (f"Applies the factor of one half twice, $cT^2/4={sig(c * T ** 2 / 4)}\\text{{ N·s}}$.", c * T ** 2 / 4)], "N·s")
    stem = f"The net force on an object moving along a line is $F(t)={c:g}t$, where $F$ is in newtons and $t$ is in seconds. What is the magnitude of the impulse delivered from $t=0$ to $t={T:g}\\text{{ s}}$?"
    return MQ("pc_impulse_force_poly", "4.2", "2.B", stem, key, ds, rng, "Impulse is the time integral of the force", ["Integrate the force over the interval", "Evaluate between the limits"],
              "sympy integral versus a Simpson integration", f"$J=\\int_0^T ct\\,dt=cT^2/2={sig(J)}\\text{{ N·s}}$.", [f"c={c}", f"T={T}"], est=75)


@retry_sep
def pc_impulse_parabola_speed(rng):
    for _ in forever():
        c = pick(rng, [1.0, 2.0, 3.0, 6.0]); T = pick(rng, [2.0, 3.0, 4.0, 6.0]); m = pick(rng, [0.5, 1.0, 2.0]); J = c * T ** 3 / 6; v = J / m
        agree(J, simpson(lambda s: c * s * (T - s), 0, T), 1e-6, "J")
        if v > 1:
            break
    key, ds = num_opts(v, [("Uses the peak force times the time, divided by the mass.", c * (T / 2) ** 2 * T / m), ("Integrates $c\\,t$ rather than $ct(T-t)$, giving $cT^2/(2m)$.", c * T ** 2 / (2 * m)), ("Forgets to divide by the mass.", J), ("Uses $cT^3/(3m)$, the integral of $t(T-t)$ with the wrong factor.", c * T ** 3 / (3 * m))], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ cart starts from rest on a frictionless track. A force along the track of magnitude $F(t)={c:g}\\,t\\,({T:g}-t)$ (in newtons, $t$ in seconds) acts from $t=0$ to $t={T:g}\\text{{ s}}$. What is the speed of the cart at $t={T:g}\\text{{ s}}$?"
    return MQ("pc_impulse_parabola_speed", "4.2", "2.B", stem, key, ds, rng, "Impulse-momentum theorem with a time-varying force", ["Integrate the force to find the impulse", "Set the impulse equal to the change in momentum"],
              "sympy integral versus a Simpson integration", f"$J=\\int_0^T ct(T-t)dt=cT^3/6={sig(J)}\\text{{ N·s}}$ and $v=J/m={sig(v)}\\text{{ m/s}}$.", [f"c={c}", f"T={T}", f"m={m}"], est=95)


@retry_sep
def pc_inelastic_collision_speed(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [1.0, 2.0, 4.0]); v1 = pick(rng, [4.0, 6.0, 8.0]); v2 = pick(rng, [-3.0, -2.0, 1.0, 2.0])
        vf = (m1 * v1 + m2 * v2) / (m1 + m2); sol = np.linalg.solve(np.array([[m1 + m2]]), np.array([m1 * v1 + m2 * v2])); agree(vf, sol[0], 1e-9, "vf")
        if abs(vf) > 0.5:
            break
    key, ds = signed_opts(vf, [("Averages the two speeds, $(v_1+v_2)/2$.", (v1 + v2) / 2), ("Ignores the direction of the second cart, adding the magnitudes of the momenta.", (m1 * v1 + m2 * abs(v2)) / (m1 + m2)), ("Divides the total momentum by only the first mass.", (m1 * v1 + m2 * v2) / m1), ("Uses the speed of the first cart, as if the second cart did not change the motion.", v1)], "m/s")
    stem = f"A ${m1:g}\\text{{ kg}}$ cart moving at ${v1:g}\\text{{ m/s}}$ to the right collides with a ${m2:g}\\text{{ kg}}$ cart moving at ${v2:g}\\text{{ m/s}}$ (positive is to the right) on a frictionless track. The carts stick together. What is their common velocity after the collision?"
    return MQ("pc_inelastic_collision_speed", "4.4", "2.B", stem, key, ds, rng, "Conservation of momentum in a perfectly inelastic collision", ["Write the total momentum with signs before the collision", "Divide by the total mass"],
              "numpy linalg.solve of the momentum equation recomputes the common velocity", f"$(m_1+m_2)v=m_1v_1+m_2v_2$ gives $v={sig(vf)}\\text{{ m/s}}$.", [f"m1={m1}", f"m2={m2}", f"v1={v1}", f"v2={v2}"], est=95)


@retry_sep
def pc_elastic_final_velocity(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0, 4.0]); m2 = pick(rng, [1.0, 2.0, 3.0, 4.0]); v = pick(rng, [4.0, 6.0, 8.0])
        if m1 == m2:
            continue
        v1p = (m1 - m2) / (m1 + m2) * v; v2p = 2 * m1 / (m1 + m2) * v
        sol = np.linalg.solve(np.array([[m1, m2], [1.0, -1.0]]), np.array([m1 * v, -v])); agree(v1p, sol[0], 1e-9, "v1")
        agree(0.5 * m1 * v * v, 0.5 * m1 * v1p ** 2 + 0.5 * m2 * v2p ** 2, 1e-9, "KE")
        break
    key, ds = signed_opts(v1p, [("Uses the result for a perfectly inelastic collision, $m_1v/(m_1+m_2)$.", m1 * v / (m1 + m2)), ("Swaps the masses, $(m_2-m_1)v/(m_1+m_2)$.", (m2 - m1) / (m1 + m2) * v), ("Reports the final velocity of the second block instead of the first block.", v2p), ("Assumes the first object keeps its speed.", v)], "m/s")
    stem = f"A ${m1:g}\\text{{ kg}}$ block moving at ${v:g}\\text{{ m/s}}$ makes a head-on elastic collision with a ${m2:g}\\text{{ kg}}$ block that is initially at rest on a frictionless surface. What is the velocity of the ${m1:g}\\text{{ kg}}$ block after the collision? Positive is the initial direction of motion."
    return MQ("pc_elastic_final_velocity", "4.4", "2.B", stem, key, ds, rng, "Elastic collision with conservation of momentum and kinetic energy", ["Write conservation of momentum and use the equal relative speeds of approach and separation", "Solve for the final velocity of the first block"],
              "numpy linalg.solve of momentum plus relative-speed equations; the kinetic energy is checked", f"$v_1'=\\dfrac{{m_1-m_2}}{{m_1+m_2}}v={sig(v1p)}\\text{{ m/s}}$.", [f"m1={m1}", f"m2={m2}", f"v={v}"], est=105)


@retry_sep
def pc_ballistic_pendulum(rng):
    for _ in forever():
        m = pick(rng, [0.010, 0.020, 0.050]); M = pick(rng, [1.0, 2.0, 3.0]); h = pick(rng, [0.05, 0.10, 0.20])
        v = (m + M) / m * math.sqrt(2 * CG * h)
        vf = m * v / (m + M); hh = vf ** 2 / (2 * CG); agree(hh, h, 1e-9, "h")
        break
    key, ds = num_opts(v, [(f"Uses only the swing speed, $\\sqrt{{2gh}}={sig(math.sqrt(2 * CG * h))}\\text{{ m/s}}$, as the bullet speed.", math.sqrt(2 * CG * h)), (f"Uses the mass ratio $M/m$ instead of $(m+M)/m$ in the momentum balance.", M / m * math.sqrt(2 * CG * h)),
                           ("Applies energy conservation through the collision, $\\tfrac12mv^2=(m+M)gh$, although the collision dissipates energy.", math.sqrt(2 * (m + M) * CG * h / m)), (f"Forgets the square root, $(m+M)(2gh)/m$.", (m + M) / m * 2 * CG * h)], "m/s")
    stem = f"A ${m * 1000:g}\\text{{ g}}$ bullet is fired into a ${M:g}\\text{{ kg}}$ block that hangs at rest from light strings and remains embedded. The block and bullet swing up to a maximum height of ${h * 100:g}\\text{{ cm}}$. What was the speed of the bullet just before impact?"
    return MQ("pc_ballistic_pendulum", "4.3", "2.B", stem, key, ds, rng, "Momentum conservation in the collision, then energy conservation in the swing", ["Use energy conservation to find the speed just after the collision", "Use momentum conservation to find the bullet speed"],
              "the swing height from the computed speeds is recomputed and compared with the given height", f"After the collision $v'=\\sqrt{{2gh}}$; then $mv=(m+M)v'$ gives $v={sig(v)}\\text{{ m/s}}$.", [f"m={m}", f"M={M}", f"h={h}"], est=110)


@retry_sep
def pc_explosion_recoil(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [3.0, 4.0, 6.0]); E = pick(rng, [24.0, 36.0, 48.0, 60.0])
        v1 = math.sqrt(2 * E * m2 / (m1 * (m1 + m2))); v2 = m1 * v1 / m2
        agree(E, 0.5 * m1 * v1 ** 2 + 0.5 * m2 * v2 ** 2, 1e-9, "E")
        if m1 != m2:
            break
    key, ds = num_opts(v1, [("Gives all of the energy to the lighter piece, $\\sqrt{2E/m_1}$.", math.sqrt(2 * E / m1)), ("Splits the energy equally between the two pieces.", math.sqrt(E / m1)), ("Uses the heavier piece's speed, $m_1v_1/m_2$.", v2), ("Ignores momentum conservation and uses $\\sqrt{2E/(m_1+m_2)}$.", math.sqrt(2 * E / (m1 + m2)))], "m/s")
    stem = f"A cart of total mass ${m1 + m2:g}\\text{{ kg}}$ is at rest on a frictionless track. A compressed spring releases ${E:g}\\text{{ J}}$ of energy and the cart splits into a ${m1:g}\\text{{ kg}}$ piece and a ${m2:g}\\text{{ kg}}$ piece moving in opposite directions. What is the speed of the ${m1:g}\\text{{ kg}}$ piece?"
    return MQ("pc_explosion_recoil", "4.3", "2.B", stem, key, ds, rng, "Momentum conservation and energy release in an explosion", ["Use momentum conservation for the equal and opposite momenta", "Use the released energy for the total kinetic energy and solve"],
              "sympy solves the two equations; the kinetic energy of the result is recomputed", f"$m_1v_1=m_2v_2$ and $\\tfrac12m_1v_1^2+\\tfrac12m_2v_2^2=E$ give $v_1={sig(v1)}\\text{{ m/s}}$.", [f"m1={m1}", f"m2={m2}", f"E={E}"], est=115)


@retry_sep
def pc_com_velocity_system(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [2.0, 4.0]); v1 = pick(rng, [6.0, 8.0, 10.0]); v2 = pick(rng, [-6.0, -4.0, -2.0, 2.0])
        vc = (m1 * v1 + m2 * v2) / (m1 + m2)
        xc = lambda t: (m1 * (0 + v1 * t) + m2 * (10 + v2 * t)) / (m1 + m2)  # noqa: E731
        agree(vc, nd(xc, 3.0), 1e-6, "vc")
        if abs(vc) > 0.5 and m1 != m2:
            break
    heavy = v1 if m1 > m2 else v2
    key, ds = signed_opts(vc, [("Averages the two velocities, ignoring the masses.", (v1 + v2) / 2), ("Divides the total momentum by the number of objects, 2, instead of by the total mass.", (m1 * v1 + m2 * v2) / 2), (f"Uses the velocity of the heavier object, ${heavy:g}\\text{{ m/s}}$.", heavy), ("Adds the velocities, $v_1+v_2$.", v1 + v2)], "m/s")
    stem = f"Two objects move along a line on a frictionless surface. Object 1 has mass ${m1:g}\\text{{ kg}}$ and velocity ${v1:g}\\text{{ m/s}}$; object 2 has mass ${m2:g}\\text{{ kg}}$ and velocity ${v2:g}\\text{{ m/s}}$ (positive is to the right). What is the velocity of the center of mass of the two-object system?"
    return MQ("pc_com_velocity_system", "4.1", "2.B", stem, key, ds, rng, "Velocity of the center of mass from total momentum", ["Find the total momentum of the system", "Divide by the total mass"],
              "the center-of-mass position is differentiated numerically", f"$v_{{cm}}=(m_1v_1+m_2v_2)/(m_1+m_2)={sig(vc)}\\text{{ m/s}}$.", [f"m1={m1}", f"m2={m2}", f"v1={v1}", f"v2={v2}"], est=85)


@retry_sep
def pc_momentum_ke_claim(rng):
    m1 = pick(rng, [2.0, 3.0]); m2 = pick(rng, [1.0, 2.0]); v = pick(rng, [4.0, 6.0]); vf = m1 * v / (m1 + m2)
    ke0 = 0.5 * m1 * v * v; kef = 0.5 * (m1 + m2) * vf * vf; assert kef < ke0
    key, ds = sentence_options(f"Momentum is conserved but kinetic energy decreases from ${sig(ke0)}\\text{{ J}}$ to ${sig(kef)}\\text{{ J}}$, because the collision is perfectly inelastic and the objects stick together.", "Sticking collisions conserve momentum but dissipate kinetic energy as thermal and deformation energy.",
                               [(f"Both momentum and kinetic energy are conserved, because there are no external forces.", "Believes the absence of external forces conserves kinetic energy."),
                                (f"Kinetic energy is conserved but momentum decreases, because the combined mass moves slower.", "Confuses which quantity is conserved."),
                                (f"Neither is conserved, because the objects stick together.", "Thinks momentum is lost when objects stick.")])
    stem = f"A ${m1:g}\\text{{ kg}}$ cart moving at ${v:g}\\text{{ m/s}}$ hits a stationary ${m2:g}\\text{{ kg}}$ cart on a frictionless track and the carts stick together. Which statement about the collision is correct and best justified?"
    return MQ("pc_momentum_ke_claim", "4.4", "3.B", stem, key, ds, rng, "Momentum and kinetic energy in a perfectly inelastic collision", ["Check conservation of momentum with no external force", "Compare the kinetic energy before and after"],
              "the kinetic energies before and after are computed numerically", "", [f"m1={m1}", f"m2={m2}", f"v={v}"], est=90, judg=["law_selection", "justification"])


@retry_sep
def pc_ke_loss_fraction(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0, 4.0]); m2 = pick(rng, [1.0, 2.0, 3.0, 4.0]); frac = m2 / (m1 + m2); v = 5.0
        vf = m1 * v / (m1 + m2); loss = 1 - (0.5 * (m1 + m2) * vf ** 2) / (0.5 * m1 * v * v); agree(loss, frac, 1e-9, "frac")
        if m1 != m2:
            break
    key, ds = num_opts(frac, [("Uses $m_1/(m_1+m_2)$, the fraction of the moving mass.", m1 / (m1 + m2)), ("Reports one half for every sticking collision.", 0.5), ("Reports the fraction of the speed that is lost, $m_2/(m_1+m_2)$ squared.", frac ** 2), ("Halves the fraction, thinking that only the moving block loses energy.", frac / 2)], "", fmt=lambda v_: f"${sig(v_, 3)}$")
    stem = f"A block of mass ${m1:g}\\text{{ kg}}$ moving on a frictionless surface collides with a stationary block of mass ${m2:g}\\text{{ kg}}$ and they stick together. What fraction of the initial kinetic energy is lost in the collision?"
    return MQ("pc_ke_loss_fraction", "4.4", "2.B", stem, key, ds, rng, "Fraction of kinetic energy lost in a sticking collision", ["Find the final speed from momentum conservation", "Compare the final and initial kinetic energies"],
              "the kinetic energies are computed numerically for the stated masses", f"$K_f/K_i=m_1/(m_1+m_2)$, so the lost fraction is $m_2/(m_1+m_2)={sig(frac)}$.", [f"m1={m1}", f"m2={m2}"], est=95)


@retry_sep
def pc_impulse_time_scaling(rng):
    k = pick(rng, [2, 3, 4]); case = rng.randrange(2)
    if case == 0:
        ans = 1.0 / k; stem = f"A passenger is brought to rest from the same speed in a collision. A crumple zone makes the stopping time ${k}$ times longer. By what factor does the average force on the passenger change?"
    else:
        ans = float(k); stem = f"A ball is brought to rest from the same speed. The stopping time is made ${k}$ times shorter. By what factor does the average force on the ball change?"
    wr = [("Does not change, because the change in momentum is the same.", 1.0), ("Scales as the square of the time factor.", 1.0 / (k * k) if case == 0 else float(k * k)), ("Scales in the wrong direction, increasing when the time increases.", float(k) if case == 0 else 1.0 / k), ("Scales as the square root of the time factor.", 1 / math.sqrt(k) if case == 0 else math.sqrt(k))]
    key, ds = num_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    return MQ("pc_impulse_time_scaling", "4.2", "2.D", stem, key, ds, rng, "Average force from a fixed change in momentum over a time interval", ["Use $F_{avg}\\Delta t=\\Delta p$ with the same change in momentum", "Apply the factor to the time"],
              "the average force is evaluated numerically for both stopping times", "The change in momentum is fixed, so $F_{avg}\\propto 1/\\Delta t$.", [f"k={k}", f"case={case}"], est=70, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_sym_inelastic_speed(rng):
    m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [2.0, 3.0, 4.0]); v = pick(rng, [4.0, 6.0]); vf = m1 * v / (m1 + m2)
    key, ds = sym_opts("\\frac{m_1v}{m_1+m_2}", vf, [("Puts the mass of the stationary cart in the numerator, $m_2v/(m_1+m_2)$.", "\\frac{m_2v}{m_1+m_2}"), ("Divides by the mass of the moving cart only, $m_1v/m_2$, forgetting to include it in the combined mass.", "\\frac{m_1v}{m_2}"), ("Gives the final speed of the second cart in an elastic collision, $2m_1v/(m_1+m_2)$.", "\\frac{2m_1v}{m_1+m_2}"), ("Reports the original speed, $v$, as if the stationary cart did not change the motion.", "v")], {"m1": m1, "m2": m2, "v": v})
    stem = "A cart of mass $m_1$ moving with speed $v$ collides with a stationary cart of mass $m_2$ and the two stick together. Which expression gives their speed after the collision?"
    return MQ("pc_sym_inelastic_speed", "4.3", "2.A", stem, key, ds, rng, "Derive the final speed in a sticking collision", ["Write the momentum before and after the collision", "Solve for the common speed"],
              "each option is evaluated numerically and compared with the momentum balance", "$m_1v=(m_1+m_2)v_f$ gives $v_f=m_1v/(m_1+m_2)$.", [f"m1={m1}", f"m2={m2}", f"v={v}"], est=70, judg=["symbolic_reasoning"])


@retry_sep
def pc_rank_impulse_bounce(rng):
    for _ in forever():
        specs = [(pick(rng, [0.5, 1.0, 2.0]), pick(rng, [2.0, 4.0, 6.0]), pick(rng, [-4.0, -2.0, 1.0, 3.0])) for _ in range(4)]
        if any(vi == vf for _, vi, vf in specs):
            continue
        labs = ["A", "B", "C", "D"]; vi_vf = {L: sp_ for L, sp_ in zip(labs, specs)}
        vals = {L: abs(m * (vf - vi)) for L, (m, vi, vf) in vi_vf.items()}
        try:
            key, ds, order = rank_x(vals, labs, [("Ranks by the initial momentum only.", {L: abs(m * vi) for L, (m, vi, vf) in vi_vf.items()}), ("Ranks by the final momentum only.", {L: abs(m * vf) for L, (m, vi, vf) in vi_vf.items()}),
                                                  ("Ranks by the change in speed, ignoring the mass.", {L: abs(vf - vi) for L, (m, vi, vf) in vi_vf.items()}), ("Ranks by the mass times the change in speed, ignoring that a velocity reversal changes the sign.", {L: m * abs(abs(vf) - abs(vi)) for L, (m, vi, vf) in vi_vf.items()})], 0.05)
        except ValueError:
            continue
        break
    desc = "; ".join(f"object {L}: mass ${m:g}\\text{{ kg}}$, velocity changes from ${vi:g}\\text{{ m/s}}$ to ${vf:g}\\text{{ m/s}}$" for L, (m, vi, vf) in vi_vf.items())
    stem = f"Four objects move along a line and each receives an impulse that changes its velocity ({desc}). Which ranking orders the magnitudes of the impulses from greatest to least?"
    return MQ("pc_rank_impulse_bounce", "4.2", "2.C", stem, key, ds, rng, "Impulse equals the change in momentum, including direction changes", ["Compute the change in momentum of each object with signs", "Rank the magnitudes"],
              "the changes in momentum are computed numerically and ranked", f"The magnitudes of $m\\Delta v$ rank {key.text}.", [f"specs={specs}"], est=120, judg=["quantitative_comparison", "law_selection"])


@retry_sep
def pc_momentum_graph_force(rng):
    for _ in forever():
        dts = [pick(rng, [2, 3, 4]) for _ in range(3)]; sl = [pick(rng, [-3, -2, -1, 1, 2, 3, 4]) for _ in range(3)]
        xs = [0, dts[0], dts[0] + dts[1], dts[0] + dts[1] + dts[2]]; ps = [0]
        for d_, s_ in zip(dts, sl):
            ps.append(ps[-1] + s_ * d_)
        k = pick(rng, [1, 2]); F = float(sl[k])
        if len(set(sl)) == 3 and max(ps) <= 14 and min(ps) >= -8:
            break
    tt = np.linspace(xs[k], xs[k + 1], 1001); pp = np.interp(tt, xs, ps); agree(F, float(np.polyfit(tt, pp, 1)[0]), 1e-6, "F")
    mid = (xs[k] + xs[k + 1]) / 2
    key, ds = signed_opts(F, [(f"Reads the momentum at that time, ${sig(float(np.interp(mid, xs, ps)))}\\text{{ kg·m/s}}$, as the force.", float(np.interp(mid, xs, ps))), (f"Uses the average slope over the whole graph, ${sig((ps[-1] - ps[0]) / (xs[-1] - xs[0]))}\\text{{ N}}$, instead of the slope at that time.", (ps[-1] - ps[0]) / (xs[-1] - xs[0])), (f"Gives the force the wrong sign by subtracting the momenta in the wrong order, ${sig(-F)}\\text{{ N}}$.", -F),
                              (f"Divides the momentum change in the segment by the total time of the graph, ${sig((ps[k + 1] - ps[k]) / xs[-1])}\\text{{ N}}$.", (ps[k + 1] - ps[k]) / xs[-1])], "N")
    lo = (min(ps + [0]) - 1) // 2 * 2; hi = (max(ps + [0]) + 2) // 2 * 2
    stim = graph_stim("Momentum of the object versus time", [("p", list(zip(xs, ps)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Momentum (kg·m/s)", lo, hi, 2))
    stem = f"The graph shows the momentum of an object moving along a line as a function of time. The net force on the object points along the line of motion. What is the net force on the object at $t={mid:g}\\text{{ s}}$?"
    return MQ("pc_momentum_graph_force", "4.2", "2.B", stem, key, ds, rng, "Net force is the slope of a momentum-time graph", ["Find the segment that contains the given time", "Take the slope of that segment"],
              "a least-squares fit of the segment recomputes the slope", f"The slope of the segment is $({ps[k + 1]}-({ps[k]}))/({xs[k + 1]}-{xs[k]})={sig(F)}\\text{{ N}}$.", [f"xs={xs}", f"ps={ps}"], stim=stim, est=95, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "law_selection"])


STAGE_U4 = ["pc_impulse_force_poly", "pc_impulse_parabola_speed", "pc_inelastic_collision_speed", "pc_elastic_final_velocity", "pc_ballistic_pendulum", "pc_explosion_recoil", "pc_com_velocity_system",
            "pc_momentum_ke_claim", "pc_ke_loss_fraction", "pc_impulse_time_scaling", "pc_sym_inelastic_speed", "pc_rank_impulse_bounce", "pc_momentum_graph_force"]
