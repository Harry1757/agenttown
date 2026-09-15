async page => {
 await page.goto('http://127.0.0.1:8869');
 const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try {
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  await page.evaluate(()=>{localStorage.setItem('codextown.adventure',JSON.stringify({'Pet|a':{kills:3,bosses:1,earnedStardust:10000},'Pet|b':{kills:3,bosses:1,earnedStardust:10000}}));localStorage.removeItem('codextown.shop.sessions');});
  await page.reload();await page.waitForFunction(()=>SHEETS.dungeon.img&&SHEETS.equipment.img);
  const results=[];
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();
   results.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
    const check=(ok,msg)=>{if(!ok)throw Error(msg);},g=townAdventure,clock=performance.now,random=Math.random,tile=drawTile,images=ctx.drawImage,equipment=g.equipment;
    let now=100000,pet=null,capture=false,captureBody=false,entries=[],checked=0,positions={};
    g.equipment=function(actor,x,...args){positions[actor.key]=x;return equipment(actor,x,...args);};
    const pets=new Set([108,120,121,124]);
    drawTile=function(c,sheet,idx,...args){capture=sheet==='dungeon'&&pets.has(idx);captureBody=sheet==='dungeon'&&[84,85].includes(idx);try{return tile(c,sheet,idx,...args);}finally{capture=false;captureBody=false;}};
    ctx.drawImage=function(...args){if(capture||captureBody){const [,,,,,x,y,w,h]=args,m=ctx.getTransform(),corners=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>m.transformPoint({x,y})),rect={left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};entries.push({kind:capture?'pet':'body',...rect});if(capture)pet=rect;}return images.apply(this,args);};
    performance.now=()=>now;Math.random=()=>.99;
    for(const key of Object.keys(avatars))delete avatars[key];g.cancel();g.monsters.length=0;
    const room=ROOM_BY_ROLE.waiting,a=avatars['Pet|a']={key:'Pet|a',proj:'Pet',sid:'a',idx:84,role:'waiting',x:room.gx+2.2,y:room.gy+4.5,tx:room.gx+2.2,ty:room.gy+4.5,face:1},b=avatars['Pet|b']={key:'Pet|b',proj:'Pet',sid:'b',idx:85,role:'waiting',x:room.gx+4.5,y:room.gy+4.5,tx:room.gx+4.5,ty:room.gy+4.5,face:-1};
    for(const actor of [a,b])state.sessionInfo[actor.key]={state:'working',tokens:1e9,title:'펫 전투 위치 검사'};
    const wear=(actor,id,slot)=>{if(g.equippedFor(actor,slot)!==id)check(g.buy(id,actor.key),'equip '+id);};
    try{
     for(const actor of [a,b]){wear(actor,'bulwark','shield');wear(actor,'voidblade','weapon');}
     // Compare the actual pet pixels before and after each full sword swing.
     for(const id of ['fox','wisp','moonfox','cub','phoenix','dragonling'])for(const face of [-1,1])for(const size of [32,76,96])for(const angle of [.48,.9,1.3,1.95])for(const legend of [false,true]){
      wear(a,id,'pet');ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,cv.width,cv.height);ctx.save();ctx.translate(cv.width/2,cv.height/2);
      pet=null;g.loot(a,0,0,size,face,180);check(pet,'pet rendered');const middle=(pet.left+pet.right)/2-cv.width/2;
      check(middle*face< -size*.5,'pet must stand behind the attacker: '+[id,face,size]);
      const x=Math.floor(pet.left),y=Math.floor(pet.top),w=Math.ceil(pet.right)-x,h=Math.ceil(pet.bottom)-y;
      const before=ctx.getImageData(x,y,w,h).data;g.equipment(a,0,0,size,{sword:angle,trail:1},face,legend,false,1);const after=ctx.getImageData(x,y,w,h).data;
      let visible=0,covered=0;for(let i=0;i<before.length;i+=4)if(before[i+3]>220){visible++;if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>120)covered++;}
      check(visible>0&&covered<=Math.max(2,visible*.08),'sword obscures pet: '+[id,face,size,angle,legend,covered,visible]);ctx.restore();checked++;
     }
     const behind=(body,pet,face,label)=>{
      check(body&&pet,'body and pet present: '+label);
      check(((pet.left+pet.right)-(body.left+body.right))*face<0,'pet behind owner: '+label);
      check(pet.left>=0&&pet.right<=cv.width&&pet.top>=0&&pet.bottom<=cv.height,'pet inside viewport: '+label);
     };
     for(const actor of [a,b])wear(actor,'dragonling','pet');
     ctx.setTransform(1,0,0,1,0,0);g.cancel();g.monsters.length=0;
     check(beginDuel(a,b,now),'actual PvP starts');const d=a.duel;
     const arena=[];
     for(const phase of [.55,1.2,2.2]){
      now=d.start+phase*1000;stepDuels(now);entries=[];drawDuelSpotlight();
      const bodies=entries.filter(e=>e.kind==='body'),companions=entries.filter(e=>e.kind==='pet');
      check(bodies.length===2&&companions.length===2,'both duel pets rendered');
      behind(bodies[0],companions[0],1,'left duelist');behind(bodies[1],companions[1],-1,'right duelist');
      arena.push({mode:'PvP',phase});
     }
     for(const hit of d.combat.strikes.slice(0,4)){
      now=d.start+hit.at*1000+150;stepDuels(now);positions={};drawDuelSpotlight();
      const striker=hit.attacker===0?a:b,target=hit.attacker===0?b:a;
      check(Math.abs(positions[striker.key])<=48,'attacker stays forward in battle screen');
      check(Math.abs(positions[target.key])>48,'only the victim recoils in battle screen');
      arena.push({mode:'recoil',attacker:hit.attacker});
     }
     endDuel(d);now+=70000;g.cancel();g.monsters.length=0;
     check(g.begin(a,g.spawn('waiting',true)),'actual monster battle starts');
     const battle=g.active;battle.legendary=false;
     for(const hit of [false,true]){
      now+=100;battle.playerHitAt=hit?now:undefined;entries=[];g.drawBattle();
      behind(entries.find(e=>e.kind==='body'),entries.find(e=>e.kind==='pet'),1,'monster fight');arena.push({mode:'PvE',hit});
     }
     g.cancel();
     return {width,weaponChecks:checked,arenaFrames:arena.length};
    }finally{performance.now=clock;Math.random=random;drawTile=tile;ctx.drawImage=images;g.equipment=equipment;}
   },width));
  }
  return results;
 } finally {
  await page.evaluate(b=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.')&&!Object.hasOwn(b,k))localStorage.removeItem(k);for(const[k,v]of Object.entries(b))localStorage.setItem(k,v);},backup);
  await page.unroute('**/events');await page.reload();
 }
}
