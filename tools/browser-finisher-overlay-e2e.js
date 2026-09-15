async page => {
 await page.goto('http://127.0.0.1:8869');
 const backup=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('codextown.')).map(k=>[k,localStorage.getItem(k)])));
 try {
  await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  const results=[];
  for(const width of [960,390]){
   await page.setViewportSize({width,height:580});await page.reload();
   results.push(await page.evaluate(width=>{
    cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
    const check=(ok,msg)=>{if(!ok)throw Error(msg);},g=townAdventure,clock=performance.now,random=Math.random,original={};
    let now=100000,path=[],checking=false,frames=0;
    // Repaint the same crescent path without any arena clip, then compare its pixels.
    for(const name of ['beginPath','moveTo','lineTo','quadraticCurveTo','closePath']){original[name]=ctx[name];ctx[name]=function(...args){if(name==='beginPath')path=[];else path.push([name,args]);return original[name].apply(this,args);};}
    original.fill=ctx.fill;
    ctx.fill=function(...args){
     if(!checking||!['#ffac45','#ffe786','#5abde9','#a9e3b1','#dedee9'].includes(ctx.fillStyle)||!path.some(([name,args])=>name==='moveTo'&&args[0]===-65&&args[1]===-28))return original.fill.apply(this,args);
     const w=cv.width,h=cv.height,reference=document.createElement('canvas');reference.width=w*3;reference.height=h*3;const c=reference.getContext('2d'),m=ctx.getTransform();
     c.setTransform(m.a,m.b,m.c,m.d,m.e+w,m.f+h);for(const key of ['fillStyle','globalAlpha','shadowColor','shadowBlur','shadowOffsetX','shadowOffsetY'])c[key]=ctx[key];c.beginPath();for(const[name,values]of path)c[name](...values);c.fill(...args);
     const before=ctx.getImageData(0,0,w,h).data;original.fill.apply(this,args);const after=ctx.getImageData(0,0,w,h).data,expected=c.getImageData(0,0,w*3,h*3).data;
     let visible=0,clipped=0,outside=0;
     for(let y=0;y<h*3;y++)for(let x=0;x<w*3;x++){
      const i=(y*w*3+x)*4;if(expected[i+3]<35)continue;
      if(x<w||x>=w*2||y<h||y>=h*2){outside++;continue;}
      visible++;const j=((y-h)*w+x-w)*4,alpha=expected[i+3]/255,base=before[j+3]/255,total=alpha+base*(1-alpha);
      const planned=Math.max(...[0,1,2].map(k=>Math.abs((expected[i+k]*alpha+before[j+k]*base*(1-alpha))/total-before[j+k]))),painted=Math.max(...[0,1,2].map(k=>Math.abs(after[j+k]-before[j+k])));
      if(planned>15&&painted<planned*.2)clipped++;
     }
     check(visible>100,'crescent rendered enough pixels');check(outside===0,'crescent extends beyond viewport: '+outside);
     check(clipped<=Math.max(3,visible*.015),'arena clips crescent: '+clipped+'/'+visible);frames++;
    };
    performance.now=()=>now;Math.random=()=>.99;for(const key of Object.keys(avatars))delete avatars[key];g.cancel();g.monsters.length=0;
    const r=ROOM_BY_ROLE.waiting,a=avatars['Crescent|a']={key:'Crescent|a',proj:'Crescent',sid:'a',idx:84,role:'waiting',x:r.gx+2.5,y:r.gy+4.5,tx:r.gx+2.5,ty:r.gy+4.5},b=avatars['Crescent|b']={key:'Crescent|b',proj:'Crescent',sid:'b',idx:85,role:'waiting',x:r.gx+4.5,y:r.gy+4.5,tx:r.gx+4.5,ty:r.gy+4.5};
    state.sessionInfo[a.key]={tokens:1e9,state:'working',title:'전설검 검사'};state.sessionInfo[b.key]={tokens:1e9,state:'working',title:'큰 주민'};
    try{
     check(beginDuel(a,b,now),'legendary duel begins');const d=a.duel;check(!d.legendary,'ordinary duel');now=d.start+200;stepDuels(now);drawDuelSpotlight();
     const elementFor=g.elementFor;try{for(let element=0;element<5;element++)for(const p of [.04,.15,.45,.8]){g.elementFor=()=>element;now=d.start+(d.combat.finalAt+p*2.1)*1000;stepDuels(now);checking=true;drawDuelSpotlight();checking=false;}}finally{g.elementFor=elementFor;}
     endDuel(d);now+=70000;g.monsters.length=0;Math.random=()=>.01;const m=g.spawn('waiting');Math.random=()=>.99;check(g.begin(a,m),'normal battle begins');const fight=g.active;check(!fight.legendary,'normal finisher');
     for(let i=0;i<200&&!fight.done;i++){now+=100;g.step(now);}check(fight.done&&fight.won,'legendary boss battle resolves');
     for(let element=0;element<5;element++)for(const p of [.04,.15,.45,.8]){fight.element=element;now=fight.ended+p*2100;checking=true;g.drawBattle();checking=false;}
     check(frames===40,'five elements in both battle modes');g.cancel();return {width,unclippedFinishers:frames};
    } finally {performance.now=clock;Math.random=random;for(const[name,fn]of Object.entries(original))ctx[name]=fn;}
   },width));
  }
  return results;
 } finally {
  await page.evaluate(b=>{for(const k of Object.keys(localStorage))if(k.startsWith('codextown.')&&!Object.hasOwn(b,k))localStorage.removeItem(k);for(const[k,v]of Object.entries(b))localStorage.setItem(k,v);},backup);
  await page.unroute('**/events');await page.reload();
 }
}
