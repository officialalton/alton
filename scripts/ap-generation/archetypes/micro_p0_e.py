"""AP Microeconomics P0 원형 E — 그래프 읽기 보강(세금·수요 이동·가격 하한·비용 곡선·독점적 경쟁·독점 구매자·로렌츠·양의 외부효과·탄력성)과 단원 1·5·6 보강. 2026-10-13."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401


def _sym_mkt(rng, s, qs, ps, need_c=True):
    """대칭 기울기(B = D = s) 시장: Q0, P0 가 격자(10)에 맞고 절편이 양수."""
    for _ in forever():
        Q0 = rng.choice(qs); P0 = rng.choice(ps)
        m = Mkt(Q0, P0, Fr(s), Fr(s))
        if m.C > 0 and m.A == int(m.A) and m.C == int(m.C):
            m.A, m.C = int(m.A), int(m.C)
            return m


# ======================= 세금 그래프 읽기 =======================
@retry_sep
def mi_tax_graph_read(rng):
    s = rng.choice([1, 2]); t = rng.choice([20, 40])
    m = _sym_mkt(rng, s, [30, 40, 50] if s == 1 else [20, 25, 30], [50, 60, 70])
    Qt = m.Q0 - t / (2 * s); Pb = m.P0 + t / 2; Ps = m.P0 - t / 2
    if Qt <= 0 or Qt != int(Qt): raise ValueError("not_enough_separated_distractors")
    qq, pp = mkt_check(m, tax=t)
    agree(float(qq), Qt, 1e-9, "Qt"); agree(float(pp), Pb, 1e-9, "Pb")
    which = rng.choice(["revenue", "dwl", "share"])
    qmax = int(math.ceil((m.A / s) / 10) * 10); qmax = min(qmax, 140); qmax = max(qmax, int(m.Q0) + 20); qmax = int(math.ceil(qmax / 10) * 10)
    xstep = 10 if s == 1 else 5
    ymax = int(math.ceil((m.A + 10) / 10) * 10)
    stim = econ_graph("A competitive market before and after a per-unit tax on sellers. D is demand, S is the original supply curve, and S2 is the supply curve after the tax. Point E is the original equilibrium; F and G are marked at the new quantity.",
                      [("D", line_pts(m.A, -s, 0, min(qmax, m.A / s))), ("S", line_pts(m.C, s, 0, qmax)), ("S2", line_pts(m.C + t, s, 0, qmax))], qmax, ymax, xstep, 10, points=[("E", m.Q0, m.P0), ("F", Qt, Pb), ("G", Qt, Ps)])
    f = lambda v: usd(v)  # noqa: E731
    if which == "revenue":
        key = t * Qt
        cands = [("Uses the original equilibrium quantity instead of the quantity after the tax.", t * m.Q0), ("Uses one-half of the tax times the new quantity, as if revenue were a triangle.", 0.5 * t * Qt), ("Multiplies the price buyers pay by the new quantity, which is total spending.", Pb * Qt), ("Multiplies the price sellers receive by the new quantity.", Ps * Qt),
                 ("Multiplies the rise in the buyers' price by the new quantity.", (Pb - m.P0) * Qt)]
        stem = "The graph shows a market before and after a per-unit tax on sellers. What is the total tax revenue collected by the government?"
        kw = f"Revenue = tax per unit x quantity sold = {usd(t)} x {int(Qt)} = {usd(key)}."
    elif which == "dwl":
        key = 0.5 * t * (m.Q0 - Qt)
        cands = [("Omits the one-half in the triangle area.", t * (m.Q0 - Qt)), ("Uses the tax revenue rectangle instead of the deadweight-loss triangle.", t * Qt), ("Uses the new quantity instead of the lost quantity as the base.", 0.5 * t * Qt), ("Uses the price change of buyers instead of the whole tax as the height.", 0.5 * (Pb - m.P0) * (m.Q0 - Qt)),
                 ("Uses the original equilibrium price times the lost quantity.", 0.5 * m.P0 * (m.Q0 - Qt))]
        stem = "The graph shows a market before and after a per-unit tax on sellers. What is the deadweight loss caused by the tax?"
        kw = f"Deadweight loss = 1/2 x {usd(t)} x ({int(m.Q0)} - {int(Qt)}) = {usd(key)}."
    else:
        key = (Pb - m.P0) * Qt
        cands = [("Uses the sellers' share instead of the buyers' share of the tax.", (m.P0 - Ps) * Qt), ("Uses the whole tax revenue as the buyers' share.", t * Qt), ("Uses the price buyers pay times the new quantity.", Pb * Qt), ("Uses the rise in the buyers' price times the original quantity.", (Pb - m.P0) * m.Q0),
                 ("Uses the rise in the buyers' price as the total.", Pb - m.P0)]
        stem = "The graph shows a market before and after a per-unit tax on sellers. How much of the tax revenue is paid by buyers through a higher price?"
        kw = f"Buyers' price rises from {usd(m.P0)} to {usd(Pb)}, so buyers pay {usd(Pb - m.P0)} x {int(Qt)} = {usd(key)} of the revenue."
    k, ds = val_opts(key, cands, f)
    return mk("mi_tax_graph_read", "2.8", "3.C", stem, k, ds, rng, concept="tax revenue, deadweight loss, and incidence read from a graph", path="areas from exact marker coordinates vs sympy equilibrium solution with the tax", stim=stim, kwhy=kw, facts=[f"s={s}", f"t={t}", f"Q0={m.Q0}", f"P0={m.P0}", f"Qt={Qt}", f"Pb={Pb}", f"which={which}"], est=85)


# ======================= 수요 이동 그래프 =======================
@retry_sep
def mi_demand_shift_graph(rng):
    m = _sym_mkt(rng, 1, [30, 40, 50], [50, 60, 70])
    dQ = rng.choice([20, 40]); right = rng.choice([True, False])
    sgn = 1 if right else -1
    Q2, P2 = m.Q0 + sgn * dQ / 2, m.P0 + sgn * dQ / 2
    q_, p_ = mkt_check(m, dA=sgn * dQ)
    agree(float(q_), Q2, 1e-9, "Q2"); agree(float(p_), P2, 1e-9, "P2")
    if Q2 <= 0 or P2 <= 0: raise ValueError("not_enough_separated_distractors")
    A2 = m.A + sgn * dQ
    qmax = int(math.ceil(max(m.A, A2) / 10) * 10); qmax = min(qmax, 140); qmax = int(math.ceil(max(qmax, m.Q0 + 40) / 10) * 10)
    ymax = int(math.ceil((max(m.A, A2) + 10) / 10) * 10)
    stim = econ_graph("A competitive market. Demand shifts from D1 to D2; S is the supply curve. Point A is the original equilibrium and point B is the new equilibrium.",
                      [("D1", line_pts(m.A, -1, 0, min(qmax, m.A))), ("D2", line_pts(A2, -1, 0, min(qmax, A2))), ("S", line_pts(m.C, 1, 0, qmax))], qmax, ymax, 10, 10, points=[("A", m.Q0, m.P0), ("B", Q2, P2)])
    w = "rises" if right else "falls"
    t = lambda p, q: f"The equilibrium price {w if p != m.P0 else 'does not change'} to {usd(p)}, and the equilibrium quantity {w if q != m.Q0 else 'does not change'} to {nm(q, 0)} units."  # noqa: E731
    t = lambda p, q, wp=w, wq=w: f"The equilibrium price {wp + ' to' if wp != 'stays at' else wp} {usd(p)}, and the equilibrium quantity {wq + ' to' if wq != 'stays at' else wq} {nm(q, 0)} units."  # noqa: E731
    opp = "falls" if right else "rises"
    key = Opt(t(P2, Q2), True, f"The new demand curve D2 crosses S at point B: price {usd(P2)} and quantity {nm(Q2, 0)}, so both change in the same direction as the shift.", None)
    cands = [(t(m.P0, m.Q0 + sgn * dQ, "does not change" if False else "stays at", wq=w), f"Reads the horizontal shift of demand at the old price as the new quantity, ignoring that the price adjusts."), (t(P2, m.Q0, wp=w, wq="stays at"), "Moves the price but leaves the quantity unchanged, ignoring the movement along the supply curve."),
             (t(m.P0 + sgn * dQ, m.Q0 + sgn * dQ / 2, wp=w, wq=w), "Uses the full vertical distance between the demand curves as the price change."), (t(m.P0 - sgn * dQ / 2, m.Q0 + sgn * dQ / 2, wp=opp, wq=w), "Reverses the direction of the price change while moving the quantity the right way."),
             (t(m.P0 + sgn * dQ / 2, m.Q0 - sgn * dQ / 2, wp=w, wq=opp), "Applies the law of demand backward: predicts quantity moves opposite to the demand shift.")]
    ds, seen = [], {key.text}
    for tx, why in cands:
        if tx in seen: continue
        seen.add(tx); ds.append(Opt(tx, False, why, None))
    stem = "The graph shows a shift in the demand for a good in a competitive market. Which of the following correctly describes the new equilibrium price and quantity?"
    return mk("mi_demand_shift_graph", "2.7", "3.A", stem, key, ds, rng, concept="read the new equilibrium after a demand shift from the graph", path="intersection of the shifted line with supply (exact) vs sympy solve", stim=stim, facts=[f"Q0={m.Q0}", f"P0={m.P0}", f"dQ={dQ}", f"right={right}", f"Q2={Q2}", f"P2={P2}"], est=75)


# ======================= 가격 하한의 후생 손실 그래프 =======================
@retry_sep
def mi_dwl_floor_graph(rng):
    s = rng.choice([1, 2]); k = rng.choice([1, 2])
    m = _sym_mkt(rng, s, [40, 50, 60] if s == 1 else [20, 25, 30], [50, 60, 70])
    step_q = 10 if s == 1 else 5
    dp = 10 * k
    Pf, Qf, Ps = m.P0 + dp, m.Q0 - dp / s, m.P0 - dp
    if Qf <= 0 or Ps <= m.C or Qf != int(Qf): raise ValueError("not_enough_separated_distractors")
    dwl = 0.5 * (m.Q0 - Qf) * (Pf - Ps)
    qq = np.linspace(Qf, m.Q0, 20001); agree(dwl, float(np.trapezoid((m.A - s * qq) - (m.C + s * qq), qq)), 1e-6, "dwl")
    qmax = int(math.ceil((m.A / s) / 10) * 10); qmax = min(qmax, 140); qmax = int(math.ceil(max(qmax, m.Q0 + 20) / 10) * 10)
    ymax = int(math.ceil((m.A + 10) / 10) * 10)
    stim = econ_graph("A competitive market with demand D, supply S, and a binding price floor. Point E is the original equilibrium; points F and G are marked at the quantity traded under the floor.",
                      [("D", line_pts(m.A, -s, 0, min(qmax, m.A / s))), ("S", line_pts(m.C, s, 0, qmax)), ("Floor", [(0, Pf), (qmax, Pf)])], qmax, ymax, step_q, 10, points=[("E", m.Q0, m.P0), ("F", Qf, Pf), ("G", Qf, Ps)])
    f = lambda v: usd(v)  # noqa: E731
    cs_loss = 0.5 * (m.Q0 - Qf) * (Pf - m.P0)
    cands = [("Omits the one-half in the triangle area.", (m.Q0 - Qf) * (Pf - Ps)), ("Uses the height from the equilibrium price to the floor only.", 0.5 * (m.Q0 - Qf) * (Pf - m.P0)), ("Uses the whole surplus triangle at the floor quantity.", 0.5 * Qf * (Pf - Ps)),
             ("Uses the surplus created for producers instead of the deadweight loss.", (Pf - m.P0) * Qf), ("Uses the lost quantity times the equilibrium price.", (m.Q0 - Qf) * m.P0)]
    k_, ds = val_opts(dwl, cands, f)
    stem = "The graph shows a market with a binding price floor. What is the deadweight loss caused by the price floor?"
    return mk("mi_dwl_floor_graph", "2.8", "3.C", stem, k_, ds, rng, concept="deadweight loss of a price floor as a triangle between demand and supply prices", path="triangle from exact coordinates vs numerical integration of the gap between demand and supply", stim=stim, kwhy=f"The traded quantity falls from {int(m.Q0)} to {int(Qf)}; DWL = 1/2 x ({int(m.Q0)} - {int(Qf)}) x ({usd(Pf)} - {usd(Ps)}) = {usd(dwl)}.",
              facts=[f"s={s}", f"k={k}", f"Q0={m.Q0}", f"P0={m.P0}", f"Pf={Pf}", f"Qf={Qf}", f"Ps={Ps}", f"dwl={dwl}"], est=85)


# ======================= 비용 곡선 관계 그래프 =======================
def mi_cost_curve_relation_graph(rng):
    k0 = rng.choice([20, 30]); a = rng.choice([10, 20]); F = k0 * k0
    mc = lambda q: a + 2 * q  # noqa: E731
    atc = lambda q: F / q + a + q  # noqa: E731
    qa, qb, qc = k0 / 2, k0, 2 * k0
    which = rng.choice(["A", "C"])
    q = qa if which == "A" else qc
    # 독립 경로: ATC 의 수치 미분 부호
    d = (atc(q + 1e-4) - atc(q - 1e-4)) / 2e-4
    falling = mc(q) < atc(q)
    agree(1 if d < 0 else 0, 1 if falling else 0, 1e-9, "atc_slope")
    qmax = 4 * k0; ymax = int(math.ceil((mc(qmax) + 10) / 20) * 20); q0 = max(k0 / 2, 4.0)
    stim = econ_graph("Short-run cost curves for a firm: marginal cost MC, average total cost ATC, and average variable cost AVC. Points A, B, and C are marked on the MC curve.", [("MC", line_pts(a, 2, 0, qmax)), ("ATC", dense_pts(atc, q0, qmax, 45)), ("AVC", line_pts(a, 1, 0, qmax))], qmax, ymax, 10, 20, ylabel="Cost (dollars per unit)",
                      points=[("A", qa, mc(qa)), ("B", qb, mc(qb)), ("C", qc, mc(qc))])
    rel = "below" if falling else "above"; dirw = "falling" if falling else "rising"
    stem = f"The graph shows a firm's short-run cost curves. Which of the following is true at point {which}?"
    k, ds = sent_opts(f"Marginal cost is {rel} average total cost, so average total cost is {dirw}.", f"At point {which} marginal cost is {rel} ATC, which pulls the average {'down' if falling else 'up'}.",
                      [(f"Marginal cost is {'above' if falling else 'below'} average total cost, so average total cost is {'rising' if falling else 'falling'}.", "Reverses the relationship between marginal cost and the average."), (f"Marginal cost equals average total cost, so average total cost is at its minimum.", "Marginal cost equals ATC only at the minimum of ATC, which is point B."),
                       (f"Average variable cost is above average total cost, because variable cost is part of total cost.", "AVC is always below ATC; the gap is average fixed cost."), (f"Marginal cost is {rel} average total cost, so average total cost is {'rising' if falling else 'falling'}.", "States the correct position of MC but the wrong effect on the average."),
                       (f"Average fixed cost is rising, because output is {'low' if falling else 'high'}.", "Average fixed cost falls continuously as output rises.")])
    return mk("mi_cost_curve_relation_graph", "3.2", "2.A", stem, k, ds, rng, concept="marginal cost above or below ATC determines whether ATC rises or falls", path="comparison of MC and ATC at the marker vs the sign of the numerical derivative of ATC", stim=stim, facts=[f"k0={k0}", f"a={a}", f"which={which}", f"falling={falling}"], est=65)


# ======================= 독점적 경쟁 장기 균형 그래프 =======================
@retry_sep
def mi_mc_graph_longrun(rng):
    Qs = rng.choice([20, 30]); B = rng.choice([1, 2]); c = rng.choice([20, 30])
    A = c + 2 * B * Qs; Ps = c + B * Qs; F = B * Qs * Qs
    # 독립 경로: D 와 ATC 의 차이가 q = Qs 에서 최대 0(접점)
    qq = np.arange(5, A / B - 1, 0.5); gap = (A - B * qq) - (c + F / qq)
    agree(float(qq[int(np.argmax(gap))]), Qs, 0.51, "tangent"); agree(float(np.max(gap)), 0.0, 0.02 * Ps, "zero_profit")
    ymax = int(math.ceil((A + 10) / 10) * 10); qmax = int(math.ceil((A / B) / 10) * 10)
    q0 = Qs / 1.8
    stim = econ_graph("A monopolistically competitive firm in long-run equilibrium: demand D, marginal revenue MR, marginal cost MC, and average total cost ATC. Point E marks the firm's chosen output and price.",
                      [("D", [(0, A), (A / B, 0)]), ("MR", [(0, A), (A / (2 * B), 0)]), ("MC", [(0, c), (qmax, c)]), ("ATC", dense_pts(lambda q: c + F / q, q0, qmax, 45))], qmax, ymax, 10, 10, points=[("E", Qs, Ps)])
    f = lambda p, pr: f"Price is {usd(p)} and economic profit is {pr}."  # noqa: E731
    key = Opt(f(Ps, "zero"), True, f"At point E price {usd(Ps)} equals average total cost (demand is tangent to ATC), so economic profit is zero; price exceeds marginal cost {usd(c)}.", None)
    prof_mc = (Ps - c) * Qs
    cands = [(f(c, "zero"), "Takes the price to equal marginal cost, as in perfect competition; this firm charges the price on its demand curve at its output."), (f(Ps, f"{usd(prof_mc)}"), "Computes profit as (price minus marginal cost) times quantity, which ignores fixed cost; ATC at this output equals the price."),
             (f(A, "zero"), "Reads the demand intercept as the price."), (f(Ps, f"a loss of {usd(F)}"), "Treats the fixed cost as a loss even though revenue covers all costs."), (f(c, f"{usd(prof_mc)}"), "Takes the price to be marginal cost and then reports a margin over marginal cost as profit.")]
    ds, seen = [], {key.text}
    for tx, why in cands:
        if tx in seen: continue
        seen.add(tx); ds.append(Opt(tx, False, why, None))
    stem = "The graph shows a monopolistically competitive firm in long-run equilibrium. Which of the following describes the firm's price and economic profit?"
    return mk("mi_mc_graph_longrun", "4.4", "3.A", stem, key, ds, rng, concept="long-run monopolistic competition: price equals ATC above MC and zero economic profit", path="tangency of demand and ATC found by numeric search vs the algebraic tangency condition F = B Q*^2", stim=stim, facts=[f"Qs={Qs}", f"B={B}", f"c={c}", f"A={A}", f"Ps={Ps}", f"F={F}"], est=80)


# ======================= 독점 구매자 그래프 =======================
@retry_sep
def mi_monopsony_graph(rng):
    s = rng.choice([1, 2]); r1 = rng.choice([1, 2]); Ls = rng.choice([10, 20, 30]); w0 = rng.choice([10, 20])
    r0 = w0 + (2 * s + r1) * Ls
    Wm = w0 + s * Ls; mfcL = w0 + 2 * s * Ls
    L = sp.symbols("L"); agree(float(sp.solve(sp.Eq(r0 - r1 * L, w0 + 2 * s * L), L)[0]), Ls, 1e-9, "Ls")
    Lc = Fr(r0 - w0, s + r1); Wc = w0 + s * Lc
    if Lc != int(Lc) or mfcL != r0 - r1 * Ls: raise ValueError("not_enough_separated_distractors")
    lmax = int(math.ceil((r0 / r1) / 10) * 10); lmax = min(lmax, 120); lmax = max(lmax, int(Lc) + 20); lmax = int(math.ceil(lmax / 10) * 10)
    ymax = int(math.ceil((r0 + 10) / 10) * 10)
    stim = econ_graph("The labor market faced by the only employer in a town (a monopsonist): marginal revenue product MRP, labor supply S (the wage that must be paid), and marginal factor cost MFC. Point E is where MRP equals MFC.",
                      [("MRP", line_pts(r0, -r1, 0, min(lmax, r0 / r1))), ("S", line_pts(w0, s, 0, lmax)), ("MFC", line_pts(w0, 2 * s, 0, lmax))], lmax, ymax, 10, 10, xlabel="Quantity of labor (workers)", ylabel="Wage or value (dollars per hour)", points=[("E", Ls, mfcL)])
    f = lambda v: usd(v)  # noqa: E731
    k, ds = val_opts(Wm, [("Reports the marginal factor cost at point E as the wage; a monopsonist pays the wage on the supply curve.", mfcL), ("Reports the wage a competitive labor market would pay (where MRP equals S).", float(Wc)), ("Reports the vertical intercept of the supply curve.", w0), ("Reports the vertical intercept of the MRP curve.", r0), ("Reports the number of workers hired instead of a wage.", Ls)], f)
    stem = "The graph shows the labor market for a monopsonist. To maximize profit, what hourly wage does the firm pay?"
    return mk("mi_monopsony_graph", "5.4", "3.C", stem, k, ds, rng, concept="monopsony wage read from the supply curve at the quantity where MRP = MFC", path="algebraic intersection of MRP and MFC (sympy) vs the construction of the lines and numeric evaluation of S at that quantity", stim=stim, kwhy=f"The firm hires {Ls} workers, where MRP equals MFC at point E, and pays the supply-curve wage at that quantity, {usd(Wm)}.",
              facts=[f"s={s}", f"r1={r1}", f"Ls={Ls}", f"w0={w0}", f"r0={r0}", f"Wm={Wm}", f"mfc={mfcL}"], est=85)


# ======================= 로렌츠 곡선 그래프 =======================
@retry_sep
def mi_lorenz_graph(rng):
    p1, p2 = rng.choice([1.5, 2.0, 2.5]), rng.choice([3.0, 4.0, 5.0])
    if rng.random() < 0.5: p1, p2 = p2, p1
    xs = np.linspace(0, 1, 2001)
    g1 = 1 - 2 * float(np.trapezoid(xs ** p1, xs)); g2 = 1 - 2 * float(np.trapezoid(xs ** p2, xs))
    agree(g1, (p1 - 1) / (p1 + 1), 1e-6, "gini1"); agree(g2, (p2 - 1) / (p2 + 1), 1e-6, "gini2")
    hi = "X" if g1 > g2 else "Y"; lo = "Y" if hi == "X" else "X"
    pts = lambda p: [(100 * x, 100 * x ** p) for x in np.linspace(0, 1, 41)]  # noqa: E731
    stim = econ_graph("Lorenz curves for two countries, X and Y, and the line of equality.", [("Line of equality", [(0, 0), (100, 100)]), ("Lorenz curve X", pts(p1)), ("Lorenz curve Y", pts(p2))], 100, 100, 20, 20, xlabel="Cumulative share of households (percent)", ylabel="Cumulative share of income (percent)")
    k, ds = sent_opts(f"Country {hi} has the greater income inequality, because its Lorenz curve is farther from the line of equality.", f"The farther a Lorenz curve bows below the equality line, the larger the area between them and the higher the Gini coefficient; country {hi}'s curve is farther below.",
                      [(f"Country {lo} has the greater income inequality, because its Lorenz curve is farther from the line of equality.", "Reverses which curve is farther from the line of equality."), (f"Country {lo} has the greater income inequality, because its Lorenz curve is closer to the line of equality.", "Reverses the interpretation: a curve closer to the equality line means less inequality."),
                       ("The two countries have the same Gini coefficient, because both Lorenz curves start and end at the same points.", "Every Lorenz curve passes through the same endpoints; the Gini coefficient depends on the area in between."), (f"Country {hi} has the lower Gini coefficient, because the bottom 40 percent of its households receive a smaller share of income.", "Believes a smaller share for the poorest households means a lower Gini coefficient."),
                       ("Neither country has any inequality, because both curves lie below the line of equality.", "A Lorenz curve below the line of equality indicates inequality.")])
    stem = "The graph shows the Lorenz curves of two countries. Which of the following is correct?"
    return mk("mi_lorenz_graph", "6.5", "1.B", stem, k, ds, rng, concept="compare income inequality from Lorenz curves", path="curve exponents ordered by the Gini formula (p-1)/(p+1) vs numerical integration of the area under each curve", stim=stim, facts=[f"p1={p1}", f"p2={p2}", f"hi={hi}", f"g1={g1:.4f}", f"g2={g2:.4f}"], est=60)


# ======================= 양의 외부효과 그래프 =======================
@retry_sep
def mi_pos_ext_graph(rng):
    s = rng.choice([1, 2]); e = rng.choice([20, 40]) if s == 1 else rng.choice([40, 80])
    m = _sym_mkt(rng, s, [30, 40, 50] if s == 1 else [20, 25, 30], [40, 50, 60])
    dq = e / (2 * s); Qe = m.Q0 + dq
    if dq != int(dq) or dq % (10 if s == 1 else 5) != 0: raise ValueError("not_enough_separated_distractors")
    qq = np.arange(0, 3 * m.Q0, 0.5); net = np.cumsum((m.A + e - s * qq) - (m.C + s * qq)); agree(float(qq[int(np.argmax(net))]), Qe, 1.0, "Qe")
    qmax = int(math.ceil((m.A + e) / s / 10) * 10); qmax = min(qmax, 160); qmax = int(math.ceil(max(qmax, Qe + 20) / 10) * 10)
    ymax = int(math.ceil((m.A + e + 10) / 10) * 10)
    stim = econ_graph("A competitive market with a positive externality: demand D (marginal private benefit), supply S (marginal private cost), and marginal social benefit MSB. Point E is the market equilibrium.",
                      [("D", line_pts(m.A, -s, 0, min(qmax, m.A / s))), ("MSB", line_pts(m.A + e, -s, 0, min(qmax, (m.A + e) / s))), ("S", line_pts(m.C, s, 0, qmax))], qmax, ymax, 10 if s == 1 else 5, 10, points=[("E", m.Q0, m.P0)])
    k, ds = val_opts(dq, [("Reports the market equilibrium quantity instead of the shortfall.", m.Q0), ("Reports the socially efficient quantity instead of the shortfall.", Qe), ("Reports the vertical distance between D and MSB (the external benefit per unit).", e), ("Reports twice the shortfall.", 2 * dq), ("Reports half of the shortfall.", dq / 2)], lambda v: nm(v, 0) + " units")
    stem = "The graph shows a market with a positive externality. By how many units does the market equilibrium quantity fall short of the socially efficient quantity?"
    return mk("mi_pos_ext_graph", "6.2", "3.C", stem, k, ds, rng, concept="underproduction with a positive externality read from a graph", path="analytic crossing of MSB and S vs numeric search for the maximum social net benefit", stim=stim, kwhy=f"The efficient quantity is where MSB crosses S, at {nm(Qe, 0)} units, so the market falls short by {nm(dq, 0)} units.", facts=[f"s={s}", f"e={e}", f"Q0={m.Q0}", f"P0={m.P0}", f"Qe={Qe}", f"dq={dq}"], est=85)


# ======================= 게임: 모두에게 더 좋은 결과 =======================
@retry_sep
def mi_game_pareto(rng):
    from micro_p0_d import _matrix, _game_stim
    names = rng.choice([("Firm A", "Firm B", "keep the price", "cut the price"), ("Company X", "Company Y", "low output", "high output")])
    ra, ca, s1, s2 = names; labels = [s1, s2]
    M = _matrix(rng, rng.choice(["pd", "pd", "other"]))
    ex = micro_nash(M)
    if len(ex) != 1: raise ValueError("not_enough_separated_distractors")
    r0, c0 = ex[0]
    better = [(r, c) for r in range(2) for c in range(2) if M[r][c][0] > M[r0][c0][0] and M[r][c][1] > M[r0][c0][1]]
    if len(better) != 1: raise ValueError("not_enough_separated_distractors")
    rb, cb = better[0]
    txt = lambda r, c: f"{ra} plays \"{labels[r]}\" and {ca} plays \"{labels[c]}\"."  # noqa: E731
    whys = {}
    for r in range(2):
        for c in range(2):
            if (r, c) in (better[0],): continue
            if (r, c) == (r0, c0): whys[(r, c)] = "This is the Nash equilibrium itself, so it cannot give both firms more than the equilibrium."
            elif M[r][c][0] > M[r0][c0][0] or M[r][c][1] > M[r0][c0][1]: whys[(r, c)] = "Only one firm earns more than in the Nash equilibrium, so the outcome is not better for both."
            else: whys[(r, c)] = "Both firms earn no more than in the Nash equilibrium."
    k, ds = sent_opts(txt(rb, cb), "Both firms earn more in this cell than in the Nash equilibrium, although at least one firm could gain by deviating from it.", [(txt(r, c), w) for (r, c), w in whys.items()] + [("No outcome gives both firms a higher payoff than the Nash equilibrium.", "Believes the equilibrium is always the best outcome for both players.")])
    stem = "The payoff matrix shows the profits of two firms choosing simultaneously. Which outcome gives both firms a higher profit than the Nash equilibrium?"
    return mk("mi_game_pareto", "4.5", "2.C", stem, k, ds, rng, concept="a cooperative outcome that beats the Nash equilibrium for both players", path="enumeration of cells strictly better for both than the equilibrium cell vs the independent Nash module for the equilibrium", stim=_game_stim(M, ra, ca, labels), facts=[f"payoffs={M}", f"nash={ex}", f"better={better}"], est=75)


def micro_nash(M):
    from micro_checks import nash as _n
    return _n({"payoffs": M})["nash"]


# ======================= 탄력성 그래프 =======================
@retry_sep
def mi_elasticity_graph(rng):
    Q0 = rng.choice([40, 50, 60]); P0 = rng.choice([40, 50, 60]); s_flat = rng.choice([Fr(1, 2), Fr(1)]); s_steep = rng.choice([Fr(2), Fr(3)])
    e_flat = Fr(P0, 1) / (s_flat * Q0); e_steep = Fr(P0, 1) / (s_steep * Q0)
    agree(float(e_flat / e_steep), float(s_steep / s_flat), 1e-9, "ratio")
    if e_flat == 1 or e_steep == 1:
        raise ValueError("not_enough_separated_distractors")
    flat_is_1 = rng.random() < 0.5
    sa, sb = (s_flat, s_steep) if flat_is_1 else (s_steep, s_flat)
    more = "D1" if flat_is_1 else "D2"; less = "D2" if flat_is_1 else "D1"
    qmax = int(math.ceil((Q0 + P0 / float(min(sa, sb))) / 10) * 10); qmax = min(qmax, 160)
    def dline(sl):
        a = P0 + float(sl) * Q0; q_end = min(qmax, a / float(sl)); return [(0, a), (q_end, a - float(sl) * q_end)]
    ymax = int(math.ceil((P0 + float(max(sa, sb)) * Q0 + 10) / 10) * 10); ymax = min(ymax, 260)
    stim = econ_graph("Two straight-line demand curves, D1 and D2, that cross at point A.", [("D1", dline(sa)), ("D2", dline(sb))], qmax, ymax, 10, 20 if ymax > 120 else 10, points=[("A", Q0, P0)])
    k, ds = sent_opts(f"At point A, demand {more} is more elastic than demand {less}, because the same price change causes a larger percentage change in quantity along the flatter curve.", f"Elasticity = (1/slope) x (P/Q); at the same point the flatter curve has the smaller slope in absolute value and therefore the larger elasticity.",
                      [(f"At point A, demand {less} is more elastic than demand {more}, because the steeper curve is more elastic.", "Equates a steeper demand curve with greater responsiveness; a steeper curve is less elastic at the same point."), (f"At point A, demand {more} and demand {less} have the same elasticity, because they cross at the same price and quantity.", "Believes crossing at the same point implies equal elasticity; elasticity also depends on the slope."),
                       (f"At point A, demand {less} is perfectly inelastic, because its slope is steeper.", "A straight steeper line is still not vertical, so it is not perfectly inelastic."), (f"At point A, demand {more} is unit elastic, because the demand curve is a straight line.", "A straight line has a different elasticity at each point and is not unit elastic everywhere."),
                       (f"At point A, the elasticity of demand {less} is larger, because slope and elasticity are the same thing.", "Confuses the slope with the elasticity; elasticity also depends on the price-quantity ratio.")])
    stem = "The graph shows two straight-line demand curves for two goods that cross at point A. Which of the following is true at point A?"
    return mk("mi_elasticity_graph", "2.3", "1.D", stem, k, ds, rng, concept="compare price elasticities of two demand curves at the same point", path="exact elasticity P/(slope x Q) for each line vs slope ordering", stim=stim, facts=[f"Q0={Q0}", f"P0={P0}", f"sa={sa}", f"sb={sb}", f"more={more}"], est=70)


# ======================= 단원 1·5·6 보강 =======================
FACTORS = [("land", "rent", "Rent"), ("labor", "wages", "Wages"), ("capital", "interest", "Interest"), ("entrepreneurship", "profit", "Profit")]


def mi_factors_production(rng):
    fac, pay, Pay = FACTORS[rng.randrange(4)]
    others = [p for _, p, _ in FACTORS if p != pay] + ["taxes"]
    whys = {"rent": "Rent is the payment to land, not to the other factor named.", "wages": "Wages are the payment to labor, not to the other factor named.", "interest": "Interest is the payment to capital, not to the other factor named.", "profit": "Profit is the payment to entrepreneurship, not to the other factor named.",
            "taxes": "Taxes are a payment to the government, not a payment to a factor of production."}
    k, ds = sent_opts(Pay, f"The income earned by {fac} is called {pay}.", [(o[0].upper() + o[1:], whys[o]) for o in others])
    return mk("mi_factors_production", "1.1", "1.A", f"In economics, which term describes the payment that the owners of {fac} receive?", k, ds, rng, concept="factors of production and their payments", path="fixed vetted factor-payment table", facts=[f"factor={fac}"], est=40)


@retry_sep
def mi_mfc_numeric(rng):
    w0 = rng.choice([8, 10, 12, 14]); s = rng.choice([1, 2, 3]); n = rng.choice([3, 4, 5])
    wage = lambda l: w0 + s * l  # noqa: E731
    tlc = lambda l: l * wage(l)  # noqa: E731
    mfc = tlc(n) - tlc(n - 1)
    agree(mfc, w0 + s * (2 * n - 1), 1e-9, "mfc")
    stim = tbl("A firm is the only employer in a town. The wage it must pay to all workers rises with the number of workers hired.", ["Workers", "Wage per worker"], [[l, usd(wage(l))] for l in range(1, 7)])
    k, ds = val_opts(mfc, [("Reports the wage paid to the last worker rather than the extra cost of hiring that worker.", wage(n)), ("Reports the total labor cost rather than the marginal cost.", tlc(n)), ("Reports the change in the wage rather than the change in total labor cost.", s), ("Reports the average cost of labor of the previous worker count.", wage(n - 1)),
                          ("Adds the wage of the previous worker to the wage of the last worker.", wage(n) + wage(n - 1))], usd)
    stem = f"A firm that is the only employer in a town must raise the wage paid to all of its workers to hire more of them. The table shows the wage at each employment level. What is the marginal factor cost of the worker number {n}?"
    return mk("mi_mfc_numeric", "5.4", "1.C", stem, k, ds, rng, concept="marginal factor cost of labor for a monopsonist", path="difference of total labor cost vs closed form w0 + s(2n-1)", stim=stim, kwhy=f"Total labor cost rises from {usd(tlc(n - 1))} to {usd(tlc(n))}, so MFC = {usd(mfc)}.", facts=[f"w0={w0}", f"s={s}", f"n={n}", f"mfc={mfc}"], est=65)


@retry_sep
def mi_public_good_efficient(rng):
    n = 6
    ma = sorted(rng.sample(range(6, 30, 2), n), reverse=True); mb = sorted(rng.sample(range(4, 24, 2), n), reverse=True)
    mc = rng.choice([14, 18, 22, 26])
    soc = [a + b for a, b in zip(ma, mb)]
    opt = sum(1 for x in soc if x > mc)
    indiv = sum(1 for a in ma if a > mc)
    if opt in (0, n) or opt == indiv or any(x == mc for x in soc): raise ValueError("not_enough_separated_distractors")
    cum = [sum(soc[:q]) - mc * q for q in range(n + 1)]
    agree(opt, max(range(n + 1), key=lambda q: cum[q]), 1e-9, "opt")
    stim = tbl("Marginal benefit (in dollars) that two people receive from each unit of a public good.", ["Unit", "Person A's marginal benefit", "Person B's marginal benefit"], [[i + 1, usd(ma[i]), usd(mb[i])] for i in range(n)])
    k, ds = val_opts(opt, [("Counts only the units for which Person A's benefit alone covers the marginal cost.", indiv), ("Counts the units for which either person's benefit covers the cost.", max(sum(1 for a in ma if a > mc), sum(1 for b in mb if b > mc))), ("Chooses one more unit than the efficient quantity.", opt + 1), ("Chooses one fewer unit than the efficient quantity.", max(opt - 1, 0)), ("Chooses the largest quantity shown.", n)], lambda v: str(int(v)))
    stem = f"Two people consume a public good that is provided to both at the same time. The table shows each person's marginal benefit from each unit. The marginal cost of providing each unit of the public good is {usd(mc)}. What is the efficient quantity of the public good?"
    return mk("mi_public_good_efficient", "6.3", "2.C", stem, k, ds, rng, concept="efficient quantity of a public good: add marginal benefits vertically", path="count of units whose summed benefit exceeds the cost vs argmax of cumulative net social benefit", stim=stim, kwhy=f"For a public good the marginal social benefit is the sum of the individual benefits; it exceeds {usd(mc)} for the first {opt} units.", facts=[f"ma={ma}", f"mb={mb}", f"mc={mc}", f"opt={opt}"], est=80)
