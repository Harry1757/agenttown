async page => {
 await page.goto('http://127.0.0.1:8869');
 const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try {
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  await page.evaluate(()=>{localStorage.setItem('codextown.adventure',JSON.stringify({'Portal|traveler':{kills:10,bosses:3,earnedStardust:4000}}));localStorage.removeItem('codextown.shop.sessions');});
  await page.reload();
  return await page.evaluate(()=>{
   cancelAnimationFrame(frameRequest);
   const check=(ok,msg)=>{if(!ok)throw Error(msg);},originalClock=performance.now,originalLoot=townAdventure.loot,originalTile=drawTile;
   let now=100000,body,accessories,paintingOutfit=false,outfitAlpha=[];
   const matrix=()=>Array.from(ctx.getTransform().toFloat64Array());
   for(const key of Object.keys(avatars))delete avatars[key];
   townAdventure.cancel();townAdventure.monsters.length=0;
   const key='Portal|traveler',a=avatars[key]={key,idx:84,proj:'Portal',sid:'traveler',role:'waiting',x:5,y:5,tx:8,ty:5,face:1,lean:0};
   state.sessionInfo[key]={tokens:123456,state:'working',title:'포탈 여행자'};townUI.motionReduced=false;
   for(const id of ['imperial','celestial','titanhand','cometboots','astrolabe','dragonling','bulwark','voidblade'])check(townAdventure.buy(id,key),'buy '+id);
   performance.now=()=>now;
   drawTile=function(c,sheet,idx,...args){if(!paintingOutfit&&sheet==='dungeon'&&idx===a.idx){const [x,y,scale,h=1]=args,fx=x+TILE*scale/2,fy=y+TILE*scale;body={matrix:Array.from(c.getTransform().translate(fx,fy).scale(1,h).translate(-fx,-fy).toFloat64Array()),alpha:c.globalAlpha};};if(paintingOutfit)outfitAlpha.push(c.globalAlpha);return originalTile(c,sheet,idx,...args);};
   townAdventure.loot=function(...args){accessories={matrix:matrix(),alpha:ctx.globalAlpha};paintingOutfit=true;try{return originalLoot(...args);}finally{paintingOutfit=false;}};
   let checked=0,invisible=0;
   const verify=label=>{
    body=null;accessories=null;outfitAlpha=[];ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,cv.width,cv.height);drawWorker(a);
    check(body&&accessories,'body and accessories drawn: '+label);
    check(body.matrix.every((v,i)=>Math.abs(v-accessories.matrix[i])<1e-8),'body/accessory transform diverged: '+label);
    check(Math.abs(body.alpha-accessories.alpha)<1e-8,'body/accessory opacity diverged: '+label);
    check(outfitAlpha.every(v=>v<=body.alpha+1e-8),'gear restored opacity during fade: '+label);
    check(ctx.globalAlpha===1&&matrix().every((v,i)=>v===[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1][i]),'canvas state leaked: '+label);
    checked++;
   };
   try {
    for(const face of [-1,1])for(const tokens of [0,123456,1e9])for(const p of [0,.18,.35,.45,.49,.5,.54,.55,.7,.9,1]){
     a.face=face;state.sessionInfo[key].tokens=tokens;a.portal={at:now-p*PORTAL_MS,from:{x:5,y:5},to:{x:12,y:9}};
     a.x=p<.5?5:12;a.y=p<.5?5:9;verify('portal '+[face,tokens,p]);
     if(p>=.45&&p<=.55){const pixels=ctx.getImageData(0,0,cv.width,cv.height).data;check(!pixels.some((v,i)=>i%4===3&&v),'accessory remained after entering portal');invisible++;}
    }
    a.portal=null;a.tx=a.x;a.ty=a.y;
    for(const face of [-1,1])for(const tokens of [0,123456,1e9])for(const kind of [0,1,2,3])for(const progress of [.15,.5,.8,.95]){
     a.face=face;state.sessionInfo[key].tokens=tokens;
     a.roomAction={kind,at:now-progress*1600,duration:1600};
     verify('room action '+[face,tokens,kind,progress]);
    }
    a.roomAction=null;
    for(const age of [0,100,250,450,1100]){a.summonAt=now-age;verify('summon '+age);}
    a.summonAt=undefined;townUI.motionReduced=true;verify('reduced motion');
    townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();
    state.sessionInfo[key].tokens=123456;
    const from=displayedRooms[0],to=displayedRooms.at(-1);
    const trip=()=>{
     a.role=from.role;a.x=a.tx=from.gx+3;a.y=a.ty=from.gy+4;a.roomAction=null;
     a.travelFrom=null;a.portal=null;a.route=null;a.nextRole=null;a.summonAt=undefined;
     changeRoom(a,to.role);startPendingTrips();
     check(a.route.some(p=>p.portalTo),'long-distance route uses a portal');
    };
    trip();let portalFrames=0,walkFrames=0;
    for(let i=0;i<1000&&a.travelFrom;i++){
     now+=16;stepAvatars();verify('actual trip '+i);
     if(a.portal)portalFrames++;else walkFrames++;
    }
    check(!a.travelFrom&&!a.portal&&!a.route,'trip finishes and clears portal');
    check(portalFrames>20&&walkFrames>20,'walk / portal / walk phases played');
    check(a.x===a.homeX&&a.y===a.homeY,'arrived at room position');
    trip();
    for(let i=0;i<1000&&!a.portal;i++){now+=16;stepAvatars();}
    check(a.portal,'second trip entered portal');townUI.motionReduced=true;stepAvatars();
    check(!a.portal&&!a.travelFrom,'reduced motion completes portal');verify('reduced during portal');
    return {transformedFrames:checked,fullyHiddenFrames:invisible,faces:2,tokenSizes:3,portalFrames,walkFrames,reducedDuringPortal:true};
   } finally {performance.now=originalClock;drawTile=originalTile;townAdventure.loot=originalLoot;}
  });
 } finally {
  await page.evaluate(b=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.')&&!Object.hasOwn(b,k))localStorage.removeItem(k);for(const[k,v]of Object.entries(b))localStorage.setItem(k,v);},backup);
  await page.unroute('**/events');await page.reload();
 }
}
