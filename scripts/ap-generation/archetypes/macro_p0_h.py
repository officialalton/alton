"""AP Macroeconomics 원형 H — exam_prep 보강 단원 1–3(2026-10-15, macro-hard). 전부 단독 다단계(3단계 이상) 문항. 코드가 두 경로로 정답을 계산하고 오답은 단계 누락·오적용 값이다."""
from fractions import Fraction as Fr  # noqa: F811
from macro_hard_common import *  # noqa: F401,F403
from macro_hard_common import _sg  # noqa: F401


# ======================= 단원 1 =======================
@retry_sep
def ma_h_trade_gain(rng):
    X, Y = rng.choice([("wheat", "cloth"), ("laptops", "bicycles"), ("corn", "lumber"), ("chairs", "tables")])
    a1 = rng.choice([12, 16, 20, 24, 30]); a2 = rng.choice([4, 5, 6, 8, 10]); b1 = rng.choice([6, 8, 10, 12, 15]); b2 = rng.choice([6, 8, 10, 12, 15, 20])
    rA, rB = Fr(a1, a2), Fr(b1, b2)  # 각국의 Y 한 단위의 기회비용(X 단위)
    if not rB < rA:
        raise ValueError("not_enough_separated_distractors")
    t = (rA + rB) / 2
    if t.denominator not in (1, 2):
        raise ValueError("not_enough_separated_distractors")
    cands = [e for e in range(4, a1 - 1, 2) if (e / t).denominator == 1 and e / t <= b2 and (e / t - Fr(a2 * e, a1)).denominator == 1 and e / t - Fr(a2 * e, a1) > 0]
    if not cands:
        raise ValueError("not_enough_separated_distractors")
    e = rng.choice(cands)
    got = e / t
    dom = Fr(a2 * e, a1)  # 국내에서 X 를 e 만큼 덜 만들 때 늘릴 수 있는 Y
    gain = got - dom
    # 독립 경로: A 의 생산가능곡선 x/a1 + y/a2 = 1 에서 x = a1 - e 일 때의 y 를 sympy 로 푼다
    xs, ys = sp.symbols("x y")
    y_home = sp.solve(sp.Eq(xs / a1 + ys / a2, 1).subs(xs, a1 - e), ys)[0]
    agree(float(gain), float(sp.Rational(e) / sp.Rational(t.numerator, t.denominator) - y_home), 1e-9, "gain")
    tt = nm(float(t), 1)
    stim = tbl(f"Maximum weekly output of {X} and {Y} for two countries that use all of their resources on one good (constant opportunity costs).", ["Country", f"Maximum {X}", f"Maximum {Y}"], [["Country A", a1, a2], ["Country B", b1, b2]])
    stem = (f"The table shows the maximum weekly output of {X} and {Y} for two countries; opportunity costs are constant. The countries agree to trade at {tt} units of {X} for 1 unit of {Y}. "
            f"Country A specializes completely in {X} and sends {e} units of {X} to Country B in exchange for {Y}. Compared with producing {Y} itself while consuming the same {a1 - e} units of {X}, how many more units of {Y} does Country A consume?")
    f = lambda v: f"{nm(abs(v), 1)} {'more' if v > 0 else 'fewer'} units of {Y}"  # noqa: E731
    pairs = [(f"Reports only the {Y} received from Country B and does not subtract the {Y} Country A could have produced at home for the same {X}.", float(got)),
             (f"Reports the {Y} Country A could have produced at home instead of comparing it with the {Y} obtained from trade.", float(dom)),
             (f"Treats the terms of trade as units of {Y} per unit of {X} by inverting the exchange rate.", float(e * t - dom)),
             (f"Reads Country A's home production of {Y} from the wrong point on its production possibilities curve ({a1 - e} units of {X} produced rather than given up).", float(got - Fr(a2 * (a1 - e), a1))),
             (f"Uses Country B's opportunity cost of {Y} to value the home alternative, which makes Country A look worse off.", float(got - e / rB))]
    kw = (f"Country A's opportunity cost of 1 unit of {Y} is {a1}/{a2} = {nm(float(rA), 2)} units of {X}; Country B's is {nm(float(rB), 2)}, so the terms of {tt} are between them and both gain. "
          f"Trading {e} units of {X} brings {e}/{tt} = {nm(float(got), 1)} units of {Y}. At home, giving up {e} units of {X} would free only {e}/{nm(float(rA), 2)} = {nm(float(dom), 1)} units of {Y}. The gain is {nm(float(gain), 1)} units.")
    return num_item("ma_h_trade_gain", "1.3", "1.C", stem, float(gain), pairs, f, rng, concept="gains from specialization and trade at terms between the opportunity costs", path="exact fractions on the trade rate vs sympy solution of the PPC line at the home consumption point",
                    st=steps("Compute each country's opportunity cost and confirm the terms of trade lie between them", "Find the units of Y obtained by trading the units of X at the terms", "Find the units of Y Country A could produce at home for the same units of X on its PPC", "Subtract the home alternative from the amount obtained by trade"),
                    stim=stim, facts=[f"a1={a1}", f"a2={a2}", f"b1={b1}", f"b2={b2}", f"e={e}", f"t={float(t)}", f"gain={float(gain)}"], kwhy=kw, est=120)


@retry_sep
def ma_h_shift_shortage(rng):
    good = rng.choice(GOODS)
    B = rng.choice([2, 4, 5]); D = rng.choice([2, 3, 4, 5]); P0 = rng.choice([20, 30, 40]); Q0 = rng.choice(range(100, 321, 20))
    A = Q0 + B * P0; C = Q0 - D * P0
    if C <= 0:
        raise ValueError("not_enough_separated_distractors")
    tot = (B + D) * 10
    x = 5 * rng.randint(1, tot // 5 - 1); y = tot - x
    P1 = P0 + 10
    Q1 = C + D * P1 - y
    # 독립 경로: 가격 격자를 전수 탐색해 이동 뒤 수요량 = 공급량인 가격을 찾는다
    hit = [p for p in range(0, 400) if (A + x - B * p) == (C - y + D * p)]
    agree(len(hit), 1, 1e-9, "unique_eq"); agree(hit[0], P1, 1e-9, "P1"); agree(A + x - B * P1, Q1, 1e-9, "Q1")
    rows = [[f"${P0 + k}", A - B * (P0 + k), C + D * (P0 + k)] for k in (-20, -10, 0, 10, 20)]
    stim = tbl(f"Quantity of {good} demanded and supplied at five prices, before any change.", ["Price", "Quantity demanded", "Quantity supplied"], rows)
    stem = (f"The table shows the quantity of {good} demanded and supplied at different prices. Then consumers' incomes rise, which increases the quantity demanded at every price by {x} units, "
            f"and an increase in input costs decreases the quantity supplied at every price by {y} units. What is the new equilibrium quantity?")
    f = lambda v: f"{int(round(v))} units"  # noqa: E731
    pairs = [("Applies only the increase in demand, so the quantity at the old equilibrium price is changed by the demand shift alone.", Q0 + x), ("Applies only the decrease in supply and ignores the change in demand.", Q0 - y),
             ("Keeps the original equilibrium quantity, treating the two shifts as offsetting each other.", Q0), ("Reads the old demand schedule at the new equilibrium price, ignoring the increase in demand.", A - B * P1),
             ("Reads the old supply schedule at the new equilibrium price, ignoring the decrease in supply.", C + D * P1), ("Adds the demand increase and subtracts the supply decrease from the old quantity.", Q0 + x - y)]
    kw = f"After the shifts, demand is {A + x} - {B}P and supply is {C - y} + {D}P, which are equal at P = ${P1}. The quantity there is {Q1} units."
    return num_item("ma_h_shift_shortage", "1.6", "3.C", stem, Q1, pairs, f, rng, concept="a simultaneous demand increase and supply decrease change equilibrium quantity", path="algebraic equilibrium (exact) vs exhaustive price search over the shifted schedules",
                    st=steps("Shift the demand column up and the supply column down by the stated amounts", "Find the price at which the shifted quantities demanded and supplied are equal", "Read the equilibrium quantity at that price"),
                    stim=stim, facts=[f"P0={P0}", f"Q0={Q0}", f"x={x}", f"y={y}", f"Q1={Q1}"], kwhy=kw, est=105)


@retry_sep
def ma_h_ppc_rotate(rng):
    K = rng.choice([60, 80, 120, 160, 200]); C = rng.choice([30, 40, 60, 80]); g = rng.choice([25, 50, 100])
    C2 = C * (100 + g) // 100
    if C * (100 + g) % 100:
        raise ValueError("not_enough_separated_distractors")
    k1 = K // rng.choice([2, 4])  # 자본재 생산량(유지)
    if K % 2:
        raise ValueError("not_enough_separated_distractors")
    old = Fr(C * (K - k1), K); new = Fr(C2 * (K - k1), K)
    gain = new - old
    # 독립 경로: 두 생산가능곡선의 기울기와 같은 자본재 수준에서의 소비재 수를 sympy 로 푼다
    c = sp.symbols("c")
    old_s = sp.solve(sp.Eq(sp.Rational(k1) / K + c / C, 1), c)[0]; new_s = sp.solve(sp.Eq(sp.Rational(k1) / K + c / C2, 1), c)[0]
    agree(float(gain), float(new_s - old_s), 1e-9, "gain")
    if not whole(gain):
        raise ValueError("not_enough_separated_distractors")
    stem = (f"An economy uses all of its resources to produce consumer goods and capital goods. Its production possibilities curve is a straight line from {K} units of capital goods (and no consumer goods) to {C} units of consumer goods (and no capital goods). "
            f"A technological advance in consumer-goods production raises the maximum output of consumer goods by {g} percent and does not change the maximum output of capital goods. If the economy keeps producing {k1} units of capital goods, how many more units of consumer goods can it produce?")
    f = lambda v: f"{int(round(v))} units"  # noqa: E731
    pairs = [("Reports the increase in the maximum output of consumer goods rather than the increase at the given level of capital goods.", C2 - C), ("Reports the new quantity of consumer goods instead of the increase.", float(new)),
             ("Weights the increase in the maximum output by the share of resources used for capital goods instead of the share used for consumer goods.", float(Fr(C2 - C) * Fr(k1, K))), ("Reports the old quantity of consumer goods at the point, assuming the point does not move.", float(old)),
             ("Uses the capital-goods level as if it were consumer goods and applies the percentage to it.", k1 * g / 100)]
    kw = (f"The old curve gives {C}(1 - {k1}/{K}) = {nm(float(old), 1)} units of consumer goods at {k1} units of capital goods. The new maximum is {C2}, so the new curve gives {C2}(1 - {k1}/{K}) = {nm(float(new), 1)}. The increase is {nm(float(gain), 1)} units.")
    return num_item("ma_h_ppc_rotate", "1.2", "3.C", stem, float(gain), pairs, f, rng, concept="a one-good technology advance rotates the PPC", path="exact fractions along the linear PPC vs sympy solution of both curve equations at the fixed capital level",
                    st=steps("Find the new maximum output of consumer goods after the percentage increase", "Find consumer goods on the old straight-line PPC at the given capital-goods level", "Find consumer goods on the new PPC at the same capital-goods level", "Subtract the old quantity from the new quantity"),
                    facts=[f"K={K}", f"C={C}", f"g={g}", f"k1={k1}", f"gain={float(gain)}"], kwhy=kw, est=105)


@retry_sep
def ma_h_terms_range(rng):
    X, Y = rng.choice([("shirts", "bread loaves"), ("bicycles", "radios"), ("tons of wheat", "tons of steel"), ("chairs", "lamps")])
    oA, oB = [Fr(rng.choice([1, 2, 3, 4, 5, 6, 8]), 2) for _ in range(2)]  # 각국의 Y 한 단위의 기회비용(X 단위) = Y 시간 / X 시간
    hxA, hxB = rng.choice([2, 4]), rng.choice([2, 4])
    hyA, hyB = int(oA * hxA), int(oB * hxB)
    lo, hi = min(oA, oB), max(oA, oB)
    if hi < lo * Fr(14, 10):
        raise ValueError("not_enough_separated_distractors")
    mid = (lo + hi) / 2
    if mid.denominator > 4:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 각 선택지에서 두 나라가 이득을 보는지 직접 계산한다(교환 1 Y 당 t 개의 X)
    def both_gain(t):
        seller = lo if lo < hi else None  # Y 를 파는 나라: Y 의 기회비용이 낮은 쪽이 t 를 받아 X 를 얻는다
        return (t > lo) and (t < hi)
    assert both_gain(mid) and not both_gain(lo) and not both_gain(hi)
    cand = {"lo": lo, "hi": hi, "below": lo / 2, "above": hi * Fr(3, 2)}
    stim = tbl("Hours of labor needed to produce one unit of each good.", ["Country", f"Hours per unit of {X}", f"Hours per unit of {Y}"], [["Country A", hxA, hyA], ["Country B", hxB, hyB]])
    stem = (f"The table shows the hours of labor each country needs to produce one unit of {X} and one unit of {Y}; each country has the same number of workers. The countries will trade only if both end up better off. "
            f"Which of the following terms of trade would make both countries better off?")
    fm = lambda v: f"1 unit of {Y} for {nm(float(v), 2)} unit{'' if float(v) == 1 else 's'} of {X}"  # noqa: E731
    key = Opt(fm(mid), True, f"Country A gives up {nm(float(oA), 2)} units of {X} per unit of {Y} and Country B gives up {nm(float(oB), 2)}. A price strictly between these two opportunity costs, such as {nm(float(mid), 2)}, gives both countries more {X} per unit of {Y} than producing at home.", None)
    ds = [Opt(fm(cand["lo"]), False, f"At exactly {nm(float(lo), 2)} units of {X} per unit of {Y}, the country with the lower opportunity cost of {Y} gains nothing because it receives only what it gives up at home.", None),
          Opt(fm(cand["hi"]), False, f"At exactly {nm(float(hi), 2)} units of {X} per unit of {Y}, the country with the higher opportunity cost of {Y} gains nothing because it could obtain the same by producing at home.", None),
          Opt(fm(cand["below"]), False, f"A price below the lower opportunity cost of {Y} makes the seller of {Y} worse off than producing {X} at home.", None),
          Opt(fm(cand["above"]), False, f"A price above the higher opportunity cost of {Y} makes the buyer of {Y} worse off than producing {Y} at home.", None)]
    if len({o.text for o in [key] + ds}) < 5:
        raise ValueError("not_enough_separated_distractors")
    return mk("ma_h_terms_range", "1.3", "3.A", stem, key, ds, rng, concept="mutually beneficial terms of trade lie strictly between the two opportunity costs", path="exact fractions of hours ratios vs direct gain test for each country at each option",
              thinking=steps("Convert hours per unit into each country's opportunity cost of one unit of the second good", "Order the two opportunity costs to find the range of mutually beneficial terms", "Test each offered price against both countries' opportunity costs, remembering that a price equal to an opportunity cost gives that country no gain"),
              stim=stim, facts=[f"oA={float(oA)}", f"oB={float(oB)}", f"mid={float(mid)}"], est=110)


# ======================= 단원 2 =======================
@retry_sep
def ma_h_real_percapita(rng):
    r1 = rng.choice([2000, 2500, 3000, 4000, 5000]); g = rng.choice([3, 4, 5, 6]); infl = rng.choice([4, 5, 8, 10]); p1 = rng.choice([100, 200, 250, 300]); pg = rng.choice([1, 2, 3])
    r2 = Fr(r1 * (100 + g), 100); n2 = r2 * (100 + infl) / 100; p2 = Fr(p1 * (100 + pg), 100)
    if n2.denominator != 1 or p2.denominator != 1:
        raise ValueError("not_enough_separated_distractors")
    n2, p2 = int(n2), int(p2)
    pc = ((Fr(r2) / p2) / (Fr(r1) / p1) - 1) * 100
    # 독립 경로: 1인당 실질 GDP 수준을 sympy 유리수로 계산해 성장률을 낸다
    lv1 = sp.Rational(r1, p1); lv2 = sp.Rational(int(r2), p2)
    agree(float(pc), float((lv2 / lv1 - 1) * 100), 1e-9, "pc")
    pcv = round(float(pc), 1)
    stim = tbl("Nominal GDP, the GDP deflator (Year 1 is the base year), and population.", ["Item", "Year 1", "Year 2"], [["Nominal GDP (billions of dollars)", f"{r1:,}", f"{n2:,}"], ["GDP deflator", "100", 100 + infl], ["Population (millions)", p1, p2]])
    stem = "The table gives data for an economy in two years. By what percent did real GDP per person change from Year 1 to Year 2?"
    nom_pc = ((Fr(n2) / p2) / (Fr(r1) / p1) - 1) * 100
    pairs = [("Reports the growth of real GDP and ignores that the population grew.", g), ("Reports the growth of nominal GDP, which includes the change in prices.", float((Fr(n2, r1) - 1) * 100)),
             ("Reports nominal GDP per person growth and does not remove the price increase.", float(nom_pc)), ("Adds the population growth to the real GDP growth instead of dividing by the larger population.", g + pg),
             ("Uses the inflation rate implied by the deflator as the change in real GDP per person.", infl)]
    f = lambda v: f"{nm(v, 1)} percent"  # noqa: E731
    kw = f"Real GDP is nominal GDP divided by the deflator: ${r1:,} billion in Year 1 and ${n2:,}/{(100 + infl) / 100:.2f} = ${int(r2):,} billion in Year 2. Per person it is {nm(float(Fr(r1, p1)), 2)} and {nm(float(Fr(int(r2), p2)), 2)}, a change of {nm(pcv, 1)} percent."
    return num_item("ma_h_real_percapita", "2.6", "2.C", stem, pcv, pairs, f, rng, concept="real GDP per person requires deflating nominal GDP and dividing by population", path="exact fractions vs sympy rational per-person levels",
                    st=steps("Deflate Year 2 nominal GDP with the deflator to get real GDP in base-year prices", "Divide each year's real GDP by that year's population", "Compute the percent change in real GDP per person"),
                    stim=stim, facts=[f"r1={r1}", f"n2={n2}", f"infl={infl}", f"p1={p1}", f"p2={p2}", f"pc={float(pc):.4f}"], kwhy=kw, est=110)


@retry_sep
def ma_h_unemp_event(rng):
    P = rng.choice([200000, 250000, 300000]); LF0 = int(P * rng.choice([Fr(2, 3), Fr(13, 20), Fr(7, 10)]))
    U = int(LF0 * rng.choice([Fr(6, 100), Fr(8, 100), Fr(10, 100)])); E = LF0 - U
    d = rng.choice([1000, 2000, 3000, 4000]); f_ = rng.choice([1000, 2000, 3000])
    if d + f_ > 0.6 * U:
        raise ValueError("not_enough_separated_distractors")
    U1, LF1 = U - d - f_, LF0 - d
    rate = Fr(U1 * 100, LF1)
    # 독립 경로: 사람 단위로 상태 이동을 계수한다(실업 -> 취업 / 실업 -> 비경제활동)
    emp, unemp, nilf = E, U, P - LF0
    emp += f_; unemp -= f_; unemp -= d; nilf += d
    agree(float(rate), 100 * unemp / (emp + unemp), 1e-9, "rate")
    ratev = round(float(rate), 1)
    stim = tbl("Adult population by labor-force status (number of people).", ["Status", "Number"], [["Adult civilian noninstitutional population", f"{P:,}"], ["Employed", f"{E:,}"], ["Unemployed", f"{U:,}"]])
    stem = (f"The table shows labor-market data for an economy. During the next month, {d:,} of the unemployed become discouraged and stop looking for work, and {f_:,} of the unemployed find jobs. "
            f"Nothing else changes. What is the unemployment rate after these changes?")
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    pairs = [("Counts the job finders as the only unemployed workers who leave, so the discouraged workers are left in the unemployed count while the labor force shrinks.", float(Fr((U - f_) * 100, LF1))),
             ("Ignores both changes and reports the initial unemployment rate.", float(Fr(U * 100, LF0))), ("Divides the remaining unemployed by the whole adult population instead of the labor force.", float(Fr(U1 * 100, P))),
             ("Reports the share of the labor force that left unemployment instead of the share that remains unemployed.", float(Fr((d + f_) * 100, LF1))), ("Treats the discouraged workers as still unemployed and removes only those who found jobs, using the old labor force.", float(Fr((U - f_) * 100, LF0))),
             ("Removes only the discouraged workers from the unemployed and forgets the job finders.", float(Fr((U - d) * 100, LF1)))]
    kw = f"Initially the labor force is {E:,} + {U:,} = {LF0:,}. Discouraged workers leave the labor force, so it falls to {LF1:,}; unemployment falls to {U} - {d} - {f_} = {U1:,}. The rate is {U1:,}/{LF1:,} = {nm(ratev, 1)}%."
    return num_item("ma_h_unemp_event", "2.3", "3.C", stem, ratev, pairs, f, rng, concept="discouraged workers leave the labor force; job finders move to employment", path="exact fractions vs person-by-person status transitions",
                    st=steps("Find the labor force as employed plus unemployed", "Move the job finders from unemployed to employed and the discouraged workers out of the labor force", "Divide the new number of unemployed by the new labor force"),
                    stim=stim, facts=[f"P={P}", f"E={E}", f"U={U}", f"d={d}", f"f={f_}", f"rate={float(rate):.4f}"], kwhy=kw, est=110)


@retry_sep
def ma_h_cpi_real_wage(rng):
    goods = rng.sample(["Bread", "Gasoline", "Rent", "Milk", "Shirts", "Movie tickets"], 3)
    for _ in forever():
        q = [rng.choice([5, 10, 20, 30]) for _ in goods]; p1 = [rng.choice([2, 4, 5, 10, 20]) for _ in goods]
        p2 = [p + rng.choice([0, 0, 1, 2, 3, 4, 5]) for p in p1]
        c1 = sum(a * b for a, b in zip(q, p1)); c2 = sum(a * b for a, b in zip(q, p2))
        if (c2 * 100) % c1 == 0 and 3 <= (c2 * 100 // c1 - 100) <= 12:
            break
    cpi = c2 * 100 // c1; infl = cpi - 100
    w = rng.choice([2, 4, 5, 6, 8, 10, 14])
    if abs(w - infl) < 2 or w == infl:
        raise ValueError("not_enough_separated_distractors")
    real = w - infl
    # 독립 경로: 두 해의 바구니 비용을 sympy 유리수로 비교해 물가 상승률을 다시 구한다
    agree(float(sp.Rational(c2, c1) * 100 - 100), infl, 1e-9, "infl")
    rows = [[g, a, f"${b}", f"${c}"] for g, a, b, c in zip(goods, q, p1, p2)]
    stim = tbl("A fixed market basket and prices (Year 1 is the base year).", ["Good", "Quantity in basket", "Price in Year 1", "Price in Year 2"], rows)
    stem = f"The table shows a market basket used to compute the consumer price index (CPI) and the prices of its goods. A worker's nominal wage rose by {w} percent from Year 1 to Year 2. Approximately by what percent did the worker's real wage change?"
    f = lambda v: f"{'Increased' if v > 0 else 'Decreased'} by {nm(abs(v), 0)} percent"  # noqa: E731
    pairs = [("Reports the change in the nominal wage and does not adjust for the rise in the price level.", w), ("Adds the inflation rate to the nominal wage growth instead of subtracting it.", w + infl),
             ("Reverses the subtraction, treating the inflation rate minus the wage growth as the change in the real wage.", infl - w), ("Reports only the inflation rate as the change in the real wage.", infl), ("Treats a rise in the nominal wage as a fall in the real wage.", -w)]
    kw = f"The basket costs ${c1} in Year 1 and ${c2} in Year 2, so the CPI in Year 2 is {cpi} and inflation is {infl} percent. The real wage change is about {w} - {infl} = {real} percentage points."
    return num_item("ma_h_cpi_real_wage", "2.4", "2.C", stem, real, pairs, f, rng, concept="compute the CPI and inflation from a basket, then the real wage change", path="exact basket costs vs sympy rational ratio",
                    st=steps("Compute the cost of the basket in each year", "Convert the costs to a CPI and the inflation rate", "Subtract the inflation rate from the nominal wage growth"),
                    stim=stim, facts=[f"c1={c1}", f"c2={c2}", f"infl={infl}", f"w={w}", f"real={real}"], kwhy=kw, est=105)


@retry_sep
def ma_h_exp_real_growth(rng):
    G1 = rng.choice([2000, 2500, 3000]); g = rng.choice([3, 4, 5, 6]); d2 = rng.choice([104, 105, 108, 110])
    real2 = Fr(G1 * (100 + g), 100); n2 = real2 * d2 / 100
    if n2.denominator != 1:
        raise ValueError("not_enough_separated_distractors")
    n2 = int(n2)
    C1 = int(G1 * rng.choice([Fr(65, 100), Fr(6, 10), Fr(7, 10)])); I1 = int(G1 * rng.choice([Fr(15, 100), Fr(2, 10)])); G_1 = int(G1 * Fr(2, 10)); X1 = int(G1 * Fr(15, 100)); M1 = C1 + I1 + G_1 + X1 - G1
    if M1 < 0:
        raise ValueError("not_enough_separated_distractors")
    I2 = I1 + rng.choice([20, 30, 40]); G2 = G_1 + rng.choice([20, 30, 40]); X2 = X1 + rng.choice([10, 20, 30]); M2 = M1 + rng.choice([10, 20, 30]); C2 = n2 - (I2 + G2 + X2 - M2)
    if C2 <= 0:
        raise ValueError("not_enough_separated_distractors")
    nom_g = (Fr(n2, G1) - 1) * 100
    real_g = (Fr(n2 * 100, d2) / G1 - 1) * 100
    # 독립 경로: 두 해의 실질 GDP 를 sympy 로 계산한다
    agree(float(real_g), float((sp.Rational(n2) * 100 / d2) / G1 * 100 - 100), 1e-9, "real_g")
    agree(float(real_g), g, 1e-9, "g")
    stim = tbl("Expenditure components of GDP (billions of dollars).", ["Item", "Year 1", "Year 2"], [["Consumption", f"{C1:,}", f"{C2:,}"], ["Investment", f"{I1:,}", f"{I2:,}"], ["Government purchases", f"{G_1:,}", f"{G2:,}"], ["Exports", f"{X1:,}", f"{X2:,}"], ["Imports", f"{M1:,}", f"{M2:,}"], ["GDP deflator (Year 1 = 100)", "100", d2]])
    stem = "The table shows the expenditure components of GDP and the GDP deflator for an economy. By what percent did real GDP change from Year 1 to Year 2?"
    wr1 = (Fr((C2 + I2 + G2 + X2) * 100, d2) / (C1 + I1 + G_1 + X1) - 1) * 100
    wr2 = (Fr((C2 + I2 + G2 + X2 + M2) * 100, d2) / (C1 + I1 + G_1 + X1 + M1) - 1) * 100
    pairs = [("Reports the growth of nominal GDP and does not remove the price increase.", float(nom_g)), ("Leaves imports out of the calculation, adding C + I + G + X instead of subtracting imports.", float(wr1)),
             ("Adds imports instead of subtracting them when computing GDP.", float(wr2)), ("Adds the inflation implied by the deflator to nominal growth instead of removing it.", float(nom_g) + d2 - 100),
             ("Multiplies Year 2 GDP by the deflator instead of dividing by it.", float((Fr(n2 * d2, 100) / G1 - 1) * 100))]
    f = lambda v: f"{nm(v, 1)} percent"  # noqa: E731
    kw = f"GDP is C + I + G + X - M: ${G1:,} billion in Year 1 and ${n2:,} billion in Year 2. Dividing Year 2 by the deflator ({d2 / 100:.2f}) gives real GDP of ${int(real2):,} billion, an increase of {g} percent."
    return num_item("ma_h_exp_real_growth", "2.6", "2.C", stem, float(g), pairs, f, rng, concept="expenditure approach to nominal GDP, then deflate to find real growth", path="exact fractions vs sympy rationals",
                    st=steps("Compute GDP in each year as C + I + G + X - M", "Deflate Year 2 nominal GDP using the deflator", "Compute the percent change in real GDP between the years"),
                    stim=stim, facts=[f"G1={G1}", f"n2={n2}", f"d2={d2}", f"g={g}"], kwhy=kw, est=115)


CATALOG = [
    ("A household buys a new bicycle from a domestic retailer.", True), ("A bakery buys flour from a mill to make bread that it sells later in the year.", False), ("A household buys a used car from another household.", False),
    ("The government pays unemployment benefits to workers.", False), ("A firm buys a new machine from a domestic manufacturer.", True), ("The government buys new computers for public schools.", True),
    ("A household buys shares of stock on a stock exchange.", False), ("Foreign customers buy software produced in the country.", True), ("A retailer's inventories of unsold domestically produced goods rise.", True),
    ("A household buys a car produced and assembled in Japan.", False),
]
WHY_EXC = {"A bakery buys flour from a mill to make bread that it sells later in the year.": "Flour is an intermediate good; its value is already included in the final price of the bread.", "A household buys a used car from another household.": "A used car was counted in GDP when it was produced; resale is a transfer of ownership.",
           "The government pays unemployment benefits to workers.": "Transfer payments are not payment for current production.", "A household buys shares of stock on a stock exchange.": "Buying financial assets is not spending on newly produced goods and services.", "A household buys a car produced and assembled in Japan.": "A good produced abroad is not part of domestic production; it is subtracted as an import."}


@retry_sep
def ma_h_gdp_classify(rng):
    rows = rng.sample(CATALOG, 8)
    if not (3 <= sum(1 for r in rows if r[1]) <= 5):
        raise ValueError("not_enough_separated_distractors")
    amts = [rng.choice([40, 60, 80, 100, 120, 150, 200, 250, 300]) for _ in rows]
    key = sum(a for (d, c), a in zip(rows, amts) if c)
    # 독립 경로: 제외 항목 총합을 전체에서 뺀다
    tot = sum(amts); exc = sum(a for (d, c), a in zip(rows, amts) if not c)
    agree(key, tot - exc, 1e-9, "gdp")
    excl = [(d, a) for (d, c), a in zip(rows, amts) if not c]
    inc_all = sum(a for _, a in excl)
    stim = tbl("Transactions in an economy during one year (billions of dollars).", ["Transaction", "Amount"], [[d, f"${a}"] for (d, c), a in zip(rows, amts)])
    stem = "The table lists transactions that took place in an economy during one year. What is the contribution of these transactions to the economy's GDP for the year?"
    f = lambda v: f"${int(round(v))} billion"  # noqa: E731
    e0 = excl[0]; e1 = excl[1] if len(excl) > 1 else excl[0]
    pairs = [("Adds every transaction in the table, including intermediate goods, resales, transfers, and financial assets.", tot), (f"Counts the first excluded transaction ({e0[0].rstrip('.').lower()}) even though it is not spending on newly produced domestic output.", key + e0[1]),
             (f"Counts the second excluded transaction ({e1[0].rstrip('.').lower()}) even though it is not spending on newly produced domestic output.", key + e1[1]), ("Reports only the largest single final-good transaction.", max(a for (d, c), a in zip(rows, amts) if c)),
             ("Counts the excluded transactions and leaves out the final purchases.", exc), ("Counts every transaction except the single largest excluded one.", tot - max(a for _, a in excl))]
    kw = "GDP counts only final purchases of newly produced domestic goods and services. " + " ".join(f"Excluded: {WHY_EXC[d]}" for d, a in excl[:2]) + f" The counted transactions sum to ${key} billion."
    return num_item("ma_h_gdp_classify", "2.1", "1.C", stem, float(key), pairs, f, rng, concept="what GDP counts: final goods, investment, government purchases, exports; not intermediate goods, resales, transfers, or financial assets", path="sum of counted items vs total minus excluded items",
                    st=steps("Decide for each transaction whether it is a final purchase of newly produced domestic output", "Set aside intermediate goods, resales, transfers, financial assets, and foreign-produced goods", "Add the amounts that are counted in GDP"),
                    stim=stim, facts=[f"key={key}", f"tot={tot}"], kwhy=kw, est=110)


@retry_sep
def ma_h_unexpected_inflation(rng):
    n = rng.choice([5, 6, 7, 8]); pe = rng.choice([2, 3]); pa = rng.choice([pe + 3, pe + 4, max(0, pe - 2)])
    if pa == pe:
        raise ValueError("not_enough_separated_distractors")
    re_, ra = n - pe, n - pa
    L = 50000
    # 독립 경로: 상환액의 구매력을 예상·실제 물가 상승으로 환산해 누가 이득인지 비교한다
    exp_pp = Fr(L * (100 + n), 100) / Fr(100 + pe, 100); act_pp = Fr(L * (100 + n), 100) / Fr(100 + pa, 100)
    borrower_gains = act_pp < exp_pp
    agree(1, 1 if borrower_gains == (pa > pe) else 0, 1e-9, "who")
    good, bad = ("borrower", "lender") if pa > pe else ("lender", "borrower")
    stem = (f"A bank lends $50,000 to a business at a nominal interest rate of {n} percent. When the loan is made, both parties expect inflation of {pe} percent over the year. Inflation over the year turns out to be {pa} percent. "
            "Which of the following correctly states who gains relative to what was expected and the actual real interest rate on the loan?")
    t = lambda who, r: f"The {who} gains, because the actual real interest rate is {r} percent."  # noqa: E731
    k_, ds = sent_opts(t(good, ra), f"The actual real interest rate is {n} - {pa} = {ra} percent, compared with the expected {n} - {pe} = {re_} percent. Inflation was {'higher' if pa > pe else 'lower'} than expected, so the {good} {'repays dollars worth less' if pa > pe else 'receives dollars worth more'} than expected and gains.",
                       [(t(bad, ra), f"Uses the correct real interest rate but names the wrong party; when inflation is {'higher' if pa > pe else 'lower'} than expected the {good} gains."), (t(good, re_), "Reports the expected real interest rate instead of the actual real interest rate."),
                        (t(bad, re_), "Uses the expected real interest rate and also names the wrong party who gains from the inflation surprise."), (t(good, n + pa), "Adds actual inflation to the nominal rate instead of subtracting it to find the real rate."),
                        (t(bad, n + pa), "Adds inflation to the nominal rate and names the wrong party who gains from the surprise.")])
    return mk("ma_h_unexpected_inflation", "2.5", "2.C", stem, k_, ds, rng, concept="unexpected inflation redistributes between borrowers and lenders through the actual real interest rate", path="Fisher approximation vs purchasing-power comparison of the repayment (exact fractions)",
              thinking=steps("Compute the expected real interest rate from the nominal rate and expected inflation", "Compute the actual real interest rate from actual inflation", "Compare actual with expected to decide whether the borrower or the lender gains"),
              facts=[f"n={n}", f"pe={pe}", f"pa={pa}", f"ra={ra}", f"good={good}"], est=100, judgment="compare the actual outcome with the expected outcome and name the party affected")


# ======================= 단원 3 =======================
@retry_sep
def ma_h_gap_tax(rng):
    sc = adas_scene(rng, "rec")
    sc_check(sc)
    gap = sc["Yf"] - sc["Y0"]
    mpc = rng.choice([Fr(1, 2), Fr(3, 4), Fr(4, 5)])
    tm = mpc / (1 - mpc)
    need = Fr(gap) / tm
    if need.denominator != 1:
        raise ValueError("not_enough_separated_distractors")
    need = int(need)
    # 독립 경로: 세금 감소의 전체 효과(=감세 x 세금 승수)가 gap 이 되는 감세 크기를 sympy 로 푼다
    t_ = sp.symbols("t")
    sol = sp.solve(sp.Eq(t_ * sp.Rational(mpc.numerator, mpc.denominator) / (1 - sp.Rational(mpc.numerator, mpc.denominator)), gap), t_)[0]
    agree(need, float(sol), 1e-9, "need")
    cur, xhi, yhi = adas_curves(sc)
    stim = econ_graph("Aggregate demand, short-run aggregate supply, and long-run aggregate supply; the economy is in short-run equilibrium at point E.", cur, xhi, yhi, 20, 20, points=[("E", sc["Y0"], sc["P0"])], **AXES)
    stem = (f"The graph shows an economy in short-run equilibrium at point E. The marginal propensity to consume is {nm(float(mpc), 2)}. Assume the price level does not change as the government acts. "
            "By how much would the government need to cut lump-sum taxes to move real GDP to its long-run level?")
    f = lambda v: f"${nm(v, 0)} billion"  # noqa: E731
    sm = 1 / (1 - mpc)
    pairs = [("Sets the tax cut equal to the size of the gap and ignores the tax multiplier.", gap), ("Divides the gap by the spending multiplier 1/(1 - MPC) instead of the tax multiplier.", float(Fr(gap) * (1 - mpc))),
             ("Multiplies the gap by the tax multiplier instead of dividing by it.", float(Fr(gap) * tm)), ("Divides the gap by the MPC.", float(Fr(gap) / mpc)), ("Applies the spending multiplier 1/(1 - MPC) to the gap, which is the wrong direction and the wrong multiplier.", float(Fr(gap) * sm))]
    kw = f"The graph shows real GDP of {sc['Y0']} at E and potential real GDP of {sc['Yf']} (LRAS), a recessionary gap of ${gap} billion. The tax multiplier is {nm(float(mpc), 2)}/{nm(float(1 - mpc), 2)} = {nm(float(tm), 2)}, so the tax cut is {gap}/{nm(float(tm), 2)} = ${need} billion."
    return num_item("ma_h_gap_tax", "3.8", "3.C", stem, float(need), pairs, f, rng, concept="read the recessionary gap from AD-AS and size a tax cut with the tax multiplier", path="exact fraction gap/tax multiplier vs sympy solution of tax effect = gap",
                    st=steps("Read real GDP at E and potential real GDP from the graph to find the gap", "Compute the tax multiplier from the MPC", "Divide the gap by the tax multiplier to find the tax cut"),
                    stim=stim, facts=[f"Y0={sc['Y0']}", f"Yf={sc['Yf']}", f"mpc={float(mpc):.4f}", f"need={need}"], kwhy=kw, est=115)


@retry_sep
def ma_h_shock_fiscal_vs_self(rng):
    up = rng.choice([True, False])  # True: AD 감소 충격(경기 침체), False: AD 증가 충격(과열)
    sc = adas_scene(rng, "none")
    sc_check(sc)
    s = rng.choice([8, 12, 16, 20]) * (1 if up else -1)  # AD 절편 변화량(감소 충격이면 양수 = 왼쪽 이동)
    A, B, C, D, Yf, P0 = sc["A"], sc["B"], sc["C"], sc["D"], sc["Yf"], sc["P0"]
    # 충격 후 AD: P = A - s'*... 충격 크기 s(절편)
    shock = -abs(s) if up else abs(s)
    A1 = A + shock
    # 자연 조정: SRAS 가 움직여 AD1 과 LRAS 의 교점에서 균형 -> 물가 P_self
    P_self = A1 - B * Yf
    P_pol = P0  # 정책이 AD 를 원래대로 돌리면 물가는 원래 수준
    # 독립 경로: sympy 로 연립(AD1 과 Y=Yf)
    Pp = sp.symbols("Pp")
    agree(float(P_self), float(sp.solve(sp.Eq(Pp, sp.Rational(A1.numerator, A1.denominator) - sp.Rational(B.numerator, B.denominator) * Yf), Pp)[0]), 1e-9, "P_self")
    rel = 1 if P_pol > P_self else -1  # 정책 경로의 물가가 자연 조정 경로보다 높은가
    agree(rel, 1 if up else -1, 1e-9, "dir")
    if up:
        stem = ("An economy is in long-run equilibrium when a sharp decline in consumer confidence shifts aggregate demand to the left, creating a recessionary gap. "
                "In Case 1, the government increases its purchases enough to return aggregate demand to its original position. In Case 2, the government takes no action, and wages and prices adjust until the economy returns to potential output. "
                "Which of the following compares the long-run outcome of Case 1 with the long-run outcome of Case 2?")
    else:
        stem = ("An economy is in long-run equilibrium when a surge in investment spending shifts aggregate demand to the right, creating an inflationary gap. "
                "In Case 1, the government raises taxes enough to return aggregate demand to its original position. In Case 2, the government takes no action, and wages and prices adjust until the economy returns to potential output. "
                "Which of the following compares the long-run outcome of Case 1 with the long-run outcome of Case 2?")
    w = {1: "higher", -1: "lower", 0: "the same as"}

    def txt(yd, pd):
        yw = "the same" if yd == 0 else w[yd]; pw = "the same" if pd == 0 else w[pd]
        return f"Real GDP is {yw}, and the price level is {pw}."
    ykey = f"In the long run both cases return to potential output, so real GDP is the same. In Case 1 the price level returns to its original level; in Case 2 the price level ends {'below' if up else 'above'} the original level because {'wages fall and SRAS shifts right' if up else 'wages rise and SRAS shifts left'}."
    wrongs = [(txt(rel, rel), "Assumes the policy leaves real GDP different in the long run; in the long run output is at potential in both cases."), (txt(0, 0), "Overlooks that self-adjustment works through the price level: in Case 2 the price level ends away from its original level."),
              (txt(0, -rel), "Gets the price-level comparison backward; the policy case returns to the original price level."), (txt(rel, 0), "Claims the policy case has different real GDP and the same price level, confusing short-run and long-run effects."),
              (txt(-rel, rel), "Claims real GDP differs in the long run, but both cases end at potential output.")]
    return sent_item("ma_h_shock_fiscal_vs_self", "3.7", "2.B", stem, txt(0, rel), ykey, wrongs, rng, concept="stabilization policy versus long-run self-adjustment after a demand shock", path="exact AD-AS solution for both cases vs sympy simultaneous equations; price-level order from the linear model",
                     st=steps("Find the short-run effect of the demand shock and the size of the gap", "Find the long-run outcome when fiscal policy restores aggregate demand", "Find the long-run outcome when wages and prices adjust and SRAS shifts", "Compare real GDP and the price level across the two cases"),
                     facts=[f"up={up}", f"P0={P0}", f"P_self={float(P_self):.3f}", f"rel={rel}"], est=125, judgment="trace both cases to the long run and compare the results")


@retry_sep
def ma_h_mpc_table_gap(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5)]); a = rng.choice([100, 150, 200]); dis = [1000, 1200, 1400]
    cons = [a + mpc * d for d in dis]
    gap = rng.choice([100, 150, 200, 250, 300, 400])
    need = Fr(gap) * (1 - mpc)
    if need.denominator != 1 or any(c.denominator != 1 for c in cons):
        raise ValueError("not_enough_separated_distractors")
    est_mpc = (cons[2] - cons[0]) / (dis[2] - dis[0])
    agree(float(est_mpc), float(mpc), 1e-9, "mpc")
    apc = cons[1] / dis[1]
    yf = rng.choice([2000, 2500, 3000]); y = yf - gap
    stim = tbl("Disposable income and consumption spending in an economy (billions of dollars).", ["Disposable income", "Consumption"], [[f"${d:,}", f"${int(c):,}"] for d, c in zip(dis, cons)])
    stem = (f"The table shows disposable income and consumption spending. Real GDP is ${y:,} billion and potential real GDP is ${yf:,} billion. Assume the price level is constant and taxes do not change. "
            "By how much should government purchases increase to eliminate the gap?")
    f = lambda v: f"${int(round(v)):,} billion"  # noqa: E731
    pairs = [("Sets the increase in purchases equal to the gap and ignores the multiplier.", gap), ("Multiplies the gap by the spending multiplier instead of dividing by it.", float(Fr(gap) / (1 - mpc))), ("Divides the gap by the MPC instead of by the spending multiplier.", float(Fr(gap) / mpc)),
             ("Uses the average propensity to consume at the middle income level in place of the MPC.", float(Fr(gap) * (1 - apc))), ("Uses the MPC as the multiplier and multiplies the gap by it.", float(Fr(gap) * mpc))]
    kw = f"MPC = change in consumption / change in disposable income = {int(cons[2] - cons[0])}/{dis[2] - dis[0]} = {nm(float(mpc), 2)}. The spending multiplier is 1/(1 - {nm(float(mpc), 2)}) = {nm(float(1 / (1 - mpc)), 2)}, so purchases must rise by {gap}/{nm(float(1 / (1 - mpc)), 2)} = ${int(need)} billion."
    return num_item("ma_h_mpc_table_gap", "3.2", "3.C", stem, float(need), pairs, f, rng, concept="derive the MPC from data, then size the spending change needed to close a gap", path="exact fractions vs sympy rationals (MPC from two rows, from three rows)",
                    st=steps("Compute the MPC from the change in consumption and the change in disposable income", "Compute the spending multiplier", "Find the gap and divide it by the multiplier"),
                    stim=stim, facts=[f"mpc={float(mpc):.4f}", f"gap={gap}", f"need={float(need):.4f}", f"apc={float(apc):.4f}"], kwhy=kw, est=110)


@retry_sep
def ma_h_two_policy_net(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 4), Fr(4, 5)]); g = rng.choice([20, 40, 60, 80, 100]); t = rng.choice([20, 40, 60, 80])
    if t >= g * 2 or t == g:
        raise ValueError("not_enough_separated_distractors")
    dy = (Fr(g) - mpc * t) / (1 - mpc)
    if dy.denominator != 1 or dy <= 0:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 승수 라운드를 직접 합산(소비 지출 반복)
    total = Fr(0); inj = Fr(g) - mpc * t  # 첫 라운드의 순 지출 변화 = G - MPC*T
    cur = inj
    for _ in range(400):
        total += cur; cur *= mpc
    agree(float(dy), float(total), 1e-6, "rounds")
    stem = (f"The marginal propensity to consume is {nm(float(mpc), 2)}. The government increases its purchases by ${g} billion and, at the same time, raises lump-sum taxes by ${t} billion. Assuming the price level is constant, what is the maximum change in real GDP?")
    f = lambda v: f"{'+' if v > 0 else '-' if v < 0 else ''}${abs(int(round(v))):,} billion"  # noqa: E731
    sm = 1 / (1 - mpc); tm = mpc / (1 - mpc)
    pairs = [("Applies the spending multiplier to both the purchases and the tax change, so the tax increase is overstated.", float(Fr(g - t) * sm)), ("Applies the multiplier to the purchases only and ignores the tax increase.", float(g * sm)),
             ("Subtracts the tax change from the purchases without using any multiplier.", g - t), ("Adds the tax multiplier effect to the spending effect instead of subtracting it.", float(g * sm + t * tm)), ("Applies the tax multiplier to both changes.", float(Fr(g - t) * tm))]
    kw = f"The spending effect is {g} x {nm(float(sm), 2)} = {nm(float(g * sm), 1)}. The tax effect is -{t} x {nm(float(tm), 2)} = -{nm(float(t * tm), 1)}. The net change in real GDP is {int(dy)}."
    return num_item("ma_h_two_policy_net", "3.2", "3.C", stem, float(dy), pairs, f, rng, concept="combine the government-spending multiplier and the tax multiplier", path="exact multipliers vs round-by-round summation of induced spending",
                    st=steps("Compute the spending multiplier and the tax multiplier from the MPC", "Find the effect of the increase in purchases", "Find the effect of the tax increase and subtract it"),
                    facts=[f"mpc={float(mpc):.4f}", f"g={g}", f"t={t}", f"dy={float(dy):.4f}"], kwhy=kw, est=110)


@retry_sep
def ma_h_adas_table_shift(rng):
    sd = rng.choice([10, 20, 30]); ss = rng.choice([10, 20, 30]); i0 = rng.choice([1, 2]); k = 1
    yd100 = rng.choice([500, 600, 700]); ys100 = yd100 - (sd + ss) * i0 + 0  # 초기 균형이 행 i0 에서 이루어지게
    rows_i = list(range(0, 5))
    yd = [yd100 - sd * i for i in rows_i]; ys = [ys100 + ss * i for i in rows_i]
    if yd[i0] != ys[i0]:
        raise ValueError("not_enough_separated_distractors")
    x = (sd + ss) * k
    i1 = i0 + k
    Y1 = ys[i1] if i1 < 5 else None
    if Y1 is None:
        raise ValueError("not_enough_separated_distractors")
    delta = rng.choice([-2, -1, 1, 2]) * (ss // 2 if ss >= 20 else 5)
    Yf = Y1 + delta
    gapv = Y1 - Yf  # 양수 = 인플레이션 갭
    # 독립 경로: 이동한 AD 열을 만들어 각 행의 초과 수요를 훑는다
    ad2 = [v + x for v in yd]
    hit = [i for i in rows_i if ad2[i] == ys[i]]
    agree(len(hit), 1, 1e-9, "eq"); agree(hit[0], i1, 1e-9, "i1")
    P = [100 + 10 * i for i in rows_i]
    stim = tbl("Real GDP demanded and supplied at five price levels (billions of dollars).", ["Price level", "Real GDP demanded", "Real GDP supplied in the short run"], [[P[i], yd[i], ys[i]] for i in rows_i])
    stem = (f"The table shows aggregate demand and short-run aggregate supply for an economy. Potential real GDP is ${Yf} billion. Aggregate demand then increases by ${x} billion at every price level. "
            "Which of the following describes the new short-run equilibrium?")
    f = lambda v: ("An inflationary gap of $" + str(int(abs(v))) + " billion") if v > 0 else ("A recessionary gap of $" + str(int(abs(v))) + " billion") if v < 0 else "No output gap"  # noqa: E731
    old_gap = ys[i0] - Yf
    pairs = [("Compares the old equilibrium output with potential output, ignoring the increase in aggregate demand.", old_gap), ("Reports the increase in aggregate demand as the size of the gap.", x), ("Names the gap with the wrong sign because it compares potential output with actual output in the wrong direction.", -gapv),
             ("Reads the real GDP demanded at the new price level from the old demand column and compares it with potential output.", yd[i1] - Yf), ("Compares the real GDP supplied at the old price level with potential output after the shift.", ys[i0] + x - Yf)]
    kw = f"After the increase, demand is {yd[i1] + x} at price level {P[i1]}, equal to supply of {ys[i1]}, so the new equilibrium output is {Y1}. Potential output is {Yf}, so there is {'an inflationary' if gapv > 0 else 'a recessionary'} gap of {abs(gapv)}."
    return num_item("ma_h_adas_table_shift", "3.6", "3.C", stem, float(gapv), pairs, f, rng, concept="find the new short-run equilibrium after an AD shift from schedules, then compare with potential output", path="schedule scan for the shifted equilibrium vs closed-form row arithmetic",
                    st=steps("Add the increase in aggregate demand to the real GDP demanded at every price level", "Find the price level where real GDP demanded equals real GDP supplied", "Compare equilibrium output with potential output to find the type and size of the gap"),
                    stim=stim, facts=[f"sd={sd}", f"ss={ss}", f"Yf={Yf}", f"Y1={Y1}", f"gap={gapv}"], kwhy=kw, est=115)


@retry_sep
def ma_h_ulc_adas(rng):
    w = rng.choice([2, 3, 4, 6]); q = rng.choice([1, 2, 3, 5, 6])
    if w == q:
        raise ValueError("not_enough_separated_distractors")
    ulc = (Fr(100 + w, 100) / Fr(100 + q, 100) - 1)  # 단위 노동비용 변화율
    ss = -1 if ulc > 0 else 1  # 비용 상승 -> SRAS 왼쪽
    # 독립 경로: 규칙표(adas_dirs)와 별개로 수치 예: 단위 노동비용 곡선 이동을 직접 시뮬레이션
    d = adas_dirs(1, ss)
    sim = eq_effect_sim(1, ss)
    agree(1, 1 if (d["P"], d["Y"]) == sim else 0, 1e-9, "sim")
    stem = (f"In an economy, nominal wages rise by {w} percent and labor productivity rises by {q} percent. At the same time, an increase in consumer confidence shifts aggregate demand to the right. "
            "Other determinants of aggregate supply do not change. Which of the following correctly describes the short-run effects on the price level and real GDP?")
    mech = {"P": ("Higher costs per unit shift SRAS left and rising demand shifts AD right, so both push the price level up." if ss == -1 else "Falling costs per unit shift SRAS right while AD shifts right; the price level effect depends on the relative sizes, so it is indeterminate."),
            "Y": ("SRAS shifts left (lower output) and AD shifts right (higher output), so the effect on real GDP is indeterminate without sizes." if ss == -1 else "Both SRAS and AD shift right, so real GDP increases.")}
    k_, ds = combo_item(rng, ["P", "Y"], {"P": d["P"], "Y": d["Y"]}, mech, dirs=(1, -1, None))
    return mk("ma_h_ulc_adas", "3.3", "2.B", stem, k_, ds, rng, concept="labor cost per unit of output (wages relative to productivity) shifts SRAS; combined with an AD shift", path="rule table (adas_dirs) vs numeric three-region simulation of the linear AD-AS model; unit-cost ratio from exact fractions",
              thinking=steps("Compare wage growth with productivity growth to find the change in labor cost per unit of output", "Decide the direction of the SRAS shift", "Combine the SRAS shift with the AD shift", "Decide which of the price level and real GDP effects are determinate"),
              facts=[f"w={w}", f"q={q}", f"ss={ss}", f"d={d}"], est=110, judgment="combine two curve shifts and decide which effects are determinate")
