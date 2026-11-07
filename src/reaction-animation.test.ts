import { describe, it, expect } from 'vitest';
import { WATER_ATOMS, WATER_INITIAL_BONDS, WATER_FINAL_BONDS, stageForProgress, proteinPoint } from './reaction-animation';
describe('reaction animation teaching models',()=>{
 it('maps two hydrogen molecules and one oxygen molecule to two water molecules',()=>{
  expect(WATER_ATOMS.filter(a=>a.element==='H')).toHaveLength(4);
  expect(WATER_ATOMS.filter(a=>a.element==='O')).toHaveLength(2);
  expect(WATER_INITIAL_BONDS.map(([a,b])=>WATER_ATOMS[a].element+WATER_ATOMS[b].element).sort()).toEqual(['HH','HH','OO']);
  for(const [i,a] of WATER_ATOMS.entries()){
   expect(WATER_FINAL_BONDS.filter(b=>b.includes(i))).toHaveLength(a.element==='H'?1:2);
  }
  expect(WATER_FINAL_BONDS.every(([a,b])=>WATER_ATOMS[a].element!==WATER_ATOMS[b].element)).toBe(true);
 });
 it('uses valid chapters at endpoints and seek positions',()=>{
  expect([0,.3,.6,1].map(stageForProgress)).toEqual([0,1,2,3]);
  expect(stageForProgress(1.1)).toBe(3);expect(stageForProgress(-.1)).toBe(0);
 });
 it('moves continuous protein chains closer during aggregation without losing residues',()=>{
  const distance=(p:number)=>Math.hypot(...proteinPoint(9,0,p).map((v,i)=>v-proteinPoint(9,1,p)[i]));
  expect(distance(1)).toBeLessThan(distance(.5));
  for(const p of [0,.3,.6,1])for(let c=0;c<3;c++)for(let i=0;i<19;i++)expect(proteinPoint(i,c,p).every(Number.isFinite)).toBe(true);
 });
});
