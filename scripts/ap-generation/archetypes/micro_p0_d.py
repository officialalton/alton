"""AP Microeconomics P0 원형 D — 단원 4(불완전경쟁)·5(요소시장)·6(시장 실패와 정부의 역할). 2026-10-13."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401
from micro_checks import monopoly as _mono_exact, nash as _nash_exact


# ======================= 4.1 불완전경쟁 개론 =======================
def mi_barriers(rng):
    k, ds = sent_opts("The government grants a firm the exclusive right to sell a product.", "A government-granted exclusive right (a patent or license) blocks other firms from entering, which is a legal barrier to entry.",
                      [("The firm's product is sold to many buyers at a price set by the market.", "Describes price-taking behavior in competitive markets, not a barrier to entry."), ("Many firms sell nearly identical products in the same market.", "Many identical sellers indicate low barriers to entry and perfect competition."), ("Firms can leave the industry at any time without losing fixed costs.", "Easy exit describes low barriers; fixed costs are unrelated to the definition of a barrier."),
                       ("Consumers have no preference among the products offered.", "Consumer indifference describes homogeneous products, not an entry barrier."), ("The price of the product is equal to its marginal cost.", "Price equal to marginal cost is an efficiency outcome, not a barrier to entry.")])
    return mk("mi_barriers", "4.1", "1.A", "Which of the following is an example of a barrier to entry into an industry?", k, ds, rng, concept="barriers to entry", path="fixed vetted examples of entry barriers", facts=["variant=1"], est=45)


STRUCT = [
    ("a single firm sells a product with no close substitutes, and high barriers prevent other firms from entering", "Monopoly"),
    ("many firms sell differentiated products, entry and exit are easy, and each firm faces a downward-sloping demand curve", "Monopolistic competition"),
    ("a few large firms dominate the market, each firm's decisions affect its rivals, and barriers to entry are significant", "Oligopoly"),
    ("many firms sell an identical product, each is a price taker, and entry and exit are free", "Perfect competition"),
]


def mi_structure_identify(rng):
    desc, ans = STRUCT[rng.randrange(4)]
    others = [s[1] for s in STRUCT if s[1] != ans] + ["Natural monopoly"]
    why = {"Monopoly": "Mistakes any large market share or barriers for a single seller with no close substitutes.", "Monopolistic competition": "Mistakes product differentiation with free entry for a market with barriers or a single seller.", "Oligopoly": "Mistakes interdependent behavior among a few firms for a market with many sellers or one seller.",
           "Perfect competition": "Mistakes many sellers for price-taking firms with identical products and free entry.", "Natural monopoly": "Treats a market with economies of scale over the whole demand range as the structure described, which the description does not mention."}
    k, ds = sent_opts(ans, f"The description (single/few/many sellers, product type, and entry) matches {ans.lower()}.", [(o, why[o]) for o in others])
    return mk("mi_structure_identify", "4.1", "1.B", f"A market has the following characteristics: {desc}. Which market structure does this describe?", k, ds, rng, concept="identify a market structure from its characteristics", path="fixed vetted structure descriptions", facts=[f"ans={ans}"], est=45)


@retry_sep
def mi_hhi(rng):
    n = rng.choice([3, 4, 5])
    shares = sorted(rng.sample([5, 10, 15, 20, 25, 30, 35, 40, 45, 50], n), reverse=True)
    tot = sum(shares)
    if tot != 100:
        # 비율을 맞추기 위해 마지막 값을 보정
        shares[-1] = 100 - sum(shares[:-1])
        if shares[-1] <= 0 or len(set(shares)) < n:
            raise ValueError("not_enough_separated_distractors")
    hhi = sum(s * s for s in shares)
    agree(hhi, float(np.sum(np.square(np.array(shares, dtype=float)))), 1e-9, "hhi")
    k, ds = val_opts(hhi, [("Adds the market shares (always 100) instead of squaring them.", 100), ("Squares the sum of the shares.", 100 * 100), ("Squares only the largest firm's share.", shares[0] ** 2), ("Uses the average of the squared shares.", hhi / n), ("Squares the shares but leaves out the smallest firm.", hhi - shares[-1] ** 2)], lambda v: nm(v, 0))
    stem = f"An industry has {n} firms with market shares of " + ", ".join(f"{s} percent" for s in shares[:-1]) + f", and {shares[-1]} percent. What is the Herfindahl-Hirschman Index (HHI) for the industry?"
    return mk("mi_hhi", "4.1", "1.C", stem, k, ds, rng, concept="Herfindahl-Hirschman Index", path="sum of squared shares (exact integers) vs numpy sum of squares", kwhy=f"HHI = {' + '.join(f'{s}^2' for s in shares)} = {hhi}.", facts=[f"shares={shares}", f"hhi={hhi}"], est=60)


@retry_sep
def mi_cr4(rng):
    shares = sorted(rng.sample(range(4, 30, 2), 6), reverse=True)
    tot = sum(shares)
    if tot > 100:
        raise ValueError("not_enough_separated_distractors")
    cr4 = sum(shares[:4])
    agree(cr4, float(sum(sorted(shares)[-4:])), 1e-9, "cr4")
    k, ds = val_opts(cr4, [("Adds the two largest firms only (a two-firm concentration ratio).", sum(shares[:2])), ("Adds the three largest firms.", sum(shares[:3])), ("Adds all six firms.", tot), ("Adds the four smallest firms instead of the four largest.", sum(shares[-4:])), ("Averages the four largest shares.", cr4 / 4)], lambda v: nm(v, 0) + " percent")
    stem = "An industry has six firms with market shares of " + ", ".join(f"{s} percent" for s in shares) + f". Together they account for {tot} percent of industry sales. What is the four-firm concentration ratio?"
    return mk("mi_cr4", "4.1", "1.C", stem, k, ds, rng, concept="four-firm concentration ratio", path="sum of the four largest shares vs numpy sort and slice", kwhy=f"The four largest shares sum to {cr4} percent.", facts=[f"shares={shares}", f"cr4={cr4}"], est=55)


# ======================= 4.2 독점 =======================
def mi_mr_demand(rng):
    k, ds = sent_opts("To sell more, a monopolist must lower the price on all units, so marginal revenue is less than price.", "Lowering the price to sell an extra unit also lowers the revenue on units that would have sold at the higher price, so MR < P.",
                      [("A monopolist can charge each customer a different price, so marginal revenue equals price.", "Describes perfect price discrimination, not the single-price monopolist assumed here."), ("A monopolist is a price taker, so marginal revenue equals price.", "A monopolist is a price maker, not a price taker."), ("Marginal revenue is greater than price because the monopolist faces no competition.", "Market power does not make marginal revenue exceed price."),
                       ("Marginal revenue is less than price because costs rise as output rises.", "Confuses the revenue side with the cost side; MR < P because of the downward-sloping demand curve."), ("Marginal revenue is negative at every output.", "Marginal revenue is positive at low output and negative only at high output.")])
    return mk("mi_mr_demand", "4.2", "2.A", "Why is marginal revenue less than price for a profit-maximizing monopolist that charges a single price to all customers?", k, ds, rng, concept="monopoly marginal revenue lies below demand", path="fixed vetted explanation; wrong sentences contradict the single-price downward-sloping-demand assumption", facts=["variant=1"], est=55)


@retry_sep
def mi_monopoly_numeric(rng):
    A = rng.choice([60, 80, 100, 120]); B = rng.choice([1, 2]); m = rng.choice([10, 20, 30])
    ref = _mono_exact({"A": A, "B": B, "m": m})
    Q = sp.symbols("Q")
    qs = float(sp.solve(sp.diff((A - B * Q) * Q - m * Q, Q), Q)[0])
    agree(float(Fr(ref["Q"])), qs, 1e-9, "Qm")
    Pm = A - B * qs; prof = (Pm - m) * qs
    which = rng.choice(["quantity", "price", "profit"])
    qc = (A - m) / B
    if qs != int(qs) or Pm != int(Pm):
        raise ValueError("not_enough_separated_distractors")
    agree(float(Fr(ref["P"])), Pm, 1e-9, "Pm")
    if which == "quantity":
        key_val = qs; label = "quantity"
        cands = [("Sets price equal to marginal cost, which gives the competitive quantity.", qc), ("Reports the price instead of the quantity.", Pm), ("Reads the quantity at which the price falls to zero.", A / B), ("Reads the quantity at which marginal revenue equals zero (the revenue-maximizing quantity).", A / (2 * B))]
        f = lambda v: nm(v, 0) + " units"  # noqa: E731
        kw = f"MR = {A} - {2 * B}Q equals MC = {m} at Q = {int(qs)}."
        q_text = "the profit-maximizing quantity"
    elif which == "price":
        key_val = Pm
        cands = [("Reports marginal cost as the price.", m), ("Reports the quantity instead of the price.", qs), ("Reports the demand intercept as the price.", A), ("Charges the price at the revenue-maximizing quantity (where marginal revenue is zero).", A / 2)]
        f = lambda v: usd(v)  # noqa: E731
        kw = f"MR = MC gives Q = {int(qs)}; the price comes from the demand curve: P = {A} - {B}({int(qs)}) = {usd(Pm)}."
        q_text = "the price the monopolist charges"
    else:
        key_val = prof
        cands = [("Uses total revenue as the profit.", Pm * qs), ("Reports the per-unit margin (price minus marginal cost) instead of multiplying by the quantity.", Pm - m), ("Multiplies the monopoly margin by the competitive quantity.", (Pm - m) * qc), ("Reports the deadweight loss instead of the profit.", 0.5 * (qc - qs) * (Pm - m)), ("Multiplies the monopoly price by the competitive quantity.", Pm * qc)]
        f = lambda v: usd(v)  # noqa: E731
        kw = f"Q = {int(qs)} and P = {usd(Pm)}; profit = ({usd(Pm)} - {usd(m)}) x {int(qs)} = {usd(prof)}."
        q_text = "the monopolist's economic profit"
    k, ds = val_opts(key_val, cands, f)
    stem = f"A monopolist faces the demand curve P = {A} - {B}Q, where P is the price in dollars and Q is the quantity. Its marginal cost is constant at {usd(m)} per unit, and it has no fixed cost. What is {q_text}?"
    return mk("mi_monopoly_numeric", "4.2", "3.C", stem, k, ds, rng, concept="monopoly profit maximization with linear demand and constant marginal cost", path="exact-fraction MR = MC module vs sympy derivative of profit", kwhy=kw, facts=[f"A={A}", f"B={B}", f"m={m}", f"Q={qs}", f"P={Pm}", f"profit={prof}", f"which={which}"], est=80)


@retry_sep
def mi_monopoly_graph(rng):
    A = rng.choice([80, 100, 120]); B = 1; m = rng.choice([20, 40])
    Qm = (A - m) / (2 * B); Pm = A - B * Qm
    Qc = (A - m) / B
    if Qm != int(Qm) or Pm % 10 != 0 or Qm % 10 != 0:
        raise ValueError("not_enough_separated_distractors")
    qmax = int(A / B)
    stim = econ_graph("A monopolist's demand curve D, marginal revenue curve MR, and constant marginal cost curve MC.", [("D", [(0, A), (A / B, 0)]), ("MR", [(0, A), (A / (2 * B), 0)]), ("MC", [(0, m), (qmax, m)])], qmax, A + 20, 10, 20)
    which = rng.choice(["price", "quantity"])
    if which == "price":
        key_val = Pm
        cands = [("Reads the price from the marginal cost curve at the profit-maximizing quantity.", m), ("Reports the demand intercept.", A), ("Reports the profit-maximizing quantity as the price.", Qm), ("Charges the price at the revenue-maximizing quantity (where marginal revenue is zero).", A / 2)]
        f = lambda v: usd(v)  # noqa: E731
        stem = "The graph shows the demand, marginal revenue, and marginal cost curves of a profit-maximizing monopolist. What price does the monopolist charge?"
        kw = f"MR crosses MC at {int(Qm)} units; the demand curve above that quantity gives the price {usd(Pm)}."
    else:
        key_val = Qm
        cands = [("Reads the quantity where the demand curve crosses marginal cost, the competitive quantity.", Qc), ("Reads the quantity at which marginal revenue equals zero, the revenue-maximizing quantity.", A / (2 * B)), ("Reports the price instead of the quantity.", Pm), ("Reports the horizontal intercept of demand.", A / B), ("Reports the marginal cost instead of the quantity.", m)]
        f = lambda v: nm(v, 0) + " units"  # noqa: E731
        stem = "The graph shows the demand, marginal revenue, and marginal cost curves of a profit-maximizing monopolist. What quantity does the monopolist produce?"
        kw = f"The monopolist produces where MR = MC, at {int(Qm)} units."
    # 독립 경로: 격자에서 MR=MC 교차점
    qq = np.arange(0, qmax, 0.5); cross = float(qq[int(np.argmin(np.abs((A - 2 * B * qq) - m)))])
    agree(cross, Qm, 1e-9, "mr_mc")
    cands = [c for c in cands if c[1] > 0 or True]
    k, ds = val_opts(key_val, cands, f)
    return mk("mi_monopoly_graph", "4.2", "3.A", stem, k, ds, rng, concept="read the monopoly outcome from MR, MC, and demand", path="analytic MR = MC intersection vs grid search for the crossing of the plotted lines", stim=stim, kwhy=kw, facts=[f"A={A}", f"m={m}", f"Qm={Qm}", f"Pm={Pm}", f"which={which}"], est=70)


@retry_sep
def mi_monopoly_dwl(rng):
    A = rng.choice([60, 80, 100, 120]); B = rng.choice([1, 2]); m = rng.choice([10, 20, 30])
    ref = _mono_exact({"A": A, "B": B, "m": m})
    qs, Pm = float(Fr(ref["Q"])), float(Fr(ref["P"])); qc = (A - m) / B
    dwl = 0.5 * (qc - qs) * (Pm - m)
    agree(dwl, float(Fr(ref["DWL"])), 1e-9, "dwl")
    if qs != int(qs) or Pm != int(Pm):
        raise ValueError("not_enough_separated_distractors")
    k, ds = val_opts(dwl, [("Omits the one-half in the triangle area (this also equals the monopolist's profit rectangle, a different measure).", (qc - qs) * (Pm - m)), ("Uses the whole demand triangle above marginal cost as the deadweight loss.", 0.5 * qc * (A - m)),
                          ("Uses the price instead of the price-cost gap as the height.", 0.5 * (qc - qs) * Pm), ("Reports the per-unit gap between price and marginal cost instead of an area.", Pm - m), ("Uses half of the monopolist's total revenue.", 0.5 * Pm * qs)], usd)
    stem = f"A monopolist faces the demand curve P = {A} - {B}Q and has constant marginal cost of {usd(m)} per unit. Relative to a perfectly competitive outcome with the same costs, what is the deadweight loss from monopoly?"
    return mk("mi_monopoly_dwl", "4.2", "3.C", stem, k, ds, rng, concept="deadweight loss of monopoly as a triangle", path="exact-fraction module (micro_checks.monopoly DWL) vs numeric integral of demand minus marginal cost over the lost quantity", kwhy=f"DWL = 1/2 x ({nm(qc)} - {nm(qs)}) x ({usd(Pm)} - {usd(m)}) = {usd(dwl)}.", facts=[f"A={A}", f"B={B}", f"m={m}", f"dwl={dwl}"], est=80)


def mi_monopoly_vs_pc(rng):
    k, ds = sent_opts("The monopolist produces a smaller quantity and charges a higher price.", "With MR below demand, the monopolist restricts output below the competitive level and charges a price above marginal cost.",
                      [("The monopolist produces a larger quantity and charges a lower price.", "Reverses the effect of market power on quantity and price."), ("The monopolist produces the same quantity and charges a higher price.", "Ignores that a monopolist restricts output to raise the price."), ("The monopolist produces a smaller quantity and charges the same price.", "Believes output restriction does not raise the price."),
                       ("The monopolist produces a larger quantity and charges a higher price.", "Combines a higher price with higher output, which contradicts the downward-sloping demand curve."), ("The monopolist produces where price equals marginal cost and earns zero economic profit.", "Describes the perfectly competitive outcome.")])
    return mk("mi_monopoly_vs_pc", "4.2", "2.B", "Compared with a perfectly competitive industry that has the same costs, a profit-maximizing single-price monopolist will", k, ds, rng, concept="monopoly versus perfect competition", path="fixed vetted comparison; verified by the exact MR = MC module showing Q_m < Q_c and P_m > MC", facts=["variant=1"], est=50)


# ======================= 4.3 가격 차별 =======================
def mi_pd_conditions(rng):
    k, ds = sent_opts("The firm has market power, can separate buyers by elasticity, and can prevent resale.", "Price discrimination needs market power, identifiable groups with different demand elasticities, and no resale between groups.",
                      [("The firm is a price taker in a perfectly competitive market with free entry.", "A price taker cannot set different prices; it takes the market price."), ("All customers have identical demand elasticities.", "If elasticities are identical there is no gain from charging different prices."), ("Customers can easily resell the product to each other.", "Resale would let low-price buyers undercut the higher-price market."),
                       ("The firm cannot tell customers apart and faces many close competitors.", "Without market power or the ability to separate groups, price discrimination is impossible."), ("Marginal cost differs sharply across the groups of customers served.", "Price discrimination refers to price differences not explained by cost differences.")])
    return mk("mi_pd_conditions", "4.3", "2.A", "Which of the following describes the conditions necessary for a firm to successfully practice price discrimination?", k, ds, rng, concept="conditions for price discrimination", path="fixed vetted conditions", facts=["variant=1"], est=50)


def mi_pd_perfect(rng):
    k, ds = sent_opts("Output equals the efficient quantity, deadweight loss is zero, and the firm captures all of the surplus.", "Charging each buyer their maximum willingness to pay makes marginal revenue equal to price, so the firm produces the efficient quantity and takes all consumer surplus.",
                      [("Output is below the efficient quantity, and deadweight loss is positive.", "Describes the single-price monopolist, not a perfect price discriminator."), ("Output equals the efficient quantity, and consumers keep all of the surplus.", "A perfect price discriminator charges each buyer their maximum willingness to pay, leaving no consumer surplus."), ("Output is above the efficient quantity, and deadweight loss is zero.", "Output cannot exceed the efficient quantity where price equals marginal cost."),
                       ("Output equals the efficient quantity, but deadweight loss is positive.", "At the efficient quantity there is no deadweight loss."), ("The firm earns zero economic profit because all consumers pay marginal cost.", "Buyers pay their willingness to pay, which exceeds marginal cost, so the firm earns profit.")])
    return mk("mi_pd_perfect", "4.3", "2.B", "Compared with a single-price monopolist, a perfectly price-discriminating monopolist with the same costs and demand will have which of the following outcomes?", k, ds, rng, concept="perfect price discrimination and efficiency", path="fixed vetted outcomes verified by the identity MR = P under perfect discrimination", facts=["variant=1"], est=55)


def mi_pd_markets(rng):
    e1 = rng.choice([0.5, 0.8]); e2 = rng.choice([2.0, 3.0])
    a_first = rng.random() < 0.5
    ea, eb = (e1, e2) if a_first else (e2, e1)
    hi = "A" if ea < eb else "B"; lo = "B" if hi == "A" else "A"
    agree(1, 1 if (ea < eb) == (hi == "A") else 0, 1e-9, "market")
    k, ds = sent_opts(f"Market {hi} should be charged the higher price, because its demand is less elastic.", "The profit-maximizing markup is larger where demand is less elastic, because buyers are less sensitive to the price.",
                      [(f"Market {lo} should be charged the higher price, because its demand is more elastic.", "Reverses the rule: the more elastic market should get the lower price."), ("The two markets should be charged the same price because marginal cost is the same.", "With different elasticities, equal prices do not maximize profit."), (f"Market {hi} should be charged the lower price, because its buyers are less sensitive to price.", "Reverses the implication of inelastic demand."),
                       (f"Market {lo} should be charged the lower price, because it has the larger total revenue.", "Uses total revenue rather than elasticity to set prices."), ("Both markets should be charged marginal cost.", "Charging marginal cost in both markets would forgo profit and is not the profit-maximizing price.")])
    stem = f"A firm with market power sells the same product in two separate markets and can prevent resale. In Market A the absolute value of the price elasticity of demand is {ea}, and in Market B it is {eb}. Marginal cost is the same in both markets. To maximize profit, which statement is correct?"
    return mk("mi_pd_markets", "4.3", "2.B", stem, k, ds, rng, concept="price discrimination across markets with different elasticities", path="elasticity comparison rule vs inverse-elasticity markup formula (P - MC)/P = 1/e", facts=[f"ea={ea}", f"eb={eb}", f"hi={hi}"], est=60)


# ======================= 4.4 독점적 경쟁 =======================
def mi_mc_short_long(rng):
    profit = rng.choice([True, False])
    if profit:
        k_t = "Firms enter, the demand for each existing firm falls, and economic profit falls to zero."
        wr = [("Firms exit, the demand for each remaining firm rises, and economic profit falls to zero.", "Reverses the direction of entry and exit."), ("Firms enter, the demand for each existing firm rises, and economic profit increases.", "Entry splits the market among more firms, which reduces the demand for each firm."), ("Firms enter until price equals marginal cost at the minimum of average total cost.", "Applies the perfectly competitive long-run condition; with downward-sloping demand, price equals ATC above its minimum."),
              ("No firms enter, because product differentiation creates barriers to entry.", "Product differentiation does not stop entry; barriers are low in monopolistic competition."), ("Economic profit persists in the long run because each firm has market power.", "Market power from differentiation does not prevent entry from eliminating profit.")]
        why = "Positive economic profit attracts entry, which shifts each firm's demand curve left until price equals average total cost and profit is zero."
        stem = "A firm in a monopolistically competitive market is earning positive economic profit in the short run. Which of the following describes the long-run adjustment?"
    else:
        k_t = "Firms exit, the demand for each remaining firm rises, and economic loss rises to zero."
        k_t = "Firms exit, the demand for each remaining firm rises, and economic profit rises to zero."
        wr = [("Firms enter, the demand for each firm falls, and economic profit rises to zero.", "Reverses the direction of entry and exit."), ("Firms exit, the demand for each remaining firm falls, and the losses increase.", "Exit leaves fewer firms, which raises the demand facing each remaining firm."), ("Firms exit until price equals marginal cost at the minimum of average total cost.", "Applies the perfectly competitive long-run condition; with downward-sloping demand, price equals ATC above its minimum."),
              ("No firms exit, because firms with market power cannot lose money.", "Market power does not guarantee profit; losses cause exit."), ("Economic losses persist in the long run because firms must keep producing.", "In the long run firms can exit, which eliminates losses.")]
        why = "Economic losses push firms out, which shifts each remaining firm's demand curve right until price equals average total cost and profit is zero."
        stem = "A firm in a monopolistically competitive market is earning an economic loss in the short run. Which of the following describes the long-run adjustment?"
    k, ds = sent_opts(k_t, why, wr)
    return mk("mi_mc_short_long", "4.4", "2.B", stem, k, ds, rng, concept="monopolistic competition adjustment to zero economic profit", path="fixed vetted adjustment table; direction checked against the demand-shift mechanism", facts=[f"profit={profit}"], est=60)


def mi_mc_excess_capacity(rng):
    k, ds = sent_opts("Price exceeds marginal cost, and the firm produces less than the output at the minimum of average total cost.", "In long-run monopolistic competition, price equals ATC on the downward-sloping part of ATC, so P > MC and output is below minimum-ATC output (excess capacity).",
                      [("Price equals marginal cost, and the firm produces at the minimum of average total cost.", "Describes perfect competition in the long run."), ("Price is less than marginal cost, and the firm produces more than the output at the minimum of average total cost.", "Price below marginal cost would not maximize profit."), ("Price exceeds marginal cost, and the firm earns positive economic profit.", "Free entry drives economic profit to zero in the long run."),
                       ("Price equals marginal revenue, and the firm is productively efficient.", "Price equals marginal revenue only for a price taker, and the firm is not producing at minimum ATC."), ("Price equals average total cost, and the firm is allocatively efficient.", "Price equals ATC but is above marginal cost, so allocative efficiency is not achieved.")])
    return mk("mi_mc_excess_capacity", "4.4", "1.D", "Which of the following is true of a monopolistically competitive firm in long-run equilibrium, in contrast to a perfectly competitive firm?", k, ds, rng, concept="monopolistic competition versus perfect competition", path="fixed vetted comparison; tangency of demand with ATC implies P > MC and output below minimum ATC", facts=["variant=1"], est=55)


# ======================= 4.5 게임 이론 =======================
def _matrix(rng, structure):
    hh = rng.choice([60, 70, 80]); ll = hh - rng.choice([15, 20, 25]); sucker = max(5, ll - rng.choice([10, 15])); temp = hh + rng.choice([15, 20, 30])
    if structure == "pd":
        return [[[hh, hh], [sucker, temp]], [[temp, sucker], [ll, ll]]]
    cs = rng.choice([0, 1]); e1, e2 = rng.choice([40, 45, 50]), rng.choice([35, 40, 45]); M = [[None, None], [None, None]]
    M[1][cs] = [e1, e2]; M[0][cs] = [e1 - 10, e2 - 15]; M[0][1 - cs] = [e1 + 10, e2 + 20]; M[1][1 - cs] = [e1 + 20, e2 - 10]
    return M


def _game_stim(M, ra, ca, labels, unit="millions of dollars of profit"):
    return {"kind": "payoff_matrix", "description": f"Payoff matrix for two firms, {ra} (rows) and {ca} (columns), each choosing between “{labels[0]}” and “{labels[1]}”. The firms choose simultaneously, once. Payoffs are profits in millions of dollars, listed as ({ra}, {ca}).",
            "data": {"row_player": ra, "col_player": ca, "row_strategies": labels, "col_strategies": labels, "payoff_units": unit, "payoffs": {f"{labels[r]},{labels[c]}": M[r][c] for r in range(2) for c in range(2)}, "format": f"({ra} payoff, {ca} payoff)"}}


@retry_sep
def mi_game_nash(rng):
    names = rng.choice([("Firm A", "Firm B", "keep the price", "cut the price"), ("Airline X", "Airline Y", "high fare", "low fare"), ("Company A", "Company B", "low output", "high output")])
    ra, ca, s1, s2 = names; labels = [s1, s2]
    M = _matrix(rng, rng.choice(["pd", "other"]))
    ex = _nash_exact({"payoffs": M})
    brute = [[r, c] for r in range(2) for c in range(2) if M[r][c][0] == max(M[0][c][0], M[1][c][0]) and M[r][c][1] == max(M[r][0][1], M[r][1][1])]
    if ex["nash"] != brute or len(brute) != 1:
        raise ValueError("not_enough_separated_distractors")
    r0, c0 = brute[0]
    cells = [(r, c) for r in range(2) for c in range(2)]
    txt = lambda r, c: f"{ra} plays \"{labels[r]}\" and {ca} plays \"{labels[c]}\"."  # noqa: E731
    why_other = {}
    for r, c in cells:
        if (r, c) == (r0, c0): continue
        if M[r][c][0] > M[r0][c0][0] and M[r][c][1] > M[r0][c0][1]:
            why_other[(r, c)] = "Chooses the outcome that gives both firms higher payoffs, but at least one firm can gain by switching, so it is not an equilibrium."
        elif M[r][c][0] + M[r][c][1] == max(sum(M[x][y]) for x, y in cells):
            why_other[(r, c)] = "Chooses the cell with the largest combined payoff, which is not what each firm does when choosing separately."
        elif r != r0 and c == c0:
            why_other[(r, c)] = f"{ra} could earn more by switching strategies, so this is not a best response."
        elif r == r0 and c != c0:
            why_other[(r, c)] = f"{ca} could earn more by switching strategies, so this is not a best response."
        else:
            why_other[(r, c)] = "Neither firm is playing a best response in this cell."
    k, ds = sent_opts(txt(r0, c0), "In this cell each firm's strategy is a best response to the other's, so neither firm can gain by switching.", [(txt(r, c), why_other[(r, c)]) for r, c in cells if (r, c) != (r0, c0)] + [(f"There is no Nash equilibrium in this game.", "Believes a game must have a mixed outcome; this game has a pure-strategy equilibrium.")])
    stem = f"The payoff matrix shows the profits of two firms that choose their strategies at the same time. Which of the following is the Nash equilibrium?"
    return mk("mi_game_nash", "4.5", "2.C", stem, k, ds, rng, concept="find the Nash equilibrium of a 2x2 game", path="best-response enumeration vs the independent Nash module (micro_checks.nash)", stim=_game_stim(M, ra, ca, labels), facts=[f"payoffs={M}", f"nash={brute}"], est=70)


@retry_sep
def mi_game_dominant(rng):
    names = rng.choice([("Firm A", "Firm B", "advertise", "not advertise"), ("Store X", "Store Y", "run a sale", "no sale")])
    ra, ca, s1, s2 = names; labels = [s1, s2]
    M = _matrix(rng, "pd")
    ex = _nash_exact({"payoffs": M})
    who = rng.choice(["row", "col"])
    dom = ex["dominant_row"] if who == "row" else ex["dominant_col"]
    if len(dom) != 1: raise ValueError("not_enough_separated_distractors")
    d = dom[0]
    player = ra if who == "row" else ca
    other_dom = labels[1 - d]
    k, ds = sent_opts(f"{player} has a dominant strategy: \"{labels[d]}\".", f"{labels[d]} gives {player} a higher payoff than {labels[1 - d]} whatever the rival chooses.",
                      [(f"{player} has a dominant strategy: \"{other_dom}\".", "Names the other strategy, which is dominated."), (f"{player} has no dominant strategy, because the best choice depends on what the rival does.", "Compares payoffs for only one rival choice; for both choices the same strategy pays more."), (f"{player} has a dominant strategy only if the other firm also has one.", "A dominant strategy is defined for one player regardless of what the other has."),
                       (f"Neither firm has a dominant strategy, because the cooperative outcome gives both firms more.", "Confuses the cooperative outcome with the dominant strategy; one strategy pays more regardless of the rival's choice."), (f"{player}'s dominant strategy is the one that gives the highest payoff in any single cell.", "Defines a dominant strategy by the best cell, not by the best response to every rival choice.")])
    stem = f"The payoff matrix shows the profits of two firms choosing simultaneously. Which statement about {player} is correct?"
    return mk("mi_game_dominant", "4.5", "3.A", stem, k, ds, rng, concept="identify a dominant strategy", path="comparison of payoffs against each rival strategy vs micro_checks.nash dominance lists", stim=_game_stim(M, ra, ca, labels), facts=[f"payoffs={M}", f"who={who}", f"dom={d}"], est=70)


def mi_cartel_cheat(rng):
    k, ds = sent_opts("Each member can earn more by producing extra output while the others keep to their quotas, so the agreement tends to break down.", "Each cartel member has an incentive to cheat: producing more raises its own profit while the rest restrict output, which makes the cartel unstable.",
                      [("The cartel earns less than a competitive industry, so members leave immediately.", "A cartel that holds together earns monopoly-like profit, more than competitive firms."), ("Demand for the cartel's product is perfectly elastic, so quotas have no effect.", "Cartel demand is downward sloping; quotas raise the price."), ("Each member earns the same profit whether or not it cheats, so cheating is irrelevant.", "Cheating raises the cheater's profit in the short run."),
                       ("Cartels are stable because each firm's best response is to keep its quota.", "The dominant strategy in the underlying game is to cheat, not to cooperate."), ("The government requires cartels to price at marginal cost.", "Cartels are generally illegal, but they are not required to price at marginal cost.")])
    return mk("mi_cartel_cheat", "4.5", "2.B", "Why are cartel agreements among oligopolists often unstable?", k, ds, rng, concept="incentive to cheat in a cartel", path="fixed vetted explanation tied to the prisoners'-dilemma payoff structure", facts=["variant=1"], est=50)


# ======================= 5 요소시장 =======================
def _mp_table(rng, P):
    mps = sorted(rng.sample([30, 26, 22, 18, 14, 10, 6], 5), reverse=True)
    tp = [0]
    for m in mps:
        tp.append(tp[-1] + m)
    return tp


@retry_sep
def mi_mrp_value(rng):
    P = rng.choice([2, 3, 4, 5]); tp = _mp_table(rng, P)
    n = rng.choice([2, 3, 4, 5])
    mrp = (tp[n] - tp[n - 1]) * P
    agree(mrp, float(sp.Integer(np.diff(tp)[n - 1]) * P), 1e-9, "mrp")
    stim = tbl(f"Total product of a firm that sells its output in a perfectly competitive market at {usd(P)} per unit.", ["Workers", "Total product"], [[i, tp[i]] for i in range(0, 6)])
    k, ds = val_opts(mrp, [("Reports the marginal product without multiplying by the output price.", tp[n] - tp[n - 1]), ("Multiplies the total product, instead of the marginal product, by the output price.", tp[n] * P), ("Uses the average product times the price.", tp[n] / n * P), ("Uses the marginal product of the previous worker times the price.", (tp[n - 1] - tp[n - 2]) * P if n >= 2 else 0.0),
                          ("Divides the marginal product by the price.", (tp[n] - tp[n - 1]) / P)], usd)
    stem = f"A firm sells its output in a perfectly competitive market at {usd(P)} per unit. The table shows its total product for different numbers of workers. What is the marginal revenue product of worker number {n}?"
    return mk("mi_mrp_value", "5.3", "1.C", stem, k, ds, rng, concept="marginal revenue product = marginal product x output price", path="difference of totals times price vs numpy diff", stim=stim, kwhy=f"MRP = ({tp[n]} - {tp[n - 1]}) x {usd(P)} = {usd(mrp)}.", facts=[f"P={P}", f"tp={tp}", f"n={n}", f"mrp={mrp}"], est=65)


@retry_sep
def mi_hire_table(rng):
    P = rng.choice([2, 3, 4]); tp = _mp_table(rng, P)
    mrps = [(tp[i] - tp[i - 1]) * P for i in range(1, 6)]
    tgt = rng.choice([2, 3, 4])
    w = (mrps[tgt - 1] + mrps[tgt]) // 2
    best = sum(1 for m in mrps if m >= w)
    # 독립 경로: 이윤 최대
    prof = [sum(mrps[:q]) - w * q for q in range(6)]
    best2 = max(range(6), key=lambda q: prof[q])
    if best != best2 or best in (0, 5) or prof.count(max(prof)) > 1:
        raise ValueError("not_enough_separated_distractors")
    stim = tbl(f"Total product when output sells for {usd(P)} per unit in a perfectly competitive market. The market wage is {usd(w)} per worker.", ["Workers", "Total product"], [[i, tp[i]] for i in range(0, 6)])
    stem = f"A firm sells its output at {usd(P)} per unit in a perfectly competitive market and hires workers in a perfectly competitive labor market at a wage of {usd(w)}. The table shows its total product. How many workers should the firm hire to maximize profit?"
    k, ds = val_opts(best, [("Hires the first worker only because the first worker has the highest marginal product.", 1), ("Hires one more worker than the profit-maximizing number, although that worker's marginal revenue product is below the wage.", best + 1), ("Hires the number of workers that maximizes total product regardless of the wage.", 5), ("Hires one fewer worker than the profit-maximizing number.", best - 1 if best > 1 else 0),
                          ("Hires no workers because the wage exceeds the average product.", 0)], lambda v: str(int(v)))
    return mk("mi_hire_table", "5.3", "2.C", stem, k, ds, rng, concept="hire labor until marginal revenue product equals the wage", path="count of workers with MRP at least the wage vs argmax of profit (sum of MRP minus wage bill)", stim=stim, kwhy=f"Hire while the marginal revenue product is at least the {usd(w)} wage: {best} workers.", facts=[f"P={P}", f"tp={tp}", f"w={w}", f"best={best}"], est=85)


def mi_factor_derived(rng):
    g = rng.choice(["pizza", "cars", "houses", "smartphones"])
    k, ds = sent_opts(f"The demand for labor used to produce {g} is a derived demand: it depends on the demand for {g}.", "Factor demand is derived from the demand for the output the factor helps produce.",
                      [(f"The demand for labor used to produce {g} is independent of the demand for {g}.", "Firms hire labor only to produce output, so factor demand depends on output demand."), (f"The demand for labor used to produce {g} depends only on the wage and not on the price of {g}.", "The marginal revenue product depends on the output price, so the output price matters."),
                       (f"The demand for labor is a derived demand, so it slopes upward with the wage.", "Labor demand slopes downward because marginal revenue product falls as more labor is hired."), (f"The demand for labor is determined by workers' preferences for leisure.", "Preferences for leisure affect labor supply, not labor demand."),
                       (f"The demand for {g} is derived from the demand for the labor used to produce {g}.", "Reverses the direction of derivation.")])
    return mk("mi_factor_derived", "5.1", "1.A", f"Which of the following statements about the demand for labor used to produce {g} is correct?", k, ds, rng, concept="derived demand for factors", path="fixed vetted statements; wrong sentences reverse the derivation or the slope", facts=[f"good={g}"], est=50)


LABOR_EVENTS = [("The price of the product the workers help produce rises.", +1, "demand", "marginal revenue product rises"), ("A technological advance raises each worker's productivity.", +1, "demand", "marginal product and marginal revenue product rise"), ("The price of the product the workers help produce falls.", -1, "demand", "marginal revenue product falls"),
                ("The number of qualified workers in the market increases because of immigration.", +1, "supply", "more workers are willing to work at each wage"), ("The wage in a similar occupation rises sharply.", -1, "supply", "some workers move to the other occupation"), ("Workers' training costs for this occupation rise.", -1, "supply", "fewer workers choose this occupation")]


def mi_labor_market_shift(rng):
    ev, d, side, why = LABOR_EVENTS[rng.randrange(len(LABOR_EVENTS))]
    ds_, ss_ = (d, 0) if side == "demand" else (0, d)
    key = eq_effect_rule(ds_, ss_)
    agree(1, 1 if eq_effect_sim(ds_, ss_) == key else 0, 1e-9, "labor_shift")
    cn, cx = ("demand", "supply") if side == "demand" else ("supply", "demand")
    models = [(eq_effect_rule(ss_, ds_), f"Shifts the labor {cx} curve instead of the labor {cn} curve."), (eq_effect_rule(-ds_, -ss_), f"Shifts the labor {cn} curve in the wrong direction."), ((key[0], -key[1]), "Reads the wage change as a movement along the curve and predicts the opposite employment change."),
              ((key[0], 0), "Predicts a wage change but no change in employment."), ((0, key[1]), "Predicts an employment change but no change in the wage.")]
    wr = []
    seen = {key}
    for c, w in models:
        if c in seen: continue
        seen.add(c); wr.append((f"The equilibrium wage {dir_word(c[0])}, and equilibrium employment {dir_word(c[1])}.", w))
    k, ds = sent_opts(f"The equilibrium wage {dir_word(key[0])}, and equilibrium employment {dir_word(key[1])}.", f"The event shifts labor {cn} ({why}); with labor {cx} unchanged, wage and employment move as the shift implies.", wr)
    stem = f"Consider a perfectly competitive labor market. The following event occurs: {ev} Which of the following describes the effect on the equilibrium wage and the equilibrium quantity of labor employed?"
    return mk("mi_labor_market_shift", "5.2", "3.A", stem, k, ds, rng, concept="labor demand and supply shifts", path="shift rule table vs numeric linear-market simulation", facts=[f"event={ev[:40]}", f"key={key}"], est=60)


@retry_sep
def mi_monopsony_numeric(rng):
    w0 = rng.choice([4, 6, 8]); s = rng.choice([1, 2]); r0 = rng.choice([30, 36, 40]); r1 = rng.choice([2, 3, 4])
    # 공급(임금) W = w0 + s L, MFC = w0 + 2 s L, MRP = r0 - r1 L
    Ls = Fr(r0 - w0, 2 * s + r1)
    if Ls != int(Ls) or not 2 <= Ls <= 5:
        raise ValueError("not_enough_separated_distractors")
    Ls = int(Ls); Wm = w0 + s * Ls
    Lc = Fr(r0 - w0, s + r1)
    L = sp.symbols("L")
    sol = float(sp.solve(sp.Eq(r0 - r1 * L, w0 + 2 * s * L), L)[0])
    agree(sol, Ls, 1e-9, "L_star")
    rows = [[l, usd(w0 + s * l), usd(w0 + 2 * s * l), usd(r0 - r1 * l)] for l in range(1, 7)]
    stim = tbl("A firm is the only employer of labor in a town. For each number of workers hired: the wage that must be paid to all workers, the marginal factor cost (MFC), and the marginal revenue product (MRP).", ["Workers", "Wage", "Marginal factor cost", "Marginal revenue product"], rows)
    key = Opt(f"The firm hires {Ls} workers and pays a wage of {usd(Wm)}.", True, f"It hires where MRP = MFC ({Ls} workers) and pays the wage on the labor supply curve at that quantity, {usd(Wm)}, which is below the MRP of {usd(r0 - r1 * Ls)}.", Ls)
    ds = []
    seen = {key.text}
    cands = [(f"The firm hires {Ls} workers and pays a wage of {usd(w0 + 2 * s * Ls)}.", "Pays the marginal factor cost instead of the wage on the supply curve."), (f"The firm hires {Ls} workers and pays a wage of {usd(r0 - r1 * Ls)}.", "Pays the marginal revenue product, although a monopsonist pays the supply-curve wage at the quantity hired."),
             (f"The firm hires {int(Lc)} workers and pays a wage of {usd(w0 + s * int(Lc))}." if Lc == int(Lc) and int(Lc) <= 6 else f"The firm hires {Ls + 1} workers and pays a wage of {usd(w0 + s * (Ls + 1))}.", "Hires where MRP equals the wage (the competitive rule) instead of where MRP equals MFC."),
             (f"The firm hires {Ls - 1} workers and pays a wage of {usd(w0 + s * (Ls - 1))}.", "Hires one worker fewer than the quantity where MRP equals MFC."), (f"The firm hires {Ls + 1} workers and pays a wage of {usd(w0 + s * (Ls + 1))}.", "Hires one more worker than the profit-maximizing quantity, past the point where MFC exceeds MRP."),
             (f"The firm hires {Ls + 2} workers and pays a wage of {usd(w0 + s * (Ls + 2))}.", "Hires two workers more than the profit-maximizing quantity.")]
    for t, w in cands:
        if t in seen: continue
        seen.add(t); ds.append(Opt(t, False, w, None))
    stem = "The table describes the labor market for a firm that is the only employer in a town (a monopsonist) and sells its output in a competitive market. To maximize profit, how many workers does the firm hire and what wage does it pay?"
    return mk("mi_monopsony_numeric", "5.4", "3.C", stem, key, ds, rng, concept="monopsony hiring where MRP = MFC with the wage from the supply curve", path="algebraic intersection of MRP and MFC (sympy) vs row-by-row scan of the table", stim=stim, facts=[f"w0={w0}", f"s={s}", f"r0={r0}", f"r1={r1}", f"L={Ls}", f"W={Wm}"], est=95)


def mi_monopsony_concept(rng):
    k, ds = sent_opts("A monopsonist hires fewer workers and pays a lower wage than a competitive labor market would.", "The monopsonist's marginal factor cost exceeds the wage, so it hires where MRP = MFC, a smaller quantity at a lower wage than in competition.",
                      [("A monopsonist hires more workers and pays a higher wage than a competitive labor market would.", "Reverses the effect of buyer power on employment and the wage."), ("A monopsonist hires fewer workers but pays a higher wage than a competitive labor market would.", "Buyer power lowers the wage; it does not raise it."), ("A monopsonist hires the same number of workers and pays the same wage as a competitive market.", "Ignores that marginal factor cost exceeds the wage for a monopsonist."),
                       ("A monopsonist hires workers until marginal revenue product equals the wage.", "That is the competitive hiring rule; a monopsonist hires where MRP equals MFC."), ("A monopsonist pays workers their marginal revenue product.", "A monopsonist pays a wage below MRP.")])
    return mk("mi_monopsony_concept", "5.4", "2.A", "Compared with a perfectly competitive labor market, a monopsonist in the labor market will", k, ds, rng, concept="monopsony employment and wage", path="fixed vetted outcomes verified by the numeric monopsony model (MFC above the supply curve)", facts=["variant=1"], est=50)


def mi_min_wage_monopsony(rng):
    k, ds = sent_opts("Employment could increase, because the minimum wage raises the wage and removes the monopsonist's incentive to hire fewer workers.", "A binding minimum wage between the monopsony wage and the competitive wage makes the marginal factor cost equal to the wage, so the firm hires more workers.",
                      [("Employment must fall, because any minimum wage reduces the quantity of labor demanded.", "Applies the competitive-market result to a monopsony."), ("Employment is unchanged, because the monopsonist already pays the minimum wage.", "A binding minimum wage exceeds the monopsony wage."), ("Employment falls because the monopsonist's marginal factor cost increases.", "A minimum wage below the competitive wage lowers the marginal factor cost over the relevant range, so employment can rise."),
                       ("Employment increases without limit, because the monopsonist's marginal revenue product is constant.", "Marginal revenue product eventually falls, so employment cannot rise without limit."), ("Employment increases only if the minimum wage exceeds the competitive wage.", "A minimum wage above the competitive wage would reduce employment.")])
    return mk("mi_min_wage_monopsony", "5.4", "2.B", "In a labor market with a single large employer (a monopsonist), a binding minimum wage set above the monopsony wage but below the competitive wage will have which of the following effects?", k, ds, rng, concept="minimum wage in a monopsony", path="fixed vetted outcome verified by the numeric monopsony model with a wage floor", facts=["variant=1"], est=60)


@retry_sep
def mi_least_cost(rng):
    mpl, w = rng.choice([(12, 4), (20, 5), (30, 10), (18, 6)]); mpk, r = rng.choice([(10, 5), (16, 4), (24, 8), (9, 3), (6, 3)])
    rl, rk = Fr(mpl, w), Fr(mpk, r)
    if rl == rk: raise ValueError("equal")
    agree(1.0 if rl > rk else 0.0, 1.0 if bool(sp.Rational(mpl, w) > sp.Rational(mpk, r)) else 0.0, 1e-9, "ratio")
    more, less = ("labor", "capital") if rl > rk else ("capital", "labor")
    k, ds = sent_opts(f"Use more {more} and less {less}, because {more} gives more extra output per dollar.", f"MPL/w = {mpl}/{w} = {float(rl):.2f} and MPK/r = {mpk}/{r} = {float(rk):.2f}; the input with the greater marginal product per dollar should be used more.",
                      [(f"Use more {less} and less {more}, because {less} has the lower price.", "Compares only input prices and ignores marginal products."), (f"Use more {less} and less {more}, because {less} has the lower marginal product per dollar.", "Reverses the least-cost rule."), (f"Make no change, because the firm is already producing efficiently.", "The firm is at least cost only if the marginal product per dollar is equal across inputs."),
                       (f"Use more of both inputs, because each has a positive marginal product.", "Ignores that the budget is fixed."), (f"Use more {more}, because {more} has the higher marginal product regardless of its price.", "Compares marginal products without adjusting for prices.")])
    stem = f"A firm uses labor and capital. At its current input mix, the marginal product of labor is {mpl} units and the wage is {usd(w)}; the marginal product of capital is {mpk} units and the price of capital is {usd(r)}. To produce its current output at least cost, what should the firm do?"
    return mk("mi_least_cost", "5.3", "2.C", stem, k, ds, rng, concept="least-cost input combination: equalize marginal product per dollar", path="exact ratio comparison vs sympy rational comparison", facts=[f"mpl={mpl}", f"w={w}", f"mpk={mpk}", f"r={r}", f"more={more}"], est=70)


def mi_factor_substitutes(rng):
    sub = rng.choice([True, False])
    if sub:
        stem = "Machines and workers are substitutes in production. If the price of machines falls, what is the most likely effect on the firm's demand for workers, ignoring any output effect?"
        k_t = "The demand for workers decreases, because the firm substitutes cheaper machines for workers."; why = "A cheaper substitute input reduces the demand for the other input through the substitution effect."
        wr = [("The demand for workers increases, because workers become more productive.", "Cheaper machines do not raise workers' marginal product when the inputs are substitutes."), ("The demand for workers does not change, because the wage has not changed.", "A change in another input's price shifts the demand for labor."), ("The quantity of workers demanded decreases along the labor demand curve.", "A change in the price of another input shifts the demand curve; it is not a movement along it."),
              ("The supply of workers decreases, because workers prefer to work with machines.", "Confuses a change in labor demand with a change in labor supply."), ("The demand for workers increases, because total output must fall.", "Reverses the substitution effect and invents an output change.")]
    else:
        stem = "Machines and workers are complements in production. If the price of machines falls, what is the most likely effect on the firm's demand for workers?"
        k_t = "The demand for workers increases, because the firm expands output and uses more of both inputs."; why = "A cheaper complementary input lowers costs and raises the marginal revenue product of the other input."
        wr = [("The demand for workers decreases, because the firm substitutes machines for workers.", "Applies the substitution effect to complementary inputs."), ("The demand for workers does not change, because the wage has not changed.", "A change in another input's price shifts the demand for labor."), ("The quantity of workers demanded increases along the labor demand curve.", "A change in the price of another input shifts the demand curve; it is not a movement along it."),
              ("The supply of workers increases, because workers prefer to work with machines.", "Confuses a change in labor demand with a change in labor supply."), ("The demand for workers decreases, because output must fall.", "Reverses the output effect for complementary inputs.")]
    k, ds = sent_opts(k_t, why, wr)
    return mk("mi_factor_substitutes", "5.2", "3.B", stem, k, ds, rng, concept="effect of another input's price on factor demand", path="substitute/complement rule table", facts=[f"sub={sub}"], est=55)


def mi_hire_rule(rng):
    mrp = rng.choice([18, 24, 30, 36]); w = mrp + rng.choice([-6, -4, 4, 6])
    more = mrp > w
    ans = "Hire more workers, because the marginal revenue product of the next worker exceeds the wage." if more else "Hire fewer workers, because the wage exceeds the marginal revenue product of the last worker."
    other = "Hire fewer workers, because the wage exceeds the marginal revenue product of the last worker." if more else "Hire more workers, because the marginal revenue product of the next worker exceeds the wage."
    k, ds = sent_opts(ans, f"A competitive firm hires labor until MRP equals the wage; here MRP is {usd(mrp)} and the wage is {usd(w)}, so it should adjust employment accordingly.", [(other, "Reverses the marginal hiring rule."), ("Keep employment unchanged, because both the wage and the marginal revenue product are positive.", "Positive values do not imply that profit is maximized; MRP must equal the wage."),
                                                                                                                                             ("Hire more workers, because the average product of labor is above the wage.", "Compares average product, not marginal revenue product, with the wage."), ("Hire fewer workers, because total revenue exceeds total cost.", "Compares totals instead of the marginal hiring rule."), ("Shut down, because the wage and MRP differ.", "Confuses a hiring adjustment with a shutdown decision.")])
    stem = f"A firm in perfectly competitive output and labor markets pays a wage of {usd(w)}. The marginal revenue product of its last worker is {usd(mrp)}. To maximize profit, what should the firm do?"
    return mk("mi_hire_rule", "5.3", "2.A", stem, k, ds, rng, concept="hire where marginal revenue product equals the wage", path="direct comparison of MRP and the wage vs sympy inequality", facts=[f"mrp={mrp}", f"w={w}", f"more={more}"], est=50)


# ======================= 6 시장 실패 =======================
def mi_neg_externality(rng):
    g = rng.choice(["steel", "paper", "chemicals"])
    k, ds = sent_opts(f"The market produces more than the socially optimal quantity of {g}, because the marginal social cost exceeds the marginal private cost.", "With a negative externality, producers ignore the external cost, so the market quantity exceeds the quantity where marginal social benefit equals marginal social cost.",
                      [(f"The market produces less than the socially optimal quantity of {g}, because the marginal social benefit exceeds the marginal private benefit.", "Describes a positive externality, not a negative one."), (f"The market produces the socially optimal quantity of {g}, because buyers and sellers voluntarily trade.", "Voluntary trade is efficient only without externalities."),
                       (f"The market produces more than the socially optimal quantity of {g}, because the marginal private cost exceeds the marginal social cost.", "Reverses the relationship between private and social cost."), (f"The market produces less than the socially optimal quantity of {g}, because producers pay the external cost.", "Producers do not pay the external cost; the third party does."),
                       (f"The market produces more than the socially optimal quantity of {g}, and the best policy is a subsidy to producers.", "A subsidy would increase output further; the efficient policy is a tax or regulation.")])
    stem = f"The production of {g} generates pollution that harms people who are not buyers or sellers of {g}. Which of the following is true?"
    return mk("mi_neg_externality", "6.2", "2.A", stem, k, ds, rng, concept="negative externality leads to overproduction", path="fixed vetted statements; direction verified by the numeric wedge model where MSC = MPC + external cost", facts=[f"good={g}"], est=55)


@retry_sep
def mi_pigou_numeric(rng):
    rows, qmkt, qeff = [], None, None
    mpb0 = rng.choice([60, 70, 80]); mpb_d = rng.choice([8, 10]); mpc0 = rng.choice([10, 20]); mpc_d = rng.choice([4, 5, 6]); mec0 = rng.choice([4, 6, 8]); mec_d = rng.choice([2, 4])
    table = []
    for q in range(1, 8):
        mpb = mpb0 - mpb_d * (q - 1); mpc = mpc0 + mpc_d * (q - 1); mec = mec0 + mec_d * (q - 1)
        table.append((q, mpb, mpc, mec))
    qmkt = max([q for q, mb, mc, me in table if mb > mc], default=0)
    qeff = max([q for q, mb, mc, me in table if mb > mc + me], default=0)
    if qmkt == 0 or qeff == 0 or qmkt <= qeff or qmkt >= 7:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 사회적 순편익 누적 최대
    cum = [0]
    for q, mb, mc, me in table:
        cum.append(cum[-1] + mb - mc - me)
    agree(qeff, max(range(len(cum)), key=lambda i: cum[i]), 1e-9, "q_eff")
    tax = table[qeff - 1][3]
    stim = tbl("Marginal private benefit (MPB), marginal private cost (MPC), and marginal external cost (MEC), in dollars, for each unit of a good.", ["Unit", "MPB", "MPC", "MEC"], [[q, usd(mb), usd(mc), usd(me)] for q, mb, mc, me in table])
    k, ds = val_opts(tax, [("Uses the marginal external cost at the market quantity instead of the efficient quantity.", table[qmkt - 1][3]), ("Uses the marginal external cost of the first unit.", table[0][3]), ("Uses the gap between marginal private benefit and cost at the market quantity.", table[qmkt - 1][1] - table[qmkt - 1][2]), ("Uses the total external cost at the efficient quantity.", sum(r[3] for r in table[:qeff])),
                          ("Uses marginal private cost at the efficient quantity.", table[qeff - 1][2])], usd)
    stem = "The table shows the marginal private benefit, marginal private cost, and marginal external cost of each unit of a good produced in a competitive market. The government sets a per-unit tax equal to the marginal external cost at the socially efficient quantity. What is the amount of this tax?"
    return mk("mi_pigou_numeric", "6.2", "3.C", stem, k, ds, rng, concept="Pigouvian tax equals marginal external cost at the efficient quantity", path="last unit with MPB >= MPC + MEC (exact) vs argmax of cumulative social net benefit", stim=stim, kwhy=f"The efficient quantity is {qeff} units, where MPB still covers MPC + MEC; the tax equals the MEC of that unit, {usd(tax)}.", facts=[f"table={table}", f"qmkt={qmkt}", f"qeff={qeff}", f"tax={tax}"], est=100)


def mi_pos_externality(rng):
    g = rng.choice(["vaccinations", "education", "beekeeping near orchards"])
    k, ds = sent_opts(f"The market produces less than the socially optimal quantity of {g}, and a subsidy could move the market toward the efficient quantity.", "With a positive externality, marginal social benefit exceeds marginal private benefit, so the market underproduces and a subsidy raises output toward the efficient level.",
                      [(f"The market produces more than the socially optimal quantity of {g}, and a tax could move the market toward the efficient quantity.", "Describes a negative externality."), (f"The market produces the socially optimal quantity of {g}, because private benefits equal social benefits.", "Private and social benefits differ when there is a positive externality."),
                       (f"The market produces less than the socially optimal quantity of {g}, and a tax would increase efficiency.", "A tax would reduce output further when the market already underproduces."), (f"The market produces more than the socially optimal quantity of {g}, because buyers ignore the external benefit.", "Ignoring a benefit leads to underproduction, not overproduction."),
                       (f"The market produces less than the socially optimal quantity of {g}, and a price ceiling would correct the problem.", "A price ceiling would reduce quantity and does not capture the external benefit.")])
    stem = f"The consumption of {g} provides benefits to people other than the buyers and sellers. Which of the following is true?"
    return mk("mi_pos_externality", "6.2", "3.A", stem, k, ds, rng, concept="positive externality leads to underproduction", path="fixed vetted statements; direction verified by the numeric wedge model where MSB = MPB + external benefit", facts=[f"good={g}"], est=55)


@retry_sep
def mi_ext_graph(rng):
    BD = rng.choice([1, 2]); step = 10
    Q0 = rng.choice([40, 50, 60]); P0 = rng.choice([40, 50, 60]); e = rng.choice([20, 40, 60]) if BD == 1 else rng.choice([40, 80])
    m = Mkt(Q0, P0, BD, BD)
    if m.C <= 0 or m.A > 150 or m.C != int(m.C) or m.A != int(m.A):
        raise ValueError("not_enough_separated_distractors")
    dq = e / (2 * BD)
    qeff = Q0 - dq
    if dq % 10 != 0 or qeff <= 0:
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 수치 탐색(사회적 순편익 최대)
    qq = np.arange(0, 2 * Q0, 1.0)
    net = np.cumsum((m.A - BD * qq) - (m.C + BD * qq + e))
    agree(float(qq[int(np.argmax(net))]), qeff, 1.0, "q_eff")
    qmax = int(math.ceil(m.A / BD / 10) * 10) if m.A / BD <= 120 else 120
    qmax = max(qmax, Q0 + 30); qmax = int(math.ceil(qmax / 10) * 10)
    ymax = int(math.ceil((m.A + 10) / 10) * 10)
    stim = econ_graph("A competitive market with a negative externality: demand curve D (marginal private benefit), supply curve S (marginal private cost), and marginal social cost curve MSC. Point E is the market equilibrium.",
                      [("D", [(0, m.A), (min(qmax, m.A / BD), max(0, m.A - BD * min(qmax, m.A / BD)))]), ("S", line_pts(m.C, BD, 0, qmax)), ("MSC", line_pts(m.C + e, BD, 0, qmax))], qmax, ymax, 10, 10, points=[("E", Q0, P0)])
    over = Q0 - qeff
    k, ds = val_opts(over, [("Reports the market equilibrium quantity instead of the overproduction.", Q0), ("Reports the efficient quantity instead of the overproduction.", qeff), ("Reports the vertical distance between S and MSC (the external cost per unit).", e), ("Reports twice the overproduction.", 2 * over), ("Reports half of the overproduction.", over / 2)], lambda v: nm(v, 0) + " units")
    stem = "The graph shows a market with a negative externality. By how many units does the market equilibrium quantity exceed the socially efficient quantity?"
    return mk("mi_ext_graph", "6.2", "3.C", stem, k, ds, rng, concept="overproduction with a negative externality read from a graph", path="analytic crossing of D and MSC vs numeric search for maximum social net benefit", stim=stim, kwhy=f"The efficient quantity is where D crosses MSC, at {nm(qeff, 0)} units, so the market overproduces by {nm(over, 0)} units.", facts=[f"A={m.A}", f"C={m.C}", f"BD={BD}", f"Q0={Q0}", f"P0={P0}", f"e={e}", f"qeff={qeff}"], est=85)


PG = [("a lighthouse that guides all ships passing through a harbor", "public good", "non-rival and non-excludable"), ("a pizza sold at a restaurant", "private good", "rival and excludable"), ("a crowded public fishing lake with no fees", "common resource", "rival and non-excludable"), ("a gated swimming club with a membership fee and room for more members", "club good", "non-rival and excludable")]


def mi_public_good(rng):
    desc, ans, feat = PG[rng.randrange(4)]
    others = [p[1] for p in PG if p[1] != ans] + ["natural monopoly"]
    why = {"public good": "Treats a good that is non-rival and non-excludable as one of the other categories.", "private good": "Treats a rival and excludable good as non-rival or non-excludable.", "common resource": "Treats a rival, non-excludable good as one that is non-rival.", "club good": "Treats a non-rival, excludable good as a good that is non-excludable or rival.", "natural monopoly": "Confuses a classification by rivalry and excludability with a market structure."}
    k, ds = sent_opts(ans[0].upper() + ans[1:], f"The good is {feat}, which defines a {ans}.", [(o[0].upper() + o[1:], why[o]) for o in others])
    return mk("mi_public_good", "6.3", "1.B", f"Consider {desc}. Which type of good is this?", k, ds, rng, concept="classify goods by rivalry and excludability", path="fixed vetted classification table", facts=[f"ans={ans}"], est=45)


def mi_free_rider(rng):
    k, ds = sent_opts("People can use it without paying, so firms cannot earn enough revenue to supply it.", "Non-excludability creates a free-rider problem: people have no incentive to pay, so the market underprovides the public good.",
                      [("Public goods are rival, so private firms provide too much of them in practice.", "Public goods are non-rival, and the problem is underprovision."), ("Public goods have no social benefit, so no one wants them.", "Public goods usually have large social benefits."), ("The marginal cost of serving one more user is high, so firms avoid providing it.", "Public goods have near-zero marginal cost of serving another user."),
                       ("Governments always provide public goods at zero cost to taxpayers.", "Governments finance public goods through taxes; they are not costless."), ("Consumers value public goods less than they value private goods.", "Valuation is not the reason; the inability to exclude non-payers is the reason.")])
    return mk("mi_free_rider", "6.3", "2.B", "Why does a competitive market tend to provide too little of a pure public good?", k, ds, rng, concept="free-rider problem", path="fixed vetted explanation", facts=["variant=1"], est=50)


@retry_sep
def mi_msb_msc_table(rng):
    msb = sorted(rng.sample(range(10, 60, 4), 6), reverse=True); msc = sorted(rng.sample(range(6, 40, 3), 6))
    opt = max([i + 1 for i in range(6) if msb[i] > msc[i]], default=0)
    if opt in (0, 6) or any(msb[i] == msc[i] for i in range(6)):
        raise ValueError("not_enough_separated_distractors")
    cum = [sum(msb[:q]) - sum(msc[:q]) for q in range(7)]
    agree(opt, max(range(7), key=lambda i: cum[i]), 1e-9, "opt")
    stim = tbl("Marginal social benefit (MSB) and marginal social cost (MSC), in dollars, of each additional unit of an activity.", ["Unit", "MSB", "MSC"], [[i + 1, usd(msb[i]), usd(msc[i])] for i in range(6)])
    k, ds = val_opts(opt, [("Chooses the first unit only.", 1), ("Chooses one more unit than the efficient quantity, where marginal social cost exceeds marginal social benefit.", opt + 1), ("Chooses the largest quantity shown.", 6), ("Chooses one unit fewer than the efficient quantity.", max(opt - 1, 0)), ("Chooses zero units because the total cost is larger than the first unit's benefit.", 0)], lambda v: str(int(v)))
    return mk("mi_msb_msc_table", "6.1", "2.C", "The table shows the marginal social benefit and marginal social cost of an activity. What quantity is socially efficient?", k, ds, rng, concept="efficient quantity where marginal social benefit equals marginal social cost", path="last unit with MSB above MSC vs argmax of cumulative social net benefit", stim=stim, kwhy=f"Unit {opt} is the last unit whose marginal social benefit exceeds its marginal social cost.", facts=[f"msb={msb}", f"msc={msc}", f"opt={opt}"], est=65)


def mi_lorenz_gini(rng):
    k, ds = sent_opts("The farther the Lorenz curve is below the line of equality, the larger the Gini coefficient.", "The Gini coefficient is the ratio of the area between the line of equality and the Lorenz curve to the area under the line, so a bigger gap means more inequality.",
                      [("The closer the Lorenz curve is to the line of equality, the larger the Gini coefficient.", "Reverses the interpretation; the line of equality represents perfect equality."), ("A Gini coefficient of 1 indicates perfect equality.", "A Gini coefficient of 0 indicates perfect equality and 1 indicates perfect inequality."), ("The Lorenz curve is above the line of equality when income is unequally distributed.", "The Lorenz curve never lies above the line of equality."),
                       ("The Gini coefficient measures the average income of households in a country.", "The Gini coefficient measures the dispersion of income, not its average."), ("A Gini coefficient of 0 indicates that one person receives all of the income.", "A Gini coefficient of 0 means perfect equality.")])
    return mk("mi_lorenz_gini", "6.5", "1.A", "Which of the following correctly describes the Lorenz curve and the Gini coefficient?", k, ds, rng, concept="Lorenz curve and Gini coefficient", path="fixed vetted statements", facts=["variant=1"], est=50)


@retry_sep
def mi_tax_progressive(rng):
    kind = rng.choice(["progressive", "regressive", "proportional"])
    incs = [20000, 40000, 80000]
    if kind == "proportional":
        rate = rng.choice([8, 10, 12]); taxes = [i * rate // 100 for i in incs]
    elif kind == "progressive":
        taxes = [int(i * r / 100) for i, r in zip(incs, rng.choice([(5, 10, 18), (4, 9, 15), (6, 12, 20)]))]
    else:
        taxes = [int(i * r / 100) for i, r in zip(incs, rng.choice([(12, 8, 5), (10, 7, 4), (9, 6, 3)]))]
    rates = [Fr(t, i) for t, i in zip(taxes, incs)]
    got = "progressive" if rates[0] < rates[1] < rates[2] else "regressive" if rates[0] > rates[1] > rates[2] else "proportional" if rates[0] == rates[1] == rates[2] else "other"
    agree(1, 1 if got == kind else 0, 1e-9, "tax_kind")
    stim = tbl("Annual tax paid at three income levels under a tax.", ["Income", "Tax paid"], [[usd(i), usd(t)] for i, t in zip(incs, taxes)])
    full = {"progressive": "A progressive tax, because the percentage of income paid in tax rises as income rises.", "regressive": "A regressive tax, because the percentage of income paid in tax falls as income rises.", "proportional": "A proportional tax, because the percentage of income paid in tax is the same at every income level."}
    whys = {"progressive": "Labels the tax progressive when the tax rate does not rise with income; the tax paid in dollars rises but the percentage does not.", "regressive": "Labels the tax regressive when the tax rate does not fall with income.", "proportional": "Labels the tax proportional although the percentage of income paid changes."}
    wr = [(full[o], whys[o]) for o in full if o != kind] + [("A lump-sum tax, because every taxpayer pays the same amount.", "Taxes paid differ across incomes, so this is not a lump-sum tax."), ("A progressive tax, because high-income taxpayers pay more dollars of tax.", "Confuses dollars of tax paid with the share of income paid as tax.")]
    wr = [w for w in wr if w[0] != full[kind]]
    k, ds = sent_opts(full[kind], f"The tax rates are {', '.join(f'{float(r) * 100:.1f}%' for r in rates)} at the three incomes, which defines a {kind} tax.", wr)
    return mk("mi_tax_progressive", "6.5", "1.C", "The table shows the tax paid at three income levels. Which type of tax does it represent?", k, ds, rng, concept="classify a tax by how the tax rate changes with income", path="exact tax-rate fractions compared across incomes vs sympy ordering", stim=stim, facts=[f"taxes={taxes}", f"kind={kind}"], est=60)


def mi_natural_monopoly(rng):
    k, ds = sent_opts("Setting the price equal to average total cost removes the firm's economic profit, but output is still below the efficient quantity.", "At P = ATC the firm earns zero economic profit, but price exceeds marginal cost, so output is below the allocatively efficient level.",
                      [("Setting the price equal to marginal cost gives the efficient output, and the firm earns positive economic profit.", "For a natural monopoly ATC exceeds MC, so P = MC causes a loss."), ("Setting the price equal to marginal cost gives the efficient output, but the firm incurs an economic loss.", "A price at marginal cost is below ATC for a natural monopoly, so the firm loses money, which is why this answer is the opposite statement of a profitable outcome."),
                       ("Setting the price equal to average total cost gives the efficient output.", "At P = ATC price exceeds marginal cost, so output is below the efficient quantity."), ("Setting the price equal to marginal revenue maximizes social surplus.", "P = MR is the unregulated monopoly outcome, which is not socially optimal."), ("Setting the price above the unregulated monopoly price raises output.", "A higher price lowers quantity demanded.")])
    # 두 번째 문장 정정: 정답 외 선택지가 모호하지 않도록 정의 수정
    ds[1].text = "Setting the price equal to marginal cost gives the efficient output, and the firm earns zero economic profit."; ds[1].why = "Believes marginal-cost pricing leaves the natural monopoly with zero profit; ATC exceeds MC, so it incurs a loss."
    return mk("mi_natural_monopoly", "6.4", "3.A", "A government regulates a natural monopoly whose average total cost is above its marginal cost at the relevant output. Which of the following correctly describes a regulated price?", k, ds, rng, concept="regulating a natural monopoly: marginal-cost versus average-cost pricing", path="fixed vetted regulatory outcomes verified with the cost relationship ATC > MC for decreasing average cost", facts=["variant=1"], est=60)
