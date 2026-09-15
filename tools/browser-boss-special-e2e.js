async page => {
 const errors=[],onError=e=>errors.push(e.message),results=[];page.on('pageerror',onError);
 await page.goto('http://127.0.0.1:8869');
 const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>SHEETS.dungeon.img&&SHEETS.equipment.img);
   results.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
    const g=townAdventure,clock=performance.now,random=Math.random,fillText=CanvasRenderingContext2D.prototype.fillText,check=(ok,msg)=>{if(!ok)throw Error(msg);};
    let now=100000,texts=[],frames=0;const names=new Set(),screens={};performance.now=()=>now;Math.random=()=>.99;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){texts.push(String(text));return fillText.call(this,text,...args);};
    for(const key of Object.keys(avatars))delete avatars[key];g.cancel();g.monsters.length=0;
    const frame=()=>{texts=[];draw();const m=ctx.getTransform();check(m.a===1&&m.d===1&&m.e===0&&m.f===0,'canvas transform restored');frames++;};
    try{
     for(let i=0;i<8;i++){
      const r=ROOM_BY_ROLE.waiting,key='Special|'+width+'-'+i,a=avatars[key]={key,proj:'Special',sid:width+'-'+i,idx:84,role:'waiting',x:r.gx+3,y:r.gy+4,tx:r.gx+3,ty:r.gy+4};
      state.sessionInfo[key]={title:'보스 필살기 검증',state:'working',tokens:1e9};
      Math.random=()=>.99;const m=g.spawn('waiting',true,i>=5);check(g.begin(a,m),'encounter begins');const b=g.active;b.legendary=false;
      const hp=b.hp;Math.random=()=>.01;now=b.next;g.step(now);check(b.counterSpecial,'special scheduled');const due=b.counterAt,round=b.round;
      for(const offset of [100,700,1399]){now=b.counterStartedAt+offset;g.step(now);frame();check(b.hp===hp,'telegraph does not damage');check(texts.some(t=>t.startsWith('위험!')),'warning visible');}
      names.add(m.name);
      if(m.kind.id==='storm')screens.charge=battleCanvas.toDataURL();
      Math.random=()=>i%2?.01:.99;now=due;g.step(now);check(b.receivedSpecial,'special hits');
      const expected=Math.max(1,Math.round(b.monsterAttack*3*(i%2?1.75:1)-b.stats.defense));
      check(b.receivedDamage===expected&&b.hp===Math.max(0,hp-expected),'actual HP matches special/critical and armor');
      for(const offset of [30,200,700,1200]){now=due+offset;g.step(now);frame();check(texts.some(t=>t.startsWith('필살기 · ')),'special title persists');check(b.round===round,'no next attack during special effect');}
      if(m.kind.id==='storm'){now=due+200;frame();screens.impact=battleCanvas.toDataURL();}
      now=due+1300;frame();check(!texts.some(t=>t.startsWith('필살기 · ')),'special effect clears');
      if(b.done){check(!b.won&&g.record(a).deaths===1,'lethal special produces one defeat');}
      g.cancel();g.monsters.length=0;delete avatars[key];now+=70000;
     }
     check(names.size===8,'all five bosses and three elites covered');return {width,bosses:names.size,frames,screens};
    }finally{performance.now=clock;Math.random=random;CanvasRenderingContext2D.prototype.fillText=fillText;g.cancel();}
   },width));
  }
  if(errors.length)throw Error(errors.join('\n'));return results;
 }finally{await page.unroute('**/events');await page.evaluate(backup=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.'))localStorage.removeItem(k);for(const [k,v] of Object.entries(backup))localStorage.setItem(k,v);},backup);page.off('pageerror',onError);await page.reload();}
}
