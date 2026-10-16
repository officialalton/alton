"""AP Physics 1 장면 모델(scene model)과 결정적 SVG 렌더 도우미(2026-10-13, P0).
원칙: 본문 수치와 그림은 같은 변수(장면 모델)에서 파생된다. LLM 은 그림을 그리지 않는다. 장면 모델 = JSON(type + 요소). 렌더는 순수 함수(SVG 문자열),
검사(check_scene)는 결정적이다: viewBox 내부, 화살표 길이 ∝ 크기, 평형이면 힘 합 0, 에너지 막대 보존, 라벨 겹침.
TS 쪽 `ap_diagram` 렌더러 연결(W4-W8)은 아직 없다 — 이 렌더는 (a) render-check 갤러리와 (b) 파이프라인 결정적 게이트용 기준 구현이다.
지원 type: fbd, energy_bars, vector, motion_diagram, incline, atwood, collision, beam, utube, tank_hole."""
import math

W, H = 360, 240


def _arrow(x0, y0, x1, y1, color="#111", w=2.2):
    a = math.atan2(y1 - y0, x1 - x0)
    hx, hy = 8, 4
    p1 = (x1 - hx * math.cos(a) + hy * math.sin(a), y1 - hx * math.sin(a) - hy * math.cos(a))
    p2 = (x1 - hx * math.cos(a) - hy * math.sin(a), y1 - hx * math.sin(a) + hy * math.cos(a))
    return (f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="{w}"/>'
            f'<polygon points="{x1:.1f},{y1:.1f} {p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}" fill="{color}"/>')


def _text(x, y, s, size=13, anchor="middle", color="#111"):
    s = str(s).replace("&", "&amp;").replace("<", "&lt;")
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" font-family="serif" fill="{color}">{s}</text>'


def _wrap(body, w=W, h=H):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img">{body}</svg>'


# ---------- 힘 목록 -> 화살표 ----------
def fbd_vectors(scene):
    """각 힘의 화살표 끝 좌표(px). 길이 = mag * scale. 반환: [(force, (dx, dy))] (SVG 좌표: y 아래로)."""
    out = []
    for f in scene["forces"]:
        L = f["mag"] * scene["scale"]
        a = math.radians(f["angle"])
        out.append((f, (L * math.cos(a), -L * math.sin(a))))
    return out


def fbd_scale_for(mags, max_px=80.0):  # 95 에서 80 으로: 아래쪽 화살표 끝+라벨이 viewBox(240) 밖으로 잘렸다(P1-a 화면 증거 확인)
    return max_px / max(mags)


def make_fbd(forces, equilibrium=None, body="box", note=None):
    """forces: [{id, label, angle(도, 반시계, 오른쪽=0), mag(N)}]. scale 은 코드가 최대 힘이 95px 가 되게 계산한다."""
    sc = {"type": "fbd", "body": body, "forces": [dict(f) for f in forces], "scale": fbd_scale_for([f["mag"] for f in forces]), "equilibrium": equilibrium}
    if equilibrium is None:
        sx = sum(f["mag"] * math.cos(math.radians(f["angle"])) for f in forces)
        sy = sum(f["mag"] * math.sin(math.radians(f["angle"])) for f in forces)
        sc["equilibrium"] = math.hypot(sx, sy) < 1e-6 * max(f["mag"] for f in forces)
    if note:
        sc["note"] = note
    return sc


def render_fbd(sc):
    cx, cy = W / 2, H / 2
    parts = [f'<rect x="{cx - 18}" y="{cy - 18}" width="36" height="36" fill="#eee" stroke="#111"/>' if sc["body"] == "box" else f'<circle cx="{cx}" cy="{cy}" r="5" fill="#111"/>']
    for f, (dx, dy) in fbd_vectors(sc):
        x0 = cx + (18 * math.cos(math.radians(f["angle"])) if sc["body"] == "box" else 0)
        y0 = cy - (18 * math.sin(math.radians(f["angle"])) if sc["body"] == "box" else 0)
        parts.append(_arrow(x0, y0, x0 + dx, y0 + dy))
        parts.append(_text(x0 + dx * 1.0 + (12 if dx >= 0 else -12) * (abs(dx) > abs(dy) * 0.5), y0 + dy + (-6 if dy < 0 else 14), f["label"]))
    return _wrap("".join(parts))


# ---------- 에너지 막대 ----------
BAR_KEYS = ["K", "Ug", "Us", "Eint"]


def make_bars(states, unit="J", conserved=True):
    """states: [{name, bars:{K,Ug,Us,Eint}}]. 같은 눈금. conserved=True 면 각 상태 막대 합이 같아야 한다(check_scene 이 검증)."""
    top = max(sum(s["bars"].get(k, 0) for k in BAR_KEYS) for s in states)
    return {"type": "energy_bars", "states": states, "unit": unit, "conserved": conserved, "ymax": top}


def render_bars(sc):
    n = len(sc["states"]); gw = (W - 40) / n; base = H - 40; sc_y = (base - 20) / sc["ymax"]
    parts = [f'<line x1="20" y1="{base}" x2="{W - 10}" y2="{base}" stroke="#111"/>']
    for i, s in enumerate(sc["states"]):
        x0 = 20 + gw * i + 10
        for j, k in enumerate(BAR_KEYS):
            v = s["bars"].get(k, 0)
            bw = (gw - 20) / 4
            hgt = v * sc_y
            parts.append(f'<rect x="{x0 + bw * j:.1f}" y="{base - hgt:.1f}" width="{bw - 3:.1f}" height="{hgt:.1f}" fill="#999" stroke="#111"/>')
            parts.append(_text(x0 + bw * j + bw / 2 - 1.5, base + 13, k, 10))
        parts.append(_text(x0 + (gw - 20) / 2, base + 28, s["name"], 11))
    return _wrap("".join(parts))


# ---------- 벡터(꼬리-머리) ----------
def make_vectors(vecs, resultant=True):
    """vecs: [{label, dx, dy}] (물리 단위, y 위로)."""
    return {"type": "vector", "vectors": vecs, "resultant": resultant}


def render_vectors(sc):
    mx = max(max(abs(v["dx"]), abs(v["dy"])) for v in sc["vectors"]) or 1
    k = 70 / mx
    x, y = 60, H - 60
    parts = []
    for v in sc["vectors"]:
        x1, y1 = x + v["dx"] * k, y - v["dy"] * k
        parts.append(_arrow(x, y, x1, y1)); parts.append(_text((x + x1) / 2, (y + y1) / 2 - 7, v["label"]))
        x, y = x1, y1
    if sc["resultant"]:
        parts.append(_arrow(60, H - 60, x, y, "#b00"))
    return _wrap("".join(parts))


# ---------- 운동 도해 ----------
def make_motion_diagram(xs, vs):
    """xs: 위치(등간격 시각), vs: 각 점의 속도(부호 있음). 화살표 길이 ∝ |v|."""
    return {"type": "motion_diagram", "xs": xs, "vs": vs}


def render_motion(sc):
    xs, vs = sc["xs"], sc["vs"]
    lo, hi = min(xs), max(xs); sx = (W - 100) / ((hi - lo) or 1); vm = max(abs(v) for v in vs) or 1
    parts = [f'<line x1="20" y1="150" x2="{W - 20}" y2="150" stroke="#bbb"/>']
    for x, v in zip(xs, vs):
        px = 50 + (x - lo) * sx
        parts.append(f'<circle cx="{px:.1f}" cy="150" r="4" fill="#111"/>')
        if v:
            parts.append(_arrow(px, 130, px + 36 * v / vm, 130))
    return _wrap("".join(parts))


# ---------- 경사면 / 도르래 / 충돌 / 막대 / U자관 / 구멍 탱크 ----------
def make_incline(theta_deg, mass_kg, mu=None, kind="block"):
    return {"type": "incline", "theta": theta_deg, "m": mass_kg, "mu": mu, "kind": kind}


def render_incline(sc):
    th = math.radians(sc["theta"]); L = 220
    bx, by = 40 + L * math.cos(th), H - 30
    parts = [f'<polygon points="40,{H - 30} {bx:.1f},{by:.1f} {bx:.1f},{by - L * math.sin(th):.1f}" fill="#ddd" stroke="#111"/>',
             _text(70, H - 36, f'{sc["theta"]:g}°', 12), _text(bx - 60, by - L * math.sin(th) / 2, f'{sc["m"]:g} kg', 12)]
    return _wrap("".join(parts))


def make_atwood(m1, m2, table=False, mu=None):
    return {"type": "atwood", "m1": m1, "m2": m2, "table": table, "mu": mu}


def render_atwood(sc):
    parts = ['<circle cx="180" cy="50" r="18" fill="#eee" stroke="#111"/>']
    if sc["table"]:
        parts = ['<rect x="60" y="70" width="140" height="10" fill="#ccc" stroke="#111"/><circle cx="215" cy="75" r="12" fill="#eee" stroke="#111"/>',
                 '<rect x="110" y="48" width="30" height="22" fill="#eee" stroke="#111"/><line x1="140" y1="59" x2="203" y2="59" stroke="#111"/><line x1="227" y1="75" x2="227" y2="150" stroke="#111"/>',
                 '<rect x="212" y="150" width="30" height="30" fill="#eee" stroke="#111"/>', _text(125, 64, f'{sc["m1"]:g} kg', 10), _text(227, 170, f'{sc["m2"]:g} kg', 10)]
        return _wrap("".join(parts))
    parts += ['<line x1="162" y1="50" x2="162" y2="140" stroke="#111"/><line x1="198" y1="50" x2="198" y2="170" stroke="#111"/>',
              '<rect x="147" y="140" width="30" height="30" fill="#eee" stroke="#111"/><rect x="183" y="170" width="30" height="30" fill="#eee" stroke="#111"/>',
              _text(162, 160, f'{sc["m1"]:g}', 11), _text(198, 190, f'{sc["m2"]:g}', 11)]
    return _wrap("".join(parts))


def make_collision(before, after=None):
    """before/after: [{m, v}] (v 부호 있음, 오른쪽 +). after 가 None 이면 '충돌 전'만."""
    return {"type": "collision", "before": before, "after": after}


def render_collision(sc):
    parts = []
    for row, (lab, objs) in enumerate([("Before", sc["before"]), ("After", sc["after"])]):
        if objs is None:
            continue
        y = 70 + row * 100
        parts.append(_text(30, y - 25, lab, 11, "start"))
        for i, o in enumerate(objs):
            x = 90 + 150 * i
            parts.append(f'<rect x="{x - 20}" y="{y - 16}" width="40" height="32" fill="#eee" stroke="#111"/>')
            parts.append(_text(x, y + 4, f'{o["m"]:g} kg', 10))
            if o["v"]:
                parts.append(_arrow(x, y - 24, x + (50 if o["v"] > 0 else -50) * min(1, abs(o["v"]) / 5), y - 24)); parts.append(_text(x, y - 32, f'{abs(o["v"]):g} m/s', 10))
    return _wrap("".join(parts))


def make_beam(length, pivot_x, forces):
    """forces: [{x(피벗 기준 아님, 왼쪽 끝에서 거리), mag, dir('up'|'down'), label}]"""
    return {"type": "beam", "length": length, "pivot": pivot_x, "forces": forces}


def render_beam(sc):
    k = 280 / sc["length"]; x0 = 40; y = 120
    parts = [f'<rect x="{x0}" y="{y - 4}" width="{sc["length"] * k:.1f}" height="8" fill="#ddd" stroke="#111"/>',
             f'<polygon points="{x0 + sc["pivot"] * k:.1f},{y + 4} {x0 + sc["pivot"] * k - 10:.1f},{y + 26} {x0 + sc["pivot"] * k + 10:.1f},{y + 26}" fill="#999" stroke="#111"/>']
    for f in sc["forces"]:
        px = x0 + f["x"] * k
        d = 1 if f["dir"] == "down" else -1
        parts.append(_arrow(px, y - 44 if d > 0 else y + 44, px, y - 4 if d > 0 else y + 4))
        parts.append(_text(px, (y - 50 if d > 0 else y + 60), f["label"], 11))
    return _wrap("".join(parts))


def make_utube(h1, h2, rho1, rho2):
    return {"type": "utube", "h1": h1, "h2": h2, "rho1": rho1, "rho2": rho2}


def render_utube(sc):
    parts = ['<path d="M110,40 V200 H250 V40" fill="none" stroke="#111" stroke-width="3"/>',
             f'<rect x="113" y="{200 - sc["h1"] * 10:.1f}" width="34" height="{sc["h1"] * 10:.1f}" fill="#bcd"/>',
             f'<rect x="213" y="{200 - sc["h2"] * 10:.1f}" width="34" height="{sc["h2"] * 10:.1f}" fill="#dcb"/>',
             _text(130, 30, f'{sc["rho1"]:g} kg/m³', 10), _text(230, 30, f'{sc["rho2"]:g} kg/m³', 10)]
    return _wrap("".join(parts))


def make_tank_hole(depth, hole_height, tank_height):
    return {"type": "tank_hole", "depth": depth, "hole_height": hole_height, "tank_height": tank_height}


def render_tank(sc):
    k = 170 / sc["tank_height"]; base = 210
    top = base - sc["tank_height"] * k; wl = base - (sc["hole_height"] + sc["depth"]) * k; hy = base - sc["hole_height"] * k
    return _wrap(f'<rect x="100" y="{top:.1f}" width="90" height="{base - top:.1f}" fill="none" stroke="#111" stroke-width="3"/>'
                 f'<rect x="102" y="{wl:.1f}" width="86" height="{base - wl - 1.5:.1f}" fill="#bcd"/><circle cx="190" cy="{hy:.1f}" r="4" fill="#111"/>'
                 + _text(150, wl - 6, f'depth {sc["depth"]:g} m', 10))


RENDER = {"fbd": render_fbd, "energy_bars": render_bars, "vector": render_vectors, "motion_diagram": render_motion, "incline": render_incline,
          "atwood": render_atwood, "collision": render_collision, "beam": render_beam, "utube": render_utube, "tank_hole": render_tank}


def render_svg(scene):
    return RENDER[scene["type"]](scene)


# ---------- 결정적 검사 ----------
def scene_numbers(scene):
    """장면 모델에서 학생에게 보이는 숫자 집합(문자열). 본문과 일치 검사(W10)에 쓴다."""
    t = scene["type"]; out = set()
    def add(v):
        out.add(f"{v:g}" if isinstance(v, (int, float)) else str(v))
    if t == "fbd":
        for f in scene["forces"]:
            if "value" in f:
                add(f["value"])
    elif t == "incline":
        add(scene["theta"]); add(scene["m"])
    elif t == "atwood":
        add(scene["m1"]); add(scene["m2"])
    elif t == "collision":
        for row in (scene["before"], scene["after"] or []):
            for o in row:
                add(o["m"]); add(abs(o["v"])) if o["v"] else None
    elif t == "utube":
        add(scene["rho1"]); add(scene["rho2"])
    elif t == "tank_hole":
        add(scene["depth"])
    return out


def check_scene(scene):
    """오류 코드 목록(빈 리스트면 통과)."""
    issues = []
    t = scene.get("type")
    if t not in RENDER:
        return ["unknown_scene_type"]
    if t == "fbd":
        vec = fbd_vectors(scene)
        for f, (dx, dy) in vec:
            if abs(math.hypot(dx, dy) - f["mag"] * scene["scale"]) > 1e-6:
                issues.append("arrow_length_not_proportional")
            if math.hypot(dx, dy) < 6:
                issues.append("arrow_too_short")
        if scene.get("equilibrium"):
            sx = sum(f["mag"] * math.cos(math.radians(f["angle"])) for f in scene["forces"])
            sy = sum(f["mag"] * math.sin(math.radians(f["angle"])) for f in scene["forces"])
            if math.hypot(sx, sy) > 1e-6 * max(f["mag"] for f in scene["forces"]):
                issues.append("equilibrium_sum_not_zero")
        labels = [f["label"] for f in scene["forces"]]
        if len(set(labels)) != len(labels):
            issues.append("duplicate_force_label")
        ends = [(round(dx), round(dy)) for _, (dx, dy) in vec]
        if len(set(ends)) != len(ends) and not scene.get("allow_overlap"):
            issues.append("arrow_overlap")
    elif t == "energy_bars":
        if scene.get("conserved"):
            tots = [sum(s["bars"].get(k, 0) for k in BAR_KEYS) for s in scene["states"]]
            if max(tots) - min(tots) > 1e-6 * max(tots):
                issues.append("energy_not_conserved")
        if any(v < 0 for s in scene["states"] for v in s["bars"].values()):
            issues.append("negative_bar")
    elif t == "collision":
        for row in (scene["before"], scene["after"] or []):
            if any(o["m"] <= 0 for o in row):
                issues.append("nonpositive_mass")
    elif t == "utube":
        if scene["h1"] <= 0 or scene["h2"] <= 0:
            issues.append("nonpositive_height")
    svg = render_svg(scene)
    if "NaN" in svg or "inf" in svg:
        issues.append("svg_nonfinite")
    import re
    # 축별 범위(2026-10-13 수정: 예전에는 max(W,H) 로만 비교해 y 가 H 를 넘어도 통과했다). 글자 기준선은 하단 3px 여유를 둔다.
    for m in re.finditer(r'(x|x1|x2|cx)="(-?[0-9.]+)"', svg):
        if float(m.group(2)) < -1 or float(m.group(2)) > W + 1:
            issues.append("outside_viewbox"); break
    for m in re.finditer(r'(y|y1|y2|cy)="(-?[0-9.]+)"', svg):
        if float(m.group(2)) < -1 or float(m.group(2)) > H - 3:
            issues.append("outside_viewbox"); break
    return issues


def choice_checks(scenes, correct_index):
    """선택지가 그림(scene)인 문항: 같은 type·같은 크기 모델, 서로 구별, 정답만 특별한 보조 요소(note)를 갖지 않는다."""
    issues = []
    if len({s["type"] for s in scenes}) != 1:
        issues.append("mixed_scene_types")
    if len({str(sorted((k, str(v)) for k, v in s.items() if k != "note")) for s in scenes}) != len(scenes):
        issues.append("duplicate_choice_scene")
    if any("note" in s for s in scenes):
        issues.append("choice_has_note")
    if scenes[0]["type"] == "fbd":
        n = [len(s["forces"]) for s in scenes]
        if n[correct_index] == max(n) and n.count(max(n)) == 1:
            issues.append("correct_has_most_elements")  # 길이 단서 방지
    return issues
