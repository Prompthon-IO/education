import {describe,it,expect} from 'vitest';
import {PROTEIN,AMINO_ACIDS,proteinBreakdown,isolatedResidue,residuePosition} from './protein-model';
describe('Crambin protein explorer',()=>{
 it('uses the 46-residue experimental sequence and its three disulfides',()=>{
  expect(PROTEIN.residues).toHaveLength(46);
  expect(PROTEIN.residues.map(r=>AMINO_ACIDS[r.code].letter).join('')).toBe('TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN');
  expect(PROTEIN.residues.reduce((n,r)=>n+r.atoms.length,0)).toBe(327);
  expect(PROTEIN.disulfides).toHaveLength(3);
  for(const pair of PROTEIN.disulfides)for(const i of pair)expect(PROTEIN.residues[i-1].code).toBe('CYS');
 });
 it('accounts for every hydrolysed peptide bond and independent chain fragment',()=>{
  expect(proteinBreakdown(0)).toMatchObject({peptideCuts:0,disulfideCuts:0,fragments:1});
  expect(proteinBreakdown(.5)).toMatchObject({peptideCuts:0,disulfideCuts:3,fragments:1});
  expect(proteinBreakdown(1)).toMatchObject({peptideCuts:45,disulfideCuts:3,fragments:46,waterMolecules:45,complete:true});
 });
 it('adds one terminal oxygen where needed and matches free amino-acid heavy-atom formulae',()=>{
  const digits='₀₁₂₃₄₅₆₇₈₉';
  for(const residue of PROTEIN.residues){
   const original=JSON.stringify(residue);
   const free=isolatedResidue(residue,true);
   expect(free.atoms.filter(a=>a.name==='OXT')).toHaveLength(1);
   const formula=AMINO_ACIDS[residue.code].formula.replace(/[₀-₉]/g,c=>String(digits.indexOf(c)));
   for(const [,symbol,count] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)){
    if(symbol!=='H')expect(free.atoms.filter(a=>a.element===symbol),residue.code).toHaveLength(Number(count||1));
   }
   for(const bond of free.bonds){expect(free.atoms[bond[0]]).toBeDefined();expect(free.atoms[bond[1]]).toBeDefined();}
   expect(JSON.stringify(residue)).toBe(original);
  }
 });
 it('keeps each residue selectable at finite coordinates during unfolding and separation',()=>{
  for(const p of [0,.2,.5,.8,1]){const positions=PROTEIN.residues.map((_,i)=>residuePosition(i,p));expect(positions.every(v=>v.every(Number.isFinite))).toBe(true);expect(new Set(positions.map(v=>v.join(','))).size).toBe(46);}
 });
});
