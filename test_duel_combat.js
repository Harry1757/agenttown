'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let now=0,wins=0;const stored=new Map(),element=()=>({style:{},setAttribute(){},append(){},querySelector(){return element();},querySelectorAll(){return [];},set innerHTML(x){},textContent:''});
const room={role:'waiting',gx:1,gy:1},env={console,Math:Object.create(Math),performance:{now:()=>now},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},document:{createElement:element,head:element(),getElementById:element},window:{townUI:{motionReduced:false,recordWin:()=>wins++,winCount:()=>0}},avatars:{},state:{sessionInfo:{}},ROOM_BY_ROLE:{waiting:room},displayedRooms:[room],ROOM_W:8,ROOM_H:7,DESK_CLEAR:1.9,roomDuels:new Set(),nextDuelCheck:Infinity,layout:{scale:2},workerState:()=> 'working',spriteScaleFor:a=>a.h*2,tokensOf:a=>a.tokens,changeRoom(a,role){a.role=role;}};
vm.createContext(env);const html=fs.readFileSync('town.html','utf8');
for(const name of ['wanderBox','duelWinChance','duelFrame','duelEligible','clearDuelAftermath','beginDuel','endDuel','stepDuels']){const match=html.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));assert.ok(match,name);vm.runInContext(match[0],env);}
const source=fs.readFileSync('town-adventure.js','utf8');vm.runInContext(source,env);let g=env.window.townAdventure;env.Math.random=()=>.99;
const actor=(id,x,h=1,tokens=0)=>{const key='duel|'+id,a=env.avatars[key]={key,proj:'duel',sid:id,idx:84,role:'waiting',x,y:4.6,tx:x,ty:4.6,h,tokens,duelAfter:Infinity};env.state.sessionInfo[key]={};return a;};
const a=actor('a',2.2),b=actor('b',3.7);assert.ok(env.beginDuel(a,b,now));const d=a.duel;
assert.ok(d.combat.strikes.length>2,'HP determines more than two attacks');
let prior=d.combat.stats.map(s=>s.hp);
for(const hit of d.combat.strikes){
 now=d.start+hit.at*1000-1;env.stepDuels(now);assert.deepEqual([...d.playback.hp],[...prior]);
 now+=2;env.stepDuels(now);assert.deepEqual([...d.playback.hp],[...hit.hp]);
 assert.equal(hit.hp[hit.attacker],prior[hit.attacker]);assert.equal(prior[1-hit.attacker]-hit.hp[1-hit.attacker],hit.damage);prior=hit.hp;
 assert.equal(g.balance(d.winner.key),0,'no reward before result');
 now=d.start+hit.at*1000+100;env.stepDuels(now);
 const striker=hit.attacker===0?a:b,target=hit.attacker===0?b:a;
 assert.equal(striker.duelPose.back,0,'attacker must not recoil from their own strike');
 assert.ok(target.duelPose.back>0,'only the hit resident is pushed back');
 assert.equal(striker.duelPose.hop,0,'attacker does not play the victim hop');
 const strikerDir=hit.attacker===0?-1:1,targetDir=-strikerDir;
 assert.ok((striker.x-(hit.attacker===0?d.xA:d.xB))*strikerDir<=0,'attacker stays forward');
 assert.ok((target.x-(hit.attacker===0?d.xB:d.xA))*targetDir>0,'victim moves away');
}
assert.ok(prior.includes(0));const last=d.combat.strikes.at(-1);assert.equal(last.chargeEnd-last.chargeStart,3,'final attack has a full charge');
const loser=d.winner===d.a?d.b:d.a;
for(const age of [.1,1,2.09]){now=d.start+(d.combat.finalAt+age)*1000;env.stepDuels(now);assert.equal(loser.duelPose.collapse,0,'target stays upright throughout the skill');}
now=d.start+(d.combat.finalAt+2.35)*1000;env.stepDuels(now);assert.ok(loser.duelPose.collapse>.6&&loser.duelPose.collapse<1,'gradual fall after skill');
now=d.start+(d.combat.finalAt+2.7)*1000;env.stepDuels(now);assert.equal(loser.duelPose.collapse,1,'defeated resident lies down');assert.equal(d.winner.duelPose.collapse,0,'winner never falls');
now=d.start+(d.combat.endAt-.1)*1000;env.stepDuels(now);assert.ok(loser.duelPose.collapse<.1,'gets up before leaving');
now=d.start+d.combat.resultAt*1000+1;env.stepDuels(now);assert.equal(wins,1);assert.equal(g.balance(d.winner.key),d.combat.reward);assert.equal(g.record(d.winner).kills,0,'PvP never counts as a monster kill');
g.rewardDuel(d);env.stepDuels(now+1);assert.equal(g.balance(d.winner.key),d.combat.reward,'single reward');
const winnerKey=d.winner.key,stars=d.combat.reward;vm.runInContext(source,env);g=env.window.townAdventure;assert.equal(g.balance(winnerKey),stars);assert.equal(g.record(d.winner).duelWins,1,'duel earnings survive reload');
d.a.nextRole='research';now=d.start+d.combat.endAt*1000+1;env.stepDuels(now);assert.equal(d.a.role,'research');assert.equal(env.roomDuels.size,0);assert.equal(wins,1);
const c=actor('c',2.2),e=actor('e',4.2,2,1e7);env.Math.random=()=>.1;now+=70000;assert.ok(env.beginDuel(c,e,now));const legend=c.duel;
assert.equal(legend.legendary,c);const end=legend.combat.strikes.at(-1);assert.ok(Math.abs(end.chargeEnd-end.chargeStart-4.8)<1e-9);assert.equal(legend.combat.winner,c);assert.ok(end.legendary&&end.hp[1]===0);assert.ok(legend.combat.strikes.slice(0,-1).every(hit=>hit.hp[0]>0),'legend survives until its final swing');
// A backgrounded window can jump straight past the end without losing or duplicating rewards.
now=legend.start+legend.combat.endAt*1000+100;env.stepDuels(now);assert.equal(g.balance(c.key),legend.combat.reward);assert.equal(wins,2);assert.equal(env.roomDuels.size,0);
const f=actor('f',2.2),h=actor('h',3.7);now+=70000;env.Math.random=()=>.99;assert.ok(env.beginDuel(f,h,now));env.state.sessionInfo[f.key].needsInput=true;env.stepDuels(now+500);assert.equal(env.roomDuels.size,0);assert.equal(g.balance(f.key),0);assert.equal(g.balance(h.key),0,'cancelled battles grant no reward');
assert.equal(g.gradeFor({attack:25,defense:2,hp:80}),1,'starter resident begins at grade one');
assert.ok(g.gradeFor({attack:98,defense:49,hp:360})>g.gradeFor({attack:25,defense:2,hp:80}));
console.log('PvP: every strike matches HP, longer charge, grade rewards, save/reload, single payout, skipped frames, queued departure and cancellation pass');
