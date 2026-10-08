import json
from sympy import symbols, solve, Rational
P=symbols('P')
p=solve(120-2*P-(4*P-60),P)[0]; q=120-2*p
cs=Rational(1,2)*q*(60-p); ps=Rational(1,2)*q*(p-15)
e=-2*p/q
p2=solve(120-2*P-(4*(P+6)-60),P)[0]; q2=120-2*p2
cs2=Rational(1,2)*q2*(60-p2)
checks=[{"part":"a","pass":bool(p==30 and q==60),"detail":"P=30,Q=60"},
{"part":"b","pass":bool(cs==900 and ps==450),"detail":"CS 900 PS 450"},
{"part":"c","pass":bool(e==-1),"detail":"Ed=-1"},
{"part":"d","pass":bool(p2==26 and q2==68 and cs2==1156),"detail":"P26 Q68 CS1156"}]
print(json.dumps({"checks":checks,"conceptual_parts":[]}))