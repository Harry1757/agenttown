async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img);
 const results=[];
 for(const width of [960,1440]){
  await page.setViewportSize({width,height:700});
  await page.evaluate(()=>{cancelAnimationFrame(frameRequest);window.backdropNow=(window.backdropNow||100000)+1000000;performance.now=()=>backdropNow;townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();townEvents.cancel();townAdventure.cancel();roomDuels.clear();for(const k of Object.keys(avatars))delete avatars[k];state.sessionInfo={};const r=ROOM_BY_ROLE.waiting;window.backdropActors=[0,1].map(i=>{const key='Backdrop|'+i,a=avatars[key]={key,proj:'Backdrop',sid:''+i,idx:84+i,role:'waiting',x:r.gx+2+i*2,y:r.gy+4,tx:r.gx+2+i*2,ty:r.gy+4};state.sessionInfo[key]={title:'전투 배경 확인 '+i,tokens:1e7,state:'working'};return a;});window.dispatchEvent(new Event('town:sessions'));});
  for(const mode of ['monster','duel','raid']){
   await page.evaluate(mode=>{townEvents.cancel();townAdventure.cancel();backdropNow+=70000;for(const d of roomDuels)endDuel(d);if(mode==='monster'){townAdventure.monsters.length=0;townAdventure.begin(backdropActors[0],townAdventure.spawn('waiting',true));}else if(mode==='duel'){backdropActors.forEach(a=>{a.duelAfter=0;});beginDuel(...backdropActors,performance.now());if(!backdropActors[0].duel)throw Error('duel fixture');backdropActors[0].duel.start-=500;stepDuels(performance.now());}else if(!townEvents.startRaid(backdropActors))throw Error('raid fixture');draw();},mode);
   if(width<1100)await page.getByRole('button',{name:'작업 목록',exact:true}).click();
   const state=await page.evaluate(()=>{draw();const layer=battleLayer.getBoundingClientRect(),panel=document.querySelector('.roster').getBoundingClientRect();return {open:battleLayer.matches(':popover-open'),color:getComputedStyle(battleLayer).backgroundColor,covers:layer.left<=panel.left&&layer.right>=panel.right&&layer.top<=panel.top&&layer.bottom>=panel.bottom};});
   if(!state.open||!state.covers||state.color==='rgba(0, 0, 0, 0)')throw Error('roster not dimmed: '+JSON.stringify({width,mode,...state}));
   await page.screenshot({path:'/tmp/agenttown-backdrop-'+width+'-'+mode+'.png'});
   if(width<1100)await page.locator('.close-roster').click();
   await page.evaluate(()=>{townEvents.cancel();townAdventure.cancel();for(const d of roomDuels)endDuel(d);draw();});
   if(await page.locator('#battle-foreground').evaluate(e=>e.matches(':popover-open')))throw Error('backdrop remains after battle');
   results.push({width,mode,color:state.color});
  }
 }
 return results;
}
