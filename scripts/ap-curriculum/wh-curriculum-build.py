# AP World History: Modern curriculum transcription (CED effective Fall 2026; Course Framework V.1). Generates data/ap/curriculum-2027/ap_world_history.json.
#   python3 -I scripts/ap-curriculum/wh-curriculum-build.py
# Official parts: 9 units, 71 topics with codes/titles, suggested skills, unit class periods, exam weighting (CED p.196). Sub-keywords/estLessons/requires are ALTON tutoring-sequence proposals.
import json
us = json.load(open("data/ap/curriculum-2027/ap_us_history.json"))
SK = us["skills"]
U = [
 ("1", "Unit 1: The Global Tapestry (c. 1200 to c. 1450)", "~10-13", (8, 10), [
  ("1.1", "Developments in East Asia from c. 1200 to c. 1450", "4.A", [("Song to Yuan to Ming: state, bureaucracy and Neo-Confucianism", "concept"), ("Place East Asian developments in their regional context", "skill")]),
  ("1.2", "Developments in Dar al-Islam from c. 1200 to c. 1450", "1.A", [("Abbasid decline, Mongol conquest and successor Islamic states", "concept"), ("Islamic law, learning and the spread of Islam by trade and Sufis", "concept")]),
  ("1.3", "Developments in South and Southeast Asia from c. 1200 to c. 1450", "3.A", [("Delhi Sultanate, Hindu and Buddhist kingdoms, and Khmer and Srivijaya states", "concept"), ("Identify the claim in a source on South or Southeast Asian rule", "skill")]),
  ("1.4", "State Building in the Americas", "3.B", [("Aztec (Mexica) and Inca imperial organization", "concept"), ("Identify the evidence a source gives for American state building", "skill")]),
  ("1.5", "State Building in Africa", "1.B", [("Mali, Ethiopia, Great Zimbabwe and Swahili city-states", "concept"), ("Explain the role of trade and religion in African state building", "skill")]),
  ("1.6", "Developments in Europe from c. 1200 to c. 1450", "1.A", [("Feudalism, manorialism, the church and early parliaments", "concept"), ("Black Death and its social and economic effects", "concept")]),
  ("1.7", "Comparison in the Period from c. 1200 to c. 1450", "6.A", [("Compare state forms and sources of legitimacy across regions", "skill"), ("Make a defensible comparative claim about the period", "skill")])]),
 ("2", "Unit 2: Networks of Exchange (c. 1200 to c. 1450)", "~10-13", (8, 10), [
  ("2.1", "The Silk Roads", "4.A", [("Goods, technologies and religions along overland routes", "concept"), ("Read trade-route maps", "representation")]),
  ("2.2", "The Mongol Empire and the Making of the Modern World", "5.A", [("Mongol conquest, the Pax Mongolica and exchange across Eurasia", "concept"), ("Continuity and change under Mongol rule", "skill")]),
  ("2.3", "Exchange in the Indian Ocean", "5.A", [("Monsoon trade, port cities and merchant communities", "concept"), ("Cultural diffusion through maritime exchange", "concept")]),
  ("2.4", "Trans-Saharan Trade Routes", "1.B", [("Gold, salt, camels and the rise of West African states", "concept"), ("Explain how trade spread Islam in West Africa", "skill")]),
  ("2.5", "Cultural Consequences of Connectivity", "2.A", [("Diffusion of religion, art, science and technology", "concept"), ("Identify the point of view of travelers' accounts", "skill")]),
  ("2.6", "Environmental Consequences of Connectivity", "5.A", [("Disease transmission and the Black Death along trade routes", "concept"), ("Link trade expansion to environmental change", "skill")]),
  ("2.7", "Comparison of Economic Exchange", "6.B", [("Compare the Silk Roads, Indian Ocean and trans-Saharan systems", "skill"), ("Support a comparison with specific evidence", "skill")])]),
 ("3", "Unit 3: Land-Based Empires (c. 1450 to c. 1750)", "~8-11", (12, 15), [
  ("3.1", "Empires Expand", "1.B", [("Ottoman, Safavid, Mughal, Qing, Russian and other land-based empires", "concept"), ("Gunpowder, military organization and expansion", "concept")]),
  ("3.2", "Empires: Administration", "4.A", [("Bureaucracy, taxation and the legitimation of rule", "concept"), ("Describe administrative contexts of an empire", "skill")]),
  ("3.3", "Empires: Belief Systems", "2.B", [("Religion as support for and challenge to imperial rule", "concept"), ("Explain how a source's purpose reflects imperial religious policy", "skill")]),
  ("3.4", "Comparison in Land-Based Empires", "6.B", [("Compare administration and religious policy across empires", "skill"), ("Support a comparative argument with specific evidence", "skill")])]),
 ("4", "Unit 4: Transoceanic Interconnections (c. 1450 to c. 1750)", "~22-25", (12, 15), [
  ("4.1", "Technological Innovations from 1450 to 1750", "4.A", [("Navigation, shipbuilding and cartography", "concept"), ("Place maritime innovations in their political context", "skill")]),
  ("4.2", "Exploration: Causes and Events from 1450 to 1750", "5.B", [("Portuguese, Spanish, Dutch, French and English voyages and motives", "concept"), ("Explain how state competition drove exploration", "skill")]),
  ("4.3", "Columbian Exchange", "3.B", [("Transfer of crops, animals, people and disease between hemispheres", "concept"), ("Identify the evidence a source gives for the exchange's effects", "skill")]),
  ("4.4", "Maritime Empires Established", "2.A", [("Trading-post and colonial empires of Europeans", "concept"), ("Identify the point of view in a colonial-era source", "skill")]),
  ("4.5", "Maritime Empires Maintained and Developed", "3.A", [("Mercantilism, chartered companies and the Atlantic system", "concept"), ("Identify the claim in a source on maritime commerce", "skill")]),
  ("4.6", "Internal and External Challenges to State Power from 1450 to 1750", "4.B", [("Revolts, resistance and rivalry that strained states", "concept"), ("Situate a challenge within its broader context", "skill")]),
  ("4.7", "Changing Social Hierarchies from 1450 to 1750", "3.D", [("Atlantic slavery, castas, and new elites", "concept"), ("Explain how evidence supports or modifies a claim about hierarchy", "skill")]),
  ("4.8", "Continuity and Change from 1450 to 1750", "6.C", [("Trace continuities and changes in global trade and power", "skill"), ("Use reasoning to relate pieces of evidence about continuity and change", "skill")])]),
 ("5", "Unit 5: Revolutions (c. 1750 to c. 1900)", "~20-23", (12, 15), [
  ("5.1", "The Enlightenment", "3.A", [("Natural rights, reason and challenges to absolutism", "concept"), ("Identify the claim in an Enlightenment source", "skill")]),
  ("5.2", "Nationalism and Revolutions in the Period from 1750 to 1900", "3.C", [("American, French, Haitian and Latin American revolutions", "concept"), ("Compare revolutionary documents", "skill")]),
  ("5.3", "Industrial Revolution Begins", "1.B", [("Why industrialization began in Britain", "concept"), ("Coal, iron, textiles and the factory", "concept")]),
  ("5.4", "Industrialization Spreads in the Period from 1750 to 1900", "5.A", [("Industrial development in continental Europe, the United States and Japan", "concept"), ("Identify patterns in industrial spread", "skill")]),
  ("5.5", "Technology of the Industrial Age", "1.B", [("Steam, railroads, telegraph and steamships", "concept"), ("Explain technological effects on trade and empire", "skill")]),
  ("5.6", "Industrialization: Government's Role from 1750 to 1900", "5.A", [("State support, laissez-faire and reform", "concept"), ("Connect state action to industrial development", "skill")]),
  ("5.7", "Economic Developments and Innovations in the Industrial Age", "5.B", [("Capitalism, joint-stock companies and banking", "concept"), ("Explain relationships among economic developments", "skill")]),
  ("5.8", "Reactions to the Industrial Economy from 1750 to 1900", "2.B", [("Socialism, Marxism, labor movements and reform", "concept"), ("Explain how a source's situation shapes its view of industry", "skill")]),
  ("5.9", "Society and the Industrial Age", "4.B", [("Urbanization, class, gender and family change", "concept"), ("Situate social change in the broader industrial context", "skill")]),
  ("5.10", "Continuity and Change in the Industrial Age", "6.C", [("Trace what industrialization changed and what it left unchanged", "skill"), ("Use reasoning to relate pieces of evidence", "skill")])]),
 ("6", "Unit 6: Consequences of Industrialization (c. 1750 to c. 1900)", "~12-15", (12, 15), [
  ("6.1", "Rationales for Imperialism from 1750 to 1900", "4.B", [("Economic, political and ideological motives for empire", "concept"), ("Situate imperial rationales in their broader context", "skill")]),
  ("6.2", "State Expansion from 1750 to 1900", "4.B", [("Imperial expansion by Britain, Russia, Japan, the United States and others", "concept"), ("Compare forms of state expansion", "skill")]),
  ("6.3", "Indigenous Responses to State Expansion from 1750 to 1900", "2.C", [("Resistance, accommodation and rebellion", "concept"), ("Explain how a source's point of view limits its use", "skill")]),
  ("6.4", "Global Economic Development from 1750 to 1900", "2.B", [("Global trade, plantations and resource extraction", "concept"), ("Explain how a source's audience affects its interpretation", "skill")]),
  ("6.5", "Economic Imperialism from 1750 to 1900", "4.B", [("Unequal treaties, spheres of influence and informal empire", "concept"), ("Situate economic imperialism in its context", "skill")]),
  ("6.6", "Causes of Migration in an Interconnected World", "5.B", [("Push and pull factors, indentured labor and emancipation", "concept"), ("Explain connections between migration and global economic change", "skill")]),
  ("6.7", "Effects of Migration", "5.B", [("Diasporas, nativism and ethnic enclaves", "concept"), ("Explain relationships between migration and social change", "skill")]),
  ("6.8", "Causation in the Imperial Age", "6.D", [("Weigh multiple causes of imperial expansion and its outcomes", "skill"), ("Qualify a causal claim about empire with alternative evidence", "skill")])]),
 ("7", "Unit 7: Global Conflict (c. 1900 to the present)", "~9-12", (8, 10), [
  ("7.1", "Shifting Power After 1900", "4.B", [("Decline of old empires and rise of new powers", "concept"), ("Situate shifting power in its broader context", "skill")]),
  ("7.2", "Causes of World War I", "1.B", [("Alliances, imperial rivalry and nationalism", "concept"), ("Explain how causes combined in 1914", "skill")]),
  ("7.3", "Conducting World War I", "3.B", [("Total war, mobilization and colonial participation", "concept"), ("Identify the evidence a source offers about the war experience", "skill")]),
  ("7.4", "Economy in the Interwar Period", "2.C", [("Postwar recovery, the Great Depression and state responses", "concept"), ("Explain how the situation of an interwar source limits its use", "skill")]),
  ("7.5", "Unresolved Tensions After World War I", "2.C", [("Versailles, mandates, revolutions and nationalist movements", "concept"), ("Explain the significance of a source's point of view", "skill")]),
  ("7.6", "Causes of World War II", "2.C", [("Fascism, militarism, appeasement and expansion", "concept"), ("Explain the significance of a source's purpose", "skill")]),
  ("7.7", "Conducting World War II", "3.D", [("Total war, air power, the home front and new weapons", "concept"), ("Explain how evidence supports or modifies a claim about the war", "skill")]),
  ("7.8", "Mass Atrocities After 1900", "5.B", [("Armenian genocide, the Holocaust, and later atrocities", "concept"), ("Explain connections among causes of atrocities", "skill")]),
  ("7.9", "Causation in Global Conflict", "6.D", [("Weigh multiple causes of world wars and atrocities", "skill"), ("Qualify a causal claim about the world wars with alternative evidence", "skill")])]),
 ("8", "Unit 8: Cold War and Decolonization (c. 1900 to the present)", "~14-17", (8, 10), [
  ("8.1", "Setting the Stage for the Cold War and Decolonization", "4.B", [("Postwar settlements, the UN and weakened empires", "concept"), ("Situate the early Cold War in its context", "skill")]),
  ("8.2", "The Cold War", "2.B", [("Superpower rivalry, alliances and proxy conflict", "concept"), ("Explain how a source's purpose reflects Cold War positions", "skill")]),
  ("8.3", "Effects of the Cold War", "5.B", [("Arms race, space race and divided societies", "concept"), ("Explain relationships among Cold War effects", "skill")]),
  ("8.4", "Spread of Communism After 1900", "2.C", [("Russia, China, Cuba and Vietnam", "concept"), ("Explain the significance of a communist source's audience", "skill")]),
  ("8.5", "Decolonization After 1900", "5.B", [("Independence movements and partition", "concept"), ("Compare decolonization in Asia and Africa", "skill")]),
  ("8.6", "Newly Independent States", "3.D", [("Nation building, nonalignment and neocolonialism", "concept"), ("Explain how evidence modifies a claim about new states", "skill")]),
  ("8.7", "Global Resistance to Established Order After 1900", "2.B", [("Civil rights, anti-apartheid and student movements", "concept"), ("Explain how a source's audience shaped its message", "skill")]),
  ("8.8", "End of the Cold War", "1.B", [("Reform in the USSR and the collapse of communist states", "concept"), ("Explain multiple causes of the Cold War's end", "skill")]),
  ("8.9", "Causation in the Age of the Cold War and Decolonization", "6.D", [("Weigh causes of Cold War outcomes and decolonization", "skill"), ("Qualify a causal claim about the Cold War era with alternative evidence", "skill")])]),
 ("9", "Unit 9: Globalization (c. 1900 to the present)", "~8-11", (8, 10), [
  ("9.1", "Advances in Technology and Exchange After 1900", "5.A", [("Green Revolution, communications and transport", "concept"), ("Identify patterns in technology and exchange", "skill")]),
  ("9.2", "Technological Advances and Limitations After 1900: Disease", "5.B", [("Vaccination, antibiotics and pandemics", "concept"), ("Explain connections between medicine and demographic change", "skill")]),
  ("9.3", "Technological Advances: Debates About the Environment After 1900", "4.B", [("Industrial pollution, climate change and conservation", "concept"), ("Situate environmental debates in their context", "skill")]),
  ("9.4", "Economics in the Global Age", "2.C", [("Free trade, multinationals and international institutions", "concept"), ("Explain how the situation of a globalization-era source limits its use", "skill")]),
  ("9.5", "Calls for Reform and Responses After 1900", "4.B", [("Human rights, women's rights and labor movements", "concept"), ("Situate reform movements in their context", "skill")]),
  ("9.6", "Globalized Culture After 1900", "4.B", [("Mass media, migration and popular culture", "concept"), ("Situate cultural globalization in its context", "skill")]),
  ("9.7", "Resistance to Globalization After 1900", "2.C", [("Traditionalism, fundamentalism and anti-globalization protest", "concept"), ("Explain the significance of a source's audience and purpose", "skill")]),
  ("9.8", "Institutions Developing in a Globalized World", "3.C", [("United Nations, WTO, NGOs and regional blocs", "concept"), ("Compare arguments about international institutions", "skill")]),
  ("9.9", "Continuity and Change in a Globalized World", "6.D", [("Weigh continuity and change since 1900", "skill"), ("Qualify an argument with diverse evidence", "skill")])]),
]
units = []; prev = None
for code, title, cp, _w, topics in U:
    ts = []
    for tc, tt, sk, subs in topics:
        sks = []
        for i, (lab, kind) in enumerate(subs, 1):
            sks.append({"code": f"{tc}#{i}", "label": lab, "kind": kind, "skills": [sk], "requires": [], "estLessons": 1})
        ts.append({"code": tc, "title": tt, "scope": "both", "skills": [sk], "requires": [prev] if prev else [], "estLessons": 1, "subKeywords": sks}); prev = tc
    units.append({"code": code, "title": title, "officialClassPeriods": cp, "topics": ts})
src = "AP World History: Modern CED (effective Fall 2026), Exam Information p.196: MC unit weighting"
out = {"schemaVersion": 1, "subject": {"apCode": "ap_world_history", "name": "AP World History: Modern", "family": "history", "edition": "ced-2027", "cedVersion": "AP World History: Modern CED (Course Framework V.1, (c)2026; effective Fall 2026)", "examYear": 2027,
  "sourceUrl": "https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description.pdf", "officialTopicCodes": True,
  "designNotes": "9 units (c. 1200 to the present) with official CED topic codes (71 topics: U1 7, U2 7, U3 4, U4 8, U5 10, U6 8, U7 9, U8 9, U9 9), titles, class-period estimates, and suggested skills from the Unit at a Glance tables. MC unit weights come from the CED exam weighting (U1 8-10, U2 8-10, U3-U6 12-15, U7-U9 8-10 percent). Skills are the historical thinking skills 1.A-6.D; Skill 6 (argumentation) is not assessed in the multiple-choice section, and skill/reasoning-process weights are not published. Sub-keywords, kinds, requires and estLessons are original tutoring-sequence proposals in neutral, mainstream wording."},
  "skills": SK, "weights": [{"axis": "unit", "code": c, "section": "mc", "min": w[0], "max": w[1], "source": src} for c, _t, _p, w, _ts in U], "units": units}
json.dump(out, open("data/ap/curriculum-2027/ap_world_history.json", "w"), indent=2, ensure_ascii=False)
print(sum(len(u["topics"]) for u in units), "topics")
