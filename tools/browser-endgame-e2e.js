async page=>{
 const errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);await page.goto('http://127.0.0.1:8869');
 const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 const items=['solaris','voidblade','tempest','bulwark','imperial','celestial','titanhand','cometboots','heartlantern','astrolabe','phoenix','dragonling'];
 const check=(ok,msg)=>{if(!ok)throw Error(msg);};
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  await page.evaluate(()=>{localStorage.setItem('codextown.adventure',JSON.stringify({'Test|a':{kills:0,bosses:0,earnedStardust:4000},'Test|b':{kills:0,bosses:0,earnedStardust:4000}}));localStorage.removeItem('codextown.shop.sessions');});
  await page.setViewportSize({width:960,height:580});await page.reload();
  const fixture=()=>{cancelAnimationFrame(frameRequest);for(const k of Object.keys(avatars))delete avatars[k];roomDuels.clear();townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();const r=ROOM_BY_ROLE.waiting;
   for(const [sid,idx,x]of[['a',84,2.2],['b',85,4.5]]){const key='Test|'+sid;avatars[key]={key,proj:'Test',sid,idx,role:'waiting',x:r.gx+x,y:r.gy+4.5,tx:r.gx+x,ty:r.gy+4.5,duelAfter:Infinity};state.sessionInfo[key]={tokens:1e9,state:'working',title:'최상위 장비와 실제 체력 전투 · '+sid};}
   townAdventure.openEquipment('Test|a');
  };
  await page.evaluate(fixture);check(await page.locator('.shop-item').count()===56,'56 items');
  for(const id of items){await page.locator('[data-item="'+id+'"]').click();check((await page.locator('[data-item="'+id+'"]').getAttribute('aria-label')).endsWith('해제'),'purchase '+id);}
  const balance=await page.evaluate(()=>townAdventure.balance('Test|a'));check(balance<4000,'new items cost currency');
  await page.reload();await page.evaluate(fixture);check(await page.evaluate(()=>townAdventure.balance('Test|a'))===balance,'inventory and money persist');
  for(const width of [960,680,390]){await page.setViewportSize({width,height:580});const clipped=await page.locator('.shop-item h3,.equipment-slots strong,.shop-heading').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));check(!clipped.length,'names fit '+width+': '+clipped);await page.locator('[data-item="dragonling"]').scrollIntoViewIfNeeded();check(await page.locator('.shop-close').evaluate(e=>e.getBoundingClientRect().top>=0),'close visible');}
  await page.keyboard.press('Escape');
  const result=await page.evaluate(()=>{
   const check=(ok,msg)=>{if(!ok)throw Error(msg);},g=townAdventure,a=avatars['Test|a'],b=avatars['Test|b'],random=Math.random,clock=performance.now;let now=clock.call(performance)+70000;Math.random=()=>.99;performance.now=()=>now;cancelAnimationFrame(frameRequest);g.cancel();g.monsters.length=0;
   const equip=(actor,id,slot)=>{if(g.equippedFor(actor,slot)!==id)check(g.buy(id,actor.key),'equip '+id);};
   for(const actor of [a,b])for(const [id,slot]of[['voidblade','weapon'],['bulwark','shield'],['imperial','head'],['celestial','body'],['titanhand','hands'],['cometboots','feet'],['astrolabe','charm'],['dragonling','pet']])equip(actor,id,slot);
   try{
    check(beginDuel(a,b,now),'actual encounter starts');const d=a.duel;check(d.combat.strikes.length>2,'multiple actual strikes');const before=g.balance(d.winner.key);let shown=0;now=d.start+200;stepDuels(now);drawDuelSpotlight();check(featuredDuel===d,'spotlight is visible');
    for(const hit of d.combat.strikes){if(hit.final){now=d.start+(hit.chargeStart+1.5)*1000;stepDuels(now);drawDuelSpotlight();check(d.playback.charging&&Math.abs(d.playback.charge-.5)<.001,'middle of charge');}now=d.start+hit.at*1000+1;stepDuels(now);drawDuelSpotlight();check(JSON.stringify(d.playback.hp)===JSON.stringify(hit.hp),'visible HP follows each strike');shown++;}
    const last=d.combat.strikes.at(-1);check(Math.abs(last.chargeEnd-last.chargeStart-3)<.001,'3 second charge');
    now=d.start+(d.combat.resultAt+.1)*1000;stepDuels(now);drawDuelSpotlight();check(g.balance(d.winner.key)===before+d.combat.reward,'grade-based reward');check(g.record(d.winner).kills===0,'no fake monster kills');
    now=d.start+(d.combat.endAt+.1)*1000;stepDuels(now);check(!a.duel&&!b.duel,'encounter completes');check(!beginDuel(a,b,now),'same visit cannot repeat reward');
    const elites=[];
    for(let i=0;i<3;i++){
     g.cancel();now+=70000;g.monsters.length=0;const m=g.spawn('waiting',true,true);check(g.begin(a,m),'elite encounter');const fight=g.active;fight.legendary=false;const money=g.balance(a.key);
     for(let tick=0;tick<300&&!fight.done;tick++){now+=250;g.step(now);g.drawBattle();}
     check(fight.done,'elite fight resolves');check(g.balance(a.key)-money===(fight.won?m.reward:0),'elite reward matches outcome');elites.push({level:m.level,reward:m.reward,won:fight.won,hits:fight.round});
    }
    return {strikesShown:shown,duelReward:d.combat.reward,opponentGrades:[...d.combat.grades],eliteBattles:elites};
   }finally{Math.random=random;performance.now=clock;}
  });
  check(!errors.length,errors.join('; '));return {newPurchases:items.length,totalItems:56,widths:[960,680,390],...result,errors};
 }finally{
  await page.evaluate(b=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.')&&!Object.hasOwn(b,k))localStorage.removeItem(k);for(const[k,v]of Object.entries(b))localStorage.setItem(k,v);},backup);
  await page.unroute('**/events');await page.reload();page.off('pageerror',onError);
 }
}
