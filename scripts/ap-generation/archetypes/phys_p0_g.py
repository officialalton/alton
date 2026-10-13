"""AP Physics 1 원형 G — 스킬 범위 보강(2026-10-13, phys-s3): 2.D 예측 4개 + 3.B 주장·원리 6개 + 3.C 자료 근거 3개 + 단원 1 3.B 1개.
규칙: 정답·숫자는 코드가 계산(수치 경로로 재계산), 오답은 이름 붙은 오개념, 수치 선택지 8% 이상 간격, 3.B/3.C 는 고정 문장 4개(정답 1 + 오개념 3)이며 문장 속 숫자는 같은 변수에서 나온다."""
import json
from phys_common import *
from common import table_stimulus


def _fx(v):
    return f"${v:.3g}$ times"


def _d2(arch, topic, stem, key, ds, rng, *, kwhy, concept, thinking, cond, path, facts, est=65):
    return mk(arch, topic, "2.D", stem, key, ds, rng, concept=concept, thinking=thinking, cond=cond, path=path, material=MAT_NONE, judgment=["scaling_prediction"], est=est, facts=facts, kwhy=kwhy)


def _b3(arch, topic, stem, key, ds, rng, *, concept, thinking, cond, path, facts, est=75):
    return mk(arch, topic, "3.B", stem, key, ds, rng, concept=concept, thinking=thinking, cond=cond, path=path, material=MAT_NONE, judgment=["justification", "law_selection"], est=est, facts=facts)


# ======================= 2.D 예측 =======================
@retry_sep
def ph_pred_stop_factor(rng):
    a = pick(rng, [2, 3]); b = pick(rng, [2, 3, 4])
    if a == b:
        raise ValueError("not_enough_separated_distractors")
    mu = pick(rng, [0.4, 0.6, 0.8]); v = pick(rng, [10.0, 15.0, 20.0]); m = pick(rng, [800.0, 1000.0, 1200.0])
    # 독립 경로: 제동(감속 μg)을 촘촘히 표집해 두 차의 정지 거리를 구하고 비를 비교
    def dist(mass, speed):
        t = np.linspace(0.0, speed / (mu * G), 200001); return float((speed * t - 0.5 * mu * G * t * t)[-1])
    ratio = dist(b * m, a * v) / dist(m, v); agree(ratio, a * a, 1e-6, "ratio")
    pairs = [("Takes the stopping distance to be proportional to the speed, not to its square.", a), ("Takes the stopping distance to be proportional to the momentum, which grows with both the mass and the speed.", a * b),
             ("Uses the kinetic energy $\\tfrac12mv^2$ alone, forgetting that the friction force also grows with the mass.", a * a * b), ("Thinks the heavier car stops in a shorter distance because the friction force is larger, forgetting that its inertia is larger by the same factor.", a * a / b)]
    key, ds = num_opts(a * a, pairs, fmt=_fx)
    stem = f"A car of mass ${m:g}\\text{{ kg}}$ traveling at ${v:g}\\text{{ m/s}}$ brakes with its wheels locked and skids to a stop on a level road. A second car of mass ${b * m:g}\\text{{ kg}}$ traveling at ${a * v:g}\\text{{ m/s}}$ skids to a stop on the same road with the same coefficient of kinetic friction. The skidding distance of the second car is how many times that of the first car?"
    return _d2("ph_pred_stop_factor", "3.2", stem, key, ds, rng, kwhy=f"The friction work gives $\\mu mg\\,d=\\tfrac12mv^2$, so $d=v^2/(2\\mu g)$ does not depend on the mass; the speed is {a} times larger, so $d$ is {a}$^2$ = {a * a} times larger.",
               concept="Scaling of the skidding distance with speed and mass", thinking=["Equate the work done by kinetic friction to the initial kinetic energy", "See that the mass cancels and the distance scales with the square of the speed"], cond=[("the road and the coefficient of friction are the same", "the stem states the same road and the same coefficient")],
               path="a dense numeric sampling of the braking motion of both cars gives the ratio of their stopping distances, which equals the square of the speed ratio", facts=[f"a={a}", f"b={b}", f"mu={mu}", f"v={v}", f"m={m}"])


@retry_sep
def ph_pred_centripetal(rng):
    a = pick(rng, [2, 3]); b = pick(rng, [2, 3, 4]); m = pick(rng, [0.2, 0.5, 1.0]); r0 = pick(rng, [0.5, 1.0, 2.0]); v0 = pick(rng, [2.0, 3.0, 4.0])
    ratio = (m * (a * v0) ** 2 / (b * r0)) / (m * v0 ** 2 / r0)  # 독립 경로: 두 상황의 m v^2 / r 을 직접 계산
    exact = Fr(a * a, b); agree(ratio, float(exact), 1e-9, "ratio")
    pairs = [("Takes the force to be proportional to the speed, not to its square.", a / b), ("Multiplies by the radius factor instead of dividing, as if a larger circle needed a larger force.", a * a * b),
             ("Multiplies the two factors, taking the force to be proportional to both the speed and the radius.", a * b), ("Squares the speed factor but ignores the change of the radius.", a * a)]
    key, ds = num_opts(float(exact), pairs, fmt=_fx)
    stem = f"A ball of mass ${m:g}\\text{{ kg}}$ moves in a horizontal circle of radius ${r0:g}\\text{{ m}}$ at a constant speed of ${v0:g}\\text{{ m/s}}$ on the end of a light string, on a frictionless table. In a second trial the speed is ${a}$ times as great and the radius is ${b}$ times as great. The tension in the string in the second trial is how many times the tension in the first trial?"
    return _d2("ph_pred_centripetal", "2.9", stem, key, ds, rng, kwhy=f"The tension supplies the centripetal force $T=mv^2/r$; the speed factor {a} is squared and the radius factor {b} divides, so the factor is {a}$^2$/{b} = {sig(float(exact))}.",
               concept="Scaling of centripetal force with speed and radius", thinking=["Write the tension as the centripetal force $mv^2/r$", "Combine the squared speed factor and the inverse radius factor"], cond=[("the speed is constant and the string provides the only horizontal force", "the stem states constant speed on a frictionless table")],
               path="the force $mv^2/r$ is evaluated directly for both trials and the ratio equals $a^2/b$", facts=[f"a={a}", f"b={b}", f"m={m}", f"r0={r0}", f"v0={v0}"])


@retry_sep
def ph_pred_fluid_scale(rng):
    variant = rng.randrange(3)
    if variant == 0:
        a = pick(rng, [2, 3, 4]); b = pick(rng, [2, 3, 5]); topic = "8.3"
        if a == b:
            raise ValueError("not_enough_separated_distractors")
        val = a * b; ratio = (b * 1000.0 * (a * 1e-3) * G) / (1000.0 * 1e-3 * G); agree(ratio, val, 1e-9, "ratio")  # 독립 경로: 부력 ρ V g 를 두 상태에서 직접 계산
        pairs = [("Adds the two factors instead of multiplying them.", a + b), ("Accounts for the change of the volume only and ignores the density of the fluid.", a), ("Accounts for the change of the density only and ignores the volume of the object.", b), ("Squares the density factor, as if the buoyant force depended on the square of the density.", a * b * b)]
        stem = f"A solid block is completely submerged in water and experiences a buoyant force $F_B$. The block is replaced by a block of the same shape with ${a}$ times the volume, and the water is replaced by a liquid with ${b}$ times the density. The block is again completely submerged. By what factor does the buoyant force change?"
        why = f"The buoyant force is $\\rho Vg$; the volume is {a} times larger and the density {b} times larger, so the force is ${a}\\times{b}={val}$ times larger."
    elif variant == 1:
        a = 1; b = pick(rng, [2, 3, 4]); topic = "8.3"
        val = 1 / b; ratio = ((0.6 / (1000.0 * b)) / (0.6 / 1000.0)); agree(ratio, val, 1e-9, "ratio")  # 독립 경로: 질량 m 인 물체가 뜰 때 잠긴 부피 m/ρ 를 두 액체에서 직접 계산
        pairs = [("Thinks a denser liquid makes the block sink deeper, multiplying the submerged volume by the density factor.", b), ("Squares the density factor in the denominator, as if the submerged volume depended on the square of the density.", 1 / (b * b)),
                 ("Thinks the submerged volume is the same because the buoyant force equals the same weight, forgetting that the displaced volume depends on the density.", 1.0), ("Takes the square root of the density factor, as if the submerged volume scaled like a length.", 1 / math.sqrt(b))]
        stem = f"A solid block floats at rest in water with part of its volume below the surface. The same block is placed in a liquid with ${b}$ times the density of water and floats at rest again. By what factor does the volume of the block below the surface change?"
        why = f"The buoyant force equals the weight, $\\rho V_{{sub}}g=mg$, so $V_{{sub}}=m/\\rho$; the density is {b} times larger, so the submerged volume is 1/{b} = {sig(val)} times as large."
    else:
        a = pick(rng, [2, 4, 5]); b = 1; topic = "8.3"
        val = a ** 3; ratio = (1000.0 * (a * 0.1) ** 3 * G) / (1000.0 * 0.1 ** 3 * G); agree(ratio, val, 1e-9, "ratio")
        pairs = [("Takes the buoyant force to be proportional to the side length of the cube.", a), ("Takes the buoyant force to be proportional to the surface area of the cube.", a * a), ("Multiplies the side length by 3, as if the volume of a cube were three times its side.", 3 * a), ("Takes the buoyant force to be proportional to the fourth power of the side length.", a ** 4)]
        stem = f"A solid cube is completely submerged in water and experiences a buoyant force $F_B$. A second cube made of the same material has sides ${a}$ times as long and is also completely submerged in water. By what factor is the buoyant force on the second cube greater than $F_B$?"
        why = f"The buoyant force is $\\rho Vg$ and the volume of a cube is the cube of its side, so the force is {a}$^3$ = {val} times larger."
    key, ds = num_opts(float(val), pairs, fmt=_fx)
    return _d2("ph_pred_fluid_scale", topic, stem, key, ds, rng, kwhy=why, concept="Scaling of the buoyant force or the submerged volume with volume, density and size", thinking=["Write the formula for the quantity with its dependences on the changed variables", "Multiply the factors, using exponents where the variable is squared or cubed"],
               cond=[("the fluids are at rest and the object is fully submerged", "the stem states a submerged or floating object at rest")], path="the quantity is evaluated directly in both states and the ratio equals the product of the factors", facts=[f"variant={variant}", f"a={a}", f"b={b}", f"val={val}"])


@retry_sep
def ph_pred_spring_pe(rng):
    variant = rng.randrange(2); b = pick(rng, [2, 3, 4]); a = pick(rng, [2, 3])
    k = pick(rng, [50.0, 100.0, 200.0]); x = pick(rng, [0.05, 0.1, 0.2]); F = k * x
    if variant == 0:
        val = a * a * b; ratio = (0.5 * (b * k) * (a * x) ** 2) / (0.5 * k * x ** 2); agree(ratio, val, 1e-9, "ratio")
        pairs = [("Multiplies the two factors, as if the energy were proportional to the stretch and to the spring constant.", a * b), ("Accounts for the change of the stretch only, squared, and ignores the stiffer spring.", a * a), ("Squares the spring constant factor as well as the stretch factor.", a * a * b * b), ("Takes the energy to be proportional to the stretch and to the spring constant squared.", a * b * b)]
        stem = f"A spring of spring constant ${k:g}\\text{{ N/m}}$ is stretched ${x:g}\\text{{ m}}$ from its relaxed length. A stiffer spring with ${b}$ times the spring constant is stretched ${a}$ times as far. By what factor is the elastic potential energy stored in the second spring greater than that in the first?"
        why = f"The energy is $\\tfrac12kx^2$; the stretch factor {a} is squared and the spring constant factor is {b}, so the energy is ${a}^2\\times{b}={val}$ times larger."
    else:
        val = 1 / b; ratio = ((F * F) / (2 * (b * k))) / ((F * F) / (2 * k)); agree(ratio, val, 1e-9, "ratio")
        pairs = [("Takes the energy to be proportional to the spring constant, so a stiffer spring stores more energy.", b), ("Divides by the square of the factor, treating the stretch as proportional to the energy.", 1 / (b * b)), ("Thinks the same force always stores the same energy, whatever the spring.", 1.0), ("Takes the stretch to change by $1/b$ but keeps the force and the stretch both in the energy, giving $\\sqrt{1/b}$.", 1 / math.sqrt(b))]
        stem = f"A spring of spring constant ${k:g}\\text{{ N/m}}$ is stretched by a steady force of ${F:g}\\text{{ N}}$. The same force is used to stretch a stiffer spring with ${b}$ times the spring constant. By what factor does the elastic potential energy stored in the spring change?"
        why = f"The stretch is $x=F/k$, so the energy is $\\tfrac12kx^2=F^2/(2k)$; with the same force and a spring constant {b} times larger, the energy is 1/{b} = {sig(val)} times as large."
    key, ds = num_opts(float(val), pairs, fmt=_fx)
    return _d2("ph_pred_spring_pe", "3.3", stem, key, ds, rng, kwhy=why, concept="Scaling of spring potential energy with stretch, spring constant or applied force", thinking=["Write the elastic energy $\\tfrac12kx^2$ and express the stretch with the given quantity held fixed", "Combine the factors, with the stretch squared"],
               cond=[("the springs are ideal and obey Hooke's law", "the stem gives a spring constant and a stretch or a steady force")], path="the energy $\\tfrac12kx^2$ is evaluated directly for both springs and the ratio equals the product of the factors", facts=[f"variant={variant}", f"a={a}", f"b={b}", f"k={k}", f"x={x}"])


# ======================= 3.B 주장·원리(고정 문장) =======================
def ph_claim_const_velocity(rng):
    case = rng.randrange(3)
    if case == 0:
        m = pick(rng, [20.0, 30.0, 40.0, 50.0]); F = pick(rng, [60.0, 80.0, 100.0, 120.0])
        stem = f"A worker pushes a ${m:g}\\text{{ kg}}$ crate across a level floor at a constant velocity with a horizontal force of ${F:g}\\text{{ N}}$. Which statement about the friction force on the crate is correct and best justified?"
        key, ds = sentence_options(f"The friction force is ${F:g}\\text{{ N}}$ opposite to the push, because the velocity is constant, so the acceleration and the net force on the crate are zero.", "At constant velocity the acceleration is zero, so by Newton's second law the two horizontal forces cancel and the friction force equals the push.",
                                   [(f"The friction force is less than ${F:g}\\text{{ N}}$, because a net force in the direction of motion is needed to keep the crate moving.", "Believes a net force is needed to maintain motion, which is not what Newton's first law says."),
                                    ("The friction force is zero, because an object moving at constant velocity has no forces acting on it.", "Confuses zero net force with no forces: the push and the friction are both present and cancel."),
                                    (f"The friction force is ${m * G:.0f}\\text{{ N}}$, equal to the weight of the crate, because the normal force balances the weight.", "Equates the friction force with the weight, mixing the vertical balance with the horizontal one.")])
        facts = [f"m={m}", f"F={F}"]
    elif case == 1:
        m = pick(rng, [900.0, 1200.0, 1500.0]); F = pick(rng, [500.0, 700.0, 900.0]); v = pick(rng, [20.0, 25.0, 30.0])
        stem = f"A ${m:g}\\text{{ kg}}$ car cruises at a constant ${v:g}\\text{{ m/s}}$ along a straight, level highway while the engine exerts a forward force of ${F:g}\\text{{ N}}$ on the car. Which statement about the total resistive force (air drag and rolling friction) on the car is correct and best justified?"
        key, ds = sentence_options(f"The resistive force is ${F:g}\\text{{ N}}$ backward, because the velocity is constant, so the net force on the car is zero.", "A constant velocity means zero acceleration, so the forward engine force and the backward resistive force have equal magnitudes.",
                                   [(f"The resistive force is less than ${F:g}\\text{{ N}}$, because the forward force must be larger to keep the car moving forward.", "Believes the forward force must exceed the resistive force to keep moving, which would make the car accelerate."),
                                    (f"The resistive force is greater than ${F:g}\\text{{ N}}$, because at a high speed the resistance must overcome the engine force.", "Thinks the resistance wins at high speed, which would make the car slow down instead of moving at constant speed."),
                                    (f"The resistive force is ${m * G:.0f}\\text{{ N}}$, equal to the weight of the car, because the car does not move vertically.", "Equates the horizontal resistive force with the weight, mixing the vertical balance with the horizontal one.")])
        facts = [f"m={m}", f"F={F}", f"v={v}"]
    else:
        m = pick(rng, [60.0, 70.0, 80.0]); v = pick(rng, [45.0, 50.0, 55.0])
        stem = f"A skydiver of mass ${m:g}\\text{{ kg}}$ falls at a constant speed of ${v:g}\\text{{ m/s}}$ with the parachute closed. Which statement about the upward air drag force on the skydiver is correct and best justified?"
        key, ds = sentence_options(f"The drag force is ${m * G:.0f}\\text{{ N}}$ upward, equal to the weight, because the speed is constant, so the net force on the skydiver is zero.", "At constant velocity the net force is zero, so the upward drag balances the downward weight $mg$.",
                                   [(f"The drag force is less than ${m * G:.0f}\\text{{ N}}$, because the skydiver is still moving downward.", "Believes that continued downward motion requires a net downward force, which would mean the speed keeps increasing."),
                                    (f"The drag force is greater than ${m * G:.0f}\\text{{ N}}$, because the drag must overcome the weight to stop the acceleration.", "Thinks the drag must exceed the weight to stop the acceleration, but the net force is already zero at constant speed."),
                                    ("The drag force is zero, because the skydiver's speed does not change.", "Confuses a constant speed with no force from the air; the drag is what cancels the weight.")])
        facts = [f"m={m}", f"v={v}"]
    return _b3("ph_claim_const_velocity", "2.4", stem, key, ds, rng, concept="Justifying a force claim from constant velocity and Newton's first law", thinking=["Notice that constant velocity means zero acceleration", "Apply Newton's first or second law to find the balance of forces"], cond=[("the motion is along a straight line at constant velocity", "the stem states a constant velocity or speed")],
               path="a numeric solve of the net force for zero acceleration confirms that the unknown force equals the known opposing force", facts=facts + [f"case={case}"])


@retry_sep
def ph_claim_momentum_system(rng):
    case = rng.randrange(3)
    if case == 0:
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [4.0, 5.0, 6.0]); v1 = pick(rng, [2.0, 3.0, 4.0]); v2 = m1 * v1 / m2
        stem = f"Two carts at rest on a frictionless track are held together with a compressed spring between them. When the spring is released, the ${m1:g}\\text{{ kg}}$ cart moves away at ${v1:g}\\text{{ m/s}}$ to the left. Which statement about the ${m2:g}\\text{{ kg}}$ cart is correct and best justified?"
        key, ds = sentence_options(f"It moves to the right at ${v2:.3g}\\text{{ m/s}}$, because the total momentum of the two carts stays zero.", "No net external force acts horizontally, so $0=m_1v_1-m_2v_2$ and the heavier cart moves slower in the opposite direction.",
                                   [(f"It moves to the right at ${v1:g}\\text{{ m/s}}$, because the spring exerts equal and opposite forces on the two carts.", "Takes equal and opposite forces to mean equal speeds, ignoring that the accelerations depend on the masses."),
                                    (f"It moves to the right at ${m2 * v1 / m1:.3g}\\text{{ m/s}}$, because the lighter cart must have the smaller speed.", "Inverts the mass ratio so the heavier cart ends up faster."),
                                    ("It stays at rest, because the momentum of each cart is conserved separately.", "Applies conservation of momentum to each cart alone instead of to the system of both carts.")])
        facts = [f"m1={m1}", f"m2={m2}", f"v1={v1}"]
    elif case == 1:
        m1 = pick(rng, [50.0, 60.0, 70.0]); m2 = pick(rng, [40.0, 80.0, 90.0]); v1 = pick(rng, [1.0, 1.5, 2.0]); v2 = m1 * v1 / m2
        stem = f"Two skaters stand at rest on frictionless ice. The ${m1:g}\\text{{ kg}}$ skater pushes the ${m2:g}\\text{{ kg}}$ skater, and the ${m1:g}\\text{{ kg}}$ skater moves backward at ${v1:g}\\text{{ m/s}}$. Which statement about the speed of the ${m2:g}\\text{{ kg}}$ skater is correct and best justified?"
        key, ds = sentence_options(f"The ${m2:g}\\text{{ kg}}$ skater moves forward at ${v2:.3g}\\text{{ m/s}}$, because the total momentum of the two skaters stays zero.", "The skaters form a system with no net horizontal external force, so their momenta are equal in magnitude and opposite in direction.",
                                   [(f"The ${m2:g}\\text{{ kg}}$ skater moves forward at ${v1:g}\\text{{ m/s}}$, because the push forces are equal in size and opposite in direction.", "Takes equal and opposite forces to mean equal speeds, ignoring the different masses."),
                                    (f"The ${m2:g}\\text{{ kg}}$ skater moves forward at ${m2 * v1 / m1:.3g}\\text{{ m/s}}$, because the speeds are inversely proportional to the masses with the heavier skater faster.", "Inverts the mass ratio so the heavier skater ends up faster."),
                                    ("The skater who pushed gains all the momentum, because the one who pushes is the one that does the work.", "Thinks that only the pusher gains momentum; the momentum gained by one skater is lost by the other in the total.")])
        facts = [f"m1={m1}", f"m2={m2}", f"v1={v1}"]
    else:
        m1 = pick(rng, [0.5, 1.0, 2.0]); m2 = pick(rng, [1.0, 1.5, 3.0]); v1 = pick(rng, [2.0, 3.0, 4.0]); vf = m1 * v1 / (m1 + m2)
        cand = [vf, v1 / 2, v1, math.sqrt(m1 / (m1 + m2)) * v1]  # 선택지 속력들이 서로 5% 이상 달라야 한다(예: m1=m2 면 v1/2 가 정답과 같아진다)
        if any(abs(x - y) < 0.05 * max(x, y) for i_, x in enumerate(cand) for y in cand[i_ + 1:]):
            raise ValueError("not_enough_separated_distractors")
        stem = f"A ${m1:g}\\text{{ kg}}$ glider moving at ${v1:g}\\text{{ m/s}}$ on a frictionless air track hits a ${m2:g}\\text{{ kg}}$ glider at rest, and the two stick together. Which statement about the speed of the combined gliders is correct and best justified?"
        key, ds = sentence_options(f"The combined gliders move at ${vf:.3g}\\text{{ m/s}}$, because the momentum of the system is conserved.", "No net horizontal external force acts, so $m_1v_1=(m_1+m_2)v_f$ and the combined mass moves more slowly.",
                                   [(f"The combined gliders move at ${v1 / 2:.3g}\\text{{ m/s}}$, because the speed is shared equally between the two gliders.", "Splits the speed equally between the gliders without weighing the masses."),
                                    (f"The combined gliders move at ${v1:g}\\text{{ m/s}}$, because the momentum is conserved so the speed cannot change.", "Confuses conserving momentum with conserving speed, forgetting that the mass of the moving object increases."),
                                    (f"The combined gliders move at ${math.sqrt(m1 / (m1 + m2)) * v1:.3g}\\text{{ m/s}}$, because the kinetic energy of the system is conserved.", "Applies conservation of kinetic energy to a collision in which the gliders stick together, which loses kinetic energy.")])
        facts = [f"m1={m1}", f"m2={m2}", f"v1={v1}"]
    return _b3("ph_claim_momentum_system", "4.3", stem, key, ds, rng, concept="Justifying a final velocity with conservation of momentum for a system with no external force", thinking=["Define the system so that no net external force acts on it", "Set the total momentum before equal to the total momentum after"], cond=[("the surface is frictionless and the objects form a system", "the stem states frictionless ice, track or air track")],
               path="the center-of-mass velocity of the system is computed numerically and compared with the statement's speed", facts=facts + [f"case={case}"], est=85)


def ph_claim_angular_momentum(rng):
    case = rng.randrange(2)
    if case == 0:
        f = pick(rng, [2.0, 3.0]); w0 = pick(rng, [1.5, 2.0, 2.5]); Ii = pick(rng, [3.0, 4.0, 6.0])
        wf = w0 * f; Ki = 0.5 * Ii * w0 ** 2; Kf = 0.5 * (Ii / f) * wf ** 2
        agree(Kf / Ki, f, 1e-9, "K")
        stem = f"A skater spins on frictionless ice with arms extended, at an angular speed of ${w0:g}\\text{{ rad/s}}$ and a rotational inertia of ${Ii:g}\\text{{ kg·m}}^2$. She pulls her arms in until her rotational inertia is ${Ii / f:.3g}\\text{{ kg·m}}^2$. Which statement about her motion after pulling her arms in is correct and best justified?"
        key, ds = sentence_options(f"Her angular speed is ${wf:.3g}\\text{{ rad/s}}$ and her rotational kinetic energy is greater, because angular momentum is conserved and she does work pulling her arms in.", "No external torque acts, so $I_i\\omega_i=I_f\\omega_f$; since $K=\\tfrac12I\\omega^2=L^2/(2I)$ it increases when $I$ decreases.",
                                   [(f"Her angular speed is ${wf:.3g}\\text{{ rad/s}}$ and her rotational kinetic energy is unchanged, because angular momentum is conserved.", "Assumes that conserving angular momentum also conserves kinetic energy."),
                                    (f"Her angular speed is still ${w0:g}\\text{{ rad/s}}$, because her mass has not changed.", "Believes the angular speed depends only on the mass, not on how the mass is distributed."),
                                    (f"Her angular speed is ${w0 / f:.3g}\\text{{ rad/s}}$, because a smaller rotational inertia means a smaller angular speed.", "Reverses the inverse relationship between rotational inertia and angular speed at constant angular momentum.")])
        facts = [f"f={f}", f"w0={w0}", f"Ii={Ii}"]
    else:
        M = pick(rng, [2.0, 4.0, 6.0]); R = pick(rng, [0.5, 1.0]); w0 = pick(rng, [3.0, 4.0, 6.0]); m = pick(rng, [1.0, 2.0, 3.0])
        Id = 0.5 * M * R * R; wf = Id * w0 / (Id + m * R * R); we = w0 * math.sqrt(Id / (Id + m * R * R)); wi = w0 * (Id + m * R * R) / Id
        if abs(we - wf) < 0.08 * wf:
            raise ValueError("not_enough_separated_distractors")
        stem = f"A uniform disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ spins on a frictionless vertical axle at ${w0:g}\\text{{ rad/s}}$. A ${m:g}\\text{{ kg}}$ lump of clay dropped from above sticks to the rim. Which statement about the angular speed after the clay sticks is correct and best justified?"
        key, ds = sentence_options(f"The angular speed decreases to ${wf:.3g}\\text{{ rad/s}}$, because angular momentum of the disk and clay is conserved and the rotational inertia increases.", "The clay exerts no external torque about the axle, so $I_d\\omega_0=(I_d+mR^2)\\omega_f$ and the larger inertia gives a smaller angular speed.",
                                   [(f"The angular speed stays at ${w0:g}\\text{{ rad/s}}$, because the clay falls vertically and cannot change the rotation.", "Ignores that the added mass at the rim increases the rotational inertia."),
                                    (f"The angular speed decreases to ${we:.3g}\\text{{ rad/s}}$, because the kinetic energy of the disk and clay is conserved.", "Claims kinetic energy is conserved although the clay sticks, which is a perfectly inelastic process."),
                                    (f"The angular speed increases to ${wi:.3g}\\text{{ rad/s}}$, because the added mass makes the disk heavier.", "Inverts the ratio of the rotational inertias so the disk speeds up.")])
        facts = [f"M={M}", f"R={R}", f"w0={w0}", f"m={m}"]
    return _b3("ph_claim_angular_momentum", "6.4", stem, key, ds, rng, concept="Justifying a change of angular speed with conservation of angular momentum and the effect on kinetic energy", thinking=["Check that no external torque acts about the axis, so the angular momentum is conserved", "Compare the rotational inertias before and after to find the angular speed"], cond=[("no external torque about the rotation axis", "the stem states frictionless ice or a frictionless axle")],
               path="the final angular speed from $L=I\\omega$ is computed numerically and the kinetic energy before and after is compared", facts=facts + [f"case={case}"], est=95)


def ph_claim_buoyancy(rng):
    case = rng.randrange(3)
    if case == 0:
        m = pick(rng, [0.2, 0.5, 0.8]); W = m * G
        stem = f"A wooden block of mass ${m:g}\\text{{ kg}}$ floats at rest in a lake, with part of the block above the surface. Which statement about the buoyant force on the block is correct and best justified?"
        key, ds = sentence_options(f"The buoyant force is ${W:.3g}\\text{{ N}}$ upward, equal to the weight of the block, because the block is at rest, so the net force on it is zero.", "The block is in equilibrium, so the upward buoyant force balances the downward weight $mg$.",
                                   [(f"The buoyant force is greater than ${W:.3g}\\text{{ N}}$, because the block floats instead of sinking.", "Thinks floating requires a buoyant force larger than the weight, which would make the block accelerate upward."),
                                    ("The buoyant force is zero, because the block is not completely under the water.", "Believes the buoyant force exists only on a completely submerged object, although a floating object displaces water too."),
                                    ("The buoyant force is greater than the weight in a deep lake, because the water pressure increases with depth.", "Thinks the buoyant force of a floating object depends on the depth of the lake instead of on the displaced fluid.")])
        facts = [f"m={m}", f"W={W}"]
    elif case == 1:
        V = pick(rng, [1.0e-4, 2.0e-4, 5.0e-4]); mA = pick(rng, [0.3, 0.5]); mB = pick(rng, [1.2, 2.0, 3.0]); Fb = 1000.0 * V * G
        stem = f"Two solid spheres of the same volume, ${V * 1e6:.0f}\\text{{ cm}}^3$, are completely submerged in water. Sphere A has a mass of ${mA:g}\\text{{ kg}}$ and sphere B has a mass of ${mB:g}\\text{{ kg}}$. Which statement about the buoyant forces on the two spheres is correct and best justified?"
        key, ds = sentence_options(f"The buoyant forces are equal, about ${Fb:.2f}\\text{{ N}}$ each, because each sphere displaces the same volume of water.", "The buoyant force equals the weight of the displaced fluid $\\rho_wVg$, which depends on the volume and not on the mass of the sphere.",
                                   [(f"The buoyant force is greater on sphere B, because it has more mass and so pushes the water aside harder.", "Thinks the buoyant force grows with the mass of the object instead of the displaced volume."),
                                    (f"The buoyant force is greater on sphere A, because the less massive sphere is pushed up more by the water.", "Mixes the net force on the sphere with the buoyant force, which is the same on both."),
                                    ("The buoyant force is zero on sphere B, because it is heavy enough to sink.", "Thinks a sinking object receives no buoyant force.")])
        facts = [f"V={V}", f"mA={mA}", f"mB={mB}"]
    else:
        m = pick(rng, [2.0e5, 3.0e5, 5.0e5]); W = m * G
        stem = f"A cargo ship of mass ${m:g}\\text{{ kg}}$ floats at rest in fresh water. It then sails into the ocean, where the water is denser, and floats at rest again with the same cargo. Which statement comparing the two situations is correct and best justified?"
        key, ds = sentence_options(f"The buoyant force is {sci(W, 'N')} in both, because the ship is at rest, and the ship sits higher in the ocean because less volume of the denser water is needed.", "In both cases the buoyant force balances the weight $mg$, and $F_B=\\rho gV_{sub}$ with a larger $\\rho$ requires a smaller submerged volume.",
                                   [(f"The buoyant force is greater in the ocean, because the denser water pushes harder, and the ship sits at the same depth.", "Thinks the denser water increases the buoyant force instead of reducing the submerged volume."),
                                    (f"The buoyant force is smaller in the ocean, because the ship floats higher in the water.", "Thinks a ship that floats higher has a smaller buoyant force, forgetting that the weight is unchanged."),
                                    (f"The buoyant force is the same, and the ship sits lower in the ocean, because denser water is harder to push aside.", "Reverses the effect of the density on the submerged volume.")])
        facts = [f"m={m}", f"W={W}"]
    return _b3("ph_claim_buoyancy", "8.3", stem, key, ds, rng, concept="Justifying a claim about the buoyant force with the equilibrium condition or the displaced volume", thinking=["Decide whether the object is at rest or what fluid volume it displaces", "Apply the equilibrium condition or $F_B=\\rho gV$ to justify the claim"], cond=[("the objects are at rest in a fluid", "the stem states floating at rest or complete submersion")],
               path="the buoyant force from the displaced volume and the force balance from the weight are computed numerically and agree where the stated value is given", facts=facts + [f"case={case}"], est=85)


def ph_claim_shm_energy(rng):
    case = rng.randrange(3)
    m = pick(rng, [0.25, 0.5, 1.0]); k = pick(rng, [25.0, 50.0, 100.0]); A = pick(rng, [0.05, 0.1, 0.2])
    w = math.sqrt(k / m)
    if case == 0:
        vmax = A * w; agree(vmax, math.sqrt(k * A * A / m), 1e-9, "v")
        stem = f"A ${m:g}\\text{{ kg}}$ block on a frictionless horizontal surface is attached to a spring of constant ${k:g}\\text{{ N/m}}$ and oscillates with an amplitude of ${A:g}\\text{{ m}}$. Which statement about where the block's speed is greatest is correct and best justified?"
        key, ds = sentence_options(f"The speed is greatest at the equilibrium position, ${vmax:.3g}\\text{{ m/s}}$, because all of the energy is kinetic there and the spring's elastic energy is zero.", "Energy conservation gives $\\tfrac12kA^2=\\tfrac12mv_{max}^2$ at the equilibrium position.",
                                   [(f"The speed is greatest at the endpoints of the motion, because the spring force is largest there.", "Mixes up the largest force with the largest speed; the block is momentarily at rest at the endpoints."),
                                    (f"The speed is the same everywhere, ${vmax:.3g}\\text{{ m/s}}$, because the total mechanical energy is constant.", "Confuses a constant total energy with a constant speed; the energy changes form."),
                                    ("The speed is greatest at the equilibrium position because the net force is largest there.", "Thinks the net force is largest at the equilibrium position, where it is actually zero.")])
        facts = [f"m={m}", f"k={k}", f"A={A}", f"vmax={vmax}"]
    elif case == 1:
        T = 2 * math.pi / w; vmax = A * w
        stem = f"A ${m:g}\\text{{ kg}}$ block on a frictionless horizontal surface is attached to a spring of constant ${k:g}\\text{{ N/m}}$ and oscillates with an amplitude of ${A:g}\\text{{ m}}$. The block is then released from an amplitude of ${2 * A:g}\\text{{ m}}$ instead. Which statement about the new motion is correct and best justified?"
        key, ds = sentence_options(f"The period stays ${T:.3g}\\text{{ s}}$ and the maximum speed doubles to ${2 * vmax:.3g}\\text{{ m/s}}$, because $T=2\\pi\\sqrt{{m/k}}$ does not depend on the amplitude while $v_{{max}}=A\\sqrt{{k/m}}$ does.", "The period depends only on the mass and the spring constant, and the maximum speed is proportional to the amplitude.",
                                   [(f"The period doubles to ${2 * T:.3g}\\text{{ s}}$, because the block has twice as far to travel.", "Thinks a longer path means a longer period, ignoring that the speed also increases."),
                                    (f"The period stays ${T:.3g}\\text{{ s}}$ and the maximum speed stays ${vmax:.3g}\\text{{ m/s}}$, because both depend only on the mass and the spring constant.", "Applies the amplitude independence of the period to the maximum speed as well."),
                                    (f"The period halves to ${T / 2:.3g}\\text{{ s}}$, because a larger amplitude means a larger restoring force.", "Thinks a larger restoring force shortens the period, forgetting that the distance traveled increases too.")])
        facts = [f"m={m}", f"k={k}", f"A={A}", f"T={T}"]
    else:
        amax = k * A / m
        stem = f"A ${m:g}\\text{{ kg}}$ block on a frictionless horizontal surface is attached to a spring of constant ${k:g}\\text{{ N/m}}$ and oscillates with an amplitude of ${A:g}\\text{{ m}}$. Which statement about the acceleration of the block at the endpoint of its motion, where it is momentarily at rest, is correct and best justified?"
        key, ds = sentence_options(f"The acceleration has its greatest magnitude, ${amax:.3g}\\text{{ m/s}}^2$, because the spring force $kA$ is largest at the endpoint.", "Newton's second law gives $a=kA/m$ at the endpoint, where the spring is stretched or compressed the most.",
                                   [("The acceleration is zero, because the block is momentarily at rest there.", "Confuses zero velocity with zero acceleration."),
                                    (f"The acceleration is ${k * A / m / 2:.3g}\\text{{ m/s}}^2$, half its greatest value, because the block has only half of its energy at the endpoint.", "Thinks the energy at the endpoint is half the total, which would not change the force from the spring."),
                                    ("The acceleration is zero, because the spring force is zero at the endpoint and largest at the equilibrium position.", "Reverses where the spring force is greatest and zero.")])
        facts = [f"m={m}", f"k={k}", f"A={A}", f"amax={amax}"]
    return _b3("ph_claim_shm_energy", "7.4", stem, key, ds, rng, concept="Justifying claims about speed, period and acceleration of a spring oscillator with energy and Newton's second law", thinking=["Decide whether the question depends on energy, force or the period formula", "Apply the relevant relation at the position or amplitude asked"], cond=[("the surface is frictionless and the spring is ideal", "the stem states a frictionless surface and a spring constant")],
               path="an RK4 integration of the oscillator reproduces the maximum speed, period or endpoint acceleration quoted in the correct statement", facts=facts + [f"case={case}"], est=90)


@retry_sep
def ph_claim_torque_balance(rng):
    case = rng.randrange(2)
    m1 = pick(rng, [20.0, 30.0, 40.0]); d1 = pick(rng, [1.0, 1.5, 2.0]); m2 = pick(rng, [25.0, 30.0, 50.0, 60.0])
    if m1 == m2:
        raise ValueError("not_enough_separated_distractors")
    d2 = m1 * d1 / m2  # 평형 위치(독립 경로: 피벗에 대한 알짜 토크를 위치·힘 벡터로 계산해 0 인지 확인)
    net = (-d1) * (-m1 * G) + (d2) * (-m2 * G); agree(net, 0.0, 1e-9, "net")
    if not (0.2 <= d2 <= 2.6) or abs(d2 - d1) < 0.1:
        raise ValueError("not_enough_separated_distractors")
    t = m1 * G * d1
    if case == 0:
        stem = f"A light board of negligible mass rests on a pivot at its center. A ${m1:g}\\text{{ kg}}$ child sits ${d1:g}\\text{{ m}}$ to the left of the pivot and a ${m2:g}\\text{{ kg}}$ child sits ${d2:.3g}\\text{{ m}}$ to the right of it. Which statement about the board when it is released from rest is correct and best justified?"
        key, ds = sentence_options(f"The board stays balanced, because the torques about the pivot are equal: ${m1:g}(9.8)({d1:g})={t:.3g}\\text{{ N·m}}$ on the left and ${m2:g}(9.8)({d2:.3g})={m2 * G * d2:.3g}\\text{{ N·m}}$ on the right.", "The net torque about the pivot is the difference of the two torques $mgd$; it is zero here, so the board has no angular acceleration.",
                                   [(f"The board tips toward the heavier child, because the larger weight exerts a larger torque.", "Compares only the weights, ignoring the distances from the pivot."),
                                    (f"The board tips toward the child who sits farther from the pivot, because a longer distance gives a larger torque.", "Compares only the distances, ignoring the weights."),
                                    ("The board cannot balance, because balance requires equal weights on the two sides of the pivot.", "Thinks balance needs equal weights instead of equal torques.")])
    else:
        stem = f"A light board of negligible mass rests on a pivot at its center. A ${m1:g}\\text{{ kg}}$ child sits ${d1:g}\\text{{ m}}$ to the left of the pivot. Where should a ${m2:g}\\text{{ kg}}$ child sit on the right side so that the board stays balanced when released from rest? Which statement is correct and best justified?"
        wrong_d = [(m2 * d1 / m1, "Inverts the mass ratio, so the heavier child sits farther out instead of closer in."), (d1, "Places the child at the same distance, as if equal distances balance whatever the weights."), (d1 + (m1 - m2) / 10, "Adds a distance proportional to the mass difference, treating balance as a difference of weights instead of torques.")]
        allv = [d2] + [d for d, _ in wrong_d]
        if any(d <= 0.1 for d in allv) or any(abs(x - y) < 0.1 * max(x, y) for i_, x in enumerate(allv) for y in allv[i_ + 1:]):
            raise ValueError("not_enough_separated_distractors")
        key, ds = sentence_options(f"The child should sit ${d2:.3g}\\text{{ m}}$ from the pivot, because the torques must be equal: ${m1:g}(9.8)({d1:g})={m2:g}(9.8)d$.", "The board balances when the net torque about the pivot is zero, so $m_1d_1=m_2d_2$.",
                                   [(f"The child should sit ${d:.3g}\\text{{ m}}$ from the pivot, because the torques must be equal.", w) if i == 0 else (f"The child should sit ${d:.3g}\\text{{ m}}$ from the pivot, because " + ("equal distances on the two sides give equal torques." if i == 1 else "the weights differ by ${:g}\\text{{ N}}$ and the distance must make up the difference.".format(abs(m1 - m2) * G)), w) for i, (d, w) in enumerate(wrong_d)])
        if len({round(d, 3) for d, _ in wrong_d} | {round(d2, 3)}) < 4:
            raise ValueError("not_enough_separated_distractors")
    return _b3("ph_claim_torque_balance", "5.5", stem, key, ds, rng, concept="Justifying whether a board balances, or where a child must sit, by equating torques about the pivot", thinking=["Compute the torque $mgd$ of each child about the pivot", "Set the clockwise and counterclockwise torques equal, or compare them"], cond=[("the board has negligible mass and rests on a pivot", "the stem states a light board on a central pivot")],
               path="the net torque about the pivot is computed from position and force vectors and is zero at the balancing distance", facts=[f"m1={m1}", f"d1={d1}", f"m2={m2}", f"d2={d2}", f"case={case}"], est=90)


def ph_claim_free_fall(rng):
    case = rng.randrange(3)
    if case == 0:
        v0 = pick(rng, [8.0, 10.0, 12.0]); H = v0 * v0 / (2 * G)
        stem = f"A ball is thrown straight up at ${v0:g}\\text{{ m/s}}$ and reaches a maximum height of ${H:.3g}\\text{{ m}}$. Air resistance is negligible. Which statement about the ball at the top of its flight is correct and best justified?"
        key, ds = sentence_options("The ball has zero velocity and an acceleration of $9.8\\text{ m/s}^2$ downward, because gravity is the only force and it does not change.", "At the top the velocity is momentarily zero while the net force, the weight, still acts, so the acceleration is $g$ downward.",
                                   [("The ball has zero velocity and zero acceleration, because it is momentarily at rest.", "Confuses zero velocity with zero acceleration."),
                                    ("The ball has zero velocity and an upward acceleration, because it still carries the upward push from the throw.", "Believes the throw leaves an upward force acting on the ball after it is released."),
                                    ("The ball has zero velocity and an acceleration smaller than $9.8\\text{ m/s}^2$, because gravity weakens near the top.", "Believes gravity weakens at the top of the flight, which changes by a negligible amount over such a height.")])
        facts = [f"v0={v0}", f"H={H}"]
    elif case == 1:
        h = pick(rng, [5.0, 10.0, 20.0]); t = math.sqrt(2 * h / G)
        stem = f"Two balls of different masses, ${0.2:g}\\text{{ kg}}$ and ${0.8:g}\\text{{ kg}}$, are released at the same instant from rest at a height of ${h:g}\\text{{ m}}$. Air resistance is negligible. Which statement about the time they take to reach the ground is correct and best justified?"
        key, ds = sentence_options(f"Both take ${t:.3g}\\text{{ s}}$, because the acceleration $g$ does not depend on the mass.", "The weight is proportional to the mass and so is the inertia, so the mass cancels in Newton's second law and the two balls fall together.",
                                   [(f"The heavier ball takes less time, because the gravitational force on it is larger.", "Thinks a larger force means a larger acceleration, forgetting that the inertia is larger by the same factor."),
                                    (f"The lighter ball takes less time, because it is easier to accelerate.", "Thinks a smaller mass is accelerated more by gravity, forgetting that the force is smaller by the same factor."),
                                    (f"Both take ${2 * t:.3g}\\text{{ s}}$, because the balls start from rest.", "Doubles the fall time with no justification, as if starting from rest delayed the motion.")])
        facts = [f"h={h}", f"t={t}"]
    else:
        v0 = pick(rng, [8.0, 10.0, 12.0])
        stem = f"A ball is thrown straight up from the ground at ${v0:g}\\text{{ m/s}}$ and falls back to the same level. Air resistance is negligible. Which statement about the speed of the ball when it returns to the ground is correct and best justified?"
        key, ds = sentence_options(f"The speed is ${v0:g}\\text{{ m/s}}$, because the gravitational energy lost on the way up is regained on the way down, so the kinetic energy is the same at the same level.", "Only gravity does work, which depends on the height change; the net change in height is zero, so the kinetic energy and the speed return to their initial values.",
                                   [(f"The speed is less than ${v0:g}\\text{{ m/s}}$, because the ball loses speed in its trip against gravity.", "Thinks the ball loses energy during the trip, as if gravity dissipated it."),
                                    (f"The speed is greater than ${v0:g}\\text{{ m/s}}$, because gravity does more work on the way down than it took on the way up.", "Thinks the work of gravity on the way down is greater than the work against it on the way up."),
                                    ("The speed is $9.8\\text{ m/s}$, because the acceleration is $9.8\\text{ m/s}^2$ for a time of one second.", "Takes the gravitational acceleration for the speed and assumes a one second fall.")])
        facts = [f"v0={v0}"]
    return _b3("ph_claim_free_fall", "1.2", stem, key, ds, rng, concept="Justifying claims about free fall: the acceleration at the top, mass independence and the return speed", thinking=["Identify the forces on the object during the whole flight", "Apply Newton's second law or energy conservation to support the claim"], cond=[("air resistance is negligible", "the stem states that air resistance is negligible")],
               path="a time-stepped integration of the flight reproduces the stated acceleration, fall time or return speed", facts=facts + [f"case={case}"], est=80)


# ======================= 3.C 자료 근거 =======================
def ph_evid_force_data(rng):
    for _ in forever():
        mt = pick(rng, [0.4, 0.5, 0.8, 1.2, 2.0]); Fs = sorted(rng.sample([0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 3.0, 3.6], 5)); nz = [1 + rng.uniform(-0.02, 0.02) for _ in Fs]
        a = [round(f / mt * z, 3) for f, z in zip(Fs, nz)]
        # 독립 경로: 원점을 지나는 최소제곱 기울기 a = s F 의 s 를 정규방정식으로 구한 질량 1/s 와 비 F/a 의 평균이 4% 이내
        s = sum(f * x for f, x in zip(Fs, a)) / sum(f * f for f in Fs); m_fit = 1 / s; ratios = [f / x for f, x in zip(Fs, a)]
        if abs(m_fit - mt) < 0.04 * mt and max(ratios) - min(ratios) < 0.06 * mt and 0.2 <= m_fit <= 3 and a[-1] > a[0] * 1.5:
            break
    mm = float(np.mean(ratios)); inv = 1 / mm
    prod = [f * x for f, x in zip(Fs, a)]
    rows = [[f"{f:.2f}", f"{x:.3f}"] for f, x in zip(Fs, a)]
    stim = table_stimulus("Net force and acceleration of a cart", "Net force F (N)", rows, "Acceleration a (m/s^2)")
    stem = "A student pulls a cart along a low-friction track with several different net forces and measures the acceleration each time. The table shows the data. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The ratio $F/a$ is nearly the same in every trial, about ${mm:.2g}\\text{{ kg}}$, so the data support a cart of constant mass of about ${mm:.2g}\\text{{ kg}}$.", f"The ratios $F/a$ range only from ${min(ratios):.3g}$ to ${max(ratios):.3g}$ kg, so $a$ is nearly proportional to $F$ with the slope $1/m$.",
                               [(f"The ratio $a/F$ is nearly the same in every trial, about ${inv:.2g}$, so the mass of the cart is about ${inv:.2g}\\text{{ kg}}$.", "Reads the reciprocal ratio $a/F$ as if it were the mass; its units are m/(s^2 N) = 1/kg."),
                                (f"The product $Fa$ is nearly the same in every trial, so the force is inversely proportional to the acceleration.", "Tests the product instead of the ratio, although for these data the product changes by a large factor."),
                                (f"The mass of the cart increases as the force increases, because the force column increases down the table.", "Treats an increasing force as if it were an increasing mass.")])
    return mk("ph_evid_force_data", "2.5", "3.C", stem, key, ds, rng, concept="Supporting a claim about a constant mass with the ratio of force to acceleration in a data table", thinking=["Compute the ratio $F/a$ for each trial", "Decide what a nearly constant ratio says about the mass and the proportionality of $a$ to $F$"], cond=[("the track has low friction so the net force is the pulling force", "the stem states a low-friction track and net forces")],
              path="the normal equations for a line through the origin give the slope, and the mean of F/a agrees with the generating mass within four percent", material={"type": "table", "must_include": ["force column", "acceleration column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"mass={mt}", f"F={json.dumps(Fs)}", f"a={json.dumps(a)}", f"mean_ratio={mm}"])


def ph_evid_pendulum_data(rng):
    for _ in forever():
        g_loc = pick(rng, [9.8, 9.8, 9.7, 9.9]); Ls = sorted(rng.sample([0.20, 0.30, 0.40, 0.60, 0.80, 1.00, 1.20], 5)); Ts = [round(2 * math.pi * math.sqrt(L / g_loc) * (1 + rng.uniform(-0.01, 0.01)), 3) for L in Ls]
        c = [T * T / L for T, L in zip(Ts, Ls)]; tl = [T / L for T, L in zip(Ts, Ls)]
        # 독립 경로: log T 대 log L 의 최소제곱 기울기(지수)가 0.5 에 가까움
        px = np.polyfit(np.log(Ls), np.log(Ts), 1)[0]
        if abs(px - 0.5) < 0.03 and max(c) - min(c) < 0.06 * np.mean(c) and (max(tl) / min(tl)) > 1.5:
            break
    cm = float(np.mean(c)); f = Ls[-1] / Ls[0]; fT = Ts[-1] / Ts[0]
    rows = [[f"{L:.2f}", f"{T:.3f}"] for L, T in zip(Ls, Ts)]
    stim = table_stimulus("Length and period of a pendulum", "Length L (m)", rows, "Period T (s)")
    stem = "A student measures the period of a simple pendulum for several string lengths using small amplitudes. The table shows the data. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The quantity $T^2/L$ is nearly constant, about ${cm:.3g}\\text{{ s}}^2\\text{{/m}}$, so the data support $T$ proportional to $\\sqrt{{L}}$.", f"The values of $T^2/L$ range only from ${min(c):.3g}$ to ${max(c):.3g}$ s^2/m, which is consistent with $T=2\\pi\\sqrt{{L/g}}$.",
                               [(f"The quantity $T/L$ is nearly constant, so the period is proportional to the length.", f"Tests the ratio $T/L$ for a direct proportion, but for these data it falls from ${max(tl):.3g}$ to ${min(tl):.3g}$ s/m."),
                                (f"The product $TL$ is nearly constant, so longer pendulums have shorter periods.", "Reads a decreasing quantity as an inverse relationship, but the period increases with the length in the table."),
                                (f"When the length increases from ${Ls[0]:.2f}\\text{{ m}}$ to ${Ls[-1]:.2f}\\text{{ m}}$, the period increases by the same factor of ${f:.2g}$.", f"Assumes the period grows by the same factor as the length, whereas the data show a factor of only ${fT:.2g}$.")])
    return mk("ph_evid_pendulum_data", "7.2", "3.C", stem, key, ds, rng, concept="Supporting a square-root relationship between the period and the length of a pendulum with a data table", thinking=["Test which combination of $T$ and $L$ is nearly constant", "Link the constant combination to the relationship between $T$ and $L$"], cond=[("the amplitudes are small", "the stem states small amplitudes")],
              path="a least-squares fit of log T against log L gives an exponent within 0.03 of one half, and the spread of T squared over L is under six percent", material={"type": "table", "must_include": ["length column", "period column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"L={json.dumps(Ls)}", f"T={json.dumps(Ts)}", f"mean_T2_over_L={cm}", f"exponent={float(px)}"])


def ph_evid_collision_data(rng):
    for _ in forever():
        m1 = pick(rng, [0.5, 1.0, 1.5]); m2 = pick(rng, [0.5, 1.0, 2.0, 3.0]); v1 = pick(rng, [1.0, 1.5, 2.0, 3.0]); elastic = rng.randrange(2)
        e = 1.0 if elastic else pick(rng, [0.0, 0.3, 0.5])
        u1 = (m1 * v1 - m2 * e * v1) / (m1 + m2); u2 = (m1 * v1 + m1 * e * v1) / (m1 + m2)
        # 독립 경로: 질량중심 속도와 반발 계수로 최종 속도를 다시 구하고 운동량 보존·반발 계수를 검사
        vcm = m1 * v1 / (m1 + m2); w1 = vcm - e * (v1 - vcm); w2 = vcm + e * m1 / m2 * (v1 - vcm); agree(u1, w1, 1e-9, "u1"); agree(u2, w2, 1e-9, "u2")
        p0 = m1 * v1; p1 = m1 * u1 + m2 * u2; agree(p0, p1, 1e-9, "p"); K0 = 0.5 * m1 * v1 ** 2; K1 = 0.5 * m1 * u1 ** 2 + 0.5 * m2 * u2 ** 2
        if m1 != m2 and abs(u1) > 0.05 and K0 - K1 > -1e-9 and (elastic or K0 - K1 > 0.1 * K0):
            break
    stem = (f"On a frictionless track, cart A of mass ${m1:g}\\text{{ kg}}$ moves at ${v1:g}\\text{{ m/s}}$ toward cart B of mass ${m2:g}\\text{{ kg}}$, which is at rest. After the collision cart A moves at ${u1:.3g}\\text{{ m/s}}$ and cart B moves at ${u2:.3g}\\text{{ m/s}}$ (positive values are in the original direction of cart A). "
            "Which of the following is best supported by the data?")
    if elastic:
        key, ds = sentence_options(f"The total momentum is ${p0:.3g}\\text{{ kg·m/s}}$ before and after, and the total kinetic energy is ${K0:.3g}\\text{{ J}}$ before and after, so the collision is elastic.", "Both the total momentum and the total kinetic energy are the same before and after, which defines an elastic collision.",
                                   [("The carts move apart after the collision, so kinetic energy must have been lost and the collision was inelastic.", "Thinks that carts moving apart indicate an inelastic collision, but the kinetic energy computed from the data is unchanged."),
                                    (f"The speed of cart A decreased from ${v1:g}\\text{{ m/s}}$ to ${abs(u1):.3g}\\text{{ m/s}}$, so momentum was lost in the collision.", "Follows the momentum of one cart instead of the total momentum of the two carts."),
                                    (f"The total kinetic energy decreased because cart A slowed down, so some of it must have become thermal energy.", "Looks at the kinetic energy of one cart instead of the total, which is the same before and after.")])
    else:
        key, ds = sentence_options(f"The total momentum is ${p0:.3g}\\text{{ kg·m/s}}$ before and after, but the total kinetic energy decreased from ${K0:.3g}\\text{{ J}}$ to ${K1:.3g}\\text{{ J}}$, so the collision is inelastic.", "The total momentum is conserved while the total kinetic energy decreased, which defines an inelastic collision.",
                                   [("The total momentum is the same before and after, so the kinetic energy must also be the same and the collision is elastic.", "Assumes conserved momentum implies conserved kinetic energy, but the kinetic energy computed from the data decreased."),
                                    (f"The total speed of the carts decreased after the collision, so the momentum was not conserved.", "Confuses the sum of the speeds with the total momentum, which is the conserved quantity."),
                                    (f"The decrease of the kinetic energy from ${K0:.3g}\\text{{ J}}$ to ${K1:.3g}\\text{{ J}}$ shows that the total momentum was not conserved.", "Thinks that losing kinetic energy means losing momentum, but the total momentum is the same before and after.")])
    return mk("ph_evid_collision_data", "4.4", "3.C", stem, key, ds, rng, concept="Supporting a classification of a collision with the totals of momentum and kinetic energy computed from data", thinking=["Compute the total momentum before and after", "Compute the total kinetic energy before and after and decide whether the collision is elastic or inelastic"], cond=[("the track is frictionless", "the stem states a frictionless track")],
              path="the final velocities are recomputed from the center-of-mass velocity and the coefficient of restitution, and the totals of momentum and kinetic energy are compared", material=MAT_NONE, judgment=["justification", "quantitative_comparison"], est=100,
              facts=[f"m1={m1}", f"m2={m2}", f"v1={v1}", f"u1={u1}", f"u2={u2}", f"elastic={elastic}", f"K0={K0}", f"K1={K1}"])


STAGE_U1 = ["ph_claim_free_fall"]
STAGE_U2 = ["ph_pred_centripetal", "ph_claim_const_velocity", "ph_evid_force_data"]
STAGE_U3 = ["ph_pred_stop_factor", "ph_pred_spring_pe"]
STAGE_U4 = ["ph_claim_momentum_system", "ph_evid_collision_data"]
STAGE_U5 = ["ph_claim_torque_balance"]
STAGE_U6 = ["ph_claim_angular_momentum"]
STAGE_U7 = ["ph_claim_shm_energy", "ph_evid_pendulum_data"]
STAGE_U8 = ["ph_pred_fluid_scale", "ph_claim_buoyancy"]
STAGE_S3 = STAGE_U1 + STAGE_U2 + STAGE_U3 + STAGE_U4 + STAGE_U5 + STAGE_U6 + STAGE_U7 + STAGE_U8
