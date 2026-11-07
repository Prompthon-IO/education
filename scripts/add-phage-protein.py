import json, math
from pathlib import Path

import sys
pdb_id = sys.argv[1] if len(sys.argv) > 1 else '3IG9'
lines = Path(f'/tmp/{pdb_id}.pdb').read_text().splitlines()
standard = set('ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL'.split())
groups = {}
for line in lines:
    if line.startswith('ENDMDL'): break
    if not line.startswith('ATOM  ') or line[21] != 'A' or line[16] not in ' A' or line[17:20] not in standard: continue
    element = line[76:78].strip() or line[12:16].strip()[0]
    if element not in 'CNOS': continue
    key = line[22:27].strip()
    residue = groups.setdefault(key, {'number': key, 'code': line[17:20], 'atoms': []})
    atom = {'name': line[12:16].strip(), 'element': element, 'position': [float(line[x:x + 8]) for x in (30, 38, 46)]}
    if not any(item['name'] == atom['name'] for item in residue['atoms']): residue['atoms'].append(atom)
residues = []
for residue in groups.values():
    atoms = {item['name']: item for item in residue['atoms']}
    if not all(name in atoms for name in ('CA', 'C', 'N', 'O')): continue
    residue['position'] = atoms['CA']['position']; residue['bonds'] = []
    radii = {'C': .76, 'N': .71, 'O': .66, 'S': 1.05}
    for index, atom in enumerate(residue['atoms']):
        for previous, other in enumerate(residue['atoms'][:index]):
            if .4 < math.dist(atom['position'], other['position']) < radii[atom['element']] + radii[other['element']] + .4: residue['bonds'].append([previous, index])
    residues.append(residue)
peptide = []
for index in range(len(residues) - 1):
    carbon = next(atom for atom in residues[index]['atoms'] if atom['name'] == 'C')
    nitrogen = next(atom for atom in residues[index + 1]['atoms'] if atom['name'] == 'N')
    if math.dist(carbon['position'], nitrogen['position']) < 1.9: peptide.append([index, index + 1])
pdb_meta = {'3IG9': ('Small outer capsid protein (SOC)', '噬菌体 RB69 小型外壳蛋白', '噬菌体结构', '大肠杆菌噬菌体 RB69 的外壳', 'SOC 在噬菌体成熟阶段附着于外壳，帮助稳定病毒颗粒。此处展示一个小型外壳蛋白结构域。', '单链；外壳装饰蛋白', 'Escherichia phage RB69'), '1G1C': ('Titin I1 domain', '肌联蛋白 titin I1 结构域', '肌肉结构', '人体肌肉的肌联蛋白（titin）', '肌联蛋白是巨大的弹性肌肉结构蛋白；这里展示它的 I1 免疫球蛋白样结构域，而不是整条蛋白。', '单个免疫球蛋白样结构域', 'Homo sapiens')}[pdb_id]
name, zh, category, location, description, scope, organism = pdb_meta
data = {'pdb': pdb_id, 'name': name, 'source': f'https://www.rcsb.org/structure/{pdb_id}', 'disulfides': [], 'peptideBonds': peptide, 'residues': residues}
Path(f'src/data/proteins/{pdb_id.lower()}.json').write_text(json.dumps(data, separators=(',', ':')) + '\n')
catalog_path = Path('src/data/proteins/catalog.json')
catalog = json.loads(catalog_path.read_text())
catalog.append({'pdb': pdb_id, 'chain': 'A', 'name': name, 'zh': zh, 'category': category, 'location': location, 'description': description, 'scope': scope, 'organism': organism, 'method': 'X-RAY DIFFRACTION', 'count': len(residues), 'source': f'https://www.rcsb.org/structure/{pdb_id}', 'preview': [[80, 52] for _ in residues], 'peptideBonds': peptide})
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Added {pdb_id} with {len(residues)} residues')
