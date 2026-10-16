"""Micro 코드 검증기: 균형·이동 방향·잉여·가격 통제·탄력성·독점 MR=MC·게임 이론. 입력 JSON 한 개(kind + params + claim) → {"ok":bool,"computed":...}."""
import json, sys
from fractions import Fraction as Fr

def equilibrium(a, b, c, d):  # Qd=a-bP, Qs=c+dP
    P = Fr(a - c, 1) / Fr(b + d); return P, a - b * P

def shift(params):
    a, b, c, d = params["a"], params["b"], params["c"], params["d"]
    P0, Q0 = equilibrium(a, b, c, d)
    a2 = a + params.get("dDemand", 0); c2 = c + params.get("dSupply", 0)
    P1, Q1 = equilibrium(a2, b, c2, d)
    sgn = lambda v: "increase" if v > 0 else ("decrease" if v < 0 else "unchanged")
    return {"dP": sgn(P1 - P0), "dQ": sgn(Q1 - Q0), "P0": str(P0), "Q0": str(Q0), "P1": str(P1), "Q1": str(Q1)}

def surplus(params):
    a, b, c, d = params["a"], params["b"], params["c"], params["d"]; P, Q = equilibrium(a, b, c, d)
    cs = Fr(1, 2) * (Fr(a, b) - P) * Q; ps = Fr(1, 2) * (P - Fr(-c, d)) * Q
    return {"CS": str(cs), "PS": str(ps), "total": str(cs + ps)}

def price_control(params):
    a, b, c, d = params["a"], params["b"], params["c"], params["d"]; Pc = Fr(params["price"]); kind = params["control"]
    P, Q = equilibrium(a, b, c, d); qd = a - b * Pc; qs = c + d * Pc
    binding = (kind == "floor" and Pc > P) or (kind == "ceiling" and Pc < P)
    traded = min(qd, qs) if binding else Q
    # DWL = 삼각형: 거래량 감소분 × (수요가 - 공급가) / 2
    if binding:
        pdm = Fr(a - traded, 1) / b; psm = Fr(traded - c, 1) / d
        dwl = Fr(1, 2) * (Q - traded) * (pdm - psm)
    else: dwl = Fr(0)
    return {"binding": binding, "traded": str(traded), "shortage_or_surplus": str(abs(qd - qs)), "type": ("surplus" if qs > qd else "shortage") if binding else "none", "DWL": str(dwl)}

def elasticity(params):
    P0, Q0, P1, Q1 = (Fr(params[k]) for k in ("P0", "Q0", "P1", "Q1"))
    mid = ((Q1 - Q0) / ((Q1 + Q0) / 2)) / ((P1 - P0) / ((P1 + P0) / 2))
    return {"midpoint": str(abs(mid)), "elastic": abs(mid) > 1}

def cross_price(params):
    pct_q, pct_p = Fr(params["pctQ"]), Fr(params["pctP"]); e = pct_q / pct_p
    return {"cross": str(e), "relation": "substitutes" if e > 0 else "complements"}

def monopoly(params):  # P = A - B Q, MC = m
    A, B, m = params["A"], params["B"], params["m"]; Q = Fr(A - m, 2 * B); P = A - B * Q
    return {"Q": str(Q), "P": str(P), "profit": str((P - m) * Q), "DWL": str(Fr(1, 2) * (Fr(A - m, B) - Q) * (P - m))}

def nash(params):
    M = params["payoffs"]  # M[r][c] = [row, col]
    R, C = len(M), len(M[0]); out = []
    for r in range(R):
        for c in range(C):
            if all(M[r][c][0] >= M[r2][c][0] for r2 in range(R)) and all(M[r][c][1] >= M[r][c2][1] for c2 in range(C)): out.append([r, c])
    dom_row = [r for r in range(R) if all(M[r][c][0] > M[r2][c][0] for r2 in range(R) if r2 != r for c in range(C))]
    dom_col = [c for c in range(C) if all(M[r][c][1] > M[r][c2][1] for c2 in range(C) if c2 != c for r in range(R))]
    return {"nash": out, "dominant_row": dom_row, "dominant_col": dom_col}

KINDS = {"shift": shift, "surplus": surplus, "price_control": price_control, "elasticity": elasticity, "cross_price": cross_price, "monopoly": monopoly, "nash": nash}

def verify(item):
    got = KINDS[item["kind"]](item["params"]); claim = item.get("claim", {})
    bad = {k: (claim[k], got.get(k)) for k in claim if str(claim[k]) != str(got.get(k))}
    return {"ok": not bad, "computed": got, "mismatch": bad}

if __name__ == "__main__":
    print(json.dumps(verify(json.loads(sys.stdin.read()))))
