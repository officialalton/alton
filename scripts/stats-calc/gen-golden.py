"""골든 값 생성: scipy로 lib/stats-calc 수치 함수의 기준값을 계산해 JSON으로 저장한다.
실행: .venv-ap/bin/python scripts/stats-calc/gen-golden.py  (네트워크·DB 불필요, scipy/numpy 필요)
"""
import json, os
import numpy as np
from scipy import stats

out = {"scipy": __import__("scipy").__version__, "dist": [], "describe": {}, "infer": {}}
d = out["dist"]

def add(fn, args, value):
    d.append({"fn": fn, "args": args, "value": float(value)})

for x in [-8, -5.5, -3, -1.96, -1, -0.3, 0, 0.5, 1.645, 2.5, 4, 7]:
    add("normCdf", [x], stats.norm.cdf(x)); add("normPdf", [x], stats.norm.pdf(x))
add("normCdf", [105, 100, 15], stats.norm.cdf(105, 100, 15))
for p in [1e-12, 1e-6, 0.001, 0.025, 0.1, 0.5, 0.8, 0.975, 0.999999]:
    add("normInv", [p], stats.norm.ppf(p))
add("normInv", [0.9, 100, 15], stats.norm.ppf(0.9, 100, 15))
for df in [1, 2, 3, 5, 10, 29, 120, 1000]:
    for t in [-6, -2.5, -1, 0, 0.7, 2.045, 5, 12]:
        add("tCdf", [t, df], stats.t.cdf(t, df))
    for p in [0.0005, 0.025, 0.2, 0.5, 0.9, 0.995]:
        add("tInv", [p, df], stats.t.ppf(p, df))
    add("tPdf", [1.3, df], stats.t.pdf(1.3, df))
for df in [1, 2, 3, 7, 15, 50, 200]:
    for x in [0.05, 0.5, 1, 3.84, 7, 20, 60, 250]:
        add("chiCdf", [x, df], stats.chi2.cdf(x, df)); add("chiSf", [x, df], stats.chi2.sf(x, df))
    for p in [0.001, 0.05, 0.5, 0.95, 0.999]:
        add("chiInv", [p, df], stats.chi2.ppf(p, df))
    add("chiPdf", [4.2, df], stats.chi2.pdf(4.2, df))
for n, p in [(1, 0.5), (10, 0.3), (20, 0.05), (50, 0.5), (200, 0.37), (1000, 0.02), (30, 0.999)]:
    for k in sorted({0, 1, n // 4, n // 2, n - 1, n}):
        add("binomPdf", [n, p, k], stats.binom.pmf(k, n, p)); add("binomCdf", [n, p, k], stats.binom.cdf(k, n, p))
for p in [0.05, 0.25, 0.5, 0.9]:
    for k in [1, 2, 5, 17, 60]:
        add("geomPdf", [p, k], stats.geom.pmf(k, p)); add("geomCdf", [p, k], stats.geom.cdf(k, p))

# 기술통계(수치는 numpy; 사분위수는 TI 방식이라 직접 계산한 고정 예제를 코드에서 검증)
xs = [4.2, 5.1, 6.3, 7.7, 8.0, 9.4, 10.1, 12.6, 13.0, 15.5]
ys = [2.0, 2.9, 3.1, 4.8, 4.4, 6.0, 6.2, 7.9, 7.5, 9.8]
lr = stats.linregress(xs, ys)
n = len(xs)
resid = np.array(ys) - (lr.intercept + lr.slope * np.array(xs))
s = float(np.sqrt((resid ** 2).sum() / (n - 2)))
out["describe"] = {"xs": xs, "ys": ys, "mean": float(np.mean(xs)), "sx": float(np.std(xs, ddof=1)), "sigma": float(np.std(xs)),
    "r": float(lr.rvalue), "slope": float(lr.slope), "intercept": float(lr.intercept), "seSlope": float(lr.stderr), "seIntercept": float(lr.intercept_stderr),
    "s": s, "p": float(lr.pvalue), "t": float(lr.slope / lr.stderr)}

inf = out["infer"]
# 1-sample t (요약통계에서 직접)
x, s1, n1, mu0 = 52.3, 11.2, 25, 48.0
t = (x - mu0) / (s1 / np.sqrt(n1)); inf["t1"] = {"in": [x, s1, n1, mu0], "t": float(t), "p2": float(2 * stats.t.sf(abs(t), n1 - 1)), "pr": float(stats.t.sf(t, n1 - 1)), "pl": float(stats.t.cdf(t, n1 - 1)),
    "lo": float(x - stats.t.ppf(0.975, n1 - 1) * s1 / np.sqrt(n1)), "hi": float(x + stats.t.ppf(0.975, n1 - 1) * s1 / np.sqrt(n1))}
# 2-sample t
a = dict(m1=24.5, s1=4.1, n1=18, m2=21.2, s2=6.3, n2=23)
for pooled in (False, True):
    r = stats.ttest_ind_from_stats(a["m1"], a["s1"], a["n1"], a["m2"], a["s2"], a["n2"], equal_var=pooled)
    v1, v2 = a["s1"] ** 2 / a["n1"], a["s2"] ** 2 / a["n2"]
    if pooled:
        df = a["n1"] + a["n2"] - 2
        sp2 = ((a["n1"] - 1) * a["s1"] ** 2 + (a["n2"] - 1) * a["s2"] ** 2) / df
        se = np.sqrt(sp2 * (1 / a["n1"] + 1 / a["n2"]))
    else:
        se = np.sqrt(v1 + v2); df = (v1 + v2) ** 2 / (v1 ** 2 / (a["n1"] - 1) + v2 ** 2 / (a["n2"] - 1))
    diff = a["m1"] - a["m2"]; tc = stats.t.ppf(0.975, df)
    inf["t2_pooled" if pooled else "t2_welch"] = {"in": a, "t": float(r.statistic), "p2": float(r.pvalue), "df": float(df), "lo": float(diff - tc * se), "hi": float(diff + tc * se)}
# 1-prop z
x1, nn, p0 = 62, 120, 0.45
phat = x1 / nn; z = (phat - p0) / np.sqrt(p0 * (1 - p0) / nn)
se = np.sqrt(phat * (1 - phat) / nn); zc = stats.norm.ppf(0.975)
inf["p1"] = {"in": [x1, nn, p0], "z": float(z), "p2": float(2 * stats.norm.sf(abs(z))), "pr": float(stats.norm.sf(z)), "lo": float(phat - zc * se), "hi": float(phat + zc * se)}
# 2-prop z
xa, na, xb, nb = 45, 100, 38, 110
pa, pb = xa / na, xb / nb; pc = (xa + xb) / (na + nb)
z = (pa - pb) / np.sqrt(pc * (1 - pc) * (1 / na + 1 / nb)); se = np.sqrt(pa * (1 - pa) / na + pb * (1 - pb) / nb)
inf["p2"] = {"in": [xa, na, xb, nb], "z": float(z), "p2": float(2 * stats.norm.sf(abs(z))), "lo": float(pa - pb - zc * se), "hi": float(pa - pb + zc * se)}
# chi-square
obs = [18, 22, 31, 29]; exp = [0.25, 0.25, 0.25, 0.25]
g = stats.chisquare(obs, [e * sum(obs) for e in exp])
inf["gof"] = {"obs": obs, "exp": exp, "chi": float(g.statistic), "p": float(g.pvalue), "df": 3}
m = [[30, 20, 25], [22, 35, 18]]
c = stats.chi2_contingency(m, correction=False)
inf["indep"] = {"m": m, "chi": float(c[0]), "p": float(c[1]), "df": int(c[2])}
# slope interval
b, seb, nsl = lr.slope, lr.stderr, n
inf["slope"] = {"in": [float(b), float(seb), nsl], "t": float(b / seb), "p2": float(2 * stats.t.sf(abs(b / seb), nsl - 2)),
    "lo": float(b - stats.t.ppf(0.975, nsl - 2) * seb), "hi": float(b + stats.t.ppf(0.975, nsl - 2) * seb)}

path = os.path.join(os.path.dirname(__file__), "..", "..", "lib", "stats-calc", "__golden__", "golden.json")
with open(path, "w") as f:
    json.dump(out, f, indent=1)
print("wrote", len(d), "dist cases")
