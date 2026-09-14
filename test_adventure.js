'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let now=0;const stored=new Map(),element=()=>({style:{},setAttribute(){},append(){},querySelector(){return element();},querySelectorAll(){return [];},set innerHTML(x){},textContent:''});
const room={role:'waiting',gx:1,gy:1},env={console,Math:Object.create(Math),performance:{now:()=>now},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},document:{createElement:element,head:element(),getElementById:element},window:{townUI:{motionReduced:false,winCount:()=>0}},avatars:{},state:{sessionInfo:{}},ROOM_BY_ROLE:{waiting:room},displayedRooms:[room],roomDuels:new Set(),workerState:a=>env.state.sessionInfo[a.key]?.state||'working',spriteScaleFor:()=>8,layout:{scale:2},tokensOf:a=>a.tokens,clearDuelAftermath(){}};
vm.createContext(env);vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);const game=env.window.townAdventure;
assert.equal(game.hpFor(0),80);assert.equal(game.hpFor(-10),80);assert.equal(game.hpFor(Infinity),200);assert.ok(game.hpFor(1e6)>game.hpFor(1e4));
const a=env.avatars.a={key:'a',role:'waiting',x:3,y:4,tokens:1e9};env.Math.random=()=>.9;
let m=game.spawn('waiting',true);assert.ok(game.begin(a,m));assert.equal(game.active.legendary,false);
now=2000;game.step(now);assert.ok(game.active.monsterHp>0,'boss survives a hit');assert.equal(game.active.hp,game.active.maxHp,'counterattack is delayed');
now=2700;game.step(now);assert.ok(game.active.hp<game.active.maxHp);
for(let i=0;i<20&&!game.active.done;i++){now+=1800;game.step(now);}
assert.ok(game.active.won);assert.equal(game.record(a).kills,1);assert.equal(game.record(a).bosses,1);
now+=100;game.step(now);assert.equal(game.record(a).kills,1,'reward only once');
now+=4700;game.step(now);assert.equal(game.active,null);assert.ok(game.resting(a));
now+=70000;env.spriteScaleFor=()=>2;env.Math.random=()=>.1;m=game.spawn('waiting',true);assert.ok(game.begin(a,m));assert.ok(game.active.legendary);
now+=2000;game.step(now);now+=700;game.step(now);now+=3500;game.step(now);assert.ok(game.active.won,'legendary wins on final blow');
game.cancel();now+=30000;m=game.spawn('waiting');assert.ok(game.begin(a,m));env.state.sessionInfo.a={needsInput:true};game.step(++now);assert.equal(game.active,null,'response waiting cancels');assert.equal(game.record(a).kills,2);
env.state.sessionInfo.a={};now+=30000;m=game.spawn('waiting');assert.ok(game.begin(a,m));env.window.townUI.motionReduced=true;game.step(++now);assert.equal(game.active,null);assert.equal(game.monsters.length,0);
console.log('Adventure: token HP, boss multi-hit, delayed retaliation, single loot, recovery, legendary win, response and reduced-motion cancellation pass');

env.window.townUI.motionReduced=false;const walker={gx:1,gy:1,x:3,y:4,boss:false};env.Math.random=()=>.7;
for(let i=0;i<1000;i++){now+=100;game.wander(walker,now,.1);assert.ok(walker.x>=2.35&&walker.x<=6.65&&walker.y>=3.75&&walker.y<=5.75);}
assert.ok(walker.tx===undefined||walker.tx===1+1.35+.7*4.3,'waypoint depends on randomness, not resident');
console.log('Independent monster roaming stays within the floor');

const beforeBalance=game.balance();assert.equal(beforeBalance,20,'two bosses award ten each');
assert.equal(game.buy('unknown'),false);assert.equal(game.buy('astral'),false,'insufficient funds');
assert.equal(game.buy('halo'),true);assert.equal(game.balance(),15);assert.equal(game.equipped,'halo');
game.buy('halo');assert.equal(game.balance(),15,'owned item toggles without charging');assert.equal(game.equipped,'');
env.Math.random=()=>.01;now+=70000;m=game.spawn('waiting');assert.ok(game.begin(a,m));
env.state.sessionInfo.a={state:'done'};a.nextRole='research';let moved=null;env.changeRoom=(actor,role)=>{moved=role;};
now+=2000;game.step(now);assert.ok(game.active,'completed work does not interrupt fight');now+=700;game.step(now);for(let i=0;i<30&&!game.active.done;i++){now+=1000;game.step(now);}assert.ok(game.active.won);assert.equal(moved,null,'wait for reward');now+=4700;game.step(now);assert.equal(moved,'research');
assert.equal(game.balance(),16,'level one monster awards one');
console.log('Shop budget, equipment toggle, boss rewards and deferred departure pass');
for(const role of ['plan','research','design','qa']){const r={role,gx:10,gy:10};env.ROOM_BY_ROLE[role]=r;env.displayedRooms.push(r);}
for(let i=0;i<80;i++){now+=1000;game.step(now);assert.ok(game.monsters.length<=8);}
assert.ok(game.monsters.length>=6,'village replenishes six to eight monsters even without active residents');
console.log('Village population stays between six and eight after replenishment');

assert.ok(game.impactScale(12)<game.impactScale(22));assert.ok(game.impactScale(22)<game.impactScale(40));assert.ok(game.impactScale(500)<=1.7);console.log('Damage effects increase with attack strength and stay bounded');

const b=env.avatars.b={key:'b',idx:85,role:'waiting',x:3,y:4};
for(let i=0;i<6;i++)game.reward(b,true);
const aBalance=game.balance('a');assert.equal(game.balance('b'),60);
assert.ok(game.buy('frost','b'));assert.ok(game.buy('gloves','b'));assert.ok(game.buy('boots','b'));assert.ok(game.buy('fox','b'));
assert.equal(game.balance('b'),15);assert.equal(game.balance('a'),aBalance,'another session pays nothing');
for(const [slot,id] of [['weapon','frost'],['hands','gloves'],['feet','boots'],['pet','fox']]){assert.equal(game.equippedFor(b,slot),id);assert.equal(game.equippedFor(a,slot),'');}
assert.equal(game.buy('astral','b'),false,'cannot spend another session balance');assert.equal(game.buy('halo','missing'),false);
vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);let reloaded=env.window.townAdventure;
assert.equal(reloaded.equippedFor(b,'weapon'),'frost');assert.equal(reloaded.equippedFor(b,'pet'),'fox');assert.equal(reloaded.balance('b'),15);
assert.ok(reloaded.buy('boots','b'));assert.equal(reloaded.equippedFor(b,'feet'),'');assert.equal(reloaded.equippedFor(b,'hands'),'gloves','other slots remain equipped');assert.equal(reloaded.balance('b'),15);
stored.delete('codextown.shop.sessions');stored.set('codextown.shop',JSON.stringify({owned:['halo'],spent:5,equipped:'halo'}));vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);reloaded=env.window.townAdventure;
assert.equal(reloaded.equippedFor(a),'');assert.equal(reloaded.equippedFor(b),'','legacy never equips everyone');const before=reloaded.balance('b');assert.ok(reloaded.buy('halo','b'));assert.equal(reloaded.balance('b'),before,'legacy transfers once without charging');assert.ok(reloaded.buy('halo','a'));assert.equal(reloaded.balance('a'),21-5,'second session purchases separately');
console.log('Independent session wallets, seven equipment slots, persistence and one-time legacy transfer pass');

let previous=-1;const seen=new Set();for(let i=0;i<20;i++){const element=reloaded.nextElement();assert.notEqual(element,previous);seen.add(element);previous=element;}assert.equal(seen.size,5);console.log('All five finishers rotate without immediate repetition');

const weak=env.avatars.weak={key:'weak',role:'waiting',x:3,y:4,tokens:0};env.Math.random=()=>.9;env.spriteScaleFor=()=>2;
for(let loss=1;loss<=4;loss++){
 now+=70000;reloaded.monsters.length=0;const boss=reloaded.spawn('waiting',true);assert.ok(reloaded.begin(weak,boss));assert.equal(reloaded.active.legendary,false);
 for(let tick=0;tick<60&&!reloaded.active.done;tick++){now+=500;reloaded.step(now);}
 assert.equal(reloaded.active.won,false);assert.equal(reloaded.active.hp,0);assert.equal(reloaded.record(weak).lossStreak,loss);assert.equal(reloaded.balance('weak'),0);
 now+=2300;reloaded.step(now);
}
now+=70000;reloaded.monsters.length=0;assert.ok(reloaded.begin(weak,reloaded.spawn('waiting',true)));assert.ok(reloaded.active.mercy);assert.ok(reloaded.active.legendary);
for(let tick=0;tick<60&&!reloaded.active.done;tick++){now+=500;reloaded.step(now);}
assert.ok(reloaded.active.won);assert.equal(reloaded.record(weak).deaths,4);assert.equal(reloaded.record(weak).lossStreak,0);assert.equal(reloaded.balance('weak'),10);
const unarmed=reloaded.statsFor(weak);for(let i=0;i<10;i++)reloaded.reward(weak,true);reloaded.buy('frost','weak');reloaded.buy('ironshield','weak');reloaded.buy('cape','weak');const armored=reloaded.statsFor(weak);
assert.ok(armored.attack>unarmed.attack);assert.ok(armored.defense>unarmed.defense);assert.ok(armored.hp>unarmed.hp);
env.Math.random=()=>.9;const normal=reloaded.rollDamage(30,5,.1);env.Math.random=()=>.01;const critical=reloaded.rollDamage(30,5,.1);assert.ok(critical.critical);assert.ok(critical.damage>normal.damage);assert.ok(reloaded.rollDamage(30,15,0).damage<normal.damage);
env.Math.random=()=>.9;const duel=reloaded.resolveDuel(weak,a);assert.equal(duel.winner,weak,'equipped resident wins through actual stats');assert.ok(duel.snapshots.at(-1).includes(0));
console.log('Real defeat, four-loss legendary comeback, equipment stats, criticals, armor and PvP HP resolution pass');

for(const size of [16,32,48,72,96]){assert.ok(reloaded.legendaryLength(size)<=104);assert.ok(reloaded.legendaryLength(size)>size*.62);}console.log('Legendary blade stays inside the battle stage at every character size');

// Every five boss encounters offer the full roster, even with predictable randomness.
reloaded.cancel();vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);reloaded=env.window.townAdventure;env.state.sessionInfo.a={};env.spriteScaleFor=()=>8;env.Math.random=()=>.9;
let lastBoss='';const profiles=new Map();
for(let cycle=0;cycle<3;cycle++){
 const roster=new Set();
 for(let i=0;i<5;i++){
  now+=70000;reloaded.monsters.length=0;const boss=reloaded.spawn('waiting',true);
  assert.ok(boss.kind,'boss has a distinct profile');assert.notEqual(boss.kind.id,lastBoss,'no immediate repeat');lastBoss=boss.kind.id;roster.add(lastBoss);profiles.set(lastBoss,boss.kind);
  assert.ok(reloaded.begin(a,boss));const fight=reloaded.active;
  assert.equal(fight.maxMonsterHp,boss.kind.hp);assert.equal(fight.monsterAttack,boss.kind.attack);assert.equal(fight.monsterDefense,boss.kind.defense);assert.equal(fight.monsterCrit,boss.kind.crit);
  reloaded.cancel();
 }
 assert.equal(roster.size,5,'all five bosses appear before reusing one');
}
assert.equal(new Set([...profiles.values()].map(p=>p.idx)).size,5,'different source sprites');
assert.equal(new Set([...profiles.values()].map(p=>p.skill)).size,5,'different attack signatures');
assert.ok(new Set([...profiles.values()].map(p=>p.hp)).size>=3,'different combat strengths');
console.log('Five distinct bosses rotate without repeats and use individual combat stats');

// Combat difficulty and actual payouts progress through all ten levels.
const hunter=env.avatars.hunter={key:'hunter',role:'waiting',x:3,y:4,tokens:1e9};
let lastHp=0,lastAttack=0,total=0;
for(let level=1;level<=10;level++){
 now+=70000;reloaded.monsters.length=0;env.Math.random=()=> Math.min(.99,(level-.5)/9);
 const monster=reloaded.spawn('waiting',level===10);assert.equal(monster.level,level);
 env.Math.random=()=>.99;assert.ok(reloaded.begin(hunter,monster));const fight=reloaded.active;
 assert.ok(fight.maxMonsterHp>lastHp);assert.ok(fight.monsterAttack>=lastAttack);lastHp=fight.maxMonsterHp;lastAttack=fight.monsterAttack;
 assert.equal(fight.reward,level);
 for(let tick=0;tick<100&&!fight.done;tick++){now+=500;reloaded.step(now);}
 assert.ok(fight.won);total+=level;assert.equal(reloaded.balance('hunter'),total);
 now+=100;reloaded.step(now);assert.equal(reloaded.balance('hunter'),total,'no duplicate payout');
 now+=4700;reloaded.step(now);
}
assert.equal(total,55);
console.log('Levels 1–10 increase difficulty and award exactly 1–10 stardust');

// Old bosses were worth eight: upgrading must preserve existing savings and purchases.
stored.set('codextown.adventure',JSON.stringify({legacy:{kills:12,bosses:2,deaths:3,lossStreak:1}}));
stored.set('codextown.shop.sessions',JSON.stringify({sessions:{legacy:{owned:['steel'],equipped:{weapon:'steel'},spent:8}},legacy:[]}));
const legacy=env.avatars.legacy={key:'legacy',role:'waiting',tokens:0};
vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);reloaded=env.window.townAdventure;
assert.equal(reloaded.balance('legacy'),18);assert.equal(reloaded.equippedFor(legacy,'weapon'),'steel');
reloaded.reward(legacy,false,7);assert.equal(reloaded.balance('legacy'),25);assert.equal(reloaded.record(legacy).deaths,3);
vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);reloaded=env.window.townAdventure;
assert.equal(reloaded.balance('legacy'),25,'new graded earnings survive reload');assert.equal(reloaded.equippedFor(legacy,'weapon'),'steel');
reloaded.reward(legacy,true);assert.equal(reloaded.balance('legacy'),35,'future bosses pay ten');
console.log('Legacy balances, purchases and graded earnings survive migration and reload');
