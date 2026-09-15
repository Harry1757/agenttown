async page => {
 await page.goto('http://127.0.0.1:8869');
 const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  await page.evaluate(()=>{localStorage.removeItem('codextown.shop.sessions');localStorage.setItem('codextown.adventure',JSON.stringify({'Outfit|a':{kills:10,bosses:1,earnedStardust:10000},'Outfit|b':{kills:10,bosses:1,earnedStardust:10000}}));});
  const results=[];
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>SHEETS.dungeon.img&&SHEETS.equipment.img);
   results.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
    const g=townAdventure,tile=drawTile,clock=performance.now,random=Math.random,check=(ok,msg)=>{if(!ok)throw Error(msg);};
    let now=100000,body=null,gear=0,frames=0,checking=false,label='';
    drawTile=function(c,sheet,idx,...args){
     if(checking){const matrix=Array.from(c.getTransform().toFloat64Array());
      if(sheet==='dungeon'&&[84,85].includes(idx)){body={matrix,alpha:c.globalAlpha};}
      if(sheet==='equipment'&&[226,352,166].includes(idx)){check(body,'body before outfit');check(matrix.every((v,i)=>Math.abs(v-body.matrix[i])<1e-7),'body/outfit transform differs: '+label);check(c.globalAlpha<=body.alpha+1e-7,'outfit ignores hit flash: '+label);gear++;}
     }
     return tile(c,sheet,idx,...args);
    };
    performance.now=()=>now;Math.random=()=>.99;for(const key of Object.keys(avatars))delete avatars[key];g.cancel();g.monsters.length=0;
    const r=ROOM_BY_ROLE.waiting,actors=[84,85].map((idx,i)=>{const key='Outfit|'+(i?'b':'a');const a=avatars[key]={key,proj:'Outfit',sid:i?'b':'a',idx,role:'waiting',x:r.gx+2.5+i*2,y:r.gy+4.5,tx:r.gx+2.5+i*2,ty:r.gy+4.5,face:i?-1:1};state.sessionInfo[key]={state:'working',tokens:1e9,title:'장비 움직임 검사'};for(const id of ['imperial','celestial','titanhand','cometboots','astrolabe','dragonling','bulwark','voidblade'])if(!['head','body','hands','feet','charm','pet','shield','weapon'].some(slot=>g.equippedFor(a,slot)===id))check(g.buy(id,key),'equip '+id);return a;});
    const frame=(name,drawFrame)=>{label=name;body=null;const before=gear;checking=true;try{drawFrame();}finally{checking=false;}check(gear>before,'outfit rendered: '+name+' '+now);frames++;};
    try{
     check(beginDuel(...actors,now),'duel starts');const d=actors[0].duel;now+=200;stepDuels(now);drawDuelSpotlight();
     for(const strike of d.combat.strikes)for(const offset of [30,120,300]){now=d.start+strike.at*1000+offset;stepDuels(now);frame('PvP hit '+offset,drawDuelSpotlight);}
     for(const offset of [300,600,900]){now=d.start+(d.combat.resultAt+offset/1000)*1000;stepDuels(now);frame('PvP result '+offset,drawDuelSpotlight);}
     endDuel(d);now+=70000;g.monsters.length=0;const m=g.spawn('waiting',true);check(g.begin(actors[0],m),'boss battle starts');const b=g.active;b.legendary=false;
     now=b.next;g.step(now);now=b.counterAt;g.step(now);
     for(const offset of [0,70,180,400]){now=b.playerHitAt+offset;frame('PvE recoil '+offset,g.drawBattle);}
     b.finishing=true;b.next=now+1800;b.counterAt=0;
     for(const offset of [800,1200,1500]){now=b.next-1800+offset;frame('PvE charge '+offset,g.drawBattle);}
     b.done=true;b.won=false;b.ended=now;frame('PvE defeated',g.drawBattle);
     g.cancel();return {width,frames,gearDraws:gear};
    }finally{drawTile=tile;performance.now=clock;Math.random=random;g.cancel();}
   },width));
  }
  return results;
 }finally{await page.evaluate(backup=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.'))localStorage.removeItem(k);for(const[k,v]of Object.entries(backup))localStorage.setItem(k,v);},backup);await page.unroute('**/events');await page.reload();}
}
