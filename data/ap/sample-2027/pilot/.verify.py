import json
L=5*3**2+105
R=30*3+60
v=140
cont=(L==R==v)
key=0 if (L==R and L!=v) else None
print(json.dumps({"computed_key_index":key,"conceptual_only":False,"details":f"left={L}, right={R}, H(3)={v}, continuous={cont}"}))