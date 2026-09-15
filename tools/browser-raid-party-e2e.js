async page=>{
 await page.goto('http://127.0.0.1:8869');const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const results=[];
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img&&SHEETS.equipment.img);
   results.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const g=townAdventure,e=townEvents,clock=performance.now,random=Math.random,equipment=g.equipment,monster=g.monster;let now=100000,frames=0,portraits=[],boss={};performance.now=()=>now;Math.random=()=>.99;
    const check=(ok,msg)=>{if(!ok)throw Error(msg);},room=ROOM_BY_ROLE.waiting,screens={},skills=new Set();
    g.equipment=function(a,x,y,size,pose,...args){portraits.push({key:a.key,x,y,size,sword:pose.sword});return equipment.call(this,a,x,y,size,pose,...args);};g.monster=function(m,x,y,...args){boss={x,y};return monster.call(this,m,x,y,...args);};
    const frame=label=>{portraits=[];ctx.resetTransform();ctx.clearRect(0,0,cv.width,cv.height);e.drawBattle();frames++;if(label)screens[label]=cv.toDataURL();return portraits;};
    const advance=phase=>{for(let i=0;i<35&&e.active.phase!==phase;i++){now=e.active.next;g.step(now);}check(e.active.phase===phase,'phase '+phase);};
    try{
     for(const count of [4,8,15]){
      e.cancel();g.cancel();g.monsters.length=0;for(const key of Object.keys(avatars))delete avatars[key];
      const people=Array.from({length:count},(_,i)=>{const key='Party|'+i,a=avatars[key]={key,proj:'Party',sid:''+i,idx:84+i%12,role:'waiting',x:room.gx+3,y:room.gy+4,tx:room.gx+3,ty:room.gy+4};state.sessionInfo[key]={title:'참가자 '+i,state:'working',tokens:10**(3+i%5)};return a;});
      const rest=avatars['Party|rest']={...people[0],key:'Party|rest',sid:'rest',role:'done'};state.sessionInfo[rest.key]={state:'working'};
      check(e.startRaid(),'all residents join automatically');const r=e.active;check(r.members.length===count&&!r.members.some(m=>m.a===rest),'restroom excluded without four-person cap');r.hp=r.maxHp=99999;r.attack=0;
      now=r.start+1100;const all=frame('party-'+count);check(all.length===count,'all portraits drawn');for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];check(Math.abs(a.x-b.x)>=(a.size+b.size)/2||Math.abs(a.y-b.y)>=Math.max(a.size,b.size)+12,'portraits and health bars do not overlap');}
      check(Math.abs(boss.x)<80,'boss arrives through center');const turns=new Set();
      for(let i=0;i<count;i++){
       let rolls=0;Math.random=()=>rolls++===0?.01:(i%5+.1)/5;advance('playerApproach');turns.add(r.actor.a.key);check(r.pending.skill&&r.pending.element===i%5,'25% hit selects independent random element');skills.add(r.pending.element);const hp=r.hp,expected=g.rollDamage(r.actor.stats.attack*1.6,r.defense,0).damage;r.pending.critical=false;r.pending.damage=expected;
       advance('playerWindup');check(r.next-r.phaseAt===1300,'skill charges after arrival');now=r.phaseAt+700;frame();check(r.hp===hp,'charge does not damage');advance('playerImpact');check(hp-r.hp===expected,'skill attack multiplier applied before defense');check(r.next-r.phaseAt===1400,'actor holds position for the entire skill');
       now=r.phaseAt+1100;frame(count===15&&i<5?'skill-'+i:null);check(r.phase==='playerImpact','skill still plays after one second');advance('bossReturn');
      }
      check(turns.size===count,'every participant takes an attack turn');e.cancel();now+=70000;
     }
     check(skills.size===5,'all five skill visuals exercised');return {width,frames,partySizes:[4,8,15],skills:skills.size,screens};
    }finally{g.equipment=equipment;g.monster=monster;e.cancel();g.cancel();performance.now=clock;Math.random=random;}
   },width));
  }
  return results;
 }finally{await page.unroute('**/events');await page.evaluate(backup=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.'))localStorage.removeItem(k);for(const[k,v]of Object.entries(backup))localStorage.setItem(k,v);},backup);await page.reload();}
}
