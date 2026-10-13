"""Physics 1 장면 모델 렌더 갤러리(무료): 대표 원형 한 개씩의 장면(SVG)을 data/ap/render-check/ap_physics_1/ 에 기록한다. 사용: cd scripts/ap-generation/archetypes && python phys_gallery.py ../../../data/ap/render-check/ap_physics_1"""
import os, sys
import registry as R
import phys_figs as F

SOURCES = ["ph_motion_diagram", "ph_relative_velocity", "ph_atwood_tension", "ph_incline_friction", "ph_inelastic_collision", "ph_collision_type", "ph_beam_balance", "ph_torricelli_range", "ph_fbd_choice", "ph_energy_bar_choice"]


def main(out):
    os.makedirs(out, exist_ok=True)
    n = 0
    for name in SOURCES:
        p = R.batch(name, 1, 40)[0]
        scenes = []
        st = p.get("stimulus") or {}
        if st.get("kind") == "diagram":
            scenes.append(st["data"]["scene"])
        scenes += p.get("option_scenes", [])
        for i, sc in enumerate(scenes):
            assert F.check_scene(sc) == [] or p.get("option_scenes"), name
            with open(os.path.join(out, f"{name}_{i}.svg"), "w") as f:
                f.write(F.render_svg(sc))
            n += 1
    print(n, "svg files")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "gallery")
