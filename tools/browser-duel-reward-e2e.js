async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
 const results=[];
 for(const [width,height] of [[960,580],[390,580],[960,360]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure&&SHEETS.dungeon.img);
  results.push(await page.evaluate(({width,height})=>{
   cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
   const g=townAdventure,clock=performance.now,random=Math.random,check=(ok,m)=>{if(!ok)throw Error(m);};let now=100000,frames=0;
   performance.now=()=>now;Math.random=()=>.99;townEvents.cancel();g.cancel();for(const d of roomDuels)endDuel(d);for(const key of Object.keys(avatars))delete avatars[key];
   const r=ROOM_BY_ROLE.waiting,actors=[0,1].map(i=>{const key='Reward|'+i,a=avatars[key]={key,proj:'Reward',sid:String(i),idx:84+i,role:'waiting',x:r.gx+2.5+i*2,y:r.gy+4.5,tx:r.gx+2.5+i*2,ty:r.gy+4.5};state.sessionInfo[key]={state:'working',tokens:1e9,title:i?'오른쪽 세션':'왼쪽 세션'};return a;});
   const c=battleCanvas.getContext('2d'),fillText=c.fillText,strokeRect=c.strokeRect,fillRect=c.fillRect;let reward,frame,hpTop,heading;
   const point=(x,y)=>new DOMPoint(x,y).matrixTransform(c.getTransform());
   c.strokeRect=function(x,y,w,h){if(y===-103&&h===206)frame={top:point(x,y).y,left:point(x,y).x,right:point(x+w,y).x};return strokeRect.call(this,x,y,w,h);};
   c.fillRect=function(x,y,w,h){if(y===-71&&h===5)hpTop=point(x,y).y;return fillRect.call(this,x,y,w,h);};
   c.fillText=function(text,x,y,...args){if(text.includes('작은 결투'))heading=true;if(text.includes('승리!')&&text.includes('별가루')){const m=c.measureText(text);reward={top:point(x,y-m.actualBoundingBoxAscent).y,bottom:point(x,y+m.actualBoundingBoxDescent).y,left:point(x-m.actualBoundingBoxLeft,y).x,right:point(x+m.actualBoundingBoxRight,y).x,text};}return fillText.call(this,text,x,y,...args);};
   try{
    check(beginDuel(...actors,now),'duel begins');const d=actors[0].duel;now+=200;stepDuels(now);draw();
    for(const age of [.05,.8,1.4]){reward=frame=null;heading=false;now=d.start+(d.combat.resultAt+age)*1000;stepDuels(now);draw();
     check(reward&&frame,'reward is rendered');check(!heading,'reward replaces the fight heading');
     check(reward.top>=frame.top+2&&reward.bottom<hpTop-2,'reward stays inside header above health bars');
     check(reward.left>frame.left+5&&reward.right<frame.right-5,'reward fits inside arena');
     check(reward.text.includes('+'+d.combat.reward),'correct reward amount');frames++;
    }
    return {width,height,frames,screenshot:battleCanvas.toDataURL()};
   }finally{c.fillText=fillText;c.strokeRect=strokeRect;c.fillRect=fillRect;performance.now=clock;Math.random=random;for(const d of roomDuels)endDuel(d);g.cancel();}
  },{width,height}));
 }
 return results;
}
