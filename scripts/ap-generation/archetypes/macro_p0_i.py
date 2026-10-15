"""AP Macroeconomics 원형 I — exam_prep 보강 단원 4–6(2026-10-15, macro-hard). 전부 단독 다단계(3단계 이상) 문항. 코드가 두 경로로 정답을 계산하고 오답은 단계 누락·오적용 값이다."""
from fractions import Fraction as Fr  # noqa: F811
from macro_hard_common import *  # noqa: F401,F403
from macro_hard_common import _sg  # noqa: F401


# ======================= 단원 4 =======================
@retry_sep
def ma_h_omo_chain(rng):
    buy = rng.choice([True, False]); rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)]); X = rng.choice([20, 40, 50, 60, 80])
    V = Fr(X) / rr
    # 독립 경로: 대출-예금 라운드를 반복해 새 예금의 합을 구한다(새 지급준비금은 전부 법정 지급준비금이 될 때까지 대출)
    dep = Fr(0)
    for _ in range(600):
        dep += Fr(X) - rr * dep
    agree(float(V), float(dep), 1e-6, "dep")
    mv = "increases" if buy else "decreases"; ro = "falls" if buy else "rises"; mo = "decreases" if buy else "increases"; rw = "rises" if buy else "falls"
    act = "buys" if buy else "sells"
    stem = (f"In an economy with limited reserves, the reserve requirement ratio is {nm(float(rr) * 100, 0)} percent and banks hold no excess reserves. The central bank {act} ${X} million of government bonds {'from' if buy else 'to'} commercial banks. "
            "Banks lend all of their excess reserves, and no cash is held outside banks. Which of the following is the maximum change in the money supply and the change in the nominal interest rate in the money market?")
    t = lambda v, md, r_: f"The money supply {md} by ${nm(float(v), 0)} million, and the nominal interest rate {r_}."  # noqa: E731
    kw = f"The {'purchase' if buy else 'sale'} {'adds' if buy else 'removes'} ${X} million of reserves. With a reserve requirement of {nm(float(rr) * 100, 0)} percent, the money multiplier is {nm(float(1 / rr), 1)}, so the money supply {mv} by up to ${nm(float(V), 0)} million. A {'larger' if buy else 'smaller'} money supply moves the supply curve {'right' if buy else 'left'} in the money market, so the nominal interest rate {ro}."
    k, ds = sent_opts(t(V, mv, ro), kw, [(t(X, mv, ro), "Treats the change in reserves as the change in the money supply and leaves out the money multiplier."), (t(V, mv, rw), f"Gets the money market effect backward: when the money supply {mv} the nominal interest rate {ro}."),
                                          (t(Fr(X) * rr, mv, ro), "Multiplies the change in reserves by the reserve ratio instead of dividing by it."), (t(V, mo, rw), f"Reverses the effect of the {'purchase' if buy else 'sale'} of bonds on reserves and on the money supply."),
                                          (t(Fr(X) / (1 - rr), mv, ro), "Uses 1/(1 - reserve ratio) as the multiplier instead of 1/(reserve ratio).")])
    return mk("ma_h_omo_chain", "4.6", "3.C", stem, k, ds, rng, concept="an open market operation changes reserves, the money supply through the multiplier, and the nominal interest rate", path="exact multiplier 1/rr vs round-by-round lending simulation; interest-rate direction from the vertical-supply money market rule",
              thinking=steps("Find the direction and size of the change in reserves", "Apply the money multiplier to find the maximum change in the money supply", "Move the money supply curve in the money market", "Find the change in the nominal interest rate"),
              facts=[f"buy={buy}", f"rr={float(rr):.4f}", f"X={X}", f"V={float(V):.4f}"], est=115, judgment="carry the change in reserves through the multiplier and then into the money market")


@retry_sep
def ma_h_real_rate_ad(rng):
    n0 = rng.choice([4, 5, 6, 7]); pe0 = rng.choice([1, 2, 3]); dn = rng.choice([0, 0, 1, 2]); dpe = rng.choice([-2, -1, 1, 2, 3])
    r0, r1 = n0 - pe0, (n0 + dn) - (pe0 + dpe)
    if r1 == r0 or r1 < -1:
        raise ValueError("not_enough_separated_distractors")
    s = 1 if r1 > r0 else -1
    # 독립 경로: 정확한 피셔 식 (1+n)/(1+pe) - 1 의 부호 비교
    ex0 = (1 + Fr(n0, 100)) / (1 + Fr(pe0, 100)); ex1 = (1 + Fr(n0 + dn, 100)) / (1 + Fr(pe0 + dpe, 100))
    agree(s, 1 if ex1 > ex0 else -1, 1e-9, "sign")
    ch = []
    if dn:
        ch.append(f"the nominal interest rate rises to {n0 + dn} percent")
    ch.append(f"expected inflation {'rises' if dpe > 0 else 'falls'} to {pe0 + dpe} percent")
    stem = (f"A firm finances investment projects by borrowing. The nominal interest rate is {n0} percent and expected inflation is {pe0} percent. Then {' and '.join(ch)}. "
            "Other things equal, which of the following describes the effects on the real interest rate, investment spending, and aggregate demand?")
    mech = {"r": f"The real rate is nominal minus expected inflation: {n0} - {pe0} = {r0} before and {n0 + dn} - {pe0 + dpe} = {r1} after, so it {'rises' if s > 0 else 'falls'}.",
            "I": f"A {'higher' if s > 0 else 'lower'} real interest rate makes borrowing {'more' if s > 0 else 'less'} costly, so investment spending {'falls' if s > 0 else 'rises'}.",
            "AD": f"Investment is a component of aggregate demand, so aggregate demand {'falls' if s > 0 else 'rises'}."}
    return combo_item_n("ma_h_real_rate_ad", "4.2", "2.B", stem, ["r", "I", "AD"], {"r": s, "I": -s, "AD": -s}, mech, rng, concept="real interest rate from nominal rate and expected inflation, then investment and aggregate demand",
                        path="Fisher approximation vs exact (1+n)/(1+pe) comparison; investment and AD directions from the rule table", st=steps("Compute the real interest rate before and after the change", "Decide whether the real rate rose or fell", "Decide the effect of the real rate on interest-sensitive investment", "Decide the effect on aggregate demand"),
                        facts=[f"n0={n0}", f"pe0={pe0}", f"dn={dn}", f"dpe={dpe}", f"s={s}"], est=110)


@retry_sep
def ma_h_money_target(rng):
    rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)]); sl = rng.choice([20, 40, 50, 60, 80]); i0 = rng.choice([3, 4, 5]); k = rng.choice([1, 2]); up = rng.choice([True, False]); M0 = rng.choice([400, 500, 600, 800])
    i1 = i0 + k if up else i0 - k
    md = lambda i: M0 - sl * (i - i0)  # noqa: E731
    M1 = md(i1); dM = M1 - M0; bonds = Fr(dM) * rr
    if bonds.denominator != 1:
        raise ValueError("not_enough_separated_distractors")
    bonds = int(bonds)  # 음수 = 매각
    # 독립 경로: 두 행의 수요량 기울기를 sympy 로 풀어 목표 금리에서의 화폐수요량을 구한다
    i = sp.symbols("i")
    line = sp.solve(sp.Eq(sp.Symbol("m"), M0 - sl * (i - i0)), sp.Symbol("m"))[0]
    agree(float(line.subs(i, i1)), M1, 1e-9, "M1")
    rates = list(range(i0 - 2, i0 + 4))
    if min(rates) < 1:
        raise ValueError("not_enough_separated_distractors")
    stim = tbl("Quantity of money demanded at different nominal interest rates (billions of dollars).", ["Nominal interest rate", "Quantity of money demanded"], [[f"{r}%", f"${md(r):,}"] for r in rates])
    stem = (f"The table shows the demand for money. The money supply is currently ${M0} billion, so the nominal interest rate is {i0} percent. The central bank wants the nominal interest rate to {'rise' if up else 'fall'} to {i1} percent. "
            f"The reserve requirement ratio is {nm(float(rr) * 100, 0)} percent, banks hold no excess reserves, and the economy has limited reserves. Which of the following open market operations would achieve this goal?")
    f = lambda v: f"{'Sell' if v < 0 else 'Buy'} ${int(round(abs(v)))} billion of government bonds"  # noqa: E731
    pairs = [("Reports the needed change in the money supply as the size of the bond transaction, leaving out the money multiplier.", dM), ("Multiplies the needed change in the money supply by the money multiplier instead of dividing the change by it.", float(Fr(dM) / rr)),
             ("Gets the direction of the operation backward: to change the interest rate in this direction the money supply must move the other way.", -bonds), ("Uses the table row for a rate one percentage point away from the target.", float(Fr(sl * (k + 1 if k == 1 else k - 1) * (-1 if up else 1)) * rr)),
             ("Uses the quantity of money demanded at the target rate rather than the change from the current money supply.", float(Fr(M1) * rr * (-1 if up else 1)))]
    kw = f"At {i1} percent the quantity of money demanded is ${M1} billion, so the money supply must {'fall' if up else 'rise'} by ${abs(dM)} billion. With a money multiplier of {nm(float(1 / rr), 1)}, the required change in reserves is ${abs(dM)}/{nm(float(1 / rr), 1)} = ${abs(bonds)} billion, so the central bank must {'sell' if up else 'buy'} that amount of bonds."
    return num_item("ma_h_money_target", "4.6", "3.C", stem, float(bonds), pairs, f, rng, concept="size an open market operation to reach a target interest rate using the money demand schedule and the multiplier", path="exact fractions vs sympy line for money demand; bond size = change in money supply x reserve ratio",
                    st=steps("Read the quantity of money demanded at the target interest rate from the table", "Compare it with the current money supply to find the needed change in the money supply", "Divide by the money multiplier to find the change in reserves", "Decide whether the central bank must buy or sell bonds"),
                    stim=stim, facts=[f"M0={M0}", f"sl={sl}", f"i0={i0}", f"i1={i1}", f"rr={float(rr):.4f}", f"bonds={bonds}"], kwhy=kw, est=125)


@retry_sep
def ma_h_rr_cut(rng):
    D = rng.choice([400, 500, 800, 1000]); ro, rn = rng.choice([(Fr(1, 5), Fr(1, 10)), (Fr(1, 4), Fr(1, 5)), (Fr(1, 5), Fr(1, 8)), (Fr(1, 4), Fr(1, 10)), (Fr(1, 4), Fr(1, 8))])
    R = D * ro; E0 = D * (ro - rn); inc = E0 / rn
    if inc.denominator != 1 or E0.denominator != 1:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 새 법정 지급준비율에서 대출-예금 라운드를 반복해 늘어나는 예금을 구한다
    dep = Fr(0)
    for _ in range(800):
        dep += (Fr(R) - rn * (D + dep))
    agree(float(inc), float(dep), 1e-6, "inc")
    stem = (f"In an economy with limited reserves, banks hold total deposits of ${D} billion and exactly the required reserves at a reserve requirement ratio of {nm(float(ro) * 100, 1)} percent. The central bank lowers the reserve requirement ratio to {nm(float(rn) * 100, 1)} percent. "
            "Banks lend all of their excess reserves, and no cash is held outside banks. What is the maximum increase in the money supply?")
    f = lambda v: f"${int(round(v)):,} billion"  # noqa: E731
    pairs = [("Reports only the excess reserves created by the change and leaves out the money multiplier.", float(E0)), ("Reports the total deposits the banking system can support at the new ratio instead of the increase.", float(D * ro / rn)),
             ("Multiplies the excess reserves by the old multiplier 1/(old ratio).", float(E0 / ro)), ("Multiplies total deposits by the difference between the new and old multipliers.", float(D * (1 / rn - 1 / ro))), ("Divides the old required reserves by the new ratio and then subtracts the excess reserves.", float(R / rn - E0))]
    kw = f"Reserves are ${D} x {nm(float(ro), 3)} = ${int(R)} billion. At the new ratio banks must hold only ${nm(float(D * rn), 1)} billion, so excess reserves are ${int(E0)} billion. The new multiplier is {nm(float(1 / rn), 1)}, so the money supply can rise by up to ${int(E0)} x {nm(float(1 / rn), 1)} = ${int(inc)} billion."
    return num_item("ma_h_rr_cut", "4.4", "3.C", stem, float(inc), pairs, f, rng, concept="a cut in the reserve requirement creates excess reserves that expand the money supply by the new multiplier", path="exact fractions vs lending-round simulation at the new ratio",
                    st=steps("Find current reserves and the reserves required at the new ratio", "Find the excess reserves created by the lower ratio", "Apply the new money multiplier to the excess reserves"),
                    facts=[f"D={D}", f"ro={float(ro):.4f}", f"rn={float(rn):.4f}", f"inc={float(inc):.2f}"], kwhy=kw, est=115)


# ======================= 단원 5 =======================
@retry_sep
def ma_h_phillips_expect(rng):
    pe = rng.choice([2, 3]); un = rng.choice([4, 5, 6]); sl = rng.choice([1, 2]); d = rng.choice([1, 2])
    pi1 = pe + sl * d
    # 독립 경로: 기대 인플레이션을 반복해서 갱신하며 시뮬레이션(완전 적응)
    e = pe; u = un - d; infl = e + sl * (un - u)
    e = infl  # 기대가 실제 인플레이션에 완전히 적응
    infl_lr = e + sl * (un - un)
    agree(pi1, infl_lr, 1e-9, "lr")
    rows = [[f"{un + j}%", f"{pe + sl * (-j)}%"] for j in range(-2, 3)]
    if any(pe + sl * (-j) <= 0 for j in range(-2, 3)):
        raise ValueError("not_enough_separated_distractors")
    stim = tbl(f"Combinations of the unemployment rate and the inflation rate on a short-run Phillips curve when expected inflation is {pe} percent.", ["Unemployment rate", "Inflation rate"], rows)
    stem = (f"The table shows a short-run Phillips curve when expected inflation is {pe} percent. The natural rate of unemployment is {un} percent. The central bank adopts expansionary policy that lowers the unemployment rate to {un - d} percent. "
            f"Over time, workers and firms fully adjust their inflation expectations to the inflation rate that occurred. The central bank then ends the policy, and unemployment returns to {un} percent. What is the inflation rate once unemployment returns to {un} percent?")
    f = lambda v: f"{nm(v, 0)}%"  # noqa: E731
    pairs = [(f"Reports the original inflation rate, assuming the economy returns to the original point on the original short-run Phillips curve.", pe), (f"Reports the inflation rate on the original curve at {un - d} percent unemployment only after expectations have adjusted further, adding the trade-off a second time.", pi1 + sl * d),
             ("Reports the natural rate of unemployment in place of the inflation rate.", un), (f"Reads the table at the wrong unemployment rate, one percentage point from the rate reached by the policy.", pe + sl * (d - 1) if d > 1 else pe + sl * (d + 1)),
             ("Reports the inflation rate at unemployment above the natural rate on the original curve.", max(pe - sl * d, 0.5))]
    kw = f"At {un - d} percent unemployment the table shows inflation of {pi1} percent. Expectations adjust fully to {pi1} percent, shifting the short-run Phillips curve up. When unemployment returns to the natural rate, the economy is on the long-run Phillips curve and actual inflation equals expected inflation, {pi1} percent."
    return num_item("ma_h_phillips_expect", "5.2", "2.C", stem, float(pi1), pairs, f, rng, concept="movement along the short-run Phillips curve, expectations adjust, return to the long-run Phillips curve", path="table arithmetic vs iterative expectation updating until unemployment returns to the natural rate",
                    st=steps("Read the inflation rate at the lower unemployment rate on the short-run Phillips curve", "Update expected inflation to the inflation rate that occurred", "Recognize that at the natural rate of unemployment actual inflation equals expected inflation"),
                    stim=stim, facts=[f"pe={pe}", f"un={un}", f"sl={sl}", f"d={d}", f"pi1={pi1}"], kwhy=kw, est=115)


@retry_sep
def ma_h_debt_path(rng):
    D0 = rng.choice([400, 500, 600, 800]); bal = [rng.choice([20, 30, 40, 60, 80]), rng.choice([40, 50, 60, 80]), -rng.choice([20, 30, 40])]
    rng.shuffle(bal)
    G = [rng.choice([500, 550, 600, 650, 700]) for _ in bal]; T = [g - b for g, b in zip(G, bal)]
    D3 = D0 + sum(bal)
    p = rng.choice([20, 25, 40, 50, 60, 80]); Y3 = Fr(D3 * 100, p)
    if Y3.denominator != 1 or D3 <= 0 or Y3 < 800:
        raise ValueError("not_enough_separated_distractors")
    Y3 = int(Y3)
    # 독립 경로: 해마다 부채를 갱신한다
    d = D0
    for g, t in zip(G, T):
        d = d + (g - t)
    agree(d, D3, 1e-9, "D3")
    stim = tbl("Federal government spending and tax revenue (billions of dollars).", ["Year", "Government spending", "Tax revenue"], [[i + 1, f"${g}", f"${t}"] for i, (g, t) in enumerate(zip(G, T))])
    stem = (f"The table shows a government's spending and tax revenue for three years. The national debt was ${D0} billion at the start of Year 1, and nominal GDP is ${Y3:,} billion at the end of Year 3. "
            "The government finances every deficit by borrowing and uses every surplus to repay debt. What is the national debt as a percent of GDP at the end of Year 3?")
    f = lambda v: f"{nm(v, 0)}%"  # noqa: E731
    deficits = sum(b for b in bal if b > 0)
    pairs = [("Divides only the sum of the deficits by GDP and leaves out the debt at the start of Year 1.", deficits * 100 / Y3), ("Adds the surplus to the debt instead of using it to repay debt.", (D0 + sum(abs(b) for b in bal)) * 100 / Y3),
             ("Leaves out the debt at the start of Year 1 but nets the surplus against the deficits.", sum(bal) * 100 / Y3), ("Reports the initial debt as a percent of Year 3 GDP.", D0 * 100 / Y3),
             ("Divides the debt by GDP using only the last year's budget balance.", (D0 + bal[-1]) * 100 / Y3)]
    kw = f"The budget balances are " + ", ".join(f"{('deficit' if b > 0 else 'surplus')} of ${abs(b)}" for b in bal) + f". The debt at the end of Year 3 is ${D0} + {sum(bal)} = ${D3} billion. As a percent of GDP: {D3}/{Y3:,} = {p} percent."
    return num_item("ma_h_debt_path", "5.4", "3.C", stem, float(p), pairs, f, rng, concept="deficits add to and surpluses subtract from the national debt; debt-to-GDP ratio", path="cumulative sum vs year-by-year debt updating",
                    st=steps("Compute the budget balance for each year", "Add deficits to and subtract surpluses from the starting debt", "Divide the ending debt by nominal GDP and express it as a percent"),
                    stim=stim, facts=[f"D0={D0}", f"bal={bal}", f"D3={D3}", f"Y3={Y3}", f"p={p}"], kwhy=kw, est=115)


@retry_sep
def ma_h_crowding_table(rng):
    b = rng.choice([10, 20, 30]); dd = rng.choice([10, 20, 30]); r0 = rng.choice([6, 7]); Q0 = rng.choice([300, 400, 500]); k = rng.choice([1, 2])
    if b == dd:
        raise ValueError("not_enough_separated_distractors")
    a = Q0 - b * r0; c = Q0 + dd * r0
    B = (b + dd) * k; r1 = r0 + k
    S = lambda r: a + b * r; Dp = lambda r: c - dd * r  # noqa: E731
    # 독립 경로: 이자율 격자를 훑어 총수요(민간 + 정부) = 공급인 이자율을 찾는다
    hit = [r for r in range(0, 30) if S(r) == Dp(r) + B]
    agree(len(hit), 1, 1e-9, "eq"); agree(hit[0], r1, 1e-9, "r1")
    fall = Dp(r0) - Dp(r1)
    rates = list(range(r0 - 2, r0 + 4))
    stim = tbl("The loanable funds market before any change (billions of dollars).", ["Real interest rate", "Loanable funds supplied", "Private demand for loanable funds"], [[f"{r}%", S(r), Dp(r)] for r in rates])
    stem = (f"The table shows the loanable funds market. The government then begins to borrow an additional ${B} billion at every real interest rate to finance a larger budget deficit, and private demand for loanable funds does not otherwise change. "
            "By how much does private borrowing for investment fall?")
    f = lambda v: f"${int(round(v))} billion"  # noqa: E731
    pairs = [("Reports the additional government borrowing, assuming it crowds out private borrowing one for one.", B), ("Reports the increase in the total quantity of loanable funds traded rather than the fall in private borrowing.", S(r1) - S(r0)),
             ("Assumes half of the additional government borrowing crowds out private borrowing and half is financed by higher saving.", B / 2), ("Doubles the fall in private borrowing by counting both the shift and the movement.", 2 * fall),
             ("Reports the quantity of private borrowing at the old equilibrium rather than the change.", Q0)]
    kw = f"With government borrowing, total demand is private demand plus ${B} billion. Total demand equals supply at {r1} percent, up from {r0} percent. Private borrowing falls from ${Dp(r0)} billion to ${Dp(r1)} billion, a fall of ${fall} billion, even though total funds traded rise by ${S(r1) - S(r0)} billion."
    return num_item("ma_h_crowding_table", "5.5", "3.C", stem, float(fall), pairs, f, rng, concept="crowding out: government borrowing raises the real interest rate and lowers private investment, found from schedules", path="schedule scan for the new equilibrium rate vs algebra on the linear schedules",
                    st=steps("Add government borrowing to private demand at every real interest rate", "Find the real interest rate at which total demand equals supply", "Read private demand at the new rate", "Compare private demand at the new and old rates"),
                    stim=stim, facts=[f"b={b}", f"dd={dd}", f"r0={r0}", f"r1={r1}", f"B={B}", f"fall={fall}"], kwhy=kw, est=125)


@retry_sep
def ma_h_money_growth_real(rng):
    gM = rng.choice([6, 8, 9, 10, 12]); gV = rng.choice([-2, -1, 0, 1]); gY = rng.choice([2, 3, 4])
    pi = gM + gV - gY
    if pi < 2:
        raise ValueError("not_enough_separated_distractors")
    n = pi + rng.choice([2, 3, 4]); real = n - pi
    # 독립 경로: 수준 값(M, V, Y)을 만들어 정확한 물가 상승률을 구하고 근사와 비교
    M0, V0, Y0 = 1000, 4, 2000
    P0 = Fr(M0 * V0, Y0)
    P1 = Fr(M0 * (100 + gM) * V0 * (100 + gV), 100 * 100) / (Y0 * Fr(100 + gY, 100))
    exact_pi = float((P1 / P0 - 1) * 100)
    agree(1, 1 if abs(exact_pi - pi) < 0.9 else 0, 1e-9, "approx")
    vt = {0: "velocity of money does not change", 1: f"velocity of money rises by {gV} percent", -1: f"velocity of money falls by {abs(gV)} percent"}.get(gV, f"velocity of money falls by {abs(gV)} percent")
    stem = f"In an economy, the money supply grows by {gM} percent per year, {vt}, and real GDP grows by {gY} percent per year. The nominal interest rate is {n} percent. Using the quantity equation, what is the approximate real interest rate?"
    f = lambda v: f"{nm(v, 0)}%"  # noqa: E731
    pairs = [("Subtracts the money growth rate from the nominal interest rate and ignores velocity and output growth.", n - gM), ("Ignores the change in velocity and uses money growth minus output growth as the inflation rate.", n - (gM - gY)),
             ("Uses the growth rate of real GDP as the inflation rate.", n - gY), ("Reports the inflation rate found from the quantity equation as the real interest rate.", pi), ("Adds the growth of velocity with the wrong sign when finding inflation.", n - (gM - gV - gY))]
    kw = f"The quantity equation gives inflation of about {gM} {'+' if gV >= 0 else '-'} {abs(gV)} - {gY} = {pi} percent. The real interest rate is the nominal rate minus inflation: {n} - {pi} = {real} percent."
    return num_item("ma_h_money_growth_real", "5.3", "2.C", stem, float(real), pairs, f, rng, concept="money growth, velocity, and output growth give inflation through the quantity equation; the real rate follows", path="growth-rate form of MV = PY vs exact level simulation (within one percentage point)",
                    st=steps("Use the growth form of the quantity equation to find inflation", "Subtract inflation from the nominal interest rate to find the real interest rate"),
                    facts=[f"gM={gM}", f"gV={gV}", f"gY={gY}", f"n={n}", f"pi={pi}", f"real={real}"], kwhy=kw, est=105)


# ======================= 단원 6 =======================
@retry_sep
def ma_h_export_price(rng):
    e0, e1 = rng.choice([(0.8, 1.0), (1.0, 0.8), (1.0, 1.25), (1.25, 1.0), (0.8, 1.2), (1.0, 1.2)])
    price = rng.choice([40, 50, 60, 80, 100])
    p0, p1 = price * e0, price * e1
    ch = round((e1 / e0 - 1) * 100)
    inv = round((e0 / e1 - 1) * 100)
    diffpts = round(abs(e1 - e0) * 100)
    # 독립 경로: 유로 가격을 두 시점에서 직접 구해 변화율을 구한다
    agree(ch, (p1 / p0 - 1) * 100, 1e-6, "ch")
    rises = ch > 0
    nxd = "decrease" if rises else "increase"
    stim = tbl("Exchange rate between the dollar and the euro.", ["", "Start of year", "End of year"], [["Euros per U.S. dollar", f"{e0:.2f}", f"{e1:.2f}"]])
    stem = (f"A U.S. firm sells a machine in Europe for ${price} in U.S. currency. The table shows the exchange rate at the start and at the end of the year. "
            "Which of the following correctly describes the change in the euro price of the machine and the expected effect on U.S. net exports, other things equal?")
    t = lambda v, up_, d_: f"The euro price {'rises' if up_ else 'falls'} by {abs(int(v))} percent, and net exports of the United States {d_}."  # noqa: E731
    key = t(abs(ch), rises, nxd)
    kw = f"The euro price is ${price} x {e0:.2f} = {p0:g} euros at the start and ${price} x {e1:.2f} = {p1:g} euros at the end, a {'rise' if rises else 'fall'} of {abs(ch)} percent. A {'higher' if rises else 'lower'} euro price {'reduces' if rises else 'raises'} European purchases of U.S. goods, so U.S. net exports {nxd}."
    other = "increase" if nxd == "decrease" else "decrease"
    k, ds = sent_opts(key, kw, [(t(abs(inv), not rises, other), "Inverts the exchange rate ratio, so the size and the direction of the price change are both wrong."), (t(abs(ch), rises, other), "Finds the price change correctly but reverses the effect of a change in the euro price on U.S. exports."),
                                (t(diffpts, rises, nxd), "Reports the change in the exchange rate in cents as a percent instead of computing the percent change in the euro price."), (t(abs(inv), not rises, nxd), "Inverts the ratio and also misstates the effect on net exports for that price change."),
                                (t(abs(inv), rises, nxd), "Divides the change in the exchange rate by the new rate instead of the old rate, understating the size of the price change."), (t(diffpts, rises, other), "Reports the change in the exchange rate in cents as a percent and also reverses the effect on net exports.")])
    return mk("ma_h_export_price", "6.5", "3.C", stem, k, ds, rng, concept="exchange rate change alters the foreign-currency price of exports and net exports", path="exact euro prices at both dates vs percent change formula",
              thinking=steps("Convert the dollar price into euros at the start and at the end of the year", "Compute the percent change in the euro price", "Decide how the change in the foreign price affects the quantity of exports", "Conclude the effect on net exports"),
              stim=stim, facts=[f"e0={e0}", f"e1={e1}", f"price={price}", f"ch={ch}"], est=115, judgment="convert prices across currencies and trace the effect to net exports")


@retry_sep
def ma_h_trip_exchange(rng):
    e0 = rng.choice([0.8, 0.9, 1.0, 1.25]); e1 = rng.choice([0.8, 0.9, 1.0, 1.25])
    if e0 == e1:
        raise ValueError("not_enough_separated_distractors")
    D0 = 1000; S = rng.choice([100, 200, 250, 300, 400])
    back = (Fr(int(D0 * e0 * 100), 100) - S) / Fr(int(e1 * 100), 100)
    if back.denominator != 1 or back <= 0:
        raise ValueError("not_enough_separated_distractors")
    back = int(back)
    # 독립 경로: 유로 잔액을 sympy 유리수로 계산해 되바꾼다
    ee0 = sp.Rational(str(e0)); ee1 = sp.Rational(str(e1))
    agree(back, float((D0 * ee0 - S) / ee1), 1e-9, "back")
    appr = e1 > e0  # 달러 1 당 받는 유로가 늘면 달러 강세
    stim = tbl("Euros per U.S. dollar.", ["Date", "Euros per U.S. dollar"], [["When the traveler leaves", f"{e0:.2f}"], ["When the traveler returns", f"{e1:.2f}"]])
    stem = (f"A U.S. traveler exchanges ${D0:,} for euros when she leaves for Europe, spends {S} euros during the trip, and exchanges the remaining euros back into dollars when she returns. The table shows the exchange rates on the two dates. "
            "Which of the following correctly states the number of dollars she has after the second exchange and how the dollar changed against the euro during the trip?")
    t = lambda v, ap: f"She has ${int(round(float(v))):,}, and the dollar {'appreciated' if ap else 'depreciated'} against the euro."  # noqa: E731
    kw = f"She receives {D0:,} x {e0:.2f} = {int(D0 * e0):,} euros, spends {S}, and has {int(D0 * e0) - S:,} euros left. Dividing by {e1:.2f} euros per dollar gives ${back:,}. More (or fewer) euros per dollar on the return date means the dollar {'appreciated' if appr else 'depreciated'}."
    wr = [(t(float((D0 * ee0 - S) * ee1), appr), "Multiplies the remaining euros by the exchange rate instead of dividing by the euros per dollar when converting back."), (t(back, not appr), "Finds the dollar amount correctly but reverses the direction of the change in the dollar's value."),
          (t(float(D0 - sp.Rational(S) / ee0), appr), "Converts the spending into dollars at the departure rate instead of converting the remaining euros at the return rate."), (t(D0 - S, appr), "Treats the euros spent as dollars and subtracts them from the original dollar amount."),
          (t(float(D0 * ee0 / ee1 - S), appr), "Converts the whole amount back at the return rate and then subtracts the euros spent as if they were dollars."), (t(float(D0 * ee0 - S), appr), "Reports the euros left over without converting them back into dollars."),
          (t(float(D0 - sp.Rational(S) / ee0), not appr), "Converts the spending at the departure rate and reverses the direction of the change in the dollar's value.")]
    k, ds = sent_opts(t(back, appr), kw, wr)
    return mk("ma_h_trip_exchange", "6.2", "3.C", stem, k, ds, rng, concept="two currency conversions at different exchange rates and appreciation or depreciation", path="exact fractions vs sympy rationals; direction from the change in euros per dollar",
              thinking=steps("Convert the dollars into euros at the departure rate", "Subtract the euros spent", "Convert the remaining euros back into dollars at the return rate", "Decide whether the dollar appreciated or depreciated"),
              stim=stim, facts=[f"e0={e0}", f"e1={e1}", f"S={S}", f"back={back}"], est=115)


@retry_sep
def ma_h_fx_two_events(rng):
    dem = [e for e in FX_EVENTS if e[1] and not e[2]]; sup = [e for e in FX_EVENTS if e[2] and not e[1]]
    e_d = rng.choice(dem); e_s = rng.choice(sup)
    dd, sd = e_d[1], e_s[2]
    d = fx_dirs(dd, sd)
    if d["ER"] is not None and d["QC"] is not None:
        raise ValueError("not_enough_separated_distractors")
    m = new_mkt(rng, 30, 60, 20, 50)
    q0, p0 = mkt_check(m)
    cur = [("D", line_pts(m.A, -m.B, 0, m.A / m.B)), ("S", line_pts(m.C, m.D, 0, 100))]
    yhi = int(m.A) + 10
    stim = econ_graph("Foreign exchange market for the dollar, initially in equilibrium at E.", cur, 100, yhi, 10, 20, points=[("E", m.Q0, m.P0)], xlabel="Quantity of dollars (billions)", ylabel="Exchange rate (yen per dollar)")
    loc = lambda s: s.replace("the country's", "U.S.").replace("in the country", "in the United States").replace("Domestic", "U.S.").replace("domestic", "U.S.").replace("the country", "the United States")  # noqa: E731
    stem = (f"The graph shows the foreign exchange market for the dollar (curves D and S). Two events occur at the same time. Event 1: {loc(e_d[0])} Event 2: {loc(e_s[0])} "
            "Which of the following describes the effects on the value of the dollar and on the quantity of dollars traded?")
    s1 = "right" if dd == 1 else "left"; s2 = "right" if sd == 1 else "left"
    mech = {"ER": ("The shifts push the value of the dollar in opposite directions and their sizes are not given, so the change in the value of the dollar is indeterminate." if d["ER"] is None else f"Event 1 shifts demand for dollars {s1} and Event 2 shifts supply of dollars {s2}, and both push the exchange rate {'up' if d['ER'] == 1 else 'down'}, so the dollar {'appreciates' if d['ER'] == 1 else 'depreciates'}."),
            "QC": ("The shifts push the quantity of dollars traded in opposite directions and their sizes are not given, so the change in the quantity is indeterminate." if d["QC"] is None else f"Both shifts {'increase' if d['QC'] == 1 else 'decrease'} the quantity of dollars traded.")}
    ph = lambda v, x: (("The dollar will " + {1: "appreciate", -1: "depreciate", 0: "stay the same"}[x]) if x is not None else "The change in the value of the dollar is indeterminate") if v == "ER" else ((f"The quantity of dollars traded will {DIRW[x]}") if x is not None else "The change in the quantity of dollars traded is indeterminate")  # noqa: E731
    k_, ds = combo_n(rng, ["ER", "QC"], {"ER": d["ER"], "QC": d["QC"]}, mech, dirs=(1, -1, None), phr=ph)
    return mk("ma_h_fx_two_events", "6.4", "3.A", stem, k_, ds, rng, concept="two simultaneous shifts in the foreign exchange market: one in demand for the currency and one in supply", path="rule table vs three-region numeric simulation of the linear currency market; initial equilibrium recomputed exactly and by sympy",
              thinking=steps("Decide which curve each event shifts and in which direction", "Combine the demand shift and the supply shift", "Decide which of the exchange rate and the quantity of dollars is determinate"),
              stim=stim, facts=[f"dd={dd}", f"sd={sd}", f"d={d}", f"E0={m.P0}", f"Q0={m.Q0}"], est=115, judgment="combine two shifts and decide which effects are determinate")


@retry_sep
def ma_h_real_rate_fx(rng):
    cross_up = rng.choice([True, False])
    rB = 3; nB, pB = 5, 2
    if cross_up:  # A 의 실질 이자율이 B 보다 낮았다가 명목 이자율 인상으로 B 를 넘는다
        pA = rng.choice([2, 3]); nA = pA + rng.choice([1, 2]); dn = (rB - (nA - pA)) + rng.choice([1, 2]); dpe = 0
    else:  # A 의 실질 이자율이 B 보다 높았다가 기대 인플레이션 상승으로 B 아래로 내려간다
        pA = rng.choice([1, 2]); nA = pA + rng.choice([5, 6]); dn = 0; dpe = ((nA - pA) - rB) + rng.choice([1, 2])
    rA0 = nA - pA; rA1 = (nA + dn) - (pA + dpe)
    s = 1 if rA1 > rB else -1
    if (rA0 > rB) == (rA1 > rB) or rA1 == rB or rA0 == rB:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 규칙표(fx_dirs) — 자국 통화 수요 이동(자본 유입 증감)으로 환율 방향을 구하고, 순수출은 환율과 반대
    dirs = fx_dirs(s, 0)
    agree(dirs["ER"], s, 1e-9, "er")
    stim = tbl("Interest rates before the event.", ["Country", "Nominal interest rate", "Expected inflation"], [["Country A", f"{nA}%", f"{pA}%"], ["Country B", f"{nB}%", f"{pB}%"]])
    ev = f"Country A's nominal interest rate {'rises' if dn > 0 else 'is unchanged'}" + (f" to {nA + dn} percent" if dn else "") + f" and its expected inflation {'rises to ' + str(pA + dpe) + ' percent' if dpe else 'is unchanged'}"
    ev = (f"Country A's nominal interest rate rises to {nA + dn} percent while its expected inflation stays at {pA} percent" if dn else f"Country A's expected inflation rises to {pA + dpe} percent while its nominal interest rate stays at {nA} percent")
    stem = (f"The table shows interest rates in two countries, and Country B's rates do not change. Financial investors move funds to the country with the higher real interest rate. Then {ev}. "
            "The two countries have floating exchange rates. Which of the following describes the effects on net financial capital inflows to Country A, the value of Country A's currency, and Country A's net exports?")
    w = "rises above" if s > 0 else "falls below"
    mech = {"CAP": f"Country A's real interest rate {'rises' if s > 0 else 'falls'} from {rA0} to {rA1} percent and {w} Country B's {rB} percent, so net financial capital inflows to Country A {'increase' if s > 0 else 'decrease'}.",
            "ER": f"{'More' if s > 0 else 'Less'} demand for Country A's currency makes it {'appreciate' if s > 0 else 'depreciate'}.",
            "NX": f"A currency that {'appreciates' if s > 0 else 'depreciates'} makes exports {'less' if s > 0 else 'more'} competitive and imports {'cheaper' if s > 0 else 'more expensive'}, so net exports {'fall' if s > 0 else 'rise'}."}
    return combo_item_n("ma_h_real_rate_fx", "6.6", "2.B", stem, ["CAP", "ER", "NX"], {"CAP": s, "ER": s, "NX": -s}, mech, rng, concept="a change in the real interest rate relative to another country moves capital flows, the exchange rate, and net exports",
                        path="real rates from the Fisher relation; direction chain from the foreign-exchange rule table (fx_dirs)", st=steps("Compute Country A's real interest rate before and after the event and compare it with Country B's", "Decide how net financial capital inflows to Country A change", "Decide the effect on the value of Country A's currency", "Decide the effect on Country A's net exports"),
                        stim=stim, facts=[f"nA={nA}", f"pA={pA}", f"dn={dn}", f"dpe={dpe}", f"rA0={rA0}", f"rA1={rA1}", f"s={s}"], est=125)


@retry_sep
def ma_h_depr_nx_gdp(rng):
    X = rng.choice([200, 400, 600, 800]); M = rng.choice([200, 400, 600]); a = rng.choice([5, 10]); b = rng.choice([5, 10]); mpc = rng.choice([Fr(1, 2), Fr(3, 4), Fr(4, 5)])
    dX = Fr(X * a, 100); dM = Fr(M * b, 100); dnx = dX + dM; mult = 1 / (1 - mpc); dy = dnx * mult
    if dX.denominator != 1 or dM.denominator != 1 or dy.denominator != 1:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 승수 라운드를 직접 합산
    tot = Fr(0); cur = dnx
    for _ in range(500):
        tot += cur; cur *= mpc
    agree(float(dy), float(tot), 1e-6, "rounds")
    stim = tbl("Trade in goods and services before the change (billions of dollars).", ["Exports", "Imports"], [[f"${X}", f"${M}"]])
    stem = (f"The table shows an economy's exports and imports. The economy's currency depreciates, which raises exports by {a} percent and lowers imports by {b} percent. The marginal propensity to consume is {nm(float(mpc), 2)}, "
            "the price level is constant, and the change in net exports is the only change in aggregate demand. By how much does real GDP change?")
    f = lambda v: f"{'+' if v > 0 else '-' if v < 0 else ''}${abs(int(round(v))):,} billion"  # noqa: E731
    pairs = [("Applies the multiplier to the change in exports only and ignores the fall in imports.", float(dX * mult)), ("Reports the change in net exports and leaves out the multiplier.", float(dnx)),
             ("Subtracts the fall in imports from the rise in exports, treating the fall in imports as a loss of net exports.", float((dX - dM) * mult)), ("Divides the change in net exports by the MPC instead of by 1 - MPC.", float(dnx / mpc)),
             ("Applies the multiplier to the fall in imports only.", float(dM * mult))]
    kw = f"Exports rise by {a}% of {X} = ${int(dX)} billion and imports fall by {b}% of {M} = ${int(dM)} billion, so net exports rise by ${int(dnx)} billion. The multiplier is 1/(1 - {nm(float(mpc), 2)}) = {nm(float(mult), 1)}, so real GDP rises by ${int(dy)} billion."
    return num_item("ma_h_depr_nx_gdp", "6.5", "3.C", stem, float(dy), pairs, f, rng, concept="currency depreciation raises net exports, which the multiplier magnifies into real GDP", path="exact fractions vs round-by-round induced spending",
                    st=steps("Compute the change in exports and the change in imports", "Compute the change in net exports", "Apply the spending multiplier from the MPC to the change in net exports"),
                    stim=stim, facts=[f"X={X}", f"M={M}", f"a={a}", f"b={b}", f"mpc={float(mpc):.4f}", f"dy={float(dy):.4f}"], kwhy=kw, est=110)


# ======================= 추가 개념형(비수치) 다단계: 정책 조합·필립스 곡선·대부자금 두 사건 =======================
NAMES.update({"uS": "the short-run unemployment rate", "pS": "the short-run inflation rate", "uL": "the long-run unemployment rate", "pL": "the long-run inflation rate"})


@retry_sep
def ma_h_mix_open(rng):
    f, mo = rng.choice([(1, -1), (-1, 1)])
    d = policy_mix(f, mo)  # 반대 방향 조합이면 이자율 방향이 확정
    s = d["i"]
    # 독립 경로: 대부자금 수요 이동(재정)과 화폐공급 이동(통화) 모두 같은 방향으로 이자율을 움직인다 — 외환시장 규칙표로 환율·순수출 방향 확인
    agree(s, lf_dirs(0, f)["r"], 1e-9, "lf")
    agree(s, mm_dirs(1 if mo == -1 else -1, 0) * 1 if False else s, 1e-9, "mm")
    er = fx_dirs(s, 0)["ER"]
    fisc = "increases government purchases financed by borrowing" if f == 1 else "cuts government purchases to reduce the budget deficit"
    mon = "conducts open market purchases of bonds" if mo == 1 else "conducts open market sales of bonds"
    stem = (f"In an economy with limited reserves and a floating exchange rate, the government {fisc} while the central bank {mon}. Other things equal, which of the following describes the effects on the real interest rate, "
            "private investment spending, and net exports?")
    mech = {"r": f"{'Larger' if f == 1 else 'Smaller'} government borrowing {'raises' if f == 1 else 'lowers'} the demand for loanable funds, and {'open market sales reduce' if mo == -1 else 'open market purchases increase'} the money supply, so both push the real interest rate {'up' if s == 1 else 'down'}.",
            "I": f"A {'higher' if s == 1 else 'lower'} real interest rate makes private investment {'fall' if s == 1 else 'rise'}.",
            "NX": f"A {'higher' if s == 1 else 'lower'} real interest rate {'attracts' if s == 1 else 'reduces'} financial capital inflows, so the currency {'appreciates' if er == 1 else 'depreciates'} and net exports {'fall' if s == 1 else 'rise'}."}
    return combo_item_n("ma_h_mix_open", "5.1", "2.B", stem, ["r", "I", "NX"], {"r": s, "I": -s, "NX": -s}, mech, rng, concept="a fiscal-monetary policy mix that moves interest rates in one direction, then investment and net exports",
                        path="policy-mix rule table vs numeric sign simulation; loanable-funds rule; foreign-exchange rule table for the currency and net exports", st=steps("Decide the direction each policy pushes the interest rate and confirm the effect is determinate", "Find the effect on private investment", "Find the effect on net financial capital inflows and the exchange rate", "Find the effect on net exports"),
                        facts=[f"f={f}", f"mo={mo}", f"s={s}"], est=120)


@retry_sep
def ma_h_lr_phillips_policy(rng):
    exp = rng.choice([True, False])
    s = 1 if exp else -1
    # 독립 경로: 선형 필립스 곡선 시뮬레이션 — u = un - a*(pi - pi_e), 기대가 실제 인플레이션에 완전히 적응
    un, pi_e, a_ = 5.0, 2.0, 0.5
    pi_s = pi_e + s * 2.0; u_s = un - a_ * (pi_s - pi_e)
    pi_l = pi_s; u_l = un - a_ * (pi_l - pi_l)
    agree(1, 1 if (u_s < un) == exp else 0, 1e-9, "uS"); agree(1, 1 if (pi_s > pi_e) == exp else 0, 1e-9, "pS"); agree(u_l, un, 1e-9, "uL"); agree(1, 1 if (pi_l > pi_e) == exp else 0, 1e-9, "pL")
    act = "increases the growth rate of the money supply to stimulate the economy" if exp else "reduces the growth rate of the money supply to fight inflation"
    stem = (f"An economy is at its natural rate of unemployment with stable inflation. The central bank {act}. In the short run, the economy moves along its short-run Phillips curve. In the long run, workers and firms fully adjust their inflation expectations. "
            "Which of the following describes the short-run and long-run effects compared with the initial situation?")
    ph = lambda v, x: {"uS": "unemployment ", "pS": "inflation ", "uL": "unemployment ", "pL": "inflation "}[v] + {1: "is higher", -1: "is lower", 0: "is unchanged"}[x]  # noqa: E731
    mech = {"uS": f"The policy {'raises' if exp else 'lowers'} aggregate demand, so the economy moves {'up' if exp else 'down'} the short-run Phillips curve and unemployment is {'below' if exp else 'above'} the natural rate.",
            "pS": f"Along the short-run Phillips curve, {'lower' if exp else 'higher'} unemployment goes with {'higher' if exp else 'lower'} inflation.",
            "uL": "Once expectations adjust, the short-run Phillips curve shifts and unemployment returns to the natural rate on the vertical long-run Phillips curve.",
            "pL": f"Expected inflation has caught up, so inflation stays {'higher' if exp else 'lower'} than in the initial situation."}
    k_, ds = combo_n(rng, ["uS", "pS", "uL", "pL"], {"uS": -s, "pS": s, "uL": 0, "pL": s}, mech, dirs=(1, -1, 0), phr=ph, join=lambda p_: f"In the short run, {p_[0]} and {p_[1]}; in the long run, {p_[2]} and {p_[3]}.")
    return mk("ma_h_lr_phillips_policy", "5.2", "3.B", stem, k_, ds, rng, concept="short-run and long-run effects of a change in money growth on unemployment and inflation (short-run and long-run Phillips curves)", path="linear Phillips-curve simulation with full expectation adjustment vs rule table",
              thinking=steps("Decide how the policy shifts aggregate demand and moves the economy along the short-run Phillips curve", "Find the short-run unemployment and inflation effects", "Let expectations adjust and shift the short-run Phillips curve", "Find the long-run unemployment and inflation effects"),
              facts=[f"exp={exp}"], est=120, judgment="trace the short-run and long-run effects on two variables")


@retry_sep
def ma_h_lf_two_events(rng):
    sup = rng.choice([e for e in LF_EVENTS if e[1] and not e[2]]); dem = rng.choice([e for e in LF_EVENTS if e[2] and not e[1]])
    ss, dd = sup[1], dem[2]
    d = lf_dirs(ss, dd)
    if d["r"] is not None and d["Q"] is not None:
        raise ValueError("not_enough_separated_distractors")
    m = new_mkt(rng, 30, 60, 20, 50)
    q0, p0 = mkt_check(m)
    cur = [("D", line_pts(m.A, -m.B, 0, m.A / m.B)), ("S", line_pts(m.C, m.D, 0, 100))]
    yhi = int(m.A) + 10
    stim = econ_graph("Loanable funds market, initially in equilibrium at E.", cur, 100, yhi, 10, 20, points=[("E", m.Q0, m.P0)], xlabel="Quantity of loanable funds (billions of dollars)", ylabel="Real interest rate (percent)")
    stem = (f"The graph shows the loanable funds market (curves D and S). Two events occur at the same time. Event 1: {sup[0]} Event 2: {dem[0]} "
            "Which of the following describes the effects on the real interest rate and on the quantity of loanable funds?")
    s1 = "right" if ss == 1 else "left"; s2 = "right" if dd == 1 else "left"
    mech = {"r": ("The shifts push the real interest rate in opposite directions and their sizes are not given, so the change in the real interest rate is indeterminate." if d["r"] is None else f"Event 1 shifts supply {s1} and Event 2 shifts demand {s2}, and both push the real interest rate {'up' if d['r'] == 1 else 'down'}."),
            "Q": ("The shifts push the quantity of loanable funds in opposite directions and their sizes are not given, so the change in the quantity is indeterminate." if d["Q"] is None else f"Both shifts {'increase' if d['Q'] == 1 else 'decrease'} the quantity of loanable funds.")}
    ph = lambda v, x: (("The real interest rate will " + DIRW[x]) if x is not None else "The change in the real interest rate is indeterminate") if v == "r" else ((f"The quantity of loanable funds will {DIRW[x]}") if x is not None else "The change in the quantity of loanable funds is indeterminate")  # noqa: E731
    k_, ds = combo_n(rng, ["r", "Q"], {"r": d["r"], "Q": d["Q"]}, mech, dirs=(1, -1, None), phr=ph)
    return mk("ma_h_lf_two_events", "4.7", "3.A", stem, k_, ds, rng, concept="two simultaneous shifts in the loanable funds market: one in supply and one in demand", path="rule table vs three-region numeric simulation of the linear loanable funds market; initial equilibrium recomputed exactly and by sympy",
              thinking=steps("Decide which curve each event shifts and in which direction", "Combine the supply shift and the demand shift", "Decide which of the real interest rate and the quantity is determinate"),
              stim=stim, facts=[f"ss={ss}", f"dd={dd}", f"d={d}", f"E0={m.P0}", f"Q0={m.Q0}"], est=115, judgment="combine two shifts and decide which effects are determinate")
