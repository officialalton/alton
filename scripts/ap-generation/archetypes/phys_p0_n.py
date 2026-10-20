"""AP Physics 1 원형 N — PH5 새 풀이 틀(2026-10-19, 브랜치 ap-bi-ph-ch): 공개 세트(PH3·PH4)가 쓰지 않은 원형만으로 PH5 를 엄격 배정하려면
(원형 서로소 + 스킬 범위 차단) 3.B 주장·원리 / 2.A 기호식 / 3.C 자료 근거 / 2.C 순위 / 2.D 예측 칸과 2문항 세트가 모자란다(phys-strict-plan.ts). 그 칸을 채우는 원형이다.
phys_p0_f/g 와 같은 규칙: 정답·숫자는 코드가 이중 경로로 계산, 오답은 이름 붙은 오개념, 수치 선택지 8% 이상 간격, 3.B/3.C 는 고정 문장 4개(정답 1 + 오개념 3), 필요한 값은 모두 학생 화면 본문·표에 둔다."""
import json
from phys_common import *
from common import table_stimulus
from phys_sym import tex_eval, sym_opts, rank_opts
from phys_p0_f import _a2, _c2, _rank_loop, LBL
from phys_p0_g import _d2, _b3, _fx
from phys_p0_e import _set_pack, _seg_text


def _sent(key_text, key_why, wrongs):
    return sentence_options(key_text, key_why, wrongs)


# ======================= 3.B 주장·원리 =======================
@retry_sep
def ph_claim_relative_motion(rng):
    case = rng.randrange(3)
    if case == 0:
        a = pick(rng, [15, 20, 25, 30]); b = pick(rng, [10, 12, 18, 22])
        # 독립 경로: 두 차의 위치를 10 s 동안 표집해 벌어지는(좁혀지는) 속도를 미분으로 구한다
        t = np.linspace(0, 10, 1001); xa = a * t; xb = 500 - b * t
        rate = float(-(np.gradient(xb - xa, t)).mean()); agree(rate, a + b, 1e-9, "rate")
        stem = f"Two cars travel on a straight, level road toward each other. Car A moves east at ${a}\\text{{ m/s}}$ and car B moves west at ${b}\\text{{ m/s}}$, both measured relative to the road. Which statement about car B as measured by the driver of car A is correct and best justified?"
        key, ds = _sent(f"Car B approaches at ${a + b}\\text{{ m/s}}$, because the velocity of B relative to A is the velocity of B minus the velocity of A, and the two velocities point in opposite directions.", f"Relative velocity is $v_B-v_A=(-{b})-(+{a})=-{a + b}\\text{{ m/s}}$, whose magnitude is ${a + b}\\text{{ m/s}}$ when the cars move in opposite directions.",
                        [(f"Car B approaches at ${abs(a - b)}\\text{{ m/s}}$, because speeds are subtracted when two objects move in opposite directions.", "Subtracts the speeds, which is correct only for objects moving in the same direction."),
                         (f"Car B approaches at ${b}\\text{{ m/s}}$, because the speed of an object is the same for every observer.", "Treats speed as independent of the observer, but velocity is measured relative to a frame of reference."),
                         (f"Car B approaches at ${max(a, b)}\\text{{ m/s}}$, because the faster of the two cars sets the speed at which they close.", "Lets the faster car alone set the closing speed instead of combining the two velocities.")])
        facts = [f"a={a}", f"b={b}"]
    elif case == 1:
        a = pick(rng, [15, 18, 20, 22]); b = a + pick(rng, [6, 8, 10, 12])
        t = np.linspace(0, 10, 1001); gap = (b * t) - (a * t); rate = float(np.gradient(gap, t).mean()); agree(rate, b - a, 1e-9, "rate")
        stem = f"Car A and car B travel east on a straight, level road. Car A moves at ${a}\\text{{ m/s}}$ and car B, behind it, moves at ${b}\\text{{ m/s}}$, both measured relative to the road. Which statement about car A as measured by the driver of car B is correct and best justified?"
        key, ds = _sent(f"Car A appears to move west at ${b - a}\\text{{ m/s}}$, because the velocity of A relative to B is the velocity of A minus the velocity of B, and B is faster.", "$v_A-v_B=a-b$ is negative, so the driver of B sees A drifting backward (west) at $b-a$.",
                        [(f"Car A appears to move east at ${b - a}\\text{{ m/s}}$, because the velocity of A relative to B is the velocity of A minus the velocity of B and A is ahead.", "Gets the sign of the relative velocity wrong; the slower car is seen moving backward by the faster driver."),
                         (f"Car A appears to move west at ${a + b}\\text{{ m/s}}$, because the speeds of two cars are added to find a relative speed.", "Adds the speeds, which is correct only when the cars move in opposite directions."),
                         (f"Car A appears to move east at ${a}\\text{{ m/s}}$, because the speed of A does not change with the observer.", "Treats the velocity of A as the same for every observer.")])
        facts = [f"a={a}", f"b={b}"]
    else:
        V = pick(rng, [20, 25, 30, 35]); u = pick(rng, [1.0, 1.5, 2.0, 2.5]); rear = rng.randrange(2)
        s = -1 if rear else 1
        vg = V + s * u; tt = np.linspace(0, 20, 2001); pos = (V * tt) + s * u * tt; agree(float(np.gradient(pos, tt).mean()), vg, 1e-9, "vg")
        d_ = "toward the rear" if rear else "toward the front"
        stem = f"A train travels east at ${V}\\text{{ m/s}}$ relative to the ground. A passenger walks {d_} of the train at ${u:g}\\text{{ m/s}}$ relative to the train. Which statement about the passenger as measured by an observer standing on the ground is correct and best justified?"
        key, ds = _sent(f"The passenger moves east at ${vg:g}\\text{{ m/s}}$, because the velocity relative to the ground is the velocity of the passenger relative to the train plus the velocity of the train relative to the ground.", "Velocities relative to different frames add as vectors: $v_{pg}=v_{pt}+v_{tg}$.",
                        [(f"The passenger moves east at ${V - s * u:g}\\text{{ m/s}}$, because the walking velocity is subtracted when the passenger walks {d_}.", "Applies the sign of the walking velocity backward, so the walking speed is combined in the wrong direction."),
                         (f"The passenger moves east at ${V}\\text{{ m/s}}$, because everything inside the train moves at the speed of the train.", "Ignores the motion of the passenger relative to the train."),
                         (f"The passenger moves at ${u:g}\\text{{ m/s}}$, because the ground observer measures only the walking speed of the passenger.", "Ignores the motion of the train relative to the ground.")])
        facts = [f"V={V}", f"u={u}", f"rear={rear}"]
    return _b3("ph_claim_relative_motion", "1.4", stem, key, ds, rng, concept="Justifying a relative velocity with the addition or subtraction of velocities in different frames", thinking=["Choose the frame of the observer and write the velocities with signs", "Combine the velocities as vectors and read the magnitude and direction"],
               cond=[("all motion is along one straight line", "the stem gives straight-line motion with directions")], path="positions of the objects are sampled over time and the rate of change of their separation is compared with the vector sum or difference stated in the option", facts=facts + [f"case={case}"], est=80)


@retry_sep
def ph_claim_vt_area(rng):
    v1 = pick(rng, [4.0, 6.0, 8.0]); t1 = pick(rng, [2.0, 3.0, 4.0]); v2 = pick(rng, [2.0, 3.0, 4.0]); t2 = pick(rng, [4.0, 5.0, 6.0])
    disp = v1 * t1 - v2 * t2; dist = v1 * t1 + v2 * t2
    if disp == 0 or abs(disp) < 2 or abs(abs(disp) - dist) < 1 or abs(abs((v1 - v2) / 2 * (t1 + t2)) - abs(disp)) < 0.08 * abs(disp):
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 속도 함수를 촘촘히 적분(위치)해 최종 위치와 경로 길이(|v| 적분)를 비교
    t = np.linspace(0, t1 + t2, 200001); v = np.where(t < t1, v1, -v2)
    x = np.concatenate([[0], np.cumsum(0.5 * (v[1:] + v[:-1]) * np.diff(t))]); agree(float(x[-1]), disp, 2e-4, "disp")
    ds_ = float(np.sum(np.abs(0.5 * (v[1:] + v[:-1])) * np.diff(t))); agree(ds_, dist, 2e-4, "dist")
    side = "east" if disp > 0 else "west"
    stem = f"A cart moves along a straight track. For the first ${t1:g}\\text{{ s}}$ its velocity is ${v1:g}\\text{{ m/s}}$ toward the east. For the next ${t2:g}\\text{{ s}}$ its velocity is ${v2:g}\\text{{ m/s}}$ toward the west. Which statement about the motion of the cart during the whole ${t1 + t2:g}\\text{{ s}}$ is correct and best justified?"
    key, ds = _sent(f"The cart is ${abs(disp):g}\\text{{ m}}$ {side} of its starting point and traveled a total distance of ${dist:g}\\text{{ m}}$, because displacement is the signed area under the velocity-time graph and distance is the total area without signs.", f"The area is ${v1 * t1:g}-{v2 * t2:g}={disp:g}\\text{{ m}}$ with signs, and ${v1 * t1:g}+{v2 * t2:g}={dist:g}\\text{{ m}}$ without signs.",
                    [(f"The cart is ${dist:g}\\text{{ m}}$ from its starting point and traveled a total distance of ${dist:g}\\text{{ m}}$, because displacement and distance are the same for motion along a line.", "Treats displacement and distance as equal even though the velocity changes direction."),
                     (f"The cart is ${abs(disp):g}\\text{{ m}}$ {side} of its starting point and traveled a total distance of ${abs(disp):g}\\text{{ m}}$, because distance is the magnitude of the displacement.", "Gives the distance as the magnitude of the displacement, which holds only if the direction does not reverse."),
                     (f"The cart is ${sig(abs((v1 - v2) / 2 * (t1 + t2)))}\\text{{ m}}$ from its starting point, because the displacement is the average of the two velocities times the total time.", "Averages the two velocities without weighting them by the time that each lasts.")])
    return _b3("ph_claim_vt_area", "1.2", stem, key, ds, rng, concept="Justifying displacement and distance from signed and unsigned areas under a velocity-time description", thinking=["Treat the westward velocity as negative and find the signed area", "Find the total distance as the sum of the magnitudes of the areas"],
               cond=[("the velocity is constant in each interval", "the stem gives a constant velocity in each interval")], path="a dense numerical integration of the velocity gives the final position and the integral of the speed gives the path length", facts=[f"v1={v1}", f"t1={t1}", f"v2={v2}", f"t2={t2}"], est=85)


@retry_sep
def ph_claim_ramps_speed(rng):
    h = pick(rng, [0.8, 1.0, 1.5, 2.0, 2.5]); m = pick(rng, [0.5, 1.0, 2.0]); L1 = pick(rng, [2.0, 3.0]); L2 = L1 + pick(rng, [1.0, 2.0, 3.0])
    v = math.sqrt(2 * G * h)
    # 독립 경로: 각 경사면에서 가속도 g h/L 로 L 만큼 달려 속력을 구한다(같은 값)
    va = math.sqrt(2 * (G * h / L1) * L1); vb = math.sqrt(2 * (G * h / L2) * L2); agree(va, v, 1e-9, "va"); agree(vb, v, 1e-9, "vb")
    ta = math.sqrt(2 * L1 / (G * h / L1)); tb = math.sqrt(2 * L2 / (G * h / L2))
    stem = f"Two frictionless ramps rise to the same height of ${h:g}\\text{{ m}}$. Ramp 1 is ${L1:g}\\text{{ m}}$ long and ramp 2 is ${L2:g}\\text{{ m}}$ long. A block of mass ${m:g}\\text{{ kg}}$ is released from rest at the top of each ramp. Which statement about the blocks when they reach the bottom is correct and best justified?"
    key, ds = _sent(f"Both blocks have the same speed of ${sig(v)}\\text{{ m/s}}$, because each block loses the same gravitational potential energy $mgh$ and gains the same kinetic energy.", "With no friction, $mgh=\\tfrac12mv^2$ on either ramp, so $v=\\sqrt{2gh}$, which does not depend on the length of the ramp.",
                    [(f"The block on ramp 1 is faster, because it has the greater acceleration and so the greater final speed.", f"A greater acceleration over a shorter distance gives the same speed, since $v^2=2aL$ with $a=gh/L$ gives $v^2=2gh$ for both."),
                     (f"The block on ramp 2 is faster, because it travels the greater distance and so gains more speed.", "Overlooks the smaller acceleration on the longer ramp; the speed depends on the height only."),
                     (f"Both blocks have the same speed of ${sig(math.sqrt(G * h))}\\text{{ m/s}}$, because the kinetic energy is $mgh$ and equals $mv^2$.", "Equates $mgh$ with $mv^2$ and so leaves out the factor $\\tfrac12$ in the kinetic energy.")])
    return _b3("ph_claim_ramps_speed", "3.4", stem, key, ds, rng, concept="Justifying equal final speeds on frictionless ramps of the same height with conservation of energy", thinking=["Compare the loss of gravitational potential energy on the two ramps", "Set it equal to the gain in kinetic energy and solve for the speed"],
               cond=[("friction is negligible", "the stem says the ramps are frictionless")], path="constant-acceleration kinematics on each incline gives the same final speed as the energy equation", facts=[f"h={h}", f"L1={L1}", f"L2={L2}", f"m={m}", f"t_a={sig(ta)}", f"t_b={sig(tb)}"], est=80)


@retry_sep
def ph_claim_power_climb(rng):
    m = pick(rng, [50.0, 60.0, 70.0]); h = pick(rng, [3.0, 4.0, 5.0]); t1 = pick(rng, [5.0, 8.0, 10.0]); t2 = t1 * pick(rng, [2.0, 3.0])
    W = m * G * h; P1 = W / t1; P2 = W / t2
    # 독립 경로: 일을 힘×거리의 수치 적분으로 구하고 평균 일률 = 일 / 시간
    hh = np.linspace(0, h, 20001); Wn = float(np.trapezoid(np.full_like(hh, m * G), hh)); agree(Wn, W, 1e-9, "W")
    stem = f"Climber 1 and climber 2 each have a mass of ${m:g}\\text{{ kg}}$ and each climbs at a steady pace up the same vertical rope to a height of ${h:g}\\text{{ m}}$. Climber 1 takes ${t1:g}\\text{{ s}}$ and climber 2 takes ${t2:g}\\text{{ s}}$. Which statement is correct and best justified?"
    key, ds = _sent(f"Both climbers do the same work of ${sig(W)}\\text{{ J}}$, but climber 1 has the greater average power of ${sig(P1)}\\text{{ W}}$, because power is the work done per unit time.", f"Each climber lifts $mg$ through $h$, so $W=mgh={sig(W)}\\text{{ J}}$, and $P=W/t$ is ${sig(P1)}\\text{{ W}}$ for climber 1 and ${sig(P2)}\\text{{ W}}$ for climber 2.",
                    [(f"Climber 2 does more work, because climber 2 spends more time exerting a force on the rope.", "Confuses the time spent with the amount of work; the work depends on the force and the distance."),
                     (f"Both climbers have the same power of ${sig(P1)}\\text{{ W}}$, because they do the same work.", "Treats equal work as equal power, forgetting that power is the rate at which the work is done."),
                     (f"Climber 2 has the greater power of ${sig(P2)}\\text{{ W}}$, because it takes longer to do the work.", "Divides the wrong way or thinks that a longer time means more power, but power decreases as the time increases.")])
    return _b3("ph_claim_power_climb", "3.5", stem, key, ds, rng, concept="Justifying equal work and different power with the definition of average power", thinking=["Find the work done against gravity for each climber", "Divide the work by the time to find the average power"],
               cond=[("the pace is steady", "the stem says each climbs at a steady pace")], path="the work is found by numerical integration of the force over the height, and the average power is the work over the time", facts=[f"m={m}", f"h={h}", f"t1={t1}", f"t2={t2}"], est=80)


@retry_sep
def ph_claim_ke_stopping(rng):
    v = pick(rng, [10.0, 12.0, 15.0]); f = pick(rng, [2, 3]); m = pick(rng, [800.0, 1000.0, 1200.0]); mu = pick(rng, [0.5, 0.7, 0.8])
    d1 = v * v / (2 * mu * G); d2 = (f * v) ** 2 / (2 * mu * G)
    # 독립 경로: 제동 운동을 시간 표집해 정지 거리를 구한다
    def dist(vv):
        tt = np.linspace(0, vv / (mu * G), 200001); return float(np.trapezoid(vv - mu * G * tt, tt))
    agree(dist(v), d1, 1e-6, "d1"); agree(dist(f * v), d2, 1e-6, "d2")
    stem = f"A car of mass ${m:g}\\text{{ kg}}$ travels at ${v:g}\\text{{ m/s}}$ on a level road and brakes with a constant friction force that stops it in ${sig(d1)}\\text{{ m}}$. The same car, with the same constant friction force, brakes from a speed of ${f * v:g}\\text{{ m/s}}$. Which statement about the stopping distance is correct and best justified?"
    key, ds = _sent(f"The stopping distance is ${sig(d2)}\\text{{ m}}$, which is ${f * f}$ times as great, because the work done by the friction force equals the initial kinetic energy, which is proportional to the square of the speed.", f"With a constant force $F d=\\tfrac12mv^2$, so $d\\propto v^2$ and the distance increases by a factor of ${f}^2={f * f}$.",
                    [(f"The stopping distance is ${sig(f * d1)}\\text{{ m}}$, which is ${f}$ times as great, because the distance is proportional to the speed.", "Takes the distance to be proportional to the speed, but the kinetic energy depends on the square of the speed."),
                     (f"The stopping distance is ${sig(d1)}\\text{{ m}}$, because the friction force does not depend on the speed.", "Concludes that a constant force always gives the same distance, ignoring the larger kinetic energy to be removed."),
                     (f"The stopping distance is ${sig(d2 / f)}\\text{{ m}}$, because a faster car has more momentum and the friction force stops it sooner.", "Reverses the effect of the speed on the distance and confuses momentum with the energy that the friction force removes.")])
    return _b3("ph_claim_ke_stopping", "3.2", stem, key, ds, rng, concept="Justifying the dependence of stopping distance on speed with the work-energy theorem", thinking=["Equate the work done by the friction force with the loss of kinetic energy", "Compare the distances for the two speeds"],
               cond=[("the friction force is constant", "the stem gives a constant friction force")], path="the braking motion is sampled in time and integrated to give the stopping distance at both speeds", facts=[f"v={v}", f"f={f}", f"mu={mu}", f"m={m}"], est=85)


@retry_sep
def ph_claim_airbag_force(rng):
    m = pick(rng, [60.0, 70.0, 80.0]); v = pick(rng, [10.0, 15.0, 20.0]); t1 = pick(rng, [0.02, 0.04]); k = pick(rng, [2, 3, 4, 5])
    t2 = t1 * k; F1 = m * v / t1; F2 = m * v / t2
    tt = np.linspace(0, t2, 100001); Fn = float(np.trapezoid(np.full_like(tt, F2), tt)); agree(Fn, m * v, 1e-9, "J")
    stem = f"A crash-test dummy of mass ${m:g}\\text{{ kg}}$ moving at ${v:g}\\text{{ m/s}}$ is brought to rest by a steel dashboard in ${t1:g}\\text{{ s}}$ in one test and by an airbag in ${t2:g}\\text{{ s}}$ in a second test. Assume that the average force is constant during each stop. Which statement about the average force is correct and best justified?"
    key, ds = _sent(f"The average force with the airbag is ${sig(F2)}\\text{{ N}}$, which is ${k}$ times smaller than ${sig(F1)}\\text{{ N}}$ with the dashboard, because the change in momentum is the same and the impulse equals the average force times the time.", f"In both tests $F\\Delta t=mv$ is the same, so $F=mv/\\Delta t$ is smaller by the factor ${k}$ when the time is ${k}$ times as long.",
                    [(f"The average force with the airbag is ${sig(F1)}\\text{{ N}}$, the same as with the dashboard, because the change in momentum is the same.", "Treats equal momentum changes as equal forces, forgetting that the time of the stop differs."),
                     (f"The average force with the airbag is ${sig(F2 * k * k)}\\text{{ N}}$, which is greater, because the airbag takes longer so it exerts more impulse.", "Thinks that a longer time means a larger impulse, but the impulse is fixed by the change in momentum."),
                     (f"The average force with the airbag is ${sig(m * v * t2)}\\text{{ N}}$, because the force is the momentum times the time.", "Multiplies the momentum by the time instead of dividing the change in momentum by the time.")])
    return _b3("ph_claim_airbag_force", "4.2", stem, key, ds, rng, concept="Justifying a smaller average force with the same change in momentum over a longer time", thinking=["Find the change in momentum, which is the same in both stops", "Divide by each time to compare the average forces"],
               cond=[("the average force is constant", "the stem asks for the average force that is constant during each stop")], path="a numerical integration of the constant force over the stopping time reproduces the change in momentum", facts=[f"m={m}", f"v={v}", f"t1={t1}", f"k={k}"], est=85)


@retry_sep
def ph_claim_spring_launch(rng):
    k = pick(rng, [200.0, 400.0, 800.0]); x1 = pick(rng, [0.05, 0.10]); f = pick(rng, [2, 3]); m = pick(rng, [0.1, 0.2, 0.5])
    v1 = x1 * math.sqrt(k / m); v2 = f * v1
    # 독립 경로: 용수철 힘 -kx 를 압축 거리 쪽으로 적분한 일이 운동에너지
    xs = np.linspace(0, f * x1, 200001); W = float(np.trapezoid(k * xs, xs)); agree(math.sqrt(2 * W / m), v2, 1e-7, "v2")
    stem = f"A spring of spring constant ${k:g}\\text{{ N/m}}$ is compressed by ${x1:g}\\text{{ m}}$ and then launches a block of mass ${m:g}\\text{{ kg}}$ across a frictionless horizontal surface at a speed of ${sig(v1)}\\text{{ m/s}}$. The same spring is then compressed by ${f * x1:g}\\text{{ m}}$ and launches the same block. Which statement about the launch speed is correct and best justified?"
    key, ds = _sent(f"The launch speed is ${sig(v2)}\\text{{ m/s}}$, which is ${f}$ times as great, because the stored energy $\\tfrac12kx^2$ increases by a factor of ${f * f}$ and the speed depends on the square root of the kinetic energy.", f"$\\tfrac12kx^2=\\tfrac12mv^2$ gives $v=x\\sqrt{{k/m}}$, so the speed is proportional to the compression.",
                    [(f"The launch speed is ${sig(f * f * v1)}\\text{{ m/s}}$, which is ${f * f}$ times as great, because the stored energy increases by a factor of ${f * f}$.", "Takes the speed to be proportional to the energy, but the energy is proportional to the speed squared."),
                     (f"The launch speed is ${sig(v1)}\\text{{ m/s}}$, because the spring constant and the mass have not changed.", "Concludes that the speed depends only on $k$ and $m$, ignoring the greater compression."),
                     (f"The launch speed is ${sig(math.sqrt(f) * v1)}\\text{{ m/s}}$, because the stored energy is proportional to the compression and the speed to its square root.", "Treats the stored energy as proportional to the compression instead of to its square.")])
    return _b3("ph_claim_spring_launch", "3.3", stem, key, ds, rng, concept="Justifying how the launch speed scales with the compression of a spring using energy conservation", thinking=["Write the elastic energy as $\\tfrac12kx^2$ and set it equal to the kinetic energy", "Compare the speeds for the two compressions"],
               cond=[("the surface is frictionless", "the stem says the surface is frictionless")], path="the work done by the spring force is found by numerically integrating kx over the compression and the speed from the kinetic energy", facts=[f"k={k}", f"x1={x1}", f"f={f}", f"m={m}"], est=85)


# ======================= 3.C 자료 근거 =======================
def ph_evid_friction_data(rng):
    for _ in forever():
        mu = pick(rng, [0.25, 0.30, 0.40, 0.50, 0.60]); Ns = sorted(rng.sample([5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 40.0], 5)); fr = [round(mu * n * (1 + rng.uniform(-0.02, 0.02)), 2) for n in Ns]
        # 독립 경로: 원점을 지나는 최소제곱 기울기와 비 f/N 의 평균이 4% 이내, N - f 는 크게 변함
        s = sum(n * f for n, f in zip(Ns, fr)) / sum(n * n for n in Ns); ratios = [f / n for n, f in zip(Ns, fr)]
        diff = [n - f for n, f in zip(Ns, fr)]
        if abs(s - mu) < 0.04 * mu and max(ratios) - min(ratios) < 0.06 * mu and max(diff) / min(diff) > 2.0 and fr[-1] > 1.5 * fr[0]:
            break
    mm = float(np.mean(ratios)); rows = [[f"{n:.1f}", f"{f:.2f}"] for n, f in zip(Ns, fr)]
    stim = table_stimulus("Normal force and kinetic friction force on a sliding block", "Normal force N (N)", rows, "Kinetic friction force f (N)")
    stem = "A student pulls a block at constant speed across a horizontal board and changes the normal force on the block by adding masses to it. The table shows the normal force and the measured kinetic friction force for five trials. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The ratio $f/N$ is nearly the same in every trial, about ${sig(mm, 2)}$, so the data support a friction force proportional to the normal force with a coefficient of kinetic friction of about ${sig(mm, 2)}$.", f"The ratios $f/N$ range only from ${sig(min(ratios))}$ to ${sig(max(ratios))}$, so $f$ is nearly proportional to $N$ with a slope $\\mu_k$.",
                               [(f"The difference $N-f$ is nearly the same in every trial, so the friction force is the normal force minus a fixed amount.", f"Tests the difference instead of the ratio, but for these data $N-f$ varies from ${sig(min(diff))}$ to ${sig(max(diff))}$ N."),
                                (f"The friction force is nearly the same in every trial, so it does not depend on the normal force.", f"Overlooks that $f$ rises from ${fr[0]:.2f}\\text{{ N}}$ to ${fr[-1]:.2f}\\text{{ N}}$ as the normal force increases."),
                                (f"The ratio $N/f$ is nearly the same in every trial, about ${sig(1 / mm, 2)}$, so the coefficient of kinetic friction is about ${sig(1 / mm, 2)}$.", "Reads the reciprocal ratio $N/f$ as the coefficient of kinetic friction, which is defined as $f/N$.")])
    return mk("ph_evid_friction_data", "2.7", "3.C", stem, key, ds, rng, concept="Supporting a proportionality between kinetic friction and the normal force with the ratio computed from a data table", thinking=["Compute the ratio $f/N$ for each trial", "Decide what a nearly constant ratio says about the relationship and the coefficient"], cond=[("the block moves at constant speed", "the stem states the block is pulled at constant speed")],
              path="the normal equations for a line through the origin give a slope close to the mean of f/N, and N - f changes by more than a factor of two", material={"type": "table", "must_include": ["normal force column", "friction force column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"mu={mu}", f"N={json.dumps(Ns)}", f"f={json.dumps(fr)}", f"mean_ratio={mm}"])


def ph_evid_spring_data(rng):
    for _ in forever():
        k = pick(rng, [20.0, 40.0, 50.0, 80.0, 120.0]); xs = sorted(rng.sample([0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15], 5)); Fs = [round(k * x * (1 + rng.uniform(-0.02, 0.02)), 2) for x in xs]
        s = sum(x * f for x, f in zip(xs, Fs)) / sum(x * x for x in xs); ratios = [f / x for x, f in zip(xs, Fs)]; prod = [f * x for x, f in zip(xs, Fs)]
        if abs(s - k) < 0.04 * k and max(ratios) - min(ratios) < 0.06 * k and max(prod) / min(prod) > 3 and Fs[0] > 0:
            break
    mm = float(np.mean(ratios)); rows = [[f"{x:.2f}", f"{f:.2f}"] for x, f in zip(xs, Fs)]
    stim = table_stimulus("Stretch of a spring and the force needed to hold it", "Stretch x (m)", rows, "Applied force F (N)")
    stem = "A student hangs different loads from a vertical spring, waits until the spring is at rest, and measures the stretch of the spring. The table shows the applied force and the stretch for five trials. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The ratio $F/x$ is nearly the same in every trial, about ${sig(mm)}\\text{{ N/m}}$, so the data support a spring that obeys $F=kx$ with $k$ of about ${sig(mm)}\\text{{ N/m}}$.", f"The ratios $F/x$ range only from ${sig(min(ratios))}$ to ${sig(max(ratios))}$ N/m, so the force is nearly proportional to the stretch.",
                               [(f"The product $Fx$ is nearly the same in every trial, so the force is inversely proportional to the stretch.", f"Tests the product instead of the ratio, but for these data $Fx$ increases from ${sig(min(prod))}$ to ${sig(max(prod))}$ J."),
                                (f"The ratio $x/F$ is nearly the same in every trial, about ${sig(1 / mm)}$, so the spring constant is about ${sig(1 / mm)}\\text{{ N/m}}$.", "Reads the reciprocal $x/F$ as the spring constant, which is defined as $F/x$."),
                                (f"The force increases by the same amount for every trial, so the spring constant increases as the stretch increases.", "Mistakes an increasing force for an increasing spring constant, but the ratio of force to stretch is constant.")])
    return mk("ph_evid_spring_data", "2.8", "3.C", stem, key, ds, rng, concept="Supporting Hooke's law with the ratio of force to stretch computed from a data table", thinking=["Compute the ratio $F/x$ for each trial", "Decide what a nearly constant ratio says about the spring"], cond=[("the spring is at rest for each measurement", "the stem says the spring is at rest")],
              path="the normal equations for a line through the origin give a slope close to the mean of F/x, and the product F x varies by more than a factor of three", material={"type": "table", "must_include": ["stretch column", "force column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"k={k}", f"x={json.dumps(xs)}", f"F={json.dumps(Fs)}", f"mean_ratio={mm}"])


# ======================= 2.C 순위 =======================
SHAPES = [("a solid disk", 0.5), ("a hoop", 1.0), ("a solid sphere", 0.4), ("a thin spherical shell", 2 / 3)]
SHORT = {"a solid disk": "solid disk", "a hoop": "hoop", "a solid sphere": "solid sphere", "a thin spherical shell": "thin shell"}


def ph_rank_rot_ke(rng):
    def make(r):
        ks = r.sample(range(4), 4); ms = r.sample([1.0, 2.0, 3.0, 4.0, 5.0], 4); rs = r.sample([0.10, 0.20, 0.30, 0.40], 4); ws = r.sample([4.0, 6.0, 8.0, 10.0, 12.0], 4)
        I = {L: SHAPES[ks[i]][1] * ms[i] * rs[i] ** 2 for i, L in enumerate(LBL)}
        vals = {L: 0.5 * I[L] * ws[i] ** 2 for i, L in enumerate(LBL)}
        wr = [("Ranks by the angular speed alone, ignoring the moment of inertia.", {L: ws[i] for i, L in enumerate(LBL)}), ("Ranks by the moment of inertia alone, ignoring the angular speed.", dict(I)),
              ("Ranks by $I\\omega$, the angular momentum, instead of the rotational kinetic energy.", {L: I[L] * ws[i] for i, L in enumerate(LBL)}), ("Ranks by the mass times the angular speed squared, ignoring the radius and shape.", {L: ms[i] * ws[i] ** 2 for i, L in enumerate(LBL)})]
        return (ks, ms, rs, ws), vals, wr
    (ks, ms, rs, ws), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(SHAPES[ks[LBL.index(L)]][1])).limit_denominator(1000) * Fr(str(ms[LBL.index(L)])) * Fr(str(rs[LBL.index(L)])) ** 2 * Fr(str(ws[LBL.index(L)])) ** 2) / 2); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: {SHORT[SHAPES[ks[i]][0]]}, ${ms[i]:g}\\text{{ kg}}$, ${rs[i]:.2f}\\text{{ m}}$, ${ws[i]:g}\\text{{ rad/s}}$" for i, L in enumerate(LBL))
    stem = f"Four uniform objects spin about axes through their centers (shape, mass, radius, angular speed): {rows}. (Moments of inertia: hoop $MR^2$, solid disk $\\tfrac12MR^2$, solid sphere $\\tfrac25MR^2$, thin shell $\\tfrac23MR^2$.) Rank the rotational kinetic energies from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])}" for L in LBL)
    key.why = f"With $K=\\tfrac12I\\omega^2$ the rotational kinetic energies in joules are {st}, which ranks as {key.text}."
    return _c2("ph_rank_rot_ke", "6.1", stem, key, ds, rng, kwhy=None, concept="Ranking rotational kinetic energies from the shape, mass, radius and angular speed", thinking=["Find the moment of inertia of each object from its shape", "Compute $\\tfrac12I\\omega^2$ and order the four values"], cond=[("each object spins about an axis through its center", "the stem gives the axis through the center")],
               path="exact fractions of the energy formula are sorted and compared with the floating-point ordering", facts=[f"shapes={json.dumps([SHAPES[k][0] for k in ks])}", f"m={json.dumps(ms)}", f"r={json.dumps(rs)}", f"w={json.dumps(ws)}"], est=90)


def ph_rank_ang_momentum(rng):
    def make(r):
        ks = r.sample(range(4), 4); ms = r.sample([1.0, 2.0, 3.0, 4.0, 5.0], 4); rs = r.sample([0.10, 0.20, 0.30, 0.40], 4); ws = r.sample([4.0, 6.0, 8.0, 10.0, 12.0], 4)
        I = {L: SHAPES[ks[i]][1] * ms[i] * rs[i] ** 2 for i, L in enumerate(LBL)}
        vals = {L: I[L] * ws[i] for i, L in enumerate(LBL)}
        wr = [("Ranks by the angular speed alone, ignoring the moment of inertia.", {L: ws[i] for i, L in enumerate(LBL)}), ("Ranks by the mass of the objects, as if a heavier object has more angular momentum.", {L: ms[i] for i, L in enumerate(LBL)}),
              ("Ranks by the rotational kinetic energy $\\tfrac12I\\omega^2$ instead of the angular momentum.", {L: 0.5 * I[L] * ws[i] ** 2 for i, L in enumerate(LBL)}), ("Ranks by the moment of inertia alone, ignoring the angular speed.", dict(I))]
        return (ks, ms, rs, ws), vals, wr
    (ks, ms, rs, ws), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(SHAPES[ks[LBL.index(L)]][1])).limit_denominator(1000) * Fr(str(ms[LBL.index(L)])) * Fr(str(rs[LBL.index(L)])) ** 2 * Fr(str(ws[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: {SHORT[SHAPES[ks[i]][0]]}, ${ms[i]:g}\\text{{ kg}}$, ${rs[i]:.2f}\\text{{ m}}$, ${ws[i]:g}\\text{{ rad/s}}$" for i, L in enumerate(LBL))
    stem = f"Four uniform objects spin about axes through their centers (shape, mass, radius, angular speed): {rows}. (Moments of inertia: hoop $MR^2$, solid disk $\\tfrac12MR^2$, solid sphere $\\tfrac25MR^2$, thin shell $\\tfrac23MR^2$.) Rank the magnitudes of the angular momenta from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])}" for L in LBL)
    key.why = f"With $L=I\\omega$ the angular momenta in kg m^2/s are {st}, which ranks as {key.text}."
    return _c2("ph_rank_ang_momentum", "6.4", stem, key, ds, rng, kwhy=None, concept="Ranking angular momenta from the shape, mass, radius and angular speed", thinking=["Find the moment of inertia of each object from its shape", "Compute $I\\omega$ and order the four values"], cond=[("each object spins about an axis through its center", "the stem gives the axis through the center")],
               path="exact fractions of I times omega are sorted and compared with the floating-point ordering", facts=[f"shapes={json.dumps([SHAPES[k][0] for k in ks])}", f"m={json.dumps(ms)}", f"r={json.dumps(rs)}", f"w={json.dumps(ws)}"], est=90)


# ======================= 2.A 기호식 =======================
@retry_sep
def ph_sym_wheel_pulley(rng):
    ask_T = rng.randrange(2)
    m = pick(rng, [0.5, 1.0, 2.0, 3.0]); I = pick(rng, [0.02, 0.05, 0.1, 0.2]); R = pick(rng, [0.1, 0.2, 0.25])
    env = {"g": G, "m": m, "I": I, "R": R}
    g_, m_, I_, R_, a_, T_ = sp.symbols("g m I R a T", positive=True)
    sol = sp.solve([sp.Eq(m_ * g_ - T_, m_ * a_), sp.Eq(T_ * R_, I_ * a_ / R_)], [a_, T_], dict=True)[0]
    num = {g_: G, m_: m, I_: I, R_: R}; sym_v = float((sol[T_] if ask_T else sol[a_]).subs(num))
    A = np.array([[m, 1.0], [I / R ** 2, -1.0]]); b = np.array([m * G, 0.0]); a_n, T_n = np.linalg.solve(A, b)   # m a + T = m g ; (I/R^2) a - T = 0
    agree(sym_v, T_n if ask_T else a_n, 1e-9, "val")
    if ask_T:
        key_tex = r"\frac{mg}{1+mR^2/I}"
        wrongs = [("Takes the tension to equal the weight of the hanging block, which holds only if the block does not accelerate.", r"mg"), ("Splits the weight equally between the string and the acceleration of the block, as if the moment of inertia of the wheel were always $mR^2$.", r"\frac{mg}{2}"),
                  ("Gives the net force $ma$ on the block instead of the tension in the string.", r"\frac{mg}{1+I/(mR^2)}"), ("Treats the block as accelerating upward, so the tension is $m(g+a)$ instead of $m(g-a)$.", r"mg\left(1+\frac{1}{1+I/(mR^2)}\right)")]
        what = "the tension in the string"
        why = r"For the block $mg-T=ma$ and for the wheel $TR=I\alpha=Ia/R$, so $T=\dfrac{I}{R^2}a$ and $a=\dfrac{mg}{m+I/R^2}$; therefore $T=\dfrac{mg}{1+mR^2/I}$."
    else:
        key_tex = r"\frac{mg}{m+I/R^2}"
        wrongs = [("Ignores the wheel, so the block falls freely with $a=g$.", r"g"), ("Adds the moment of inertia to the mass of the block without dividing by $R^2$, as if the wheel were a point mass equal to $I$.", r"\frac{mg}{m+I}"),
                  ("Replaces the effective mass $I/R^2$ of the wheel with the mass $m$ of the block.", r"\frac{mg}{2m}"), ("Subtracts the effective mass $I/R^2$ of the wheel from the mass of the block instead of adding it.", r"\frac{mg}{m-I/R^2}")]
        what = "the acceleration of the block"
        why = r"For the block $mg-T=ma$ and for the wheel $TR=I\alpha=Ia/R$, so $mg=(m+I/R^2)a$ and $a=\dfrac{mg}{m+I/R^2}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    stem = f"A light string is wound around a wheel of radius $R$ and moment of inertia $I$ that can rotate without friction about a fixed horizontal axle. The string supports a block of mass $m$ that is released from rest and hangs from the string, which does not slip on the wheel. Which of the following is the magnitude of {what}?"
    return _a2("ph_sym_wheel_pulley", "5.6", stem, key, ds, rng, kwhy=why, concept="Symbolic acceleration and tension for a block hanging from a string wound on a wheel with a moment of inertia", thinking=["Write Newton's second law for the block and the rotational second law for the wheel", "Use the no-slip condition $a=R\\alpha$ to eliminate the angular acceleration"],
               cond=[("the string does not slip and the axle is frictionless", "the stem states that the string does not slip and that the wheel rotates without friction")], path="sympy solves the equations of both bodies; numpy solves the 2x2 linear system at the chosen values, and the printed option is evaluated by a TeX evaluator",
               facts=[f"m={m}", f"I={I}", f"R={R}", f"ask_T={ask_T}"], est=95)


@retry_sep
def ph_sym_pressure_depth(rng):
    variant = rng.randrange(3)
    rho = pick(rng, [1000.0, 1030.0, 850.0, 1360.0]); h = pick(rng, [2.0, 5.0, 8.0, 12.0]); A = pick(rng, [0.1, 0.2, 0.5]); P0 = 1.01e5
    env = {"rho": rho, "g": G, "h": h, "A": A, "P0": P0}
    # 독립 경로: 깊이 방향으로 압력 증가율 dP/dy = rho g 를 수치 적분
    def grad_int(depth):
        yy = np.linspace(0, depth, 200001); return float(np.trapezoid(np.full_like(yy, rho * G), yy))
    if variant == 0:
        sym_v = P0 + rho * G * h; agree(P0 + grad_int(h), sym_v, 1e-9, "P")
        key_tex = r"P_0+\rho gh"
        wrongs = [("Gives only the gauge pressure and leaves out the pressure of the atmosphere on the surface.", r"\rho gh"), ("Uses the average depth, $h/2$, instead of the full depth.", r"P_0+\frac{\rho gh}{2}"), ("Subtracts the pressure due to the depth from the pressure at the surface, as if the pressure decreased with depth.", r"P_0-\rho gh"), ("Doubles the increase in the pressure due to the depth.", r"P_0+2\rho gh")]
        stem = r"A tank of a fluid of density $\rho$ is open to the atmosphere, where the pressure is $P_0$. Which of the following is the absolute pressure at a depth $h$ below the surface of the fluid?"
        why = r"The pressure increases by $\rho g$ per unit depth, so the absolute pressure is the atmospheric pressure plus $\rho gh$."
    elif variant == 1:
        sym_v = rho * G * h * A; agree(grad_int(h) * A, sym_v, 1e-9, "F")
        key_tex = r"\rho ghA"
        wrongs = [("Uses the absolute pressure to find the net force, although the air inside pushes on the hatch with the atmospheric pressure from the other side.", r"(P_0+\rho gh)A"), ("Uses the average of the zero gauge pressure at the surface and the gauge pressure at the depth $h$.", r"\frac{\rho ghA}{2}"), ("Gives only the force of the atmosphere on one side of the hatch.", r"P_0A"), ("Doubles the force because the fluid and the air each push on the hatch.", r"2\rho ghA")]
        stem = r"A square hatch of area $A$ in the side of a tank is at a depth $h$ below the surface of a fluid of density $\rho$. The tank is open to the atmosphere, where the pressure is $P_0$, and the pressure of the air on the other side of the hatch is also $P_0$. Which of the following is the magnitude of the net force on the hatch due to the pressures? (Treat the hatch as small compared with $h$.)"
        why = r"The atmospheric pressure acts on both sides, so the net pressure is the gauge pressure $\rho gh$, and the net force is $\rho ghA$."
    else:
        sym_v = rho * G * h / 2; agree(grad_int(h / 2), sym_v, 1e-9, "dP")
        key_tex = r"\frac{\rho gh}{2}"
        wrongs = [("Uses the full depth $h$ instead of the depth at the middle of the column, $h/2$.", r"\rho gh"), ("Doubles the depth, as if the pressure were measured at depth $2h$ rather than $h/2$.", r"2\rho gh"), ("Gives the absolute pressure at that depth instead of the gauge pressure.", r"P_0+\frac{\rho gh}{2}"), ("Halves the depth twice.", r"\frac{\rho gh}{4}")]
        stem = r"A vertical window in the side of a fluid tank extends from the surface of the fluid down to a depth $h$. The fluid has a density $\rho$ and the tank is open to the atmosphere. Which of the following is the gauge pressure of the fluid at a depth of $h/2$?"
        why = r"The gauge pressure at a depth $d$ is $\rho gd$, and the depth is $d=h/2$, so the gauge pressure is $\rho gh/2$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_pressure_depth", "8.2", stem, key, ds, rng, kwhy=why, concept="Symbolic pressure or force in a fluid at rest from the dependence of pressure on depth", thinking=["Recall that the pressure of a fluid at rest increases by $\\rho g$ per unit depth", "Decide whether the question asks for the absolute pressure, the gauge pressure, or a net force"],
               cond=[("the fluid is at rest and incompressible", "the stem describes a tank of a fluid of constant density")], path="the rate of increase of pressure with depth is integrated numerically and compared with the symbolic formula, and the printed option is evaluated by a TeX evaluator",
               facts=[f"rho={rho}", f"h={h}", f"A={A}", f"variant={variant}"], est=75)


@retry_sep
def ph_sym_continuity_pipe(rng):
    variant = rng.randrange(2)
    d1 = pick(rng, [0.04, 0.06, 0.08, 0.10]); d2 = pick(rng, [0.02, 0.03, 0.05, 0.12]); v1 = pick(rng, [1.0, 1.5, 2.0, 3.0])
    if d1 == d2:
        raise ValueError("not_enough_separated_distractors")
    env = {"d1": d1, "d2": d2, "v1": v1, "v": v1, "d": d1}
    A1 = math.pi * d1 ** 2 / 4; A2 = math.pi * d2 ** 2 / 4
    if variant == 0:
        # 독립 경로: 일정한 부피 유량 Q = A v 를 두 단면에서 같게 놓고 풀기
        sym_v = v1 * (d1 / d2) ** 2; agree(A1 * v1 / A2, sym_v, 1e-9, "v2")
        key_tex = r"v_1\left(\frac{d_1}{d_2}\right)^2"
        wrongs = [("Uses the ratio of the diameters without squaring it, although the cross-sectional area depends on the diameter squared.", r"v_1\frac{d_1}{d_2}"), ("Inverts the ratio of the areas, so the water would be faster in the wider part.", r"v_1\left(\frac{d_2}{d_1}\right)^2"),
                  ("Takes the speed to be unchanged because the same amount of water passes both points.", r"v_1"), ("Uses the ratio of the diameters to the third power.", r"v_1\left(\frac{d_1}{d_2}\right)^3")]
        stem = r"Water flows steadily through a horizontal pipe that narrows from a circular cross section of diameter $d_1$ to a circular cross section of diameter $d_2$. The speed of the water in the wider section is $v_1$. Which of the following is the speed of the water in the narrower section?"
        why = r"The volume flow rate is the same in both sections, so $A_1v_1=A_2v_2$ with $A\propto d^2$, which gives $v_2=v_1(d_1/d_2)^2$."
    else:
        sym_v = math.pi * d1 ** 2 * v1 / 4; agree(A1 * v1, sym_v, 1e-9, "Q")
        key_tex = r"\frac{\pi d^2 v}{4}"
        wrongs = [("Uses the diameter instead of the radius in the area formula, so the factor of 4 is missing.", r"\pi d^2 v"), ("Uses the circumference times the speed instead of the area times the speed.", r"\pi d v"), ("Leaves out the factor of $\\pi$ in the area of a circle.", r"\frac{d^2 v}{4}"), ("Uses the diameter without squaring it in the area.", r"\frac{\pi d v}{4}")]
        stem = r"Water flows through a pipe with a circular cross section of diameter $d$ at a speed $v$ that is the same across the cross section. Which of the following is the volume of water that passes a point in the pipe per unit time?"
        why = r"The volume flow rate is the cross-sectional area times the speed, $Q=Av=\pi (d/2)^2v=\pi d^2v/4$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_continuity_pipe", "8.4", stem, key, ds, rng, kwhy=why, concept="Symbolic speed or volume flow rate from the continuity equation for a pipe with a circular cross section", thinking=["Write the volume flow rate as the area times the speed", "Use the circular area with the diameter and set the flow rates equal"],
               cond=[("the flow is steady and the fluid is incompressible", "the stem states a steady flow of water")], path="the equal volume flow rates are solved for the speed, and the printed option is evaluated by a TeX evaluator against the numeric result from the areas",
               facts=[f"d1={d1}", f"d2={d2}", f"v1={v1}", f"variant={variant}"], est=75)


@retry_sep
def ph_sym_bernoulli_diff(rng):
    variant = rng.randrange(2)
    rho = pick(rng, [1000.0, 800.0, 1200.0]); v1 = pick(rng, [1.0, 2.0, 3.0]); v2 = pick(rng, [4.0, 5.0, 6.0]); dh = pick(rng, [0.5, 1.0, 2.0])
    env = {"rho": rho, "v1": v1, "v2": v2, "g": G, "h": dh}
    if variant == 0:
        # 독립 경로: 유선을 따라 속도가 v1 에서 v2 로 바뀔 때 압력 변화 dP = -rho v dv 를 수치 적분해 P2 - P1 을 구한다
        vv = np.linspace(v1, v2, 200001); P2mP1 = float(-np.trapezoid(rho * vv, vv)); sym_v = 0.5 * rho * (v2 ** 2 - v1 ** 2); agree(-P2mP1, sym_v, 1e-9, "dP")
        key_tex = r"\frac{1}{2}\rho\left(v_2^2-v_1^2\right)"
        wrongs = [("Uses the difference of the speeds instead of the difference of the squares of the speeds.", r"\frac{1}{2}\rho\left(v_2-v_1\right)"), ("Reverses the order of the speeds, so the pressure would be smaller where the speed is smaller.", r"\frac{1}{2}\rho\left(v_1^2-v_2^2\right)"),
                  ("Leaves out the factor of one half in the kinetic energy per unit volume.", r"\rho\left(v_2^2-v_1^2\right)"), ("Squares the difference of the speeds instead of taking the difference of the squares.", r"\frac{1}{2}\rho\left(v_2-v_1\right)^2")]
        stem = r"Fluid of density $\rho$ flows steadily through a horizontal pipe. The fluid speed is $v_1$ at point 1 and $v_2$ at point 2, which is in a narrower section of the pipe. Which of the following is the pressure at point 1 minus the pressure at point 2, $P_1-P_2$?"
        why = r"For a horizontal flow Bernoulli's equation gives $P_1+\tfrac12\rho v_1^2=P_2+\tfrac12\rho v_2^2$, so $P_1-P_2=\tfrac12\rho\left(v_2^2-v_1^2\right)$; the pressure is greater where the speed is smaller."
    else:
        # 독립 경로: 베르누이 합 P + rho g y + 1/2 rho v^2 이 두 점에서 같다고 놓고 P1 - P2 를 직접 계산
        P2 = 2.0e5; y1 = dh; y2 = 0.0; P1 = P2 + 0.5 * rho * v2 ** 2 + rho * G * y2 - 0.5 * rho * v1 ** 2 - rho * G * y1
        sym_v = 0.5 * rho * (v2 ** 2 - v1 ** 2) - rho * G * dh; agree(P1 - P2, sym_v, 1e-9, "dP")
        key_tex = r"\frac{1}{2}\rho\left(v_2^2-v_1^2\right)-\rho gh"
        wrongs = [("Leaves out the change in the gravitational potential energy per unit volume, although point 1 is higher than point 2.", r"\frac{1}{2}\rho\left(v_2^2-v_1^2\right)"), ("Adds the gravitational term instead of subtracting it, which treats point 1 as lower than point 2.", r"\frac{1}{2}\rho\left(v_2^2-v_1^2\right)+\rho gh"),
                  ("Uses only the gravitational term and ignores the change in speed.", r"-\rho gh"), ("Reverses the order of the speeds in the kinetic term.", r"\frac{1}{2}\rho\left(v_1^2-v_2^2\right)-\rho gh")]
        stem = r"Fluid of density $\rho$ flows steadily through a pipe. At point 1 the fluid speed is $v_1$ and the height is $h$ above point 2. At point 2 the fluid speed is $v_2$. Which of the following is the pressure at point 1 minus the pressure at point 2, $P_1-P_2$?"
        why = r"Bernoulli's equation gives $P_1+\rho gh+\tfrac12\rho v_1^2=P_2+\tfrac12\rho v_2^2$, so $P_1-P_2=\tfrac12\rho\left(v_2^2-v_1^2\right)-\rho gh$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_bernoulli_diff", "8.4", stem, key, ds, rng, kwhy=why, concept="Symbolic pressure difference between two points in a steady flow from Bernoulli's equation", thinking=["Write Bernoulli's equation at the two points with the heights and speeds given", "Solve for the pressure at point 1 minus the pressure at point 2"],
               cond=[("the flow is steady, incompressible and nonviscous", "the stem describes the steady flow of a fluid of constant density")], path="the Bernoulli sum is set equal at the two points and the pressure difference is evaluated numerically, and the printed option is evaluated by a TeX evaluator",
               facts=[f"rho={rho}", f"v1={v1}", f"v2={v2}", f"dh={dh}", f"variant={variant}"], est=85)


@retry_sep
def ph_sym_apparent_weight(rng):
    variant = rng.randrange(2)
    rho_o = pick(rng, [2700.0, 7800.0, 8900.0, 2300.0]); rho_f = pick(rng, [1000.0, 800.0, 1260.0]); Vv = pick(rng, [1.0e-3, 2.0e-3, 5.0e-4]); frac = pick(rng, [0.5, 0.25])
    env = {"rhoo": rho_o, "rhof": rho_f, "V": Vv, "g": G}
    if variant == 0:
        sym_v = (rho_o - rho_f) * Vv * G
        # 독립 경로: 힘의 평형 T + F_b = W 를 풀어 장력(저울의 읽음)을 구한다
        Tn = np.linalg.solve(np.array([[1.0]]), np.array([rho_o * Vv * G - rho_f * Vv * G]))[0]; agree(Tn, sym_v, 1e-9, "T")
        key_tex = r"\left(\rho_o-\rho_f\right)Vg"
        wrongs = [("Reports the weight of the object and forgets that the fluid pushes up on it.", r"\rho_oVg"), ("Reports only the buoyant force, which is the amount by which the reading decreases.", r"\rho_fVg"), ("Adds the buoyant force to the weight instead of subtracting it.", r"\left(\rho_o+\rho_f\right)Vg"), ("Uses the difference of the densities divided by the volume instead of multiplying by it.", r"\frac{\left(\rho_o-\rho_f\right)g}{V}")]
        stem = r"An object of density $\rho_o$ and volume $V$ hangs from a spring scale by a thin string and is completely submerged in a fluid of density $\rho_f$, with $\rho_o>\rho_f$. The object is at rest and does not touch the container. Which of the following is the reading of the spring scale?"
        why = r"The scale reads the tension, which balances the weight less the buoyant force: $T=\rho_oVg-\rho_fVg=(\rho_o-\rho_f)Vg$."
    else:
        sym_v = frac * rho_f * Vv * G; agree(float(np.trapezoid(np.full(100001, rho_f * G * Vv), np.linspace(0, frac, 100001))), sym_v, 1e-9, "Fb")
        fr_tex = r"\frac{V}{4}" if frac == 0.25 else r"\frac{V}{2}"
        key_tex = r"\rho_f" + fr_tex + "g"
        part = "one-fourth" if frac == 0.25 else "one-half"
        wrongs = [("Uses the whole volume of the object although only part of it is below the surface of the fluid.", r"\rho_fVg"), ("Leaves out the factor of the acceleration due to gravity.", r"\rho_f" + fr_tex),
                  ("Puts the density of the fluid in the denominator instead of the numerator.", fr_tex + r"\frac{g}{\rho_f}"), ("Uses the square of the fraction of the volume that is submerged.", (r"\rho_f\frac{V}{16}g" if frac == 0.25 else r"\rho_f\frac{V}{4}g")),
                  ("Uses the volume of the part that is above the surface of the fluid.", (r"\rho_f\frac{3V}{4}g" if frac == 0.25 else r"\rho_f\frac{V}{3}g"))]
        stem = f"An object of volume $V$ floats at rest in a fluid of density $\\rho_f$ with {part} of its volume below the surface of the fluid. Which of the following is the magnitude of the buoyant force on the object?"
        why = r"The buoyant force is the weight of the fluid displaced, $F_b=\rho_f V_{sub}g$, with $V_{sub}$ equal to " + ("$V/4$" if frac == 0.25 else "$V/2$") + "."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_apparent_weight", "8.3", stem, key, ds, rng, kwhy=why, concept="Symbolic scale reading or buoyant force from the weight of the displaced fluid", thinking=["Identify the forces on the object: weight, buoyant force and, if present, the tension", "Apply equilibrium and the weight of the displaced fluid"],
               cond=[("the object is at rest", "the stem states the object is at rest")], path="force balance solved numerically and the buoyant force integrated over the submerged fraction, and the printed option is evaluated by a TeX evaluator",
               facts=[f"rho_o={rho_o}", f"rho_f={rho_f}", f"V={Vv}", f"variant={variant}", f"frac={frac}"], est=80)


@retry_sep
def ph_sym_rolling_accel(rng):
    variant = rng.randrange(3)
    th_d = pick(rng, [15, 20, 25, 30, 35]); thr = math.radians(th_d); env = {"g": G, "theta": thr}
    kk = {0: 0.4, 1: 0.5, 2: 1.0}[variant]; name = {0: "a uniform solid sphere", 1: "a uniform solid cylinder", 2: "a hoop"}[variant]
    sym_v = G * math.sin(thr) / (1 + kk)
    # 독립 경로: 에너지 보존으로 v^2 = 2 a s 가 되는 a 를 구한다(굴러 내려오는 거리 s 에서 ½mv²(1+k) = m g s sinθ)
    s_ = 2.0; v2 = 2 * G * s_ * math.sin(thr) / (1 + kk); a_n = v2 / (2 * s_); agree(a_n, sym_v, 1e-9, "a")
    key_tex = {0: r"\frac{5}{7}g\sin\theta", 1: r"\frac{2}{3}g\sin\theta", 2: r"\frac{1}{2}g\sin\theta"}[variant]
    names3 = {0: ("solid cylinder, $\\tfrac12mR^2$", r"\frac{2}{3}g\sin\theta", "hoop, $mR^2$", r"\frac{1}{2}g\sin\theta"), 1: ("solid sphere, $\\tfrac25mR^2$", r"\frac{5}{7}g\sin\theta", "hoop, $mR^2$", r"\frac{1}{2}g\sin\theta"), 2: ("solid cylinder, $\\tfrac12mR^2$", r"\frac{2}{3}g\sin\theta", "solid sphere, $\\tfrac25mR^2$", r"\frac{5}{7}g\sin\theta")}[variant]
    cos_tex = {0: r"\frac{5}{7}g\cos\theta", 1: r"\frac{2}{3}g\cos\theta", 2: r"\frac{1}{2}g\cos\theta"}[variant]
    wrongs = [("Treats the object as sliding without friction, so all of the gravitational work becomes translational kinetic energy.", r"g\sin\theta"), ("Uses the cosine of the angle, which is the component of gravity perpendicular to the incline.", cos_tex),
              (f"Uses the moment of inertia of a {names3[0]} instead of the moment of inertia given in the problem.", names3[1]), (f"Uses the moment of inertia of a {names3[2]} instead of the moment of inertia given in the problem.", names3[3])]
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    stem = f"{name[0].upper() + name[1:]} of mass $m$ and radius $R$ rolls without slipping down an incline that makes an angle $\\theta$ with the horizontal. The moment of inertia of the object about its center is $" + {0: r"\tfrac{2}{5}mR^2", 1: r"\tfrac{1}{2}mR^2", 2: r"mR^2"}[variant] + "$. Which of the following is the magnitude of the acceleration of the center of mass of the object?"
    why = r"Rolling without slipping gives $mg\sin\theta-f=ma$ and $fR=I\alpha=Ia/R$, so $a=\dfrac{g\sin\theta}{1+I/(mR^2)}=" + {0: r"\dfrac{5}{7}", 1: r"\dfrac{2}{3}", 2: r"\dfrac{1}{2}"}[variant] + r"g\sin\theta$."
    return _a2("ph_sym_rolling_accel", "6.5", stem, key, ds, rng, kwhy=why, concept="Symbolic acceleration of an object that rolls without slipping down an incline from the translational and rotational second laws", thinking=["Write the translational equation along the incline with the static friction force", "Write the rotational equation about the center and use $a=R\\alpha$"],
               cond=[("the object rolls without slipping", "the stem states that the object rolls without slipping")], path="energy conservation with the kinetic energy split into translation and rotation gives the acceleration through v squared = 2 a s, which agrees with the force and torque solution, and the printed option is evaluated by a TeX evaluator",
               facts=[f"theta_deg={th_d}", f"variant={variant}"], est=90)


# ======================= 2.D 예측 =======================
@retry_sep
def ph_pred_planet_weight(rng):
    fM = pick(rng, [2, 4, 8]); fR = pick(rng, [2, 3]); m = pick(rng, [50.0, 60.0, 70.0])
    # 독립 경로: 뉴턴 중력 법칙으로 지구 표면 무게와 새 행성 표면 무게를 각각 계산해 비를 구한다
    Me = 5.97e24; Re = 6.37e6; Gc = 6.67e-11
    W1 = Gc * Me * m / Re ** 2; W2 = Gc * fM * Me * m / (fR * Re) ** 2; ratio = W2 / W1; agree(ratio, fM / fR ** 2, 1e-9, "ratio")
    stem = f"An astronaut has a weight of ${sig(m * G)}\\text{{ N}}$ on the surface of Earth. A planet has ${fM}$ times the mass of Earth and ${fR}$ times the radius of Earth. Which of the following is the best prediction of the weight of the astronaut on the surface of the planet?"
    f = lambda v: f"${sig(v)}\\text{{ N}}$"  # noqa: E731
    key, ds = num_opts(m * G * ratio, [("Multiplies the weight by the factor for the mass only and forgets the radius.", m * G * fM), ("Divides the factor for the mass by the radius instead of by the square of the radius.", m * G * fM / fR),
                                       ("Puts the factor for the radius squared in the numerator and the factor for the mass in the denominator.", m * G * fR ** 2 / fM), ("Multiplies the weight by the factor for the mass and the factor for the radius squared.", m * G * fM * fR ** 2)], fmt=f)
    return _d2("ph_pred_planet_weight", "2.6", stem, key, ds, rng, kwhy=f"The weight is $GMm/R^2$, which increases by the factor ${fM}$ for the mass and decreases by the factor ${fR}^2={fR ** 2}$ for the radius: ${sig(m * G)}\\text{{ N}}\\times{fM}/{fR ** 2}={sig(m * G * ratio)}\\text{{ N}}$.",
               concept="Predicting the weight on another planet from the dependence of gravity on mass and radius", thinking=["Write the weight as $GMm/R^2$ and find how it scales with the mass and the radius of the planet", "Apply the factors to the weight on Earth"],
               cond=[("the planet is spherical with uniform spherical symmetry", "the stem gives the mass and radius of the planet relative to Earth")], path="the weight is computed from Newton's law of gravitation with the masses and radii of Earth and the planet and the ratio is compared with the scaling factor", facts=[f"fM={fM}", f"fR={fR}", f"m={m}"], est=75)


@retry_sep
def ph_pred_spring_period(rng):
    fm = pick(rng, [2, 4, 8, 9]); fk = pick(rng, [2, 4, 8, 16]); m = pick(rng, [0.2, 0.5, 1.0]); k = pick(rng, [20.0, 50.0, 80.0])
    T1 = 2 * math.pi * math.sqrt(m / k); T2 = 2 * math.pi * math.sqrt(fm * m / (fk * k)); fac = T2 / T1
    # 독립 경로: 운동 방정식을 RK4 로 적분해 두 경우의 주기(1/4 주기 x4)를 측정
    def period(mm, kk):
        st = np.array([1.0, 0.0]); t = 0.0; dt = 1e-4
        while st[0] > 0:
            prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -kk / mm * y[0]]), st, t, t + dt, 1); t += dt
        fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr)
    agree(period(fm * m, fk * k) / period(m, k), fac, 2e-3, "fac")
    cand = [fac, fm / fk, math.sqrt(fm) * math.sqrt(fk), fm * fk, math.sqrt(fk / fm)]
    stem = f"A block of mass ${m:g}\\text{{ kg}}$ oscillates on a horizontal frictionless surface at the end of a spring of spring constant ${k:g}\\text{{ N/m}}$ with a period $T_1$. The block is replaced by a block of mass ${fm * m:g}\\text{{ kg}}$ and the spring is replaced by a spring of spring constant ${fk * k:g}\\text{{ N/m}}$. Which of the following is the period $T_2$ of the new system in terms of $T_1$?"
    key, ds = num_opts(fac, [("Uses the ratio of the masses to the ratio of the spring constants without the square root.", fm / fk), ("Multiplies the square roots of the two factors instead of dividing the square root of the mass factor by that of the spring factor.", math.sqrt(fm * fk)),
                             ("Inverts the dependence on the spring constant, so a stiffer spring gives a longer period.", math.sqrt(fm * fk)), ("Uses the square root of the inverse ratio, as if the period increased with the spring constant and decreased with the mass.", math.sqrt(fk / fm)), ("Uses the product of the two factors without the square root.", float(fm * fk))], fmt=_fx)
    key.text = f"$T_2={sig(fac)}\\,T_1$"
    for d in ds:
        d.text = f"$T_2={sig(float(d.value))}\\,T_1$"
    return _d2("ph_pred_spring_period", "7.2", stem, key, ds, rng, kwhy=f"The period is $T=2\\pi\\sqrt{{m/k}}$, so $T_2/T_1=\\sqrt{{{fm}/{fk}}}={sig(fac)}$.", concept="Predicting the change in the period of a mass-spring oscillator when both the mass and the spring constant change", thinking=["Write the period as $2\\pi\\sqrt{m/k}$", "Find the factor for the mass over the factor for the spring constant under the square root"],
               cond=[("the spring is ideal and the surface is frictionless", "the stem states a horizontal frictionless surface")], path="the equation of motion is integrated with RK4 for both systems and the periods are measured at the quarter-period crossing", facts=[f"fm={fm}", f"fk={fk}", f"m={m}", f"k={k}"], est=80)


@retry_sep
def ph_pred_collapse_spin(rng):
    f = pick(rng, [2, 3, 4]); M = pick(rng, [2.0, 5.0, 10.0]); R = pick(rng, [0.5, 1.0, 2.0]); w0 = pick(rng, [2.0, 4.0, 6.0])
    # 독립 경로: 각운동량 보존으로 새 각속도를 구하고, 회전 운동에너지 비는 ½Iω² 를 직접 계산
    I1 = 0.4 * M * R ** 2; I2 = 0.4 * M * (R / f) ** 2; w2 = I1 * w0 / I2; agree(w2, f * f * w0, 1e-9, "w2")
    K1 = 0.5 * I1 * w0 ** 2; K2 = 0.5 * I2 * w2 ** 2; agree(K2 / K1, f * f, 1e-9, "Kratio")
    stem = f"A uniform solid sphere of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ rotates freely about an axis through its center with an angular speed of ${w0:g}\\text{{ rad/s}}$. The sphere then contracts, with its mass staying the same and remaining a uniform solid sphere, until its radius is ${R / f:g}\\text{{ m}}$. No external torque acts on it. Which of the following is the best prediction of the new angular speed?"
    fm_ = lambda v: f"${sig(v)}\\text{{ rad/s}}$"  # noqa: E731
    key, ds = num_opts(w2, [("Takes the angular speed to be inversely proportional to the radius instead of the square of the radius.", f * w0), ("Assumes that the angular speed does not change because no external torque acts.", w0),
                            ("Takes the angular speed to be proportional to the radius, so it would decrease.", w0 / f), ("Uses the cube of the factor for the radius, as if the moment of inertia depended on the volume.", f ** 3 * w0)], fmt=fm_)
    return _d2("ph_pred_collapse_spin", "6.4", stem, key, ds, rng, kwhy=f"Angular momentum $I\\omega$ is conserved with $I\\propto R^2$, so $\\omega$ increases by ${f}^2={f * f}$ to ${sig(w2)}\\text{{ rad/s}}$.", concept="Predicting the new angular speed of a contracting sphere from conservation of angular momentum", thinking=["Write the moment of inertia of a uniform sphere as $\\tfrac25MR^2$ and recognize that angular momentum is conserved", "Find how the angular speed scales with the radius"],
               cond=[("no external torque acts", "the stem states no external torque acts")], path="the angular speed from conservation of angular momentum is compared with the rotational kinetic energy ratio from half I omega squared, which increases by the same square factor", facts=[f"f={f}", f"M={M}", f"R={R}", f"w0={w0}"], est=80)


# ======================= 2문항 세트 =======================
@retry_sep
def phs_ft_set(rng):
    """세트: 힘–시간 그래프 → (충격량, 나중 속력). 단원 4."""
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [2, 3])):
            xs.append(xs[-1] + pick(rng, [1, 2, 3]))
        Fv = [rng.randint(2, 10) for _ in xs]; Fv[0] = pick(rng, [0, 2, 4])
        m = pick(rng, [1.0, 2.0, 4.0]); v0 = pick(rng, [0.0, 2.0, 3.0])
        J = trapz_exact(xs, Fv); vf = v0 + float(J) / m
        tt = np.linspace(0, xs[-1], 40001); agree(float(J), float(np.trapezoid(np.interp(tt, xs, Fv), tt)), 1e-7, "J")
        if float(J) >= 8 and len(set(Fv)) >= 3 and (v0 > 0 or True):
            break
    Jf = float(J)
    k1, d1 = num_opts(Jf, [("Multiplies the largest force by the total time.", max(Fv) * xs[-1]), ("Averages the first and last forces and multiplies by the total time.", (Fv[0] + Fv[-1]) / 2 * xs[-1]),
                           ("Adds the force values at the plotted points without multiplying by the intervals.", float(sum(Fv))), ("Uses only the area of the first segment.", float((Fr(Fv[0]) + Fr(Fv[1])) / 2 * xs[1]))], "N s")
    k2, d2 = num_opts(vf, [("Reports the change in speed, $J/m$, and forgets to add the initial speed.", Jf / m), ("Adds the initial speed to the impulse without dividing by the mass.", v0 + Jf),
                           ("Divides the final momentum by twice the mass.", (m * v0 + Jf) / (2 * m)), ("Uses the largest force times the total time as the impulse.", v0 + max(Fv) * xs[-1] / m)], "m/s")
    stim = graph_stim("Net force on the cart versus time", [("F", list(zip(xs, Fv)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Net force (N)", 0, max(Fv) + 2, 2))
    q = []
    for st, key, ds, nm, kw in [(f"What is the magnitude of the impulse that the net force exerts on the cart between $t=0$ and $t={xs[-1]}\\text{{ s}}$?", k1, d1, "q1", f"The areas of the trapezoids under the graph are {_seg_text(xs, Fv, 'N s')}, which add to ${sig(Jf)}\\text{{ N s}}$."),
                                (f"What is the speed of the cart at $t={xs[-1]}\\text{{ s}}$?", k2, d2, "q2", f"The impulse equals the change in momentum: $J=m(v-v_0)$ with $J={sig(Jf)}\\text{{ N s}}$, $m={m:g}\\text{{ kg}}$ and $v_0={v0:g}\\text{{ m/s}}$ gives $v={sig(vf)}\\text{{ m/s}}$.")]:
        q.append(mk(f"phs_ft_set_{nm}", "4.2", "2.B", st, key, ds, rng, concept="Two questions about a single force-time graph", thinking=["Find the impulse as the area under the force-time graph", "Use the impulse-momentum theorem for the final speed"],
                    cond=[("the plotted force is the net force along the line of motion", "the shared stimulus states the graph shows the net force")], path="exact fractions for the area versus numpy integration of a dense resampling; the speed from the impulse-momentum equation", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"xs={xs}", f"Fv={Fv}", f"m={m}", f"v0={v0}"], kwhy=kw))
    intro = f"A ${m:g}\\text{{ kg}}$ cart moves on a horizontal track with negligible friction. At $t=0$ the cart has a speed of ${v0:g}\\text{{ m/s}}$ in the positive direction. The graph shows the net force on the cart in the direction of its motion as a function of time."
    return _set_pack("phs_ft_set", "4.2", intro, stim, q, q[0]["facts"])


@retry_sep
def phs_torque_set(rng):
    """세트: 알짜 돌림힘–시간 그래프 → (한 순간의 각가속도, 나중 각속력). 단원 5."""
    for _ in forever():
        xs = [0]
        for _ in range(pick(rng, [2, 3])):
            xs.append(xs[-1] + pick(rng, [1, 2, 3]))
        Tv = [rng.randint(2, 10) for _ in xs]; Tv[0] = pick(rng, [0, 2, 4])
        I = pick(rng, [0.5, 1.0, 2.0, 4.0]); tq = pick(rng, [i for i in range(1, len(xs))])
        L = trapz_exact(xs, Tv); wf = float(L) / I; alpha = Tv[tq] / I
        tt = np.linspace(0, xs[-1], 40001); agree(float(L), float(np.trapezoid(np.interp(tt, xs, Tv), tt)), 1e-7, "L")
        if float(L) >= 8 and len(set(Tv)) >= 3 and Tv[tq] > 0:
            break
    Lf = float(L)
    k1, d1 = num_opts(alpha, [("Reports the net torque without dividing by the moment of inertia.", float(Tv[tq])), ("Multiplies the net torque by the moment of inertia instead of dividing.", Tv[tq] * I),
                              ("Uses the average torque over the whole graph divided by the moment of inertia.", Lf / xs[-1] / I), ("Divides the moment of inertia by the net torque.", I / Tv[tq])], "rad/s^2")
    k2, d2 = num_opts(wf, [("Divides the final torque by the moment of inertia, ignoring the time for which the torque acts.", Tv[-1] / I), ("Multiplies the largest torque by the total time and divides by the moment of inertia.", max(Tv) * xs[-1] / I),
                           ("Reports the change in angular momentum, which is the area, without dividing by the moment of inertia.", Lf), ("Uses only the area of the first segment divided by the moment of inertia.", float((Fr(Tv[0]) + Fr(Tv[1])) / 2 * xs[1]) / I)], "rad/s")
    stim = graph_stim("Net torque on the wheel versus time", [("tau", list(zip(xs, Tv)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Net torque (N m)", 0, max(Tv) + 2, 2))
    q = []
    for st, key, ds, nm, kw in [(f"What is the angular acceleration of the wheel at $t={xs[tq]}\\text{{ s}}$?", k1, d1, "q1", f"The net torque at $t={xs[tq]}\\text{{ s}}$ is ${Tv[tq]}\\text{{ N m}}$, so $\\alpha=\\tau/I={sig(alpha)}\\text{{ rad/s}}^2$."),
                                (f"What is the angular speed of the wheel at $t={xs[-1]}\\text{{ s}}$?", k2, d2, "q2", f"The change in angular momentum is the area under the graph, {_seg_text(xs, Tv, 'N m s')}, which adds to ${sig(Lf)}\\text{{ kg m}}^2\\text{{/s}}$; dividing by $I={I:g}\\text{{ kg m}}^2$ gives $\\omega={sig(wf)}\\text{{ rad/s}}$.")]:
        q.append(mk(f"phs_torque_set_{nm}", "5.6", "2.B", st, key, ds, rng, concept="Two questions about a single net torque-time graph", thinking=["Use the second law for rotation to find the angular acceleration from the torque", "Find the change in angular momentum as the area under the torque-time graph"],
                    cond=[("the plotted torque is the net torque about the axle", "the shared stimulus states the graph shows the net torque")], path="exact fractions for the area versus numpy integration; the angular acceleration from the torque and the moment of inertia", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"xs={xs}", f"Tv={Tv}", f"I={I}"], kwhy=kw))
    intro = f"A wheel with a moment of inertia of ${I:g}\\text{{ kg m}}^2$ is at rest at $t=0$ on a fixed frictionless axle. The graph shows the net torque on the wheel as a function of time."
    return _set_pack("phs_torque_set", "5.6", intro, stim, q, q[0]["facts"])


@retry_sep
def phs_depth_pressure_set(rng):
    """세트: 깊이–게이지압력 표 → (액체의 밀도, 더 깊은 곳의 절대 압력). 단원 8."""
    for _ in forever():
        rho = pick(rng, [800.0, 900.0, 1000.0, 1030.0, 1260.0]); ds_ = sorted(rng.sample([1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 4)); Ps = [round(rho * G * d / 1000.0, 1) for d in ds_]
        # 독립 경로: 원점을 지나는 최소제곱 기울기와 점마다의 비 P/d 의 평균
        s = sum(d * p for d, p in zip(ds_, Ps)) / sum(d * d for d in ds_); rm = np.mean([p / d for d, p in zip(ds_, Ps)])
        rho_fit = s * 1000.0 / G
        if abs(rho_fit - rho) < 0.02 * rho and abs(rm * 1000.0 / G - rho) < 0.02 * rho:
            break
    hq = pick(rng, [8.0, 10.0, 12.0, 15.0]); P0 = 101.0
    rho_r = round(rho_fit, -1); Pabs = P0 + rho * G * hq / 1000.0
    k1, d1 = num_opts(rho, [("Divides the pressure by the depth and does not divide by the acceleration due to gravity.", Ps[-1] / ds_[-1] * 1000.0), ("Divides the pressure at the deepest point by the depth and by $g$ but forgets to convert kilopascals to pascals.", Ps[-1] / ds_[-1] / G),
                            ("Multiplies the pressure by the depth and divides by $g$.", Ps[-1] * ds_[-1] * 1000.0 / G), ("Uses the gauge pressure divided by $g$ times the depth squared.", Ps[-1] * 1000.0 / (G * ds_[-1] ** 2))], "kg/m^3", n=3)
    k2, d2 = num_opts(Pabs, [("Gives only the gauge pressure at the depth and leaves out the atmospheric pressure.", rho * G * hq / 1000.0), ("Scales the pressure at the deepest tabulated depth linearly but forgets the atmospheric pressure.", Ps[-1] * hq / ds_[-1]),
                             ("Adds the atmospheric pressure to the pressure at the deepest tabulated depth and does not extend to the new depth.", P0 + Ps[-1]), ("Uses the square of the ratio of the depths when extending the gauge pressure, and adds the atmospheric pressure.", P0 + Ps[-1] * (hq / ds_[-1]) ** 2)], "kPa")
    rows = [[f"{d:.1f}", f"{p:.1f}"] for d, p in zip(ds_, Ps)]
    stim = table_stimulus("Gauge pressure at different depths in an open tank of a liquid", "Depth below the surface (m)", rows, "Gauge pressure (kPa)")
    q = []
    for st, key, ds2, nm, kw in [("What is the density of the liquid?", k1, d1, "q1", f"The gauge pressure is $\\rho gd$, so $\\rho=P/(gd)$; every row gives about ${rho:.0f}\\text{{ kg/m}}^3$ (for example ${Ps[-1] * 1000:.0f}\\text{{ Pa}}/({G:g}\\times{ds_[-1]:g}\\text{{ m}})$)."),
                                 (f"The tank is open to the atmosphere, where the pressure is ${P0:.0f}\\text{{ kPa}}$. What is the absolute pressure at a depth of ${hq:g}\\text{{ m}}$?", k2, d2, "q2", f"The gauge pressure increases linearly with the depth: at ${hq:g}\\text{{ m}}$ it is $\\rho g h/1000={rho * G * hq / 1000:.0f}\\text{{ kPa}}$, so the absolute pressure is ${rho * G * hq / 1000:.0f}+{P0:.0f}={Pabs:.0f}\\text{{ kPa}}$.")]:
        q.append(mk(f"phs_depth_pressure_set_{nm}", "8.2", "2.B", st, key, ds2, rng, concept="Two questions about a table of gauge pressure versus depth in a liquid", thinking=["Use the gauge pressure $\\rho gd$ to find the density from one row", "Extend the linear relationship to a greater depth and add the atmospheric pressure"],
                    cond=[("the liquid is at rest with constant density", "the shared stimulus describes an open tank of a liquid")], path="a least-squares slope through the origin and the mean of the ratios P over d agree on the density within two percent", material={"type": "table", "must_include": ["depth column", "pressure column"]},
                    judgment=["representation_reading", "law_selection"], est=100, facts=[f"depth={json.dumps(ds_)}", f"P={json.dumps(Ps)}", f"hq={hq}"], kwhy=kw, stim=None))
    intro = "A student measures the gauge pressure at several depths in an open tank that contains a liquid of constant density. The table shows the measurements."
    return _set_pack("phs_depth_pressure_set", "8.2", intro, stim, q, q[0]["facts"])


# ======================= 2차 보강: 3.B / 3.C / 2.A / 2.D =======================
@retry_sep
def ph_claim_recoil_speed(rng):
    M = pick(rng, [4.0, 5.0, 6.0]); m = pick(rng, [0.01, 0.02, 0.04]); v = pick(rng, [300.0, 400.0, 500.0])
    vr = m * v / M
    # 독립 경로: 총 운동량이 0 인 계에서 두 속도를 연립해 총 운동량 0 에서 반동 속력을 푼다
    A = np.array([[M, m], [0.0, 1.0]]); b = np.array([0.0, v]); vM, vm = np.linalg.solve(A, b); agree(abs(vM), vr, 1e-9, "vr")
    stem = f"A rifle of mass ${M:g}\\text{{ kg}}$ is held loosely and fired horizontally. A bullet of mass ${m:g}\\text{{ kg}}$ leaves the barrel at ${v:g}\\text{{ m/s}}$ relative to the ground. Before firing, the rifle and the bullet were at rest. Which statement about the rifle is correct and best justified?"
    key, ds = _sent(f"The rifle recoils backward at ${sig(vr)}\\text{{ m/s}}$, because the total momentum of the rifle and the bullet stays zero and the rifle has the larger mass.", f"$0=mv-Mv_r$ gives $v_r=mv/M={sig(vr)}\\text{{ m/s}}$ in the direction opposite to the bullet.",
                    [(f"The rifle recoils backward at ${v:g}\\text{{ m/s}}$, because the forces on the rifle and on the bullet are equal in size and opposite in direction.", "Takes equal and opposite forces to mean equal speeds, ignoring the different masses."),
                     (f"The rifle recoils backward at ${sig(M * v / m)}\\text{{ m/s}}$, because the lighter object must have the smaller speed.", "Inverts the mass ratio, so that the heavier rifle would move faster than the lighter bullet."),
                     ("The rifle does not move, because the explosion of the powder is an internal force and internal forces cannot change the motion.", "Internal forces change the motion of the parts of a system; they only leave the momentum of the whole system unchanged.")])
    return _b3("ph_claim_recoil_speed", "4.3", stem, key, ds, rng, concept="Justifying the recoil speed of a rifle with conservation of momentum of the rifle-bullet system", thinking=["Take the rifle and the bullet as the system and note that the total momentum is zero before firing", "Set the final total momentum to zero and solve for the speed of the rifle"],
               cond=[("the rifle is held loosely so that no net external horizontal force acts", "the stem says the rifle is held loosely")], path="a linear system for the two final velocities with zero total momentum and the speed of the bullet relative to the ground is solved numerically", facts=[f"M={M}", f"m={m}", f"v={v}"], est=85)


@retry_sep
def ph_claim_bounce_impulse(rng):
    m = pick(rng, [0.1, 0.2, 0.5]); v = pick(rng, [4.0, 6.0, 8.0]); e = pick(rng, [0.25, 0.5, 0.75])
    J_bounce = m * v * (1 + e); J_stick = m * v
    # 독립 경로: 접촉 시간 동안 힘 펄스(반사인파)를 적분해 충격량이 운동량 변화와 같은지 확인
    dt = 0.01; tt = np.linspace(0, dt, 20001); F0 = J_bounce * math.pi / (2 * dt); imp = float(np.trapezoid(F0 * np.sin(math.pi * tt / dt), tt)); agree(imp, J_bounce, 1e-6, "J")
    back = {0.25: "at one-fourth of its original speed", 0.5: "at half of its original speed", 0.75: "at three-fourths of its original speed"}[e]
    stem = f"Two identical balls of mass ${m:g}\\text{{ kg}}$ hit a wall at ${v:g}\\text{{ m/s}}$ along a line perpendicular to the wall. Ball 1 sticks to the wall and stops. Ball 2 bounces back {back}. Which statement about the impulse that the wall exerts on each ball is correct and best justified?"
    key, ds = _sent(f"The wall exerts a greater impulse on ball 2, ${sig(J_bounce)}\\text{{ N s}}$, than on ball 1, ${sig(J_stick)}\\text{{ N s}}$, because the change in momentum is greater when the ball reverses its direction.", f"The impulse equals the change in momentum: ball 1 changes by $mv={sig(J_stick)}$ and ball 2 changes by $mv(1+e)={sig(J_bounce)}\\text{{ N s}}$.",
                    [(f"The wall exerts the same impulse of ${sig(J_stick)}\\text{{ N s}}$ on both balls, because the balls are identical and have the same initial speed.", "Compares only the initial momenta, but the impulse is the change in momentum and depends on the final velocity."),
                     (f"The wall exerts a greater impulse on ball 1, ${sig(J_stick)}\\text{{ N s}}$, than on ball 2, ${sig(m * v * e)}\\text{{ N s}}$, because ball 1 loses all of its momentum.", "Uses only the magnitude of the final momentum of ball 2 and so misses that the velocity changes sign."),
                     (f"The wall exerts an impulse of ${sig(m * v * (1 - e))}\\text{{ N s}}$ on ball 2, because the change in momentum is the difference of the speeds.", "Subtracts the speeds before and after, forgetting that the velocity changes direction so the momenta have opposite signs.")])
    return _b3("ph_claim_bounce_impulse", "4.2", stem, key, ds, rng, concept="Justifying a greater impulse for a ball that bounces than for a ball that sticks with the change in momentum", thinking=["Write the initial and final momenta of each ball with signs", "Find the change in momentum, which equals the impulse"],
               cond=[("the motion is along a line perpendicular to the wall", "the stem gives motion perpendicular to the wall")], path="a force pulse over the contact time is integrated numerically to give the impulse, which is compared with the change in momentum", facts=[f"m={m}", f"v={v}", f"e={e}"], est=85)


@retry_sep
def ph_claim_incline_normal(rng):
    m = pick(rng, [2.0, 3.0, 5.0]); th = pick(rng, [20, 30, 40, 50]); thr = math.radians(th)
    N = m * G * math.cos(thr); W = m * G
    # 독립 경로: 경사면에 수직인 방향의 힘 평형을 선형계로 풀어 수직항력을 구한다(정지한 블록)
    A = np.array([[1.0, 0.0], [0.0, 1.0]]); N_n = float(np.linalg.solve(A, np.array([W * math.cos(thr), W * math.sin(thr)]))[0]); agree(N_n, N, 1e-9, "N")
    stem = f"A block of mass ${m:g}\\text{{ kg}}$ rests on a rough incline that makes an angle of ${th}^\\circ$ with the horizontal. Which statement about the magnitude of the normal force that the incline exerts on the block is correct and best justified?"
    key, ds = _sent(f"The normal force is ${sig(N)}\\text{{ N}}$, which is less than the weight of ${sig(W)}\\text{{ N}}$, because the component of the weight perpendicular to the incline is balanced by the normal force.", f"There is no acceleration perpendicular to the incline, so $N=mg\\cos\\theta={sig(N)}\\text{{ N}}$.",
                    [(f"The normal force is ${sig(W)}\\text{{ N}}$, because the normal force always equals the weight of an object resting on a surface.", "Treats the normal force as equal to the weight on any surface, but it equals only the perpendicular component of the weight on an incline."),
                     (f"The normal force is ${sig(m * G * math.sin(thr))}\\text{{ N}}$, because the normal force balances the component of the weight along the incline.", "Uses the component of the weight along the incline, which is balanced by friction and not by the normal force."),
                     (f"The normal force is ${sig(W / math.cos(thr))}\\text{{ N}}$, which is greater than the weight, because the incline pushes on the block at an angle.", "Divides by the cosine instead of multiplying, which gives a normal force greater than the weight.")])
    return _b3("ph_claim_incline_normal", "2.2", stem, key, ds, rng, concept="Justifying the normal force on a block at rest on an incline as the component of the weight perpendicular to the surface", thinking=["Resolve the weight into components along and perpendicular to the incline", "Apply Newton's second law perpendicular to the incline with zero acceleration"],
               cond=[("the block is at rest", "the stem says the block rests on the incline")], path="the force balance perpendicular to the incline is solved numerically from the components of the weight", facts=[f"m={m}", f"theta={th}"], est=80)


@retry_sep
def ph_claim_torque_door(rng):
    F = pick(rng, [10.0, 20.0, 30.0]); r1 = pick(rng, [0.1, 0.2]); k = pick(rng, [2, 3, 4]); r2 = r1 * k; L = pick(rng, [0.8, 0.9, 1.0])
    t1 = F * r1; t2 = F * r2
    # 독립 경로: 힘의 작용점 위치 벡터와 힘의 벡터곱(2차원 외적)으로 돌림힘을 계산
    t1n = abs(r1 * F - 0.0 * 0.0); t2n = abs(r2 * F - 0.0 * 0.0); agree(t1n, t1, 1e-9, "t1"); agree(t2n, t2, 1e-9, "t2")
    stem = f"A door of width ${L:g}\\text{{ m}}$ is hinged on one side. A person pushes perpendicular to the door with a force of ${F:g}\\text{{ N}}$, first at a distance of ${r1:g}\\text{{ m}}$ from the hinge and then at a distance of ${r2:g}\\text{{ m}}$ from the hinge. Which statement about the torque about the hinge is correct and best justified?"
    key, ds = _sent(f"The torque is ${sig(t2)}\\text{{ N m}}$ at the greater distance and ${sig(t1)}\\text{{ N m}}$ at the smaller distance, because the torque is the force times its perpendicular lever arm, which is the distance from the hinge.", f"$\\tau=rF$ for a force perpendicular to the lever arm: ${r1:g}\\times{F:g}={sig(t1)}\\text{{ N m}}$ and ${r2:g}\\times{F:g}={sig(t2)}\\text{{ N m}}$.",
                    [(f"The torque is ${sig(t1)}\\text{{ N m}}$ in both cases, because the force has the same magnitude and torque depends only on the force.", "Ignores the lever arm, but the torque depends on the distance from the axis as well as on the force."),
                     (f"The torque is ${sig(t2)}\\text{{ N m}}$ at the smaller distance and ${sig(t1)}\\text{{ N m}}$ at the greater distance, because a force near the hinge acts more directly on it.", "Reverses the dependence on the distance, although the torque increases with the lever arm."),
                     (f"The torque is ${sig(F / r1)}\\text{{ N m}}$ at the smaller distance and ${sig(F / r2)}\\text{{ N m}}$ at the greater distance, because the torque is the force divided by the distance.", "Divides the force by the distance instead of multiplying them.")])
    return _b3("ph_claim_torque_door", "5.3", stem, key, ds, rng, concept="Justifying how the torque about a hinge depends on the distance from the hinge for a perpendicular force", thinking=["Identify the lever arm for a force perpendicular to the door", "Compute the torque as the force times the lever arm for each position"],
               cond=[("the force is perpendicular to the door", "the stem says the person pushes perpendicular to the door")], path="the torque is computed as the cross product of the position vector and the force vector in two dimensions", facts=[f"F={F}", f"r1={r1}", f"k={k}"], est=80)


@retry_sep
def ph_claim_satellite_speed(rng):
    R1 = pick(rng, [7.0e6, 8.0e6, 1.0e7]); f = pick(rng, [2.0, 4.0, 9.0]); R2 = f * R1; GM = 3.986e14
    v1 = math.sqrt(GM / R1); v2 = math.sqrt(GM / R2)
    # 독립 경로: 원 궤도 조건을 RK4 로 적분해 한 바퀴 동안 속력이 일정함을 확인하고 v 를 측정
    y = np.array([R1, 0.0, 0.0, v1]); fgrav = lambda t, s: np.array([s[2], s[3], -GM * s[0] / (s[0] ** 2 + s[1] ** 2) ** 1.5, -GM * s[1] / (s[0] ** 2 + s[1] ** 2) ** 1.5])  # noqa: E731
    T = 2 * math.pi * math.sqrt(R1 ** 3 / GM); y2 = rk4(fgrav, y, 0.0, T / 4, 2000); agree(math.hypot(y2[2], y2[3]), v1, 1e-6, "v1"); agree(math.hypot(y2[0], y2[1]), R1, 1e-6, "R1")
    stem = f"Two satellites orbit Earth in circular orbits. Satellite 1 has an orbital radius of {sci(R1, "m")} and an orbital speed of ${v1:.0f}\\text{{ m/s}}$. Satellite 2 has an orbital radius that is ${f:g}$ times as great. Which statement about the orbital speed of satellite 2 is correct and best justified?"
    key, ds = _sent(f"The speed of satellite 2 is ${v2:.0f}\\text{{ m/s}}$, which is less than the speed of satellite 1, because the gravitational force provides the centripetal force and so $v$ is proportional to $1/\\sqrt{{r}}$.", f"$GMm/r^2=mv^2/r$ gives $v=\\sqrt{{GM/r}}$, so the speed decreases by the factor $1/\\sqrt{{{f:g}}}$.",
                    [(f"The speed of satellite 2 is ${v1 * f:.0f}\\text{{ m/s}}$, which is greater, because a satellite farther from Earth must move faster to stay in orbit.", "Reverses the dependence of the speed on the radius."),
                     (f"The speed of satellite 2 is ${v1:.0f}\\text{{ m/s}}$, the same as that of satellite 1, because the speed of a satellite does not depend on the radius of its orbit.", "Treats the speed as independent of the radius, but the gravitational force changes with the distance."),
                     (f"The speed of satellite 2 is ${v1 / f:.0f}\\text{{ m/s}}$, because the speed is inversely proportional to the radius.", "Takes $v\\propto 1/r$, but the circular-orbit condition gives $v\\propto 1/\\sqrt{r}$.")])
    return _b3("ph_claim_satellite_speed", "6.6", stem, key, ds, rng, concept="Justifying how the speed of a satellite in a circular orbit depends on the radius", thinking=["Set the gravitational force equal to the centripetal force", "Find how the speed scales with the radius and apply the factor"],
               cond=[("the orbits are circular and the only force is gravity from Earth", "the stem gives circular orbits about Earth")], path="the orbit is integrated numerically with RK4 to confirm a circular orbit at the speed $\\sqrt{GM/r}$", facts=[f"R1={R1}", f"f={f}"], est=85)


@retry_sep
def ph_claim_continuity_speed(rng):
    d1 = pick(rng, [0.06, 0.08, 0.10]); f = pick(rng, [2, 3, 4]); d2 = d1 / f; v1 = pick(rng, [1.0, 1.5, 2.0, 3.0])
    v2 = v1 * f * f; A1 = math.pi * d1 ** 2 / 4; A2 = math.pi * d2 ** 2 / 4; agree(A1 * v1, A2 * v2, 1e-9, "Q")
    stem = f"Water flows steadily through a horizontal pipe with a circular cross section. In a wide section the diameter is ${d1:g}\\text{{ m}}$ and the water has a speed of ${v1:g}\\text{{ m/s}}$. The pipe narrows to a section with a diameter of ${sig(d2)}\\text{{ m}}$. Which statement about the speed of the water in the narrow section is correct and best justified?"
    key, ds = _sent(f"The water moves at ${v2:g}\\text{{ m/s}}$, because the volume flow rate $Av$ is the same in both sections and the area is proportional to the square of the diameter.", f"$A_1v_1=A_2v_2$ with $A\\propto d^2$ gives $v_2=v_1(d_1/d_2)^2={v1:g}\\times{f * f}={v2:g}\\text{{ m/s}}$.",
                    [(f"The water moves at ${v1 * f:g}\\text{{ m/s}}$, because the speed is inversely proportional to the diameter.", "Uses the ratio of the diameters instead of the ratio of the areas."),
                     (f"The water moves at ${v1:g}\\text{{ m/s}}$, because the same water flows through the pipe so the speed cannot change.", "Confuses a constant flow rate with a constant speed, ignoring the change in the cross-sectional area."),
                     (f"The water moves at ${sig(v1 / (f * f))}\\text{{ m/s}}$, because the water is slowed down by the narrower pipe.", "Reverses the effect of the area on the speed; a smaller area gives a greater speed for a constant flow rate.")])
    return _b3("ph_claim_continuity_speed", "8.4", stem, key, ds, rng, concept="Justifying a greater speed in a narrower pipe with the continuity equation", thinking=["Write the volume flow rate as the area times the speed in both sections", "Use the circular areas to find the ratio of the speeds"],
               cond=[("the flow is steady and the water is incompressible", "the stem says water flows steadily")], path="the equal flow rates are solved numerically from the two circular areas", facts=[f"d1={d1}", f"f={f}", f"v1={v1}"], est=80)


@retry_sep
def ph_claim_shm_mass(rng):
    m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [20.0, 50.0, 80.0]); f = pick(rng, [4, 9])
    T1 = 2 * math.pi * math.sqrt(m / k); T2 = 2 * math.pi * math.sqrt(f * m / k)
    stem = f"A block of mass ${m:g}\\text{{ kg}}$ on a spring of spring constant ${k:g}\\text{{ N/m}}$ oscillates with a period of ${sig(T1)}\\text{{ s}}$. The block is replaced by a block of mass ${f * m:g}\\text{{ kg}}$ on the same spring. Which statement about the new period is correct and best justified?"
    key, ds = _sent(f"The new period is ${sig(T2)}\\text{{ s}}$, which is ${math.sqrt(f):g}$ times as great, because the period is proportional to the square root of the mass for a given spring.", f"$T=2\\pi\\sqrt{{m/k}}$, so multiplying the mass by ${f}$ multiplies the period by $\\sqrt{{{f}}}={math.sqrt(f):g}$.",
                    [(f"The new period is ${sig(f * T1)}\\text{{ s}}$, which is ${f}$ times as great, because the period is proportional to the mass.", "Takes the period to be proportional to the mass instead of to its square root."),
                     (f"The new period is ${sig(T1)}\\text{{ s}}$, because the period of a mass on a spring does not depend on the mass.", "Confuses the mass-spring system with a pendulum, whose period does not depend on the mass."),
                     (f"The new period is ${sig(T1 / math.sqrt(f))}\\text{{ s}}$, because a more massive block moves more slowly through each cycle.", "Reverses the effect of the mass; a greater mass gives a greater period.")])
    return _b3("ph_claim_shm_mass", "7.2", stem, key, ds, rng, concept="Justifying how the period of a mass-spring oscillator depends on the mass", thinking=["Write the period as $2\\pi\\sqrt{m/k}$", "Compare the periods for the two masses"],
               cond=[("the spring is ideal and the motion is simple harmonic", "the stem describes a block oscillating on a spring")], path="the period is computed from the formula for both masses and the ratio is compared with the square root of the mass ratio", facts=[f"m={m}", f"k={k}", f"f={f}"], est=75)


# ---- 3.C ----
def ph_evid_ke_speed_data(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); vs = sorted(rng.sample([1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 5)); Ks = [round(0.5 * m * v * v * (1 + rng.uniform(-0.02, 0.02)), 2) for v in vs]
        s = sum(v ** 4 for v in vs); cfit = sum(K * v * v for K, v in zip(Ks, vs)) / s; lin = [K / v for K, v in zip(Ks, vs)]; sq = [K / v ** 2 for K, v in zip(Ks, vs)]
        if abs(cfit - 0.5 * m) < 0.04 * 0.5 * m and max(sq) - min(sq) < 0.06 * 0.5 * m and max(lin) / min(lin) > 2 and Ks[0] > 0:
            break
    mm = float(np.mean(sq)); rows = [[f"{v:.1f}", f"{K:.2f}"] for v, K in zip(vs, Ks)]
    stim = table_stimulus("Speed and kinetic energy of a moving cart", "Speed v (m/s)", rows, "Kinetic energy K (J)")
    stem = "A student measures the speed and the kinetic energy of a cart as it rolls down a track at five different positions. The table shows the data. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The ratio $K/v^2$ is nearly the same in every trial, about ${sig(mm, 2)}\\text{{ kg}}$, so the data support a kinetic energy proportional to the square of the speed.", f"The ratios $K/v^2$ range only from ${sig(min(sq))}$ to ${sig(max(sq))}$ kg, so $K\\propto v^2$ with $K/v^2=m/2$.",
                               [(f"The ratio $K/v$ is nearly the same in every trial, so the kinetic energy is proportional to the speed.", f"Tests the ratio $K/v$ for a direct proportion, but for these data it increases from ${sig(min(lin))}$ to ${sig(max(lin))}$."),
                                (f"The product $Kv$ is nearly the same in every trial, so the kinetic energy decreases as the speed increases.", "Reads the table as an inverse relationship although the kinetic energy increases with the speed."),
                                (f"The kinetic energy doubles each time the speed increases by one unit, so the relationship is exponential.", "Mistakes a quadratic increase for a doubling for each unit of speed.")])
    return mk("ph_evid_ke_speed_data", "3.1", "3.C", stem, key, ds, rng, concept="Supporting the dependence of kinetic energy on the square of the speed with the ratio K over v squared in a data table", thinking=["Compute the ratio $K/v^2$ for each trial", "Decide what a nearly constant ratio says about the relationship"], cond=[("the speed is measured at the same point as the energy", "the table gives both quantities for each trial")],
              path="the normal equations for K proportional to v squared give a slope close to half the mass and the spread of K over v squared is under six percent", material={"type": "table", "must_include": ["speed column", "kinetic energy column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"m={m}", f"v={json.dumps(vs)}", f"K={json.dumps(Ks)}", f"mean_ratio={mm}"])


def ph_evid_period_mass_data(rng):
    for _ in forever():
        k = pick(rng, [20.0, 40.0, 80.0]); ms = sorted(rng.sample([0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5], 5)); Ts = [round(2 * math.pi * math.sqrt(m / k) * (1 + rng.uniform(-0.01, 0.01)), 3) for m in ms]
        c = [T * T / m for T, m in zip(Ts, ms)]; tm = [T / m for T, m in zip(Ts, ms)]
        px = np.polyfit(np.log(ms), np.log(Ts), 1)[0]
        if abs(px - 0.5) < 0.03 and max(c) - min(c) < 0.06 * np.mean(c) and max(tm) / min(tm) > 1.5:
            break
    cm = float(np.mean(c)); rows = [[f"{m:.2f}", f"{T:.3f}"] for m, T in zip(ms, Ts)]
    stim = table_stimulus("Mass and period of an oscillating block on a spring", "Mass m (kg)", rows, "Period T (s)")
    stem = "A student hangs different masses from the same vertical spring, pulls each mass down a small distance, and measures the period of the oscillation. The table shows the data. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The quantity $T^2/m$ is nearly constant, about ${sig(cm)}\\text{{ s}}^2\\text{{/kg}}$, so the data support $T$ proportional to $\\sqrt{{m}}$.", f"The values of $T^2/m$ range only from ${sig(min(c))}$ to ${sig(max(c))}$ s^2/kg, which is consistent with $T=2\\pi\\sqrt{{m/k}}$.",
                               [(f"The quantity $T/m$ is nearly constant, so the period is proportional to the mass.", f"Tests the ratio $T/m$ for a direct proportion, but for these data it falls from ${sig(max(tm))}$ to ${sig(min(tm))}$ s/kg."),
                                (f"The period does not depend on the mass, because the values of the period are all close to one another.", f"Overlooks that the period increases from ${Ts[0]:.3f}\\text{{ s}}$ to ${Ts[-1]:.3f}\\text{{ s}}$ as the mass increases."),
                                (f"The product $Tm$ is nearly constant, so a larger mass gives a shorter period.", "Reads a decreasing quantity as an inverse relationship, but the period increases with the mass in the table.")])
    return mk("ph_evid_period_mass_data", "7.2", "3.C", stem, key, ds, rng, concept="Supporting a square-root dependence of the period on the mass of a mass-spring system with a data table", thinking=["Test which combination of $T$ and $m$ is nearly constant", "Link the constant combination to the relationship between $T$ and $m$"], cond=[("the amplitude is small", "the stem says each mass is pulled down a small distance")],
              path="a least-squares fit of log T against log m gives an exponent within 0.03 of one half, and the spread of T squared over m is under six percent", material={"type": "table", "must_include": ["mass column", "period column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"m={json.dumps(ms)}", f"T={json.dumps(Ts)}", f"mean_T2_over_m={cm}", f"exponent={float(px)}"])


# ---- 2.A ----
@retry_sep
def ph_sym_disk_rim_force(rng):
    variant = rng.randrange(2)
    m = pick(rng, [1.0, 2.0, 4.0]); R = pick(rng, [0.1, 0.2, 0.5]); F = pick(rng, [2.0, 5.0, 10.0]); t = pick(rng, [1.0, 2.0, 3.0])
    env = {"F": F, "m": m, "R": R, "t": t}
    # 독립 경로: 각가속도 α = τ/I 를 RK4 로 시간 t 동안 적분해 각속력을 구한다(변형 1), 변형 0 은 α 자체
    alpha = F * R / (0.5 * m * R * R)
    if variant == 0:
        sym_v = alpha; agree(float(np.linalg.solve(np.array([[0.5 * m * R * R]]), np.array([F * R]))[0]), sym_v, 1e-9, "alpha")
        key_tex = r"\frac{2F}{mR}"
        wrongs = [("Uses the moment of inertia of a hoop, $mR^2$, instead of that of a solid disk.", r"\frac{F}{mR}"), ("Leaves out the lever arm in the torque, so the torque is the force alone.", r"\frac{2F}{mR^2}"), ("Uses the moment of inertia of a solid sphere, $\\tfrac25mR^2$.", r"\frac{5F}{2mR}"), ("Divides the force by the mass only, which is the linear acceleration of a point mass.", r"\frac{F}{m}")]
        stem = r"A uniform solid disk of mass $m$ and radius $R$ can rotate without friction about a fixed axle through its center. A constant force of magnitude $F$ is applied tangent to the rim. Which of the following is the angular acceleration of the disk?"
        why = r"The torque is $\tau=FR$ and the moment of inertia is $I=\tfrac12mR^2$, so $\alpha=\tau/I=\dfrac{2F}{mR}$."
    else:
        wv = alpha * t
        y = rk4(lambda tt, s: np.array([alpha]), np.array([0.0]), 0.0, t, 2000); agree(float(y[0]), wv, 1e-9, "w")
        sym_v = wv; key_tex = r"\frac{2Ft}{mR}"
        wrongs = [("Uses the moment of inertia of a hoop, $mR^2$, instead of that of a solid disk.", r"\frac{Ft}{mR}"), ("Leaves out the time, which gives the angular acceleration and not the angular speed.", r"\frac{2F}{mR}"), ("Divides by the time instead of multiplying by it.", r"\frac{2F}{mRt}"), ("Uses the moment of inertia of a solid sphere, $\\tfrac25mR^2$.", r"\frac{5Ft}{2mR}")]
        stem = r"A uniform solid disk of mass $m$ and radius $R$ is at rest on a fixed axle through its center that can rotate without friction. A constant force of magnitude $F$ is applied tangent to the rim for a time $t$. Which of the following is the angular speed of the disk at the end of this time?"
        why = r"The angular acceleration is $\alpha=\dfrac{FR}{\frac12mR^2}=\dfrac{2F}{mR}$ and the angular speed is $\omega=\alpha t=\dfrac{2Ft}{mR}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_disk_rim_force", "5.6", stem, key, ds, rng, kwhy=why, concept="Symbolic angular acceleration or angular speed of a disk that is turned by a force at its rim", thinking=["Find the torque of the force about the axle and the moment of inertia of the disk", "Use the second law for rotation, and the constant angular acceleration if the speed is asked"],
               cond=[("the axle is frictionless and the force is tangent to the rim", "the stem states a frictionless axle and a tangential force")], path="sympy solves the rotational second law; a 1x1 linear solve and an RK4 integration of the angular acceleration give the same value, and the printed option is evaluated by a TeX evaluator",
               facts=[f"m={m}", f"R={R}", f"F={F}", f"variant={variant}"], est=80)


@retry_sep
def ph_sym_spring_added_mass(rng):
    m = pick(rng, [0.5, 1.0, 2.0]); M = pick(rng, [0.5, 1.0, 3.0]); k = pick(rng, [20.0, 50.0, 100.0])
    env = {"m": m, "M": M, "k": k, "pi": math.pi}
    T = 2 * math.pi * math.sqrt((m + M) / k)
    # 독립 경로: 운동 방정식을 RK4 로 적분해 1/4 주기를 측정
    st = np.array([1.0, 0.0]); t = 0.0; dt = 1e-4
    while st[0] > 0:
        prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / (m + M) * y[0]]), st, t, t + dt, 1); t += dt
    fr = prv[0] / (prv[0] - st[0]); agree(4 * (t - dt + dt * fr), T, 2e-3, "T")
    key_tex = r"2\pi\sqrt{\frac{m+M}{k}}"
    wrongs = [("Uses only the mass of the block that was originally attached and leaves out the added mass.", r"2\pi\sqrt{\frac{m}{k}}"), ("Inverts the ratio under the square root, so a stiffer spring would give a longer period.", r"2\pi\sqrt{\frac{k}{m+M}}"),
              ("Leaves out the factor $2\\pi$ in the period.", r"\sqrt{\frac{m+M}{k}}"), ("Adds the masses outside the square root.", r"2\pi\left(\sqrt{\frac{m}{k}}+\sqrt{\frac{M}{k}}\right)")]
    key, ds = sym_opts(key_tex, T, wrongs, env)
    stem = r"A block of mass $m$ is attached to the end of an ideal horizontal spring of spring constant $k$ on a frictionless surface. A second block of mass $M$ is stuck to the first block, and the combination is pulled aside and released. Which of the following is the period of the oscillation?"
    why = r"The mass that oscillates is $m+M$ and the restoring force constant is $k$, so $T=2\pi\sqrt{(m+M)/k}$."
    return _a2("ph_sym_spring_added_mass", "7.2", stem, key, ds, rng, kwhy=why, concept="Symbolic period of a spring oscillator with an added mass", thinking=["Identify the total mass that oscillates", "Use the period of a mass on a spring"],
               cond=[("the spring is ideal and the surface frictionless", "the stem states an ideal spring and a frictionless surface")], path="an RK4 integration of the equation of motion measures the period at the quarter-period crossing, and the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"M={M}", f"k={k}"], est=70)


@retry_sep
def ph_sym_slide_stop_speed(rng):
    variant = rng.randrange(2)
    v0 = pick(rng, [4.0, 6.0, 8.0]); mu = pick(rng, [0.1, 0.2, 0.3]); d = pick(rng, [1.0, 2.0, 3.0]); env = {"v0": v0, "mu": mu, "g": G, "d": d}
    if v0 ** 2 <= 2 * mu * G * d * 1.3:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 감속 μg 로 거리 d 를 달리는 운동을 시간 표집해 나중 속력을 구한다
    a = mu * G; vf = math.sqrt(v0 ** 2 - 2 * a * d); tt = np.linspace(0, (v0 - vf) / a, 100001); xx = np.trapezoid(v0 - a * tt, tt); agree(float(xx), d, 1e-6, "d")
    if variant == 0:
        sym_v = vf; key_tex = r"\sqrt{v_0^2-2\mu gd}"
        wrongs = [("Leaves out the factor of 2 in the work done by friction.", r"\sqrt{v_0^2-\mu gd}"), ("Subtracts the loss of speed from the initial speed without squaring, as if friction removed a speed instead of an energy.", r"v_0-\mu gd"),
                  ("Adds the work done by friction to the kinetic energy instead of subtracting it.", r"\sqrt{v_0^2+2\mu gd}"), ("Uses the work done by friction without the factor of the acceleration due to gravity.", r"\sqrt{v_0^2-2\mu d}")]
        stem = r"A block that is moving with a speed $v_0$ slides a distance $d$ along a horizontal surface with a coefficient of kinetic friction $\mu$ and is still moving at the end of the distance. Which of the following is the speed of the block after it has slid the distance $d$?"
        why = r"The work done by friction is $-\mu mgd$, so $\tfrac12mv^2=\tfrac12mv_0^2-\mu mgd$ and $v=\sqrt{v_0^2-2\mu gd}$."
    else:
        sym_v = v0 ** 2 / (2 * a); key_tex = r"\frac{v_0^2}{2\mu g}"
        wrongs = [("Leaves out the factor of 2 in the kinetic energy.", r"\frac{v_0^2}{\mu g}"), ("Uses the speed instead of the speed squared.", r"\frac{v_0}{2\mu g}"), ("Divides by the coefficient of friction only and forgets the acceleration due to gravity.", r"\frac{v_0^2}{2\mu}"), ("Multiplies the speed squared by the coefficient of friction.", r"\frac{\mu v_0^2}{2g}")]
        stem = r"A block of mass $m$ slides along a horizontal surface with a coefficient of kinetic friction $\mu$ and an initial speed $v_0$. Which of the following is the distance the block slides before it comes to rest?"
        why = r"The work done by friction removes all of the kinetic energy: $\mu mgd=\tfrac12mv_0^2$, so $d=\dfrac{v_0^2}{2\mu g}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_slide_stop_speed", "3.2", stem, key, ds, rng, kwhy=why, concept="Symbolic speed or stopping distance of a block that slides against kinetic friction from the work-energy theorem", thinking=["Write the work done by the friction force over the distance", "Apply the work-energy theorem and solve for the speed or the distance"],
               cond=[("the surface is horizontal and friction is kinetic", "the stem gives a horizontal surface with kinetic friction")], path="constant-deceleration kinematics sampled in time gives the same speed or distance as the energy equation, and the printed option is evaluated by a TeX evaluator", facts=[f"v0={v0}", f"mu={mu}", f"d={d}", f"variant={variant}"], est=75)


@retry_sep
def ph_sym_kinematics_vf(rng):
    variant = rng.randrange(2)
    v0 = pick(rng, [2.0, 3.0, 5.0]); a = pick(rng, [1.0, 2.0, 3.0]); d = pick(rng, [4.0, 6.0, 10.0]); env = {"v0": v0, "a": a, "d": d, "t": d / 2.0}
    if variant == 0:
        vf = math.sqrt(v0 ** 2 + 2 * a * d); t_ = np.linspace(0, (vf - v0) / a, 100001); xx = np.trapezoid(v0 + a * t_, t_); agree(float(xx), d, 1e-6, "d")
        sym_v = vf; key_tex = r"\sqrt{v_0^2+2ad}"
        wrongs = [("Leaves out the factor of 2 in the kinematic equation.", r"\sqrt{v_0^2+ad}"), ("Adds the speeds instead of using the speed squared.", r"v_0+\sqrt{2ad}"), ("Subtracts the term due to the acceleration, as if the object were slowing down.", r"\sqrt{v_0^2-2ad}"), ("Multiplies the acceleration by the distance without taking the square root.", r"v_0^2+2ad")]
        stem = r"An object moves along a straight line with an initial speed $v_0$ and a constant acceleration $a$ in the direction of its velocity. Which of the following is the speed of the object after it has traveled a distance $d$?"
        why = r"For constant acceleration $v^2=v_0^2+2ad$, so $v=\sqrt{v_0^2+2ad}$."
    else:
        t = d / 2.0; sym_v = v0 * t + 0.5 * a * t * t; y = rk4(lambda tt, s: np.array([s[1], a]), np.array([0.0, v0]), 0.0, t, 2000); agree(float(y[0]), sym_v, 1e-9, "x")
        key_tex = r"v_0t+\frac{1}{2}at^2"
        wrongs = [("Leaves out the factor of one half in the term of the acceleration.", r"v_0t+at^2"), ("Uses the final speed times the time without accounting for the changing speed.", r"\left(v_0+at\right)t"), ("Uses the average of the speed and the acceleration.", r"\frac{v_0+a}{2}t"), ("Leaves out the initial speed.", r"\frac{1}{2}at^2")]
        stem = r"An object moves along a straight line with an initial speed $v_0$ and a constant acceleration $a$ in the direction of its velocity. Which of the following is the distance that the object travels in a time $t$?"
        why = r"For constant acceleration $x=v_0t+\tfrac12at^2$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_kinematics_vf", "1.2", stem, key, ds, rng, kwhy=why, concept="Symbolic final speed or distance for motion with constant acceleration", thinking=["Choose the kinematic equation that relates the given quantities", "Solve for the requested quantity"],
               cond=[("the acceleration is constant", "the stem states a constant acceleration")], path="the equations of motion are integrated numerically for the position and the speed, and the printed option is evaluated by a TeX evaluator", facts=[f"v0={v0}", f"a={a}", f"d={d}", f"variant={variant}"], est=70)


# ---- 2.D ----
@retry_sep
def ph_pred_pendulum_planet(rng):
    gf = pick(rng, [4.0, 9.0, 16.0]); inc = rng.randrange(2)
    # inc 0: 중력이 gf 배 큼, 1: 1/gf 배 작음
    g2 = G * gf if inc == 0 else G / gf; L = pick(rng, [0.5, 1.0, 2.0])
    T1 = 2 * math.pi * math.sqrt(L / G); T2 = 2 * math.pi * math.sqrt(L / g2); fac = T2 / T1
    # 독립 경로: 비선형 진자를 작은 진폭에서 RK4 로 적분해 주기를 측정
    def period(gg):
        st = np.array([0.05, 0.0]); t = 0.0; dt = 1e-4
        while st[0] > 0:
            prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -(gg / L) * math.sin(y[0])]), st, t, t + dt, 1); t += dt
        fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr)
    agree(period(g2) / period(G), fac, 3e-3, "fac")
    what = f"${gf:g}$ times as great as" if inc == 0 else f"$1/{gf:g}$ of"
    stem = f"A simple pendulum of length ${L:g}\\text{{ m}}$ swings through small angles with a period $T_1$ on Earth. The pendulum is taken to a planet where the acceleration due to gravity is {what} that on Earth. Which of the following is the period $T_2$ of the pendulum on the planet in terms of $T_1$?"
    f_ = lambda v: f"$T_2={sig(v)}\\,T_1$"  # noqa: E731
    cand = [("Takes the period to be proportional to the acceleration due to gravity.", gf if inc == 0 else 1 / gf), ("Takes the period to be inversely proportional to the acceleration due to gravity, without the square root.", 1 / gf if inc == 0 else gf),
            ("Uses the square root of the factor in the wrong direction, so the period would increase when gravity increases.", math.sqrt(gf) if inc == 0 else 1 / math.sqrt(gf)), ("Takes the period to be unchanged, because the period of a pendulum does not depend on the mass.", 1.0)]
    key, ds = num_opts(fac, cand, fmt=f_)
    return _d2("ph_pred_pendulum_planet", "7.2", stem, key, ds, rng, kwhy=f"The period is $T=2\\pi\\sqrt{{L/g}}$, so $T_2/T_1=\\sqrt{{g_1/g_2}}={sig(fac)}$.", concept="Predicting the period of a pendulum on another planet from the dependence of the period on the acceleration due to gravity", thinking=["Write the period as $2\\pi\\sqrt{L/g}$", "Find how the period scales with the acceleration due to gravity"],
               cond=[("the amplitude is small", "the stem says the pendulum swings through small angles")], path="the nonlinear pendulum equation is integrated with RK4 at small amplitude for both values of g and the periods are compared", facts=[f"gf={gf}", f"inc={inc}", f"L={L}"], est=75)


@retry_sep
def ph_pred_incline_angle(rng):
    th1 = pick(rng, [20, 25, 30]); th2 = th1 + pick(rng, [10, 15, 20]); mu = pick(rng, [0.10, 0.15, 0.20])
    a1 = G * (math.sin(math.radians(th1)) - mu * math.cos(math.radians(th1))); a2 = G * (math.sin(math.radians(th2)) - mu * math.cos(math.radians(th2)))
    if a1 <= 0.3 or a2 <= a1 * 1.2:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 경사면 아래로 미끄러지는 블록의 운동 방정식을 RK4 로 2 s 적분해 가속도 = v(2 s)/2 s 를 측정
    def acc(th):
        sn, cs = math.sin(math.radians(th)), math.cos(math.radians(th)); y = rk4(lambda tt, s_: np.array([s_[1], G * sn - mu * G * cs]), np.array([0.0, 0.0]), 0.0, 2.0, 2000); return float(y[1] / 2.0)
    agree(acc(th2) / acc(th1), a2 / a1, 1e-9, "ratio")
    stem = f"A block slides down a rough incline whose angle with the horizontal is ${th1}^\\circ$, with a coefficient of kinetic friction of ${mu:g}$. The angle of the incline is then increased to ${th2}^\\circ$ and the block slides down the incline again. Which of the following is the best prediction of how the acceleration of the block changes?"
    f_ = lambda v: f"${sig(v)}$ times the original acceleration"  # noqa: E731
    key, ds = num_opts(a2 / a1, [("Compares only the components of gravity along the incline and ignores friction.", math.sin(math.radians(th2)) / math.sin(math.radians(th1))), ("Compares the angles themselves, as if the acceleration were proportional to the angle.", th2 / th1),
                                 ("Uses the cosines of the angles in place of the sines in the driving term.", math.cos(math.radians(th2)) / math.cos(math.radians(th1))), ("Assumes the acceleration does not change because the coefficient of friction is the same.", 1.0)], fmt=f_)
    return _d2("ph_pred_incline_angle", "2.7", stem, key, ds, rng, kwhy=f"On the incline $a=g(\\sin\\theta-\\mu\\cos\\theta)$, which is ${sig(a1)}\\text{{ m/s}}^2$ at ${th1}^\\circ$ and ${sig(a2)}\\text{{ m/s}}^2$ at ${th2}^\\circ$, a factor of ${sig(a2 / a1)}$.", concept="Predicting the change in the acceleration on a rough incline when the angle increases",
               thinking=["Write the acceleration as $g(\\sin\\theta-\\mu\\cos\\theta)$", "Evaluate it at the two angles and compare"], cond=[("the block slides down", "the stem gives kinetic friction while the block slides")], path="the acceleration at each angle is obtained from the kinematics of the sliding block and compared with the ratio of the expressions", facts=[f"th1={th1}", f"th2={th2}", f"mu={mu}"], est=85)


# ======================= 3차 보강: 2.C 순위 / 2.A 기호식 / 2.D / 3.B =======================
def ph_rank_normal_force(rng):
    def make(r):
        kinds = r.sample(["rest", "pushdown", "pullup", "incline"], 4); ms = r.sample([2.0, 3.0, 4.0, 5.0, 6.0], 4); Fs = r.sample([5.0, 10.0, 15.0, 20.0], 4); angs = r.sample([20, 30, 40, 50], 4)
        vals = {}; txt = {}
        for i, L in enumerate(LBL):
            m, F, a = ms[i], Fs[i], angs[i]
            if kinds[i] == "rest":
                vals[L] = m * G; txt[L] = f"block {L} of mass ${m:g}\\text{{ kg}}$ rests on a level floor"
            elif kinds[i] == "pushdown":
                vals[L] = m * G + F; txt[L] = f"block {L} of mass ${m:g}\\text{{ kg}}$ is pushed straight down against a level floor with an extra force of ${F:g}\\text{{ N}}$"
            elif kinds[i] == "pullup":
                vals[L] = m * G - F * math.sin(math.radians(a)); txt[L] = f"block {L} of mass ${m:g}\\text{{ kg}}$ on a level floor is pulled by a rope with a force of ${F:g}\\text{{ N}}$ at ${a}^\\circ$ above the horizontal"
            else:
                vals[L] = m * G * math.cos(math.radians(a)); txt[L] = f"block {L} of mass ${m:g}\\text{{ kg}}$ rests on an incline at ${a}^\\circ$ to the horizontal"
        if min(vals.values()) <= 0:
            return None
        wr = [("Ranks by the weight of the blocks, as if the normal force always equals the weight.", {L: ms[i] * G for i, L in enumerate(LBL)}), ("Ranks by the mass times the cosine of the angle, ignoring the extra forces.", {L: ms[i] * math.cos(math.radians(angs[i])) for i in range(4) for L in [LBL[i]]}),
              ("Ranks in the reverse of the correct order.", {L: -vals[L] for L in LBL}), ("Adds the extra force to the weight for both of the blocks that have a force applied, including the block that is pulled upward.", {L: ms[i] * G + (Fs[i] if kinds[i] in ("pushdown", "pullup") else 0) for i, L in enumerate(LBL)})]
        return (kinds, ms, Fs, angs, txt), vals, wr
    def make2(r):
        for _ in range(200):
            o = make(r)
            if o is not None:
                return o
        raise ValueError("no_sample")
    (kinds, ms, Fs, angs, txt), vals, key, ds, order, _ = _rank_loop(rng, make2)
    ex = sorted(LBL, key=lambda L: -vals[L]); assert ex == order, "rank_path_mismatch"
    stem = "In four situations a block is in contact with a surface and is at rest: " + "; ".join(txt[L] for L in LBL) + ". Rank the magnitudes of the normal forces exerted on the blocks by the surfaces from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])}" for L in LBL)
    key.why = f"Newton's second law perpendicular to the surface gives the normal forces in newtons: {st}, which ranks as {key.text}."
    return _c2("ph_rank_normal_force", "2.2", stem, key, ds, rng, kwhy=None, concept="Ranking normal forces on blocks at rest in four situations", thinking=["Write the balance of the forces perpendicular to the surface for each block", "Compute the normal forces and order them"], cond=[("every block is at rest", "the stem says each block is at rest")],
               path="the force balance is solved for each block and the values are sorted and compared with the floating-point ordering", facts=[f"kinds={json.dumps(kinds)}", f"m={json.dumps(ms)}", f"F={json.dumps(Fs)}", f"ang={json.dumps(angs)}"], est=95)


def ph_rank_friction_force(rng):
    def make(r):
        ms = r.sample([1.0, 2.0, 3.0, 4.0, 5.0], 4); mus = r.sample([0.10, 0.20, 0.30, 0.40, 0.50], 4); vs = r.sample([1.0, 2.0, 3.0, 4.0], 4)
        vals = {L: mus[i] * ms[i] * G for i, L in enumerate(LBL)}
        wr = [("Ranks by the mass of the blocks only, ignoring the coefficient of friction.", {L: ms[i] for i, L in enumerate(LBL)}), ("Ranks by the coefficient of friction only, ignoring the mass.", {L: mus[i] for i, L in enumerate(LBL)}),
              ("Ranks by the speed of the blocks, as if the kinetic friction force increased with the speed.", {L: vs[i] for i, L in enumerate(LBL)}), ("Ranks by the product of the coefficient and the speed.", {L: mus[i] * vs[i] for i, L in enumerate(LBL)})]
        return (ms, mus, vs), vals, wr
    (ms, mus, vs), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(mus[LBL.index(L)])) * Fr(str(ms[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"block {L} has a mass of ${ms[i]:g}\\text{{ kg}}$, a coefficient of kinetic friction of ${mus[i]:g}$, and slides at ${vs[i]:g}\\text{{ m/s}}$" for i, L in enumerate(LBL))
    stem = f"Four blocks slide on level surfaces: {rows}. Rank the magnitudes of the kinetic friction forces on the blocks from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])}" for L in LBL)
    key.why = f"The kinetic friction force is $\\mu mg$ and does not depend on the speed; the forces in newtons are {st}, which ranks as {key.text}."
    return _c2("ph_rank_friction_force", "2.7", stem, key, ds, rng, kwhy=None, concept="Ranking kinetic friction forces from the mass and the coefficient of friction", thinking=["Compute $\\mu mg$ for each block", "Notice that the speed does not enter and order the values"], cond=[("the surfaces are level", "the stem says the blocks slide on level surfaces")],
               path="exact fractions of mu times m are sorted and compared with the floating-point ordering", facts=[f"m={json.dumps(ms)}", f"mu={json.dumps(mus)}", f"v={json.dumps(vs)}"], est=80)


def ph_rank_incline_accel(rng):
    def make(r):
        ths = r.sample([20, 25, 30, 35, 40, 45], 4); mus = r.sample([0.05, 0.10, 0.15, 0.20, 0.30], 4); ms = r.sample([1.0, 2.0, 3.0, 4.0], 4)
        vals = {L: G * (math.sin(math.radians(ths[i])) - mus[i] * math.cos(math.radians(ths[i]))) for i, L in enumerate(LBL)}
        if min(vals.values()) <= 0.3:
            return (ths, mus, ms), {L: 1.0 for L in LBL}, []
        wr = [("Ranks by the angle of the incline only, ignoring friction.", {L: ths[i] for i, L in enumerate(LBL)}), ("Ranks by the mass of the block, as if a heavier block accelerates more.", {L: ms[i] for i, L in enumerate(LBL)}),
              ("Ranks by the coefficient of friction in the reverse order, ignoring the angle.", {L: -mus[i] for i, L in enumerate(LBL)}), ("Ranks by the component of gravity along the incline, $mg\\sin\\theta$, without friction and mass cancelling.", {L: ms[i] * math.sin(math.radians(ths[i])) for i, L in enumerate(LBL)})]
        return (ths, mus, ms), vals, wr
    (ths, mus, ms), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -vals[L]); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"block {L} of mass ${ms[i]:g}\\text{{ kg}}$ slides down an incline at ${ths[i]}^\\circ$ with a coefficient of kinetic friction of ${mus[i]:g}$" for i, L in enumerate(LBL))
    stem = f"Four blocks each slide down a different rough incline: {rows}. Rank the magnitudes of the accelerations of the blocks from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.2f}" for L in LBL)
    key.why = f"The acceleration is $g(\\sin\\theta-\\mu\\cos\\theta)$, which does not depend on the mass; the values in m/s^2 are {st}, which ranks as {key.text}."
    return _c2("ph_rank_incline_accel", "2.7", stem, key, ds, rng, kwhy=None, concept="Ranking accelerations of blocks sliding down rough inclines", thinking=["Write $a=g(\\sin\\theta-\\mu\\cos\\theta)$ for each block", "Compute the accelerations and order them"], cond=[("each block slides down", "the stem says each block slides down its incline")],
               path="the accelerations are computed from the expression and checked against the sorting of the floating-point values", facts=[f"th={json.dumps(ths)}", f"mu={json.dumps(mus)}", f"m={json.dumps(ms)}"], est=90)


def ph_rank_momentum_change(rng):
    def make(r):
        ms = r.sample([0.1, 0.2, 0.3, 0.5, 1.0], 4); vs = r.sample([2.0, 3.0, 4.0, 5.0, 6.0], 4); es = r.sample([0.0, 0.5, 1.0, 0.25], 4)
        vals = {L: ms[i] * vs[i] * (1 + es[i]) for i, L in enumerate(LBL)}
        wr = [("Ranks by the initial momentum of each ball, ignoring what happens in the collision.", {L: ms[i] * vs[i] for i, L in enumerate(LBL)}), ("Ranks by the final momentum of each ball, ignoring the change in direction.", {L: ms[i] * vs[i] * es[i] for i, L in enumerate(LBL)}),
              ("Ranks by the initial speed of the balls alone, ignoring the masses.", {L: vs[i] for i, L in enumerate(LBL)}), ("Ranks by the kinetic energy before the collision.", {L: 0.5 * ms[i] * vs[i] ** 2 for i, L in enumerate(LBL)})]
        return (ms, vs, es), vals, wr
    (ms, vs, es), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(ms[LBL.index(L)])) * Fr(str(vs[LBL.index(L)])) * (1 + Fr(str(es[LBL.index(L)]))))); assert ex == order, "rank_path_mismatch"
    def rb(e):
        return "stops and sticks to the wall" if e == 0.0 else "bounces straight back at the same speed" if e == 1.0 else f"bounces straight back at {e:g} of its original speed"
    rows = "; ".join(f"ball {L} of mass ${ms[i]:g}\\text{{ kg}}$ hits a wall at ${vs[i]:g}\\text{{ m/s}}$ and {rb(es[i])}" for i, L in enumerate(LBL))
    stem = f"Four balls each hit a wall along a line perpendicular to the wall: {rows}. Rank the magnitudes of the impulses that the wall exerts on the balls from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])}" for L in LBL)
    key.why = f"The impulse equals the change in momentum, $mv(1+e)$, where $e$ is the fraction of the speed kept after the bounce; the values in N s are {st}, which ranks as {key.text}."
    return _c2("ph_rank_momentum_change", "4.2", stem, key, ds, rng, kwhy=None, concept="Ranking impulses on balls that stick to a wall or bounce back", thinking=["Write the change in momentum with signs for each ball", "Compute the impulses and order them"], cond=[("all balls move along a line perpendicular to the wall", "the stem gives motion perpendicular to the wall")],
               path="exact fractions of the change in momentum are sorted and compared with the floating-point ordering", facts=[f"m={json.dumps(ms)}", f"v={json.dumps(vs)}", f"e={json.dumps(es)}"], est=90)


def ph_rank_moment_inertia(rng):
    def make(r):
        sets = []; vals = {}; txt = {}
        for L in LBL:
            n = r.choice([2, 3]); mm = [r.choice([0.5, 1.0, 2.0]) for _ in range(n)]; rr = [r.choice([0.2, 0.4, 0.6, 0.8]) for _ in range(n)]
            I = sum(a * b * b for a, b in zip(mm, rr)); vals[L] = I; sets.append((mm, rr))
            txt[L] = L + ": " + ", ".join(f"${a:g}\\text{{ kg}}$ at ${b:g}\\text{{ m}}$" for a, b in zip(mm, rr))
        wr = [("Ranks by the total mass of the particles, ignoring their distances from the axis.", {L: sum(sets[i][0]) for i, L in enumerate(LBL)}), ("Ranks by the sum of the products of the mass and the distance, without squaring the distance.", {L: sum(a * b for a, b in zip(*sets[i])) for i, L in enumerate(LBL)}),
              ("Ranks by the largest distance from the axis of any particle.", {L: max(sets[i][1]) for i, L in enumerate(LBL)}), ("Ranks in the reverse of the correct order.", {L: -vals[L] for L in LBL})]
        return (sets, txt), vals, wr
    (sets, txt), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -sum(Fr(str(a)) * Fr(str(b)) ** 2 for a, b in zip(*sets[LBL.index(L)]))); assert ex == order, "rank_path_mismatch"
    stem = "Four rigid objects of negligible mass each carry particles (mass at distance from the axis) and rotate about a fixed axis: " + "; ".join(txt[L] for L in LBL) + ". Rank the moments of inertia of the objects about the axis from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])}" for L in LBL)
    key.why = f"The moment of inertia is the sum of $mr^2$ over the particles; the values in kg m^2 are {st}, which ranks as {key.text}."
    return _c2("ph_rank_moment_inertia", "5.4", stem, key, ds, rng, kwhy=None, concept="Ranking moments of inertia of systems of particles about an axis", thinking=["Compute $mr^2$ for each particle and add them for each object", "Order the four sums"], cond=[("the rods have negligible mass", "the stem says the objects have negligible mass")],
               path="exact fractions of the sums of m r squared are sorted and compared with the floating-point ordering", facts=[f"sets={json.dumps(sets)}"], est=95)


def ph_rank_angular_accel(rng):
    def make(r):
        ks = r.sample(range(4), 4); ms = r.sample([1.0, 2.0, 3.0, 4.0, 5.0], 4); rs = r.sample([0.10, 0.20, 0.30, 0.40], 4); Fs = r.sample([2.0, 4.0, 6.0, 8.0, 10.0], 4)
        I = {L: SHAPES[ks[i]][1] * ms[i] * rs[i] ** 2 for i, L in enumerate(LBL)}
        vals = {L: Fs[i] * rs[i] / I[L] for i, L in enumerate(LBL)}
        wr = [("Ranks by the tangential force alone, ignoring the moment of inertia.", {L: Fs[i] for i, L in enumerate(LBL)}), ("Ranks by the torque alone, ignoring the moment of inertia.", {L: Fs[i] * rs[i] for i, L in enumerate(LBL)}),
              ("Ranks by the force divided by the mass, as for a point mass, ignoring the radius and shape.", {L: Fs[i] / ms[i] for i, L in enumerate(LBL)}), ("Ranks by the moment of inertia, with the largest first.", dict(I))]
        return (ks, ms, rs, Fs), vals, wr
    (ks, ms, rs, Fs), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(Fs[LBL.index(L)])) * Fr(str(rs[LBL.index(L)])) / (Fr(str(SHAPES[ks[LBL.index(L)]][1])).limit_denominator(1000) * Fr(str(ms[LBL.index(L)])) * Fr(str(rs[LBL.index(L)])) ** 2))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: {SHORT[SHAPES[ks[i]][0]]}, ${ms[i]:g}\\text{{ kg}}$, ${rs[i]:.2f}\\text{{ m}}$, ${Fs[i]:g}\\text{{ N}}$" for i, L in enumerate(LBL))
    stem = f"Four uniform objects rotate without friction about axes through their centers. A tangential force acts at the rim of each (shape, mass, radius, force): {rows}. (Moments of inertia: hoop $MR^2$, solid disk $\\tfrac12MR^2$, solid sphere $\\tfrac25MR^2$, thin shell $\\tfrac23MR^2$.) Rank the angular accelerations from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])}" for L in LBL)
    key.why = f"The angular acceleration is $\\alpha=FR/I$; the values in rad/s^2 are {st}, which ranks as {key.text}."
    return _c2("ph_rank_angular_accel", "5.6", stem, key, ds, rng, kwhy=None, concept="Ranking angular accelerations from the torque and the moment of inertia", thinking=["Find the torque of the force at the rim and the moment of inertia of each shape", "Compute $\\tau/I$ and order the four values"], cond=[("each axis is frictionless", "the stem says each object rotates without friction")],
               path="exact fractions of the torque over the moment of inertia are sorted and compared with the floating-point ordering", facts=[f"shapes={json.dumps([SHAPES[k][0] for k in ks])}", f"m={json.dumps(ms)}", f"r={json.dumps(rs)}", f"F={json.dumps(Fs)}"], est=95)


# ---- 2.A (1단원·8단원) ----
@retry_sep
def ph_sym_projectile_range(rng):
    variant = rng.randrange(2)
    v = pick(rng, [10.0, 15.0, 20.0]); th_d = pick(rng, [25, 30, 35, 40, 50, 55, 60]); thr = math.radians(th_d); env = {"v_0": v, "v": v, "g": G, "theta": thr}
    env["v0"] = v
    if variant == 0:
        R_ = v * v * math.sin(2 * thr) / G; sym_v = R_
        # 독립 경로: 포물선 운동 방정식을 RK4 로 적분해 지면에 닿을 때의 수평 거리를 구한다
        y = np.array([0.0, 0.0, v * math.cos(thr), v * math.sin(thr)]); t = 0.0; dt = 1e-3
        while True:
            prv = y.copy(); y = rk4(lambda tt, s: np.array([s[2], s[3], 0.0, -G]), y, t, t + dt, 1); t += dt
            if y[1] < 0:
                break
        fr = prv[1] / (prv[1] - y[1]); agree(prv[0] + fr * (y[0] - prv[0]), R_, 1e-3, "R")
        key_tex = r"\frac{v_0^2\sin(2\theta)}{g}"
        wrongs = [("Uses the sine of the angle instead of the sine of twice the angle.", r"\frac{v_0^2\sin\theta}{g}"), ("Leaves out the factor of 2 in the double-angle formula $2\\sin\\theta\\cos\\theta$.", r"\frac{v_0^2\sin\theta\cos\theta}{g}"), ("Uses the cosine of twice the angle, which would give the maximum range at 0 degrees.", r"\frac{v_0^2\cos(2\theta)}{g}"), ("Divides by $2g$, as in the formula for the maximum height, instead of by $g$.", r"\frac{v_0^2\sin(2\theta)}{2g}")]
        stem = r"A projectile is launched from level ground with a speed $v_0$ at an angle $\theta$ above the horizontal. Air resistance is negligible. Which of the following is the horizontal distance that the projectile travels before it returns to the ground?"
        why = r"The time of flight is $2v_0\sin\theta/g$ and the horizontal speed is $v_0\cos\theta$, so the range is $\dfrac{2v_0^2\sin\theta\cos\theta}{g}=\dfrac{v_0^2\sin2\theta}{g}$."
    else:
        H = (v * math.sin(thr)) ** 2 / (2 * G); sym_v = H
        y = np.array([0.0, v * math.sin(thr)]); t = 0.0; dt = 1e-4; top = 0.0
        while y[1] > 0:
            y = rk4(lambda tt, s: np.array([s[1], -G]), y, t, t + dt, 1); t += dt; top = max(top, y[0])
        agree(top, H, 1e-3, "H")
        key_tex = r"\frac{v_0^2(\sin\theta)^2}{2g}"
        wrongs = [("Uses the full speed instead of its vertical component.", r"\frac{v_0^2}{2g}"), ("Uses the cosine of the angle, which is the horizontal component.", r"\frac{v_0^2(\cos\theta)^2}{2g}"), ("Leaves out the factor of 2 in the denominator.", r"\frac{v_0^2(\sin\theta)^2}{g}"), ("Uses the sine without squaring it.", r"\frac{v_0^2\sin\theta}{2g}")]
        stem = r"A projectile is launched from level ground with a speed $v_0$ at an angle $\theta$ above the horizontal. Air resistance is negligible. Which of the following is the maximum height that the projectile reaches above the ground?"
        why = r"At the top the vertical speed is zero, so $0=(v_0\sin\theta)^2-2gH$ and $H=\dfrac{v_0^2(\sin\theta)^2}{2g}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_projectile_range", "1.5", stem, key, ds, rng, kwhy=why, concept="Symbolic range or maximum height of a projectile launched from level ground", thinking=["Resolve the launch velocity into horizontal and vertical components", "Use constant acceleration in the vertical direction and constant speed in the horizontal direction"],
               cond=[("air resistance is negligible", "the stem states negligible air resistance")], path="the equations of motion are integrated with RK4 until the projectile lands or reaches the top, and the printed option is evaluated by a TeX evaluator", facts=[f"v0={v}", f"theta_deg={th_d}", f"variant={variant}"], est=80)


@retry_sep
def ph_sym_free_fall_time(rng):
    variant = rng.randrange(2)
    h = pick(rng, [5.0, 10.0, 20.0]); v = pick(rng, [3.0, 5.0, 8.0]); env = {"h": h, "g": G, "v": v, "v_0": v, "v0": v}
    if variant == 0:
        t = math.sqrt(2 * h / G); sym_v = t
        y = np.array([h, 0.0]); tt = 0.0; dt = 1e-4
        while y[0] > 0:
            prv = y.copy(); y = rk4(lambda ts, s: np.array([s[1], -G]), y, tt, tt + dt, 1); tt += dt
        fr = prv[0] / (prv[0] - y[0]); agree(tt - dt + dt * fr, t, 1e-3, "t")
        key_tex = r"\sqrt{\frac{2h}{g}}"
        wrongs = [("Leaves out the factor of 2 in the equation of the distance fallen.", r"\sqrt{\frac{h}{g}}"), ("Leaves out the square root, as if the time were proportional to the height.", r"\frac{2h}{g}"), ("Inverts the ratio under the square root.", r"\sqrt{\frac{g}{2h}}"), ("Uses the equation for the speed at the ground, $\\sqrt{2gh}$, as if it were the time.", r"\sqrt{2gh}")]
        stem = r"A ball is released from rest at a height $h$ above the ground. Air resistance is negligible. Which of the following is the time for the ball to reach the ground?"
        why = r"For free fall from rest $h=\tfrac12gt^2$, so $t=\sqrt{2h/g}$."
    else:
        t = v / G * 2; sym_v = t; key_tex = r"\frac{2v_0}{g}"
        y = np.array([0.0, v]); tt = 0.0; dt = 1e-4
        while True:
            prv = y.copy(); y = rk4(lambda ts, s: np.array([s[1], -G]), y, tt, tt + dt, 1); tt += dt
            if y[0] < 0:
                break
        fr = prv[0] / (prv[0] - y[0]); agree(tt - dt + dt * fr, t, 1e-3, "t")
        wrongs = [("Gives only the time to reach the top of the path, which is half of the time of flight.", r"\frac{v_0}{g}"), ("Squares the initial speed in the numerator.", r"\frac{2v_0^2}{g}"), ("Multiplies by $g$ instead of dividing.", r"2v_0g"), ("Uses the equation for the maximum height, $v_0^2/(2g)$, as the time.", r"\frac{v_0^2}{2g}")]
        stem = r"A ball is thrown straight up with an initial speed $v_0$ and returns to the height from which it was thrown. Air resistance is negligible. Which of the following is the total time the ball is in the air?"
        why = r"The ball takes $v_0/g$ to rise to the top and the same time to fall back, so the total time is $2v_0/g$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_free_fall_time", "1.2", stem, key, ds, rng, kwhy=why, concept="Symbolic time of fall or time of flight in one-dimensional free fall", thinking=["Write the equation of motion with the acceleration due to gravity", "Solve for the time"],
               cond=[("air resistance is negligible", "the stem states negligible air resistance")], path="RK4 integration of the vertical motion measures the time to reach the ground or the starting height, and the printed option is evaluated by a TeX evaluator", facts=[f"h={h}", f"v={v}", f"variant={variant}"], est=70)


@retry_sep
def ph_sym_float_fraction(rng):
    variant = rng.randrange(2)
    rho_o = pick(rng, [500.0, 600.0, 700.0, 800.0]); rho_f = pick(rng, [1000.0, 1030.0, 1260.0]); L = pick(rng, [0.1, 0.2, 0.3]); env = {"rhoo": rho_o, "rhof": rho_f, "L": L, "g": G, "A": 0.04}
    if variant == 0:
        sym_v = rho_o / rho_f
        # 독립 경로: 부력 = 무게 를 풀어 잠긴 부피 비율을 이분법으로 구한다
        f = lambda x: rho_f * x - rho_o  # noqa: E731
        agree(bisect(lambda x: f(x), 0.0, 1.0), sym_v, 1e-9, "fr")
        key_tex = r"\frac{\rho_o}{\rho_f}"
        wrongs = [("Inverts the ratio of the densities, which would give a fraction greater than one.", r"\frac{\rho_f}{\rho_o}"), ("Gives the fraction that is above the surface instead of the fraction below it.", r"1-\frac{\rho_o}{\rho_f}"), ("Uses the difference of the densities divided by the density of the object.", r"\frac{\rho_f-\rho_o}{\rho_o}"), ("Uses the square root of the ratio of the densities.", r"\sqrt{\frac{\rho_o}{\rho_f}}")]
        stem = r"A block of uniform density $\rho_o$ floats at rest in a fluid of density $\rho_f$, with $\rho_o<\rho_f$. Which of the following is the fraction of the volume of the block that is below the surface of the fluid?"
        why = r"The buoyant force equals the weight: $\rho_fV_{sub}g=\rho_oVg$, so $V_{sub}/V=\rho_o/\rho_f$."
    else:
        sym_v = rho_o / rho_f * L; key_tex = r"\frac{\rho_o}{\rho_f}L"
        agree(bisect(lambda x: rho_f * x - rho_o * L, 0.0, L), sym_v, 1e-9, "d")
        wrongs = [("Gives the height of the block above the surface instead of the depth below it.", r"\left(1-\frac{\rho_o}{\rho_f}\right)L"), ("Inverts the ratio of the densities.", r"\frac{\rho_f}{\rho_o}L"), ("Leaves out the height of the block and gives only the fraction.", r"\frac{\rho_o}{\rho_f}"), ("Multiplies by $g$, as if the depth depended on the acceleration due to gravity.", r"\frac{\rho_o}{\rho_f}Lg")]
        stem = r"A uniform cube of side $L$ and density $\rho_o$ floats at rest in a fluid of density $\rho_f$, with $\rho_o<\rho_f$, and its top and bottom faces are horizontal. Which of the following is the depth of the bottom face of the cube below the surface of the fluid?"
        why = r"The buoyant force equals the weight: $\rho_fL^2dg=\rho_oL^3g$, so $d=\dfrac{\rho_o}{\rho_f}L$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_float_fraction", "8.3", stem, key, ds, rng, kwhy=why, concept="Symbolic submerged fraction or depth of a floating object from the equality of the buoyant force and the weight", thinking=["Set the buoyant force equal to the weight of the object", "Write the submerged volume in terms of the fraction or the depth"],
               cond=[("the object floats at rest", "the stem says the object floats at rest")], path="the force balance is solved by bisection for the submerged fraction or depth, and the printed option is evaluated by a TeX evaluator", facts=[f"rho_o={rho_o}", f"rho_f={rho_f}", f"L={L}", f"variant={variant}"], est=80)


@retry_sep
def ph_sym_torricelli(rng):
    variant = rng.randrange(2)
    h = pick(rng, [0.5, 1.0, 2.0, 4.0]); H = pick(rng, [1.0, 2.0, 3.0]); rho = pick(rng, [1000.0, 800.0]); env = {"h": h, "H": H, "g": G, "rho": rho}
    if variant == 0:
        v = math.sqrt(2 * G * h); sym_v = v
        # 독립 경로: 베르누이 식 P_atm + ρ g h = P_atm + ½ ρ v² 을 이분법으로 풀어 속력을 구한다
        agree(bisect(lambda x: 0.5 * rho * x * x - rho * G * h, 0.0, 100.0), v, 1e-9, "v")
        key_tex = r"\sqrt{2gh}"
        wrongs = [("Leaves out the factor of 2.", r"\sqrt{gh}"), ("Leaves out the square root.", r"2gh"), ("Includes the density of the fluid in the speed, which cancels.", r"\sqrt{2\rho gh}"), ("Uses the height without the acceleration due to gravity.", r"\sqrt{2h}")]
        stem = r"A large open tank contains a fluid of density $\rho$ to a height $h$ above a small hole in its side. The fluid flows out of the hole. Treat the fluid as ideal and the surface of the fluid in the tank as stationary. Which of the following is the speed of the fluid as it leaves the hole?"
        why = r"Bernoulli's equation between the surface and the hole, both at atmospheric pressure, gives $\rho gh=\tfrac12\rho v^2$, so $v=\sqrt{2gh}$."
    else:
        v = math.sqrt(2 * G * h); x = v * math.sqrt(2 * H / G); sym_v = x
        agree(v * math.sqrt(2 * H / G), x, 1e-9, "x")
        t = np.linspace(0, math.sqrt(2 * H / G), 100001); xx = float(np.trapezoid(np.full_like(t, v), t)); agree(xx, x, 1e-6, "xx")
        key_tex = r"2\sqrt{hH}"
        sym_v = 2 * math.sqrt(h * H); agree(sym_v, x, 1e-9, "x2")
        wrongs = [("Leaves out the factor of 2.", r"\sqrt{hH}"), ("Adds the two heights under the square root.", r"2\sqrt{h+H}"), ("Uses the product of the heights without the square root.", r"2hH"), ("Uses the ratio of the heights under the square root.", r"2\sqrt{\frac{h}{H}}")]
        stem = r"A large open tank contains a fluid to a height $h$ above a small hole in its side. The hole is a height $H$ above the horizontal ground. The fluid leaves the hole horizontally and lands on the ground. Treat the fluid as ideal. Which of the following is the horizontal distance from the hole to the point where the fluid lands?"
        why = r"The exit speed is $v=\sqrt{2gh}$ and the time of fall is $t=\sqrt{2H/g}$, so $x=vt=2\sqrt{hH}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_torricelli", "8.4", stem, key, ds, rng, kwhy=why, concept="Symbolic exit speed or landing distance of a fluid that leaves a hole in an open tank", thinking=["Apply Bernoulli's equation between the surface and the hole to find the exit speed", "Use projectile motion for the horizontal distance if it is asked"],
               cond=[("the fluid is ideal and the surface is stationary", "the stem states an ideal fluid and a stationary surface")], path="the Bernoulli equation is solved by bisection for the exit speed and the horizontal distance is integrated over the time of fall, and the printed option is evaluated by a TeX evaluator", facts=[f"h={h}", f"H={H}", f"variant={variant}"], est=85)


# ---- 2.D ----
@retry_sep
def ph_pred_collision_stick(rng):
    fM = pick(rng, [2, 3, 4]); m = pick(rng, [1.0, 2.0]); v = pick(rng, [3.0, 4.0, 6.0])
    vf1 = m * v / (m + m); vf2 = m * v / (m + fM * m); fac = vf2 / vf1
    # 독립 경로: 충돌 후 합쳐진 물체의 속도를 운동량 보존으로 연립해 풀고 두 경우의 비를 구한다
    A1 = np.array([[2 * m]]); A2 = np.array([[(1 + fM) * m]]); s1 = float(np.linalg.solve(A1, np.array([m * v]))[0]); s2 = float(np.linalg.solve(A2, np.array([m * v]))[0]); agree(s2 / s1, fac, 1e-9, "fac")
    stem = f"A cart of mass ${m:g}\\text{{ kg}}$ moving at ${v:g}\\text{{ m/s}}$ collides with a stationary cart of mass ${m:g}\\text{{ kg}}$ on a frictionless track, and the carts stick together and move with a speed $v_1$. In a second trial the stationary cart is replaced by a stationary cart of mass ${fM * m:g}\\text{{ kg}}$, and the carts again stick together and move with a speed $v_2$. Which of the following is the best prediction of $v_2$ in terms of $v_1$?"
    f_ = lambda x: f"$v_2={sig(x)}\\,v_1$"  # noqa: E731
    key, ds = num_opts(fac, [("Takes the speed to be inversely proportional to the mass of the stationary cart only.", 1 / fM), ("Takes the speed to be inversely proportional to the square of the total mass.", (2 / (1 + fM)) ** 2), ("Assumes the speed after the collision does not change because the momentum is conserved.", 1.0),
                              ("Takes the speed to be proportional to the mass of the stationary cart.", float(fM)), ("Divides the speed by the mass factor and by two.", 1 / (2 * fM))], fmt=f_)
    return _d2("ph_pred_collision_stick", "4.3", stem, key, ds, rng, kwhy=f"Momentum conservation gives $v=mv_0/(m+M)$, so $v_1=mv_0/(2m)$ and $v_2=mv_0/(m+{fM}m)$, and $v_2/v_1=2/(1+{fM})={sig(fac)}$.", concept="Predicting the final speed of two carts that stick together when the mass of the stationary cart changes", thinking=["Use conservation of momentum for the two carts that stick together", "Find how the final speed depends on the total mass and compare the two trials"],
               cond=[("the track is frictionless and the carts stick together", "the stem gives a frictionless track and carts that stick together")], path="the final speed in each trial is found from a numerical solution of the momentum equation and the ratio of the speeds is compared", facts=[f"fM={fM}", f"m={m}", f"v={v}"], est=80)


# ---- 3.B ----
@retry_sep
def ph_claim_atwood_accel(rng):
    m1 = pick(rng, [1.0, 2.0, 3.0]); dm = pick(rng, [0.5, 1.0, 2.0]); m2 = m1 + dm
    a = (m2 - m1) * G / (m1 + m2); T = 2 * m1 * m2 * G / (m1 + m2)
    # 독립 경로: 두 블록의 운동 방정식을 선형계로 풀어 a 와 T 를 구한다
    A = np.array([[m1, -1.0], [m2, 1.0]]); b = np.array([-m1 * G, m2 * G]); x = np.linalg.solve(A, b); agree(abs(x[0]), a, 1e-9, "a"); agree(abs(x[1]), T, 1e-9, "T")
    stem = f"Two blocks of masses ${m1:g}\\text{{ kg}}$ and ${m2:g}\\text{{ kg}}$ hang from the ends of a light string that passes over a light, frictionless pulley. The blocks are released from rest. Which statement about the tension in the string is correct and best justified?"
    key, ds = _sent(f"The tension is ${sig(T)}\\text{{ N}}$, which is greater than the weight of the lighter block and less than the weight of the heavier block, because the lighter block accelerates upward and the heavier block accelerates downward.", f"For the lighter block $T-m_1g=m_1a$ and for the heavier block $m_2g-T=m_2a$, so $T=\\dfrac{{2m_1m_2g}}{{m_1+m_2}}={sig(T)}\\text{{ N}}$, between $m_1g={sig(m1 * G)}$ and $m_2g={sig(m2 * G)}$ N.",
                    [(f"The tension is ${sig(m2 * G)}\\text{{ N}}$, equal to the weight of the heavier block, because the string supports the heavier block.", "Treats the tension as the weight of the heavier block, which holds only if that block does not accelerate."),
                     (f"The tension is ${sig((m1 + m2) * G)}\\text{{ N}}$, equal to the total weight of the two blocks, because the string supports both blocks.", "Adds the weights, which would be the tension only if the blocks hung from one end at rest."),
                     (f"The tension is ${sig(m1 * G)}\\text{{ N}}$, equal to the weight of the lighter block, because the string is only as strong as the lighter block.", "Treats the tension as the weight of the lighter block, which holds only if that block does not accelerate.")])
    return _b3("ph_claim_atwood_accel", "2.5", stem, key, ds, rng, concept="Justifying the tension in an Atwood machine as a value between the two weights using Newton's second law for each block", thinking=["Write Newton's second law for each block with the same tension and acceleration", "Solve for the tension and compare it with the two weights"],
               cond=[("the string and pulley are ideal", "the stem states a light string and a light frictionless pulley")], path="the two equations of motion are solved as a linear system for the acceleration and the tension", facts=[f"m1={m1}", f"m2={m2}"], est=90)


@retry_sep
def ph_claim_friction_area(rng):
    m = pick(rng, [2.0, 4.0, 5.0]); mu = pick(rng, [0.2, 0.3, 0.4]); A1 = pick(rng, [0.01, 0.02]); k = pick(rng, [2, 3, 4]); A2 = A1 * k
    f = mu * m * G
    stem = f"A wooden block of mass ${m:g}\\text{{ kg}}$ has a face of area ${A1:g}\\text{{ m}}^2$ and a larger face of area ${A2:g}\\text{{ m}}^2$. The block is pulled at constant speed along a level wooden board, first on the smaller face and then on the larger face. The coefficient of kinetic friction between the wood surfaces is ${mu:g}$ in both cases. Which statement about the friction force is correct and best justified?"
    key, ds = _sent(f"The friction force is ${sig(f)}\\text{{ N}}$ in both cases, because the kinetic friction force is $\\mu N$ and the normal force is the same, so the contact area does not matter.", f"$f=\\mu N=\\mu mg={sig(f)}\\text{{ N}}$ for either face, since $N=mg$ does not change.",
                    [(f"The friction force is greater on the larger face, ${sig(f * k)}\\text{{ N}}$, because a larger area of contact gives more friction.", "Assumes that the friction force is proportional to the contact area, but the model $f=\\mu N$ does not include the area."),
                     (f"The friction force is greater on the smaller face, ${sig(f * k)}\\text{{ N}}$, because the same weight acts on a smaller area.", "Confuses the pressure on the surface with the friction force; the force does not depend on the area."),
                     (f"The friction force is ${sig(f / k)}\\text{{ N}}$ on the larger face, because the weight is spread over a larger area.", "Divides the weight by the area, but the friction force is $\\mu N$ and the normal force is the same.")])
    return _b3("ph_claim_friction_area", "2.7", stem, key, ds, rng, concept="Justifying that the kinetic friction force does not depend on the area of contact when the normal force is the same", thinking=["Find the normal force on the block for each face", "Use $f=\\mu N$ and compare the two friction forces"],
               cond=[("the block is pulled at constant speed on a level board", "the stem says the block is pulled at constant speed along a level board")], path="the friction force is computed as mu times the normal force obtained from a vertical force balance, which does not involve the area", facts=[f"m={m}", f"mu={mu}", f"A1={A1}", f"k={k}"], est=80)


# ======================= 3.B 세트(단원 5): 각속도–시간 그래프에 대한 두 주장 =======================
@retry_sep
def phs_wt_claim_set(rng):
    """세트: 각속력–시간 그래프 → (일정한 각속력 구간의 알짜 돌림힘에 대한 주장, 돌아간 각에 대한 주장). 단원 5, 두 문항 모두 3.B."""
    for _ in forever():
        t1 = pick(rng, [2, 3, 4]); t2 = t1 + pick(rng, [2, 3, 4]); t3 = t2 + pick(rng, [2, 3, 4])
        w1 = pick(rng, [4, 6, 8, 10]); w2 = pick(rng, [0, 2, 3])
        xs = [0, t1, t2, t3]; ws = [0, w1, w1, w2]
        ang = trapz_exact(xs, ws); I = pick(rng, [0.5, 1.0, 2.0, 4.0])
        tt = np.linspace(0, t3, 40001); agree(float(ang), float(np.trapezoid(np.interp(tt, xs, ws), tt)), 1e-7, "ang")
        alpha1 = w1 / t1; alpha3 = (w2 - w1) / (t3 - t2)
        if float(ang) >= 20 and alpha1 != -alpha3:
            break
    angf = float(ang)
    stim = graph_stim("Angular speed of the wheel versus time", [("w", list(zip(xs, ws)))], gaxis("Time (s)", 0, t3, 1), gaxis("Angular speed (rad/s)", 0, max(ws) + 2, 2))
    stem1 = f"The wheel always rotates in the same direction. Which statement about the net torque on the wheel from $t={t1}\\text{{ s}}$ to $t={t2}\\text{{ s}}$ is correct and best justified?"
    key1, ds1 = sentence_options(f"The net torque is zero, because the angular speed is constant and so the angular acceleration is zero.", f"The graph is horizontal between ${t1}\\text{{ s}}$ and ${t2}\\text{{ s}}$, so $\\alpha=0$ and $\\tau_{{net}}=I\\alpha=0$.",
                                 [(f"The net torque is not zero, because the wheel keeps turning at ${w1}\\text{{ rad/s}}$ and a torque is needed to keep it turning.", "Thinks that a net torque is needed to maintain a constant angular speed, but a net torque produces an angular acceleration."),
                                  (f"The net torque is ${sig(I * w1 / t1)}\\text{{ N m}}$ in the direction of the rotation, because it is the same as in the first segment.", "Carries the net torque of the first segment into the second segment although the slope of the graph is zero there."),
                                  (f"The net torque is negative, because the line on the graph does not rise.", "Takes a graph that does not rise to mean a negative torque, but a negative torque would make the angular speed decrease.")])
    q1 = mk("phs_wt_claim_set_q1", "5.1", "3.B", stem1, key1, ds1, rng, concept="Justifying a zero net torque from a constant angular speed on a graph", thinking=["Read the slope of the graph in the interval", "Relate the slope, the angular acceleration and the net torque"],
            cond=[("the wheel rotates about a fixed axis", "the shared stimulus describes a wheel with an angular speed graph")], path="the slope of each segment is computed exactly and by numerical differentiation", material=MAT_GRAPH("axis labels with units"), judgment=["justification", "representation_reading"], est=85, facts=[f"xs={xs}", f"ws={ws}"])
    stem2 = f"Which statement about the angle through which the wheel turns from $t=0$ to $t={t3}\\text{{ s}}$ is correct and best justified?"
    key2, ds2 = sentence_options(f"The wheel turns through ${sig(angf)}\\text{{ rad}}$, because the angle is the area under the angular speed-time graph.", f"The areas of the segments are {_seg_text(xs, ws, 'rad')}, which add to ${sig(angf)}\\text{{ rad}}$.",
                                 [(f"The wheel turns through ${sig(max(ws) * t3)}\\text{{ rad}}$, because the angle is the largest angular speed times the total time.", "Uses the largest angular speed for the whole time, but the speed is lower for part of the time."),
                                  (f"The wheel turns through ${sig((w2 - 0) / t3)}\\text{{ rad}}$, because the angle is the slope of the graph.", "Mistakes the slope, which is the angular acceleration, for the angle that the wheel turns."),
                                  (f"The wheel turns through ${sig(w1 * (t2 - t1))}\\text{{ rad}}$, because the angle is found only from the part of the graph where the speed is constant.", "Uses only the horizontal part of the graph and leaves out the other segments.")])
    q2 = mk("phs_wt_claim_set_q2", "5.1", "3.B", stem2, key2, ds2, rng, concept="Justifying the angle turned from the area under an angular speed-time graph", thinking=["Recognize that the angle is the area under the angular speed-time graph", "Add the areas of the three segments"],
            cond=[("the wheel always turns in the same direction", "the shared stimulus says the wheel always rotates in the same direction")], path="exact fractions for the areas versus numpy integration of a dense resampling", material=MAT_GRAPH("axis labels with units"), judgment=["justification", "representation_reading"], est=90, facts=[f"xs={xs}", f"ws={ws}"], kwhy=key2.why)
    intro = f"A wheel with a moment of inertia of ${I:g}\\text{{ kg m}}^2$ rotates about a fixed axle. The graph shows the angular speed of the wheel as a function of time."
    return _set_pack("phs_wt_claim_set", "5.1", intro, stim, [q1, q2], q1["facts"])


# ===== 생성 단계 목록(2026-10-19): phys-strict-plan.ts 가 PH5·PH6 엄격 배정에 필요하다고 계산한 새 원형 전부 =====
STAGE_N_MC = [
 "ph_claim_relative_motion",
 "ph_claim_vt_area",
 "ph_claim_ramps_speed",
 "ph_claim_power_climb",
 "ph_claim_ke_stopping",
 "ph_claim_airbag_force",
 "ph_claim_spring_launch",
 "ph_evid_friction_data",
 "ph_evid_spring_data",
 "ph_rank_rot_ke",
 "ph_rank_ang_momentum",
 "ph_sym_wheel_pulley",
 "ph_sym_pressure_depth",
 "ph_sym_continuity_pipe",
 "ph_sym_bernoulli_diff",
 "ph_sym_apparent_weight",
 "ph_sym_rolling_accel",
 "ph_pred_planet_weight",
 "ph_pred_spring_period",
 "ph_pred_collapse_spin",
 "ph_claim_recoil_speed",
 "ph_claim_bounce_impulse",
 "ph_claim_incline_normal",
 "ph_claim_torque_door",
 "ph_claim_satellite_speed",
 "ph_claim_continuity_speed",
 "ph_claim_shm_mass",
 "ph_evid_ke_speed_data",
 "ph_evid_period_mass_data",
 "ph_sym_disk_rim_force",
 "ph_sym_spring_added_mass",
 "ph_sym_slide_stop_speed",
 "ph_sym_kinematics_vf",
 "ph_pred_pendulum_planet",
 "ph_pred_incline_angle",
 "ph_rank_normal_force",
 "ph_rank_friction_force",
 "ph_rank_incline_accel",
 "ph_rank_momentum_change",
 "ph_rank_moment_inertia",
 "ph_rank_angular_accel",
 "ph_sym_projectile_range",
 "ph_sym_free_fall_time",
 "ph_sym_float_fraction",
 "ph_sym_torricelli",
 "ph_pred_collision_stick",
 "ph_claim_atwood_accel",
 "ph_claim_friction_area"
]
STAGE_N_SETS = ["phs_ft_set", "phs_torque_set", "phs_depth_pressure_set", "phs_wt_claim_set"]


# ======================= 4차: 예비 3개(PH6 칸 2.D 단원 2·6, 3.B 단원 4) =======================
@retry_sep
def ph_pred_altitude_weight(rng):
    k = pick(rng, [1, 2, 3]); m = pick(rng, [50.0, 60.0, 70.0, 80.0]); Re = 6.37e6
    # 독립 경로: 뉴턴 중력 법칙으로 지표면과 고도 k R 에서의 무게를 각각 계산해 비를 구한다
    Me = 5.97e24; Gc = 6.67e-11
    W0 = Gc * Me * m / Re ** 2; W1 = Gc * Me * m / ((1 + k) * Re) ** 2; ratio = W1 / W0; agree(ratio, 1 / (1 + k) ** 2, 1e-9, "ratio")
    stem = f"An astronaut has a weight of ${sig(m * G)}\\text{{ N}}$ on the surface of Earth. The astronaut is carried to a height above the surface of Earth that is equal to ${k}$ times the radius of Earth. Which of the following is the best prediction of the weight of the astronaut at that height?"
    f = lambda v: f"${sig(v)}\\text{{ N}}$"  # noqa: E731
    key, ds = num_opts(m * G * ratio, [("Divides the weight by the factor of the height above the surface instead of the square of the distance from the center.", m * G / k), ("Uses the distance from the center divided by the radius, $1+k$, without squaring it.", m * G / (1 + k)),
                                       ("Assumes the weight does not change because the mass of the astronaut does not change.", m * G), ("Divides by the square of the height above the surface, forgetting that the distance is measured from the center of Earth.", m * G / k ** 2)], fmt=f)
    return _d2("ph_pred_altitude_weight", "2.6", stem, key, ds, rng, kwhy=f"The weight is $GM_Em/r^2$ with $r=(1+{k})R_E$, so it is ${sig(m * G)}\\text{{ N}}/(1+{k})^2={sig(m * G * ratio)}\\text{{ N}}$.", concept="Predicting the weight at an altitude from the inverse-square dependence on the distance from the center of Earth",
               thinking=["Write the weight as $GMm/r^2$ with $r$ measured from the center of Earth", "Find the distance in terms of the radius of Earth and apply the factor"], cond=[("Earth is spherical and uniform", "the stem gives the height as a multiple of the radius of Earth")],
               path="the weight is computed from Newton's law of gravitation at both distances and the ratio is compared with the inverse square of the distance factor", facts=[f"k={k}", f"m={m}"], est=75)


@retry_sep
def ph_pred_orbit_period_radius(rng):
    f = pick(rng, [4, 9, 16]); R1 = pick(rng, [7.0e6, 8.0e6, 1.0e7]); GM = 3.986e14
    T1 = 2 * math.pi * math.sqrt(R1 ** 3 / GM); T2 = 2 * math.pi * math.sqrt((f * R1) ** 3 / GM); fac = T2 / T1
    # 독립 경로: 두 원 궤도를 RK4 로 적분해 한 바퀴(위상각 2π)에 걸리는 시간을 측정한다
    def period(R):
        v = math.sqrt(GM / R); y = np.array([R, 0.0, 0.0, v]); t = 0.0; dt = 2.0; ang = 0.0; prev = 0.0; fg = lambda tt, s: np.array([s[2], s[3], -GM * s[0] / (s[0] ** 2 + s[1] ** 2) ** 1.5, -GM * s[1] / (s[0] ** 2 + s[1] ** 2) ** 1.5])  # noqa: E731
        while True:
            yn = rk4(fg, y, t, t + dt, 1); a = math.atan2(yn[1], yn[0]); d = a - prev; d = d + 2 * math.pi if d < -math.pi else d - 2 * math.pi if d > math.pi else d; ang += d; prev = a; t += dt; y = yn
            if ang >= 2 * math.pi:
                return t - dt * (ang - 2 * math.pi) / d
    agree(period(f * R1) / period(R1), fac, 2e-3, "fac")
    stem = f"A satellite orbits Earth in a circular orbit of radius $r_1$ with a period $T_1$. A second satellite orbits Earth in a circular orbit of radius ${f}r_1$. Which of the following is the best prediction of the period $T_2$ of the second satellite in terms of $T_1$?"
    fm = lambda v: f"$T_2={sig(v)}\\,T_1$"  # noqa: E731
    key, ds = num_opts(fac, [("Takes the period to be proportional to the radius.", float(f)), ("Takes the period to be proportional to the square root of the radius.", math.sqrt(f)), ("Takes the period to be proportional to the square of the radius.", float(f * f)), ("Takes the period to be unchanged because both satellites feel the gravity of the same Earth.", 1.0)], fmt=fm)
    return _d2("ph_pred_orbit_period_radius", "6.6", stem, key, ds, rng, kwhy=f"For a circular orbit $T=2\\pi\\sqrt{{r^3/(GM)}}$, so $T_2/T_1=({f})^{{3/2}}={sig(fac)}$.", concept="Predicting the period of a circular orbit when the radius changes",
               thinking=["Set the gravitational force equal to the centripetal force and write the period", "Find how the period scales with the radius and apply the factor"], cond=[("both orbits are circular around the same Earth", "the stem gives circular orbits of two radii around Earth")],
               path="the orbits are integrated with RK4 and the time for one revolution is measured at both radii", facts=[f"f={f}", f"R1={R1}"], est=80)


@retry_sep
def ph_claim_collision_energy(rng):
    m = pick(rng, [1.0, 2.0]); M = pick(rng, [1.0, 2.0, 3.0]); v = pick(rng, [3.0, 4.0, 6.0])
    vf = m * v / (m + M); K0 = 0.5 * m * v * v; K1 = 0.5 * (m + M) * vf * vf; loss = K0 - K1
    # 독립 경로: 운동량 보존을 선형계로 풀어 나중 속력을 구하고 운동에너지를 직접 계산
    vfn = float(np.linalg.solve(np.array([[m + M]]), np.array([m * v]))[0]); agree(vfn, vf, 1e-9, "vf"); agree(0.5 * (m + M) * vfn ** 2, K1, 1e-9, "K1")
    stem = f"A ${m:g}\\text{{ kg}}$ cart moving at ${v:g}\\text{{ m/s}}$ on a frictionless track collides with a stationary ${M:g}\\text{{ kg}}$ cart, and the two carts stick together. Which statement about the kinetic energy of the carts is correct and best justified?"
    key, ds = _sent(f"The kinetic energy decreases from ${sig(K0)}\\text{{ J}}$ to ${sig(K1)}\\text{{ J}}$, because the carts move together after the collision and the momentum is conserved but the kinetic energy is not.", f"$v_f=mv/(m+M)={sig(vf)}\\text{{ m/s}}$, so $K_f=\\tfrac12(m+M)v_f^2={sig(K1)}\\text{{ J}}$, which is less than ${sig(K0)}\\text{{ J}}$.",
                    [(f"The kinetic energy stays ${sig(K0)}\\text{{ J}}$, because momentum is conserved in the collision, so the kinetic energy is also conserved.", "Treats conservation of momentum as conservation of kinetic energy, which holds only for elastic collisions."),
                     (f"The kinetic energy increases to ${sig(0.5 * (m + M) * v * v)}\\text{{ J}}$, because the total mass that moves is greater after the collision.", "Uses the original speed for the combined mass, but the speed decreases after the carts stick together."),
                     (f"The kinetic energy decreases to ${sig(K0 / 2)}\\text{{ J}}$, because each cart keeps half of the energy.", "Splits the energy equally between the carts without using the masses and the conservation of momentum.")])
    return _b3("ph_claim_collision_energy", "4.4", stem, key, ds, rng, concept="Justifying the loss of kinetic energy in a perfectly inelastic collision using conservation of momentum", thinking=["Use conservation of momentum to find the speed of the carts that stick together", "Compare the kinetic energy before and after the collision"],
               cond=[("the track is frictionless and the carts stick together", "the stem gives a frictionless track and carts that stick together")], path="the momentum equation is solved as a linear system for the final speed and the kinetic energies are computed directly", facts=[f"m={m}", f"M={M}", f"v={v}"], est=85)

# 2026-10-19 2차 생성: 1차에서 후보 3개가 모두 반려된 원형(표기 e+03·너무 긴 stem·오답 설명 불일치를 고친 것)
STAGE_N2_MC = ["ph_claim_power_climb", "ph_pred_planet_weight", "ph_rank_rot_ke", "ph_rank_ang_momentum", "ph_rank_moment_inertia", "ph_rank_angular_accel", "ph_pred_altitude_weight", "ph_pred_orbit_period_radius", "ph_claim_collision_energy", "ph_gravity_scaling", "ph_orbit_period_ratio", "ph_claim_momentum_system"]

# 2026-10-19: phys_mc_all(단원별 목록)·phys_sets 에 새 원형을 넣어 가이드 JSON 일관성 테스트(physics1-archetypes.test.ts)가 같은 목록을 보게 한다.
STAGE_U1 = ["ph_claim_relative_motion", "ph_claim_vt_area", "ph_sym_kinematics_vf", "ph_sym_projectile_range", "ph_sym_free_fall_time"]
STAGE_U2 = ["ph_evid_friction_data", "ph_evid_spring_data", "ph_pred_planet_weight", "ph_claim_incline_normal", "ph_pred_incline_angle", "ph_rank_normal_force", "ph_rank_friction_force", "ph_rank_incline_accel", "ph_claim_atwood_accel", "ph_claim_friction_area", "ph_pred_altitude_weight"]
STAGE_U3 = ["ph_claim_ramps_speed", "ph_claim_power_climb", "ph_claim_ke_stopping", "ph_claim_spring_launch", "ph_evid_ke_speed_data", "ph_sym_slide_stop_speed"]
STAGE_U4 = ["ph_claim_airbag_force", "ph_claim_recoil_speed", "ph_claim_bounce_impulse", "ph_rank_momentum_change", "ph_pred_collision_stick", "ph_claim_collision_energy"]
STAGE_U5 = ["ph_sym_wheel_pulley", "ph_claim_torque_door", "ph_sym_disk_rim_force", "ph_rank_moment_inertia", "ph_rank_angular_accel"]
STAGE_U6 = ["ph_rank_rot_ke", "ph_rank_ang_momentum", "ph_sym_rolling_accel", "ph_pred_collapse_spin", "ph_claim_satellite_speed", "ph_pred_orbit_period_radius"]
STAGE_U7 = ["ph_pred_spring_period", "ph_claim_shm_mass", "ph_evid_period_mass_data", "ph_sym_spring_added_mass", "ph_pred_pendulum_planet"]
STAGE_U8 = ["ph_sym_pressure_depth", "ph_sym_continuity_pipe", "ph_sym_bernoulli_diff", "ph_sym_apparent_weight", "ph_claim_continuity_speed", "ph_sym_float_fraction", "ph_sym_torricelli"]
STAGE_SETS = ["phs_ft_set", "phs_torque_set", "phs_depth_pressure_set", "phs_wt_claim_set"]
