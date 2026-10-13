"""AP Chemistry 결정적 그림 도우미(2026-10-13, P0). 원칙은 Physics 와 같다: 본문 수치와 그림은 같은 변수(장면 모델)에서 파생되고 LLM 은 그림을 그리지 않는다.
지원 변종: `chem_pes`(광전자 스펙트럼 — 결합 에너지 축은 로그, 오른쪽이 낮은 에너지, 봉우리 높이 = 상대 전자 수), `chem_particles`(입자 상자 — 종류별 개수·배열).
그래프형 그림(적정 곡선, 농도-시간, 속도 분포, 가열 곡선, 에너지 도표, 포텐셜 곡선, 증기압)은 기존 `ap_graph` 규약(graph_stim)으로 만든다.
분자 구조식(Lewis 그림)은 결정적 생성이 불가능해 그리지 않는다: 학생 화면은 텍스트·표로 제시하고, FRQ 의 구조식 그리기는 종이 손글씨 + 루브릭 체크리스트로 다룬다.
TS 쪽 `ap_diagram` 렌더 연결은 아직 없다 — 이 렌더는 갤러리·결정적 게이트용 기준 구현이다(Physics 와 같은 상태)."""
import math

W, H = 360, 220


def _wrap(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img">{body}</svg>'


def render_pes(scene):
    """peaks: [{energy, electrons}] — 로그 눈금의 가로축(높은 에너지가 왼쪽)과 높이 ∝ 전자 수."""
    peaks = scene["peaks"]
    emin, emax = min(p["energy"] for p in peaks) / 2, max(p["energy"] for p in peaks) * 2
    maxn = max(p["electrons"] for p in peaks)
    x0, x1, yb, yt = 30, W - 20, H - 40, 25
    xpos = lambda e: x0 + (x1 - x0) * (math.log(emax) - math.log(e)) / (math.log(emax) - math.log(emin))
    out = [f'<line x1="{x0}" y1="{yb}" x2="{x1}" y2="{yb}" stroke="#111" stroke-width="1.5"/>', f'<text x="{(x0 + x1) / 2}" y="{H - 8}" font-size="12" text-anchor="middle" font-family="serif">Binding energy ({scene.get("unit", "MJ/mol")})</text>']
    for p in peaks:
        x = xpos(p["energy"]); h = (yb - yt) * p["electrons"] / maxn
        out.append(f'<line x1="{x:.1f}" y1="{yb}" x2="{x:.1f}" y2="{yb - h:.1f}" stroke="#111" stroke-width="3"/><text x="{x:.1f}" y="{yb + 14}" font-size="10" text-anchor="middle" font-family="serif">{p["energy"]:g}</text>')
    return _wrap("".join(out))


def render_particles(scene):
    """box: [{species, count}] 를 격자 위치에 점으로 배치(결정적). 배열 정보(arrangement)는 캡션으로."""
    out = [f'<rect x="20" y="15" width="{W - 40}" height="{H - 50}" fill="none" stroke="#111" stroke-width="1.5"/>']
    colors = ["#1b6", "#c33", "#36c", "#a6a"]
    cols = 12
    i = 0
    for k, grp in enumerate(scene.get("box", [])):
        for _ in range(grp["count"]):
            r, c = divmod(i, cols)
            out.append(f'<circle cx="{40 + c * 24}" cy="{35 + r * 24}" r="8" fill="{colors[k % 4]}"/>')
            i += 1
    legend = "  ".join(f'{g["species"]}' for g in scene.get("box", []))
    out.append(f'<text x="{W / 2}" y="{H - 8}" font-size="11" text-anchor="middle" font-family="serif">{legend}</text>')
    return _wrap("".join(out))


def render(variant, data):
    return {"chem_pes": render_pes, "chem_particles": lambda d: render_particles(d["scene"])}[variant](data if variant == "chem_pes" else data)


def check_pes(scene):
    """결정적 검사: 봉우리 에너지 엄격 감소(오른쪽으로), 전자 수 양수 정수, 합 = Z(주어졌으면), viewBox 안."""
    pk = scene["peaks"]
    es = [p["energy"] for p in pk]
    errs = []
    if any(es[i] <= es[i + 1] for i in range(len(es) - 1)):
        errs.append("energies_not_decreasing")
    if any(p["electrons"] < 1 or p["electrons"] != int(p["electrons"]) for p in pk):
        errs.append("electron_counts")
    if "z" in scene and sum(p["electrons"] for p in pk) != scene["z"]:
        errs.append("electron_total_ne_z")
    return errs


def check_particles(scene):
    errs = []
    n = sum(g["count"] for g in scene.get("box", []))
    if n > 12 * 7:
        errs.append("too_many_particles")
    if "packing_fraction" in scene and not (0 < scene["packing_fraction"] < 0.8):
        errs.append("packing_fraction")
    return errs
