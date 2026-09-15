async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));await page.goto('http://127.0.0.1:8869');const results=[];
 for(const width of [960,390]){await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>window.townAdventure&&SHEETS.dungeon.img&&SHEETS.equipment.img);results.push(await page.evaluate(width=>{
  cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const g=townAdventure,e=townEvents,clock=performance.now,random=Math.random,equipment=g.equipment,monster=g.monster;let now=100000,frames=0,units={},boss;const screens={};performance.now=()=>now;Math.random=()=>.99;
  const check=(ok,m)=>{if(!ok)throw Error(m);},same=(a,b)=>Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7,room=ROOM_BY_ROLE.waiting;
  const clear=()=>{e.cancel();g.cancel();for(const d of roomDuels)endDuel(d);for(const key of Object.keys(avatars))delete avatars[key];};
  const actors=count=>Array.from({length:count},(_,i)=>{const key='Patterns|'+i,a=avatars[key]={key,proj:'Patterns',sid:''+i,idx:84+i%12,role:'waiting',x:room.gx+2.5+i%2*2,y:room.gy+4.5,tx:room.gx+2.5+i%2*2,ty:room.gy+4.5,duelAfter:Infinity};state.sessionInfo[key]={state:'working',title:'검사 '+i,tokens:i%2?1e7:1e4};return a;});
  g.equipment=function(a,x,y,size,pose,...args){units[a.key]={x,y,size,sword:pose.sword};return equipment.call(this,a,x,y,size,pose,...args);};g.monster=function(m,x,y,size,...args){boss={x,y,size};return monster.call(this,m,x,y,size,...args);};
  const frame=label=>{units={};ctx.resetTransform();ctx.clearRect(0,0,cv.width,cv.height);e.drawBattle();frames++;if(label)screens[label]=cv.toDataURL();return JSON.parse(JSON.stringify(units));};
  const advance=phase=>{for(let i=0;i<80&&e.active.phase!==phase&&!e.active.done;i++){now=e.active.next;g.step(now);}check(e.active.phase===phase,'phase '+phase);};
  const modes=[[.1,'wave'],[.4,'focus'],[.7,'scatter'],[.95,'single']];
  try{for(const count of [4,8,15])for(const [roll,kind]of modes){
   clear();const people=actors(count);Math.random=()=>.99;check(e.startRaid(people),'raid starts');const r=e.active;r.hp=r.maxHp=99999;r.members.forEach(m=>m.hp=m.maxHp=10000);advance('playerReturn');let rolls=0;Math.random=()=>rolls++===0?roll:.99;now=r.next;g.step(now);check(r.bossPlan.kind===kind,'pattern selected');const hits=[];
   while(r.phase!=='bossReturn'){
    check(r.phase==='bossApproach','next hit begins with approach');now=r.phaseAt;const base=frame(),startBoss={...boss};
    for(const offset of [65,130,259]){now=r.phaseAt+offset;frame(count===4&&offset===130?kind+'-approach':null);for(const a of people)check(same(units[a.key],base[a.key]),'all defenders stay in formation');check(r.hit?.actor!=='boss'||now-r.hit.at>=800,'previous impact completes before chain');}
    advance('bossWindup');const hp=r.members.map(m=>m.hp),target=r.target;now=r.phaseAt+(r.next-r.phaseAt)/2;frame(count===4?kind+'-ready':null);for(const a of people)check(same(units[a.key],base[a.key]),'defenders do not walk into attacks');if(kind!=='wave'){
     check(Math.hypot(boss.x-startBoss.x,boss.y-startBoss.y)>0||r.bossPlan.index>0,'boss comes to defender');for(const a of people)check(Math.abs(boss.x-units[a.key].x)>=boss.size/2+units[a.key].size/2+8,'boss does not cover stationed residents');
    }
    check(r.members.every((m,i)=>m.hp===hp[i]),'windup does not damage');now=r.next;g.step(now);check(r.phase==='bossImpact','impact after approach/windup');hits.push(r.hit);
    for(const v of r.hit.victims){const i=r.members.indexOf(v.target),power={wave:.65,focus:.72,scatter:.85,single:1}[kind];check(v.damage===Math.max(1,Math.round(r.attack*power-v.target.stats.defense)),'per-target armor damage');check(hp[i]-v.target.hp===v.damage,'actual HP matches hit');}
    for(const offset of [80,350,kind==='wave'?1150:650]){now=r.phaseAt+offset;frame(count===4&&offset===350?kind+'-hit-'+r.bossPlan.index:null);for(const a of people)if(!r.hit.victims.some(v=>v.target.a===a))check(same(units[a.key],base[a.key]),'bystanders remain still');}
    const after=r.members.map(m=>m.hp);g.step(now);check(r.members.every((m,i)=>m.hp===after[i]),'damage is not applied twice');now=r.next;g.step(now);
   }
   check(hits.length===r.bossPlan.total,'full boss sequence executed');if(kind==='wave')check(hits[0].victims.length===count,'wave damages every living member');if(kind==='focus')check(hits.every(h=>h.target===hits[0].target),'same target combo');if(kind==='scatter')check(new Set(hits.map(h=>h.target)).size===hits.length,'scatter changes targets');now+=70000;
  }
  // The close-up uses body size to maintain a visible gap throughout attacks.
  clear();Math.random=()=>.99;const people=actors(2);check(beginDuel(...people,now),'PvP starts');const d=people[0].duel;now=d.start+200;stepDuels(now);drawDuelSpotlight();let minimum=Infinity;
  for(const hit of d.combat.strikes.slice(0,5))for(const offset of [-.05,.05,.15,.35]){now=d.start+(hit.at+offset)*1000;stepDuels(now);units={};ctx.clearRect(0,0,cv.width,cv.height);drawDuelSpotlight();frames++;const a=units[people[0].key],b=units[people[1].key];check(a&&b,'both duelists visible');const gap=b.x-a.x-(a.size+b.size)/2;minimum=Math.min(minimum,gap);check(gap>=30,'clear space between bodies');if(offset===.05)screens.duel=cv.toDataURL();}
  return {width,frames,partySizes:[4,8,15],patterns:4,duelMinimumGap:minimum,screens};
  }finally{clear();g.equipment=equipment;g.monster=monster;performance.now=clock;Math.random=random;}
 },width));}if(errors.length)throw Error(errors.join(';'));return results;
}
