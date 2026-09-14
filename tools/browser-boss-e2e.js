async page => {
  const errors=[],onError=e=>errors.push(e.message),results=[];
  page.on('pageerror',onError);
  await page.goto('http://127.0.0.1:8869');
  const keys=['codextown.adventure','codextown.shop','codextown.shop.sessions'];
  const backup=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys);
  try {
    await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
    for(const width of [960,390]) {
      await page.setViewportSize({width,height:580});await page.reload();
      const result=await page.evaluate(width=>{
        const check=(ok,message)=>{if(!ok)throw Error(message);};
        cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
        for(const key of Object.keys(avatars))delete avatars[key];
        const game=townAdventure,random=Math.random,clock=performance.now;
        let now=clock.call(performance);Math.random=()=>.99;performance.now=()=>now;
        const bosses=[];
        try {
          game.cancel();game.monsters.length=0;
          for(let i=0;i<5;i++) {
            const sid=`boss-${width}-${i}`,key=`E2E|${sid}`,r=ROOM_BY_ROLE.waiting;
            const a=avatars[key]={key,proj:'E2E',sid,idx:84,role:'waiting',x:r.gx+3,y:r.gy+4,tx:r.gx+3,ty:r.gy+4};
            state.sessionInfo[key]={state:'working',tokens:1e9,title:'보스 전투 검사'};
            for(let j=0;j<8;j++)game.reward(a,true);
            game.buy('astral',key);game.buy('ironshield',key);game.buy('cape',key);
            const balance=game.balance(key),boss=game.spawn('waiting',true);
            check(game.begin(a,boss),'boss encounter starts');
            const b=game.active;b.legendary=false;
            check(b.maxHp>200,'real token HP and armor are used');
            now=b.next+1;game.step(now);game.drawBattle();
            check(b.monsterHp>0,'boss survives the first hit');
            now=b.counterAt+1;game.step(now);game.drawBattle();
            check(b.hp===b.maxHp-Math.max(1,b.monsterAttack-b.stats.defense),'boss attack uses its own stats');
            now+=170;game.drawBattle();
            for(let j=0;j<100&&!b.done;j++){now+=250;game.step(now);game.drawBattle();}
            check(b.done&&b.won,'equipped resident wins a complete battle');
            check(game.balance(key)===balance+8,'boss reward is eight stardust');
            now+=200;game.step(now);game.drawBattle();
            check(game.balance(key)===balance+8,'reward is only granted once');
            now+=4500;game.step(now);
            check(!game.active&&!game.monsters.includes(boss),'boss is removed after the reward');
            bosses.push(boss.name);delete avatars[key];game.monsters.length=0;
          }
          check(new Set(bosses).size===5,'five different bosses');
          return {width,bosses,completeBattles:5};
        } finally {Math.random=random;performance.now=clock;}
      },width);
      results.push(result);
    }
    if(errors.length)throw Error(errors.join('; '));
    return {results,errors};
  } finally {
    await page.evaluate(backup=>{for(const [key,value] of Object.entries(backup)){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}},backup);
    await page.unroute('**/events');await page.reload();page.off('pageerror',onError);
  }
}
