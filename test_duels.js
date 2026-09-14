'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(`${__dirname}/town.html`,'utf8');
let now=0,wins=0;
const room={role:'plan',gx:1,gy:1};
const env={Math,performance:{now:()=>now},window:{townUI:{motionReduced:false,recordWin:()=>wins++}},
  avatars:{},state:{sessionInfo:{}},ROOM_BY_ROLE:{plan:room},displayedRooms:[room],ROOM_W:8,ROOM_H:7,DESK_CLEAR:1.9,
  roomDuels:new Set(),nextDuelCheck:Infinity,layout:{scale:2},workerState:a=>a.st||'working',
  spriteScaleFor:(a,s)=>s*(a.duel?(a===a.duel.a?a.duel.ha:a.duel.hb):a.h),};
vm.createContext(env);
for(const name of ['wanderBox','duelWinChance','duelFrame','duelEligible','clearDuelAftermath','duelAftermathPoint','stepDuelAftermath','beginDuel','endDuel','stepDuels']){
  const match=html.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match,name);vm.runInContext(match[0],env);
}
const actor=(id,x,h=1)=>{
  const a={key:'p|'+id,proj:'p',sid:id,role:'plan',x:x+1,y:4.5,tx:x+1,ty:4.5,h};
  env.avatars[a.key]=a;env.state.sessionInfo[a.key]={};return a;
};
assert.equal(env.duelWinChance(2,1),.9);assert.equal(env.duelWinChance(1,2),.1);assert.equal(env.duelWinChance(2,2),.5);
assert.equal(Array.from({length:1000},(_,i)=>(i+.5)/1000<env.duelWinChance(2,1)).filter(Boolean).length,900);
const a=actor('a',1.2),b=actor('b',2.4),c=actor('c',4.6),d=actor('d',5.8);
assert.ok(env.beginDuel(a,b,0));assert.ok(env.beginDuel(c,d,0));assert.equal(env.roomDuels.size,2);
const firstDuel=a.duel;
assert.equal(env.beginDuel(a,c,0),false,'no actor in two pairs');
for(now=0;now<=5500;now+=50){
  env.stepDuels(now);
  for(const v of [a,b,c,d]){const box=env.wanderBox(v,v.h);assert.ok(v.x>=box.x0&&v.x<=box.x1&&v.y>=box.y0&&v.y<=box.y1);}
}
assert.equal(wins,2,'one victory per pair');now=5700;env.stepDuels(now);assert.equal(env.roomDuels.size,0);
for(const v of [a,b,c,d]){assert.equal(v.duel,null);assert.equal(v.duelPose,null);assert.ok(v.duelAfter>now);}
assert.equal(wins,2);
const winner=firstDuel.winner,loser=winner===a?b:a;
assert.equal(loser.fleeFrom,winner.key);assert.equal(loser.fleeUntil,now+4500);
assert.ok(winner.duelOpponents.has(loser.key));
const flee=env.duelAftermathPoint(loser,winner,true),box=env.wanderBox(loser,loser.h);
assert.ok(flee.x>=box.x0&&flee.x<=box.x1&&flee.y>=box.y0&&flee.y<=box.y1);
assert.ok(Math.hypot(flee.x-winner.x,flee.y-winner.y)>=Math.hypot(loser.x-winner.x,loser.y-winner.y));
const newcomer=actor('new',3.5);newcomer.duelAfter=0;
assert.ok(env.stepDuelAftermath(winner,now+1));assert.equal(winner.seekTarget,newcomer.key);
delete env.avatars[newcomer.key];env.stepDuelAftermath(winner,now+2);assert.equal(winner.seekTarget,null);
env.stepDuelAftermath(loser,now+4600);assert.equal(loser.fleeFrom,null);assert.equal(loser.socialMotion,false);
assert.ok(env.beginDuel(a,b,now));env.window.townUI.motionReduced=true;env.stepDuels(now+10);assert.equal(env.roomDuels.size,0);assert.equal(wins,2);
env.window.townUI.motionReduced=false;
assert.ok(env.beginDuel(a,b,now));env.state.sessionInfo[a.key].needsInput=true;env.stepDuels(now+20);assert.equal(env.roomDuels.size,0);delete env.state.sessionInfo[a.key].needsInput;
assert.ok(env.beginDuel(a,b,now));delete env.avatars[a.key];env.stepDuels(now+30);assert.equal(b.duel,null);assert.equal(wins,2);
env.avatars[a.key]=a;a.x=room.gx+.2;assert.equal(env.beginDuel(a,b,now),false,'reject wall overlap');
for(let t=0;t<5.6;t+=.01){const f=env.duelFrame(t);assert.ok(f.back>=0&&f.back<=1);assert.ok(f.hop>=0&&f.hop<=.31);}
for(const [i,v] of [a,b,c,d].entries()){v.x=v.tx=1+[1.2,2.4,4.6,5.8][i];v.y=v.ty=4.5;v.duelAfter=0;}
env.Math=Object.create(Math);env.Math.random=()=>0;env.nextDuelCheck=0;
env.stepDuels(10000);assert.equal(env.roomDuels.size,2,'nearby residents automatically pair independently');
env.window.townUI.motionReduced=true;env.stepDuels(10001);assert.equal(env.roomDuels.size,0);
console.log('Duels: 90/10 odds, equal sizes, independent pairs, wall bounds, single awards, cooldown and cancellation pass');
