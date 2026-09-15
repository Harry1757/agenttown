async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const results=[];
 for(const width of [960,390]){
  await page.setViewportSize({width,height:580});await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure);
  await page.evaluate(()=>{cancelAnimationFrame(frameRequest);townEvents.cancel();townAdventure.cancel();draw();});
  const dialog=page.locator('#town-journal'),open=page.locator('#open-town-journal');
  for(const native of [true,false]){
   await dialog.evaluate((d,native)=>d.setAttribute('closedby',native?'any':'closerequest'),native);
   await open.click();await page.locator('#town-journal-title').click();
   if(!await dialog.evaluate(d=>d.open))throw Error('inside click closed journal');
   const box=await dialog.boundingBox();await page.mouse.click(Math.max(1,box.x-6),box.y+box.height/2);
   await page.waitForFunction(()=>!document.getElementById('town-journal').open,{},{timeout:1500});
   if(!await open.evaluate(b=>document.activeElement===b))throw Error('focus not restored');
   await open.click();await page.keyboard.press('Escape');if(await dialog.evaluate(d=>d.open))throw Error('Escape failed');
   await open.click();await page.locator('.journal-close').click();if(await dialog.evaluate(d=>d.open))throw Error('close button failed');
   results.push({width,native,inside:true,outside:true,escape:true,closeButton:true});
  }
 }
 return results;
}
