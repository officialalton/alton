"""정수계획 보조 풀이기(HiGHS, scipy.optimize.milp). lib/ap-exam/ilp.ts 의 작은 분기한정이 변수 수백 개에서 해를 못 찾을 때 오프라인 배정(chem-assign.ts)이 쓴다.
입력 JSON: {n, obj, cons:[{coef:[[j,v],..], sense:"<="|">="|"=", rhs}], integer:[bool], binary:[bool], timeMs}. 출력 JSON: {status, obj, x}. 서버 런타임에서는 쓰지 않는다(배정은 커밋된 보고서를 읽고 독립 검증만 한다)."""
import json
import sys

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import lil_matrix

p = json.load(open(sys.argv[1]))
n = p["n"]
rows = len(p["cons"])
A = lil_matrix((rows, n))
lo = np.full(rows, -np.inf)
hi = np.full(rows, np.inf)
for i, c in enumerate(p["cons"]):
    for j, v in c["coef"]:
        A[i, j] += v
    if c["sense"] == "<=":
        hi[i] = c["rhs"]
    elif c["sense"] == ">=":
        lo[i] = c["rhs"]
    else:
        lo[i] = hi[i] = c["rhs"]
ub = np.full(n, np.inf)
for j, b in enumerate(p.get("binary", [])):
    if b:
        ub[j] = 1.0
res = milp(c=np.array(p["obj"], dtype=float), constraints=LinearConstraint(A.tocsr(), lo, hi), integrality=np.array([1 if v else 0 for v in p["integer"]]), bounds=Bounds(0, ub), options={"time_limit": max(1.0, p.get("timeMs", 120000) / 1000.0), "mip_rel_gap": 0.0})
status = {0: "optimal", 1: "limit", 2: "infeasible", 3: "unbounded"}.get(res.status, "limit")
print(json.dumps({"status": status, "obj": float(res.fun) if res.x is not None else None, "x": [float(v) for v in res.x] if res.x is not None else [], "message": str(res.message)}))
