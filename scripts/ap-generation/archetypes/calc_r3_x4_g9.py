"""BC4·BC5 확대 라운드(2026-10-19) 단원 9 그래프 필수 새 원형: 두 속도 성분 그래프에서 속력이 증가하는 시각, 운동 방향. 구간선형 그래프 + 정확한 유리수, 별도 수치 경로로 재확인."""
from calc_r3_x4_lib import *
from fractions import Fraction as Fr

XS5 = [0, 2, 4, 6, 8]


def W(text, why):
    return Opt(text, False, why, None)


def _axes(vals, xl="t", yl="velocity"):
    lo = min(0, min(z for vs in vals for z in vs)) - 1
    hi = max(0, max(z for vs in vals for z in vs)) + 1
    return axis(xl, 0, 8, 1), axis(yl, lo, hi, 1)


# 9.6 속력 증가: 두 속도 성분 그래프에서 v . a > 0 인 시각
def g_x4_speed_increasing_graphs(rng):
    times = [1, 3, 5, 7]
    for _ in forever():
        px_, py_ = rng.randint(0, 1), rng.randint(0, 1)  # 한 그래프의 꼭짓점 값은 홀짝이 같다: 선분 중점의 값과 기울기가 정수
        vx, vy = [2 * rng.randint(-3, 3) + px_ for _ in range(5)], [2 * rng.randint(-3, 3) + py_ for _ in range(5)]
        xf, yf = PL(XS5, vx), PL(XS5, vy)
        dots = []
        for tt in times:
            i = (tt - 1) // 2
            dots.append(xf.at(tt) * xf.slope_seg(i) + yf.at(tt) * yf.slope_seg(i))
        pos = [i for i, d in enumerate(dots) if d > 0]
        if len(pos) == 1 and all(d != 0 for d in dots) and any(xf.at(t_) == 0 or yf.at(t_) == 0 for t_ in times) is False:
            break
    ki = pos[0]
    key_t_ = times[ki]
    spf = lambda u: math.hypot(xf.num(u), yf.num(u))
    for tt, d in zip(times, dots):  # 독립 경로: 속력의 중심차분의 부호
        if ((spf(tt + 1e-4) - spf(tt - 1e-4)) > 0) != (d > 0):
            raise ValueError("independent_check_failed")
    desc = lambda tt: f"$t={tt}$"
    ds = []
    for tt, d in zip(times, dots):
        if tt == key_t_:
            continue
        i = (tt - 1) // 2
        ds.append(W(desc(tt), f"At $t={tt}$: $x'={fx(xf.at(tt)).strip('$')}$, $x''={fx(xf.slope_seg(i)).strip('$')}$, $y'={fx(yf.at(tt)).strip('$')}$, $y''={fx(yf.slope_seg(i)).strip('$')}$, so $x'x''+y'y''={fx(d).strip('$')}<0$ and the speed is decreasing."))
    i = (key_t_ - 1) // 2
    why = f"At $t={key_t_}$: $x'={fx(xf.at(key_t_)).strip('$')}$, $x''={fx(xf.slope_seg(i)).strip('$')}$, $y'={fx(yf.at(key_t_)).strip('$')}$, $y''={fx(yf.slope_seg(i)).strip('$')}$, so $x'x''+y'y''={fx(dots[ki]).strip('$')}>0$ and the speed is increasing. At the other three times this sum is negative."
    stem = "A particle moves in the $xy$-plane. The graphs of $x'(t)$ and $y'(t)$ for $0\\le t\\le 8$ are shown and each consists of line segments. At which of the following times is the speed of the particle increasing?"
    bpr = bpb("g_x4_speed_increasing_graphs", "9.6", "3.D", "not_allowed", "Decide when planar speed is increasing from the slopes and values of the two velocity-component graphs: x'x'' + y'y'' > 0",
              ["Read each velocity component and its slope (the acceleration component) at the given time", "Form x'x'' + y'y''", "The speed is increasing where this sum is positive"],
              [("d(speed)/dt has the sign of x'x'' + y'y'' when the speed is not 0", "the times are interior to the line segments, so x'' and y'' exist")],
              [("sign_of_x_only", "uses the sign of x'' alone"), ("both_decreasing", "thinks speed falls when a component falls"), ("component_positive", "uses the sign of a velocity component")],
              "central difference of hypot(x'(t), y'(t)) built from the interpolated graphs at each time (independent of the product x'x'' + y'y'')", {"type": "graph", "must_include": ["vertices of x'", "vertices of y'"]})
    return gpack("g_x4_speed_increasing_graphs", "9.6", "3.D", "not_allowed", stem, Opt(desc(key_t_), True, why, key_t_), ds, rng,
                 gstim("Graphs of x'(t) and y'(t), each consisting of line segments connecting the plotted vertices.", [("x'", xf.vert()), ("y'", yf.vert())], *_axes([vx, vy])), bpr, 120, [f"vx={vx}", f"vy={vy}", f"key={key_t_}"])


# 9.5·9.6 운동 방향: 두 속도 성분 그래프에서 한 시각의 부호
def g_x4_motion_direction_graphs(rng):
    for _ in forever():
        px_, py_ = rng.randint(0, 1), rng.randint(0, 1)  # 한 그래프의 꼭짓점 값은 홀짝이 같다: 선분 중점의 값과 기울기가 정수
        vx, vy = [2 * rng.randint(-3, 3) + px_ for _ in range(5)], [2 * rng.randint(-3, 3) + py_ for _ in range(5)]
        a = rng.choice([1, 3, 5, 7])
        xf, yf = PL(XS5, vx), PL(XS5, vy)
        if xf.at(a) != 0 and yf.at(a) != 0:
            break
    sx, sy = xf.at(a) > 0, yf.at(a) > 0
    hor = lambda p: "to the right" if p else "to the left"
    ver = lambda p: "upward" if p else "downward"
    txt = lambda a_, b_: f"The particle is moving {hor(a_)} and {ver(b_)}."
    if (xf.num(a) > 0) != sx or (yf.num(a) > 0) != sy:
        raise ValueError("independent_check_failed")
    key_t = txt(sx, sy)
    why_of = lambda ax_, ay_: ("Reads the horizontal direction from the wrong sign: $x'(%d)$ is %s." % (a, "positive" if sx else "negative")) if ax_ != sx and ay_ == sy else (("Reads the vertical direction from the wrong sign: $y'(%d)$ is %s." % (a, "positive" if sy else "negative")) if ay_ != sy and ax_ == sx else "Reverses both components: the signs of $x'(%d)$ and $y'(%d)$ are the opposite of the direction stated." % (a, a))
    ds = [W(txt(ax_, ay_), why_of(ax_, ay_)) for ax_ in (True, False) for ay_ in (True, False) if (ax_, ay_) != (sx, sy)]
    stem = f"A particle moves in the $xy$-plane. The graphs of $x'(t)$ and $y'(t)$ for $0\\le t\\le 8$ are shown and each consists of line segments. Which of the following describes the motion of the particle at $t={a}$?"
    bpr = bpb("g_x4_motion_direction_graphs", "9.6", "2.B", "not_allowed", "Describe the direction of planar motion from the signs of the two velocity components read from graphs",
              ["Read x'(a) and y'(a) from the two graphs", "A positive x' means moving right and a negative x' means moving left", "A positive y' means moving up and a negative y' means moving down"],
              [("the direction of motion is given by the signs of x' and y'", "both components are nonzero at the given time")],
              [("horizontal_sign_flipped", "wrong horizontal direction"), ("vertical_sign_flipped", "wrong vertical direction"), ("both_flipped", "both directions reversed")],
              "values of the interpolated graphs at t = a computed numerically (independent of reading the plotted vertices)", {"type": "graph", "must_include": ["vertices of x'", "vertices of y'"]})
    why = f"At $t={a}$, $x'({a})={fx(xf.at(a)).strip('$')}$ is {'positive' if sx else 'negative'} (moving {hor(sx)}) and $y'({a})={fx(yf.at(a)).strip('$')}$ is {'positive' if sy else 'negative'} (moving {ver(sy)})."
    return gpack("g_x4_motion_direction_graphs", "9.6", "2.B", "not_allowed", stem, Opt(key_t, True, why, None), ds, rng,
                 gstim("Graphs of x'(t) and y'(t), each consisting of line segments connecting the plotted vertices.", [("x'", xf.vert()), ("y'", yf.vert())], *_axes([vx, vy])), bpr, 75, [f"vx={vx}", f"vy={vy}", f"a={a}"])


STAGE_LISTS = {"supp_x4d_bc": ["g_x4_speed_increasing_graphs", "g_x4_motion_direction_graphs"]}
