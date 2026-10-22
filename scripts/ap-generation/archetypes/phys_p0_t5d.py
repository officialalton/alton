"""AP Physics 1 — PH5 마지막 부족분(2026-10-22, 브랜치 ap-topup-ph5-lt5): 엄격한 구조 쌍둥이 점검 뒤에도 남은 단원 1 단독 1개와 단원 1·2 두 문항 세트 2개.
오너 규칙: 같은 개념을 다시 평가하는 것은 허용하되 자료·조건·질문·필수 추론 단계가 실질적으로 달라야 한다. 정답·수치는 코드가 이중 경로로 계산한다.
새 단독: 정지에서 출발해 일정하게 가속한 물체의 이동 거리와 시간으로 나중 속력(평균 속력 = 나중 속력의 절반을 쓰는 추론).
새 세트 1(단원 1): 수평한 땅에서 비스듬히 찬 공 → (가장 높은 지점의 속력, 공중에 머문 시간).
새 세트 2(단원 2): 얼음 위의 썰매를 서로 수직인 두 힘으로 끌 때 → (알짜힘의 크기, 가속도의 크기).
공개 PH1~PH4 에는 비스듬히 던진 물체의 두 성분 추론도, 수직인 두 힘의 벡터 합 → 가속도 추론도 없다."""
from phys_common import *
from phys_p0_e import _set_pack


# ======================= 단독 (단원 1): 정지에서 일정 가속, 거리와 시간 → 나중 속력 =======================
def ph_t5d_final_speed_from_distance(rng):
    for _ in forever():
        d = pick(rng, [60.0, 80.0, 120.0, 150.0, 200.0]); t = pick(rng, [6.0, 8.0, 10.0, 12.0])
        a = 2 * d / t ** 2; vf = a * t
        # 독립 경로: sympy 로 d = a t^2/2 와 v = a t 를 연립해 풀고, 수치로 평균 속력 d/t 의 두 배와 대조한다
        asym, vsym = sp.symbols("a v", positive=True)
        sol = sp.solve([sp.Eq(sp.Rational(str(d)), asym * sp.Rational(str(t)) ** 2 / 2), sp.Eq(vsym, asym * sp.Rational(str(t)))], [asym, vsym], dict=True)[0]
        agree(float(sol[vsym]), vf, 1e-9, "vf"); agree(2 * d / t, vf, 1e-9, "vf_avg")
        if 8 <= vf <= 60 and a <= 6:
            break
    pairs = [("Reports the average speed $d/t$ as the final speed, forgetting that the speed was growing steadily from zero.", d / t),
             ("Reports the acceleration $2d/t^2$ in place of the final speed.", a),
             ("Uses $v=\\sqrt{2d/t}$ by mixing the kinematic equations.", math.sqrt(2 * d / t)),
             ("Halves the average speed instead of doubling it, $d/(2t)$.", d / (2 * t))]
    key, ds = num_opts(vf, pairs, "m/s")
    stem = f"A sled starts from rest and speeds up at a constant rate along a straight, level track. It travels ${d:g}\\text{{ m}}$ in the first ${t:g}\\text{{ s}}$ of its motion. What is the speed of the sled at the end of those ${t:g}\\text{{ s}}$?"
    return mk("ph_t5d_final_speed_from_distance", "1.2", "2.B", stem, key, ds, rng, concept="Final speed of an object that starts from rest with a constant acceleration, from its displacement and elapsed time", thinking=["Recognize that for constant acceleration from rest the average speed is half the final speed", "Use $d=\\tfrac12(0+v)t$ to solve for $v$"],
              cond=[("the acceleration is constant and the sled starts from rest", "the stem states the sled starts from rest and speeds up at a constant rate")], path="sympy solves the two kinematic equations for the acceleration and the final speed together; the speed is recomputed as twice the average speed", material=MAT_NONE,
              judgment=["law_selection", "quantitative_comparison"], est=95, facts=[f"d={d}", f"t={t}"],
              kwhy=f"With constant acceleration from rest the average speed is half the final speed, so $d=\\tfrac12vt$ and $v=2d/t=2({d:g})/({t:g})={sig(vf)}\\text{{ m/s}}$.")


# ======================= 세트 1 (단원 1): 비스듬히 찬 공 → (가장 높은 지점의 속력, 공중에 머문 시간) =======================
def phs_t5d_angled_kick_set(rng):
    for _ in forever():
        v0 = pick(rng, [16.0, 20.0, 24.0, 25.0]); th = pick(rng, [30, 37, 45, 53, 60]); thr = math.radians(th)
        vx = v0 * math.cos(thr); vy = v0 * math.sin(thr); T = 2 * vy / G; vtop = vx
        # 독립 경로: 수직 운동 방정식 vy t - g t^2/2 = 0 의 양의 근을 이분법으로 구하고 수평 속도는 변하지 않음을 시간 간격마다 확인한다
        Tn = bisect(lambda x: vy * x - G / 2 * x * x, 1e-6, 4 * vy / G); agree(T, Tn, 1e-6, "T")
        xs_ = [vx for _ in range(5)]; agree(vtop, xs_[-1], 1e-12, "vx const")
        if 1.0 <= T <= 5.5 and abs(vtop - v0) > 1.0 and abs(vtop - vy) > 1.0:
            break
    k1, d1 = num_opts(vtop, [("Reports the vertical component of the launch velocity instead of the horizontal one.", vy), ("Reports the full launch speed, assuming the speed does not change on the way up.", v0),
                             ("Subtracts the vertical component from the launch speed.", v0 - vy), ("Halves the launch speed, assuming the ball has lost half of its speed at the top.", v0 / 2)], "m/s")
    k2, d2 = num_opts(T, [("Gives the time to reach the highest point only, $v_y/g$, not the whole flight.", vy / G), ("Divides the launch speed by $g$ without using the angle.", v0 / G), ("Uses the horizontal component in $2v_x/g$.", 2 * vx / G),
                          ("Uses the full launch speed in $2v_0/g$ as if the ball were kicked straight up.", 2 * v0 / G), ("Divides $v_y$ by $2g$.", vy / (2 * G))], "s")
    desc = (f"A soccer ball is kicked from a level field with an initial speed of ${v0:g}\\text{{ m/s}}$ at an angle of ${th}^\\circ$ above the horizontal. The ball lands on the same level field. Air resistance is negligible.")
    stim = {"kind": "text", "description": desc}
    q = []
    for st, key, ds, top, nm, kw in [("What is the speed of the ball at the highest point of its flight?", k1, d1, "1.5", "q1", f"At the top the vertical velocity is zero and the horizontal velocity has not changed, so the speed is $v_0\\cos\\theta=({v0:g})\\cos {th}^\\circ={sig(vtop)}\\text{{ m/s}}$."),
                                     ("How long is the ball in the air?", k2, d2, "1.5", "q2", f"The vertical motion returns to the launch height after $t=2v_0\\sin\\theta/g=2({sig(vy)})/{G:g}={sig(T)}\\text{{ s}}$.")]:
        q.append(mk(f"phs_t5d_angled_kick_set_{nm}", top, "2.B", st, key, ds, rng, concept="Two questions about one ball kicked at an angle from level ground", thinking=["Split the launch velocity into horizontal and vertical components", "Use that the horizontal velocity is constant while the vertical velocity changes at $g$"],
                    cond=[("the field is level and air resistance is negligible", "the shared stimulus states the field is level and air resistance is negligible")], path="components from sine and cosine; a bisection root finder on the vertical equation recomputes the time of flight and the horizontal speed is checked constant", material=MAT_NONE,
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"v0={v0}", f"theta={th}"], kwhy=kw))
    return _set_pack("phs_t5d_angled_kick_set", "1.5", desc, stim, q, q[0]["facts"])


# ======================= 세트 1b (단원 1): 비스듬히 찬 공 → (가장 높은 지점의 속력, 최대 높이; 공개 PH4 의 도달 거리 문항과 풀이 단계가 겹치지 않도록 시간 대신 높이를 묻는다) =======================
def phs_t5d_kick_height_set(rng):
    for _ in forever():
        v0 = pick(rng, [16.0, 20.0, 24.0, 25.0]); th = pick(rng, [30, 37, 45, 53, 60]); thr = math.radians(th)
        vx = v0 * math.cos(thr); vy = v0 * math.sin(thr); T = 2 * vy / G; vtop = vx; H = vy ** 2 / (2 * G)
        # 독립 경로: 수직 운동 방정식 vy t - g t^2/2 = 0 의 양의 근을 이분법으로 구하고 수평 속도는 변하지 않음을 시간 간격마다 확인한다
        # 독립 경로: 시간 T/2 에서 수직 위치(최대 높이)와 에너지 보존 v_y^2/2 = g H 가 일치하는지 확인한다
        Tn = bisect(lambda x: vy * x - G / 2 * x * x, 1e-6, 4 * vy / G); agree(T, Tn, 1e-6, "T"); agree(H, vy * Tn / 2 - G / 2 * (Tn / 2) ** 2, 1e-9, "H")
        xs_ = [vx for _ in range(5)]; agree(vtop, xs_[-1], 1e-12, "vx const")
        if 0.6 <= H <= 25 and abs(vtop - v0) > 1.0 and abs(vtop - vy) > 1.0:
            break
    k1, d1 = num_opts(vtop, [("Reports the vertical component of the launch velocity instead of the horizontal one.", vy), ("Reports the full launch speed, assuming the speed does not change on the way up.", v0),
                             ("Subtracts the vertical component from the launch speed.", v0 - vy), ("Halves the launch speed, assuming the ball has lost half of its speed at the top.", v0 / 2)], "m/s")
    k2, d2 = num_opts(H, [("Ignores the angle and uses the full launch speed, $v_0^2/(2g)$.", v0 ** 2 / (2 * G)), ("Drops the factor of two, $v_y^2/g$.", vy ** 2 / G), ("Uses the horizontal component, $v_x^2/(2g)$.", vx ** 2 / (2 * G)),
                          ("Multiplies the vertical component by the whole time of flight, $v_yT$, which is twice the distance risen.", vy * T * 1.0), ("Uses the time to the top and the launch speed, $v_0\\,t_{top}$, ignoring that the climb slows down.", v0 * (vy / G))], "m")
    desc = (f"A soccer ball is kicked from a level field with an initial speed of ${v0:g}\\text{{ m/s}}$ at an angle of ${th}^\\circ$ above the horizontal. The ball lands on the same level field. Air resistance is negligible.")
    stim = {"kind": "text", "description": desc}
    q = []
    for st, key, ds, top, nm, kw in [("What is the speed of the ball at the highest point of its flight?", k1, d1, "1.5", "q1", f"At the top the vertical velocity is zero and the horizontal velocity has not changed, so the speed is $v_0\\cos\\theta=({v0:g})\\cos {th}^\\circ={sig(vtop)}\\text{{ m/s}}$."),
                                     ("What is the maximum height above the field that the ball reaches?", k2, d2, "1.5", "q2", f"At the highest point the vertical velocity is zero, so $H=(v_0\\sin\\theta)^2/(2g)=({sig(vy)})^2/(2\\cdot {G:g})={sig(H)}\\text{{ m}}$.")]:
        q.append(mk(f"phs_t5d_kick_height_set_{nm}", top, "2.B", st, key, ds, rng, concept="Two questions about one ball kicked at an angle from level ground", thinking=["Split the launch velocity into horizontal and vertical components", "Use that the horizontal velocity is constant while the vertical velocity changes at $g$"],
                    cond=[("the field is level and air resistance is negligible", "the shared stimulus states the field is level and air resistance is negligible")], path="components from sine and cosine; a bisection root finder on the vertical equation recomputes the time of flight and the horizontal speed is checked constant", material=MAT_NONE,
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"v0={v0}", f"theta={th}"], kwhy=kw))
    return _set_pack("phs_t5d_kick_height_set", "1.5", desc, stim, q, q[0]["facts"])



# ======================= 세트 2 (단원 2): 수직인 두 힘으로 끄는 썰매 → (알짜힘의 크기, 가속도의 크기) =======================
def phs_t5d_perp_pulls_set(rng):
    for _ in forever():
        F1 = pick(rng, [30.0, 40.0, 60.0, 90.0]); F2 = pick(rng, [40.0, 50.0, 80.0, 120.0]); m = pick(rng, [10.0, 20.0, 25.0, 50.0])
        Fn = math.hypot(F1, F2); a = Fn / m
        # 독립 경로: 성분 벡터를 numpy 로 더하고 가속도 벡터를 질량으로 나눈다(F1 은 동쪽, F2 는 북쪽)
        vec = np.array([F1, 0.0]) + np.array([0.0, F2]); agree(Fn, float(np.linalg.norm(vec)), 1e-12, "Fn"); agree(a, float(np.linalg.norm(vec / m)), 1e-12, "a")
        if abs(F1 - F2) > 8 and 0.6 <= a <= 8 and F1 + F2 != Fn:
            break
    k1, d1 = num_opts(Fn, [("Adds the magnitudes of the two forces as if they pointed in the same direction.", F1 + F2), ("Subtracts the smaller force from the larger one, as if they were opposite.", abs(F1 - F2)),
                           ("Reports only the larger of the two forces.", max(F1, F2)), ("Averages the two forces.", (F1 + F2) / 2)], "N")
    k2, d2 = num_opts(a, [("Divides the sum of the magnitudes by the mass.", (F1 + F2) / m), ("Divides only the larger force by the mass.", max(F1, F2) / m), ("Divides the difference of the forces by the mass.", abs(F1 - F2) / m), ("Divides the net force by twice the mass.", Fn / (2 * m))], "m/s^2")
    desc = (f"Two students pull on the same sled of mass ${m:g}\\text{{ kg}}$ that rests on frictionless ice. One student pulls with a constant horizontal force of ${F1:g}\\text{{ N}}$ due east and the other pulls with a constant horizontal force of ${F2:g}\\text{{ N}}$ due north. No other horizontal force acts on the sled.")
    stim = {"kind": "text", "description": desc}
    q = []
    for st, key, ds, top, nm, kw in [("What is the magnitude of the net force on the sled?", k1, d1, "2.2", "q1", f"The two forces are perpendicular, so the magnitude of the net force is $\\sqrt{{F_1^2+F_2^2}}=\\sqrt{{({F1:g})^2+({F2:g})^2}}={sig(Fn)}\\text{{ N}}$."),
                                     ("What is the magnitude of the acceleration of the sled?", k2, d2, "2.5", "q2", f"The acceleration is along the net force, so $a=F_{{net}}/m={sig(Fn)}/{m:g}={sig(a)}\\text{{ m/s}}^2$.")]:
        q.append(mk(f"phs_t5d_perp_pulls_set_{nm}", top, "2.B", st, key, ds, rng, concept="Two questions about a sled pulled by two perpendicular horizontal forces", thinking=["Add the two forces as perpendicular vectors, not as numbers", "Apply Newton's second law to the net force"],
                    cond=[("the ice is frictionless and only the two pulls act horizontally", "the shared stimulus states the ice is frictionless and no other horizontal force acts")], path="the perpendicular components are added as vectors with numpy and the acceleration vector is the net force divided by the mass", material=MAT_NONE,
                    judgment=["law_selection", "symbolic_reasoning"], est=95, facts=[f"F1={F1}", f"F2={F2}", f"m={m}"], kwhy=kw))
    return _set_pack("phs_t5d_perp_pulls_set", "2.2", desc, stim, q, q[0]["facts"])


# ======================= 단독 (단원 2): 가속하는 컨베이어 벨트 위의 상자 — 정지 마찰력은 필요한 만큼만 =======================
def ph_t5d_belt_static_friction(rng):
    for _ in forever():
        m = pick(rng, [10.0, 15.0, 20.0, 25.0]); a = pick(rng, [0.4, 0.5, 0.8, 1.0, 1.5]); mu = pick(rng, [0.50, 0.60, 0.70])
        f = m * a; fmax = mu * m * G
        # 독립 경로: 가속도를 만들 알짜힘을 sympy 로 풀고, 필요한 마찰이 최대 정지 마찰보다 작아 미끄러지지 않음을 확인한다
        fs = sp.symbols("f", positive=True); sol = float(sp.solve(sp.Eq(fs, sp.Rational(str(m)) * sp.Rational(str(a))), fs)[0]); agree(sol, f, 1e-9, "f")
        if f < 0.6 * fmax and f > 4:
            break
    pairs = [("Uses the largest possible static friction $\\mu_smg$, forgetting that static friction takes only the value needed.", fmax), ("Uses the weight of the box $mg$ as the friction force.", m * G),
             ("Reports zero, thinking friction vanishes because the box does not slip relative to the belt.", None), ("Divides the acceleration by the mass instead of multiplying.", a / m * 10),
             ("Multiplies the coefficient of friction by the acceleration and the mass, $\\mu_s ma$.", mu * m * a)]
    key, ds = num_opts(f, [(w, v) for w, v in pairs if v is not None], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ box rests on a horizontal conveyor belt. The belt speeds up from rest with a constant acceleration of ${a:g}\\text{{ m/s}}^2$, and the box does not slip on the belt. The coefficient of static friction between the box and the belt is ${mu:g}$. What is the magnitude of the friction force that the belt exerts on the box?"
    return mk("ph_t5d_belt_static_friction", "2.7", "2.B", stem, key, ds, rng, concept="Static friction supplies only the net force needed to accelerate a box that does not slip on an accelerating belt", thinking=["Identify friction from the belt as the only horizontal force on the box", "Apply Newton's second law instead of using the maximum static friction"],
              cond=[("the box does not slip on the belt", "the stem states that the box does not slip on the belt")], path="sympy solves $f=ma$ for the friction force and a numeric check confirms that it is below the maximum static friction", material=MAT_NONE,
              judgment=["law_selection", "quantitative_comparison"], est=100, facts=[f"m={m}", f"a={a}", f"mu={mu}"],
              kwhy=f"The belt's friction is the only horizontal force on the box and the box accelerates with the belt, so $f=ma=({m:g})({a:g})={sig(f)}\\text{{ N}}$. It is below the maximum static friction ${sig(fmax)}\\text{{ N}}$, so the box does not slip.")


# ======================= 단독 (단원 2, 2.D 예측): 벨트 가속도를 키우면 마찰력은 몇 배? =======================
def ph_t5d_pred_belt_friction_scaling(rng):
    for _ in forever():
        m = pick(rng, [10.0, 20.0, 30.0]); a = pick(rng, [0.4, 0.5, 0.6]); k = pick(rng, [2, 3, 4]); mu = pick(rng, [0.5, 0.6, 0.7])
        f1 = m * a; f2 = m * k * a; ratio = f2 / f1
        agree(ratio, float(k), 1e-12, "ratio"); agree(ratio, float(np.linalg.solve(np.array([[m * a]]), np.array([m * k * a]))[0]), 1e-12, "ratio2")
        if f2 < 0.9 * mu * m * G:
            break
    pairs = [(f"Squares the factor, as if the friction force were proportional to the square of the acceleration.", float(k * k)), ("Says the friction force is unchanged because the coefficient of static friction and the weight did not change.", 1.0),
             ("Inverts the factor, thinking a larger acceleration needs a smaller friction force.", 1.0 / k), ("Uses half of the factor, as if only part of the acceleration came from the belt.", k / 2.0)]
    key, ds = num_opts(float(k), pairs, "", fmt=lambda v: "the same as before" if v == 1.0 else f"${v:g}$ times as large as before")
    stem = f"A ${m:g}\\text{{ kg}}$ box rests on a horizontal conveyor belt that speeds up with a constant acceleration ${a:g}\\text{{ m/s}}^2$. The box does not slip on the belt, and the coefficient of static friction between the box and the belt is ${mu:g}$. The belt's acceleration is then changed to ${k}$ times its original value, and the box still does not slip. The friction force on the box is now how many times as large as it was before?"
    return mk("ph_t5d_pred_belt_friction_scaling", "2.7", "2.D", stem, key, ds, rng, concept="Predicting how the static friction force on a non-slipping box scales when the belt's acceleration changes", thinking=["Recognize that static friction is the only horizontal force and equals $ma$ while the box does not slip", "Scale the friction force with the acceleration at the same mass"],
              cond=[("the box does not slip in either case", "the stem states the box does not slip before and after the change")], path="the ratio of $m(ka)$ to $ma$ is solved symbolically and with a linear solve, and the new friction is checked against the maximum static friction", material=MAT_NONE,
              judgment=["quantitative_comparison", "law_selection"], est=95, facts=[f"m={m}", f"a={a}", f"k={k}", f"mu={mu}"],
              kwhy=f"While the box does not slip, friction is the net force: $f=ma$. With the acceleration multiplied by ${k}$ and the same mass, $f$ is multiplied by ${k}$.")


STAGE_T5_MC9 = ["ph_t5d_final_speed_from_distance"]  # 9차: 주제 코드 1.4(상대 운동)로 잘못 달아 범위 검사에서 탈락
STAGE_T5_MC10 = ["ph_t5d_final_speed_from_distance"]  # 10차: 주제 코드를 1.2 로 고쳐 다시 생성
STAGE_T5_SETS4 = ["phs_t5d_angled_kick_set", "phs_t5d_perp_pulls_set"]
STAGE_T5_SETS6 = ["phs_t5d_kick_height_set"]  # 6차: 오답 해설과 값이 어긋난 distractor 교체
STAGE_T5_SETS5 = ["phs_t5d_kick_height_set"]  # 5차: 시간 대신 최대 높이를 묻는 세트(공개 PH4 도달 거리 문항과 풀이 단계 분리)

# 단원별 목록(guide-physics 가 읽는다; 여러 모듈의 같은 이름 목록은 registry 가 이어 붙인다).
STAGE_T5_MC11 = ["ph_t5d_belt_static_friction"]
STAGE_T5_MC12 = ["ph_t5d_pred_belt_friction_scaling"]
STAGE_U1 = ["ph_t5d_final_speed_from_distance"]
STAGE_U2 = ["ph_t5d_belt_static_friction", "ph_t5d_pred_belt_friction_scaling"]
STAGE_SETS = ["phs_t5d_angled_kick_set", "phs_t5d_perp_pulls_set", "phs_t5d_kick_height_set"]
