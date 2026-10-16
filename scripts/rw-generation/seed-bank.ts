// R&W 문학 생성용 소재 목록(2026-10-01): 장소(배경 종류 x 지역)·갈등·관계를 대폭 확대.
// 직접 생성 테스트에서 장소가 19종뿐이었다(씨앗 생성기 목록 20개). 이제 배경 60여 종 x 지역 60여 곳 = 약 3,800 조합, 갈등 70여, 관계 60.
export const SETTINGS = [
  "a ferry terminal", "a school gymnasium", "a rented farmhouse", "a night-shift pharmacy", "a lighthouse station", "a crowded wedding hall",
  "a quiet library", "a salt flat", "a radio repair shop", "a river barge", "a mountain bus stop", "an abandoned orchard", "a bakery before opening",
  "a hospital waiting room", "a train compartment", "an open-air market", "a snowed-in cabin", "a rooftop laundry line", "a lakeside dock",
  "a tailor's back room", "a fishing harbor", "a noodle stall", "a tea plantation", "a night bus", "a seed-saving cooperative", "a ceramics studio",
  "a laundromat", "a rural post office", "a flooded cellar", "a courtyard with a dry fountain", "a shoe repair stall", "a language school classroom",
  "a bookbinder's workshop", "a vineyard at harvest", "a metro platform", "a boarding-house kitchen", "a stone bridge", "a cemetery gate",
  "a ship's galley", "a movie theater in the off-season", "a beekeeper's yard", "a customs checkpoint", "a barbershop", "a community garden",
  "a clock-maker's shop", "a hillside terrace", "a bus depot", "an apartment stairwell", "a soccer field at dusk", "a weaving cooperative",
  "a salt-water pool", "a roadside diner", "a seaside promenade", "a summer camp dining hall", "a monastery guesthouse", "a rooftop water tank",
  "a kite-maker's yard", "a train-station cafe", "a printing press room", "a dried-riverbed crossing", "a school music room", "an old cinema projection booth",
];
export const LOCALES: { place: string; culture: string }[] = [
  { place: "Lisbon", culture: "portuguese_brazilian" }, { place: "Oaxaca", culture: "latin_american" }, { place: "Glasgow", culture: "irish_scottish" },
  { place: "Kerala", culture: "indian_subcontinent" }, { place: "Busan", culture: "korean" }, { place: "Kyoto", culture: "japanese" },
  { place: "Lagos", culture: "west_african" }, { place: "Nairobi", culture: "east_south_african" }, { place: "Cairo", culture: "arabic_levantine" },
  { place: "Istanbul", culture: "greek_balkan_turkish" }, { place: "Thessaloniki", culture: "greek_balkan_turkish" }, { place: "Krakow", culture: "slavic_baltic" },
  { place: "Tbilisi", culture: "slavic_baltic" }, { place: "Tromso", culture: "dutch_nordic" }, { place: "Rotterdam", culture: "dutch_nordic" },
  { place: "Seville", culture: "spanish_iberian" }, { place: "Naples", culture: "italian" }, { place: "Lyon", culture: "french" },
  { place: "Hamburg", culture: "german_austrian" }, { place: "Vienna", culture: "german_austrian" }, { place: "Galway", culture: "irish_scottish" },
  { place: "Manchester", culture: "english" }, { place: "Vermont", culture: "english" }, { place: "the Mississippi Delta", culture: "african_american" },
  { place: "Kingston", culture: "caribbean" }, { place: "Port of Spain", culture: "caribbean" }, { place: "Havana", culture: "latin_american" },
  { place: "Lima", culture: "latin_american" }, { place: "Valparaiso", culture: "latin_american" }, { place: "Hanoi", culture: "southeast_asian" },
  { place: "Chiang Mai", culture: "southeast_asian" }, { place: "Surabaya", culture: "southeast_asian" }, { place: "Shanghai", culture: "chinese" },
  { place: "Chengdu", culture: "chinese" }, { place: "Taipei", culture: "chinese" }, { place: "Auckland", culture: "pacific_maori_hawaiian" },
  { place: "Maui", culture: "pacific_maori_hawaiian" }, { place: "Albuquerque", culture: "indigenous_american" }, { place: "the Navajo plateau", culture: "indigenous_american" },
  { place: "Haifa", culture: "hebrew_jewish" }, { place: "Tehran", culture: "persian_central_asian" }, { place: "Samarkand", culture: "persian_central_asian" },
  { place: "Karachi", culture: "south_asian_muslim_sri_lankan" }, { place: "Colombo", culture: "south_asian_muslim_sri_lankan" }, { place: "Dhaka", culture: "indian_subcontinent" },
  { place: "Accra", culture: "west_african" }, { place: "Dakar", culture: "west_african" }, { place: "Cape Town", culture: "east_south_african" },
  { place: "Addis Ababa", culture: "east_south_african" }, { place: "Marseille", culture: "french" }, { place: "Porto Alegre", culture: "portuguese_brazilian" },
  { place: "Bologna", culture: "italian" }, { place: "Gdansk", culture: "slavic_baltic" }, { place: "Riga", culture: "slavic_baltic" },
  { place: "Bergen", culture: "dutch_nordic" }, { place: "Galicia", culture: "spanish_iberian" }, { place: "the Cornish coast", culture: "english" },
  { place: "Ohio", culture: "english" }, { place: "Chicago's South Side", culture: "african_american" }, { place: "Beirut", culture: "arabic_levantine" },
  { place: "Marrakesh", culture: "arabic_levantine" }, { place: "Jeju Island", culture: "korean" }, { place: "Hokkaido", culture: "japanese" },
  { place: "Manila", culture: "southeast_asian" }, { place: "Mumbai", culture: "indian_subcontinent" },
];
export const CONFLICTS = [
  "over whether to sell a shared inheritance", "after an unsent apology", "about a promise nobody remembers making", "over who should stay behind",
  "while hiding a small failure", "after a misunderstood gift", "over a borrowed object never returned", "while pretending nothing has changed",
  "over an unfinished project", "after a public embarrassment", "about leaving versus staying loyal", "over a secret discovered in a drawer",
  "when one of them is offered a way out", "over blame for a lost opportunity", "while waiting for important news", "about what to tell a younger sibling",
  "over an old photograph", "after a quiet act of generosity", "about whether to forgive", "while learning to let go of a habit",
  "over a recipe that was never written down", "about a debt neither will mention", "when a rumor reaches the wrong person", "over a decision made without asking",
  "after a competition one of them lost on purpose", "about moving an elderly parent", "when a long silence is finally broken", "over a plan that depends on a lie",
  "about who gets credit for shared work", "after discovering a letter meant for someone else", "over how to mark an anniversary", "while one of them prepares to leave for good",
  "about an object that belonged to someone gone", "when old loyalties collide with new ones", "over an apology offered too late", "about teaching a skill that is dying out",
  "over a witness account that differs", "after a harvest, voyage or season that went badly", "while rehearsing for an important performance", "over a repair that could never really fix it",
  "about keeping a family business open", "when a child's question exposes an adult's evasion", "over an invitation one of them refuses", "after a storm reveals what was buried",
  "about a name that no one uses anymore", "over unequal sacrifices made in the past", "while one of them is pretending not to be proud", "about a translation that changes the meaning",
  "over a tool or instrument inherited by the wrong person", "when a visitor arrives and sees what the family does not", "about the cost of a scholarship or opportunity", "over a map, a route or a way home",
  "when someone returns after years without explaining", "about borrowed money and borrowed time", "over how to describe an accident honestly", "after a teacher's remark that changed everything",
  "when two traditions have to share one table", "about whether a small kindness was a cover for something else", "over silence kept to protect someone", "while pretending to enjoy a gift that is wrong",
  "when an expected rival turns out to be an ally", "about an ending that nobody wants to admit", "over an unfair rule everyone obeys", "while one of them quietly changes their mind",
  "after a surprising success that makes things harder", "about the proper way to say goodbye", "over an unspoken agreement to avoid one subject", "when the plan works and nobody feels better",
  "about work that is admired but never paid for", "over a promise made to a child", "while arguing about something smaller than the real quarrel", "after a mistake that only one person noticed",
  "about the last item in a house being emptied", "when a gift is returned instead of thanked", "over whether to tell the truth to a dying friend", "after learning how someone really earned their reputation",
  "about starting over somewhere unfamiliar", "over a shared chore that has become a ritual", "while deciding whether a rule still applies",
];
export const RELATIONSHIPS = [
  "two estranged sisters", "a grandmother and her grandson", "a new teacher and a wary student", "old rivals in a chess club", "a stepfather and his stepdaughter",
  "two night-shift coworkers", "a retired sailor and his neighbor", "a daughter and her absent father's friend", "best friends after a move", "a young apprentice and a master carpenter",
  "twin brothers dividing a house", "a widow and the delivery boy", "a mother and her son leaving for college", "two strangers sharing a delay", "a keeper and a visiting surveyor",
  "a teenage cook and her stern aunt", "a father and his stubborn son", "an interpreter and her client", "an old teacher and a former pupil", "a captain and a stowaway",
  "a landlord and a long-term tenant", "cousins reunited at a funeral", "a violin student and an exacting teacher", "a mayor and the town's only doctor", "two brothers who run a failing shop",
  "a nurse and her night patient", "a farmer and a surveyor from the city", "a mother-in-law and a new bride", "a coach and a benched star", "a pair of rival bakers",
  "a girl and an old family friend", "a grandfather and a granddaughter learning his language", "a foreman and a young hire", "a sister and her younger brother's tutor", "a retired judge and a young clerk",
  "two women who once shared a stage", "a ferryman's daughter and a passenger", "an uncle and a nephew with a debt", "a seamstress and her only apprentice", "a returning soldier and his younger sister",
  "a priest and a lapsed parishioner", "a shopkeeper and a persistent customer", "two neighbors with a shared wall", "a brother and sister reading their mother's letters", "a gardener and the house's new owner",
  "a boy and the old man who sells him fish", "an author and her translator", "an elder and a restless apprentice", "a stepmother and a skeptical teenager", "a landlord's son and a tenant's daughter",
  "a pair of lifelong friends who rarely speak", "a bus driver and a regular passenger", "a daughter caring for her mother", "two musicians in a failing duo", "a teacher and a student who will not speak",
  "an immigrant father and his English-speaking daughter", "a conductor and the youngest violinist", "a ranger and a lost hiker", "a mother and a daughter planning a wedding", "a grandson and the grandfather's old friend",
];
export const GENRES_LIT = ["short_story", "novel_excerpt", "poetry", "drama", "personal_essay", "memoir", "letter", "diary", "fable_or_folktale_retelling"] as const;
export type LitGenre = (typeof GENRES_LIT)[number];
/** 규격 권장 비율: 단편·소설 발췌 50%, 에세이·회고 25%, 시·희곡 15%, 편지·일기·민담 10%. */
export const GENRE_WEIGHTS: Record<LitGenre, number> = {
  short_story: 30, novel_excerpt: 20, personal_essay: 13, memoir: 12, poetry: 10, drama: 5, letter: 4, diary: 3, fable_or_folktale_retelling: 3,
};
export const ERAS = ["contemporary", "late_20c", "early_20c", "19c"] as const;
export const POVS_LIT = ["first", "second", "third_limited", "third_omniscient", "mixed_or_none"] as const;
