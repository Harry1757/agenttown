async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const results=[];
 for(const width of [390,960,1920])for(const count of [4,7,15]){
  await page.setViewportSize({width,height:width===1920?1080:580});await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img);
  results.push(await page.evaluate(({width,count})=>{
   cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const e=townEvents,g=townAdventure,clock=performance.now,equipment=g.equipment;let now=100000,drawn=[];performance.now=()=>now;
   const check=(ok,msg)=>{if(!ok)throw Error(msg);};for(const key of Object.keys(avatars))delete avatars[key];e.cancel();g.cancel();roomDuels.clear();
   const room=ROOM_BY_ROLE.waiting,actors=Array.from({length:count},(_,i)=>{const key='Formation|'+i,a=avatars[key]={key,proj:'Formation',sid:''+i,idx:84+i%6,role:'waiting',x:room.gx+3,y:room.gy+4,tx:room.gx+3,ty:room.gy+4};state.sessionInfo[key]={title:'토벌대 '+(i+1),state:'working',tokens:[100000,1e6,1e7][i%3]};return a;});
   g.equipment=function(a,x,y,size,...args){drawn.push({x,y,size});return equipment.call(this,a,x,y,size,...args);};
   try{
    check(e.startRaid(actors),'raid begins');now+=3100;e.drawBattle();check(drawn.length===count,'everyone drawn');
    const before=JSON.stringify(drawn);drawn=[];now+=100;e.drawBattle();check(before===JSON.stringify(drawn),'formation does not jitter');
    for(let i=0;i<count;i++){check(drawn[i].size===48*tokenSizeMul(tokensOf(actors[i])),'token size retained');for(let j=i+1;j<count;j++){const a=drawn[i],b=drawn[j];check(Math.abs(a.x-b.x)>(a.size+b.size)/2+8||a.y+18<b.y-b.size||b.y+18<a.y-a.size,'portrait and HP clearance');}}
    check(new Set(drawn.map(a=>a.x)).size>2,'not two straight lines');
    const shot=count===7?ctx.canvas.toDataURL():null;return {width,count,minSize:Math.min(...drawn.map(a=>a.size)),maxSize:Math.max(...drawn.map(a=>a.size)),shot};
   }finally{e.cancel();g.equipment=equipment;performance.now=clock;}
  },{width,count}));
 }
 return results;
}
