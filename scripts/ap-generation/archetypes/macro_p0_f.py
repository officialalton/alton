"""AP Macroeconomics 원형 F — 단원 6(개방경제: 국제수지·환율·외환시장·순수출·국제 자본 이동). 2026-10-14."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401
from macro_models import *  # noqa: F401,F403


def _v(rng, table):
    return table[rng.randrange(len(table))]


# ======================= 6.1 국제수지 =======================
BOP = [
    ("A U.S. company exports aircraft to a foreign airline.", "The current account (a credit for exports of goods).", "Exports of goods are recorded in the current account."),
    ("A U.S. household imports a car produced in another country.", "The current account (a debit for imports of goods).", "Imports of goods are recorded in the current account."),
    ("A foreign investor buys shares of a U.S. company.", "The financial account (an inflow of foreign financial capital).", "Purchases of financial assets across borders are financial-account transactions."),
    ("A U.S. firm builds a new factory in another country.", "The financial account (an outflow of financial capital).", "Foreign direct investment abroad is a financial-account outflow."),
    ("A U.S. resident receives interest on a bond issued by a foreign government.", "The current account (a credit for income received from abroad).", "Income received from abroad is recorded in the current account."),
]
BOP_ALL = ["The current account (a credit for exports of goods).", "The current account (a debit for imports of goods).", "The financial account (an inflow of foreign financial capital).", "The financial account (an outflow of financial capital).", "The current account (a credit for income received from abroad)."]


def ma_bop_classify(rng):
    t, kt, kw = _v(rng, BOP)
    ent = {BOP_ALL[0]: "This entry records sales of goods to foreign buyers, which is not the transaction described.", BOP_ALL[1]: "This entry records purchases of goods from foreign sellers, which is not the transaction described.",
           BOP_ALL[2]: "This entry records foreign purchases of the country's financial assets, which is not the transaction described.", BOP_ALL[3]: "This entry records the country's purchases of foreign assets or investment abroad, which is not the transaction described.",
           BOP_ALL[4]: "This entry records income earned abroad, which is not the transaction described."}
    wl = [(o, ent[o]) for o in BOP_ALL if o != kt]
    stem = f"In the balance of payments accounts, where is the following transaction recorded? {t}"
    k, ds = sent_opts(kt, kw, wl)
    return mk("ma_bop_classify", "6.1", "1.A", stem, k, ds, rng, concept="balance of payments: current versus financial account entries", path="fixed vetted transaction-to-account table", facts=[f"t={t[:30]}"], est=55)


@retry_sep
def ma_bop_calc(rng):
    gx = rng.choice([300, 400, 500, 600]); gm = gx + rng.choice([-100, 50, 100, 150]); sx = rng.choice([100, 150, 200]); sm = sx + rng.choice([-50, 0, 50]); inc = rng.choice([-20, 20, 40])
    ca = gx - gm + sx - sm + inc
    if ca == 0:
        raise ValueError("not_enough_separated_distractors")
    stim = tbl("A country's international transactions for one year (billions of dollars).", ["Item", "Amount"], [["Exports of goods", usd(gx)], ["Imports of goods", usd(gm)], ["Exports of services", usd(sx)], ["Imports of services", usd(sm)], ["Net income received from abroad", usd(inc)]])
    ask = rng.choice(["ca", "fa"])
    f = lambda v: (f"A surplus of ${abs(int(round(v))):,} billion" if v > 0 else f"A deficit of ${abs(int(round(v))):,} billion" if v < 0 else "Balance")  # noqa: E731
    if ask == "ca":
        stem = "The table shows a country's international transactions for one year. What is the country's current account balance?"
        key = float(ca)
        k, ds = val_opts(key, [("Reverses the sign by subtracting exports from imports.", -ca), ("Counts only the balance on goods.", gx - gm), ("Adds exports and imports instead of subtracting imports.", gx + gm + sx + sm + inc), ("Leaves out services.", gx - gm + inc), ("Leaves out the income received from abroad.", ca - inc)], f)
        kw = f"Current account = (goods exports - goods imports) + (service exports - service imports) + net income = {gx - gm} + {sx - sm} + {inc} = {ca}."
    else:
        stem = "The table shows a country's international transactions for one year, which make up the whole current account. Ignoring statistical discrepancies and capital account items, what must be the balance on the financial account?"
        key = float(-ca)
        k, ds = val_opts(key, [("Gives the financial account the same sign as the current account.", ca), ("Reports only the balance on goods with the opposite sign.", -(gx - gm)), ("Reports zero, because the accounts are independent.", 0), ("Counts only the goods balance.", gx - gm), ("Adds exports and imports of goods.", gx + gm)], f)
        kw = f"The current account balance is {ca}, so the financial account balance is {-ca}, because the two accounts sum to zero."
    agree(ca, int(sp.Integer(gx) - gm + sx - sm + inc), 1e-9, "ca")
    return mk("ma_bop_calc", "6.1", "1.C", stem, k, ds, rng, concept="current account balance and its offset in the financial account", path="integer arithmetic vs sympy", stim=stim, kwhy=kw, facts=[f"gx={gx}", f"gm={gm}", f"sx={sx}", f"sm={sm}", f"inc={inc}", f"ask={ask}", f"key={key:.1f}"], est=80)


BOPID = [
    ("A country has a large current account deficit. Which of the following must be true, ignoring statistical discrepancies?", "The financial account has a surplus of the same size, so the country borrows from abroad.", "The current and financial accounts sum to zero, so a current account deficit is matched by net financial capital inflows.",
     [("The financial account has a deficit of the same size.", "The accounts sum to zero, so their balances have opposite signs."), ("The financial account balance equals zero, because the accounts are independent.", "A current account deficit must be financed by a financial account surplus."), ("The country's exports of goods exceed its imports of goods.", "A current account deficit means spending on imports and payments exceeds receipts."), ("The country's currency must have appreciated in every previous year.", "The identity does not require a particular exchange-rate history.")]),
]


def ma_bop_identity(rng):
    q, kt, kw, wr = BOPID[0]
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_bop_identity", "6.1", "3.A", q, k, ds, rng, concept="the current and financial accounts sum to zero", path="fixed vetted statements", facts=["variant=bop_identity"], est=55)


# ======================= 6.2 환율 =======================
@retry_sep
def ma_exchange_calc(rng):
    rate = rng.choice([Fr(1, 10), Fr(1, 2), Fr(2), Fr(4), Fr(5), Fr(10), Fr(100)])  # 외국 통화 단위 / 달러
    cur = {Fr(1, 10): ("pounds", "dollars"), Fr(1, 2): ("euros", "dollars"), Fr(2): ("francs", "dollars"), Fr(4): ("pesos", "dollars"), Fr(5): ("yuan", "dollars"), Fr(10): ("pesos", "dollars"), Fr(100): ("yen", "dollars")}[rate]
    foreign = cur[0]
    price = rng.choice([20, 40, 50, 100, 200])
    ask = rng.choice(["dollars_to_foreign", "foreign_price_in_dollars"])
    if ask == "dollars_to_foreign":
        amt = rng.choice([10, 20, 50, 100])
        key = float(amt * rate)
        stem = f"The exchange rate is {nm(float(rate), 2)} {foreign} per dollar. How many {foreign} can a traveler get for ${amt}?"
        k, ds = val_opts(key, [("Divides the dollar amount by the exchange rate instead of multiplying.", float(amt / rate)), ("Reports the dollar amount.", amt), ("Subtracts the exchange rate from the dollar amount.", amt - float(rate)), ("Multiplies by the inverse of the exchange rate twice.", float(amt / rate / rate)), ("Adds the exchange rate to the dollar amount.", amt + float(rate))], lambda v: f"{nm(v, 2)} {foreign}")
        kw = f"{amt} dollars x {nm(float(rate), 2)} {foreign} per dollar = {nm(key, 2)} {foreign}."
        agree(key, float(sp.Integer(amt) * sp.Rational(rate.numerator, rate.denominator)), 1e-9, "conv")
        facts = [f"rate={float(rate):.4f}", f"amt={amt}", "ask=d2f", f"key={key:.4f}"]
    else:
        pf = int(price * rate) if (price * rate).denominator == 1 else None
        if pf is None:
            raise ValueError("not_enough_separated_distractors")
        key = float(Fr(pf) / rate)
        stem = f"A good costs {pf:,} {foreign} in a foreign country, and the exchange rate is {nm(float(rate), 2)} {foreign} per dollar. What is the price of the good in dollars?"
        k, ds = val_opts(key, [("Multiplies the foreign price by the exchange rate instead of dividing.", float(pf * rate)), ("Reports the foreign price as the dollar price.", pf), ("Subtracts the exchange rate from the foreign price.", pf - float(rate)), ("Divides the exchange rate by the foreign price.", float(rate / pf)), ("Divides the foreign price by the exchange rate twice.", float(pf / rate / rate))], lambda v: usd(v))
        kw = f"{pf} {foreign} / {nm(float(rate), 2)} {foreign} per dollar = {usd(key)}."
        agree(key, float(sp.Integer(pf) / sp.Rational(rate.numerator, rate.denominator)), 1e-9, "conv")
        facts = [f"rate={float(rate):.4f}", f"pf={pf}", "ask=f2d", f"key={key:.4f}"]
    return mk("ma_exchange_calc", "6.2", "1.C", stem, k, ds, rng, concept="convert between currencies using the exchange rate", path="exact fraction vs sympy rational", kwhy=kw, facts=facts, est=60)


@retry_sep
def ma_appreciation_calc(rng):
    e0 = rng.choice([Fr(10), Fr(20), Fr(25), Fr(40)]); e1 = e0 * rng.choice([Fr(11, 10), Fr(9, 10), Fr(6, 5), Fr(4, 5)])
    f0 = e0; f1 = e1
    pct = (f1 / f0 - 1) * 100
    if pct == 0:
        raise ValueError("not_enough_separated_distractors")
    stem = f"Last year the exchange rate was {nm(float(f0), 2)} pesos per dollar. This year it is {nm(float(f1), 2)} pesos per dollar. Which of the following is correct?"
    dollar_up = f1 > f0
    k, ds = sent_opts(f"The dollar appreciated against the peso, by {nm(abs(float(pct)), 1)} percent.", f"Each dollar now buys {'more' if dollar_up else 'fewer'} pesos, so the dollar {'appreciated' if dollar_up else 'depreciated'} by {nm(abs(float(pct)), 1)} percent.",
                      [(f"The dollar depreciated against the peso, by {nm(abs(float(pct)), 1)} percent.", "Reverses appreciation and depreciation; a dollar that buys more pesos has appreciated.") if dollar_up else (f"The dollar appreciated against the peso, by {nm(abs(float(pct)), 1)} percent.", "Reverses appreciation and depreciation; a dollar that buys fewer pesos has depreciated."),
                       (f"The peso appreciated against the dollar, by {nm(abs(float(pct)), 1)} percent.", "Reverses the direction for the peso; if the dollar buys more pesos the peso has depreciated.") if dollar_up else (f"The peso depreciated against the dollar, by {nm(abs(float(pct)), 1)} percent.", "Reverses the direction for the peso; if the dollar buys fewer pesos the peso has appreciated."),
                       (f"The exchange rate did not change in value, because only the quote changed.", "Ignores that the exchange rate changed the pesos per dollar."), (f"The dollar changed in value by {nm(float(f1 - f0), 2)} percent.", "Treats the change in the quoted rate in pesos as a percent change.") if False else (f"The change in the exchange rate was {nm(abs(float(f1 - f0)), 2)} percent.", "Treats the absolute change in the quote as a percent change."),
                       ("The dollar depreciated, because a larger number of pesos per dollar means the dollar is worth less.", "Reverses the meaning of a larger quote; more pesos per dollar means the dollar is worth more.") if dollar_up else ("The dollar appreciated, because a smaller number of pesos per dollar means the dollar is worth more.", "Reverses the meaning of a smaller quote; fewer pesos per dollar means the dollar is worth less.")])
    agree(float(pct), float((sp.Rational(f1.numerator, f1.denominator) / sp.Rational(f0.numerator, f0.denominator) - 1) * 100), 1e-9, "pct")
    return mk("ma_appreciation_calc", "6.2", "2.C", stem, k, ds, rng, concept="appreciation and depreciation from a change in the exchange rate", path="exact ratio of quotes vs sympy rational", facts=[f"f0={float(f0):.4f}", f"f1={float(f1):.4f}", f"pct={float(pct):.4f}"], est=65)


# ======================= 6.3·6.4 외환시장 =======================
def ma_fx_graph(rng):
    m = new_mkt(rng, 30, 60, 20, 50)
    ev, dd, sd, mech = _v(rng, FX_EVENTS)
    s_ = 20 * (dd or sd)
    dA = s_ if dd else 0; dC = -s_ if sd else 0
    q1, p1 = mkt_check(m, dA=dA, dC=dC); q0, p0 = mkt_check(m)
    d = fx_dirs(dd, sd)
    if (_sg(float(p1 - p0)), _sg(float(q1 - q0))) != (d["ER"], d["QC"]):
        raise ValueError("graph_rule")
    cur = [("D1", line_pts(m.A, -m.B, 0, m.A / m.B)), ("S1", line_pts(m.C, m.D, 0, 100))] + ([("D2", line_pts(m.A + dA, -m.B, 0, (m.A + dA) / m.B))] if dd else [("S2", line_pts(m.C + dC, m.D, 0, 100))])
    yhi = int(max(m.A, m.A + dA)) + 10
    stim = econ_graph("Foreign exchange market for the dollar: the equilibrium moves from E1 to E2 after one curve shifts.", cur, 100, yhi, 10, 20, points=[("E1", m.Q0, m.P0), ("E2", float(q1), float(p1))], xlabel="Quantity of dollars (billions)", ylabel="Exchange rate (yen per dollar)")
    which = "demand for" if dd else "supply of"
    sgn = dd or sd
    stem = "The graph shows the foreign exchange market for the dollar, with the exchange rate in yen per dollar. The equilibrium moves from E1 to E2. Which of the following correctly describes the move?"
    rt = "right" if sgn == 1 else "left"
    k, ds = sent_opts(f"The {which} dollars shifts to the {rt}, and the dollar {'appreciates' if d['ER'] == 1 else 'depreciates'}.", f"The graph shows the {which} dollars shifting {rt}, which moves the exchange rate {'up' if d['ER'] == 1 else 'down'}.",
                      [(f"The {which} dollars shifts to the {rt}, and the dollar {'depreciates' if d['ER'] == 1 else 'appreciates'}.", "Gets the effect on the value of the dollar backward; a higher yen-per-dollar rate is an appreciation."),
                       (f"The {'supply of' if dd else 'demand for'} dollars shifts to the {rt}, and the dollar {'appreciates' if d['ER'] == 1 else 'depreciates'}.", "Names the wrong curve; the graph shows the other curve shifting."),
                       (f"The {which} dollars shifts to the {'left' if sgn == 1 else 'right'}, and the dollar {'appreciates' if d['ER'] == 1 else 'depreciates'}.", "Gets the direction of the shift backward."),
                       (f"The economy moves along an unchanged {which} dollars curve, and the dollar {'appreciates' if d['ER'] == 1 else 'depreciates'}.", "A shift of a curve in the graph is not a movement along a fixed curve."),
                       (f"The dollar's value does not change, because exchange rates are fixed in this market.", "The graph shows a floating exchange rate that changes with the curves.")])
    return mk("ma_fx_graph", "6.3", "3.A", stem, k, ds, rng, concept="read a shift in the demand or supply of a currency from the foreign exchange graph", path="equilibrium recomputed exactly and by sympy; direction rule table", stim=stim, facts=[f"dd={dd}", f"sd={sd}", f"d={d}", f"E0={m.P0}", f"Q0={m.Q0}"], est=70)


def ma_fx_events(rng):
    ev, dd, sd, mech = _v(rng, FX_EVENTS)
    d = fx_dirs(dd, sd)
    er = d["ER"]
    nx = -er  # 통화 가치가 오르면 순수출 감소
    truth = {"ER": er, "NX": nx}
    mm = {"ER": f"{mech} The currency {'appreciates' if er == 1 else 'depreciates'}.", "NX": f"When the currency {'appreciates' if er == 1 else 'depreciates'}, the country's goods become {'more' if er == 1 else 'less'} expensive to foreigners and imports become {'cheaper' if er == 1 else 'more expensive'}, so net exports {'fall' if nx == -1 else 'rise'}."}
    key, ds = combo_item(rng, ["ER", "NX"], truth, mm, dirs=(1, -1, 0))
    stem = f"Consider the following event in a country with a floating exchange rate: {ev} What is the most likely effect on the value of the country's currency and on its net exports?"
    return mk("ma_fx_events", "6.4", "3.A", stem, key, ds, rng, concept="determinants of currency demand and supply: effect on the exchange rate and net exports", path="direction rule table vs numeric simulation of a linear currency market; net exports opposite to currency value", facts=[f"ev={ev[:30]}", f"dd={dd}", f"sd={sd}", f"truth={truth}"], est=70)


FXD = [
    ("Which of the following would increase the demand for a country's currency in the foreign exchange market?", "Foreign investors want to buy more of the country's financial assets because its interest rates rise.", "Foreign investors must buy the country's currency to purchase its assets.",
     [("Domestic residents want to buy more imported goods.", "Buying imports increases the supply of the country's currency, not its demand."), ("The country's interest rates fall relative to rates abroad.", "Lower relative interest rates reduce foreign demand for its assets."), ("Domestic investors buy more foreign financial assets.", "This increases the supply of the country's currency."), ("The country's inflation rate rises relative to other countries.", "A higher relative price level makes its goods less attractive, reducing demand for its currency.")]),
    ("A country's inflation rate rises relative to the inflation rates of its trading partners. What is the most likely effect on its currency in the foreign exchange market?", "The currency depreciates, because its goods become less attractive to foreigners and imports become more attractive.", "Higher relative prices lower exports and raise imports.",
     [("The currency appreciates, because higher prices raise the value of money.", "Higher relative inflation reduces demand for the currency and raises its supply."), ("The currency does not change, because inflation affects only the price level.", "Relative price changes shift currency demand and supply."), ("The currency appreciates, because exports rise.", "Higher relative prices reduce, not raise, exports."), ("The currency depreciates, because interest rates must fall automatically.", "The effect works through relative prices, not an automatic fall in interest rates.")]),
]


def ma_fx_determinants(rng):
    q, kt, kw, wr = _v(rng, FXD)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_fx_determinants", "6.3", "1.A", q, k, ds, rng, concept="determinants of currency demand and supply", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=60)


# ======================= 6.5 순수출과 AD =======================
def ma_nx_ad(rng):
    dep = rng.choice([True, False])
    nx = 1 if dep else -1
    d = adas_dirs(nx, 0)
    vs = rng.choice([("NX", "Y"), ("NX", "P"), ("Y", "P")])
    truth = {"NX": nx, "Y": d["Y"], "P": d["P"]}
    mm = {"NX": f"A {'depreciation' if dep else 'appreciation'} makes the country's goods {'cheaper' if dep else 'more expensive'} to foreigners and imports {'more expensive' if dep else 'cheaper'}, so net exports {'rise' if dep else 'fall'}.",
          "Y": f"Net exports are a component of AD, so AD shifts {'right' if dep else 'left'} and real GDP {'rises' if d['Y'] == 1 else 'falls'} in the short run.", "P": f"AD shifts {'right' if dep else 'left'} along SRAS, so the price level {'rises' if d['P'] == 1 else 'falls'} in the short run."}
    key, ds = combo_item(rng, list(vs), truth, mm, dirs=(1, -1, 0))
    stem = f"The value of a country's currency {'depreciates' if dep else 'appreciates'} in the foreign exchange market, and nothing else changes. What is the most likely short-run effect?"
    return mk("ma_nx_ad", "6.5", "3.B", stem, key, ds, rng, concept="currency value, net exports, and aggregate demand", path="net exports direction opposite to currency value; adas direction table vs numeric AD-SRAS simulation", facts=[f"dep={dep}", f"vs={vs}", f"truth={truth}"], est=70)


STRONG = [
    ("The value of a country's currency rises substantially against other currencies. Which of the following groups is most likely to benefit?", "Domestic consumers and firms that buy imported goods.", "A stronger currency makes imports cheaper.",
     [("Domestic firms that export most of their output.", "Exporters are hurt because their goods become more expensive for foreign buyers."), ("Domestic firms that compete with imports.", "Import-competing firms face cheaper foreign goods."), ("Foreign tourists visiting the country.", "Foreign tourists find the country more expensive."), ("Workers in the country's export industries.", "Export industries lose sales when the currency strengthens.")]),
    ("Which of the following is the most likely effect of a significant depreciation of a country's currency?", "Exports rise and imports fall, which raises net exports.", "A weaker currency makes the country's goods cheaper abroad and foreign goods costlier at home.",
     [("Exports fall and imports rise, which lowers net exports.", "Reverses the effect of a depreciation on trade."), ("Both exports and imports rise by the same amount.", "A depreciation changes relative prices in opposite directions for exports and imports."), ("Foreign goods become cheaper for domestic consumers.", "A weaker currency makes foreign goods more expensive."), ("Net exports are unchanged, because exchange rates do not affect prices.", "Exchange rates change relative prices and trade flows.")]),
]


def ma_strong_currency(rng):
    q, kt, kw, wr = _v(rng, STRONG)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_strong_currency", "6.5", "1.D", q, k, ds, rng, concept="winners and losers from a stronger or weaker currency", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=60)


# ======================= 6.6 실질금리와 국제 자본 이동 =======================
CAP_EV = [
    ("The country's government runs a larger budget deficit that raises the country's real interest rate relative to rates abroad.", 1, "A higher domestic real interest rate attracts foreign financial capital."),
    ("The country's central bank lowers interest rates so that its real interest rate falls relative to rates abroad.", -1, "A lower domestic real interest rate reduces foreign demand for the country's financial assets and raises domestic investors' purchases of foreign assets."),
    ("Real interest rates in the rest of the world fall while the country's real interest rate stays the same.", 1, "A higher relative domestic real interest rate attracts foreign financial capital."),
    ("Real interest rates in the rest of the world rise while the country's real interest rate stays the same.", -1, "A lower relative domestic real interest rate reduces net financial capital inflows."),
]


def ma_capital_flows(rng):
    ev, c, mech = _v(rng, CAP_EV)
    er = c  # 순자본유입 증가 → 통화 수요↑ → 절상
    truth = {"CAP": c, "ER": er}
    # 독립 경로: 외환시장 모형으로 환율 방향
    d = fx_dirs(1 if c == 1 else 0, 1 if c == -1 else 0)
    agree(d["ER"], er, 1e-9, "er")
    mm = {"CAP": f"{mech} Net financial capital inflows {'rise' if c == 1 else 'fall'}.", "ER": f"The {'greater' if c == 1 else 'smaller'} flow of foreign financial capital {'raises' if c == 1 else 'lowers'} the demand for the currency (or raises its supply), so the currency {'appreciates' if er == 1 else 'depreciates'}."}
    key, ds = combo_item(rng, ["CAP", "ER"], truth, mm, dirs=(1, -1, 0))
    stem = f"Consider the following event: {ev} What is the most likely effect on net financial capital inflows to the country and on the value of its currency?"
    return mk("ma_capital_flows", "6.6", "3.B", stem, key, ds, rng, concept="real interest rate differences drive capital flows and the exchange rate", path="direction of net capital inflows by interest differential; exchange-rate direction from the foreign exchange rule table vs simulation", facts=[f"ev={ev[:30]}", f"c={c}", f"truth={truth}"], est=70)


def ma_policy_fx_chain(rng):
    exp = rng.choice([True, False])
    stem = f"A central bank carries out {'expansionary' if exp else 'contractionary'} monetary policy in an economy with ample reserves, and the exchange rate floats. Which of the following correctly describes the chain of effects in the short run?"
    a = lambda x, y: x if exp else y  # noqa: E731
    key = f"Interest rates {a('fall', 'rise')}, net financial capital {a('outflows rise', 'inflows rise')}, the currency {a('depreciates', 'appreciates')}, net exports {a('rise', 'fall')}, and aggregate demand shifts {a('right', 'left')} further."
    wr = [(f"Interest rates {a('fall', 'rise')}, net financial capital {a('inflows rise', 'outflows rise')}, the currency {a('appreciates', 'depreciates')}, net exports {a('fall', 'rise')}, and aggregate demand shifts {a('left', 'right')} further.", "Reverses the capital-flow and exchange-rate steps."),
          (f"Interest rates {a('fall', 'rise')}, net financial capital {a('outflows rise', 'inflows rise')}, the currency {a('depreciates', 'appreciates')}, net exports {a('fall', 'rise')}, and aggregate demand shifts {a('left', 'right')} further.", "Gets the effect of the exchange rate on net exports backward."),
          (f"Interest rates {a('rise', 'fall')}, net financial capital {a('inflows rise', 'outflows rise')}, the currency {a('appreciates', 'depreciates')}, net exports {a('fall', 'rise')}, and aggregate demand shifts {a('left', 'right')} further.", "Starts from the wrong interest-rate effect of the policy."),
          (f"Interest rates {a('fall', 'rise')}, net financial capital {a('outflows rise', 'inflows rise')}, the currency {a('depreciates', 'appreciates')}, net exports {a('rise', 'fall')}, and aggregate demand shifts {a('left', 'right')}, offsetting the policy.", "Gets the final AD shift backward; net exports are a component of AD and reinforce the policy."),
          (f"Interest rates {a('fall', 'rise')} and nothing else changes, because the exchange rate is not affected by interest rates.", "Ignores that interest rates change capital flows and the exchange rate.")]
    k, ds = sent_opts(key, "Policy changes interest rates, which change capital flows and the exchange rate, which change net exports and reinforce the shift in AD.", wr)
    return mk("ma_policy_fx_chain", "6.6", "2.B", stem, k, ds, rng, concept="monetary policy transmission through the open economy", path="fixed vetted chain; each link checked with the foreign-exchange and AD-AS rule tables", facts=[f"exp={exp}"], est=75)


@retry_sep
def ma_ncf_identity(rng):
    ex = rng.choice([400, 500, 600, 800]); im = ex + rng.choice([-100, -50, 100, 150, 200])
    nx = ex - im
    stim = tbl("A country's trade in goods and services for one year (billions of dollars).", ["Item", "Amount"], [["Exports", usd(ex)], ["Imports", usd(im)]])
    stem = "The table shows a country's exports and imports of goods and services. Assuming there are no other international transactions, what is the country's net capital outflow?"
    f = lambda v: (f"A net capital outflow of ${abs(int(round(v))):,} billion" if v > 0 else f"A net capital inflow of ${abs(int(round(v))):,} billion" if v < 0 else "Zero")  # noqa: E731
    k, ds = val_opts(float(nx), [("Reverses the sign by subtracting exports from imports.", -nx), ("Reports exports as the net capital outflow.", ex), ("Reports imports as the net capital outflow.", im), ("Adds exports and imports.", ex + im), ("Reports half of net exports.", nx / 2)], f)
    agree(nx, int(sp.Integer(ex) - im), 1e-9, "nx")
    return mk("ma_ncf_identity", "6.6", "1.C", stem, k, ds, rng, concept="net capital outflow equals net exports", path="integer subtraction vs sympy", stim=stim, kwhy=f"Net exports = {ex} - {im} = {nx}, so net capital outflow = {nx}.", facts=[f"ex={ex}", f"im={im}", f"nx={nx}"], est=65)
