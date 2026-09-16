'use strict';
const assert=require('node:assert/strict');
const {createTownEvents,raidFormation}=require('./town-events.js');
function fixture(){
 let time=1000,enabled=true;const list=[],log=[],payouts=[],lost=[],released=[],people=['a','b','c','d'].map((key,i)=>({key,role:'waiting',x:3+i*.1,y:4,present:true,stats:{hp:120,attack:45+i*5,defense:8,crit:.1}}));
 const g={active:null,monsters:list},room={gx:0,gy:0},h={now:()=>time,random:()=>.99,game:()=>g,duels:()=>false,enabled:()=>enabled,residents:()=>people,present:a=>a.present,eligible:a=>a.present&&a.role!=='done',stats:a=>({...a.stats}),damage:(a,d)=>({damage:Math.max(1,Math.round(a-d)),critical:false}),reward:(a,b,s)=>payouts.push({key:a.key,stars:s}),defeat:a=>lost.push(a.key),freeze:a=>a.frozen=true,release:a=>{released.push(a.key);a.frozen=false;},room:()=>room,roomValid:()=>true,event:(...e)=>log.push(e),cooperate:a=>log.push(['friends',a.map(a=>a.key)]),see:m=>log.push(['see',m.name]),hit:(m,n)=>log.push(['hit',n]),result:(m,w)=>log.push(['result',w])};
 const e=createTownEvents(h);return {e,h,g,people,log,payouts,lost,released,time:t=>{time=t;return time;},step:t=>{time=t;e.step(t);},disable:()=>enabled=false,next:()=>{time=e.active.next;e.step(time);}};
}
function advanceTo(f,phase){for(let i=0;i<30&&f.e.active?.phase!==phase;i++)f.next();assert.equal(f.e.active?.phase,phase);}
{
 const f=fixture();assert.equal(f.e.startRaid([f.people[0]]),false);assert.equal(f.e.startRaid([f.people[0],f.people[0]]),false,'unique members required');assert.equal(f.e.startRaid(),true);assert.equal(f.e.startRaid(),false);assert.equal(f.e.active.members.length,4);assert.equal(f.e.busy(f.people[0]),true);assert.ok(f.people.every(a=>a.frozen));
 const r=f.e.active;f.step(r.next-1);assert.equal(r.phase,'arrival');f.next();assert.equal(r.phase,'playerApproach');const initial=r.hp;f.step(r.next-1);assert.equal(r.hp,initial,'no damage while approaching');f.next();assert.equal(r.phase,'playerWindup');assert.equal(r.hp,initial,'arrival stops before strike');f.next();assert.equal(r.phase,'playerImpact');assert.ok(r.members[0].damage>0);const hp=r.hp;f.e.step(r.next-1);assert.equal(r.hp,hp,'no duplicate hit');f.next();assert.equal(r.phase,'playerReturn');f.step(r.next-1);assert.equal(r.hp,hp,'no extra damage while returning');f.next();assert.equal(r.phase,'bossApproach');const playerHP=r.target.hp;f.step(r.next-1);assert.equal(r.target.hp,playerHP,'boss movement deals no damage');f.next();assert.equal(r.phase,'bossWindup');assert.equal(r.target.hp,playerHP);f.next();assert.equal(r.phase,'bossImpact');assert.ok(r.members.some(m=>m.hp<m.maxHp));f.next();assert.equal(r.phase,'bossReturn');f.next();assert.equal(r.actor,r.members[1],'rotates only after returning');
}
{
 const f=fixture();f.e.startRaid();const r=f.e.active;r.hp=80;r.members[0].stats.attack=45;r.members[1].stats.attack=500;
 while(!r.done)f.next();assert.equal(r.won,true);assert.equal(f.payouts.length,4,'all present participants get a base payout');assert.ok(f.payouts.every(p=>p.stars>=6));assert.ok(f.payouts[1].stars>f.payouts[0].stars,'share proportional to actual damage');
 const n=f.payouts.length;for(let i=0;i<10;i++)f.step(r.ended+1000+i);assert.equal(f.payouts.length,n,'payout exactly once');assert.equal(f.log.filter(e=>e[0]==='raids'&&e[1]==='won').length,1);f.step(r.ended+4300);assert.equal(f.e.active,null);assert.equal(f.released.length,4);
}
{
 const f=fixture();f.e.startRaid(f.people.slice(0,2));const r=f.e.active;r.hp=80;r.members[1].stats.attack=500;
 advanceTo(f,'playerImpact');r.members[0].hp=0;while(!r.done)f.next();assert.ok(f.payouts.some(p=>p.key==='a'),'fallen contributor receives share');assert.equal(f.log.find(e=>e[0]==='friends')[1].length,2);
}
{
 const f=fixture();f.e.startRaid(f.people.slice(0,2));const r=f.e.active;r.hp=20;f.next();f.people[0].present=false;f.next();assert.equal(r.actor.a.key,'b','removed pending attacker skipped');assert.deepEqual(f.released,['a']);while(!r.done)f.next();assert.equal(r.won,true);assert.deepEqual(f.payouts.map(p=>p.key),['b']);
}
{
 const f=fixture();f.e.startRaid();f.people.forEach(a=>a.present=false);f.step(1100);assert.equal(f.e.active,null);assert.equal(f.payouts.length,0);assert.equal(f.log.filter(e=>e[0]==='raids'&&e[1]==='lost').length,0,'interruption not defeat');
}
{
 const f=fixture();f.e.startRaid(f.people.slice(0,2));const r=f.e.active;r.attack=10000;r.hp=10000;
 for(let i=0;i<30&&!r.done;i++)f.next();assert.equal(r.done,true);assert.equal(r.won,false);assert.equal(f.lost.length,2);assert.equal(new Set(f.lost).size,2);assert.equal(f.payouts.length,0);assert.equal(f.log.filter(e=>e[0]==='raids'&&e[1]==='lost').length,1);
}
{
 const f=fixture();f.h.random=()=>.01;f.e.startRaid();const r=f.e.active;advanceTo(f,'bossWindup');assert.equal(r.special,true);assert.equal(r.next-r.phaseAt,1600);const hp=r.target.hp;f.step(r.next-1);assert.equal(r.target.hp,hp);f.next();assert.equal(r.hit.special,true);assert.equal(r.hit.damage,Math.round(r.attack*({wave:.65,focus:.72,scatter:.85,single:1}[r.bossPlan.kind])*2.6-r.target.stats.defense));
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

{const f=fixture();f.e.startRaid();const r=f.e.active;advanceTo(f,'bossWindup');const old=r.target;old.a.present=false;f.next();assert.equal(r.phase,'bossApproach','removed target forces a new approach');assert.notEqual(r.target,old);const hp=r.target.hp;f.step(r.next-1);assert.equal(r.target.hp,hp,'retarget travel cannot strike');}

for(const count of [4,8,15]){const f=fixture();while(f.people.length<count)f.people.push({...f.people[0],key:'extra'+f.people.length});f.people.push({...f.people[0],key:'rest',role:'done'});f.e.startRaid();assert.equal(f.e.active.members.length,count,'all nonrestroom residents join');for(const width of [450,820]){const height=310+Math.max(0,Math.ceil(count/4)-2)*36,formation=raidFormation(count,width,height);assert.equal(formation.positions.length,count);for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){const a=formation.positions[i],b=formation.positions[j];assert.ok(Math.abs(a.x-b.x)>=formation.size+10||Math.abs(a.y-b.y)>=formation.size+18,'formation avoids overlapping portraits and HP bars');}}}
for(const roll of [.249999,.25,.99]){const f=fixture();let calls=0;f.h.random=()=>calls++===0?roll:.62;f.e.startRaid();f.next();const r=f.e.active;assert.equal(r.pending.skill,roll<.25);assert.equal(r.pending.element,roll<.25?3:null);assert.equal(r.pending.damage,Math.round(r.actor.stats.attack*(roll<.25?1.6:1)-r.defense));advanceTo(f,'playerWindup');assert.equal(r.next-r.phaseAt,120);f.next();assert.equal(r.next-r.phaseAt,roll<.25?1400:350);}
for(let element=0;element<5;element++){const f=fixture();let calls=0;f.h.random=()=>calls++===0?.01:(element+.1)/5;f.e.startRaid();f.next();assert.equal(f.e.active.pending.element,element,'all five random techniques selectable');}
console.log('events: 4/8/15 participants, formation clearance and 25% five-skill damage boundaries passed');

{
 const f=fixture();f.people[0].cooldown=true;f.people[1].completed=true;f.people[2].portal=true;f.people[3].role='done';
 f.h.eligible=a=>a.present&&a.role!=='done'&&!a.cooldown&&!a.completed&&!a.portal;
 f.h.raidEligible=a=>a.present&&a.role!=='done'&&!a.needsInput;
 f.h.raidReady=a=>!a.portal&&!a.route?.length;
 assert.equal(f.e.startRaid(),false,'wait for moving party member instead of omitting them');
 f.step(181001);assert.equal(f.e.active,null);assert.equal(f.e.snapshot().raidPending,true,'automatic raid remains pending during transit');
 f.people[2].portal=false;f.people[2].route=[{x:1,y:1}];f.step(181002);assert.equal(f.e.active,null,'finishing portal alone does not skip the route');
 f.people[2].route=[];f.step(181003);assert.equal(f.e.active.members.length,3,'cooldown, completed outside restroom and arriving member all join');assert.equal(f.e.snapshot().raidPending,false);
 assert.equal(f.e.active.members.some(m=>m.a.role==='done'),false);
}
{
 const f=fixture();f.people[0].needsInput=true;f.people[1].portal=true;f.people[1].needsInput=true;
 f.h.raidEligible=a=>a.present&&a.role!=='done'&&!a.needsInput;f.h.raidReady=a=>!a.portal;
 assert.equal(f.e.startRaid(),true,'input-needed sessions are safely excluded and do not block ready participants');assert.equal(f.e.active.members.length,2);
}
console.log('events: raid-only eligibility includes cooldown/completed residents, waits for transit and excludes input-needed/restroom residents');

for(const skill of [false,true]){const f=fixture();f.h.random=()=>skill?.01:.99;f.e.startRaid();const r=f.e.active;if(!skill)r.hp=1;f.next();assert.equal(r.phase,'playerCharge');const hp=r.hp;assert.equal(r.next-r.phaseAt,skill?1300:2600);f.step(r.next-1);assert.equal(r.hp,hp);f.next();assert.equal(r.phase,'playerApproach');assert.equal(r.next-r.phaseAt,260);f.next();assert.equal(r.phase,'playerWindup');assert.equal(r.next-r.phaseAt,120);assert.equal(r.hp,hp);f.next();assert.equal(r.phase,'playerImpact');assert.ok(r.hp<hp);}
console.log('Raid finisher/skill: charge, travel, plant feet, then damage');

for(const [roll,kind,count] of [[.1,'wave',1],[.4,'focus',2],[.7,'scatter',2],[.95,'single',1]]){
 const f=fixture();f.e.startRaid();const r=f.e.active;r.hp=100000;r.members.forEach(m=>m.hp=m.maxHp=10000);advanceTo(f,'playerReturn');
 let calls=0;f.h.random=()=>calls++===0?roll:.99;f.next();assert.equal(r.bossPlan.kind,kind);assert.equal(r.bossPlan.total,count);
 const hits=[];while(r.phase!=='bossReturn'){if(r.phase==='bossWindup'){const hp=r.members.map(m=>m.hp);f.step(r.next-1);assert.deepEqual(r.members.map(m=>m.hp),hp);f.next();assert.equal(r.phase,'bossImpact');hits.push(r.hit);for(const hit of r.hit.victims){const i=r.members.indexOf(hit.target);assert.equal(hp[i]-hit.target.hp,Math.min(hp[i],hit.damage));}const after=r.members.map(m=>m.hp);f.step(r.next-1);assert.deepEqual(r.members.map(m=>m.hp),after,'hit applies once');}else f.next();}
 assert.equal(hits.length,count);if(kind==='wave')assert.equal(hits[0].victims.length,4);if(kind==='focus')assert.equal(hits[0].target,hits[1].target);if(kind==='scatter')assert.notEqual(hits[0].target,hits[1].target);
}
{
 const f=fixture();f.e.startRaid();const r=f.e.active;r.hp=100000;r.attack=10000;advanceTo(f,'playerReturn');let calls=0;f.h.random=()=>calls++===0?.4:.99;f.next();advanceTo(f,'bossImpact');const first=r.target;assert.equal(first.hp,0);f.next();assert.notEqual(r.target,first,'focus retargets after death');assert.equal(r.phase,'bossApproach');const hp=r.target.hp;f.step(r.next-1);assert.equal(r.target.hp,hp,'replacement target is not hit during travel');advanceTo(f,'bossImpact');assert.equal(f.lost.length,2);assert.equal(new Set(f.lost).size,2,'each defeat recorded once');
}
{
 const f=fixture();f.e.startRaid();const r=f.e.active;r.hp=100000;r.attack=10000;advanceTo(f,'playerReturn');let calls=0;f.h.random=()=>calls++===0?.1:.99;f.next();advanceTo(f,'bossWindup');r.members[0].a.present=false;f.next();advanceTo(f,'bossImpact');assert.equal(r.hit.victims.length,3,'departed resident omitted from wave');assert.equal(r.won,false);assert.equal(f.lost.length,3);assert.ok(r.hit.victims.every(v=>v.target.defeatEffectDuration===1250));assert.equal(f.payouts.length,0,'party defeat gives no reward');
}
console.log('Boss patterns: repeat/distributed strikes, all-party wave, once-only armor damage, retargeting and party defeat pass');

for(let grade=1;grade<=10;grade++){
 const f=fixture();f.h.grade=stats=>stats.grade;f.people[0].stats.grade=grade;f.people[1].stats.grade=10;
 f.e.startRaid(f.people.slice(0,2));const r=f.e.active;r.hp=1;r.members[0].hp=0;f.people[0].stats.grade=10;
 while(!r.done)f.next();assert.equal(r.won,true);
 const weak=r.members[0],bonus=Math.max(0,6-grade)*6;
 assert.equal(weak.damage,0);assert.equal(weak.growthBonus,bonus);assert.equal(weak.reward,6+bonus,'fallen novice gets participation and locked-in grade bonus');
 assert.equal(r.members[1].growthBonus,0,'high grades keep original reward');
 const before=f.payouts.length;f.step(r.ended+100);assert.equal(f.payouts.length,before,'growth bonus paid once');
}
console.log('Raid growth: grades 1–5 earn +30/+24/+18/+12/+6; early defeat, grade snapshot and single payout pass');
for(const count of [1,4,7,15]){
 const sizes=Array.from({length:count},(_,i)=>48+(i%3)*24),a=raidFormation(count,660,400,sizes,2345),b=raidFormation(count,660,400,sizes,2345),c=raidFormation(count,660,400,sizes,9876);
 assert.deepEqual(a.positions,b.positions,'same raid keeps its formation');assert.notDeepEqual(a.positions,c.positions,'another raid gets new positions');assert.deepEqual(a.sizes,sizes,'party count does not shrink token sizes');
 for(let i=0;i<count;i++){const p=a.positions[i];assert.ok(Math.abs(p.x)+sizes[i]/2<a.width/2);assert.ok(p.y-sizes[i]>-a.height/2+80);assert.ok(p.y+18<a.height/2);}
}
console.log('Raid party: fixed token sizes, repeatable scatter, new raid variation and arena bounds pass');
