'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 let now=1000;const stored=new Map(),element=()=>({style:{},setAttribute(){},append(){},querySelector(){return element();},querySelectorAll(){return [];},set innerHTML(x){},textContent:''});
 const room={role:'waiting',gx:1,gy:1},env={console,Math:Object.create(Math),performance:{now:()=>now},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},document:{createElement:element,head:element(),getElementById:element},window:{townUI:{motionReduced:false,winCount:()=>0}},avatars:{},state:{sessionInfo:{}},ROOM_BY_ROLE:{waiting:room},displayedRooms:[room],roomDuels:new Set(),workerState:()=> 'working',spriteScaleFor:()=>8,layout:{scale:2},tokensOf:()=>1e9,clearDuelAftermath(){}};
 env.Math.random=()=>.99;vm.createContext(env);vm.runInContext(fs.readFileSync('town-adventure.js','utf8'),env);
 const g=env.window.townAdventure,a=env.avatars.a={key:'a',role:'waiting',x:3,y:4};
 return {g,a,env,at:t=>{now=t;g.step(now);},start(boss=true){const m=g.spawn('waiting',boss);g.begin(a,m);const b=g.active;b.monsterHp=b.maxMonsterHp=10000;b.hp=b.maxHp=10000;return b;}};
}
for(const [boss,roll,special] of [[true,0,true],[true,.079999,true],[true,.08,false],[true,.99,false],[false,0,false]]){
 const f=fixture(),b=f.start(boss);f.env.Math.random=()=>roll;f.at(b.next);
 assert.equal(b.counterSpecial,special,'8% boundary, bosses only');
 const due=b.counterAt,hp=b.hp,round=b.round;
 if(special)assert.equal(due-b.counterStartedAt,1400,'special telegraph lasts 1.4 seconds after approach');
 f.at(due-1);assert.equal(b.hp,hp,'no damage during telegraph');assert.equal(b.round,round);
 f.env.Math.random=()=>.99;f.at(due);
 assert.equal(b.receivedSpecial,special);assert.equal(b.receivedCritical,false);
 assert.equal(b.receivedDamage,Math.max(1,Math.round(b.monsterAttack*(special?3:1)-b.stats.defense)));
 assert.equal(b.hp,hp-b.receivedDamage);f.at(due+1);assert.equal(b.hp,hp-b.receivedDamage,'one damage application');
 if(special){assert.ok(b.next>=due+1450,'impact finishes before next attack');f.at(due+1200);assert.equal(b.round,round);}
}
{
 const f=fixture(),b=f.start();f.env.Math.random=()=>.01;f.at(b.next);f.at(b.counterAt);
 assert.equal(b.receivedSpecial,true);assert.equal(b.receivedCritical,true,'critical is independent');
 assert.equal(b.receivedDamage,Math.round(b.monsterAttack*3*1.75-b.stats.defense));
 f.env.Math.random=()=>.99;f.at(b.next);assert.equal(b.counterSpecial,false,'roll again every attack');
 f.at(b.counterAt);assert.equal(b.receivedSpecial,false,'special flag clears on normal hit');
 f.env.Math.random=()=>.01;f.at(b.next);assert.equal(b.counterSpecial,true,'special can trigger again');
}
{
 const f=fixture(),b=f.start();f.env.Math.random=()=>.01;f.at(b.next);
 const late=b.counterAt+10000,round=b.round;f.at(late);
 assert.ok(b.next>=late+1450,'late frame preserves the special impact duration');
 f.at(late+1);assert.equal(b.round,round);assert.equal(b.hp,b.maxHp-b.receivedDamage);
}
for(const legendary of [false,true]){
 const f=fixture(),b=f.start();b.hp=1;b.legendary=legendary;f.env.Math.random=()=>.01;f.at(b.next);f.at(b.counterAt);
 assert.equal(b.hp,legendary?1:0);assert.equal(b.done,!legendary);
 f.at(b.playerHitAt+1);assert.equal(f.g.record(f.a).deaths||0,legendary?0:1,'defeat recorded once');
}
for(const reason of ['input','motion']){
 const f=fixture(),b=f.start();f.env.Math.random=()=>.01;f.at(b.next);const due=b.counterAt;
 if(reason==='input')f.env.state.sessionInfo.a={needsInput:true};else f.env.window.townUI.motionReduced=true;
 f.at(due-100);assert.equal(f.g.active,null);f.at(due+1);assert.equal(f.g.record(f.a).deaths||0,0,'cancelled special does not deal damage');
}
console.log('Boss specials: 8% boundary, boss-only, 3x attack, independent criticals, telegraph, impact pause, rerolls, defeat, legendary survival and cancellation pass');
for(const special of [false,true]){
 const f=fixture(),b=f.start();f.env.Math.random=()=>special?.01:.99;f.at(b.next);const late=b.counterAt+5000,round=b.round;f.at(late);
 const hold=special?1250:500,recovery=hold+260;
 assert.ok(b.next>=late+recovery+280+b.windup,'background delay preserves recovery, approach and cast');
 f.at(late+1);assert.equal(b.round,round,'no immediate extra attack after tab resumes');
 const contact=f.g.battleMotion(b,late+10,70,96).mx;
 assert.equal(f.g.battleMotion(b,late+hold-1,70,96).mx,contact,'boss stays through the complete effect');
 assert.ok(f.g.battleMotion(b,late+hold+200,70,96).mx>contact,'boss eases home after the effect');
}
console.log('Background resume preserves normal/special impact, recovery and full next cast');
