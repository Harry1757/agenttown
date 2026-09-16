async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img);
 return page.evaluate(()=>{
  cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const g=townAdventure,e=townEvents,clock=performance.now,random=Math.random,equipment=g.equipment;let now=100000,drawn={};performance.now=()=>now;Math.random=()=>.99;
  const check=(ok,msg)=>{if(!ok)throw Error(msg);},increases=values=>values.every((v,i)=>Number.isFinite(v)&&(!i||v>values[i-1]));
  for(const k of Object.keys(avatars))delete avatars[k];g.cancel();e.cancel();roomDuels.clear();const room=ROOM_BY_ROLE.waiting,actors=[0,1].map(i=>{const key='Damage|'+i,a=avatars[key]={key,proj:'Damage',sid:''+i,idx:84+i,role:'waiting',x:room.gx+2+i*2,y:room.gy+4,tx:room.gx+2+i*2,ty:room.gy+4};state.sessionInfo[key]={title:'피격 동작 검사',tokens:1e7,state:'working'};return a;});
  g.equipment=function(a,x,y,size,pose,...args){drawn[a.key]={x,y,angle:args[4]?.angle};return equipment.call(this,a,x,y,size,pose,...args);};
  const damages=[1,30,300],results={};
  try{
   g.monsters.length=0;check(g.begin(actors[0],g.spawn('waiting',true)),'monster begins');const b=g.active;b.hitAt=now;b.playerHitAt=now;b.counterAt=0;b.next=now+10000;now+=70;
   results.monster=damages.map(damage=>{b.inflictedDamage=damage;b.receivedDamage=damage;const pose=g.battleMotion(b,now,76,96);g.drawBattle();return {damage,player:pose.playerPush,monster:pose.bossPush};});check(increases(results.monster.map(r=>r.player))&&increases(results.monster.map(r=>r.monster)),'both PvE recipients scale');g.cancel();now+=70000;
   check(beginDuel(...actors,now),'duel begins');const d=actors[0].duel,hit=d.combat.strikes[0],target=actors[1-hit.attacker],striker=actors[hit.attacker];now=d.start+hit.at*1000+100;
   results.duel=damages.map(damage=>{hit.damage=damage;stepDuels(now);drawDuelSpotlight();check(striker.duelPose.back===0,'striker never recoils');return {damage,back:target.duelPose.back,angle:Math.abs(target.duelPose.angle)};});check(increases(results.duel.map(r=>r.back))&&increases(results.duel.map(r=>r.angle)),'PvP displacement and tilt scale');endDuel(d);now+=70000;
   check(e.startRaid(actors),'raid begins');const r=e.active;for(let i=0;i<50&&r.phase!=='bossImpact';i++){now=g.combatRealTime(r.start,r.next)+.001;g.step(now);}check(r.phase==='bossImpact','boss lands hit');now=g.combatRealTime(r.start,r.hit.at+70);
   results.raid=damages.map(damage=>{r.hit.damage=damage;for(const v of r.hit.victims)v.damage=damage;drawn={};e.drawBattle();const pose=drawn[r.target.a.key];return {damage,x:pose.x,angle:Math.abs(pose.angle)};});check(increases(results.raid.map(row=>row.angle)),'raid tilt scales');check(Math.abs(results.raid[2].x-results.raid[0].x)>Math.abs(results.raid[1].x-results.raid[0].x),'raid displacement scales');
   check(g.impactScale(1e9)===g.impactScale(300),'huge damage is capped');return results;
  }finally{e.cancel();g.cancel();for(const d of roomDuels)endDuel(d);g.equipment=equipment;performance.now=clock;Math.random=random;}
 });
}
