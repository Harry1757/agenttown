'use strict';
const assert=require('node:assert/strict');
const {createTownEvents}=require('./town-events.js');
function fixture(){
 let time=1000,enabled=true;const list=[],log=[],payouts=[],lost=[],released=[],people=['a','b','c','d'].map((key,i)=>({key,role:'waiting',x:3+i*.1,y:4,present:true,stats:{hp:120,attack:45+i*5,defense:8,crit:.1}}));
 const g={active:null,monsters:list},room={gx:0,gy:0},h={now:()=>time,random:()=>.5,game:()=>g,duels:()=>false,enabled:()=>enabled,residents:()=>people,present:a=>a.present,eligible:a=>a.present,stats:a=>({...a.stats}),damage:(a,d)=>({damage:Math.max(1,Math.round(a-d)),critical:false}),reward:(a,b,s)=>payouts.push({key:a.key,stars:s}),defeat:a=>lost.push(a.key),freeze:a=>a.frozen=true,release:a=>{released.push(a.key);a.frozen=false;},room:()=>room,roomValid:()=>true,event:(...e)=>log.push(e),cooperate:a=>log.push(['friends',a.map(a=>a.key)]),see:m=>log.push(['see',m.name]),hit:(m,n)=>log.push(['hit',n]),result:(m,w)=>log.push(['result',w])};
 const e=createTownEvents(h);return {e,h,g,people,log,payouts,lost,released,time:t=>{time=t;return time;},step:t=>{time=t;e.step(t);},disable:()=>enabled=false,next:()=>{time=e.active.next;e.step(time);}};
}
{
 const f=fixture();assert.equal(f.e.startRaid([f.people[0]]),false);assert.equal(f.e.startRaid([f.people[0],f.people[0]]),false,'unique members required');assert.equal(f.e.startRaid(),true);assert.equal(f.e.startRaid(),false);assert.equal(f.e.active.members.length,4);assert.equal(f.e.busy(f.people[0]),true);assert.ok(f.people.every(a=>a.frozen));
 const r=f.e.active;f.step(r.next-1);assert.equal(r.phase,'arrival');f.next();assert.equal(r.phase,'playerWindup');f.next();assert.equal(r.phase,'playerImpact');assert.ok(r.members[0].damage>0);const hp=r.hp;f.e.step(r.next-1);assert.equal(r.hp,hp,'no duplicate hit');f.next();assert.equal(r.phase,'bossWindup');f.next();assert.equal(r.phase,'bossImpact');assert.ok(r.members.some(m=>m.hp<m.maxHp));f.next();assert.equal(r.actor,r.members[1],'rotates to next living member');
}
{
 const f=fixture();f.e.startRaid();const r=f.e.active;r.hp=80;r.members[0].stats.attack=45;r.members[1].stats.attack=500;
 while(!r.done)f.next();assert.equal(r.won,true);assert.equal(f.payouts.length,2,'only contributors get payout');assert.ok(f.payouts.every(p=>p.stars>=6));assert.ok(f.payouts[1].stars>f.payouts[0].stars,'share proportional to actual damage');
 const n=f.payouts.length;for(let i=0;i<10;i++)f.step(r.ended+1000+i);assert.equal(f.payouts.length,n,'payout exactly once');assert.equal(f.log.filter(e=>e[0]==='raids'&&e[1]==='won').length,1);f.step(r.ended+4300);assert.equal(f.e.active,null);assert.equal(f.released.length,4);
}
{
 const f=fixture();f.e.startRaid(f.people.slice(0,2));const r=f.e.active;r.hp=80;r.members[1].stats.attack=500;
 f.next();f.next();r.members[0].hp=0;while(!r.done)f.next();assert.ok(f.payouts.some(p=>p.key==='a'),'fallen contributor receives share');assert.equal(f.log.find(e=>e[0]==='friends')[1].length,2);
}
{
 const f=fixture();f.e.startRaid(f.people.slice(0,2));const r=f.e.active;r.hp=20;f.next();f.people[0].present=false;f.next();assert.equal(r.actor.a.key,'b','removed pending attacker skipped');assert.deepEqual(f.released,['a']);f.next();assert.equal(r.won,true);assert.deepEqual(f.payouts.map(p=>p.key),['b']);
}
{
 const f=fixture();f.e.startRaid();f.people.forEach(a=>a.present=false);f.step(1100);assert.equal(f.e.active,null);assert.equal(f.payouts.length,0);assert.equal(f.log.filter(e=>e[0]==='raids'&&e[1]==='lost').length,0,'interruption not defeat');
}
{
 const f=fixture();f.e.startRaid(f.people.slice(0,2));const r=f.e.active;r.attack=10000;r.hp=10000;
 for(let i=0;i<30&&!r.done;i++)f.next();assert.equal(r.done,true);assert.equal(r.won,false);assert.equal(f.lost.length,2);assert.equal(new Set(f.lost).size,2);assert.equal(f.payouts.length,0);assert.equal(f.log.filter(e=>e[0]==='raids'&&e[1]==='lost').length,1);
}
{
 const f=fixture();f.h.random=()=>.01;f.e.startRaid();const r=f.e.active;f.next();f.next();f.next();assert.equal(r.special,true);assert.equal(r.next-r.phaseAt,1600);const hp=r.target.hp;f.step(r.next-1);assert.equal(r.target.hp,hp);f.next();assert.equal(r.hit.special,true);assert.equal(r.hit.damage,Math.round(r.attack*2.6-r.target.stats.defense));
}
{
 const f=fixture();f.e.startRaid();f.disable();f.step(5000);assert.equal(f.e.active,null);assert.equal(f.payouts.length,0);assert.equal(f.released.length,4);assert.equal(f.e.spawnTreasure(),false);
}
{
 const f=fixture();const m=f.e.spawnTreasure();assert.ok(m.treasure);assert.equal(f.e.spawnTreasure(),false);assert.ok(f.g.monsters.includes(m));assert.equal(f.log.filter(e=>e[0]==='treasure'&&e[1]==='seen').length,1);f.step(31001);assert.equal(f.e.treasure,null);assert.equal(f.g.monsters.includes(m),false);f.step(31002);assert.equal(f.log.filter(e=>e[0]==='treasure'&&e[1]==='escaped').length,1);
}
{
 const f=fixture(),m=f.e.spawnTreasure();f.g.active={m,done:false};f.step(35000);assert.ok(f.e.treasure,'battle prevents timeout');f.g.active.done=true;f.g.active.won=true;f.step(35001);f.step(35002);assert.equal(f.log.filter(e=>e[0]==='treasure'&&e[1]==='caught').length,1);assert.equal(f.log.find(e=>e[1]==='caught')[2],m.reward);f.g.active=null;f.step(36000);assert.equal(f.e.treasure,null);assert.equal(f.g.monsters.includes(m),false,'released treasure removed from population');assert.equal(f.log.filter(e=>e[1]==='escaped').length,0);
}
console.log('events: turn ordering, specials, removal, defeat, shared payout, cancellation and treasure lifecycle passed');

{const f=fixture(),m=f.e.spawnTreasure();f.g.active={m,done:true,won:false};f.step(2000);f.g.active=null;f.step(3000);assert.equal(f.g.monsters.includes(m),false,'defeated treasure cannot be fought a second time');assert.equal(f.log.filter(e=>e[1]==='escaped').length,1);}
