async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
 await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure);
 await page.evaluate(()=>{cancelAnimationFrame(frameRequest);state.sessionInfo={'Board|a':{title:'리더보드 검증',state:'working',tokens:10000}};window.dispatchEvent(new Event('town:sessions'));});
 const results=[];
 for(const wins of [0,1]){
  if(wins)await page.evaluate(()=>townUI.recordWin({proj:'Board',sid:'a'}));
  for(const [width,height]of[[390,580],[960,580],[1440,900],[1440,500],[1100,580],[1101,580]]){
   await page.setViewportSize({width,height});
   for(const detail of [false,true]){
    await page.evaluate(detail=>{if(detail)townUI.select('Board|a');else{townUI.selectedKey=null;document.querySelector('.workspace').classList.remove('roster-open');window.dispatchEvent(new Event('town:sessions'));}},detail);
    const visible=[];for(const id of ['duel-leaders','duel-mini-leaders'])if(await page.locator('#'+id).isVisible())visible.push(id);
    if(visible.length!==1)throw Error('expected one leaderboard: '+JSON.stringify({width,height,wins,detail,visible}));
    const board=page.locator('#'+visible[0]);if(wins?await board.locator('button').count()!==1:!(await board.innerText()).includes('첫 승'))throw Error('missing ranking or empty state');
    results.push({width,height,wins,detail,board:visible[0]});
   }
  }
 }
 return {scenarios:results.length,results};
}
