// R&W 문학 생성용 이름 풀(2026-10-01): 문화·성별·시대가 고르게 분산된 이름 수백 개.
// 직접 생성 테스트에서 'Tobias' 18/60, 'Odalys' 12/60 이 반복돼 풀을 코드가 지정해 주입하고(모델 자유 작명 금지) 사용 상한으로 강제한다.
// 표기: "이름/성별" (f·m·n). 각 문화는 classic(19~20세기 초 분위기)·modern(현대) 두 목록. 실존 유명 작품 주인공 이름은 되도록 피했다.
export type NameEntry = { name: string; culture: string; gender: "f" | "m" | "n"; era: "classic" | "modern" };

const RAW: Record<string, { classic: string; modern: string }> = {
  english: {
    classic: "Edith/f Harriet/f Mabel/f Clara/f Agnes/f Winifred/f Josiah/m Silas/m Albert/m Cyrus/m Hollis/m Ephraim/m",
    modern: "Nora/f Piper/f Leah/f Maya/f Dana/f Colby/m Declan/m Grant/m Jonah/m Reid/m Casey/n Jordan/n",
  },
  irish_scottish: {
    classic: "Brigid/f Maeve/f Aoife/f Moira/f Fergus/m Callum/m Ronan/m Angus/m Donal/m",
    modern: "Saoirse/f Niamh/f Orla/f Ciara/f Cormac/m Eamon/m Lachlan/m Rory/m Caoimhe/f",
  },
  french: {
    classic: "Odile/f Colette/f Genevieve/f Marcel/m Lucien/m Armand/m Etienne/m Solange/f",
    modern: "Camille/n Margaux/f Elodie/f Mathis/m Theo/m Remy/m Noemie/f Amelie/f",
  },
  spanish_iberian: {
    classic: "Remedios/f Pilar/f Consuelo/f Esteban/m Anselmo/m Rafael/m Alonso/m Dolores/f",
    modern: "Lucia/f Marisol/f Paloma/f Joaquin/m Mateo/m Ivan/m Alba/f Sergio/m Carmela/f",
  },
  latin_american: {
    classic: "Esperanza/f Rosalinda/f Cleotilde/f Eulalio/m Anacleto/m Bartolo/m Ofelia/f",
    modern: "Ximena/f Valentina/f Camila/f Santiago/m Emiliano/m Nicolas/m Itzel/f Dario/m Renata/f",
  },
  portuguese_brazilian: {
    classic: "Benedita/f Amelia/f Joaquim/m Anselmo/m Fausto/m Leopoldina/f",
    modern: "Thiago/m Beatriz/f Larissa/f Caio/m Rafaela/f Matheus/m Isadora/f Bruno/m",
  },
  italian: {
    classic: "Assunta/f Giulietta/f Fiorella/f Emilio/m Giacomo/m Tommaso/m Ottavio/m",
    modern: "Chiara/f Giada/f Alessia/f Matteo/m Lorenzo/m Riccardo/m Elisa/f Marco/m",
  },
  german_austrian: {
    classic: "Greta/f Liesel/f Hedwig/f Friedrich/m Anselm/m Konrad/m Wolfram/m Ottilie/f",
    modern: "Lena/f Katharina/f Jonas/m Felix/m Matthias/m Annika/f Linus/m Mira/f",
  },
  dutch_nordic: {
    classic: "Wilhelmina/f Anneke/f Sigrid/f Gunnar/m Thorvald/m Jens/m Ingeborg/f",
    modern: "Freja/f Ingrid/f Astrid/f Emil/m Soren/m Lars/m Marit/f Anders/m Saga/f",
  },
  slavic_baltic: {
    classic: "Zofia/f Katarzyna/f Anushka/f Pavel/m Dmitri/m Stanislav/m Bronislaw/m Irena/f",
    modern: "Tatiana/f Milena/f Ksenia/f Bogdan/m Radek/m Jakub/m Marta/f Dainius/m Vesna/f",
  },
  greek_balkan_turkish: {
    classic: "Eleni/f Despina/f Zeynep/f Kostas/m Yiannis/m Hasan/m Nikos/m Fatma/f",
    modern: "Selin/f Defne/f Eda/f Emre/m Stavros/m Kerem/m Katerina/f Burak/m Daphne/f",
  },
  arabic_levantine: {
    classic: "Layla/f Zaynab/f Salma/f Rashid/m Tariq/m Hamza/m Yusuf/m Samira/f",
    modern: "Noor/f Hala/f Rania/f Omar/m Karim/m Faris/m Dalia/f Malek/m Yasmin/f",
  },
  persian_central_asian: {
    classic: "Roxana/f Shirin/f Parvin/f Darius/m Bahram/m Farhad/m Mehrnaz/f",
    modern: "Soraya/f Dariush/m Kian/m Nasrin/f Aydin/n Pouya/m Leila/f Arman/m Aigerim/f",
  },
  hebrew_jewish: {
    classic: "Rivka/f Miriam/f Chana/f Avraham/m Yitzhak/m Moshe/m Dvora/f",
    modern: "Noa/f Tamar/f Maya/f Eitan/m Yoav/m Lior/n Shira/f Amit/n Gil/m",
  },
  west_african: {
    classic: "Abena/f Adaeze/f Folasade/f Kwame/m Chinedu/m Babatunde/m Yaa/f Kofi/m",
    modern: "Ama/f Efua/f Ngozi/f Kwesi/m Tunde/m Obinna/m Zainab/f Seun/n Nneka/f",
  },
  east_south_african: {
    classic: "Wanjiru/f Nandi/f Thandiwe/f Mandla/m Jomo/m Themba/m Amara/f",
    modern: "Zawadi/f Lindiwe/f Neema/f Tendai/m Kagiso/m Baraka/m Imani/f Sipho/m Aster/f",
  },
  indian_subcontinent: {
    classic: "Savitri/f Kamala/f Lakshmi/f Rajendra/m Gopal/m Hari/m Sharda/f Mohan/m",
    modern: "Ananya/f Meera/f Priya/f Rohan/m Arjun/m Vikram/m Tara/f Nikhil/m Ishaan/m Zoya/f",
  },
  south_asian_muslim_sri_lankan: {
    classic: "Rukhsana/f Nargis/f Shamsuddin/m Imtiaz/m Kamal/m Sunethra/f",
    modern: "Ayesha/f Mehreen/f Faisal/m Danish/m Nadeesha/f Ruwan/m Sadia/f Hassan/m",
  },
  chinese: {
    classic: "Meilin/f Xiulan/f Yuying/f Wenhua/m Zhiming/m Jianguo/m Baoyu/m Lanying/f",
    modern: "Xinyi/f Yuxuan/n Haoran/m Jiayi/f Zihan/n Mingyu/m Shuang/f Weiqi/m Ruoxi/f",
  },
  japanese: {
    classic: "Fumiko/f Sachiko/f Tomoe/f Haruo/m Shigeru/m Kenji/m Takeshi/m Chiyo/f",
    modern: "Hana/f Sakura/f Aiko/f Haruto/m Ren/n Yuto/m Mio/f Sota/m Akari/f",
  },
  korean: {
    classic: "Sunja/f Okja/f Bokhee/f Chulsoo/m Dongsik/m Gyeongho/m Younghee/f",
    modern: "Jiwoo/n Seoyeon/f Minjun/m Haneul/n Dayoung/f Taeyang/m Eunseo/f Joon/m Suhyun/n",
  },
  southeast_asian: {
    classic: "Lan/f Thuy/f Siti/f Somchai/m Nguyen/m Budi/m Dewi/f Aung/m",
    modern: "Linh/f Mai/f Anh/n Kiet/m Arisa/f Putri/f Bao/m Narong/m Thida/f Wira/m",
  },
  pacific_maori_hawaiian: {
    classic: "Moana/f Leilani/f Aroha/f Tane/m Kalani/m Hemi/m Mele/f",
    modern: "Anahera/f Kainoa/m Makana/n Tui/f Mika/n Koa/m Nalani/f Rangi/n",
  },
  indigenous_american: {
    classic: "Tallulah/f Aponi/f Kai/f Waya/m Ahanu/m Takoda/m Nayeli/f",
    modern: "Ayita/f Nova/f Chayton/m Sequoia/n Talon/m Yona/n Kaya/f Elan/m",
  },
  caribbean: {
    classic: "Cecile/f Pearl/f Hortense/f Winston/m Clement/m Errol/m Ivy/f Linton/m",
    modern: "Shanice/f Kemoy/m Janelle/f Tyrese/m Marlon/m Alisha/f Dwayne/m Kiara/f Roshane/m",
  },
  african_american: {
    classic: "Mattie/f Odessa/f Birdie/f Lucius/m Isaiah/m Booker/m Beulah/f",
    modern: "Imani/f Jamal/m Tamika/f Darnell/m Aaliyah/f Marcus/m Camryn/n Devon/n Kenya/f",
  },
};

export const NAME_POOL: NameEntry[] = Object.entries(RAW).flatMap(([culture, v]) =>
  (["classic", "modern"] as const).flatMap((era) =>
    v[era].split(/\s+/).filter(Boolean).map((tok) => {
      const [name, g] = tok.split("/");
      return { name, culture, gender: g as NameEntry["gender"], era };
    }),
  ),
);

/** 과다 반복이 확인돼 쓰지 못하게 막는 이름(대소문자 무시). 풀에도 없다. */
export const BANNED_NAMES = ["Tobias", "Odalys", "Wren", "Elena", "Maren", "Elias"].map((s) => s.toLowerCase());

export const nameCultures = () => [...new Set(NAME_POOL.map((n) => n.culture))];
export const uniqueNames = () => [...new Set(NAME_POOL.map((n) => n.name))];
