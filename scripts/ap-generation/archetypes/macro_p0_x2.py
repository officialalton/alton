"""AP Macroeconomics 확대 MA3 — 신규 원형 X2(단원 4·5·6). 2026-10-19. 공개 세트 MA1·MA2 의 원형과 풀이 틀·자료 형태가 다르다."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401
from macro_p0_x1 import _bank


# 런 X-A(2026-10-19 MA3): x1·x2 신규 원형 전부 + 공개 세트·재고 어디에도 쓰이지 않은 라이브러리 원형 14. 후보 3씩.
STAGE_X_A = [
    "ma_price_control_effects", "ma_related_goods_id", "ma_absolute_vs_comparative", "ma_lfpr_calc", "ma_gdp_inclusion_cases", "ma_real_nominal_compare", "ma_inflation_vs_price_level", "ma_ad_shift_events",
    "ma_sras_shift_events", "ma_lras_potential_events", "ma_mpc_mps_data", "ma_multiplier_rounds", "ma_tax_vs_spending_compare", "ma_fiscal_policy_compare", "ma_stabilizer_vs_discretionary", "ma_stagflation_dilemma",
    "ma_supply_self_correction", "ma_nx_identity", "ma_fed_tools_compare", "ma_excess_reserves_calc", "ma_lend_excess_reserves_effect", "ma_real_rate_projects",
    "ma_first_bank_loan", "ma_policy_for_data", "ma_phillips_tradeoff_table", "ma_expected_inflation_shift", "ma_longrun_phillips_why", "ma_velocity_solve", "ma_money_growth_numeric", "ma_interest_on_debt",
    "ma_saving_investment_numeric", "ma_growth_policy_choice", "ma_phillips_compare", "ma_bop_account_entries", "ma_cross_rate_numeric",
    "ma_appreciation_calc", "ma_bond_price", "ma_bop_calc", "ma_business_cycle_graph", "ma_comp_adv_inputs", "ma_crowding_concept", "ma_debt_explain", "ma_deflator", "ma_inflation_winners", "ma_multiplier_concept",
    "ma_ppc_shift", "ma_strong_currency", "ma_trade_explain", "ma_unemp_measure",
]
STAGE_X_F = ["maf_long_open_economy", "maf_short_gdp_data", "maf_short_ppc_trade", "maf_short_money_banking"]


# ======================= 단원 4 =======================
FED_TOOLS = [
    ("Which statement correctly compares the Federal Reserve's tools for increasing the money supply?",
     "Open-market purchases and a lower discount rate raise reserves and lending, and a lower required reserve ratio raises the money multiplier.",
     "Each of these actions expands reserves or the amount banks can lend against reserves, so the money supply rises.",
     [("Selling government bonds in the open market increases bank reserves, because banks receive payment from the Fed.", "Bond sales take reserves out of the banking system as buyers pay the Fed."), ("Raising the discount rate encourages banks to borrow more reserves from the Fed.", "A higher discount rate makes borrowing from the Fed more costly, so it discourages borrowing."),
      ("Raising the required reserve ratio lets banks lend a larger share of their deposits.", "A higher required ratio reduces the share of deposits banks can lend."), ("Lowering the required reserve ratio decreases the money multiplier.", "A lower ratio raises the multiplier because 1/rr increases.")]),
]


def ma_fed_tools_compare(rng):
    return _bank(rng, "ma_fed_tools_compare", "4.6", "1.D", FED_TOOLS, "compare the Fed's tools for expanding the money supply", "fixed vetted statement; each wrong option reverses the direction of a tool")


@retry_sep
def ma_excess_reserves_calc(rng):
    dep = rng.choice([400, 500, 800, 1000]); rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)]); res = rng.choice([90, 120, 150, 200, 250])
    req = dep * rr
    if req != int(req) or res <= req:
        raise ValueError("not_enough_separated_distractors")
    req = int(req); ex = res - req
    stem = f"A bank has checkable deposits of ${dep} million and total reserves of ${res} million. The required reserve ratio is {nm(float(rr) * 100, 0)} percent. What is the amount of excess reserves, in millions of dollars?"
    k, ds = val_opts(ex, [("Reports the bank's required reserves rather than its excess reserves.", req), ("Reports total reserves without subtracting required reserves.", res), ("Subtracts total reserves from deposits.", dep - res),
                          ("Multiplies deposits by one minus the reserve ratio.", float(dep * (1 - rr))), ("Applies the reserve ratio to total reserves instead of deposits.", float(res * rr))], lambda v: f"${nm(v, 0)} million")
    agree(ex, float(sp.Integer(res) - sp.Integer(dep) * sp.Rational(rr.numerator, rr.denominator)), 1e-9, "excess")
    return mk("ma_excess_reserves_calc", "4.4", "1.C", stem, k, ds, rng, concept="excess reserves equal total reserves minus required reserves", path="exact fraction vs sympy rational", kwhy=f"Required reserves are {nm(float(rr), 2)} x {dep} = {req}, so excess reserves are {res} - {req} = {ex}.", facts=[f"dep={dep}", f"rr={rr}", f"res={res}"], est=70)


LEND_EFFECT = [
    ("A commercial bank has excess reserves and uses them to make a new loan to a business, which deposits the loan proceeds in a checking account at the same bank. Which statement best describes the immediate effect?",
     "The money supply increases, because the loan creates a new checkable deposit while the bank's reserves stay in the banking system.", "A loan credited to a deposit adds to the money supply; reserves only leave the bank if the borrower spends the money elsewhere.",
     [("The money supply decreases, because the bank's excess reserves fall when the loan is made.", "Making a loan does not destroy reserves; it creates a deposit."), ("The money supply is unchanged, because the loan only moves money from the bank to the business.", "The bank creates a new deposit that did not exist before."),
      ("Required reserves fall, because the bank lent out its deposits.", "Required reserves rise with the new checkable deposit."), ("Aggregate demand falls, because the business now owes money to the bank.", "The new spending financed by the loan tends to raise aggregate demand.")]),
]


def ma_lend_excess_reserves_effect(rng):
    return _bank(rng, "ma_lend_excess_reserves_effect", "4.4", "2.B", LEND_EFFECT, "bank lending creates checkable deposits and raises the money supply", "fixed vetted scenario; wrong options confuse lending with removing money from the system", judgment="explain the effect with deposit creation and reserves")


@retry_sep
def ma_real_rate_projects(rng):
    infl = rng.choice([2, 3, 4]); nom = rng.choice([7, 8, 9]); real = nom - infl
    rets = sorted(rng.sample(range(2, 12), 5))
    funded = [r for r in rets if r >= real]
    if not 1 <= len(funded) <= 4 or any(r == real for r in rets):
        raise ValueError("not_enough_separated_distractors")
    names = ["Project A", "Project B", "Project C", "Project D", "Project E"]
    stim = tbl("Expected real rate of return of each investment project (percent per year).", ["Project", "Expected real return (%)"], [[names[i], rets[i]] for i in range(5)])
    stem = f"Firms fund an investment project only if its expected real rate of return exceeds the real interest rate. The nominal interest rate is {nom} percent and expected inflation is {infl} percent. How many of the projects in the table will be funded?"
    n = len(funded)
    k, ds = val_opts(n, [("Compares the returns with the nominal interest rate instead of the real rate.", sum(1 for r in rets if r > nom)), ("Compares the returns with the sum of the nominal rate and expected inflation.", sum(1 for r in rets if r > nom + infl)), ("Funds every project with a positive return.", 5),
                         ("Compares the returns with expected inflation alone.", sum(1 for r in rets if r > infl)), ("Funds only the project with the highest return.", 1)], lambda v: str(int(v)))
    return mk("ma_real_rate_projects", "4.2", "2.C", stem, k, ds, rng, concept="investment depends on the real interest rate (nominal rate minus expected inflation)", path="count of returns above the real rate vs sympy subtraction", stim=stim, kwhy=f"The real rate is {nom} - {infl} = {real} percent; {n} projects have a higher expected return.",
              facts=[f"nom={nom}", f"infl={infl}", f"rets={rets}"], est=85)


@retry_sep
def ma_first_bank_loan(rng):
    dep = rng.choice([500, 800, 1000, 2000]); rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)])
    loan = dep * (1 - rr)
    if loan != int(loan):
        raise ValueError("not_enough_separated_distractors")
    loan = int(loan)
    stem = f"A customer deposits ${dep} in cash into a checking account at a bank that currently holds no excess reserves. The required reserve ratio is {nm(float(rr) * 100, 0)} percent. What is the largest loan this bank can make with the new deposit, in dollars?"
    k, ds = val_opts(loan, [("Reports the amount the bank must hold as required reserves.", float(dep * rr)), ("Reports the whole deposit as available to lend.", dep), ("Reports the largest eventual change in the money supply from the whole banking system.", float(dep / rr)),
                            ("Divides the deposit by one minus the reserve ratio.", float(dep / (1 - rr))), ("Multiplies the deposit by the reserve ratio twice.", float(dep * rr * rr))], lambda v: f"${nm(v, 0)}")
    agree(loan, float(sp.Integer(dep) * (1 - sp.Rational(rr.numerator, rr.denominator))), 1e-9, "loan")
    return mk("ma_first_bank_loan", "4.4", "3.C", stem, k, ds, rng, concept="one bank can lend its excess reserves, which are deposits minus required reserves", path="exact fraction vs sympy rational", kwhy=f"The bank keeps {nm(float(rr), 2)} x {dep} = {nm(float(dep * rr), 0)} in required reserves and can lend the remaining {loan}.", facts=[f"dep={dep}", f"rr={rr}"], est=85)


POLICY_DATA = [
    ("An economy has a high unemployment rate, falling inflation, and real GDP below potential output. Which monetary policy action is most appropriate, and what is its expected effect?",
     "The central bank should buy government bonds to lower interest rates, which raises investment and aggregate demand.", "Expansionary monetary policy fights a recessionary gap by lowering interest rates and raising aggregate demand.",
     [("The central bank should sell government bonds to raise interest rates, which lowers inflation further.", "This is contractionary and would deepen the recession."), ("The central bank should raise the required reserve ratio, which lowers unemployment by tightening credit.", "A higher ratio reduces lending and raises unemployment."),
      ("The central bank should raise the discount rate to discourage borrowing and lower unemployment.", "A higher discount rate discourages borrowing, which weakens aggregate demand."), ("The central bank should do nothing, because monetary policy cannot affect real GDP in the short run.", "Monetary policy affects real GDP in the short run through interest rates and investment.")]),
    ("An economy has a very low unemployment rate, rapidly rising prices, and real GDP above potential output. Which monetary policy action is most appropriate, and what is its expected effect?",
     "The central bank should sell government bonds to raise interest rates, which lowers investment and aggregate demand.", "Contractionary monetary policy fights an inflationary gap by raising interest rates and lowering aggregate demand.",
     [("The central bank should buy government bonds to lower interest rates, which cools the economy.", "Lower rates raise aggregate demand and add to inflation."), ("The central bank should lower the reserve requirement to reduce the money supply.", "A lower ratio raises lending and the money multiplier."),
      ("The central bank should lower the discount rate to discourage banks from lending.", "A lower discount rate makes borrowing easier and encourages lending."), ("The central bank should increase the money supply to reduce prices.", "A larger money supply tends to raise prices in the short and long run.")]),
]


def ma_policy_for_data(rng):
    return _bank(rng, "ma_policy_for_data", "4.6", "2.B", POLICY_DATA, "match a monetary policy action to the gap suggested by data", "fixed vetted scenarios; wrong options choose the opposite action or a tool that moves the wrong way", judgment="read the data for the type of gap and choose the action that closes it")


# ======================= 단원 5 =======================
@retry_sep
def ma_phillips_tradeoff_table(rng):
    u0 = rng.choice([4, 5, 6]); step = rng.choice([1, 2]); i0 = rng.choice([8, 9, 10]); slope = rng.choice([1, 2])
    pts = [(u0 + step * k, i0 - slope * k) for k in range(4)]
    k_ = rng.choice([2, 3])
    a, b = pts[0], pts[k_]
    sacrifice = (b[0] - a[0])
    stim = tbl("Combinations of the unemployment rate and the inflation rate on a short-run Phillips curve.", ["Unemployment rate (%)", "Inflation rate (%)"], [[u, i] for u, i in pts])
    stem = f"The table shows points on a short-run Phillips curve for an economy. To reduce the inflation rate from {a[1]} percent to {b[1]} percent along this curve, by how many percentage points must the unemployment rate rise?"
    k, ds = val_opts(sacrifice, [("Reports the fall in the inflation rate rather than the rise in unemployment.", a[1] - b[1]), ("Reports the final unemployment rate rather than the change.", b[0]), ("Reports the initial unemployment rate.", a[0]),
                                  ("Adds the unemployment rates at the two points.", a[0] + b[0]), ("Reports the change in unemployment for a one-step move only.", step)], lambda v: nm(v, 0))
    return mk("ma_phillips_tradeoff_table", "5.2", "2.C", stem, k, ds, rng, concept="move along a short-run Phillips curve to read the unemployment cost of lower inflation", path="difference of table values vs sympy subtraction", stim=stim, kwhy=f"Unemployment rises from {a[0]} to {b[0]} percent, an increase of {sacrifice} points.", facts=[f"pts={pts}", f"k={k_}"], est=80)


PC_EXPECT = [
    ("Workers and firms come to expect higher inflation than before, and nothing else changes. Which statement correctly describes the effect on the short-run Phillips curve?",
     "The short-run Phillips curve shifts upward (to the right), so every unemployment rate is now associated with a higher inflation rate.", "Higher expected inflation raises wage and price demands, which shifts the short-run Phillips curve up.",
     [("The short-run Phillips curve shifts downward, so inflation falls at every unemployment rate.", "Higher expectations shift the curve up, not down."), ("The economy moves along the same short-run Phillips curve to a lower unemployment rate.", "A change in expectations shifts the curve rather than moving along it."),
      ("The long-run Phillips curve shifts to the right, because expectations change potential output.", "The long-run Phillips curve stays at the natural rate of unemployment."), ("Nothing changes, because expected inflation does not affect actual inflation.", "Expected inflation is a determinant of actual inflation along a short-run Phillips curve.")]),
]


def ma_expected_inflation_shift(rng):
    return _bank(rng, "ma_expected_inflation_shift", "5.2", "3.A", PC_EXPECT, "expected inflation shifts the short-run Phillips curve", "fixed vetted scenario; wrong options reverse the shift or confuse a shift with a movement", judgment="decide whether the event shifts the curve or moves along it")


LR_NEUTRAL = [
    ("A central bank keeps unemployment below the natural rate for many years by increasing the money supply faster and faster. Which statement best explains why this policy cannot work in the long run?",
     "Expectations adjust, shifting the short-run Phillips curve up, so unemployment returns to the natural rate with permanently higher inflation.", "In the long run workers adjust their expectations, so there is no trade-off at the natural rate.",
     [("Real GDP rises permanently, because the money supply is the main source of long-run growth.", "Money growth does not change potential output or the natural rate in the long run."), ("The long-run Phillips curve slopes downward, so lower unemployment is always available at a cost of more inflation.", "The long-run Phillips curve is vertical at the natural rate."),
      ("Inflation falls over time, because people spend less when prices rise.", "Persistent money growth leads to higher, not lower, inflation."), ("The natural rate of unemployment falls to zero as the money supply grows.", "The natural rate depends on structural factors, not on the money supply.")]),
]


def ma_longrun_phillips_why(rng):
    return _bank(rng, "ma_longrun_phillips_why", "5.2", "2.B", LR_NEUTRAL, "no long-run trade-off between unemployment and inflation", "fixed vetted scenario; wrong options keep a permanent trade-off", judgment="explain the adjustment of expectations")


@retry_sep
def ma_velocity_solve(rng):
    m = rng.choice([500, 800, 1000, 1500]); v = rng.choice([2, 3, 4, 5]); q = rng.choice([1000, 1200, 1500, 2000])
    pq = m * v
    p = Fr(pq, q)
    if p != int(p) and (p * 10) != int(p * 10):
        raise ValueError("not_enough_separated_distractors")
    stem = f"In an economy, the money supply is ${m} billion, the velocity of money is {v}, and real output is ${q} billion. According to the equation of exchange, what is the price level (in index points, where the price index is nominal GDP divided by real output times 1)?"
    stem = f"In an economy, the money supply is ${m} billion, the velocity of money is {v}, and real output is ${q} billion. According to the equation of exchange (MV = PQ), what is the price level, P?"
    k, ds = val_opts(float(p), [("Multiplies money by real output instead of velocity.", m * q / v), ("Divides real output by the product of money and velocity.", q / pq), ("Adds the money supply and velocity and divides by real output.", (m + v) / q),
                                ("Divides the money supply by velocity and real output.", m / (v * q)), ("Reports nominal GDP as the price level.", pq)], lambda x: nm(x, 2))
    agree(float(p), float(sp.Rational(m * v, q)), 1e-9, "price")
    return mk("ma_velocity_solve", "5.3", "3.C", stem, k, ds, rng, concept="equation of exchange MV = PQ solved for the price level", path="exact fraction vs sympy", kwhy=f"P = MV / Q = {m} x {v} / {q} = {nm(float(p), 2)}.", facts=[f"m={m}", f"v={v}", f"q={q}"], est=80)


@retry_sep
def ma_money_growth_numeric(rng):
    mg = rng.choice([6, 8, 10, 12]); yg = rng.choice([2, 3, 4]); vg = rng.choice([0, 1, -1, 2])
    infl = mg + vg - yg
    if infl <= 0:
        raise ValueError("not_enough_separated_distractors")
    stem = f"In an economy, the money supply grows at {mg} percent per year and real output grows at {yg} percent per year. The velocity of money {'is constant' if vg == 0 else ('rises by ' + str(vg) + ' percent per year' if vg > 0 else 'falls by ' + str(-vg) + ' percent per year')}. According to the quantity theory (equation of exchange in growth rates), what is the inflation rate?"
    k, ds = val_opts(infl, [("Reports the money growth rate as the inflation rate, ignoring output growth.", mg), ("Adds output growth to money growth.", mg + yg), ("Reports output growth as the inflation rate.", yg), ("Subtracts money growth from output growth.", yg - mg), ("Ignores the change in velocity and subtracts only output growth, then adds velocity again.", mg - yg + 2 * vg)],
                           lambda x: f"{nm(x, 0)}%")
    agree(infl, float(sp.Integer(mg) + sp.Integer(vg) - sp.Integer(yg)), 1e-9, "infl")
    return mk("ma_money_growth_numeric", "5.3", "3.C", stem, k, ds, rng, concept="inflation = money growth + velocity growth - real output growth", path="integer arithmetic vs sympy", kwhy=f"Inflation = {mg} + {vg} - {yg} = {infl} percent.", facts=[f"mg={mg}", f"yg={yg}", f"vg={vg}"], est=85)


@retry_sep
def ma_interest_on_debt(rng):
    debt = rng.choice([4000, 5000, 8000]); r = rng.choice([2, 3, 4, 5]); prim = rng.choice([-100, -50, 50, 100, 150])
    interest = debt * r // 100
    if interest * 100 != debt * r:
        raise ValueError("not_enough_separated_distractors")
    deficit = interest + (-prim if prim < 0 else -prim) if False else interest - prim
    stem = f"A government has outstanding debt of ${debt:,} billion, pays an average interest rate of {r} percent on the debt, and runs a primary {'surplus' if prim > 0 else 'deficit'} of ${abs(prim)} billion (revenue minus spending other than interest payments). What is the government's total budget {'deficit' if deficit > 0 else 'surplus'} for the year, in billions of dollars?"
    ans = abs(deficit)
    k, ds = val_opts(ans, [("Reports the interest payments alone.", interest), ("Reports the primary balance alone.", abs(prim)), ("Adds the primary balance to the interest payments with the wrong sign.", abs(interest + prim)),
                           ("Applies the interest rate to the primary balance.", abs(prim) * r / 100), ("Reports the debt as the deficit.", debt)], lambda v: f"${nm(v, 0)} billion")
    agree(ans, abs(float(sp.Integer(interest) - sp.Integer(prim))), 1e-9, "deficit")
    return mk("ma_interest_on_debt", "5.4", "1.C", stem, k, ds, rng, concept="total budget balance = primary balance minus interest payments", path="integer arithmetic vs sympy", kwhy=f"Interest is {r}% of {debt} = {interest}; the total balance is primary balance {prim} minus {interest}, so it is {'a deficit' if deficit > 0 else 'a surplus'} of {ans}.",
              facts=[f"debt={debt}", f"r={r}", f"prim={prim}"], est=90)


@retry_sep
def ma_saving_investment_numeric(rng):
    ps = rng.choice([800, 900, 1000, 1200]); gs = rng.choice([-200, -150, -100, 100]); nfi = rng.choice([0, 0, 50, -50])
    inv = ps + gs - nfi
    dg = rng.choice([50, 100])
    stem = f"In an economy, private saving is ${ps} billion, government saving (the budget balance) is {'-$' + str(-gs) if gs < 0 else '$' + str(gs)} billion, and net capital outflow is ${nfi} billion. Investment equals national saving minus net capital outflow. If the government's budget balance falls by an additional ${dg} billion and nothing else changes, what is the new level of investment, in billions of dollars?"
    new = inv - dg
    k, ds = val_opts(new, [("Reports the original level of investment.", inv), ("Adds the extra deficit to investment.", inv + dg), ("Reports the drop in government saving instead of investment.", dg), ("Ignores government saving and reports private saving.", ps), ("Subtracts the extra deficit twice.", inv - 2 * dg)], lambda v: f"${nm(v, 0)} billion")
    agree(new, float(sp.Integer(ps) + sp.Integer(gs) - sp.Integer(dg) - sp.Integer(nfi)), 1e-9, "inv")
    return mk("ma_saving_investment_numeric", "5.5", "3.C", stem, k, ds, rng, concept="a larger government deficit lowers national saving and crowds out investment", path="integer arithmetic vs sympy", kwhy=f"National saving falls by {dg}, so investment falls from {inv} to {new}.", facts=[f"ps={ps}", f"gs={gs}", f"nfi={nfi}", f"dg={dg}"], est=95)


SUPPLY_SIDE = [
    ("A government wants a permanently higher growth rate of potential output. Which of the following policies would be most effective?",
     "Increasing public spending on education and research, which raises human capital and technology.", "Better human capital and technology raise productivity and shift long-run aggregate supply to the right.",
     [("Increasing the money supply, which raises nominal wages and prices permanently.", "Money growth raises prices but not potential output."), ("Raising import quotas, which protects existing industries from competition.", "Protection tends to reduce competition and innovation and does not raise productivity by itself."),
      ("Imposing price controls on essential goods, which lowers the cost of living.", "Price controls distort production and can reduce output."), ("Raising the minimum wage, which raises the income of low-wage workers.", "A higher minimum wage does not raise the economy's productive capacity.")]),
]


def ma_growth_policy_choice(rng):
    return _bank(rng, "ma_growth_policy_choice", "5.7", "2.A", SUPPLY_SIDE, "policies that raise human capital and technology raise long-run growth", "fixed vetted statement; wrong options are demand-side or distorting policies", judgment="pick the policy that raises productive capacity")


PC_COMPARE = [
    ("Which statement correctly compares the short-run Phillips curve with the long-run Phillips curve?",
     "The short-run curve slopes downward, showing a trade-off, while the long-run curve is vertical at the natural rate of unemployment.", "In the short run expectations are fixed, so a trade-off exists; in the long run expectations adjust and unemployment returns to the natural rate.",
     [("The short-run curve is vertical at the natural rate, while the long-run curve slopes downward.", "This reverses the two curves."), ("Both curves slope downward, but the long-run curve is steeper.", "The long-run curve is vertical, not downward sloping."),
      ("Both curves are vertical because unemployment is determined only by structural factors.", "The short-run curve slopes downward because expectations are temporarily fixed."), ("The short-run curve is horizontal at the expected inflation rate, while the long-run curve slopes upward.", "Neither curve has these shapes.")]),
]


def ma_phillips_compare(rng):
    return _bank(rng, "ma_phillips_compare", "5.2", "1.D", PC_COMPARE, "short-run versus long-run Phillips curves", "fixed vetted statement; wrong options swap or misshape the curves")


# ======================= 단원 6 =======================
BOP_CASES = [
    ("A U.S. resident buys a German-made car. How is this transaction recorded in the U.S. balance of payments?",
     "As an import, which is a debit in the current account.", "Buying foreign goods is an import, and imports are debits in the current account.",
     [("As an export, which is a credit in the current account, because the car crosses the border.", "Goods bought from abroad are imports, not exports."), ("As a purchase of a foreign asset in the financial account, because the buyer receives a durable good.", "A consumer good is a current-account item, not a financial asset."),
      ("As a debit in the financial account only, because the buyer paid in dollars.", "The car purchase itself is recorded in the current account."), ("It is not recorded, because only government transactions appear in the balance of payments.", "Private transactions with foreigners are recorded in the balance of payments.")]),
]


def ma_bop_account_entries(rng):
    return _bank(rng, "ma_bop_account_entries", "6.1", "1.B", BOP_CASES, "classify a transaction in the current and financial accounts", "fixed vetted scenario; wrong options misclassify the transaction", judgment="classify the transaction and its matching financial entry")


@retry_sep
def ma_cross_rate_numeric(rng):
    eur = rng.choice([Fr(9, 10), Fr(4, 5), Fr(5, 4)]); yen = rng.choice([100, 120, 150])
    cross = Fr(yen, 1) / eur
    amt = rng.choice([50, 100, 200])
    want = amt * cross
    if want != int(want):
        raise ValueError("not_enough_separated_distractors")
    stem = f"The exchange rates are {nm(float(eur), 2)} euros per U.S. dollar and {yen} yen per U.S. dollar. How many yen can a traveler obtain by exchanging {amt} euros, using the U.S. dollar as the intermediate currency?"
    k, ds = val_opts(int(want), [("Multiplies the euros by the yen per dollar without converting through dollars.", amt * yen), ("Multiplies the euros by the euros per dollar and then by the yen per dollar.", float(amt * eur * yen)), ("Divides the yen per dollar by the euros per dollar and ignores the amount.", float(cross)),
                                 ("Divides the euros by the yen per dollar.", amt / yen), ("Multiplies the amount by the euros per dollar only.", float(amt * eur))], lambda v: f"{nm(v, 0)} yen")
    agree(int(want), float(sp.Rational(amt) / sp.Rational(eur.numerator, eur.denominator) * yen), 1e-9, "yen")
    return mk("ma_cross_rate_numeric", "6.2", "1.C", stem, k, ds, rng, concept="convert between two foreign currencies through the dollar", path="exact fraction vs sympy rational", kwhy=f"{amt} euros buy {nm(float(amt / eur), 2)} dollars, which buy {nm(float(want), 0)} yen.", facts=[f"eur={eur}", f"yen={yen}", f"amt={amt}"], est=95)
