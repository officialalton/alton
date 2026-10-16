import json
a,b=100,2
mc=20
q=(a-mc)/(2*b)
p=a-b*q
profit=(p-mc)*q
cs=0.5*q*(a-p)
qe=(a-mc)/b
dwl=0.5*(p-mc)*(qe-q)
checks=[{"part":"a","pass":q==20 and p==60,"detail":"Qm=20, Pm=60"},{"part":"b","pass":profit==800 and cs==400,"detail":"profit 800, CS 400"},{"part":"c","pass":dwl==400,"detail":"DWL 400"},{"part":"d","pass":qe==40,"detail":"ceiling Q=40, profit 0"}]
print(json.dumps({"checks":checks,"conceptual_parts":[]}))