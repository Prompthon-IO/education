"""Build bundled teaching structures from public RCSB PDB files.
Download https://files.rcsb.org/download/{pdb}.pdb into the input directory,
then run: python3 scripts/build-protein-library.py /path/to/pdb-files
Uses first model, one named chain, standard amino acids, heavy atoms,
and one alternate conformer (blank/A). No predicted coordinates are substituted.
"""
import json, math, sys
from pathlib import Path
entries = [
('1CRN','A','Crambin','海甘蓝种子蛋白','植物种子','海甘蓝近缘植物的种子','小型植物蛋白，常用于研究蛋白质折叠与晶体结构；生物学功能尚未完全明确。','单链'),
('1UBQ','A','Ubiquitin','泛素','细胞调控','人体及其他真核生物的细胞中','像一个分子标签，帮助细胞调控蛋白质的降解和其他活动。','单链'),
('1LYZ','A','Lysozyme','溶菌酶','防御','鸡蛋蛋清；同类蛋白也见于人的泪液和唾液','切开某些细菌细胞壁的多糖，参与防御。这里是鸡蛋清溶菌酶。','单链'),
('1MBN','A','Myoglobin','肌红蛋白','氧气运输','抹香鲸肌肉；同类蛋白广泛存在于脊椎动物肌肉','结合氧气，帮助肌肉储存和利用氧。血红素辅基未在此简化模型中显示。','单链'),
('4HHB','A','Hemoglobin','血红蛋白','氧气运输','人的红细胞','负责运输氧气。天然血红蛋白由两条 α 链和两条 β 链组成；这里观察其中一条 α 链。','α 亚基；非完整四聚体'),
('1BPI','A','Pancreatic trypsin inhibitor','胰蛋白酶抑制剂','酶调控','牛的胰腺等组织','结合并抑制胰蛋白酶；三条二硫键帮助稳定这个小蛋白。','单链'),
('7RSA','A','Ribonuclease A','核糖核酸酶 A','消化酶','牛胰腺分泌的消化液','切断 RNA 中的某些磷酸二酯键，帮助分解 RNA。','单链'),
('1TIM','A','Triosephosphate isomerase','磷酸丙糖异构酶','代谢酶','鸡肌肉细胞；同类酶也在其他生物细胞中','让两种三碳糖磷酸互相转化，是糖酵解途径的一员。可观察典型的桶状折叠。','二聚体中的一个亚基'),
('1AKE','A','Adenylate kinase','腺苷酸激酶','代谢酶','大肠杆菌细胞','催化 ATP + AMP ⇌ 2 ADP，帮助平衡细胞中的能量分子。这里是与抑制剂结合时的蛋白构象。','一个亚基；抑制剂未显示'),
('1VII','A','Villin','绒毛蛋白','细胞骨架','鸡的肠道等上皮细胞微绒毛中','完整绒毛蛋白帮助组织肌动蛋白骨架。这里是它的小型 headpiece 子结构域。','headpiece 子结构域；非全长'),
('1PGB','A','Protein G','蛋白 G','抗体结合','链球菌表面','能够结合免疫球蛋白，研究中也用来捕获抗体。这里显示 B1 抗体结合结构域。','B1 结构域；非全长'),
('2PTC','E','Trypsin','胰蛋白酶','消化酶','牛胰腺产生，在小肠发挥作用','帮助切断蛋白质的肽键，通常在赖氨酸或精氨酸后切割。结构取自与抑制剂形成的复合物。','酶链 E；抑制剂链未显示'),
('1STP','A','Streptavidin','链霉亲和素','分子结合','亲和链霉菌产生的蛋白','非常牢固地结合生物素，因此常用于生物实验中的分子捕获。','核心结构的一个亚基；非完整四聚体'),
('1AZU','A','Azurin','天青蛋白','电子传递','铜绿假单胞菌的周质空间','含铜的电子传递蛋白，铜中心与蓝色外观有关。此处只展示蛋白质部分。','单链；铜离子未显示'),
('1CTF','A','Ribosomal protein L7/L12','核糖体蛋白 L7/L12','蛋白质合成','大肠杆菌核糖体','参与核糖体与翻译因子的相互作用，帮助合成蛋白质。这里显示 C 端结构域。','C 端结构域；非全长'),
('1CYO','A','Cytochrome b5','细胞色素 b₅','电子传递','牛细胞的内质网膜系统','通过血红素参与电子传递。这里是可溶性结构部分，不包含完整膜锚定区。','可溶性结构域；非全长'),
('1HRC','A','Cytochrome c','细胞色素 c','电子传递','马心肌细胞的线粒体','在呼吸链中传递电子，参与细胞获取能量。血红素及修饰残基不在简化模型中显示。','标准残基部分；修饰位点留空'),
('1BTA','A','Barstar','芽孢杆菌核糖核酸酶抑制剂','酶调控','解淀粉芽孢杆菌细胞内','抑制同一细菌产生的 barnase 核糖核酸酶，帮助保护细胞自身的 RNA。','单链；NMR 结构'),
('1RTP','1','Parvalbumin','小清蛋白','钙调控','大鼠肌肉及部分神经细胞','结合钙离子，参与调节细胞内钙的变化。此条目来自黑家鼠。','一个亚基；钙离子未显示'),
('2CBA','A','Carbonic anhydrase II','碳酸酐酶 II','代谢酶','人的红细胞等多种组织','加速二氧化碳与水生成碳酸氢根和氢离子的可逆反应，参与酸碱平衡。','已解析的单链部分；锌离子未显示'),
('3IG9','A','Small outer capsid protein (SOC)','噬菌体 RB69 小型外壳蛋白','噬菌体结构','大肠杆菌噬菌体 RB69 的外壳','SOC 在噬菌体成熟阶段附着于外壳，帮助稳定病毒颗粒。此处展示一个小型外壳蛋白结构域。','单链；外壳装饰蛋白'),
('1G1C','A','Titin I1 domain','肌联蛋白 titin I1 结构域','肌肉结构','人体肌肉的肌联蛋白（titin）','肌联蛋白是巨大的弹性肌肉结构蛋白；这里展示它的 I1 免疫球蛋白样结构域，而不是整条蛋白。','单个免疫球蛋白样结构域'),
]
root=Path('src/data/proteins');root.mkdir(exist_ok=True)
standard=set('ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL'.split())
catalog=[]
for pdb,chain,name,zh,category,location,description,scope in entries:
 lines=(Path(sys.argv[1])/(pdb+'.pdb')).read_text().splitlines(); groups={}
 for l in lines:
  if l.startswith('ENDMDL'): break
  if not l.startswith('ATOM  ') or l[21]!=chain or l[16] not in ' A' or l[17:20] not in standard: continue
  element=l[76:78].strip() or l[12:16].strip()[0]
  if element not in ['C','N','O','S']: continue
  key=l[22:27].strip();g=groups.setdefault(key,{'number':key,'code':l[17:20],'atoms':[]})
  atom={'name':l[12:16].strip(),'element':element,'position':[float(l[x:x+8]) for x in [30,38,46]]}
  if not any(a['name']==atom['name'] for a in g['atoms']):g['atoms'].append(atom)
 residues=[];keys=[]
 for key,r in groups.items():
  a={a['name']:a for a in r['atoms']}
  if not all(x in a for x in ['CA','C','N','O']):continue
  r['position']=a['CA']['position'];r['bonds']=[]
  radii={'C':.76,'N':.71,'O':.66,'S':1.05}
  for i,u in enumerate(r['atoms']):
   for j,v in enumerate(r['atoms'][:i]):
    if .4<math.dist(u['position'],v['position'])<radii[u['element']]+radii[v['element']]+.4:r['bonds'].append([j,i])
  residues.append(r);keys.append(key)
 peptide=[]
 for i in range(len(residues)-1):
  c=next(a for a in residues[i]['atoms'] if a['name']=='C');n=next(a for a in residues[i+1]['atoms'] if a['name']=='N')
  if math.dist(c['position'],n['position'])<1.9:peptide.append([i,i+1])
 ss=[]
 for l in lines:
  if l.startswith('SSBOND') and l[15]==chain and l[29]==chain:
   a=l[17:22].strip();b=l[31:36].strip()
   if a in keys and b in keys:ss.append([keys.index(a)+1,keys.index(b)+1])
 for i,r in enumerate(residues):
  a=next((a for a in r['atoms'] if r['code']=='CYS' and a['name']=='SG'),None)
  if a:
   for j in range(i+1,len(residues)):
    b=next((a for a in residues[j]['atoms'] if residues[j]['code']=='CYS' and a['name']=='SG'),None)
    if b and 1.8 < math.dist(a['position'],b['position']) < 2.3 and [i+1,j+1] not in ss:ss.append([i+1,j+1])
 source='https://www.rcsb.org/structure/'+pdb
 data={'pdb':pdb,'name':name,'source':source,'disulfides':ss,'peptideBonds':peptide,'residues':residues}
 (root/(pdb.lower()+'.json')).write_text(json.dumps(data,separators=(',',':'))+'\n')
 organism=' '.join(l[10:].strip() for l in lines if l.startswith('SOURCE') and 'ORGANISM_SCIENTIFIC:' in l).replace('ORGANISM_SCIENTIFIC:','').strip(' ;')
 method=' '.join(l[10:].strip() for l in lines if l.startswith('EXPDTA'))
 center=[sum(r['position'][j] for r in residues)/len(residues) for j in range(3)]
 points=[[round(r['position'][j]-center[j],3) for j in range(3)] for r in residues];extent=max(math.hypot(*p) for p in points)
 preview=[[round(80+p[0]/extent*65,1),round(52+p[1]/extent*43,1)] for p in points]
 catalog.append(dict(pdb=pdb,chain=chain,name=name,zh=zh,category=category,location=location,description=description,scope=scope,organism=organism,method=method,count=len(residues),source=source,preview=preview,peptideBonds=peptide))
 print(pdb,len(residues),'residues',len(peptide),'peptides',len(ss),'SS')
(root/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n')
