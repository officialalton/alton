"""AB 그래프 필수 MC 신규 원형 C군(2026-10-09, 단계 S1): 불연속·꺾임이 있는 구간선형 그래프(pieces 형식, 열린/닫힌 원). 계산기 불가."""
from gcommon import *

XSB = [0, 2, 4, 6, 8]


def _seg(p0, p1, lo="closed", ro="closed"):
    return {"from": list(p0), "to": list(p1), "left_end": lo, "right_end": ro}


def _pstim(desc, pieces, iso, xax, yax):
    data = {"x_axis": xax, "y_axis": yax, "pieces": pieces}
    if iso:
        data["isolated_points"] = [{"point": list(p), "style": "filled"} for p in iso]
    return {"kind": "graph", "description": desc, "data": data}


def _yax(pieces, iso):
    ys = [p["from"][1] for p in pieces] + [p["to"][1] for p in pieces] + [q[1] for q in iso]
    return axis("y", min(0, min(ys)) - 1, max(ys) + 1, 1)


# 1) 1.10 불연속 유형: 극한은 존재하지만 연속이 아닌 점(제거 가능 불연속)
def g_cont_removable(rng):
    kinds = ["hole", "jump", "corner"]
    rng.shuffle(kinds)
    kind_at = dict(zip([2, 4, 6], kinds))
    loc = {k: x for x, k in kind_at.items()}
    for _ in forever():
        yv = [rng.randint(1, 6) for _ in range(5)]
        if len(set(yv)) >= 4:
            break
    L = {2: yv[1], 4: yv[2], 6: yv[3]}
    Rv = dict(L)
    iso = []
    for x_, kd in kind_at.items():
        if kd == "jump":
            d = rng.choice([-3, -2, 2, 3])
            Rv[x_] = L[x_] + d if 0 <= L[x_] + d <= 8 else L[x_] - d
        if kd == "hole":
            iso.append((x_, L[x_] + 2 if L[x_] + 2 <= 8 else L[x_] - 2))
    pieces = []
    for i in range(4):
        x0_, x1_ = XSB[i], XSB[i + 1]
        yl = yv[0] if x0_ == 0 else Rv[x0_]
        yr = yv[4] if x1_ == 8 else L[x1_]
        lo = "open" if x0_ in kind_at and kind_at[x0_] == "hole" else "closed"
        ro = "open" if x1_ in kind_at and kind_at[x1_] in ("hole", "jump") else "closed"
        pieces.append(_seg((x0_, yl), (x1_, yr), lo, ro))
    key_x = loc["hole"]
    # 독립 경로: 그려진 조각 끝점에서 좌우 극한과 함수값을 읽어 비교
    def left(x_):
        return [p["to"][1] for p in pieces if p["to"][0] == x_][0]
    def right(x_):
        return [p["from"][1] for p in pieces if p["from"][0] == x_][0]
    def fval(x_):
        for q in iso:
            if q[0] == x_:
                return q[1]
        return right(x_)
    sel = [x_ for x_ in (2, 4, 6) if left(x_) == right(x_) and fval(x_) != left(x_)]
    if sel != [key_x]:
        raise ValueError("independent_check_failed")
    ds = [("The graph has a jump at x = %d: the left and right limits differ, so the limit does not exist." % loc["jump"], loc["jump"]),
          ("At the corner x = %d the limit equals the function value, so f is continuous there; the corner affects differentiability, not continuity." % loc["corner"], loc["corner"]),
          ("x = 3 is in the middle of a segment, where the limit exists and equals f(3), so f is continuous there.", 3)]
    pool = [Opt("$x=%d$" % z, False, w_, z) for w_, z in ds]
    stem = "The graph of the function $f$ is shown. At which value of $x=c$ does $\\lim_{x\\to c}f(x)$ exist while $f$ is not continuous at $x=c$?"
    k = Opt("$x=%d$" % key_x, True, "At x = %d both sides approach the same value (the open circles coincide) but the plotted point f(%d) is elsewhere, so the limit exists and f is not continuous there." % (key_x, key_x), key_x)
    bpr = bp("g_cont_removable", "1.10", "3.D", "not_allowed", "Classify points of a graph by limit existence and continuity",
             ["Compare the left and right limits at each candidate point", "Compare the common limit with the plotted function value", "Select the point where the limit exists but the function value is different"],
             [("continuity at c requires the limit to exist and equal f(c)", "definition of continuity at a point")],
             [("jump_discontinuity", "limit does not exist at a jump"), ("corner_continuous", "a corner is continuous"), ("interior_point", "a regular interior point is continuous")],
             "side limits and function values compared numerically from the plotted piece endpoints (independent of how the picture types were assigned)", {"type": "graph", "must_include": ["open circles at the discontinuities", "a separate filled point at the removable discontinuity"]})
    return gpack("g_cont_removable", "1.10", "3.D", "not_allowed", stem, k, pool, rng, _pstim("Graph of f on [0, 8]: four line segments with open and filled circles at x = 2, 4, 6 and one separate filled point.", pieces, iso, axis("x", 0, 8, 1), _yax(pieces, iso)), bpr, 85, [f"kind_at={kind_at}", f"iso={iso}"])


# 2) 2.4 미분 불가능한 점의 개수: 점프 1개 + 꺾임
def g_count_nondiff(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 7)
        c = rng.choice([2, 4, 6])
        jd = rng.choice([-3, -2, 2, 3])
        i = c // 2
        right_val0 = v[i] + jd
        yl_ = [right_val0 if XSB[j] == c else v[j] for j in range(4)]
        sl = [v[j + 1] - yl_[j] for j in range(4)]     # 점프 옆 조각의 기울기는 조각 끝점 값으로 계산
        # 점프 꼭짓점은 제외하고, 연속인 내부 꼭짓점의 꺾임(기울기 변화)을 센다
        cont_int = [j for j in (1, 2, 3) if 2 * j != c]
        corners = sum(1 for j in cont_int if sl[j - 1] != sl[j])
        collinear = sum(1 for j in cont_int if sl[j - 1] == sl[j])
        right_val = v[i] + jd
        if collinear >= 1 and corners >= 1 and 0 <= right_val <= 8 and right_val != v[i]:
            break
    key = corners + 1
    pieces = []
    for j in range(4):
        x0_, x1_ = XSB[j], XSB[j + 1]
        yl = (right_val if x0_ == c else v[j])
        yr = v[j + 1]
        lo = "closed"
        ro = "open" if x1_ == c else "closed"
        pieces.append(_seg((x0_, yl), (x1_, yr), lo, ro))
    # 독립 경로: 촘촘한 격자에서 좌우 차분 기울기와 값의 불연속으로 센다
    def fn(u):
        for p in pieces:
            a_, b_ = p["from"], p["to"]
            if a_[0] <= u <= b_[0] and not (u == b_[0] and p["right_end"] == "open"):
                return a_[1] + (b_[1] - a_[1]) * (u - a_[0]) / (b_[0] - a_[0])
    cnt = 0
    for x_ in (2, 4, 6):
        lval = [p["to"][1] for p in pieces if p["to"][0] == x_][0]
        rval = fn(x_)
        if lval != rval:
            cnt += 1
            continue
        sl_l = fn(x_ - 0.5) - fn(x_ - 1.5) if False else (fn(x_ - 0.25) - fn(x_ - 0.75)) / 0.5
        sl_r = (fn(x_ + 0.75) - fn(x_ + 0.25)) / 0.5
        if abs(sl_l - sl_r) > 1e-9:
            cnt += 1
    if cnt != key:
        raise ValueError("independent_check_failed")
    ds = [("Counts only the corners and forgets that f is not even continuous at x = %d." % c, corners), ("Counts every vertex of the graph in (0, 8) as a point where f is not differentiable, including the vertex where the two slopes agree.", 3),
          ("Counts only the discontinuity.", 1), ("Counts every vertex including the discontinuity twice, once as a break and once as a corner.", 4)]
    pool = opts(ds, key, lambda z: "$%d$" % z)
    stem = "The graph of the function $f$ is shown on the interval $0\\le x\\le 8$. It consists of line segments. For how many values of $x$ in the open interval $(0,8)$ is $f$ not differentiable?"
    k = Opt("$%d$" % key, True, "f is not differentiable at the discontinuity (x = %d) and at each corner where the slope changes (%d of them); a vertex where the two slopes are equal is differentiable." % (c, corners), key)
    bpr = bp("g_count_nondiff", "2.4", "3.D", "not_allowed", "Count points of non-differentiability from a graph with a discontinuity and corners",
             ["Recognize that a jump discontinuity prevents differentiability", "At each continuous vertex compare the slopes on both sides to detect corners", "Add the discontinuity and the corners"],
             [("a function is differentiable at a point only if it is continuous there and the one-sided slopes agree", "theorem connecting differentiability and continuity")],
             [("forgets_discontinuity", "counts corners only"), ("counts_all_vertices", "counts a smooth vertex"), ("only_discontinuity", "counts only the break")],
             "numerical one-sided difference slopes and one-sided values around each interior vertex on the plotted pieces (independent of the vertex slope list)", {"type": "graph", "must_include": ["four line segments", "an open circle and a filled point at the discontinuity"]})
    return gpack("g_count_nondiff", "2.4", "3.D", "not_allowed", stem, k, pool, rng, _pstim("Graph of f: line segments with a jump (open and filled circles) at x = %d." % c, pieces, [], axis("x", 0, 8, 1), _yax(pieces, [])), bpr, 95, [f"v={v}", f"c={c}", f"key={key}"])
