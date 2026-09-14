'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let now=0;const stored=new Map(),element=()=>({style:{},append(){},querySelector(){return element();},set innerHTML(x){},textContent:''});
const room={role:'waiting',gx:1,gy:1},env={console,Math:Object.create(Math),performance:{now:()=>now},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},document:{createElement:element,head:element(),getElementById:element},window:{townUI:{motionReduced:false,winCount:()=>0}},avatars:{},state:{sessionInfo:{}},ROOM_BY_ROLE:{waiting:room},displayedRooms:[room],roomDuels:new Set(),workerState:a=>env.state.sessionInfo[a.key]?.state||'working',spriteScaleFor:()=>2,layout:{scale:2},tokensOf:a=>a.tokens,clearDuelAftermath(){}};
vm.createContext(env);vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);const game=env.window.townAdventure;
assert.equal(game.hpFor(0),80);assert.equal(game.hpFor(-10),80);assert.equal(game.hpFor(Infinity),200);assert.ok(game.hpFor(1e6)>game.hpFor(1e4));
const a=env.avatars.a={key:'a',role:'waiting',x:3,y:4,tokens:1e6};env.Math.random=()=>.9;
let m=game.spawn('waiting',true);assert.ok(game.begin(a,m));assert.equal(game.active.legendary,false);
now=2000;game.step(now);assert.ok(game.active.monsterHp>0,'boss survives a hit');assert.equal(game.active.hp,game.active.maxHp,'counterattack is delayed');
now=2700;game.step(now);assert.ok(game.active.hp<game.active.maxHp);
for(let i=0;i<20&&!game.active.done;i++){now+=1800;game.step(now);}
assert.ok(game.active.won);assert.equal(game.record(a).kills,1);assert.equal(game.record(a).bosses,1);
now+=100;game.step(now);assert.equal(game.record(a).kills,1,'reward only once');
now+=4700;game.step(now);assert.equal(game.active,null);assert.ok(game.resting(a));
now+=70000;env.Math.random=()=>.1;m=game.spawn('waiting',true);assert.ok(game.begin(a,m));assert.ok(game.active.legendary);
now+=2000;game.step(now);now+=700;game.step(now);now+=3500;game.step(now);assert.ok(game.active.won,'legendary wins on final blow');
game.cancel();now+=30000;m=game.spawn('waiting');assert.ok(game.begin(a,m));env.state.sessionInfo.a={needsInput:true};game.step(++now);assert.equal(game.active,null,'response waiting cancels');assert.equal(game.record(a).kills,2);
env.state.sessionInfo.a={};now+=30000;m=game.spawn('waiting');assert.ok(game.begin(a,m));env.window.townUI.motionReduced=true;game.step(++now);assert.equal(game.active,null);assert.equal(game.monsters.length,0);
console.log('Adventure: token HP, boss multi-hit, delayed retaliation, single loot, recovery, legendary win, response and reduced-motion cancellation pass');

env.window.townUI.motionReduced=false;const walker={gx:1,gy:1,x:3,y:4,boss:false};env.Math.random=()=>.7;
for(let i=0;i<1000;i++){now+=100;game.wander(walker,now,.1);assert.ok(walker.x>=2.35&&walker.x<=6.65&&walker.y>=3.75&&walker.y<=5.75);}
assert.ok(walker.tx===undefined||walker.tx===1+1.35+.7*4.3,'waypoint depends on randomness, not resident');
console.log('Independent monster roaming stays within the floor');

const beforeBalance=game.balance();assert.equal(beforeBalance,16,'two bosses award eight each');
assert.equal(game.buy('unknown'),false);assert.equal(game.buy('orbit'),false,'insufficient funds');
assert.equal(game.buy('halo'),true);assert.equal(game.balance(),11);assert.equal(game.equipped,'halo');
game.buy('halo');assert.equal(game.balance(),11,'owned item toggles without charging');assert.equal(game.equipped,'');
env.Math.random=()=>.9;now+=70000;m=game.spawn('waiting');assert.ok(game.begin(a,m));
env.state.sessionInfo.a={state:'done'};a.nextRole='research';let moved=null;env.changeRoom=(actor,role)=>{moved=role;};
now+=2000;game.step(now);assert.ok(game.active,'completed work does not interrupt fight');now+=700;game.step(now);now+=2500;game.step(now);assert.ok(game.active.won);assert.equal(moved,null,'wait for reward');now+=4700;game.step(now);assert.equal(moved,'research');
assert.equal(game.balance(),12,'ordinary monster awards one');
console.log('Shop budget, equipment toggle, boss rewards and deferred departure pass');
for(const role of ['plan','research','design','qa']){const r={role,gx:10,gy:10};env.ROOM_BY_ROLE[role]=r;env.displayedRooms.push(r);}
for(let i=0;i<80;i++){now+=1000;game.step(now);assert.ok(game.monsters.length<=4);}
assert.ok(game.monsters.length>=3,'village replenishes three to four monsters even without active residents');
console.log('Village population stays between three and four after replenishment');
