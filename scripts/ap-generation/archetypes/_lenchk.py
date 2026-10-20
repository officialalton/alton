"""로컬 점검(무료): 모듈의 고정 문장 은행(리스트 변수)에서 정답 문장이 보기 평균의 1.45배를 넘는 항목을 찾는다(key_much_longer 게이트는 1.6배)."""
import sys, importlib
import registry  # noqa: F401
mod = importlib.import_module(sys.argv[1])
for name in dir(mod):
    v = getattr(mod, name)
    if not (isinstance(v, list) and v and isinstance(v[0], tuple) and len(v[0]) == 4 and isinstance(v[0][3], list)):
        continue
    for i, (stem, kt, kw, wr) in enumerate(v):
        ls = [len(kt)] + [len(w[0]) for w in wr]
        mean = sum(ls) / len(ls)
        r = len(kt) / mean
        mx = max(ls)
        if r > 1.4 and len(kt) > 18:
            print(f"{name}[{i}] key {len(kt)} mean {mean:.0f} ratio {r:.2f} max_is_key={len(kt) == mx}")
