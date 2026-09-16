async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img);
 const results=[];
 for(const width of [390,960,1440]){
  await page.setViewportSize({width,height:700});
  await page.evaluate(()=>{cancelAnimationFrame(frameRequest);window.backdropNow=(window.backdropNow||100000)+1000000;performance.now=()=>backdropNow;townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();townEvents.cancel();townAdventure.cancel();roomDuels.clear();for(const k of Object.keys(avatars))delete avatars[k];state.sessionInfo={};const r=ROOM_BY_ROLE.waiting;window.backdropActors=[0,1].map(i=>{const key='Backdrop|'+i,a=avatars[key]={key,proj:'Backdrop',sid:''+i,idx:84+i,role:'waiting',x:r.gx+2+i*2,y:r.gy+4,tx:r.gx+2+i*2,ty:r.gy+4};state.sessionInfo[key]={title:'전투 배경 확인 '+i,tokens:1e7,state:'working'};return a;});window.dispatchEvent(new Event('town:sessions'));});
  for(const mode of ['monster','duel','raid']){
   await page.evaluate(mode=>{townEvents.cancel();townAdventure.cancel();backdropNow+=70000;for(const d of roomDuels)endDuel(d);if(mode==='monster'){townAdventure.monsters.length=0;townAdventure.begin(backdropActors[0],townAdventure.spawn('waiting',true));}else if(mode==='duel'){backdropActors.forEach(a=>{a.duelAfter=0;});beginDuel(...backdropActors,performance.now());if(!backdropActors[0].duel)throw Error('duel fixture');backdropActors[0].duel.start-=500;stepDuels(performance.now());}else if(!townEvents.startRaid(backdropActors))throw Error('raid fixture');draw();},mode);
   const toggle=page.locator('#battle-view-toggle');
   if(!await toggle.isVisible())throw Error('toggle hidden at '+width);
   const fit=await toggle.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth;});if(!fit)throw Error('toggle clipped');
   if(!await page.locator('#battle-foreground').evaluate(e=>e.matches(':popover-open')))throw Error('battle starts expanded');
   await toggle.click();
   if(await page.locator('#battle-foreground').evaluate(e=>e.matches(':popover-open')))throw Error('battle did not hide immediately');
   const continued=await page.evaluate(mode=>{const previous=mode==='monster'?townAdventure.active:mode==='raid'?townEvents.active:backdropActors[0].duel;backdropNow+=1000;townAdventure.step(backdropNow);stepDuels(backdropNow);drawBattleForeground();return previous&&(mode==='monster'?townAdventure.active===previous:mode==='raid'?townEvents.active===previous:backdropActors[0].duel===previous);},mode);
   if(!continued)throw Error('toggle cancelled combat');
   await toggle.click();if(!await page.locator('#battle-foreground').evaluate(e=>e.matches(':popover-open')))throw Error('cannot restore live battle');
   await page.evaluate(()=>{townEvents.cancel();townAdventure.cancel();for(const d of roomDuels)endDuel(d);draw();});
   if(await page.locator('#battle-foreground').evaluate(e=>e.matches(':popover-open')))throw Error('backdrop remains after battle');
   results.push({width,mode,immediateToggle:true,combatContinues:true});
  }
 }
 await page.locator('#battle-view-toggle').click();await page.reload();await page.waitForFunction(()=>window.townUI);if(await page.locator('#battle-view-toggle').getAttribute('aria-pressed')!=='false')throw Error('preference not saved');await page.locator('#battle-view-toggle').click();return results;
}
