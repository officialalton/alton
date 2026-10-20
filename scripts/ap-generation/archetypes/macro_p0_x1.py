"""AP Macroeconomics 확대 MA3 — 신규 원형 X1(단원 1·2·3). 2026-10-19. 공개 세트 MA1·MA2 의 원형과 풀이 틀·자료 형태가 다르다(고정 문장 비교·식별, 데이터 표 해석, 항등식 계산)."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401


def _bank(rng, arch, topic, skill, bank, concept, path, est=60, judgment=None):
    """고정 문장 은행 한 항목을 골라 5지선다로 만든다. bank = [(stem, key_text, key_why, [(wrong_text, wrong_why), ...≥4])]."""
    stem, kt, kw, wr = bank[rng.randrange(len(bank))]
    k, ds = sent_opts(kt, kw, wr)
    return mk(arch, topic, skill, stem, k, ds, rng, concept=concept, path=path, facts=[f"variant={stem[:40]}"], est=est, **({"judgment": judgment} if judgment else {}))


# ======================= 단원 1 =======================
PRICE_CTRL = [
    ("A city caps the monthly rent for apartments below the equilibrium rent. Which statement correctly describes the result in the rental market?",
     "A shortage develops, because the quantity of apartments demanded at the capped rent exceeds the quantity supplied.",
     "A binding price ceiling holds the price below equilibrium, so quantity demanded exceeds quantity supplied.",
     [("A surplus develops, because landlords supply more apartments when rents are capped.", "A lower price reduces, not raises, the quantity supplied."), ("The market stays at equilibrium, because a price cap cannot change market behavior.", "A binding ceiling prevents the price from reaching equilibrium."),
      ("The quantity of apartments rented rises above the equilibrium quantity.", "The quantity traded is limited by the smaller quantity supplied, which falls."), ("A shortage develops only when the cap is set above the equilibrium rent.", "A cap above equilibrium is not binding and has no effect.")]),
    ("A government sets a minimum price for wheat above the equilibrium price. Which statement correctly describes the result in the wheat market?",
     "A surplus develops, because the quantity of wheat supplied at the minimum price exceeds the quantity demanded.",
     "A binding price floor holds the price above equilibrium, so quantity supplied exceeds quantity demanded.",
     [("A shortage develops, because buyers want more wheat at the higher price.", "A higher price reduces the quantity demanded."), ("The price falls to the equilibrium price over time, because markets always clear.", "A binding floor prevents the price from falling to equilibrium."),
      ("The quantity of wheat traded rises above the equilibrium quantity.", "The quantity traded is limited by the smaller quantity demanded, which falls."), ("A surplus develops only when the minimum price is below the equilibrium price.", "A floor below equilibrium is not binding and has no effect.")]),
]


def ma_price_control_effects(rng):
    return _bank(rng, "ma_price_control_effects", "1.6", "1.D", PRICE_CTRL, "binding price ceilings cause shortages and binding price floors cause surpluses", "fixed vetted scenarios; each wrong sentence reverses the quantity effect or ignores that a control binds only on one side of equilibrium")


REL_GOODS = [
    ("The price of gasoline rises sharply, and the quantity of large SUVs that consumers buy at every price falls. Which statement correctly describes the relationship between gasoline and large SUVs?",
     "They are complements, because a higher price of one good decreases the demand for the other.", "A fall in demand for SUVs when the price of gasoline rises shows the goods are consumed together.",
     [("They are substitutes, because a higher price of one good decreases the demand for the other.", "Substitutes move in the same direction as the other good's price: a higher price raises demand for the substitute."), ("They are normal goods, because demand changes when the price of gasoline changes.", "Normal and inferior describe the response to income."),
      ("They are inferior goods, because consumers buy fewer SUVs as the price rises.", "Inferior goods are defined by income, not by a change in another good's price."), ("They are unrelated, because the price of gasoline cannot shift the demand for SUVs.", "A related good's price shifts demand; this is a change in demand, not a movement along one curve.")]),
    ("The price of tea rises, and the quantity of coffee that consumers buy at every price rises. Which statement correctly describes the relationship between tea and coffee?",
     "They are substitutes, because a higher price of one good increases the demand for the other.", "A rise in demand for coffee when the price of tea rises shows consumers switch between the two.",
     [("They are complements, because a higher price of one good increases the demand for the other.", "Complements move opposite to the other good's price."), ("The demand for coffee is unchanged, because only the price of tea changed.", "A change in the price of a related good shifts the demand for coffee."),
      ("There is a movement along the demand curve for coffee, because the price of tea changed.", "A change in the price of a related good shifts the whole demand curve for coffee."), ("They are inferior goods, because demand for coffee rose when the price of tea rose.", "Inferior goods are defined by the response to income, not to a related good's price.")]),
]


def ma_related_goods_id(rng):
    return _bank(rng, "ma_related_goods_id", "1.4", "1.B", REL_GOODS, "classify related goods from the direction of the cross-price effect", "fixed vetted pairs with a sign rule", judgment="read the direction of the change in demand and name the relationship")


COMP_ADV_MA = [
    ("Country A can produce more of both wheat and cloth per worker than Country B can, and the two countries have different opportunity costs of producing wheat. Which statement correctly explains whether the two countries can gain from trade?",
     "Yes, if their opportunity costs differ, because each country can export the good for which its opportunity cost is lower.", "Even a country with an absolute advantage in both goods has a lower opportunity cost in only one of them.",
     [("No, because Country A is better at producing both goods and has nothing to gain.", "Confuses absolute advantage with comparative advantage."), ("Yes, but only Country B gains, because Country A gives up nothing by trading.", "Country A also gains by specializing where its opportunity cost is lower."),
      ("No, because trade is beneficial only if each country has an absolute advantage in a different good.", "Absolute advantage in different goods is not required for gains from trade."), ("Yes, because each country should specialize in the good it can make with the fewest resources.", "Specialization follows the lowest opportunity cost, not the lowest absolute resource use.")]),
]


def ma_absolute_vs_comparative(rng):
    return _bank(rng, "ma_absolute_vs_comparative", "1.3", "2.B", COMP_ADV_MA, "gains from trade rest on comparative advantage", "fixed vetted scenario; the key explains the gain with opportunity cost", judgment="separate absolute from comparative advantage")


# ======================= 단원 2 =======================
@retry_sep
def ma_lfpr_calc(rng):
    pop = rng.choice([200, 250, 300, 400]); lf_share = rng.choice([55, 60, 65, 70]); un_share = rng.choice([10, 12, 15])
    lf = pop * lf_share // 100; un = lf * un_share // 100
    if lf * 100 != pop * lf_share or un * 100 != lf * un_share:
        raise ValueError("not_enough_separated_distractors")
    emp = lf - un
    which = rng.choice(["lfpr", "epr"])
    ans = Fr(lf, pop) * 100 if which == "lfpr" else Fr(emp, pop) * 100
    agree(float(ans), (lf / pop * 100) if which == "lfpr" else (emp / pop * 100), 1e-9, "rate")
    stem = f"In an economy, the adult civilian noninstitutional population is {pop} million, {lf} million of them are in the labor force, and {un} million of those in the labor force are unemployed. What is the {'labor force participation rate' if which == 'lfpr' else 'employment-population ratio'}?"
    pairs = [("Divides the number of unemployed by the labor force, which is the unemployment rate.", un / lf * 100), ("Divides the labor force by the population, which is the participation rate.", lf / pop * 100), ("Divides the number employed by the population.", emp / pop * 100),
             ("Divides the number employed by the labor force.", emp / lf * 100), ("Divides the number unemployed by the population.", un / pop * 100)]
    pairs = [p for p in pairs if abs(p[1] - float(ans)) > 1e-9]
    k, ds = val_opts(float(ans), pairs, lambda v: f"{nm(v, 1)}%")
    return mk("ma_lfpr_calc", "2.3", "2.C", stem, k, ds, rng, concept="participation rate and employment-population ratio use the population as the denominator", path="exact fraction vs float ratio", kwhy=f"The {'labor force' if which == 'lfpr' else 'number employed'} divided by the population gives {nm(float(ans), 1)}%.",
              facts=[f"pop={pop}", f"lf={lf}", f"un={un}", f"which={which}"], est=70)


GDP_INCL = [
    ("Which of the following transactions is included in this year's U.S. GDP?",
     "A family buys a newly built house from a builder this year.", "New residential construction is investment, a final good produced this year.",
     [("A family buys a house built ten years ago from another family.", "A sale of an existing house is a transfer of ownership; only the broker's fee for the service counts."), ("A person buys shares of stock in a corporation.", "A purchase of stock is a financial transaction, not production of a good or service."),
      ("A retiree receives a Social Security payment.", "A transfer payment is not payment for current production."), ("A restaurant buys flour to bake bread that it will sell this year.", "Flour is an intermediate good, and its value is counted in the final price of the bread.")]),
    ("Which of the following transactions is included in this year's U.S. GDP?",
     "A university pays a contractor to build a new library this year.", "Construction of a new building is investment spending on a final good produced this year.",
     [("A consumer buys a used car from a dealer's lot that was made last year.", "A used car was counted in the year it was produced; the dealer's margin is the only current service."), ("A homemaker cooks meals for the family at home.", "Unpaid household production is not traded in a market and is not counted."),
      ("The government pays an unemployment benefit to a worker.", "A transfer payment is not payment for current production."), ("A bakery buys sugar to use in the cakes it sells this year.", "Sugar is an intermediate good whose value is included in the price of the cakes.")]),
]


def ma_gdp_inclusion_cases(rng):
    return _bank(rng, "ma_gdp_inclusion_cases", "2.1", "1.B", GDP_INCL, "GDP counts the market value of final goods and services produced in the current year", "fixed vetted cases; each wrong option is a used good, transfer, financial asset, or intermediate good", judgment="decide whether each transaction is a final good produced this year")


REAL_NOM = [
    ("Country X's nominal GDP rose 6 percent last year, while its price level rose 4 percent. Which statement correctly compares nominal GDP growth with real GDP growth?",
     "Real GDP grew by approximately 2 percent, because nominal growth includes the effect of higher prices, which must be removed.", "Real growth is approximately nominal growth minus inflation: 6 - 4 = 2.",
     [("Real GDP grew by approximately 10 percent, because inflation adds to real growth.", "Inflation raises nominal GDP without raising output, so it is subtracted."), ("Real GDP grew by 6 percent, because nominal and real GDP always grow at the same rate.", "Nominal and real GDP differ by the change in prices."),
      ("Real GDP fell by 4 percent, because the price level rose.", "Real GDP falls only if nominal growth is smaller than inflation."), ("Real GDP grew by approximately 1.5 percent, because 6 divided by 4 gives the real growth rate.", "Dividing the rates does not give real growth; subtract inflation from nominal growth.")]),
    ("Country Y's nominal GDP rose 3 percent last year, while its price level rose 5 percent. Which statement correctly compares nominal GDP growth with real GDP growth?",
     "Real GDP fell by approximately 2 percent, because nominal growth was smaller than the rise in prices.", "Real growth is approximately nominal growth minus inflation: 3 - 5 = -2.",
     [("Real GDP rose by approximately 8 percent, because growth and inflation add together.", "Inflation is subtracted from nominal growth to find real growth."), ("Real GDP rose by 3 percent, because real GDP does not depend on prices.", "Real GDP is measured at constant prices, but its growth is computed after removing price changes from nominal GDP."),
      ("Real GDP was unchanged, because both nominal GDP and the price level rose.", "Real growth equals nominal growth minus inflation, which is not zero here."), ("Real GDP fell by approximately 5 percent, because the price level rose by 5 percent.", "The nominal increase of 3 percent partly offsets the price increase.")]),
]


def ma_real_nominal_compare(rng):
    return _bank(rng, "ma_real_nominal_compare", "2.6", "1.D", REAL_NOM, "real growth is approximately nominal growth minus inflation", "fixed vetted numbers; the key subtracts inflation from nominal growth", judgment="compare nominal and real growth rates")


INFL_LEVEL = [
    ("A newspaper reports that the inflation rate fell from 6 percent to 3 percent this year. Which statement is correct?",
     "The price level is still rising, but more slowly than last year.", "A positive inflation rate means the price level is increasing, and a lower rate means it is increasing more slowly (disinflation).",
     [("The price level fell, because inflation decreased.", "A fall in the inflation rate is not a fall in the price level; that would be deflation (negative inflation)."), ("The economy experienced deflation, because inflation was lower than before.", "Deflation is a negative inflation rate; 3 percent is still positive."),
      ("Prices are lower than they were two years ago, because inflation decreased.", "With positive inflation in both years, prices are higher than two years ago."), ("The purchasing power of money increased, because inflation slowed.", "Money still loses purchasing power at a positive inflation rate, only more slowly.")]),
]


def ma_inflation_vs_price_level(rng):
    return _bank(rng, "ma_inflation_vs_price_level", "2.4", "1.D", INFL_LEVEL, "disinflation is a lower positive inflation rate, not a falling price level", "fixed vetted scenario", judgment="distinguish the inflation rate from the price level")


# ======================= 단원 3 =======================
AD_EVENTS = [
    ("Which of the following events would most likely shift the aggregate demand curve to the right?",
     "Consumers become more optimistic about future income and increase their spending.", "Higher consumer confidence raises consumption at every price level, a determinant of aggregate demand.",
     [("The price level falls and the economy moves down along the same aggregate demand curve.", "A change in the price level moves along the curve instead of shifting it."), ("The price of oil falls sharply, lowering firms' production costs.", "A change in production costs shifts short-run aggregate supply, not aggregate demand."),
      ("The government raises personal income taxes.", "Higher taxes reduce disposable income and shift aggregate demand to the left."), ("The value of the dollar rises on foreign exchange markets, making exports more expensive.", "A stronger currency lowers net exports and shifts aggregate demand to the left.")]),
]


def ma_ad_shift_events(rng):
    return _bank(rng, "ma_ad_shift_events", "3.1", "3.A", AD_EVENTS, "determinants of aggregate demand versus movements along the curve", "fixed vetted statements; each wrong option is a movement along AD, a supply shock, or a leftward shift", judgment="separate a shift of AD from a movement along AD and from a supply-side event")


SRAS_EVENTS = [
    ("A new law doubles the legal minimum wage, and firms' costs of production rise in every industry. Which statement correctly describes the short-run effect in the AD-AS model?",
     "Short-run aggregate supply decreases, so the price level rises and real GDP falls.", "Higher input costs shift SRAS to the left, which raises the price level and lowers real GDP in the short run.",
     [("Aggregate demand decreases, so the price level and real GDP both fall.", "Higher production costs shift aggregate supply, not aggregate demand."), ("Short-run aggregate supply increases, so the price level falls and real GDP rises.", "Higher costs reduce, not raise, short-run aggregate supply."),
      ("Long-run aggregate supply decreases immediately, because wages affect potential output.", "A change in wages shifts short-run supply; potential output changes only with resources or technology."), ("The economy moves along the aggregate supply curve to a higher output with a lower price level.", "The curve itself shifts when costs change.")]),
]


def ma_sras_shift_events(rng):
    return _bank(rng, "ma_sras_shift_events", "3.3", "3.A", SRAS_EVENTS, "input-cost changes shift short-run aggregate supply", "fixed vetted statement; wrong options confuse AD with SRAS or LRAS", judgment="identify which curve shifts and trace the effect on price level and real GDP")


LRAS_EVENTS = [
    ("Which of the following events would increase long-run aggregate supply?",
     "A discovery of a large new deposit of a natural resource that firms can use in production.", "A larger quantity or better quality of resources raises potential output and shifts LRAS to the right.",
     [("A temporary fall in the price of oil that lasts one year.", "A temporary change in input prices shifts short-run aggregate supply."), ("An increase in government spending on defense.", "Higher spending shifts aggregate demand, not potential output."),
      ("A rise in the price level that makes firms produce more in the short run.", "A movement along SRAS is not a shift of LRAS."), ("A fall in the nominal wage rate that raises employment temporarily.", "A temporary wage change shifts SRAS, not the economy's potential output.")]),
]


def ma_lras_potential_events(rng):
    return _bank(rng, "ma_lras_potential_events", "3.4", "1.B", LRAS_EVENTS, "long-run aggregate supply shifts only with changes in resources, technology, or institutions", "fixed vetted statement; wrong options are temporary or demand-side events", judgment="identify an event that changes potential output")


@retry_sep
def ma_mpc_mps_data(rng):
    mpc = rng.choice([Fr(4, 5), Fr(3, 4), Fr(2, 3), Fr(9, 10), Fr(3, 5)])
    dy = rng.choice([100, 200, 300, 400]); dc = mpc * dy
    if dc != int(dc):
        raise ValueError("not_enough_separated_distractors")
    dc = int(dc); mps = 1 - mpc; mult = 1 / mps
    agree(float(mult), float(sp.Integer(1) / (1 - sp.Rational(mpc.numerator, mpc.denominator))), 1e-9, "multiplier")
    stem = f"When disposable income in an economy rises by ${dy} billion, consumption spending rises by ${dc} billion. If the government increases spending by $50 billion, what is the maximum total change in real GDP implied by the simple spending multiplier, in billions of dollars?"
    k, ds = val_opts(float(mult * 50), [("Multiplies by the marginal propensity to consume instead of the multiplier.", float(mpc * 50)), ("Uses the multiplier 1 / MPC instead of 1 / MPS.", float(50 / mpc)), ("Reports the initial increase in spending without any multiplier effect.", 50), ("Uses the marginal propensity to save as the multiplier.", float(mps * 50)),
                                         ("Uses the multiplier MPC / (1 - MPC) rather than 1 / (1 - MPC).", float(mpc / mps * 50))], lambda v: f"${nm(v, 0)} billion")
    return mk("ma_mpc_mps_data", "3.2", "3.C", stem, k, ds, rng, concept="derive the MPC from data and apply the spending multiplier 1 / MPS", path="exact fraction vs sympy rational", kwhy=f"MPC = {dc}/{dy} = {nm(float(mpc), 2)}, so the multiplier is 1/(1 - MPC) = {nm(float(mult), 2)} and the change is {nm(float(mult * 50), 0)}.",
              facts=[f"mpc={mpc}", f"dy={dy}", f"dc={dc}"], est=100)


@retry_sep
def ma_multiplier_rounds(rng):
    mpc = rng.choice([Fr(1, 2), Fr(4, 5), Fr(3, 4)]); g = rng.choice([40, 80, 100, 200]); rounds = rng.choice([3, 4])
    spend = [Fr(g)]
    for _ in range(rounds - 1):
        spend.append(spend[-1] * mpc)
    tot = sum(spend)
    if tot != int(tot):
        raise ValueError("not_enough_separated_distractors")
    stem = f"The government spends an additional ${g} billion on a project. The marginal propensity to consume is {nm(float(mpc), 2)}, and each round of income is re-spent in the same way. What is the total increase in spending after {rounds} rounds, counting the government's spending as the first round, in billions of dollars?"
    full = float(g / (1 - mpc))
    k, ds = val_opts(float(tot), [("Reports the full eventual multiplier effect rather than the total after the stated number of rounds.", full), ("Counts only the initial government spending.", g), ("Adds only the induced rounds and leaves out the first round.", float(tot - g)),
                                  ("Multiplies the initial spending by the number of rounds.", g * rounds), ("Adds one more round than stated.", float(tot + spend[-1] * mpc))], lambda v: f"${nm(v, 1)} billion")
    agree(float(tot), float(sum(sp.Integer(g) * sp.Rational(mpc.numerator, mpc.denominator) ** i for i in range(rounds))), 1e-9, "series")
    return mk("ma_multiplier_rounds", "3.2", "3.C", stem, k, ds, rng, concept="the spending multiplier is a series of rounds of re-spending", path="exact fraction vs sympy geometric sum", kwhy=f"The rounds are {', '.join(nm(float(x), 1) for x in spend)}, which add to {nm(float(tot), 1)}.", facts=[f"g={g}", f"mpc={mpc}", f"rounds={rounds}"], est=105)


TAX_VS_SPEND = [
    ("Which statement correctly compares the effect on aggregate demand of a $100 billion increase in government purchases with a $100 billion decrease in lump-sum taxes?",
     "Government purchases have the larger effect, because all of the $100 billion is spent at first, while households save part of a tax cut.", "Government purchases add directly to aggregate demand, while a tax cut first goes to households, who save part of it (the tax multiplier is smaller).",
     [("The tax cut has the larger effect, because households spend more than the government.", "Households spend only the MPC share of the extra disposable income."), ("They have equal effects, because both change the budget deficit by $100 billion.", "The size of the deficit change does not equal the size of the effect on spending."),
      ("Neither affects aggregate demand, because both are paid for by the government.", "Both are fiscal policies that change aggregate demand."), ("The tax cut has no effect, because households may not spend any of it.", "A tax cut raises disposable income and, with a positive MPC, raises spending.")]),
]


def ma_tax_vs_spending_compare(rng):
    return _bank(rng, "ma_tax_vs_spending_compare", "3.2", "1.D", TAX_VS_SPEND, "government purchases have a larger multiplier than lump-sum taxes", "fixed vetted statement; wrong options reverse the comparison or ignore saving", judgment="compare the first-round effects and the multipliers")


FISCAL_COMPARE = [
    ("The economy is operating below full employment. Which of the following fiscal policy actions would most directly raise aggregate demand and help close the gap?",
     "Increasing government purchases of goods and services.", "Higher government purchases add directly to aggregate demand.",
     [("Raising personal income tax rates, which lowers disposable income.", "Higher taxes reduce consumption and aggregate demand."), ("Cutting transfer payments such as unemployment benefits.", "Lower transfers reduce household income and aggregate demand."),
      ("Selling government bonds in the open market to drain reserves.", "This is a monetary action that raises interest rates and lowers aggregate demand."), ("Reducing government purchases to balance the budget.", "Lower purchases reduce aggregate demand directly and widen the gap.")]),
    ("The economy is operating above full employment with rapidly rising prices. Which of the following fiscal policy actions would most directly reduce aggregate demand?",
     "Raising personal income tax rates.", "Higher taxes reduce disposable income and consumption, lowering aggregate demand.",
     [("Increasing government purchases of goods and services.", "Higher purchases raise aggregate demand and add to inflation."), ("Raising transfer payments such as unemployment benefits.", "Higher transfers raise household income and aggregate demand."),
      ("Buying government bonds in the open market to add reserves.", "This is a monetary action that lowers interest rates and raises aggregate demand."), ("Cutting personal income tax rates.", "Lower taxes raise disposable income and aggregate demand.")]),
]


def ma_fiscal_policy_compare(rng):
    return _bank(rng, "ma_fiscal_policy_compare", "3.8", "1.D", FISCAL_COMPARE, "expansionary and contractionary fiscal actions for a gap", "fixed vetted statements; wrong options are the opposite action or a monetary tool")


STAB = [
    ("Which statement correctly compares automatic stabilizers with discretionary fiscal policy?",
     "Automatic stabilizers change the budget without new legislation, while discretionary policy requires a deliberate decision by Congress.", "Automatic stabilizers respond to the business cycle by themselves; discretionary policy needs legislation.",
     [("Automatic stabilizers require a vote each time the economy changes, while discretionary policy works without any decision.", "This reverses the two definitions."), ("Both require new legislation, but automatic stabilizers act faster.", "Automatic stabilizers need no new legislation."),
      ("Automatic stabilizers increase the budget surplus during a recession, while discretionary policy decreases it.", "During a recession tax revenue falls and benefits rise, so automatic stabilizers move the budget toward deficit."), ("Neither changes the budget balance, because both are monetary policy tools.", "Both are fiscal policy tools that affect the budget balance.")]),
]


def ma_stabilizer_vs_discretionary(rng):
    return _bank(rng, "ma_stabilizer_vs_discretionary", "3.9", "1.D", STAB, "automatic stabilizers versus discretionary fiscal policy", "fixed vetted statement; wrong options reverse the definitions", judgment="compare how each type of policy is triggered")


STAGFL_DILEMMA = [
    ("An oil-price increase shifts short-run aggregate supply to the left, raising the price level and lowering real GDP. Which statement correctly describes the dilemma facing policymakers?",
     "Expansionary policy would restore real GDP but raise prices further, while contractionary policy would lower prices but deepen the fall in output.", "Because the shock moves prices and output in opposite directions of what AD policy fixes, any demand-side response worsens one problem.",
     [("Expansionary policy would raise real GDP and lower the price level, so there is no dilemma.", "Raising AD raises the price level."), ("Contractionary policy would raise real GDP and lower the price level.", "Contractionary policy lowers AD, which lowers real GDP."),
      ("Policy cannot affect aggregate demand when the shock is on the supply side.", "Policy can shift AD; it does not reverse the supply shock."), ("The short-run aggregate supply curve will shift back right immediately, so no response is needed.", "Without an offsetting change, the economy self-corrects only slowly as wages and prices adjust.")]),
]


def ma_stagflation_dilemma(rng):
    return _bank(rng, "ma_stagflation_dilemma", "3.6", "2.B", STAGFL_DILEMMA, "supply shocks pose a trade-off for demand-side policy", "fixed vetted statement; wrong options say there is no trade-off", judgment="explain the dilemma with two variables moving against each other")


SUPPLY_ADJ = [
    ("The economy is in a recessionary gap, and the government takes no action. Which statement best describes how the economy returns to long-run equilibrium?",
     "Input prices fall because of high unemployment, shifting short-run aggregate supply right until output returns to potential.", "Slack in resource markets lowers input prices, which shifts SRAS right and raises real GDP back to full employment.",
     [("Nominal wages rise because of high unemployment, shifting short-run aggregate supply to the left.", "High unemployment puts downward pressure on wages."), ("Aggregate demand shifts right automatically, because lower real GDP raises consumption.", "The self-correction works through the supply side, not by a shift in AD."),
      ("Long-run aggregate supply shifts right, because the gap increases potential output.", "A gap does not change potential output."), ("The price level rises and real GDP stays below potential permanently.", "Self-correction lowers the price level while real GDP rises toward potential.")]),
]


def ma_supply_self_correction(rng):
    return _bank(rng, "ma_supply_self_correction", "3.7", "2.A", SUPPLY_ADJ, "self-correction of a recessionary gap through falling input prices", "fixed vetted statement; wrong options reverse the wage response", judgment="explain the adjustment from a gap back to full employment")


@retry_sep
def ma_nx_identity(rng):
    c = rng.choice([700, 800, 900, 1000]); i = rng.choice([150, 200, 250, 300]); g = rng.choice([200, 250, 300, 350]); y = c + i + g + rng.choice([-60, -40, -20, 20, 40, 60])
    nx = y - c - i - g
    if nx == 0:
        raise ValueError("not_enough_separated_distractors")
    stem = f"An economy has GDP of ${y} billion, consumption of ${c} billion, investment of ${i} billion, and government purchases of ${g} billion. What are net exports, in billions of dollars?"
    k, ds = val_opts(nx, [("Adds the three components to GDP instead of subtracting them.", y + c + i + g), ("Subtracts only consumption from GDP.", y - c), ("Adds consumption, investment, and government purchases and reports their sum.", c + i + g),
                          ("Reverses the sign by subtracting GDP from the sum of the three components.", -nx), ("Subtracts only investment and government purchases from GDP.", y - i - g)], lambda v: f"${nm(v, 0)} billion")
    agree(nx, float(sp.Integer(y) - sp.Integer(c) - sp.Integer(i) - sp.Integer(g)), 1e-9, "nx")
    return mk("ma_nx_identity", "2.1", "2.C", stem, k, ds, rng, concept="Y = C + I + G + NX solved for net exports", path="exact subtraction vs sympy", kwhy=f"NX = Y - C - I - G = {y} - {c} - {i} - {g} = {nx}.", facts=[f"y={y}", f"c={c}", f"i={i}", f"g={g}"], est=70)
