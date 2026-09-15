async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const results=[];
 for(const width of [960,390]){
  await page.setViewportSize({width,height:580});await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure&&SHEETS.dungeon.img);
  results.push(await page.evaluate(width=>{
   cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();
   const g=townAdventure,clock=performance.now,random=Math.random,tile=drawTile,check=(ok,m)=>{if(!ok)throw Error(m);};let now=100000,monsterIndex,angle,frames=0;
   performance.now=()=>now;Math.random=()=>.99;townEvents.cancel();for(const d of roomDuels)endDuel(d);g.cancel();for(const key of Object.keys(avatars))delete avatars[key];
   const r=ROOM_BY_ROLE.waiting,a=avatars['Attack|a']={key:'Attack|a',proj:'Attack',sid:'a',idx:84,role:'waiting',x:r.gx+3,y:r.gy+4.5,tx:r.gx+3,ty:r.gy+4.5};state.sessionInfo[a.key]={state:'working',tokens:1e9,title:'공격 동작 검증'};
   const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=750;const paint=sheet.getContext('2d');paint.fillStyle='#111d29';paint.fillRect(0,0,1200,750);let shots=0;
   drawTile=function(c,sheet,idx,...args){if(sheet==='dungeon'&&idx===monsterIndex){const m=c.getTransform();angle=Math.atan2(-m.c,m.d);}return tile(c,sheet,idx,...args);};
   const frame=label=>{angle=null;ctx.resetTransform();ctx.clearRect(0,0,cv.width,cv.height);g.drawBattle();check(Number.isFinite(angle),'monster sprite is rendered');frames++;if(label){const x=shots%3*400,y=Math.floor(shots/3)*250,scale=Math.min(400/cv.width,225/cv.height);paint.drawImage(cv,x+(400-cv.width*scale)/2,y+25,cv.width*scale,cv.height*scale);paint.font='12px sans-serif';paint.textAlign='center';paint.fillStyle='#eee';paint.fillText(label,x+200,y+17);shots++;}return angle;};
   try{for(const mode of ['normal','boss','special']){
    g.cancel();g.monsters.length=0;now+=70000;Math.random=()=>.99;const m=g.spawn('waiting',mode!=='normal');monsterIndex=m.idx;check(g.begin(a,m),'battle begins');const b=g.active;b.hp=b.maxHp=10000;b.monsterHp=b.maxMonsterHp=10000;
    Math.random=()=>mode==='special'?.01:.99;now=b.next;g.step(now);check(Boolean(b.counterSpecial)===(mode==='special'),'intended attack type');
    const hitAt=b.counterAt,windup=b.counterSpecial?1400:200,arrival=hitAt-windup,hp=b.hp;
    now=arrival-100;check(Math.abs(frame())<.001,'travel is upright');check(b.hp===hp,'travel has no damage');
    now=arrival+windup*.5;check(frame(mode+' · 뒤로 준비')>.05,'visible windup');
    now=hitAt-.1;check(frame()<-.3,'body leans into contact');check(b.hp===hp,'no premature damage');
    now=hitAt;g.step(now);check(frame(mode+' · 타격')<-.3&&b.hp<hp,'damage matches visible contact pose');
    now=hitAt+200;check(frame()<-.1,'follow through');now=hitAt+400;check(Math.abs(frame(mode+' · 복귀'))<.001,'returns upright');
   }return {width,frames,screenshot:sheet.toDataURL()};}finally{drawTile=tile;performance.now=clock;Math.random=random;g.cancel();sheet.width=sheet.height=0;}
  },width));
 }
 return results;
}
