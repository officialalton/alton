"""Bio 코드 검증기: 평균·SE·±2SE 겹침·퍼센트 변화·속도·카이제곱·하디-바인베르크·실험 설계 유효성."""
import json, math, sys

def overlap(m1, e1, m2, e2):  # e = SE 값, ±2SE 구간
    return not ((m1 + 2 * e1) < (m2 - 2 * e2) or (m2 + 2 * e2) < (m1 - 2 * e1))

def stats(p):
    vals = p["values"]; n = len(vals); m = sum(vals) / n
    sd = math.sqrt(sum((v - m) ** 2 for v in vals) / (n - 1)); se = sd / math.sqrt(n)
    return {"mean": round(m, 4), "sd": round(sd, 4), "se": round(se, 4), "ci2": [round(m - 2 * se, 4), round(m + 2 * se, 4)]}

def percent_change(p): return {"pct": round((p["new"] - p["old"]) / p["old"] * 100, 4)}
def rate(p): return {"rate": round((p["y1"] - p["y0"]) / (p["t1"] - p["t0"]), 6)}
def chi_square(p):
    chi = sum((o - e) ** 2 / e for o, e in zip(p["observed"], p["expected"])); df = len(p["observed"]) - 1
    crit = {1: 3.84, 2: 5.99, 3: 7.81, 4: 9.49, 5: 11.07}.get(df)
    return {"chi2": round(chi, 4), "df": df, "reject_null_at_0.05": (chi > crit) if crit else None}
def hardy_weinberg(p):
    q2 = p["q2"]; q = math.sqrt(q2); pp = 1 - q
    return {"q": round(q, 6), "p": round(pp, 6), "heterozygotes": round(2 * pp * q, 6)}
def overlap_claim(p):
    return {"overlap": overlap(p["m1"], p["se1"], p["m2"], p["se2"])}

def design(p):
    """실험 설계 유효성: 대조군 존재, 독립변수 1개만 변화, 반복 ≥3, 종속변수 정의."""
    groups = p["groups"]; ivs = p["independent_variables"]
    issues = []
    if len(ivs) != 1: issues.append("not_exactly_one_independent_variable")
    if not any(g.get("control") for g in groups): issues.append("no_control_group")
    if min(g.get("n", 0) for g in groups) < 3: issues.append("too_few_replicates")
    if not p.get("dependent_variable"): issues.append("no_dependent_variable")
    # 대조군은 처리하지 않은 수준이거나 기준 수준이어야 한다: 대조군과 다른 변수까지 동시에 바뀌면 교란
    if any(len(g.get("changed_vs_control", [])) > 1 for g in groups): issues.append("confounded_groups")
    return {"valid": not issues, "issues": issues}

KINDS = {"stats": stats, "percent_change": percent_change, "rate": rate, "chi_square": chi_square, "hardy_weinberg": hardy_weinberg, "overlap_claim": overlap_claim, "design": design}

def verify(item):
    got = KINDS[item["kind"]](item["params"]); claim = item.get("claim", {})
    bad = {k: (claim[k], got.get(k)) for k in claim if got.get(k) != claim[k] and not (isinstance(claim[k], (int, float)) and isinstance(got.get(k), (int, float)) and abs(claim[k] - got[k]) < item.get("tol", 1e-3))}
    return {"ok": not bad, "computed": got, "mismatch": bad}

if __name__ == "__main__":
    print(json.dumps(verify(json.loads(sys.stdin.read()))))
