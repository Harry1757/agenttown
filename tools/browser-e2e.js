async page => {
  const results=[],errors=[];
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const onError=e=>errors.push(e.message);
  page.on('pageerror',onError);
  await page.goto('http://127.0.0.1:8869');
  const keys=['codextown.adventure','codextown.shop','codextown.shop.sessions'];
  const backup=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys);
  const fixture=()=>{
    cancelAnimationFrame(frameRequest);
    townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();
    const room=ROOM_BY_ROLE.waiting;
    for(const [key,idx,dx,title] of [['e2e-a',84,2,'아주 긴 작업 제목도 끝까지 확인하는 세션 · 장비 구매와 이동을 검증합니다'],['e2e-b',85,4,'두 번째 세션']]){
      avatars[key]={key,idx,role:'waiting',workRole:'waiting',proj:'E2E',sid:key,x:room.gx+dx,y:room.gy+4,homeX:room.gx+dx,homeY:room.gy+4,tx:room.gx+dx,ty:room.gy+4,face:1};
      state.sessionInfo[key]={title,state:'working',tokens:1000,mtime:Date.now()/1000};
    }
    window.dispatchEvent(new Event('town:sessions'));draw();cancelAnimationFrame(frameRequest);
  };
  try{
    await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
    await page.evaluate(()=>{localStorage.setItem('codextown.adventure',JSON.stringify({'e2e-a':{kills:200,bosses:0},'e2e-b':{kills:60,bosses:0}}));localStorage.removeItem('codextown.shop');localStorage.removeItem('codextown.shop.sessions');});
    await page.setViewportSize({width:960,height:580});await page.reload();await page.evaluate(fixture);
    const gap=await page.evaluate(()=>{const a=document.querySelector('#adventure-log summary').getBoundingClientRect(),b=document.querySelector('#open-stardust-shop').getBoundingClientRect();return b.left-a.right;});
    check(Math.abs(gap-6)<1,'Adventure/shop spacing');results.push('모험·상점 간격 6px');
    const point=await page.evaluate(()=>{const a=avatars['e2e-a'],r=cv.getBoundingClientRect(),P=TILE*layout.scale;return {x:r.x+(layout.offsetX+(a.x+.5)*P)/dpr,y:r.y+(layout.offsetY+(a.y+1)*P-TILE*spriteScaleFor(a,layout.scale)*.45)/dpr};});
    await page.evaluate(()=>{window.__focusCalls=[];window.codextown={focusSession:(...args)=>{window.__focusCalls.push(args);return Promise.resolve({ok:true});}};});
    await page.mouse.dblclick(point.x,point.y,{delay:300});await page.waitForTimeout(600);
    check(await page.evaluate(()=>window.__focusCalls.length===1),'Double click opens session exactly once');
    check(!await page.locator('#stardust-shop').evaluate(d=>d.open),'Double click leaves shop closed');
    await page.mouse.click(point.x,point.y);
    await page.waitForTimeout(600);
    check(!await page.locator('#stardust-shop').evaluate(d=>d.open),'Single click keeps shop closed');
    check(await page.evaluate(()=>townUI.selectedKey==='e2e-a'),'Single click selects session');
    await page.locator('#equipment-selected').click();
    check(await page.locator('#stardust-shop').evaluate(d=>d.open),'Detail button opens equipment');
    check(await page.locator('#shop-session').inputValue()==='e2e-a','Correct character selected');
    await page.getByRole('button',{name:'무기',exact:true}).click();
    await page.getByRole('button',{name:'기사의 검 구매',exact:true}).click();
    await page.getByRole('button',{name:'머리',exact:true}).click();
    await page.getByRole('button',{name:'별빛 왕관 구매',exact:true}).click();
    let snapshot=await page.evaluate(()=>({a:townAdventure.balance('e2e-a'),b:townAdventure.balance('e2e-b'),weapon:townAdventure.equippedFor('e2e-a','weapon'),head:townAdventure.equippedFor('e2e-a','head')}));
    check(snapshot.a===187&&snapshot.b===60&&snapshot.weapon==='steel'&&snapshot.head==='halo','Independent purchase and simultaneous slots');
    await page.locator('#shop-session').selectOption('e2e-b');
    await page.getByRole('button',{name:'무기',exact:true}).click();await page.getByRole('button',{name:'기사의 검 구매',exact:true}).click();
    check(await page.evaluate(()=>townAdventure.balance('e2e-b')===52&&townAdventure.balance('e2e-a')===187),'Second wallet isolation');
    await page.locator('#shop-session').selectOption('e2e-a');await page.getByRole('button',{name:'머리',exact:true}).click();await page.getByRole('button',{name:'별빛 왕관 해제',exact:true}).click();
    check(await page.evaluate(()=>townAdventure.equippedFor('e2e-a','head')===''&&townAdventure.equippedFor('e2e-a','weapon')==='steel'&&townAdventure.balance('e2e-a')===187),'Unequip only one slot');
    await page.keyboard.press('Escape');
    check(!await page.locator('#stardust-shop').evaluate(d=>d.open),'Escape closes dialog');
    check(await page.evaluate(()=>townUI.selectedKey==='e2e-a'),'Escape preserves selection');
    if(!await page.locator('#equipment-selected').isVisible())await page.locator('#mobile-roster').click();
    const buttons=await page.locator('.detail-actions button').evaluateAll(es=>es.map(e=>{const range=document.createRange();range.selectNodeContents(e);return {text:e.textContent,lines:range.getClientRects().length,overflow:e.scrollWidth>e.clientWidth};}));
    check(buttons.every(b=>b.lines===1&&!b.overflow),`Action button names fit: ${JSON.stringify(buttons)}`);results.push('캐릭터 클릭, 세션별 구매·교체·해제, Escape, 상세 버튼');
    await page.getByRole('button',{name:'장비 · 상점',exact:true}).click();
    for(const width of [960,820,780,680,621,620,390]){
      await page.setViewportSize({width,height:580});
      const checks=await page.evaluate(()=>{
        const selectors=['#stardust-shop','.shop-layout','.shop-catalog','.shop-character','.shop-categories'];
        const overflow=selectors.filter(s=>{const e=document.querySelector(s);return e.scrollWidth>e.clientWidth+1;});
        const parent=document.querySelector('.shop-categories').getBoundingClientRect();
        const cutTabs=[...document.querySelectorAll('.shop-categories button')].filter(e=>{const r=e.getBoundingClientRect();return r.left<parent.left-1||r.right>parent.right+1;}).length;
        const close=document.querySelector('.shop-close').getBoundingClientRect();
        return {overflow,cutTabs,closeVisible:close.top>=0&&close.right<=innerWidth};
      });
      check(!checks.overflow.length&&!checks.cutTabs&&checks.closeVisible,`Layout at ${width}: ${JSON.stringify(checks)}`);
    }
    results.push('390~960px 일곱 너비에서 가로 잘림·탭·닫기 버튼 확인');
    await page.setViewportSize({width:960,height:580});await page.reload();await page.evaluate(fixture);
    check(await page.evaluate(()=>townAdventure.balance('e2e-a')===187&&townAdventure.balance('e2e-b')===52&&townAdventure.equippedFor('e2e-a','weapon')==='steel'),'Persistence after reload');
    results.push('재실행 후 세션별 잔액·장비 유지');
    const travel=await page.evaluate(()=>{
      cancelAnimationFrame(frameRequest);townAdventure.cancel();townAdventure.monsters.length=0;
      const r=ROOM_BY_ROLE.waiting,a=avatars['e2e-fight']={key:'e2e-fight',idx:84,role:'waiting',workRole:'waiting',x:r.gx+3,y:r.gy+4,tx:r.gx+3,ty:r.gy+4,proj:'E2E',sid:'fight'};
      state.sessionInfo[a.key]={state:'working',tokens:0};
      const monster=townAdventure.spawn('waiting');
      if(!townAdventure.begin(a,monster))throw new Error('Start encounter');
      townAdventure.active.legendary=true;changeRoom(a,'research');const queued=a.role==='waiting'&&a.nextRole==='research';
      let now=performance.now();for(let i=0;i<30&&!townAdventure.active.done;i++){now+=500;townAdventure.step(now);}
      const completed=townAdventure.active.won&&a.role==='waiting';now+=5700;townAdventure.step(now);
      return {queued,completed,moved:a.role==='research'&&a.travelFrom==='waiting',reward:townAdventure.balance(a.key),level:monster.level};
    });
    check(travel.queued&&travel.completed&&travel.moved&&travel.reward===travel.level,`Battle/loot/departure: ${JSON.stringify(travel)}`);
    results.push('실제 전투 → 보상 1회 → 대기하던 방 이동');
    check(!errors.length,`Browser runtime errors: ${errors.join('; ')}`);
    return {passed:results,errors};
  }finally{
    await page.evaluate(backup=>{for(const [key,value] of Object.entries(backup)){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}},backup);
    await page.unroute('**/events');await page.reload();page.off('pageerror',onError);
  }
}
