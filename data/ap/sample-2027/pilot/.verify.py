import sympy as sp, json
t=sp.symbols('t')
L=sp.limit((t**2-4*t+3)/(t-3),t,3)
ok = (L==2)
print(json.dumps({"computed_key_index":0 if ok else None,"conceptual_only":False,"details":"limit=%s, g(3)=2"%L}))