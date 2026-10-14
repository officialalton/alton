"""AP Macroeconomics 원형 E — 단원 5(안정화 정책의 장기 결과: 정책 조합·필립스 곡선·화폐수량설·적자와 부채·구축효과·성장). 2026-10-14."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401
from macro_models import *  # noqa: F401,F403


def _v(rng, table):
    return table[rng.randrange(len(table))]


# ======================= 5.1 정책 조합 =======================
POLNAME = {(1, "f"): "expansionary fiscal policy (a larger budget deficit)", (-1, "f"): "contractionary fiscal policy (a smaller budget deficit)", (1, "m"): "expansionary monetary policy", (-1, "m"): "contractionary monetary policy"}


def ma_policy_mix(rng):
    f, mo = rng.choice([(1, 1), (1, -1), (-1, 1), (-1, -1)])
    d = policy_mix(f, mo)
    mm = {"Y": ("Both policies push real GDP in the same direction, so real GDP " + ("rises." if d["Y"] == 1 else "falls.")) if d["Y"] is not None else "The policies push real GDP in opposite directions, and the sizes are not given, so the effect on real GDP is indeterminate.",
          "ir": ("The policies push interest rates in the same direction, so interest rates " + ("rise." if d["i"] == 1 else "fall.")) if d["i"] is not None else "The policies push interest rates in opposite directions, and the sizes are not given, so the effect on interest rates is indeterminate."}
    key, ds = combo_item(rng, ["Y", "ir"], {"Y": d["Y"], "ir": d["i"]}, mm, dirs=(1, -1, None))
    stem = f"The government carries out {POLNAME[(f, 'f')]} while the central bank carries out {POLNAME[(mo, 'm')]}. What is the most likely short-run effect on real GDP and on interest rates?"
    return mk("ma_policy_mix", "5.1", "2.B", stem, key, ds, rng, concept="combining fiscal and monetary policy: output and interest-rate effects", path="direction rule table (same-direction policies fix output, opposite-direction policies fix interest rates) vs numeric sign simulation", facts=[f"f={f}", f"mo={mo}", f"d={d}"], est=75)


def ma_policy_goal(rng):
    goal = rng.choice(["raise_noint", "raise_int"])
    if goal == "raise_noint":
        stem = "Which of the following combinations of policies would most likely increase real GDP while having an indeterminate effect on interest rates?"
        want = (1, 1)
    else:
        stem = "Which of the following combinations of policies would most likely increase interest rates while having an indeterminate effect on real GDP?"
        want = (1, -1)
    for f, mo in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
        d = policy_mix(f, mo)
        if goal == "raise_noint":
            ok = d["Y"] == 1 and d["i"] is None
        else:
            ok = d["i"] == 1 and d["Y"] is None
        agree(1, 1 if ok == ((f, mo) == want) else 0, 1e-9, "goal")
    wf, wm = want
    txt = lambda f, m_: f"{cap1(POLNAME[(f, 'f')])} and {POLNAME[(m_, 'm')]}."  # noqa: E731
    reasons = {}
    for f, mo in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
        d = policy_mix(f, mo)
        reasons[(f, mo)] = f"This combination gives real GDP {'an increase' if d['Y'] == 1 else 'a decrease' if d['Y'] == -1 else 'an indeterminate change'} and interest rates {'an increase' if d['i'] == 1 else 'a decrease' if d['i'] == -1 else 'an indeterminate change'}, which does not match the goal."
    k, ds = sent_opts(txt(wf, wm), "Both policies raise real GDP, while fiscal expansion raises and monetary expansion lowers interest rates." if goal == "raise_noint" else "Fiscal expansion and monetary contraction both raise interest rates, while their effects on real GDP are in opposite directions.",
                      [(txt(f, mo), reasons[(f, mo)]) for (f, mo) in reasons if (f, mo) != want] + [("Neither policy, because policies do not affect interest rates or real GDP in the short run.", "Ignores that fiscal and monetary policy shift aggregate demand and change interest rates.")])
    return mk("ma_policy_goal", "5.1", "2.B", stem, k, ds, rng, concept="choose a policy mix from its determinate and indeterminate effects", path="policy_mix rule table verified against sign simulations for all four combinations", facts=[f"goal={goal}"], est=70)


# ======================= 5.2 필립스 곡선 =======================
def ma_phillips_graph(rng):
    a = rng.choice([8, 10, 12]); b = rng.choice([Fr(1, 1), Fr(3, 2), Fr(2)])
    un = rng.choice([4, 5, 6])  # LRPC
    u_hi = 10
    fn = lambda u: float(a - b * (u - 0) + 0)  # noqa: E731
    pts = []
    infl_target = rng.choice([4, 5, 6])
    k_ = (a - infl_target) / float(b)  # SRPC: pi = a - b*u
    if abs(k_ - round(k_)) > 1e-9 or not (1 <= k_ <= 9):
        raise ValueError("range")
    k_ = int(round(k_))
    srpc = [(u, round(a - float(b) * u, 3)) for u in [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9] if a - float(b) * u > 0.4]
    ymax = a + 1
    stim = econ_graph("Short-run Phillips curve (SRPC) and long-run Phillips curve (LRPC): inflation rate against unemployment rate.", [("SRPC", srpc), ("LRPC", [(un, 0), (un, ymax)])], 10, ymax, 1, 1, xlabel="Unemployment rate (percent)", ylabel="Inflation rate (percent)")
    ask = rng.choice(["u_at", "pi_at"])
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    if ask == "u_at":
        stem = f"The graph shows the short-run Phillips curve (SRPC) and the long-run Phillips curve (LRPC) for an economy. The curves are labeled SRPC and LRPC. If the inflation rate is currently {infl_target} percent on the SRPC, what is the current unemployment rate?"
        key = float(k_)
        agree(a - float(b) * k_, infl_target, 1e-9, "srpc")
        k, ds = val_opts(key, [("Reports the inflation rate as the unemployment rate.", infl_target), ("Reports the natural rate of unemployment from the LRPC.", un), ("Reads the unemployment rate at the vertical intercept of the SRPC.", 0.5), ("Reads the unemployment rate where the SRPC would reach zero inflation.", a / float(b)), ("Adds the inflation rate and the natural rate.", infl_target + un)], f)
        kw = f"On the SRPC, an inflation rate of {infl_target} percent corresponds to an unemployment rate of {k_} percent."
    else:
        stem = f"The graph shows the short-run Phillips curve (SRPC) and the long-run Phillips curve (LRPC) for an economy. The curves are labeled SRPC and LRPC. If the unemployment rate is {k_} percent on the SRPC, what is the inflation rate?"
        key = float(infl_target)
        k, ds = val_opts(key, [("Reports the unemployment rate as the inflation rate.", k_), ("Reports the natural rate of unemployment.", un), ("Reads the inflation rate at the horizontal axis.", 0.0), ("Reads the inflation rate at the top of the vertical axis.", ymax), ("Adds the unemployment rate and the natural rate.", k_ + un)], f)
        kw = f"On the SRPC, an unemployment rate of {k_} percent corresponds to an inflation rate of {infl_target} percent."
    return mk("ma_phillips_graph", "5.2", "2.C", stem, k, ds, rng, concept="read inflation and unemployment on the short-run Phillips curve", path="line equation pi = a - b*u evaluated exactly vs the plotted vertices", stim=stim, kwhy=kw, facts=[f"a={a}", f"b={float(b)}", f"un={un}", f"u={k_}", f"pi={infl_target}", f"ask={ask}"], est=60)


def ma_phillips_move(rng):
    up = rng.choice([True, False])
    ev, mech = _v(rng, AD_UP if up else AD_DOWN)
    d = adas_dirs(1 if up else -1, 0)
    truth = {"P": d["P"], "U": d["U"], "Y": d["Y"]}
    # 필립스: 인플레이션 방향 = 물가 방향(AD 충격 후 단기), 실업 방향 = -Y
    t = {"pi": d["P"], "U": d["U"]}
    mm = {"pi": f"Aggregate demand shifts {'right' if up else 'left'}, so the economy moves {'up' if up else 'down'} along the SRPC and the inflation rate {'rises' if t['pi'] == 1 else 'falls'}.", "U": f"Real GDP {'rises' if d['Y'] == 1 else 'falls'}, so the unemployment rate {'falls' if t['U'] == -1 else 'rises'} along the SRPC."}
    key, ds = combo_item(rng, ["pi", "U"], t, mm, dirs=(1, -1, 0))
    stem = f"An economy is initially at its natural rate of unemployment and expected inflation is unchanged. {ev} What is the most likely short-run effect, shown as a movement along the short-run Phillips curve?"
    return mk("ma_phillips_move", "5.2", "3.A", stem, key, ds, rng, concept="an AD change moves the economy along the short-run Phillips curve", path="adas direction table (price level and real GDP) mapped to inflation and unemployment vs numeric AD-SRAS simulation", facts=[f"up={up}", f"t={t}"], est=70)


PH_EVENTS = [
    ("Workers and firms come to expect higher inflation.", "S", "The SRPC shifts upward (to the right), because higher expected inflation raises wage and price increases at every unemployment rate."),
    ("Workers and firms come to expect lower inflation.", "L", "The SRPC shifts downward (to the left), because lower expected inflation lowers wage and price increases at every unemployment rate."),
    ("A sharp increase in the price of oil raises firms' costs and shifts short-run aggregate supply to the left.", "S", "A negative supply shock raises inflation and unemployment at the same time, shifting the SRPC upward (to the right)."),
    ("A productivity-enhancing technological advance shifts short-run aggregate supply to the right.", "L", "A positive supply shock lowers both inflation and unemployment, shifting the SRPC downward (to the left)."),
    ("The natural rate of unemployment increases because of a rise in structural unemployment.", "N", "The LRPC shifts to the right, and the SRPC shifts with it."),
]
PH_STMT = {"S": "The SRPC shifts upward (to the right).", "L": "The SRPC shifts downward (to the left).", "N": "The LRPC shifts to the right, and the SRPC shifts with it.", "M": "The economy moves along the SRPC with no shift of either curve.", "V": "The LRPC shifts to the left, and the SRPC does not change."}
PH_WHY = {"S": "Predicts an upward shift of the SRPC, but the event lowers inflation expectations or costs.", "L": "Predicts a downward shift of the SRPC, but the event raises inflation expectations or costs.", "N": "Predicts a rightward shift of the LRPC, but the event does not change the natural rate of unemployment.", "M": "Treats the event as a change in AD that moves the economy along a fixed SRPC, but the event shifts the curve.", "V": "Predicts a leftward shift of the LRPC, which would mean a lower natural rate, not implied by the event."}


def ma_phillips_shift(rng):
    ev, ans, mech = _v(rng, PH_EVENTS)
    k, ds = sent_opts(PH_STMT[ans], mech, [(PH_STMT[c], PH_WHY[c]) for c in PH_STMT if c != ans])
    stem = f"Consider the following event in an economy: {ev} Which of the following is the effect on the Phillips curves?"
    return mk("ma_phillips_shift", "5.2", "3.A", stem, k, ds, rng, concept="shifts of the short-run and long-run Phillips curves", path="fixed vetted event-to-curve table consistent with the AD-AS supply-shock rule table", facts=[f"ev={ev[:30]}", f"ans={ans}"], est=60)


LRPC = [
    ("Which of the following is true of the long-run Phillips curve (LRPC)?", "It is vertical at the natural rate of unemployment, so there is no long-run trade-off between inflation and unemployment.", "In the long run unemployment returns to the natural rate whatever the inflation rate is.",
     [("It is downward sloping, so policymakers can permanently lower unemployment by accepting higher inflation.", "Describes the short-run trade-off as if it were permanent."), ("It is horizontal at the natural rate of inflation.", "The LRPC is vertical, not horizontal."), ("It is upward sloping because inflation raises unemployment in the long run.", "Describes stagflation in the short run, not the long-run curve."), ("It shifts whenever aggregate demand increases.", "An AD change moves the economy along the SRPC; the LRPC shifts only when the natural rate changes.")]),
    ("An economy has been at the natural rate of unemployment. The central bank permanently expands the money supply growth. What happens to unemployment in the long run?", "Unemployment returns to the natural rate while inflation stays higher.", "The long-run Phillips curve is vertical at the natural rate.",
     [("Unemployment stays permanently below the natural rate.", "Ignores that expectations adjust and the SRPC shifts."), ("Unemployment rises permanently above the natural rate.", "Does not follow from expansionary policy once expectations adjust."), ("Unemployment keeps falling as long as the money supply keeps growing.", "Treats the short-run trade-off as permanent."), ("Unemployment is unaffected in the short run and the long run.", "Ignores the short-run fall in unemployment along the SRPC.")]),
]


def ma_lrpc(rng):
    q, kt, kw, wr = _v(rng, LRPC)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_lrpc", "5.2", "1.B", q, k, ds, rng, concept="the long-run Phillips curve is vertical at the natural rate", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


def ma_phillips_adas(rng):
    which = rng.choice(["sras_left", "sras_right", "ad_left"])
    if which == "sras_left":
        stem = "In the AD-AS model, short-run aggregate supply shifts to the left. Which of the following correctly describes the effect shown on the short-run Phillips curve?"
        key = "The SRPC shifts upward (to the right), so inflation and unemployment both rise."
        wr = [("The economy moves down along the SRPC, so inflation rises and unemployment falls.", "Describes an AD increase, not a supply shock, and gets the direction of movement wrong."), ("The SRPC shifts downward (to the left), so inflation and unemployment both fall.", "Describes a favorable supply shock, not a leftward SRAS shift."), ("The LRPC shifts to the right, so the natural rate rises.", "A temporary cost shock does not change the natural rate."), ("The economy moves up along the SRPC, so inflation falls and unemployment rises.", "Misdescribes movement along the SRPC; moving up along it means higher inflation and lower unemployment.")]
        kw = "A negative supply shock raises inflation and unemployment together, which is an upward shift of the SRPC."
    elif which == "sras_right":
        stem = "In the AD-AS model, short-run aggregate supply shifts to the right. Which of the following correctly describes the effect shown on the short-run Phillips curve?"
        key = "The SRPC shifts downward (to the left), so inflation and unemployment both fall."
        wr = [("The SRPC shifts upward (to the right), so inflation and unemployment both rise.", "Describes a negative supply shock."), ("The economy moves up along the SRPC, so inflation rises and unemployment falls.", "Describes an AD increase."), ("The LRPC shifts to the left, so the natural rate falls.", "A short-run cost change does not change the natural rate by itself."), ("There is no effect on the Phillips curve, because the AD curve does not shift.", "Supply shocks shift the SRPC even when AD does not shift.")]
        kw = "A positive supply shock lowers inflation and unemployment together, which is a downward shift of the SRPC."
    else:
        stem = "In the AD-AS model, aggregate demand shifts to the left in an economy initially at its natural rate of unemployment. Which of the following correctly describes the effect shown on the short-run Phillips curve?"
        key = "The economy moves down along the SRPC, so unemployment rises and inflation falls."
        wr = [("The SRPC shifts upward (to the right), so unemployment and inflation both rise.", "Describes a negative supply shock, not a fall in AD."), ("The economy moves up along the SRPC, so unemployment falls and inflation rises.", "Reverses the direction of movement along the SRPC."), ("The LRPC shifts to the right, so the natural rate rises.", "A demand shock does not change the natural rate."), ("The SRPC shifts downward (to the left), so unemployment and inflation both fall.", "Describes a favorable supply shock.")]
        kw = "A fall in AD lowers real GDP and the price level, raising unemployment: a movement down along the SRPC."
    k, ds = sent_opts(key, kw, wr)
    return mk("ma_phillips_adas", "5.2", "2.B", stem, k, ds, rng, concept="link AD-AS shocks to movements along and shifts of the Phillips curve", path="fixed vetted pairs consistent with the AD-AS rule table", facts=[f"which={which}"], est=65)


# ======================= 5.3 화폐수량설 =======================
@retry_sep
def ma_quantity_theory(rng):
    kind = rng.choice(["P", "Q", "growth"])
    if kind == "growth":
        gm = rng.choice([4, 5, 6, 8, 10]); gv = rng.choice([0, 0, 1, 2]); gq = rng.choice([2, 3, 4]); gp = gm + gv - gq
        if gp <= 0:
            raise ValueError("not_enough_separated_distractors")
        stem = f"In an economy, the money supply grows at {gm} percent per year, the velocity of money grows at {gv} percent per year, and real output grows at {gq} percent per year. According to the quantity equation (MV = PQ), what is the approximate inflation rate?"
        f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
        k, ds = val_opts(gp, [("Ignores output growth and reports money growth plus velocity growth.", gm + gv), ("Adds output growth instead of subtracting it.", gm + gv + gq), ("Reports money growth only.", gm), ("Subtracts money growth from output growth.", abs(gq - gm)), ("Reports output growth.", gq)], f)
        kw = f"%change in P is about %change in M + %change in V - %change in Q = {gm} + {gv} - {gq} = {gp} percent."
        agree(gp, int(sp.Integer(gm) + sp.Integer(gv) - sp.Integer(gq)), 1e-9, "growth")
        facts = [f"kind=growth", f"gm={gm}", f"gv={gv}", f"gq={gq}", f"gp={gp}"]
    elif kind == "P":
        M = rng.choice([200, 400, 500, 800]); V = rng.choice([2, 4, 5]); Q = rng.choice([400, 500, 800, 1000])
        P = Fr(M * V, Q)
        if P.denominator not in (1, 2, 4, 5):
            raise ValueError("not_enough_separated_distractors")
        stem = f"In an economy, the money supply is ${M:,} billion, the velocity of money is {V}, and real output is {Q:,} billion units. According to the quantity equation (MV = PQ), what is the price level, in dollars per unit?"
        f = lambda v: usd(v)  # noqa: E731
        k, ds = val_opts(float(P), [("Divides real output by the product of money and velocity.", Q / (M * V)), ("Multiplies money, velocity, and output.", float(M * V * Q) / 1000), ("Divides the money supply by real output and ignores velocity.", M / Q), ("Divides money by velocity before dividing by output.", M / V / Q), ("Adds money and velocity and divides by output.", (M + V) / Q)], f)
        kw = f"P = MV/Q = {M} x {V}/{Q} = {nm(float(P), 2)}."
        agree(float(P), float(sp.Rational(M * V, Q)), 1e-9, "P")
        facts = [f"kind=P", f"M={M}", f"V={V}", f"Q={Q}", f"P={float(P):.4f}"]
    else:
        P = rng.choice([2, 4, 5]); Q = rng.choice([200, 400, 500]); V = rng.choice([2, 4, 5])
        M = Fr(P * Q, V)
        if M.denominator != 1:
            raise ValueError("not_enough_separated_distractors")
        stem = f"In an economy, the price level is {usd(P)}, real output is {Q:,} billion units, and the velocity of money is {V}. According to the quantity equation (MV = PQ), what is the money supply, in billions of dollars?"
        f = lambda v: f"${nm(v, 1)} billion"  # noqa: E731
        k, ds = val_opts(float(M), [("Multiplies the price level, output, and velocity.", P * Q * V), ("Divides output by the price level.", Q / P), ("Divides the price level by output and multiplies by velocity.", P / Q * V), ("Ignores velocity and reports nominal GDP.", P * Q), ("Multiplies nominal GDP by velocity and divides by the price level.", P * Q * V / P)], f)
        kw = f"M = PQ/V = {P} x {Q}/{V} = {nm(float(M), 1)}."
        agree(float(M), float(sp.Rational(P * Q, V)), 1e-9, "M")
        facts = [f"kind=M", f"P={P}", f"Q={Q}", f"V={V}", f"M={float(M):.4f}"]
    return mk("ma_quantity_theory", "5.3", "3.C", stem, k, ds, rng, concept="the quantity equation MV = PQ", path="exact fractions vs sympy rationals", kwhy=kw, facts=facts, est=70)


MGI = [
    ("According to the quantity theory of money, if the money supply grows faster than real output and velocity is constant, what is the long-run effect?", "The price level rises, so there is inflation.", "With constant velocity and output growing slower than money, MV = PQ requires a higher price level.",
     [("Real output rises permanently by the same percent as the money supply.", "In the long run output depends on resources and technology, not the money supply."), ("The price level falls, so there is deflation.", "Money growth above output growth raises prices."), ("Velocity falls by exactly enough to keep prices unchanged.", "The question holds velocity constant."), ("Real interest rates fall permanently to zero.", "Not implied by the quantity equation.")]),
    ("Which of the following is the most likely long-run consequence of a central bank that permanently increases the growth rate of the money supply?", "A higher inflation rate with no lasting change in real GDP.", "In the long run money growth affects the price level, not potential output.",
     [("A permanently higher level of real GDP.", "Money growth does not raise potential output in the long run."), ("A permanently lower price level.", "More money growth raises prices."), ("A permanently lower natural rate of unemployment.", "The natural rate is not changed by money growth."), ("A permanently higher real interest rate.", "The long-run real rate is determined by saving and investment, not money growth.")]),
]


def ma_money_growth_inflation(rng):
    q, kt, kw, wr = _v(rng, MGI)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_money_growth_inflation", "5.3", "3.A", q, k, ds, rng, concept="long-run link between money growth and inflation", path="fixed vetted statements; MV = PQ rearranged symbolically", facts=[f"variant={q[:30]}"], est=55)


# ======================= 5.4 적자와 부채 =======================
@retry_sep
def ma_deficit_debt(rng):
    debt0 = rng.choice([800, 1000, 1500, 2000]); g = rng.choice([300, 400, 500, 600]); t = g + rng.choice([-100, -50, 50, 100, 150])
    bal = t - g
    debt1 = debt0 - bal
    ask = rng.choice(["balance", "debt"])
    stim = tbl("Government finances for one year (billions of dollars).", ["Item", "Amount"], [["Government purchases and transfers", usd(g)], ["Tax revenue", usd(t)], ["National debt at the start of the year", usd(debt0)]])
    f = lambda v: f"${int(round(v)):,} billion"  # noqa: E731
    if ask == "balance":
        stem = "The table shows a government's finances for one year. What is the government's budget balance for the year, assuming no other sources of revenue or spending?"
        key = float(bal)
        k, ds = val_opts(key, [("Reverses the subtraction, giving the opposite sign.", -bal), ("Reports tax revenue as the budget balance.", t), ("Reports spending as the budget balance.", g), ("Adds tax revenue and spending.", t + g), ("Reports the national debt at the start of the year.", debt0)], lambda v: (f"A surplus of ${int(round(v)):,} billion" if v > 0 else f"A deficit of ${abs(int(round(v))):,} billion" if v < 0 else "A balanced budget"))
        kw = f"Budget balance = tax revenue - spending = {t} - {g} = {bal}: {'a surplus' if bal > 0 else 'a deficit'}."
    else:
        stem = "The table shows a government's finances for one year. If the government finances any deficit by borrowing and uses any surplus to repay debt, what is the national debt at the end of the year?"
        key = float(debt1)
        k, ds = val_opts(key, [("Reports the debt at the start of the year.", debt0), ("Reverses the effect of the budget balance on the debt.", debt0 + bal), ("Adds spending to the debt.", debt0 + g), ("Subtracts tax revenue from the starting debt.", debt0 - t), ("Reports the deficit or surplus as the new debt.", abs(bal))], f)
        kw = f"The budget balance is {bal}, so debt at the end of the year = {debt0} - ({bal}) = {debt1}."
    agree(float(debt1), float(sp.Integer(debt0) - (sp.Integer(t) - sp.Integer(g))), 1e-9, "debt")
    return mk("ma_deficit_debt", "5.4", "3.C", stem, k, ds, rng, concept="deficits add to the national debt and surpluses reduce it", path="integer arithmetic vs sympy", stim=stim, kwhy=kw, facts=[f"g={g}", f"t={t}", f"debt0={debt0}", f"ask={ask}", f"key={key:.1f}"], est=65)


DEF = [
    ("Which of the following correctly distinguishes the budget deficit from the national debt?", "The deficit is the yearly amount by which spending exceeds revenue, and the debt is the accumulated total of past deficits.", "The deficit is a flow; the debt is a stock.",
     [("The deficit is the total amount the government owes, and the debt is the annual shortfall.", "Reverses the stock and flow."), ("The deficit and the debt are the same measure expressed in different years.", "They are different: one is a yearly flow, the other an accumulated stock."), ("The debt falls whenever the government runs a deficit because borrowing is repaid.", "A deficit adds to the debt."), ("The deficit is the amount of money the central bank prints each year.", "A deficit is financed by borrowing, not by definition by money creation.")]),
    ("A government that has been running budget deficits for many years begins to run a budget surplus. Which of the following is true?", "The national debt falls, although it may remain large.", "A surplus is used to repay debt, so the stock of debt falls.",
     [("The national debt rises, because the government is saving.", "A surplus reduces the debt."), ("The national debt disappears immediately.", "A surplus reduces the debt only gradually."), ("The national debt does not change, because debt depends only on past deficits.", "The debt changes with each year's budget balance."), ("The deficit rises, because the surplus must be borrowed.", "A surplus means revenue exceeds spending.")]),
]


def ma_deficit_vs_debt(rng):
    q, kt, kw, wr = _v(rng, DEF)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_deficit_vs_debt", "5.4", "1.B", q, k, ds, rng, concept="budget deficit (flow) versus national debt (stock)", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


@retry_sep
def ma_debt_gdp(rng):
    debt = rng.choice([600, 800, 900, 1200, 1500]); gdp = rng.choice([1000, 1200, 1500, 2000, 3000])
    ratio = Fr(debt, gdp) * 100
    gdp2 = gdp * rng.choice([Fr(11, 10), Fr(6, 5), Fr(5, 4)])
    if gdp2.denominator != 1:
        raise ValueError("not_enough_separated_distractors")
    gdp2 = int(gdp2); r2 = Fr(debt, gdp2) * 100
    ask = rng.choice(["ratio", "later"])
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    if ask == "ratio":
        stem = f"A country's national debt is ${debt:,} billion and its GDP is ${gdp:,} billion. What is the national debt as a percent of GDP?"
        key = float(ratio)
        k, ds = val_opts(key, [("Divides GDP by the debt.", gdp / debt * 100), ("Divides the debt by GDP without converting to a percent.", debt / gdp), ("Subtracts the debt from GDP.", gdp - debt), ("Divides the debt by the sum of the debt and GDP.", debt / (debt + gdp) * 100), ("Reports the debt in billions.", debt)], f)
        kw = f"Debt/GDP = {debt}/{gdp} = {nm(key, 1)} percent."
        agree(key, float(sp.Rational(debt, gdp) * 100), 1e-9, "ratio")
    else:
        stem = f"A country's national debt is ${debt:,} billion, and it does not change. The country's GDP grows from ${gdp:,} billion to ${gdp2:,} billion. What is the national debt as a percent of GDP after the growth?"
        key = float(r2)
        k, ds = val_opts(key, [("Reports the ratio before GDP grows.", float(ratio)), ("Divides the new GDP by the debt.", gdp2 / debt * 100), ("Adds the growth rate to the original ratio.", float(ratio) + (gdp2 / gdp - 1) * 100), ("Divides the debt by the increase in GDP.", debt / (gdp2 - gdp) * 100), ("Reports the debt as a fraction of GDP without converting to a percent.", debt / gdp2)], f)
        kw = f"Debt/GDP after growth = {debt}/{gdp2} = {nm(key, 1)} percent, lower than before."
        agree(key, float(sp.Rational(debt, gdp2) * 100), 1e-9, "r2")
    return mk("ma_debt_gdp", "5.4", "2.C", stem, k, ds, rng, concept="national debt relative to GDP", path="exact fraction vs sympy rational", kwhy=kw, facts=[f"debt={debt}", f"gdp={gdp}", f"gdp2={gdp2}", f"ask={ask}", f"key={key:.4f}"], est=60)


# ======================= 5.5 구축효과 =======================
def ma_crowding_out(rng):
    up = rng.choice([True, False])
    ev = "The government increases its budget deficit and finances it by borrowing from private savers." if up else "The government reduces its budget deficit, so it borrows less from private savers."
    d = lf_dirs(0, 1 if up else -1)
    r = d["r"]
    inv = -1 if up else 1  # 민간 투자
    # 독립 경로: 민간이 쓰는 자금 = 총 거래량 - 정부 차입(+이동분) — 이동폭 시뮬레이션
    for (kd, ks) in [(3, 1), (1, 3), (2, 2)]:
        m = Mkt(40, 20, Fr(1), Fr(1))
        q0, p0 = m.eq_exact(); gov = 10 * kd if up else -10 * kd
        q1, p1 = m.eq_exact(dA=gov)
        agree(1 if (q0 - 0) is not None else 0, 1, 1e-9, "x")
        priv0 = q0; priv1 = q1 - gov
        agree(1, 1 if (_sg(priv1 - priv0) == inv and _sg(p1 - p0) == r) else 0, 1e-9, "crowd")
    mm = {"r": f"Government borrowing changes the demand for loanable funds, so the real interest rate {'rises' if r == 1 else 'falls'}.", "I": f"The {'higher' if r == 1 else 'lower'} real interest rate {'reduces' if inv == -1 else 'raises'} private investment: {'crowding out' if up else 'crowding in'} private borrowing."}
    key, ds = combo_item(rng, ["r", "I"], {"r": r, "I": inv}, mm, dirs=(1, -1, 0))
    stem = f"In the market for loanable funds: {ev} What is the most likely effect on the real interest rate and on private investment spending?"
    return mk("ma_crowding_out", "5.5", "3.B", stem, key, ds, rng, concept="crowding out: government borrowing raises the real interest rate and lowers private investment", path="loanable funds equilibrium before and after government borrowing; private funds = total minus government borrowing", facts=[f"up={up}", f"r={r}", f"inv={inv}"], est=65)


def ma_crowding_graph(rng):
    m = new_mkt(rng, 30, 60, 20, 50)
    gov = 20
    q0, p0 = mkt_check(m); q1, p1 = mkt_check(m, dA=gov)
    d = lf_dirs(0, 1)
    if (_sg(float(p1 - p0)), _sg(float(q1 - q0))) != (d["r"], d["Q"]):
        raise ValueError("graph_rule")
    cur = [("D1", line_pts(m.A, -m.B, 0, m.A / m.B)), ("D2", line_pts(m.A + gov, -m.B, 0, (m.A + gov) / m.B)), ("S", line_pts(m.C, m.D, 0, 100))]
    yhi = int(m.A + gov) + 10
    stim = econ_graph("Loanable funds market: the government's increased borrowing shifts demand from D1 to D2, moving the equilibrium from E1 to E2.", cur, 100, yhi, 10, 20, points=[("E1", m.Q0, m.P0), ("E2", float(q1), float(p1))], xlabel="Quantity of loanable funds (billions of dollars)", ylabel="Real interest rate (percent)")
    stem = "The graph shows the market for loanable funds when the government increases its borrowing to finance a larger budget deficit. Which of the following describes the effect shown by the move from E1 to E2?"
    k, ds = sent_opts("The real interest rate rises, and private investment falls because some private borrowing is crowded out.", "Demand for loanable funds increases from D1 to D2, so the real interest rate rises and private borrowers cut back.",
                      [("The real interest rate falls, and private investment rises because the government supplies funds.", "Treats government borrowing as an increase in the supply of loanable funds."), ("The real interest rate rises, and private investment rises because firms expect higher returns.", "Ignores that a higher real interest rate reduces private investment."), ("The real interest rate does not change, because the government borrows only a small amount.", "Any increase in demand for loanable funds raises the real interest rate."),
                       ("The real interest rate falls, and private investment falls because households save less.", "The graph shows demand shifting, not saving falling; and a lower rate would not reduce investment."), ("The supply of loanable funds shifts to the left, so the real interest rate rises.", "The graph shows the demand curve shifting, not the supply curve.")])
    return mk("ma_crowding_graph", "5.5", "3.B", stem, k, ds, rng, concept="crowding out shown on the loanable funds graph", path="equilibrium recomputed exactly and by sympy; direction rule table", stim=stim, facts=[f"r0={m.P0}", f"Q0={m.Q0}", f"r1={float(p1):.3f}", f"Q1={float(q1):.3f}"], est=70)


CROWD = [
    ("Crowding out is best described as", "a decrease in private investment caused by higher interest rates that result from government borrowing.", "Government borrowing raises the real interest rate, reducing private investment.",
     [("an increase in private investment caused by lower interest rates that result from government spending.", "Reverses the effect on interest rates and investment."), ("a decrease in government spending caused by lower tax revenue.", "Describes a fiscal squeeze, not an effect on private investment."), ("a decrease in imports caused by a weaker currency.", "Describes an exchange-rate effect, not crowding out."), ("an increase in saving caused by higher taxes.", "Not the definition of crowding out.")]),
]


def ma_crowding_concept(rng):
    q, kt, kw, wr = CROWD[0]
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_crowding_concept", "5.5", "1.A", q, k, ds, rng, concept="definition of crowding out", path="fixed vetted statements", facts=["variant=crowding_concept"], est=45)


# ======================= 5.6·5.7 경제성장 =======================
GROW = [
    ("Which of the following is a source of long-run economic growth?", "An increase in the stock of physical and human capital.", "More capital raises productivity and potential output.",
     [("An increase in the price level.", "A higher price level does not raise potential output."), ("An increase in nominal wages.", "Nominal wages affect costs, not potential output."), ("An increase in government transfer payments.", "Transfers move income and do not directly raise productive capacity."), ("A decrease in the labor force.", "A smaller labor force lowers potential output.")]),
    ("Which of the following would most likely increase the growth rate of potential output over many years?", "Greater investment in education and new technology.", "Human capital and technology raise productivity over time.",
     [("A temporary increase in consumer spending.", "A temporary demand increase affects short-run output, not potential output."), ("A price ceiling on essential goods.", "A price control distorts markets and does not raise potential output."), ("A temporary decrease in the price of oil.", "A temporary cost shock shifts SRAS but not potential output."), ("An increase in the money supply.", "Money growth raises prices in the long run, not potential output.")]),
]


def ma_growth_sources(rng):
    q, kt, kw, wr = _v(rng, GROW)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_growth_sources", "5.6", "1.A", q, k, ds, rng, concept="sources of long-run economic growth", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=50)


GL = [
    ("A permanent improvement in technology occurs in an economy. What happens to the production possibilities curve (PPC) and to the long-run aggregate supply (LRAS) curve?", "Both shift outward (the PPC outward and LRAS to the right).", "Better technology raises potential output, shifting both curves.",
     [("The PPC shifts outward and LRAS does not change.", "Overlooks that a higher potential output also shifts LRAS."), ("Both shift inward (the PPC inward and LRAS to the left).", "Predicts the opposite direction for both curves."), ("The PPC does not change and LRAS shifts to the right.", "The two curves both represent productive capacity and shift together."), ("The PPC shifts inward and LRAS shifts to the right.", "Predicts opposite movements for two curves that measure the same capacity.")]),
    ("A large increase in the capital stock of an economy would most likely cause which of the following?", "The PPC shifts outward and the LRAS curve shifts to the right.", "More capital raises productive capacity.",
     [("The PPC shifts inward and the LRAS curve shifts to the right.", "Predicts opposite movements for two curves that measure the same capacity."), ("The PPC does not change and the AD curve shifts to the left.", "Confuses a capacity increase with a fall in demand."), ("The PPC shifts outward and the LRAS curve does not change.", "Overlooks that a higher potential output also shifts LRAS."), ("The economy moves to a point inside the PPC.", "An increase in capacity does not by itself create unused resources.")]),
]


def ma_growth_lras(rng):
    q, kt, kw, wr = _v(rng, GL)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_growth_lras", "5.6", "3.A", q, k, ds, rng, concept="growth shifts the PPC outward and LRAS to the right", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


@retry_sep
def ma_productivity_growth(rng):
    r0 = rng.choice([1000, 1200, 2000, 3000]); g = rng.choice([2, 4, 5, 10]); r1 = r0 * (100 + g) // 100
    if r0 * (100 + g) % 100:
        raise ValueError("not_enough_separated_distractors")
    l0 = rng.choice([50, 100, 200]); gl = rng.choice([0, 0, 2, 4]); l1 = l0 * (100 + gl) // 100
    if l0 * (100 + gl) % 100:
        raise ValueError("not_enough_separated_distractors")
    p0, p1 = Fr(r0, l0), Fr(r1, l1)
    gp = float((p1 / p0 - 1) * 100)
    agree(gp, float((sp.Rational(r1, l1) / sp.Rational(r0, l0) - 1) * 100), 1e-9, "prod")
    stim = tbl("Real GDP and employment in a country.", ["Year", "Real GDP (billions)", "Workers (millions)"], [["Year 1", usd(r0), l0], ["Year 2", usd(r1), l1]])
    stem = "The table shows real GDP and the number of workers in a country in two years. By approximately what percent did output per worker (labor productivity) change?"
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    k, ds = val_opts(gp, [("Reports the growth rate of real GDP and ignores employment growth.", g), ("Adds the growth rates of real GDP and employment.", g + gl), ("Reports the growth rate of employment.", gl), ("Reports the level of output per worker in Year 2.", float(p1)), ("Reports the dollar change in real GDP.", r1 - r0)], f)
    return mk("ma_productivity_growth", "5.6", "2.C", stem, k, ds, rng, concept="labor productivity growth is output growth minus employment growth", path="exact output-per-worker ratio vs sympy rational ratio", stim=stim, kwhy=f"Output per worker rises from {nm(float(p0), 2)} to {nm(float(p1), 2)}, about {f(gp)}.", facts=[f"r0={r0}", f"r1={r1}", f"l0={l0}", f"l1={l1}", f"gp={gp:.4f}"], est=75)


GP = [
    ("Which of the following government policies is most likely to increase an economy's long-run growth rate?", "Subsidizing research and development and investment in education.", "These policies raise the stock of knowledge and human capital.",
     [("Imposing price ceilings on consumer goods.", "Price ceilings create shortages and do not raise productive capacity."), ("Raising tariffs on imported capital goods.", "Tariffs on capital goods raise the cost of investment and slow capital accumulation."), ("Increasing transfer payments without any change in investment.", "Transfers do not raise productive capacity by themselves."), ("Reducing spending on infrastructure.", "Infrastructure spending raises productivity.")]),
    ("A country reduces the barriers to saving and investment in new capital. Which of the following is the most likely result in the long run?", "Potential output grows faster, shifting the LRAS curve to the right over time.", "More capital raises productivity.",
     [("Potential output falls, shifting the LRAS curve to the left.", "Reverses the effect of more capital."), ("Only the price level changes, and potential output stays the same.", "More capital raises potential output."), ("Aggregate demand shifts to the left permanently.", "Saving and investment policies do not imply a permanent fall in AD."), ("The natural rate of unemployment must rise.", "Investment in capital does not require a higher natural rate.")]),
]


def ma_growth_policy(rng):
    q, kt, kw, wr = _v(rng, GP)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_growth_policy", "5.7", "2.A", q, k, ds, rng, concept="policies that raise long-run growth", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


GT = [
    ("An economy chooses to devote more resources to capital goods and fewer to consumer goods today. Which of the following describes the trade-off and the likely long-run result?", "Consumption is lower today, but the PPC may shift outward in the future as the capital stock grows.", "Investing now has an opportunity cost today and raises productive capacity later.",
     [("There is no trade-off, because capital goods are also consumer goods.", "Ignores the opportunity cost along the PPC."), ("Consumption is higher today and the PPC shifts inward in the future.", "Reverses both the current and the long-run effects."), ("Consumption is lower today, and the PPC shifts inward in the future.", "More capital goods raise future capacity."), ("Consumption is unchanged today, and the PPC shifts outward in the future.", "Ignores the current trade-off between capital and consumer goods.")]),
]


def ma_growth_tradeoff(rng):
    q, kt, kw, wr = GT[0]
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_growth_tradeoff", "5.7", "1.D", q, k, ds, rng, concept="growth policies have a present opportunity cost", path="fixed vetted statements", facts=["variant=growth_tradeoff"], est=60)


def ma_growth_graph(rng):
    sc = adas_scene(rng, "none"); sc_check(sc)
    sh = rng.choice([20, 25])
    cur, xhi, yhi = adas_curves(sc)
    cur = [c for c in cur if c[0] != "LRAS"] + [("LRAS1", [(sc["Yf"], 0), (sc["Yf"], yhi)]), ("LRAS2", [(sc["Yf"] + sh, 0), (sc["Yf"] + sh, yhi)])]
    stim = econ_graph("AD, SRAS, and two long-run aggregate supply curves, LRAS1 and LRAS2, for an economy.", cur, xhi, yhi, 20, 20, points=[("E", sc["Y0"], sc["P0"])], **AXES)
    stem = "The graph shows a rightward shift of long-run aggregate supply from LRAS1 to LRAS2. Which of the following events is most likely to have caused the shift?"
    k, ds = sent_opts("A permanent increase in the economy's stock of capital and productivity.", "Greater capital and productivity raise potential output, which shifts LRAS to the right.",
                      [("An increase in the price level caused by higher aggregate demand.", "A price-level change moves the economy along SRAS; it does not shift LRAS."), ("A temporary decrease in the price of oil.", "A temporary cost change shifts SRAS but not LRAS."), ("An increase in government purchases.", "A change in government purchases shifts AD, not LRAS."), ("A decrease in nominal wages in a recession.", "Falling nominal wages shift SRAS in the long-run adjustment; potential output is unchanged.")])
    return mk("ma_growth_graph", "5.6", "3.A", stem, k, ds, rng, concept="a rightward LRAS shift reflects higher potential output", path="graph vertices LRAS2 > LRAS1; fixed vetted cause table", stim=stim, facts=[f"Yf={sc['Yf']}", f"sh={sh}"], est=60)
