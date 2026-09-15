async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
 await page.goto('http://127.0.0.1:8869');
 await page.waitForFunction(()=>window.townEvents&&SHEETS.dungeon.img);
 return page.evaluate(async()=>{
  cancelAnimationFrame(frameRequest);townUI.motionReduced=false;townUI.roomView='all';updateRoomView();fitCanvas();
  const g=townAdventure,e=townEvents,clock=performance.now;let now=1000000;performance.now=()=>now;
  const check=(ok,msg)=>{if(!ok)throw Error(msg);};
  for(const k of Object.keys(avatars))delete avatars[k];e.cancel();g.cancel();roomDuels.clear();
  const r=ROOM_BY_ROLE.waiting,people=[0,1].map(i=>{const key='Pause|'+i,a=avatars[key]={key,proj:'Pause',sid:''+i,idx:84+i,role:'waiting',x:r.gx+2.5+i*2,y:r.gy+4.5,tx:r.gx+2.5+i*2,ty:r.gy+4.5};state.sessionInfo[key]={title:'대기 검증 '+i,tokens:100000,state:'working'};return a;});
  g.monsters.length=0;const m=g.spawn('waiting',true),results=[];
  try{
   for(const name of ['shop','journal','roster']){
    const node=document.getElementById(name==='shop'?'stardust-shop':name==='journal'?'town-journal':'workspace');
    if(name==='roster'){node.classList.add('roster-open');document.getElementById('roster').classList.add('show-detail');}else node.showModal();
    await Promise.resolve();
    check(townUI.combatPaused(),name+' pauses');
    check(!g.begin(people[0],m),name+' blocks monster');
    check(!beginDuel(...people,now),name+' blocks duel');
    check(!e.startRaid(people),name+' blocks raid');
    now+=10000;check(townUI.combatPaused(),name+' remains paused');
    if(name==='roster')node.classList.remove('roster-open');else node.close();
    document.activeElement?.blur();await Promise.resolve();
    now+=2999;check(townUI.combatPaused(),name+' grace');now+=2;check(!townUI.combatPaused(),name+' resumes');results.push(name);if(name==='roster')document.getElementById('roster').classList.remove('show-detail');
   }
   check(g.begin(people[0],m),'monster resumes');
   document.getElementById('stardust-shop').showModal();await Promise.resolve();
   const fight=g.active;now=fight.next;g.step(now);check(g.active===fight&&fight.round===1,'existing combat continues');
   document.getElementById('stardust-shop').close();document.activeElement?.blur();await Promise.resolve();now+=4000;g.cancel();now+=21000;
   check(beginDuel(...people,now),'duel resumes');endDuel(people[0].duel);
   check(e.startRaid(people),'raid resumes');
   return {blockedIn:results,modes:3,resumeDelayMs:3000,existingFightContinues:true};
  }finally{e.cancel();g.cancel();performance.now=clock;}
 });
}
