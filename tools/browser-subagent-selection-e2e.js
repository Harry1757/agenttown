async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const results=[];
 for(const width of [960,1440])for(const sub of [false,true]){
  await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure&&SHEETS.dungeon.img);
  const point=await page.evaluate(sub=>{
   cancelAnimationFrame(frameRequest);townUI.roomView='all';townUI.motionReduced=false;updateRoomView();fitCanvas();for(const k of Object.keys(avatars))delete avatars[k];state.sessionInfo={};
   const sk='Selection|worker',key=sk+(sub?':sub':''),r=ROOM_BY_ROLE.waiting;
   const a=avatars[key]={key,proj:'Selection',sid:'worker',sub,idx:84,role:'waiting',workRole:'waiting',x:r.gx+3,y:r.gy+4,tx:r.gx+3,ty:r.gy+4,face:1};
   state.sessionInfo[sk]={title:sub?'보조 세션 상세 검사':'일반 세션 상세 검사',state:'working',sub,tokens:1000};
   window.__focusCalls=[];window.codextown={focusSession:(...args)=>{window.__focusCalls.push(args);return Promise.resolve({ok:true});}};
   window.dispatchEvent(new Event('town:sessions'));draw();cancelAnimationFrame(frameRequest);
   const rect=cv.getBoundingClientRect(),P=TILE*layout.scale;return{x:rect.x+(layout.offsetX+(a.x+.5)*P)/dpr,y:rect.y+(layout.offsetY+(a.y+1)*P-TILE*spriteScaleFor(a,layout.scale)*.45)/dpr};
  },sub);
  await page.mouse.click(point.x,point.y);await page.waitForTimeout(650);
  if(!await page.locator('#task-detail').isVisible())throw Error('Click lost detail '+width+'/'+sub);
  if(await page.locator('#task-detail h3').textContent()!==(sub?'보조 세션 상세 검사':'일반 세션 상세 검사'))throw Error('Wrong detail');
  await page.evaluate(()=>window.dispatchEvent(new Event('town:sessions')));
  if(await page.evaluate(()=>townUI.selectedKey)!=='Selection|worker')throw Error('Refresh cleared selection');
  await page.locator('#equipment-selected').click();if(await page.locator('#shop-session').inputValue()!=='Selection|worker'+(sub?':sub':''))throw Error('Shop chose wrong actor');
  if(await page.locator('.shop-session-title').textContent()!==(sub?'보조 세션 상세 검사':'일반 세션 상세 검사'))throw Error('Shop lost title');
  await page.keyboard.press('Escape');await page.locator('#open-stardust-shop').click();if(await page.locator('#shop-session').inputValue()!=='Selection|worker'+(sub?':sub':''))throw Error('Map shop chose wrong actor');await page.keyboard.press('Escape');if(!await page.locator('#locate-selected').isVisible())await page.locator('#mobile-roster').click();await page.locator('#locate-selected').click();
  if(!await page.evaluate(()=>cam.userAdjusted))throw Error('Locate missed actor');
  results.push({width,sub,detail:true,shop:true,locate:true});
 }
 return results;
}
