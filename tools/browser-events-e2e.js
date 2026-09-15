async page=>{
 const errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);
 await page.goto('http://127.0.0.1:8869');
 const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  const results=[];
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img&&SHEETS.equipment.img);
   results.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
    const g=townAdventure,e=townEvents,clock=performance.now,random=Math.random;let now=100000,frames=0;
    const check=(ok,msg)=>{if(!ok)throw Error(msg);},screens={};performance.now=()=>now;Math.random=()=>.99;
    for(const key of Object.keys(avatars))delete avatars[key];g.cancel();e.cancel();g.monsters.length=0;
    const room=ROOM_BY_ROLE.waiting,people=[1e9,0,1e5,1e7].map((tokens,i)=>{
     const key='Raid|'+width+'-'+i,a=avatars[key]={key,proj:'Raid',sid:width+'-'+i,idx:84+i,role:'waiting',x:room.gx+2+i*.3,y:room.gy+4,tx:room.gx+2+i*.3,ty:room.gy+4};state.sessionInfo[key]={title:'함께 싸우는 친구 '+i,state:'working',tokens};return a;});
    const advance=phase=>{for(let i=0;i<30&&e.active?.phase!==phase&&!e.active?.done;i++){now=e.active.next;g.step(now);}check(e.active?.phase===phase,'phase '+phase);};
    const frame=()=>{draw();const m=ctx.getTransform();check(m.a===1&&m.d===1&&m.e===0&&m.f===0,'render restores canvas transform');frames++;};
    try{
     check(e.startRaid(people),'start real raid');const r=e.active;check(r.members.length===4,'four real members');
     for(let i=0;i<4;i++){const stats=g.statsFor(people[i]);check(stats.hp===r.members[i].hp&&stats.attack===r.members[i].stats.attack,'actual token/equipment stats snapshot');}
     now=r.start+1400;frame();screens.arrival=battleCanvas.toDataURL();
     const before=r.hp;advance('playerWindup');now=r.next;g.step(now);check(r.hp===before-r.pending.damage,'player damage applied to actual HP');
     frame();advance('bossImpact');check(r.members.some(m=>m.hp<m.maxHp),'boss damages a real member');frame();screens.attack=battleCanvas.toDataURL();
     const queuedRole=displayedRooms.find(room=>room.role!=='waiting'&&room.role!=='done').role;changeRoom(people[0],queuedRole);check(people[0].role==='waiting'&&people[0].nextRole===queuedRole,'room movement deferred through raid');
     // Play the full battle with actual stats. A weaker party is allowed to lose.
     for(let i=0;i<250&&!r.done;i++){now=r.next;g.step(now);frame();}
     check(r.done,'raid resolves');if(r.won){check(r.members.filter(m=>m.damage&&!m.left).every(m=>m.reward>=6),'contributors rewarded');}else check(r.members.filter(m=>!m.left).every(m=>m.hp===0),'defeat requires all living members down');
     const totals=people.map(a=>g.record(a).earnedStardust);now=r.ended+300;frame();g.step(now);check(people.every((a,i)=>g.record(a).earnedStardust===totals[i]),'repeated finished frame does not pay twice');now=r.ended+4500;g.step(now);check(!e.active&&people[0].role===queuedRole,'queued movement released at end');
     // Verify actual winning finish/rewards independently, with guaranteed setup and no fake journal events.
     for(const a of people){a.role='waiting';a.travelFrom=null;a.portal=null;a.route=[];a.x=room.gx+3;a.y=room.gy+4;}
     check(e.startRaid(people),'second raid can start');const win=e.active;win.hp=win.maxHp=10;advance('playerCharge');check(win.finishing,'final strike charges');now=win.next-500;frame();screens.charge=battleCanvas.toDataURL();advance('playerWindup');now=win.next;g.step(now);check(win.won,'final strike wins');now=win.ended+500;frame();screens.finish=battleCanvas.toDataURL();check(win.members[0].reward>=6,'winner payout');e.cancel();
     // Treasure is visible, wanders, then uses the same actual encounter engine.
     g.monsters.length=0;const treasure=e.spawnTreasure('waiting');check(treasure&&treasure.treasure,'rare treasure spawns');now+=100;g.step(now);frame();screens.treasure=cv.toDataURL();
     people[0].x=treasure.x;people[0].y=treasure.y;check(g.begin(people[0],treasure),'treasure enters real battle');const b=g.active;b.legendary=true;const balance=g.balance(people[0].key);
     for(let i=0;i<20&&!b.done;i++){now=b.counterAt||b.next;g.step(now);}check(b.won,'treasure battle won');now+=1;g.step(now);check(g.balance(people[0].key)===balance+treasure.reward,'real treasure reward once');g.cancel();e.cancel();
     return {width,frames,fullRaidWon:r.won,treasureReward:treasure.reward,screens};
    }finally{e.cancel();g.cancel();performance.now=clock;Math.random=random;}
   },width));
  }
  if(errors.length)throw Error(errors.join('\n'));return results;
 }finally{await page.unroute('**/events');await page.evaluate(backup=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.'))localStorage.removeItem(k);for(const[k,v]of Object.entries(backup))localStorage.setItem(k,v);},backup);page.off('pageerror',onError);await page.reload();}
}
