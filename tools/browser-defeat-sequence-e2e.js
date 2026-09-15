async page=>{
 await page.goto('http://127.0.0.1:8869');const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const results=[];
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img&&SHEETS.equipment.img);
   results.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();
    const g=townAdventure,e=townEvents,clock=performance.now,random=Math.random,tile=drawTile;let now=100000,captured=[],frames=0;performance.now=()=>now;Math.random=()=>.99;
    const check=(ok,msg)=>{if(!ok)throw Error(msg);},room=ROOM_BY_ROLE.waiting;
    for(const key of Object.keys(avatars))delete avatars[key];g.cancel();e.cancel();g.monsters.length=0;
    const a=avatars['Defeat|a']={key:'Defeat|a',proj:'Defeat',sid:'a',idx:84,role:'waiting',x:room.gx+3,y:room.gy+4,tx:room.gx+3,ty:room.gy+4};state.sessionInfo[a.key]={title:'쓰러짐 검증',state:'working',tokens:1e7};
    drawTile=function(c,sheet,idx,...args){const matrix=c.getTransform();if(sheet==='dungeon')captured.push({idx,alpha:c.globalAlpha,angle:Math.atan2(matrix.b,matrix.a)-Math.round(Math.atan2(matrix.b,matrix.a)/Math.PI)*Math.PI});return tile(c,sheet,idx,...args);};
    const advance=phase=>{for(let i=0;i<30&&e.active?.phase!==phase&&!e.active?.done;i++){now=e.active.next;g.step(now);}check(e.active?.phase===phase,'phase '+phase);};
    const frame=(render,idx,time)=>{now=time;captured=[];ctx.resetTransform();ctx.clearRect(0,0,cv.width,cv.height);render();frames++;const body=captured.find(x=>x.idx===idx);check(body,'target sprite is drawn');return body;};
    const opaque=body=>check(Math.abs(body.alpha-1)<.001,'target stays opaque during skill'),upright=body=>check(Math.abs(body.angle)<.2,'target does not fall during skill'),fallen=body=>check(Math.abs(body.angle)>.35,'target collapses after skill');
    try{
     for(const legendary of [false,true]){
      const m=g.spawn('waiting',true);check(g.begin(a,m),'PvE starts');const b=g.active;b.legendary=legendary;b.hp=b.maxHp=10000;b.monsterHp=legendary?500:b.nextHit.damage;b.maxMonsterHp=b.monsterHp;
      for(let i=0;i<30&&!b.done;i++){now=b.counterAt||b.next;g.step(now);}check(b.won,'actual finishing strike wins');const duration=g.finishDuration(legendary)*1000;
      for(const offset of [40,500,1500,duration-1]){const target=frame(g.drawBattle,m.idx,b.ended+offset);opaque(target);upright(target);}
      const collapsing=frame(g.drawBattle,m.idx,b.ended+duration+400);fallen(collapsing);check(collapsing.alpha>0&&collapsing.alpha<.8,'monster fades only after skill');check(frame(g.drawBattle,m.idx,b.ended+duration+810).alpha===0,'monster finishes disappearing');g.cancel();g.monsters.length=0;now+=70000;
     }
     for(const special of [false,true]){
      Math.random=()=>.99;const m=g.spawn('waiting',true);check(g.begin(a,m),'loss fight begins');const b=g.active;b.legendary=false;b.hp=1;b.monsterHp=b.maxMonsterHp=10000;Math.random=()=>special?.01:.99;now=b.next;g.step(now);check(b.counterSpecial===special,'requested actual attack kind');now=b.counterAt;g.step(now);check(b.done&&!b.won,'actual hit defeats player');const delay=special?1250:700;
      for(const offset of [20,delay*.5,delay-1]){const target=frame(g.drawBattle,a.idx,b.playerHitAt+offset);opaque(target);upright(target);}
      fallen(frame(g.drawBattle,a.idx,b.playerHitAt+delay+300));fallen(frame(g.drawBattle,a.idx,b.playerHitAt+delay+550));g.cancel();g.monsters.length=0;now+=70000;
     }
     Math.random=()=>.99;const other=avatars['Defeat|b']={...a,key:'Defeat|b',sid:'b',idx:85};state.sessionInfo[other.key]={title:'함께 도전',state:'working',tokens:10000};
     check(e.startRaid([a,other]),'raid starts');const r=e.active;r.hp=10;advance('playerWindup');now=r.next;g.step(now);check(r.won,'raid actual hit wins');
     for(const offset of [40,700,1500,2099]){const target=frame(e.drawBattle,122,r.ended+offset);opaque(target);upright(target);}const collapse=frame(e.drawBattle,122,r.ended+2500);fallen(collapse);check(collapse.alpha>0&&collapse.alpha<.8,'raid boss fades after full skill');e.cancel();now+=70000;
     for(const special of [false,true]){
      Math.random=()=>special?.01:.99;check(e.startRaid([a,other]),'raid loss setup begins');const r=e.active;r.hp=10000;r.attack=10000;advance('playerReturn');let rolls=0;Math.random=()=>rolls++===0?.99:special?.01:.99;advance('bossWindup');check(r.special===special,'raid special selected');now=r.next;g.step(now);const target=r.target;check(!target.hp&&target.defeatedAt===now,'lethal hit records time');const delay=special?1250:800;
      for(const offset of [20,delay*.5,delay-1]){const body=frame(e.drawBattle,target.a.idx,target.defeatedAt+offset);opaque(body);upright(body);}fallen(frame(e.drawBattle,target.a.idx,target.defeatedAt+delay+300));
      // Advance the next turn: the previous member must stay fallen when r.hit changes.
      const deathAt=target.defeatedAt;advance('playerImpact');fallen(frame(e.drawBattle,target.a.idx,Math.max(now,deathAt+delay+900)));e.cancel();now+=70000;
     }
     return {width,frames,scenarios:7};
    }finally{drawTile=tile;e.cancel();g.cancel();performance.now=clock;Math.random=random;}
   },width));
  }
  return results;
 }finally{await page.unroute('**/events');await page.evaluate(backup=>{for(const key of Object.keys(localStorage))if(key.startsWith('codextown.'))localStorage.removeItem(key);for(const[k,v]of Object.entries(backup))localStorage.setItem(k,v);},backup);await page.reload();}
}
