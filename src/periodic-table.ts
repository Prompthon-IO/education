export const ELEMENT_FAMILIES = {
  nonmetal: {
    name: "Other nonmetals",
    color: "#dcefe0",
    ink: "#306346",
    description:
      "These elements have varied properties and often share electrons in covalent bonds. Hydrogen is placed in group 1 but is not an alkali metal.",
  },
  alkali: {
    name: "Alkali metals",
    color: "#f7dfd4",
    ink: "#9a513c",
    description:
      "Group 1 metals commonly lose one electron to form +1 ions. They are reactive metals.",
  },
  alkaline: {
    name: "Alkaline earth metals",
    color: "#f7edc8",
    ink: "#8a7029",
    description:
      "Group 2 metals commonly form +2 ions by losing two electrons.",
  },
  transition: {
    name: "Transition metals",
    color: "#dae8f4",
    ink: "#426b8f",
    description:
      "Many metals in this region conduct electricity well and can form ions with different charges. This school-table category also includes group 12.",
  },
  post: {
    name: "Other metals",
    color: "#d6ece8",
    ink: "#367369",
    description:
      "These metals lie toward the right of the table. This is a teaching classification; category boundaries can vary between tables.",
  },
  metalloid: {
    name: "Metalloids",
    color: "#e5ead0",
    ink: "#697b38",
    description:
      "These elements show a mixture of metallic and nonmetallic properties. The exact boundaries of this category vary between tables.",
  },
  halogen: {
    name: "Halogens",
    color: "#e5def5",
    ink: "#72549b",
    description:
      "Group 17 elements commonly form −1 ions in salts. Their properties change as you move down the group.",
  },
  noble: {
    name: "Noble gases",
    color: "#f2dfee",
    ink: "#925583",
    description:
      "Group 18 includes the familiar noble gases. The lighter members have filled outer electron shells and are generally very unreactive.",
  },
  lanthanoid: {
    name: "Lanthanoids",
    color: "#dceef4",
    ink: "#477f90",
    description:
      "Elements 57–71 belong to period 6. They are shown below the main table to keep it compact.",
  },
  actinoid: {
    name: "Actinoids",
    color: "#f0e1d4",
    ink: "#936a48",
    description:
      "Elements 89–103 belong to period 7. All actinoids are radioactive; many are produced artificially.",
  },
  unknown: {
    name: "Properties under study",
    color: "#e9ecee",
    ink: "#6b7580",
    description:
      "These short-lived synthetic elements are difficult to study. Their positions are known, but many bulk chemical and physical properties remain uncertain.",
  },
} as const;
export type ElementFamily = keyof typeof ELEMENT_FAMILIES;
const records = `H Hydrogen 1.0080
He Helium 4.0026
Li Lithium 6.94
Be Beryllium 9.0122
B Boron 10.81
C Carbon 12.011
N Nitrogen 14.007
O Oxygen 15.999
F Fluorine 18.998
Ne Neon 20.180
Na Sodium 22.990
Mg Magnesium 24.305
Al Aluminium 26.982
Si Silicon 28.085
P Phosphorus 30.974
S Sulfur 32.06
Cl Chlorine 35.45
Ar Argon 39.95
K Potassium 39.098
Ca Calcium 40.078
Sc Scandium 44.956
Ti Titanium 47.867
V Vanadium 50.942
Cr Chromium 51.996
Mn Manganese 54.938
Fe Iron 55.845
Co Cobalt 58.933
Ni Nickel 58.693
Cu Copper 63.546
Zn Zinc 65.38
Ga Gallium 69.723
Ge Germanium 72.630
As Arsenic 74.922
Se Selenium 78.971
Br Bromine 79.904
Kr Krypton 83.798
Rb Rubidium 85.468
Sr Strontium 87.62
Y Yttrium 88.906
Zr Zirconium 91.224
Nb Niobium 92.906
Mo Molybdenum 95.95
Tc Technetium [97]
Ru Ruthenium 101.07
Rh Rhodium 102.91
Pd Palladium 106.42
Ag Silver 107.87
Cd Cadmium 112.41
In Indium 114.82
Sn Tin 118.71
Sb Antimony 121.76
Te Tellurium 127.60
I Iodine 126.90
Xe Xenon 131.29
Cs Caesium 132.91
Ba Barium 137.33
La Lanthanum 138.91
Ce Cerium 140.12
Pr Praseodymium 140.91
Nd Neodymium 144.24
Pm Promethium [145]
Sm Samarium 150.36
Eu Europium 151.96
Gd Gadolinium 157.25
Tb Terbium 158.93
Dy Dysprosium 162.50
Ho Holmium 164.93
Er Erbium 167.26
Tm Thulium 168.93
Yb Ytterbium 173.05
Lu Lutetium 174.97
Hf Hafnium 178.49
Ta Tantalum 180.95
W Tungsten 183.84
Re Rhenium 186.21
Os Osmium 190.23
Ir Iridium 192.22
Pt Platinum 195.08
Au Gold 196.97
Hg Mercury 200.59
Tl Thallium 204.38
Pb Lead 207.2
Bi Bismuth 208.98
Po Polonium [209]
At Astatine [210]
Rn Radon [222]
Fr Francium [223]
Ra Radium [226]
Ac Actinium [227]
Th Thorium 232.04
Pa Protactinium 231.04
U Uranium 238.03
Np Neptunium [237]
Pu Plutonium [244]
Am Americium [243]
Cm Curium [247]
Bk Berkelium [247]
Cf Californium [251]
Es Einsteinium [252]
Fm Fermium [257]
Md Mendelevium [258]
No Nobelium [259]
Lr Lawrencium [262]
Rf Rutherfordium [267]
Db Dubnium [268]
Sg Seaborgium [269]
Bh Bohrium [270]
Hs Hassium [269]
Mt Meitnerium [277]
Ds Darmstadtium [281]
Rg Roentgenium [282]
Cn Copernicium [285]
Nh Nihonium [286]
Fl Flerovium [290]
Mc Moscovium [290]
Lv Livermorium [293]
Ts Tennessine [294]
Og Oganesson [294]`;
export type PeriodicElement = {
  number: number;
  symbol: string;
  name: string;
  mass: string;
  period: number;
  group: number | null;
  column: number;
  row: number;
  family: ElementFamily;
};
export const PERIODIC_ELEMENTS: PeriodicElement[] = records
  .split("\n")
  .map((line, i) => {
    const number = i + 1;
    const [symbol, name, mass] = line.split(" ");
    const period =
      number <= 2
        ? 1
        : number <= 10
          ? 2
          : number <= 18
            ? 3
            : number <= 36
              ? 4
              : number <= 54
                ? 5
                : number <= 86
                  ? 6
                  : 7;
    const lanthanoid = number >= 57 && number <= 71,
      actinoid = number >= 89 && number <= 103;
    let group: number | null;
    if (lanthanoid || actinoid) group = null;
    else if (period === 1) group = number === 1 ? 1 : 18;
    else if (period <= 3) {
      const offset = number - (period === 2 ? 3 : 11);
      group = offset < 2 ? offset + 1 : offset + 11;
    } else if (period <= 5) group = number - (period === 4 ? 19 : 37) + 1;
    else {
      const start = period === 6 ? 55 : 87;
      group = number - start + 1 - (number >= start + 17 ? 14 : 0);
    }
    let family: ElementFamily = "post";
    if (lanthanoid) family = "lanthanoid";
    else if (actinoid) family = "actinoid";
    else if (number >= 109) family = "unknown";
    else if ([1, 6, 7, 8, 15, 16, 34].includes(number)) family = "nonmetal";
    else if ([5, 14, 32, 33, 51, 52].includes(number)) family = "metalloid";
    else if (group === 1) family = "alkali";
    else if (group === 2) family = "alkaline";
    else if (group === 17) family = "halogen";
    else if (group === 18) family = "noble";
    else if (group !== null && group >= 3 && group <= 12) family = "transition";
    return {
      number,
      symbol,
      name,
      mass,
      period,
      group,
      column: lanthanoid
        ? number - 57 + 3
        : actinoid
          ? number - 89 + 3
          : group!,
      row: lanthanoid ? 9 : actinoid ? 10 : period,
      family,
    };
  });
export function matchesElement(
  element: PeriodicElement,
  query: string,
  family: string,
) {
  const q = query.trim().toLowerCase();
  const aliases: Record<string, string> = {
    aluminum: "aluminium",
    cesium: "caesium",
  };
  return (
    (family === "all" || family === element.family) &&
    (!q ||
      element.name.toLowerCase().includes(aliases[q] ?? q) ||
      element.symbol.toLowerCase() === q ||
      String(element.number) === q)
  );
}
