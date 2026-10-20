"""AP Microeconomics 확대 MI3 — 신규 짧은 FRQ 원형(5점): 단기 가동 중단 결정(비용표). 2026-10-19. 공개 세트의 FRQ 유형(시장 정책·완전경쟁 기업·외부효과·노동·무역·보수행렬)과 풀이 틀이 다르다."""
from micro_common import *  # noqa: F401,F403
from micro_p0_frq import fr, prt, finish, mdl


# ======================= 짧은 FRQ: 단기 가동 중단 결정 (5점) =======================
def mif_short_shutdown(rng):
    for _ in forever():
        base = rng.choice([8, 10, 12]); step = rng.choice([2, 3, 4])
        mc = [base + step * i for i in range(6)]                       # 한계비용 1..6 번째 단위
        tvc = [0]
        for m_ in mc:
            tvc.append(tvc[-1] + m_)
        P = rng.choice(mc[2:5]) + rng.choice([0, 1])                   # 가격: 3~5 번째 단위의 한계비용 근처
        qstar = max(q for q in range(1, 7) if mc[q - 1] <= P)
        ps = P * qstar - tvc[qstar]                                    # 생산자 잉여(= 고정비용을 덮는 몫)
        F = ps + rng.choice([6, 9, 12, 15])
        loss = F - ps
        # 독립 경로: 모든 수량에서 이윤을 직접 계산해 최대를 찾는다(고정비용 포함)
        prof = [P * q - F - tvc[q] for q in range(0, 7)]
        if max(range(0, 7), key=lambda q: prof[q]) != qstar or prof[qstar] != -loss or prof.count(max(prof)) > 1:
            continue
        if P * qstar < tvc[qstar] or -loss <= -F:                      # 가동 조건: 수입이 가변비용 이상, 중단 손실 F 가 더 크다
            continue
        avc = Fr(tvc[qstar], qstar)
        break
    g = rng.choice(["notebooks", "sandwiches", "phone cases", "ceramic mugs"])
    rows_t = [[q, usd(tvc[q])] for q in range(0, 7)]
    stim = tbl(f"Total variable cost of producing {g} per day for one firm in a perfectly competitive market where the price is {usd(P)} per unit. The firm's total fixed cost is {usd(F)} per day.",
               ["Quantity", "Total variable cost (dollars)"], rows_t)
    nxt = qstar + 1 if qstar < 6 else None
    parts = [
        prt("A", "Calculate the quantity that maximizes the firm's profit in the short run.", 1, "calculate", ["2.C"],
            f"Produce while the marginal cost of the next unit is at most the price of {usd(P)}; the marginal cost of unit {qstar} is {usd(mc[qstar - 1])}" + (f" and of unit {nxt} is {usd(mc[qstar])}" if nxt else "") + f", so the firm produces {qstar} units.",
            [fr("A1", 1, "Profit-maximizing quantity (answer)", ["Compares the price with marginal cost from the changes in total variable cost and chooses the last unit whose marginal cost does not exceed the price (the answer is correct)", str(qstar)],
                ["price equals marginal cost", "produce until marginal cost would exceed the price"], ["picks the quantity with the lowest average variable cost", "produces the largest quantity in the table"], nums=True)], ["3.6"]),
        prt("B", "Calculate the firm's economic profit or loss at that quantity.", 1, "calculate", ["2.C"],
            f"Total revenue = {usd(P)} x {qstar} = {usd(P * qstar)}; total cost = {usd(F)} + {usd(tvc[qstar])} = {usd(F + tvc[qstar])}; the firm has a loss of {usd(loss)}.",
            [fr("B1", 1, "Loss (answer)", ["Subtracts total fixed cost plus total variable cost from total revenue to get a loss (the answer is correct)", str(loss)],
                ["revenue minus total cost", "total revenue less fixed and variable cost"], ["leaves out the fixed cost", "reports total revenue as the profit"], nums=True)], ["3.4"]),
        prt("C", "Should the firm produce in the short run or shut down? Identify your choice.", 1, "identify", ["3.A"],
            "It should keep producing in the short run, because total revenue exceeds total variable cost (the price is above average variable cost), so the firm loses less than the fixed cost it would lose by shutting down.",
            [fr("C1", 1, "Chooses to keep producing", ["States that the firm should keep producing rather than shut down"], ["operate in the short run", "stay open"], ["says the firm should shut down because it has a loss"])], ["3.6"]),
        prt("D", "Explain why your answer to part (C) is correct for the short run even though the firm has an economic loss.", 1, "explain", ["2.A"],
            f"The fixed cost of {usd(F)} must be paid whether the firm operates or not, so shutting down would lose {usd(F)}; by operating, revenue covers all the variable cost with {usd(ps)} left over to cover part of the fixed cost, so the loss is only {usd(loss)}.",
            [fr("D1", 1, "Explains with revenue covering variable cost and fixed cost being sunk", ["States that revenue covers variable cost, with something left over toward the fixed cost, so operating loses less than shutting down, where the whole fixed cost is lost"],
                ["the fixed cost is sunk in the short run", "price is above average variable cost"], ["says the firm earns a profit", "says the fixed cost can be avoided by shutting down in the short run"])], ["3.6"]),
        prt("E", "If the price stays at this level, describe what will happen to the number of firms in this industry in the long run and explain why.", 1, "explain", ["2.B"],
            "Firms exit the industry, because in the long run all costs are avoidable and a firm earning a loss would leave; exit reduces market supply and raises the price until firms earn zero economic profit.",
            [fr("E1", 1, "Explains exit until zero economic profit", ["States that firms leave the industry in the long run because of economic losses, which raises the price toward the level where economic profit is zero"],
                ["market supply decreases and the price rises", "fixed costs are avoidable in the long run"], ["says new firms enter the industry", "says the number of firms stays the same because firms earn normal profit"])], ["3.7"]),
    ]
    pk = {"archetype": "mif_short_shutdown", "template": "short_shutdown", "topic": "3.6", "extra_topics": ["3.4", "3.7"], "skill": "2.C", "calculator": "allowed", "title": "A firm's short-run shutdown decision", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"P={P}", f"F={F}", f"mc={mc}", f"tvc={tvc}", f"q*={qstar}", f"loss={loss}", f"good={g}"], "context": "shutdown"}
    return finish(pk, "Profit-maximizing quantity from marginal cost, economic loss, the shutdown rule, and long-run exit", ["Find marginal cost from total variable cost", "Compare revenue with total cost and with variable cost", "Reason about sunk fixed cost and long-run exit"],
                  [("Competitive output market with the price and the fixed cost stated in the table title", "stated in the stimulus description")], {"type": "table", "must_include": ["total variable cost", "price", "fixed cost"]},
                  "argmax of total profit across quantities vs last unit with marginal cost at most the price",
                  mdl(f"price taker selling at {usd(P)} with total fixed cost {usd(F)}", ["the long run (exit)"], ["costs", "price"], ["profit-maximizing quantity", "loss", "shutdown choice", "exit"], "shutdown-rule"))
