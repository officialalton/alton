import json
from sympy import symbols, solve
Q=symbols('Q')
q=solve(300-2*Q-(60+4*Q),Q)[0]; p=300-2*q
cs=0.5*q*(300-p); ps=0.5*q*(p-60)
q2=solve(300-2*Q-(36+4*Q),Q)[0]; p2=300-2*q2
cs2=0.5*q2*(300-p2)
ok_a=(q==40 and p==220)
ok_b=(cs==1600 and ps==3200)
ok_c=(q2==44 and p2==212 and cs2-cs==336)
print(json.dumps({"checks":[{"part":"a","pass":bool(ok_a),"detail":"Q=40,P=220"},{"part":"b","pass":bool(ok_b),"detail":"CS=1600,PS=3200"},{"part":"c","pass":bool(ok_c),"detail":"Q=44,P=212,dCS=336"}],"conceptual_parts":[]}))