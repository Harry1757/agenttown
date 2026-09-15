async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));await page.goto('http://127.0.0.1:8869');const results=[];
 for(const width of [960,390]){await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>window.townAdventure&&SHEETS.dungeon.img&&SHEETS.equipment.img);results.push(await page.evaluate(width=>{
  cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const g=townAdventure,clock=performance.now,random=Math.random,finish=g.foregroundFinish,check=(ok,m)=>{if(!ok)throw Error(m);};let now=100000,frames=0,seen=[],screens={};performance.now=()=>now;Math.random=()=>.99;
  const room=ROOM_BY_ROLE.waiting;for(const key of Object.keys(avatars))delete avatars[key];const actors=[0,1].map(i=>{const key='Mid|'+i,a=avatars[key]={key,proj:'Mid',sid:''+i,idx:84+i,role:'waiting',x:room.gx+2.5+i*2,y:room.gy+4.5,tx:room.gx+2.5+i*2,ty:room.gy+4.5,duelAfter:Infinity};state.sessionInfo[key]={state:'working',title:i?'오른쪽 기사':'왼쪽 기사',tokens:1e6};return a;});
  g.foregroundFinish=function(x,y,p,k,e){seen.push(e);return finish.call(this,x,y,p,k,e);};
  try{for(let element=0;element<5;element++){
   let roll=0;Math.random=()=>[.1,(element+.1)/5,.99][roll++%3];const hit=g.rollPlayerHit(40,10,0);check(hit.skill&&hit.element===element&&hit.damage===54,'random element and 1.6 damage before armor');
   Math.random=()=>.1;check(beginDuel(...actors,now),'duel starts');const d=actors[0].duel;now=d.start+200;stepDuels(now);draw();const strike=d.combat.strikes.find(s=>s.skill&&!s.final);check(strike,'mid skill exists');strike.element=element;
   const attacker=actors[strike.attacker],target=actors[1-strike.attacker];let prior;
   for(const offset of [-1000,-500,-10,100,650,1350]){now=d.start+strike.at*1000+offset;stepDuels(now);draw();frames++;check(target.duelPose.collapse===0,'no fall during mid-skill');if(offset<0){check(d.playback.skillCharging,'charge state');check(attacker.duelPose.lunge===1,'standing at contact throughout charge');if(prior)check(d.playback.hp.join()===prior,'no HP change during cast');prior=d.playback.hp.join();}else{check(d.playback.hit===strike,'same strike while effect plays');check(attacker.duelPose.lunge===1,'hold until skill ends');check(seen.includes(element),'matching skill visual');if(offset===650&&element===1)screens.pvp=battleCanvas.toDataURL();}}
   endDuel(d);now+=70000;Math.random=()=>.99;const m=g.spawn('waiting',true);check(g.begin(actors[0],m),'PvE starts');const b=g.active;b.monsterHp=b.maxMonsterHp=9999;b.nextHit={damage:54,critical:false,skill:true,element};b.finishing=false;b.windup=1200;b.next=now+1680;
   for(const offset of [-1000,-500,-10,0,100,650,1350,1800]){now=b.next+offset;if(offset>=0&&b.round===0)g.step(now);const hitTime=b.hitAt; // next changes after impact, use hitAt for subsequent samples below
    if(offset===0){check(b.attackSkill&&b.attackElement===element,'PvE skill recorded');check(b.monsterHp===9945,'PvE actual damage');break;}
    g.drawBattle();frames++;check(b.monsterHp===9999,'PvE cast keeps HP');const motion=g.battleMotion(b,now,70,96);check(motion.approach===1,'PvE arrives before charge');
   }
   const start=b.hitAt;for(const age of [100,650,1350]){now=start+age;g.drawBattle();frames++;const motion=g.battleMotion(b,now,70,96);check(Math.abs(motion.px-g.battleMotion(b,start+1,70,96).px)<1e-6,'PvE holds feet during effect');check(!b.done&&b.monsterHp>0,'nonlethal skill does not end battle');if(age===650&&element===0)screens.pve=cv.toDataURL();}
   check(b.counterAt-start>=2400,'boss waits for skill and return');g.cancel();now+=70000;
  }return {width,frames,elements:[...new Set(seen)],screens};}finally{for(const d of roomDuels)endDuel(d);g.cancel();g.foregroundFinish=finish;performance.now=clock;Math.random=random;}
 },width));}if(errors.length)throw Error(errors.join(';'));return results;
}
