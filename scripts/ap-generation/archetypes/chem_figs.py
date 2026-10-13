"""AP Chemistry 결정적 그림(2026-10-13 P0, 같은 날 TS 렌더 연결). 원칙은 Physics 와 같다: 본문 수치와 그림은 같은 변수(장면 모델)에서 파생되고 LLM 은 그림을 그리지 않는다.
장면 모델 2종: `pes`(광전자 스펙트럼 — 결합 에너지 로그 축, 오른쪽이 낮은 에너지, 봉우리 높이 = 상대 전자 수), `particles`(입자 상자 — 종류별 개수 또는 상 배열).
TS 쪽 기준 구현은 `lib/problem-figures/templates/ap-chem-scene.ts` 이며 두 렌더는 같은 기하(좌표·글자)를 낸다(Vitest 가 숫자 단위로 대조).
그래프형 그림(적정 곡선, 농도-시간, 속도 분포, 가열 곡선, 에너지 도표, 포텐셜 곡선, 증기압)은 기존 `ap_graph` 규약(graph_stim)으로 만든다.
분자 구조식(Lewis 그림)은 결정적 생성이 불가능해 그리지 않는다: 학생 화면은 텍스트·표로 제시하고, FRQ 의 구조식 그리기는 종이 손글씨 + 루브릭 체크리스트로 다룬다.
화면에 보이지 않는 값(예: 원소의 원자 번호 Z)은 장면에 넣지 않는다 — 정답 누출 방지."""
import math
import re

W, H = 360, 220
FONT = "Georgia, 'Times New Roman', serif"
PARTICLE_COLORS = ["#1f77b4", "#d62728", "#2ca02c", "#9467bd"]
PHASES = ("solid", "liquid", "gas")
BOX = (20, 15, 340, 175)  # x0, y0, x1, y1
CELL = 26
COLS, ROWS = 12, 6  # 격자 배치 최대 72


def _esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _g(v):
    return f"{v:g}"


def _wrap(body, alt):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" style="max-width:100%;height:auto" role="img" aria-label="{_esc(alt)}" font-family="{FONT}">{body}</svg>'


def _n1(v):
    return f"{v:.1f}"


class _Lcg:
    """Park–Miller 최소 표준 생성기(정수만 사용 — TS 와 비트 단위로 같은 열)."""

    def __init__(self, seed):
        self.s = (int(seed) % 2147483646) + 1

    def next(self):
        self.s = (self.s * 48271) % 2147483647
        return self.s

    def below(self, n):
        return self.next() % n


def pretty_species(sp):
    """'SO42-' -> ('SO4', '2-'), 'Ca2+' -> ('Ca', '2+'), 'Na+' -> ('Na', '+'), 'H2' -> ('H2', ''). NH4+/H3O+ 는 전하 숫자를 읽지 않는다."""
    if sp in ("NH4+", "H3O+"):
        return sp[:-1], "+"
    if not sp.endswith(("+", "-")):
        return sp, ""
    rest, sign = sp[:-1], sp[-1]
    if rest and rest[-1].isdigit():
        return rest[:-1], rest[-1] + sign
    return rest, sign


def _label(x, y, sp, size=11, anchor="start"):
    """종 이름을 아래·위첨자 tspan 으로(숫자는 아래첨자, 전하는 위첨자)."""
    base, charge = pretty_species(sp)
    parts = []
    for tok in re.findall(r"\d+|[^\d]+", base):
        if tok.isdigit():
            parts.append(f'<tspan baseline-shift="sub" font-size="{size - 3}">{tok}</tspan>')
        else:
            parts.append(_esc(tok))
    if charge:
        parts.append(f'<tspan baseline-shift="super" font-size="{size - 3}">{_esc(charge)}</tspan>')
    return f'<text x="{_n1(x)}" y="{_n1(y)}" font-size="{size}" text-anchor="{anchor}" fill="#111">{"".join(parts)}</text>'


# ---------------- PES ----------------
PES_X0, PES_X1, PES_YB, PES_YT = 56, 340, 150, 20
PES_ROW_Y = [166, 179, 192]
PES_TITLE_Y = 212


def _pes_xpos(scene):
    es = [p["energy"] for p in scene["peaks"]]
    emin, emax = min(es) / 1.6, max(es) * 1.6
    return lambda e: PES_X0 + (PES_X1 - PES_X0) * (math.log(emax) - math.log(e)) / (math.log(emax) - math.log(emin))


def pes_label_rows(scene):
    """봉우리 값 글자를 왼쪽부터 놓되 겹치면 아래 줄로(최대 3줄). 반환: [(x, row, text)], 겹침 해소 불가 시 row=-1."""
    xp = _pes_xpos(scene)
    out = []
    right_edge = [-1e9, -1e9, -1e9]
    for p in sorted(scene["peaks"], key=lambda q: -q["energy"]):
        x = xp(p["energy"]); t = _g(p["energy"]); w = 5.8 * len(t)
        row = -1
        for r in range(3):
            if x - w / 2 >= right_edge[r] + 3:
                row = r; right_edge[r] = x + w / 2; break
        out.append((x, row, t))
    return out


def render_pes(scene):
    peaks = scene["peaks"]
    maxn = max(p["electrons"] for p in peaks)
    xp = _pes_xpos(scene)
    unit = scene.get("unit", "MJ/mol")
    out = [f'<line x1="{PES_X0 - 8}" y1="{PES_YB}" x2="{PES_X1 + 8}" y2="{PES_YB}" stroke="#111" stroke-width="1.5"/>', f'<line x1="{PES_X0 - 8}" y1="{PES_YT - 6}" x2="{PES_X0 - 8}" y2="{PES_YB}" stroke="#111" stroke-width="1.5"/>']
    for k in range(1, maxn + 1):
        yy = PES_YB - (PES_YB - PES_YT) * k / maxn
        out.append(f'<line x1="{PES_X0 - 8}" y1="{_n1(yy)}" x2="{PES_X1 + 8}" y2="{_n1(yy)}" stroke="#ddd" stroke-width="0.6"/><text x="{PES_X0 - 12}" y="{_n1(yy + 3)}" font-size="9" text-anchor="end" fill="#555">{k}</text>')
    out.append(f'<text x="14" y="{(PES_YB + PES_YT) // 2}" font-size="10" text-anchor="middle" fill="#111" transform="rotate(-90 14 {(PES_YB + PES_YT) // 2})">Relative number of electrons</text>')
    for p in peaks:
        x = xp(p["energy"]); h = (PES_YB - PES_YT) * p["electrons"] / maxn
        out.append(f'<line x1="{_n1(x)}" y1="{PES_YB}" x2="{_n1(x)}" y2="{_n1(PES_YB - h)}" stroke="#111" stroke-width="3"/>')
    for x, row, t in pes_label_rows(scene):
        yy = PES_ROW_Y[max(row, 0)]
        out.append(f'<line x1="{_n1(x)}" y1="{PES_YB}" x2="{_n1(x)}" y2="{yy - 10}" stroke="#888" stroke-width="0.8"/><text x="{_n1(x)}" y="{yy}" font-size="10" text-anchor="middle" fill="#111">{t}</text>')
    out.append(f'<text x="{(PES_X0 + PES_X1) // 2}" y="{PES_TITLE_Y}" font-size="12" text-anchor="middle" fill="#111">Binding energy ({_esc(unit)}, log scale)</text>')
    return _wrap("".join(out), alt_pes(scene))


def alt_pes(scene):
    pk = sorted(scene["peaks"], key=lambda p: -p["energy"])
    return ("Photoelectron spectrum with " + str(len(pk)) + " peaks on a logarithmic binding-energy axis with the highest energy at the left. Peaks (binding energy in " + scene.get("unit", "MJ/mol") + ", relative number of electrons): " + "; ".join(f"{_g(p['energy'])}, {p['electrons']}" for p in pk) + ". Peak heights are proportional to the relative number of electrons.")


# ---------------- 입자 ----------------
R_P = 9


def _phase_of(scene):
    if scene.get("phase") in PHASES:
        return scene["phase"]
    a = scene.get("arrangement", "")
    return "solid" if a.startswith("regular") else ("gas" if "gaps" in a else "liquid")


def _rsa(rng, n, mind, attempts):
    """무작위 순차 추가(정수 좌표): 최소 거리 mind 를 지키며 최대 n 개."""
    x0, y0, x1, y1 = BOX
    pts = []
    for _ in range(attempts):
        if len(pts) >= n:
            break
        x = x0 + R_P + 1 + rng.below(x1 - x0 - 2 * R_P - 1)
        y = y0 + R_P + 1 + rng.below(y1 - y0 - 2 * R_P - 1)
        if all((x - a) ** 2 + (y - b) ** 2 >= mind * mind for a, b in pts):
            pts.append((x, y))
    return pts


def particle_positions(scene):
    """[(x, y, species_index)] — 결정적. box 가 있으면 종별 개수를 격자 칸에 무작위로 놓고, 없으면 상(solid/liquid/gas)에 맞게 놓는다."""
    x0, y0, x1, y1 = BOX
    if scene.get("box"):
        groups = scene["box"]
        total = sum(g["count"] for g in groups)
        rng = _Lcg(total * 13 + len(groups) * 7 + sum(g["count"] * (i + 3) for i, g in enumerate(groups)))
        cells = list(range(COLS * ROWS))
        for i in range(len(cells) - 1, 0, -1):
            j = rng.below(i + 1)
            cells[i], cells[j] = cells[j], cells[i]
        pos = []; k = 0
        for gi, g in enumerate(groups):
            for _ in range(g["count"]):
                c = cells[k]; k += 1
                r, col = divmod(c, COLS)
                pos.append((x0 + 14 + col * CELL, y0 + 14 + r * CELL, gi))
        return pos
    ph = _phase_of(scene)
    if ph == "solid":
        pos = []
        for r in range(9):
            for c in range(15):
                x = x0 + 10 + c * 20 + (r % 2) * 10; y = y0 + 10 + r * 17
                if x <= x1 - 10 and y <= y1 - 9:
                    pos.append((x, y, 0))
        return pos
    rng = _Lcg(911 if ph == "liquid" else 313)
    pts = _rsa(rng, 90, 19, 9000) if ph == "liquid" else _rsa(rng, 12, 52, 2000)
    return [(x, y, 0) for x, y in pts]


def render_particles(scene):
    x0, y0, x1, y1 = BOX
    out = [f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="none" stroke="#111" stroke-width="1.5"/>']
    pos = particle_positions(scene)
    for x, y, gi in pos:
        out.append(f'<circle cx="{x}" cy="{y}" r="{R_P if not scene.get("box") else 8}" fill="{PARTICLE_COLORS[gi % 4]}" stroke="#111" stroke-width="0.6"/>')
    if scene.get("box"):
        groups = scene["box"]
        step = (W - 40) / len(groups)
        for gi, g in enumerate(groups):
            lx = 20 + step * gi
            out.append(f'<circle cx="{_n1(lx + 8)}" cy="196" r="6" fill="{PARTICLE_COLORS[gi % 4]}" stroke="#111" stroke-width="0.6"/>')
            out.append(_label(lx + 20, 200, g["species"], 12))
    return _wrap("".join(out), alt_particles(scene))


def alt_particles(scene):
    if scene.get("box"):
        parts = []
        for g in scene["box"]:
            base, charge = pretty_species(g["species"])
            parts.append(f"{g['count']} particle{'s' if g['count'] != 1 else ''} of {base}{charge}")
        return "Particulate diagram of a box containing " + ", ".join(parts) + ". The key below the box shows which color is which species."
    ph = _phase_of(scene)
    d = {"solid": "particles in a regular repeating pattern, all touching their neighbors", "liquid": "particles in a random arrangement, close together and touching", "gas": "a few particles in a random arrangement with large gaps between them"}[ph]
    return "Particulate diagram of one pure substance: " + d + "."


def render(variant, data):
    if variant == "chem_pes":
        return render_pes(data if "peaks" in data else data["scene"])
    return render_particles(data["scene"])


def scene_of(variant, data):
    return {"type": "pes", "peaks": data["peaks"], "unit": data.get("unit", "MJ/mol")} if variant == "chem_pes" else data["scene"]


def check_pes(scene, z=None):
    """결정적 검사: 봉우리 에너지 엄격 감소(오른쪽으로), 전자 수 양수 정수, 합 = Z(주어졌으면 — Z 는 화면 데이터에 넣지 않으므로 테스트가 설계도 사실에서 넘긴다), 값 글자 겹침 없음, viewBox 안."""
    pk = scene["peaks"]
    es = [p["energy"] for p in pk]
    errs = []
    if any(es[i] <= es[i + 1] for i in range(len(es) - 1)):
        errs.append("energies_not_decreasing")
    if any(p["electrons"] < 1 or p["electrons"] != int(p["electrons"]) for p in pk):
        errs.append("electron_counts")
    if z is not None and sum(p["electrons"] for p in pk) != z:
        errs.append("electron_total_ne_z")
    if len(pk) > 8:
        errs.append("too_many_peaks")
    if any(r == -1 for _, r, _ in pes_label_rows(scene)):
        errs.append("peak_labels_overlap")
    errs.extend(_viewbox_issues(render_pes(scene)))
    return errs


def check_particles(scene):
    errs = []
    if scene.get("box"):
        n = sum(g["count"] for g in scene["box"])
        if n > COLS * ROWS:
            errs.append("too_many_particles")
        if any(g["count"] < 0 or g["count"] != int(g["count"]) for g in scene["box"]) or not (1 <= len(scene["box"]) <= 4):
            errs.append("bad_counts")
        if len({g["species"] for g in scene["box"]}) != len(scene["box"]):
            errs.append("duplicate_species")
    else:
        if scene.get("phase") not in PHASES and not scene.get("arrangement"):
            errs.append("no_phase")
        if "packing_fraction" in scene and not (0 < scene["packing_fraction"] < 0.8):
            errs.append("packing_fraction")
    errs.extend(_viewbox_issues(render_particles(scene)))
    return errs


def _viewbox_issues(svg):
    out = []
    if re.search(r"NaN|Infinity", svg):
        out.append("svg_nonfinite")
    for m in re.finditer(r'\b(?:x|x1|x2|cx)="(-?[0-9.]+)"', svg):
        if float(m.group(1)) < -1 or float(m.group(1)) > W + 1:
            out.append("outside_viewbox"); break
    for m in re.finditer(r'\b(?:y|y1|y2|cy)="(-?[0-9.]+)"', svg):
        if float(m.group(1)) < -1 or float(m.group(1)) > H - 3:
            out.append("outside_viewbox"); break
    return out


def describe_for_review(variant, data):
    """LLM 풀이자·검토자용 '학생이 보는 그림' 텍스트(결정적, 장면에서만 파생)."""
    sc = scene_of(variant, data)
    return alt_pes(sc) if variant == "chem_pes" else alt_particles(sc)
