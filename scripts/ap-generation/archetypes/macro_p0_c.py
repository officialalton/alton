"""AP Macroeconomics 원형 C — 단원 3(국민소득과 물가 결정: AD·승수·SRAS·LRAS·균형·충격·장기 조정·재정정책). 2026-10-14."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401
from macro_models import *  # noqa: F401,F403


def _v(rng, table):
    return table[rng.randrange(len(table))]


# ======================= 3.1 총수요 =======================
AD_STMT = {
    "A+": "Aggregate demand shifts to the right.", "A-": "Aggregate demand shifts to the left.", "S+": "Short-run aggregate supply shifts to the right.", "S-": "Short-run aggregate supply shifts to the left.",
    "M": "The economy moves along the aggregate demand curve.",
}


def ma_ad_determinants(rng):
    up = rng.choice([True, False])
    ev, mech = _v(rng, AD_UP if up else AD_DOWN)
    key = "A+" if up else "A-"
    wrong = {
        "A+": "Predicts a rightward shift of aggregate demand, but the event reduces spending at every price level.", "A-": "Predicts a leftward shift of aggregate demand, but the event increases spending at every price level.",
        "S+": "Predicts a rightward shift of short-run aggregate supply; the event changes spending, not production costs.", "S-": "Predicts a leftward shift of short-run aggregate supply; the event changes spending, not production costs.",
        "M": "Treats the event as a change in the price level, which moves the economy along the AD curve; the event itself is a determinant that shifts the curve.",
    }
    if not up:
        wrong["A+"] = "Predicts a rightward shift of aggregate demand, but the event reduces spending at every price level."
    else:
        wrong["A-"] = "Predicts a leftward shift of aggregate demand, but the event increases spending at every price level."
    cand = [c for c in AD_STMT if c != key]
    k, ds = sent_opts(AD_STMT[key], mech, [(AD_STMT[c], wrong[c]) for c in cand])
    stem = f"Consider the following event in an economy: {ev} Which of the following is the most likely immediate effect in the aggregate demand-aggregate supply model?"
    return mk("ma_ad_determinants", "3.1", "3.A", stem, k, ds, rng, concept="determinants shift aggregate demand", path="fixed vetted event-to-curve table", facts=[f"event={ev[:40]}", f"key={key}"], est=55)


ADSLOPE = [
    ("Which of the following helps explain why the aggregate demand curve slopes downward?", "A lower price level raises the real value of wealth held in nominal assets, which increases consumption.", "The wealth effect: a lower price level raises real wealth and consumption.",
     [("A lower price level raises the cost of production, which reduces output.", "Describes a supply-side effect and has the sign wrong; costs are not what makes AD slope down."), ("A lower price level increases the quantity of goods that firms want to supply.", "Describes the upward-sloping short-run supply curve, not aggregate demand."), ("A lower price level makes the country's goods more expensive relative to foreign goods, which raises net exports.", "A lower domestic price level makes domestic goods cheaper, not more expensive."),
      ("A lower price level raises the nominal interest rate, which increases investment.", "A lower price level reduces money demand and lowers the interest rate; a higher nominal interest rate would reduce investment.")]),
    ("A fall in the price level causes the interest rate to fall and investment to rise. This is best described as which of the following?", "The interest-rate effect, one reason why the aggregate demand curve slopes downward.", "A lower price level lowers money demand and interest rates, which raises interest-sensitive spending.",
     [("The wealth effect, one reason why the aggregate supply curve slopes upward.", "Mixes up the wealth effect with the interest-rate effect and puts it on the supply side."), ("A shift of the aggregate demand curve to the right.", "A change in the price level causes a movement along AD, not a shift."), ("The crowding-out effect of government borrowing.", "Crowding out is about government borrowing raising interest rates, not about a lower price level."),
      ("The multiplier effect of a change in autonomous spending.", "The multiplier describes the amplification of a spending change, not the price-level effect on investment.")]),
    ("A fall in the price level makes the country's goods cheaper relative to foreign goods, so net exports rise. This is best described as", "the exchange-rate (international trade) effect, one reason why the aggregate demand curve slopes downward.", "Cheaper domestic goods raise net exports as the price level falls.",
     [("the wealth effect, which makes the aggregate demand curve slope upward.", "Confuses the trade effect with the wealth effect and gets the slope wrong."), ("a shift of the aggregate demand curve caused by higher foreign income.", "A change in the price level is a movement along AD; foreign income would shift it."), ("the real balance effect on the supply of money.", "Not an effect on net exports."),
      ("the reason the long-run aggregate supply curve is vertical.", "LRAS is vertical because potential output does not depend on the price level; this effect concerns spending.")]),
]


def ma_ad_slope(rng):
    q, kt, kw, wr = _v(rng, ADSLOPE)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_ad_slope", "3.1", "1.A", q, k, ds, rng, concept="why the aggregate demand curve slopes downward: wealth, interest-rate, and exchange-rate effects", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


ADVD = [
    ("Which of the following correctly distinguishes the aggregate demand curve from the demand curve for a single good?", "The aggregate demand curve relates the overall price level to the total quantity of real output demanded.", "AD shows the price level on the vertical axis and real GDP demanded on the horizontal axis.",
     [("The aggregate demand curve slopes downward because of the substitution effect between goods.", "The substitution effect explains a single good's demand; AD slopes downward because of the wealth, interest-rate, and exchange-rate effects."), ("The aggregate demand curve is vertical in the long run.", "The vertical long-run curve is LRAS, not AD."), ("The aggregate demand curve is the horizontal sum of the demand curves for all goods.", "Adding individual demand curves ignores that AD uses the overall price level, not individual relative prices."),
      ("The aggregate demand curve measures nominal GDP on the horizontal axis.", "AD is drawn with real GDP, not nominal GDP, on the horizontal axis.")]),
]


def ma_ad_vs_demand(rng):
    q, kt, kw, wr = ADVD[0]
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_ad_vs_demand", "3.1", "1.D", q, k, ds, rng, concept="aggregate demand versus market demand for a single good", path="fixed vetted statements", facts=["variant=ad_vs_demand"], est=55, judgment="distinguish the macro AD curve from a microeconomic demand curve")


# ======================= 3.2 승수 =======================
@retry_sep
def ma_multiplier_calc(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5), Fr(9, 10)]); dg = rng.choice([20, 40, 50, 100, 200]); kind = rng.choice(["raise", "cut"])
    mult = 1 / (1 - mpc)
    d = dg * mult
    agree(float(d), float(dg / (1 - sp.Rational(mpc.numerator, mpc.denominator))), 1e-9, "mult")
    sgn = 1 if kind == "raise" else -1
    verb = "increases" if kind == "raise" else "decreases"
    stem = f"The marginal propensity to consume (MPC) in an economy is {nm(float(mpc), 2)}. The government {verb} its purchases of goods and services by ${dg} billion, and taxes do not change. Assuming the price level is constant, what is the maximum change in real GDP?"
    f = lambda v: (("+" if v > 0 else "-") if v != 0 else "") + f"${abs(int(round(v))):,} billion"  # noqa: E731
    mps = 1 - mpc
    k, ds = val_opts(sgn * float(d), [("Uses the reciprocal of the MPC as the multiplier instead of 1/(1 - MPC).", sgn * dg / float(mpc)), ("Uses MPC/(1 - MPC), the tax multiplier, for a change in government purchases.", sgn * dg * float(mpc / (1 - mpc))), ("Reports only the initial change in spending, ignoring the multiplier.", sgn * dg), ("Multiplies the change by the MPC only.", sgn * dg * float(mpc)),
                                       ("Gets the direction of the change wrong.", -sgn * float(d)), ("Uses 1/(1 + MPC) as the multiplier.", sgn * dg / (1 + float(mpc)))], f)
    return mk("ma_multiplier_calc", "3.2", "3.C", stem, k, ds, rng, concept="spending multiplier = 1/(1 - MPC)", path="exact fraction vs sympy rational", kwhy=f"The multiplier is 1/(1 - {nm(float(mpc), 2)}) = {nm(float(mult), 2)}, so the maximum change in real GDP is {sgn} x {dg} x {nm(float(mult), 2)} = {nm(sgn * float(d), 1)}.", facts=[f"mpc={float(mpc):.4f}", f"dg={dg}", f"kind={kind}", f"d={sgn * float(d):.4f}"], est=70)


@retry_sep
def ma_mpc_from_data(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5)]); base_c = rng.choice([200, 300, 400]); step = rng.choice([100, 200])
    di = [800, 800 + step, 800 + 2 * step]
    cons = [base_c + (mpc * (d - di[0])) for d in di]
    cons = [int(c) for c in cons]
    if any(abs(c - (base_c + mpc * (d - di[0]))) > 1e-9 for c, d in zip(cons, di)):
        raise ValueError("not_enough_separated_distractors")
    ask = rng.choice(["mpc", "mult"])
    stim = tbl("Disposable income and consumption spending in an economy (billions of dollars).", ["Disposable income", "Consumption"], [[usd(d), usd(c)] for d, c in zip(di, cons)])
    mps = 1 - mpc
    mult = 1 / mps
    if ask == "mpc":
        stem = "The table shows disposable income and consumption in an economy. What is the marginal propensity to consume (MPC)?"
        key = float(mpc)
        k, ds = val_opts(key, [("Reports the marginal propensity to save instead of the MPC.", float(mps)), ("Divides consumption by disposable income at the first row.", cons[0] / di[0]), ("Divides the change in income by the change in consumption.", 1 / float(mpc)), ("Reports the spending multiplier instead of the MPC.", float(mult)), ("Divides the change in consumption by the final level of income.", (cons[2] - cons[0]) / di[2])], lambda v: nm(v, 2))
        kw = f"MPC = change in consumption / change in disposable income = {cons[1] - cons[0]}/{di[1] - di[0]} = {nm(key, 2)}."
    else:
        stem = "The table shows disposable income and consumption in an economy. Based on the table, what is the spending multiplier?"
        key = float(mult)
        k, ds = val_opts(key, [("Reports the MPC instead of the multiplier.", float(mpc)), ("Uses 1/MPC instead of 1/(1 - MPC).", 1 / float(mpc)), ("Uses MPC/(1 - MPC) instead of 1/(1 - MPC).", float(mpc / mps)), ("Reports the marginal propensity to save.", float(mps)), ("Uses 1/(1 + MPC).", 1 / (1 + float(mpc)))], lambda v: nm(v, 2))
        kw = f"MPC = {cons[1] - cons[0]}/{di[1] - di[0]} = {nm(float(mpc), 2)}, so the multiplier = 1/(1 - MPC) = {nm(key, 2)}."
    agree(float(mpc), float(sp.Rational(cons[1] - cons[0], di[1] - di[0])), 1e-9, "mpc")
    return mk("ma_mpc_from_data", "3.2", "1.C", stem, k, ds, rng, concept="MPC from consumption data and the multiplier", path="exact ratio of changes vs sympy rational", stim=stim, kwhy=kw, facts=[f"mpc={float(mpc):.4f}", f"ask={ask}", f"key={key:.4f}"], est=70)


@retry_sep
def ma_tax_multiplier(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5)]); dt = rng.choice([20, 40, 50, 100]); cut = rng.choice([True, False])
    tm = mpc / (1 - mpc); sm = 1 / (1 - mpc)
    d = dt * tm * (1 if cut else -1)
    agree(float(d), float(dt * sp.Rational(mpc.numerator, mpc.denominator) / (1 - sp.Rational(mpc.numerator, mpc.denominator))) * (1 if cut else -1), 1e-9, "tm")
    verb = "cuts" if cut else "raises"
    stem = f"The marginal propensity to consume (MPC) is {nm(float(mpc), 2)}. The government {verb} lump-sum taxes by ${dt} billion, and government purchases do not change. Assuming the price level is constant, what is the maximum change in real GDP?"
    sg = 1 if cut else -1
    f = lambda v: (("+" if v > 0 else "-") if v != 0 else "") + f"${abs(int(round(v))):,} billion"  # noqa: E731
    k, ds = val_opts(float(d), [("Uses the spending multiplier 1/(1 - MPC), which applies to government purchases, instead of the tax multiplier.", sg * dt * float(sm)), ("Reports only the initial change in taxes, ignoring the multiplier.", sg * dt), ("Uses the tax multiplier but gets the direction of the effect wrong.", -sg * float(d)), ("Multiplies the tax change by the MPC only, ignoring the multiplier process.", sg * dt * float(mpc)), ("Uses the reciprocal of the tax multiplier.", sg * dt / float(tm))], f)
    return mk("ma_tax_multiplier", "3.2", "3.C", stem, k, ds, rng, concept="tax multiplier = -MPC/(1 - MPC)", path="exact fraction vs sympy rational", kwhy=f"The tax multiplier is MPC/(1 - MPC) = {nm(float(tm), 2)} in absolute value, so the change in real GDP is {nm(float(d), 1)}.", facts=[f"mpc={float(mpc):.4f}", f"dt={dt}", f"cut={cut}", f"d={float(d):.4f}"], est=75)


@retry_sep
def ma_balanced_budget(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5), Fr(9, 10)]); dg = rng.choice([50, 100, 200]); up = rng.choice([True, False])
    d = dg * (1 if up else -1)
    sm = 1 / (1 - mpc); tm = mpc / (1 - mpc)
    agree(float(dg * sm - dg * tm), dg, 1e-9, "balanced")
    verb = "increases" if up else "decreases"
    stem = f"The government {verb} both its purchases and its taxes by ${dg} billion, and the marginal propensity to consume is {nm(float(mpc), 2)}. Assuming the price level is constant, which of the following is the maximum change in real GDP?"
    f = lambda v: (("+" if v > 0 else "-") if v != 0 else "") + f"${abs(int(round(v))):,} billion"  # noqa: E731
    sg = 1 if up else -1
    k, ds = val_opts(float(d), [("Applies the spending multiplier to the change in purchases and ignores the offsetting tax change.", sg * dg * float(sm)), ("Applies the tax multiplier only.", -sg * dg * float(tm)), ("Reports no change, because the budget is balanced.", 0), ("Adds the spending and tax effects instead of netting them.", sg * dg * float(sm + tm)), ("Reports the change in real GDP with the wrong sign.", -sg * dg)], f)
    return mk("ma_balanced_budget", "3.2", "3.C", stem, k, ds, rng, concept="balanced-budget multiplier equals 1", path="spending multiplier effect plus tax multiplier effect computed exactly vs the direct result", kwhy=f"Spending effect {nm(float(dg * sm), 1)} plus tax effect {nm(-float(dg * tm), 1)} equals {dg}: the balanced-budget multiplier is 1.", facts=[f"mpc={float(mpc):.4f}", f"dg={dg}", f"up={up}", f"d={float(d):.1f}"], est=75)


MULT_FIXED = [
    ("Which of the following would increase the size of the spending multiplier?", "An increase in the marginal propensity to consume.", "A higher MPC raises 1/(1 - MPC), so each round of spending is larger.",
     [("An increase in the marginal propensity to save.", "A higher MPS means a lower MPC and a smaller multiplier."), ("An increase in the income tax rate.", "Higher tax rates leak spending out of each round and reduce the multiplier."), ("An increase in the share of income spent on imports.", "Import spending leaks out of the domestic spending stream and reduces the multiplier."), ("A decrease in autonomous spending.", "Changes in autonomous spending change the size of the initial shock, not the multiplier.")]),
    ("An increase in autonomous investment of $10 billion increases real GDP by $40 billion. What is the spending multiplier and the marginal propensity to consume?", "The multiplier is 4 and the MPC is 0.75.", "Multiplier = 40/10 = 4 and 1/(1 - MPC) = 4 gives MPC = 0.75.",
     [("The multiplier is 4 and the MPC is 0.25.", "Takes the reciprocal of the multiplier as the MPC; that value is the marginal propensity to save."), ("The multiplier is 4 and the MPC is 0.80.", "Uses 1 - 1/(multiplier + 1) instead of 1 - 1/multiplier."), ("The multiplier is 0.25 and the MPC is 0.75.", "Inverts the multiplier by dividing the initial change by the final change."), ("The multiplier is 40 and the MPC is 0.975.", "Treats the change in GDP as the multiplier instead of dividing by the spending change.")]),
]


def ma_multiplier_concept(rng):
    q, kt, kw, wr = _v(rng, MULT_FIXED)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_multiplier_concept", "3.2", "1.D" if "increase the size" in q else "2.C", q, k, ds, rng, concept="what changes the spending multiplier and how to infer MPC from a GDP change", path="fixed vetted statements; the numeric variant recomputed by 1/(1 - MPC)", facts=[f"variant={q[:30]}"], est=60)


# ======================= 3.3 SRAS =======================
SR_STMT = {"S+": "Short-run aggregate supply shifts to the right.", "S-": "Short-run aggregate supply shifts to the left.", "A+": "Aggregate demand shifts to the right.", "A-": "Aggregate demand shifts to the left.", "M": "The economy moves along the short-run aggregate supply curve."}


def ma_sras_determinants(rng):
    up = rng.choice([True, False])
    ev, mech, perm = _v(rng, SRAS_UP if up else SRAS_DOWN)
    key = "S+" if up else "S-"
    wrong = {"S+": "Predicts a rightward shift of short-run aggregate supply, but the event raises firms' costs.", "S-": "Predicts a leftward shift of short-run aggregate supply, but the event lowers firms' costs.",
             "A+": "Predicts a rightward shift of aggregate demand; the event changes production costs, not spending.", "A-": "Predicts a leftward shift of aggregate demand; the event changes production costs, not spending.",
             "M": "Treats the event as a change in the price level, which moves the economy along SRAS; the event is a determinant that shifts the curve."}
    cand = [c for c in SR_STMT if c != key]
    k, ds = sent_opts(SR_STMT[key], mech, [(SR_STMT[c], wrong[c]) for c in cand])
    stem = f"Consider the following event in an economy: {ev} Which of the following is the most likely immediate effect in the aggregate demand-aggregate supply model?"
    return mk("ma_sras_determinants", "3.3", "3.A", stem, k, ds, rng, concept="determinants shift short-run aggregate supply", path="fixed vetted event-to-curve table", facts=[f"event={ev[:40]}", f"key={key}"], est=55)


SRSLOPE = [
    ("Which of the following best explains why the short-run aggregate supply curve slopes upward?", "Nominal wages and some other input prices are slow to adjust when the price level changes.", "With sticky nominal wages, a higher price level raises profit per unit and firms produce more in the short run.",
     [("Potential output rises whenever the price level rises.", "Potential output depends on resources and technology, not on the price level."), ("Consumers spend more when the price level falls.", "Describes the wealth and interest-rate effects that make AD slope downward."), ("Real wages always rise when the price level rises.", "With sticky nominal wages the real wage falls when the price level rises, which is why firms produce more."),
      ("Firms can instantly adjust every input price to match changes in the price level.", "If all prices adjusted instantly, output would not respond to the price level and SRAS would be vertical.")]),
    ("A rise in the price level with nominal wages unchanged leads firms to increase output in the short run. This is best explained by which of the following?", "Profit per unit rises because output prices rise while input costs are temporarily fixed.", "Fixed nominal wages mean a higher price level raises the profit margin and encourages more production.",
     [("The real wage rises, so firms hire more workers.", "A higher price level with fixed nominal wages lowers the real wage."), ("Aggregate demand has shifted to the right, which raises output at the same price level.", "A higher price level moves the economy along SRAS; it is not itself a shift of AD."), ("Potential output has increased because the price level is higher.", "Potential output does not respond to the price level."), ("Workers have permanently accepted lower real wages.", "The adjustment is temporary; wages adjust over time.")]),
]


def ma_sras_slope(rng):
    q, kt, kw, wr = _v(rng, SRSLOPE)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_sras_slope", "3.3", "1.A", q, k, ds, rng, concept="why short-run aggregate supply slopes upward: sticky wages and prices", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


# ======================= 3.4 LRAS =======================
LR_EVENTS = [
    ("An increase in the economy's stock of capital through sustained investment.", "right", "More capital raises the economy's productive capacity, so LRAS shifts to the right."),
    ("A permanent technological advance that raises productivity.", "right", "Higher productivity raises potential output, so LRAS shifts to the right."),
    ("A large inflow of immigrant workers that increases the labor force.", "right", "A larger labor force raises potential output, so LRAS shifts to the right."),
    ("A war that destroys a large part of the economy's factories and machines.", "left", "A smaller capital stock lowers potential output, so LRAS shifts to the left."),
    ("A permanent decrease in the number of working-age people.", "left", "A smaller labor force lowers potential output, so LRAS shifts to the left."),
    ("An increase in the price level caused by an increase in aggregate demand.", "none", "The price level does not change potential output, so LRAS does not shift."),
    ("A temporary increase in the price of oil.", "none", "A temporary cost shock shifts SRAS but not potential output, so LRAS does not shift."),
]


def ma_lras_shift(rng):
    ev, d, mech = _v(rng, LR_EVENTS)
    st = {"right": "The long-run aggregate supply curve shifts to the right.", "left": "The long-run aggregate supply curve shifts to the left.", "none": "The long-run aggregate supply curve does not shift."}
    wrong = {"right": "Predicts a rightward shift of LRAS, but the event does not raise potential output.", "left": "Predicts a leftward shift of LRAS, but the event does not lower potential output.", "none": "Predicts that LRAS does not shift, but the event changes the economy's productive capacity."}
    k, ds = sent_opts(st[d], mech, [(st[c], wrong[c]) for c in st if c != d] + [("The aggregate demand curve shifts, and neither supply curve shifts.", "Treats a change in productive capacity or a price-level change as an AD event."), ("The long-run aggregate supply curve becomes upward sloping.", "LRAS is vertical at potential output regardless of the price level.")])
    stem = f"Consider the following event in an economy: {ev} Which of the following is the effect on long-run aggregate supply (LRAS)?"
    return mk("ma_lras_shift", "3.4", "1.B", stem, k, ds, rng, concept="LRAS shifts only when potential output changes", path="fixed vetted event-to-curve table", facts=[f"event={ev[:40]}", f"d={d}"], est=55)


LRVS = [
    ("An economy's workers negotiate higher nominal wages. Which of the following describes the effect on aggregate supply?", "Short-run aggregate supply shifts to the left, and long-run aggregate supply does not change.", "Higher nominal wages raise costs in the short run but do not change potential output.",
     [("Both short-run and long-run aggregate supply shift to the left.", "Treats a higher nominal wage as a reduction in potential output."), ("Long-run aggregate supply shifts to the left, and short-run aggregate supply does not change.", "Reverses which curve is affected by a nominal cost increase."), ("Short-run aggregate supply shifts to the right, and long-run aggregate supply does not change.", "Higher wages raise costs; they do not lower costs."), ("Neither curve shifts, because wages are a nominal variable.", "Nominal wages affect firms' costs and shift SRAS even though they do not change real capacity.")]),
    ("A permanent technological advance raises productivity throughout an economy. Which of the following describes the effect on aggregate supply?", "Both short-run and long-run aggregate supply shift to the right.", "Higher productivity lowers costs and raises potential output.",
     [("Short-run aggregate supply shifts to the right, and long-run aggregate supply does not change.", "Overlooks that a permanent productivity gain raises potential output."), ("Long-run aggregate supply shifts to the right, and short-run aggregate supply does not change.", "Overlooks the lower costs that shift SRAS."), ("Both short-run and long-run aggregate supply shift to the left.", "Predicts the opposite direction for both curves."), ("Aggregate demand shifts to the right, and neither supply curve shifts.", "Treats a supply-side improvement as a demand shock.")]),
]


def ma_lras_vs_sras(rng):
    q, kt, kw, wr = _v(rng, LRVS)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_lras_vs_sras", "3.4", "1.D", q, k, ds, rng, concept="SRAS shift versus LRAS shift", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=60)


# ======================= 3.5 AD-AS 균형 =======================
def ma_adas_gap_graph(rng):
    gap = rng.choice(["rec", "inf"])
    sc = adas_scene(rng, gap); sc_check(sc)
    cur, xhi, yhi = adas_curves(sc)
    stim = econ_graph("Aggregate demand, short-run aggregate supply, and long-run aggregate supply for an economy in short-run equilibrium at point E.", cur, xhi, yhi, 20, 20, points=[("E", sc["Y0"], sc["P0"])], **AXES)
    stem = "The graph shows an economy in short-run equilibrium at point E. Which of the following describes the economy?"
    rec = gap == "rec"
    # 독립 경로: 균형 산출량과 잠재 산출량 비교
    agree(1, 1 if (sc["Y0"] < sc["Yf"]) == rec else 0, 1e-9, "gap_sign")
    r = ("recessionary", "inflationary")
    k, ds = sent_opts(f"The economy has {'a recessionary' if rec else 'an inflationary'} gap, and unemployment is {'above' if rec else 'below'} the natural rate.", f"Equilibrium output is {'below' if rec else 'above'} potential output (LRAS), which means {'cyclical unemployment is positive' if rec else 'the economy is overheating, with unemployment below the natural rate'}.",
                      [(f"The economy has {'an inflationary' if rec else 'a recessionary'} gap, and unemployment is {'below' if rec else 'above'} the natural rate.", "Reverses the comparison between equilibrium output and potential output."), ("The economy is at full employment, and unemployment equals the natural rate.", "Ignores that equilibrium output differs from potential output."),
                       (f"The economy has {'a recessionary' if rec else 'an inflationary'} gap, and unemployment is {'below' if rec else 'above'} the natural rate.", "Names the gap correctly but reverses the relation to the natural rate of unemployment."),
                       ("The economy is in long-run equilibrium because it is on the SRAS curve.", "Short-run equilibrium on SRAS is long-run equilibrium only if it is also on LRAS."), (f"The economy will experience deflation in the short run because it is at point E.", "Does not follow from the position of E relative to LRAS.")])
    return mk("ma_adas_gap_graph", "3.5", "3.A", stem, k, ds, rng, concept="recessionary versus inflationary gap from the position of AD-SRAS equilibrium relative to LRAS", path="parameters solved exactly and by sympy; Y0 compared to Yf", stim=stim, facts=[f"Y0={sc['Y0']}", f"Yf={sc['Yf']}", f"gap={gap}", f"P0={sc['P0']}"], est=70)


@retry_sep
def ma_gap_size(rng):
    yf = rng.choice([800, 1000, 1200, 2000]); pct = rng.choice([2, 4, 5, 10]); sign = rng.choice([1, -1])
    y = int(yf * (100 + sign * pct) / 100)
    if abs(yf * (100 + sign * pct) / 100 - y) > 1e-9:
        raise ValueError("not_enough_separated_distractors")
    gap = y - yf
    kind = "inflationary" if gap > 0 else "recessionary"
    stem = f"An economy's real GDP is ${y:,} billion, and its potential real GDP is ${yf:,} billion. Which of the following correctly describes the output gap?"
    f = lambda v: f"{'An inflationary' if v > 0 else 'A recessionary'} gap of ${abs(int(round(v))):,} billion"  # noqa: E731
    k, ds = val_opts(float(gap), [("Names the gap with the wrong sign: it compares potential output with actual output in the wrong direction.", -gap), ("Reports the level of real GDP as the gap.", y if sign > 0 else -y), ("Reports potential real GDP as the gap.", yf if sign < 0 else -yf), ("Adds actual and potential output.", y + yf), ("Reports the gap as a percent of actual real GDP in billions of dollars.", gap / y * 100)], f)
    agree(gap, int(sp.Integer(y) - sp.Integer(yf)), 1e-9, "gap")
    return mk("ma_gap_size", "3.5", "1.C", stem, k, ds, rng, concept="output gap = actual real GDP minus potential real GDP", path="integer subtraction vs sympy", kwhy=f"Actual output exceeds potential by {abs(gap)} billion: an {kind} gap." if gap > 0 else f"Actual output is below potential by {abs(gap)} billion: a {kind} gap.", facts=[f"y={y}", f"yf={yf}", f"gap={gap}"], est=55)


# ======================= 3.6 단기 AD-AS 변화 =======================
def _adas_vars(rng):
    return rng.choice([("P", "Y"), ("Y", "U"), ("P", "U")])


def ma_adas_shock(rng):
    kind = rng.choice(["ad", "sras"])
    if kind == "ad":
        up = rng.choice([True, False]); ev, mech = _v(rng, AD_UP if up else AD_DOWN); ds_, ss_ = (1 if up else -1), 0
        shift_txt = "aggregate demand shifts " + ("right" if up else "left")
    else:
        up = rng.choice([True, False]); ev, mech, _ = _v(rng, SRAS_UP if up else SRAS_DOWN); ds_, ss_ = 0, (1 if up else -1)
        shift_txt = "short-run aggregate supply shifts " + ("right" if up else "left")
    d = adas_dirs(ds_, ss_)
    vs = _adas_vars(rng)
    mm = {
        "P": f"{cap1(shift_txt)}, so the economy moves along the other curve and the price level {'rises' if d['P'] == 1 else 'falls'}.",
        "Y": f"{cap1(shift_txt)}, so equilibrium real GDP {'rises' if d['Y'] == 1 else 'falls'}.",
        "U": f"Cyclical unemployment moves opposite to real GDP, so it {'rises' if d['U'] == 1 else 'falls'} when real GDP {'falls' if d['U'] == 1 else 'rises'}.",
    }
    key, ds = combo_item(rng, list(vs), d, mm, dirs=(1, -1, 0))
    stem = f"An economy is initially in long-run equilibrium. {ev} What is the most likely effect in the short run?"
    return mk("ma_adas_shock", "3.6", "3.A", stem, key, ds, rng, concept="short-run effects of an AD or SRAS shock on the price level, real GDP, and cyclical unemployment", path="direction rule table vs numeric simulation of a linear AD-SRAS model", facts=[f"kind={kind}", f"up={up}", f"vs={vs}", f"d={d}"], est=70)


def ma_adas_double(rng):
    ds_, ss_ = rng.choice([(1, -1), (-1, 1), (1, 1), (-1, -1)])
    ev1 = _v(rng, AD_UP if ds_ == 1 else AD_DOWN)[0]; ev2 = _v(rng, SRAS_UP if ss_ == 1 else SRAS_DOWN)[0]
    d = adas_dirs(ds_, ss_)
    which = rng.choice(["P", "Y"])
    truth = d[which]
    nmv = NAMES[which]; other = NAMES["Y" if which == "P" else "P"]
    stem = f"An economy experiences both of the following events at the same time. First, {ev1[0].lower() + ev1[1:]} Second, {ev2[0].lower() + ev2[1:]} What is the effect on {nmv} in the short run?"
    opts = {1: f"{cap1(nmv)} will increase.", -1: f"{cap1(nmv)} will decrease.", 0: f"{cap1(nmv)} will not change.", None: f"The effect on {nmv} is indeterminate."}
    dirw = {1: "increases", -1: "decreases", 0: "does not change"}
    wrongs = []
    for t in (1, -1, 0, None):
        if t == truth:
            continue
        if t is None:
            w = f"Calls the effect on {nmv} indeterminate, but the two shifts move it in the same direction."
        elif truth is None:
            w = f"Claims {nmv} {dirw[t]} for sure, but the two shifts push it in opposite directions and their sizes are not given."
        elif t == 0:
            w = f"Claims no change in {nmv}, but both shifts change the equilibrium."
        else:
            w = f"Gets the direction of the effect on {nmv} backward; each shift's direction has to be combined with the other's."
        wrongs.append((opts[t], w))
    wrongs.append((f"{cap1(nmv)} will increase, and {other} will not change.", f"Ignores that a shift in either curve changes both {nmv} and {other}."))
    wrongs.append((f"{cap1(nmv)} will decrease, and {other} will not change.", f"Ignores that a shift in either curve changes both {nmv} and {other}, and misreads the combined effect."))
    mech = f"AD shifts {'right' if ds_ == 1 else 'left'} and SRAS shifts {'right' if ss_ == 1 else 'left'}, so the effect on {nmv} is " + ("indeterminate without the sizes of the shifts." if truth is None else ("an increase." if truth == 1 else "a decrease."))
    k, d_ = sent_opts(opts[truth], mech, wrongs)
    return mk("ma_adas_double", "3.6", "3.A", stem, k, d_, rng, concept="simultaneous AD and SRAS shifts: determinate versus indeterminate", path="direction rule table vs numeric simulation with three shift-size regimes", facts=[f"ds={ds_}", f"ss={ss_}", f"which={which}", f"truth={truth}"], est=75)


STAG = [
    ("Which of the following events is most likely to cause stagflation (rising prices and falling real GDP) in the short run?", "A sharp increase in the price of oil, a key input for most firms.", "Higher input costs shift SRAS to the left, raising the price level and lowering real GDP.",
     [("A decrease in government purchases.", "Shifts AD to the left, which lowers both the price level and real GDP."), ("An increase in consumer confidence.", "Shifts AD to the right, which raises both the price level and real GDP."), ("A technological advance that raises productivity.", "Higher productivity shifts SRAS to the right, which lowers the price level and raises real GDP."), ("A decrease in the price of imported inputs.", "Cheaper imported inputs lower costs and shift SRAS to the right, the opposite of stagflation.")]),
    ("An economy experiences stagflation. Which of the following correctly describes what happened to the price level and real GDP, and which curve most likely shifted?", "The price level rose and real GDP fell; short-run aggregate supply shifted to the left.", "Stagflation combines higher prices and lower output, as with a leftward SRAS shift.",
     [("The price level rose and real GDP rose; aggregate demand shifted to the right.", "Describes the effect of a demand-driven expansion, not stagflation."), ("The price level fell and real GDP fell; aggregate demand shifted to the left.", "Describes a demand-driven recession with falling prices."), ("The price level fell and real GDP rose; short-run aggregate supply shifted to the right.", "Describes a favorable supply shock."), ("The price level rose and real GDP fell; aggregate demand shifted to the left.", "A leftward AD shift lowers the price level.")]),
]


def ma_stagflation(rng):
    q, kt, kw, wr = _v(rng, STAG)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_stagflation", "3.6", "1.B", q, k, ds, rng, concept="stagflation comes from a leftward SRAS shift", path="fixed vetted statements; direction rule table", facts=[f"variant={q[:30]}"], est=60)


def ma_adas_shift_graph(rng):
    sc = adas_scene(rng, "none"); sc_check(sc)
    which = rng.choice(["ad", "sras"]); sg = rng.choice([1, -1]); mag = 15
    if which == "ad":
        cur, xhi, yhi = adas_curves(sc, ad_shift=sg * mag * float(sc["B"]) * 2, ad2=True)
        ad_s = sg * mag * float(sc["B"]) * 2
        d = adas_dirs(sg, 0)
        Y1, P1 = eq_sympy(Mkt(sc["Y0"], sc["P0"], sc["B"], sc["D"]), dA=ad_s)
        why = f"AD shifts to the {'right' if sg == 1 else 'left'}"
    else:
        sras_s = -sg * mag * float(sc["D"]) * 2  # 오른쪽 이동 = 절편 하락
        cur, xhi, yhi = adas_curves(sc, sras_shift=sras_s, sras2=True)
        d = adas_dirs(0, sg)
        Y1, P1 = eq_sympy(Mkt(sc["Y0"], sc["P0"], sc["B"], sc["D"]), dC=sras_s)
        why = f"SRAS shifts to the {'right' if sg == 1 else 'left'}"
    if (_sg(float(Y1) - sc["Y0"]), _sg(float(P1) - sc["P0"])) != (d["Y"], d["P"]):
        raise ValueError("graph_rule_mismatch")
    stim = econ_graph("AD-AS graph: equilibrium E1 moves to equilibrium E2 after one curve shifts.", cur, xhi, yhi, 20, 20, points=[("E1", sc["Y0"], sc["P0"]), ("E2", round(float(Y1), 2), round(float(P1), 2))], **AXES)
    labels = {("ad", 1): ["Consumer confidence about future incomes rises sharply.", "A_up"], ("ad", -1): ["The government raises personal income tax rates.", "A_dn"], ("sras", 1): ["The price of an important imported input falls.", "S_up"], ("sras", -1): ["Nominal wages rise throughout the economy.", "S_dn"]}
    kt = labels[(which, sg)][0]
    wl = [(labels[c][0], f"Would shift {'AD' if c[0] == 'ad' else 'SRAS'} to the {'right' if c[1] == 1 else 'left'}, but the graph shows {why.split(' shifts')[0]} shifting to the {'right' if sg == 1 else 'left'}." if c[0] == which else f"Would shift {'AD' if c[0] == 'ad' else 'SRAS'} to the {'right' if c[1] == 1 else 'left'}, but the graph shows {'AD' if which == 'ad' else 'SRAS'} shifting.") for c in labels if c != (which, sg)]
    wl.append(("A rise in the price level, with no other change.", "A higher price level moves the economy along a curve and does not shift AD or SRAS."))
    k, ds = sent_opts(kt, f"The graph shows {why}, which matches this event.", wl)
    stem = "The graph shows the aggregate demand, short-run aggregate supply, and long-run aggregate supply curves, and a move from equilibrium E1 to equilibrium E2. Which of the following events is most likely to have caused the move?"
    return mk("ma_adas_shift_graph", "3.6", "3.A", stem, k, ds, rng, concept="read an AD or SRAS shift from the graph and match the event", path="equilibria solved exactly and by sympy; direction signs match the rule table", stim=stim, facts=[f"which={which}", f"sg={sg}", f"Y0={sc['Y0']}", f"P0={sc['P0']}"], est=75)


# ======================= 3.7 장기 자기 조정 =======================
def ma_lr_adjust(rng):
    gap = rng.choice(["rec", "inf"])
    rec = gap == "rec"
    txt = "below" if rec else "above"
    ask = rng.choice(["curve", "price"])
    if ask == "curve":
        stem = f"An economy is in short-run equilibrium with real GDP {txt} potential output, and the government takes no policy action. Which of the following describes the adjustment of the economy to long-run equilibrium?"
        k, ds = sent_opts(f"Nominal wages {'fall' if rec else 'rise'}, short-run aggregate supply shifts to the {'right' if rec else 'left'}, and real GDP returns to potential output.", f"{'High unemployment pushes nominal wages down, lowering costs and shifting SRAS right' if rec else 'Low unemployment pushes nominal wages up, raising costs and shifting SRAS left'}, which moves the economy to LRAS.",
                          [(f"Nominal wages {'rise' if rec else 'fall'}, short-run aggregate supply shifts to the {'left' if rec else 'right'}, and real GDP returns to potential output.", "Reverses the wage adjustment; unemployment above (below) the natural rate lowers (raises) nominal wages."), (f"Aggregate demand shifts to the {'right' if rec else 'left'} until real GDP equals potential output.", "In the long run self-adjustment works through SRAS, not through AD."),
                           ("Long-run aggregate supply shifts until it passes through the short-run equilibrium.", "LRAS depends on productive capacity and does not move to meet the equilibrium."), ("The economy stays at the short-run equilibrium, because nominal wages are fixed permanently.", "Nominal wages are sticky only in the short run."), (f"Real GDP stays {txt} potential output, because markets cannot correct a gap.", "Ignores the self-correcting wage adjustment in the long run.")])
    else:
        stem = f"An economy is in short-run equilibrium with real GDP {txt} potential output, and the government takes no policy action. What will happen to the price level and real GDP as the economy adjusts to long-run equilibrium?"
        Pdir = -1 if rec else 1
        key = f"The price level will {'decrease' if rec else 'increase'}, and real GDP will {'increase' if rec else 'decrease'} to potential output."
        wl = [(f"The price level will {'increase' if rec else 'decrease'}, and real GDP will {'increase' if rec else 'decrease'} to potential output.", "Pairs a falling price level with falling real GDP, which would need a leftward AD shift; self-adjustment works through SRAS, which moves the price level and real GDP in opposite directions."),
              (f"The price level will {'decrease' if rec else 'increase'}, and real GDP will {'decrease' if rec else 'increase'} further from potential output.", "Moves real GDP away from potential output instead of toward it."),
              (f"The price level will not change, and real GDP will {'increase' if rec else 'decrease'} to potential output.", "Ignores that the SRAS shift changes the price level during the adjustment."),
              (f"The price level will {'decrease' if rec else 'increase'}, and real GDP will not change.", "Ignores that real GDP moves back to potential output as SRAS shifts."),
              (f"The price level will {'increase' if rec else 'decrease'}, and real GDP will {'decrease' if rec else 'increase'} further from potential output.", "Reverses both the price-level and the real-GDP adjustments.")]
        k, ds = sent_opts(key, f"{'Falling' if rec else 'Rising'} nominal wages shift SRAS {'right' if rec else 'left'}, which moves the economy along AD to a {'lower' if rec else 'higher'} price level and to potential output.", wl)
    return mk("ma_lr_adjust", "3.7", "3.A", stem, k, ds, rng, concept="long-run self-adjustment through nominal wages and SRAS", path="rule table of the wage-SRAS adjustment vs simulation of SRAS shifting until output equals potential", facts=[f"gap={gap}", f"ask={ask}"], est=70)


def ma_lr_adjust_graph(rng):
    gap = rng.choice(["rec", "inf"])
    sc = adas_scene(rng, gap); sc_check(sc)
    cur, xhi, yhi = adas_curves(sc)
    stim = econ_graph("AD, SRAS, and LRAS curves for an economy in short-run equilibrium at point E; no policy action is taken.", cur, xhi, yhi, 20, 20, points=[("E", sc["Y0"], sc["P0"])], **AXES)
    rec = gap == "rec"
    # 독립 경로: SRAS 를 이동해 AD 와 LRAS 의 교점이 되는 조정 (Yf 에서의 가격)
    Pf = sc["A"] - sc["B"] * sc["Yf"]
    agree(1, 1 if (Pf < sc["P0"]) == rec else 0, 1e-9, "long_run_price")
    stem = "The graph shows an economy in short-run equilibrium at point E, and no policy action is taken. Which of the following describes the adjustment to long-run equilibrium?"
    k, ds = sent_opts(f"SRAS shifts to the {'right' if rec else 'left'}, and the price level {'falls' if rec else 'rises'} as real GDP returns to the LRAS level.", f"The wage adjustment shifts SRAS {'right' if rec else 'left'} until it intersects AD at LRAS, at a {'lower' if rec else 'higher'} price level.",
                      [(f"SRAS shifts to the {'left' if rec else 'right'}, and the price level {'rises' if rec else 'falls'} as real GDP returns to the LRAS level.", "Shifts SRAS the wrong way; with a gap of this type nominal wages move so as to shift SRAS toward the LRAS level."), (f"AD shifts to the {'right' if rec else 'left'}, and the price level {'rises' if rec else 'falls'} as real GDP returns to the LRAS level.", "Self-adjustment shifts SRAS, not AD, so the price level moves the other way."),
                       (f"LRAS shifts to the {'left' if rec else 'right'} until it passes through point E.", "LRAS is determined by productive capacity and does not adjust to the short-run equilibrium."), ("No curve shifts, and the economy stays at point E.", "Point E is not long-run equilibrium; wages adjust over time."),
                       (f"SRAS shifts to the {'right' if rec else 'left'}, and the price level {'rises' if rec else 'falls'} as real GDP returns to the LRAS level.", "Gets the shift right but the price-level change backward; moving SRAS along AD changes the price level in the opposite direction to its shift.")])
    return mk("ma_lr_adjust_graph", "3.7", "3.A", stem, k, ds, rng, concept="long-run adjustment shown on the AD-AS graph", path="long-run price found as the AD price at potential output (exact) vs the rule table", stim=stim, facts=[f"gap={gap}", f"Y0={sc['Y0']}", f"Yf={sc['Yf']}", f"P0={sc['P0']}", f"Pf={float(Pf):.3f}"], est=70)


# ======================= 3.8 재정정책 =======================
def ma_fiscal_policy_gap(rng):
    gap = rng.choice(["rec", "inf"]); rec = gap == "rec"
    txt = "a recessionary gap with high cyclical unemployment" if rec else "an inflationary gap with unemployment below the natural rate and rising prices"
    exp, con = _v(rng, FISCAL_EXP), _v(rng, FISCAL_CON)
    key_t = exp[0] if rec else con[0]
    others = [con[0], _v(rng, FISCAL_CON)[0]] if rec else [exp[0], _v(rng, FISCAL_EXP)[0]]
    stem = f"An economy is experiencing {txt}. Which of the following fiscal policy actions would be most appropriate to move the economy toward full employment?"
    pool = [t for t in (FISCAL_CON if rec else FISCAL_EXP)]
    wr = [(p[0], f"{'Contractionary' if rec else 'Expansionary'} fiscal policy through {p[1]} shifts AD {'left' if rec else 'right'}, which would widen the gap instead of closing it.") for p in pool]
    wr.append(("Keeping the government's budget unchanged, since the economy will self-correct at once.", "Ignores that fiscal policy is used to speed the return to full employment instead of waiting for slow wage adjustment."))
    k, ds = sent_opts(key_t, f"{'Expansionary' if rec else 'Contractionary'} fiscal policy shifts AD {'right' if rec else 'left'} and moves output toward potential.", wr)
    return mk("ma_fiscal_policy_gap", "3.8", "2.A", stem, k, ds, rng, concept="choose expansionary or contractionary fiscal policy for a gap", path="fixed vetted policy table keyed to the gap sign", facts=[f"gap={gap}", f"key={key_t[:30]}"], est=60)


def ma_fiscal_effects(rng):
    exp = rng.choice([True, False])
    ev, comp = _v(rng, FISCAL_EXP if exp else FISCAL_CON)
    d = adas_dirs(1 if exp else -1, 0)
    vs = rng.choice([("P", "Y"), ("Y", "U")])
    mm = {"P": f"The policy shifts AD {'right' if exp else 'left'}, so the price level {'rises' if d['P'] == 1 else 'falls'} along SRAS.", "Y": f"The policy shifts AD {'right' if exp else 'left'}, so real GDP {'rises' if d['Y'] == 1 else 'falls'}.", "U": f"Cyclical unemployment moves opposite to real GDP, so it {'rises' if d['U'] == 1 else 'falls'}."}
    key, ds = combo_item(rng, list(vs), d, mm, dirs=(1, -1, 0))
    stem = f"{ev} Assuming the economy is initially in long-run equilibrium, what is the most likely short-run effect?"
    return mk("ma_fiscal_effects", "3.8", "3.A", stem, key, ds, rng, concept="short-run effects of fiscal policy through AD", path="direction rule table vs numeric simulation of a linear AD-SRAS model", facts=[f"exp={exp}", f"comp={comp}", f"vs={vs}", f"d={d}"], est=65)


@retry_sep
def ma_fiscal_gap_closing(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5)]); gap = rng.choice([40, 60, 100, 200])
    if gap % 1 or (gap * (1 - mpc)) != int(gap * (1 - mpc)):
        raise ValueError("not_enough_separated_distractors")
    need = gap * (1 - mpc)
    agree(float(need), float(gap * (1 - sp.Rational(mpc.numerator, mpc.denominator))), 1e-9, "need")
    yf = rng.choice([1000, 1500, 2000]); y = yf - gap
    stem = f"An economy has real GDP of ${y:,} billion and potential real GDP of ${yf:,} billion. The marginal propensity to consume is {nm(float(mpc), 2)}, and the price level is assumed to be constant. By how much should the government increase its purchases to close the output gap, assuming taxes do not change?"
    f = lambda v: f"${int(round(v)):,} billion"  # noqa: E731
    k, ds = val_opts(float(need), [("Sets the spending increase equal to the size of the gap and ignores the multiplier.", gap), ("Multiplies the gap by the multiplier instead of dividing by it.", gap / float(1 - mpc)), ("Divides the gap by the MPC.", gap / float(mpc)), ("Multiplies the gap by the MPC.", gap * float(mpc)), ("Uses the tax multiplier MPC/(1 - MPC) to divide the gap.", gap / float(mpc / (1 - mpc)))], f)
    return mk("ma_fiscal_gap_closing", "3.8", "3.C", stem, k, ds, rng, concept="required spending change = gap / multiplier", path="exact fraction vs sympy rational", kwhy=f"The multiplier is {nm(float(1 / (1 - mpc)), 2)}, so the needed increase is {gap}/{nm(float(1 / (1 - mpc)), 2)} = {nm(float(need), 1)}.", facts=[f"mpc={float(mpc):.4f}", f"gap={gap}", f"need={float(need):.4f}"], est=75)


# ======================= 3.9 자동 안정화 장치 =======================
STAB = [
    ("Which of the following is an example of an automatic stabilizer?", "Unemployment benefits that rise when more people lose their jobs.", "Transfer payments rise automatically in a downturn without new legislation, cushioning the fall in disposable income.",
     [("Congress passes a law to increase spending on highways during a recession.", "A new law is discretionary fiscal policy, not an automatic stabilizer."), ("The central bank buys bonds in the open market.", "Open market operations are monetary policy, not a built-in fiscal stabilizer."), ("The government cuts tax rates by new legislation during a recession.", "A legislated tax cut is discretionary fiscal policy."), ("A new law raises the minimum wage.", "Not a mechanism that automatically offsets changes in output.")]),
    ("During a recession, which of the following happens automatically, without any new legislation?", "Tax revenues fall and transfer payments rise, which reduces the decline in aggregate demand.", "A progressive tax system and transfers act as automatic stabilizers.",
     [("Tax revenues rise and transfer payments fall, which reduces aggregate demand further.", "Reverses the direction of the automatic changes."), ("The central bank raises the required reserve ratio.", "Monetary policy requires a decision by the central bank and is not a fiscal stabilizer."), ("Government purchases rise by an act of Congress.", "Requires new legislation, so it is discretionary."), ("The budget balance moves toward a surplus.", "A recession moves the budget toward a deficit.")]),
]


def ma_auto_stabilizers(rng):
    q, kt, kw, wr = _v(rng, STAB)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_auto_stabilizers", "3.9", "1.B", q, k, ds, rng, concept="automatic stabilizers versus discretionary policy", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


def ma_stabilizer_effect(rng):
    rec = rng.choice([True, False])
    stem = f"An economy with a progressive income tax and unemployment benefits {'slides into a recession' if rec else 'enters a strong expansion'}. Which of the following describes the automatic effect on the government's budget?"
    k, ds = sent_opts(f"Tax revenues {'fall' if rec else 'rise'} and transfer payments {'rise' if rec else 'fall'}, so the budget moves toward {'a deficit' if rec else 'a surplus'}.", f"Automatic stabilizers move the budget {'toward a deficit' if rec else 'toward a surplus'} and dampen the cycle.",
                      [(f"Tax revenues {'rise' if rec else 'fall'} and transfer payments {'fall' if rec else 'rise'}, so the budget moves toward {'a surplus' if rec else 'a deficit'}.", "Reverses the direction of both revenue and transfer changes."), (f"Tax revenues {'fall' if rec else 'rise'} and transfer payments {'fall' if rec else 'rise'}, so the budget balance does not change.", "Misstates the transfer response; transfers move opposite to taxes over the cycle."),
                       ("Neither taxes nor transfers change, because legislation is needed to change them.", "Ignores that the tax code and benefit rules operate automatically as income and employment change."), (f"The government must raise tax rates to {'cover the shortfall' if rec else 'spend the extra revenue'} by law before the budget changes.", "The budget balance changes automatically without any new law."),
                       (f"Government purchases {'rise' if rec else 'fall'} automatically, which {'raises' if rec else 'lowers'} the deficit.", "Government purchases are a discretionary decision; the automatic changes are in taxes and transfers.")])
    return mk("ma_stabilizer_effect", "3.9", "3.A", stem, k, ds, rng, concept="automatic stabilizers move the budget toward deficit in a recession and surplus in an expansion", path="fixed vetted statements keyed to the cycle phase", facts=[f"rec={rec}"], est=60)
