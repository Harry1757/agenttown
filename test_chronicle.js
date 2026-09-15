const assert=require('node:assert/strict');
const {createTownChronicle}=require('./town-chronicle');
let raw='invalid';const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};
const c=createTownChronicle(storage),a={key:'a',title:'첫 세션'},b={key:'b',title:'다음 세션'};
assert.equal(c.autoMode('a'),'off');assert.equal(c.setAuto('a','invalid'),false);
c.setAuto('a','tank');assert.equal(c.autoMode('b'),'off');
const m={boss:true,kind:{id:'frost'},name:'서리 망령',idx:121};c.see(m);c.hit(m,100);c.hit(m,30);c.result(m,true);c.duel(a,b);c.duel(b,a);c.cooperate([a,b]);c.treasure('caught',25);c.raid('won');
const restored=createTownChronicle(storage);assert.equal(restored.snapshot().bosses[0].maxHit,100);assert.equal(restored.relation(a,b).duels,2);assert.equal(restored.relation(a,b).coops,1);assert.equal(restored.autoMode('a'),'tank');assert.equal(restored.snapshot().treasure.stars,25);
const items=[{id:'small',slot:'weapon',price:5,stats:{attack:2}},{id:'big',slot:'weapon',price:30,stats:{attack:10}},{id:'guard',slot:'shield',price:15,stats:{defense:10}}];
assert.equal(c.chooseUpgrade(items,{},30,'attack').id,'big');assert.equal(c.chooseUpgrade(items,{},30,'tank').id,'guard');assert.equal(c.chooseUpgrade(items,{},4,'balanced'),null);assert.equal(c.chooseUpgrade(items,{weapon:'big',shield:'guard'},30,'attack'),null);assert.equal(c.chooseUpgrade(items,{},0,'attack',['big']).id,'big');assert.equal(c.chooseUpgrade(items,{},100,'off'),null);
console.log('Chronicle persistence, relationships and independent upgrade strategies passed');

raw=JSON.stringify({bosses:[null,3],relations:[null,false]});assert.doesNotThrow(()=>createTownChronicle(storage));
