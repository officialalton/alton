"""AP Macroeconomics 원형 B — 단원 2(경제 지표와 경기변동). 2026-10-14. 정답은 코드가 계산하고 독립 경로로 다시 계산한다."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401


def _v(rng, table):
    return table[rng.randrange(len(table))]


# ======================= 2.1 GDP =======================
GDP_IN = [
    ("A builder sells a newly constructed house to a family this year.", "New residential construction is counted as investment spending on a final good produced this year."),
    ("A restaurant buys a new oven made this year.", "New capital equipment is investment spending on a final good produced this year."),
    ("A city pays a company to build a new bridge this year.", "Government purchases of newly produced goods and services are part of GDP."),
    ("A foreign firm buys software produced by a domestic firm this year.", "Exports of goods and services produced domestically are part of GDP."),
    ("A family buys a haircut from a local barber this year.", "Consumer purchases of newly produced services are part of GDP."),
]
GDP_OUT = [
    ("A person sells a used car to a neighbor.", "A used car was counted in GDP in the year it was produced; the resale is not new production."),
    ("A retiree receives a Social Security payment.", "A transfer payment moves income and does not pay for newly produced output."),
    ("A household buys shares of stock on an exchange.", "Buying stock is a financial transaction, not a purchase of newly produced goods and services."),
    ("A bakery buys flour that it uses to make bread sold this year.", "Flour is an intermediate good; counting it as well as the bread would double count."),
    ("A parent spends the day cooking and cleaning at home without pay.", "Unpaid household production is a nonmarket activity that is not measured in GDP."),
    ("A person sells a house that was built ten years ago.", "The house was counted when it was built; the resale is not current production (the realtor's fee is the only new output)."),
]


def ma_gdp_counts(rng):
    kt, kw = _v(rng, GDP_IN)
    wr = rng.sample(GDP_OUT, 4)
    stem = "Which of the following transactions is counted in this year's gross domestic product (GDP) of a country?"
    k, ds = sent_opts(kt, kw, [(t, w) for t, w in wr])
    return mk("ma_gdp_counts", "2.1", "1.A", stem, k, ds, rng, concept="GDP counts final goods and services produced in the current year", path="fixed vetted inclusion/exclusion table", facts=[f"key={kt[:30]}"], est=50)


COMP = {"C": "consumption", "I": "investment", "G": "government purchases", "X": "net exports"}
COMP_ITEMS = [
    ("Households buy new cars produced by domestic firms.", "C", "Household purchases of newly produced goods are consumption."),
    ("A manufacturing firm buys new machines for its factory.", "I", "Purchases of new capital goods by firms are investment."),
    ("A family buys a newly built home from a builder.", "I", "New residential construction is classified as investment."),
    ("A state government buys new buses for its transit system.", "G", "Government purchases of goods and services are G."),
    ("A firm's inventories of unsold goods increase over the year.", "I", "Changes in inventories are counted as investment."),
    ("Foreign buyers purchase more of the country's machinery exports.", "X", "Exports raise net exports (exports minus imports)."),
]


def ma_gdp_component(rng):
    t, c, w = _v(rng, COMP_ITEMS)
    others = [x for x in COMP if x != c]
    wrong = {
        "C": "Classifies the purchase as consumption; consumption is household spending on newly produced goods and services.", "I": "Classifies the purchase as investment; investment is spending by firms on capital and inventories and household purchases of new housing.",
        "G": "Classifies the purchase as government purchases; G is spending by governments on goods and services.", "X": "Classifies the purchase as net exports; net exports are exports minus imports.",
    }
    stem = f"In the expenditure approach to measuring GDP, in which component is the following transaction counted? {t}"
    wl = [(f"{cap1(COMP[o])}.", wrong[o] + " It does not describe this transaction.") for o in others] + [("It is not counted in GDP.", "Excludes a transaction that is final spending on newly produced output, which GDP includes.")]
    k, ds = sent_opts(f"{cap1(COMP[c])}.", w, wl)
    return mk("ma_gdp_component", "2.1", "1.B", stem, k, ds, rng, concept="classify spending as C, I, G, or net exports", path="fixed vetted transaction-to-component table", facts=[f"component={c}"], est=50)


@retry_sep
def ma_gdp_expenditure(rng):
    C = rng.choice([700, 800, 900, 1000, 1200]); I = rng.choice([150, 200, 250, 300]); G = rng.choice([200, 250, 300, 350]); X = rng.choice([100, 150, 200]); M = X + rng.choice([-50, 50, 100])
    gdp = C + I + G + X - M
    agree(gdp, int(sum(sp.Integer(v) for v in (C, I, G, X)) - sp.Integer(M)), 1e-9, "gdp")
    tp = rng.choice([50, 80, 120])
    stim = tbl("Spending in a country in one year (billions of dollars).", ["Component", "Amount"], [["Consumption", usd(C)], ["Gross private investment", usd(I)], ["Government purchases", usd(G)], ["Government transfer payments", usd(tp)], ["Exports", usd(X)], ["Imports", usd(M)]])
    stem = "The table shows spending in a country in one year, in billions of dollars. What is the country's GDP, in billions of dollars?"
    f = lambda v: f"${int(round(v)):,} billion"  # noqa: E731
    k, ds = val_opts(gdp, [("Omits imports and counts only exports; GDP uses net exports (exports minus imports).", C + I + G + X), ("Adds imports instead of subtracting them.", C + I + G + X + M), ("Includes transfer payments, which are not spending on newly produced output.", gdp + tp), ("Leaves out net exports completely.", C + I + G),
                           ("Adds only consumption and investment.", C + I)], f)
    return mk("ma_gdp_expenditure", "2.1", "1.C", stem, k, ds, rng, concept="GDP = C + I + G + (X - M); transfers are excluded", path="exact integer sum vs sympy sum", stim=stim, kwhy=f"GDP = C + I + G + (X - M) = {C} + {I} + {G} + ({X} - {M}) = {gdp}.", facts=[f"C={C}", f"I={I}", f"G={G}", f"X={X}", f"M={M}", f"gdp={gdp}"], est=60)


@retry_sep
def ma_value_added(rng):
    farm = rng.choice([20, 30, 40]); mill = farm + rng.choice([30, 40, 50]); bakery = mill + rng.choice([40, 60, 80]); retail = bakery + rng.choice([20, 30, 40])
    stages = [("Wheat farmer sells wheat to the miller", farm), ("Miller sells flour to the bakery", mill), ("Bakery sells bread to the grocery store", bakery), ("Grocery store sells bread to households", retail)]
    va = [farm, mill - farm, bakery - mill, retail - bakery]
    agree(sum(va), retail, 1e-9, "sum_va")
    which = rng.randrange(1, 4)
    ask = rng.choice(["total", "stage"])
    stim = tbl("Sales at each stage of producing bread (dollars).", ["Stage", "Value of sales"], [[a, usd(b)] for a, b in stages])
    if ask == "total":
        stem = "The table shows the value of sales at each stage of producing bread that is sold to households this year. What is the total contribution of these stages to GDP?"
        k, ds = val_opts(retail, [("Adds the sales at all four stages, which double counts the intermediate goods.", sum(v for _, v in stages)), ("Counts only the first stage.", farm), ("Counts only the bakery's sales to the grocery store.", bakery), ("Adds only the two middle stages.", mill + bakery), ("Subtracts the farmer's sales from the final sales.", retail - farm)], usd)
        kw = f"Only the final sale to households, {usd(retail)}, is counted; the sum of the value added at each stage is also {usd(retail)}."
        facts = [f"farm={farm}", f"mill={mill}", f"bakery={bakery}", f"retail={retail}", "ask=total"]
    else:
        nm_ = ["the wheat farmer", "the miller", "the bakery", "the grocery store"][which]
        stem = f"The table shows the value of sales at each stage of producing bread that is sold to households this year. What is the value added by {nm_}?"
        key = va[which]
        prev = stages[which - 1][1]
        k, ds = val_opts(key, [(f"Reports the stage's sales rather than the value added.", stages[which][1]), ("Reports the sales of the previous stage, which is the cost of inputs.", prev), ("Reports the final sales to households.", retail), ("Adds the stage's sales and its input cost.", stages[which][1] + prev), ("Reports the value added by the wheat farmer.", farm)], usd)
        kw = f"Value added = sales minus the cost of inputs bought from the previous stage = {usd(stages[which][1])} - {usd(prev)} = {usd(key)}."
        facts = [f"farm={farm}", f"mill={mill}", f"bakery={bakery}", f"retail={retail}", f"which={which}", "ask=stage"]
    return mk("ma_value_added", "2.1", "1.C", stem, k, ds, rng, concept="value added and the final-goods approach avoid double counting", path="telescoping sum of value added vs final sales", stim=stim, kwhy=kw, facts=facts, est=70)


@retry_sep
def ma_income_approach(rng):
    wages = rng.choice([500, 600, 700]); rent = rng.choice([40, 60, 80]); interest = rng.choice([30, 50, 70]); profit = rng.choice([80, 100, 120]); other = rng.choice([150, 200, 250])
    gdp = wages + rent + interest + profit
    stim = tbl("Incomes earned in producing output, and one other item, in one year (billions of dollars).", ["Item", "Amount"], [["Wages and salaries", usd(wages)], ["Rental income", usd(rent)], ["Interest income", usd(interest)], ["Profit", usd(profit)], ["Government transfer payments", usd(other)]])
    stem = "The table shows incomes earned in producing output and government transfer payments in a country, in billions of dollars. Using the income approach, what is the country's GDP, in billions of dollars?"
    f = lambda v: f"${int(round(v)):,} billion"  # noqa: E731
    k, ds = val_opts(gdp, [("Adds government transfer payments, which are not income earned in producing output.", gdp + other), ("Leaves out wages and salaries, the largest income component.", gdp - wages), ("Counts only wages and salaries.", wages), ("Leaves out rent and interest income.", wages + profit), ("Leaves out profit.", gdp - profit)], f)
    return mk("ma_income_approach", "2.1", "1.C", stem, k, ds, rng, concept="income approach sums wages, rent, interest, and profit", path="exact integer sum vs sympy sum", stim=stim, kwhy=f"GDP equals total income earned in production: {wages} + {rent} + {interest} + {profit} = {gdp}.", facts=[f"wages={wages}", f"rent={rent}", f"interest={interest}", f"profit={profit}", f"gdp={gdp}"], est=60)


# ======================= 2.2 GDP 한계 =======================
LIM = [
    ("Which of the following is a limitation of GDP as a measure of a country's well-being?", "It does not account for the value of leisure time or unpaid household work.", "GDP omits nonmarket activity and leisure, which affect well-being.",
     [("It is calculated only for the largest cities in a country.", "Misdescribes GDP as a measure for large cities; GDP measures output for the whole country."), ("It counts the value of used goods sold during the year.", "GDP excludes used goods; the statement is false."), ("It subtracts the value of all imports from consumption.", "Describes a different adjustment; GDP subtracts imports from exports, and the issue is not a measurement limitation."),
      ("It includes only the production of goods and not services.", "False; GDP includes both goods and services.")]),
    ("A country's GDP per capita is higher than another country's. Which of the following would be a reason to be cautious about concluding that its residents have a higher standard of living?", "GDP per capita does not capture income inequality, environmental damage, or leisure.", "Per-capita GDP is an average and omits distribution, environmental costs, and leisure.",
     [("GDP per capita includes the value of intermediate goods.", "False; GDP counts only final goods and services."), ("GDP per capita counts imports as part of domestic production.", "False; imports are subtracted in the expenditure approach."), ("GDP per capita is a measure of the price level.", "Confuses output per person with the price level."),
      ("GDP per capita is always lower in richer countries.", "False and unrelated to a measurement limitation.")]),
    ("Which of the following is least likely to be reflected in a country's measured GDP?", "The value of illegal or unreported activity in the underground economy.", "Underground-economy activity is not recorded, so measured GDP understates production.",
     [("A new car sold at a dealership.", "A newly produced car sold through legal channels is counted in GDP."), ("A haircut purchased at a licensed salon.", "A legal market service is counted in GDP."), ("Government spending on newly built schools.", "Government purchases of new output are counted in GDP."),
      ("Newly built machinery purchased by a firm.", "Purchases of newly produced machinery are counted as investment.")]),
]


def ma_gdp_limits(rng):
    q, kt, kw, wr = _v(rng, LIM)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_gdp_limits", "2.2", "1.D", q, k, ds, rng, concept="what GDP leaves out and what per-capita GDP does not show", path="fixed vetted statements; each wrong sentence is false or describes counted output", facts=[f"variant={q[:30]}"], est=55)


@retry_sep
def ma_gdp_percapita_growth(rng):
    pop0 = rng.choice([100, 120, 200, 250]); g_pop = rng.choice([0, 2, 4]); gdp0 = rng.choice([1000, 1200, 2000, 3000]); g_gdp = rng.choice([4, 6, 8, 10])
    pop1 = pop0 * (100 + g_pop) // 100
    if pop0 * (100 + g_pop) % 100 != 0:
        raise ValueError("not_enough_separated_distractors")
    gdp1 = gdp0 * (100 + g_gdp) // 100
    if gdp0 * (100 + g_gdp) % 100 != 0:
        raise ValueError("not_enough_separated_distractors")
    pc0, pc1 = Fr(gdp0, pop0), Fr(gdp1, pop1)
    g = float((pc1 / pc0 - 1) * 100)
    agree(g, float(((sp.Rational(gdp1, pop1)) / sp.Rational(gdp0, pop0) - 1) * 100), 1e-9, "pc_growth")
    stim = tbl("Real GDP and population of a country.", ["Year", "Real GDP (billions)", "Population (millions)"], [["Year 1", usd(gdp0), pop0], ["Year 2", usd(gdp1), pop1]])
    stem = "The table shows real GDP and population for a country in two years. By approximately what percent did real GDP per capita change from Year 1 to Year 2?"
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    k, ds = val_opts(g, [("Reports the growth rate of real GDP and ignores population growth.", g_gdp), ("Adds the growth rates of GDP and population instead of subtracting.", g_gdp + g_pop), ("Reports the population growth rate.", g_pop), ("Reports the level of real GDP per capita in Year 2 instead of a percent change.", float(pc1)), ("Subtracts the percent growth of population from the percent growth of real GDP and then doubles it.", (g_gdp - g_pop) * 2)], f)
    return mk("ma_gdp_percapita_growth", "2.2", "2.C", stem, k, ds, rng, concept="growth of real GDP per capita is roughly GDP growth minus population growth", path="exact ratio of per-capita values vs sympy rational ratio", stim=stim, kwhy=f"Real GDP per capita rises from {nm(float(pc0), 2)} to {nm(float(pc1), 2)}, about {f(g)}.", facts=[f"gdp0={gdp0}", f"gdp1={gdp1}", f"pop0={pop0}", f"pop1={pop1}", f"g={g:.4f}"], est=75)


# ======================= 2.3 실업 =======================
@retry_sep
def ma_unemp_rate(rng):
    pop = rng.choice([200000, 250000, 300000, 400000]); lf = int(pop * rng.choice([Fr(4, 5), Fr(3, 4), Fr(7, 10)])); emp = int(lf * rng.choice([Fr(9, 10), Fr(19, 20), Fr(7, 8), Fr(4, 5)]))
    un = lf - emp
    ask = rng.choice(["unemp", "lfpr"])
    if ask == "unemp":
        val = Fr(un, lf) * 100
        agree(float(val), (sp.Rational(lf - emp, lf) * 100).evalf(), 1e-9, "u")
        stem = f"A country's population of working age is {pop:,}. The labor force is {lf:,} people, and {emp:,} people are employed. What is the unemployment rate?"
        f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
        k, ds = val_opts(float(val), [("Divides the number of unemployed by the working-age population instead of the labor force.", un / pop * 100), ("Divides the number of unemployed by the number employed.", un / emp * 100), ("Reports the percent of the labor force that is employed.", emp / lf * 100), ("Reports the percent of the population that is not in the labor force.", (pop - lf) / pop * 100), ("Divides the number employed by the working-age population.", emp / pop * 100)], f)
        kw = f"Unemployed = {lf:,} - {emp:,} = {un:,}; the unemployment rate = {un:,}/{lf:,} = {nm(float(val), 1)}%."
    else:
        val = Fr(lf, pop) * 100
        agree(float(val), float(sp.Rational(lf, pop) * 100), 1e-9, "lfpr")
        stem = f"A country's population of working age is {pop:,}. The labor force is {lf:,} people, and {emp:,} people are employed. What is the labor force participation rate?"
        f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
        k, ds = val_opts(float(val), [("Divides the number employed by the working-age population.", emp / pop * 100), ("Divides the labor force by the number employed.", lf / emp * 100), ("Reports the unemployment rate instead.", un / lf * 100), ("Reports the percent of the working-age population outside the labor force.", (pop - lf) / pop * 100), ("Divides the number of unemployed by the working-age population.", un / pop * 100)], f)
        kw = f"The labor force participation rate = labor force / working-age population = {lf:,}/{pop:,} = {nm(float(val), 1)}%."
    return mk("ma_unemp_rate", "2.3", "1.C", stem, k, ds, rng, concept="unemployment rate and labor force participation rate", path="exact fraction vs sympy rational", kwhy=kw, facts=[f"pop={pop}", f"lf={lf}", f"emp={emp}", f"ask={ask}", f"val={float(val):.4f}"], est=60)


UNEMP_SCEN = [
    ("A worker quits a job in order to search for a better position and is looking for new work.", "frictional", "Frictional unemployment arises while workers search for or move between jobs."),
    ("A recent college graduate is searching for a first job in the field of study.", "frictional", "Frictional unemployment arises while workers search for or move between jobs."),
    ("A factory worker loses a job because robots now perform the work, and the worker's skills do not match openings in the area.", "structural", "Structural unemployment arises from a mismatch between workers' skills or location and available jobs."),
    ("A coal miner loses a job when the mine closes permanently because of a shift in demand toward other energy sources.", "structural", "Structural unemployment arises from lasting changes in the structure of demand or technology."),
    ("A retail worker is laid off during a recession because consumers reduce their spending.", "cyclical", "Cyclical unemployment rises when the economy contracts and output falls below potential."),
    ("A construction worker is laid off because the economy is in a downturn and builders cancel projects.", "cyclical", "Cyclical unemployment rises when the economy contracts and output falls below potential."),
]
UT_WHY = {"frictional": "Frictional unemployment arises from normal job search, not from the situation described.", "structural": "Structural unemployment arises from lasting skill or location mismatches, not from the situation described.", "cyclical": "Cyclical unemployment arises from a downturn in the business cycle, not from the situation described."}


def ma_unemp_types(rng):
    t, kind, mech = _v(rng, UNEMP_SCEN)
    others = [x for x in UT_WHY if x != kind]
    stem = f"Which type of unemployment is best illustrated by the following situation? {t}"
    k, ds = sent_opts(f"{cap1(kind)} unemployment.", mech, [(f"{cap1(o)} unemployment.", UT_WHY[o]) for o in others] + [("Seasonal unemployment only.", "Treats the situation as tied to the time of year, which is not described."), ("Not unemployment, because the person is not counted in the labor force.", "Ignores that a person who is without work and looking for work is in the labor force and counted as unemployed.")])
    return mk("ma_unemp_types", "2.3", "1.B", stem, k, ds, rng, concept="frictional, structural, and cyclical unemployment", path="fixed vetted scenario-to-type table", facts=[f"kind={kind}"], est=50)


@retry_sep
def ma_cyclical_rate(rng):
    nat = rng.choice([4, 5, 6]); act = nat + rng.choice([-2, -1, 2, 3, 4])
    cyc = act - nat
    stem = f"A country's actual unemployment rate is {act} percent, and its natural rate of unemployment is {nat} percent. What is the cyclical unemployment rate?"
    f = lambda v: f"{nm(v, 1)} percentage points" if abs(v) != 1 else f"{nm(v, 1)} percentage point"  # noqa: E731
    k, ds = val_opts(float(cyc), [("Reports the actual unemployment rate.", act), ("Reports the natural rate.", nat), ("Adds the actual and natural rates.", act + nat), ("Reverses the subtraction, giving the negative of the correct value.", -cyc), ("Reports the natural rate minus twice the actual rate.", nat - 2 * act)], f)
    agree(cyc, int(sp.Integer(act) - sp.Integer(nat)), 1e-9, "cyc")
    kw = f"Cyclical unemployment = actual rate minus natural rate = {act} - {nat} = {cyc} percentage points" + (" (negative, because actual unemployment is below the natural rate)." if cyc < 0 else ".")
    return mk("ma_cyclical_rate", "2.3", "2.C", stem, k, ds, rng, concept="cyclical unemployment is actual minus natural unemployment", path="integer subtraction vs sympy", kwhy=kw, facts=[f"act={act}", f"nat={nat}", f"cyc={cyc}"], est=50)


UNEMP_MEASURE = [
    ("Discouraged workers who have stopped looking for work are not counted as unemployed. If many discouraged workers stop searching, what happens to the measured unemployment rate, other things equal?", "It decreases, because the workers leave the labor force.", "Workers who stop searching leave the labor force, lowering the number of unemployed and the labor force.",
     [("It increases, because the workers are still without jobs.", "Counts people who stopped searching as unemployed, which the official definition excludes."), ("It does not change, because the number employed does not change.", "Ignores that the numerator and denominator of the unemployment rate both change when people leave the labor force."), ("It increases, because the labor force rises.", "Believes a smaller group of searchers raises the labor force."),
      ("It decreases, because the workers find jobs.", "Assumes the discouraged workers become employed, which is not stated.")]),
    ("Which of the following people is counted as unemployed in official unemployment statistics?", "A person without a job who has actively looked for work in recent weeks.", "Unemployed means without a job and actively seeking one.",
     [("A full-time student who is not looking for work.", "Not looking for work means the person is outside the labor force."), ("A retiree who does not want a job.", "A retiree who is not seeking work is outside the labor force."), ("A person with a part-time job who would like more hours.", "A person with any job is counted as employed in the official measure."), ("A parent who chooses to stay at home with children and is not seeking work.", "Not seeking work places the person outside the labor force.")]),
]


def ma_unemp_measure(rng):
    q, kt, kw, wr = _v(rng, UNEMP_MEASURE)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_unemp_measure", "2.3", "3.A", q, k, ds, rng, concept="who is counted as unemployed and how leaving the labor force changes the rate", path="fixed vetted statements; each wrong sentence misapplies the official definition", facts=[f"variant={q[:30]}"], est=60)


@retry_sep
def ma_employment_change(rng):
    lf = rng.choice([100, 120, 150, 200]) * 1000; un = int(lf * rng.choice([Fr(1, 10), Fr(3, 20), Fr(1, 8)]))
    ev = rng.choice(["leave", "join"]); n = int(un * rng.choice([Fr(1, 4), Fr(2, 5), Fr(1, 2)]))
    emp = lf - un
    if ev == "leave":
        new_un = un - n; new_lf = lf - n
        txt = f"{n:,} unemployed people stop looking for work and leave the labor force"
    else:
        new_lf = lf + n
        txt = f"{n:,} people who were not in the labor force begin searching for work but do not find jobs, so they become unemployed"
        new_un = un + n
    r0 = Fr(un, lf) * 100; r1 = Fr(new_un, new_lf) * 100
    agree(float(r1), float((sp.Rational(new_un, new_lf)) * 100), 1e-9, "r1")
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    stem = f"A country has a labor force of {lf:,} people, of whom {un:,} are unemployed. Then {txt}. What is the new unemployment rate?"
    wr = [("Reports the unemployment rate before the change.", float(r0)), ("Divides the new number unemployed by the original labor force.", new_un / lf * 100), ("Divides the new number unemployed by the number employed.", new_un / emp * 100), ("Reports the number of people who changed status as a percent of the original labor force.", n / lf * 100),
          ("Divides the number employed by the new labor force.", emp / new_lf * 100), ("Divides the original number unemployed by the new labor force.", un / new_lf * 100)]
    k, ds = val_opts(float(r1), wr, f)
    return mk("ma_employment_change", "2.3", "3.C", stem, k, ds, rng, concept="the unemployment rate changes when people enter or leave the labor force", path="exact fraction vs sympy rational", kwhy=f"New unemployed = {new_un:,} and new labor force = {new_lf:,}, so the rate is {f(float(r1))}.", facts=[f"lf={lf}", f"un={un}", f"n={n}", f"ev={ev}", f"r1={float(r1):.4f}"], est=75)


# ======================= 2.4 가격지수와 인플레이션 =======================
@retry_sep
def ma_cpi_inflation(rng):
    base = rng.choice([100, 110, 120, 125, 140, 150]); rate = rng.choice([2, 4, 5, 8, 10]); nxt = base * (100 + rate) / 100
    if abs(nxt - round(nxt)) > 1e-9:
        raise ValueError("not_enough_separated_distractors")
    nxt = int(round(nxt))
    infl = (Fr(nxt, base) - 1) * 100
    agree(float(infl), (nxt - base) / base * 100, 1e-9, "infl")
    stim = tbl("Consumer price index (CPI).", ["Year", "CPI"], [["Year 1", base], ["Year 2", nxt]])
    stem = "The table shows the consumer price index (CPI) in a country in two consecutive years. What was the inflation rate from Year 1 to Year 2?"
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    k, ds = val_opts(float(infl), [("Reports the change in the index points instead of the percent change.", nxt - base), ("Divides the change by the Year 2 index instead of the Year 1 index.", (nxt - base) / nxt * 100), ("Reports the Year 2 index as the inflation rate.", nxt), ("Divides Year 2 by Year 1 and reports the ratio as a percent.", nxt / base * 100), ("Halves the correct percent change.", float(infl) / 2)], f)
    return mk("ma_cpi_inflation", "2.4", "2.C", stem, k, ds, rng, concept="inflation rate is the percent change in a price index", path="exact fraction vs sympy rational", stim=stim, kwhy=f"Inflation = ({nxt} - {base})/{base} = {f(float(infl))}.", facts=[f"base={base}", f"nxt={nxt}", f"infl={float(infl):.4f}"], est=60)


@retry_sep
def ma_price_index_basket(rng):
    items = [("loaves of bread", rng.choice([10, 20, 30])), ("gallons of milk", rng.choice([5, 10, 15])), ("movie tickets", rng.choice([2, 4, 6]))]
    p0 = [rng.choice([2, 3, 4]), rng.choice([3, 4, 5]), rng.choice([8, 10, 12])]
    p1 = [p + rng.choice([0, 1, 2]) for p in p0]
    c0 = sum(q * p for (_, q), p in zip(items, p0)); c1 = sum(q * p for (_, q), p in zip(items, p1))
    if c0 == c1:
        raise ValueError("not_enough_separated_distractors")
    idx = Fr(c1, c0) * 100
    ask = rng.choice(["index", "infl"])
    rows = [[nme, q, usd(a), usd(b)] for (nme, q), a, b in zip(items, p0, p1)]
    stim = tbl("A fixed market basket and its prices in two years.", ["Item", "Quantity in basket", "Price in Year 1", "Price in Year 2"], rows)
    f = lambda v: f"{nm(v, 1)}"  # noqa: E731
    if ask == "index":
        stem = "The table shows a fixed market basket and prices in two years. Using Year 1 as the base year, what is the price index in Year 2?"
        key = float(idx)
        k, ds = val_opts(key, [("Divides the Year 1 cost by the Year 2 cost.", c0 / c1 * 100), ("Reports the Year 2 cost of the basket in dollars instead of an index.", c1), ("Reports the percent change instead of the index.", float(idx) - 100), ("Adds the Year 2 prices without weighting by the quantities.", sum(p1) * 10), ("Divides the Year 2 cost by the Year 1 cost without multiplying by 100.", c1 / c0)], f)
        kw = f"Cost of the basket: Year 1 = {usd(c0)}, Year 2 = {usd(c1)}; index = {c1}/{c0} x 100 = {f(key)}."
    else:
        stem = "The table shows a fixed market basket and prices in two years. What is the inflation rate from Year 1 to Year 2 based on the cost of the basket?"
        key = float(idx - 100)
        k, ds = val_opts(key, [("Reports the Year 2 index instead of the percent change.", float(idx)), ("Divides the change in cost by the Year 2 cost.", (c1 - c0) / c1 * 100), ("Reports the change in cost in dollars.", c1 - c0), ("Divides Year 1 cost by Year 2 cost.", c0 / c1 * 100), ("Averages the percent changes of the three prices without weighting by the quantities.", sum((b - a) / a * 100 for a, b in zip(p0, p1)) / 3)], lambda v: f"{nm(v, 1)}%")
        kw = f"The basket costs {usd(c0)} in Year 1 and {usd(c1)} in Year 2, so inflation = ({c1} - {c0})/{c0} = {nm(key, 1)}%."
    agree(float(idx), float(sp.Rational(c1, c0) * 100), 1e-9, "idx")
    return mk("ma_price_index_basket", "2.4", "1.C", stem, k, ds, rng, concept="price index from the cost of a fixed basket", path="exact fractions vs sympy rationals", stim=stim, kwhy=kw, facts=[f"c0={c0}", f"c1={c1}", f"ask={ask}", f"key={key:.4f}"], est=85)


@retry_sep
def ma_deflator(rng):
    nom = rng.choice([1200, 1500, 2000, 2400]); defl = rng.choice([100, 120, 125, 150, 160, 200]); real = nom * 100 / defl
    if abs(real - round(real)) > 1e-9:
        raise ValueError("not_enough_separated_distractors")
    ask = rng.choice(["real", "deflator"])
    real = int(round(real))
    f = lambda v: f"${int(round(v)):,} billion"  # noqa: E731
    if ask == "real":
        stem = f"A country's nominal GDP is ${nom:,} billion and its GDP deflator is {defl} (base year = 100). What is real GDP, in billions of dollars?"
        k, ds = val_opts(real, [("Multiplies nominal GDP by the deflator expressed as a ratio instead of dividing.", nom * defl / 100), ("Reports nominal GDP.", nom), ("Divides nominal GDP by the deflator without multiplying by 100.", nom / defl), ("Subtracts the deflator from nominal GDP.", nom - defl), ("Subtracts 100 from the deflator and applies it to nominal GDP.", nom - (defl - 100))], f)
        kw = f"Real GDP = nominal GDP / deflator x 100 = {nom}/{defl} x 100 = {real:,}."
    else:
        stem = f"A country's nominal GDP is ${nom:,} billion and its real GDP is ${real:,} billion. What is the GDP deflator (base year = 100)?"
        k, ds = val_opts(defl, [("Divides real GDP by nominal GDP.", real / nom * 100), ("Subtracts real GDP from nominal GDP.", nom - real), ("Divides nominal GDP by real GDP without multiplying by 100.", nom / real), ("Reports the ratio of real to nominal GDP as a decimal.", real / nom), ("Divides the difference between the two measures by real GDP.", (nom - real) / real * 100)], lambda v: nm(v, 1))
        kw = f"GDP deflator = nominal GDP / real GDP x 100 = {nom}/{real} x 100 = {defl}."
    agree(real, float(sp.Rational(nom * 100, defl)), 1e-9, "real")
    return mk("ma_deflator", "2.4", "1.C", stem, k, ds, rng, concept="GDP deflator links nominal and real GDP", path="exact fraction vs sympy rational", kwhy=kw, facts=[f"nom={nom}", f"defl={defl}", f"real={real}", f"ask={ask}"], est=55)


CPIDEF = [
    ("Which of the following is a difference between the consumer price index (CPI) and the GDP deflator?", "The CPI measures a fixed basket of goods bought by households, while the GDP deflator covers all domestically produced output.", "The CPI is based on a basket of consumer purchases, including imports; the deflator covers domestic output.",
     [("The CPI is a measure of real output and the GDP deflator is a measure of nominal output.", "Both are price indexes; neither measures output."), ("The CPI includes only the prices of goods produced domestically.", "The CPI includes imported goods that households buy."), ("The GDP deflator is based on a fixed basket of goods chosen by the government.", "The fixed-basket description fits the CPI, not the deflator."), ("The two measures always change by exactly the same amount each year.", "The baskets differ, so the measures generally differ.")]),
    ("A country's CPI rises from 200 to 210. Which of the following statements is correct?", "The price level rose by 5 percent, which is the inflation rate.", "Inflation is the percent change in the price level: (210 - 200)/200 = 5 percent.",
     [("The price level rose by 10 percent, because the index rose by 10 points.", "Reports the point change instead of the percent change."), ("The inflation rate is 210 percent.", "Treats the index level as the inflation rate."), ("Real GDP rose by 5 percent.", "Confuses a price index with a measure of real output."), ("Deflation occurred, because the index is above 100.", "Deflation is a falling price level; an index above 100 only says prices are above the base year.")]),
]


def ma_cpi_vs_deflator(rng):
    q, kt, kw, wr = _v(rng, CPIDEF)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_cpi_vs_deflator", "2.4", "1.D", q, k, ds, rng, concept="CPI versus GDP deflator and the meaning of inflation", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=60)


# ======================= 2.5 인플레이션의 비용 =======================
INFL_WIN = [
    ("A bank has made a fixed-rate loan to a borrower. Inflation unexpectedly rises.", "The lender loses and the borrower gains.", "Dollars repaid are worth less in purchasing power, which hurts lenders and helps borrowers who agreed to a fixed nominal rate."),
    ("A retiree lives on a pension whose nominal payment is fixed. Inflation unexpectedly rises.", "The retiree's purchasing power falls.", "A fixed nominal income buys fewer goods when prices rise unexpectedly."),
    ("A worker is under a labor contract with a fixed nominal wage for the next three years. Inflation unexpectedly rises.", "The worker's real wage falls and the employer's real labor cost falls.", "With a fixed nominal wage the real wage falls when prices rise, which benefits employers."),
    ("A family has a fixed-rate mortgage. Inflation unexpectedly rises.", "The real value of the family's debt falls, which benefits the family.", "The nominal payments stay fixed while their purchasing power falls, which helps the borrower."),
]
INFL_WRONG = [
    ("The lender gains and the borrower loses.", "Reverses winners and losers; unexpected inflation transfers purchasing power from lenders to borrowers on fixed-rate loans."),
    ("Neither side is affected, because the nominal interest rate does not change.", "Ignores that the real value of the repayments changes when the price level changes."),
    ("Both parties gain, because higher prices raise nominal incomes.", "Believes inflation raises the real value of everyone's income."),
    ("Both parties lose, because inflation reduces real GDP.", "Confuses a redistribution between debtors and creditors with a fall in total output."),
]


def ma_inflation_winners(rng):
    ctx, kt, kw = _v(rng, INFL_WIN)
    stem = f"{ctx} Which of the following is the most likely result?"
    if "lender" in ctx:
        wr = INFL_WRONG
    elif "retiree" in ctx:
        wr = [("The retiree's purchasing power rises, because nominal prices rise.", "Reverses the effect; higher prices reduce what a fixed nominal payment can buy."), ("The retiree's purchasing power is unchanged, because the pension is stated in dollars.", "Confuses nominal and real values; the real value of a fixed nominal payment falls."), ("The retiree's nominal income falls.", "The nominal payment is fixed, so only its real value changes."), ("The retiree's real income rises if interest rates rise.", "Brings in an interest rate that does not affect a fixed pension payment.")]
    elif "worker" in ctx:
        wr = [("The worker's real wage rises and the employer's real labor cost rises.", "Reverses the effect; a fixed nominal wage buys less after inflation."), ("The worker's real wage is unchanged because the contract is fixed.", "Confuses the fixed nominal wage with a fixed real wage."), ("The worker's nominal wage rises automatically.", "A fixed contract has no automatic increase."), ("The worker's real wage falls and the employer's real labor cost rises.", "A lower real wage lowers, not raises, the employer's real labor cost.")]
    else:
        wr = [("The real value of the family's debt rises, which harms the family.", "Reverses the effect; inflation reduces the real value of fixed nominal debt."), ("The family's nominal mortgage payment rises automatically.", "A fixed-rate mortgage has fixed nominal payments."), ("The real value of the debt is unchanged because the interest rate is fixed.", "Confuses the fixed nominal rate with a fixed real burden."), ("The bank's real income rises, which benefits the family.", "A higher real income for the bank is the opposite of a gain for the family.")]
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_inflation_winners", "2.5", "3.A", stem, k, ds, rng, concept="unanticipated inflation redistributes real purchasing power", path="fixed vetted scenario table with real-versus-nominal reasoning", facts=[f"ctx={ctx[:30]}"], est=60)


COSTS = [
    ("Firms must frequently reprint price lists and change posted prices because of inflation. This is an example of", "menu costs.", "Menu costs are the costs of changing prices.", [("shoe-leather costs.", "Shoe-leather costs are costs of reducing money holdings, not of changing prices."), ("a cost of deflation.", "The situation involves rising prices."), ("cyclical unemployment.", "Describes a business-cycle labor market effect, not a cost of changing prices."), ("an increase in real GDP.", "Price-list changes use resources and do not raise output.")]),
    ("People make extra trips to the bank to hold less cash when inflation is high. This is an example of", "shoe-leather costs.", "Shoe-leather costs arise when people spend time and effort reducing money holdings.", [("menu costs.", "Menu costs are the costs of changing posted prices."), ("a transfer from lenders to borrowers.", "Describes the redistribution caused by unexpected inflation, not the cost of holding less cash."), ("structural unemployment.", "Describes a skill mismatch, not a cost of holding cash."), ("an increase in the real value of money.", "High inflation lowers the real value of money.")]),
]


def ma_inflation_costs(rng):
    q, kt, kw, wr = _v(rng, COSTS)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_inflation_costs", "2.5", "1.A", q, k, ds, rng, concept="menu costs and shoe-leather costs of inflation", path="fixed vetted definitions", facts=[f"variant={q[:30]}"], est=45)


@retry_sep
def ma_real_wage(rng):
    nom = rng.choice([2, 3, 4, 5, 6]); infl = rng.choice([1, 2, 3, 4, 7, 8])
    real = nom - infl
    if real == 0:
        raise ValueError("not_enough_separated_distractors")
    stem = f"A worker's nominal wage rises by {nom} percent in a year in which the inflation rate is {infl} percent. Approximately how did the worker's real wage change?"
    f = lambda v: f"{'Increased' if v > 0 else 'Decreased'} by about {nm(abs(v), 0)} percent" if v != 0 else "Did not change"  # noqa: E731
    k, ds = val_opts(real, [("Adds the inflation rate to the nominal wage change instead of subtracting.", nom + infl), ("Reports the nominal wage change as the real wage change.", nom), ("Reverses the subtraction, giving the opposite sign.", -real), ("Reports the inflation rate as the real wage change.", infl), ("Reports half of the difference between the two rates.", real / 2)], f)
    agree(real, int(sp.Integer(nom) - sp.Integer(infl)), 1e-9, "real")
    return mk("ma_real_wage", "2.5", "2.C", stem, k, ds, rng, concept="real wage growth is approximately nominal wage growth minus inflation", path="integer subtraction vs sympy", kwhy=f"Real wage growth is about {nom} - {infl} = {real} percent.", facts=[f"nom={nom}", f"infl={infl}", f"real={real}"], est=50)


# ======================= 2.6 실질·명목 GDP =======================
@retry_sep
def ma_real_gdp_growth(rng):
    r0 = rng.choice([1000, 1200, 2000, 2500]); g = rng.choice([2, 3, 4, 5]); r1 = r0 * (100 + g) // 100
    if r0 * (100 + g) % 100:
        raise ValueError("not_enough_separated_distractors")
    d0 = 100; d1 = rng.choice([103, 105, 106, 108, 110, 112]); n0 = r0 * d0 // 100; n1 = r1 * d1 // 100
    if (r1 * d1) % 100:
        raise ValueError("not_enough_separated_distractors")
    ng = (Fr(n1, n0) - 1) * 100
    agree(g, float((sp.Rational(n1 * 100, d1) / sp.Rational(n0 * 100, d0) - 1) * 100), 1e-6, "real_g")
    stim = tbl("Nominal GDP and the GDP deflator.", ["Year", "Nominal GDP (billions)", "GDP deflator"], [["Year 1", usd(n0), d0], ["Year 2", usd(n1), d1]])
    stem = "The table shows nominal GDP and the GDP deflator for a country. By approximately what percent did real GDP grow from Year 1 to Year 2?"
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    k, ds = val_opts(float(g), [("Reports the growth rate of nominal GDP.", float(ng)), ("Reports the percent change in the GDP deflator.", d1 - d0), ("Adds the growth rate of nominal GDP and the inflation rate.", float(ng) + d1 - d0), ("Reports the dollar change in nominal GDP.", n1 - n0), ("Divides the dollar change in nominal GDP by the Year 2 level.", (n1 - n0) / n1 * 100)], f)
    return mk("ma_real_gdp_growth", "2.6", "2.C", stem, k, ds, rng, concept="real GDP growth removes price changes from nominal GDP growth", path="exact real GDP levels (nominal / deflator x 100) vs sympy rational growth", stim=stim, kwhy=f"Real GDP is {nom_(n0, d0)} in Year 1 and {nom_(n1, d1)} in Year 2, a growth of {g}%.", facts=[f"n0={n0}", f"n1={n1}", f"d1={d1}", f"g={g}"], est=80)


def nom_(n, d):
    return f"{nm(n * 100 / d, 1)} billion"


NOMREAL = [
    ("A country's nominal GDP rises by 10 percent in a year in which the price level rises by 15 percent. What happened to real GDP?", "Real GDP fell.", "Real growth is approximately nominal growth minus inflation: 10 - 15 = -5 percent.",
     [("Real GDP rose by 10 percent.", "Reports nominal growth as real growth."), ("Real GDP rose by 25 percent.", "Adds inflation to nominal growth instead of subtracting."), ("Real GDP did not change.", "Assumes real output is unchanged because nominal GDP rose."), ("Real GDP rose by 5 percent.", "Subtracts in the wrong direction (15 - 10) and ignores the sign.")]),
    ("A country's nominal GDP is unchanged over a year while the price level rises. What can be concluded about real GDP?", "Real GDP fell.", "Real GDP equals nominal GDP divided by the price level; a higher price level with unchanged nominal GDP means lower real GDP.",
     [("Real GDP rose.", "Reverses the effect of the higher price level on real GDP."), ("Real GDP did not change.", "Confuses unchanged nominal GDP with unchanged real GDP."), ("Real GDP cannot be determined without knowing the population.", "Population is not needed to compare real GDP for a country over time."), ("Real GDP rose by the amount of inflation.", "Treats inflation as a source of real growth.")]),
]


def ma_nominal_vs_real(rng):
    q, kt, kw, wr = _v(rng, NOMREAL)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_nominal_vs_real", "2.6", "3.A", q, k, ds, rng, concept="nominal growth mistaken for real growth", path="fixed vetted statements; arithmetic confirmed by sympy of real = nominal / price", facts=[f"variant={q[:30]}"], est=55)


# ======================= 2.7 경기변동 =======================
def ma_business_cycle_graph(rng):
    pts = [(0, 104), (1, 106), (2, 109), (3, 112), (4, 109), (5, 105), (6, 101), (7, 104), (8, 108)]
    peak = max(pts, key=lambda p: p[1]); trough = min(pts, key=lambda p: p[1])
    scale = rng.choice([1, 2]); sh = rng.choice([0, 4, 8])
    P = [(x, y * scale + sh) for x, y in pts]
    peak = max(P, key=lambda p: p[1]); trough = min(P, key=lambda p: p[1])
    ask = rng.choice(["peak", "trough", "contraction", "expansion"])
    labels = {0: "Q1", 3: "A", 6: "B", 5: "C", 1: "D"}
    pl = [("A", P[3][0], P[3][1]), ("B", P[6][0], P[6][1]), ("C", P[5][0], P[5][1]), ("D", P[1][0], P[1][1])]
    ymin = (min(y for _, y in P) // 10) * 10 - 10; ymax = (max(y for _, y in P) // 10) * 10 + 20
    stim = econ_graph("Real GDP of an economy over nine years, with points A, B, C, and D marked.", [("Real GDP", P)], 8, ymax, 1, 10, points=pl, xlabel="Year", ylabel="Real GDP (billions of dollars)")
    stim["data"]["y_axis"]["min"] = ymin
    stim["data"]["y_axis"]["step"] = 10
    if ask == "peak":
        stem = "The graph shows an economy's real GDP over nine years. Which point is a business cycle peak?"; key = "A"
        reason = "Point A is the highest level of real GDP before output starts to fall."
    elif ask == "trough":
        stem = "The graph shows an economy's real GDP over nine years. Which point is a business cycle trough?"; key = "B"
        reason = "Point B is the lowest level of real GDP before output starts to rise."
    elif ask == "contraction":
        stem = "The graph shows an economy's real GDP over nine years. Which point lies in a contraction (recession)?"; key = "C"
        reason = "At point C real GDP is falling between the peak and the trough."
    else:
        stem = "The graph shows an economy's real GDP over nine years. Which point lies in an expansion?"; key = "D"
        reason = "At point D real GDP is rising on the way up to the peak."
    # 독립 경로: 점의 위치에서 기울기 판정
    tr = {"A": "peak", "B": "trough", "C": "contraction", "D": "expansion"}
    ys = [y for _, y in P]
    slope_c = ys[5] - ys[4]; slope_d = ys[1] - ys[0]
    agree(1, 1 if (slope_c < 0 and slope_d > 0 and ys[3] == max(ys) and ys[6] == min(ys)) else 0, 1e-9, "shape")
    names = {"A": "Point A", "B": "Point B", "C": "Point C", "D": "Point D"}
    why = {"A": "Point A is the peak, where real GDP stops rising and begins to fall.", "B": "Point B is the trough, where real GDP stops falling and begins to rise.", "C": "Point C is on the falling part of the curve, a contraction.", "D": "Point D is on the rising part of the curve, an expansion."}
    wr = [(names[x], f"{why[x]} It is not the point asked about.") for x in names if x != key]
    k, ds = sent_opts(names[key], reason, wr + [("None of the points.", "The marked points include the point asked about.")])
    return mk("ma_business_cycle_graph", "2.7", "1.B", stem, k, ds, rng, concept="identify business-cycle phases on a real GDP graph", path="slope signs and extrema of the plotted series", stim=stim, facts=[f"ask={ask}", f"key={key}"], est=55)


CYCLE = [
    ("Which of the following is most likely to occur during a recession?", "The unemployment rate rises above the natural rate.", "A recession is a period of falling real GDP, which raises cyclical unemployment.",
     [("Real GDP rises faster than potential output.", "Describes a boom or expansion, not a recession."), ("Cyclical unemployment falls below zero.", "Cyclical unemployment rises in a recession."), ("The price level and real GDP both rise sharply.", "Describes an expansion driven by rising aggregate demand."), ("Factories operate above their normal capacity.", "Capacity utilization falls in a recession.")]),
    ("Which of the following best describes the economy at the peak of a business cycle?", "Real GDP has reached its highest level before it begins to decline.", "A peak is the turning point between expansion and contraction.",
     [("Real GDP has reached its lowest level before it begins to rise.", "Describes a trough, not a peak."), ("Real GDP is falling and unemployment is rising.", "Describes a contraction after the peak."), ("Real GDP is always at the level of potential output.", "A peak need not coincide with potential output."), ("The unemployment rate is at its highest level.", "Unemployment is typically lowest near the peak.")]),
]


def ma_cycle_indicators(rng):
    q, kt, kw, wr = _v(rng, CYCLE)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_cycle_indicators", "2.7", "1.A", q, k, ds, rng, concept="business-cycle phases and their links to unemployment and output", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=50)
