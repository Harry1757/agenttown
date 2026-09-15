async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img);
 return page.evaluate(()=>{
  cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const g=townAdventure,e=townEvents,clock=performance.now,random=Math.random,equipment=g.equipment;let now=1000000,seen={};performance.now=()=>now;Math.random=()=>.99;
  for(const k of Object.keys(avatars))delete avatars[k];e.cancel();g.cancel();roomDuels.clear();const r=ROOM_BY_ROLE.waiting,people=[0,1].map(i=>{const key='Speed|'+i,a=avatars[key]={key,proj:'Speed',sid:''+i,idx:84+i,role:'waiting',x:r.gx+2.5+i*2,y:r.gy+4.5,tx:r.gx+2.5+i*2,ty:r.gy+4.5};state.sessionInfo[key]={title:'빠른 참격 '+i,tokens:100000,state:'working'};return a;});
  const check=(ok,msg)=>{if(!ok)throw Error(msg);};g.equipment=function(a,x,y,size,pose,...args){seen[a.key]=pose.sword;return equipment.call(this,a,x,y,size,pose,...args);};const results=[];
  const sample=(mode,key,hitAt,render,rest)=>{const angles=[];for(const ms of [0,25,50,120,240]){now=hitAt+ms;seen={};render();angles.push(seen[key]);}check(Math.abs(angles[2]-1.95)<.001,mode+' peak at 50ms');check(Math.abs(angles[4]-rest)<.001,mode+' recovers by 240ms');check(angles.every(Number.isFinite),mode+' rendered actual weapon');results.push({mode,angles});};
  try{
   g.monsters.length=0;check(g.begin(people[0],g.spawn('waiting',true)),'monster start');const fight=g.active;fight.legendary=false;now=fight.next;g.step(now);sample('monster',people[0].key,now,()=>{g.drawBattle();seen[people[0].key]=g.battleMotion(fight,now,76,96).swing;},.48);g.cancel();now+=70000;
   check(beginDuel(...people,now),'duel start');const d=people[0].duel,first=d.combat.strikes[0];now=d.start+200;stepDuels(now);drawDuelSpotlight();sample('duel',people[first.attacker].key,d.start+first.at*1000,()=>{stepDuels(now);drawDuelSpotlight();},.48);endDuel(d);now+=70000;
   check(e.startRaid(people),'raid start');const raid=e.active;raid.hp=raid.maxHp=100000;for(let i=0;i<10&&raid.phase!=='playerWindup';i++){now=raid.next;g.step(now);}check(raid.next-raid.phaseAt===120,'raid preparation is 120ms');now=raid.next;g.step(now);sample('raid',raid.actor.a.key,now,()=>e.drawBattle(),.52);
   return {strikePeakMs:50,recoveryMs:240,results};
  }finally{g.equipment=equipment;e.cancel();g.cancel();for(const d of roomDuels)endDuel(d);performance.now=clock;Math.random=random;}
 });
}
