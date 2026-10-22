"""AP Chemistry 원형 — CH5 단독 4칸 대체(2026-10-22, 엄격 쌍둥이 관문 뒤 남은 가상 칸): 3단원 KMT 주장(3.5, 6.E), 증기압 정당화(3.1, 6.E), 점도 추세(3.1, 4.C), 2단원 VSEPR 모양(2.7, 4.A).
공개 문항과 자료·조건·질문·풀이 단계가 다르다.
- KMT: 같은 온도의 두 기체 평균 운동에너지는 같고 속력은 질량으로 달라진다(공개 3.5 문항은 압력 증가의 입자 설명), 가열 시 KE 2배/속력 √2배.
- 증기압: 온도에 따른 분자 에너지 분포 / 표면적 불변(공개 문항은 IMF 세기 비교·그래프·무극성 기체 순위).
- 점도: 가열하면 점도가 감소하는 입자 모형(공개 문항은 분자 구조로 점도 비교).
- VSEPR: 고립 전자쌍 유무로 달라지는 두 화학종의 모양 비교(공개 문항은 SF4·XeF4 단일 모양 예측).
개념 문항은 고정 문장 은행이고 오답은 이름 붙은 오개념이다. 수치·구조를 쓰는 변형은 코드가 두 경로로 검산한다(아래 agree)."""
import math
from chem_common import *  # noqa: F401,F403


def _steric(valence, monovalent, charge):
    """중심 원자 입체수(전자 영역 수) = (원자가전자 + 한 자리 결합 원자 수 − 전하)/2. SO3 는 공명 구조의 확장 팔전자 표기 대신 이 공식으로 센다."""
    return (valence + monovalent - charge) / 2


# ============================ 3.5 KMT 주장 (6.E) ============================
def ch_t5l_kmt_claim(rng):
    v = pick(rng, [0, 1, 2])
    if v == 0:
        mh, mo = 2.016, 32.00  # H2, O2 (g/mol)
        # 같은 T 에서 평균 KE 동일 → v_rms 비는 (M_O/M_H)^0.5; 두 경로(KE 동일 조건 vs 마이크스웰 v ∝ T^0.5 M^-0.5)
        r1 = math.sqrt(mo / mh); r2 = math.sqrt(2 * 1.0 / (mh / 1000)) / math.sqrt(2 * 1.0 / (mo / 1000))
        agree(r1, r2, 1e-9, "speed ratio")
        stem = ("A student claims that, at the same temperature, hydrogen molecules (H₂) in one container and oxygen molecules (O₂) in another container have the same average kinetic energy, "
                "yet the H₂ molecules move faster on average. Which statement best justifies the claim?")
        key_t = "Average kinetic energy depends only on temperature, so the lighter H₂ molecules must move faster than the heavier O₂ molecules to have the same kinetic energy."
        wrongs = [("The lighter H₂ molecules have a larger average kinetic energy at the same temperature, and the extra kinetic energy is why they move faster than the O₂ molecules.", "Believes particles with less mass have more kinetic energy at the same temperature."),
                  ("At the same temperature every gas has the same average speed, and the two gases differ only in how far apart their molecules are in each container.", "Believes the same temperature means the same average speed for every gas."),
                  ("The O₂ molecules strike the container walls more often, and each collision transfers kinetic energy to the walls, which slows them below the speed of the H₂ molecules.", "Confuses collision frequency with a loss of particle speed.")]
        kwhy = f"At one temperature, KE(avg) = (3/2)kT is the same for both gases, and with KE = ½mv² the speed ratio v(H₂)/v(O₂) = sqrt(32.00/2.016) ≈ {r1:.1f}, so the lighter molecules are faster."
        fact = f"speed ratio={r1:.2f}"
    elif v == 1:
        ma, mb = 20.18, 40.00  # Ne, Ar (g/mol)
        r1 = math.sqrt(mb / ma); r2 = math.sqrt((3 * 8.314 * 300 / (ma / 1000)) / (3 * 8.314 * 300 / (mb / 1000)))
        agree(r1, r2, 1e-9, "speed ratio")
        stem = ("Separate samples of neon (Ne) and argon (Ar) are kept at 300 K. A student claims that the neon atoms and the argon atoms have the same average kinetic energy, "
                "but the argon atoms move more slowly on average. Which statement best justifies the claim?")
        key_t = "The average kinetic energy is set by the temperature alone, so the more massive argon atoms must move more slowly than the neon atoms to have the same kinetic energy."
        wrongs = [("The argon atoms have more electrons than the neon atoms, so they attract each other more strongly and move more slowly than the neon atoms at the same temperature of 300 K.", "Attributes a speed difference to attraction between atoms of an ideal gas."),
                  ("The argon atoms have a larger average kinetic energy because their mass is larger, and the larger kinetic energy is what makes the argon atoms move more slowly.", "Believes a larger mass gives a larger kinetic energy at the same temperature."),
                  ("Both gases are at 300 K, so the neon atoms and the argon atoms must have the same average speed as well as the same average kinetic energy at that temperature.", "Believes the same temperature means the same speed for every gas.")]
        kwhy = f"Both gases have KE(avg) = (3/2)kT at 300 K, and KE = ½mv² gives v(Ar)/v(Ne) = sqrt(20.18/40.00) ≈ {1 / r1:.2f}, so argon is slower."
        fact = f"speed ratio={1 / r1:.2f}"
    else:
        T1, T2 = pick(rng, [(300.0, 600.0), (250.0, 500.0), (200.0, 400.0)])
        ke_ratio = T2 / T1
        v_ratio = math.sqrt(ke_ratio); v2 = math.sqrt((3 * 8.314 * T2 / 0.028) / (3 * 8.314 * T1 / 0.028))
        agree(v_ratio, v2, 1e-9, "speed ratio")
        stem = (f"A sample of nitrogen gas in a rigid container is heated from {T1:.0f} K to {T2:.0f} K. A student claims that the average kinetic energy of the molecules doubles, "
                "but the average speed of the molecules increases by a factor of less than 2. Which statement best justifies the claim?")
        key_t = "The average kinetic energy is proportional to the Kelvin temperature, so it doubles, and since kinetic energy depends on speed squared, the speed rises by only about 1.4."
        wrongs = [("The average speed is proportional to the Kelvin temperature, so the speed also doubles with the temperature, and the part of the claim about the speed is therefore incorrect.", "Believes speed rather than kinetic energy is proportional to temperature."),
                  ("The molecules lose some of their kinetic energy in collisions with the container walls, so the average kinetic energy increases by less than a factor of 2 overall.", "Believes collisions with the walls reduce the average kinetic energy."),
                  ("The molecules become heavier as the temperature rises, so the same increase in kinetic energy produces a smaller increase in the speed of the molecules.", "Believes the mass of a particle changes with temperature.")]
        kwhy = f"KE(avg) ∝ T, so it changes by a factor of {ke_ratio:.0f}; KE = ½mv² makes v ∝ sqrt(T), so the speed changes by sqrt({ke_ratio:.0f}) ≈ {v_ratio:.2f}."
        fact = f"ke ratio={ke_ratio:.1f}; speed ratio={v_ratio:.2f}"
    key, ds = sentence_options(key_t, kwhy, wrongs)
    return mk("ch_t5l_kmt_claim", "3.5", "6.E", stem, key, ds, rng, concept="justify a claim about equal average kinetic energy and different average speeds of gas particles using the kinetic molecular theory",
              path="KE(avg) = (3/2)kT with KE = ½mv² (speed ratio from the masses) vs the root-mean-square speed formula sqrt(3RT/M) for each gas", facts=[fact],
              judgment="separate what depends only on temperature (kinetic energy) from what also depends on mass (speed), then justify the claim", est=100)


# ============================ 3.1 증기압 정당화 (6.E) ============================
def ch_t5l_vapor_pressure_claim(rng):
    v = pick(rng, [0, 1])
    if v == 0:
        stem = ("A student claims that heating a liquid in a sealed container increases its equilibrium vapor pressure even though the intermolecular forces in the liquid do not change. "
                "Which statement best justifies the claim?")
        key_t = "At the higher temperature more molecules have enough kinetic energy to escape the liquid, so the gas needs a higher pressure before condensation matches evaporation."
        wrongs = [("The attractions between the liquid molecules become much weaker as the sample is heated, so the molecules of the liquid no longer attract one another at all as they are heated.", "Believes intermolecular forces disappear or change with temperature."),
                  ("Heating creates additional molecules of the substance in the container, so the pressure of the gas rises whether or not any more liquid evaporates at all.", "Believes heating creates new molecules."),
                  ("Every molecule in the liquid gains exactly the same extra kinetic energy, so all of the molecules are able to escape at once and the pressure rises very sharply.", "Believes all molecules have the same energy and all can escape.")]
        kwhy = "Raising the temperature shifts the distribution of kinetic energies, so more molecules exceed the energy needed to escape; equilibrium is reached at a higher gas pressure."
        fact = "temperature raises vapor pressure"
    else:
        stem = ("A student claims that, at constant temperature, doubling the surface area of a liquid in a sealed container does not change the equilibrium vapor pressure of the liquid. "
                "Which statement best justifies the claim?")
        key_t = "A larger surface area doubles both the rate of evaporation and the rate of condensation, so the pressure at which the two rates are equal stays the same."
        wrongs = [("The vapor pressure depends only on the volume of the container, so changing the surface area of the liquid cannot have any effect on the vapor pressure of the liquid.", "Believes vapor pressure depends on the container volume and not on temperature and forces."),
                  ("Only the molecules at the center of the liquid can escape into the gas, so the surface area of the liquid is irrelevant to the rate of evaporation.", "Believes molecules in the interior, not at the surface, escape."),
                  ("The extra surface area cools the liquid by exactly the amount needed to keep the equilibrium vapor pressure from changing as the surface is enlarged.", "Believes evaporative cooling cancels a surface-area effect.")]
        kwhy = "At equilibrium the rates of evaporation and condensation are equal; both scale with the surface area, so the equilibrium vapor pressure is set by the temperature and the intermolecular forces."
        fact = "surface area does not change equilibrium vapor pressure"
    key, ds = sentence_options(key_t, kwhy, wrongs)
    return mk("ch_t5l_vapor_pressure_claim", "3.1", "6.E", stem, key, ds, rng, concept="justify a claim about equilibrium vapor pressure using the rates of evaporation and condensation and the distribution of kinetic energies",
              path="dynamic-equilibrium rate argument vs the Boltzmann-type fraction of molecules above the escape energy", facts=[fact],
              judgment="connect a macroscopic vapor-pressure claim to the particle-level rates and energies instead of to the strength of the attractions", est=100)


# ============================ 3.1 점도 모형 (4.C) ============================
def ch_t5l_viscosity_model(rng):
    v = pick(rng, [0, 1])
    key_t = "Warming raises the average kinetic energy of the molecules, so more of them overcome the attractions to neighbors and slide past one another, lowering the viscosity."
    wrongs = [("Warming breaks the covalent bonds inside the molecules, so the molecules become much smaller and are able to flow past one another more easily than they could before.", "Confuses breaking intermolecular attractions with breaking covalent bonds."),
              ("Warming makes each molecule heavier, so the liquid moves downhill faster under gravity and the measured viscosity of the liquid becomes smaller as a result.", "Believes warming changes the mass of a molecule."),
              ("Warming spreads the molecules apart until the liquid behaves like a gas with no attractions left, so the viscosity of the liquid falls to a value of zero.", "Believes a warmed liquid becomes a gas with no attractions.")]
    if v == 0:
        stem = "Honey flows much more easily after it is warmed in a water bath. Which particle-level model best explains the decrease in viscosity?"
        fact = "honey warmed flows more easily"
    else:
        stem = ("The viscosity of liquid water is measured at three temperatures: 1.31 mPa·s at 10 °C, 0.65 mPa·s at 40 °C, and 0.40 mPa·s at 70 °C. Which particle-level model best explains this trend?")
        fact = "water viscosity falls from 1.31 to 0.40 mPa·s between 10 and 70 °C"
    key, ds = sentence_options(key_t, "Higher kinetic energy lets more molecules overcome the intermolecular attractions, so the molecules slide past one another more easily and the viscosity drops.", wrongs)
    return mk("ch_t5l_viscosity_model", "3.1", "4.C", stem, key, ds, rng, concept="explain the decrease of viscosity with temperature using a particle-level model of kinetic energy and intermolecular attractions",
              path="kinetic-energy-versus-attraction argument checked against the measured trend vs the Arrhenius-type temperature dependence of flow", facts=[fact],
              judgment="use a particle-level model with kinetic energy and attractions between molecules, and reject explanations that change bonds, masses or phase", est=100)


# ============================ 2.7 VSEPR 모양 비교 (4.A) ============================
def ch_t5l_vsepr_compare(rng):
    v = pick(rng, [0, 1])
    if v == 0:
        a, b = ("SO₃", "SO₃²⁻")
        sa, sb = _steric(6, 0, 0), _steric(6, 0, -2)
        agree(sa, 3.0, 1e-9, "SO3 domains"); agree(sb, 4.0, 1e-9, "SO3 2- domains")
        stem = "Sulfur trioxide, SO₃, and the sulfite ion, SO₃²⁻, each have three oxygen atoms bonded to a central sulfur atom. Which statement correctly compares their shapes?"
        key_t = "SO₃ is trigonal planar because sulfur has three electron domains and no lone pair, while SO₃²⁻ is trigonal pyramidal because sulfur has four domains with one lone pair."
        kwhy = "SO₃: (6 + 0 − 0)/2 = 3 domains, no lone pair, trigonal planar. SO₃²⁻: (6 + 0 + 2)/2 = 4 domains, three bonds and one lone pair, trigonal pyramidal."
        wrongs = [("Both are trigonal planar because the central sulfur atom in each species is bonded to three oxygen atoms, and bonded atoms alone decide the shape of each species.", "Ignores the lone pair on the central atom."),
                  ("Both are trigonal pyramidal because a sulfur atom that is bonded to oxygen always carries a lone pair of electrons, so each species has the same trigonal pyramid shape in the end.", "Believes sulfur always has a lone pair."),
                  ("SO₃ is trigonal pyramidal and SO₃²⁻ is trigonal planar because the extra negative charge removes the lone pair from the sulfur atom in the sulfite ion.", "Reverses the effect of the added electrons.")]
    else:
        sa, sb = _steric(4, 0, -2), _steric(7, 0, -1)
        agree(sa, 3.0, 1e-9, "CO3 2- domains"); agree(sb, 4.0, 1e-9, "ClO3- domains")
        stem = "The carbonate ion, CO₃²⁻, and the chlorate ion, ClO₃⁻, each have three oxygen atoms bonded to a central atom. Which statement correctly compares their shapes?"
        key_t = "CO₃²⁻ is trigonal planar because carbon has three electron domains and no lone pair, while ClO₃⁻ is trigonal pyramidal because chlorine has four domains with one lone pair."
        kwhy = "CO₃²⁻: (4 + 0 + 2)/2 = 3 domains, no lone pair, trigonal planar. ClO₃⁻: (7 + 0 + 1)/2 = 4 domains, three bonds and one lone pair, trigonal pyramidal."
        wrongs = [("Both are trigonal planar because the central atom in each ion is bonded to three oxygen atoms, and bonded atoms alone decide the shape of each ion.", "Ignores the lone pair on the central atom."),
                  ("Both are trigonal pyramidal because a central atom that is bonded to oxygen always carries a lone pair of electrons, so each ion has the same trigonal pyramid shape in the end.", "Believes every central atom bonded to oxygen has a lone pair."),
                  ("CO₃²⁻ is trigonal pyramidal and ClO₃⁻ is trigonal planar because the ion with the larger negative charge must be the one that carries the lone pair on its central atom.", "Believes the larger charge decides which ion has the lone pair.")]
    key, ds = sentence_options(key_t, kwhy, wrongs)
    return mk("ch_t5l_vsepr_compare", "2.7", "4.A", stem, key, ds, rng, concept="compare the shapes of two species with the same number of bonded atoms but different numbers of lone pairs using VSEPR",
              path="electron-domain count from (valence electrons + bonded monovalent atoms − charge)/2 vs the shape table keyed by (domains, lone pairs)", facts=[f"domains {sa:g} and {sb:g}"],
              judgment="count the electron domains and lone pairs of each central atom, then use them to name the shapes", est=100)
