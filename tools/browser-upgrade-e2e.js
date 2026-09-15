async page=>{
 const check=(ok,msg)=>{if(!ok)throw Error(msg);},errors=[],onError=e=>errors.push(e.message);
 page.on('pageerror',onError);await page.goto('http://127.0.0.1:8869');
 const keys=['codextown.adventure','codextown.shop','codextown.shop.sessions'],backup=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys);
 const items=['thunderblade','tideblade','eclipse','runemallet','aegis','runecrown','warden','nightwings','sungrip','runegloves','starboots','compass','lantern','moonfox','cub'];
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  await page.evaluate(()=>{localStorage.setItem('codextown.adventure',JSON.stringify({'Upgrade|hero':{kills:0,bosses:0,earnedStardust:1000}}));localStorage.removeItem('codextown.shop.sessions');localStorage.removeItem('codextown.shop');});
  await page.setViewportSize({width:960,height:580});await page.reload();
  const fixture=()=>{cancelAnimationFrame(frameRequest);for(const key of Object.keys(avatars))delete avatars[key];townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const r=ROOM_BY_ROLE.waiting;avatars['Upgrade|hero']={key:'Upgrade|hero',proj:'Upgrade',sid:'hero',idx:84,role:'waiting',x:r.gx+3,y:r.gy+4};state.sessionInfo['Upgrade|hero']={tokens:1e7,state:'working',title:'새 장비의 실제 구매와 장착 확인'};townAdventure.openEquipment('Upgrade|hero');};
  await page.evaluate(fixture);
  check(await page.locator('.shop-item').count()===45,'all 45 items visible');
  for(const id of items){
   const button=page.locator('[data-item="'+id+'"]');await button.click();
   check((await button.getAttribute('aria-label')).endsWith('해제'),'new item equipped: '+id);
   const state=await page.evaluate(id=>{const g=townAdventure,a=avatars['Upgrade|hero'],c=document.querySelector('[data-preview="'+id+'"]'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {balance:g.balance(a.key),visible:d.some((v,i)=>i%4===3&&v>0),stats:g.statsFor(a)};},id);
   check(state.visible,'item artwork renders: '+id);check(state.balance>=0,'wallet never negative');
  }
  const bought=await page.evaluate(()=>({inventory:JSON.parse(localStorage.getItem('codextown.shop.sessions')).sessions['Upgrade|hero'],stats:townAdventure.statsFor(avatars['Upgrade|hero']),balance:townAdventure.balance('Upgrade|hero')}));
  check(items.every(id=>bought.inventory.owned.includes(id)),'all new items owned');
  await page.reload();await page.evaluate(fixture);
  const reloaded=await page.evaluate(()=>({inventory:JSON.parse(localStorage.getItem('codextown.shop.sessions')).sessions['Upgrade|hero'],stats:townAdventure.statsFor(avatars['Upgrade|hero']),balance:townAdventure.balance('Upgrade|hero')}));
  check(JSON.stringify(bought)===JSON.stringify(reloaded),'new equipment and wallet survive restart');
  for(const width of [960,680,390]){
   await page.setViewportSize({width,height:580});await page.getByRole('button',{name:'전체',exact:true}).click();
   const clipped=await page.locator('.shop-item h3,.equipment-slots strong,.shop-heading').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
   check(!clipped.length,'new names fit at '+width+': '+clipped.join(','));
   await page.locator('[data-item="cub"]').scrollIntoViewIfNeeded();check(await page.locator('[data-item="cub"]').isVisible(),'last item is reachable');
   check(await page.locator('.shop-close').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'close stays visible after scrolling at '+width);
  }
  await page.keyboard.press('Escape');
  const combat=await page.evaluate(()=>{
   cancelAnimationFrame(frameRequest);townAdventure.cancel();townAdventure.monsters.length=0;roomDuels.clear();
   const g=townAdventure,a=avatars['Upgrade|hero'],clock=performance.now,random=Math.random,drawImage=ctx.drawImage;let now=clock.call(performance)+70000;performance.now=()=>now;Math.random=()=>.99;
   const calls=[];ctx.drawImage=function(img,sx,sy,...rest){if(String(img.src).includes('dungeon'))calls.push(sx/16+sy/16*12);return drawImage.call(this,img,sx,sy,...rest);};
   try{
    const m=g.spawn('waiting',true);if(!g.begin(a,m))throw Error('begin');const b=g.active;b.legendary=false;
    if(b.element!==3)throw Error('wind hammer selects wind finisher');
    const stats=JSON.stringify(b.stats);g.buy('thunderblade',a.key);if(b.element!==3||g.elementFor(a)!==1)throw Error('current fight keeps its element; next weapon uses lightning');if(JSON.stringify(b.stats)!==stats)throw Error('changing equipment modifies current combat stats');
    const result={weaponFront:false,quietMap:false,elements:[],snapshots:[]};
    calls.length=0;g.drawBattle();result.weaponFront=calls.lastIndexOf(104)>calls.indexOf(m.idx)&&calls.indexOf(m.idx)>=0;
    calls.length=0;g.loot(a,130,180,48);result.quietMap=!calls.includes(104);
    b.finishing=true;b.next=now+200;
    for(let element=0;element<5;element++){b.element=element;ctx.clearRect(0,0,cv.width,cv.height);g.drawBattle();const data=ctx.getImageData(0,0,cv.width,cv.height).data;let hash=0;for(let i=0;i<data.length;i+=13)hash=(Math.imul(hash,31)+data[i])>>>0;result.snapshots.push(hash);result.elements.push(element);}
    g.cancel();roomDuels.clear();
    const rival={key:'Upgrade|rival',idx:85,role:'waiting'},d={a,b:rival,winner:a,ha:1,hb:2,role:'waiting',start:now-3500,legendary:a};
    a.duel=rival.duel=d;a.duelPose=rival.duelPose=duelFrame(2.5);roomDuels.add(d);featuredDuel=d;
    const equipment=g.equipment;g.equipment=(...args)=>{if(args[0].key===a.key)result.pvpLegendary=!!args[6]&&!!args[7];equipment(...args);};
    try{drawDuelSpotlight();}finally{g.equipment=equipment;roomDuels.clear();featuredDuel=null;a.duel=null;}
    return result;
   }finally{ctx.drawImage=drawImage;performance.now=clock;Math.random=random;}
  });
  check(combat.pvpLegendary,'small legendary remains visible in the PvP spotlight');
  check(combat.weaponFront,'weapon drawn after monster');check(combat.quietMap,'purchased weapon hidden on village map');check(new Set(combat.snapshots).size===5,'five distinct atmosphere frames');
  check(!errors.length,errors.join('; '));
  return {newItemsPurchased:items.length,totalItems:45,responsiveWidths:[960,680,390],persistence:true,combat,errors};
 }finally{
  await page.evaluate(backup=>{for(const[k,v]of Object.entries(backup)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}},backup);
  await page.unroute('**/events');await page.reload();page.off('pageerror',onError);
 }
}
