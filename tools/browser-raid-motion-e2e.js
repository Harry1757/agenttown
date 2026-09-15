async page=>{
 await page.goto('http://127.0.0.1:8869');const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try{
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const output=[];
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img&&SHEETS.equipment.img);
   output.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();const g=townAdventure,e=townEvents,clock=performance.now,random=Math.random,equipment=g.equipment,monster=g.monster;
    let now=100000,frames=0,units={},boss=null;performance.now=()=>now;Math.random=()=>.99;for(const key of Object.keys(avatars))delete avatars[key];e.cancel();g.cancel();g.monsters.length=0;
    const check=(ok,msg)=>{if(!ok)throw Error(msg);},room=ROOM_BY_ROLE.waiting,people=[0,1,2,3].map(i=>{const key='Motion|'+i,a=avatars[key]={key,proj:'Motion',sid:''+i,idx:84+i,role:'waiting',x:room.gx+3,y:room.gy+4,tx:room.gx+3,ty:room.gy+4};state.sessionInfo[key]={title:'움직임 검증 '+i,state:'working',tokens:i===1?1e10:10**(i+3)};return a;});
    const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=900;const c=sheet.getContext('2d');c.fillStyle='#101d28';c.fillRect(0,0,1280,900);let shots=0;
    g.equipment=function(a,x,y,size,pose,...args){units[a.key]={x,y,size,sword:pose.sword};return equipment.call(this,a,x,y,size,pose,...args);};g.monster=function(m,x,y,...args){boss={x,y,size:args[0]};return monster.call(this,m,x,y,...args);};
    const frame=(label)=>{units={};boss=null;ctx.resetTransform();ctx.clearRect(0,0,cv.width,cv.height);e.drawBattle();frames++;if(label&&shots<12){const x=shots%4*320,y=Math.floor(shots/4)*300,ratio=Math.min(320/cv.width,265/cv.height);c.drawImage(cv,x+(320-cv.width*ratio)/2,y+25+(265-cv.height*ratio)/2,cv.width*ratio,cv.height*ratio);c.font='bold 12px sans-serif';c.textAlign='center';c.fillStyle='#e6eadf';c.fillText(label,x+160,y+17);shots++;}return {units:JSON.parse(JSON.stringify(units)),boss:{...boss}};};
    const advance=phase=>{for(let i=0;i<30&&e.active.phase!==phase;i++){now=e.active.next;g.step(now);}check(e.active.phase===phase,'phase '+phase);};
    const at=(fraction,label)=>{now=e.active.phaseAt+(e.active.next-e.active.phaseAt)*fraction;return frame(label);};
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const same=(a,b)=>Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)<.01;
    try{
     check(e.startRaid(people),'start raid');const r=e.active;r.hp=r.maxHp=1e6;r.members.forEach(m=>m.hp=m.maxHp=1e6);now=r.start+1000;frame('BOSS 등장 · 공격 전에 소개');
     for(let i=0;i<4;i++){
      Math.random=()=>[.12,.38,.62,.88][i];advance('playerApproach');check(r.actor.a===people[i],'all four actors take their turn');const key=people[i].key,hp=r.hp;
      const start=at(.01),middle=at(.5,i===0?'먼 자리에서 다가가기':i===1?'가까운 자리에서 다가가기':null),near=at(.99);check(distance(start.units[key],middle.units[key])>0&&distance(start.units[key],near.units[key])>distance(start.units[key],middle.units[key]),'approach is progressive');check(r.hp===hp,'approach has no damage');check(start.units[key].sword===.52&&middle.units[key].sword===.52&&near.units[key].sword===.52,'weapon rests during approach');
      advance('playerWindup');const stop1=at(.2,i===0?'도착 · 멈춘 뒤 검 준비':i===1?'가까운 자리 · 멈추기':null),stop2=at(.8);check(same(stop1.units[key],stop2.units[key]),'attacker stands still through windup');check(stop2.units[key].sword>stop1.units[key].sword,'weapon prepares while body stays');
      advance('playerImpact');check(r.hp<hp,'damage only after stopped windup');const hit1=at(.01,i===0?'닿는 순간 · 적만 밀림':i===1?'가까운 자리 · 멈춰서 공격':null),hit2=at(.4);check(same(hit1.units[key],hit2.units[key]),'attacker remains planted through hit');check(hit1.units[key].sword!==hit2.units[key].sword,'sword swings independently');
      advance('playerReturn');const returning=at(.5,i===0?'공격이 끝난 뒤 제자리로':null);check(distance(returning.units[key],start.units[key])>0&&distance(returning.units[key],start.units[key])<distance(hit2.units[key],start.units[key]),'deliberate return follows hit');check(returning.units[key].sword===.52,'weapon rests during return');
      Math.random=()=>.99;advance('bossApproach');const targetHP=r.target.hp,bstart=at(.01),bmid=at(.5,i===0?'보스가 상대에게 다가가기':null),bend=at(.99);check(distance(bstart.boss,bmid.boss)>0&&distance(bstart.boss,bend.boss)>distance(bstart.boss,bmid.boss),'boss approaches smoothly');check(r.target.hp===targetHP,'boss travel does not damage');const defender=r.target.a.key;check(same(bstart.units[defender],bmid.units[defender])&&same(bmid.units[defender],bend.units[defender]),'defender stays at their own station');check(bmid.units[defender].sword===.52,'defender rests weapon while moving');for(const p of people)if(p.key!==defender)check(same(bstart.units[p.key],bmid.units[p.key])&&same(bmid.units[p.key],bend.units[p.key]),'bystanders remain in place');
      advance('bossWindup');const w1=at(.2,i===0?'보스도 멈춘 뒤 공격 준비':null),w2=at(.8);check(same(w1.boss,w2.boss),'boss stays planted during windup');check(same(w1.units[defender],w2.units[defender]),'defender also stops before the attack');for(const p of people)if(p.key!==defender)check(Math.abs(w1.boss.x-w1.units[p.key].x)>w1.boss.size/2+w1.units[p.key].size/2+8,'boss stays clear of party formation');
      advance('bossImpact');check(r.target.hp<targetHP,'boss hit applies after windup');const struck1=at(.01,i===0?'보스 명중 · 맞은 친구만 밀림':null),struck2=at(.25);check(same(struck1.boss,struck2.boss),'boss holds contact position');check(struck1.units[r.target.a.key].x!==struck2.units[r.target.a.key].x,'victim visibly reacts after contact');
      advance('bossReturn');const back=at(.5,i===0?'보스도 공격 후 돌아가기':null);check(distance(back.boss,bstart.boss)<distance(w2.boss,bstart.boss)&&distance(back.boss,bstart.boss)>0,'boss returns after attack');
     }
     return {width,frames,actors:4,contactSheet:sheet.toDataURL()};
    }finally{g.equipment=equipment;g.monster=monster;e.cancel();g.cancel();performance.now=clock;Math.random=random;sheet.width=sheet.height=0;}
   },width));
  }
  return output;
 }finally{await page.unroute('**/events');await page.evaluate(backup=>{for(const key of Object.keys(localStorage))if(key.startsWith('codextown.'))localStorage.removeItem(key);for(const[k,v]of Object.entries(backup))localStorage.setItem(k,v);},backup);await page.reload();}
}
