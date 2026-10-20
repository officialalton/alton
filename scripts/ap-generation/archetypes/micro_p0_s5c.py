"""AP Microeconomics 확대 MI3 — 신규 원형 C(단원 4·5·6). 2026-10-19. 공개 세트와 풀이 틀이 겹치지 않는다. 수치 원형은 정확 분수·전수 탐색으로 정답을 독립 계산한다."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401
from micro_p0_s5a import _bank


# ================= 단원 4 =================
@retry_sep
def mi_merger_hhi_change(rng):
    n = rng.choice([4, 5, 6])
    shares = sorted(rng.sample([5, 10, 15, 20, 25, 30], n), reverse=True)
    rest = 100 - sum(shares)
    if rest != 0:
        shares[-1] += rest
        if shares[-1] <= 0 or len(set(shares)) < n:
            raise ValueError("not_enough_separated_distractors")
    i, j = sorted(rng.sample(range(n), 2))
    s1, s2 = shares[i], shares[j]
    before = sum(s * s for s in shares)
    after_sh = [s for k_, s in enumerate(shares) if k_ not in (i, j)] + [s1 + s2]
    after = sum(s * s for s in after_sh)
    delta = after - before
    agree(delta, 2 * s1 * s2, 1e-9, "dhhi")
    names = "ABCDEF"
    lst = ", ".join(f"Firm {names[k_]} ({shares[k_]} percent)" for k_ in range(n))
    stem = f"An industry has {n} firms with the following market shares: {lst}. Firm {names[i]} and Firm {names[j]} announce a merger. By how many points would the Herfindahl-Hirschman Index (HHI) increase if the merger is approved?"
    k, ds = val_opts(delta, [("Squares the merged firm's share and treats that as the change, without removing the two original squared shares.", (s1 + s2) ** 2), ("Multiplies the two shares but forgets the factor of 2 in (a + b)^2 - a^2 - b^2.", s1 * s2),
                             ("Adds the two squared shares instead of finding the increase caused by combining them.", s1 * s1 + s2 * s2), ("Reports the new HHI after the merger instead of the increase.", after), ("Adds the two shares, reporting the merged firm's share rather than a change in the index.", s1 + s2)], lambda v: nm(v, 0))
    return mk("mi_merger_hhi_change", "4.1", "2.C", stem, k, ds, rng, concept="a merger raises the HHI by twice the product of the merging firms' shares", path="difference of recomputed HHI before/after vs closed form 2ab (exact integers)",
              kwhy=f"The merged firm's share is {s1 + s2}, so the index changes by ({s1}+{s2})^2 - {s1}^2 - {s2}^2 = {delta}.", facts=[f"shares={shares}", f"merge={s1},{s2}", f"delta={delta}"], est=85,
              judgment="recompute the index for the merged market and take the difference")


@retry_sep
def mi_mr_table_profit(rng):
    a = rng.choice([40, 48, 56, 60, 72]); b = rng.choice([4, 6, 8])
    c = rng.choice([6, 8, 10, 12, 14])
    qs = list(range(1, 9))
    P = {q: a - b * (q - 1) for q in qs}  # 표의 가격: 단위당 b 씩 하락
    if min(P.values()) <= c:
        raise ValueError("not_enough_separated_distractors")
    TR = {q: P[q] * q for q in qs}
    MR = {q: TR[q] - (TR[q - 1] if q > 1 else 0) for q in qs}
    qstar = max([q for q in qs if MR[q] >= c], default=0)
    if qstar in (0, 8) or any(MR[q] == c for q in qs):
        raise ValueError("not_enough_separated_distractors")
    prof = {q: TR[q] - c * q for q in qs}
    best = max(qs, key=lambda q: prof[q])
    agree(best, qstar, 1e-9, "qstar")
    if list(prof.values()).count(prof[best]) > 1:
        raise ValueError("not_enough_separated_distractors")
    qc = max([q for q in qs if P[q] >= c], default=0)  # 완전경쟁 P=MC
    qrev = max(qs, key=lambda q: TR[q])
    stim = tbl("Demand schedule facing a monopolist.", ["Quantity", "Price"], [[q, usd(P[q])] for q in qs])
    stem = f"A monopolist faces the demand schedule shown and produces each unit at a constant marginal cost of {usd(c)}. What price will the profit-maximizing monopolist charge?"
    k, ds = val_opts(P[qstar], [("Charges the price at the output where price equals marginal cost, the output a perfectly competitive industry would choose.", P[qc]), ("Charges the price at the output that maximizes total revenue, which ignores marginal cost.", P[qrev]),
                                ("Charges the price one unit above the profit-maximizing output.", P[min(8, qstar + 1)]), ("Charges the price one unit below the profit-maximizing output, stopping before the last unit with marginal revenue above marginal cost.", P[max(1, qstar - 1)]),
                                ("Charges the marginal cost, because price should equal marginal cost.", c), ("Charges the highest price on the schedule.", P[1])], usd)
    return mk("mi_mr_table_profit", "4.2", "2.C", stem, k, ds, rng, concept="a monopolist produces where marginal revenue equals marginal cost and charges the demand price at that quantity", path="MR from differences of total revenue vs exhaustive profit search",
              stim=stim, kwhy=f"Marginal revenue from the schedule exceeds {usd(c)} through unit {qstar}; the profit-maximizing quantity is {qstar}, so the price is {usd(P[qstar])}.", facts=[f"a={a}", f"b={b}", f"c={c}", f"q*={qstar}"], est=105,
              judgment="derive marginal revenue from the schedule and compare it with marginal cost")


@retry_sep
def mi_mc_tangency_table(rng):
    qm = rng.choice([7, 8]); A = rng.choice([8, 10, 12]); qs_ = rng.choice([4, 5])
    qs = list(range(2, qm + 1))
    atc = {q: A + (q - qm) ** 2 for q in qs}
    slope = 2 * (qs_ - qm)
    P = {q: atc[qs_] + slope * (q - qs_) for q in qs}
    if min(P.values()) <= 0:
        raise ValueError("not_enough_separated_distractors")
    zero = [q for q in qs if P[q] == atc[q]]
    agree(len(zero), 1, 1e-9, "unique_tangent")
    assert zero[0] == qs_ and all(P[q] < atc[q] for q in qs if q != qs_)
    stim = tbl("A monopolistically competitive firm after entry: the price its demand allows and its average total cost at each output.", ["Output", "Price", "Average total cost"], [[q, usd(P[q]), usd(atc[q])] for q in qs])
    stem = "The table shows, for a monopolistically competitive firm in a market where entry has been completed, the price the firm's demand allows and its average total cost at each level of output. At which output is the firm in long-run equilibrium?"
    k, ds = val_opts(qs_, [("Chooses the output with the lowest average total cost, but a monopolistically competitive firm ends up producing less than that output (excess capacity).", qm), ("Chooses the smallest output shown, where the price is highest.", qs[0]),
                           ("Chooses the output one unit higher, where the firm would earn a loss because average total cost exceeds the price.", qs_ + 1), ("Chooses the output one unit lower, where average total cost exceeds the price and the firm earns a loss.", qs_ - 1)], lambda v: str(int(v)))
    return mk("mi_mc_tangency_table", "4.4", "2.C", stem, k, ds, rng, concept="long-run monopolistic competition ends with price equal to average total cost and zero economic profit", path="unique row with P = ATC vs tangency of the linear demand to the convex ATC",
              stim=stim, kwhy=f"Only at output {qs_} does the price equal average total cost ({usd(P[qs_])}), so economic profit is zero and entry stops.", facts=[f"qm={qm}", f"A={A}", f"q*={qs_}"], est=95,
              judgment="find the output with zero economic profit and reject the minimum-cost output")


@retry_sep
def mi_price_discrim_numeric(rng):
    n = rng.choice([5, 6])
    wtp = sorted(rng.sample(range(14, 61, 2), n), reverse=True)
    mc = rng.choice([6, 8, 10])
    if min(wtp) <= mc + 2:
        raise ValueError("not_enough_separated_distractors")
    single = max(((p, sum(1 for w in wtp if w >= p) * (p - mc)) for p in wtp), key=lambda t: t[1])
    if [t for t in ((p, sum(1 for w in wtp if w >= p) * (p - mc)) for p in wtp) if t[1] == single[1]] and len([p for p in wtp if sum(1 for w in wtp if w >= p) * (p - mc) == single[1]]) > 1:
        raise ValueError("not_enough_separated_distractors")
    perfect = sum(w - mc for w in wtp)
    gain = perfect - single[1]
    agree(gain, float(sum(sp.Integer(w) for w in wtp) - n * mc - single[1]), 1e-9, "gain")
    names = ["Ana", "Ben", "Cho", "Dev", "Eli", "Fay"][:n]
    stim = tbl("Maximum price each buyer is willing to pay for one ticket.", ["Buyer", "Willingness to pay"], [[names[i], usd(wtp[i])] for i in range(n)])
    stem = f"A theater can produce each ticket at a marginal cost of {usd(mc)}. Each of the {n} buyers will buy at most one ticket, as shown. The theater must now choose between charging every buyer one price and charging each buyer exactly the buyer's willingness to pay. By how much does the second approach raise the theater's profit above the best single price?"
    k, ds = val_opts(gain, [("Computes the profit from perfect price discrimination but does not subtract the best single-price profit.", perfect), ("Subtracts total marginal cost twice, counting the cost of each ticket in both profit figures.", gain + n * mc),
                            ("Uses the revenue under perfect discrimination minus the revenue at the best single price, ignoring the marginal cost.", sum(wtp) - single[0] * sum(1 for w in wtp if w >= single[0])), ("Reports the best single-price profit instead of the increase.", single[1]),
                            ("Takes the difference between the highest and lowest willingness to pay.", wtp[0] - wtp[-1])], usd)
    return mk("mi_price_discrim_numeric", "4.2", "2.C", stem, k, ds, rng, concept="perfect price discrimination captures every buyer's willingness to pay", path="enumerate single prices at each willingness to pay vs sum of (willingness to pay - cost)",
              stim=stim, kwhy=f"The best single price is {usd(single[0])} for a profit of {usd(single[1])}; perfect discrimination earns {usd(perfect)}, so profit rises by {usd(gain)}.", facts=[f"wtp={wtp}", f"mc={mc}", f"single={single}", f"perfect={perfect}"], est=110,
              judgment="compute the best uniform-price profit and the discriminating profit and take the difference")


LUMP_TAX = [
    ("A monopolist is subject to a new fixed annual license fee that does not depend on how much it produces. Assuming the monopolist continues to operate, how will the fee affect its profit-maximizing price and quantity in the short run?",
     "Price and quantity will not change, because a fixed fee does not change marginal cost or marginal revenue.",
     "A fixed fee is a fixed cost: it lowers profit but does not shift marginal cost, so the MR = MC output and the price stay the same.",
     [("Price will rise and quantity will fall, because the monopolist passes the fee on to consumers.", "Treats a fixed fee as a per-unit cost; only a per-unit cost raises marginal cost."),
      ("Price will fall and quantity will rise, because the monopolist must produce more to cover the fee.", "Assumes the firm raises output to cover a fixed cost; the profit-maximizing output depends only on marginal revenue and marginal cost."),
      ("Quantity will fall but price will stay the same, because the demand curve is unchanged.", "Price and quantity are both determined by MR = MC and the demand curve; neither changes."),
      ("Marginal cost will rise by the amount of the fee divided by the quantity.", "The fee divided by quantity raises average cost, but marginal cost is unchanged.")]),
    ("A monopolist selling a good faces a new per-unit tax on each unit it sells. What is the most likely effect on its profit-maximizing price and quantity?",
     "Price will rise and quantity will fall, because the tax raises marginal cost.",
     "A per-unit tax shifts the marginal cost curve upward, so the MR = MC quantity is lower and the demand price is higher.",
     [("Price and quantity will not change, because a monopolist is not affected by taxes.", "A per-unit tax raises marginal cost, which changes the profit-maximizing choice."),
      ("Price will fall and quantity will rise, because the monopolist must sell more to pay the tax.", "Raises output in response to a higher marginal cost; a higher marginal cost reduces the profit-maximizing output."),
      ("Price will rise and quantity will rise, because demand is unchanged.", "A higher price along an unchanged demand curve means a lower quantity demanded."),
      ("Price will rise by exactly the amount of the tax, with no change in quantity.", "The monopolist faces a downward-sloping demand curve; raising price by the full tax reduces quantity.")]),
]


def mi_monopoly_tax_effect(rng):
    return _bank(rng, "mi_monopoly_tax_effect", "4.2", "3.A", LUMP_TAX, "a fixed fee leaves marginal cost unchanged, a per-unit tax raises it", "fixed vetted scenarios; the key follows from where the cost change enters MR = MC", judgment="decide whether marginal cost changes and trace the result to price and quantity")


ENTRY_MC = [
    ("Firms in a monopolistically competitive market are earning positive economic profit. Which of the following is the most likely long-run effect on an existing firm?",
     "New firms enter, the demand facing each existing firm shifts left and becomes more elastic, and economic profit falls to zero.",
     "Positive profit attracts entry; more close substitutes reduce each firm's demand and make it more elastic until profit is zero.",
     [("New firms enter, and the demand facing each existing firm shifts right, because there are more consumers.", "Entry splits the market among more firms; it shifts each firm's demand left."),
      ("No firms enter, because product differentiation prevents all entry.", "Differentiation does not stop entry; barriers to entry are low in monopolistic competition."),
      ("Existing firms exit, because positive economic profit is a signal to leave.", "Positive economic profit attracts entry; losses cause exit."),
      ("Each firm's demand becomes less elastic, because there are more brands to choose from.", "More close substitutes make each firm's demand more elastic.")]),
    ("A monopolistically competitive firm earns an economic loss in the short run. Which of the following describes the long-run adjustment?",
     "Some firms exit, the demand facing each remaining firm shifts right, and the remaining firms earn zero economic profit.",
     "Losses cause exit; fewer competitors raise each remaining firm's demand until economic profit returns to zero.",
     [("More firms enter, because the market is clearly not saturated.", "Losses cause exit, not entry."),
      ("The remaining firms earn positive economic profit, because exit reduces competition.", "Exit continues only until losses are removed, leaving zero economic profit."),
      ("Each remaining firm's demand shifts left, because consumers dislike the surviving products.", "With fewer firms the remaining firms' demand shifts right."),
      ("The firm continues to earn losses indefinitely, because monopolistically competitive firms can always sell at a loss.", "Losses cannot persist in the long run; exit occurs.")]),
]


def mi_entry_mc_shift(rng):
    return _bank(rng, "mi_entry_mc_shift", "4.4", "3.A", ENTRY_MC, "entry and exit in monopolistic competition until zero economic profit", "fixed vetted scenarios; the key follows profit to entry or exit and then to the shift in firm demand", judgment="trace entry or exit to the change in each firm's demand and profit")


PD_EFFECT = [
    ("A perfectly price-discriminating monopolist charges each buyer the maximum price the buyer is willing to pay. Compared with a single-price monopolist facing the same demand and costs, what is the most likely effect on output and deadweight loss?",
     "Output rises to the efficient level, and deadweight loss is eliminated, but all consumer surplus is captured by the monopolist.",
     "The perfect discriminator sells every unit for which willingness to pay exceeds marginal cost, so output is efficient and there is no deadweight loss, but consumer surplus is zero.",
     [("Output falls below the single-price output, and deadweight loss rises.", "A price-discriminating monopolist sells additional units to buyers with lower willingness to pay, so output rises."),
      ("Output stays the same, and consumer surplus rises.", "Output expands, and the discriminator captures consumer surplus."),
      ("Output rises to the efficient level, and consumer surplus rises.", "Consumer surplus is captured by the firm, not raised."),
      ("Output rises, but deadweight loss remains because price exceeds marginal cost for each unit.", "Each unit is sold at its willingness to pay, and the last unit is sold at marginal cost, so no efficient trade is blocked.")]),
]


def mi_price_discrim_effect(rng):
    return _bank(rng, "mi_price_discrim_effect", "4.2", "3.A", PD_EFFECT, "perfect price discrimination: efficient output, no deadweight loss, no consumer surplus", "fixed vetted statements; each wrong sentence reverses an output, surplus, or deadweight-loss effect", judgment="determine the effect on output, deadweight loss, and surplus")


# ================= 단원 5 =================
@retry_sep
def mi_hire_table_wage_change(rng):
    p = rng.choice([4, 5, 6, 8]); w1 = rng.choice([20, 24, 28]); dw = rng.choice([8, 12, 16]); w2 = w1 + dw
    mp = sorted(rng.sample(range(3, 15), 7), reverse=True)
    mrp = [m * p for m in mp]
    h = lambda w: sum(1 for v in mrp if v >= w)  # noqa: E731
    n1, n2 = h(w1), h(w2)
    if n1 == n2 or n2 == 0 or any(v == w1 or v == w2 for v in mrp):
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 이윤을 전수 탐색
    best = lambda w: max(range(0, 8), key=lambda L: sum(mrp[:L]) - w * L)  # noqa: E731
    assert best(w1) == n1 and best(w2) == n2
    stim = tbl("Marginal product of each additional worker.", ["Worker", "Marginal product (units per day)"], [[i + 1, mp[i]] for i in range(7)])
    stem = f"A firm sells its output in a perfectly competitive product market at {usd(p)} per unit and hires workers in a perfectly competitive labor market. The table shows each additional worker's marginal product. The daily wage rises from {usd(w1)} to {usd(w2)}. By how many workers does the profit-maximizing firm reduce its hiring?"
    d = n1 - n2
    k, ds = val_opts(d, [("Compares the wage with marginal product instead of with marginal revenue product, which gives a different number of workers.", abs(sum(1 for m in mp if m >= w1) - sum(1 for m in mp if m >= w2))),
                         ("Reports the number of workers hired after the wage increase rather than the change.", n2), ("Reports the number of workers hired before the wage increase rather than the change.", n1),
                         ("Counts only one worker for any wage increase, since the wage rose once.", 1), ("Adds the change in the wage to the number of workers.", d + 2)], lambda v: str(int(v)))
    return mk("mi_hire_table_wage_change", "5.3", "2.C", stem, k, ds, rng, concept="a firm hires workers until marginal revenue product falls to the wage", path="count of MRP >= wage vs exhaustive search of total profit over hiring levels",
              stim=stim, kwhy=f"MRP = {usd(p)} x MP; at {usd(w1)} the firm hires {n1} workers and at {usd(w2)} it hires {n2}, a reduction of {d}.", facts=[f"p={p}", f"w1={w1}", f"w2={w2}", f"mp={mp}", f"n1={n1}", f"n2={n2}"], est=110,
              judgment="convert marginal product to marginal revenue product and compare it with each wage")


@retry_sep
def mi_labor_shift_numeric(rng):
    m = new_mkt(rng, 20, 60, 20, 80)  # 수요 W = A - B L, 공급 W = C + D L (임금·고용)
    dA = rng.choice([8, 10, 12, 16, 20])
    q0, p0 = mkt_check(m)
    q1, p1 = mkt_check(m, dA=dA)
    if p1 != int(p1) and (p1 * 2 != int(p1 * 2)):
        raise ValueError("not_enough_separated_distractors")
    dw = float(p1 - p0)
    if dw <= 0:
        raise ValueError("not_enough_separated_distractors")
    co = lambda v: "" if float(v) == 1 else nm(float(v))  # noqa: E731
    stem = (f"In a competitive labor market, the labor demand curve is W = {m.A} - {co(m.B)}L and the labor supply curve is W = {m.C} + {co(m.D)}L, where W is the hourly wage in dollars and L is thousands of workers. "
            f"An increase in the price of the product raises labor demand so that the demand curve becomes W = {m.A + dA} - {co(m.B)}L. By how much does the equilibrium wage rise?")
    k, ds = val_opts(dw, [("Reports the full vertical shift of the demand curve rather than the change in the equilibrium wage.", dA), ("Reports the new equilibrium wage rather than the change.", float(p1)),
                          ("Assumes the wage rises by the shift divided by the slope of the demand curve.", dA / float(m.B)), ("Reports the change in equilibrium employment instead of the change in wage.", float(q1 - q0)),
                          ("Splits the shift evenly between the two sides of the market.", dA / 2)], lambda v: usd(v))
    return mk("mi_labor_shift_numeric", "5.2", "2.C", stem, k, ds, rng, concept="a shift in labor demand moves the equilibrium wage by less than the shift when supply slopes upward", path="exact fractions vs sympy solution of the two equilibria",
              kwhy=f"Equilibrium moves from W = {usd(p0)} to W = {usd(p1)}, an increase of {usd(dw)}.", facts=[f"A={m.A}", f"B={m.B}", f"C={m.C}", f"D={m.D}", f"dA={dA}"], est=110, judgment="solve both equilibria and take the difference")


@retry_sep
def mi_mc_from_mp_wage(rng):
    w1 = rng.choice([30, 36, 40, 48, 60]); dw = rng.choice([6, 12, 18, 24]); w2 = w1 + dw
    mp = rng.choice([3, 4, 6, 8, 12])
    if (w1 % mp) or (w2 % mp):
        raise ValueError("not_enough_separated_distractors")
    mc1, mc2 = Fr(w1, mp), Fr(w2, mp)
    delta = mc2 - mc1
    agree(float(delta), (w2 - w1) / mp, 1e-9, "dmc")
    stem = f"A firm hires workers at a daily wage, and the marginal product of its last worker is {mp} units per day. The daily wage rises from {usd(w1)} to {usd(w2)}, and the marginal product of the last worker does not change. By how much does the firm's marginal cost of producing one more unit rise?"
    k, ds = val_opts(float(delta), [("Reports the change in the wage rather than the change in the cost per unit.", dw), ("Multiplies the wage change by the marginal product instead of dividing by it.", dw * mp),
                                    ("Reports the new marginal cost per unit instead of the increase.", float(mc2)), ("Reports the old marginal cost per unit instead of the increase.", float(mc1)), ("Divides the wage change by two.", dw / 2)], lambda v: usd(v))
    return mk("mi_mc_from_mp_wage", "5.3", "2.C", stem, k, ds, rng, concept="marginal cost of output equals the wage divided by the marginal product of labor", path="exact fraction change in w/MP vs sympy",
              kwhy=f"MC = wage / MP: {usd(w1)}/{mp} = {usd(float(mc1))} before and {usd(w2)}/{mp} = {usd(float(mc2))} after, an increase of {usd(float(delta))}.", facts=[f"w1={w1}", f"w2={w2}", f"mp={mp}"], est=70,
              judgment="relate input cost and marginal product to the cost of one more unit of output")


@retry_sep
def mi_mrp_price_change(rng):
    mp = rng.choice([5, 6, 8, 10, 12]); p1 = rng.choice([5, 6, 8, 10]); cut = rng.choice([1, 2, 3])
    p2 = p1 - cut
    if p2 <= 0:
        raise ValueError("not_enough_separated_distractors")
    mrp1, mrp2 = mp * p1, mp * p2
    agree(mrp1 - mrp2, cut * mp, 1e-9, "dmrp")
    stem = f"A firm's last worker produces {mp} additional units per day. The market price of the firm's output falls from {usd(p1)} to {usd(p2)}. What is the highest daily wage the firm is willing to pay to keep employing this worker after the price falls?"
    k, ds = val_opts(mrp2, [("Uses the old price, which gives the highest wage the firm was willing to pay before the price fell.", mrp1), ("Uses the price alone, ignoring the worker's marginal product.", p2),
                            ("Uses the amount of the price decrease times the marginal product, which is the fall in the value of the worker.", cut * mp), ("Adds the marginal product and the new price.", mp + p2),
                            ("Divides the marginal product by the new price.", mp / p2)], lambda v: usd(v))
    return mk("mi_mrp_price_change", "5.3", "2.C", stem, k, ds, rng, concept="the most a competitive firm will pay for a worker is the worker's marginal revenue product", path="MP x price vs exact fraction check of the change",
              kwhy=f"The worker's marginal revenue product is now {mp} x {usd(p2)} = {usd(mrp2)}, the most the firm will pay.", facts=[f"mp={mp}", f"p1={p1}", f"p2={p2}"], est=75, judgment="value the worker's added output at the new price")


# ================= 단원 6 =================
@retry_sep
def mi_natural_monopoly_pricing(rng):
    q1 = rng.choice([2, 3, 4]); q2 = q1 + rng.choice([4, 6, 8])
    # ATC = c + F/Q 와 수요 P = a - bQ 가 Q = q1, q2 에서 만난다: bQ^2 - (a-c)Q + F = 0 -> 근의 합 (a-c)/b = q1+q2, 곱 F/b = q1 q2
    b = rng.choice([1, 2, 3]); c = rng.choice([4, 6, 8])
    a = c + b * (q1 + q2); F = b * q1 * q2
    pf = a - b * q2  # 공정수익가격: 큰 해에서의 가격
    p_mc = c
    qm = Fr(a - c, 2 * b)
    pm = a - b * qm
    # 독립 경로: sympy 로 P=ATC 방정식을 푼다
    Q = sp.symbols("Q", positive=True)
    sol = sorted(sp.solve(sp.Eq(a - b * Q, c + sp.Integer(F) / Q), Q))
    agree(float(sol[-1]), q2, 1e-9, "root")
    if len(sol) != 2 or float(pm) != int(pm):
        raise ValueError("not_enough_separated_distractors")
    bq = "Q" if b == 1 else f"{b}Q"
    stem = (f"A natural monopoly faces the market demand curve P = {a} - {bq} and has a constant marginal cost of {usd(c)} per unit plus a fixed cost of {usd(F)}, so its average total cost is ATC = {c} + {F}/Q. "
            f"A regulator requires the firm to charge the lowest price at which the firm just breaks even (price equal to average total cost) while serving as many customers as possible. What price must the firm charge?")
    k, ds = val_opts(pf, [("Sets the price equal to marginal cost, which would leave the firm with a loss equal to its fixed cost.", p_mc), ("Charges the unregulated monopoly price, where marginal revenue equals marginal cost.", float(pm)),
                          ("Uses the smaller of the two quantities where price equals average total cost, which serves fewer customers.", a - b * q1), ("Charges the price at the demand curve's vertical intercept.", a),
                          ("Sets the price equal to average fixed cost at the larger quantity.", F / q2)], usd)
    return mk("mi_natural_monopoly_pricing", "6.4", "2.C", stem, k, ds, rng, concept="fair-return pricing sets price equal to average total cost; marginal-cost pricing leaves a natural monopoly with a loss", path="closed-form roots of P = ATC vs sympy solve",
              kwhy=f"Price equals ATC where {a} - {b}Q = {c} + {F}/Q, which has roots Q = {q1} and Q = {q2}; the larger quantity gives the price {usd(pf)}.", facts=[f"a={a}", f"b={b}", f"c={c}", f"F={F}", f"q1={q1}", f"q2={q2}"], est=130,
              judgment="set price equal to average total cost and choose the root that serves more customers")
