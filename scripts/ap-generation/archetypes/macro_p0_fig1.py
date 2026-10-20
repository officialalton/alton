"""AP Macroeconomics MA3 그림·표 보강(2026-10-19, 한계 보완 A1) — 신규 그림 원형 16개. 공개 세트 MA1·MA2 의 원형과 풀이 틀·자료 형태가 다르다.
공개 세트의 그림은 모두 모형 그래프(AD-AS·화폐시장·대부자금·외환·필립스 읽기)와 계산 표다. 여기서는 시계열 선 그래프(경기·물가지수·실업률·이자율·환율·수출입), AD 이동폭 읽기, 가격통제 그래프의 수량 읽기,
필립스 곡선 이동(기대 인플레이션), 교차가격·채권가격·예금창출·누진 세수·성장 원천 표를 쓴다. 모든 정답은 정확 분수 경로와 독립 수치 경로(numpy·sympy)가 일치할 때만 쓴다.
필요한 값은 모두 학생 화면의 본문·표·그래프(눈금·표식)에 있다. 설명에만 있는 값은 없다."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401

# 런 FIG-A: 16 원형 후보 3씩. MA3 의 그림 없는 칸을 (단원, 스킬) 이 같은 그림 문항으로 바꾼다.
STAGE_FIG_A = [
    "ma_g_cross_price_table", "ma_g_price_control_graph", "ma_g_gdp_peak_trough", "ma_g_price_index_line", "ma_g_cyclical_unemp_graph", "ma_g_ad_multiplier_graph",
    "ma_g_stabilizer_table", "ma_g_ad_move_along_graph", "ma_g_real_rate_lines", "ma_g_deposit_rounds_table", "ma_g_bond_price_table", "ma_g_phillips_shift_graph",
    "ma_g_debt_balance_table", "ma_g_growth_sources_table", "ma_g_fx_line_graph", "ma_g_exports_imports_lines",
]


def ts_stim(desc, series, xhi, ylo, yhi, ystep, xlabel, ylabel, points=None, dashed_y=None):
    """시계열 선 그래프(x 는 0..xhi, y 는 ylo..yhi). series = [(라벨, [(x,y),...])]."""
    stim = econ_graph(desc, series, xhi, yhi, 1, ystep, points=points, dashed_y=dashed_y, xlabel=xlabel, ylabel=ylabel)
    stim["data"]["y_axis"]["min"] = ylo
    return stim


def _desc_bal(b):
    return "a balanced budget" if b == 0 else (f"a surplus of ${abs(int(b))} billion" if b > 0 else f"a deficit of ${abs(int(b))} billion")


# ======================= 단원 1 =======================
CROSS = [("tea", "coffee", "sub"), ("butter", "margarine", "sub"), ("bus tickets", "ride-share trips", "sub"), ("streaming subscriptions", "movie theater tickets", "sub"),
         ("printers", "ink cartridges", "comp"), ("hot dogs", "hot dog buns", "comp"), ("tennis rackets", "tennis balls", "comp"), ("gasoline", "large pickup trucks", "comp"), ("cameras", "memory cards", "comp")]


@retry_sep
def ma_g_cross_price_table(rng):
    a, b, rel = CROSS[rng.randrange(len(CROSS))]
    p0 = rng.choice([2, 4, 5, 10]); step = rng.choice([1, 2, 5]) if p0 >= 5 else 1
    prices = [p0, p0 + step, p0 + 2 * step]
    q0 = rng.choice([60, 80, 100, 120]); dq = rng.choice([10, 15, 20]) * (1 if rel == "sub" else -1)
    qs = [q0, q0 + dq, q0 + 2 * dq]
    slope_np = float(np.polyfit(prices, qs, 1)[0]); slope_ex = Fr(qs[2] - qs[0], prices[2] - prices[0])
    agree(1 if slope_np > 0 else -1, 1 if slope_ex > 0 else -1, 1e-9, "sign")
    sub = slope_ex > 0
    agree(1 if sub else 0, 1 if rel == "sub" else 0, 1e-9, "rel")
    stim = tbl(f"Quantity of {b} demanded at three prices of {a}.", [f"Price of {a} (dollars per unit)", f"Quantity of {b} demanded (units per week)"], [[usd(p), str(q)] for p, q in zip(prices, qs)])
    stem = f"The table shows the quantity of {b} that consumers demand at three different prices of {a}. Income, tastes, and the price of {b} are the same in every row. Which statement is correct?"
    other = "complements" if sub else "substitutes"
    k, ds = sent_opts(f"{cap1(a)} and {b} are {'substitutes' if sub else 'complements'}, because a higher price of {a} {'increases' if sub else 'decreases'} the demand for {b}.",
                      f"When the price of {a} rises, the quantity of {b} demanded at the unchanged price of {b} {'rises' if sub else 'falls'}, which identifies {'substitutes' if sub else 'complements'}.",
                      [(f"{cap1(a)} and {b} are {other}, because a higher price of {a} {'increases' if sub else 'decreases'} the demand for {b}.", f"The direction in the table identifies {'substitutes' if sub else 'complements'}; the other label would need the opposite direction."),
                       (f"The table shows a movement along the demand curve for {b}, because the price of {a} changed.", f"A change in the price of a related good shifts the whole demand curve for {b}; it is not a movement along it."),
                       (f"{cap1(b)} is an inferior good, because the quantity demanded changes when the price of {a} changes.", "An inferior good is defined by its response to income, not by a response to another good's price."),
                       (f"{cap1(a)} and {b} are unrelated, because the price of {b} is the same in every row.", f"Demand for {b} changes even though its own price is fixed, so the price of {a} matters for demand.")])
    return mk("ma_g_cross_price_table", "1.4", "1.B", stem, k, ds, rng, concept="classify related goods from a table of quantity demanded at different prices of the other good", path="sign of the least-squares slope (numpy) vs exact fraction slope between end rows", stim=stim,
              facts=[f"a={a}", f"b={b}", f"rel={rel}", f"p0={p0}", f"step={step}", f"q0={q0}", f"dq={dq}"], est=60, judgment="read the direction of the change in demand in a table and name the relationship")


@retry_sep
def ma_g_price_control_graph(rng):
    kind = rng.choice(["floor", "ceiling"])
    Q0 = rng.choice([40, 50, 60]); P0 = rng.choice([40, 50, 60]); B = rng.choice([1, 2]); D = rng.choice([1, 2]); delta = 20
    good, unit = rng.choice([("wheat", "bushels"), ("rice", "tons"), ("milk", "gallons"), ("apartments", "units")])
    m = Mkt(Q0, P0, Fr(B), Fr(D))
    Pc = P0 + delta if kind == "floor" else P0 - delta
    qd = m.qd(Pc); qs = m.qs(Pc)
    Q_, P_ = sp.symbols("Q P")
    qd2 = sp.solve(sp.Eq(Pc, (m.A) - m.B * Q_), Q_)[0]; qs2 = sp.solve(sp.Eq(Pc, (m.C) + m.D * Q_), Q_)[0]
    agree(float(qd), float(qd2), 1e-9, "qd"); agree(float(qs), float(qs2), 1e-9, "qs")
    qd, qs = int(qd), int(qs)
    gap = abs(qs - qd)
    word, notword = ("surplus", "shortage") if kind == "floor" else ("shortage", "surplus")
    xhi = 100; yhi = 100
    dem = line_pts(m.A, -float(m.B), 0, xhi); sup = line_pts(m.C, float(m.D), 0, xhi)
    stim = econ_graph(f"Demand D and supply S for {good}, with a price {kind} and points A and B at that price.", [("D", dem), ("S", sup)], xhi, yhi, 10, 10, points=[("A", qd, Pc), ("B", qs, Pc)], dashed_y=[Pc],
                      xlabel=f"Quantity ({unit} per day)", ylabel=f"Price (dollars per {unit[:-1] if unit.endswith('s') else unit})")
    pname = "price floor (a legal minimum price)" if kind == "floor" else "price ceiling (a legal maximum price)"
    stem = f"The graph shows the market for {good}. The government sets a {pname} of ${Pc}, shown by the dashed horizontal line. Point A shows the quantity demanded and point B shows the quantity supplied at that price. Which statement correctly describes the result?"
    traded = min(qd, qs)
    k, ds = sent_opts(f"A {word} of {gap} {unit} occurs, because the quantity supplied is {qs} {unit} and the quantity demanded is {qd} {unit}.",
                      f"At the controlled price the quantity supplied is {qs} and the quantity demanded is {qd}, so the {word} is |{qs} - {qd}| = {gap} {unit}.",
                      [(f"A {notword} of {gap} {unit} occurs, because the quantity supplied is {qs} {unit} and the quantity demanded is {qd} {unit}.", f"With {qs} supplied and {qd} demanded, the {word}, not the {notword}, results."),
                       (f"A {word} of {qs if kind == 'floor' else qd} {unit} occurs, because sellers offer {qs} {unit} at that price." if kind == "floor" else f"A {word} of {qd} {unit} occurs, because buyers demand {qd} {unit} at that price.",
                        "The size of the gap is the difference between the two quantities, not the quantity on one side of the market."),
                       (f"A {word} of {abs(qs - Q0) if kind == 'floor' else abs(qd - Q0)} {unit} occurs, because the quantity changes from the equilibrium quantity of {Q0} {unit}.", "The gap is measured between the quantities supplied and demanded at the controlled price, not from the equilibrium quantity."),
                       (f"The quantity traded rises to {qs if kind == 'floor' else qd} {unit}, because {'producers supply more' if kind == 'floor' else 'consumers demand more'} at that price.", f"The quantity actually traded is the smaller of the two quantities, {traded} {unit}, so it falls below the equilibrium quantity.")])
    return mk("ma_g_price_control_graph", "1.6", "1.D", stem, k, ds, rng, concept="read the surplus or shortage created by a binding price control from a supply and demand graph", path="exact fractions on the plotted lines vs sympy solution at the controlled price", stim=stim,
              facts=[f"kind={kind}", f"Q0={Q0}", f"P0={P0}", f"B={B}", f"D={D}", f"good={good}"], est=70, judgment="compare the quantities supplied and demanded at the controlled price on the graph")


# ======================= 단원 2 =======================
@retry_sep
def ma_g_gdp_peak_trough(rng):
    for _ in forever():
        Vp = rng.choice([2000, 3000, 4000, 2500]); r = rng.choice([Fr(1, 20), Fr(1, 10), Fr(3, 20), Fr(1, 5)])
        drop = Vp * r
        if drop.denominator != 1 or int(drop) % 100 != 0 or int(drop) == 0:
            continue
        break
    drop = int(drop); Vt = Vp - drop
    pk = rng.choice([3, 4]); tr = pk + rng.choice([2, 3])
    ys = []
    for i in range(1, 9):
        if i < pk:
            ys.append(Vp - 100 * (pk - i) - rng.choice([0, 50]))
        elif i == pk:
            ys.append(Vp)
        elif i < tr:
            f = (i - pk) / (tr - pk)
            ys.append(int(round((Vp - drop * f) / 50.0)) * 50 + 50)
        elif i == tr:
            ys.append(Vt)
        else:
            ys.append(Vt + 100 * (i - tr) - rng.choice([0, 50]) + (50 if i == tr + 1 else 0))
    ys = [min(max(y, Vt + 50), Vp - 50) if i + 1 not in (pk, tr) else y for i, y in enumerate(ys)]
    if ys.index(max(ys)) + 1 != pk or ys.index(min(ys)) + 1 != tr or ys.count(Vp) != 1 or ys.count(Vt) != 1:
        raise ValueError("not_enough_separated_distractors")
    key_v = float(Fr(drop, Vp) * 100)
    agree(key_v, (max(ys) - min(ys)) / max(ys) * 100, 1e-9, "pct")
    ylo = (Vt // 100) * 100 - 200; yhi = Vp + 200
    pts = list(zip(range(1, 9), ys))
    stim = ts_stim("Real GDP of an economy over eight years, with the peak P and the trough T marked.", [("Real GDP", pts)], 8, ylo, yhi, 100, "Time (year)", "Real GDP (billions of dollars)", points=[("P", pk, Vp), ("T", tr, Vt)])
    stem = "The graph shows an economy's real GDP over eight years. Point P is the business cycle peak and point T is the trough. By what percent did real GDP fall from the peak to the trough?"
    first = ys[0]
    pairs = [("Divides the decline by the trough level instead of the peak level.", drop / Vt * 100), ("Reports the dollar decline in billions as if it were a percent.", float(drop)), ("Reports the trough as a percent of the peak.", Vt / Vp * 100),
             ("Measures the decline from the first year's level rather than from the peak.", (first - Vt) / first * 100), ("Divides the decline by the number of years between P and T.", drop / (tr - pk) / Vp * 100)]
    k, ds = val_opts(key_v, pairs, lambda v: f"{nm(v, 1)}%")
    kw = f"The peak is ${nm(Vp)} billion and the trough is ${nm(Vt)} billion, so the decline is {nm(drop)} / {nm(Vp)} = {nm(key_v, 1)} percent of the peak."
    return mk("ma_g_gdp_peak_trough", "2.7", "2.C", stem, k, ds, rng, concept="percent decline in real GDP from peak to trough read from a time-series graph", path="exact fraction of the labeled values vs numpy max/min of the plotted series", stim=stim, kwhy=kw,
              facts=[f"Vp={Vp}", f"drop={drop}", f"pk={pk}", f"tr={tr}", f"ys={ys}"], est=75)


@retry_sep
def ma_g_price_index_line(rng):
    typ = rng.choice(["disinf", "accel", "defl"]); base = rng.choice([125, 200, 250])
    incs = {"disinf": [rng.choice([8, 10]), 6, 4, 2], "accel": [2, 4, 6, rng.choice([8, 10])], "defl": [rng.choice([6, 8]), 4, -4, -6]}[typ]
    idx = [base]
    for d in incs:
        idx.append(idx[-1] + d)
    rates = [Fr(incs[i], idx[i]) * 100 for i in range(4)]
    npr = [(idx[i + 1] - idx[i]) / idx[i] * 100 for i in range(4)]
    for r_, n_ in zip(rates, npr):
        agree(float(r_), n_, 1e-9, "rate")
    r1 = nm(float(rates[0]), 1); inc1 = incs[0]
    if abs(float(rates[0]) - inc1) < 0.3:
        raise ValueError("not_enough_separated_distractors")
    ylo = (min(idx) - 5) // 5 * 5; yhi = (max(idx) + 4) // 5 * 5 + 5
    pts = list(zip(range(1, 6), idx))
    stim = ts_stim("A price index over five years.", [("Price index", pts)], 5, ylo, yhi, 5, "Time (year)", "Price index (units)")
    stem = "The graph shows a price index for an economy over five years. Which statement is consistent with the graph?"
    if typ == "disinf":
        k, ds = sent_opts(f"Inflation was {r1}% from Year 1 to Year 2 and was lower in each later year, although the price level kept rising.", "The index rises every year, so there is inflation each year, and each yearly rise is a smaller percent of the index than the one before.",
                          [("The price level fell after Year 2, because the inflation rate fell each year.", "A falling inflation rate is disinflation; the price level still rises while inflation is positive."),
                           ("The inflation rate rose each year, because the price index rose every year.", "A rising price level does not mean a rising inflation rate; the yearly increases get smaller relative to the index."),
                           (f"Inflation was {inc1}% from Year 1 to Year 2, because the index rose by {inc1} points.", f"A rise of {inc1} points on a base of {base} is {r1} percent, not {inc1} percent."),
                           ("The economy experienced deflation in Year 5, because inflation was lowest in that year.", "The lowest inflation rate is still positive here, so it is not deflation.")])
    elif typ == "accel":
        k, ds = sent_opts(f"Inflation was {r1}% from Year 1 to Year 2 and was higher in each later year, so the price level rose at an increasing rate.", "Each yearly rise in the index is larger than the one before, so the inflation rate increases every year.",
                          [("The inflation rate fell after Year 2, because the price level rose in every year.", "The yearly increases are getting larger, so inflation rises rather than falls."),
                           (f"Inflation was {inc1}% from Year 1 to Year 2, because the index rose by {inc1} points.", f"A rise of {inc1} points on a base of {base} is {r1} percent, not {inc1} percent."),
                           ("The inflation rate was the same in every year, because the index rose in every year.", "The index rises by a different amount each year, so the inflation rate changes."),
                           ("Prices were stable, because the index never fell during the five years.", "A steadily rising index means positive inflation; price stability would show a nearly flat index.")])
    else:
        r4 = nm(float(rates[3]), 1)
        k, ds = sent_opts("The price level fell in Years 4 and 5, so the economy experienced deflation at the end of the period.", "A falling price index means a negative inflation rate, which is deflation.",
                          [("The price level kept rising in Years 4 and 5, but at a slower rate.", "The index falls in Years 4 and 5, so the price level does not keep rising."),
                           (f"The inflation rate in Year 5 was {r4[1:] if r4.startswith('-') else r4}%, because the index changed by a small amount.", "The index falls in Year 5, so the inflation rate is negative rather than positive."),
                           ("Real GDP fell in Years 4 and 5, because the price index fell.", "A price index measures prices, so it gives no information about real GDP."),
                           (f"Inflation was {inc1}% from Year 1 to Year 2, because the index rose by {inc1} points.", f"A rise of {inc1} points on a base of {base} is {r1} percent, not {inc1} percent.")])
    return mk("ma_g_price_index_line", "2.4", "1.D", stem, k, ds, rng, concept="separate the inflation rate from the price level using a price index graph", path="exact yearly percent changes vs numpy diff of the plotted index", stim=stim,
              facts=[f"typ={typ}", f"base={base}", f"incs={incs}"], est=70, judgment="compute yearly percent changes from the graph and distinguish the rate from the level")


@retry_sep
def ma_g_cyclical_unemp_graph(rng):
    un = rng.choice([4, 5, 6]); k_ = rng.choice([3, 4, 5]); cyc = rng.choice([-2, -1, 2, 3])
    for _ in forever():
        us = [un + rng.choice([-1, 0, 1, 2]) for _ in range(7)]
        us[k_ - 1] = un + cyc
        if all(2 <= u <= 11 for u in us) and all(abs(us[i + 1] - us[i]) <= 3 for i in range(6)):
            break
    u_k = us[k_ - 1]
    agree(u_k - un, cyc, 1e-9, "cyc")
    stim = ts_stim("The unemployment rate over seven years, the natural rate (dashed line), and point A.", [("Unemployment rate", list(zip(range(1, 8), us)))], 7, 0, 12, 1, "Time (year)", "Unemployment rate (percent)", points=[("A", k_, u_k)], dashed_y=[un])
    stem = f"The graph shows an economy's unemployment rate over seven years. The dashed horizontal line shows the natural rate of unemployment, {un} percent. Which statement correctly describes the economy at point A?"
    below = cyc > 0
    sgn = lambda v: ("+" if v > 0 else "-") + nm(abs(v), 0)  # noqa: E731
    k, ds = sent_opts(f"Cyclical unemployment is {sgn(cyc)} percentage points, so real GDP is likely {'below' if below else 'above'} potential output.", f"Cyclical unemployment is the actual rate ({u_k}%) minus the natural rate ({un}%), which is {sgn(cyc)} points; {'unemployment above the natural rate' if below else 'unemployment below the natural rate'} goes with output {'below' if below else 'above'} potential.",
                      [(f"Cyclical unemployment is {sgn(-cyc)} percentage points, so real GDP is likely {'above' if below else 'below'} potential output.", "Cyclical unemployment is the actual rate minus the natural rate; reversing the subtraction reverses the sign and the conclusion."),
                       (f"Cyclical unemployment is {u_k} percentage points, because it equals the actual unemployment rate.", "Cyclical unemployment is only the part of unemployment above or below the natural rate, not the whole rate."),
                       (f"Cyclical unemployment is {sgn(cyc)} percentage points, so real GDP is likely {'above' if below else 'below'} potential output.", f"The size is right, but unemployment {'above' if below else 'below'} the natural rate goes with output {'below' if below else 'above'} potential, not the reverse."),
                       (f"The economy is at full employment, because the unemployment rate is positive at point A.", "Full employment means unemployment equals the natural rate; a positive rate alone does not show that.")])
    return mk("ma_g_cyclical_unemp_graph", "2.3", "3.A", stem, k, ds, rng, concept="cyclical unemployment is the actual rate minus the natural rate and signals the output gap", path="exact subtraction vs numpy comparison of the plotted point with the dashed line", stim=stim,
              facts=[f"un={un}", f"k={k_}", f"cyc={cyc}", f"us={us}"], est=70, judgment="compare the actual rate with the natural rate and infer the output gap")


# ======================= 단원 3 =======================
@retry_sep
def ma_g_ad_multiplier_graph(rng):
    dG = 20; mult = rng.choice([2, 4, 5]); dY = dG * mult
    Y1 = rng.choice([200, 240, 280]); P0 = 100; s = Fr(1, 2)
    Y2 = Y1 + dY
    mpc = 1 - Fr(1, mult)
    Ys = sp.symbols("Ys")
    mpc2 = sp.solve(sp.Eq(Ys, dG / (1 - sp.Symbol("c"))), sp.Symbol("c"))
    agree(float(mpc), float(mpc2[0].subs(Ys, dY)), 1e-9, "mpc")
    A1 = P0 + s * Y1; A2 = P0 + s * Y2
    xhi = 400; yhi = 300
    stim = econ_graph("Aggregate demand curves AD1 and AD2 and a horizontal short-run aggregate supply curve SRAS, with equilibria E1 and E2.",
                      [("AD1", line_pts(float(A1), -float(s), 0, xhi)), ("AD2", line_pts(float(A2), -float(s), 0, xhi)), ("SRAS", [(0, P0), (xhi, P0)])], xhi, yhi, 20, 20, points=[("E1", Y1, P0), ("E2", Y2, P0)],
                      xlabel="Real GDP (billions of dollars)", ylabel="Price level (index)")
    stem = (f"The graph shows aggregate demand curves AD1 and AD2 and a horizontal short-run aggregate supply curve SRAS for an economy with large amounts of unused capacity, so the price level does not change. Points E1 and E2 are the equilibria. "
            f"An increase in government purchases of ${dG} billion is the only cause of the shift from AD1 to AD2. Assume there are no taxes or imports. What is the marginal propensity to consume?")
    pairs = [("Reports the marginal propensity to save instead.", float(1 - mpc)), ("Reports the spending multiplier instead of the MPC.", float(mult)), ("Subtracts one from the multiplier.", float(mult - 1)),
             ("Reports the change in real GDP in billions of dollars.", float(dY)), ("Divides the change in government purchases by the multiplier.", dG / mult)]
    k, ds = val_opts(float(mpc), pairs, lambda v: nm(v, 2))
    kw = f"Real GDP rises from {Y1} to {Y2}, so the multiplier is {dY} / {dG} = {mult}. Since the multiplier is 1 / (1 - MPC), the MPC is 1 - 1/{mult} = {nm(float(mpc), 2)}."
    return mk("ma_g_ad_multiplier_graph", "3.2", "3.C", stem, k, ds, rng, concept="infer the multiplier and MPC from the horizontal shift of aggregate demand", path="exact fractions vs sympy solution of the multiplier equation", stim=stim, kwhy=kw,
              facts=[f"mult={mult}", f"Y1={Y1}", f"dG={dG}"], est=90)


@retry_sep
def ma_g_stabilizer_table(rng):
    t = rng.choice([Fr(1, 5), Fr(1, 4)]); Y1 = rng.choice([1000, 1200]); st = rng.choice([100, 200]) if t == Fr(1, 5) else rng.choice([100, 200])
    Ys = [Y1, Y1 - st, Y1 - 2 * st]
    Ts = [int(Fr(y) * t) for y in Ys]
    if any(Fr(y) * t != Ts[i] for i, y in enumerate(Ys)):
        raise ValueError("not_enough_separated_distractors")
    G = Ts[0] + rng.choice([-30, -20, 20]) if rng.random() < 0.5 else Ts[2] + rng.choice([-20, 20])
    b1, b3 = Ts[0] - G, Ts[2] - G
    b1s = int(sp.Rational(Ts[0]) - sp.Rational(G)); agree(b1s, b1, 1e-9, "b1")
    stim = tbl("Real GDP, tax revenue, and government purchases over three years.", ["Year", "Real GDP (billions of dollars)", "Tax revenue (billions of dollars)", "Government purchases (billions of dollars)"], [[str(i + 1), usd(Ys[i]), usd(Ts[i]), usd(G)] for i in range(3)])
    stem = "The table shows real GDP, tax revenue, and government purchases for an economy over three years. Government purchases are set by a fixed budget, and tax revenue depends on income. Which statement best describes the change in the budget balance from Year 1 to Year 3?"
    k, ds = sent_opts(f"The budget moved from {_desc_bal(b1)} in Year 1 to {_desc_bal(b3)} in Year 3, because tax revenue fell with real GDP while government purchases stayed the same.", f"Tax revenue minus purchases is {Ts[0]} - {G} = {b1} in Year 1 and {Ts[2]} - {G} = {b3} in Year 3; the automatic fall in revenue caused the change.",
                      [(f"The budget moved from {_desc_bal(b3)} in Year 1 to {_desc_bal(b1)} in Year 3, because tax revenue rises when real GDP falls.", "Tax revenue falls, not rises, when real GDP falls, so the balance moves toward a smaller surplus or a larger deficit."),
                       ("The budget balance did not change, because government purchases were the same in every year.", "The balance equals revenue minus purchases, and revenue changed with real GDP."),
                       (f"The deficit in Year 3 equals the ${2 * st} billion fall in real GDP, because tax revenue is a fixed amount.", f"Tax revenue is not fixed; it fell by ${Ts[0] - Ts[2]} billion, which is a share of the fall in real GDP."),
                       (f"The budget moved from {_desc_bal(b1)} in Year 1 to {_desc_bal(b3)} in Year 3, because government purchases rose in Year 3.", "The table shows the same government purchases in all three years, so purchases did not cause the change.")])
    return mk("ma_g_stabilizer_table", "3.9", "3.A", stem, k, ds, rng, concept="automatic stabilizers: tax revenue falls with income while purchases are fixed, so the budget balance worsens", path="exact fractions vs sympy rationals on revenue minus purchases", stim=stim,
              facts=[f"t={float(t):.2f}", f"Y1={Y1}", f"st={st}", f"G={G}"], est=75, judgment="compute the balance in each year and trace the change to revenue, not purchases")


@retry_sep
def ma_g_ad_move_along_graph(rng):
    s = rng.choice([Fr(1, 2), Fr(1, 3), Fr(1, 4)]); dP = 20; dY = int(dP / s)
    Ya = rng.choice([200, 240]) ; Pa = rng.choice([100, 120, 140]); Yb = Ya + dY; Pb = Pa - dP
    P0 = Pa + s * Ya
    if P0 != int(P0) or Yb > 380:
        raise ValueError("not_enough_separated_distractors")
    agree(float(P0 - s * Yb), Pb, 1e-9, "line")
    xhi = 400; yhi = int(P0) + 20 - int(P0) % 20
    stim = econ_graph("Aggregate demand curve AD with points A and B.", [("AD", line_pts(float(P0), -float(s), 0, xhi))], xhi, yhi, 20, 20, points=[("A", Ya, Pa), ("B", Yb, Pb)], xlabel="Real GDP (billions of dollars)", ylabel="Price level (index)")
    stem = f"The graph shows the aggregate demand curve AD for an economy. The price level falls from {Pa} to {Pb}, and the economy moves from point A to point B. Which statement best explains why the quantity of real GDP demanded increases from {Ya} billion to {Yb} billion dollars?"
    k, ds = sent_opts("A lower price level raises the real value of money holdings and lowers interest rates, so spending rises along the same AD curve.", "Wealth and interest-rate effects of a lower price level raise the quantity of real GDP demanded, a movement along the AD curve.",
                      [("The AD curve shifted to the right, because consumers became more optimistic about their future income.", "A change in the price level moves the economy along AD; a shift needs a change in a determinant like confidence."),
                       ("Short-run aggregate supply increased, because the lower price level reduced firms' costs.", "A change in aggregate supply shifts AS and does not explain a movement along the AD curve."),
                       ("Net exports fell, because domestic goods became more expensive relative to foreign goods.", "A lower domestic price level makes domestic goods cheaper relative to foreign goods, which raises net exports."),
                       ("The government increased its purchases, which raised aggregate demand at every price level.", "Higher government purchases shift the whole AD curve; the graph shows a move along one curve.")])
    return mk("ma_g_ad_move_along_graph", "3.1", "1.A", stem, k, ds, rng, concept="why aggregate demand slopes downward: wealth, interest-rate, and exchange-rate effects of a price level change", path="exact fractions on the plotted line vs numpy interpolation at the labeled points", stim=stim,
              facts=[f"s={s}", f"Ya={Ya}", f"Pa={Pa}"], est=60, judgment="distinguish a movement along AD caused by the price level from a shift of AD")


# ======================= 단원 4 =======================
@retry_sep
def ma_g_real_rate_lines(rng):
    ask = rng.choice(["value", "year"])
    for _ in forever():
        nom = [rng.randint(2, 9) for _ in range(6)]; inf = [rng.randint(0, 7) for _ in range(6)]
        real = [n - i for n, i in zip(nom, inf)]
        if any(abs(nom[i + 1] - nom[i]) > 3 or abs(inf[i + 1] - inf[i]) > 3 for i in range(5)):
            continue
        if ask == "year":
            lo = min(real)
            if real.count(lo) != 1:
                continue
            kyr = real.index(lo) + 1
            if nom.index(min(nom)) + 1 in (kyr,) or inf.index(max(inf)) + 1 == kyr or nom.index(min(nom)) == inf.index(max(inf)) or nom.count(min(nom)) > 1 or inf.count(max(inf)) > 1:
                continue
            break
        else:
            kyr = rng.randint(2, 5)
            if nom[kyr - 1] == inf[kyr - 1] or nom[kyr - 1] - inf[kyr - 1] == 0:
                continue
            break
    stim = ts_stim("The nominal interest rate and the inflation rate over six years.", [("Nominal interest rate", list(zip(range(1, 7), nom))), ("Inflation rate", list(zip(range(1, 7), inf)))], 6, 0, 10, 1, "Time (year)", "Percent per year")
    if ask == "value":
        n_, i_ = nom[kyr - 1], inf[kyr - 1]; key = n_ - i_
        agree(key, float(np.subtract(n_, i_)), 1e-9, "real")
        stem = f"The graph shows an economy's nominal interest rate and inflation rate over six years. The curves are labeled Nominal interest rate and Inflation rate. What was the real interest rate in Year {kyr}?"
        pairs = [("Adds the inflation rate to the nominal rate.", n_ + i_), ("Reports the nominal interest rate itself.", n_), ("Reports the inflation rate itself.", i_), ("Subtracts the nominal rate from the inflation rate, which reverses the sign.", i_ - n_), ("Multiplies the nominal rate by the inflation rate.", n_ * i_)]
        k, ds = val_opts(float(key), pairs, lambda v: f"{nm(v, 0)}%")
        kw = f"The real interest rate is the nominal rate minus the inflation rate: {n_} - {i_} = {key} percent in Year {kyr}."
        return mk("ma_g_real_rate_lines", "4.2", "1.C", stem, k, ds, rng, concept="real interest rate equals the nominal rate minus inflation, read from two time-series lines", path="exact subtraction vs numpy elementwise difference of the two plotted series", stim=stim, kwhy=kw,
                  facts=[f"nom={nom}", f"inf={inf}", f"year={kyr}", "ask=value"], est=60)
    stem = "The graph shows an economy's nominal interest rate and inflation rate over six years. The curves are labeled Nominal interest rate and Inflation rate. In which year was the real interest rate the lowest?"
    kmin = nom.index(min(nom)) + 1; kmax = inf.index(max(inf)) + 1
    others = [y for y in range(1, 7) if y not in (kyr, kmin, kmax)]
    rng.shuffle(others)
    wr = [Opt(f"Year {kmin}", False, f"Year {kmin} has the lowest nominal rate, but its real rate is {real[kmin - 1]} percent, which is higher than the lowest value.", None),
          Opt(f"Year {kmax}", False, f"Year {kmax} has the highest inflation rate, but its real rate is {real[kmax - 1]} percent, which is higher than the lowest value.", None)]
    for y in others[:2]:
        wr.append(Opt(f"Year {y}", False, f"The real rate in Year {y} is {nom[y - 1]} - {inf[y - 1]} = {real[y - 1]} percent, which is higher than the lowest real rate.", None))
    key = Opt(f"Year {kyr}", True, f"The real rate is the nominal rate minus inflation: {nom[kyr - 1]} - {inf[kyr - 1]} = {real[kyr - 1]} percent in Year {kyr}, the lowest of the six years.", None)
    return mk("ma_g_real_rate_lines", "4.2", "1.C", stem, key, wr, rng, concept="real interest rate equals the nominal rate minus inflation, read from two time-series lines", path="exact subtraction vs numpy argmin of the elementwise difference", stim=stim,
              facts=[f"nom={nom}", f"inf={inf}", "ask=year"], est=70)


@retry_sep
def ma_g_deposit_rounds_table(rng):
    rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)])
    D1 = {Fr(1, 10): rng.choice([1000, 2000]), Fr(1, 5): rng.choice([1000, 2500]), Fr(1, 4): rng.choice([1600, 3200])}[rr]
    D = [Fr(D1)]
    for _ in range(2):
        D.append(D[-1] * (1 - rr))
    if any(d.denominator != 1 for d in D):
        raise ValueError("not_enough_separated_distractors")
    D = [int(d) for d in D]
    R = [int(Fr(d) * rr) for d in D]; L = [d - r for d, r in zip(D, R)]
    total = Fr(D1) / rr
    n_ = sp.Symbol("n", integer=True, nonnegative=True)
    tot2 = sp.summation(sp.Rational(D1) * (1 - sp.Rational(rr.numerator, rr.denominator)) ** n_, (n_, 0, sp.oo))
    agree(float(total), float(tot2), 1e-9, "total")
    ask = rng.choice(["deposits", "loans"])
    stim = tbl("The first three rounds of money creation after a new deposit.", ["Round", "New checkable deposit", "Required reserves", "New loan"], [[str(i + 1), usd(D[i]), usd(R[i]), usd(L[i])] for i in range(3)])
    stem = (f"In an economy with limited reserves, every bank lends all of its excess reserves, every loan is redeposited in full in checkable deposits, and the public holds no currency. The table shows the first three rounds that follow a new deposit of {usd(D1)}. "
            + ("If the process continues until no excess reserves remain, what is the total increase in checkable deposits, including the original deposit?" if ask == "deposits" else "If the process continues until no excess reserves remain, what is the total amount of new loans made by all banks?"))
    if ask == "deposits":
        key = float(total)
        pairs = [("Adds only the three rounds shown in the table.", float(sum(D))), ("Leaves out the original deposit.", float(total - D1)), ("Multiplies the original deposit by the required reserve ratio.", float(D1 * rr)), ("Reports the multiplier instead of the change in deposits.", float(1 / rr)),
                 ("Starts the geometric process from the round 3 deposit instead of the original deposit.", float(Fr(D[2]) / rr))]
        kw = f"The required reserve ratio is {R[0]} / {D[0]} = {nm(float(rr), 2)}, so total deposits rise by {D1} / {nm(float(rr), 2)} = {nm(key)}."
    else:
        key = float(total - D1)
        pairs = [("Adds only the three loans shown in the table.", float(sum(L))), ("Reports the total increase in deposits, which includes the original deposit.", float(total)), ("Multiplies the original deposit by the required reserve ratio.", float(D1 * rr)), ("Reports the multiplier instead of the amount of loans.", float(1 / rr)),
                 ("Starts the geometric process from the round 3 loan.", float(Fr(L[2]) / rr))]
        kw = f"Total deposits rise by {D1} / {nm(float(rr), 2)} = {nm(float(total))}; the original deposit was not a loan, so loans total {nm(float(total))} - {D1} = {nm(key)}."
    k, ds = val_opts(key, pairs, lambda v: usd(v))
    return mk("ma_g_deposit_rounds_table", "4.4", "3.C", stem, k, ds, rng, concept="total deposit expansion from the pattern of rounds in a table", path="exact geometric sum fraction vs sympy infinite series", stim=stim, kwhy=kw,
              facts=[f"rr={float(rr):.3f}", f"D1={D1}", f"ask={ask}"], est=95)


@retry_sep
def ma_g_bond_price_table(rng):
    c, rows = rng.choice([(40, [(2, 2000), (4, 1000), (5, 800), (8, 500)]), (60, [(3, 2000), (4, 1500), (5, 1200), (6, 1000)]), (80, [(4, 2000), (5, 1600), (8, 1000), (10, 800)]), (100, [(4, 2500), (5, 2000), (8, 1250), (10, 1000)])])
    for r_, p_ in rows:
        agree(c / (r_ / 100), p_, 1e-9, "price")
    i, j = rng.sample(range(4), 2)
    up = rng.random() < 0.5
    a_, b_ = (i, j) if (rows[i][0] < rows[j][0]) == up else (j, i)
    ra, pa = rows[a_]; rb, pb = rows[b_]
    stim = tbl("Market price of a bond with a fixed annual payment at four market interest rates.", ["Market interest rate (percent)", "Price of the bond (dollars)"], [[str(r_), usd(p_)] for r_, p_ in rows])
    stem = f"A bond makes a fixed payment of ${c} every year forever. The table shows the price that buyers would pay for the bond at four market interest rates. The market interest rate {'rises' if up else 'falls'} from {ra} percent to {rb} percent. Which statement correctly describes the effect on the bond's price and why?"
    if up:
        k, ds = sent_opts(f"The price falls from ${pa:,} to ${pb:,}, because new bonds pay a higher interest rate, so the fixed ${c} payment is less attractive.", "Buyers compare the fixed payment with the higher interest available elsewhere, so they pay less for the bond.",
                          [("The price rises, because a higher interest rate raises the value of each fixed payment.", "A fixed payment is worth less, not more, when the market interest rate rises."), (f"The price stays at ${pa:,}, because the bond's payment of ${c} does not change.", "The payment is fixed, but its attractiveness depends on market interest rates, so the price changes."),
                           (f"The price rises from ${pb:,} to ${pa:,}, because the market interest rate is higher.", "This reads the table backward: the higher interest rate goes with the lower price."), ("The price falls, but only because borrowers default more often when interest rates rise.", "The table gives the price at each rate with no default risk; the change is caused by the interest rate itself.")])
    else:
        k, ds = sent_opts(f"The price rises from ${pa:,} to ${pb:,}, because new bonds pay a lower interest rate, so the fixed ${c} payment is more attractive.", "Buyers compare the fixed payment with the lower interest available elsewhere, so they pay more for the bond.",
                          [("The price falls, because a lower interest rate lowers the value of each fixed payment.", "A fixed payment is worth more, not less, when the market interest rate falls."), (f"The price stays at ${pa:,}, because the bond's payment of ${c} does not change.", "The payment is fixed, but its attractiveness depends on market interest rates, so the price changes."),
                           (f"The price falls from ${pb:,} to ${pa:,}, because the market interest rate is lower.", "This reads the table backward: the lower interest rate goes with the higher price."), ("The price rises, but only because the issuer decides to pay more each year.", "The payment is fixed at the same amount; the price changes because the market interest rate changes.")])
    return mk("ma_g_bond_price_table", "4.1", "2.B", stem, k, ds, rng, concept="bond prices move opposite to market interest rates (fixed payment)", path="exact price = payment / rate on every table row vs the stated prices", stim=stim,
              facts=[f"c={c}", f"ra={ra}", f"rb={rb}", f"up={up}"], est=75, judgment="use the table to explain the inverse relationship between bond prices and interest rates")


# ======================= 단원 5 =======================
@retry_sep
def ma_g_phillips_shift_graph(rng):
    un = rng.choice([4, 5, 6]); p1 = rng.choice([2, 3, 4]); up = rng.random() < 0.5; d = 2
    p2 = p1 + d if up else p1 - d
    if p2 < 1:
        raise ValueError("not_enough_separated_distractors")
    b = 1
    def srpc(pe):
        return [(u, pe + b * (un - u)) for u in range(1, 10) if 0.4 <= pe + b * (un - u) <= 12]
    agree(srpc(p1)[un - 1][1], p1, 1e-9, "A")
    xhi = 10; yhi = 12
    stim = econ_graph("A long-run Phillips curve LRPC and two short-run Phillips curves SRPC1 and SRPC2, with points A and B.", [("LRPC", [(un, 0), (un, yhi)]), ("SRPC1", srpc(p1)), ("SRPC2", srpc(p2))], xhi, yhi, 1, 1, points=[("A", un, p1), ("B", un, p2)],
                      xlabel="Unemployment rate (percent)", ylabel="Inflation rate (percent)")
    stem = f"The graph shows the long-run Phillips curve LRPC and two short-run Phillips curves, SRPC1 and SRPC2, for an economy. The economy moves from point A on SRPC1 to point B on SRPC2. Which statement best explains the move from A to B?"
    word = "increased" if up else "decreased"; other = "decreased" if up else "increased"
    k, ds = sent_opts(f"Expected inflation {word} from {p1} percent to {p2} percent, which shifted the short-run Phillips curve {'up' if up else 'down'} while the natural rate stayed at {un} percent.", f"Both points are at the natural rate of {un} percent, so only the expected inflation rate changed; that shifts the SRPC and leaves the LRPC where it is.",
                      [(f"The natural rate of unemployment {'rose' if up else 'fell'}, so the long-run Phillips curve shifted {'right' if up else 'left'}.", "The LRPC is at the same unemployment rate at both points, so the natural rate did not change."),
                       (f"Unemployment {'fell' if up else 'rose'} along SRPC1, which {'raised' if up else 'lowered'} inflation from {p1} percent to {p2} percent.", "Points A and B have the same unemployment rate, so this is not a movement along one short-run curve."),
                       (f"Expected inflation {other} from {p2} percent to {p1} percent, which shifted the short-run Phillips curve {'down' if up else 'up'}.", "This reverses the direction of the change in expected inflation shown by the move from A to B."),
                       (f"Productivity growth {'rose' if up else 'fell'}, so the economy can sustain {'lower' if up else 'higher'} unemployment at every inflation rate.", "A change in productivity growth is not shown by these curves, and the natural rate stays the same at both points.")])
    return mk("ma_g_phillips_shift_graph", "5.2", "3.A", stem, k, ds, rng, concept="a change in expected inflation shifts the short-run Phillips curve and leaves the long-run curve unchanged", path="exact line equations of the two SRPCs at the natural rate vs the plotted vertices", stim=stim,
              facts=[f"un={un}", f"p1={p1}", f"p2={p2}"], est=75, judgment="separate a shift of the short-run curve from a movement along it and from a shift of the long-run curve")


@retry_sep
def ma_g_debt_balance_table(rng):
    typ = rng.choice(["shrink", "surplus"]); D0 = rng.choice([1000, 1500, 2000])
    bal = {"shrink": [-rng.choice([120, 160]), -90, -60, -30, -10], "surplus": [-60, -20, 20, 40, 30]}[typ]
    debt = []
    cur = D0
    for b in bal:
        cur = cur - b
        debt.append(cur)
    agree(debt[-1], D0 - sum(bal), 1e-9, "debt")
    stim = tbl("Budget balance and national debt over five years (deficits are negative).", ["Year", "Budget balance (billions of dollars)", "National debt at end of year (billions of dollars)"], [[str(i + 1), usd(bal[i]), usd(debt[i])] for i in range(5)])
    stem = f"The table shows a government's budget balance and its national debt at the end of each of five years. The national debt was ${D0:,} billion at the start of Year 1. Which statement is consistent with the table?"
    if typ == "shrink":
        k, ds = sent_opts("The national debt rose every year, even though the annual deficit shrank every year.", "Each year's deficit is added to the existing debt, so the debt keeps rising while any deficit remains.",
                          [("The national debt fell in the later years, because the annual deficit fell.", "A smaller deficit still adds to the debt; the debt falls only when the government runs a surplus."), ("The government ran a budget surplus in Year 5, because the deficit was smallest in that year.", "The balance in Year 5 is still negative, so there is a small deficit rather than a surplus."),
                           ("The annual deficit and the national debt are the same measure, so both fell.", "The deficit is a yearly flow and the debt is the accumulated stock; the stock did not fall."), ("The national debt rose only in years when the annual deficit increased.", "The debt rises in every year with a deficit, even when the deficit is smaller than before.")])
    else:
        k, ds = sent_opts("The national debt fell in Years 3 through 5, because the government ran budget surpluses in those years.", "A surplus is used to pay down debt, so the debt falls in each year with a positive balance.",
                          [("The national debt fell in Year 2, because the deficit was smaller than in Year 1.", "A smaller deficit still adds to the debt, so the debt rose in Year 2."), ("The national debt rose in Years 3 through 5, because the government still owed interest.", "The table shows the debt falling in those years, since each surplus reduced it."),
                           ("The national debt was highest in Year 1, because the deficit was the largest in that year.", "The debt was highest in Year 2, after the second deficit was added."), ("The national debt fell by the amount of the Year 5 surplus in every year after Year 2.", "Each year's change in the debt equals that year's balance, which was not the same in each year.")])
    return mk("ma_g_debt_balance_table", "5.4", "1.B", stem, k, ds, rng, concept="deficits add to the national debt and surpluses reduce it", path="exact running sum of balances vs numpy cumulative sum equals the debt column", stim=stim,
              facts=[f"typ={typ}", f"D0={D0}", f"bal={bal}"], est=70, judgment="relate each year's budget balance to the change in the national debt")


@retry_sep
def ma_g_growth_sources_table(rng):
    typ = rng.choice(["deep", "wide"])
    L1 = rng.choice([100, 200]); K1 = rng.choice([600, 1200]); Y1 = rng.choice([1000, 1200])
    if typ == "deep":
        lg, kg, yg = Fr(6, 5), Fr(3, 2), Fr(36, 25)
    else:
        lg, kg, yg = Fr(6, 5), Fr(1), Fr(27, 25)
    L2, K2, Y2 = L1 * lg, K1 * kg, Y1 * yg
    if any(Fr(v).denominator != 1 for v in (L2, K2, Y2)):
        raise ValueError("not_enough_separated_distractors")
    L2, K2, Y2 = int(L2), int(K2), int(Y2)
    opw1, opw2 = Fr(Y1 * 1000, L1), Fr(Y2 * 1000, L2); kpw1, kpw2 = Fr(K1 * 1000, L1), Fr(K2 * 1000, L2)
    if any(v.denominator != 1 for v in (opw1, opw2, kpw1, kpw2)):
        raise ValueError("not_enough_separated_distractors")
    opw1, opw2, kpw1, kpw2 = (int(v) for v in (opw1, opw2, kpw1, kpw2))
    agree(float(opw2 > opw1), float((Y2 / L2) > (Y1 / L1)), 1e-9, "opw")
    stim = tbl("Capital, labor, and real GDP in two years.", ["Year", "Capital stock (billions of dollars)", "Workers (millions)", "Real GDP (billions of dollars)"], [["1", usd(K1), str(L1), usd(Y1)], ["2", usd(K2), str(L2), usd(Y2)]])
    stem = "The table shows an economy's capital stock, number of workers, and real GDP in two years. Which statement best explains the change in real GDP per worker between Year 1 and Year 2?"
    if typ == "deep":
        k, ds = sent_opts(f"Real GDP per worker rose from ${opw1:,} to ${opw2:,}, mainly because capital per worker rose from ${kpw1:,} to ${kpw2:,}.", "Each worker has more capital to work with, which raises output per worker.",
                          [(f"Real GDP per worker did not change, because the number of workers grew {int((lg - 1) * 100)} percent.", "Output per worker is real GDP divided by workers, and it rose because real GDP grew faster than the labor force."),
                           ("Real GDP per worker rose, because the number of workers increased.", "More workers raise total real GDP, but output per worker rose here only because capital per worker rose."),
                           (f"Real GDP per worker rose by {int((kg - 1) * 100)} percent, the same rate as the capital stock.", "Output per worker grew by a different rate than the capital stock, so the two growth rates are not equal."),
                           (f"Capital per worker fell from ${kpw2:,} to ${kpw1:,}, which lowered real GDP per worker.", "The table shows capital per worker rising, not falling, between the two years.")])
    else:
        k, ds = sent_opts(f"Real GDP rose, but real GDP per worker fell from ${opw1:,} to ${opw2:,}, because the number of workers grew faster than the capital stock.", f"Capital per worker fell from ${kpw1:,} to ${kpw2:,}, so each worker produced less on average.",
                          [(f"Real GDP per worker rose, because real GDP grew {int((yg - 1) * 100)} percent.", "Real GDP per worker also depends on the number of workers, which grew faster than real GDP."),
                           ("Real GDP per worker did not change, because the capital stock stayed the same.", "A constant capital stock with more workers lowers output per worker."),
                           (f"Real GDP per worker rose from ${opw2:,} to ${opw1:,}, because capital per worker increased.", "This reverses the years: capital per worker and output per worker both fell from Year 1 to Year 2."),
                           ("Real GDP per worker fell, because the capital stock decreased.", "The capital stock is the same in both years; the fall in output per worker comes from more workers sharing it.")])
    return mk("ma_g_growth_sources_table", "5.6", "2.B", stem, k, ds, rng, concept="productivity growth comes from capital per worker; more workers alone lower output per worker", path="exact per-worker fractions vs numpy division of the table columns", stim=stim,
              facts=[f"typ={typ}", f"K1={K1}", f"L1={L1}", f"Y1={Y1}"], est=80, judgment="compute capital and output per worker from the table and tie the change to capital deepening")


# ======================= 단원 6 =======================
@retry_sep
def ma_g_fx_line_graph(rng):
    rise = rng.random() < 0.5
    a_ = rng.choice([Fr(110, 100), Fr(115, 100), Fr(120, 100)])
    steps = [Fr(5, 100), Fr(5, 100), Fr(10, 100), Fr(5, 100)] if rng.random() < 0.5 else [Fr(5, 100), Fr(10, 100), Fr(5, 100), Fr(5, 100)]
    ys = [a_]
    for s_ in steps:
        ys.append(ys[-1] + (s_ if rise else -s_))
    if min(ys) < Fr(80, 100):
        raise ValueError("not_enough_separated_distractors")
    first, last = ys[0], ys[-1]
    dep = (1 / last) < (1 / first)
    agree(1 if dep else 0, 1 if (last > first) else 0, 1e-9, "dep")
    lo = float(min(ys)) - 0.1; lo = int(lo * 20) / 20; hi = float(max(ys)) + 0.1; hi = int(hi * 20 + 1) / 20
    stim = ts_stim("The exchange rate between the U.S. dollar and the euro over five years.", [("Exchange rate", [(i + 1, round(float(v), 2)) for i, v in enumerate(ys)])], 5, lo, hi, 0.05, "Time (year)", "Exchange rate (dollars per euro)")
    stem = "The graph shows the exchange rate between the U.S. dollar and the euro over five years, measured in dollars per euro. Which statement is correct?"
    a_s, b_s = f"${float(first):.2f}", f"${float(last):.2f}"
    if dep:
        k, ds = sent_opts(f"The dollar depreciated against the euro, so goods made in the United States became cheaper for buyers in the eurozone.", f"One euro cost {a_s} in Year 1 and {b_s} in Year 5, so the dollar buys fewer euros and exports from the United States cost less in euros.",
                          [(f"The dollar appreciated against the euro, because it took more dollars to buy one euro in Year 5 than in Year 1.", "Needing more dollars to buy a euro means the dollar lost value, which is depreciation."),
                           ("The dollar depreciated against the euro, so imports from the eurozone became cheaper for American buyers.", "A weaker dollar makes imports more expensive for American buyers."),
                           ("The euro depreciated against the dollar, so European tourists found the United States more expensive to visit.", "More dollars per euro means the euro gained value, which makes the United States cheaper for European visitors."),
                           ("The dollar depreciated against the euro, so the United States will import more and export less.", "A weaker dollar tends to raise exports and lower imports.")])
    else:
        k, ds = sent_opts(f"The dollar appreciated against the euro, so goods made in the United States became more expensive for buyers in the eurozone.", f"One euro cost {a_s} in Year 1 and {b_s} in Year 5, so the dollar buys more euros and exports from the United States cost more in euros.",
                          [(f"The dollar depreciated against the euro, because it took fewer dollars to buy one euro in Year 5 than in Year 1.", "Needing fewer dollars to buy a euro means the dollar gained value, which is appreciation."),
                           ("The dollar appreciated against the euro, so imports from the eurozone became more expensive for American buyers.", "A stronger dollar makes imports cheaper for American buyers."),
                           ("The euro appreciated against the dollar, so European tourists found the United States cheaper to visit.", "The euro depreciated, which makes the United States more expensive for European tourists."),
                           ("The dollar appreciated against the euro, so the United States will import less and export more.", "A stronger dollar tends to lower exports and raise imports.")])
    return mk("ma_g_fx_line_graph", "6.5", "1.D", stem, k, ds, rng, concept="read an exchange rate time series and infer appreciation or depreciation and the trade effects", path="exact reciprocal comparison vs plotted first and last values", stim=stim,
              facts=[f"first={float(first):.2f}", f"last={float(last):.2f}", f"rise={rise}"], est=75, judgment="read the direction of the exchange rate and trace its effect on relative prices")


@retry_sep
def ma_g_exports_imports_lines(rng):
    rises = rng.random() < 0.5
    X1 = rng.choice([300, 340, 400]); M1 = X1 + rng.choice([-20, 0, 20, 40])
    dx, dm = (20, 40) if not rises else (40, 20)
    X = [X1 + dx * i + rng.choice([0, 10]) * (1 if 0 < i < 4 else 0) for i in range(5)]
    M = [M1 + dm * i + rng.choice([0, 10]) * (1 if 0 < i < 4 else 0) for i in range(5)]
    ya = rng.choice([1, 2]); yb = 5
    nxa, nxb = X[ya - 1] - M[ya - 1], X[yb - 1] - M[yb - 1]
    agree(nxb - nxa, float(np.subtract(X[yb - 1], M[yb - 1]) - np.subtract(X[ya - 1], M[ya - 1])), 1e-9, "nx")
    if (nxb > nxa) != rises or not (X[yb - 1] > X[ya - 1] and M[yb - 1] > M[ya - 1]):
        raise ValueError("not_enough_separated_distractors")
    ylo = (min(min(X), min(M)) - 20) // 20 * 20; yhi = (max(max(X), max(M)) + 20) // 20 * 20 + 20
    stim = ts_stim("Exports and imports of an economy over five years.", [("Exports", list(zip(range(1, 6), X))), ("Imports", list(zip(range(1, 6), M)))], 5, ylo, yhi, 20, "Time (year)", "Billions of dollars")
    stem = f"The graph shows an economy's exports and imports over five years. The curves are labeled Exports and Imports. Which statement correctly describes net exports and the effect on aggregate demand between Year {ya} and Year {yb}?"
    nx_a, nx_b = usd(nxa), usd(nxb)
    if not rises:
        k, ds = sent_opts(f"Net exports fell from {nx_a} billion to {nx_b} billion, which decreased aggregate demand.", "Net exports are exports minus imports; imports rose by more than exports, so net exports and aggregate demand fell.",
                          [(f"Net exports rose from {nx_a} billion to {nx_b} billion, which increased aggregate demand.", "Imports grew faster than exports, so net exports fell rather than rose."),
                           (f"Net exports fell from {nx_a} billion to {nx_b} billion, which increased aggregate demand, because higher imports raise total spending.", "Imports are subtracted from aggregate demand because that spending goes to foreign producers."),
                           (f"Net exports fell from {usd(X[ya - 1])} billion to {usd(X[yb - 1])} billion, which decreased aggregate demand.", "These values are exports, which rose; net exports also subtract imports."),
                           ("Net exports did not change, because both exports and imports rose.", "Net exports change when exports and imports rise by different amounts.")])
    else:
        k, ds = sent_opts(f"Net exports rose from {nx_a} billion to {nx_b} billion, which increased aggregate demand.", "Net exports are exports minus imports; exports rose by more than imports, so net exports and aggregate demand rose.",
                          [(f"Net exports fell from {nx_a} billion to {nx_b} billion, which decreased aggregate demand.", "Exports grew faster than imports, so net exports rose rather than fell."),
                           (f"Net exports rose from {nx_a} billion to {nx_b} billion, which decreased aggregate demand, because higher exports raise the price level.", "Higher net exports add to aggregate demand; the price level effect does not reverse that."),
                           (f"Net exports rose from {usd(X[ya - 1])} billion to {usd(X[yb - 1])} billion, which increased aggregate demand.", "These values are exports; net exports also subtract imports."),
                           ("Net exports did not change, because both exports and imports rose.", "Net exports change when exports and imports rise by different amounts.")])
    return mk("ma_g_exports_imports_lines", "6.5", "3.A", stem, k, ds, rng, concept="net exports from two plotted series and their effect on aggregate demand", path="exact subtraction of the plotted values vs numpy elementwise difference", stim=stim,
              facts=[f"X={X}", f"M={M}", f"ya={ya}"], est=75, judgment="compute net exports at two dates from two lines and trace the effect on aggregate demand")
