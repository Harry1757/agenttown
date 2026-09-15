'use strict';
// Seeded full fights use production damage, equipment, timing and reward logic.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let now=0,seed=5192026,size=2;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const stored=new Map(),element=()=>({style:{},setAttribute(){},append(){},querySelector(){return element();},querySelectorAll(){return [];},set innerHTML(x){},textContent:''});
const room={role:'waiting',gx:1,gy:1},env={console,Math:Object.create(Math),performance:{now:()=>now},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},document:{createElement:element,head:element(),getElementById:element},window:{townUI:{motionReduced:false,winCount:()=>0}},avatars:{},state:{sessionInfo:{}},ROOM_BY_ROLE:{waiting:room},displayedRooms:[room],roomDuels:new Set(),workerState:()=> 'working',spriteScaleFor:()=>size*2,layout:{scale:2},tokensOf:a=>a.tokens,clearDuelAftermath(){}};
vm.createContext(env);vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);const g=env.window.townAdventure;
const builds=[['small',1,0,[]],['unarmed',2,1e9,[]],['veteran',2,1e9,['astral','ironshield','cape','crown','gloves','boots','fox']],['guardian',2,1e9,['tideblade','aegis','runecrown','warden','sungrip','starboots','lantern','moonfox']],['striker',2,1e9,['thunderblade','aegis','runecrown','nightwings','runegloves','starboots','compass','cub']]];
const results={};
for(const [name,mul,tokens,items]of builds){
 size=mul;const a=env.avatars[name]={key:name,role:'waiting',x:3,y:4,tokens};g.reward(a,false,1000);for(const id of items)assert.ok(g.buy(id,name));
 const rates=[];
 for(let level=1;level<=10;level++){
  let wins=0,rounds=0;
  for(let trial=0;trial<200;trial++){
   g.cancel();now+=70000;g.monsters.length=0;env.Math.random=()=>Math.min(.99,(level-.5)/9);
   const m=g.spawn('waiting',level===10);env.Math.random=rng;g.reward(a,false,0);assert.ok(g.begin(a,m));const b=g.active;
   // Separate gear balance from the existing 20% lucky legendary mechanic.
   b.legendary=false;b.mercy=false;
   for(let tick=0;tick<200&&!b.done;tick++){now+=250;g.step(now);}
   assert.ok(b.done,'battle terminates');if(b.won)wins++;rounds+=b.round;
  }
  rates.push(wins/2);
 }
 results[name]={stats:g.statsFor(a),winPercent:rates};delete env.avatars[name];
}
console.log(JSON.stringify(results,null,2));
assert.ok(results.small.winPercent[0]>50,'small residents can start earning');
assert.ok(results.unarmed.winPercent[7]<20&&results.unarmed.winPercent[8]<10,'high levels punish no gear');
assert.ok(results.veteran.winPercent[9]>10&&results.veteran.winPercent[9]<90,'bosses threaten a veteran');
assert.ok(results.guardian.winPercent[9]>results.veteran.winPercent[9],'defensive upgrades matter');
assert.ok(results.striker.winPercent[9]>results.unarmed.winPercent[9],'offensive upgrades matter');
// A lethal critical gets preparation; the displayed preparation and delivered roll agree.
g.cancel();now+=70000;g.monsters.length=0;size=2;const a=env.avatars.critical={key:'critical',role:'waiting',x:3,y:4,tokens:1e9};env.Math.random=()=>0;
const m=g.spawn('waiting');m.power={...m.power,hp:50};assert.ok(g.begin(a,m));const b=g.active;
assert.ok(b.nextHit.critical&&b.finishing);assert.equal(b.windup,3000);assert.equal(b.next-now,1100+280+3000);
env.Math.random=()=>.99;now=b.next;g.step(now);assert.ok(b.won&&b.dealtCritical);assert.equal(b.inflictedDamage,b.nextHit.damage);
console.log('Lethal critical preparation uses the same reserved damage roll');

// A rare legendary comeback still reaches its promised final swing against a boss critical.
g.cancel();now+=70000;g.monsters.length=0;size=1;const lucky=env.avatars.lucky={key:'lucky',role:'waiting',x:3,y:4,tokens:0};env.Math.random=()=>0;
assert.ok(g.begin(lucky,g.spawn('waiting',true)));const comeback=g.active;assert.ok(comeback.legendary);comeback.monsterAttack=100;
now=comeback.next;g.step(now);now=comeback.counterAt;g.step(now);assert.ok(comeback.hp>=1&&!comeback.done);assert.ok(comeback.receivedCritical&&comeback.receivedDamage>=comeback.maxHp);
now=comeback.next;g.step(now);assert.ok(comeback.done&&comeback.won);console.log('Legendary comeback survives a lethal boss critical and completes its final blow');

// Elite bosses reward preparation without becoming automatic wins for the new equipment.
const eliteRates={};
for(const [name,items]of [['oldGear',['tideblade','aegis','runecrown','warden','sungrip','starboots','lantern','moonfox']],['endgame',['voidblade','bulwark','imperial','celestial','titanhand','cometboots','astrolabe','dragonling']]]){
 size=2;const a=env.avatars[name]={key:name,role:'waiting',x:3,y:4,tokens:1e9};g.reward(a,false,5000);for(const id of items)assert.ok(g.buy(id,name));const counts={12:0,14:0,16:0};
 for(let trial=0;trial<600;trial++){
  g.cancel();now+=70000;g.monsters.length=0;env.Math.random=rng;g.reward(a,false,0);const monster=g.spawn('waiting',true,true),before=g.balance(a.key);assert.ok(g.begin(a,monster));const fight=g.active;fight.legendary=false;
  for(let tick=0;tick<300&&!fight.done;tick++){now+=250;g.step(now);}assert.ok(fight.done);
  if(fight.won){counts[monster.level]++;assert.equal(g.balance(a.key)-before,monster.reward);}else assert.equal(g.balance(a.key),before);
 }
 eliteRates[name]=Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v/2]));delete env.avatars[name];
}
assert.ok(eliteRates.endgame[12]>eliteRates.oldGear[12]);assert.ok(eliteRates.endgame[16]>5&&eliteRates.endgame[16]<95);
console.log('Elite boss win percentages (without legendary): '+JSON.stringify(eliteRates));
