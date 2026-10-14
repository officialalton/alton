"""AP Macroeconomics 원형 D — 단원 4(금융 부문: 금융자산·실질금리·화폐·은행·화폐시장·통화정책·대부자금시장). 2026-10-14.
화폐공급 변화(공개시장조작·지급준비율)는 '지급준비금이 제한적인 경제'를 명시한 문항에서만 쓴다(CED POL-1.D.6). 지급준비금이 충분한 경제는 관리금리(지급준비금 이자율 등)로 설명한다."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401
from macro_models import *  # noqa: F401,F403


def _v(rng, table):
    return table[rng.randrange(len(table))]


# ======================= 4.1 금융자산 =======================
FIN = [
    ("Which of the following correctly compares a corporate bond with a share of stock?", "A bond is a loan that pays interest and is repaid at maturity, while a share of stock is an ownership claim on the firm.", "Bondholders are creditors; stockholders are owners.",
     [("A bond gives ownership of the firm, while a share of stock is a loan to the firm.", "Reverses the two assets; a bond is a loan and a share is ownership."), ("A bond pays a return that depends on the firm's profit, while a share of stock pays a fixed interest rate.", "Reverses the typical return patterns of the two assets."), ("A bond and a share of stock are both forms of money.", "Stocks and bonds are financial assets, not money."),
      ("A bond always has a higher risk than a share of stock.", "Stocks are typically riskier than bonds because stockholders are paid after creditors.")]),
    ("Which of the following assets is the most liquid?", "Cash held in a wallet.", "Cash can be used immediately without any loss of value, so it is the most liquid asset.",
     [("A share of stock in a large firm.", "A stock must be sold first, which takes time and can involve a loss, so it is less liquid than cash."), ("A rental house.", "Selling real estate takes time and costs, so it is much less liquid."), ("A ten-year government bond.", "A bond must be sold, and its price can change, so it is less liquid than cash."), ("A certificate of deposit with a penalty for early withdrawal.", "The penalty makes the certificate less liquid than cash.")]),
    ("Which of the following correctly describes the relationship between risk and return on financial assets?", "Assets with higher risk generally must offer a higher expected return to attract buyers.", "Investors require compensation for bearing risk.",
     [("Assets with higher risk generally offer a lower expected return.", "Reverses the risk-return trade-off."), ("Risk and return are unrelated for financial assets.", "Ignores that investors require higher returns for greater risk."), ("Assets with higher liquidity must offer a higher return than assets with lower liquidity.", "Reverses the liquidity relationship; illiquid assets usually must offer higher returns."),
      ("Government bonds are always riskier than corporate bonds.", "Government bonds are generally lower risk than corporate bonds.")]),
]


def ma_financial_assets(rng):
    q, kt, kw, wr = _v(rng, FIN)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_financial_assets", "4.1", "1.D", q, k, ds, rng, concept="stocks, bonds, liquidity, risk, and return", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


BOND_EV = [
    ("Market interest rates rise.", -1, "Existing bonds with lower fixed payments become less attractive, so their prices fall."),
    ("Market interest rates fall.", 1, "Existing bonds with higher fixed payments become more attractive, so their prices rise."),
    ("The central bank sells government bonds in the open market, raising interest rates.", -1, "Higher interest rates reduce the price of previously issued bonds."),
    ("The central bank buys government bonds in the open market, lowering interest rates.", 1, "Lower interest rates raise the price of previously issued bonds."),
]


def ma_bond_price(rng):
    ev, d, mech = _v(rng, BOND_EV)
    vs = ("B", "i")
    t = {"B": d, "i": -d}
    mm = {"B": f"Bond prices and interest rates move in opposite directions: {mech}", "i": f"The market interest rate {'falls' if d == 1 else 'rises'} when previously issued bond prices {'rise' if d == 1 else 'fall'}."}
    key, ds = combo_item(rng, ["B", "i"], t, mm, dirs=(1, -1, 0))
    stem = f"Consider the following event: {ev} What is the effect on the price of previously issued bonds and on the market interest rate?"
    if "central bank" not in ev:
        stem = f"Consider the following event. {ev} What is the most likely effect on the price of previously issued bonds?"
        k, ds = sent_opts(f"The price of previously issued bonds {'rises' if d == 1 else 'falls'}.", mech, [(f"The price of previously issued bonds {'falls' if d == 1 else 'rises'}.", "Reverses the inverse relationship between bond prices and interest rates."), ("The price of previously issued bonds does not change, because the bond's face value is fixed.", "Confuses the fixed face value with the market price, which moves with interest rates."),
                                                                                           (f"The price of previously issued bonds {'falls' if d == 1 else 'rises'}, because the interest payments on these bonds {'fall' if d == 1 else 'rise'}.", "Confuses the bond's fixed payments with the market interest rate; the payments on previously issued bonds do not change."), ("The price of previously issued bonds and interest rates move in the same direction.", "Bond prices and market interest rates move in opposite directions.")])
        return mk("ma_bond_price", "4.1", "3.A", stem, k, ds, rng, concept="bond prices and interest rates are inversely related", path="inverse price-yield relation: present value of fixed payments recomputed at the new rate", facts=[f"ev={ev[:30]}", f"d={d}"], est=50)
    return mk("ma_bond_price", "4.1", "3.A", stem, key, ds, rng, concept="bond prices and interest rates are inversely related", path="inverse price-yield relation: present value of fixed payments recomputed at the new rate", facts=[f"ev={ev[:30]}", f"d={d}"], est=55)


# ======================= 4.2 명목·실질 이자율 =======================
@retry_sep
def ma_real_rate(rng):
    nom = rng.choice([4, 5, 6, 8, 10, 12]); infl = rng.choice([1, 2, 3, 4, 5]); ask = rng.choice(["real", "nominal", "expected"])
    real = nom - infl
    if real <= 0:
        raise ValueError("not_enough_separated_distractors")
    f = lambda v: f"{nm(v, 1)}%"  # noqa: E731
    if ask == "real":
        stem = f"A bank offers a loan with a nominal interest rate of {nom} percent. Borrowers and lenders expect an inflation rate of {infl} percent over the life of the loan. What is the expected real interest rate?"
        key = real
        k, ds = val_opts(key, [("Adds expected inflation to the nominal rate.", nom + infl), ("Reports the nominal rate as the real rate.", nom), ("Reports the expected inflation rate.", infl), ("Reverses the subtraction, producing the negative of the real rate.", -real), ("Divides the nominal rate by expected inflation.", nom / infl)], f)
        kw = f"Real interest rate = nominal rate - expected inflation = {nom} - {infl} = {real} percent."
    elif ask == "nominal":
        stem = f"Borrowers and lenders agree that the real interest rate on a loan should be {real} percent, and they expect inflation of {infl} percent. What nominal interest rate should the loan carry?"
        key = nom
        k, ds = val_opts(key, [("Subtracts expected inflation from the real rate.", real - infl), ("Reports the real rate as the nominal rate.", real), ("Reports the expected inflation rate.", infl), ("Multiplies the real rate by expected inflation.", real * infl), ("Subtracts the real rate from expected inflation and takes the absolute value.", abs(infl - real))], f)
        kw = f"Nominal interest rate = real rate + expected inflation = {real} + {infl} = {nom} percent."
    else:
        stem = f"A loan has a nominal interest rate of {nom} percent and an expected real interest rate of {real} percent. What inflation rate do the parties expect?"
        key = infl
        k, ds = val_opts(key, [("Adds the nominal and real rates.", nom + real), ("Reports the nominal rate.", nom), ("Reports the real rate.", real), ("Reverses the subtraction, producing the negative of expected inflation.", -infl), ("Divides the nominal rate by the real rate.", nom / real)], f)
        kw = f"Expected inflation = nominal rate - real rate = {nom} - {real} = {infl} percent."
    agree(real, int(sp.Integer(nom) - sp.Integer(infl)), 1e-9, "real")
    return mk("ma_real_rate", "4.2", "1.C", stem, k, ds, rng, concept="real interest rate = nominal rate - expected inflation", path="integer arithmetic vs sympy", kwhy=kw, facts=[f"nom={nom}", f"infl={infl}", f"real={real}", f"ask={ask}"], est=50)


RR_EV = [
    ("Lenders expect inflation to be 2 percent, but inflation turns out to be 6 percent. The loan carried a fixed nominal interest rate. Which of the following is correct?", "The realized real interest rate is lower than the expected real interest rate, so lenders lose and borrowers gain.", "Unexpectedly high inflation lowers the realized real rate on a fixed nominal loan.",
     [("The realized real interest rate is higher than the expected real rate, so lenders gain and borrowers lose.", "Reverses the effect of higher-than-expected inflation on the real rate."), ("The realized real interest rate equals the expected real rate, because the nominal rate is fixed.", "Confuses a fixed nominal rate with a fixed real rate."), ("The nominal interest rate rises automatically to offset the unexpected inflation.", "A fixed nominal rate does not adjust after the loan is made."),
      ("Neither party is affected, because both parties paid or received the same dollar amounts.", "Ignores that the purchasing power of the repayment differs from what was expected.")]),
    ("Which interest rate should a firm compare with the expected return on a new investment project when deciding whether to borrow?", "The real interest rate, because it measures the cost of borrowing in terms of purchasing power.", "The expected real return on the project should be compared with the real cost of funds.",
     [("The nominal interest rate only, because the loan is repaid in dollars and prices do not matter.", "Ignores the effect of inflation on the real cost of repayment."), ("The rate on government bonds, regardless of the loan.", "The relevant cost is the rate on the firm's own borrowing, adjusted for inflation."), ("The inflation rate, because it measures the project's cost.", "Inflation alone is not the cost of funds."),
      ("The federal funds rate, because all firms borrow at that rate.", "Firms borrow at different rates, and the decision depends on the real cost.")]),
]


def ma_real_rate_logic(rng):
    q, kt, kw, wr = _v(rng, RR_EV)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_real_rate_logic", "4.2", "2.A", q, k, ds, rng, concept="why real interest rates drive borrowing and lending decisions", path="fixed vetted statements; the realized real rate recomputed as nominal minus actual inflation", facts=[f"variant={q[:30]}"], est=60)


# ======================= 4.3 화폐 =======================
MONEY_FN = [
    ("People in a village accept shells in exchange for all goods and services.", "medium of exchange", "Accepted in exchange for goods and services."),
    ("A shop lists all of its prices in euros.", "unit of account", "Prices stated in a common unit let people compare values."),
    ("A family saves part of its income as cash to use for purchases several months later.", "store of value", "Money held now keeps its purchasing power for use later."),
]
FN_WHY = {"medium of exchange": "Describes the use of money in transactions, not the situation given.", "unit of account": "Describes the use of money as a common measure of value, not the situation given.", "store of value": "Describes holding money to keep purchasing power over time, not the situation given."}


def ma_money_functions(rng):
    t, fn_, mech = _v(rng, MONEY_FN)
    others = [f for f in FN_WHY if f != fn_]
    stem = f"Which function of money is best illustrated by the following situation? {t}"
    k, ds = sent_opts(cap1(fn_) + ".", mech, [(cap1(o) + ".", FN_WHY[o]) for o in others] + [("Standard of deferred payment only.", "Describes the use of money to settle debts, which is not the situation given."), ("Barter.", "Barter is exchange without money, the opposite of the situation described.")])
    return mk("ma_money_functions", "4.3", "1.B", stem, k, ds, rng, concept="functions of money", path="fixed vetted scenario table", facts=[f"fn={fn_}"], est=45)


M_ITEMS = [
    ("A household moves $1,000 from a checking account to a savings account. What happens to M1 and M2?", "M1 decreases by $1,000 and M2 does not change.", "Savings deposits are in M2 but not M1, so the move lowers M1 and leaves M2 unchanged.",
     [("M1 increases by $1,000 and M2 does not change.", "Reverses the effect on M1; checking deposits are part of M1 and savings deposits are not."), ("M1 does not change and M2 decreases by $1,000.", "M2 includes both checking and savings deposits, so the total does not change."), ("Both M1 and M2 decrease by $1,000.", "M2 includes savings deposits, so it does not fall."), ("Both M1 and M2 increase by $1,000.", "Moving funds between accounts does not create money.")]),
    ("Which of the following is counted as part of M1?", "Currency in circulation and checkable deposits.", "M1 consists of the most liquid forms of money.",
     [("Stocks and bonds held by households.", "Financial assets such as stocks and bonds are not money."), ("The limit available on a credit card.", "A credit card gives a line of credit, not money."), ("The total wealth of a household.", "Wealth includes assets that are not money."), ("The income a worker earns in a year.", "Income is a flow of earnings, not a stock of money.")]),
]


def ma_m1_m2(rng):
    q, kt, kw, wr = _v(rng, M_ITEMS)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_m1_m2", "4.3", "1.B", q, k, ds, rng, concept="what counts as M1 and M2; money versus income, wealth, and credit", path="fixed vetted statements", facts=[f"variant={q[:30]}"], est=55)


# ======================= 4.4 은행과 화폐 창조 =======================
@retry_sep
def ma_money_multiplier(rng):
    rr = rng.choice([Fr(1, 20), Fr(1, 10), Fr(1, 8), Fr(1, 5), Fr(1, 4)]); x = rng.choice([20, 40, 50, 100, 200]); ask = rng.choice(["mult", "max"])
    mult = 1 / rr
    f = lambda v: nm(v, 2)  # noqa: E731
    if ask == "mult":
        stem = f"The required reserve ratio is {nm(float(rr) * 100, 1)} percent, banks hold no excess reserves, and the public holds no currency. What is the simple money multiplier?"
        key = float(mult)
        k, ds = val_opts(key, [("Reports the required reserve ratio itself.", float(rr)), ("Reports 1 minus the required reserve ratio.", float(1 - rr)), ("Reports the reserve ratio as a percent.", float(rr) * 100), ("Divides 1 by (1 + required reserve ratio).", float(1 / (1 + rr))), ("Multiplies the reserve ratio by 10.", float(rr) * 10)], f)
        kw = f"The simple money multiplier is 1/required reserve ratio = 1/{nm(float(rr), 3)} = {nm(key, 2)}."
    else:
        stem = f"The central bank buys ${x} million of government bonds from the public in an economy with limited reserves, and the sellers deposit the proceeds in banks. The required reserve ratio is {nm(float(rr) * 100, 1)} percent, banks hold no excess reserves, and the public holds no currency. What is the maximum change in the money supply?"
        key = float(x * mult)
        k, ds = val_opts(key, [("Reports only the initial change in reserves, ignoring the multiplier.", x), ("Multiplies the initial change by the required reserve ratio.", float(x * rr)), ("Divides by (1 - required reserve ratio) instead of the required reserve ratio.", float(x / (1 - rr))), ("Subtracts the initial amount from the maximum expansion.", float(x * mult - x)), ("Multiplies by the multiplier and then by the reserve ratio.", float(x * mult * rr))], lambda v: f"${int(round(v)):,} million")
        kw = f"The multiplier is {nm(float(mult), 2)}, so the maximum change in the money supply is {x} x {nm(float(mult), 2)} = {nm(key, 1)} million."
    agree(float(mult), float(1 / sp.Rational(rr.numerator, rr.denominator)), 1e-9, "mult")
    return mk("ma_money_multiplier", "4.4", "3.C", stem, k, ds, rng, concept="simple money multiplier = 1/required reserve ratio", path="exact fraction vs sympy rational", kwhy=kw, facts=[f"rr={float(rr):.4f}", f"x={x}", f"ask={ask}", f"mult={float(mult):.4f}"], est=70)


@retry_sep
def ma_deposit_expansion(rng):
    rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4), Fr(1, 8)]); d = rng.choice([400, 800, 1000, 2000]); ask = rng.choice(["lend", "total", "required"])
    exc = d * (1 - rr); tot = d / rr; req = d * rr
    if ask == "lend":
        key = float(exc)
        stem = f"A bank that holds no excess reserves receives a new ${d:,} deposit of funds from outside the banking system. The required reserve ratio is {nm(float(rr) * 100, 1)} percent. What is the maximum amount this bank can lend?"
        wr = [("Reports the entire deposit, ignoring the required reserves.", d), ("Reports the amount the bank must hold as required reserves.", float(req)), ("Reports the maximum total expansion of deposits in the banking system.", float(tot)), ("Divides the deposit by (1 - required reserve ratio).", float(d / (1 - rr))), ("Subtracts the required reserve ratio as a dollar amount from the deposit.", d - float(rr))]
        kw = f"Required reserves are {nm(float(req), 0)}, so the bank can lend {d} - {nm(float(req), 0)} = {nm(key, 0)}."
    elif ask == "total":
        key = float(tot)
        stem = f"A bank that holds no excess reserves receives a new ${d:,} deposit of funds from outside the banking system. The required reserve ratio is {nm(float(rr) * 100, 1)} percent, banks lend out all excess reserves, and the public holds no currency. What is the maximum total increase in checkable deposits in the banking system?"
        wr = [("Reports only the new deposit.", d), ("Reports the amount the first bank can lend.", float(exc)), ("Multiplies the deposit by the required reserve ratio.", float(req)), ("Divides the deposit by (1 - required reserve ratio).", float(d / (1 - rr))), ("Subtracts the first bank's loan from the total.", float(tot - exc))]
        kw = f"The multiplier is 1/{nm(float(rr), 3)} = {nm(float(1 / rr), 2)}, so the maximum increase in deposits is {d} x {nm(float(1 / rr), 2)} = {nm(key, 0)}."
    else:
        key = float(req)
        stem = f"A bank receives a new ${d:,} deposit. The required reserve ratio is {nm(float(rr) * 100, 1)} percent. How much of the new deposit must the bank hold as required reserves?"
        wr = [("Reports the entire deposit.", d), ("Reports the amount the bank can lend.", float(exc)), ("Reports the maximum total expansion of deposits in the banking system.", float(tot)), ("Divides the deposit by (1 - required reserve ratio).", float(d / (1 - rr))), ("Reports the ratio as a dollar amount.", float(rr) * 100)]
        kw = f"Required reserves = {nm(float(rr), 3)} x {d} = {nm(key, 0)}."
    agree(float(tot), float(d / sp.Rational(rr.numerator, rr.denominator)), 1e-9, "tot")
    k, ds = val_opts(key, wr, lambda v: usd(v))
    return mk("ma_deposit_expansion", "4.4", "3.C", stem, k, ds, rng, concept="a new deposit supports loans of excess reserves and a total expansion of 1/rr", path="exact fractions vs sympy rationals", kwhy=kw, facts=[f"rr={float(rr):.4f}", f"d={d}", f"ask={ask}", f"key={key:.4f}"], est=70)


@retry_sep
def ma_bank_balance_sheet(rng):
    rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)]); dep = rng.choice([400, 500, 800, 1000]); res = int(dep * rr + rng.choice([20, 40, 60, 100])); loans = dep - res
    req = dep * rr; exc = res - req
    ask = rng.choice(["excess", "max_loan", "money"])
    stim = tbl("Balance sheet of a bank (millions of dollars).", ["Assets", "Amount", "Liabilities", "Amount"], [["Reserves", usd(res), "Checkable deposits", usd(dep)], ["Loans", usd(loans), "Total liabilities", usd(dep)]])
    if ask == "excess":
        key = float(exc)
        stem = f"The table shows a bank's balance sheet. The required reserve ratio is {nm(float(rr) * 100, 1)} percent. How much does the bank hold in excess reserves, in millions of dollars?"
        wr = [("Reports the bank's total reserves.", res), ("Reports required reserves.", float(req)), ("Reports loans.", loans), ("Subtracts deposits from reserves.", res - dep if res > dep else abs(res - dep)), ("Multiplies total reserves by the required reserve ratio.", float(res * rr))]
        kw = f"Required reserves = {nm(float(rr), 3)} x {dep} = {nm(float(req), 1)}, so excess reserves = {res} - {nm(float(req), 1)} = {nm(key, 1)}."
    elif ask == "max_loan":
        key = float(exc)
        stem = f"The table shows a bank's balance sheet. The required reserve ratio is {nm(float(rr) * 100, 1)} percent. What is the maximum amount of additional loans this bank can make, in millions of dollars?"
        wr = [("Reports the bank's total reserves.", res), ("Reports required reserves.", float(req)), ("Reports the bank's existing loans.", loans), ("Reports the bank's excess reserves times the multiplier.", float(exc / rr)), ("Reports deposits.", dep)]
        kw = f"Excess reserves are {res} - {nm(float(req), 1)} = {nm(key, 1)}; a bank can lend its excess reserves."
    else:
        key = float(exc / rr)
        stem = f"The table shows the balance sheet of a bank in an economy with limited reserves, where banks lend all excess reserves and the public holds no currency. The required reserve ratio is {nm(float(rr) * 100, 1)} percent. What is the maximum increase in the money supply that the banking system can create from this bank's excess reserves, in millions of dollars?"
        wr = [("Reports the bank's excess reserves only.", float(exc)), ("Reports total reserves times the multiplier.", float(res / rr)), ("Reports deposits.", dep), ("Multiplies excess reserves by the reserve ratio.", float(exc * rr)), ("Reports required reserves times the multiplier.", float(req / rr))]
        kw = f"Excess reserves are {nm(float(exc), 1)}; the multiplier is {nm(float(1 / rr), 1)}, so the maximum increase is {nm(key, 1)}."
    agree(float(exc), float(sp.Rational(res) - sp.Rational(dep) * sp.Rational(rr.numerator, rr.denominator)), 1e-9, "exc")
    k, ds = val_opts(key, wr, lambda v: f"${nm(v, 1)} million")
    return mk("ma_bank_balance_sheet", "4.4", "3.C", stem, k, ds, rng, concept="required versus excess reserves from a bank balance sheet", path="exact fractions vs sympy rationals", stim=stim, kwhy=kw, facts=[f"rr={float(rr):.4f}", f"dep={dep}", f"res={res}", f"loans={loans}", f"ask={ask}", f"key={key:.4f}"], est=80)


MMO = [
    ("Why is the actual expansion of the money supply usually smaller than the simple money multiplier predicts?", "Banks may hold excess reserves and the public may hold some money as currency, not deposits.", "Both reduce the amount of lending and deposit creation at each round.",
     [("Banks are required to lend out more than their excess reserves.", "Banks cannot lend more than their excess reserves."), ("The required reserve ratio is zero in practice, so no reserves are held.", "The simple multiplier uses the required reserve ratio, which is above zero."), ("The central bank destroys part of each new deposit as it is created.", "Deposits are not destroyed by the central bank in the expansion process."), ("Banks lend out the required reserves as well as excess reserves.", "Required reserves must be held, not lent.")]),
]


def ma_multiplier_overstated(rng):
    q, kt, kw, wr = MMO[0]
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_multiplier_overstated", "4.4", "1.D", q, k, ds, rng, concept="the simple money multiplier overstates the expansion", path="fixed vetted statements", facts=["variant=mm_overstated"], est=55)


# ======================= 4.5 화폐시장 =======================
def _mm_scene(rng):
    A = rng.choice([14, 16, 18, 20]); B = rng.choice([Fr(1, 2), Fr(1)]); M0 = rng.choice([20, 30, 40])
    return A, B, M0


def ma_money_market_graph(rng):
    ev, ms, md, mech = _v(rng, [e for e in MM_EVENTS if e[1] != 0])
    mm_dirs(ms, 0)
    dM = 10
    for _ in forever():
        A, B, M0 = _mm_scene(rng)
        i0 = A - float(B) * M0; i1 = A - float(B) * (M0 + ms * dM)
        if 2 < i1 < A - 1 and 2 < i0 < A - 1:
            break
    md_ = line_pts(A, -B, 0, A / B)
    xhi = int(A / float(B)) + 10
    ms1 = [(M0, 0), (M0, A)]; ms2 = [(M0 + ms * dM, 0), (M0 + ms * dM, A)]
    stim = econ_graph("Money market: money demand and two money supply curves; the equilibrium moves from E1 to E2.", [("MD", md_), ("MS1", ms1), ("MS2", ms2)], xhi, A + 2, 10, 2, points=[("E1", M0, round(i0, 2)), ("E2", M0 + ms * dM, round(i1, 2))], xlabel="Quantity of money (billions of dollars)", ylabel="Nominal interest rate (percent)")
    d = mm_dirs(ms, 0)
    if _sg(i1 - i0) != d:
        raise ValueError("graph_rule")
    stem = "The graph shows the money market of an economy with limited reserves. The equilibrium moves from E1 to E2 when the supply of money changes. Which of the following describes the change and a central bank action that could have caused it?"
    r = "right" if ms == 1 else "left"
    k, ds = sent_opts(f"The money supply curve shifts to the {r} and the nominal interest rate {'falls' if ms == 1 else 'rises'}, as when the central bank {'buys' if ms == 1 else 'sells'} government bonds.", f"The vertical money supply curve moves to the {r}, which {'lowers' if ms == 1 else 'raises'} the equilibrium nominal interest rate.",
                      [(f"The money supply curve shifts to the {r} and the nominal interest rate {'rises' if ms == 1 else 'falls'}, as when the central bank {'buys' if ms == 1 else 'sells'} government bonds.", "Gets the interest-rate effect backward; a larger money supply with unchanged demand lowers the nominal rate."),
                       (f"The money demand curve shifts to the {r} and the nominal interest rate {'rises' if ms == 1 else 'falls'}, as when the price level changes.", "The graph shows the money supply curve shifting, not money demand."), (f"The money supply curve shifts to the {'left' if ms == 1 else 'right'} and the nominal interest rate {'falls' if ms == 1 else 'rises'}, as when the central bank {'sells' if ms == 1 else 'buys'} government bonds.", "Misreads the direction of the shift in the graph; the supply curve moved the other way."),
                       (f"The economy moves along the money demand curve because the central bank changes its required reserve ratio, but the money supply curve does not shift.", "A change in the money supply shifts the supply curve; it is not only a movement along demand."), (f"The nominal interest rate does not change, because the money supply is vertical.", "A vertical supply curve means supply does not depend on the interest rate, but a shift of it changes the equilibrium rate.")])
    return mk("ma_money_market_graph", "4.5", "3.A", stem, k, ds, rng, concept="a money supply shift changes the equilibrium nominal interest rate", path="equilibrium rate from i = A - B*M recomputed after the shift vs the direction rule table", stim=stim, facts=[f"A={A}", f"B={float(B)}", f"M0={M0}", f"ms={ms}", f"i0={i0:.3f}", f"i1={i1:.3f}"], est=75)


def ma_money_market_shift(rng):
    ev, ms, md, mech = _v(rng, MM_EVENTS)
    di = mm_dirs(ms, md)
    cause = {(1, 0): "the money supply curve shifts to the right", (-1, 0): "the money supply curve shifts to the left", (0, 1): "the money demand curve shifts to the right", (0, -1): "the money demand curve shifts to the left"}
    stmt = {(s, m_): f"The {'money supply' if s else 'money demand'} curve shifts to the {'right' if (s or m_) == 1 else 'left'} and the nominal interest rate {'rises' if mm_dirs(s, m_) == 1 else 'falls'}." for (s, m_) in cause}
    key = stmt[(ms, md)]
    wrong = {(1, 0): "Predicts a rightward shift of money supply, but this event does not change the quantity of money the central bank provides.", (-1, 0): "Predicts a leftward shift of money supply, but this event does not change the quantity of money the central bank provides.",
             (0, 1): "Predicts a rightward shift of money demand, but this event does not change people's demand for money at each interest rate.", (0, -1): "Predicts a leftward shift of money demand, but this event does not change people's demand for money at each interest rate."}
    wl = [(stmt[c], wrong[c]) for c in cause if c != (ms, md)]
    wl.append(("The money market does not shift, and the nominal interest rate stays the same.", "Ignores that this event shifts a curve in the money market."))
    k, ds = sent_opts(key, mech + f" The nominal interest rate {'rises' if di == 1 else 'falls'}.", wl)
    stem = f"In the money market, consider the following event: {ev} Which of the following describes the effect in the money market model?"
    return mk("ma_money_market_shift", "4.5", "3.A", stem, k, ds, rng, concept="money supply and money demand determinants and the equilibrium nominal interest rate", path="direction rule table vs numeric simulation of a vertical-supply money market", facts=[f"ev={ev[:30]}", f"ms={ms}", f"md={md}", f"di={di}"], est=60)


# ======================= 4.6 통화정책 =======================
def ma_monetary_policy_gap(rng):
    rec = rng.choice([True, False])
    txt = "a recessionary gap" if rec else "an inflationary gap"
    stem = f"An economy has {txt}. Which of the following monetary policy actions by the central bank would be most appropriate to move the economy toward full employment?"
    if rec:
        key = "Lower its administered interest rates, which lowers market interest rates."
        wr = [("Raise its administered interest rates, which raises market interest rates.", "Contractionary monetary policy would shift AD left and widen the recessionary gap."), ("Sell government bonds in the open market in an economy with limited reserves.", "An open-market sale shrinks the money supply, raises interest rates, and widens the gap."), ("Raise the required reserve ratio in an economy with limited reserves.", "A higher reserve requirement reduces the money supply and raises interest rates."),
              ("Do nothing, because monetary policy cannot affect real GDP in the short run.", "Monetary policy affects interest rates and spending, so it can change real GDP in the short run.")]
        kw = "Expansionary monetary policy lowers interest rates, raises investment and consumption, and shifts AD right."
    else:
        key = "Raise its administered interest rates, which raises market interest rates."
        wr = [("Lower its administered interest rates, which lowers market interest rates.", "Expansionary policy would shift AD right and widen the inflationary gap."), ("Buy government bonds in the open market in an economy with limited reserves.", "An open-market purchase expands the money supply, lowers interest rates, and widens the gap."), ("Lower the required reserve ratio in an economy with limited reserves.", "A lower reserve requirement expands the money supply and lowers interest rates."),
              ("Do nothing, because monetary policy cannot affect the price level in the short run.", "Monetary policy affects AD, so it can change both real GDP and the price level in the short run.")]
        kw = "Contractionary monetary policy raises interest rates, reduces interest-sensitive spending, and shifts AD left."
    k, ds = sent_opts(key, kw, wr)
    return mk("ma_monetary_policy_gap", "4.6", "2.A", stem, k, ds, rng, concept="choose expansionary or contractionary monetary policy for a gap", path="fixed vetted policy table keyed to the gap sign", facts=[f"rec={rec}"], est=60)


def ma_omo_effects(rng):
    buy = rng.choice([True, False]); s = 1 if buy else -1
    i = mm_dirs(s, 0)  # 금리 방향
    inv = -i  # 이자율에 민감한 지출
    d = adas_dirs(inv, 0)
    B = -i  # 채권 가격은 금리와 반대
    truth = {"i": i, "I": inv, "Y": d["Y"], "P": d["P"], "B": B, "U": d["U"]}
    vs = rng.choice([("i", "Y"), ("I", "P"), ("i", "I"), ("Y", "U"), ("B", "Y")])
    mm = {"i": f"The money supply curve shifts {'right' if buy else 'left'} in an economy with limited reserves, so the nominal interest rate {'falls' if i == -1 else 'rises'}.", "I": f"A {'lower' if i == -1 else 'higher'} interest rate {'raises' if inv == 1 else 'lowers'} interest-sensitive investment and consumption.",
          "Y": f"Interest-sensitive spending {'rises' if inv == 1 else 'falls'}, shifting AD {'right' if inv == 1 else 'left'}, so real GDP {'rises' if d['Y'] == 1 else 'falls'}.", "P": f"AD shifts {'right' if inv == 1 else 'left'} along SRAS, so the price level {'rises' if d['P'] == 1 else 'falls'}.",
          "B": f"Bond prices move opposite to interest rates, so the price of previously issued bonds {'rises' if B == 1 else 'falls'}.", "U": f"Cyclical unemployment moves opposite to real GDP, so it {'rises' if d['U'] == 1 else 'falls'}."}
    key, ds = combo_item(rng, list(vs), truth, mm, dirs=(1, -1, 0))
    stem = f"In an economy with limited reserves, the central bank {'buys' if buy else 'sells'} government bonds in the open market. What is the most likely short-run effect?"
    return mk("ma_omo_effects", "4.6", "3.A", stem, key, ds, rng, concept="open-market operations: money supply, interest rate, investment, AD, real GDP, and price level", path="chain of rule-table directions (money market, AD-AS) vs numeric simulations of each linear model", facts=[f"buy={buy}", f"vs={vs}", f"truth={truth}"], est=70)


AMPLE = [
    ("In an economy with ample reserves, such as the United States, which of the following is the central bank's key tool for influencing market interest rates?", "Changing the interest rate it pays on reserves and other administered interest rates.", "With ample reserves, administered rates anchor short-term market rates.",
     [("Changing the required reserve ratio to alter the money multiplier.", "The money multiplier and reserve requirement are the main tools only in an economy with limited reserves."), ("Selling large amounts of government bonds each day to change the money supply.", "With ample reserves, changes in the money supply do not effectively change the interest rate."), ("Changing the level of government spending.", "Government spending is fiscal policy, not a tool of the central bank."),
      ("Setting prices for goods and services directly.", "A central bank does not set prices directly.")]),
    ("A central bank in an economy with ample reserves raises the interest rate it pays on reserves. What is the most likely effect on short-term market interest rates?", "They rise, because banks will not lend reserves at rates below what the central bank pays.", "The administered rate sets a floor for the rates banks charge.",
     [("They fall, because banks hold more reserves.", "Higher administered rates raise, not lower, market rates."), ("They do not change, because only the money supply can change interest rates.", "With ample reserves it is administered rates, not the money supply, that influence interest rates."), ("They become negative.", "A higher administered rate pushes market rates up."), ("Only long-term interest rates change, and short-term rates are fixed by law.", "Short-term rates respond most directly to the administered rate.")]),
]


def ma_ample_reserves(rng):
    q, kt, kw, wr = _v(rng, AMPLE)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_ample_reserves", "4.6", "1.A", q, k, ds, rng, concept="monetary policy tools with ample reserves", path="fixed vetted statements following the CED description of ample-reserves policy", facts=[f"variant={q[:30]}"], est=60)


def ma_policy_transmission(rng):
    exp = rng.choice([True, False])
    stem = f"Which of the following correctly lists the sequence of effects of {'expansionary' if exp else 'contractionary'} monetary policy on the economy in the short run?"
    d = lambda w: w if exp else {"decrease": "increase", "increase": "decrease", "rise": "fall", "fall": "rise", "lower": "higher", "higher": "lower", "right": "left", "left": "right"}[w]  # noqa: E731
    key = f"The nominal interest rate {d('fall')}s, investment and consumption {d('rise')}, aggregate demand shifts {d('right')}, and real GDP {d('rise')}."
    key = f"The interest rate {'falls' if exp else 'rises'}, interest-sensitive spending {'rises' if exp else 'falls'}, aggregate demand shifts {'right' if exp else 'left'}, and real GDP {'rises' if exp else 'falls'}."
    wr = [(f"The interest rate {'rises' if exp else 'falls'}, interest-sensitive spending {'rises' if exp else 'falls'}, aggregate demand shifts {'right' if exp else 'left'}, and real GDP {'rises' if exp else 'falls'}.", "The interest-rate step is reversed, so the sequence does not follow from the policy."),
          (f"Aggregate demand shifts {'right' if exp else 'left'}, the interest rate {'falls' if exp else 'rises'}, interest-sensitive spending {'rises' if exp else 'falls'}, and real GDP {'rises' if exp else 'falls'}.", "Puts the AD shift before the interest-rate change; the policy works through interest rates first."),
          (f"The interest rate {'falls' if exp else 'rises'}, interest-sensitive spending {'falls' if exp else 'rises'}, aggregate demand shifts {'right' if exp else 'left'}, and real GDP {'rises' if exp else 'falls'}.", "The spending step is reversed; lower rates raise and higher rates lower interest-sensitive spending."),
          (f"The interest rate {'falls' if exp else 'rises'}, interest-sensitive spending {'rises' if exp else 'falls'}, short-run aggregate supply shifts {'right' if exp else 'left'}, and real GDP {'rises' if exp else 'falls'}.", "Monetary policy works through aggregate demand in the short run, not short-run aggregate supply."),
          (f"The interest rate {'falls' if exp else 'rises'}, interest-sensitive spending {'rises' if exp else 'falls'}, aggregate demand shifts {'left' if exp else 'right'}, and real GDP {'rises' if exp else 'falls'}.", "The AD shift is in the wrong direction for the stated change in spending.")]
    k, ds = sent_opts(key, "Monetary policy changes interest rates, which change interest-sensitive spending, which shifts aggregate demand and changes real GDP.", wr)
    return mk("ma_policy_transmission", "4.6", "2.B", stem, k, ds, rng, concept="transmission of monetary policy: rates, spending, AD, output", path="fixed vetted chain; the direction of each link checked with the money-market and AD-AS rule tables", facts=[f"exp={exp}"], est=60)


# ======================= 4.7 대부자금시장 =======================
def ma_lf_events(rng):
    ev, sup, dem, mech = _v(rng, LF_EVENTS)
    d = lf_dirs(sup, dem)
    r = d["r"]; q = d["Q"]
    vs = rng.choice([("r", "Q"), ("r", "I")]) if False else ("r", "Q")
    mm = {"r": f"{mech} The real interest rate {'rises' if r == 1 else 'falls'}.", "Q": f"{mech} The quantity of loanable funds exchanged {'rises' if q == 1 else 'falls'}."}
    key, ds = combo_item(rng, list(vs), {"r": r, "Q": q}, mm, dirs=(1, -1, 0))
    stem = f"In the market for loanable funds, consider the following event: {ev} What is the most likely effect on the equilibrium real interest rate and the quantity of loanable funds?"
    return mk("ma_lf_events", "4.7", "3.A", stem, key, ds, rng, concept="shifts in the supply of and demand for loanable funds", path="direction rule table vs numeric simulation of a linear loanable funds market", facts=[f"ev={ev[:30]}", f"sup={sup}", f"dem={dem}", f"d={d}"], est=65)


def ma_lf_graph(rng):
    m = new_mkt(rng, 30, 60, 20, 50)
    ev, sup, dem, mech = _v(rng, LF_EVENTS)
    s_ = 20 * (sup if sup else dem)
    dA = s_ if dem else 0; dC = -s_ if sup else 0
    q1, p1 = mkt_check(m, dA=dA, dC=dC)
    d = lf_dirs(sup, dem)
    q0, p0 = mkt_check(m)
    if (_sg(float(p1 - p0)), _sg(float(q1 - q0))) != (d["r"], d["Q"]):
        raise ValueError("graph_rule")
    dl = line_pts(m.A, -m.B, 0, m.A / m.B); sl = line_pts(m.C, m.D, 0, 100)
    cur = [("D1", dl), ("S1", sl)] + ([("D2", line_pts(m.A + dA, -m.B, 0, (m.A + dA) / m.B))] if dem else [("S2", line_pts(m.C + dC, m.D, 0, 100))])
    yhi = int(max(m.A, m.A + dA)) + 10
    stim = econ_graph("Loanable funds market: the equilibrium moves from E1 to E2 after one curve shifts.", cur, 100, yhi, 10, 20, points=[("E1", m.Q0, m.P0), ("E2", float(q1), float(p1))], xlabel="Quantity of loanable funds (billions of dollars)", ylabel="Real interest rate (percent)")
    which = "demand" if dem else "supply"
    sgn = (dem or sup)
    cause = {("supply", 1): ("Households increase their saving at every real interest rate.", "S+"), ("supply", -1): ("Households decrease their saving at every real interest rate.", "S-"), ("demand", 1): ("Firms become more optimistic about the profitability of new capital.", "D+"), ("demand", -1): ("Firms become pessimistic about the profitability of new capital.", "D-")}
    kt, tag = cause[(which, sgn)]
    wl = []
    for c, (t, tg) in cause.items():
        if c == (which, sgn):
            continue
        wl.append((t, f"Would shift the {c[0]} of loanable funds to the {'right' if c[1] == 1 else 'left'}, but the graph shows the {which} curve shifting to the {'right' if sgn == 1 else 'left'}." if c[0] == which else f"Would shift the {c[0]} of loanable funds to the {'right' if c[1] == 1 else 'left'}, but the graph shows the {which} curve shifting, not the {c[0]} curve."))
    wl.append(("An increase in the real interest rate.", "A change in the interest rate moves along the curves; it does not shift either curve."))
    k, ds = sent_opts(kt, f"The graph shows the {which} of loanable funds shifting to the {'right' if sgn == 1 else 'left'}, which matches this event.", wl)
    stem = "The graph shows the market for loanable funds. The equilibrium moves from E1 to E2. Which of the following events is most likely to have caused the change?"
    return mk("ma_lf_graph", "4.7", "3.A", stem, k, ds, rng, concept="identify the loanable-funds shifter from the graph", path="equilibrium recomputed exactly and by sympy; shift direction matches the rule table", stim=stim, facts=[f"which={which}", f"sgn={sgn}", f"r0={m.P0}", f"Q0={m.Q0}", f"d={d}"], est=75)


def ma_lf_investment(rng):
    up = rng.choice([True, False])
    ev = "Households increase their saving at every real interest rate." if up else "Households decrease their saving at every real interest rate."
    d = lf_dirs(1 if up else -1, 0)
    vs = rng.choice([("r", "Q")])
    inv = d["Q"]  # 저축 증가 → 대부자금 거래량 증가 → 투자 증가
    mm = {"r": f"The supply of loanable funds shifts {'right' if up else 'left'}, so the real interest rate {'falls' if d['r'] == -1 else 'rises'}.", "I": f"With a {'lower' if d['r'] == -1 else 'higher'} real interest rate, firms {'borrow and invest more' if inv == 1 else 'borrow and invest less'}, so investment {'rises' if inv == 1 else 'falls'}."}
    key, ds = combo_item(rng, ["r", "I"], {"r": d["r"], "I": inv}, mm, dirs=(1, -1, 0))
    stem = f"In the market for loanable funds: {ev} What is the most likely effect on the real interest rate and on investment spending?"
    return mk("ma_lf_investment", "4.7", "3.B", stem, key, ds, rng, concept="a change in saving moves the real interest rate and investment in opposite directions", path="direction rule table vs numeric simulation of a linear loanable funds market", facts=[f"up={up}", f"d={d}"], est=65)


MVLF = [
    ("Which of the following correctly distinguishes the money market from the market for loanable funds?", "The money market determines the nominal interest rate from money demand and supply, while the loanable funds market determines the real interest rate from saving and borrowing.", "The two models have different axes, interest rates, and participants.",
     [("The money market determines the real interest rate, and the loanable funds market determines the nominal interest rate.", "Reverses the interest rates determined in the two markets."), ("In both markets the supply curve is vertical because it is set by the central bank.", "Only the money supply is vertical in the money model; loanable funds supply slopes upward."), ("The loanable funds market is determined only by the central bank's open-market operations.", "Loanable funds depend on saving and borrowing decisions, not only on central bank actions."),
      ("The two markets are the same market with different names, and both determine the nominal interest rate.", "They differ in what is traded and what rate adjusts.")]),
]


def ma_money_vs_lf(rng):
    q, kt, kw, wr = MVLF[0]
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_money_vs_lf", "4.7", "1.D", q, k, ds, rng, concept="money market versus loanable funds market", path="fixed vetted statements", facts=["variant=money_vs_lf"], est=60)
